/**
 * SidelinersModule — the on-air graphics package for "SideLiner's",
 * NOW Ayrshire Radio's sports show with Scott Watson.
 *
 * One module, many full-frame `variant`s sharing one brand language:
 *   skewed parallelogram panels, purple→navy gradient, gold accent,
 *   condensed italic Oswald type — matching the SideLiner's logo lockup.
 *
 * Variants (config.variant):
 *   ident_open    — show opener / title build
 *   ident_close   — end card
 *   sponsor       — "in association with…" (Kilmarnock FC)
 *   break         — "back after this" bumper
 *   coming_up     — run-of-show list (config.items[])
 *   talking_point — today's big topic (config.title / lines[])
 *   score         — full-frame score bug (home/away/score/competition/minute)
 *   fixtures      — fixture list (config.items[]: {home,away,time})
 *   results       — results list  (config.items[]: {home,away,score})
 *   table         — mini league table (config.rows[]: {pos,team,pl,pts,hl})
 *   poll          — vote graphic  (config.question, config.options[]: {label,pct})
 *
 * All client-rendered (CSS animation) — no external render server needed, so it
 * plays reliably on the kiosk screens. Sizing is viewport-relative (cqw/cqh) as
 * these are designed as full-frame scenes.
 */
import React, { useRef, useState, useLayoutEffect } from 'react';

const NAVY = '#241a40';
const NAVY2 = '#171026';
const PURPLE = '#7a2f9e';
const PURPLE_HI = '#a44ad0';
const GOLD = '#ffd24a';
const HEAD = "'Oswald','Rajdhani',sans-serif";

const KEYS = `
@keyframes slIn   { from { opacity:0; transform:translateY(40px) skewX(-12deg);} to { opacity:1; transform:translateY(0) skewX(-12deg);} }
@keyframes slInUp { from { opacity:0; transform:translateY(60px);} to { opacity:1; transform:translateY(0);} }
@keyframes slWipe { from { transform:translateX(-120%) skewX(-12deg);} to { transform:translateX(0) skewX(-12deg);} }
@keyframes slFade { from { opacity:0;} to { opacity:1;} }
@keyframes slPop  { 0%{opacity:0;transform:scale(0.6);} 60%{transform:scale(1.08);} 100%{opacity:1;transform:scale(1);} }
@keyframes slBar  { from { width:0;} }
@keyframes slShine{ 0%{transform:translateX(-150%) skewX(-20deg);opacity:0.45;} 80%{opacity:0.45;} 100%{transform:translateX(650%) skewX(-20deg);opacity:0;} }
@keyframes slPulse{ 0%,100%{opacity:1;} 50%{opacity:0.45;} }
`;

// Skewed parallelogram panel — the core brand shape.
function Panel({ children, bg = PURPLE, style = {}, anim = 'slIn', delay = 0 }) {
  return (
    <div style={{
      display: 'inline-block', transform: 'skewX(-12deg)', background: bg,
      padding: '1.4cqh 3.2cqw', boxShadow: '0 1.2cqh 4cqh rgba(0,0,0,0.45)',
      animation: `${anim} 0.7s cubic-bezier(.2,.8,.2,1) ${delay}s both`, ...style,
    }}>
      <div style={{ transform: 'skewX(12deg)' }}>{children}</div>
    </div>
  );
}

