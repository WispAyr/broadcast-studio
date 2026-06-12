/**
 * Seeds the four new match graphics as layouts + a MATCH-page console button
 * each, on the SideLiner's FanZone studio. Non-destructive: layouts/buttons are
 * only inserted if absent, so it never wipes operator or scoreboard buttons.
 *
 * Run: node server/seed-sideliners-matchgfx.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');

const studio = db.prepare("SELECT * FROM studios WHERE slug = 'sideliners-fanzone'").get();
if (!studio) { console.error('FanZone studio not found'); process.exit(1); }
const studioId = studio.id;

// name, view, button label, sublabel, icon, colour
const SCENES = [
  ['📋 Match Centre — Line-ups', 'formation', 'Line-ups', 'Predicted XI', '📋', '#1e6fd0'],
  ['🏟 Match Centre — The Venue', 'stadium', 'Venue', 'Gillette Stadium', '🏟', '#475569'],
  ['⚔ Match Centre — Key Battles', 'head_to_head', 'Battles', 'Head-to-head', '⚔', '#7a2f9e'],
  ['⭐ Match Centre — Ones to Watch', 'ones_to_watch', 'Watch', 'Star players', '⭐', '#caa33a'],
];

const mod = (view) => JSON.stringify([{ id: uuid(), module: 'match_stats', type: 'match_stats', x: 0, y: 0, w: 12, h: 8, config: { view } }]);
const findL = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?');
const insL = db.prepare("INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background, project, resolution_w, resolution_h, orientation) VALUES (?,?,?,12,8,?,'#241a40','SideLiner''s',1920,1080,'landscape')");

const cols = db.prepare('PRAGMA table_info(console_buttons)').all().map((c) => c.name);
const hasPage = cols.includes('page');
let order = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM console_buttons WHERE studio_id = ?').get(studioId).m;
const findB = db.prepare("SELECT id FROM console_buttons WHERE studio_id = ? AND action_type = 'take_layout' AND json_extract(action_payload,'$.layout_id') = ?");
const insB = db.prepare(
  `INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, ${hasPage ? 'page, ' : ''}sort_order)
   VALUES (?,?,?,?,?,?,?,?,?,${hasPage ? '?, ' : ''}?)`
);

let addedL = 0, addedB = 0, skip = 0;
for (const [name, view, label, sub, icon, color] of SCENES) {
  let r = findL.get(studioId, name);
  if (!r) { const id = uuid(); insL.run(id, studioId, name, mod(view)); r = { id }; addedL++; }
  const lid = r.id;
  if (findB.get(studioId, lid)) { skip++; continue; }
  const args = [uuid(), studioId, label, sub, icon, color, 'take_layout', JSON.stringify({ layout_id: lid }), 0];
  if (hasPage) args.push('MATCH');
  args.push(++order);
  insB.run(...args);
  addedB++;
}
console.log(`[matchgfx] ${addedL} layouts + ${addedB} buttons added, ${skip} present (studio ${studioId})`);
