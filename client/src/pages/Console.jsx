import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getMe } from '../lib/api';
import { connectSocket } from '../lib/socket';

// ──────────────────────────────────────────────────────────────────────────
// /console — the in-studio "dumb console". Big dumb buttons, on-air state,
// zero chrome. Designed for a touchscreen on the studio desk. Each button is
// a console_buttons row; tapping it fires /api/console/:studio/fire/:id.
// The same buttons are driven by a Stream Deck via their fire URL.
//
// Lighting-desk model:
//   • PAGES — banks of buttons for parts of the show (button.page; tabs).
//   • TARGET — fire layout buttons at ALL SCREENS or one screen (group strip).
//   • EDIT MODE — operators add/edit/move/remove buttons on the console itself.
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

const MAIN_PAGE = 'MAIN';
const PALETTE = ['#F7941D', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#475569', '#1E2A35', '#111827'];
const ACTION_TYPES = [
  { value: 'take_layout', label: 'Take layout' },
  { value: 'apply_scene', label: 'Apply scene (multi-screen)' },
  { value: 'push_overlay', label: 'Push overlay (JSON)' },
  { value: 'now_playing', label: 'Push Now Playing' },
  { value: 'clear_overlays', label: 'Clear graphics' },
  { value: 'resume_schedule', label: 'Resume auto schedule' },
  { value: 'reload_screens', label: 'Reload screens' },
  { value: 'blackout', label: 'Blackout' },
  { value: 'webhook', label: 'Webhook (HTTP)' },
];

const pageOf = (b) => (b.page || '').trim().toUpperCase() || MAIN_PAGE;

export default function Console() {
  const [params] = useSearchParams();
  const [studio, setStudio] = useState({ id: params.get('studio') || null, name: 'Studio' });
  const [buttons, setButtons] = useState([]);
  const [state, setState] = useState(null);
  const [layouts, setLayouts] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [activePage, setActivePage] = useState(null); // null until pages known
  const [target, setTarget] = useState('all');        // 'all' | screenId
  const [editMode, setEditMode] = useState(false);
  const [editBtn, setEditBtn] = useState(null);        // button row | 'new'
  const [confirmBtn, setConfirmBtn] = useState(null);
  const [flash, setFlash] = useState({});              // id -> 'ok' | 'err' | 'busy'
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

  const loadPickers = useCallback(async (sid) => {
    if (!sid) return;
    try { setLayouts(await api.get(`/layouts?studio_id=${sid}`)); } catch {}
    try {
      const sc = await api.get(`/scenes?studio_id=${sid}`);
      setScenes(Array.isArray(sc) ? sc : sc?.scenes || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!studio.id) return;
    loadButtons(studio.id);
    loadState(studio.id);
    loadPickers(studio.id);
    try { setTarget(localStorage.getItem(`console_target_${studio.id}`) || 'all'); } catch {}
    const s = connectSocket();
    s.emit('join_studio', { studioId: studio.id });
    const refresh = () => loadState(studio.id);
    s.on('screen_preview', refresh);
    s.on('set_layout', refresh);
    const poll = setInterval(refresh, 12000);
    return () => { s.off('screen_preview', refresh); s.off('set_layout', refresh); clearInterval(poll); };
  }, [studio.id, loadButtons, loadState, loadPickers]);

  const pickTarget = (t) => {
    setTarget(t);
    try { localStorage.setItem(`console_target_${studio.id}`, t); } catch {}
  };

  const fire = useCallback(async (btn) => {
    const sid = studioIdRef.current;
    if (!sid) return;
    setFlash(f => ({ ...f, [btn.id]: 'busy' }));
    try {
      const t = (btn.action_type === 'take_layout' || btn.action_type === 'blackout') && target !== 'all' ? target : undefined;
      await api.post(`/console/${sid}/fire/${btn.id}`, t ? { target: t } : {});
      setFlash(f => ({ ...f, [btn.id]: 'ok' }));
      loadState(sid);
    } catch (e) {
      setFlash(f => ({ ...f, [btn.id]: 'err' }));
    }
    setTimeout(() => setFlash(f => { const n = { ...f }; delete n[btn.id]; return n; }), 1200);
  }, [loadState, target]);

  const onPress = (btn) => {
    if (editMode) { setEditBtn(btn); return; }
    if (btn.confirm) setConfirmBtn(btn); else fire(btn);
  };

  // ── pages ────────────────────────────────────────────────────────────────
  const enabled = buttons.filter(b => b.enabled || editMode);
  const pages = useMemo(() => {
    const seen = new Map(); // page -> min sort_order
    for (const b of enabled) {
      const p = pageOf(b);
      if (!seen.has(p) || b.sort_order < seen.get(p)) seen.set(p, b.sort_order);
    }
    return [...seen.entries()].sort((a, z) => a[1] - z[1]).map(([p]) => p);
  }, [enabled]);

  useEffect(() => {
    if (activePage === null && pages.length) setActivePage(pages[0]);
    else if (activePage !== null && activePage !== 'ALL' && pages.length && !pages.includes(activePage)) setActivePage(pages[0]);
  }, [pages, activePage]);

  const visible = activePage === 'ALL' ? enabled : enabled.filter(b => pageOf(b) === activePage);

  // ── live-state helpers ───────────────────────────────────────────────────
  const screens = state?.screens || [];
  const layoutName = useCallback((id) => layouts.find(l => l.id === id)?.name || '', [layouts]);
  const liveCount = (btn) => {
    if (btn.action_type !== 'take_layout' || !btn.action_payload?.layout_id) return 0;
    const pool = target === 'all' ? screens : screens.filter(s => s.id === target);
    return pool.filter(s => s.current_layout_id === btn.action_payload.layout_id).length;
  };
  const livePool = target === 'all' ? screens.length : 1;

  // ── edit ops ─────────────────────────────────────────────────────────────
  const moveBtn = async (btn, dir) => {
    const ordered = [...buttons].sort((a, z) => a.sort_order - z.sort_order || (a.created_at || '').localeCompare(z.created_at || ''));
    const peers = ordered.filter(b => activePage === 'ALL' || pageOf(b) === pageOf(btn));
    const i = peers.findIndex(b => b.id === btn.id);
    const j = i + dir;
    if (j < 0 || j >= peers.length) return;
    const a = ordered.indexOf(peers[i]), z = ordered.indexOf(peers[j]);
    [ordered[a], ordered[z]] = [ordered[z], ordered[a]];
    try {
      await api.post('/console/buttons/reorder', { order: ordered.map(b => b.id) });
      loadButtons(studio.id);
    } catch (e) { setErr(e.message); }
  };

  const deleteBtn = async (btn) => {
    if (!window.confirm(`Remove "${btn.label}" from the console?`)) return;
    try { await api.delete(`/console/buttons/${btn.id}`); loadButtons(studio.id); }
    catch (e) { setErr(e.message); }
  };

  const timelineActive = state?.timeline?.active;
  const targetName = target === 'all' ? 'ALL SCREENS' : (screens.find(s => s.id === target)?.name || 'screen');

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
          <button
            onClick={() => { setEditMode(m => !m); setEditBtn(null); }}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${editMode ? 'bg-orange-500 text-white' : 'text-white/30 hover:text-white hover:bg-white/10'}`}
            title="Add / edit / remove console buttons"
          >
            {editMode ? '✓ Done' : '✏️ Edit'}
          </button>
          <Link to="/control/console" className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition" title="Configure console">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </Link>
        </div>
      </div>

      {/* Page tabs — lighting-desk banks */}
      {(pages.length > 1 || editMode) && (
        <div className="flex items-center gap-2 px-5 pt-3 shrink-0 overflow-x-auto">
          {pages.map(p => (
            <button key={p} onClick={() => setActivePage(p)}
              className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider whitespace-nowrap transition ${activePage === p ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
              style={activePage === p ? {} : { background: 'rgba(255,255,255,0.07)' }}>
              {p}
            </button>
          ))}
          <button onClick={() => setActivePage('ALL')}
            className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider whitespace-nowrap transition ${activePage === 'ALL' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
            style={activePage === 'ALL' ? {} : { background: 'rgba(255,255,255,0.04)' }}>
            ALL
          </button>
        </div>
      )}

      {/* Target group strip — ALL SCREENS + one chip per screen */}
      {screens.length > 0 && (
        <div className="flex items-stretch gap-2 px-5 pt-3 shrink-0 overflow-x-auto">
          <button onClick={() => pickTarget('all')}
            className={`px-4 py-2 rounded-xl text-left transition shrink-0 ${target === 'all' ? 'ring-2 ring-orange-400' : ''}`}
            style={{ background: target === 'all' ? 'rgba(247,148,29,0.18)' : 'rgba(255,255,255,0.05)' }}>
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-300">🖥 All screens</div>
            <div className="text-[11px] text-white/50">{screens.length} screens · group fire</div>
          </button>
          {screens.map(s => (
            <button key={s.id} onClick={() => pickTarget(s.id)}
              className={`px-4 py-2 rounded-xl text-left transition shrink-0 max-w-[220px] ${target === s.id ? 'ring-2 ring-orange-400' : ''}`}
              style={{ background: target === s.id ? 'rgba(247,148,29,0.18)' : 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.is_online ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                <span className="truncate">{s.name}</span>
              </div>
              <div className="text-[11px] text-white/50 truncate">{layoutName(s.current_layout_id) || '—'}</div>
            </button>
          ))}
          {target !== 'all' && (
            <div className="self-center text-[11px] text-orange-300/80 font-bold whitespace-nowrap pl-1">
              Layout buttons fire to {targetName} only
            </div>
          )}
        </div>
      )}

      {/* Button grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {err && <div className="mb-4 text-center text-rose-300 text-sm bg-rose-500/10 rounded-lg py-2">{err}</div>}
        {visible.length === 0 && !editMode ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/40 gap-3">
            <div className="text-5xl">🎛️</div>
            <p className="text-lg">No console buttons yet.</p>
            <button onClick={() => setEditMode(true)} className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-400 transition">Set up the console →</button>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {visible.map(btn => {
              const lc = liveCount(btn);
              const live = lc > 0;
              const f = flash[btn.id];
              const base = btn.color || '#334155';
              // An icon that is a URL renders as card art filling the button.
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
                    opacity: btn.enabled ? 1 : 0.45,
                  }}
                >
                  {artIcon && (
                    <>
                      <img src={btn.icon} alt="" loading="lazy" draggable={false}
                        className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 35%, rgba(8,6,18,0.92) 100%)' }} />
                    </>
                  )}
                  {live && !editMode && (
                    <span className="absolute top-2 right-2 z-10 text-[9px] font-black uppercase tracking-widest bg-white text-black px-1.5 py-0.5 rounded">
                      {lc < livePool ? `LIVE ${lc}/${livePool}` : 'LIVE'}
                    </span>
                  )}
                  {btn.confirm && !editMode && <span className="absolute top-2 left-2 z-10 text-[10px]" title="Confirms before firing">🔒</span>}
                  {editMode && (
                    <>
                      <span onClick={(e) => { e.stopPropagation(); deleteBtn(btn); }}
                        className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-rose-600 text-white text-sm font-black flex items-center justify-center shadow-lg">✕</span>
                      <span onClick={(e) => { e.stopPropagation(); moveBtn(btn, -1); }}
                        className="absolute bottom-1.5 left-1.5 z-20 w-7 h-7 rounded-full bg-black/60 text-white/80 text-xs flex items-center justify-center">◀</span>
                      <span onClick={(e) => { e.stopPropagation(); moveBtn(btn, 1); }}
                        className="absolute bottom-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-black/60 text-white/80 text-xs flex items-center justify-center">▶</span>
                    </>
                  )}
                  {artIcon ? <div className="flex-1" /> : <div className="text-4xl leading-none drop-shadow">{btn.icon || '⬜'}</div>}
                  <div className="relative z-10 text-base font-black leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{btn.label}</div>
                  {btn.sublabel && <div className="relative z-10 text-[11px] text-white/70 leading-tight">{btn.sublabel}</div>}
                  {editMode && activePage === 'ALL' && <div className="relative z-10 text-[9px] font-black uppercase tracking-widest text-orange-300/80">{pageOf(btn)}</div>}
                  {f && (
                    <div className="absolute inset-0 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ background: f === 'err' ? 'rgba(190,18,60,0.85)' : f === 'ok' ? 'rgba(22,163,74,0.85)' : 'rgba(0,0,0,0.5)' }}>
                      {f === 'busy' ? <span className="animate-spin">⏳</span> : f === 'ok' ? '✓' : '✕'}
                    </div>
                  )}
                </button>
              );
            })}
            {editMode && (
              <button onClick={() => setEditBtn('new')}
                className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/20 text-white/40 hover:text-white hover:border-orange-400 transition"
                style={{ minHeight: 130 }}>
                <div className="text-4xl">＋</div>
                <div className="text-sm font-black uppercase tracking-wider">Add button</div>
              </button>
            )}
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

      {/* Add / edit button modal */}
      {editBtn && (
        <ButtonEditor
          btn={editBtn === 'new' ? null : editBtn}
          pages={pages}
          defaultPage={activePage && activePage !== 'ALL' ? activePage : MAIN_PAGE}
          layouts={layouts}
          scenes={scenes}
          onClose={() => setEditBtn(null)}
          onSaved={() => { setEditBtn(null); loadButtons(studio.id); }}
          studioId={studio.id}
        />
      )}
    </div>
  );
}

// ── Add/edit modal — quick, touch-friendly, no JSON unless you ask for it ──
function ButtonEditor({ btn, pages, defaultPage, layouts, scenes, onClose, onSaved, studioId }) {
  const p = btn?.action_payload || {};
  const [form, setForm] = useState({
    label: btn?.label || '',
    sublabel: btn?.sublabel || '',
    icon: btn?.icon || '🔘',
    color: btn?.color || PALETTE[0],
    page: (btn?.page || defaultPage || MAIN_PAGE).toUpperCase(),
    action_type: btn?.action_type || 'take_layout',
    layout_id: p.layout_id || '',
    scene_id: p.scene_id || '',
    url: p.url || '',
    payloadJson: JSON.stringify(p, null, 2),
    confirm: !!btn?.confirm,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setError(null);
    if (!form.label.trim()) { setError('Label required'); return; }
    let payload = {};
    if (form.action_type === 'take_layout') {
      if (!form.layout_id) { setError('Pick a layout'); return; }
      payload = { layout_id: form.layout_id };
    } else if (form.action_type === 'apply_scene') {
      if (!form.scene_id) { setError('Pick a scene'); return; }
      payload = { scene_id: form.scene_id };
    } else if (form.action_type === 'webhook') {
      if (!form.url) { setError('URL required'); return; }
      payload = { url: form.url, method: 'POST' };
    } else if (form.action_type === 'push_overlay') {
      try { payload = JSON.parse(form.payloadJson || '{}'); } catch { setError('Invalid JSON'); return; }
    } else if (form.action_type === 'now_playing') {
      payload = { moduleId: 'now-playing' };
    }
    const body = {
      studio_id: studioId,
      label: form.label.trim(),
      sublabel: form.sublabel.trim() || null,
      icon: form.icon.trim() || null,
      color: form.color,
      page: form.page.trim().toUpperCase() === MAIN_PAGE ? null : form.page.trim().toUpperCase(),
      action_type: form.action_type,
      action_payload: payload,
      confirm: form.confirm,
    };
    setSaving(true);
    try {
      if (btn) await api.put(`/console/buttons/${btn.id}`, body);
      else await api.post('/console/buttons', body);
      onSaved();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-white/8 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-400';
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-white/40 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: '#16202b', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-4">{btn ? 'Edit button' : 'Add button'}</h2>
        {error && <div className="mb-3 text-rose-300 text-sm bg-rose-500/10 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="col-span-2">
            <label className={labelCls}>Label</label>
            <input className={inputCls} value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Half-Time Quiz" />
          </div>
          <div>
            <label className={labelCls}>Icon (emoji)</label>
            <input className={inputCls} value={form.icon} onChange={e => set('icon', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelCls}>Sublabel</label>
            <input className={inputCls} value={form.sublabel} onChange={e => set('sublabel', e.target.value)} placeholder="optional" />
          </div>
          <div>
            <label className={labelCls}>Page</label>
            <input className={inputCls} value={form.page} onChange={e => set('page', e.target.value)} list="console-pages" placeholder="MAIN" />
            <datalist id="console-pages">
              {[MAIN_PAGE, ...pages.filter(pg => pg !== MAIN_PAGE)].map(pg => <option key={pg} value={pg} />)}
            </datalist>
          </div>
        </div>

        <div className="mb-3">
          <label className={labelCls}>Colour</label>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map(c => (
              <button key={c} onClick={() => set('color', c)}
                className={`w-9 h-9 rounded-lg transition ${form.color === c ? 'ring-2 ring-white scale-110' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className={labelCls}>Action</label>
          <select className={inputCls} value={form.action_type} onChange={e => set('action_type', e.target.value)}>
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {form.action_type === 'take_layout' && (
          <div className="mb-3">
            <label className={labelCls}>Layout</label>
            <select className={inputCls} value={form.layout_id} onChange={e => set('layout_id', e.target.value)}>
              <option value="">— pick a layout —</option>
              {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
        {form.action_type === 'apply_scene' && (
          <div className="mb-3">
            <label className={labelCls}>Scene</label>
            <select className={inputCls} value={form.scene_id} onChange={e => set('scene_id', e.target.value)}>
              <option value="">— pick a scene —</option>
              {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {form.action_type === 'webhook' && (
          <div className="mb-3">
            <label className={labelCls}>URL</label>
            <input className={inputCls} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://…" />
          </div>
        )}
        {form.action_type === 'push_overlay' && (
          <div className="mb-3">
            <label className={labelCls}>Overlay JSON</label>
            <textarea className={`${inputCls} font-mono text-xs`} rows={5} value={form.payloadJson} onChange={e => set('payloadJson', e.target.value)} placeholder='{"overlay":{"type":"sl_lower_third","title":"…"}}' />
          </div>
        )}

        <label className="flex items-center gap-2 mb-5 text-sm text-white/70">
          <input type="checkbox" checked={form.confirm} onChange={e => set('confirm', e.target.checked)} className="w-5 h-5" />
          Ask for confirmation before firing
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="py-3.5 rounded-2xl text-base font-bold bg-white/10 hover:bg-white/15 transition">Cancel</button>
          <button onClick={save} disabled={saving} className="py-3.5 rounded-2xl text-base font-black text-white bg-orange-500 hover:bg-orange-400 transition disabled:opacity-50">
            {saving ? 'Saving…' : btn ? 'Save' : 'Add button'}
          </button>
        </div>
      </div>
    </div>
  );
}
