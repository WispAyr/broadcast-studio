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

// ── Producer console buttons (touch /console + Stream Deck fire URLs) ──
// Re-seeded each run (FanZone studio only). take_layout = switch scene;
// push_overlay = fire a graphic; plus utilities.
try {
  db.exec('CREATE TABLE IF NOT EXISTS console_buttons (id TEXT PRIMARY KEY, studio_id TEXT, label TEXT, sublabel TEXT, icon TEXT, color TEXT, action_type TEXT, action_payload TEXT, confirm INTEGER DEFAULT 0, sort_order INTEGER, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');
  const cols = db.prepare('PRAGMA table_info(console_buttons)').all().map((c) => c.name);
  if (cols.includes('action_type') && cols.includes('action_payload')) {
    db.prepare('DELETE FROM console_buttons WHERE studio_id = ?').run(studioId);
    const PUR = '#7a2f9e', NAVY = '#241a40', GOLD = '#caa33a', BLUE = '#1e6fd0', RED = '#d2384f', SLATE = '#475569', GREEN = '#16a34a';
    const L = (name) => layoutIds[name] || null;
    const btns = [
      { label: 'Show Intro', icon: '🎬', color: NAVY, action: 'take_layout', payload: { layout_id: L('🎬 FanZone — Show Intro') } },
      { label: 'Holding', icon: '🏟', color: PUR, action: 'take_layout', payload: { layout_id: L('🏟 FanZone — Holding') } },
      { label: 'Match Centre', icon: '📊', color: BLUE, action: 'take_layout', payload: { layout_id: L('📊 Match Centre — Scotland v Haiti') } },
      { label: 'Auto Loop', icon: '🔁', color: BLUE, action: 'take_layout', payload: { layout_id: L('🔁 Match Centre — Auto Loop') } },
      { label: 'Profiles', icon: '👤', color: PUR, action: 'take_layout', payload: { layout_id: L('👤 Player Profiles — Rotation') } },
      { label: 'Scotland', icon: '🏴', color: '#0a2a66', action: 'take_layout', payload: { layout_id: L('🏴 Scotland — Tartan Army') } },
      { label: 'Match Day', icon: '🟢', color: GREEN, action: 'take_layout', payload: { layout_id: L('🏟 FanZone — Match Day') } },
      { label: 'STV Live', icon: '📺', color: GOLD, action: 'take_layout', payload: { layout_id: L('📺 STV Live') } },
      { label: 'BBC One', icon: '📺', color: '#d2384f', action: 'take_layout', payload: { layout_id: L('📺 BBC One') } },
      { label: 'Half-Time Quiz', icon: '🎯', color: GOLD, action: 'take_layout', payload: { layout_id: L('🏟 FanZone — Half-Time Quiz') } },
      { label: 'Quiz Join', icon: '🎯', color: PUR, action: 'take_layout', payload: { layout_id: L('🏟 FanZone — Quiz Join') } },
      { label: 'Now Playing', icon: '💿', color: '#db2777', action: 'push_overlay', payload: { overlay: { type: 'now_playing_l3', stationId: 7719 } } },
      { label: 'Clear GFX', icon: '🧹', color: SLATE, action: 'clear_overlays', payload: {} },
      { label: 'Blackout', icon: '⬛', color: '#111827', action: 'blackout', confirm: 1, payload: {} },
    ];

    // ── Per-player GOAL buttons (likely scorers) → fire the goalscorer lower-third ──
    const ph = (slug, has) => (has ? `/uploads/${studioId}/players/${slug}.jpg` : null);
    const SCORERS = [
      { team: 'SCO', name: 'John McGinn', number: 7, pos: 'MF', club: 'Aston Villa', caps: 86, intlGoals: 20, role: 'Top scorer', photo: ph('john-mcginn', 1) },
      { team: 'SCO', name: 'Scott McTominay', number: 4, pos: 'MF', club: 'Napoli', caps: 70, intlGoals: 15, role: 'Key man', photo: ph('scott-mctominay', 1) },
      { team: 'SCO', name: 'Che Adams', number: 10, pos: 'FW', club: 'Torino', caps: 47, intlGoals: 13, role: '', photo: ph('che-adams', 1) },
      { team: 'SCO', name: 'Lawrence Shankland', number: 20, pos: 'FW', club: 'Hearts', caps: 20, intlGoals: 7, role: '', photo: ph('lawrence-shankland', 1) },
      { team: 'SCO', name: 'Lyndon Dykes', number: 9, pos: 'FW', club: 'Charlton Athletic', caps: 51, intlGoals: 10, role: '', photo: ph('lyndon-dykes', 1) },
      { team: 'SCO', name: 'Ben Doak', number: 17, pos: 'MF', club: 'Bournemouth', caps: 14, intlGoals: 1, role: 'Key man', photo: ph('ben-doak', 1) },
      { team: 'HAI', name: 'Duckens Nazon', number: 9, pos: 'FW', club: 'Esteghlal', caps: 78, intlGoals: 44, role: 'Top scorer', photo: null },
      { team: 'HAI', name: 'Frantzdy Pierrot', number: 20, pos: 'FW', club: 'Çaykur Rizespor', caps: 51, intlGoals: 34, role: 'Key man', photo: null },
      { team: 'HAI', name: 'Wilson Isidor', number: 18, pos: 'FW', club: 'Sunderland', caps: 4, intlGoals: 2, role: 'Key man', photo: ph('wilson-isidor', 1) },
      { team: 'HAI', name: 'Jean-Ricner Bellegarde', number: 10, pos: 'MF', club: 'Wolves', caps: 10, intlGoals: 0, role: 'Key man', photo: ph('jean-ricner-bellegarde', 1) },
    ];
    // GOAL buttons fire the FULL-SCREEN celebration + horn/roar (the big wall
    // moment). The lower-third version stays available via the Squads panel toggle.
    for (const p of SCORERS) {
      const surname = p.name.split(' ').slice(1).join(' ') || p.name;
      btns.push({ label: surname, sublabel: 'GOAL!', icon: '⚽', color: p.team === 'SCO' ? '#0a2a66' : '#d2384f',
        action: 'push_overlay', payload: { overlay: { type: 'goal', player: p, layout: 'full', sound: `/uploads/${studioId}/goal.mp3`, duration: 10 } } });
    }

    const ins = db.prepare('INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)');
    btns.forEach((b, i) => ins.run(uuid(), studioId, b.label, b.sublabel || null, b.icon, b.color, b.action, JSON.stringify(b.payload || {}), b.confirm || 0, i));
    console.log(`[console] seeded ${btns.length} producer buttons (incl ${SCORERS.length} goal)`);
  }
} catch (e) { console.warn('[console] button seed skipped:', e.message); }

console.log('\n' + '─'.repeat(60));
console.log(`SideLiner's FanZone ready. Studio: ${studioId}`);
const scr = db.prepare('SELECT id, name FROM screens WHERE studio_id = ? ORDER BY screen_number').all(studioId);
for (const s of scr) console.log(`  ${s.name}: /screen/${s.id}`);
console.log('Main Wall = PA audio output + fit-to-screen. Set quiz code live from the Quiz panel.');
console.log('─'.repeat(60));
db.close();
