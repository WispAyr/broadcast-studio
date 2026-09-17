import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api';

// The Virtual Producer studio page. Shows the live, data-grounded editorial rundown
// (ranked by the server-side producer from real feed signals) and lets an operator
// supervise it: TAKE a story to air, PIN it (long hold), or RELEASE back to auto.
// Autonomy: MANUAL (operator cuts) · ASSIST (producer flags the recommended cut) ·
// AUTOPILOT (producer auto-cuts BREAKING stories only — never routine rotation).

const TONE = {
  crit: { bar: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-500/40', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  hot: { bar: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/40', chip: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  mil: { bar: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/40', chip: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
  warn: { bar: 'bg-sky-400', text: 'text-sky-300', ring: 'ring-sky-400/40', chip: 'bg-sky-400/15 text-sky-300 border-sky-400/30' },
  '': { bar: 'bg-gray-600', text: 'text-gray-400', ring: 'ring-gray-600/40', chip: 'bg-gray-700/40 text-gray-400 border-gray-600/40' },
};

const AUTONOMY = [
  { id: 'MANUAL', label: 'Manual', hint: 'You cut. Producer only ranks.' },
  { id: 'ASSIST', label: 'Assisted', hint: 'Producer flags the recommended cut.' },
  { id: 'AUTO', label: 'Autopilot', hint: 'Producer auto-cuts breaking stories.' },
];

function ago(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  return Math.round(s / 60) + 'm ago';
}

export default function Rundown() {
  const [rd, setRd] = useState({ ok: false, items: [] });
  const [autonomy, setAutonomy] = useState(() => localStorage.getItem('rundown_autonomy') || 'MANUAL');
  const [busy, setBusy] = useState('');
  const [log, setLog] = useState([]);
  const [now, setNow] = useState(Date.now());
  const lastAuto = useRef('');

  const pushLog = useCallback((text, tone) => {
    setLog((l) => [{ text, tone, t: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...l].slice(0, 30));
  }, []);

  const load = useCallback(() => {
    api.get('/channel/rundown').then((r) => setRd(r || { ok: false, items: [] })).catch(() => {});
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { localStorage.setItem('rundown_autonomy', autonomy); }, [autonomy]);

  const take = useCallback((scene, minutes, verb) => {
    setBusy(scene);
    api.post('/channel/scene/take', { scene, minutes: minutes || 3 }).then(
      () => { pushLog(`${verb || 'TAKE'} → ${scene} (${minutes || 3}m)`, 'ok'); load(); },
      (e) => pushLog(`${scene}: ${e.message}`, 'err')
    ).finally(() => setBusy(''));
  }, [pushLog, load]);

  const release = useCallback(() => {
    setBusy('_release');
    api.post('/channel/scene/clear', {}).then(
      () => { pushLog('RELEASE → back to auto rotation', 'ok'); load(); },
      (e) => pushLog(`release: ${e.message}`, 'err')
    ).finally(() => setBusy(''));
  }, [pushLog, load]);

  // AUTOPILOT: cut to a BREAKING story that isn't already on air. Breaking only —
  // routine rotation is left to the director. One action per scene change (deduped).
  useEffect(() => {
    if (autonomy !== 'AUTO' || !rd.ok) return;
    const brk = rd.items.find((i) => i.breaking && !i.onair);
    if (brk && lastAuto.current !== brk.scene) {
      lastAuto.current = brk.scene;
      pushLog(`AUTOPILOT cut → ${brk.scene}: ${brk.headline}`, 'auto');
      api.post('/channel/scene/take', { scene: brk.scene, minutes: 4 }).then(load).catch(() => {});
    }
    if (!brk) lastAuto.current = '';
  }, [rd, autonomy, pushLog, load]);

  const items = rd.items || [];
  const recommended = autonomy === 'MANUAL' ? null : (items.find((i) => i.breaking && !i.onair) || items.find((i) => !i.onair && i.score >= 50));
  const held = rd.onair && items.find((i) => i.onair);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Rundown
            <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Virtual Producer</span>
          </h1>
          <div className="text-sm text-gray-400 mt-1">
            {rd.ok ? (
              <>Show <span className="text-gray-200 font-semibold">{rd.show || '—'}</span> · on air <span className="text-red-300 font-semibold">{rd.onair || '—'}</span> · producer updated {ago(rd.updated)}</>
            ) : 'Waiting for the engine…'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {AUTONOMY.map((a) => (
            <button key={a.id} onClick={() => setAutonomy(a.id)} title={a.hint}
              className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${autonomy === a.id
                ? (a.id === 'AUTO' ? 'bg-rose-500/20 border-rose-500/50 text-rose-200' : 'bg-sky-500/20 border-sky-500/50 text-sky-200')
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* breaking / autopilot banner */}
      {rd.breaking && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 flex items-center gap-3">
          <span className="text-rose-300 font-bold tracking-wide animate-pulse">● BREAKING</span>
          <span className="text-rose-100 text-sm">{(items.find((i) => i.breaking) || {}).headline}</span>
        </div>
      )}
      {autonomy === 'AUTO' && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-sm text-rose-200/90 flex items-center gap-2">
          <span className="font-mono text-xs tracking-widest">AUTOPILOT</span>
          Producer will cut to breaking stories automatically. Routine rotation stays with the director.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* the running order */}
        <div className="space-y-2">
          {items.length === 0 && <div className="text-gray-500 text-sm py-10 text-center">No rundown yet.</div>}
          {items.map((it) => {
            const tn = TONE[it.tone] || TONE[''];
            const isRec = recommended && recommended.scene === it.scene;
            return (
              <div key={it.scene}
                className={`rounded-xl border bg-gray-900/70 px-4 py-3 flex items-center gap-4 transition ${it.onair ? 'border-red-500/60 ring-1 ring-red-500/30'
                  : isRec ? 'border-amber-400/50 ring-1 ring-amber-400/20' : 'border-gray-800'}`}>
                <div className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center font-bold text-sm ${it.onair ? 'bg-red-500/20 text-red-200' : 'bg-gray-800 text-gray-400'}`}>
                  {it.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-100">{it.scene}</span>
                    {it.onair && <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500 text-gray-950">ON AIR</span>}
                    {it.breaking && <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-500 text-gray-950 animate-pulse">BREAKING</span>}
                    {isRec && !it.onair && <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-gray-950">RECOMMENDED</span>}
                  </div>
                  <div className="text-sm text-gray-300 mt-0.5 truncate">{it.headline}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1.5 w-24 rounded-full bg-gray-800 overflow-hidden">
                      <div className={`h-full ${tn.bar}`} style={{ width: Math.min(100, it.score) + '%' }} />
                    </div>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${tn.chip}`}>{it.why}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {it.onair ? (
                    <button onClick={release} disabled={busy === '_release'}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50">Release</button>
                  ) : (
                    <>
                      <button onClick={() => take(it.scene, 3, 'TAKE')} disabled={busy === it.scene}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-gray-950 disabled:opacity-50">TAKE</button>
                      <button onClick={() => take(it.scene, 12, 'PIN')} disabled={busy === it.scene} title="Hold on air for 12 minutes"
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50">Pin</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* producer activity */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">Producer log</div>
            {log.length === 0 && <div className="text-gray-600 text-sm">No actions yet.</div>}
            <div className="space-y-1.5">
              {log.map((l, i) => (
                <div key={i} className="text-xs flex gap-2">
                  <span className="text-gray-600 font-mono shrink-0">{l.t}</span>
                  <span className={l.tone === 'err' ? 'text-rose-400' : l.tone === 'auto' ? 'text-rose-300' : l.tone === 'ok' ? 'text-emerald-300' : 'text-gray-400'}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 text-xs text-gray-500 leading-relaxed">
            The producer ranks the active show's scenes every ~45s from live feeds
            (aircraft on approach, lightning, military traffic, SAR, aurora, weather warnings).
            Every headline number is a real feed value — nothing is invented. In
            <span className="text-gray-300"> Autopilot</span> it cuts to breaking stories only;
            routine rotation stays with the director.
          </div>
        </div>
      </div>
    </div>
  );
}
