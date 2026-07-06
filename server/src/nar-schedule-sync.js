// Auto-populate the NAR card-wall schedule from the station's own ProRadio feed
// (nowayrshireradio.co.uk), so the daypart schedule always reflects the REAL,
// staff-maintained lineup instead of a hand-edited seed. The seed drifted badly
// (e.g. a 13:00 "Afternoons — Danielle McLaughlan" card for a show no longer on
// air), which is exactly what this removes — across ALL SEVEN days.
//
// Source: the ProRadio weekly schedule endpoint returns 7 day posts (Monday..
// Sunday), each with slots of { show_id, show_time, show_time_end }. Show names
// are referenced by id, resolved in one batch via the WP REST shows endpoint.
// Each resolved show is matched to an existing branded "NAR TV Cards" layout by
// normalised name; unmatched shows fall back to a generic LIVE schedule card
// (an nar_schedule module), which is always correct.
//
// The card-wall resolves its slot live from card_wall_schedule on every tick
// (see card-wall.js scheduledSlot), so writing these rows takes effect with no
// server restart. Run standalone (cron) or import syncOnce().

const { db } = require('./db');
const { v4: uuidv4 } = require('uuid');

const WP = 'https://www.nowayrshireradio.co.uk/wp-json';
const WEEK_URL = `${WP}/proradio/v1/schedule`;
const SHOWS_URL = `${WP}/wp/v2/shows`;
const PROJECT = 'NAR TV Cards';
const GENERIC_NAME = 'Card — Live Schedule (auto)';

// post_name (day slug) -> card_wall_schedule.dow (0=Sun..6=Sat).
const DAY_DOW = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();
}
function norm(s) {
  return decodeEntities(s).toLowerCase().replace(/^card\s*[—–-]\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
function unwrapId(v) { return Array.isArray(v) ? v[0] : v; }

// Fetch the weekly schedule -> [{ dow, slots:[{start, id}] }].
async function fetchWeek() {
  const d = await getJson(WEEK_URL);
  const posts = Array.isArray(d && d.posts) ? d.posts : [];
  const days = [];
  for (const p of posts) {
    const dow = DAY_DOW[String(p.post_name || '').toLowerCase()];
    if (dow === undefined) continue;
    const slots = (p.shows || [])
      .map((s) => ({ start: String(s.show_time || '').slice(0, 5), id: unwrapId(s.show_id) }))
      .filter((s) => /^\d\d:\d\d$/.test(s.start) && s.id);
    days.push({ dow, slots });
  }
  return days;
}

// Batch-resolve show ids -> { id: name } via WP REST.
async function resolveNames(ids) {
  const uniq = [...new Set(ids.map(String))];
  const map = {};
  for (let i = 0; i < uniq.length; i += 80) {
    const batch = uniq.slice(i, i + 80);
    const arr = await getJson(`${SHOWS_URL}?include=${batch.join(',')}&per_page=100&_fields=id,title`);
    for (const s of (Array.isArray(arr) ? arr : [])) {
      const t = s.title && (s.title.rendered !== undefined ? s.title.rendered : s.title);
      map[String(s.id)] = decodeEntities(t);
    }
  }
  return map;
}

function ensureGenericCard(studioId) {
  const existing = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND project = ? AND name = ?')
    .get(studioId, PROJECT, GENERIC_NAME);
  if (existing) return existing.id;
  const id = uuidv4();
  const modules = JSON.stringify([{
    type: 'nar_schedule', x: 0, y: 0, w: 12, h: 8,
    config: { accentColor: '#F7941D', title: 'NOW AYRSHIRE RADIO', showThumbnails: true, showGenres: true, maxUpcoming: 5 },
  }]);
  db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, project, public_safe) VALUES (?, ?, ?, 12, 8, ?, ?, 1)')
    .run(id, studioId, GENERIC_NAME, modules, PROJECT);
  return id;
}
function cardIndex(studioId) {
  return db.prepare('SELECT id, name FROM layouts WHERE studio_id = ? AND project = ?')
    .all(studioId, PROJECT)
    .filter((c) => c.name !== GENERIC_NAME)
    .map((c) => ({ id: c.id, n: norm(c.name) }));
}
function matchCard(showName, cards) {
  const q = norm(showName);
  if (!q) return null;
  const hit = cards.find((c) => c.n === q) || cards.find((c) => c.n.startsWith(q + ' '));
  return hit ? hit.id : null;
}

async function syncOnce() {
  const st = db.prepare("SELECT id FROM studios WHERE slug = 'now-ayrshire'").get();
  if (!st) { console.warn('[nar-schedule-sync] no now-ayrshire studio'); return { ok: false }; }

  const week = await fetchWeek();
  const totalSlots = week.reduce((n, d) => n + d.slots.length, 0);
  if (!totalSlots) { console.warn('[nar-schedule-sync] empty weekly schedule; leaving DB unchanged'); return { ok: false }; }

  const names = await resolveNames(week.flatMap((d) => d.slots.map((s) => s.id)));
  const cards = cardIndex(st.id);
  const generic = ensureGenericCard(st.id);

  const del = db.prepare('DELETE FROM card_wall_schedule WHERE studio_id = ? AND dow = ?');
  const ins = db.prepare('INSERT INTO card_wall_schedule (id, studio_id, dow, start, layout_id, label, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let matched = 0, written = 0, days = 0;
  db.transaction(() => {
    for (const day of week) {
      if (!day.slots.length) continue;                 // don't wipe a day we couldn't read
      days++;
      del.run(st.id, day.dow);
      day.slots.forEach((slot, i) => {
        const label = names[String(slot.id)] || 'On Air';
        const cardId = matchCard(label, cards);
        if (cardId) matched++;
        ins.run(uuidv4(), st.id, day.dow, slot.start, cardId || generic, label, i);
        written++;
      });
    }
  })();

  console.log(`[nar-schedule-sync] synced ${days} days, ${written} slots (${matched} branded, ${written - matched} live-fallback) from ProRadio weekly`);
  return { ok: true, days, written, matched };
}

module.exports = { syncOnce };

if (require.main === module) {
  syncOnce()
    .then((r) => process.exit(r && r.ok ? 0 : 1))
    .catch((e) => { console.error('[nar-schedule-sync] failed:', e.message); process.exit(1); });
}
