/**
 * DoonFest OB overlay pack — seeds under the CSU Deployment studio.
 *
 * Creates (idempotently, keyed by name):
 *   1. "DoonFest Overlay (OBS)" layout — transparent background, no modules.
 *      Used as an OBS browser-source over the stage camera, so the layout
 *      itself must paint NOTHING; all graphics arrive as df_* overlays.
 *   2. "DoonFest Overlay (OBS)" screen bound to that layout, with
 *      disconnectBehavior=freeze so a socket blip never paints the stream
 *      black (the default 'message' behaviour would).
 *   3. Console buttons (page DOONFEST) for one-tap fires from /console —
 *      LiveMode's overlay panel is the primary surface; these are backup.
 *
 * Run from repo root on small-server:  node server/seed-doonfest.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const STUDIO_ID = '778e35c6-e1f9-46c9-ad19-841988b6ffd6'; // CSU Deployment
const NAME = 'DoonFest Overlay (OBS)';

const studio = db.prepare('SELECT id, name FROM studios WHERE id = ?').get(STUDIO_ID);
if (!studio) { console.error('CSU Deployment studio not found — aborting'); process.exit(1); }
console.log(`[studio] ${studio.name}`);

// 1. Layout — transparent, empty.
let layoutId;
const layout = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(STUDIO_ID, NAME);
if (layout) {
  layoutId = layout.id;
  db.prepare("UPDATE layouts SET modules = '[]', background = 'transparent', grid_cols = 1, grid_rows = 1, project = 'DoonFest', updated_at = datetime('now') WHERE id = ?").run(layoutId);
} else {
  layoutId = randomUUID();
  db.prepare("INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background, project) VALUES (?, ?, ?, 1, 1, '[]', 'transparent', 'DoonFest')")
    .run(layoutId, STUDIO_ID, NAME);
}
console.log(`[layout] ${layoutId}`);

// 2. Screen bound to it, freeze-on-disconnect.
const screenCfg = JSON.stringify({ disconnectBehavior: 'freeze' });
let screenId;
const screen = db.prepare('SELECT id FROM screens WHERE studio_id = ? AND name = ?').get(STUDIO_ID, NAME);
if (screen) {
  screenId = screen.id;
  db.prepare("UPDATE screens SET current_layout_id = ?, config = ?, updated_at = datetime('now') WHERE id = ?").run(layoutId, screenCfg, screenId);
} else {
  screenId = randomUUID();
  const n = db.prepare('SELECT COALESCE(MAX(screen_number),0) AS n FROM screens WHERE studio_id = ?').get(STUDIO_ID).n;
  db.prepare('INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id, config) VALUES (?, ?, ?, ?, ?, ?)')
    .run(screenId, STUDIO_ID, NAME, n + 1, layoutId, screenCfg);
}
console.log(`[screen] ${screenId}`);
console.log(`[url]    /screen/${screenId}`);

// 3. Console buttons — wipe + reseed the DOONFEST page.
db.prepare("DELETE FROM console_buttons WHERE studio_id = ? AND page = 'DOONFEST'").run(STUDIO_ID);
const ins = db.prepare(`INSERT INTO console_buttons
  (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order, page)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, 'DOONFEST')`);
const btn = (label, sublabel, icon, type, payload, sort) =>
  ins.run(randomUUID(), STUDIO_ID, label, sublabel, icon, '#faa61e', type, JSON.stringify(payload), sort);

btn('Live Bug', 'persistent', '🔴', 'push_overlay', { overlay: { type: 'df_bug' } }, 1);
btn('Ticker', 'persistent', '📜', 'push_overlay', { overlay: { type: 'df_ticker', text: 'Welcome to DoonFest — brought to you with Now Ayrshire Radio' } }, 2);
btn('Sponsor', '8s', '🤝', 'push_overlay', { overlay: { type: 'df_sponsor', name: 'Now Ayrshire Radio', duration: 8 } }, 3);
btn('Clear All', 'overlays off', '🧹', 'clear_overlays', {}, 4);
console.log('[buttons] DOONFEST page seeded (4)');

db.close();
console.log('done');
