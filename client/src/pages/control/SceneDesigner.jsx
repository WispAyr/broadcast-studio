import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useLiveData from '../../hooks/useLiveData';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';

// Scene Designer — author a scene (a named layout-per-screen snapshot) by
// picking a layout for each screen, without having to arrange the live wall
// first. Uses the scenes API's explicit `assignments` (POST/PUT); no server
// change. Applying a scene stays the operator's action (here + Scenes rail +
// Deck) — designing it is inert.

export default function SceneDesigner() {
  const { studioId, studios, setStudioId, isSuperAdmin, layouts } = useLiveData();
  const toast = useToast();

  const [scenes, setScenes] = useState([]);
  const [screens, setScreens] = useState([]);
  const [selId, setSelId] = useState(null);       // scene id | 'new' | null
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assign, setAssign] = useState({});        // screenId -> layoutId
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const layoutName = useCallback((id) => layouts.find(l => l.id === id)?.name || null, [layouts]);

  const loadScenes = useCallback(async () => {
    if (!studioId) { setScenes([]); return; }
    try { const s = await api.get(`/scenes?studio_id=${studioId}`); setScenes(Array.isArray(s) ? s : []); }
    catch (e) { toast?.(e.message, 'error'); }
  }, [studioId, toast]);

  useEffect(() => { loadScenes(); }, [loadScenes]);
  useEffect(() => {
    if (!studioId) { setScreens([]); return; }
    api.get(`/console/state?studio_id=${studioId}`).then(st => setScreens(st.screens || [])).catch(() => setScreens([]));
    setSelId(null);
  }, [studioId]);

  function newScene() { setSelId('new'); setName(''); setDescription(''); setAssign({}); setDirty(false); }
  function selectScene(sc) {
    setSelId(sc.id); setName(sc.name || ''); setDescription(sc.description || '');
    const m = {}; (sc.assignments || []).forEach(a => { m[a.screen_id] = a.layout_id; });
    setAssign(m); setDirty(false);
  }
  function setScreenLayout(screenId, layoutId) {
    setAssign(a => { const n = { ...a }; if (layoutId) n[screenId] = layoutId; else delete n[screenId]; return n; });
    setDirty(true);
  }
  function snapshotCurrent() {
    const m = {};
    screens.forEach(s => { if (s.current_layout_id) m[s.id] = s.current_layout_id; });
    setAssign(m); setDirty(true);
    toast?.('Filled from what’s currently on each screen', 'success');
  }

  const assignmentsArray = () => Object.entries(assign).filter(([, l]) => l).map(([screen_id, layout_id]) => ({ screen_id, layout_id }));
  const assignedCount = Object.values(assign).filter(Boolean).length;

  async function save() {
    if (!name.trim()) { toast?.('Name the scene first', 'error'); return; }
    setBusy(true);
    const body = { name: name.trim(), description: description.trim() || null, studio_id: studioId, assignments: assignmentsArray() };
    try {
      if (selId === 'new') { const sc = await api.post('/scenes', body); await loadScenes(); setSelId(sc.id); }
      else { await api.put(`/scenes/${selId}`, body); await loadScenes(); }
      setDirty(false); toast?.('Scene saved', 'success');
    } catch (e) { toast?.(e.message, 'error'); } finally { setBusy(false); }
  }
  async function del() {
    if (selId === 'new' || !selId) return;
    try { await api.delete(`/scenes/${selId}`); toast?.('Scene deleted', 'success'); setSelId(null); await loadScenes(); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  async function apply(sc) {
    try {
      const r = await api.post(`/scenes/${sc.id}/apply`);
      const notes = [r.locked ? `${r.locked} locked` : '', r.skipped ? `${r.skipped} missing` : ''].filter(Boolean);
      toast?.(`"${sc.name}": ${r.applied ?? 0} screen${(r.applied ?? 0) !== 1 ? 's' : ''}${notes.length ? ` (${notes.join(', ')})` : ''}`, notes.length ? 'warning' : 'success');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  const editing = selId !== null;
  const sel = { name, description };

  if (!studioId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950 text-center p-8">
        <div>
          <div className="text-4xl mb-3">🎭</div>
          <p className="text-gray-300 font-semibold mb-1">No studio selected</p>
          <p className="text-gray-500 text-sm mb-4">Pick a studio to design scenes for its screens.</p>
          {isSuperAdmin && studios.length > 0 && (
            <select value={studioId || ''} onChange={e => setStudioId(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg text-sm">
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
        <span className="text-sm font-semibold text-white mr-1">Scene Designer</span>
        {isSuperAdmin && studios.length > 0 && (
          <select value={studioId} onChange={e => setStudioId(e.target.value)} className="px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs">
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <span className="text-xs text-gray-500 ml-auto">{screens.length} screen{screens.length !== 1 ? 's' : ''} · {layouts.length} layout{layouts.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Scene list */}
        <div className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
          <div className="p-2 border-b border-gray-800">
            <button onClick={newScene} className="w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded">+ New scene</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {scenes.map(sc => (
              <div key={sc.id} onClick={() => selectScene(sc)}
                className={`group px-2.5 py-2 rounded-lg cursor-pointer border transition-colors ${selId === sc.id ? 'bg-indigo-900/40 border-indigo-600' : 'bg-gray-900/60 border-transparent hover:bg-gray-800'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white font-medium truncate">{sc.name}</span>
                  <button onClick={e => { e.stopPropagation(); apply(sc); }} title="Apply this scene now (live)"
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-400 hover:text-emerald-300 shrink-0">Apply</button>
                </div>
                <div className="text-[10px] text-gray-500">{(sc.assignments || []).length} screen{(sc.assignments || []).length !== 1 ? 's' : ''}{sc.description ? ` · ${sc.description}` : ''}</div>
              </div>
            ))}
            {scenes.length === 0 && <p className="text-[11px] text-gray-600 px-1 py-2">No scenes yet — create one.</p>}
          </div>
        </div>

        {/* Editor */}
        {!editing ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-3">🎭</div>
              <p className="text-gray-300 font-semibold mb-1">Design a scene</p>
              <p className="text-gray-500 text-sm mb-4 max-w-xs">A scene sets a layout on each screen at once. Pick a scene to edit, or create a new one.</p>
              <button onClick={newScene} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Create scene</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 overflow-y-auto p-5">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Header */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block mb-1">Scene name</label>
                  <input value={name} onChange={e => { setName(e.target.value); setDirty(true); }} placeholder="e.g. Race Start, Mid-Event, Awards"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <button onClick={snapshotCurrent} title="Fill each screen with the layout it's showing right now"
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs rounded-lg shrink-0">Snapshot current wall</button>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block mb-1">Description (optional)</label>
                <input value={description} onChange={e => { setDescription(e.target.value); setDirty(true); }} placeholder="When to use this scene"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>

              {/* Per-screen layout picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Layout per screen</span>
                  <span className="text-[10px] text-gray-600">{assignedCount} of {screens.length} assigned</span>
                </div>
                <div className="space-y-1.5">
                  {screens.map(s => {
                    const chosen = assign[s.id] || '';
                    const current = s.current_layout_id;
                    return (
                      <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${chosen ? 'bg-gray-900/70 border-gray-700' : 'bg-gray-900/30 border-gray-800'}`}>
                        <span className="flex items-center gap-2 min-w-0 w-40 shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.is_online ? 'bg-green-400' : 'bg-gray-600'}`} />
                          <span className="text-sm text-gray-200 truncate">{s.name}</span>
                        </span>
                        <select value={chosen} onChange={e => setScreenLayout(s.id, e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-blue-500">
                          <option value="">— leave unchanged —</option>
                          {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        {current && current !== chosen && (
                          <button onClick={() => setScreenLayout(s.id, current)} title="Use what's on this screen now"
                            className="text-[10px] text-gray-500 hover:text-gray-300 shrink-0 whitespace-nowrap">now: {layoutName(current) || '…'}</button>
                        )}
                      </div>
                    );
                  })}
                  {screens.length === 0 && <p className="text-[11px] text-gray-600">No screens in this studio.</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                <button onClick={save} disabled={busy || !name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg">
                  {busy ? 'Saving…' : selId === 'new' ? 'Create scene' : 'Save changes'}
                </button>
                {dirty && <span className="text-[11px] text-amber-400">unsaved changes</span>}
                {selId !== 'new' && (
                  <>
                    <button onClick={() => apply({ id: selId, name })} className="px-3 py-2 bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-200 text-sm rounded-lg">Apply now</button>
                    <button onClick={() => setConfirmDel(true)} className="ml-auto px-3 py-2 text-red-400 hover:bg-red-950/40 text-sm rounded-lg">Delete</button>
                  </>
                )}
                <p className="text-[10px] text-gray-600 leading-snug ml-2 flex-1">
                  Screens left "unchanged" aren't touched when the scene applies. Applying is live — safe to build here, fire from a Deck or the Scenes rail at showtime.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete scene"
        message={`Delete "${name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { setConfirmDel(false); del(); }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}
