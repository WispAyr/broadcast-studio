/**
 * Sets up Kevin Paterson's "Command Center" as a client in Broadcast Studio:
 *   customer → site → studio, an admin login scoped to that studio, 5 screens
 *   (his wall), an aviation/EGPK layout pack, a few one-click screen scenes, and
 *   a "Screen Control" Stream-Deck surface. Also grants any EGPK layouts you
 *   already own to his studio so they show in his picker.
 *
 * INERT + idempotent: writes DB rows only. It never fires a button, emits a
 * socket, or sets screens.current_layout_id — nothing appears on Kevin's screens
 * until he (the operator of his own studio) presses a button. Re-running reuses
 * everything by name/slug and only fills gaps. Per feedback_bs_live_operator_only.
 *
 * Run:  node server/seed-kevin-command.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Ensure the tables/columns we touch exist (mirrors the app's own DDL so this
//    is safe to run standalone). All IF NOT EXISTS / try-guarded ALTERs. ──
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS resource_grants (id TEXT PRIMARY KEY, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL,
    grantee_type TEXT NOT NULL, grantee_id TEXT NOT NULL, permission TEXT DEFAULT 'use',
    created_at TEXT DEFAULT (datetime('now')), UNIQUE (resource_type, resource_id, grantee_type, grantee_id));
  CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, studio_id TEXT NOT NULL, name TEXT NOT NULL,
    grid_cols INTEGER DEFAULT 6, grid_rows INTEGER DEFAULT 4, status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS screen_groups (id TEXT PRIMARY KEY, studio_id TEXT NOT NULL, name TEXT NOT NULL,
    profile TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS screen_scenes (id TEXT PRIMARY KEY, studio_id TEXT NOT NULL, name TEXT NOT NULL,
    description TEXT, icon TEXT, assignments TEXT NOT NULL DEFAULT '[]', sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')));
`);
const tryExec = (sql) => { try { db.exec(sql); } catch { /* already applied */ } };
tryExec("ALTER TABLE studios ADD COLUMN site_id TEXT");
tryExec("ALTER TABLE studios ADD COLUMN public_only INTEGER DEFAULT 0");
tryExec("ALTER TABLE screens ADD COLUMN group_id TEXT");
tryExec("ALTER TABLE screens ADD COLUMN orientation TEXT DEFAULT 'landscape'");
tryExec("ALTER TABLE screens ADD COLUMN config TEXT DEFAULT '{}'");
tryExec("ALTER TABLE screens ADD COLUMN accepts_broadcasts INTEGER DEFAULT 1");
tryExec("ALTER TABLE layouts ADD COLUMN project TEXT");
tryExec("ALTER TABLE layouts ADD COLUMN visibility TEXT DEFAULT 'private'");
tryExec("ALTER TABLE layouts ADD COLUMN background TEXT DEFAULT '#000000'");
for (const c of ['deck_id TEXT', 'x INTEGER DEFAULT 0', 'y INTEGER DEFAULT 0', 'w INTEGER DEFAULT 1',
                 'h INTEGER DEFAULT 1', 'target TEXT']) tryExec(`ALTER TABLE console_buttons ADD COLUMN ${c}`);

const log = [];
const note = (m) => { log.push(m); console.log(m); };
const getOne = (sql, ...a) => db.prepare(sql).get(...a);

// ── 1. Customer → Site → Studio ──────────────────────────────────────────────
let customer = getOne("SELECT * FROM customers WHERE slug = 'kevin-paterson'");
if (!customer) { const id = uuid(); db.prepare("INSERT INTO customers (id, name, slug) VALUES (?,?,?)").run(id, 'Kevin Paterson', 'kevin-paterson'); customer = getOne('SELECT * FROM customers WHERE id = ?', id); note('customer: created Kevin Paterson'); }
else note('customer: reused Kevin Paterson');

let site = getOne("SELECT * FROM sites WHERE customer_id = ? AND slug = 'command-center'", customer.id);
if (!site) { const id = uuid(); db.prepare("INSERT INTO sites (id, customer_id, name, slug) VALUES (?,?,?,?)").run(id, customer.id, 'Command Center', 'command-center'); site = getOne('SELECT * FROM sites WHERE id = ?', id); note('site: created Command Center'); }
else note('site: reused Command Center');

