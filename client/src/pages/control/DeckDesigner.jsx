import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useLiveData from '../../hooks/useLiveData';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { connectSocket } from '../../lib/socket';

// ── Deck Designer (Deck v1 · M1) ──────────────────────────────────────────
// Lay out a grid of buttons that control the studio's screens. Each button
// takes a layout / applies a scene / blackout, aimed at a screen, group, or all.
// Buttons are stored as console_buttons rows tagged with deck_id + x/y/w/h +
// target (see routes/decks.js), and fire through the existing console dispatch.
// This page is the DESIGNER (edit only). Firing live is M2.

const ACTIONS = {
  take_layout:    { label: 'Take Layout',    color: '#2563eb', needsLayout: true, needsTarget: true },
  apply_scene:    { label: 'Apply Scene',    color: '#7c3aed', needsScene: true },
  blackout:       { label: 'Blackout',       color: '#dc2626', needsTarget: true, guard: true },
  reload_screens: { label: 'Reload Screens', color: '#d97706', guard: true },
  clear_overlays: { label: 'Clear Overlays', color: '#4b5563' },
};

const LIBRARY = [
  { action_type: 'take_layout', label: 'Take', icon: '🎬' },
  { action_type: 'apply_scene', label: 'Scene', icon: '🎭' },
  { action_type: 'blackout', label: 'Blackout', icon: '🌑', confirm: true },
  { action_type: 'reload_screens', label: 'Reload', icon: '🔄', confirm: true },
  { action_type: 'clear_overlays', label: 'Clear GFX', icon: '🧹' },
];

function cellsOf(b) {
  const cells = [];
  for (let dy = 0; dy < (b.h || 1); dy++)
    for (let dx = 0; dx < (b.w || 1); dx++)
      cells.push(`${(b.x || 0) + dx},${(b.y || 0) + dy}`);
  return cells;
}

