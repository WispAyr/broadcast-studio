/**
 * Now Ayrshire Radio — TV Cards refresh (2026-07, new "Ayrshire radio" brand set)
 * Run: node server/src/refresh-nar-cards-2026.js
 *
 * Replaces the June 2026 card set with the 16 new brand cards. All mutations
 * run in ONE better-sqlite3 transaction so the live card-wall tick only ever
 * sees the fully-old or fully-new state — the Main Wall never blanks. After
 * commit it forces a card-wall repaint via the running server's HTTP API.
 *
 * Decisions (confirmed with operator 2026-07-29):
 *  - 15 show cards + 1 station ident swapped to new artwork.
 *  - 3 shows with no new card removed entirely (The Late Show, Weekend
 *    Breakfast, Now Country); their slots become the station ident.
 *  - 3 utility cards kept (Contact, £500 Fridays entry form, School Funding)
 *    on their existing artwork — manual-only, still selectable.
 *  - Every card layout intranet_preset=1 so it appears in the NAR intranet
 *    presenter picker (Screens tab).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const cardWall = require('./card-wall'); // creates card_wall tables, exports scheduledSlot

const studio = db.prepare("SELECT * FROM studios WHERE slug = 'now-ayrshire'").get();
if (!studio) { console.error('NAR studio not found'); process.exit(1); }
const studioId = studio.id;

const pick = (sql) => db.prepare(sql).get(studioId);
const wall =
     pick("SELECT * FROM screens WHERE studio_id = ? AND lower(name) LIKE '%main wall%'")
  || pick("SELECT * FROM screens WHERE studio_id = ? AND lower(name) LIKE '%wall%'")
  || pick("SELECT * FROM screens WHERE studio_id = ? ORDER BY screen_number LIMIT 1");
if (!wall) { console.error('No wall screen for NAR'); process.exit(1); }
console.log(`Studio ${studioId} · wall "${wall.name}" (${wall.id})`);

// ── New card manifest ───────────────────────────────────────────────────────
// file = filename in the studio uploads dir. kind: 'show' = daypart + console;
// 'ident' = overnight/gap filler; 'contact'/'promo' = manual-only utility.
const CARDS = [
  { key: 'a-m',                 file: 'tvcard-a-m.jpg',                 name: 'Ali & Michael in the Morning',      kind: 'show' },
  { key: 'liam',                file: 'tvcard-liam.jpg',                name: 'Mid-Mornings — Liam Dolan',          kind: 'show' },
  { key: 'fraser',              file: 'tvcard-fraser.jpg',              name: "Fraser Thomson's All Music Lunch",   kind: 'show' },
  { key: 'billy-bex',           file: 'tvcard-billy-bex.jpg',           name: 'Drivetime — Billy & Bex',            kind: 'show' },
  { key: 'amanda-jean',         file: 'tvcard-amanda-jean.jpg',         name: 'Evening Vibe — Amanda Jean',         kind: 'show' },
  { key: 'house-party',         file: 'tvcard-house-party.jpg',         name: "Josh & Harry's House Party",         kind: 'show' },
  { key: 'club-mix',            file: 'tvcard-club-mix.jpg',            name: 'The Club Mix — Michael Smith',       kind: 'show' },
  { key: 'mash',                file: 'tvcard-mash.jpg',                name: 'Late Night House Grooves — DJ Mash', kind: 'show' },
  { key: 'saturday-afternoons', file: 'tvcard-saturday-afternoons.jpg', name: 'Saturday Afternoons — Paul Harper',  kind: 'show' },
  { key: 'now-dance',           file: 'tvcard-now-dance.jpg',           name: 'Now Dance — Colin McArdle',          kind: 'show' },
  { key: 'after-party',         file: 'tvcard-after-party.jpg',         name: 'The After Party — Elliot Boyce',     kind: 'show' },
  { key: 'ayrshire-insights',   file: 'tvcard-ayrshire-insights.jpg',   name: 'Ayrshire Insights — Elliot Boyce',   kind: 'show' },
  { key: 'sunday-afternoon',    file: 'tvcard-sunday-afternoon.jpg',    name: 'Sunday Afternoon — Chris Kinloch',   kind: 'show' },
  { key: 'sunday-service',      file: 'tvcard-sunday-service.jpg',      name: 'Sunday Service — Dominik Diamond',   kind: 'show' },
  { key: 'sideliners',          file: 'tvcard-sideliners.jpg',          name: 'Sideliners — Scott Watson',          kind: 'show' }, // sport, manual-only (no daypart slot)
  { key: 'ident',               file: 'tvcard-ident.jpg',               name: 'Now Ayrshire Radio — Ident',         kind: 'ident' },
  // Utility — kept on existing artwork, manual-only.
  { key: 'contact',        file: 'tvcard-19-contact.png',       name: 'Contact — Jam Dodger / WhatsApp',    kind: 'contact' },
  { key: 'entry-form',     file: 'tvcard-20-entry-form.png',    name: "£500 Friday's — Postal Entry Form",  kind: 'promo' },
  { key: 'school-funding', file: 'tvcard-21-school-funding.png', name: 'School Funding — Entries Open',       kind: 'promo' },
];

const urlFor = (c) => `/uploads/${studioId}/${c.file}`;
const layoutName = (c) => `Card — ${c.name}`;
const PROJECT = 'NAR TV Cards';
const layoutIdByKey = {};

// ── Daypart schedule (Europe/London slot starts) ────────────────────────────
// Late Show, Weekend Breakfast and Now Country removed → those windows show the
// station ident. Sideliners stays manual-only (sport, no fixed slot).
// {dow(0=Sun..6=Sat), start 'HH:MM', card key}. Resolved to layout_ids inside
// the transaction, once the new layouts exist.
const lid = (key) => layoutIdByKey[key];
const SLOTS = [
  // Mon–Thu
  ...[1, 2, 3, 4].flatMap(d => [
    [d, '06:00', 'a-m'], [d, '10:00', 'liam'], [d, '13:00', 'fraser'],
    [d, '16:00', 'billy-bex'], [d, '19:00', 'amanda-jean'],
    [d, '22:00', 'ident'],               // was The Late Show → ident (also covers small hours)
  ]),
  // Friday
  [5, '06:00', 'a-m'], [5, '10:00', 'liam'], [5, '13:00', 'fraser'],
  [5, '16:00', 'billy-bex'], [5, '18:00', 'house-party'], [5, '19:00', 'club-mix'],
  // Saturday
  [6, '00:00', 'mash'],                   // Saturdays from midnight
  [6, '02:00', 'ident'],                  // was Weekend Breakfast window → ident until Sat afternoon
  [6, '14:00', 'saturday-afternoons'], [6, '18:00', 'now-dance'], [6, '22:00', 'after-party'],
  // Sunday
  [0, '01:00', 'ident'],                  // small hours + former Weekend Breakfast window
  [0, '10:00', 'ayrshire-insights'], [0, '13:00', 'sunday-afternoon'],
  [0, '16:00', 'sunday-service'],
  [0, '19:00', 'ident'],                  // was Now Country → ident
];

// ── Transactional swap ──────────────────────────────────────────────────────
const NAVY = '#1E2A35', SLATE = '#475569', GREEN = '#16a34a';

const run = db.transaction(() => {
  // 1. Drop FK refs then delete the old card set.
  const oldIds = db.prepare("SELECT id FROM layouts WHERE studio_id = ? AND project = ?").all(studioId, PROJECT).map(r => r.id);
  if (oldIds.length) {
    const ph = oldIds.map(() => '?').join(',');
    db.prepare(`UPDATE screens SET current_layout_id = NULL WHERE current_layout_id IN (${ph})`).run(...oldIds);
    db.prepare(`DELETE FROM layouts WHERE id IN (${ph})`).run(...oldIds);
  }

  // 2. Insert new card layouts (intranet_preset=1 → visible in intranet picker).
  const insLayout = db.prepare(
    "INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, project, public_safe, intranet_preset) VALUES (?, ?, ?, 12, 8, ?, ?, 1, 1)"
  );
  for (const c of CARDS) {
    const id = uuidv4();
    layoutIdByKey[c.key] = id;
    const modules = [{ type: 'image', x: 0, y: 0, w: 12, h: 8,
      config: { src: urlFor(c), fit: 'cover', background: '#000000', alt: c.name } }];
    insLayout.run(id, studioId, layoutName(c), JSON.stringify(modules), PROJECT);
  }

  // 3. Rebuild the daypart schedule (resolve keys → the layout_ids just made).
  const nameByKey = (key) => CARDS.find(c => c.key === key).name;
  db.prepare("DELETE FROM card_wall_schedule WHERE studio_id = ?").run(studioId);
  const insSlot = db.prepare("INSERT INTO card_wall_schedule (id, studio_id, dow, start, layout_id, label, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
  SLOTS.forEach(([dow, start, key], i) => insSlot.run(uuidv4(), studioId, dow, start, lid(key), nameByKey(key), i));

  // 4. Card wall enabled → wall screen; drop any stale override.
  db.prepare(`INSERT INTO card_wall (studio_id, screen_id, enabled, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(studio_id) DO UPDATE SET screen_id=excluded.screen_id, enabled=1,
      override_layout_id=NULL, override_slot_key=NULL, override_until=NULL, updated_at=datetime('now')`)
    .run(studioId, wall.id);

  // 5. Point the wall at the card that is on-air right now, so state is coherent
  //    and the live tick emits the new layout immediately.
  const now = cardWall.scheduledSlot(studioId);
  if (now) db.prepare("UPDATE screens SET current_layout_id = ? WHERE id = ?").run(now.layout_id, wall.id);

  // 6. Rebuild console / Stream Deck override buttons.
  db.prepare("DELETE FROM console_buttons WHERE studio_id = ? AND action_type IN ('card_wall_take','card_wall_resume')").run(studioId);
  let order = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studioId)?.m ?? -1;
  const insBtn = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`);
  insBtn.run(uuidv4(), studioId, 'Resume Daypart', 'Auto card by time', '🔄', GREEN, 'card_wall_resume', '{}', ++order);
  for (const c of CARDS) {
    const sub = c.kind === 'show' ? 'Show card' : c.kind === 'ident' ? 'Station ident'
      : c.kind === 'contact' ? 'Contact card' : 'Promo card';
    const label = c.name.split(' — ')[0];
    insBtn.run(uuidv4(), studioId, label, sub, urlFor(c),
      c.kind === 'show' ? NAVY : SLATE, 'card_wall_take',
      JSON.stringify({ layout_id: layoutIdByKey[c.key] }), ++order);
  }

  return { deleted: oldIds.length, layouts: CARDS.length, slots: SLOTS.length, nowLayout: (cardWall.scheduledSlot(studioId) || {}).layout_id };
});

const result = run();
console.log(`Swapped: deleted ${result.deleted} old layouts, inserted ${result.layouts} new, ${result.slots} daypart slots.`);
console.log('On-air now →', db.prepare('SELECT name FROM layouts WHERE id = ?').get(result.nowLayout)?.name);

// ── Force an immediate repaint on the running server ────────────────────────
function forceResume() {
  return new Promise((resolve) => {
    const token = jwt.sign({ id: 'card-refresh', role: 'admin', studio_id: studioId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const body = JSON.stringify({ studio_id: studioId });
    const req = http.request({ host: '127.0.0.1', port: process.env.PORT || 3945, path: '/api/card-wall/resume', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Bearer ${token}` } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(`resume → HTTP ${res.statusCode}`)); });
    req.on('error', (e) => resolve(`resume failed: ${e.message} (live 30s tick will still apply)`));
    req.write(body); req.end();
  });
}
forceResume().then((m) => { console.log(m); db.close(); });