let studio = getOne("SELECT * FROM studios WHERE slug = 'kevin-command'");
if (!studio) { const id = uuid(); db.prepare("INSERT INTO studios (id, name, slug, active, site_id, public_only) VALUES (?,?,?,1,?,0)").run(id, 'Command Center', 'kevin-command', site.id); studio = getOne('SELECT * FROM studios WHERE id = ?', id); note('studio: created Command Center (kevin-command)'); }
else { db.prepare('UPDATE studios SET site_id = COALESCE(site_id, ?) WHERE id = ?').run(site.id, studio.id); note('studio: reused Command Center'); }
const studioId = studio.id;

// ── 2. Kevin's login (studio-scoped admin — can drive HIS wall, sees only his studio) ──
let user = getOne("SELECT * FROM users WHERE username = 'kevin'");
let tempPassword = null;
if (!user) {
  tempPassword = 'EGPK-' + crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(2).toString('hex');
  const id = uuid();
  db.prepare("INSERT INTO users (id, username, password, name, role, studio_id) VALUES (?,?,?,?,?,?)")
    .run(id, 'kevin', bcrypt.hashSync(tempPassword, 10), 'Kevin Paterson', 'admin', studioId);
  note('user: created kevin (studio admin)');
} else { note('user: reused kevin (password unchanged)'); }

// ── 3. Screen group + 5 screens (his wall). Left monitor is portrait. ─────────
let group = getOne("SELECT * FROM screen_groups WHERE studio_id = ? AND name = 'Command Wall'", studioId);
if (!group) { const id = uuid(); db.prepare("INSERT INTO screen_groups (id, studio_id, name) VALUES (?,?,?)").run(id, studioId, 'Command Wall'); group = getOne('SELECT * FROM screen_groups WHERE id = ?', id); note('group: created Command Wall'); }
else note('group: reused Command Wall');

const SCREENS = [
  { n: 1, name: 'Overhead — Situation', orientation: 'landscape' },
  { n: 2, name: 'Left — Military / Prestwick', orientation: 'portrait' },
  { n: 3, name: 'Centre — Radar / Movements', orientation: 'landscape' },
  { n: 4, name: 'Right — Command', orientation: 'landscape' },
  { n: 5, name: 'Aux — Weather / News', orientation: 'landscape' },
];
const screenIdByNumber = {};
for (const s of SCREENS) {
  let row = getOne('SELECT * FROM screens WHERE studio_id = ? AND screen_number = ?', studioId, s.n);
  if (!row) {
    const id = uuid();
    db.prepare("INSERT INTO screens (id, studio_id, name, screen_number, orientation, group_id, config) VALUES (?,?,?,?,?,?,'{}')")
      .run(id, studioId, s.name, s.n, s.orientation, group.id);
    row = getOne('SELECT * FROM screens WHERE id = ?', id);
    note(`screen ${s.n}: created "${s.name}"`);
  } else { db.prepare('UPDATE screens SET group_id = COALESCE(group_id, ?) WHERE id = ?').run(group.id, row.id); note(`screen ${s.n}: reused "${row.name}"`); }
  screenIdByNumber[s.n] = row.id;
}

