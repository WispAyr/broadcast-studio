/**
 * Van CSU Overview — composite live layout for the in-van display.
 *
 * Replaces the previous "spectrum-iframe-eats-everything" layout with a
 * CSU-tailored grid that surfaces what crew actually need at a glance:
 *   - link health (prism van-link-watch)
 *   - lightning risk + strike map (kiosk /api/lightning-risk + strike-map tab)
 *   - on-site cameras + PTZ (kiosk cameras tab)
 *   - incident log (kiosk incidents tab)
 *
 * The kiosk lives at http://10.42.42.162:8800 inside the van LAN; this
 * layout iframes the relevant tab routes (deep-linked via #hash) so all
 * the cache + offline behaviour comes for free.
 *
 * Idempotent: reuses "Van CSU Overview" layout + screen under "csu-deployment".
 *
 * Run: node server/src/seed-van-csu.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, '..', 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const STUDIO_SLUG = 'csu-deployment';
const LAYOUT_NAME = 'Van CSU Overview';
const SCREEN_NAME = 'Van — CSU Overview';

// Halio kiosk URL — inside van LAN. Override via env when seeding from
// somewhere that can't reach 10.42.42.162.
const HALIO_KIOSK = process.env.HALIO_KIOSK || 'http://10.42.42.162:8800';

const studio = db.prepare('SELECT id FROM studios WHERE slug = ?').get(STUDIO_SLUG);
if (!studio) {
  console.error(`[abort] studio '${STUDIO_SLUG}' not found — run the CSU studio seed first.`);
  process.exit(1);
}
const studioId = studio.id;

const modules = [
  // Top strip: brand · clock · live link health
  {
    id: 'mod_csu_brand', type: 'text',
    x: 0, y: 0, w: 4, h: 1,
    config: {
      text: 'CSU / VAN-01', subtitle: 'CONTROL · SUPPORT · UNIT',
      align: 'left', vertAlign: 'center',
      color: '#FFB020', fontSize: '1.4rem', fontWeight: '700',
      letterSpacing: '3px', textTransform: 'uppercase',
      background: 'linear-gradient(180deg, rgba(255,176,32,0.08), transparent)',
      padding: '0.6rem 1.2rem',
    },
  },
  {
    id: 'mod_csu_link', type: 'prism-lens',
    x: 4, y: 0, w: 5, h: 1,
    config: {
      title: 'LINK',
      endpoint: 'van-link-watch',
      display: 'inline',
      fields: ['health_label', 'signal_dbm', 'capacity_mbps', 'flaps_1h', 'van_wan_status'],
      fieldLabels: {
        health_label: 'HEALTH', signal_dbm: 'SIG', capacity_mbps: 'CAP',
        flaps_1h: 'FLAPS', van_wan_status: 'WAN',
      },
      color: '#FFB020', refreshSecs: 30,
    },
  },
  {
    id: 'mod_csu_clock', type: 'clock',
    x: 9, y: 0, w: 3, h: 1,
    config: {
      timezone: 'Europe/London',
      format24h: true, showSeconds: true, showDate: true,
      color: '#E5E8EE', background: '#0A0E1A', fontFamily: 'JetBrains Mono',
    },
  },

  // Main grid: weather/risk + strike map + cameras + incidents
  // Top half: weather (left big) + strike map (right)
  {
    id: 'mod_csu_weather', type: 'iframe',
    x: 0, y: 1, w: 7, h: 4,
    config: { url: `${HALIO_KIOSK}/#weather`, refreshInterval: 0 },
  },
  {
    id: 'mod_csu_strike_map', type: 'iframe',
    x: 7, y: 1, w: 5, h: 4,
    config: { url: `${HALIO_KIOSK}/#strike-map`, refreshInterval: 0 },
  },

  // Bottom half: cameras (left wide) + incidents (right)
  {
    id: 'mod_csu_cameras', type: 'iframe',
    x: 0, y: 5, w: 7, h: 3,
    config: { url: `${HALIO_KIOSK}/#cameras`, refreshInterval: 0 },
  },
  {
    id: 'mod_csu_incidents', type: 'iframe',
    x: 7, y: 5, w: 5, h: 3,
    config: { url: `${HALIO_KIOSK}/#incidents`, refreshInterval: 0 },
  },
];

const layout = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(studioId, LAYOUT_NAME);
const modulesJson = JSON.stringify(modules);

let layoutId;
if (layout) {
  layoutId = layout.id;
  db.prepare("UPDATE layouts SET modules = ?, grid_cols = 12, grid_rows = 8, background = '#0A0E1A', updated_at = datetime('now') WHERE id = ?")
    .run(modulesJson, layoutId);
  console.log(`[layout] updated: ${LAYOUT_NAME} (${layoutId})`);
} else {
  layoutId = uuidv4();
  db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background) VALUES (?, ?, ?, 12, 8, ?, ?)')
    .run(layoutId, studioId, LAYOUT_NAME, modulesJson, '#0A0E1A');
  console.log(`[layout] created: ${LAYOUT_NAME} (${layoutId})`);
}

const screen = db.prepare('SELECT id FROM screens WHERE studio_id = ? AND name = ?').get(studioId, SCREEN_NAME);
let screenId;
if (screen) {
  screenId = screen.id;
  db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?").run(layoutId, screenId);
  console.log(`[screen] updated: ${SCREEN_NAME} (${screenId})`);
} else {
  screenId = uuidv4();
  const maxNum = db.prepare('SELECT COALESCE(MAX(screen_number), 0) AS n FROM screens WHERE studio_id = ?').get(studioId).n;
  db.prepare('INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id) VALUES (?, ?, ?, ?, ?)')
    .run(screenId, studioId, SCREEN_NAME, maxNum + 1, layoutId);
  console.log(`[screen] created: ${SCREEN_NAME} (${screenId})`);
}

console.log('');
console.log('─'.repeat(60));
console.log('Van CSU Overview wired to halio kiosk composite.');
console.log(`Kiosk base:           ${HALIO_KIOSK}`);
console.log(`Open on van display:  /screen/${screenId}`);
console.log('─'.repeat(60));

db.close();
