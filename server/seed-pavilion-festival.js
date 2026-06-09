/**
 * Seed Pavilion Festival 2026 layouts + show into Broadcast Studio DB.
 * Run from /root/broadcast-studio:  node seed-pavilion-festival.js
 *
 * Idempotent: layouts identified by name "Pavilion Festival: <slug>" — re-running
 * UPDATES the modules JSON in place rather than duplicating rows.
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'data', 'broadcast.db');
const db = new Database(dbPath);

const STUDIO_SLUG = 'ayr-pavilion';
const studio = db.prepare('SELECT id FROM studios WHERE slug = ?').get(STUDIO_SLUG);
if (!studio) {
  console.error(`No studio with slug=${STUDIO_SLUG}. Aborting.`);
  process.exit(1);
}
const studioId = studio.id;
console.log(`Using studio: ${studioId} (${STUDIO_SLUG})`);

// ── Module types (registers in the picker + editor metadata) ──────────────
const MODULE_TYPES = [
  { id: 'pavilion_now_next', name: 'Pavilion Now & Next', description: 'Live current/next set per stage from the Pavilion Festival API', category: 'event', icon: '🎤' },
  { id: 'pavilion_timeline', name: 'Pavilion Day Timeline', description: 'Full day lineup by stage (Sat / Sun / auto)', category: 'event', icon: '📅' },
  { id: 'pavilion_next_90',  name: 'Pavilion Next 90 Minutes', description: 'Chronological cross-stage feed of upcoming sets', category: 'event', icon: '⏭️' },
  { id: 'pavilion_welcome',  name: 'Pavilion Welcome', description: 'Welcome / wayfinding card with stage colours and key locations', category: 'event', icon: '👋' },
  { id: 'pavilion_safety',   name: 'Pavilion Safety Announcement', description: 'Pre-approved safety templates: evac, weather, lost child, medical, welfare, hold', category: 'situational', icon: '🚨' },
  { id: 'pavilion_sponsor',  name: 'Pavilion Sponsor Slot', description: 'Rotating sponsor card — drop logos + messages into config.sponsors', category: 'broadcast', icon: '⭐' },
];
const upsertType = db.prepare(`
  INSERT INTO module_types (id, name, description, category, icon, default_config) VALUES (?, ?, ?, ?, ?, '{}')
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category, icon=excluded.icon
`);
let mtCount = 0;
for (const m of MODULE_TYPES) {
  upsertType.run(m.id, m.name, m.description, m.category, m.icon);
  mtCount++;
}
console.log(`Module types: ${mtCount} upserted.`);

// ── Layout definitions ─────────────────────────────────────────────────────
// Each entry: { slug, name, orientation, modules: [{type, x, y, w, h, config}] }
// Grid is unit-fraction (0..1) — layouts use 1×1 grid with full-bleed modules.

function fullBleed(type, config = {}) {
  return [{ type, x: 0, y: 0, w: 1, h: 1, config }];
}

const NOW_NEXT_CONFIG = { eventTitle: 'Pavilion Festival 2026', accentColor: '#ffb020' };
const TIMELINE_CONFIG_AUTO = { day: 'auto', accentColor: '#ffb020' };
const TIMELINE_CONFIG_SAT = { day: '2026-05-02', accentColor: '#ffb020' };
const TIMELINE_CONFIG_SUN = { day: '2026-05-03', accentColor: '#ffb020' };
const NEXT90_CONFIG = { windowMinutes: 90, accentColor: '#ffb020' };
const WELCOME_CONFIG_TICKET = {
  greeting: 'Welcome to',
  showStages: true,
  accentColor: '#ffb020',
};
const WELCOME_CONFIG_VIP = {
  greeting: 'VIP — Welcome',
  showStages: true,
  accentColor: '#ff5ac4',
};
const SPONSOR_CONFIG = {
  header: 'Brought to you by',
  accentColor: '#ffb020',
  defaultDuration: 7000,
  sponsors: [], // operator drops real sponsors in here later
};

const SAFETY_PRESETS = [
  { slug: 'safety-evac',         preset: 'general-evac',   name: 'Safety: General Evacuation' },
  { slug: 'safety-weather',      preset: 'severe-weather', name: 'Safety: Weather Hold' },
  { slug: 'safety-lost-child',   preset: 'lost-child',     name: 'Safety: Lost Child' },
  { slug: 'safety-found-child',  preset: 'found-child',    name: 'Safety: Found Child' },
  { slug: 'safety-medical',      preset: 'medical-aid',    name: 'Safety: Medical Aid' },
  { slug: 'safety-welfare',      preset: 'welfare',        name: 'Safety: Welfare & Support' },
  { slug: 'safety-hold',         preset: 'temporary-hold', name: 'Safety: Brief Delay' },
];

const LAYOUTS = [];

function pushOrientations(slug, baseName, modules) {
  LAYOUTS.push({ slug: `${slug}-portrait`,  name: `${baseName} (Portrait)`,  orientation: 'portrait',  resolution_w: 1080, resolution_h: 1920, modules });
  LAYOUTS.push({ slug: `${slug}-landscape`, name: `${baseName} (Landscape)`, orientation: 'landscape', resolution_w: 1920, resolution_h: 1080, modules });
}

pushOrientations('now-next',     'Pavilion Festival: Now & Next',     fullBleed('pavilion_now_next',  NOW_NEXT_CONFIG));
pushOrientations('timeline',     'Pavilion Festival: Today\'s Timeline', fullBleed('pavilion_timeline', TIMELINE_CONFIG_AUTO));
pushOrientations('timeline-sat', 'Pavilion Festival: Saturday Lineup', fullBleed('pavilion_timeline', TIMELINE_CONFIG_SAT));
pushOrientations('timeline-sun', 'Pavilion Festival: Sunday Lineup',   fullBleed('pavilion_timeline', TIMELINE_CONFIG_SUN));
pushOrientations('next-90',      'Pavilion Festival: Next 90 Minutes', fullBleed('pavilion_next_90',  NEXT90_CONFIG));
pushOrientations('welcome',      'Pavilion Festival: Welcome',         fullBleed('pavilion_welcome',  WELCOME_CONFIG_TICKET));
pushOrientations('welcome-vip',  'Pavilion Festival: VIP Welcome',     fullBleed('pavilion_welcome',  WELCOME_CONFIG_VIP));
pushOrientations('sponsor',      'Pavilion Festival: Sponsor Slot',    fullBleed('pavilion_sponsor',  SPONSOR_CONFIG));

for (const p of SAFETY_PRESETS) {
  pushOrientations(p.slug, `Pavilion ${p.name}`, fullBleed('pavilion_safety', { preset: p.preset }));
}

// ── Insert / update layouts ────────────────────────────────────────────────
const findByName = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?');
const insertLayout = db.prepare(`
  INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, orientation, resolution_w, resolution_h, public_safe)
  VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, 1)
`);
const updateLayout = db.prepare(`
  UPDATE layouts
  SET modules = ?, orientation = ?, resolution_w = ?, resolution_h = ?, updated_at = datetime('now'), public_safe = 1
  WHERE id = ?
`);

const layoutIdsBySlug = {};
let inserted = 0, updated = 0;

const txn = db.transaction(() => {
  for (const L of LAYOUTS) {
    const modulesJson = JSON.stringify(L.modules);
    const existing = findByName.get(studioId, L.name);
    if (existing) {
      updateLayout.run(modulesJson, L.orientation, L.resolution_w, L.resolution_h, existing.id);
      layoutIdsBySlug[L.slug] = existing.id;
      updated++;
    } else {
      const id = uuidv4();
      insertLayout.run(id, studioId, L.name, modulesJson, L.orientation, L.resolution_w, L.resolution_h);
      layoutIdsBySlug[L.slug] = id;
      inserted++;
    }
  }
});
txn();
console.log(`Layouts: ${inserted} inserted, ${updated} updated.`);

// ── Festival show (auto-rotation playlist) ─────────────────────────────────
// Each entry holds N seconds. Producer can edit the timeline in /control/shows.
function buildTimeline(orientationSuffix) {
  const slot = (slug, durationSec) => ({
    layout_id: layoutIdsBySlug[`${slug}-${orientationSuffix}`],
    duration_seconds: durationSec,
  });
  return [
    slot('now-next',  20),
    slot('next-90',   18),
    slot('welcome',   14),
    slot('timeline',  20),
    slot('sponsor',   10),
    slot('now-next',  20),
    slot('welcome-vip', 12),
    slot('timeline',  20),
    slot('sponsor',   10),
  ].filter(x => x.layout_id);
}

const SHOWS = [
  {
    name: 'Pavilion Festival — Portrait Rotation',
    description: 'Auto-cycles through now/next, schedule, welcome, sponsor for portrait kiosks.',
    timeline: buildTimeline('portrait'),
  },
  {
    name: 'Pavilion Festival — Landscape Rotation',
    description: 'Auto-cycles through now/next, schedule, welcome, sponsor for the large-format LED.',
    timeline: buildTimeline('landscape'),
  },
];

const findShow = db.prepare('SELECT id FROM shows WHERE studio_id = ? AND name = ?');
const insertShow = db.prepare(`
  INSERT INTO shows (id, studio_id, name, description, timeline, active)
  VALUES (?, ?, ?, ?, ?, 0)
`);
const updateShow = db.prepare(`
  UPDATE shows SET description = ?, timeline = ?, updated_at = datetime('now') WHERE id = ?
`);

let shInserted = 0, shUpdated = 0;
const showTxn = db.transaction(() => {
  for (const S of SHOWS) {
    const tl = JSON.stringify(S.timeline);
    const ex = findShow.get(studioId, S.name);
    if (ex) {
      updateShow.run(S.description, tl, ex.id);
      shUpdated++;
    } else {
      insertShow.run(uuidv4(), studioId, S.name, S.description, tl);
      shInserted++;
    }
  }
});
showTxn();
console.log(`Shows: ${shInserted} inserted, ${shUpdated} updated.`);

console.log('\nDone.');
console.log('Next:  /control/shows  to start the rotation, then assign each kiosk to it.');
db.close();
