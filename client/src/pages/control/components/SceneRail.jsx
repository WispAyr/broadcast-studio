import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';
import { useToast } from '../../../components/Toast';

// SceneRail: sits above the LayoutHotbar. A "scene" is a named snapshot
// of layout-per-screen assignments for the current studio, applied
// atomically with one click. Designed for live events where the operator
// needs to flip the whole wall between pre-rehearsed looks ("Race Start",
// "Mid-Event", "Awards", etc).
//
// The save-current button captures whatever layouts each screen is
// currently showing (snapshot=true on the server). Apply respects the
// padlock + public_only safety rails and surfaces pushed / locked counts
// in the toast.
export default function SceneRail({ studioId, onApplied }) {
  const toast = useToast();
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!studioId) { setScenes([]); setLoading(false); return; }
    try {
      const data = await api.get(`/scenes?studio_id=${studioId}`);
      setScenes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[SceneRail] load failed:', err);
      setScenes([]);
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveCurrent(e) {
    e?.preventDefault?.();
    if (!sceneName.trim()) return;
    setBusy(true);
    try {
      await api.post('/scenes', {
        name: sceneName.trim(),
        description: sceneDescription.trim() || null,
        studio_id: studioId,
        snapshot: true,
      });
      toast?.('Scene saved', 'success');
      setSavePromptOpen(false);
      setSceneName('');
      setSceneDescription('');
      load();
    } catch (err) {
      toast?.(`Save failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleApply(scene) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post(`/scenes/${scene.id}/apply`);
      const applied = res?.applied ?? 0;
      const locked = res?.locked ?? 0;
      const skipped = res?.skipped ?? 0;
      const notes = [];
      if (locked > 0) notes.push(`${locked} locked`);
      if (skipped > 0) notes.push(`${skipped} missing`);
      const suffix = notes.length ? ` (${notes.join(', ')})` : '';
      toast?.(`"${scene.name}": ${applied} screen${applied !== 1 ? 's' : ''}${suffix}`, locked > 0 || skipped > 0 ? 'warning' : 'success');
      onApplied?.(scene);
    } catch (err) {
      // Public-only reject surfaces here as "Studio is public-only — scene contains …"
      toast?.(err.message || 'Scene apply failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(scene, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete scene "${scene.name}"?`)) return;
    try {
      await api.delete(`/scenes/${scene.id}`);
      toast?.('Scene deleted', 'success');
      load();
    } catch (err) {
      toast?.(`Delete failed: ${err.message}`, 'error');
    }
  }

  if (loading) return null;

  return (
    <div className="px-4 pt-2 pb-1 border-b border-gray-800/40">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold shrink-0 mr-1">Scenes</span>
        {scenes.map(scene => {
          const count = Array.isArray(scene.assignments) ? scene.assignments.length : 0;
          return (
            <button key={scene.id} onClick={() => handleApply(scene)} disabled={busy}
              title={`${scene.description || scene.name} — ${count} screen${count !== 1 ? 's' : ''}${scene.description ? '\n' + scene.description : ''}`}
              className="group relative shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-900/25 border border-indigo-700/40 hover:bg-indigo-800/40 hover:border-indigo-500/60 text-indigo-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <span className="text-[11px] font-semibold">{scene.name}</span>
              <span className="text-[9px] font-mono text-indigo-400/80 bg-indigo-950/40 px-1.5 py-0.5 rounded">{count}</span>
              <span onClick={e => handleDelete(scene, e)} role="button" tabIndex={0}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs ml-0.5 transition-opacity" title="Delete scene">
                ×
              </span>
            </button>
          );
        })}
        {!scenes.length && (
          <span className="text-[10px] text-gray-700 italic shrink-0">No scenes yet — save the current wall as a starting point.</span>
        )}
        <div className="flex-1" />
        <button onClick={() => setSavePromptOpen(true)} disabled={busy || !studioId}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/25 border border-emerald-700/40 hover:bg-emerald-800/40 hover:border-emerald-500/60 text-emerald-300 text-[11px] font-semibold transition-all disabled:opacity-40">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Save current
        </button>
      </div>

      {savePromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleSaveCurrent} className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4">
            <h3 className="text-white font-semibold text-lg">Save scene</h3>
            <p className="text-xs text-gray-400 -mt-2">Captures the current layout of every screen in this studio. Apply later to restore the whole wall in one click.</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Scene name</label>
              <input autoFocus value={sceneName} onChange={e => setSceneName(e.target.value)} required
                placeholder="e.g. Race Start, Mid-Event, Awards"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
              <input value={sceneDescription} onChange={e => setSceneDescription(e.target.value)}
                placeholder="When to use this scene"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setSavePromptOpen(false)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
              <button type="submit" disabled={busy || !sceneName.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors font-medium">
                {busy ? 'Saving…' : 'Save scene'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
