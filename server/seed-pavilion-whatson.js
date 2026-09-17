/**
 * Seed the Ayr Pavilion "What's On" module type, layouts and the two venue
 * screen nodes into the Broadcast Studio DB.
 *
 * Run from /root/broadcast-studio/server:  node seed-pavilion-whatson.js
 *
 * Idempotent: layouts + screens are looked up by name within the ayr-pavilion
 * studio; re-running updates config in place rather than duplicating rows.
 * Prints the screen URLs to point the kiosks at.
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'data', 'broadcast.db');
const db = new Database(dbPath);

const STUDIO_SLUG = 'ayr-pavilion';
const studio = db.prepare('SELECT id FROM studios WHERE slug = ?').get(STUDIO_SLUG);
if (!studio) { console.error(`No studio with slug=${STUDIO_SLUG}. Aborting.`); process.exit(1); }
const studioId = studio.id;
console.log(`Using studio: ${studioId} (${STUDIO_SLUG})`);

// ── Module type ───────────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO module_types (id, name, description, category, icon, default_config) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category, icon=excluded.icon, default_config=excluded.default_config
`).run(
  'pavilion_whats_on',
  "Pavilion What's On",
  'Rotating hero cards for every upcoming Ayr Pavilion event (live from ayrpavilion.com): poster, when, lineup, ticket QR, coming-up rail',
  'event', '🎟️',
  JSON.stringify({ mode: 'upcoming', holdSeconds: 13, comingUp: 4 }),
);
db.prepare(`
  INSERT INTO module_types (id, name, description, category, icon, default_config) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category, icon=excluded.icon, default_config=excluded.default_config
`).run(
  'pavilion_calendar_timeline',
  'Pavilion Calendar Timeline',
  'Animated calendar timeline of every upcoming Ayr Pavilion event: glowing rail, big date blocks, month markers, live mini month-calendar, camera glides event to event',
  'event', '📆',
  JSON.stringify({ mode: 'upcoming', holdSeconds: 8 }),
);
console.log('Module types pavilion_whats_on + pavilion_calendar_timeline upserted.');

// ── Layouts ───────────────────────────────────────────────────────────────
function fullBleed(config, type = 'pavilion_whats_on') { return [{ type, x: 0, y: 0, w: 1, h: 1, config }]; }

const LAYOUTS = [
  { key: 'a-portrait',  name: "Pavilion: What's On — Screen A (Portrait)",           orientation: 'portrait',  w: 1080, h: 1920, modules: fullBleed({ mode: 'upcoming', holdSeconds: 13, comingUp: 4 }) },
  { key: 'b-portrait',  name: "Pavilion: What's On — Screen B Featured (Portrait)",  orientation: 'portrait',  w: 1080, h: 1920, modules: fullBleed({ mode: 'featured', holdSeconds: 13, comingUp: 4 }) },
  { key: 'a-landscape', name: "Pavilion: What's On (Landscape)",                     orientation: 'landscape', w: 1920, h: 1080, modules: fullBleed({ mode: 'upcoming', holdSeconds: 13, comingUp: 4 }) },
  { key: 'b-landscape', name: "Pavilion: What's On — Featured (Landscape)",          orientation: 'landscape', w: 1920, h: 1080, modules: fullBleed({ mode: 'featured', holdSeconds: 13, comingUp: 4 }) },
  { key: 'tl-portrait',  name: 'Pavilion: Calendar Timeline (Portrait)',              orientation: 'portrait',  w: 1080, h: 1920, modules: fullBleed({ mode: 'upcoming', holdSeconds: 8 }, 'pavilion_calendar_timeline') },
  { key: 'tl-landscape', name: 'Pavilion: Calendar Timeline (Landscape)',             orientation: 'landscape', w: 1920, h: 1080, modules: fullBleed({ mode: 'upcoming', holdSeconds: 8 }, 'pavilion_calendar_timeline') },
];

const findLayout = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?');
const insertLayout = db.prepare(`
  INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, orientation, resolution_w, resolution_h, public_safe, background)
  VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, 1, '#070b18')
`);
const updateLayout = db.prepare(`
  UPDATE layouts SET modules = ?, orientation = ?, resolution_w = ?, resolution_h = ?, public_safe = 1, background = '#070b18', updated_at = datetime('now') WHERE id = ?
`);

const layoutIds = {};
db.transaction(() => {
  for (const L of LAYOUTS) {
    const existing = findLayout.get(studioId, L.name);
    const modules = JSON.stringify(L.modules);
    if (existing) {
      updateLayout.run(modules, L.orientation, L.w, L.h, existing.id);
      layoutIds[L.key] = existing.id;
      console.log(`Layout updated:  ${L.name} (${existing.id})`);
    } else {
      const id = uuidv4();
      insertLayout.run(id, studioId, L.name, modules, L.orientation, L.w, L.h);
      layoutIds[L.key] = id;
      console.log(`Layout inserted: ${L.name} (${id})`);
    }
  }
})();

// ── Screens (the two portrait kiosk PCs at the venue) ─────────────────────
const SCREENS = [
  { name: "PIV — Screen A · What's On", screen_number: 1, layout: 'a-portrait' },
  { name: 'PIV — Screen B · Featured',   screen_number: 2, layout: 'tl-portrait' },
];
const findScreen = db.prepare('SELECT id FROM screens WHERE studio_id = ? AND name = ?');
const insertScreen = db.prepare(`
  INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id, orientation, width, height, config, accepts_broadcasts)
  VALUES (?, ?, ?, ?, ?, 'portrait', 1080, 1920, '{"fitToScreen":true}', 1)
`);
const updateScreen = db.prepare(`
  UPDATE screens SET current_layout_id = ?, orientation = 'portrait', width = 1080, height = 1920, screen_number = ?, config = '{"fitToScreen":true}', updated_at = datetime('now') WHERE id = ?
`);

const screenIds = {};
db.transaction(() => {
  for (const S of SCREENS) {
    const existing = findScreen.get(studioId, S.name);
    const layoutId = layoutIds[S.layout];
    if (existing) {
      updateScreen.run(layoutId, S.screen_number, existing.id);
      screenIds[S.name] = existing.id;
      console.log(`Screen updated:  ${S.name} (${existing.id})`);
    } else {
      const id = uuidv4();
      insertScreen.run(id, studioId, S.name, S.screen_number, layoutId);
      screenIds[S.name] = id;
      console.log(`Screen inserted: ${S.name} (${id})`);
    }
  }
})();

console.log('\nKiosk URLs:');
for (const [name, id] of Object.entries(screenIds)) {
  console.log(`  ${name}\n    https://broadcast.studio.wispayr.online/screen/${id}`);
}
