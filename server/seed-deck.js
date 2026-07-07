/**
 * Seeds a "Screen Control" Deck for a studio: one Take-Layout button per layout
 * (targeting all screens) plus Blackout and Reload utilities. Gives an operator
 * a ready-to-use control surface the moment the Deck feature is deployed.
 *
 * Buttons are INERT until an operator fires them (routes/decks.js + the console
 * dispatch) — this only writes DB rows. Non-destructive + idempotent: reuses an
 * existing "Screen Control" deck and skips buttons already present (by label).
 *
 * Run:  node server/seed-deck.js [studio-slug-or-name]
 *       (defaults to the studio with the most layouts)
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');

// Ensure the deck schema exists even if this runs before the server's first boot
// (mirrors routes/decks.js + the deck columns in routes/console.js).
db.exec(`CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY, studio_id TEXT NOT NULL, name TEXT NOT NULL,
  grid_cols INTEGER DEFAULT 6, grid_rows INTEGER DEFAULT 4, status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));`);
for (const ddl of [
  'ALTER TABLE console_buttons ADD COLUMN deck_id TEXT',
  'ALTER TABLE console_buttons ADD COLUMN x INTEGER DEFAULT 0',
  'ALTER TABLE console_buttons ADD COLUMN y INTEGER DEFAULT 0',
  'ALTER TABLE console_buttons ADD COLUMN w INTEGER DEFAULT 1',
  'ALTER TABLE console_buttons ADD COLUMN h INTEGER DEFAULT 1',
  'ALTER TABLE console_buttons ADD COLUMN target TEXT',
]) { try { db.exec(ddl); } catch { /* exists */ } }

const arg = process.argv[2];
let studio;
if (arg) {
  studio = db.prepare('SELECT * FROM studios WHERE slug = ? OR name = ?').get(arg, arg);
  if (!studio) { console.error(`studio "${arg}" not found`); process.exit(1); }
} else {
  studio = db.prepare(`SELECT s.* FROM studios s
    JOIN (SELECT studio_id, COUNT(*) n FROM layouts GROUP BY studio_id) l ON l.studio_id = s.id
    ORDER BY l.n DESC LIMIT 1`).get();
  if (!studio) { console.error('no studio with layouts found'); process.exit(1); }
}
const studioId = studio.id;

const GRID_COLS = 6, GRID_ROWS = 4, CAP = GRID_COLS * GRID_ROWS;
const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#0d9488', '#4f46e5', '#c026d3', '#0284c7', '#4338ca'];

let deck = db.prepare("SELECT * FROM decks WHERE studio_id = ? AND name = 'Screen Control'").get(studioId);
if (!deck) {
  const id = uuid();
  db.prepare('INSERT INTO decks (id, studio_id, name, grid_cols, grid_rows, status) VALUES (?,?,?,?,?,?)')
    .run(id, studioId, 'Screen Control', GRID_COLS, GRID_ROWS, 'published');
  deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
}

const layouts = db.prepare('SELECT id, name FROM layouts WHERE studio_id = ? ORDER BY name').all(studioId);
const layoutSlots = Math.min(layouts.length, CAP - 2); // reserve last two cells for utilities

const findByLabel = db.prepare('SELECT id FROM console_buttons WHERE deck_id = ? AND label = ?');
const ins = db.prepare(`INSERT INTO console_buttons
  (id, studio_id, deck_id, label, icon, color, action_type, action_payload, confirm, enabled, sort_order, x, y, w, h, target)
  VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)`);

let added = 0, skipped = 0, order = 0;
const place = (i) => ({ x: i % GRID_COLS, y: Math.floor(i / GRID_COLS) });
function addBtn(cell, label, icon, color, action_type, payload, confirm) {
  if (findByLabel.get(deck.id, label)) { skipped++; return; }
  const { x, y } = place(cell);
  ins.run(uuid(), studioId, deck.id, label, icon, color, action_type, JSON.stringify(payload || {}), confirm ? 1 : 0, order++, x, y, 1, 1, 'all');
  added++;
}

for (let i = 0; i < layoutSlots; i++) {
  addBtn(i, layouts[i].name.slice(0, 18), '🎬', COLORS[i % COLORS.length], 'take_layout', { layout_id: layouts[i].id }, false);
}
addBtn(CAP - 2, 'Blackout', '🌑', '#dc2626', 'blackout', {}, true);
addBtn(CAP - 1, 'Reload', '🔄', '#d97706', 'reload_screens', {}, true);

console.log(`[deck] "Screen Control" for ${studio.name}: ${added} button(s) added, ${skipped} already present.`);
console.log(`       ${layoutSlots} layout take(s) + Blackout + Reload. Deck ${deck.id} (${deck.status}).`);
console.log(`       Designer: /control/deck   ·   Touch surface: /deck/${deck.id}`);
