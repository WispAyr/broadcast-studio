/**
 * SideLiners Director: live football data → broadcast graphics, and who decides.
 *
 * The data arrives through Broadcast Studio's external data feed (football
 * from the NAR intranet, the one caller of API-Football). The director bot
 * turns each match event (goal, red card, full-time …) into a CUE: a
 * ready-to-air /player/sideliners graphic with a priority, a reason and an
 * expiry.
 *
 * MODE is the loudest thing on the page, and it always says in plain words what
 * will happen:
 *   OFF     nothing is made
 *   ASSIST  cues queue here, and a person TAKEs them (or Stream Deck `sl_take_next`)
 *   AUTO    the bot airs the important cues itself, only while armed, and the
 *           arm expires by itself
 * Turning AUTO on asks first. Turning it off never does.
 *
 * State polls in place (2 s). A view that goes quietly stale lies about what's on air.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';

const LEAGUES = [
  { id: 179, name: 'Scottish Premiership' }, { id: 180, name: 'Championship' },
  { id: 183, name: 'League One' }, { id: 184, name: 'League Two' }, { id: 39, name: 'Premier League' },
];
const KIND = {
  goal: ['GOAL', 'bg-amber-500 text-black'], scorer: ['GOAL UPDATE', 'bg-amber-500/70 text-black'],
  goal_cancelled: ['RULED OUT', 'bg-red-600 text-white'], red_card: ['RED CARD', 'bg-red-500 text-white'],
  kickoff: ['KICK-OFF', 'bg-sky-600 text-white'], half_time: ['HALF-TIME', 'bg-indigo-500 text-white'],
  full_time: ['FULL-TIME', 'bg-purple-600 text-white'], penalties: ['PENS', 'bg-amber-600 text-black'],
  postponed: ['POSTPONED', 'bg-gray-500 text-white'], abandoned: ['ABANDONED', 'bg-gray-500 text-white'],
  suspended: ['SUSPENDED', 'bg-gray-500 text-white'], extra_time: ['EXTRA TIME', 'bg-indigo-400 text-white'],
  scores: ['LIVE SCORES', 'bg-emerald-600 text-white'], results: ['RESULTS', 'bg-emerald-700 text-white'],
  table: ['TABLE', 'bg-teal-600 text-white'],
};
const WHAT = { aired: 'text-emerald-300', pulled: 'text-sky-300', dismissed: 'text-gray-400', expired: 'text-gray-500',
  retired: 'text-gray-500', skipped: 'text-gray-600' };

const clock = (ms) => ms ? new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
const left = (ms) => { const s = Math.max(0, Math.round((ms - Date.now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };
const minute = (f) => f.finished ? f.status : f.status === 'HT' ? 'HT' : f.elapsed ? `${f.elapsed}'` : f.status;

function Chip({ kind }) {
  const [t, c] = KIND[kind] || [String(kind || '').toUpperCase(), 'bg-gray-600 text-white'];
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${c}`}>{t}</span>;
}

function Preview({ url }) {
  const box = useRef(null); const [s, setS] = useState(0.3);
  useEffect(() => {
    const fit = () => box.current && setS(box.current.clientWidth / 1920);
    fit(); const ro = new ResizeObserver(fit); if (box.current) ro.observe(box.current); return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg border border-gray-700" style={{ aspectRatio: '16 / 9', background: 'repeating-conic-gradient(#2a2a30 0 25%, #222228 0 50%) 0 0 / 24px 24px' }}>
      {url ? <iframe key={url} title="preview" src={url + (url.includes('?') ? '&' : '?') + 'format=landscape'} scrolling="no"
        style={{ width: 1920, height: 1080, border: 0, transform: `scale(${s})`, transformOrigin: '0 0', pointerEvents: 'none', background: 'transparent' }} />
        : <div className="absolute inset-0 grid place-items-center text-gray-500 text-sm">Select a cue to preview it</div>}
    </div>
  );
}

export default function SidelinersDirector() {
  const [studios, setStudios] = useState([]);
  const [studioId, setStudioId] = useState(() => { try { return localStorage.getItem('sl_director_studio') || ''; } catch { return ''; } });
  const [st, setSt] = useState(null);
  const [feed, setFeed] = useState(null);
  const [screens, setScreens] = useState([]);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [armHours, setArmHours] = useState(4);
  const [tblLeague, setTblLeague] = useState(179);
  const [tblHl, setTblHl] = useState('Kilmarnock');
  const [, force] = useState(0);

  useEffect(() => { api.get('/studios').then(r => setStudios(Array.isArray(r) ? r : (r.studios || []))).catch(e => setErr(e.message)); }, []);
  useEffect(() => { if (!studioId) return; try { localStorage.setItem('sl_director_studio', studioId); } catch {}
    api.get('/screens').then(r => setScreens((Array.isArray(r) ? r : r.screens || []).filter(s => s.studio_id === studioId))).catch(() => {}); }, [studioId]);

  const load = useCallback(async () => {
    if (!studioId) return;
    try {
      const [d, f] = await Promise.all([api.get(`/sl-director/${studioId}`), api.get('/datafeeds/sideliners/public')]);
      setSt(d); setFeed(f); setErr(null);
    } catch (e) { setErr(e.message); }
  }, [studioId]);
  useEffect(() => { load(); const t = setInterval(load, 2000); const c = setInterval(() => force(x => x + 1), 1000); return () => { clearInterval(t); clearInterval(c); }; }, [load]);

  const call = async (fn) => { try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const setMode = (mode) => call(() => api.post(`/sl-director/${studioId}/mode`, mode === 'auto' ? { mode, hours: armHours } : { mode }));
  const settings = (patch) => call(() => api.put(`/sl-director/${studioId}/settings`, patch));
  const manual = (body) => call(() => api.post(`/sl-director/${studioId}/manual`, body));

  const selCue = st && (st.queue.find(q => q.id === sel) || (st.onAir && st.onAir.id === sel ? st.onAir : null));
  const f = st && st.feed; const up = f && f.upstream;

  if (!studioId || !st) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-bold text-white mb-2">SideLiners Director</h1>
        <p className="text-gray-400 mb-4 text-sm">Live football → broadcast graphics. Pick the studio whose screens carry the SideLiner's show.</p>
        <select className="bg-gray-800 text-white rounded px-3 py-2 w-full" value={studioId} onChange={e => setStudioId(e.target.value)}>
          <option value="">Choose a studio…</option>
          {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {err && <p className="text-red-400 mt-3 text-sm">{err}</p>}
      </div>
    );
  }

  const mode = st.mode; const armed = st.armed;
  const modeText = mode === 'off' ? 'The director is OFF. No cues are made and nothing goes to air from here.'
    : mode === 'assist' ? 'ASSIST: cues queue below and a person takes them. Nothing reaches a screen by itself.'
    : armed ? `AUTO, ARMED: the director puts cues at priority ${st.settings.autoFloor} and above on air ITSELF, until ${clock(st.armedUntil)} (${left(st.armedUntil)} left). Lower cues still wait for you.`
    : 'AUTO but the arm has EXPIRED, so it is behaving as ASSIST. Re-arm to let it air by itself.';

  return (
    <div className="p-5 space-y-4 text-gray-200">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white mr-2">SideLiners Director</h1>
        <select className="bg-gray-800 text-white rounded px-2 py-1 text-sm" value={studioId} onChange={e => { setStudioId(e.target.value); setSt(null); }}>
          {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <a className="text-xs text-sky-400 underline ml-auto" href="/player/sideliners/control.html" target="_blank" rel="noreferrer">Manual graphics control ↗</a>
      </div>

      {/* MODE: the loudest thing on the page */}
      <div className={`rounded-xl border p-4 ${mode === 'auto' && armed ? 'border-red-500 bg-red-950/40' : mode === 'assist' ? 'border-amber-500/60 bg-amber-950/20' : 'border-gray-700 bg-gray-900'}`}>
        <div className="flex flex-wrap items-center gap-2">
          {['off', 'assist'].map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 rounded-lg font-bold text-sm ${mode === m ? 'bg-white text-black' : 'bg-gray-800 hover:bg-gray-700'}`}>{m.toUpperCase()}</button>
          ))}
          <button onClick={() => setConfirmAuto(true)} className={`px-4 py-2 rounded-lg font-bold text-sm ${mode === 'auto' && armed ? 'bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>AUTO{mode === 'auto' && armed ? ` · ${left(st.armedUntil)}` : ''}</button>
          {mode === 'auto' && <button onClick={() => setMode('assist')} className="px-4 py-2 rounded-lg font-bold text-sm bg-amber-500 text-black">DISARM → ASSIST</button>}
          <span className="text-sm ml-2">{modeText}</span>
        </div>
        {confirmAuto && (
          <div className="mt-3 p-3 rounded-lg bg-black/40 border border-red-500/50 text-sm flex flex-wrap items-center gap-3">
            <span>Let the director air graphics <b>by itself</b> on {st.screens.open.length} screen(s){st.screens.locked ? ` (${st.screens.locked} locked, skipped)` : ''} for</span>
            <select className="bg-gray-800 rounded px-2 py-1" value={armHours} onChange={e => setArmHours(Number(e.target.value))}>
              {[0.5, 1, 2, 3, 4, 6].map(h => <option key={h} value={h}>{h} h</option>)}
            </select>
            <button onClick={() => { setConfirmAuto(false); setMode('auto'); }} className="px-3 py-1.5 rounded bg-red-600 font-bold">ARM AUTO</button>
            <button onClick={() => setConfirmAuto(false)} className="px-3 py-1.5 rounded bg-gray-700">Cancel</button>
          </div>
        )}
      </div>

      {/* feed health */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`px-2 py-1 rounded font-bold ${f.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-200'}`}>
          FEED {f.ok ? 'OK' : 'STALE'}{f.ageSec != null ? ` · ${f.ageSec}s` : ''}{f.error ? ` · ${f.error}` : ''}</span>
        {up && <span className="px-2 py-1 rounded bg-gray-800">{up.engine && up.engine.window ? 'MATCHDAY WINDOW — live polling' : 'no watched match on'}</span>}
        {up && up.engine && up.engine.nextKickoff && <span className="px-2 py-1 rounded bg-gray-800">next KO {new Date(up.engine.nextKickoff.ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {up.engine.nextKickoff.home} v {up.engine.nextKickoff.away}</span>}
        {f.counts && <span className="px-2 py-1 rounded bg-gray-800">{f.counts.live} live · {f.counts.results} results · {f.counts.upcoming} to come</span>}
        {up && up.quota && up.quota.provider && <span className="px-2 py-1 rounded bg-gray-800">API {up.quota.usedToday} today · {up.quota.provider.remaining}/{up.quota.provider.limit} left</span>}
        {up && up.engine && up.engine.quotaMode !== 'normal' && <span className="px-2 py-1 rounded bg-orange-900 text-orange-200 font-bold">QUOTA {String(up.engine.quotaMode).toUpperCase()}</span>}
        <span className="px-2 py-1 rounded bg-gray-800">{st.screens.open.length} screen(s) targeted{st.screens.locked ? ` · ${st.screens.locked} locked` : ''}</span>
      </div>
      {err && <div className="text-red-400 text-sm">{err}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* left: on air + queue */}
        <div className="xl:col-span-3 space-y-3">
          <div className={`rounded-xl p-3 border ${st.onAir ? 'border-red-500 bg-red-950/30' : 'border-gray-800 bg-gray-900'}`}>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-black px-2 py-0.5 rounded ${st.onAir ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>ON AIR</span>
              {st.onAir ? <>
                <Chip kind={st.onAir.kind} /><span className="font-semibold truncate">{st.onAir.title}</span>
                <span className="text-xs text-gray-400 ml-auto">{left(st.onAir.until)} · by {st.onAir.by}</span>
                <button onClick={() => call(() => api.post(`/sl-director/${studioId}/pull`, {}))} className="px-3 py-1 rounded bg-gray-100 text-black text-xs font-bold">PULL</button>
              </> : <span className="text-sm text-gray-500">No director graphic on air</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white">Queue <span className="text-gray-500 font-normal text-sm">({st.queue.length})</span></h2>
            <button disabled={!st.queue.length} onClick={() => call(() => api.post(`/sl-director/${studioId}/take-next`, {}))}
              className="ml-auto px-4 py-1.5 rounded-lg bg-red-600 disabled:opacity-30 font-black text-sm">TAKE NEXT</button>
          </div>
          {!st.queue.length && <div className="text-sm text-gray-500 border border-dashed border-gray-800 rounded-lg p-4">
            {mode === 'off' ? 'Director is off.' : 'Nothing queued. Cues arrive here as goals, cards and results come in from the feed.'}</div>}
          <div className="space-y-2">
            {st.queue.map((q, i) => (
              <div key={q.id} onClick={() => setSel(q.id)}
                className={`rounded-lg p-3 border cursor-pointer ${sel === q.id ? 'border-sky-400 bg-sky-950/30' : i === 0 ? 'border-amber-500/60 bg-gray-900' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}>
                <div className="flex items-center gap-2">
                  {i === 0 && <span className="text-[10px] font-black text-amber-400">NEXT</span>}
                  <Chip kind={q.kind} />
                  {q.local === 'AYRSHIRE' && <span className="text-[10px] font-bold px-1.5 rounded bg-amber-400 text-black">AYRSHIRE</span>}
                  <span className="font-semibold truncate">{q.title}</span>
                  <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">P{q.priority}{mode === 'auto' && armed && q.priority >= st.settings.autoFloor ? ' · auto' : ''} · expires {left(q.expiresAt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-400 truncate">{q.detail}{q.detail && q.reason ? ' — ' : ''}<i>{q.reason}</i></span>
                  <button onClick={e => { e.stopPropagation(); call(() => api.post(`/sl-director/${studioId}/dismiss/${q.id}`, {})); }} className="ml-auto px-2 py-1 rounded bg-gray-700 text-xs">Dismiss</button>
                  <button onClick={e => { e.stopPropagation(); call(() => api.post(`/sl-director/${studioId}/take/${q.id}`, {})); }} className="px-3 py-1 rounded bg-red-600 text-xs font-bold">TAKE</button>
                </div>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-white pt-2">Log</h2>
          <div className="rounded-lg bg-gray-900 border border-gray-800 max-h-64 overflow-auto text-xs font-mono">
            {st.history.length ? st.history.map((h, i) => (
              <div key={i} className="px-3 py-1 border-b border-gray-800/60 flex gap-3">
                <span className="text-gray-500">{new Date(h.at).toLocaleTimeString('en-GB')}</span>
                <span className={`w-16 ${WHAT[h.what] || ''}`}>{h.what}</span>
                <span className="truncate">{h.title}</span>
                <span className="ml-auto text-gray-500 truncate">{h.by || h.why || ''}{h.screens != null ? ` · ${h.screens} scr` : ''}</span>
              </div>)) : <div className="p-3 text-gray-500">Nothing yet.</div>}
          </div>
        </div>

        {/* right: preview, quick graphics, live matches, settings */}
        <div className="xl:col-span-2 space-y-3">
          <Preview url={selCue ? selCue.url : null} />
          {selCue && <div className="text-xs text-gray-400 break-all">{selCue.slot} · {selCue.duration}s · {selCue.url}</div>}

          <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 space-y-2">
            <div className="font-bold text-white text-sm">Request a graphic</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => manual({ kind: 'scores', set: 'live' })} className="px-3 py-1.5 rounded bg-emerald-700 text-xs font-bold">Queue live scores</button>
              <button onClick={() => manual({ kind: 'scores', set: 'results' })} className="px-3 py-1.5 rounded bg-emerald-800 text-xs font-bold">Queue results</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="bg-gray-800 rounded px-2 py-1 text-xs" value={tblLeague} onChange={e => setTblLeague(Number(e.target.value))}>
                {LEAGUES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input className="bg-gray-800 rounded px-2 py-1 text-xs w-32" value={tblHl} onChange={e => setTblHl(e.target.value)} placeholder="highlight team" />
              <button onClick={() => manual({ kind: 'table', league: tblLeague, hl: tblHl })} className="px-3 py-1.5 rounded bg-teal-700 text-xs font-bold">Queue table</button>
            </div>
          </div>

          <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
            <div className="font-bold text-white text-sm mb-2">Today {feed && feed.stale && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-800">STALE</span>}</div>
            {feed && [...feed.live, ...feed.results, ...feed.upcoming].slice(0, 40).map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-800/60">
                <span className={`w-10 text-center font-bold rounded ${m.live ? 'bg-red-700 text-white' : m.finished ? 'bg-gray-700' : 'text-gray-500'}`}>
                  {m.live || m.finished ? minute(m) : new Date(m.ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`truncate flex-1 ${m.local === 'AYRSHIRE' ? 'text-amber-300 font-semibold' : ''}`}>
                  {m.home.name} {m.live || m.finished ? `${m.home.goals ?? 0}-${m.away.goals ?? 0}` : 'v'} {m.away.name}</span>
                <span className="text-gray-500 truncate w-28 text-right">{m.league.name}</span>
                {(m.live || m.finished) && <button title="queue a score card for this match" onClick={() => manual({ kind: 'result', fixtureId: m.id })} className="px-1.5 py-0.5 rounded bg-purple-700">Card</button>}
                <button title="keep the corner score bug in sync with this match"
                  onClick={() => settings({ bugFixtureId: st.settings.bugFixtureId === m.id ? null : m.id })}
                  className={`px-1.5 py-0.5 rounded ${st.settings.bugFixtureId === m.id ? 'bg-amber-500 text-black' : 'bg-gray-700'}`}>Bug</button>
              </div>
            ))}
            {feed && !feed.live.length && !feed.results.length && !feed.upcoming.length && <div className="text-xs text-gray-500">No watched fixtures today.</div>}
          </div>

          <details className="rounded-lg bg-gray-900 border border-gray-800 p-3 text-xs">
            <summary className="font-bold text-white text-sm cursor-pointer">Director rules</summary>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[['minGapSec', 'Gap between graphics (s)'], ['autoFloor', 'AUTO airs from priority'], ['queueFloor', 'Ignore below priority'],
                ['cutInPriority', 'May cut in from priority'], ['scoresEveryMin', 'Live-scores roundup every (min, 0 = off)']].map(([k, label]) => (
                <label key={k} className="flex flex-col gap-1">{label}
                  <input type="number" className="bg-gray-800 rounded px-2 py-1" defaultValue={st.settings[k]}
                    onBlur={e => settings({ [k]: Number(e.target.value) })} /></label>
              ))}
              <div className="flex flex-col gap-1">Competitions
                {[[1, 'Scottish top flight + cups'], [2, 'Rest of SPFL'], [3, 'England / Europe / internationals']].map(([t, l]) => (
                  <label key={t} className="flex items-center gap-2"><input type="checkbox" checked={st.settings.tiers[t] !== false}
                    onChange={e => settings({ tiers: { ...st.settings.tiers, [t]: e.target.checked } })} />{l}</label>))}
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!st.settings.resultsRoundup} onChange={e => settings({ resultsRoundup: e.target.checked })} />Results roundup after a burst of full-times</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!st.settings.tableAfterFT} onChange={e => settings({ tableAfterFT: e.target.checked })} />Table after an Ayrshire full-time</label>
              <div className="col-span-2 flex flex-col gap-1">Screens
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!Array.isArray(st.settings.target)} onChange={e => settings({ target: e.target.checked ? 'all' : [] })} />Whole studio</label>
                  {Array.isArray(st.settings.target) && screens.map(s => (
                    <label key={s.id} className="flex items-center gap-1"><input type="checkbox" checked={st.settings.target.includes(s.id)}
                      onChange={e => settings({ target: e.target.checked ? [...st.settings.target, s.id] : st.settings.target.filter(x => x !== s.id) })} />{s.name}</label>))}
                </div>
              </div>
            </div>
            <p className="text-gray-500 mt-3">Stream Deck: console actions <code>sl_take_next</code>, <code>sl_dismiss_next</code>, <code>sl_pull</code>, <code>sl_mode</code> {'{mode}'}, <code>sl_gfx</code> {'{kind: scores|table, set, league, hl}'}.</p>
          </details>
        </div>
      </div>
    </div>
  );
}
