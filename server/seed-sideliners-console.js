// SideLiners console buttons for the Now Ayrshire Radio studio, page SIDELINERS.
// Idempotent: deletes this page's buttons in that studio and re-inserts them. Inert until pressed.
const D = require('better-sqlite3'); const { v4 } = require('uuid');
const db = new D('/root/broadcast-studio/server/data/broadcast.db');
const studio = db.prepare("SELECT id FROM studios WHERE name = 'Now Ayrshire Radio'").get().id;
const G = '/player/sideliners/';
const ov = (o) => ({ overlay: o });
const B = [
  ['Bug ON', 'push_overlay', ov({ type: 'gfx_bug', url: G + 'bug.html?live=1' }), '#7B3B8E'],
  ['Bug OFF', 'remove_overlay', { overlay_type: 'gfx_bug' }, '#444'],
  ['Show open', 'push_overlay', ov({ type: 'gfx_full', url: G + 'open.html', duration: 8 }), '#7B3B8E'],
  ['Intro VT', 'push_overlay', ov({ type: 'sting', url: G + 'video/sideliners-intro.mp4' }), '#7B3B8E'],
  ['Sting', 'push_overlay', ov({ type: 'sting', url: G + 'video/sideliners-sting.webm', transparent: true }), '#7B3B8E'],
  ['Bumper', 'push_overlay', ov({ type: 'sting', url: G + 'video/sideliners-bumper.mp4' }), '#7B3B8E'],
  ['L3 Scott Watson', 'push_overlay', ov({ type: 'gfx_l3', url: G + 'lower-third.html?name=Scott%20Watson&type=presenter', duration: 8 }), '#151435'],
  ['L3 Evan Warrander', 'push_overlay', ov({ type: 'gfx_l3', url: G + 'lower-third.html?name=Evan%20Warrander&type=presenter', duration: 8 }), '#151435'],
  ['L3 Elliot Boyce', 'push_overlay', ov({ type: 'gfx_l3', url: G + 'lower-third.html?name=Elliot%20Boyce&type=presenter&role=DJ', duration: 8 }), '#151435'],
  ['Countdown 3pm', 'push_overlay', ov({ type: 'gfx_corner', url: G + 'countdown.html?to=15:00&m=' + encodeURIComponent("Saturday's 3pm kick-offs") }), '#FAA61A'],
  ['Countdown OFF', 'remove_overlay', { overlay_type: 'gfx_corner' }, '#444'],
  ['Live scores', 'sl_gfx', { kind: 'scores', set: 'live' }, '#37d67a'],
  ['Results', 'sl_gfx', { kind: 'scores', set: 'results' }, '#37d67a'],
  ['Table Prem', 'sl_gfx', { kind: 'table', league: 179, hl: 'Kilmarnock' }, '#0f766e'],
  ['Table Champ', 'sl_gfx', { kind: 'table', league: 180, hl: 'Ayr Utd' }, '#0f766e'],
  ['Clock', 'push_overlay', ov({ type: 'gfx_full', url: G + 'clock.html' }), '#FAA61A'],
  ['Today board', 'push_overlay', ov({ type: 'gfx_full', url: G + 'day.html?d=today' }), '#0f766e'],
  ['Yesterday', 'push_overlay', ov({ type: 'gfx_full', url: G + 'day.html?d=yesterday' }), '#0f766e'],
  ['Tomorrow', 'push_overlay', ov({ type: 'gfx_full', url: G + 'day.html?d=tomorrow' }), '#0f766e'],
  ['This week', 'push_overlay', ov({ type: 'gfx_full', url: G + 'week.html' }), '#0f766e'],
  ['Today band', 'push_overlay', ov({ type: 'gfx_l3', url: G + 'day.html?d=today&l3=1', duration: 40 }), '#0f766e'],
  ['Slate soon', 'push_overlay', ov({ type: 'gfx_full', url: G + 'slate.html?m=soon' }), '#7B3B8E'],
  ['Slate back', 'push_overlay', ov({ type: 'gfx_full', url: G + 'slate.html?m=back' }), '#7B3B8E'],
  ['Full-screen OFF', 'remove_overlay', { overlay_type: 'gfx_full' }, '#444'],
  ['TAKE NEXT', 'sl_take_next', {}, '#ED1B2F'],
  ['PULL director', 'sl_pull', {}, '#ED1B2F'],
  ['Clear GFX', 'clear_overlays', {}, '#444'],
];
const tx = db.transaction(() => {
  const del = db.prepare("DELETE FROM console_buttons WHERE studio_id = ? AND page = 'SIDELINERS'").run(studio).changes;
  const base = (db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studio).m ?? -1) + 1;
  const ins = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, color, action_type, action_payload, confirm, enabled, sort_order, page, mode, control_kind)
    VALUES (?,?,?,?,?,?,0,1,?,'SIDELINERS','momentary','button')`);
  B.forEach(([label, type, payload, color], i) => ins.run(v4(), studio, label, color, type, JSON.stringify(payload), base + i));
  return del;
});
const deleted = tx();
console.log(`studio ${studio.slice(0, 8)}: replaced ${deleted}, inserted ${B.length} SIDELINERS buttons`);
