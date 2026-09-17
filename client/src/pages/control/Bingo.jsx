import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../lib/api';
import { getSocket, connectSocket } from '../../lib/socket';
import { confirmAsync } from '../../lib/dialog';

// Caller's console — the simple UI that drives the bingo screens.
//   • DRAW pulls a fair random ball (digital game)
//   • or tap a number on the pad / type it, for a physical ball machine
//   • pick variant + brand, set the game phase, undo mis-keys, start a new game
//   • push the Bingo layout onto any screens (landscape or portrait — same module)

const PHASES = [
  { key: 'eyes_down', label: 'Eyes down' },
  { key: 'one_line', label: 'One line' },
  { key: 'two_lines', label: 'Two lines' },
  { key: 'full_house', label: 'Full house' },
  { key: 'winner', label: 'Winner!' },
];

const BRANDS = [
  { key: 'generic', label: 'Generic' },
  { key: 'pavilion', label: 'Ayr Pavilion' },
];

export default function Bingo() {
  const [gameId, setGameId] = useState('pavilion');
  const [state, setState] = useState(null);
  const [manual, setManual] = useState('');
  const [screens, setScreens] = useState([]);
  const [selScreens, setSelScreens] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api.get(`/bingo/${encodeURIComponent(gameId)}`).then(setState).catch(() => {});
  }, [gameId]);

  useEffect(() => { load(); }, [load]);

  // Live-follow so the console mirrors exactly what the screens show
  useEffect(() => {
    let socket = getSocket() || connectSocket();
    if (!socket) return;
    if (!socket.connected) socket.connect();
    const onUpdate = (p) => { if (p && p.gameId === gameId && p.state) setState(p.state); };
    socket.on('bingo_update', onUpdate);
    return () => socket.off('bingo_update', onUpdate);
  }, [gameId]);

  useEffect(() => {
    api.get('/screens').then(rows => setScreens(Array.isArray(rows) ? rows : (rows?.screens || []))).catch(() => {});
  }, []);

  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 2500); };

  const call = async (path, body) => {
    setBusy(true);
    try { const s = await api.post(`/bingo/${encodeURIComponent(gameId)}${path}`, body || {}); setState(s); return s; }
    catch (e) { flash(e.message); }
    finally { setBusy(false); }
  };

  const max = state?.max || 90;
  const is75 = state?.variant === '75';
  const drawnSet = useMemo(() => new Set(state?.drawn || []), [state?.drawn]);

  const drawNext = () => call('/draw');
  const callNumber = (n) => call('/call', { number: n });
  const undo = () => call('/undo');
  const setPhase = (phase) => call('/phase', { phase });
  const setBrand = (brand) => call('/brand', { brand });

  const newGame = async (variant) => {
    const ok = await confirmAsync({
      title: 'Start a new game?',
      message: `This clears all called numbers for “${gameId}”${variant ? ` and switches to ${variant}-ball` : ''}.`,
      confirmLabel: 'New game', variant: 'danger',
    });
    if (!ok) return;
    if (variant && variant !== state?.variant) await call('/variant', { variant });
    else await call('/reset');
  };

  const submitManual = (e) => {
    e.preventDefault();
    const n = parseInt(manual, 10);
    if (Number.isInteger(n)) { callNumber(n); setManual(''); }
  };

  // Ensure a Bingo layout exists for this game, then point the chosen screens at it
  const sendToScreens = async () => {
    const ids = Object.keys(selScreens).filter(k => selScreens[k]);
    if (!ids.length) return flash('Select at least one screen');
    setBusy(true);
    try {
      const layoutName = `Bingo — ${gameId}`;
      const layouts = await api.get('/layouts').catch(() => []);
      let layout = (Array.isArray(layouts) ? layouts : []).find(l => l.name === layoutName);
      if (!layout) {
        layout = await api.post('/layouts', {
          name: layoutName,
          grid_cols: 1, grid_rows: 1,
          background: '#060a14',
          public_safe: true,
          project: 'bingo',
          modules: [{ type: 'bingo', x: 0, y: 0, w: 1, h: 1, config: { gameId } }],
        });
      }
      const layoutId = layout.id;
      for (const id of ids) await api.post(`/screens/${id}/layout`, { layout_id: layoutId });
      flash(`Bingo sent to ${ids.length} screen${ids.length > 1 ? 's' : ''}`);
    } catch (e) { flash(e.message); }
    finally { setBusy(false); }
  };

  const numbers = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);
  const cols = is75 ? 15 : 10;

  return (
    <div style={{ padding: 20, color: '#e5e7eb', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>🎱 Bingo Caller</h1>
        <label style={{ fontSize: 12, opacity: 0.7 }}>Game</label>
        <input value={gameId} onChange={e => setGameId(e.target.value.trim() || 'pavilion')}
          style={inp} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['90', '75'].map(v => (
            <button key={v} onClick={() => newGame(v)}
              style={chip(state?.variant === v)}>{v}-ball</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {BRANDS.map(b => (
            <button key={b.key} onClick={() => setBrand(b.key)} style={chip(state?.brand === b.key)}>{b.label}</button>
          ))}
        </div>
        {note && <span style={{ marginLeft: 'auto', color: '#f8b500', fontWeight: 700, fontSize: 13 }}>{note}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: 20, alignItems: 'start' }}>
        {/* Left: current + primary actions */}
        <div style={panel}>
          <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.2em', opacity: 0.6, fontWeight: 800 }}>CURRENT</div>
            <div style={{ fontSize: 96, fontWeight: 900, color: '#f8b500', lineHeight: 1 }}>
              {state?.current != null ? (is75 ? `${['B','I','N','G','O'][Math.floor((state.current-1)/15)]} ${state.current}` : state.current) : '—'}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              {(state?.recent || []).slice(1, 6).map((n, i) => (
                <span key={`${n}-${i}`} style={ball}>{n}</span>
              ))}
            </div>
          </div>

          <button onClick={drawNext} disabled={busy || state?.remaining === 0}
            style={{ ...bigBtn, background: 'linear-gradient(135deg,#f8b500,#f97316)', color: '#0b1220' }}>
            🎲 DRAW NEXT
          </button>

          <form onSubmit={submitManual} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={manual} onChange={e => setManual(e.target.value)} inputMode="numeric"
              placeholder={`Type a number (1–${max})`} style={{ ...inp, flex: 1 }} />
            <button type="submit" disabled={busy} style={{ ...smBtn, background: '#2563eb' }}>Call</button>
          </form>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={undo} disabled={busy || !state?.count} style={{ ...smBtn, flex: 1, background: '#374151' }}>↶ Undo</button>
            <button onClick={() => newGame(null)} disabled={busy} style={{ ...smBtn, flex: 1, background: '#7f1d1d' }}>New game</button>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800, marginBottom: 6 }}>GAME PHASE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PHASES.map(p => (
                <button key={p.key} onClick={() => setPhase(p.key)} style={chip(state?.phase === p.key)}>{p.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75, textAlign: 'center' }}>
            <b style={{ color: '#f8b500' }}>{state?.count || 0}</b> called · {state?.remaining ?? max} left
          </div>
        </div>

        {/* Right: number pad + screens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={panel}>
            <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800, marginBottom: 10 }}>
              TAP A BALL FROM THE MACHINE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
              {numbers.map(n => {
                const on = drawnSet.has(n);
                return (
                  <button key={n} disabled={on || busy} onClick={() => callNumber(n)}
                    style={{
                      aspectRatio: '1', borderRadius: 8, border: 'none', fontWeight: 800,
                      fontSize: 14, cursor: on ? 'default' : 'pointer',
                      background: n === state?.current ? '#38bdf8' : on ? '#f8b500' : '#1f2937',
                      color: on || n === state?.current ? '#0b1220' : '#9ca3af',
                      opacity: on && n !== state?.current ? 0.85 : 1,
                    }}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>PUT BINGO ON SCREENS</div>
              <button onClick={sendToScreens} disabled={busy} style={{ ...smBtn, background: '#059669' }}>Send to selected</button>
            </div>
            {screens.length === 0 && <div style={{ opacity: 0.5, fontSize: 13 }}>No screens registered. Add them under Screens.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 8 }}>
              {screens.map(s => (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                  background: selScreens[s.id] ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={!!selScreens[s.id]}
                    onChange={e => setSelScreens(v => ({ ...v, [s.id]: e.target.checked }))} />
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name || s.id}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>{s.orientation || 'landscape'}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>
              Screens open <code>/screen/&lt;id&gt;</code>. The same bingo module adapts to landscape or portrait automatically.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const panel = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 };
const inp = { background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: '8px 10px', color: '#e5e7eb', fontSize: 14, width: 130 };
const bigBtn = { width: '100%', padding: '18px 0', borderRadius: 12, border: 'none', fontWeight: 900, fontSize: 22, cursor: 'pointer' };
const smBtn = { padding: '10px 14px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const ball = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 13 };
function chip(active) {
  return {
    padding: '8px 12px', borderRadius: 8, border: '1px solid ' + (active ? '#f8b500' : 'rgba(255,255,255,0.12)'),
    background: active ? 'rgba(248,181,0,0.18)' : 'rgba(255,255,255,0.04)',
    color: active ? '#f8b500' : '#cbd5e1', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  };
}
