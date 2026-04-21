/**
 * Van CSU Overview — live telemetry layout for the CSU van display.
 *
 * Replaces the previous all-static "30 FPS / CPU 24% / SESSION CSU-------" mock
 * with real sources:
 *   - prism-lens van-link-watch (Starlink/WG link health)
 *   - iframe of broadcast.studio.wispayr.online/player/van-spectrum/
 *     (already aggregates 11 prism lenses — RF, cameras, weather, AQI, radiation)
 *   - Clock + brand + title
 *
 * Idempotent: reuses the existing "Van CSU Overview" layout + "Van — CSU Overview"
 * screen under the "CSU Deployment" studio; only replaces the modules array.
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

const studio = db.prepare('SELECT id FROM studios WHERE slug = ?').get(STUDIO_SLUG);
if (!studio) {
  console.error(`[abort] studio '${STUDIO_SLUG}' not found — run the CSU studio seed first.`);
  process.exit(1);
}
const studioId = studio.id;

const modules = [
  {
    id: 'mod_csu_brand',
    type: 'text',
    x: 0, y: 0, w: 4, h: 1,
    config: {
      text: 'CSU / VAN-01',
      subtitle: 'CONTROL · SUPPORT · UNIT',
      align: 'left', vertAlign: 'center',
      color: '#FFB020', fontSize: '1.4rem', fontWeight: '700',
      letterSpacing: '3px', textTransform: 'uppercase',
      background: 'linear-gradient(180deg, rgba(255,176,32,0.08), transparent)',
      padding: '0.6rem 1.2rem',
    },
  },
  {
    id: 'mod_csu_title',
    type: 'text',
    x: 4, y: 0, w: 4, h: 1,
    config: {
      text: 'VAN OPERATIONS · LIVE',
      align: 'center', vertAlign: 'center',
      color: '#7A8196', fontSize: '0.85rem',
      letterSpacing: '6px', textTransform: 'uppercase',
      fontWeight: '600', background: '#0A0E1A',
    },
  },
  {
    id: 'mod_csu_clock',
    type: 'clock',
    x: 8, y: 0, w: 4, h: 1,
    config: {
      timezone: 'Europe/London',
      format24h: true, showSeconds: true, showDate: true,
      color: '#E5E8EE', background: '#0A0E1A', fontFamily: 'JetBrains Mono',
    },
  },

  // Left column: live link status from prism van-link-watch lens
  {
    id: 'mod_csu_link',
    type: 'prism-lens',
    x: 0, y: 1, w: 4, h: 4,
    config: {
      title: 'LINK STATUS',
      endpoint: 'van-link-watch',
      display: 'list',
      fields: ['health_label', 'link_up', 'signal_dbm', 'ccq_pct', 'capacity_mbps', 'flaps_1h', 'van_wan_status', 'van_upstream_via'],
      fieldLabels: {
        health_label: 'HEALTH',
        link_up: 'LINK UP',
        signal_dbm: 'SIGNAL (dBm)',
        ccq_pct: 'CCQ %',
        capacity_mbps: 'CAPACITY (Mbps)',
        flaps_1h: 'FLAPS/1h',
        van_wan_status: 'WAN',
        van_upstream_via: 'UPSTREAM',
      },
      color: '#FFB020',
      refreshSecs: 30,
    },
  },

  // Left bottom: static ref info that rarely changes
  {
    id: 'mod_csu_refs',
    type: 'text',
    x: 0, y: 5, w: 4, h: 3,
    config: {
      text: 'NODE',
      subtitle: 'WireGuard       10.200.0.20\nVan LAN         192.168.1.0/24\nNVR RTSP        192.168.1.56:554\nHub             small-server\nReticulum       TCP :4965',
      align: 'left', vertAlign: 'top',
      color: '#FFB020', fontSize: '0.85rem', fontWeight: '700',
      letterSpacing: '3px', textTransform: 'uppercase',
      background: '#12172B', padding: '1rem 1.2rem', whiteSpace: 'pre-line',
    },
  },

  // Right side: Spectrum Dominance dashboard (aggregates RF, cameras, weather lenses)
  {
    id: 'mod_csu_spectrum',
    type: 'iframe',
    x: 4, y: 1, w: 8, h: 7,
    config: {
      url: 'https://broadcast.studio.wispayr.online/player/van-spectrum/',
      refreshInterval: 0,
    },
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
console.log('Van CSU Overview wired to live sources.');
console.log(`Open on van display:  /screen/${screenId}`);
console.log('─'.repeat(60));

db.close();
