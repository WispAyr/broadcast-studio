import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';
import { useToast } from '../../../components/Toast';

// ScheduleRail: horizontal strip of upcoming + recently-fired scheduled
// layout changes. Opens a modal for "Schedule layout at T" so an operator
// can queue up "Awards layout at 17:30" without sitting at the desk.
//
// Three scopes:
//   - studio  — fan out one layout to every accepting screen
//   - screen  — target one specific screen
//   - scene   — fire a saved scene (layout-per-screen snapshot)
//
// The server runs a 15s worker that applies due entries. Safety rails (
// padlock + public_only) are enforced there — scheduler doesn't bypass them.
export default function ScheduleRail({ studioId, layouts, screens }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Modal form state
  const [scope, setScope] = useState('studio');
  const [targetId, setTargetId] = useState('');
  const [layoutId, setLayoutId] = useState('');
  const [when, setWhen] = useState('');          // datetime-local string
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!studioId) return;
    try {
      const [items, scenes] = await Promise.all([
        api.get(`/scheduled-layouts?studio_id=${studioId}`),
        api.get(`/scenes?studio_id=${studioId}`),
      ]);
      setItems(Array.isArray(items) ? items : []);
      setScenes(Array.isArray(scenes) ? scenes : []);
    } catch (err) {
      console.warn('[ScheduleRail] load failed:', err);
    }
  }, [studioId]);

  useEffect(() => {
    load();
    // Refresh fairly often so ops see the fired/pending flip without a manual reload.
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [load]);

  async function handleCreate(e) {
    e?.preventDefault?.();
    if (busy) return;
    if (!when) { toast?.('Pick a time', 'warning'); return; }
    if (scope === 'screen' && !targetId) { toast?.('Pick a screen', 'warning'); return; }
    if (scope === 'scene' && !targetId) { toast?.('Pick a scene', 'warning'); return; }
    if ((scope === 'studio' || scope === 'screen') && !layoutId) { toast?.('Pick a layout', 'warning'); return; }

    const iso = new Date(when).toISOString();
    setBusy(true);
    try {
      const body = {
        studio_id: studioId,
        scope,
        scheduled_at: iso,
        note: note.trim() || undefined,
      };
      if (scope === 'screen') { body.target_id = targetId; body.layout_id = layoutId; }
      else if (scope === 'studio') { body.layout_id = layoutId; }
      else if (scope === 'scene') { body.target_id = targetId; }
      await api.post('/scheduled-layouts', body);
      toast?.('Schedule added', 'success');
      setModalOpen(false);
      setNote(''); setWhen(''); setTargetId(''); setLayoutId('');
      load();
    } catch (err) {
      toast?.(`Schedule failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this scheduled push?')) return;
    try {
      await api.delete(`/scheduled-layouts/${id}`);
      toast?.('Cancelled', 'success');
      load();
    } catch (err) {
      toast?.(`Cancel failed: ${err.message}`, 'error');
    }
  }

  function describe(item) {
    const layoutName = layouts.find(l => l.id === item.layout_id)?.name || item.layout_id?.slice(0, 8);
    const screenName = screens.find(s => s.id === item.target_id)?.name || item.target_id?.slice(0, 8);
    const sceneName = scenes.find(s => s.id === item.target_id)?.name || item.target_id?.slice(0, 8);
    if (item.scope === 'studio') return `All → ${layoutName}`;
    if (item.scope === 'screen') return `${screenName} → ${layoutName}`;
    if (item.scope === 'scene')  return `Scene: ${sceneName}`;
    return item.scope;
  }

  function timeLabel(iso) {
    const d = new Date(iso);
    const now = Date.now();
    const diffMin = Math.round((d.getTime() - now) / 60000);
    if (Math.abs(diffMin) < 60) return diffMin >= 0 ? `in ${diffMin}m` : `${-diffMin}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const statusPill = {
    pending:   'bg-sky-900/30 border-sky-700/40 text-sky-300',
    fired:     'bg-emerald-900/25 border-emerald-700/30 text-emerald-400/80',
    failed:    'bg-red-900/30 border-red-700/40 text-red-300',
    cancelled: 'bg-gray-800/40 border-gray-700/40 text-gray-500 line-through',
  };

  // Pre-fill datetime-local with "now + 5 min" when opening the modal.
  function openModal() {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    setWhen(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setScope('studio');
    setLayoutId(layouts[0]?.id || '');
    setTargetId('');
    setNote('');
    setModalOpen(true);
  }

  return (
    <div className="px-4 pt-1 pb-1 border-b border-gray-800/40">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold shrink-0 mr-1">Schedule</span>
        {items.length === 0 && (
          <span className="text-[10px] text-gray-700 italic shrink-0">Nothing scheduled — queue a push for later.</span>
        )}
        {items.map(item => {
          const pill = statusPill[item.status] || statusPill.pending;
          return (
            <div key={item.id}
              className={`group relative shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-md border ${pill} transition-all`}
              title={`${item.scope} @ ${new Date(item.scheduled_at).toLocaleString()}${item.note ? '\n' + item.note : ''}${item.result?.error ? '\nERR: ' + item.result.error : ''}`}>
              <span className="text-[10px] font-mono opacity-70">{timeLabel(item.scheduled_at)}</span>
              <span className="text-[11px] font-medium max-w-[14rem] truncate">{describe(item)}</span>
              {item.status === 'pending' && (
                <button onClick={() => handleCancel(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity" title="Cancel">×</button>
              )}
            </div>
          );
        })}
        <div className="flex-1" />
        <button onClick={openModal} disabled={!studioId}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md bg-sky-900/25 border border-sky-700/40 hover:bg-sky-800/40 hover:border-sky-500/60 text-sky-300 text-[11px] font-semibold transition-all disabled:opacity-40">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Schedule
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-3">
            <h3 className="text-white font-semibold text-lg">Schedule a push</h3>
            <p className="text-xs text-gray-400 -mt-2">Fire a layout, scene, or studio-wide push at a specific time. Padlock + public-only rails apply.</p>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Scope</label>
              <div className="flex gap-1.5">
                {[
                  { v: 'studio', l: 'Whole studio' },
                  { v: 'screen', l: 'One screen' },
                  { v: 'scene',  l: 'Scene' },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setScope(opt.v)}
                    className={`flex-1 px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${scope === opt.v ? 'bg-sky-600/30 border-sky-400/60 text-sky-100' : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:bg-gray-800'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {scope === 'screen' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Screen</label>
                <select value={targetId} onChange={e => setTargetId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="">Choose screen…</option>
                  {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {scope === 'scene' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Scene</label>
                <select value={targetId} onChange={e => setTargetId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="">Choose scene…</option>
                  {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {scope !== 'scene' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Layout</label>
                <select value={layoutId} onChange={e => setLayoutId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="">Choose layout…</option>
                  {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Fire at</label>
              <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} maxLength={120}
                placeholder="e.g. Awards ceremony start"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
              <button type="submit" disabled={busy}
                className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40 transition-colors font-medium">
                {busy ? 'Scheduling…' : 'Schedule push'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
