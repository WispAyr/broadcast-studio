/**
 * Show or switch a studio's scoreboard renderer.
 *   node server/scoreboard-renderer.js <studio-slug>               → print it
 *   node server/scoreboard-renderer.js <studio-slug> rive|react    → switch it
 *
 * Writes the DB row only, behind the running server's back, so it refuses while
 * the bug is on air (the server could not take the old bug down). Hide it first
 * (Score OFF), switch, show it again. Nothing restarts. To switch while on air,
 * go through the server instead: scoreboard action 'set' with { renderer }.
 */
const Database = require('better-sqlite3');
const path = require('path');

const [slug, renderer] = process.argv.slice(2);
if (!slug) { console.error('usage: node server/scoreboard-renderer.js <studio-slug> [rive|react]'); process.exit(2); }
if (renderer && !['rive', 'react'].includes(renderer)) { console.error('renderer must be rive or react'); process.exit(2); }

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
const studio = db.prepare('SELECT id, name FROM studios WHERE slug = ?').get(slug);
if (!studio) { console.error(`no studio with slug ${slug}`); process.exit(1); }

const hasCol = db.prepare('PRAGMA table_info(scoreboard)').all().some((c) => c.name === 'renderer');
if (!hasCol) {
  console.error('scoreboard.renderer column missing: the server with the Rive renderer has not started yet');
  process.exit(1);
}

const cur = db.prepare('SELECT renderer, visible FROM scoreboard WHERE studio_id = ?').get(studio.id);
if (renderer && cur && cur.visible && cur.renderer !== renderer) {
  console.error('the score bug is on air: hide it first (Score OFF), then switch');
  process.exit(1);
}
if (renderer) {
  db.prepare(`INSERT INTO scoreboard (studio_id, renderer) VALUES (?, ?)
              ON CONFLICT(studio_id) DO UPDATE SET renderer = excluded.renderer`).run(studio.id, renderer);
}
const row = db.prepare('SELECT renderer, visible, home_name, away_name, home_goals, away_goals, minute FROM scoreboard WHERE studio_id = ?').get(studio.id);
console.log(`${studio.name} (${slug}): renderer=${row ? row.renderer : 'react (no row yet)'}` +
  (row ? ` · ${row.home_name} ${row.home_goals}-${row.away_goals} ${row.away_name} ${row.minute} · ${row.visible ? 'ON' : 'off'}` : ''));
