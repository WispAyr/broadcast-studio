/**
 * Seed / update Broadcast Studio for Kiltwalk Dundee 2026 (Sun 16 Aug).
 * Run on small-server:
 *   cd /root/broadcast-studio/server && node kiltwalk_dundee_setup.js
 */
const Database = require('better-sqlite3');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath =
  process.env.BROADCAST_DB ||
  (fs.existsSync(path.join(__dirname, 'data/broadcast.db'))
    ? path.join(__dirname, 'data/broadcast.db')
    : path.join(__dirname, 'broadcast.db'));

const db = new Database(dbPath);
const SLUG = 'kiltwalk-dundee';

const CONFIG = {
  brand: {
    primary: '#1a1a2e',
    secondary: '#e94560',
    accent: '#0f3460',
    highlight: '#ffffff',
    tartan: true,
  },
  event: {
    name: 'Dundee Kiltwalk 2026',
    date: '2026-08-16',
    day_label: 'Sunday 16 August 2026',
    location: 'St Andrews / Broughty Ferry → Slessor Gardens, Dundee',
    routes: [
      'Mighty Stride (20.4 miles) — West Sands starts 08:30–10:30 → Slessor Gardens',
      'Wee Wander (4.3 miles) — Castle Green 10:30–11:30 → Slessor Gardens',
    ],
    waves: {
      mighty_stride: ['08:30', '09:00', '09:30', '10:00', '10:30'],
      wee_wander: ['10:30', '11:00', '11:30'],
    },
    village: {
      name: 'Kiltwalk Village — Slessor Gardens',
      what3words: 'void.rarely.luck',
      active_hours: '11:21–20:00',
      end_site_manager: 'Peter Wharton',
    },
    control_room: '07307 339 379',
    first_aid: '07307 339 406',
    headline_sponsor: 'Arnold Clark',
    prism_event_id: 'kiltwalk-dundee-2026',
    driver_zones: 6,
    critical_driver_note: 'Zone 2 PS1→PS2: long no-vehicle-access through forest/fields',
  },
};

const existing = db.prepare('SELECT id FROM studios WHERE slug = ?').get(SLUG);
let studioId;
if (existing) {
  studioId = existing.id;
  db.prepare(
    `UPDATE studios SET name = ?, config = ?, active = 1, updated_at = datetime('now') WHERE id = ?`
  ).run('Kiltwalk Dundee 2026', JSON.stringify(CONFIG), studioId);
  console.log('Updated studio', studioId, SLUG);
} else {
  studioId = uuid();
  db.prepare(
    `INSERT INTO studios (id, name, slug, config, active) VALUES (?, ?, ?, ?, 1)`
  ).run(studioId, 'Kiltwalk Dundee 2026', SLUG, JSON.stringify(CONFIG));
  console.log('Created studio', studioId, SLUG);
}

const userRow = db.prepare('SELECT id FROM users WHERE username = ?').get('kiltwalk-dundee');
const pass = process.env.KILTWALK_DUNDEE_PASS || 'KiltwalkDundee2026!';
if (!userRow) {
  const userId = uuid();
  const hash = bcrypt.hashSync(pass, 10);
  db.prepare(
    `INSERT INTO users (id, username, password, name, role, studio_id, active) VALUES (?,?,?,?,?,?,1)`
  ).run(userId, 'kiltwalk-dundee', hash, 'Kiltwalk Dundee Producer', 'admin', studioId);
  console.log('Created user kiltwalk-dundee (password set via KILTWALK_DUNDEE_PASS or default)');
} else {
  db.prepare(`UPDATE users SET studio_id = ?, active = 1, updated_at = datetime('now') WHERE id = ?`).run(
    studioId,
    userRow.id
  );
  console.log('Linked user kiltwalk-dundee → studio');
}

// Also point legacy kiltwalk user at Dundee for the weekend if desired
const legacy = db.prepare('SELECT id, studio_id FROM users WHERE username = ?').get('kiltwalk');
if (legacy) {
  console.log('Note: legacy user kiltwalk remains on studio', legacy.studio_id, '(not auto-switched)');
}

console.log('Event:', CONFIG.event.name, CONFIG.event.date);
console.log('Done. DB:', dbPath);
db.close();