export default function DeckDesigner() {
  const { studioId, studios, setStudioId, isSuperAdmin, layouts } = useLiveData();
  const toast = useToast();

  const [decks, setDecks] = useState([]);
  const [deckId, setDeckId] = useState(null);
  const [deck, setDeck] = useState(null);          // { ...deck, buttons:[] }
  const [buttons, setButtons] = useState([]);
  const [selId, setSelId] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [screens, setScreens] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // Live mode: fire buttons + show program tally.
  const [mode, setMode] = useState('edit');       // 'edit' | 'live'
  const [liveState, setLiveState] = useState({});  // screenId -> current_layout_id
  const [fireBtn, setFireBtn] = useState(null);    // guarded button awaiting confirm
  const [stateIdx, setStateIdx] = useState({});    // buttonId -> current state index (toggle/multi)

  const sel = useMemo(() => buttons.find(b => b.id === selId) || null, [buttons, selId]);
  const cols = deck?.grid_cols || 6;
  const rows = deck?.grid_rows || 4;

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadDecks = useCallback(async () => {
    if (!studioId) { setDecks([]); return; }
    try {
      const list = await api.get(`/decks?studio_id=${studioId}`);
      setDecks(list || []);
      setDeckId(prev => prev && (list || []).some(d => d.id === prev) ? prev : (list?.[0]?.id || null));
    } catch (e) { toast?.(e.message, 'error'); }
  }, [studioId, toast]);

  const loadDeck = useCallback(async (id) => {
    if (!id) { setDeck(null); setButtons([]); return; }
    try {
      const d = await api.get(`/decks/${id}`);
      setDeck(d);
      setButtons(d.buttons || []);
      setStateIdx(Object.fromEntries((d.buttons || []).map(b => [b.id, b.state_index || 0])));
    } catch (e) { toast?.(e.message, 'error'); }
  }, [toast]);

  useEffect(() => { loadDecks(); }, [loadDecks]);
  useEffect(() => { loadDeck(deckId); setSelId(null); }, [deckId, loadDeck]);

  // Pickers: scenes, groups, screens for the studio
  useEffect(() => {
    if (!studioId) return;
    api.get(`/scenes?studio_id=${studioId}`).then(s => setScenes(s || [])).catch(() => setScenes([]));
    api.get(`/screen-groups?studio_id=${studioId}`).then(r => setGroups((r?.groups || []).filter(g => !g.studio_id || g.studio_id === studioId))).catch(() => setGroups([]));
    api.get('/screens').then(r => setScreens((r?.screens || r || []).filter(s => s.studio_id === studioId))).catch(() => setScreens([]));
  }, [studioId]);

  // Live program state: fetch what's on each screen, then keep it fresh via the
  // studio's screen_preview stream (emitted on every take, from any surface).
  useEffect(() => {
    if (!studioId) return;
    let alive = true;
    api.get(`/console/state?studio_id=${studioId}`).then(st => {
      if (!alive) return;
      const m = {};
      (st.screens || []).forEach(s => { m[s.id] = s.current_layout_id; });
      setLiveState(m);
    }).catch(() => {});
    const socket = connectSocket();
    socket.emit('join_studio', { studioId });
    const onPreview = (d) => { if (d?.screenId) setLiveState(prev => ({ ...prev, [d.screenId]: d.layoutId })); };
    const onState = (d) => { if (d?.buttonId != null) setStateIdx(prev => ({ ...prev, [d.buttonId]: d.state_index })); };
    socket.on('screen_preview', onPreview);
    socket.on('deck_button_state', onState);
    return () => { alive = false; socket.off('screen_preview', onPreview); socket.off('deck_button_state', onState); };
  }, [studioId]);

  // Resolve a button's target to concrete screen ids (broadcastable only).
  const targetScreens = useCallback((b) => {
    const broadcastable = screens.filter(s => s.accepts_broadcasts !== 0 && s.accepts_broadcasts !== false);
    const t = b.target;
    if (!t || t === 'all') return broadcastable.map(s => s.id);
    if (t.startsWith('group:')) { const gid = t.slice(6); return screens.filter(s => s.group_id === gid).map(s => s.id); }
    return screens.some(s => s.id === t) ? [t] : [];
  }, [screens]);

  // A take_layout button is "live" when every screen it targets is on its layout.
  const isLive = useCallback((b) => {
    if (b.action_type !== 'take_layout' || !b.action_payload?.layout_id) return false;
    const ids = targetScreens(b);
    if (!ids.length) return false;
    return ids.every(id => liveState[id] === b.action_payload.layout_id);
  }, [liveState, targetScreens]);

  // For toggle/multi the displayed look is the current state's.
  const displayOf = useCallback((b) => {
    if ((b.mode === 'toggle' || b.mode === 'multi') && Array.isArray(b.states) && b.states.length) {
      const i = stateIdx[b.id] || 0;
      const s = b.states[i] || b.states[0];
      return { label: s.label || b.label, icon: s.icon ?? b.icon, color: s.color || b.color,
        badge: b.mode === 'multi' ? `${i + 1}/${b.states.length}` : (i ? 'ON' : 'OFF') };
    }
    return { label: b.label, icon: b.icon, color: b.color, badge: null };
  }, [stateIdx]);

  // ── State editing (toggle/multi) ──
  const baseState = (b, over = {}) => ({
    label: b.label || 'State', icon: b.icon || '', color: b.color || '#374151',
    action_type: b.action_type || 'take_layout', action_payload: b.action_payload || {}, target: b.target || 'all', ...over,
  });
  function setButtonMode(id, mode) {
    const b = buttons.find(x => x.id === id); if (!b) return;
    if (mode === 'momentary') { patchButton(id, { mode, states: [] }); return; }
    let states = Array.isArray(b.states) && b.states.length ? b.states.slice() : null;
    if (!states) {
      states = mode === 'toggle'
        ? [baseState(b, { label: b.label || 'On' }), baseState(b, { label: 'Off', action_type: 'blackout', action_payload: {}, color: '#4b5563' })]
        : [baseState(b, { label: 'State 1' }), baseState(b, { label: 'State 2', color: '#7c3aed' })];
    } else if (mode === 'toggle') {
      states = states.slice(0, 2);
      while (states.length < 2) states.push(baseState(b, { label: 'Off', color: '#4b5563' }));
    }
    patchButton(id, { mode, states });
  }
  function updateState(id, i, patch) {
    const b = buttons.find(x => x.id === id); if (!b) return;
    patchButton(id, { states: (b.states || []).map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  }
  function addState(id) {
    const b = buttons.find(x => x.id === id); if (!b) return;
    patchButton(id, { states: [...(b.states || []), baseState(b, { label: 'State ' + ((b.states || []).length + 1), color: '#4b5563' })] });
  }
  function removeState(id, i) {
    const b = buttons.find(x => x.id === id); if (!b || (b.states || []).length <= 2) return;
    patchButton(id, { states: (b.states || []).filter((_, idx) => idx !== i) });
  }

  async function fireButton(b) {
    const body = {};
    if (b.mode !== 'toggle' && b.mode !== 'multi' && ACTIONS[b.action_type]?.needsTarget && b.target && b.target !== 'all') {
      body.target = targetScreens(b).join(',');
    }
    try {
      const res = await api.post(`/console/${studioId}/fire/${b.id}`, body);
      const r = res?.result || {};
      const detail = r.applied != null ? ` — ${r.applied} screen${r.applied !== 1 ? 's' : ''}${r.locked ? `, ${r.locked} locked` : ''}` : '';
      toast?.(`${b.label} fired${detail}`, 'success');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  function onButtonClick(b) {
    if (mode !== 'live') { setSelId(b.id); return; }
    if (b.confirm) setFireBtn(b); else fireButton(b);
  }

  // Keyboard shortcuts fire buttons in Live mode (F-keys, digits, letters).
  useEffect(() => {
    if (mode !== 'live') return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = (e.key || '').toLowerCase();
      const b = buttons.find(x => (x.shortcut || '').trim().toLowerCase() === key && key);
      if (b) { e.preventDefault(); if (b.confirm) setFireBtn(b); else fireButton(b); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, buttons]);

  const layoutName = useCallback((id) => layouts.find(l => l.id === id)?.name || null, [layouts]);

  // Deck lifecycle: flip draft <-> published.
  async function setStatus(status) {
    if (!deck) return;
    setDeck(d => ({ ...d, status }));
    try { await api.put(`/decks/${deck.id}`, { status }); loadDecks(); }
    catch (e) { toast?.(e.message, 'error'); }
  }

  // Live "on air" = the most common current layout across screens (derived from
  // liveState so it tracks every take, not just the initial fetch).
  const onAirName = useMemo(() => {
    const counts = {};
    Object.values(liveState).forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; });
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return top ? layoutName(top) : null;
  }, [liveState, layoutName]);

  // ── Deck ops ───────────────────────────────────────────────────────────────
  async function createDeck() {
    if (!studioId) return;
    const name = window.prompt('New deck name', 'Screen Control');
    if (!name) return;
    try {
      const d = await api.post('/decks', { studio_id: studioId, name });
      await loadDecks();
      setDeckId(d.id);
      toast?.('Deck created', 'success');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  async function renameDeck() {
    if (!deck) return;
    const name = window.prompt('Rename deck', deck.name);
    if (!name || name === deck.name) return;
    try { await api.put(`/decks/${deck.id}`, { name }); setDeck(d => ({ ...d, name })); loadDecks(); }
    catch (e) { toast?.(e.message, 'error'); }
  }

  async function resizeDeck(patch) {
    if (!deck) return;
    const next = { ...deck, ...patch };
    setDeck(next);
    try { await api.put(`/decks/${deck.id}`, patch); } catch (e) { toast?.(e.message, 'error'); }
  }

  async function deleteDeck() {
    if (!deck) return;
    try {
      await api.delete(`/decks/${deck.id}`);
      toast?.('Deck deleted', 'success');
      setDeckId(null);
      await loadDecks();
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ── Button ops ─────────────────────────────────────────────────────────────
  const occupied = useMemo(() => {
    const m = new Map();
    buttons.forEach(b => cellsOf(b).forEach(c => m.set(c, b.id)));
    return m;
  }, [buttons]);

  async function addButton(x, y, preset = LIBRARY[0]) {
    if (!deck || busy) return;
    setBusy(true);
    try {
      const a = ACTIONS[preset.action_type];
      const body = {
        studio_id: studioId, deck_id: deck.id,
        label: preset.label, icon: preset.icon || '', color: a.color,
        action_type: preset.action_type, action_payload: {},
        confirm: !!preset.confirm || !!a.guard,
        x, y, w: 1, h: 1,
        target: a.needsTarget ? 'all' : null,
      };
      const b = await api.post('/console/buttons', body);
      setButtons(prev => [...prev, b]);
      setSelId(b.id);
    } catch (e) { toast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }

  // Update local immediately; persist to server. `payloadDirty` rebuilds action_payload.
  async function patchButton(id, patch, persist = true) {
    setButtons(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    if (!persist) return;
    try { await api.put(`/console/buttons/${id}`, patch); }
    catch (e) { toast?.(e.message, 'error'); loadDeck(deckId); }
  }

  async function deleteButton(id) {
    try { await api.delete(`/console/buttons/${id}`); setButtons(prev => prev.filter(b => b.id !== id)); if (selId === id) setSelId(null); }
    catch (e) { toast?.(e.message, 'error'); }
  }

  function moveButton(id, x, y) {
    // Only move onto free cells (ignoring the button's own footprint).
    const b = buttons.find(x2 => x2.id === id); if (!b) return;
    const own = new Set(cellsOf(b));
    for (let dy = 0; dy < (b.h || 1); dy++)
      for (let dx = 0; dx < (b.w || 1); dx++) {
        const c = `${x + dx},${y + dy}`;
        if (x + dx >= cols || y + dy >= rows) return;
        if (occupied.has(c) && !own.has(c)) return; // collision
      }
    patchButton(id, { x, y });
  }

  // Rebuild a button's action from the inspector, writing action_type + payload + target defaults.
  function setAction(id, action_type) {
    const a = ACTIONS[action_type];
    patchButton(id, {
      action_type,
      action_payload: {},
      color: a.color,
      confirm: !!a.guard,
      target: a.needsTarget ? (buttons.find(b => b.id === id)?.target || 'all') : null,
    });
  }
  function setPayload(id, payload) { patchButton(id, { action_payload: payload }); }

  const targetLabel = useCallback((t) => {
    if (!t || t === 'all') return 'All screens';
    if (t.startsWith('group:')) return `Group · ${groups.find(g => g.id === t.slice(6))?.name || t.slice(6)}`;
    return screens.find(s => s.id === t)?.name || t;
  }, [groups, screens]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!studioId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950 text-center p-8">
        <div>
          <div className="text-4xl mb-3">🎛️</div>
          <p className="text-gray-300 font-semibold mb-1">No studio selected</p>
          <p className="text-gray-500 text-sm mb-4">Pick a studio to design a control deck for its screens.</p>
          {isSuperAdmin && studios.length > 0 && (
            <select value={studioId || ''} onChange={e => setStudioId(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg text-sm">
              <option value="">Select studio…</option>
              {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/60 shrink-0">
        <span className="text-sm font-semibold text-white mr-1">Deck Designer</span>
        <div className="flex rounded-md overflow-hidden border border-gray-700 text-[10px] font-mono uppercase tracking-wider">
          <button onClick={() => { setMode('edit'); }} className={`px-2.5 py-1 transition-colors ${mode === 'edit' ? 'bg-amber-600/30 text-amber-300' : 'text-gray-400 hover:bg-gray-800'}`}>Edit</button>
          <button onClick={() => { setMode('live'); setSelId(null); }} className={`px-2.5 py-1 transition-colors flex items-center gap-1 ${mode === 'live' ? 'bg-red-600/40 text-red-200' : 'text-gray-400 hover:bg-gray-800'}`}>
            {mode === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}Live
          </button>
        </div>
        <div className="w-px h-5 bg-gray-800 mx-1" />
        {isSuperAdmin && studios.length > 0 && (
          <select value={studioId} onChange={e => setStudioId(e.target.value)}
            className="px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs">
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select value={deckId || ''} onChange={e => setDeckId(e.target.value)}
          className="px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs min-w-[10rem]">
          {decks.length === 0 && <option value="">No decks yet</option>}
          {decks.map(d => <option key={d.id} value={d.id}>{d.name} ({d.button_count})</option>)}
        </select>
        <button onClick={createDeck} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded">+ New</button>
        {deck && (
          <>
            <button onClick={renameDeck} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded">Rename</button>
            <button onClick={() => setStatus(deck.status === 'published' ? 'draft' : 'published')}
              title={deck.status === 'published' ? 'Published — click to unpublish' : 'Draft — click to publish'}
              className={`px-2 py-1 text-xs rounded font-medium ${deck.status === 'published' ? 'bg-emerald-700/40 text-emerald-300 hover:bg-emerald-700/60' : 'bg-amber-700/30 text-amber-300 hover:bg-amber-700/50'}`}>
              {deck.status === 'published' ? '● Published' : '○ Draft'}
            </button>
            <a href={`/deck/${deck.id}`} target="_blank" rel="noopener noreferrer" title="Open touch surface (tablet / on-wall)"
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded">Surface ↗</a>
            <div className="flex items-center gap-1 text-xs text-gray-500 ml-1">
              <span>Grid</span>
              <input type="number" min={1} max={12} value={cols} onChange={e => resizeDeck({ grid_cols: Math.max(1, +e.target.value || 1) })}
                className="w-11 px-1 py-0.5 bg-gray-900 border border-gray-700 text-white rounded text-xs" />
              <span>×</span>
              <input type="number" min={1} max={12} value={rows} onChange={e => resizeDeck({ grid_rows: Math.max(1, +e.target.value || 1) })}
                className="w-11 px-1 py-0.5 bg-gray-900 border border-gray-700 text-white rounded text-xs" />
            </div>
            <button onClick={() => setConfirmDelete(true)} className="ml-auto px-2 py-1 text-red-400 hover:bg-red-950/40 text-xs rounded">Delete deck</button>
          </>
        )}
      </div>

      {!deck ? (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <div className="text-4xl mb-3">🎛️</div>
            <p className="text-gray-300 font-semibold mb-1">No deck selected</p>
            <p className="text-gray-500 text-sm mb-4">Create a deck to start placing screen-control buttons.</p>
            <button onClick={createDeck} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Create deck</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Library (edit only) */}
          {mode === 'edit' && (
          <div className="w-40 shrink-0 border-r border-gray-800 p-2 overflow-y-auto">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2 px-1">Library</p>
            <p className="text-[10px] text-gray-600 mb-2 px-1 leading-snug">Click an empty cell, or drag a preset onto the grid.</p>
            {LIBRARY.map(p => (
              <div key={p.action_type} draggable
                onDragStart={e => { e.dataTransfer.setData('preset', p.action_type); setDragId(null); }}
                className="flex items-center gap-2 px-2 py-2 mb-1.5 bg-gray-800/70 hover:bg-gray-700 rounded-lg cursor-grab active:cursor-grabbing text-sm"
                style={{ borderLeft: `3px solid ${ACTIONS[p.action_type].color}` }}>
                <span>{p.icon}</span><span className="text-gray-200 text-xs font-medium">{p.label}</span>
              </div>
            ))}
          </div>
          )}

          {/* Canvas */}
          <div className="flex-1 min-w-0 overflow-auto p-6 flex items-start justify-center">
            <div className="relative w-full"
              style={{ maxWidth: 860 }}>
              <div className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, minmax(72px, 1fr))`, aspectRatio: `${cols} / ${rows}` }}>
                {/* Empty drop cells (edit only) */}
                {mode === 'edit' && Array.from({ length: rows }).flatMap((_, y) => Array.from({ length: cols }).map((_, x) => {
                  if (occupied.has(`${x},${y}`)) return null;
                  return (
                    <button key={`cell-${x}-${y}`}
                      onClick={() => addButton(x, y)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const presetType = e.dataTransfer.getData('preset');
                        if (presetType) addButton(x, y, LIBRARY.find(l => l.action_type === presetType));
                        else if (dragId != null) moveButton(dragId, x, y);
                        setDragId(null);
                      }}
                      style={{ gridColumn: `${x + 1} / span 1`, gridRow: `${y + 1} / span 1` }}
                      className="rounded-lg border border-dashed border-gray-800 hover:border-blue-600 hover:bg-blue-950/20 text-gray-700 hover:text-blue-400 text-xl transition-colors flex items-center justify-center"
                      title="Add button">+</button>
                  );
                }))}
                {/* Placed buttons */}
                {buttons.map(b => {
                  const a = ACTIONS[b.action_type] || {};
                  const isSel = b.id === selId;
                  const isMode = b.mode === 'toggle' || b.mode === 'multi';
                  const lit = mode === 'live' && !isMode && isLive(b);
                  const disp = displayOf(b);
                  return (
                    <div key={b.id} draggable={mode === 'edit'}
                      onDragStart={e => { if (mode !== 'edit') return; setDragId(b.id); e.dataTransfer.setData('text/plain', b.id); }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => onButtonClick(b)}
                      style={{
                        gridColumn: `${(b.x || 0) + 1} / span ${b.w || 1}`,
                        gridRow: `${(b.y || 0) + 1} / span ${b.h || 1}`,
                        background: disp.color || a.color || '#374151',
                        outline: isSel ? '2px solid #60a5fa' : lit ? '2px solid #34d399' : 'none', outlineOffset: 2,
                        boxShadow: lit ? '0 0 0 1px rgba(52,211,153,.6), 0 0 22px rgba(52,211,153,.45)' : undefined,
                      }}
                      className={`relative rounded-lg flex flex-col items-center justify-center gap-1 p-2 text-center shadow-lg select-none ${mode === 'live' ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-grab active:cursor-grabbing'}`}>
                      {lit && <span className="absolute top-1 right-1.5 text-[8px] font-mono font-bold text-emerald-300 tracking-wider">● LIVE</span>}
                      {isMode && <span className="absolute top-1 right-1.5 text-[8px] font-mono font-bold text-white/70 bg-black/25 rounded px-1">{disp.badge}</span>}
                      {b.shortcut && <span className="absolute top-1 left-1.5 text-[9px] font-mono font-bold text-white/70 bg-black/30 rounded px-1 leading-tight">{b.shortcut}</span>}
                      {disp.icon && <span className="text-2xl leading-none">{disp.icon}</span>}
                      <span className="text-white text-sm font-bold leading-tight">{disp.label}</span>
                      {!isMode && b.action_type === 'take_layout' && b.action_payload?.layout_id && (
                        <span className="text-white/70 text-[10px] leading-tight truncate max-w-full">
                          {layouts.find(l => l.id === b.action_payload.layout_id)?.name || 'layout'}
                        </span>
                      )}
                      {!isMode && a.needsTarget && <span className="text-white/60 text-[9px] font-mono">{targetLabel(b.target)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inspector (edit) / Program (live) */}
          <div className="w-64 shrink-0 border-l border-gray-800 overflow-y-auto">
            {mode === 'live' ? (
              <div className="p-3 space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Program</p>
                <div className="text-xs text-gray-400">On air: <span className="text-white font-semibold">{onAirName || '—'}</span></div>
                <div className="space-y-1">
                  {screens.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-900/60 rounded text-xs">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.is_online ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <span className="text-gray-300 truncate">{s.name}</span>
                      </span>
                      <span className="text-gray-500 truncate">{layoutName(liveState[s.id]) || '—'}</span>
                    </div>
                  ))}
                  {screens.length === 0 && <p className="text-[11px] text-gray-600">No screens in this studio.</p>}
                </div>
                <p className="text-[10px] text-gray-600 leading-snug pt-1">Tap a button to fire it live. A green ring = it's currently on its target.</p>
              </div>
            ) : !sel ? (
              <div className="p-4 text-center text-gray-600 text-xs mt-8">
                Select a button to edit it, or click an empty cell to add one.
              </div>
            ) : (
              <div className="p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Button</p>
                  <div className="flex gap-1">
                    <button onClick={() => { const { id, ...rest } = sel; addButtonAt(rest); }}
                      className="text-[10px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-gray-800" title="Duplicate to first free cell">Dup</button>
                    <button onClick={() => deleteButton(sel.id)}
                      className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/40">Delete</button>
                  </div>
                </div>

                {/* Look */}
                <Section title="Look">
                  <Field label="Label"><input value={sel.label || ''} onChange={e => patchButton(sel.id, { label: e.target.value }, false)} onBlur={e => patchButton(sel.id, { label: e.target.value })} className={inp} /></Field>
                  <Field label="Icon"><input value={sel.icon || ''} onChange={e => patchButton(sel.id, { icon: e.target.value }, false)} onBlur={e => patchButton(sel.id, { icon: e.target.value })} placeholder="emoji" className={inp} /></Field>
                  <Field label="Colour"><input type="color" value={sel.color || '#374151'} onChange={e => patchButton(sel.id, { color: e.target.value })} className="w-full h-7 bg-transparent border border-gray-700 rounded cursor-pointer" /></Field>
                </Section>

                {/* Behaviour */}
                <Section title="Action">
                  <Field label="Mode">
                    <select value={sel.mode || 'momentary'} onChange={e => setButtonMode(sel.id, e.target.value)} className={inp}>
                      <option value="momentary">Momentary</option>
                      <option value="toggle">Toggle (2 states)</option>
                      <option value="multi">Multi-state</option>
                    </select>
                  </Field>

                  {(!sel.mode || sel.mode === 'momentary') ? (
                    <>
                      <Field label="Type">
                        <select value={sel.action_type} onChange={e => setAction(sel.id, e.target.value)} className={inp}>
                          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </Field>
                      {ACTIONS[sel.action_type]?.needsLayout && (
                        <Field label="Layout">
                          <select value={sel.action_payload?.layout_id || ''} onChange={e => setPayload(sel.id, { layout_id: e.target.value })} className={inp}>
                            <option value="">— pick layout —</option>
                            {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </Field>
                      )}
                      {ACTIONS[sel.action_type]?.needsScene && (
                        <Field label="Scene">
                          <select value={sel.action_payload?.scene_id || ''} onChange={e => setPayload(sel.id, { scene_id: e.target.value })} className={inp}>
                            <option value="">— pick scene —</option>
                            {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </Field>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2 mt-1">
                      {(sel.states || []).map((st, i) => (
                        <div key={i} className="border border-gray-800 rounded-lg p-2 space-y-1.5 bg-gray-900/40">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gray-500">
                              {sel.mode === 'toggle' ? (i ? 'ON' : 'OFF') : `STATE ${i + 1}`}
                              {(stateIdx[sel.id] || 0) === i && <span className="text-emerald-400"> ● current</span>}
                            </span>
                            {sel.mode === 'multi' && (sel.states || []).length > 2 && (
                              <button onClick={() => removeState(sel.id, i)} className="text-[10px] text-red-400 hover:text-red-300" title="Remove state">✕</button>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <input value={st.label || ''} onChange={e => updateState(sel.id, i, { label: e.target.value })} placeholder="label" className={inp + ' flex-1'} />
                            <input type="color" value={st.color || '#374151'} onChange={e => updateState(sel.id, i, { color: e.target.value })} className="w-7 h-7 bg-transparent border border-gray-700 rounded cursor-pointer shrink-0" />
                          </div>
                          <select value={st.action_type} onChange={e => updateState(sel.id, i, { action_type: e.target.value, action_payload: {} })} className={inp}>
                            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                          {ACTIONS[st.action_type]?.needsLayout && (
                            <select value={st.action_payload?.layout_id || ''} onChange={e => updateState(sel.id, i, { action_payload: { layout_id: e.target.value } })} className={inp}>
                              <option value="">— layout —</option>
                              {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          )}
                          {ACTIONS[st.action_type]?.needsScene && (
                            <select value={st.action_payload?.scene_id || ''} onChange={e => updateState(sel.id, i, { action_payload: { scene_id: e.target.value } })} className={inp}>
                              <option value="">— scene —</option>
                              {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                          {ACTIONS[st.action_type]?.needsTarget && (
                            <select value={st.target || 'all'} onChange={e => updateState(sel.id, i, { target: e.target.value })} className={inp}>
                              <option value="all">All screens</option>
                              {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              {groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                      {sel.mode === 'multi' && (
                        <button onClick={() => addState(sel.id)} className="w-full text-[11px] text-blue-400 hover:text-blue-300 py-1 border border-dashed border-gray-700 rounded-lg">+ Add state</button>
                      )}
                      <p className="text-[10px] text-gray-600 leading-snug">Each tap in Live advances to the next state and runs its action.</p>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer mt-1">
                    <input type="checkbox" checked={!!sel.confirm} onChange={e => patchButton(sel.id, { confirm: e.target.checked })} className="accent-blue-500" />
                    Confirm before firing
                  </label>
                  <Field label="Shortcut (fires in Live)">
                    <input value={sel.shortcut || ''} onChange={e => patchButton(sel.id, { shortcut: e.target.value }, false)} onBlur={e => patchButton(sel.id, { shortcut: e.target.value.trim() })} placeholder="e.g. F1 · 1 · q" className={inp} />
                  </Field>
                </Section>

                {/* Target (momentary only — mode states carry their own target) */}
                {(!sel.mode || sel.mode === 'momentary') && ACTIONS[sel.action_type]?.needsTarget && (
                  <Section title="Target">
                    <select value={sel.target || 'all'} onChange={e => patchButton(sel.id, { target: e.target.value })} className={inp}>
                      <option value="all">All screens</option>
                      {screens.length > 0 && <optgroup label="Screen">{screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
                      {groups.length > 0 && <optgroup label="Group">{groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}</optgroup>}
                    </select>
                  </Section>
                )}

                {/* Placement */}
                <Section title="Placement">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="X"><input type="number" min={0} max={cols - 1} value={sel.x || 0} onChange={e => patchButton(sel.id, { x: Math.max(0, Math.min(cols - 1, +e.target.value || 0)) })} className={inp} /></Field>
                    <Field label="Y"><input type="number" min={0} max={rows - 1} value={sel.y || 0} onChange={e => patchButton(sel.id, { y: Math.max(0, Math.min(rows - 1, +e.target.value || 0)) })} className={inp} /></Field>
                    <Field label="W"><input type="number" min={1} max={cols} value={sel.w || 1} onChange={e => patchButton(sel.id, { w: Math.max(1, Math.min(cols, +e.target.value || 1)) })} className={inp} /></Field>
                    <Field label="H"><input type="number" min={1} max={rows} value={sel.h || 1} onChange={e => patchButton(sel.id, { h: Math.max(1, Math.min(rows, +e.target.value || 1)) })} className={inp} /></Field>
                  </div>
                </Section>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete deck"
        message={`Delete "${deck?.name}" and all its buttons? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); deleteDeck(); }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Guarded fire — confirm before pushing to live screens */}
      <ConfirmDialog
        open={!!fireBtn}
        title={`Fire "${fireBtn?.label}"?`}
        message={`This runs "${ACTIONS[fireBtn?.action_type]?.label || fireBtn?.action_type}" on ${targetLabel(fireBtn?.target).toLowerCase()} now, live.`}
        confirmLabel="Fire"
        variant="danger"
        onConfirm={() => { const b = fireBtn; setFireBtn(null); if (b) fireButton(b); }}
        onCancel={() => setFireBtn(null)}
      />
    </div>
  );

  // Duplicate helper (declared after render uses hoisted function)
  function addButtonAt(rest) {
    // find first free cell
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (!occupied.has(`${x},${y}`)) {
        api.post('/console/buttons', {
          studio_id: studioId, deck_id: deck.id,
          label: rest.label, sublabel: rest.sublabel, icon: rest.icon, color: rest.color,
          action_type: rest.action_type, action_payload: rest.action_payload || {},
          confirm: rest.confirm, x, y, w: 1, h: 1, target: rest.target,
        }).then(b => { setButtons(prev => [...prev, b]); setSelId(b.id); }).catch(e => toast?.(e.message, 'error'));
        return;
      }
    }
    toast?.('No free cell — enlarge the grid', 'error');
  }
}

const inp = 'w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-blue-500';

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] text-gray-500 block mb-0.5">{label}</span>
      {children}
    </label>
  );
}
