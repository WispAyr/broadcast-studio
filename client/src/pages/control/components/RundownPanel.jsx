import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';
import { useToast } from '../../../components/Toast';

// Rundown — the scheduled run-of-show inside the live console. Shows upcoming
// cues with a "Fire now" (push immediately + drop the cue so it doesn't re-fire)
// and "Skip" (cancel). Pairs with the Schedule page (same scheduled_layouts API).

export default function RundownPanel({ studioId, layouts = [], screens = [], onPushLayout, inShell }) {
  const toast = useToast();
  const [cues, setCues] = useState([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    if (!studioId) return;
    api.get(`/scheduled-layouts?studio_id=${studioId}`)
      .then((c) => setCues((Array.isArray(c) ? c : []).filter((x) => x.status === 'pending')))
      .catch(() => {});
  }, [studioId]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const name = (c) => c.note || layouts.find((l) => l.id === c.layout_id)?.name || '(scene)';
  const tgt = (c) => (c.scope === 'studio' ? 'All' : c.scope === 'screen' ? (screens.find((s) => s.id === c.target_id)?.name || 'screen') : 'scene');

  const fireNow = async (c) => {
    try {
      if (c.scope === 'screen' && c.target_id) await api.post(`/screens/${c.target_id}/layout`, { layout_id: c.layout_id });
      else if (onPushLayout) onPushLayout(c.layout_id);
      else await api.post('/screens/sync', { layout_id: c.layout_id, studio_id: studioId });
      await api.delete(`/scheduled-layouts/${c.id}`); // drop so the worker won't re-fire at its time
      toast?.(`Fired: ${name(c)}`, 'success'); load();
    } catch (e) { toast?.(`Fire failed: ${e.message}`, 'error'); }
  };
  const skip = async (c) => { try { await api.delete(`/scheduled-layouts/${c.id}`); load(); } catch (e) { toast?.(e.message, 'error'); } };

  const body = (
    <div className="p-2 space-y-1.5">
      {cues.length === 0 && <p className="text-gray-600 text-xs text-center py-3">No scheduled cues. Build a run of show on the Schedule page.</p>}
      {cues.map((c, i) => {
        const secs = Math.max(0, Math.round((new Date(c.scheduled_at) - now) / 1000));
        const t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        return (
          <div key={c.id} className={`rounded-md px-2 py-1.5 ${i === 0 ? 'bg-purple-900/30 ring-1 ring-purple-600/40' : 'bg-gray-800/40'}`}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-amber-300 w-12 shrink-0">T-{t}</span>
              <span className="flex-1 min-w-0 text-[12px] text-white font-medium truncate">{name(c)}</span>
              <span className="text-[9px] text-gray-500">{tgt(c)}</span>
            </div>
            <div className="flex gap-1 mt-1">
              <button onClick={() => fireNow(c)} className="flex-1 px-2 py-1 rounded text-[10px] font-bold bg-green-600/30 text-green-300 hover:bg-green-600/50">▶ Fire now</button>
              <button onClick={() => skip(c)} className="px-2 py-1 rounded text-[10px] bg-gray-700/60 text-gray-300 hover:bg-red-600/40">Skip</button>
            </div>
          </div>
        );
      })}
    </div>
  );
  return inShell ? body : body;
}
