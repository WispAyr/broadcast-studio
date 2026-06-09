import React, { useState, useEffect, useCallback } from 'react';
import api, { getMe } from '../../lib/api';
import { useToast } from '../../components/Toast';

// Schedule / Run of Show — build a timed rundown of scene pushes for the screens.
// Uses the scheduled_layouts backend (a 15s worker fires due cues). Each cue =
// "at time T, push layout L to the whole studio (or one screen)".

const fmtClock = (iso) => { try { return new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const STATUS = { pending: { c: '#a44ad0', t: 'Scheduled' }, fired: { c: '#2e9e5b', t: 'Done' }, failed: { c: '#d2384f', t: 'Failed' }, cancelled: { c: '#777', t: 'Cancelled' } };

export default function Schedule() {
  const toast = useToast();
  const [studios, setStudios] = useState([]);
  const [studioId, setStudioId] = useState('');
  const [isSuper, setIsSuper] = useState(false);
  const [layouts, setLayouts] = useState([]);
  const [screens, setScreens] = useState([]);
  const [cues, setCues] = useState([]);
  const [now, setNow] = useState(new Date());

  // New-cue form
  const [layoutId, setLayoutId] = useState('');
  const [scope, setScope] = useState('studio');
  const [screenId, setScreenId] = useState('');
  const [when, setWhen] = useState('');

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    getMe().then((d) => {
      const u = d.user || d;
      setIsSuper(u.role === 'super_admin');
      if (u.role === 'super_admin') {
        api.get('/studios').then((s) => { const arr = s.studios || s || []; setStudios(arr); setStudioId((cur) => cur || arr[0]?.id || ''); });
      } else { setStudioId(u.studio_id); }
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!studioId) return;
    api.get(`/layouts?studio_id=${studioId}`).then((l) => setLayouts((Array.isArray(l) ? l : []).slice().sort((a, b) => (a.project || 'zz').localeCompare(b.project || 'zz') || a.name.localeCompare(b.name)))).catch(() => {});
    api.get(`/screens?studio_id=${studioId}`).then((s) => setScreens(Array.isArray(s) ? s : (s.screens || []))).catch(() => {});
    api.get(`/scheduled-layouts?studio_id=${studioId}`).then((c) => setCues(Array.isArray(c) ? c : [])).catch(() => {});
  }, [studioId]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const addOffset = (mins) => { const d = new Date(Date.now() + mins * 60000); d.setSeconds(0, 0); setWhen(toLocalInput(d)); };

  async function addCue() {
    if (!layoutId || !when) { toast?.('Pick a scene and a time', 'error'); return; }
    if (scope === 'screen' && !screenId) { toast?.('Pick a screen', 'error'); return; }
    try {
      await api.post('/scheduled-layouts', {
        studio_id: studioId, scope, layout_id: layoutId,
        target_id: scope === 'screen' ? screenId : null,
        scheduled_at: new Date(when).toISOString(),
        note: layouts.find((l) => l.id === layoutId)?.name,
      });
      toast?.('Cue scheduled', 'success'); setWhen(''); load();
    } catch (e) { toast?.(`Failed: ${e.message}`, 'error'); }
  }
  async function cancel(id) { try { await api.delete(`/scheduled-layouts/${id}`); load(); } catch (e) { toast?.(e.message, 'error'); } }

  const pending = cues.filter((c) => c.status === 'pending');
  const nextCue = pending[0];
  const countdown = nextCue ? Math.max(0, Math.round((new Date(nextCue.scheduled_at) - now) / 1000)) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto text-gray-200">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">Schedule · Run of Show</h1>
        <a href="#/control" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} className="hidden" />
      </div>
      <p className="text-gray-500 text-sm mb-5">Queue scene changes by time — the server pushes them to the screens automatically. Override any time from the live console.</p>

      {isSuper && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-amber-400">Studio</span>
          <select value={studioId} onChange={(e) => setStudioId(e.target.value)} className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm">
            {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* next-up banner */}
      {nextCue && (
        <div className="mb-5 rounded-xl border border-purple-700/50 bg-purple-900/20 px-4 py-3 flex items-center gap-4">
          <div className="text-purple-300 text-xs uppercase tracking-widest">Next up</div>
          <div className="text-white font-semibold flex-1">{nextCue.note || layoutName(layouts, nextCue.layout_id)}</div>
          <div className="text-gray-400 text-sm">{fmtClock(nextCue.scheduled_at)}</div>
          <div className="font-mono text-lg text-amber-300">{countdown != null ? `T-${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : ''}</div>
        </div>
      )}

      {/* add cue */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-gray-400 text-xs">Scene</span>
            <select value={layoutId} onChange={(e) => setLayoutId(e.target.value)} className="mt-1 w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded text-white">
              <option value="">— pick a scene —</option>
              {layouts.map((l) => <option key={l.id} value={l.id}>{l.project ? `[${l.project}] ` : ''}{l.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-gray-400 text-xs">Target</span>
            <div className="mt-1 flex gap-2">
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded text-white">
                <option value="studio">All screens</option>
                <option value="screen">One screen</option>
              </select>
              {scope === 'screen' && (
                <select value={screenId} onChange={(e) => setScreenId(e.target.value)} className="flex-1 px-2 py-2 bg-gray-800 border border-gray-700 rounded text-white">
                  <option value="">— screen —</option>
                  {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
          {[['+5m', 5], ['+15m', 15], ['+30m', 30], ['+1h', 60], ['+2h', 120]].map(([l, m]) => (
            <button key={l} onClick={() => addOffset(m)} className="px-2.5 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300">{l}</button>
          ))}
          <button onClick={addCue} className="ml-auto px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm">+ Schedule cue</button>
        </div>
      </div>

      {/* rundown */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Rundown</h2>
      <div className="space-y-1">
        {cues.length === 0 && <p className="text-gray-600 text-sm py-6 text-center">No cues scheduled. Add scenes above to build your run of show.</p>}
        {cues.map((c) => {
          const st = STATUS[c.status] || STATUS.pending;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-lg bg-gray-900/50 border border-gray-800 px-3 py-2.5">
              <div className="font-mono text-sm text-gray-300 w-32 shrink-0">{fmtClock(c.scheduled_at)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{c.note || layoutName(layouts, c.layout_id)}</div>
                <div className="text-[11px] text-gray-500">{c.scope === 'studio' ? 'All screens' : c.scope === 'screen' ? (screens.find((s) => s.id === c.target_id)?.name || 'screen') : 'scene'}{c.result?.error ? ` · ${c.result.error}` : ''}</div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}22` }}>{st.t}</span>
              {c.status === 'pending' && <button onClick={() => cancel(c.id)} className="text-gray-500 hover:text-red-400 text-xs">Cancel</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function layoutName(layouts, id) { return layouts.find((l) => l.id === id)?.name || '(layout)'; }
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
