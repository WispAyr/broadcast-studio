import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Bingo flashboard — the big screen face for a live bingo game.
 *
 * Dumb by design: it hydrates once from `/api/bingo/:gameId` and then follows
 * the `bingo_update` socket event (the SERVER is the authority — see
 * server/src/routes/bingo.js). Because it owns its own socket subscription and
 * local state (rather than riding the generic module-config channel), a new
 * call updates in place and the hero number animates instead of remounting.
 *
 * Self-adapting: measures its slot and lays out landscape (hero beside board)
 * or portrait (hero above board), so one layout drives every screen regardless
 * of orientation.
 *
 * Variants: '90' (UK, 9×10 flashboard) and '75' (US, B-I-N-G-O columns).
 */

// Traditional UK 90-ball calls — a warm touch on the hero. Toggle with config.showCalls.
const CALLS_90 = {
  1: "Kelly's eye", 2: 'One little duck', 3: 'Cup of tea', 4: 'Knock at the door',
  5: 'Man alive', 6: 'Half a dozen', 7: 'Lucky seven', 8: 'Garden gate',
  9: 'Doctor’s orders', 10: '(Boris’s) den', 11: 'Legs eleven', 12: 'One dozen',
  13: 'Unlucky for some', 14: 'Valentine’s day', 15: 'Young and keen', 16: 'Sweet sixteen',
  17: 'Dancing queen', 18: 'Coming of age', 19: 'Goodbye teens', 20: 'One score',
  21: 'Key of the door', 22: 'Two little ducks', 23: 'Thee and me', 24: 'Two dozen',
  25: 'Duck and dive', 26: 'Half a crown', 27: 'Gateway to heaven', 28: 'In a state',
  29: 'Rise and shine', 30: 'Dirty Gertie', 31: 'Get up and run', 32: 'Buckle my shoe',
  33: 'Dirty knee', 34: 'Ask for more', 35: 'Jump and jive', 36: 'Three dozen',
  37: 'More than eleven', 38: 'Christmas cake', 39: 'Steps', 40: 'Life begins',
  41: 'Time for fun', 42: 'Winnie the Pooh', 43: 'Down on your knees', 44: 'Droopy drawers',
  45: 'Halfway there', 46: 'Up to tricks', 47: 'Four and seven', 48: 'Four dozen',
  49: 'PC', 50: 'Half a century', 51: 'Tweak of the thumb', 52: 'Danny La Rue',
  53: 'Stuck in the tree', 54: 'Clean the floor', 55: 'Snakes alive', 56: 'Was she worth it?',
  57: 'Heinz varieties', 58: 'Make them wait', 59: 'Brighton line', 60: 'Five dozen',
  61: 'Baker’s bun', 62: 'Tickety-boo', 63: 'Tickle me', 64: 'Almost retired',
  65: 'Old age pension', 66: 'Clickety click', 67: 'Made in heaven', 68: 'Saving grace',
  69: 'Favourite of mine', 70: 'Three score and ten', 71: 'Bang on the drum',
  72: 'Six dozen', 73: 'Queen bee', 74: 'Hit the floor', 75: 'Strive and strive',
  76: 'Trombones', 77: 'Sunset strip', 78: 'Heaven’s gate', 79: 'One more time',
  80: 'Gandhi’s breakfast', 81: 'Stop and run', 82: 'Straight on through',
  83: 'Time for tea', 84: 'Seven dozen', 85: 'Staying alive', 86: 'Between the sticks',
  87: 'Torquay in Devon', 88: 'Two fat ladies', 89: 'Nearly there', 90: 'Top of the shop',
};

const PHASE_LABEL = {
  eyes_down: 'Eyes down',
  one_line: 'One line',
  two_lines: 'Two lines',
  full_house: 'Full house',
  winner: 'We have a winner!',
};

// Named brand packs. `generic` ships now; swap Pavilion assets in later (or push
// inline overrides from the caller console via config.branding).
const BRANDS = {
  generic: {
    name: 'BINGO',
    bg: 'radial-gradient(120% 120% at 50% 0%, #172554 0%, #0b1220 60%, #060a14 100%)',
    panel: 'rgba(255,255,255,0.04)',
    accent: '#f8b500',      // ball / called-number gold
    accent2: '#38bdf8',
    text: '#ffffff',
    logo: null,
  },
  pavilion: {
    name: 'AYR PAVILION BINGO',
    bg: 'radial-gradient(120% 120% at 50% 0%, #3b0764 0%, #1e1035 60%, #0a0616 100%)',
    panel: 'rgba(255,255,255,0.05)',
    accent: '#e11d63',
    accent2: '#f8b500',
    text: '#ffffff',
    logo: null,               // drop /brands/pavilion/logo.png here later
  },
};

