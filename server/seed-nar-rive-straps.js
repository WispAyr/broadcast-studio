// NAR headline straps fed live by Crosspoint variables, for the Now Ayrshire Radio studio, page LIVE DATA.
// The strap is /player/rive/gfx/strap.riv played by /player/rive/host.html (source ~/Development/sideliners-graphics/rive).
// bind.headline=<variable id> keeps the strap in step with the variable while it is on screen; crosspoint-bs-vars
// (big-server) writes the xp:* values. One gfx_strap slot: pressing another strap replaces the first.
// Additive: inserts only buttons not already on the page (matched by label). Inert until pressed.
const D = require('better-sqlite3'); const { v4 } = require('uuid');
const db = new D('/root/broadcast-studio/server/data/broadcast.db');
const studio = db.prepare("SELECT id FROM studios WHERE name = 'Now Ayrshire Radio'").get().id;

const host = (params) => '/player/rive/host.html?' + Object.entries(params)
  .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2F/g, '/').replace(/%3A/g, ':')}`).join('&');
const strap = (kicker, variable, extra = {}) => ({
  overlay: { type: 'gfx_strap', url: host({ riv: 'gfx/strap.riv', 'set.kicker': kicker, 'bind.headline': variable, ...extra }) },
});

const B = [
  ['Strap: Power', 'push_overlay', strap('POWER', 'xp:comms.power.headline'), '#FAA61A'],
  ['Strap: Space weather', 'push_overlay', strap('SPACE WEATHER', 'xp:comms.space.headline'), '#7B3B8E'],
  ['Strap: Weather', 'push_overlay', strap('WEATHER', 'xp:storm.calm'), '#7AC4D3'],
  ['Strap OFF', 'remove_overlay', { overlay_type: 'gfx_strap' }, '#444'],
];

const hasBtn = db.prepare("SELECT 1 FROM console_buttons WHERE studio_id = ? AND page = 'LIVE DATA' AND label = ?");
const insBtn = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, color, action_type, action_payload, confirm, enabled, sort_order, page, mode, control_kind)
  VALUES (?,?,?,?,?,?,0,1,?,'LIVE DATA','momentary','button')`);
const added = db.transaction(() => {
  let n = 0;
  let order = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studio).m ?? -1;
  for (const [label, type, payload, color] of B) {
    if (hasBtn.get(studio, label)) continue;
    insBtn.run(v4(), studio, label, color, type, JSON.stringify(payload), ++order); n++;
  }
  return n;
})();
console.log(`studio ${studio.slice(0, 8)}: ${added} LIVE DATA strap buttons added`);
