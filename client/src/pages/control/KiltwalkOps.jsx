import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { connectSocket } from '../../lib/socket';
import { useToast } from '../../components/Toast';

// Kiltwalk Ops: live event control surface for finisher counter + line camera.
// Designed for one operator on the LED ops laptop — big buttons, no fiddly forms.

const COUNTER_VAR_ID = 'kiltwalk:finishers';

function getUser() {
  try { return JSON.parse(localStorage.getItem('broadcast_user') || '{}'); }
  catch { return {}; }
}

function fmtCount(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-GB');
}

function fmtRelative(ts) {
  if (!ts) return 'never';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export default function KiltwalkOps() {
  const toast = useToast();
  const user = getUser();
  const studioId = user.studio_id;

  const [counter, setCounter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setValueInput, setSetValueInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastBumpAt, setLastBumpAt] = useState(0);
  const [lineState, setLineState] = useState({ enabled: false, camera: '', line: '', count_today: 0, last_event_at: null });
  const [auditLog, setAuditLog] = useState([]);

  const counterValue = counter && typeof counter.value === 'number' ? counter.value : 0;

  const reload = async () => {
    if (!studioId) return;
    try {
      const v = await api.get(`/studios/${studioId}/variables/${COUNTER_VAR_ID}`);
      setCounter(v);
    } catch (err) {
      if (err.status === 404) {
        setCounter(null);
      } else {
        toast?.(`Counter load failed: ${err.message}`, 'error');
      }
    }
    try {
      const l = await api.get(`/kiltwalk/line-counter/state`);
      if (l) setLineState(l);
    } catch { /* line counter may not be wired yet */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!studioId) { setLoading(false); return; }
    setLoading(true);
    reload();

    const socket = connectSocket();
    socket.emit('join_studio', { studioId });
    const onUpdate = (data) => {
      if (!data || data.id !== COUNTER_VAR_ID) return;
      setCounter((prev) => ({ ...(prev || { id: COUNTER_VAR_ID, kind: 'number' }), value: data.value }));
    };
    const onLine = (data) => {
      if (!data) return;
      setLineState((prev) => ({ ...prev, ...data }));
      if (data.last_event) {
        setAuditLog((prev) => [{ ts: Date.now(), source: 'line', delta: data.last_event.delta || 1 }, ...prev].slice(0, 12));
      }
    };
    socket.on('variable_update', onUpdate);
    socket.on('kiltwalk_line_event', onLine);
    return () => {
      socket.off('variable_update', onUpdate);
      socket.off('kiltwalk_line_event', onLine);
    };
  }, [studioId]);

  async function bump(delta) {
    if (!studioId || busy) return;
    setBusy(true);
    try {
      const v = await api.post(`/studios/${studioId}/variables/${COUNTER_VAR_ID}/bump`, { delta });
      setCounter(v);
      setLastBumpAt(Date.now());
      setAuditLog((prev) => [{ ts: Date.now(), source: 'manual', delta }, ...prev].slice(0, 12));
    } catch (err) {
      toast?.(`Bump failed: ${err.message}`, 'error');
    }
    setBusy(false);
  }

  async function setValue() {
    const n = parseInt(setValueInput, 10);
    if (Number.isNaN(n) || n < 0) {
      toast?.('Enter a non-negative integer', 'error');
      return;
    }
    if (!studioId || busy) return;
    setBusy(true);
    try {
      const v = await api.patch(`/studios/${studioId}/variables/${COUNTER_VAR_ID}`, { value: n });
      setCounter(v);
      setSetValueInput('');
      setAuditLog((prev) => [{ ts: Date.now(), source: 'set', delta: n - counterValue }, ...prev].slice(0, 12));
    } catch (err) {
      toast?.(`Set failed: ${err.message}`, 'error');
    }
    setBusy(false);
  }

  async function reset() {
    if (!studioId || busy) return;
    if (!window.confirm(`Reset finisher counter to 0? Currently ${fmtCount(counterValue)}.`)) return;
    setBusy(true);
    try {
      const v = await api.post(`/studios/${studioId}/variables/${COUNTER_VAR_ID}/reset`);
      setCounter(v);
      setAuditLog((prev) => [{ ts: Date.now(), source: 'reset', delta: -counterValue }, ...prev].slice(0, 12));
    } catch (err) {
      toast?.(`Reset failed: ${err.message}`, 'error');
    }
    setBusy(false);
  }

  async function toggleLineCounter() {
    setBusy(true);
    try {
      const next = await api.post(`/kiltwalk/line-counter/toggle`, { enabled: !lineState.enabled });
      setLineState((prev) => ({ ...prev, ...next }));
    } catch (err) {
      toast?.(`Line counter toggle failed: ${err.message}`, 'error');
    }
    setBusy(false);
  }

  if (!studioId) {
    return (
      <div className="p-6 text-gray-400">No studio context. Sign in with a studio user.</div>
    );
  }

  if (loading) {
    return <div className="p-6 text-gray-400 animate-pulse">Loading Kiltwalk Ops…</div>;
  }

  const bumpButtons = [
    { delta: 1,  bg: 'bg-emerald-600 hover:bg-emerald-500',  label: '+1' },
    { delta: 5,  bg: 'bg-emerald-700 hover:bg-emerald-600',  label: '+5' },
    { delta: 10, bg: 'bg-emerald-800 hover:bg-emerald-700',  label: '+10' },
    { delta: 25, bg: 'bg-emerald-900 hover:bg-emerald-800',  label: '+25' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto text-gray-200">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Kiltwalk Ops</h1>
          <p className="text-sm text-gray-400 mt-1">
            Live finisher counter + walk-line camera count
          </p>
        </div>
        <div className="text-xs text-gray-500">
          variable <code className="text-gray-300">{COUNTER_VAR_ID}</code>
        </div>
      </header>

      <section className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 p-8 mb-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Walkers across the line</div>
          <div className="text-[140px] font-black tabular-nums leading-none text-white">
            {fmtCount(counterValue)}
          </div>
          <div className={`mt-3 text-xs ${lastBumpAt && Date.now() - lastBumpAt < 1500 ? 'text-emerald-400' : 'text-gray-500'}`}>
            {lastBumpAt ? `last update ${fmtRelative(lastBumpAt)}` : 'no manual updates this session'}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-3">
          {bumpButtons.map((b) => (
            <button
              key={b.delta}
              onClick={() => bump(b.delta)}
              disabled={busy}
              className={`${b.bg} text-white py-6 rounded-xl font-bold text-2xl tabular-nums transition-colors disabled:opacity-40`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => bump(-1)}
            disabled={busy || counterValue <= 0}
            className="bg-amber-700 hover:bg-amber-600 text-white py-4 rounded-xl font-semibold text-lg transition-colors disabled:opacity-40"
          >
            −1 (correction)
          </button>
          <button
            onClick={reset}
            disabled={busy}
            className="bg-rose-800 hover:bg-rose-700 text-white py-4 rounded-xl font-semibold text-lg transition-colors disabled:opacity-40"
          >
            Reset to 0
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            min="0"
            placeholder="Set exact value…"
            value={setValueInput}
            onChange={(e) => setSetValueInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setValue(); }}
            className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-lg tabular-nums text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={setValue}
            disabled={busy || setValueInput === ''}
            className="bg-blue-700 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </section>

      <section className="bg-gray-900 rounded-2xl border border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${lineState.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              UniFi Line Counter
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Auto-increments the counter when someone crosses the configured tripwire on
              {' '}<code className="text-gray-300">{lineState.camera || '— pick a camera —'}</code>.
            </p>
          </div>
          <button
            onClick={toggleLineCounter}
            disabled={busy || !lineState.camera}
            className={`px-5 py-3 rounded-xl font-semibold transition-colors ${
              lineState.enabled
                ? 'bg-rose-700 hover:bg-rose-600 text-white'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            } disabled:opacity-40`}
          >
            {lineState.enabled ? 'Disable line counter' : 'Enable line counter'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Crossings today</div>
            <div className="text-2xl font-bold text-white tabular-nums">{fmtCount(lineState.count_today || 0)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Last crossing</div>
            <div className="text-2xl font-bold text-white">{lineState.last_event_at ? fmtRelative(lineState.last_event_at) : '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Camera</div>
            <div className="text-base text-white truncate">{lineState.camera_label || lineState.camera || '—'}</div>
          </div>
        </div>
        {!lineState.camera && (
          <p className="mt-4 text-xs text-amber-400">
            No camera configured. Set <code>KILTWALK_LINE_CAMERA_ID</code> on the broadcast-studio server, then reload.
          </p>
        )}
      </section>

      <section className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Recent activity</h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-500">No counter activity in this session yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {auditLog.map((row, idx) => (
              <li key={idx} className="py-2 flex items-center justify-between text-sm">
                <span className="text-gray-400">{fmtRelative(row.ts)}</span>
                <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider ${
                  row.source === 'line' ? 'bg-emerald-900/50 text-emerald-300' :
                  row.source === 'manual' ? 'bg-blue-900/50 text-blue-300' :
                  row.source === 'set' ? 'bg-purple-900/50 text-purple-300' :
                  'bg-rose-900/50 text-rose-300'
                }`}>
                  {row.source}
                </span>
                <span className="font-mono tabular-nums text-white">
                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