function resolveBrand(state, config) {
  const base = BRANDS[state.brand] || BRANDS[config.brand] || BRANDS.generic;
  const ov = state.branding || config.branding || null;
  if (!ov) return base;
  return {
    ...base,
    name: ov.title || ov.name || base.name,
    bg: ov.bg || base.bg,
    accent: ov.accent || base.accent,
    accent2: ov.accent2 || base.accent2,
    logo: ov.logo || base.logo,
  };
}

// Column letter for a 75-ball number (B 1-15, I 16-30, N 31-45, G 46-60, O 61-75)
function letter75(n) {
  return ['B', 'I', 'N', 'G', 'O'][Math.floor((n - 1) / 15)] || '';
}

export default function BingoModule({ config = {} }) {
  const gameId = config.gameId || config.game || 'pavilion';
  const showCalls = config.showCalls !== false; // 90-ball nicknames on by default
  const containerRef = useRef(null);

  const [state, setState] = useState(() => ({
    variant: config.variant ? String(config.variant) : '90',
    max: 90, drawn: [], current: null, previous: null, recent: [],
    count: 0, remaining: 90, phase: 'eyes_down',
    brand: config.brand || 'generic', branding: config.branding || null,
  }));
  const [portrait, setPortrait] = useState(false);
  const [flash, setFlash] = useState(0);
  const lastCurrent = useRef(null);

  // Hydrate once, then follow the socket
  useEffect(() => {
    let alive = true;
    fetch(`/api/bingo/${encodeURIComponent(gameId)}`)
      .then(r => r.json())
      .then(s => { if (alive && s && !s.error) setState(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, [gameId]);

  useEffect(() => {
    let socket;
    let cleanup = () => {};
    import('../lib/socket').then(({ getSocket, connectSocket }) => {
      socket = getSocket() || null;
      if (!socket) socket = connectSocket();
      if (!socket) return;
      if (!socket.connected) socket.connect();
      const onUpdate = (payload) => {
        if (!payload || payload.gameId !== gameId) return;
        if (payload.state) setState(payload.state);
      };
      socket.on('bingo_update', onUpdate);
      cleanup = () => socket.off('bingo_update', onUpdate);
    });
    return () => cleanup();
  }, [gameId]);

  // Pulse the hero whenever the current ball changes
  useEffect(() => {
    if (state.current != null && state.current !== lastCurrent.current) {
      lastCurrent.current = state.current;
      setFlash(f => f + 1);
    }
  }, [state.current]);

  // Measure orientation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setPortrait(h > w * 1.05);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const brand = useMemo(() => resolveBrand(state, config), [state.brand, state.branding, config.brand]);
  const is75 = state.variant === '75';
  const drawnSet = useMemo(() => new Set(state.drawn), [state.drawn]);

  // Board grid geometry
  const board = useMemo(() => {
    if (is75) {
      // 5 columns B-I-N-G-O, 15 rows
      const cols = [];
      for (let c = 0; c < 5; c++) {
        const col = [];
        for (let r = 0; r < 15; r++) col.push(c * 15 + r + 1);
        cols.push(col);
      }
      return { cols };
    }
    // 90-ball flashboard: 9 rows × 10 cols (1-10, 11-20, … 81-90)
    const rows = [];
    for (let r = 0; r < 9; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) row.push(r * 10 + c + 1);
      rows.push(row);
    }
    return { rows };
  }, [is75]);

  const heroLetter = is75 && state.current != null ? letter75(state.current) : '';
  const callText = !is75 && showCalls && state.current != null ? CALLS_90[state.current] : '';

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        background: brand.bg, color: brand.text,
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex', flexDirection: portrait ? 'column' : 'row',
      }}
    >
      <style>{`
        @keyframes bingoPop { 0% { transform: scale(0.4); opacity: 0; }
          55% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes bingoGlow { 0%,100% { box-shadow: 0 0 0 0 var(--bg-accent-a); }
          50% { box-shadow: 0 0 26px 6px var(--bg-accent-a); } }
      `}</style>

      {/* ── Hero: current number ─────────────────────────────── */}
      <div style={{
        flex: portrait ? '0 0 34%' : '0 0 38%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2%', position: 'relative', minWidth: 0, minHeight: 0,
        borderRight: portrait ? 'none' : '1px solid rgba(255,255,255,0.08)',
        borderBottom: portrait ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}>
        <div style={{
          fontSize: portrait ? '2.2vw' : '1.5vw', letterSpacing: '0.25em', fontWeight: 800,
          textTransform: 'uppercase', opacity: 0.7, marginBottom: '0.4em', textAlign: 'center',
        }}>
          {brand.logo
            ? <img src={brand.logo} alt="" style={{ maxHeight: portrait ? '8vh' : '10vh', maxWidth: '90%' }} />
            : brand.name}
        </div>

        {state.current == null ? (
          <div style={{ textAlign: 'center', opacity: 0.55, fontSize: portrait ? '4vw' : '3.2vw', fontWeight: 800 }}>
            EYES DOWN
          </div>
        ) : (
          <div
            key={flash}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              animation: 'bingoPop 0.55s cubic-bezier(.2,1.3,.35,1) both',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.12em',
              lineHeight: 0.9,
            }}>
              {heroLetter && (
                <span style={{ fontSize: portrait ? '10vw' : '9vw', fontWeight: 900, color: brand.accent2 }}>
                  {heroLetter}
                </span>
              )}
              <span style={{
                fontSize: portrait ? '26vw' : '18vw', fontWeight: 900, color: brand.accent,
                textShadow: `0 0 40px ${brand.accent}66`,
              }}>
                {state.current}
              </span>
            </div>
            {callText && (
              <div style={{
                marginTop: '0.3em', fontSize: portrait ? '3.4vw' : '2.4vw', fontWeight: 700,
                fontStyle: 'italic', opacity: 0.9, textAlign: 'center', maxWidth: '95%',
              }}>
                “{callText}”
              </div>
            )}
          </div>
        )}

        {/* Recent balls */}
        <div style={{ display: 'flex', gap: '0.5vw', marginTop: '2vh', flexWrap: 'wrap', justifyContent: 'center' }}>
          {state.recent.slice(1, 6).map((n, i) => (
            <div key={`${n}-${i}`} style={{
              width: portrait ? '7vw' : '3.4vw', height: portrait ? '7vw' : '3.4vw',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              fontWeight: 800, fontSize: portrait ? '3vw' : '1.5vw', opacity: 1 - i * 0.14,
            }}>
              {is75 ? `${letter75(n)}${n}` : n}
            </div>
          ))}
        </div>
      </div>

      {/* ── Flashboard ───────────────────────────────────────── */}
      <div style={{
        flex: '1 1 auto', display: 'flex', flexDirection: 'column',
        padding: portrait ? '2% 3%' : '1.6% 2%', minWidth: 0, minHeight: 0,
      }}>
        <div style={{
          flex: '1 1 auto', display: 'flex',
          flexDirection: is75 ? 'row' : 'column',
          gap: is75 ? '1%' : '0.9%', minHeight: 0,
        }}>
          {is75
            ? board.cols.map((col, ci) => (
                <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3%', minWidth: 0 }}>
                  <div style={{
                    textAlign: 'center', fontWeight: 900, fontSize: portrait ? '5vw' : '2.6vw',
                    color: brand.accent2, marginBottom: '2%',
                  }}>{['B', 'I', 'N', 'G', 'O'][ci]}</div>
                  {col.map(n => <Cell key={n} n={n} on={drawnSet.has(n)} cur={n === state.current} brand={brand} />)}
                </div>
              ))
            : board.rows.map((row, ri) => (
                <div key={ri} style={{ flex: 1, display: 'flex', gap: '0.9%', minHeight: 0 }}>
                  {row.map(n => <Cell key={n} n={n} on={drawnSet.has(n)} cur={n === state.current} brand={brand} />)}
                </div>
              ))}
        </div>

        {/* Footer: phase + tallies */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: portrait ? '2vh' : '1.4vh', gap: '2vw',
        }}>
          <div style={{
            padding: '0.5vh 1.4vw', borderRadius: '999px', background: brand.accent,
            color: '#0b1220', fontWeight: 900, fontSize: portrait ? '3.4vw' : '1.9vw',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {PHASE_LABEL[state.phase] || state.phase}
          </div>
          <div style={{ display: 'flex', gap: '2.4vw', fontWeight: 800, opacity: 0.9 }}>
            <span style={{ fontSize: portrait ? '3.4vw' : '1.9vw' }}>
              <span style={{ color: brand.accent }}>{state.count}</span> called
            </span>
            <span style={{ fontSize: portrait ? '3.4vw' : '1.9vw', opacity: 0.65 }}>
              {state.remaining} left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ n, on, cur, brand }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0, borderRadius: '18%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800,
      fontSize: 'clamp(10px, 2.4vw, 44px)',
      background: on ? brand.accent : 'rgba(255,255,255,0.045)',
      color: on ? '#0b1220' : 'rgba(255,255,255,0.45)',
      border: cur ? `2px solid ${brand.accent2}` : '1px solid rgba(255,255,255,0.07)',
      transition: 'background 0.25s ease, color 0.25s ease',
      '--bg-accent-a': `${brand.accent2}cc`,
      animation: cur ? 'bingoGlow 1.2s ease-in-out infinite' : 'none',
    }}>
      {n}
    </div>
  );
}