// ── 4. Aviation / EGPK layout pack (full-screen web sources + native tracker) ─
const GRID_COLS = 12, GRID_ROWS = 8;
function webLayout(name, url) {
  return { name, modules: [{ type: 'web_source', x: 0, y: 0, w: GRID_COLS, h: GRID_ROWS, fullscreen: true, config: { url, background: '#000000' } }] };
}
const EGPK = 'https://egpk.info/tv';
const LAYOUTS = [
  webLayout('EGPK · Live Radar',       `${EGPK}/radar`),
  webLayout('EGPK · Live Movements',   `${EGPK}/movements`),
  webLayout('EGPK · Military Transit', `${EGPK}/military`),
  webLayout('EGPK · Command',          `${EGPK}/command`),
  webLayout('EGPK · Weather',          `${EGPK}/weather`),
  webLayout('EGPK · Globe',            `${EGPK}/globe`),
  webLayout('EGPK · Cinematic',        `${EGPK}/cinematic`),
  webLayout('EGPK · Overview',         `${EGPK}/overview`),
  webLayout('EGPK · Replay',           `${EGPK}/replay`),
  webLayout('Ayrshire Weather',             'https://weather.ayrshire.wispayr.online'),
  webLayout('Ayrshire News',                'https://news.ayrshire.wispayr.online'),
  { name: 'ADS-B Tracker', modules: [{ type: 'aircraft_tracker', x: 0, y: 0, w: GRID_COLS, h: GRID_ROWS, config: {} }] },
  { name: 'Blackout', modules: [], background: '#000000' },
];
const layoutIdByName = {};
for (const L of LAYOUTS) {
  let row = getOne('SELECT * FROM layouts WHERE studio_id = ? AND name = ?', studioId, L.name);
  if (!row) {
    const id = uuid();
    db.prepare("INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, project, visibility, background) VALUES (?,?,?,?,?,?,?, 'private', ?)")
      .run(id, studioId, L.name, GRID_COLS, GRID_ROWS, JSON.stringify(L.modules), L.name.startsWith('EGPK') ? 'EGPK' : 'Aviation', L.background || '#000000');
    row = getOne('SELECT * FROM layouts WHERE id = ?', id);
    note(`layout: created "${L.name}"`);
  } else note(`layout: reused "${L.name}"`);
  layoutIdByName[L.name] = row.id;
}

// ── 5. One-click screen scenes (layout-per-screen presets) ────────────────────
const SCENES = [
  { name: 'Aviation Watch', icon: '✈️', map: { 1: 'EGPK · Overview', 2: 'EGPK · Military Transit', 3: 'EGPK · Live Radar', 4: 'EGPK · Command', 5: 'EGPK · Weather' } },
  { name: 'Movements Focus', icon: '🛬', map: { 1: 'EGPK · Live Movements', 2: 'EGPK · Military Transit', 3: 'EGPK · Live Radar', 4: 'EGPK · Globe', 5: 'Ayrshire News' } },
  { name: 'Standby', icon: '🌑', map: { 1: 'Blackout', 2: 'Blackout', 3: 'Blackout', 4: 'Blackout', 5: 'Blackout' } },
];
const sceneIdByName = {};
for (const S of SCENES) {
  let row = getOne('SELECT * FROM screen_scenes WHERE studio_id = ? AND name = ?', studioId, S.name);
  const assignments = Object.entries(S.map).map(([n, lname]) => ({ screen_id: screenIdByNumber[n], layout_id: layoutIdByName[lname] })).filter(a => a.screen_id && a.layout_id);
  if (!row) {
    const id = uuid();
    db.prepare("INSERT INTO screen_scenes (id, studio_id, name, icon, assignments) VALUES (?,?,?,?,?)")
      .run(id, studioId, S.name, S.icon, JSON.stringify(assignments));
    row = getOne('SELECT * FROM screen_scenes WHERE id = ?', id);
    note(`scene: created "${S.name}" (${assignments.length} screens)`);
  } else { db.prepare('UPDATE screen_scenes SET assignments = ? WHERE id = ?').run(JSON.stringify(assignments), row.id); note(`scene: refreshed "${S.name}"`); }
  sceneIdByName[S.name] = row.id;
}

// ── 6. "Screen Control" Stream-Deck surface ───────────────────────────────────
let deck = getOne("SELECT * FROM decks WHERE studio_id = ? AND name = 'Screen Control'", studioId);
if (!deck) { const id = uuid(); db.prepare("INSERT INTO decks (id, studio_id, name, grid_cols, grid_rows, status) VALUES (?,?,?,6,4,'published')").run(id, studioId, 'Screen Control'); deck = getOne('SELECT * FROM decks WHERE id = ?', id); note('deck: created Screen Control'); }
else note('deck: reused Screen Control');

const DECK_COLS = deck.grid_cols || 6, DECK_ROWS = deck.grid_rows || 4, CAP = DECK_COLS * DECK_ROWS;
const findBtn = db.prepare('SELECT id FROM console_buttons WHERE deck_id = ? AND label = ?');
const insBtn = db.prepare(`INSERT INTO console_buttons
  (id, studio_id, deck_id, label, icon, color, action_type, action_payload, confirm, enabled, sort_order, x, y, w, h, target)
  VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)`);
