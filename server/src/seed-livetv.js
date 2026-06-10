/**
 * Live TV scenes + console buttons — off-air channels via HDHomeRun → go2rtc.
 *
 * Creates per studio:
 *   - "📺 <Channel>" full-screen scene per channel in /api/livetv's registry
 *     (audio 'auto': sound only on PA/audio-output screens)
 *   - "📺 TV Multiview" — 2×2 grid of the first four channels, all muted
 *   - Console buttons (Stream Deck-ready via /api/console fire URLs):
 *     one take per channel + multiview + resume schedule
 *
 * Run:
 *   node server/src/seed-livetv.js                # all active studios
 *   node server/src/seed-livetv.js fanzone        # one studio by slug
 *
 * Idempotent: layouts reused by (studio_id, name); console buttons reused by
 * (studio_id, label).
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'broadcast.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Same registry the server route serves (file if present, else defaults).
const cfgPath = path.join(__dirname, '..', 'data', 'livetv.json');
let CHANNELS = [
  { key: 'bbc-one', label: 'BBC One Scotland', short: 'BBC ONE', color: '#bb1919', stream: 'bbc-one' },
  { key: 'stv', label: 'STV', short: 'STV', color: '#0084d6', stream: 'stv' },
  { key: 'bbc-two', label: 'BBC Two', short: 'BBC TWO', color: '#7d6c5b', stream: 'bbc-two' },
  { key: 'channel4', label: 'Channel 4', short: 'C4', color: '#1ddbb5', stream: 'channel4' },
];
try {
  const j = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (Array.isArray(j.channels) && j.channels.length) CHANNELS = j.channels;
} catch {}

const slugArg = process.argv[2];
const studios = slugArg
  ? db.prepare('SELECT * FROM studios WHERE slug = ?').all(slugArg)
  : db.prepare('SELECT * FROM studios WHERE active = 1').all();

if (studios.length === 0) {
  console.error(slugArg ? `No studio with slug "${slugArg}".` : 'No active studios.');
  process.exit(1);
}

const hasBackground = db.prepare('PRAGMA table_info(layouts)').all().some((c) => c.name === 'background');

function upsertLayout(studio, name, modules) {
  const modulesJson = JSON.stringify(modules);
  const existing = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(studio.id, name);
  if (existing) {
    db.prepare("UPDATE layouts SET modules = ?, grid_cols = 12, grid_rows = 8, updated_at = datetime('now') WHERE id = ?")
      .run(modulesJson, existing.id);
    console.log(`[${studio.slug}] updated: ${name}`);
    return existing.id;
  }
  const id = uuidv4();
  if (hasBackground) {
    db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background) VALUES (?, ?, ?, 12, 8, ?, ?)')
      .run(id, studio.id, name, modulesJson, '#000000');
  } else {
    db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, 12, 8, ?)')
      .run(id, studio.id, name, modulesJson);
  }
  console.log(`[${studio.slug}] created: ${name}`);
  return id;
}

function upsertButton(studio, btn, sortOrder) {
  const payload = JSON.stringify(btn.payload || {});
  const existing = db.prepare('SELECT id FROM console_buttons WHERE studio_id = ? AND label = ?').get(studio.id, btn.label);
  if (existing) {
    db.prepare("UPDATE console_buttons SET sublabel = ?, icon = ?, color = ?, action_type = ?, action_payload = ?, sort_order = ?, enabled = 1, updated_at = datetime('now') WHERE id = ?")
      .run(btn.sublabel || null, btn.icon || null, btn.color || null, btn.action_type, payload, sortOrder, existing.id);
    return existing.id;
  }
  const id = uuidv4();
  db.prepare('INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, studio.id, btn.label, btn.sublabel || null, btn.icon || null, btn.color || null, btn.action_type, payload, sortOrder);
  return id;
}

for (const studio of studios) {
  const layoutIds = {};

  // Full-screen scene per channel — audio 'auto' so the same scene is safe on
  // muted walls and the PA screen alike.
  for (const ch of CHANNELS) {
    layoutIds[ch.key] = upsertLayout(studio, `📺 ${ch.label}`, [
      {
        id: uuidv4(),
        type: 'live_tv',
        fullscreen: true,
        x: 0, y: 0, w: 12, h: 8,
        config: { channel: ch.key, audio: 'auto', fit: 'contain', showLabel: true },
      },
    ]);
  }

  // 2×2 multiview of the first four channels, everything muted.
  const quad = CHANNELS.slice(0, 4);
  const pos = [ [0, 0], [6, 0], [0, 4], [6, 4] ];
  layoutIds.multiview = upsertLayout(studio, '📺 TV Multiview', quad.map((ch, i) => ({
    id: uuidv4(),
    type: 'live_tv',
    x: pos[i][0], y: pos[i][1], w: 6, h: 4,
    config: { channel: ch.key, audio: 'off', fit: 'contain', showLabel: true },
  })));

  // Console buttons — channel takes for the touch console / Stream Deck.
  let sort = 700; // keep the TV bank together, after existing button groups
  for (const ch of quad) {
    upsertButton(studio, {
      label: `TV ${ch.short || ch.label}`,
      sublabel: ch.label,
      icon: '📺',
      color: ch.color || '#bb1919',
      action_type: 'take_layout',
      payload: { layout_id: layoutIds[ch.key] },
    }, sort++);
  }
  upsertButton(studio, {
    label: 'TV Multiview',
    sublabel: 'All channels 2×2',
    icon: '🔲',
    color: '#475569',
    action_type: 'take_layout',
    payload: { layout_id: layoutIds.multiview },
  }, sort++);
  upsertButton(studio, {
    label: 'TV Off — Resume',
    sublabel: 'Back to schedule',
    icon: '⏮',
    color: '#16a34a',
    action_type: 'resume_schedule',
    payload: {},
  }, sort++);
  console.log(`[${studio.slug}] console buttons: ${quad.length + 2}`);
}

console.log('\nDone. Buttons appear on /console; fire URLs work for Stream Deck (see /control/console).');
