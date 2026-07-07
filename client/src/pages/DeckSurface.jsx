import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';

// DeckSurface — a fullscreen, touch-first rendering of a Deck at /deck/:id, for
// a staff tablet or on-wall panel. Taps fire the button (via the same console
// dispatch as the operator page), guarded buttons arm-then-fire, and take_layout
// buttons light green when live on their target. One deck model, another surface.

const ACTION_COLOR = { take_layout: '#2563eb', apply_scene: '#7c3aed', blackout: '#dc2626', reload_screens: '#d97706', clear_overlays: '#4b5563' };
const NEEDS_TARGET = { take_layout: true, blackout: true };
const center = { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e14', color: '#8a99ac', fontFamily: 'system-ui, sans-serif', fontSize: '1.05rem', padding: '2rem', textAlign: 'center', lineHeight: 1.5 };

export default function DeckSurface() {
  const { id } = useParams();
  const [deck, setDeck] = useState(null);
  const [buttons, setButtons] = useState([]);
  const [screens, setScreens] = useState([]);
  const [liveState, setLiveState] = useState({});
  const [error, setError] = useState(null);
  const [armed, setArmed] = useState(null);       // guarded button awaiting 2nd tap
  const [stateIdx, setStateIdx] = useState({});   // buttonId -> current state (toggle/multi)
  const [variables, setVariables] = useState([]);
  const [varVals, setVarVals] = useState({});     // variable_id -> value (for sliders/steppers)
  const armTimer = useRef(null);

  // Load the deck (needs an operator/staff token on this device).
  useEffect(() => {
    let alive = true;
    if (!localStorage.getItem('broadcast_token')) {
      setError('Sign in on this device first — open the deck from the control app, then bookmark this URL.');
      return;
    }
    api.get(`/decks/${id}`)
      .then(d => { if (!alive) return; setDeck(d); setButtons(d.buttons || []); setStateIdx(Object.fromEntries((d.buttons || []).map(b => [b.id, b.state_index || 0]))); })
      .catch(e => setError(e.status === 401 ? 'Session expired — sign in again on this device.' : (e.message || 'Deck not found')));
    return () => { alive = false; };
  }, [id]);

  // Screens + program tally, kept live via the studio's screen_preview stream.
  useEffect(() => {
    if (!deck?.studio_id) return;
    let alive = true;
    api.get('/screens').then(r => { if (alive) setScreens((r?.screens || r || []).filter(s => s.studio_id === deck.studio_id)); }).catch(() => {});
    api.get(`/console/state?studio_id=${deck.studio_id}`).then(st => {
      if (!alive) return;
      const m = {}; (st.screens || []).forEach(s => { m[s.id] = s.current_layout_id; });
      setLiveState(m);
    }).catch(() => {});
    const socket = connectSocket();
    socket.emit('join_studio', { studioId: deck.studio_id });
    api.get(`/studios/${deck.studio_id}/variables`).then(vs => {
      if (!alive) return;
      const list = Array.isArray(vs) ? vs : (vs?.variables || []);
      setVariables(list);
      setVarVals(Object.fromEntries(list.map(v => [v.id, v.value])));
    }).catch(() => {});
    const onPreview = (d) => { if (d?.screenId) setLiveState(p => ({ ...p, [d.screenId]: d.layoutId })); };
    const onState = (d) => { if (d?.buttonId != null) setStateIdx(p => ({ ...p, [d.buttonId]: d.state_index })); };
    const onVar = (d) => { if (d?.id != null) setVarVals(p => ({ ...p, [d.id]: d.value })); };
    socket.on('screen_preview', onPreview);
    socket.on('deck_button_state', onState);
    socket.on('variable_update', onVar);
    return () => { alive = false; socket.off('screen_preview', onPreview); socket.off('deck_button_state', onState); socket.off('variable_update', onVar); };
  }, [deck?.studio_id]);

  const setVar = useCallback((vid, value) => {
    setVarVals(p => ({ ...p, [vid]: value }));
    api.patch(`/studios/${deck.studio_id}/variables/${vid}`, { value }).catch(() => {});
  }, [deck]);
  const bumpVar = useCallback((vid, delta) => {
    setVarVals(p => ({ ...p, [vid]: (Number(p[vid]) || 0) + delta }));
    api.post(`/studios/${deck.studio_id}/variables/${vid}/bump`, { delta }).catch(() => {});
  }, [deck]);

  // First tap → browser fullscreen (kiosk).
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
    document.addEventListener('click', h, { once: true });
    return () => document.removeEventListener('click', h);
  }, []);

  const targetScreens = useCallback((b) => {
    const bc = screens.filter(s => s.accepts_broadcasts !== 0 && s.accepts_broadcasts !== false);
    const t = b.target;
    if (!t || t === 'all') return bc.map(s => s.id);
    if (t.startsWith('group:')) { const g = t.slice(6); return screens.filter(s => s.group_id === g).map(s => s.id); }
    return screens.some(s => s.id === t) ? [t] : [];
  }, [screens]);

  const isLive = useCallback((b) => {
    if (b.action_type !== 'take_layout' || !b.action_payload?.layout_id) return false;
    const ids = targetScreens(b);
    return ids.length > 0 && ids.every(i => liveState[i] === b.action_payload.layout_id);
  }, [targetScreens, liveState]);

  const fire = useCallback(async (b) => {
    const body = {};
    if (NEEDS_TARGET[b.action_type] && b.target && b.target !== 'all') body.target = targetScreens(b).join(',');
    try { await api.post(`/console/${deck.studio_id}/fire/${b.id}`, body); } catch { /* surface stays quiet */ }
  }, [deck, targetScreens]);

  const onTap = (b) => {
    if (b.confirm) {
      if (armed === b.id) { clearTimeout(armTimer.current); setArmed(null); fire(b); }
      else { setArmed(b.id); clearTimeout(armTimer.current); armTimer.current = setTimeout(() => setArmed(null), 3000); }
    } else fire(b);
  };

  if (error) return <div style={center}>{error}</div>;
  if (!deck) return <div style={center}>Loading deck…</div>;

  const cols = deck.grid_cols || 6, rows = deck.grid_rows || 4;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0e14', padding: '2vmin', cursor: 'none' }}>
      <div style={{ width: '100%', height: '100%', display: 'grid', gap: '1.4vmin', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {buttons.map(b => {
          // ── Continuous controls (slider / stepper) ──
          if (b.control_kind === 'slider' || b.control_kind === 'stepper') {
            const cp = b.action_payload || {};
            const bound = !!cp.variable_id;
            const cellPos = { gridColumn: `${(b.x || 0) + 1} / span ${b.w || 1}`, gridRow: `${(b.y || 0) + 1} / span ${b.h || 1}` };
            if (b.control_kind === 'slider') {
              const min = Number(cp.min ?? 0), max = Number(cp.max ?? 100), step = Number(cp.step || 1);
              const val = Number(varVals[cp.variable_id] ?? min);
              return (
                <div key={b.id} style={{ ...cellPos, background: b.color || '#334155', borderRadius: '1.6vmin', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1vmin', padding: '2vmin', boxShadow: '0 0.4vmin 1.6vmin rgba(0,0,0,.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '2.2vmin', fontWeight: 700 }}>
                    <span>{b.icon} {b.label}</span><span style={{ fontFamily: 'monospace' }}>{bound ? val : '—'}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={val} disabled={!bound}
                    onChange={e => setVar(cp.variable_id, Number(e.target.value))}
                    style={{ width: '100%', height: '4vmin', accentColor: '#60a5fa', touchAction: 'none' }} />
                </div>
              );
            }
            const step = Number(cp.step || 1);
            const val = varVals[cp.variable_id];
            return (
              <div key={b.id} style={{ ...cellPos, background: b.color || '#334155', borderRadius: '1.6vmin', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8vmin', padding: '1.5vmin', boxShadow: '0 0.4vmin 1.6vmin rgba(0,0,0,.4)' }}>
                <span style={{ fontSize: '2vmin', fontWeight: 700 }}>{b.icon} {b.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2vmin' }}>
                  <button disabled={!bound} onClick={() => bumpVar(cp.variable_id, -step)} style={{ width: '7vmin', height: '7vmin', borderRadius: '1.2vmin', border: 'none', background: 'rgba(0,0,0,.3)', color: '#fff', fontSize: '4vmin', touchAction: 'manipulation' }}>−</button>
                  <span style={{ fontFamily: 'monospace', fontSize: '3.2vmin', minWidth: '3ch', textAlign: 'center' }}>{bound ? (val ?? 0) : '—'}</span>
                  <button disabled={!bound} onClick={() => bumpVar(cp.variable_id, step)} style={{ width: '7vmin', height: '7vmin', borderRadius: '1.2vmin', border: 'none', background: 'rgba(0,0,0,.3)', color: '#fff', fontSize: '4vmin', touchAction: 'manipulation' }}>+</button>
                </div>
              </div>
            );
          }
          const isMode = (b.mode === 'toggle' || b.mode === 'multi') && Array.isArray(b.states) && b.states.length;
          const s = isMode ? (b.states[stateIdx[b.id] || 0] || b.states[0]) : null;
          const color = (isMode ? s.color : b.color) || ACTION_COLOR[b.action_type] || '#374151';
          const label = isMode ? (s.label || b.label) : b.label;
          const icon = isMode ? (s.icon ?? b.icon) : b.icon;
          const seq = !isMode ? (b.steps || []).length : 0;
          const badge = isMode ? (b.mode === 'multi' ? `${(stateIdx[b.id] || 0) + 1}/${b.states.length}` : ((stateIdx[b.id] || 0) ? 'ON' : 'OFF')) : (seq ? `⋯${seq}` : null);
          const lit = !isMode && !seq && isLive(b), isArmed = armed === b.id;
          return (
            <button key={b.id} onClick={() => onTap(b)}
              style={{
                gridColumn: `${(b.x || 0) + 1} / span ${b.w || 1}`,
                gridRow: `${(b.y || 0) + 1} / span ${b.h || 1}`,
                background: isArmed ? '#b91c1c' : color,
                border: 'none', borderRadius: '1.6vmin', color: '#fff', cursor: 'pointer',
                outline: lit ? '0.4vmin solid #34d399' : 'none', outlineOffset: '-0.4vmin',
                boxShadow: lit ? '0 0 4vmin rgba(52,211,153,.5)' : '0 0.4vmin 1.6vmin rgba(0,0,0,.4)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8vmin',
                fontWeight: 800, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                position: 'relative', overflow: 'hidden', transition: 'transform .08s ease, background .12s ease',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = ''; }}
              onPointerLeave={e => { e.currentTarget.style.transform = ''; }}>
              {lit && <span style={{ position: 'absolute', top: '0.8vmin', right: '1vmin', fontSize: '1.4vmin', color: '#a7f3d0', fontFamily: 'monospace', letterSpacing: '.05em' }}>● LIVE</span>}
              {badge && <span style={{ position: 'absolute', top: '0.8vmin', right: '1vmin', fontSize: '1.4vmin', color: 'rgba(255,255,255,.7)', fontFamily: 'monospace' }}>{badge}</span>}
              {icon && <span style={{ fontSize: '5vmin', lineHeight: 1 }}>{icon}</span>}
              <span style={{ fontSize: '2.6vmin', padding: '0 0.6vmin' }}>{isArmed ? 'Tap to confirm' : label}</span>
            </button>
          );
        })}
        {buttons.length === 0 && <div style={{ ...center, position: 'static', gridColumn: '1 / -1' }}>This deck has no buttons yet.</div>}
      </div>
      {deck.status !== 'published' && (
        <div style={{ position: 'fixed', bottom: '1vmin', left: '1.4vmin', fontSize: '1.4vmin', color: '#4b5563', fontFamily: 'monospace', letterSpacing: '.1em' }}>DRAFT</div>
      )}
    </div>
  );
}
