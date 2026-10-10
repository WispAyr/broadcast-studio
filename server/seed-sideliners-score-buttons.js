// Score bug buttons for the Now Ayrshire Radio studio, page SIDELINERS.
// Additive: inserts only buttons not already on the page (matched by action_type + payload), so it
// never rewrites operator-edited buttons or renumbers ids a Stream Deck may be bound to. Inert until
// pressed. Teams are set from the /console scoreboard bar. The bug renders as Rive or React by the
// studio's scoreboard renderer (node server/scoreboard-renderer.js now-ayrshire [rive|react]).
const D = require('better-sqlite3'); const { v4 } = require('uuid');
const db = new D('/root/broadcast-studio/server/data/broadcast.db');
const studio = db.prepare("SELECT id FROM studios WHERE name = 'Now Ayrshire Radio'").get().id;
const B = [
  ['Score ON', 'score_show', {}, '#16a34a'],
  ['Score OFF', 'score_hide', {}, '#444'],
  ['GOAL home', 'score_adjust', { side: 'home', delta: 1 }, '#FAA61A'],
  ['GOAL away', 'score_adjust', { side: 'away', delta: 1 }, '#FAA61A'],
  ['Home −1', 'score_adjust', { side: 'home', delta: -1 }, '#475569'],
  ['Away −1', 'score_adjust', { side: 'away', delta: -1 }, '#475569'],
  ['Clock +1', 'score_minute', { delta: 1 }, '#475569'],
  ['Score 0–0', 'score_reset', {}, '#475569'],
];
const same = db.prepare("SELECT id FROM console_buttons WHERE studio_id = ? AND page = 'SIDELINERS' AND action_type = ? AND action_payload = ?");
const ins = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, color, action_type, action_payload, confirm, enabled, sort_order, page, mode, control_kind)
  VALUES (?,?,?,?,?,?,0,1,?,'SIDELINERS','momentary','button')`);
const tx = db.transaction(() => {
  let order = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studio).m ?? -1;
  let added = 0, skipped = 0;
  for (const [label, type, payload, color] of B) {
    const pj = JSON.stringify(payload);
    if (same.get(studio, type, pj)) { skipped++; continue; }
    ins.run(v4(), studio, label, color, type, pj, ++order);
    added++;
  }
  return { added, skipped };
});
const r = tx();
console.log(`studio ${studio.slice(0, 8)}: SIDELINERS score buttons ${r.added} added, ${r.skipped} already present`);
