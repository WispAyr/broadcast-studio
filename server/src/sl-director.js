// ──────────────────────────────────────────────────────────────────────────
// SideLiners director — decides which live-football graphic goes up, and when.
//
// Input: events from the `sideliners` data feed (datafeeds.js): kickoff, goal,
// scorer, goal_cancelled, red_card, half_time, full_time, postponed …, plus
// the live snapshot for the periodic roundups (live scores, results, table).
// Output: CUES. A cue is one ready-to-air graphic (a /player/sideliners/*.html
// page pushed as a gfx_* overlay) with a priority, a reason and an expiry.
//
// Modes, per studio:
//   off     cues are not made
//   assist  (default) cues queue; an operator TAKEs them (control page, Stream
//           Deck `sl_take_next`). Nothing reaches a screen by itself.
//   auto    the director airs cues at/above `autoFloor` itself, but ONLY while
//           ARMED. Arming is explicit and time-limited (default 4 h), so an
//           AUTO left on after the show falls back to assist by itself.
//
// Editorial logic lives here, in one place:
//   - one director graphic on screen at a time, a minimum gap between them;
//     a high-priority cue (Ayrshire goal) may cut in
//   - a newer goal for the same match supersedes the unaired older one (a 1-0
//     flash when it's 2-0 is wrong)
//   - a goal ruled out before its flash aired is simply dropped; after it
//     aired, a correction is queued
//   - a scorer that arrives after the flash updates the unaired cue, or
//     queues a GOAL UPDATE if the flash already went
//   - full-time retires that match's unaired goal/kick-off/HT cues
//   - every cue expires: a goal flash 3 minutes late is not news
//   - a stale feed holds anything that would present scores as live
// Screens respect the accepts_broadcasts padlock.
// ──────────────────────────────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const { getIO } = require('./ws');
const feeds = require('./datafeeds');
const scoreboard = require('./scoreboard');

const SRC = 'sideliners';
const GFX = '/player/sideliners/';
const TABLE_LEAGUES = new Set([179, 180, 183, 184, 39]);

const DEFAULT_SETTINGS = {
  minGapSec: 40,          // quiet time between director graphics
  cutInPriority: 90,      // cues at/above this may replace what's up
  queueFloor: 35,         // below this a cue isn't made at all (event still logged)
  autoFloor: 55,          // AUTO airs cues at/above this; lower ones wait for a human
  tiers: { 1: true, 2: true, 3: true },
  scoresEveryMin: 10,     // live-scores roundup cadence while ≥2 watched matches are on (0 = off)
  resultsRoundup: true,   // a results roundup after a burst of full-times
  tableAfterFT: true,     // league table after an Ayrshire club's full-time
  target: 'all',          // 'all' | [screenId,…]
  bugFixtureId: null,     // keep the sl_score corner bug in sync with this fixture
  armHours: 4,
};

db.exec(`CREATE TABLE IF NOT EXISTS sl_director (
  studio_id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'assist', armed_until INTEGER DEFAULT 0,
  settings TEXT NOT NULL DEFAULT '{}', updated_at TEXT DEFAULT (datetime('now')))`);

// ── config ───────────────────────────────────────────────────────────────
function cfg(studioId) {
  const r = db.prepare('SELECT * FROM sl_director WHERE studio_id = ?').get(studioId);
  let s = {}; try { s = JSON.parse((r && r.settings) || '{}'); } catch {}
  return { studioId, mode: r ? r.mode : 'off', armedUntil: r ? r.armed_until || 0 : 0,
    settings: { ...DEFAULT_SETTINGS, ...s, tiers: { ...DEFAULT_SETTINGS.tiers, ...(s.tiers || {}) } }, exists: !!r };
}
function saveCfg(studioId, patch) {
  const c = cfg(studioId);
  const mode = patch.mode || (c.exists ? c.mode : 'assist');
  if (!['off', 'assist', 'auto'].includes(mode)) throw new Error('mode must be off|assist|auto');
  const settings = { ...c.settings, ...(patch.settings || {}) };
  const armed = patch.armedUntil !== undefined ? patch.armedUntil : c.armedUntil;
  db.prepare(`INSERT INTO sl_director (studio_id, mode, armed_until, settings, updated_at) VALUES (?,?,?,?,datetime('now'))
    ON CONFLICT(studio_id) DO UPDATE SET mode=excluded.mode, armed_until=excluded.armed_until, settings=excluded.settings, updated_at=excluded.updated_at`)
    .run(studioId, mode, armed, JSON.stringify(settings));
  return cfg(studioId);
}
const activeStudios = () => db.prepare("SELECT studio_id FROM sl_director WHERE mode != 'off'").all().map(r => r.studio_id);

