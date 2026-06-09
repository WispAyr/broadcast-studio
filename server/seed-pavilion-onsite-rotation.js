/**
 * Seed Pavilion Festival on-site screen rotation.
 *
 * Creates a single portrait layout that cycles 4 static images using
 * SlideshowModule (built-in fade + ken burns). Assign both on-site screens
 * to this layout via /control/screens — no timeline runner needed.
 *
 * Image files are expected to be served at /assets/pavilion-festival/onsite/<file>.
 * Drop them into  server/public/assets/pavilion-festival/onsite/  on the host
 * before (or after) running this seed — re-running is idempotent.
 *
 * Deploy:  scp this to small-server:/root/broadcast-studio/server/  and run
 *   cd /root/broadcast-studio/server && node seed-pavilion-onsite-rotation.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'data', 'broadcast.db');
const db = new Database(dbPath);

const STUDIO_SLUG = 'ayr-pavilion';
const studio = db.prepare('SELECT id FROM studios WHERE slug = ?').get(STUDIO_SLUG);
if (!studio) {
  console.error(`No studio with slug=${STUDIO_SLUG}. Aborting.`);
  process.exit(1);
}

const ASSET_BASE = '/assets/pavilion-festival/onsite';
const IMAGES = [
  `${ASSET_BASE}/besound-feelin-it.png`,
  `${ASSET_BASE}/ewans-maw-merch.png`,
  `${ASSET_BASE}/embrace-the-madness.png`,
  `${ASSET_BASE}/besound-please-just-say.png`,
  `${ASSET_BASE}/buckfast-tell-me-you-like-it.jpg`,
];

const LAYOUT_NAME = 'Pavilion Festival: On-Site Rotation (Portrait)';

const slideshowConfig = {
  images: IMAGES.join('\n'),
  interval: 8000,
  transition: 'fade',
  transitionDuration: 800,
  fit: 'cover',
  kenBurns: true,
};

const modules = [{
  type: 'slideshow',
  x: 0, y: 0, w: 1, h: 1,
  config: slideshowConfig,
}];

const findByName = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?');
const insertLayout = db.prepare(`
  INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, orientation, resolution_w, resolution_h, public_safe)
  VALUES (?, ?, ?, 1, 1, ?, 'portrait', 1080, 1920, 1)
`);
const updateLayout = db.prepare(`
  UPDATE layouts
  SET modules = ?, orientation = 'portrait', resolution_w = 1080, resolution_h = 1920,
      updated_at = datetime('now'), public_safe = 1
  WHERE id = ?
`);

const modulesJson = JSON.stringify(modules);
const existing = findByName.get(studio.id, LAYOUT_NAME);
let layoutId;
if (existing) {
  updateLayout.run(modulesJson, existing.id);
  layoutId = existing.id;
  console.log(`Layout updated: ${LAYOUT_NAME}  id=${layoutId}`);
} else {
  layoutId = uuidv4();
  insertLayout.run(layoutId, studio.id, LAYOUT_NAME, modulesJson);
  console.log(`Layout inserted: ${LAYOUT_NAME}  id=${layoutId}`);
}

// ── Upsert the two on-site screens + bind to the rotation layout ───────────
const SCREENS = [
  { name: 'Tokens', screen_number: 10 },
  { name: 'VIP',    screen_number: 11 },
];

const findScreen = db.prepare('SELECT id FROM screens WHERE studio_id = ? AND name = ?');
const insertScreen = db.prepare(`
  INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id)
  VALUES (?, ?, ?, ?, ?)
`);
const updateScreen = db.prepare(`
  UPDATE screens SET current_layout_id = ?, screen_number = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const screenResults = [];
for (const s of SCREENS) {
  const ex = findScreen.get(studio.id, s.name);
  if (ex) {
    updateScreen.run(layoutId, s.screen_number, ex.id);
    screenResults.push({ ...s, id: ex.id, action: 'updated' });
  } else {
    const id = uuidv4();
    insertScreen.run(id, studio.id, s.name, s.screen_number, layoutId);
    screenResults.push({ ...s, id, action: 'inserted' });
  }
}

console.log('\nScreens:');
for (const r of screenResults) {
  console.log(`  ${r.action.padEnd(8)} ${r.name.padEnd(8)} id=${r.id}  →  https://broadcast.studio.wispayr.online/screen/${r.id}`);
}

console.log('\nImages referenced (drop these on the host at server/public/assets/pavilion-festival/onsite/):');
for (const u of IMAGES) console.log(`  ${u}`);
db.close();
