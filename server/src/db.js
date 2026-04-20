const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'broadcast.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS studios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'producer', 'viewer')),
    studio_id TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id)
  );

  CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    screen_number INTEGER NOT NULL,
    current_layout_id TEXT,
    is_online INTEGER DEFAULT 0,
    last_seen TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id),
    FOREIGN KEY (current_layout_id) REFERENCES layouts(id)
  );

  CREATE TABLE IF NOT EXISTS shows (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    timeline TEXT DEFAULT '[]',
    active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id)
  );

  CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    grid_cols INTEGER DEFAULT 3,
    grid_rows INTEGER DEFAULT 3,
    modules TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id)
  );

  CREATE TABLE IF NOT EXISTS autocue_scripts (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Untitled Script',
    content TEXT DEFAULT '',
    speed INTEGER DEFAULT 40,
    font_size TEXT DEFAULT '2rem',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id)
  );

  CREATE TABLE IF NOT EXISTS module_types (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    icon TEXT,
    default_config TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS counters (
    id TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS variables (
    id TEXT NOT NULL,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('number','string','boolean','enum','json')),
    value TEXT,
    default_value TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (studio_id, id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    scopes TEXT DEFAULT '[]',
    active INTEGER DEFAULT 1,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
  );
`);

// Seed function
function seed() {
  const studioCount = db.prepare('SELECT COUNT(*) as count FROM studios').get();
  if (studioCount.count > 0) return;

  console.log('Seeding database...');

  const studioId = uuidv4();

  // Insert studio
  db.prepare(`
    INSERT INTO studios (id, name, slug, active) VALUES (?, ?, ?, ?)
  `).run(studioId, 'Now Ayrshire Radio', 'now-ayrshire', 1);

  // Insert super admin user
  const adminId = uuidv4();
  const adminPassword = bcrypt.hashSync('BroadcastAdmin2026!', 10);
  db.prepare(`
    INSERT INTO users (id, username, password, name, role, studio_id) VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin', adminPassword, 'Super Admin', 'super_admin', null);

  // Insert producer user
  const producerId = uuidv4();
  const producerPassword = bcrypt.hashSync('Producer2026!', 10);
  db.prepare(`
    INSERT INTO users (id, username, password, name, role, studio_id) VALUES (?, ?, ?, ?, ?, ?)
  `).run(producerId, 'producer', producerPassword, 'NAR Producer', 'producer', studioId);

  // Insert 3 screens
  const screen1Id = uuidv4();
  const screen2Id = uuidv4();
  const screen3Id = uuidv4();
  db.prepare(`
    INSERT INTO screens (id, studio_id, name, screen_number) VALUES (?, ?, ?, ?)
  `).run(screen1Id, studioId, 'Presenter Monitor', 1);
  db.prepare(`
    INSERT INTO screens (id, studio_id, name, screen_number) VALUES (?, ?, ?, ?)
  `).run(screen2Id, studioId, 'Guest Monitor', 2);
  db.prepare(`
    INSERT INTO screens (id, studio_id, name, screen_number) VALUES (?, ?, ?, ?)
  `).run(screen3Id, studioId, 'Studio Wall', 3);
  db.prepare(`
    INSERT INTO screens (id, studio_id, name, screen_number) VALUES (?, ?, ?, ?)
  `).run(uuidv4(), studioId, 'Pavilion LED', 4);

  // Insert 3 layouts
  const layout1Id = uuidv4();
  const layout2Id = uuidv4();
  const layout3Id = uuidv4();

  const defaultModules = JSON.stringify([
    { type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {} },
    { type: 'weather', x: 1, y: 0, w: 1, h: 1, config: {} },
    { type: 'text', x: 0, y: 1, w: 3, h: 1, config: { text: 'Now Ayrshire Radio' } },
    { type: 'image', x: 2, y: 0, w: 1, h: 1, config: {} }
  ]);

  const breakingModules = JSON.stringify([
    { type: 'breaking_news', x: 0, y: 0, w: 3, h: 1, config: {} },
    { type: 'clock', x: 0, y: 1, w: 1, h: 1, config: {} },
    { type: 'text', x: 1, y: 1, w: 2, h: 1, config: {} },
    { type: 'alert_ticker', x: 0, y: 2, w: 3, h: 1, config: {} }
  ]);

  const musicModules = JSON.stringify([
    { type: 'clock', x: 0, y: 0, w: 1, h: 1, config: {} },
    { type: 'image', x: 1, y: 0, w: 1, h: 1, config: {} },
    { type: 'text', x: 0, y: 1, w: 2, h: 1, config: { text: '\u266a Now Playing \u266a' } }
  ]);

  db.prepare(`
    INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, ?, ?, ?)
  `).run(layout1Id, studioId, 'Default', 3, 3, defaultModules);
  db.prepare(`
    INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, ?, ?, ?)
  `).run(layout2Id, studioId, 'Breaking News', 3, 3, breakingModules);
  db.prepare(`
    INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, ?, ?, ?)
  `).run(layout3Id, studioId, 'Music Only', 2, 2, musicModules);

  // Insert show with timeline referencing layout IDs
  const showId = uuidv4();
  const timeline = JSON.stringify([
    { time: '06:00', layout_id: layout1Id, label: 'Show Open' },
    { time: '07:00', layout_id: layout2Id, label: 'News Hour' },
    { time: '08:00', layout_id: layout3Id, label: 'Music Block' }
  ]);
  db.prepare(`
    INSERT INTO shows (id, studio_id, name, description, timeline, active) VALUES (?, ?, ?, ?, ?, ?)
  `).run(showId, studioId, 'Breakfast Show', 'Morning breakfast show 6am-10am', timeline, 0);

  // Insert all 16 module types
  const moduleTypes = [
    { name: 'clock', description: 'Digital/analog clock display', category: 'time', icon: '\u23f0' },
    { name: 'weather', description: 'Current conditions & forecast', category: 'data', icon: '\ud83c\udf24' },
    { name: 'youtube', description: 'YouTube video embed', category: 'media', icon: '\u25b6' },
    { name: 'media', description: 'Local video/image display', category: 'media', icon: '\ud83c\udfac' },
    { name: 'autocue', description: 'Scrolling teleprompter script', category: 'broadcast', icon: '\ud83d\udcdc' },
    { name: 'social', description: 'Social media feed', category: 'broadcast', icon: '\ud83d\udcac' },
    { name: 'breaking_news', description: 'Breaking news banner', category: 'broadcast', icon: '\ud83d\udd34' },
    { name: 'travel', description: 'Traffic & transport info', category: 'data', icon: '\ud83d\ude97' },
    { name: 'countdown', description: 'Event countdown timer', category: 'time', icon: '\u23f1' },
    { name: 'iframe', description: 'Embed any URL', category: 'media', icon: '\ud83c\udf10' },
    { name: 'text', description: 'Static/scrolling text', category: 'broadcast', icon: '\ud83d\udcdd' },
    { name: 'image', description: 'Static image display', category: 'media', icon: '\ud83d\uddbc' },
    { name: 'weather_radar', description: 'Weather radar map', category: 'situational', icon: '\ud83d\udef0' },
    { name: 'aircraft_tracker', description: 'ADS-B aircraft tracker', category: 'situational', icon: '\u2708' },
    { name: 'camera_feed', description: 'Live camera stream', category: 'situational', icon: '\ud83d\udcf7' },
    { name: 'alert_ticker', description: 'Rolling alert ticker', category: 'situational', icon: '\u26a0' },
    { name: 'time_local', description: 'Time Local Connect clock (14 modes)', category: 'time', icon: '\ud83d\udd70' },
    { name: 'rss_feed', description: 'RSS feed display (ticker/cards/list)', category: 'data', icon: '\ud83d\udcf0' },
    { name: 'news_ticker', description: 'Scrolling news ticker from RSS feeds', category: 'data', icon: '\ud83d\udcf0' },
    { name: 'social_embed', description: 'Embedded social media timeline', category: 'broadcast', icon: '\ud83d\udcf1' },
    { name: 'web_source', description: 'Generic URL embed with auto-refresh', category: 'media', icon: '\ud83c\udf10' },
    { name: 'youtube_player', description: 'YouTube video/live/playlist player', category: 'media', icon: '\u25b6\ufe0f' }
  ];

  const insertModule = db.prepare(`
    INSERT OR IGNORE INTO module_types (id, name, description, category, icon, default_config) VALUES (?, ?, ?, ?, ?, '{}')
  `);

  for (const mod of moduleTypes) {
    insertModule.run(uuidv4(), mod.name, mod.description, mod.category, mod.icon);
  }

  console.log('Database seeded successfully.');
}

// Ensure new module types exist (runs on every startup, not just seed)
function ensureModuleTypes() {
  const newTypes = [
    { name: 'time_local', description: 'Time Local Connect clock (14 modes)', category: 'time', icon: '🕰' },
    { name: 'rss_feed', description: 'RSS feed display (ticker/cards/list)', category: 'data', icon: '📰' },
    { name: 'news_ticker', description: 'Scrolling news ticker from RSS feeds', category: 'data', icon: '📰' },
    { name: 'social_embed', description: 'Embedded social media timeline', category: 'broadcast', icon: '📱' },
    { name: 'web_source', description: 'Generic URL embed with auto-refresh', category: 'media', icon: '🌐' },
    { name: 'youtube_player', description: 'YouTube video/live/playlist player', category: 'media', icon: '▶️' },
    { name: 'slideshow', description: 'Image slideshow with transitions', category: 'media', icon: '🎞' },
    { name: 'live_text', description: 'Live text overlay (lower-third/banner)', category: 'broadcast', icon: '💬' },
    { name: 'qrcode', description: 'QR code display', category: 'broadcast', icon: '📱' },
    { name: 'visualizer', description: 'Music visualizer with audio-reactive modes', category: 'broadcast', icon: '🎵' },
    { name: 'surface_carousel', description: 'Rotating iframe carousel for live.wispayr.online office wall views', category: 'media', icon: '🖥' },
  ];

  const insertOrIgnore = db.prepare(`
    INSERT OR IGNORE INTO module_types (id, name, description, category, icon, default_config) VALUES (?, ?, ?, ?, ?, '{}')
  `);

  for (const mod of newTypes) {
    insertOrIgnore.run(uuidv4(), mod.name, mod.description, mod.category, mod.icon);
  }
}

// Run on import to ensure module types are always present
ensureModuleTypes();

// Schema migrations — add missing columns safely
(function runMigrations() {
  const cols = db.prepare("PRAGMA table_info(screens)").all().map(c => c.name);
  if (!cols.includes('config')) db.exec("ALTER TABLE screens ADD COLUMN config TEXT DEFAULT '{}'");
  if (!cols.includes('orientation')) db.exec("ALTER TABLE screens ADD COLUMN orientation TEXT DEFAULT 'landscape'");
  if (!cols.includes('width')) db.exec("ALTER TABLE screens ADD COLUMN width INTEGER");
  if (!cols.includes('height')) db.exec("ALTER TABLE screens ADD COLUMN height INTEGER");
  if (!cols.includes('group_id')) db.exec("ALTER TABLE screens ADD COLUMN group_id TEXT");

  // Screen groups table
  db.exec(`CREATE TABLE IF NOT EXISTS screen_groups (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    profile TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id)
  )`);

  // Layouts: ensure background column exists
  const layoutCols = db.prepare("PRAGMA table_info(layouts)").all().map(c => c.name);
  if (!layoutCols.includes('background')) db.exec("ALTER TABLE layouts ADD COLUMN background TEXT DEFAULT '#000000'");
})();

// Helper functions
function getStudioById(id) {
  return db.prepare('SELECT * FROM studios WHERE id = ?').get(id);
}

function getAllStudios() {
  return db.prepare('SELECT * FROM studios WHERE active = 1').all();
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserById(id) {
  return db.prepare('SELECT id, username, name, role, studio_id, active, created_at, updated_at FROM users WHERE id = ?').get(id);
}

function getScreensByStudio(studioId) {
  return db.prepare('SELECT * FROM screens WHERE studio_id = ?').all(studioId);
}

function getScreenById(id) {
  return db.prepare('SELECT * FROM screens WHERE id = ?').get(id);
}

function getLayoutsByStudio(studioId) {
  return db.prepare('SELECT * FROM layouts WHERE studio_id = ?').all(studioId);
}

function getLayoutById(id) {
  return db.prepare('SELECT * FROM layouts WHERE id = ?').get(id);
}

function getShowsByStudio(studioId) {
  return db.prepare('SELECT * FROM shows WHERE studio_id = ?').all(studioId);
}

function getShowById(id) {
  return db.prepare('SELECT * FROM shows WHERE id = ?').get(id);
}

function getAllModuleTypes() {
  return db.prepare('SELECT * FROM module_types ORDER BY name').all();
}

// Counter helpers — persistent across server restarts
function getCounter(id) {
  const row = db.prepare('SELECT value FROM counters WHERE id = ?').get(id);
  return row ? row.value : 0;
}

function setCounter(id, value) {
  db.prepare(`
    INSERT INTO counters (id, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(id, value);
  // Keep in-memory cache in sync
  if (!global._counterState) global._counterState = {};
  global._counterState[id] = value;
  return value;
}

function bumpCounter(id, delta = 1) {
  const current = getCounter(id);
  return setCounter(id, current + delta);
}

function resetCounter(id) {
  return setCounter(id, 0);
}

function getAllCounters() {
  return db.prepare('SELECT id, value FROM counters').all();
}

// Warm up in-memory counter cache from DB on startup
(function warmCounterCache() {
  try {
    if (!global._counterState) global._counterState = {};
    const rows = db.prepare('SELECT id, value FROM counters').all();
    for (const row of rows) {
      global._counterState[row.id] = row.value;
    }
    if (rows.length > 0) console.log(`[counters] Restored ${rows.length} counter(s) from DB`);
  } catch { /* table may not exist yet on first run */ }
})();

// ─── Variables ───────────────────────────────────────────────────────────────

function serializeVariableValue(kind, value) {
  if (value === null || value === undefined) return null;
  if (kind === 'number') return String(Number(value));
  if (kind === 'boolean') return value ? '1' : '0';
  if (kind === 'string') return String(value);
  return JSON.stringify(value);
}

function deserializeVariableValue(kind, raw) {
  if (raw === null || raw === undefined) return null;
  if (kind === 'number') return Number(raw);
  if (kind === 'boolean') return raw === '1' || raw === 'true';
  if (kind === 'string') return String(raw);
  try { return JSON.parse(raw); } catch { return raw; }
}

function hydrateVariable(row) {
  if (!row) return null;
  return {
    id: row.id,
    studio_id: row.studio_id,
    name: row.name,
    kind: row.kind,
    value: deserializeVariableValue(row.kind, row.value),
    default_value: deserializeVariableValue(row.kind, row.default_value),
    metadata: (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })(),
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function getVariablesByStudio(studioId) {
  return db.prepare('SELECT * FROM variables WHERE studio_id = ? ORDER BY id').all(studioId).map(hydrateVariable);
}

function getVariable(studioId, id) {
  return hydrateVariable(db.prepare('SELECT * FROM variables WHERE studio_id = ? AND id = ?').get(studioId, id));
}

function createVariable(studioId, { id, name, kind, value, default_value, metadata }) {
  const validKinds = ['number', 'string', 'boolean', 'enum', 'json'];
  if (!validKinds.includes(kind)) throw new Error(`invalid kind: ${kind}`);
  const v = serializeVariableValue(kind === 'enum' ? 'string' : kind, value);
  const d = serializeVariableValue(kind === 'enum' ? 'string' : kind, default_value ?? value);
  db.prepare(`
    INSERT INTO variables (id, studio_id, name, kind, value, default_value, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, studioId, name, kind, v, d, JSON.stringify(metadata || {}));
  return getVariable(studioId, id);
}

function setVariableValue(studioId, id, value) {
  const existing = db.prepare('SELECT kind FROM variables WHERE studio_id = ? AND id = ?').get(studioId, id);
  if (!existing) return null;
  const serialized = serializeVariableValue(existing.kind === 'enum' ? 'string' : existing.kind, value);
  db.prepare(`UPDATE variables SET value = ?, updated_at = datetime('now') WHERE studio_id = ? AND id = ?`)
    .run(serialized, studioId, id);
  return getVariable(studioId, id);
}

function bumpVariable(studioId, id, delta = 1) {
  const existing = getVariable(studioId, id);
  if (!existing) return null;
  if (existing.kind !== 'number') throw new Error(`variable ${id} is ${existing.kind}, cannot bump`);
  return setVariableValue(studioId, id, (existing.value || 0) + Number(delta));
}

function resetVariable(studioId, id) {
  const existing = getVariable(studioId, id);
  if (!existing) return null;
  return setVariableValue(studioId, id, existing.default_value);
}

function updateVariableMeta(studioId, id, { name, metadata, default_value }) {
  const existing = getVariable(studioId, id);
  if (!existing) return null;
  const newDefault = default_value !== undefined
    ? serializeVariableValue(existing.kind === 'enum' ? 'string' : existing.kind, default_value)
    : null;
  db.prepare(`
    UPDATE variables SET
      name = COALESCE(?, name),
      metadata = COALESCE(?, metadata),
      default_value = COALESCE(?, default_value),
      updated_at = datetime('now')
    WHERE studio_id = ? AND id = ?
  `).run(name || null, metadata !== undefined ? JSON.stringify(metadata) : null, newDefault, studioId, id);
  return getVariable(studioId, id);
}

function deleteVariable(studioId, id) {
  const result = db.prepare('DELETE FROM variables WHERE studio_id = ? AND id = ?').run(studioId, id);
  return result.changes > 0;
}

// ─── API keys ────────────────────────────────────────────────────────────────

function getApiKeyByHash(keyHash) {
  return db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').get(keyHash);
}

function getApiKeysByStudio(studioId) {
  return db.prepare('SELECT id, studio_id, name, key_prefix, scopes, active, last_used_at, created_at FROM api_keys WHERE studio_id = ? ORDER BY created_at DESC').all(studioId);
}

function createApiKey({ id, studio_id, name, key_hash, key_prefix, scopes }) {
  db.prepare(`
    INSERT INTO api_keys (id, studio_id, name, key_hash, key_prefix, scopes, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).run(id, studio_id, name, key_hash, key_prefix, JSON.stringify(scopes || []));
  return db.prepare('SELECT id, studio_id, name, key_prefix, scopes, active, created_at FROM api_keys WHERE id = ?').get(id);
}

function touchApiKey(id) {
  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(id);
}

function revokeApiKey(id) {
  const r = db.prepare('UPDATE api_keys SET active = 0 WHERE id = ?').run(id);
  return r.changes > 0;
}

module.exports = {
  db,
  seed,
  getStudioById,
  getAllStudios,
  getUserByUsername,
  getUserById,
  getScreensByStudio,
  getScreenById,
  getLayoutsByStudio,
  getLayoutById,
  getShowsByStudio,
  getShowById,
  getAllModuleTypes,
  getCounter,
  setCounter,
  bumpCounter,
  resetCounter,
  getAllCounters,
  // Variables
  getVariablesByStudio,
  getVariable,
  createVariable,
  setVariableValue,
  bumpVariable,
  resetVariable,
  updateVariableMeta,
  deleteVariable,
  // API keys
  getApiKeyByHash,
  getApiKeysByStudio,
  createApiKey,
  touchApiKey,
  revokeApiKey,
};
