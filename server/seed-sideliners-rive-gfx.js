// SideLiners Rive graphics for the Now Ayrshire Radio studio, page SIDELINERS.
// The graphics live at /player/rive/ (host.html + gfx/*.riv, source in ~/Development/sideliners-graphics/rive).
// host.html plays any .riv as a gfx_* overlay: set.<prop>=… fixes a value, bind.<prop>=<variable id> follows a
// studio variable live (bind.x=<id>/<a.b> reads a field of a JSON variable).
// Additive: creates the variables and buttons only if missing (buttons matched by label), so it never rewrites
// operator-edited buttons or renumbers ids a Stream Deck may be bound to. Inert until pressed.
const D = require('better-sqlite3'); const { v4 } = require('uuid');
const db = new D('/root/broadcast-studio/server/data/broadcast.db');
const studio = db.prepare("SELECT id FROM studios WHERE name = 'Now Ayrshire Radio'").get().id;

const host = (params) => '/player/rive/host.html?' + Object.entries(params)
  .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2F/g, '/').replace(/%3A/g, ':')}`).join('&');
const l3 = (params) => ({ overlay: { type: 'gfx_l3', url: host({ riv: 'gfx/lowerthird.riv', ...params }), duration: 8 } });

// Variables the guest lower third follows: edit them in the studio's Variables panel while it is up.
const VARS = [
  ['sl.guest', 'SideLiners guest name', 'string', 'Guest Name'],
  ['sl.guest_role', 'SideLiners guest role (capitals)', 'string', 'GUEST'],
];
const B = [
  ['L3 Scott (Rive)', 'push_overlay', l3({ 'set.name': 'Scott Watson', 'set.role': 'PRESENTER' }), '#151435'],
  ['L3 Evan (Rive)', 'push_overlay', l3({ 'set.name': 'Evan Warrander', 'set.role': 'PRESENTER' }), '#151435'],
  ['L3 Elliot (Rive)', 'push_overlay', l3({ 'set.name': 'Elliot Boyce', 'set.role': 'DJ' }), '#151435'],
  ['L3 Guest (Rive)', 'push_overlay', {
    overlay: {
      type: 'gfx_l3',
      url: host({ riv: 'gfx/lowerthird.riv', 'bind.name': 'sl.guest', 'bind.role': 'sl.guest_role', 'set.roleColor': 'FAA61A', 'set.roleInk': '151435' }),
    },
  }, '#FAA61A'],
  ['L3 OFF', 'remove_overlay', { overlay_type: 'gfx_l3' }, '#444'],
];

const hasVar = db.prepare('SELECT 1 FROM variables WHERE studio_id = ? AND id = ?');
const insVar = db.prepare(`INSERT INTO variables (id, studio_id, name, kind, value, default_value, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`);
const hasBtn = db.prepare("SELECT 1 FROM console_buttons WHERE studio_id = ? AND page = 'SIDELINERS' AND label = ?");
const insBtn = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, color, action_type, action_payload, confirm, enabled, sort_order, page, mode, control_kind)
  VALUES (?,?,?,?,?,?,0,1,?,'SIDELINERS','momentary','button')`);

const r = db.transaction(() => {
  let vars = 0, btns = 0;
  for (const [id, name, kind, value] of VARS) if (!hasVar.get(studio, id)) { insVar.run(id, studio, name, kind, value, value); vars++; }
  let order = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studio).m ?? -1;
  for (const [label, type, payload, color] of B) {
    if (hasBtn.get(studio, label)) continue;
    insBtn.run(v4(), studio, label, color, type, JSON.stringify(payload), ++order); btns++;
  }
  return { vars, btns };
})();
console.log(`studio ${studio.slice(0, 8)}: ${r.vars} variables, ${r.btns} SIDELINERS Rive buttons added`);
