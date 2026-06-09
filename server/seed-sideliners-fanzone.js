/**
 * SideLiner's FanZone @ venue38 — NOW Ayrshire Radio World Cup 26 event.
 *
 * Creates a dedicated studio with branded scenes wired to the quiz + audio:
 *   - Studio "SideLiner's FanZone @ venue38" (slug sideliners-fanzone)
 *   - Screens: Main Wall (PA audio output + fit-to-screen), Bar Screen, Entrance
 *   - Layouts (project 'SideLiner's'): Holding, Match Day, Half-Time Quiz,
 *     Quiz Join, Blackout
 *   - Copies the SideLiner's / FanZone / NAR logos into this studio's Media
 *
 * Brand: deep purple/navy (#241a40) to match the logo lockups.
 * Run: node server/seed-sideliners-fanzone.js   (idempotent — reuses by name)
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SLUG = 'sideliners-fanzone';
const NAME = "SideLiner's FanZone @ venue38";
const BG = '#241a40';
const NAR_STUDIO = 'c916d613-d5c1-4beb-8db2-14da3a228c74'; // source of the logo uploads

// ── Studio ──
let studio = db.prepare('SELECT * FROM studios WHERE slug = ?').get(SLUG);
let studioId;
if (studio) { studioId = studio.id; console.log(`[studio] exists: ${NAME}`); }
else {
  studioId = uuid();
  db.prepare('INSERT INTO studios (id, name, slug, active) VALUES (?, ?, ?, 1)').run(studioId, NAME, SLUG);
  console.log(`[studio] created: ${NAME} (${studioId})`);
}

// ── Copy logos into this studio's Media ──
const upBase = path.join(__dirname, 'data', 'uploads');
const srcDir = path.join(upBase, NAR_STUDIO);
const dstDir = path.join(upBase, studioId);
fs.mkdirSync(dstDir, { recursive: true });
for (const f of ['sideliners-logo.png', 'sideliners-fanzone-logo.png', 'now-ayrshire-radio-logo.png']) {
  try { fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f)); } catch (e) { console.warn(`  logo copy skipped (${f}): ${e.message}`); }
}
const U = (f) => `/uploads/${studioId}/${f}`;
const LOGO_FZ = U('sideliners-fanzone-logo.png');
const LOGO_SL = U('sideliners-logo.png');

const img = (url, x, y, w, h, fit = 'contain') => ({ id: uuid(), module: 'image', type: 'image', x, y, w, h, config: { url, src: url, fit } });
const text = (t, x, y, w, h, fontSize = '3vw') => ({ id: uuid(), module: 'text', type: 'text', x, y, w, h, config: { text: t, fontSize, color: '#ffffff', align: 'center' } });
const ticker = (t) => ({ id: uuid(), module: 'ticker', type: 'ticker', x: 0, y: 7, w: 12, h: 1, config: { text: t, speed: 5 } });
const quiz = (mode) => ({ id: uuid(), module: 'quiz', type: 'quiz', x: 0, y: 0, w: 12, h: 8, config: { base: 'https://quiz.wispayr.online', mode, code: '' } });
const camera = (label) => ({ id: uuid(), module: 'camera_feed', type: 'camera_feed', x: 0, y: 1, w: 12, h: 6, config: { src: '', label, muted: true } });
const tv = (label, src) => ({ id: uuid(), module: 'camera_feed', type: 'camera_feed', x: 0, y: 0, w: 12, h: 8, config: { src, label, muted: false } });
const video = (url) => ({ id: uuid(), module: 'video', type: 'video', x: 0, y: 0, w: 12, h: 8, config: { url, src: url, autoplay: true, loop: false, muted: false } });
const stats = (view) => ({ id: uuid(), module: 'match_stats', type: 'match_stats', x: 0, y: 0, w: 12, h: 8, config: { view } });
const hero = (cfg) => ({ id: uuid(), module: 'scotland_hero', type: 'scotland_hero', x: 0, y: 0, w: 12, h: 8, config: cfg });
const profiles = (team, secs = 9) => ({ id: uuid(), module: 'match_stats', type: 'match_stats', x: 0, y: 0, w: 12, h: 8, config: { view: 'profiles', team, secs } });

const SCENES = [
  { name: '🎬 FanZone — Show Intro', bg: '#000000', modules: [ video(U('sideliners-intro.mp4')) ] },
  { name: '🏴 Scotland — Tartan Army', bg: '#0a2a66', modules: [ hero({ title: 'SCOTLAND', subtitle: 'THE TARTAN ARMY', kicker: 'WORLD CUP 26 · GROUP C' }) ] },
  { name: '🏟 FanZone — Holding', bg: BG, modules: [
      img(LOGO_FZ, 1, 1, 10, 5),
      text('Welcome to the SideLiner’s FanZone', 1, 6, 10, 1, '2.6vw'),
      ticker('NOW Ayrshire Radio  ·  SideLiner’s FanZone  ·  FIFA World Cup 26  ·  Live from venue38'),
  ] },
  { name: '📊 Match Centre — Scotland v Haiti', bg: BG, modules: [ stats('header') ] },
  { name: '📊 Form Guide', bg: BG, modules: [ stats('form') ] },
  { name: '📊 Key Players', bg: BG, modules: [ stats('players') ] },
  { name: '📊 Group C', bg: BG, modules: [ stats('group') ] },
  { name: '📊 Road to the World Cup', bg: BG, modules: [ stats('road') ] },
  { name: '📊 Did You Know', bg: BG, modules: [ stats('facts') ] },
  { name: '🔁 Match Centre — Auto Loop', bg: BG, modules: [ { id: uuid(), module: 'match_stats', type: 'match_stats', x: 0, y: 0, w: 12, h: 8, config: { view: 'loop', secs: 14 } } ] },
  { name: '👤 Player Profiles — Rotation', bg: BG, modules: [ profiles('both') ] },
  { name: '👤 Scotland Profiles', bg: BG, modules: [ profiles('SCO') ] },
  { name: '👤 Haiti Profiles', bg: BG, modules: [ profiles('HAI') ] },
  { name: '📺 STV Live', bg: '#000000', modules: [ tv('STV — Scotland v Haiti', 'https://live.wispayr.online/playout/stv-live/index.m3u8') ] },
  { name: '📺 BBC One', bg: '#000000', modules: [ tv('BBC One — Scotland v Haiti', 'https://live.wispayr.online/playout/bbc-one/index.m3u8') ] },
  { name: '🏟 FanZone — Match Day', bg: '#000000', modules: [
      img(LOGO_SL, 0, 0, 3, 1),
      camera('Match Feed'),
      ticker('SideLiner’s FanZone  ·  Live from venue38'),
  ] },
  { name: '🏟 FanZone — Half-Time Quiz', bg: '#000000', modules: [ quiz('screen') ] },
  { name: '🏟 FanZone — Quiz Join', bg: BG, modules: [ quiz('join') ] },
];

const layoutIds = {};
for (const s of SCENES) {
  const modulesJson = JSON.stringify(s.modules);
  const ex = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(studioId, s.name);
  if (ex) {
    db.prepare("UPDATE layouts SET modules=?, grid_cols=12, grid_rows=8, background=?, project='SideLiner''s', updated_at=datetime('now') WHERE id=?")
      .run(modulesJson, s.bg, ex.id);
    layoutIds[s.name] = ex.id; console.log(`[layout] updated: ${s.name}`);
  } else {
    const id = uuid();
    db.prepare("INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background, project, resolution_w, resolution_h, orientation) VALUES (?,?,?,12,8,?,?,'SideLiner''s',1920,1080,'landscape')")
      .run(id, studioId, s.name, modulesJson, s.bg);
    layoutIds[s.name] = id; console.log(`[layout] created: ${s.name}`);
  }
}

// ── Screens ──
const SCREENS = [
  { name: 'Main Wall', cfg: { audioOutput: true, fitToScreen: true }, layout: '🏟 FanZone — Holding' },
  { name: 'Bar Screen', cfg: { fitToScreen: true }, layout: '🏟 FanZone — Holding' },
  { name: 'Entrance', cfg: { fitToScreen: true }, layout: '🏟 FanZone — Quiz Join' },
];
for (const sc of SCREENS) {
  const cfg = JSON.stringify(sc.cfg);
  const layoutId = layoutIds[sc.layout];
  const ex = db.prepare('SELECT id FROM screens WHERE studio_id = ? AND name = ?').get(studioId, sc.name);
  if (ex) {
    db.prepare("UPDATE screens SET config=?, current_layout_id=?, updated_at=datetime('now') WHERE id=?").run(cfg, layoutId, ex.id);
    console.log(`[screen] updated: ${sc.name}`);
  } else {
    const n = db.prepare('SELECT COALESCE(MAX(screen_number),0) n FROM screens WHERE studio_id=?').get(studioId).n;
    db.prepare('INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id, config) VALUES (?,?,?,?,?,?)')
      .run(uuid(), studioId, sc.name, n + 1, layoutId, cfg);
    console.log(`[screen] created: ${sc.name}`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`SideLiner's FanZone ready. Studio: ${studioId}`);
const scr = db.prepare('SELECT id, name FROM screens WHERE studio_id = ? ORDER BY screen_number').all(studioId);
for (const s of scr) console.log(`  ${s.name}: /screen/${s.id}`);
console.log('Main Wall = PA audio output + fit-to-screen. Set quiz code live from the Quiz panel.');
console.log('─'.repeat(60));
db.close();