// ── runtime (in memory; a restart empties the queue, which is the safe way round) ──
const RT = new Map();
function rt(studioId) {
  if (!RT.has(studioId)) RT.set(studioId, { queue: [], onAir: null, lastEndAt: 0, history: [], lastScoresAt: 0, lastResultsAt: 0, ftTimes: [] });
  return RT.get(studioId);
}
function hist(r, entry) { r.history.unshift({ at: Date.now(), ...entry }); r.history.length = Math.min(r.history.length, 60); }

// ── graphic builders ─────────────────────────────────────────────────────
const qs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
const url = (page, params) => `${GFX}${page}?${qs(params)}`;
const fx = e => `${e.home.name} ${e.home.goals ?? 0}-${e.away.goals ?? 0} ${e.away.name}`;
const scorersFor = (list, side) => (list || []).filter(g => g.side === side)
  .map(g => `${g.player || '?'} ${g.minute}'${g.detail === 'Penalty' ? ' (pen)' : g.detail === 'Own Goal' ? ' (og)' : ''}`).join(';');
const tierBoost = t => (t === 1 ? 20 : t === 2 ? 10 : 0);
const localBoost = e => (e.local === 'AYRSHIRE' ? 25 : 0);

const BASE = { goal: 60, goal_cancelled: 62, scorer: 30, red_card: 40, kickoff: 20, half_time: 25, full_time: 45,
  postponed: 30, abandoned: 35, penalties: 30, extra_time: 15, suspended: 20 };
const EXPIRE = { goal: 180, goal_cancelled: 300, scorer: 240, red_card: 240, kickoff: 150, half_time: 420, full_time: 900,
  postponed: 1800, abandoned: 1800, penalties: 300, extra_time: 300, suspended: 600, scores: 150, results: 600, table: 600 };

