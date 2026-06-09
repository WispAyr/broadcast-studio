/**
 * SideLiner's — on-air graphics package (idents, stings, lower thirds, score
 * bug, fixtures/results/table, poll) for NOW Ayrshire Radio's sports show.
 *
 * Adds to the "SideLiner's FanZone @ venue38" studio:
 *   - Full-frame graphic scenes (project 'SideLiner's') using the `sideliners`
 *     module — taken to the wall via the console.
 *   - A console / Stream Deck operator surface: take-scene buttons + branded
 *     transient overlays (sting, lower thirds, breaking, your-shout, score bug).
 *
 * Idempotent (reuses layouts/buttons by name). Sample sport data is placeholder
 * for the weekend — edit live from the layout editor / console.
 * Run: node server/seed-sideliners-graphics.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SLUG = 'sideliners-fanzone';
const studio = db.prepare('SELECT * FROM studios WHERE slug = ?').get(SLUG);
if (!studio) { console.error('SideLiner\'s FanZone studio not found — run seed-sideliners-fanzone.js first'); process.exit(1); }
const studioId = studio.id;
const U = (f) => `/uploads/${studioId}/${f}`;
const LOGO = U('sideliners-logo.png');
console.log(`[studio] ${studio.name} (${studioId})`);

// One full-frame `sideliners` module filling the 12×8 grid.
const sl = (cfg) => ([{ id: uuid(), module: 'sideliners', type: 'sideliners', x: 0, y: 0, w: 12, h: 8, config: { logoUrl: LOGO, ...cfg } }]);

const SCENES = [
  { name: '▶ SL — Show Open',      cfg: { variant: 'ident_open', host: 'Scott Watson' } },
  { name: '⏹ SL — End Card',       cfg: { variant: 'ident_close', title: 'Thanks for listening', subtitle: 'Same time next week · NOW Ayrshire Radio' } },
  { name: '🤝 SL — Sponsor',        cfg: { variant: 'sponsor', sponsor: 'Kilmarnock FC' } },
  { name: '☕ SL — Break Bumper',   cfg: { variant: 'break', subtitle: 'More sport, more shouts — stay with us' } },
  { name: '📋 SL — Coming Up',      cfg: { variant: 'coming_up', items: ['Killie team news ahead of Saturday', 'The Old Firm verdict', 'Your shouts on the SPFL run-in', 'World Cup 26 build-up'] } },
  { name: '💬 SL — Talking Point',  cfg: { variant: 'talking_point', title: 'Can Killie crack the top six?', subtitle: 'Your shouts from 1pm — text 81400' } },
  { name: '🔢 SL — Score',          cfg: { variant: 'score', competition: 'SPFL Premiership', home: 'KILMARNOCK', away: 'RANGERS', score: '0 - 0', minute: 'KICK-OFF 15:00' } },
  { name: '📅 SL — Fixtures',       cfg: { variant: 'fixtures', title: 'This Weekend', items: [
      { home: 'Kilmarnock', away: 'Rangers', time: 'Sat 15:00' },
      { home: 'Celtic', away: 'Aberdeen', time: 'Sat 15:00' },
      { home: 'Hearts', away: 'Hibernian', time: 'Sun 12:00' },
      { home: 'St Mirren', away: 'Motherwell', time: 'Sun 15:00' } ] } },
  { name: '✅ SL — Results',        cfg: { variant: 'results', title: 'Last Time Out', items: [
      { home: 'Kilmarnock', away: 'St Mirren', score: '2-1' },
      { home: 'Rangers', away: 'Motherwell', score: '3-0' },
      { home: 'Celtic', away: 'Dundee', score: '4-1' },
      { home: 'Aberdeen', away: 'Hearts', score: '1-1' } ] } },
  { name: '🏆 SL — League Table',   cfg: { variant: 'table', title: 'SPFL Premiership', rows: [
      { pos: 1, team: 'Celtic', pl: 30, pts: 70 },
      { pos: 2, team: 'Rangers', pl: 30, pts: 64 },
      { pos: 3, team: 'Hibernian', pl: 30, pts: 51 },
      { pos: 4, team: 'Aberdeen', pl: 30, pts: 48 },
      { pos: 5, team: 'Hearts', pl: 30, pts: 46 },
      { pos: 6, team: 'Kilmarnock', pl: 30, pts: 44, hl: true } ] } },
  { name: '📊 SL — Poll',           cfg: { variant: 'poll', question: 'Will Killie finish in the top six?', options: [{ label: 'Aye', pct: 62 }, { label: 'Naw', pct: 38 }] } },
];

const layoutIds = {};
for (const s of SCENES) {
  const json = JSON.stringify(sl(s.cfg));
  const ex = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(studioId, s.name);
  if (ex) {
    db.prepare("UPDATE layouts SET modules=?, grid_cols=12, grid_rows=8, background='#241a40', project='SideLiner''s', updated_at=datetime('now') WHERE id=?").run(json, ex.id);
    layoutIds[s.name] = ex.id;
  } else {
    const id = uuid();
    db.prepare("INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background, project, resolution_w, resolution_h, orientation) VALUES (?,?,?,12,8,?,'#241a40','SideLiner''s',1920,1080,'landscape')").run(id, studioId, s.name, json);
    layoutIds[s.name] = id;
  }
}
console.log(`[layouts] ${SCENES.length} graphic scenes seeded`);

// ── Console / Stream Deck operator surface ──
// Wipe our own buttons (idempotent) then re-seed. Identify ours by a marker in
// the payload so we don't clobber other console buttons.
const ourTakes = SCENES.map(s => layoutIds[s.name]);
db.prepare("DELETE FROM console_buttons WHERE studio_id = ? AND (action_type IN ('push_overlay','remove_overlay') OR (action_type='take_layout' AND " +
  "json_extract(action_payload,'$.layout_id') IN (" + ourTakes.map(() => '?').join(',') + ")))").run(studioId, ...ourTakes);

const NAVY = '#241a40', PURPLE = '#7a2f9e', GOLD = '#ffd24a', RED = '#E2392D', SLATE = '#475569', GREEN = '#16a34a';
let order = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM console_buttons WHERE studio_id = ?').get(studioId).m;
const ins = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
const btn = (label, sublabel, icon, color, action_type, payload, confirm = 0) =>
  ins.run(uuid(), studioId, label, sublabel, icon, color, action_type, JSON.stringify(payload), confirm, ++order);

// Full-frame scene takes
const sceneBtns = [
  ['Show Open', 'Opener / title', '▶', GOLD], ['Sponsor', 'Kilmarnock FC', '🤝', NAVY],
  ['Talking Point', "Today's topic", '💬', PURPLE], ['Coming Up', 'Run of show', '📋', PURPLE],
  ['Score', 'Full-frame score', '🔢', NAVY], ['Fixtures', 'This weekend', '📅', PURPLE],
  ['Results', 'Last time out', '✅', PURPLE], ['League Table', 'SPFL table', '🏆', NAVY],
  ['Poll', 'Vote graphic', '📊', PURPLE], ['Break Bumper', 'Back after this', '☕', SLATE],
  ['End Card', 'Sign off', '⏹', SLATE],
];
const sceneName = { 'Show Open': '▶ SL — Show Open', 'Sponsor': '🤝 SL — Sponsor', 'Talking Point': '💬 SL — Talking Point',
  'Coming Up': '📋 SL — Coming Up', 'Score': '🔢 SL — Score', 'Fixtures': '📅 SL — Fixtures', 'Results': '✅ SL — Results',
  'League Table': '🏆 SL — League Table', 'Poll': '📊 SL — Poll', 'Break Bumper': '☕ SL — Break Bumper', 'End Card': '⏹ SL — End Card' };
for (const [label, sub, icon, color] of sceneBtns) btn('SL · ' + label, sub, icon, color, 'take_layout', { layout_id: layoutIds[sceneName[label]] });

// Transient branded overlays
btn('SL Sting', 'Logo transition', '✨', GOLD, 'push_overlay', { overlay: { type: 'sl_sting', url: LOGO, duration: 3 } });
btn('L3 · Scott Watson', 'Presenter', '🎙', PURPLE, 'push_overlay', { overlay: { type: 'sl_lower_third', kicker: 'Your host', name: 'Scott Watson', title: "SideLiner's · Ayrshire's Best Sports Show", duration: 8 } });
btn('L3 · Guest', 'Guest name', '🎤', PURPLE, 'push_overlay', { overlay: { type: 'sl_lower_third', kicker: 'In the studio', name: 'Guest Name', title: 'Guest · Role', duration: 8 } });
btn('L3 · Caller', 'Phone-in', '☎', PURPLE, 'push_overlay', { overlay: { type: 'sl_lower_third', kicker: 'On the line', name: 'Caller', title: 'Live from Ayrshire', duration: 8 } });
btn('Your Shout', 'Listener text-in', '💭', NAVY, 'push_overlay', { overlay: { type: 'sl_text', kicker: 'Your shout', text: "We're going up! Killie all the way.", name: 'Davie, Kilmarnock', duration: 10 } });
btn('BREAKING', 'Sport breaking', '🚨', RED, 'push_overlay', { overlay: { type: 'sl_breaking', text: 'Breaking sports news', duration: 14 } }, 1);
btn('Score Bug ON', 'Corner score', '🔼', GREEN, 'push_overlay', { overlay: { type: 'sl_score', home: 'KIL', away: 'RAN', score: '0-0', minute: "1'" } });
btn('Score Bug OFF', 'Hide score', '🔽', SLATE, 'remove_overlay', { overlay_type: 'sl_score' });
btn('Clear Graphics', 'Remove overlays', '🧹', SLATE, 'clear_overlays', {});

console.log(`[console] operator buttons seeded (${sceneBtns.length} scenes + overlays)`);
console.log('\n✅ SideLiner\'s graphics package ready.');
console.log(`   Studio: ${studio.name}`);
console.log('   Scenes: project "SideLiner\'s" · Overlays: sl_* via console /console + Stream Deck');
db.close();
