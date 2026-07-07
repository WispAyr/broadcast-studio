import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useLiveData from '../../hooks/useLiveData';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';

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
        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 border border-amber-700/50 rounded px-1.5 py-0.5">Edit</span>
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
          {/* Library */}
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

          {/* Canvas */}
          <div className="flex-1 min-w-0 overflow-auto p-6 flex items-start justify-center">
            <div className="relative w-full"
              style={{ maxWidth: 860 }}>
              <div className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, minmax(72px, 1fr))`, aspectRatio: `${cols} / ${rows}` }}>
                {/* Empty drop cells */}
                {Array.from({ length: rows }).flatMap((_, y) => Array.from({ length: cols }).map((_, x) => {
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
                  return (
                    <div key={b.id} draggable
                      onDragStart={e => { setDragId(b.id); e.dataTransfer.setData('text/plain', b.id); }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setSelId(b.id)}
                      style={{
                        gridColumn: `${(b.x || 0) + 1} / span ${b.w || 1}`,
                        gridRow: `${(b.y || 0) + 1} / span ${b.h || 1}`,
                        background: b.color || a.color || '#374151',
                        outline: isSel ? '2px solid #60a5fa' : 'none', outlineOffset: 2,
                      }}
                      className="rounded-lg cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-1 p-2 text-center shadow-lg select-none">
                      {b.icon && <span className="text-2xl leading-none">{b.icon}</span>}
                      <span className="text-white text-sm font-bold leading-tight">{b.label}</span>
                      {b.action_type === 'take_layout' && b.action_payload?.layout_id && (
                        <span className="text-white/70 text-[10px] leading-tight truncate max-w-full">
                          {layouts.find(l => l.id === b.action_payload.layout_id)?.name || 'layout'}
                        </span>
                      )}
                      {a.needsTarget && <span className="text-white/60 text-[9px] font-mono">{targetLabel(b.target)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inspector */}
          <div className="w-64 shrink-0 border-l border-gray-800 overflow-y-auto">
            {!sel ? (
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
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer mt-1">
                    <input type="checkbox" checked={!!sel.confirm} onChange={e => patchButton(sel.id, { confirm: e.target.checked })} className="accent-blue-500" />
                    Confirm before firing
                  </label>
                </Section>

                {/* Target */}
                {ACTIONS[sel.action_type]?.needsTarget && (
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
