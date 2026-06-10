import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getMe } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';

// ──────────────────────────────────────────────────────────────────────────
// /console — the in-studio "dumb console". Big dumb buttons, on-air state,
// zero chrome. Designed for a touchscreen on the studio desk. Each button is
// a console_buttons row; tapping it fires /api/console/:studio/fire/:id.
// The same buttons are driven by a Stream Deck via their fire URL.
// ──────────────────────────────────────────────────────────────────────────

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function darken(hex, amt = 0.75) {
  try {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = Math.round(((n >> 16) & 255) * amt), g = Math.round(((n >> 8) & 255) * amt), b = Math.round((n & 255) * amt);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}

export default function Console() {
  const [params] = useSearchParams();
  const [studio, setStudio] = useState({ id: params.get('studio') || null, name: 'Studio' });
  const [buttons, setButtons] = useState([]);
  const [state, setState] = useState(null);
  const [confirmBtn, setConfirmBtn] = useState(null);
  const [flash, setFlash] = useState({}); // id -> 'ok' | 'err' | 'busy'
  const [err, setErr] = useState(null);
  const now = useClock();
  const studioIdRef = useRef(studio.id);

  // Resolve studio + load buttons
  useEffect(() => {
    let alive = true;
    getMe().then(d => {
      const u = d.user || d;
      const sid = u.studio_id || params.get('studio');
      if (!alive) return;
      studioIdRef.current = sid;
      setStudio({ id: sid, name: d.studio?.name || d.studioName || u.name || 'Studio' });
    }).catch(() => {
      const sid = params.get('studio');
      if (sid) { studioIdRef.current = sid; setStudio(s => ({ ...s, id: sid })); }
    });
    return () => { alive = false; };
  }, [params]);

  const loadButtons = useCallback(async (sid) => {
    if (!sid) return;
    try { setButtons(await api.get(`/console/buttons?studio_id=${sid}`)); setErr(null); }
    catch (e) { setErr(e.message); }
  }, []);

  const loadState = useCallback(async (sid) => {
    if (!sid) return;
    try { setState(await api.get(`/console/state?studio_id=${sid}`)); } catch {}
  }, []);

  useEffect(() => {
    if (!studio.id) return;
    loadButtons(studio.id);
    loadState(studio.id);
    const s = connectSocket();
    s.emit('join_studio', { studioId: studio.id });
    const refresh = () => loadState(studio.id);
    s.on('screen_preview', refresh);
    s.on('set_layout', refresh);
    const poll = setInterval(refresh, 12000);
    return () => { s.off('screen_preview', refresh); s.off('set_layout', refresh); clearInterval(poll); };
  }, [studio.id, loadButtons, loadState]);

  const fire = useCallback(async (btn) => {
    const sid = studioIdRef.current;
    if (!sid) return;
    setFlash(f => ({ ...f, [btn.id]: 'busy' }));
    try {
      await api.post(`/console/${sid}/fire/${btn.id}`, {});
      setFlash(f => ({ ...f, [btn.id]: 'ok' }));
      loadState(sid);
    } catch (e) {
      setFlash(f => ({ ...f, [btn.id]: 'err' }));
    }
    setTimeout(() => setFlash(f => { const n = { ...f }; delete n[btn.id]; return n; }), 1200);
  }, [loadState]);

  const onPress = (btn) => { if (btn.confirm) setConfirmBtn(btn); else fire(btn); };

  const enabled = buttons.filter(b => b.enabled);
  const timelineActive = state?.timeline?.active;

  return (
    <div className="fixed inset-0 flex flex-col select-none" style={{ background: 'radial-gradient(circle at 50% -10%, #182433, #0a0f16 60%)', color: '#fff', WebkitTapHighlightColor: 'transparent' }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-white/10 shrink-0" style={{ background: 'rgba(0,0,0,0.35)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/brands/nar/now-logo.png" alt="" className="h-9 w-auto" onError={e => { e.target.style.display = 'none'; }} />
          <div className="leading-tight min-w-0">
            <div className="text-sm font-black tracking-wide truncate">{studio.name}</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Studio Console</div>
          </div>
        </div>

        {/* On-air state */}
        <div className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${timelineActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${timelineActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${timelineActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </span>
            {timelineActive ? 'AUTO' : 'MANUAL'}
          </span>
          <div className="text-sm">
            <span className="text-white/40 text-[11px] uppercase tracking-wider mr-2">On air</span>
            <span className="font-bold">{state?.on_air_layout_name || '—'}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right leading-none">
            <div className="text-3xl font-black tabular-nums tracking-tight">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}<span className="text-white/30 text-lg">:{String(now.getSeconds()).padStart(2, '0')}</span></div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">{now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          </div>
          <Link to="/control/console" className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition" title="Configure console">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </Link>
        </div>
      </div>

      {/* Button grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {err && <div className="mb-4 text-center text-rose-300 text-sm bg-rose-500/10 rounded-lg py-2">{err}</div>}
        {enabled.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/40 gap-3">
            <div className="text-5xl">🎛️</div>
            <p className="text-lg">No console buttons yet.</p>
            <Link to="/control/console" className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-400 transition">Set up the console →</Link>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {enabled.map(btn => {
              const live = state?.on_air_layout_id && btn.action_type === 'take_layout' && btn.action_payload?.layout_id === state.on_air_layout_id;
              const f = flash[btn.id];
              const base = btn.color || '#334155';
              // An icon that is a URL renders as card art filling the button —
              // used by the TV-card buttons so the presenter scans artwork, not
              // a wall of identical emoji tiles.
              const artIcon = typeof btn.icon === 'string' && (btn.icon.startsWith('/') || btn.icon.startsWith('http'));
              return (
                <button
                  key={btn.id}
                  onClick={() => onPress(btn)}
                  className="relative overflow-hidden rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-[0.97] focus:outline-none"
                  style={{
                    minHeight: 130,
                    background: `linear-gradient(160deg, ${base}, ${darken(base, 0.7)})`,
                    boxShadow: live ? `0 0 0 3px #fff, 0 8px 30px ${base}66` : `0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)`,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {artIcon && (
                    <>
                      <img src={btn.icon} alt="" loading="lazy" draggable={false}
                        className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 35%, rgba(8,6,18,0.92) 100%)' }} />
                    </>
                  )}
                  {live && <span className="absolute top-2 right-2 z-10 text-[9px] font-black uppercase tracking-widest bg-white text-black px-1.5 py-0.5 rounded">LIVE</span>}
                  {btn.confirm && <span className="absolute top-2 left-2 z-10 text-[10px]" title="Confirms before firing">🔒</span>}
                  {artIcon ? <div className="flex-1" /> : <div className="text-4xl leading-none drop-shadow">{btn.icon || '⬜'}</div>}
                  <div className="relative z-10 text-base font-black leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{btn.label}</div>
                  {btn.sublabel && <div className="relative z-10 text-[11px] text-white/70 leading-tight">{btn.sublabel}</div>}
                  {f && (
                    <div className="absolute inset-0 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ background: f === 'err' ? 'rgba(190,18,60,0.85)' : f === 'ok' ? 'rgba(22,163,74,0.85)' : 'rgba(0,0,0,0.5)' }}>
                      {f === 'busy' ? <span className="animate-spin">⏳</span> : f === 'ok' ? '✓' : '✕'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm overlay */}
      {confirmBtn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmBtn(null)}>
          <div className="rounded-3xl p-8 max-w-md w-full text-center" style={{ background: '#16202b', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
            {typeof confirmBtn.icon === 'string' && (confirmBtn.icon.startsWith('/') || confirmBtn.icon.startsWith('http'))
              ? <img src={confirmBtn.icon} alt="" className="w-40 mx-auto mb-3 rounded-xl border border-white/10" />
              : <div className="text-6xl mb-3">{confirmBtn.icon || '⚠️'}</div>}
            <h2 className="text-2xl font-black mb-1">{confirmBtn.label}?</h2>
            <p className="text-white/50 mb-6">{confirmBtn.sublabel || 'Confirm this action'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmBtn(null)} className="py-4 rounded-2xl text-lg font-bold bg-white/10 hover:bg-white/15 transition">Cancel</button>
              <button onClick={() => { fire(confirmBtn); setConfirmBtn(null); }} className="py-4 rounded-2xl text-lg font-black text-white transition" style={{ background: confirmBtn.color || '#dc2626' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
