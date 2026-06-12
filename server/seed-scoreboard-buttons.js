/**
 * Adds a "MATCH" page of scoreboard control buttons to the SideLiner's FanZone
 * console — so a Stream Deck (or the touch console) can drive the score bug.
 * Non-destructive: only inserts buttons that aren't already present (matched by
 * action_type + payload), so it never wipes operator-edited buttons.
 *
 * Run: node server/seed-scoreboard-buttons.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');

const SLUG = 'sideliners-fanzone';
const studio = db.prepare('SELECT * FROM studios WHERE slug = ?').get(SLUG);
if (!studio) { console.error('FanZone studio not found'); process.exit(1); }
const studioId = studio.id;

const GREEN = '#16a34a', RED = '#d2384f', SLATE = '#475569', NAVY = '#0a2a66', GOLD = '#caa33a';

// label, sublabel, icon, color, action_type, payload
const BTNS = [
  ['Home +1', 'Add goal', '➕', NAVY, 'score_adjust', { side: 'home', delta: 1 }],
  ['Home −1', 'Remove goal', '➖', SLATE, 'score_adjust', { side: 'home', delta: -1 }],
  ['Away +1', 'Add goal', '➕', RED, 'score_adjust', { side: 'away', delta: 1 }],
  ['Away −1', 'Remove goal', '➖', SLATE, 'score_adjust', { side: 'away', delta: -1 }],
  ['Min +1', 'Clock', '⏱', SLATE, 'score_minute', { delta: 1 }],
  ['Score ON', 'Show bug', '🔼', GREEN, 'score_show', {}],
  ['Score OFF', 'Hide bug', '🔽', SLATE, 'score_hide', {}],
  ['Reset', '0–0', '↺', SLATE, 'score_reset', {}],
];

const cols = db.prepare('PRAGMA table_info(console_buttons)').all().map((c) => c.name);
const hasPage = cols.includes('page');
let order = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM console_buttons WHERE studio_id = ?').get(studioId).m;

const findSame = db.prepare('SELECT id FROM console_buttons WHERE studio_id = ? AND action_type = ? AND action_payload = ?');
const ins = db.prepare(
  `INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, ${hasPage ? 'page, ' : ''}sort_order)
   VALUES (?,?,?,?,?,?,?,?,?,${hasPage ? '?, ' : ''}?)`
);

let added = 0, skipped = 0;
for (const [label, sub, icon, color, action, payload] of BTNS) {
  const pj = JSON.stringify(payload);
  if (findSame.get(studioId, action, pj)) { skipped++; continue; }
  const args = [uuid(), studioId, label, sub, icon, color, action, pj, 0];
  if (hasPage) args.push('MATCH');
  args.push(++order);
  ins.run(...args);
  added++;
}
console.log(`[scoreboard] MATCH page: ${added} buttons added, ${skipped} already present (studio ${studioId})`);
