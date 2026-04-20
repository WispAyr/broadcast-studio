/**
 * Office Wall — Automated Prism Surface views for office displays.
 *
 * Creates:
 *   - Studio "Ops Office" (if missing)
 *   - Layout "Office Wall" with a fullscreen surface_carousel module
 *   - Screen "Office Wall 1" pointing at the layout
 *
 * Run: node server/src/seed-office-wall.js
 * Prints the /screen/<id> URL on success — open that URL on the office TV.
 *
 * Re-running is idempotent: reuses studio, replaces layout + screen config.
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'broadcast.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const STUDIO_SLUG = 'ops-office';
const STUDIO_NAME = 'Ops Office';
const LAYOUT_NAME = 'Office Wall';
const SCREEN_NAME = 'Office Wall 1';

const VIEWS = [
  {
    label: 'All Events',
    url: 'https://live.wispayr.online/events',
    seconds: 45,
  },
  {
    label: 'Events — Broadcast Theme',
    url: 'https://live.wispayr.online/events?theme=broadcast&refresh=30',
    seconds: 60,
  },
];

let studio = db.prepare('SELECT * FROM studios WHERE slug = ?').get(STUDIO_SLUG);
let studioId;
if (studio) {
  studioId = studio.id;
  console.log(`[studio] exists: ${STUDIO_NAME} (${studioId})`);
} else {
  studioId = uuidv4();
  db.prepare('INSERT INTO studios (id, name, slug, active) VALUES (?, ?, ?, 1)').run(studioId, STUDIO_NAME, STUDIO_SLUG);
  console.log(`[studio] created: ${STUDIO_NAME} (${studioId})`);
}

let layout = db.prepare('SELECT * FROM layouts WHERE studio_id = ? AND name = ?').get(studioId, LAYOUT_NAME);
const moduleId = uuidv4();
const modulesJson = JSON.stringify([
  {
    id: moduleId,
    type: 'surface_carousel',
    fullscreen: true,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    config: {
      views: VIEWS,
      showLabel: true,
      zoom: 100,
      background: '#000',
    },
  },
]);

let layoutId;
if (layout) {
  layoutId = layout.id;
  db.prepare("UPDATE layouts SET modules = ?, grid_cols = 1, grid_rows = 1, background = '#000000', updated_at = datetime('now') WHERE id = ?")
    .run(modulesJson, layoutId);
  console.log(`[layout] updated: ${LAYOUT_NAME} (${layoutId})`);
} else {
  layoutId = uuidv4();
  const cols = db.prepare('PRAGMA table_info(layouts)').all().map((c) => c.name);
  if (cols.includes('background')) {
    db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background) VALUES (?, ?, ?, 1, 1, ?, ?)')
      .run(layoutId, studioId, LAYOUT_NAME, modulesJson, '#000000');
  } else {
    db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, 1, 1, ?)')
      .run(layoutId, studioId, LAYOUT_NAME, modulesJson);
  }
  console.log(`[layout] created: ${LAYOUT_NAME} (${layoutId})`);
}

let screen = db.prepare('SELECT * FROM screens WHERE studio_id = ? AND name = ?').get(studioId, SCREEN_NAME);
let screenId;
if (screen) {
  screenId = screen.id;
  db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?").run(layoutId, screenId);
  console.log(`[screen] updated: ${SCREEN_NAME} (${screenId})`);
} else {
  screenId = uuidv4();
  const maxNum = db.prepare('SELECT COALESCE(MAX(screen_number), 0) AS n FROM screens WHERE studio_id = ?').get(studioId).n;
  db.prepare('INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id) VALUES (?, ?, ?, ?, ?)')
    .run(screenId, studioId, SCREEN_NAME, maxNum + 1, layoutId);
  console.log(`[screen] created: ${SCREEN_NAME} (${screenId})`);
}

console.log('');
console.log('─'.repeat(60));
console.log('Office Wall ready.');
console.log(`Open in the office browser:  /screen/${screenId}`);
console.log('Edit views via the layout editor in broadcast-studio, or re-run this script after editing VIEWS.');
console.log('─'.repeat(60));

db.close();
