/**
 * TallyPanel — ON AIR / MIC LIVE tally from the studio-tap relay (server: routes/tally.js).
 * Lives on the Cutaway page because it is the same kind of thing: something outside
 * the operator's hands changing what a screen shows, with an arm switch in front.
 *
 * Same rules as the cutaway arm toggle: arming asks first, disarming never does.
 * State polls IN PLACE every 2 s so the panel cannot silently go stale while the
 * studio goes live.
 */
import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';

const MODE_LABEL = { off: 'Off', banner: 'Banner', takeover: 'Full screen' };
const SHOW_LABEL = { both: 'ON AIR + MIC LIVE', on_air: 'ON AIR only', mic: 'MIC LIVE only' };

const EVENT_TEXT = {
  studio_live: 'Studio went LIVE', studio_off: 'Studio off air', studio_unknown: 'Studio state unknown',
  mic_live: 'Mic LIVE', mic_off: 'Mic off', mic_unknown: 'Mic state unknown',
  lost: 'TALLY LOST', recovered: 'Tally recovered', relay_boot: 'Relay (re)started',
  armed: 'Armed', disarmed: 'Disarmed', created: 'Studio added', deleted: 'Studio removed',
  key_created: 'Key created', key_revoked: 'Key revoked', screen_config: 'Screen changed',
  rejected_bad_key: 'REJECTED — bad key', rejected_replay: 'REJECTED — replay', rejected_invalid: 'REJECTED — invalid body',
  rejected_wrong_studio: 'REJECTED — key for another studio', rejected_stale_boot: 'REJECTED — stale clock on new boot',
  rejected_rate_limit: 'Rate limited',
};

