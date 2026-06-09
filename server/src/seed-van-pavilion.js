/**
 * Van Pavilion Mode — two cinematic screens for the CSU van during a Pavilion event.
 *
 *   LEFT  — "Van — Pavilion Ops Live"      (what's happening on-stage, now/next)
 *   RIGHT — "Van — Pavilion Situational"   (timeline, weather, link, safety, alerts)
 *
 * Idempotent: re-running upserts both layouts + screens under the
 * existing 'csu-deployment' studio. Run: node server/src/seed-van-pavilion.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, '..', 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const STUDIO_SLUG = 'csu-deployment';
const studio = db.prepare('SELECT id FROM studios WHERE slug = ?').get(STUDIO_SLUG);
if (!studio) {
  console.error(`[abort] studio '${STUDIO_SLUG}' not found.`);
  process.exit(1);
}
const studioId = studio.id;

const ACCENT = '#ffb020';
const PAVILION_LAT = 55.4630;
const PAVILION_LON = -4.6346;

// ─── LEFT SCREEN ──────────────────────────────────────────────────────────
const leftModules = [
  {
    id: 'mod_pav_brand_l',
    type: 'text',
    x: 0, y: 0, w: 8, h: 1,
    config: {
      text: 'CSU / VAN-01 · PAVILION OPS LIVE',
      align: 'left', vertAlign: 'center',
      color: ACCENT, fontSize: '1.4rem', fontWeight: 800,
      letterSpacing: '4px', textTransform: 'uppercase',
      background: 'linear-gradient(180deg, rgba(255,176,32,0.10), transparent)',
      padding: '0.6rem 1.4rem',
    },
  },
  {
    id: 'mod_pav_clock_l',
    type: 'clock',
    x: 8, y: 0, w: 4, h: 1,
    config: {
      timezone: 'Europe/London',
      format24h: true, showSeconds: true, showDate: true,
      color: '#E5E8EE', background: '#0A0E1A', fontFamily: 'JetBrains Mono',
    },
  },

  // Hero: cinematic Now / Next per stage
  {
    id: 'mod_pav_nownext',
    type: 'pavilion_now_next',
    x: 0, y: 1, w: 12, h: 5,
    config: {
      eventTitle: 'Pavilion Festival 2026',
      accentColor: ACCENT,
      showStaleBadge: true,
    },
  },

  // Bottom strip: chronological 90-minute lookahead
  {
    id: 'mod_pav_next90',
    type: 'pavilion_next_90',
    x: 0, y: 6, w: 8, h: 2,
    config: {
      windowMinutes: 90,
      accentColor: ACCENT,
    },
  },

  // Bottom right: live Pavilion-area weather (siphon)
  {
    id: 'mod_pav_weather_l',
    type: 'siphon-weather',
    x: 8, y: 6, w: 4, h: 2,
    config: {
      preset: 'weather',
      label: 'PAVILION WX',
      refreshSecs: 60,
    },
  },
];

// ─── RIGHT SCREEN ─────────────────────────────────────────────────────────
const rightModules = [
  {
    id: 'mod_pav_brand_r',
    type: 'text',
    x: 0, y: 0, w: 8, h: 1,
    config: {
      text: 'CSU / VAN-01 · PAVILION SITUATIONAL',
      align: 'left', vertAlign: 'center',
      color: ACCENT, fontSize: '1.4rem', fontWeight: 800,
      letterSpacing: '4px', textTransform: 'uppercase',
      background: 'linear-gradient(180deg, rgba(255,176,32,0.10), transparent)',
      padding: '0.6rem 1.4rem',
    },
  },
  {
    id: 'mod_pav_clock_r',
    type: 'clock',
    x: 8, y: 0, w: 4, h: 1,
    config: {
      timezone: 'Europe/London',
      format24h: true, showSeconds: true, showDate: true,
      color: '#E5E8EE', background: '#0A0E1A', fontFamily: 'JetBrains Mono',
    },
  },

  // Hero left: full-day timeline across all stages
  {
    id: 'mod_pav_timeline',
    type: 'pavilion_timeline',
    x: 0, y: 1, w: 8, h: 4,
    config: {
      day: 'auto',
      accentColor: ACCENT,
    },
  },

  // Hero right top: weather card
  {
    id: 'mod_pav_weather_r',
    type: 'siphon-weather',
    x: 8, y: 1, w: 4, h: 2,
    config: {
      preset: 'weather',
      label: 'WX · LOW GREEN',
      refreshSecs: 60,
    },
  },

  // Hero right bottom: AQI card (crowd-relevant)
  {
    id: 'mod_pav_aqi',
    type: 'siphon-aqi',
    x: 8, y: 3, w: 4, h: 2,
    config: {
      preset: 'aqi',
      label: 'AIR QUALITY',
      refreshSecs: 120,
    },
  },

  // Bottom strip 1: van link / comms capability
  {
    id: 'mod_pav_link',
    type: 'prism-lens',
    x: 0, y: 5, w: 4, h: 2,
    config: {
      title: 'VAN · COMMS LINK',
      endpoint: 'van-link-watch',
      display: 'list',
      fields: ['health_label', 'capacity_mbps', 'signal_dbm', 'flaps_1h', 'van_wan_status', 'van_upstream_via'],
      fieldLabels: {
        health_label: 'HEALTH',
        capacity_mbps: 'CAPACITY (Mbps)',
        signal_dbm: 'SIGNAL (dBm)',
        flaps_1h: 'FLAPS / 1h',
        van_wan_status: 'WAN',
        van_upstream_via: 'UPSTREAM',
      },
      color: ACCENT,
      refreshSecs: 30,
    },
  },

  // Bottom strip 2: current safety state (defaults to welfare info, switchable on demand)
  {
    id: 'mod_pav_safety',
    type: 'pavilion_safety',
    x: 4, y: 5, w: 4, h: 2,
    config: {
      preset: 'welfare',
      welfareLocation: 'welfare tent (north-east of main stage)',
      welfareHours: 'open all event hours',
      accentColor: ACCENT,
    },
  },

  // Bottom strip 3: incoming weather radar (Windy embed)
  {
    id: 'mod_pav_radar',
    type: 'weather_radar',
    x: 8, y: 5, w: 4, h: 2,
    config: {
      lat: PAVILION_LAT,
      lon: PAVILION_LON,
      zoom: 9,
    },
  },

  // Footer ticker: alerts (Nuro live + manual)
  {
    id: 'mod_pav_alerts',
    type: 'alert_ticker',
    x: 0, y: 7, w: 12, h: 1,
    config: {
      mode: 'scroll',
      speed: 35,
      background: '#0A0E1A',
      alerts: [
        { id: 'pavilion_default', text: 'PAVILION FESTIVAL 2026 · Low Green, Ayr · Welfare open all event hours · First aid at welfare tent · Dial 999 in an emergency and quote "Pavilion Festival, Low Green Ayr"', severity: 'info' },
      ],
    },
  },
];

// ─── upsert helpers ───────────────────────────────────────────────────────
function upsertLayout(name, modules) {
  const existing = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(studioId, name);
  const modulesJson = JSON.stringify(modules);
  let layoutId;
  if (existing) {
    layoutId = existing.id;
    db.prepare(`UPDATE layouts
                SET modules = ?, grid_cols = 12, grid_rows = 8,
                    background = '#0A0E1A', orientation = 'landscape',
                    resolution_w = 1920, resolution_h = 1080,
                    updated_at = datetime('now')
                WHERE id = ?`).run(modulesJson, layoutId);
    console.log(`[layout] updated: ${name}  (${layoutId})`);
  } else {
    layoutId = uuidv4();
    db.prepare(`INSERT INTO layouts
                  (id, studio_id, name, grid_cols, grid_rows, modules,
                   background, orientation, resolution_w, resolution_h)
                VALUES (?, ?, ?, 12, 8, ?, '#0A0E1A', 'landscape', 1920, 1080)`)
      .run(layoutId, studioId, name, modulesJson);
    console.log(`[layout] created: ${name}  (${layoutId})`);
  }
  return layoutId;
}

function upsertScreen(name, layoutId) {
  const existing = db.prepare('SELECT id FROM screens WHERE studio_id = ? AND name = ?').get(studioId, name);
  let screenId;
  if (existing) {
    screenId = existing.id;
    db.prepare(`UPDATE screens
                SET current_layout_id = ?, orientation = 'landscape',
                    width = 1920, height = 1080, updated_at = datetime('now')
                WHERE id = ?`).run(layoutId, screenId);
    console.log(`[screen] updated: ${name}  (${screenId})`);
  } else {
    screenId = uuidv4();
    const maxNum = db.prepare('SELECT COALESCE(MAX(screen_number),0) AS n FROM screens WHERE studio_id = ?').get(studioId).n;
    db.prepare(`INSERT INTO screens
                  (id, studio_id, name, screen_number, current_layout_id,
                   orientation, width, height)
                VALUES (?, ?, ?, ?, ?, 'landscape', 1920, 1080)`)
      .run(screenId, studioId, name, maxNum + 1, layoutId);
    console.log(`[screen] created: ${name}  (${screenId})`);
  }
  return screenId;
}

const leftLayout = upsertLayout('Van Pavilion · Ops Live', leftModules);
const rightLayout = upsertLayout('Van Pavilion · Situational', rightModules);

const leftScreen = upsertScreen('Van — Pavilion Ops Live', leftLayout);
const rightScreen = upsertScreen('Van — Pavilion Situational', rightLayout);

console.log('');
console.log('─'.repeat(72));
console.log('VAN PAVILION MODE WIRED.');
console.log('─'.repeat(72));
console.log('LEFT  kiosk URL:  https://broadcast.studio.wispayr.online/screen/' + leftScreen);
console.log('RIGHT kiosk URL:  https://broadcast.studio.wispayr.online/screen/' + rightScreen);
console.log('─'.repeat(72));

db.close();
