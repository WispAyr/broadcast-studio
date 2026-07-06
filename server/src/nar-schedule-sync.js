// Auto-populate the NAR card-wall schedule from the station's own ProRadio feed
// (nowayrshireradio.co.uk), so the daypart schedule always reflects the REAL,
// staff-maintained lineup instead of a hand-edited seed. The seed drifted badly
// (e.g. a 13:00 "Afternoons — Danielle McLaughlan" card for a presenter/show no
// longer on air), which is exactly what this removes.
//
// ProRadio only exposes TODAY, so we sync the current day-of-week. Each show is
// matched to an existing branded "NAR TV Cards" layout by (normalised) name;
// unmatched shows fall back to a generic LIVE schedule card (an nar_schedule
// module), which reads ProRadio directly and is therefore always correct.
//
// The card-wall resolves its slot live from card_wall_schedule on every tick
// (see card-wall.js scheduledSlot), so writing these rows takes effect with no
// server restart. Run standalone (cron) or import syncOnce().

const { db } = require('./db');
const { v4: uuidv4 } = require('uuid');

const PRORADIO = 'https://www.nowayrshireradio.co.uk/wp-json/proradio/v1/schedule-today-full';
const PROJECT = 'NAR TV Cards';
const GENERIC_NAME = 'Card — Live Schedule (auto)';

// Decode the WordPress/ProRadio HTML entities that appear in show names.
function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalise a show/card name for fuzzy matching: drop a leading "Card —",
// lowercase, and reduce to space-separated alphanumeric tokens (so "&", "'",
// em-dashes and presenter suffixes don't block a match).
function norm(s) {
  return decodeEntities(s)
    .toLowerCase()
    .replace(/^card\s*[—–-]\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchSchedule() {
  const r = await fetch(PRORADIO, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`proradio ${r.status}`);
  const arr = await r.json();
  return (Array.isArray(arr) ? arr : [])
    .map((s) => ({
      name: decodeEntities(s.name),
      start: String(s.broadcaststart || '').slice(11, 16),      // "HH:MM"
      dateISO: String(s.broadcaststart || '').slice(0, 10),      // "YYYY-MM-DD"
    }))
    .filter((s) => s.name && /^\d\d:\d\d$/.test(s.start));
}

// Ensure the generic live-schedule fallback card exists; return its layout id.
function ensureGenericCard(studioId) {
  const existing = db.prepare(
    'SELECT id FROM layouts WHERE studio_id = ? AND project = ? AND name = ?'
  ).get(studioId, PROJECT, GENERIC_NAME);
  if (existing) return existing.id;
  const id = uuidv4();
  const modules = JSON.stringify([{
    type: 'nar_schedule', x: 0, y: 0, w: 12, h: 8,
    config: { accentColor: '#F7941D', title: 'NOW AYRSHIRE RADIO', showThumbnails: true, showGenres: true, maxUpcoming: 5 },
  }]);
  db.prepare(
    'INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, project, public_safe) VALUES (?, ?, ?, 12, 8, ?, ?, 1)'
  ).run(id, studioId, GENERIC_NAME, modules, PROJECT);
  return id;
}

function cardIndex(studioId) {
  return db.prepare('SELECT id, name FROM layouts WHERE studio_id = ? AND project = ?')
    .all(studioId, PROJECT)
    .filter((c) => c.name !== GENERIC_NAME)
    .map((c) => ({ id: c.id, n: norm(c.name) }));
}

// Match a ProRadio show to a branded card: exact normalised name, else a card
// whose name starts with the show name (branded cards carry a "— presenter"
// suffix the feed doesn't). Returns a layout id or null.
function matchCard(showName, cards) {
  const q = norm(showName);
  if (!q) return null;
  const hit = cards.find((c) => c.n === q)
    || cards.find((c) => c.n.startsWith(q + ' '));
  return hit ? hit.id : null;
}

// Calendar weekday (0=Sun..6=Sat) of the feed's own date — matches the
// card_wall_schedule.dow convention and avoids server-timezone edge cases.
function dowOf(dateISO) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date().getDay() : d.getUTCDay();
}

async function syncOnce() {
  const st = db.prepare("SELECT id FROM studios WHERE slug = 'now-ayrshire'").get();
  if (!st) { console.warn('[nar-schedule-sync] no now-ayrshire studio'); return { ok: false }; }

  const shows = await fetchSchedule();
  if (!shows.length) { console.warn('[nar-schedule-sync] empty ProRadio schedule; leaving DB unchanged'); return { ok: false }; }

  const cards = cardIndex(st.id);
  const generic = ensureGenericCard(st.id);
  const dow = dowOf(shows[0].dateISO);

  const del = db.prepare('DELETE FROM card_wall_schedule WHERE studio_id = ? AND dow = ?');
  const ins = db.prepare(
    'INSERT INTO card_wall_schedule (id, studio_id, dow, start, layout_id, label, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  let matched = 0;
  db.transaction(() => {
    del.run(st.id, dow);
    shows.forEach((s, i) => {
      const cardId = matchCard(s.name, cards);
      if (cardId) matched++;
      ins.run(uuidv4(), st.id, dow, s.start, cardId || generic, s.name, i);
    });
  })();

  console.log(`[nar-schedule-sync] dow=${dow} synced ${shows.length} shows (${matched} branded, ${shows.length - matched} live-fallback) from ProRadio`);
  return { ok: true, dow, count: shows.length, matched };
}

module.exports = { syncOnce };

// Run standalone: `node src/nar-schedule-sync.js`
if (require.main === module) {
  syncOnce()
    .then((r) => process.exit(r && r.ok ? 0 : 1))
    .catch((e) => { console.error('[nar-schedule-sync] failed:', e.message); process.exit(1); });
}
