/**
 * Seed EGPK TV scene layouts into Broadcast Studio DB.
 * Run: node seed-egpk.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'data', 'broadcast.db');
const db = new Database(dbPath);

const EGPK_BASE = 'https://egpk.info';

const SCENES = [
  { id: 'radar',       name: 'Live Radar' },
  { id: 'cinematic',   name: 'Cinematic' },
  { id: 'overview',    name: 'Overview' },
  { id: 'movements',   name: 'Live Movements' },
  { id: 'weather',     name: 'EGPK Weather' },
  { id: 'military',    name: 'Military Transit' },
  { id: 'standby',     name: 'Standby' },
  { id: 'fuel',        name: 'Aviation Fuel' },
  { id: 'leaderboard', name: 'Creator Pool' },
  { id: 'rare',        name: 'Rare Sighting' },
  { id: 'photo',       name: 'Community Photo' },
  { id: 'sar',         name: 'SAR Scene' },
  { id: 'command',     name: 'Command' },
  { id: 'airspace',    name: 'Airspace' },
  { id: 'globe',       name: 'Globe' },
  { id: 'replay',      name: 'Replay' },
  { id: 'timelapse',   name: 'Timelapse' },
  { id: 'director',    name: 'Director (Auto)' },
];

// Get first studio
const studio = db.prepare('SELECT id FROM studios LIMIT 1').get();
if (!studio) {
  console.error('No studio found. Run the main app first to seed the default studio.');
  process.exit(1);
}

const studioId = studio.id;

const insert = db.prepare(`
  INSERT OR IGNORE INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules)
  VALUES (?, ?, ?, 1, 1, ?)
`);

const existing = db.prepare('SELECT name FROM layouts WHERE studio_id = ? AND name LIKE ?').all(studioId, 'EGPK:%');
const existingNames = new Set(existing.map(r => r.name));

let created = 0;
let skipped = 0;

const txn = db.transaction(() => {
  for (const scene of SCENES) {
    const name = `EGPK: ${scene.name}`;
    if (existingNames.has(name)) {
      skipped++;
      continue;
    }
    const url = scene.id === 'director' ? `${EGPK_BASE}/tv` : `${EGPK_BASE}/tv/${scene.id}`;
    const modules = JSON.stringify([{
      type: 'iframe',
      x: 0, y: 0, w: 1, h: 1,
      config: { url, refreshInterval: 0 },
    }]);
    insert.run(uuidv4(), studioId, name, modules);
    created++;
  }
});

txn();
console.log(`EGPK scenes seeded: ${created} created, ${skipped} skipped (already exist)`);
db.close();