// Renders a fixed 1920×1080 stage scaled to fit the module's real container.
// cqw/cqh resolve against the explicit-size stage, so graphics look identical
// whether the screen uses fit-to-screen or fills the viewport, at any res.
function Bg({ children, from = NAVY, to = NAVY2 }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      // Use the UNtransformed layout size (clientWidth/Height), not
      // getBoundingClientRect — under fit-to-screen the parent is already
      // scaled, and measuring the transformed box double-shrinks the stage.
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h) setScale(Math.min(w / 1920, h / 1080));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: to, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="sl-stage" style={{
        width: 1920, height: 1080, flex: 'none', transform: `scale(${scale})`, transformOrigin: 'center',
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${from} 0%, ${to} 70%)`, color: '#fff',
        fontFamily: HEAD, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <style>{`.sl-stage{container-type:size;}` + KEYS}</style>
        {/* brand diagonal sheen */}
        <div style={{ position: 'absolute', inset: 0, background:
          `repeating-linear-gradient(115deg, transparent 0 7cqw, rgba(255,255,255,0.018) 7cqw 7.2cqw)`, pointerEvents: 'none' }} />
        {children}
      </div>
    </div>
  );
}

function Logo({ url, h = '11cqh', style = {} }) {
  if (!url) return null;
  return <img src={url} alt="SideLiner's" style={{ height: h, filter: 'drop-shadow(0 0.6cqh 1.4cqh rgba(0,0,0,0.5))', ...style }} />;
}

function Wordmark({ size = '7cqh' }) {
  return (
    <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: size, letterSpacing: '0.01em', color: '#fff', lineHeight: 1 }}>
      Side<span style={{ color: GOLD }}>Liner's</span>
    </span>
  );
}

// Gold kicker tab
function Kicker({ children, delay = 0 }) {
  return (
    <Panel bg={GOLD} anim="slWipe" delay={delay} style={{ padding: '0.5cqh 1.8cqw' }}>
      <span style={{ color: NAVY, fontWeight: 700, fontSize: '2.1cqh', letterSpacing: '0.22em', textTransform: 'uppercase' }}>{children}</span>
    </Panel>
  );
}

export default function SidelinersModule({ config = {} }) {
  const v = config.variant || 'ident_open';
  const logo = config.logoUrl || config.logo || '';
  const items = config.items || [];

  switch (v) {
    // ── Show opener ──
    case 'ident_open':
      return (
        <Bg>
          <div style={{ padding: '0 8cqw' }}>
            <div style={{ animation: 'slInUp 0.7s ease-out both' }}><Kicker delay={0.1}>NOW Ayrshire Radio</Kicker></div>
            <div style={{ marginTop: '2cqh', fontStyle: 'italic', fontWeight: 700, fontSize: '16cqh', lineHeight: 0.92,
              animation: 'slPop 0.8s cubic-bezier(.2,.9,.2,1) 0.2s both', position: 'relative' }}>
              Side<span style={{ color: GOLD }}>Liner's</span>
              <span style={{ position: 'absolute', top: 0, left: 0, width: '14cqw', height: '100%', background: 'rgba(255,255,255,0.35)', animation: 'slShine 1.1s ease-in 0.9s both' }} />
            </div>
            <div style={{ marginTop: '1cqh', animation: 'slInUp 0.7s ease-out 0.5s both' }}>
              <span style={{ fontSize: '4.6cqh', fontWeight: 600, letterSpacing: '0.04em' }}>Ayrshire's Best Sports Show</span>
            </div>
            <div style={{ marginTop: '2.4cqh', animation: 'slInUp 0.7s ease-out 0.7s both' }}>
              <Panel bg={PURPLE} delay={0.7}><span style={{ fontSize: '3cqh', fontWeight: 600, letterSpacing: '0.06em' }}>with {config.host || 'Scott Watson'}</span></Panel>
            </div>
          </div>
        </Bg>
      );

    // ── End card ──
    case 'ident_close':
      return (
        <Bg>
          <div style={{ textAlign: 'center', animation: 'slFade 0.8s ease-out both' }}>
            {logo ? <Logo url={logo} h="22cqh" /> : <Wordmark size="14cqh" />}
            <div style={{ marginTop: '3cqh', fontSize: '4cqh', fontWeight: 600, animation: 'slInUp 0.7s ease-out 0.3s both' }}>{config.title || 'Thanks for listening'}</div>
            <div style={{ marginTop: '1cqh', color: PURPLE_HI, fontSize: '2.6cqh', letterSpacing: '0.1em', animation: 'slInUp 0.7s ease-out 0.5s both' }}>
              {config.subtitle || 'Same time next week · NOW Ayrshire Radio'}
            </div>
          </div>
        </Bg>
      );

    // ── Sponsor ──
    case 'sponsor':
      return (
        <Bg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ animation: 'slInUp 0.6s ease-out both' }}><Wordmark size="9cqh" /></div>
            <div style={{ marginTop: '3cqh', fontSize: '3cqh', letterSpacing: '0.28em', color: PURPLE_HI, textTransform: 'uppercase', animation: 'slFade 0.7s ease-out 0.3s both' }}>
              In association with
            </div>
            <div style={{ marginTop: '2.2cqh', display: 'flex', justifyContent: 'center', animation: 'slPop 0.8s cubic-bezier(.2,.9,.2,1) 0.5s both' }}>
              {config.sponsorLogo
                ? <img src={config.sponsorLogo} alt={config.sponsor || ''} style={{ height: '20cqh' }} />
                : <Panel bg="#fff"><span style={{ color: '#003a70', fontWeight: 800, fontSize: '7cqh', letterSpacing: '0.04em' }}>{config.sponsor || 'Kilmarnock FC'}</span></Panel>}
            </div>
          </div>
        </Bg>
      );

    // ── Break bumper ──
    case 'break':
      return (
        <Bg from="#2a1550" to={NAVY2}>
          <div style={{ padding: '0 8cqw' }}>
            <div style={{ animation: 'slInUp 0.6s ease-out both' }}><Kicker>Don't go anywhere</Kicker></div>
            <div style={{ marginTop: '2cqh', fontStyle: 'italic', fontWeight: 700, fontSize: '13cqh', lineHeight: 0.95, animation: 'slInUp 0.7s ease-out 0.2s both' }}>
              Back after <span style={{ color: GOLD }}>this</span>
            </div>
            <div style={{ marginTop: '2cqh', fontSize: '3cqh', fontWeight: 500, color: PURPLE_HI, animation: 'slFade 0.7s ease-out 0.5s both' }}>
              {config.subtitle || 'More sport, more shouts — stay with us'}
            </div>
          </div>
          {logo && <Logo url={logo} h="9cqh" style={{ position: 'absolute', bottom: '5cqh', right: '5cqw' }} />}
        </Bg>
      );

    // ── Coming up / run of show ──
    case 'coming_up':
      return (
        <Bg>
          <div style={{ padding: '0 7cqw' }}>
            <Kicker>Coming up on the show</Kicker>
            <div style={{ marginTop: '3cqh' }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2cqw', marginBottom: '1.8cqh', animation: `slInUp 0.6s ease-out ${0.15 + i * 0.12}s both` }}>
                  <span style={{ color: GOLD, fontWeight: 700, fontSize: '4cqh', minWidth: '3cqw' }}>{String(i + 1).padStart(2, '0')}</span>
                  <Panel bg={i === 0 ? PURPLE : 'rgba(122,47,158,0.45)'} style={{ flex: 1 }}>
                    <span style={{ fontSize: '3.6cqh', fontWeight: 600 }}>{typeof it === 'string' ? it : it.title}</span>
                  </Panel>
                </div>
              ))}
            </div>
          </div>
        </Bg>
      );

    // ── Talking point ──
    case 'talking_point':
      return (
        <Bg>
          <div style={{ padding: '0 8cqw' }}>
            <div style={{ animation: 'slInUp 0.5s ease-out both' }}><Kicker>Today on SideLiner's</Kicker></div>
            <div style={{ marginTop: '2.5cqh', fontStyle: 'italic', fontWeight: 700, fontSize: '9cqh', lineHeight: 1.02, animation: 'slInUp 0.7s ease-out 0.2s both' }}>
              {config.title || 'The big talking point'}
            </div>
            {config.subtitle && <div style={{ marginTop: '2cqh', fontSize: '3.4cqh', color: PURPLE_HI, fontWeight: 500, animation: 'slFade 0.7s ease-out 0.5s both' }}>{config.subtitle}</div>}
          </div>
        </Bg>
      );

    // ── Full-frame score bug ──
    case 'score': {
      const home = config.home || 'KILMARNOCK';
      const away = config.away || 'RANGERS';
      const score = config.score || '0 - 0';
      return (
        <Bg>
          <div style={{ textAlign: 'center' }}>
            {config.competition && <div style={{ animation: 'slFade 0.6s both', marginBottom: '3cqh' }}><Kicker>{config.competition}</Kicker></div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3cqw' }}>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: '7cqh', animation: 'slIn 0.6s ease-out 0.1s both', display: 'inline-block', transform: 'skewX(-12deg)' }}><span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{home}</span></span>
              <div style={{ animation: 'slPop 0.7s cubic-bezier(.2,.9,.2,1) 0.2s both' }}>
                <Panel bg={GOLD}><span style={{ color: NAVY, fontWeight: 800, fontSize: '11cqh', letterSpacing: '0.02em' }}>{score}</span></Panel>
              </div>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: '7cqh', animation: 'slIn 0.6s ease-out 0.1s both', display: 'inline-block', transform: 'skewX(-12deg)' }}><span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{away}</span></span>
            </div>
            {config.minute && <div style={{ marginTop: '3cqh', color: PURPLE_HI, fontSize: '3cqh', letterSpacing: '0.2em', animation: 'slFade 0.6s 0.4s both' }}>{config.minute}</div>}
          </div>
        </Bg>
      );
    }

    // ── Fixtures / Results list ──
    case 'fixtures':
    case 'results': {
      const isRes = v === 'results';
      return (
        <Bg>
          <div style={{ padding: '0 7cqw' }}>
            <Kicker>{config.title || (isRes ? 'Results' : 'Fixtures')}</Kicker>
            <div style={{ marginTop: '3cqh' }}>
              {items.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '1.3cqh 0', borderBottom: '1px solid rgba(255,255,255,0.08)', animation: `slInUp 0.5s ease-out ${0.1 + i * 0.08}s both` }}>
                  <span style={{ flex: 1, textAlign: 'right', fontSize: '3.4cqh', fontWeight: 600 }}>{m.home}</span>
                  <span style={{ margin: '0 2cqw', minWidth: '6cqw', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', transform: 'skewX(-12deg)', background: isRes ? PURPLE : 'rgba(255,255,255,0.12)', padding: '0.4cqh 1.4cqw', fontWeight: 700, fontSize: '3.4cqh', color: isRes ? '#fff' : GOLD }}>
                      <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>{isRes ? (m.score || '0-0') : (m.time || 'TBC')}</span>
                    </span>
                  </span>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: '3.4cqh', fontWeight: 600 }}>{m.away}</span>
                </div>
              ))}
            </div>
          </div>
        </Bg>
      );
    }

    // ── Mini league table ──
    case 'table': {
      const rows = config.rows || [];
      return (
        <Bg>
          <div style={{ padding: '0 9cqw' }}>
            <Kicker>{config.title || 'League Table'}</Kicker>
            <div style={{ marginTop: '2.5cqh' }}>
              <div style={{ display: 'flex', color: PURPLE_HI, fontSize: '2cqh', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 1.5cqw 1cqh' }}>
                <span style={{ width: '4cqw' }}>#</span><span style={{ flex: 1 }}>Team</span><span style={{ width: '6cqw', textAlign: 'center' }}>Pl</span><span style={{ width: '6cqw', textAlign: 'center' }}>Pts</span>
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '1.2cqh 1.5cqw', background: r.hl ? 'rgba(255,210,74,0.14)' : (i % 2 ? 'rgba(255,255,255,0.04)' : 'transparent'),
                  borderLeft: r.hl ? `0.5cqw solid ${GOLD}` : '0.5cqw solid transparent', animation: `slInUp 0.5s ease-out ${0.1 + i * 0.07}s both` }}>
                  <span style={{ width: '4cqw', fontWeight: 700, color: GOLD, fontSize: '3cqh' }}>{r.pos ?? i + 1}</span>
                  <span style={{ flex: 1, fontSize: '3cqh', fontWeight: 600 }}>{r.team}</span>
                  <span style={{ width: '6cqw', textAlign: 'center', fontSize: '3cqh' }}>{r.pl ?? ''}</span>
                  <span style={{ width: '6cqw', textAlign: 'center', fontSize: '3cqh', fontWeight: 700 }}>{r.pts ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        </Bg>
      );
    }

    // ── Poll / vote ──
    case 'poll': {
      const opts = config.options || [];
      return (
        <Bg>
          <div style={{ padding: '0 8cqw' }}>
            <Kicker>{config.label || 'Your shout — vote now'}</Kicker>
            <div style={{ marginTop: '2.5cqh', fontStyle: 'italic', fontWeight: 700, fontSize: '6cqh', lineHeight: 1.05 }}>{config.question || ''}</div>
            <div style={{ marginTop: '3cqh' }}>
              {opts.map((o, i) => (
                <div key={i} style={{ marginBottom: '2cqh', animation: `slInUp 0.5s ease-out ${0.15 + i * 0.12}s both` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '3.2cqh', fontWeight: 600, marginBottom: '0.6cqh' }}>
                    <span>{o.label}</span><span style={{ color: GOLD }}>{o.pct ?? 0}%</span>
                  </div>
                  <div style={{ height: '2.4cqh', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', transform: 'skewX(-12deg)' }}>
                    <div style={{ height: '100%', width: `${o.pct ?? 0}%`, background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_HI})`, animation: `slBar 1s ease-out ${0.3 + i * 0.12}s both` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Bg>
      );
    }

    default:
      return (
        <Bg>
          <div style={{ textAlign: 'center' }}><Wordmark size="12cqh" /></div>
        </Bg>
      );
  }
}