function cueFromEvent(e) {
  const base = BASE[e.kind]; if (base == null) return null;
  const tier = (e.league && e.league.tier) || 3;
  const priority = base + tierBoost(tier) + localBoost(e);
  const common = { h: e.home.name, a: e.away.name, hs: e.home.goals ?? 0, as: e.away.goals ?? 0, comp: e.league && e.league.name, hc: e.home.logo, ac: e.away.logo };
  const c = { fixtureId: e.fixture_id, kind: e.kind, priority, tier, local: e.local, eventSeq: e.seq, eventTs: Date.parse(e.ts) || Date.now() };
  switch (e.kind) {
    case 'goal':
      return { ...c, slot: 'gfx_l3', duration: 9, side: e.side, scorer: e.scorer || null,
        title: `GOAL — ${fx(e)}`, detail: e.scorer ? `${e.scorer} ${e.minute}'` : `${e.team} (scorer not yet confirmed)`,
        url: url('goal.html', { ...common, side: e.side, scorer: e.scorer, min: e.minute, gt: e.goalType, mode: 'goal' }), _common: common, _ev: e };
    case 'scorer':
      return { ...c, slot: 'gfx_l3', duration: 7, side: e.side, title: `GOAL UPDATE — ${e.scorer} ${e.minute}'`, detail: fx(e),
        url: url('goal.html', { ...common, side: e.side, scorer: e.scorer, min: e.minute, gt: e.goalType, mode: 'update' }) };
    case 'goal_cancelled':
      return { ...c, slot: 'gfx_l3', duration: 8, side: e.side, title: `GOAL RULED OUT — ${fx(e)}`, detail: `${e.team} goal cancelled`,
        url: url('goal.html', { ...common, side: e.side, mode: 'cancelled' }) };
    case 'red_card':
      return { ...c, slot: 'gfx_l3', duration: 7, title: `RED CARD — ${e.player || e.team}`, detail: `${e.team} · ${e.minute}' · ${fx(e)}`,
        url: url('strap.html', { tag: 'Red card', t: `${e.player || e.team} sent off`, s: `${e.team} · ${e.minute}' · ${fx(e)}` }) };
    case 'kickoff':
      return { ...c, slot: 'gfx_l3', duration: 6, title: `KICK-OFF — ${e.home.name} v ${e.away.name}`, detail: e.league && e.league.name,
        url: url('strap.html', { tag: 'Kick-off', t: `${e.home.name} v ${e.away.name}`, s: e.league && e.league.name }) };
    case 'half_time': case 'full_time': case 'penalties': {
      const st = e.kind === 'half_time' ? 'HT' : e.kind === 'penalties' ? 'PEN' : (e.status === 'AET' || e.status === 'PEN' ? e.status : 'FT');
      if (e.kind === 'penalties') return { ...c, slot: 'gfx_l3', duration: 7, title: `PENALTIES — ${fx(e)}`, detail: e.league && e.league.name,
        url: url('strap.html', { tag: 'Penalties', t: `${e.home.name} v ${e.away.name} goes to penalties`, s: fx(e) }) };
      return { ...c, slot: 'gfx_l3', duration: e.kind === 'full_time' ? 11 : 9, title: `${st === 'HT' ? 'HALF-TIME' : 'FULL-TIME'} — ${fx(e)}`,
        detail: e.league && e.league.name,
        url: url('result.html', { ...common, st, hsc: scorersFor(e.scorers, 'home'), asc: scorersFor(e.scorers, 'away') }) };
    }
    case 'postponed': case 'abandoned': case 'suspended': case 'extra_time': {
      const tag = { postponed: 'Postponed', abandoned: 'Abandoned', suspended: 'Match suspended', extra_time: 'Extra time' }[e.kind];
      return { ...c, slot: 'gfx_l3', duration: 7, title: `${tag.toUpperCase()} — ${e.home.name} v ${e.away.name}`, detail: e.league && e.league.name,
        url: url('strap.html', { tag, t: `${e.home.name} v ${e.away.name}`, s: e.kind === 'extra_time' ? fx(e) : e.league && e.league.name }) };
    }
    default: return null;
  }
}

function enqueue(studioId, cue, why) {
  const c = cfg(studioId), r = rt(studioId);
  if (!cue) return null;
  if (cue.tier && c.settings.tiers[cue.tier] === false) return null;
  if (!cue.manual && cue.priority < c.settings.queueFloor) { hist(r, { what: 'skipped', title: cue.title, why: `priority ${cue.priority} < floor` }); return null; }
  const full = { id: uuidv4(), createdAt: Date.now(), expiresAt: Date.now() + (EXPIRE[cue.kind] || 300) * 1000, reason: why, ...cue };
  delete full._common; delete full._ev;
  r.queue.push(full);
  return full;
}