const age = (ms) => {
  if (ms == null) return 'never';
  const s = Math.max(0, ms / 1000);
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

function Pill({ tone, children }) {
  const c = {
    red: 'bg-red-600 text-white border-red-500',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    grey: 'bg-gray-800 text-gray-400 border-gray-700',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  }[tone];
  return <span className={`px-2 py-0.5 rounded border text-[11px] font-bold tracking-wide ${c}`}>{children}</span>;
}

function triPill(v, onLabel, offLabel) {
  if (v === true) return <Pill tone="red">{onLabel}</Pill>;
  if (v === false) return <Pill tone="grey">{offLabel}</Pill>;
  return <Pill tone="amber">unknown</Pill>;
}

function feedLine(feed) {
  if (!feed || typeof feed !== 'object') return 'no feed detail';
  return Object.entries(feed).map(([k, v]) => {
    const st = v && typeof v === 'object' ? (v.state || JSON.stringify(v).slice(0, 40)) : String(v);
    return `${k}: ${st}`;
  }).join(' · ');
}

export default function TallyPanel({ onConfirm }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [newKey, setNewKey] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api.get('/tally/state')); setErr(null); }
    catch (e) { if (e.status !== 400) setErr(e.message); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (fn) => { try { await fn(); await load(); } catch (e) { setErr(e.message); } };

  const setArmed = (s, armed) => act(() => api.patch(`/tally/studios/${encodeURIComponent(s.id)}`, { armed }));
  const onArm = (s) => {
    if (s.armed) return setArmed(s, false);   // stopping is never gated
    const n = (data?.screens || []).filter((x) => x.tally_studio === s.id && x.tally_mode !== 'off').length;
    onConfirm({
      title: `Arm tally for “${s.name}”?`,
      body: `Once armed, ${n} screen${n === 1 ? '' : 's'} set to follow ${s.name} will show ON AIR / MIC LIVE by themselves whenever the relay says so. Blackout still wins, and locked screens get the banner instead of the full-screen card.`,
      danger: true,
      onOk: () => setArmed(s, true),
    });
  };

  const addStudio = () => {
    const id = window.prompt('Relay studio id — exactly what the studio-tap relay sends as "studio" (e.g. studio-1)');
    if (!id) return;
    const name = window.prompt('Name to show on screens (e.g. Studio 1)', id) || id;
    act(() => api.post('/tally/studios', { id: id.trim(), name: name.trim() }));
  };
  const addKey = (s) => act(async () => { setNewKey(await api.post(`/tally/studios/${encodeURIComponent(s.id)}/keys`, { name: 'studio-tap relay' })); });
  const revokeKey = (k) => {
    if (!window.confirm(`Revoke key ${k.key_prefix}…? The relay using it will be refused at once (screens go TALLY LOST).`)) return;
    act(() => api.delete(`/tally/keys/${k.id}`));
  };
  const setScreen = (scr, patch) => act(() => api.put(`/tally/screens/${scr.id}`, {
    tally_mode: scr.tally_mode, tally_show: scr.tally_show, tally_studio: scr.tally_studio, ...patch,
  }));

  const studios = data?.studios || [];
  const screens = data?.screens || [];

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Studio tally — ON AIR / MIC LIVE</h2>
        <button onClick={addStudio} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700">Add studio</button>
      </div>

      {err && <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{err}</div>}

      {newKey && (
        <div className="mb-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
          <p className="text-amber-200 text-sm font-semibold">Copy this key into the relay config now — it is not shown again.</p>
          <div className="mt-2 space-y-1 font-mono text-xs">
            <div className="text-gray-300 break-all"><span className="text-gray-500">POST </span>{location.origin}{newKey.ingest_url}</div>
            <div className="text-gray-300 break-all"><span className="text-gray-500">Header </span>Authorization: Bearer {newKey.key}</div>
            <div className="text-gray-300"><span className="text-gray-500">studio </span>{newKey.studio}</div>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700">I have saved it</button>
        </div>
      )}

      {!data ? <div className="text-gray-500 text-sm">Loading…</div>
        : studios.length === 0 ? (
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-gray-500 text-sm">
            No tally studios. Add one with the same id the studio-tap relay sends, then give it a key.
          </div>
        ) : studios.map((s) => {
          const t = s.last?.tally;
          const lost = s.status !== 'ok';
          return (
            <div key={s.id} className={`mb-3 p-4 rounded-xl border ${s.armed ? 'border-red-500/40 bg-red-500/[0.06]' : 'border-gray-800 bg-gray-900/50'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{s.name}</h3>
                    <span className="text-gray-600 text-xs font-mono">{s.id}</span>
                    {lost ? <Pill tone="amber">{s.status === 'never' ? 'NEVER HEARD' : 'TALLY LOST'}</Pill> : <Pill tone="green">receiving</Pill>}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500 text-xs">Studio</span>{lost ? <Pill tone="amber">unknown</Pill> : triPill(s.studioLive, 'ON AIR', 'off air')}
                    <span className="text-gray-500 text-xs ml-2">Mic</span>{lost ? <Pill tone="amber">unknown</Pill> : triPill(s.micLive, 'MIC LIVE', 'mic off')}
                    {!lost && s.micLive === null && (
                      <span className="text-gray-500 text-[11px]">mic tally not connected — MIC LIVE is never shown while unknown</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    Last heard {age(s.age_ms)}{s.last?.relay ? ` from ${s.last.relay.src} v${s.last.relay.version || '?'}` : ''}
                    {t ? ` · confidence ${t.confidence}` : ''}
                    {t?.playersOpen?.length ? ` · faders open: ${t.playersOpen.join(', ')}` : ''}
                    {` · lost after ${Math.round(s.stale_ms / 1000)}s silence`}
                  </p>
                  {t?.reasons?.length > 0 && <p className="text-gray-500 text-xs mt-1">Why: {t.reasons.join('; ')}</p>}
                  <p className="text-gray-600 text-xs mt-1">Feed: {feedLine(s.last?.feed)}{s.rejected_count ? ` · ${s.rejected_count} rejected` : ''}</p>
                </div>
                <button onClick={() => onArm(s)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    s.armed ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'}`}
                  title={s.armed ? 'Take tally off every screen now' : 'Allow screens to show tally'}>
                  {s.armed ? 'ARMED — disarm' : 'Disarmed — arm'}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs">Keys</span>
                {s.keys.filter((k) => k.active).length === 0 && <span className="text-amber-300/80 text-xs">none — the relay is refused until you add one</span>}
                {s.keys.filter((k) => k.active).map((k) => (
                  <span key={k.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs">
                    <span className="font-mono text-gray-300">{k.key_prefix}…</span>
                    <span className="text-gray-500">{k.last_seen_at ? 'used' : 'unused'}</span>
                    <button onClick={() => revokeKey(k)} className="text-gray-500 hover:text-red-300" title="Revoke">✕</button>
                  </span>
                ))}
                <button onClick={() => addKey(s)} className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700">New key</button>
              </div>
            </div>
          );
        })}

      {studios.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 divide-y divide-gray-800">
          {screens.map((scr) => {
            const sh = scr.showing || {};
            const now = sh.suppressed ? 'hidden by blackout'
              : sh.takeover ? 'full-screen card'
              : sh.lost ? 'TALLY LOST chip'
              : sh.banner ? `banner: ${[sh.banner.onAir && 'ON AIR', sh.banner.micLive && 'MIC LIVE'].filter(Boolean).join(' + ')}`
              : 'nothing';
            return (
              <div key={scr.id} className="p-2.5 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-white text-sm min-w-[8rem]">{scr.name}</span>
                {!scr.accepts_broadcasts && <span className="text-gray-500" title="Locked screens get the banner, never the full-screen card">🔒</span>}
                <select value={scr.tally_mode} onChange={(e) => setScreen(scr, { tally_mode: e.target.value, tally_studio: scr.tally_studio || (e.target.value !== 'off' ? studios[0]?.id : null) })}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200">
                  {Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={scr.tally_studio || ''} disabled={scr.tally_mode === 'off'} onChange={(e) => setScreen(scr, { tally_studio: e.target.value || null })}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 disabled:opacity-40">
                  <option value="">— studio —</option>
                  {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={scr.tally_show} disabled={scr.tally_mode === 'off'} onChange={(e) => setScreen(scr, { tally_show: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 disabled:opacity-40">
                  {Object.entries(SHOW_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className={`ml-auto ${sh.banner || sh.takeover ? 'text-red-300' : sh.lost ? 'text-amber-300' : 'text-gray-500'}`}>now: {now}</span>
              </div>
            );
          })}
        </div>
      )}

      {data?.events?.length > 0 && (
        <details className="mt-3">
          <summary className="text-gray-500 text-xs cursor-pointer">Tally activity</summary>
          <div className="mt-2 rounded-xl border border-gray-800 bg-gray-900/50 divide-y divide-gray-800 max-h-72 overflow-y-auto">
            {data.events.map((e) => (
              <div key={e.id} className="p-2 flex items-center gap-3 text-xs">
                <span className={`shrink-0 ${e.outcome.startsWith('rejected') || e.outcome === 'lost' ? 'text-amber-300' : 'text-gray-300'}`}>{EVENT_TEXT[e.outcome] || e.outcome}</span>
                <span className="text-gray-600 truncate">{e.detail}</span>
                <span className="ml-auto text-gray-600 shrink-0 tabular-nums">{age(data.now - e.at_ms)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