let order = 0, added = 0, skipped = 0;
function addBtn(label, icon, color, action_type, payload, { confirm = false, target = 'all' } = {}) {
  if (order >= CAP) return;
  if (findBtn.get(deck.id, label)) { skipped++; order++; return; }
  const x = order % DECK_COLS, y = Math.floor(order / DECK_COLS);
  insBtn.run(uuid(), studioId, deck.id, label, icon, color, action_type, JSON.stringify(payload || {}), confirm ? 1 : 0, order, x, y, 1, 1, target);
  order++; added++;
}
// Row of scene presets first (apply layout-per-screen across the whole wall)
addBtn('Aviation Watch', '✈️', '#0284c7', 'apply_scene', { scene_id: sceneIdByName['Aviation Watch'] });
addBtn('Movements', '🛬', '#0d9488', 'apply_scene', { scene_id: sceneIdByName['Movements Focus'] });
addBtn('Standby', '🌑', '#475569', 'apply_scene', { scene_id: sceneIdByName['Standby'] }, { confirm: true });
// Then individual scenes (take one view to ALL screens — quick "everything radar")
const SINGLES = ['EGPK · Live Radar', 'EGPK · Live Movements', 'EGPK · Military Transit', 'EGPK · Command',
  'EGPK · Weather', 'EGPK · Globe', 'EGPK · Cinematic', 'EGPK · Overview', 'EGPK · Replay',
  'ADS-B Tracker', 'Ayrshire Weather', 'Ayrshire News'];
const ICONS = { 'EGPK · Live Radar': '📡', 'EGPK · Live Movements': '🛬', 'EGPK · Military Transit': '🛡️', 'EGPK · Command': '🖥️', 'EGPK · Weather': '⛅', 'EGPK · Globe': '🌍', 'EGPK · Cinematic': '🎬', 'EGPK · Overview': '📊', 'EGPK · Replay': '⏪', 'ADS-B Tracker': '✈️', 'Ayrshire Weather': '🌤️', 'Ayrshire News': '📰' };
const PAL = ['#2563eb', '#7c3aed', '#0891b2', '#4f46e5', '#c026d3', '#0284c7'];
SINGLES.forEach((name, i) => { if (order < CAP - 2) addBtn(name.replace('EGPK · ', ''), ICONS[name] || '🎬', PAL[i % PAL.length], 'take_layout', { layout_id: layoutIdByName[name] }); });
// Reserve the last two cells for utilities
order = CAP - 2;
addBtn('Blackout', '🌑', '#dc2626', 'blackout', {}, { confirm: true });
addBtn('Reload', '🔄', '#d97706', 'reload_screens', {}, { confirm: true });
note(`deck buttons: +${added} added, ${skipped} already present`);

// ── 7. Grant your existing EGPK layouts (other studios) to Kevin's picker ─────
const egpkOwned = db.prepare(`SELECT id, name FROM layouts WHERE studio_id != ? AND (project = 'EGPK' OR name LIKE '%EGPK%' OR name LIKE '%Prestwick%')`).all(studioId);
const insGrant = db.prepare("INSERT OR IGNORE INTO resource_grants (id, resource_type, resource_id, grantee_type, grantee_id, permission) VALUES (?, 'layout', ?, 'studio', ?, 'use')");
let grants = 0;
for (const l of egpkOwned) { const r = insGrant.run(uuid(), l.id, studioId); if (r.changes) grants++; }
note(`grants: ${grants} existing EGPK layout(s) shared to Kevin's studio (of ${egpkOwned.length} found)`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n================ SETUP COMPLETE (inert — nothing pushed to screens) ================');
console.log('Studio:  Command Center   (slug: kevin-command,  id: ' + studioId + ')');
console.log('Login:   username "kevin"' + (tempPassword ? '   TEMP PASSWORD: ' + tempPassword + '   (change on first login)' : '   (existing — password unchanged)'));
console.log('Deck:    https://broadcast.studio.wispayr.online/deck/' + deck.id);
console.log('Screens (open each display\'s browser at its URL):');
for (const s of SCREENS) console.log(`  ${s.n}. ${s.name.padEnd(30)} https://broadcast.studio.wispayr.online/screen/${screenIdByNumber[s.n]}`);
console.log('===================================================================================');