// ── event handling (the editorial merges) ────────────────────────────────
function onEvent(studioId, e, { late }) {
  const r = rt(studioId);
  const same = (k, f) => r.queue.filter(q => q.fixtureId === e.fixture_id && q.kind === k && (!f || f(q)));
  const drop = (qs, why) => { for (const q of qs) { r.queue = r.queue.filter(x => x !== q); hist(r, { what: 'retired', title: q.title, why }); } };

  if (e.kind === 'goal') {
    drop(same('goal'), 'superseded by a newer goal in the same match');
  } else if (e.kind === 'scorer') {
    const pending = same('goal', q => q.side === e.side && !q.scorer);
    if (pending.length) {                     // flash hasn't aired: put the name on it
      const q = pending[pending.length - 1], fresh = cueFromEvent({ ...e, kind: 'goal', home: e.home, away: e.away });
      q.scorer = e.scorer; q.url = fresh.url; q.detail = `${e.scorer} ${e.minute}'`; q.reason += ' · scorer added';
      return;
    }
  } else if (e.kind === 'goal_cancelled') {
    const pending = same('goal', q => q.side === e.side);
    if (pending.length) { drop(pending, 'goal ruled out before it aired'); return; }
    const aired = r.history.some(h => h.what === 'aired' && h.fixtureId === e.fixture_id && h.kind === 'goal');
    if (!aired) return;                        // nothing wrong went out, nothing to correct
  } else if (e.kind === 'full_time') {
    drop(r.queue.filter(q => q.fixtureId === e.fixture_id && ['goal', 'goal_cancelled', 'kickoff', 'half_time', 'scorer', 'red_card'].includes(q.kind)), 'full-time result supersedes it');
    r.ftTimes.push(Date.now());
  } else if (e.kind === 'second_half') {
    drop(same('half_time'), 'second half under way');
  }
  if (late && ['goal', 'kickoff', 'scorer', 'red_card'].includes(e.kind)) {
    hist(r, { what: 'skipped', title: `${e.kind} ${e.home.name} v ${e.away.name}`, why: 'event arrived late (feed/BS was down)' });
    return;
  }
  const cue = cueFromEvent(e);
  if (!cue) return;
  const q = enqueue(studioId, cue, `${e.kind.replace('_', ' ')} · ${e.league ? e.league.name : ''}${e.local === 'AYRSHIRE' ? ' · Ayrshire club' : ''}`);
  // A match that just finished may move the table the audience cares about.
  const c = cfg(studioId);
  if (q && e.kind === 'full_time' && c.settings.tableAfterFT && e.local === 'AYRSHIRE' && TABLE_LEAGUES.has(e.league.id)) {
    const hl = e.home.local === 'AYRSHIRE' ? e.home.name : e.away.name;
    enqueue(studioId, tableCue(e.league.id, e.league.name, hl, 40), `table after ${hl} full-time`);
  }
}

function tableCue(leagueId, leagueName, hl, priority = 40) {
  return { kind: 'table', slot: 'gfx_side', duration: 14, priority, league: leagueId, title: `TABLE — ${leagueName || 'League ' + leagueId}`,
    detail: hl ? `highlight ${hl}` : '', url: url('table.html', { league: leagueId, hl, rows: 12 }) };
}
function scoresCue(set, n, priority) {
  const pages = Math.max(1, Math.ceil(n / 4));
  return { kind: set === 'results' ? 'results' : 'scores', slot: 'gfx_l3', duration: Math.min(60, pages * 7 + 2), priority,
    title: set === 'results' ? `RESULTS ROUNDUP — ${n}` : `LIVE SCORES — ${n} matches`, detail: '', url: url('scores.html', { set, page: 7 }), dynamic: true };
}

// ── airing ───────────────────────────────────────────────────────────────
function screensFor(studioId, target) {
  let rows = db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE studio_id = ?').all(studioId);
  if (Array.isArray(target)) rows = rows.filter(s => target.includes(s.id));   // [] = no screens, not all
  return { open: rows.filter(s => s.accepts_broadcasts).map(s => s.id), locked: rows.filter(s => !s.accepts_broadcasts).length };
}

function air(studioId, cue, by) {
  const io = getIO(), c = cfg(studioId), r = rt(studioId);
  const { open, locked } = screensFor(studioId, c.settings.target);
  const overlay = { type: cue.slot, url: cue.url, duration: cue.duration, source: 'sl-director', cue_id: cue.id };
  for (const id of open) io.to(`screen:${id}`).emit('push_overlay', { overlay });
  r.queue = r.queue.filter(q => q.id !== cue.id);
  r.onAir = { ...cue, airedAt: Date.now(), until: Date.now() + cue.duration * 1000, by, screens: open.length };
  if (cue.kind === 'scores') r.lastScoresAt = Date.now();
  if (cue.kind === 'results') r.lastResultsAt = Date.now();
  hist(r, { what: 'aired', title: cue.title, by, kind: cue.kind, fixtureId: cue.fixtureId, screens: open.length, locked });
  return { aired: true, screens: open.length, locked };
}

