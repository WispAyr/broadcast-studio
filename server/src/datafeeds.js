// ──────────────────────────────────────────────────────────────────────────
// External data feeds — outside data that graphics and triggers react to.
//
// Broadcast Studio never calls a third-party data API itself. A feed is a URL
// published by the system that already owns that data (for football: the NAR
// intranet, the one caller of API-Football). This module polls it, keeps the
// latest snapshot, stores its EVENTS durably, and tells subscribers (the
// SideLiners director) about each new event exactly once.
//
// Event cursor: every feed event carries a monotonic `seq`. The cursor is
// persisted, so a BS restart neither replays old goals onto a screen nor
// misses the ones scored while it was down (they arrive flagged `late`, and
// the director decides what's still worth showing).
//
// Health is explicit: a snapshot older than STALE_MS is reported stale, and
// graphics must not present stale scores as live.
// ──────────────────────────────────────────────────────────────────────────
const { db } = require('./db');

const INTRANET = (process.env.SL_FEED_BASE || 'https://intranet.wispayr.online/api/public/sideliners').replace(/\/$/, '');
const SOURCES = {
  sideliners: {
    name: 'SideLiners football (API-Football via NAR intranet)',
    url: INTRANET + '/broadcast',
    tableUrl: id => `${INTRANET}/table/${Number(id)}`,
    // fast while a watched match is on (the intranet says so), slow otherwise
    interval: snap => (snap && snap.engine && snap.engine.window ? 8_000 : 60_000),
  },
};
// Stale = missed about two polls: 25 s on a matchday (8 s polls), 150 s otherwise (60 s polls).
const staleMs = snap => (snap && snap.engine && snap.engine.window ? 25_000 : 150_000);

db.exec(`
  CREATE TABLE IF NOT EXISTS datafeed_cursor (source TEXT PRIMARY KEY, seq INTEGER NOT NULL, updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS datafeed_events (
    source TEXT NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL,
    received_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY (source, seq)
  );
`);

const state = {};           // source → { snapshot, okAt, error, polls, fails }
const listeners = [];       // fn(sourceId, event, { late })

async function getJSON(url, ms = 8000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'user-agent': 'broadcast-studio/datafeeds' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const getCursor = id => { const r = db.prepare('SELECT seq FROM datafeed_cursor WHERE source = ?').get(id); return r ? r.seq : null; };
const setCursor = (id, seq) => db.prepare(`INSERT INTO datafeed_cursor (source, seq, updated_at) VALUES (?,?,datetime('now'))
  ON CONFLICT(source) DO UPDATE SET seq=excluded.seq, updated_at=excluded.updated_at`).run(id, seq);

async function poll(id) {
  const src = SOURCES[id]; const st = state[id] || (state[id] = { snapshot: null, okAt: 0, error: null, polls: 0, fails: 0 });
  st.polls++;
  try {
    const cursor = getCursor(id);
    const snap = await getJSON(cursor == null ? src.url : `${src.url}?since=${cursor}`);
    if (!snap || snap.ok === false) throw new Error((snap && snap.error) || 'bad payload');
    st.snapshot = snap; st.okAt = Date.now(); st.error = null;
    if (cursor == null) { setCursor(id, snap.lastSeq || 0); return; }   // first contact: start at "now"
    if ((snap.lastSeq || 0) < cursor) setCursor(id, snap.lastSeq || 0); // upstream reset its log
    const ins = db.prepare('INSERT OR IGNORE INTO datafeed_events (source, seq, kind, data) VALUES (?,?,?,?)');
    for (const ev of snap.events || []) {
      if (ev.seq <= cursor) continue;
      ins.run(id, ev.seq, ev.kind, JSON.stringify(ev));
      setCursor(id, ev.seq);
      const late = Date.now() - Date.parse(ev.ts) > 120_000;
      for (const fn of listeners) { try { fn(id, ev, { late }); } catch (e) { console.error('[datafeeds] listener:', e.message); } }
    }
  } catch (e) {
    st.fails++; st.error = e.message;
  }
}

const timers = {};
function loop(id) {
  poll(id).finally(() => {
    timers[id] = setTimeout(() => loop(id), SOURCES[id].interval(state[id] && state[id].snapshot));
    timers[id].unref?.();
  });
}
function start() {
  for (const id of Object.keys(SOURCES)) if (!timers[id]) loop(id);
  console.log('[datafeeds] polling', Object.keys(SOURCES).join(', '));
}

function health(id) {
  const st = state[id] || {}; const snap = st.snapshot;
  const age = st.okAt ? Date.now() - st.okAt : null, lim = staleMs(snap);
  return {
    id, name: SOURCES[id].name, ok: !!st.okAt && age < lim, stale: !st.okAt || age >= lim,
    ageSec: age == null ? null : Math.round(age / 1000), error: st.error, polls: st.polls || 0, fails: st.fails || 0,
    cursor: getCursor(id), upstream: snap ? { generated: snap.generated, engine: snap.engine, quota: snap.quota } : null,
    counts: snap ? { live: (snap.live || []).length, results: (snap.results || []).length, upcoming: (snap.upcoming || []).length } : null,
  };
}
function snapshot(id) { return (state[id] && state[id].snapshot) || null; }

// Public, graphics-facing view: facts only, plus an honest staleness flag.
function publicView(id) {
  const h = health(id); const s = snapshot(id) || {};
  return { ok: !!s.generated, generated: s.generated || null, stale: h.stale, ageSec: h.ageSec, day: s.day || null,
    live: s.live || [], results: s.results || [], upcoming: s.upcoming || [], off: s.off || [] };
}
function fixture(id, fixtureId) {
  const s = snapshot(id) || {}; const n = Number(fixtureId);
  return [...(s.live || []), ...(s.results || []), ...(s.upcoming || []), ...(s.off || [])].find(f => f.id === n) || null;
}
function recentEvents(id, limit = 50) {
  return db.prepare('SELECT seq, kind, data, received_at FROM datafeed_events WHERE source = ? ORDER BY seq DESC LIMIT ?')
    .all(id, Math.min(Number(limit) || 50, 500)).map(r => ({ ...JSON.parse(r.data), received_at: r.received_at }));
}

// League tables go through a short in-memory cache: the intranet owns the
// upstream TTL, this only stops a table graphic being re-pulled per screen.
const tcache = new Map();
async function table(id, leagueId) {
  const src = SOURCES[id]; if (!src || !src.tableUrl) return null;
  const k = `${id}:${Number(leagueId)}`; const hit = tcache.get(k);
  if (hit && Date.now() - hit.at < 120_000) return hit.data;
  const data = await getJSON(src.tableUrl(leagueId));
  tcache.set(k, { at: Date.now(), data });
  return data;
}

module.exports = {
  start, poll, health, snapshot, publicView, fixture, table, recentEvents,
  sources: () => Object.keys(SOURCES),
  on: fn => listeners.push(fn),
};
