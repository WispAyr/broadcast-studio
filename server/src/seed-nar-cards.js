/**
 * Now Ayrshire Radio — TV Cards + daypart card wall
 * Run: node server/src/seed-nar-cards.js
 *
 * Idempotent. Creates one full-screen image layout per show card (project
 * "NAR TV Cards"), seeds the weekly daypart schedule that drives the main
 * screen wall, points the card wall at the "Studio Wall" screen, and seeds
 * console / Stream Deck override buttons (action_type card_wall_take/resume).
 *
 * Expects the 21 card PNGs to already be in the studio uploads dir:
 *   server/data/uploads/<studio_id>/tvcard-NN-slug.png
 * (these are runtime assets, deployed separately — see DEPLOY notes).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { v4: uuidv4 } = require('uuid');
// Require ./db (runs all schema migrations incl. layouts.project) and
// ./card-wall (creates the card_wall + card_wall_schedule tables) so this
// seed works against a fresh DB. Reuse the shared handle — one connection.
const { db } = require('./db');
require('./card-wall');

const studio = db.prepare("SELECT * FROM studios WHERE slug = 'now-ayrshire'").get();
if (!studio) { console.error('NAR studio not found — run seed-nar.js first'); process.exit(1); }
const studioId = studio.id;

// Resolve the main screen wall by name — live calls it "NAR — Main Wall",
// the dev seed calls it "Studio Wall". Prefer a "main wall", then any "wall",
// then the legacy name, and only fall back to screen 1 as a last resort.
const pick = (sql) => db.prepare(sql).get(studioId);
const wall =
     pick("SELECT * FROM screens WHERE studio_id = ? AND lower(name) LIKE '%main wall%'")
  || pick("SELECT * FROM screens WHERE studio_id = ? AND lower(name) LIKE '%wall%'")
  || pick("SELECT * FROM screens WHERE studio_id = ? AND name = 'Studio Wall'")
  || pick("SELECT * FROM screens WHERE studio_id = ? ORDER BY screen_number LIMIT 1");
if (!wall) { console.error('No screen found for NAR studio'); process.exit(1); }
console.log(`Studio ${studioId} · wall screen "${wall.name}" (${wall.id})`);

// ── Card manifest ──────────────────────────────────────────────────────────
// key = file slug (matches tvcard-NN-<key>.png). `kind`: 'show' cards go in
// the daypart rotation + console; 'promo'/'contact' are manual-only.
const CARDS = [
  { n: 1,  key: 'ali-michael',           name: 'Ali & Michael in the Morning', slot: 'Weekdays 6am',  sponsor: 'The Coo Shed',           kind: 'show' },
  { n: 2,  key: 'mid-mornings',          name: 'Mid-Mornings — Liam Dolan',     slot: 'Weekdays 10am', sponsor: "Ayrshire Chip 'n' Logs", kind: 'show' },
  { n: 3,  key: 'afternoons',            name: 'Afternoons — Danielle McLaughlan', slot: 'Weekdays 1pm', sponsor: 'Gemmells Van Sales',  kind: 'show' },
  { n: 4,  key: 'drivetime',             name: 'Drivetime — Billy & Bex',       slot: 'Weekdays 4pm',  sponsor: 'MKM Kilmarnock',         kind: 'show' },
  { n: 5,  key: 'evening-vibe',          name: 'Evening Vibe — Amanda Jean',    slot: 'Mon–Thu 7pm',   sponsor: null,                     kind: 'show' },
  { n: 6,  key: 'late-show',             name: 'The Late Show — Billy Sturgeon', slot: 'Mon–Thu 10pm', sponsor: 'The Ironing Store',      kind: 'show' },
  { n: 7,  key: 'club-mix',              name: 'The Club Mix — Michael Smith',  slot: 'Fri 7pm',       sponsor: null,                     kind: 'show' },
  { n: 8,  key: 'after-after-party',     name: 'The after, after Party — DJ Mash', slot: 'Sat midnight', sponsor: null,                  kind: 'show' },
  { n: 9,  key: 'weekend-breakfast',     name: 'Weekend Breakfast',             slot: 'Weekends 6am',  sponsor: null,                     kind: 'show' },
  { n: 10, key: 'sideliners',            name: 'Sideliners — Scott Watson',     slot: 'Sport',         sponsor: 'Kilmarnock FC',          kind: 'show' },
  { n: 11, key: 'saturday-afternoons',   name: 'Saturday Afternoons — Paul Harper', slot: 'Sat 2pm',   sponsor: 'Ayrshire Climbing Centre', kind: 'show' },
  { n: 12, key: 'now-dance',             name: 'Now Dance — Colin McArdle',     slot: 'Sat 6pm',       sponsor: null,                     kind: 'show' },
  { n: 13, key: 'josh-harry-house-party', name: "Josh & Harry's House Party",   slot: 'Fri 6pm',       sponsor: null,                     kind: 'show' },
  { n: 14, key: 'after-party',           name: 'The After Party — Elliot Boyce', slot: 'Sat 10pm',     sponsor: null,                     kind: 'show' },
  { n: 15, key: 'ayrshire-insights',     name: 'Ayrshire Insights — Elliot Boyce', slot: 'Sun 10am',   sponsor: 'Billy Bowie',            kind: 'show' },
  { n: 16, key: 'sunday-afternoon',      name: 'Sunday Afternoon — Chris Kinloch', slot: 'Sun 1pm',    sponsor: null,                     kind: 'show' },
  { n: 17, key: 'sunday-service',        name: 'Sunday Service — Dominik Diamond', slot: 'Sun 4pm',    sponsor: null,                     kind: 'show' },
  { n: 18, key: 'now-country',           name: 'Now Country — David Cannell',   slot: 'Sun 7pm',       sponsor: null,                     kind: 'show' },
  { n: 19, key: 'contact',               name: 'Contact — Jam Dodger / WhatsApp', slot: 'Anytime',     sponsor: null,                     kind: 'contact' },
  { n: 20, key: 'entry-form',            name: "£500 Friday's — Postal Entry Form", slot: 'Promo',     sponsor: null,                     kind: 'promo' },
  { n: 21, key: 'school-funding',        name: 'School Funding — Entries Open', slot: 'Promo',         sponsor: null,                     kind: 'promo' },
  { n: 22, key: 'overnight',             name: 'Through the Night',             slot: 'Overnight',     sponsor: null,                     kind: 'overnight' },
];

const fileFor = (c) => `tvcard-${String(c.n).padStart(2, '0')}-${c.key}.png`;
const urlFor  = (c) => `/uploads/${studioId}/${fileFor(c)}`;
const layoutName = (c) => `Card — ${c.name}`;

// ── 1. Layouts (one full-screen image module each) ──────────────────────────
const PROJECT = 'NAR TV Cards';
// Repoint any screen currently showing an old card layout to NULL first, or the
// DELETE trips the screens.current_layout_id foreign key (re-seed idempotency).
const oldCardIds = db.prepare("SELECT id FROM layouts WHERE studio_id = ? AND project = ?").all(studioId, PROJECT).map(r => r.id);
if (oldCardIds.length) {
  const ph = oldCardIds.map(() => '?').join(',');
  db.prepare(`UPDATE screens SET current_layout_id = NULL WHERE current_layout_id IN (${ph})`).run(...oldCardIds);
}
db.prepare("DELETE FROM layouts WHERE studio_id = ? AND project = ?").run(studioId, PROJECT);

const insLayout = db.prepare(
  "INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, project, public_safe) VALUES (?, ?, ?, 12, 8, ?, ?, 1)"
);
const layoutIdByKey = {};
for (const c of CARDS) {
  const id = uuidv4();
  layoutIdByKey[c.key] = id;
  const modules = [{
    type: 'image', x: 0, y: 0, w: 12, h: 8,
    config: { src: urlFor(c), fit: 'cover', background: '#000000', alt: c.name },
  }];
  insLayout.run(id, studioId, layoutName(c), JSON.stringify(modules), PROJECT);
}
console.log(`Seeded ${CARDS.length} card layouts (project "${PROJECT}")`);

// ── 2. Weekly daypart schedule ──────────────────────────────────────────────
// dow: 0=Sun .. 6=Sat (JS getDay). Times are slot starts; a slot runs until
// the next slot. Derived verbatim from the slot text printed on each card.
const lid = (key) => layoutIdByKey[key];
const WEEKDAYS = [1, 2, 3, 4]; // Mon–Thu (Fri differs in the evening)
const schedule = [];
const add = (dow, start, key) => schedule.push({ dow, start, layout_id: lid(key), label: CARDS.find(c => c.key === key).name });

for (const d of WEEKDAYS) {
  add(d, '06:00', 'ali-michael');
  add(d, '10:00', 'mid-mornings');
  add(d, '13:00', 'afternoons');
  add(d, '16:00', 'drivetime');
  add(d, '19:00', 'evening-vibe');
  add(d, '22:00', 'late-show');
}
// Friday (5)
add(5, '06:00', 'ali-michael');
add(5, '10:00', 'mid-mornings');
add(5, '13:00', 'afternoons');
add(5, '16:00', 'drivetime');
add(5, '18:00', 'josh-harry-house-party');
add(5, '19:00', 'club-mix');
// Saturday (6)
add(6, '00:00', 'after-after-party');   // "Saturday's from Midnight"
add(6, '06:00', 'weekend-breakfast');
add(6, '14:00', 'saturday-afternoons');
add(6, '18:00', 'now-dance');
add(6, '22:00', 'after-party');
// Sunday (0)
add(0, '06:00', 'weekend-breakfast');
add(0, '10:00', 'ayrshire-insights');
add(0, '13:00', 'sunday-afternoon');
add(0, '16:00', 'sunday-service');
add(0, '19:00', 'now-country');
// Overnight ident — fills the small hours so the wall doesn't sit on a stale
// show card all night. 01:00 every night except Saturday, where "The after,
// after Party" (Sat 00:00) gets until 02:00 first.
for (const d of [0, 1, 2, 3, 4, 5]) add(d, '01:00', 'overnight');
add(6, '02:00', 'overnight');

db.prepare("DELETE FROM card_wall_schedule WHERE studio_id = ?").run(studioId);
const insSlot = db.prepare(
  "INSERT INTO card_wall_schedule (id, studio_id, dow, start, layout_id, label, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
schedule.forEach((s, i) => insSlot.run(uuidv4(), studioId, s.dow, s.start, s.layout_id, s.label, i));
console.log(`Seeded ${schedule.length} daypart slots`);

// ── 3. Card wall state — point it at the wall screen, enabled ────────────────
db.prepare(`INSERT INTO card_wall (studio_id, screen_id, enabled, updated_at)
  VALUES (?, ?, 1, datetime('now'))
  ON CONFLICT(studio_id) DO UPDATE SET screen_id=excluded.screen_id, enabled=1, updated_at=datetime('now')`)
  .run(studioId, wall.id);
console.log(`Card wall enabled → screen "${wall.name}"`);

// ── 4. Console / Stream Deck override buttons ────────────────────────────────
// One "take this card" button per card + a "Resume Daypart" button. These give
// the presenter manual override from the /console touch UI and a Stream Deck.
db.prepare("DELETE FROM console_buttons WHERE studio_id = ? AND action_type IN ('card_wall_take','card_wall_resume')").run(studioId);
const NAVY = '#1E2A35', ORANGE = '#F7941D', GREEN = '#16a34a', SLATE = '#475569';
let order = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studioId)?.m ?? -1;
const insBtn = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`);

insBtn.run(uuidv4(), studioId, 'Resume Daypart', 'Auto card by time', '🔄', GREEN, 'card_wall_resume', '{}', ++order);
for (const c of CARDS) {
  const sub = c.kind === 'show' ? c.slot
    : c.kind === 'contact' ? 'Contact card'
    : c.kind === 'overnight' ? 'Overnight ident'
    : 'Promo card';
  // Short label (show name without the presenter suffix) + the card art as the
  // button icon — the console renders URL icons as full-tile artwork.
  const label = c.name.split(' — ')[0];
  insBtn.run(uuidv4(), studioId, label, sub, urlFor(c),
    c.kind === 'show' ? NAVY : SLATE, 'card_wall_take',
    JSON.stringify({ layout_id: layoutIdByKey[c.key] }), ++order);
}
console.log(`Seeded ${CARDS.length + 1} console override buttons`);

console.log('\n✅ NAR TV Cards + daypart wall seeded.');
console.log(`   Wall screen: ${wall.name} (${wall.id})`);
console.log('   Manual override: /console buttons or Stream Deck (card_wall_take / card_wall_resume)');
console.log('   API: GET /api/card-wall · POST /api/card-wall/override|resume · PUT /api/card-wall/schedule');
console.log('\n⚠  Ensure the 21 PNGs are in server/data/uploads/' + studioId + '/ (tvcard-NN-slug.png)');

db.close();