function pull(studioId, by) {
  const r = rt(studioId); if (!r.onAir) return { pulled: false };
  const { open } = screensFor(studioId, cfg(studioId).settings.target);
  const io = getIO();
  for (const id of open) io.to(`screen:${id}`).emit('remove_overlay', { overlayType: r.onAir.slot });
  hist(r, { what: 'pulled', title: r.onAir.title, by });
  r.onAir = null; r.lastEndAt = Date.now();
  return { pulled: true };
}

// ── the loop ─────────────────────────────────────────────────────────────
function tickStudio(studioId) {
  const c = cfg(studioId), r = rt(studioId), now = Date.now();
  if (c.mode === 'off') { r.queue = []; return; }
  const h = feeds.health(SRC), snap = feeds.snapshot(SRC);

  // expiry + on-air end
  for (const q of r.queue.filter(q => q.expiresAt < now)) hist(r, { what: 'expired', title: q.title, why: 'too old to be news' });
  r.queue = r.queue.filter(q => q.expiresAt >= now);
  if (r.onAir && now >= r.onAir.until) { r.onAir = null; r.lastEndAt = now; }

  // periodic roundups from the live snapshot
  if (snap && !h.stale) {
    const live = (snap.live || []).filter(f => c.settings.tiers[f.league.tier] !== false);
    if (c.settings.scoresEveryMin > 0 && live.length >= 2 && now - r.lastScoresAt > c.settings.scoresEveryMin * 60_000
        && !r.queue.some(q => q.kind === 'scores')) {
      r.lastScoresAt = now;   // counts as "offered", so assist doesn't re-queue every tick
      enqueue(studioId, scoresCue('live', live.length, 38 + (live.some(f => f.local === 'AYRSHIRE') ? 10 : 0)), `${live.length} matches in play`);
    }
    r.ftTimes = r.ftTimes.filter(t => now - t < 15 * 60_000);
    if (c.settings.resultsRoundup && r.ftTimes.length >= 3 && now - r.lastResultsAt > 20 * 60_000 && !r.queue.some(q => q.kind === 'results')) {
      r.lastResultsAt = now;
      enqueue(studioId, scoresCue('results', (snap.results || []).length, 44), `${r.ftTimes.length} full-times in 15 min`);
    }
  }
  // score bug sync (data, not an editorial choice: keeps a visible bug honest)
  if (c.settings.bugFixtureId && snap && !h.stale) {
    const f = feeds.fixture(SRC, c.settings.bugFixtureId);
    if (f && (f.live || f.finished)) {
      const cur = scoreboard.get(studioId);
      const minute = f.finished ? 'FT' : f.status === 'HT' ? 'HT' : f.elapsed ? `${f.elapsed}'` : '';
      if (cur.home_goals !== (f.home.goals ?? 0) || cur.away_goals !== (f.away.goals ?? 0) || cur.minute !== minute) {
        scoreboard.apply(studioId, { home_goals: f.home.goals ?? 0, away_goals: f.away.goals ?? 0, minute });
      }
    }
  }

  // AUTO: air the best eligible cue
  const armed = c.mode === 'auto' && c.armedUntil > now;
  if (!armed || !r.queue.length) return;
  const best = [...r.queue].sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];
  if (best.priority < c.settings.autoFloor) return;
  if (h.stale && (best.dynamic || ['goal', 'scorer', 'kickoff'].includes(best.kind))) return;   // don't air "live" off stale data
  if (r.onAir) {
    if (best.priority >= c.settings.cutInPriority && best.priority > r.onAir.priority + 10) air(studioId, best, 'auto (cut-in)');
    return;
  }
  if (now - r.lastEndAt < c.settings.minGapSec * 1000 && best.priority < c.settings.cutInPriority) return;
  air(studioId, best, 'auto');
}

