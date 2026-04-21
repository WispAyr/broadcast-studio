import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';
import { useToast } from '../../../components/Toast';

// IncidentBar: thin one-line control rail that sits next to the SceneRail.
// Operators type a short message, pick severity, optional auto-clear, hit
// Push. The banner appears on every screen in the studio (top of screen,
// severity-coloured). Critical = pulse animation + red. "Clear" removes any
// active incident overlay across the studio.
//
// Recent history is surfaced via a hover-panel so ops can see what was
// pushed and when — useful during a long event where multiple people
// might send banners.
export default function IncidentBar({ studioId }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [duration, setDuration] = useState('');    // blank = no auto-clear
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!studioId) return;
    try {
      const data = await api.get(`/broadcast/incident/recent?studio_id=${studioId}&limit=20`);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[IncidentBar] history load failed:', err);
    }
  }, [studioId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handlePush(e) {
    e?.preventDefault?.();
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      const body = {
        studio_id: studioId,
        severity,
        message: message.trim(),
      };
      const d = parseInt(duration, 10);
      if (d > 0) body.duration_ms = d * 1000;
      await api.post('/broadcast/incident', body);
      toast?.(`Banner pushed (${severity})`, severity === 'critical' || severity === 'danger' ? 'warning' : 'success');
      setMessage('');
      loadHistory();
    } catch (err) {
      toast?.(`Banner push failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (busy) return;
    setBusy(true);
    try {
      await api.delete(`/broadcast/incident?studio_id=${studioId}`);
      toast?.('Banner cleared', 'success');
      loadHistory();
    } catch (err) {
      toast?.(`Clear failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Severity theme for the picker chips.
  const sevTheme = {
    info:     { on: 'bg-blue-500/30 border-blue-400/60 text-blue-100',       off: 'bg-blue-900/20 border-blue-800/30 text-blue-400/80 hover:bg-blue-900/40' },
    warning:  { on: 'bg-amber-500/30 border-amber-400/60 text-amber-100',    off: 'bg-amber-900/20 border-amber-800/30 text-amber-400/80 hover:bg-amber-900/40' },
    danger:   { on: 'bg-red-500/30 border-red-400/60 text-red-100',          off: 'bg-red-900/20 border-red-800/30 text-red-400/80 hover:bg-red-900/40' },
    critical: { on: 'bg-red-600/40 border-red-300/70 text-red-50 shadow-[0_0_12px_rgba(239,68,68,0.4)]', off: 'bg-red-950/30 border-red-900/50 text-red-500/70 hover:bg-red-900/40' },
  };

  return (
    <div className="relative px-4 pt-1 pb-1 border-b border-gray-800/40">
      <form onSubmit={handlePush} className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold shrink-0 mr-1">Banner</span>

        {/* Severity picker */}
        <div className="flex items-center gap-1 shrink-0">
          {['info', 'warning', 'danger', 'critical'].map(s => {
            const active = severity === s;
            const theme = sevTheme[s];
            return (
              <button key={s} type="button" onClick={() => setSeverity(s)}
                className={`px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wide transition-all ${active ? theme.on : theme.off}`}
                title={s === 'critical' ? 'Pulsing red — use for emergencies' : s}>
                {s === 'critical' ? 'Critical' : s[0].toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="e.g. Race delayed 15min — shelter in place"
          maxLength={200}
          className="flex-1 min-w-0 bg-gray-900/60 border border-gray-800/60 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />

        {/* Auto-clear (seconds). Blank = sticky until cleared. */}
        <input
          value={duration}
          onChange={e => setDuration(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="sec"
          title="Auto-clear after N seconds. Leave blank for sticky."
          className="w-14 bg-gray-900/60 border border-gray-800/60 rounded-lg px-2 py-1.5 text-[11px] text-white text-center placeholder-gray-700 focus:outline-none focus:border-gray-600"
        />

        <button type="submit" disabled={busy || !message.trim()}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-600/80 hover:bg-orange-500 border border-orange-400/50 text-white text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          Push
        </button>

        <button type="button" onClick={handleClear} disabled={busy}
          title="Clear any active incident banner"
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700 border border-gray-700/60 text-gray-300 text-[11px] font-semibold transition-all disabled:opacity-40">
          Clear
        </button>

        <button type="button" onClick={() => setHistoryOpen(v => !v)}
          title="Recent banners"
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-gray-900/50 hover:bg-gray-800 border border-gray-800/60 text-gray-500 text-[11px] transition-all">
          {history.length > 0 ? `${history.length}` : '—'}
        </button>
      </form>

      {historyOpen && (
        <div className="absolute right-4 bottom-full mb-2 z-40 w-80 max-h-80 overflow-y-auto bg-gray-950 border border-gray-800 rounded-xl shadow-2xl">
          <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Recent banners</span>
            <button onClick={() => setHistoryOpen(false)} className="text-gray-600 hover:text-gray-400 text-xs">×</button>
          </div>
          {history.length === 0 ? (
            <div className="p-4 text-center text-gray-600 text-xs italic">No banners yet.</div>
          ) : (
            <ul className="divide-y divide-gray-900">
              {history.map(h => {
                const sev = h.severity || 'info';
                const color = sev === 'critical' || sev === 'danger' ? 'text-red-400'
                            : sev === 'warning' ? 'text-amber-400'
                            : sev === 'info' ? 'text-blue-400'
                            : 'text-gray-500';
                const when = new Date(h.created_at + 'Z').toLocaleString();
                return (
                  <li key={h.id} className="px-3 py-2 hover:bg-gray-900/40">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] uppercase tracking-wider font-bold ${color}`}>{h.kind === 'clear' ? 'clear' : sev}</span>
                      {h.source && <span className="text-[9px] font-mono text-gray-600">{h.source}</span>}
                      <span className="text-[9px] text-gray-600 ml-auto">{when}</span>
                    </div>
                    {h.message && <div className="text-[11px] text-gray-300">{h.message}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
