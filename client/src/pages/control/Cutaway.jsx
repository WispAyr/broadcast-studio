/**
 * Cutaway — trigger-driven temporary screen takeover, and the operator's controls for it.
 *
 * The ARM toggle is the reason this page exists. Until now the only way to stop a
 * misbehaving door camera was a PATCH with a JWT, which is no use to someone in a
 * show. Arming is therefore the loudest thing here, it always says what it will do
 * in plain words, and turning it ON asks first (turning it OFF never does — you
 * never want to add friction to the stop button).
 *
 * Live state polls IN PLACE rather than re-rendering the page, the same lesson as
 * the intranet Screens tab: a view that silently goes stale while someone else
 * triggers is a view that lies about what is on air.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';

const OUTCOME_STYLE = {
  fired:                { c: 'bg-red-500/15 text-red-300 border-red-500/30',       t: 'Cut' },
  fired_manual:         { c: 'bg-red-500/15 text-red-300 border-red-500/30',       t: 'Cut (manual)' },
  extended:             { c: 'bg-amber-500/15 text-amber-300 border-amber-500/30', t: 'Held longer' },
  released_manual:      { c: 'bg-sky-500/15 text-sky-300 border-sky-500/30',       t: 'Released' },
  suppressed_disarmed:  { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40',    t: 'Ignored — disarmed' },
  suppressed_locked:    { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40',    t: 'Ignored — screen locked' },
  suppressed_blackout:  { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40',    t: 'Ignored — blackout' },
  suppressed_cooldown:  { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40',    t: 'Ignored — cooling down' },
  suppressed_bad_key:   { c: 'bg-orange-500/15 text-orange-300 border-orange-500/30', t: 'REJECTED — bad key' },
  suppressed_rate_limit:{ c: 'bg-orange-500/15 text-orange-300 border-orange-500/30', t: 'Rate limited' },
  no_targets:           { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40',    t: 'No screens' },
  no_rules:             { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40',    t: 'No rule bound' },
};

const secs = (ms) => `${Math.round(ms / 1000)}s`;
const ago = (iso) => {
  if (!iso) return 'never';
  const d = Math.max(0, (Date.now() - new Date(iso + 'Z').getTime()) / 1000);
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
};

function Confirm({ open, title, body, danger, onOk, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-semibold text-lg">{title}</h3>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          <button onClick={onOk}
            className={`px-3 py-2 rounded-lg text-sm font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {danger ? 'Arm it' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Cutaway() {
  const [rules, setRules] = useState([]);
  const [sources, setSources] = useState([]);
  const [screens, setScreens] = useState([]);
  const [groups, setGroups] = useState([]);
  const [state, setState] = useState([]);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [tick, setTick] = useState(0);
  const timers = useRef([]);

  const loadAll = useCallback(async () => {
    try {
      const [r, s, sc, g] = await Promise.all([
        api.get('/cutaway'), api.get('/cutaway/sources'), api.get('/screens'), api.get('/screen-groups'),
      ]);
      setRules(r || []); setSources(s || []);
      setScreens(Array.isArray(sc) ? sc : (sc?.screens || []));
      setGroups(Array.isArray(g) ? g : (g?.groups || []));
      setErr(null);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, []);

  // Live state + log poll in place — never re-render the whole page under the operator.
  const loadLive = useCallback(async () => {
    try {
      const [st, ev] = await Promise.all([api.get('/cutaway/state'), api.get('/cutaway/events?limit=25')]);
      setState(st || []); setEvents(ev || []);
    } catch { /* transient — keep last good rather than blank the view */ }
  }, []);

  useEffect(() => {
    loadAll(); loadLive();
    timers.current.push(setInterval(loadLive, 2000));
    timers.current.push(setInterval(() => setTick((t) => t + 1), 1000)); // countdown ticker
    return () => { timers.current.forEach(clearInterval); timers.current = []; };
  }, [loadAll, loadLive]);

  const targetName = (rule) => {
    if (rule.scope === 'studio') return 'Every screen in the studio';
    if (rule.scope === 'group') return groups.find((g) => g.id === rule.target_id)?.name || 'Unknown group';
    return screens.find((s) => s.id === rule.target_id)?.name || 'Unknown screen';
  };

  const heldBy = (ruleId) => state.filter((s) => s.source === `cutaway:${ruleId}`);

  const setArmed = async (rule, armed) => {
    try { await api.patch(`/cutaway/${rule.id}`, { armed }); await loadAll(); await loadLive(); }
    catch (e) { setErr(e.message); }
  };

  const onArmToggle = (rule) => {
    if (rule.armed) return setArmed(rule, false);   // stopping is never gated
    setConfirm({
      title: `Arm “${rule.name}”?`,
      body: `Once armed, a trigger from “${sources.find((s) => s.id === rule.source_id)?.name || 'its source'}” will put the camera on ${targetName(rule).toLowerCase()} for ${secs(rule.dwell_ms)}, without asking. Locked screens and blackouts are still respected.`,
      danger: true,
      onOk: () => { setConfirm(null); setArmed(rule, true); },
    });
  };

  const fire = async (rule) => { try { await api.post(`/cutaway/${rule.id}/fire`, {}); loadLive(); } catch (e) { setErr(e.message); } };
  const release = async (rule) => { try { await api.post(`/cutaway/${rule.id}/release`, {}); loadLive(); } catch (e) { setErr(e.message); } };

  const addSource = async () => {
    const name = window.prompt('Name this trigger source (e.g. "Front Door — Entry Zone")');
    if (!name) return;
    try { const r = await api.post('/cutaway/sources', { name }); setNewKey(r); loadAll(); }
    catch (e) { setErr(e.message); }
  };

  const armedCount = rules.filter((r) => r.armed).length;
  const liveHolds = state.filter((s) => s.layer === 'cutaway');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Confirm open={!!confirm} {...(confirm || {})} onCancel={() => setConfirm(null)} />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cutaway</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            An outside trigger — a camera, a door, an alarm — briefly takes a screen, then the screen
            goes back on its own. Nothing here can hold a screen indefinitely: every cutaway has a
            time limit, and a blackout always wins.
          </p>
        </div>
        <div className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold ${
          armedCount ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
          {armedCount ? `${armedCount} armed` : 'Nothing armed'}
        </div>
      </div>

      {err && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{err}</div>}

      {/* ON AIR NOW */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">On air now</h2>
        {liveHolds.length === 0 ? (
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-gray-500 text-sm">
            No screen is being held. Everything is showing its programme.
          </div>
        ) : (
          <div className="space-y-2">
            {liveHolds.map((h) => {
              const left = h.expires_at_ms ? Math.max(0, h.expires_at_ms - Date.now()) : null;
              return (
                <div key={h.screen_id} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-white font-medium text-sm">{h.screen_name}</span>
                  <span className="text-red-300/80 text-xs">held by {rules.find((r) => `cutaway:${r.id}` === h.source)?.name || h.source}</span>
                  {left != null && <span className="ml-auto text-red-200 text-xs tabular-nums">back in {secs(left)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RULES */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Cutaways</h2>
        {loading ? <div className="text-gray-500 text-sm">Loading…</div>
          : rules.length === 0 ? (
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-gray-500 text-sm">
            No cutaways yet. Create a source below, then bind a rule to it.
          </div>
        ) : rules.map((r) => {
          const held = heldBy(r.id);
          return (
            <div key={r.id} className={`mb-3 p-4 rounded-xl border ${r.armed ? 'border-red-500/40 bg-red-500/[0.06]' : 'border-gray-800 bg-gray-900/50'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{r.name}</h3>
                    {held.length > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">ON AIR</span>}
                  </div>
                  <p className="text-gray-400 text-xs mt-1">
                    {sources.find((s) => s.id === r.source_id)?.name || 'orphaned source'}
                    {' → '}<span className="text-gray-300">{targetName(r)}</span>
                    {' · '}{r.action === 'overlay' ? 'picture-in-picture' : 'full takeover'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Holds {secs(r.dwell_ms)} per trigger · never longer than {secs(r.max_hold_ms)} · waits {secs(r.cooldown_ms)} between cuts
                  </p>
                </div>

                {/* The stop button. Loud when live, plain when not. */}
                <button
                  onClick={() => onArmToggle(r)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    r.armed ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'}`}
                  title={r.armed ? 'Stop this firing automatically' : 'Allow this to fire automatically'}
                >
                  {r.armed ? 'ARMED — disarm' : 'Disarmed — arm'}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => fire(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700">
                  Cut now
                </button>
                <button onClick={() => release(r)} disabled={!held.length}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  Give it back
                </button>
                <span className="text-gray-600 text-[11px] ml-1">Manual cuts work whether or not it is armed.</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* SOURCES */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Trigger sources</h2>
          <button onClick={addSource} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500">Add source</button>
        </div>

        {newKey && (
          <div className="mb-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
            <p className="text-amber-200 text-sm font-semibold">Copy this key now — it is not shown again.</p>
            <p className="text-amber-200/70 text-xs mt-1">Only a hash is stored, so it cannot be recovered. Lose it and you make a new source.</p>
            <div className="mt-2 space-y-1 font-mono text-xs">
              <div className="text-gray-300 break-all"><span className="text-gray-500">URL </span>{location.origin}{newKey.webhook_url}</div>
              <div className="text-gray-300 break-all"><span className="text-gray-500">Header </span>X-Cutaway-Key: {newKey.key}</div>
            </div>
            <button onClick={() => setNewKey(null)} className="mt-3 px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700">I have saved it</button>
          </div>
        )}

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 divide-y divide-gray-800">
          {sources.length === 0 ? <div className="p-4 text-gray-500 text-sm">No sources yet.</div>
            : sources.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.last_seen_at ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="text-white text-sm">{s.name}</span>
              <span className="text-gray-600 text-xs font-mono">{s.key_prefix}…</span>
              {/* "never" here is the first thing to check when a trigger seems dead — it
                  distinguishes "the camera never called us" from "we ignored it". */}
              <span className="ml-auto text-gray-500 text-xs">last called {ago(s.last_seen_at)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* LOG */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Recent activity</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 divide-y divide-gray-800 max-h-96 overflow-y-auto">
          {events.length === 0 ? <div className="p-4 text-gray-500 text-sm">Nothing yet.</div>
            : events.map((e) => {
            const st = OUTCOME_STYLE[e.outcome] || { c: 'bg-gray-700/40 text-gray-400 border-gray-600/40', t: e.outcome };
            return (
              <div key={e.id} className="p-2.5 flex items-center gap-3 text-xs">
                <span className={`px-2 py-0.5 rounded border font-medium shrink-0 ${st.c}`}>{st.t}</span>
                <span className="text-gray-300 truncate">{e.cutaway_name || e.source_name || '—'}</span>
                <span className="text-gray-600 truncate hidden sm:block">{e.detail}</span>
                <span className="ml-auto text-gray-600 shrink-0 tabular-nums">{ago(e.at)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