let timer = null;
function start() {
  if (timer) return;
  feeds.on((source, ev, meta) => {
    if (source !== SRC) return;
    for (const sid of activeStudios()) { try { onEvent(sid, ev, meta); } catch (e) { console.error('[sl-director] event:', e.message); } }
  });
  timer = setInterval(() => {
    for (const sid of activeStudios()) { try { tickStudio(sid); } catch (e) { console.error('[sl-director] tick:', e.message); } }
  }, 1000);
  timer.unref?.();
  console.log('[sl-director] started');
}

// ── operator surface ─────────────────────────────────────────────────────
function state(studioId) {
  const c = cfg(studioId), r = rt(studioId), now = Date.now();
  return {
    studioId, mode: c.mode, armed: c.mode === 'auto' && c.armedUntil > now, armedUntil: c.armedUntil || null, settings: c.settings,
    onAir: r.onAir, queue: [...r.queue].sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt),
    history: r.history.slice(0, 40), feed: feeds.health(SRC),
    screens: screensFor(studioId, c.settings.target),
  };
}
function take(studioId, cueId, by) {
  const r = rt(studioId); const q = r.queue.find(x => x.id === cueId);
  if (!q) throw new Error('cue not found (taken, expired or retired)');
  return air(studioId, q, by);
}
function takeNext(studioId, by) {
  const s = state(studioId); if (!s.queue.length) return { aired: false, reason: 'queue empty' };
  return air(studioId, s.queue[0], by);
}
function dismiss(studioId, cueId, by) {
  const r = rt(studioId); const q = cueId ? r.queue.find(x => x.id === cueId) : state(studioId).queue[0];
  if (!q) return { dismissed: false };
  r.queue = r.queue.filter(x => x !== q); hist(r, { what: 'dismissed', title: q.title, by });
  return { dismissed: true };
}
function arm(studioId, hours) {
  const c = cfg(studioId); const h = Math.min(Math.max(Number(hours) || c.settings.armHours, 0.25), 8);
  return saveCfg(studioId, { mode: 'auto', armedUntil: Date.now() + h * 3600_000 });
}
// Operator-requested graphic: queued at the top (or aired now with air:true).
async function manual(studioId, { kind, set, league, hl, fixtureId, air: airNow }, by) {
  let cue;
  const snap = feeds.snapshot(SRC) || {};
  if (kind === 'scores') cue = scoresCue(set === 'results' ? 'results' : set === 'all' ? 'all' : 'live',
    set === 'results' ? (snap.results || []).length : (snap.live || []).length, 70);
  else if (kind === 'table') {
    if (!TABLE_LEAGUES.has(Number(league))) throw new Error('table not served for that league');
    cue = tableCue(Number(league), null, hl, 70);
  } else if (kind === 'result' || kind === 'match') {
    const f = feeds.fixture(SRC, fixtureId); if (!f) throw new Error('fixture not in today\'s feed');
    const ev = { kind: f.finished ? 'full_time' : 'half_time', fixture_id: f.id, league: f.league, status: f.finished ? f.status : 'HT', local: f.local,
      home: f.home, away: f.away, scorers: f.scorers, ts: new Date().toISOString() };
    cue = cueFromEvent(ev);
    if (!f.finished) {   // in-play: a live score card, labelled with the minute, never "HT" unless it is
      cue.url = cue.url.replace('st=HT', `st=${encodeURIComponent(f.status === 'HT' ? 'HT' : (f.elapsed ? f.elapsed + "'" : f.status))}`);
      cue.title = `LIVE — ${f.home.name} ${f.home.goals ?? 0}-${f.away.goals ?? 0} ${f.away.name}`;
    }
  } else throw new Error('kind must be scores|table|result');
  cue = { ...cue, manual: true, priority: Math.max(cue.priority || 0, 70) };
  const q = enqueue(studioId, cue, `requested by ${by}`);
  if (airNow && q) return air(studioId, q, by);
  return { queued: !!q, cue: q };
}

module.exports = { start, state, cfg, saveCfg, take, takeNext, dismiss, arm, pull, manual, DEFAULT_SETTINGS,
  _test: { onEvent, tickStudio, cueFromEvent, rt } };
