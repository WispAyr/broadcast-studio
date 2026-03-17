/**
 * Now Ayrshire Radio — Full tenant seed
 * Run: node server/src/seed-nar.js
 * 
 * Creates/updates the NAR studio with:
 * - Dedicated user account
 * - 5 screens (Presenter, Guest, Studio Wall, Green Room, Lobby)
 * - Pre-built layouts for each screen purpose
 * - Shows matching the real NAR weekly schedule
 * - Timelines that auto-switch layouts per show
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'broadcast.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Check if NAR studio exists ──
let studio = db.prepare("SELECT * FROM studios WHERE slug = 'now-ayrshire'").get();
let studioId;

if (studio) {
  studioId = studio.id;
  console.log(`NAR studio already exists (${studioId}), updating...`);
  // Clean existing layouts, shows, screens for fresh rebuild
  db.prepare("DELETE FROM layouts WHERE studio_id = ?").run(studioId);
  db.prepare("DELETE FROM shows WHERE studio_id = ?").run(studioId);
  db.prepare("DELETE FROM screens WHERE studio_id = ?").run(studioId);
} else {
  studioId = uuidv4();
  db.prepare("INSERT INTO studios (id, name, slug, active) VALUES (?, ?, ?, ?)").run(
    studioId, 'Now Ayrshire Radio', 'now-ayrshire', 1
  );
  console.log(`Created NAR studio: ${studioId}`);
}

// ── NAR User ──
const narUser = db.prepare("SELECT * FROM users WHERE username = 'nar'").get();
if (!narUser) {
  const narUserId = uuidv4();
  const narPassword = bcrypt.hashSync('NowAyrshire2026!', 10);
  db.prepare("INSERT INTO users (id, username, password, name, role, studio_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(narUserId, 'nar', narPassword, 'NAR Producer', 'producer', studioId);
  console.log(`Created NAR user: nar / NowAyrshire2026!`);
} else {
  // Update studio_id if needed
  db.prepare("UPDATE users SET studio_id = ? WHERE username = 'nar'").run(studioId);
  console.log('NAR user already exists, updated studio_id');
}

// ── Ensure new module types are registered ──
const newModuleTypes = [
  { name: 'news_tv', description: 'Live news TV channel switcher (YouTube)', category: 'media', icon: '📺' },
  { name: 'nar_schedule', description: 'Now Ayrshire Radio - On Air schedule', category: 'broadcast', icon: '📻' },
  { name: 'nar_news', description: 'Now Ayrshire Radio - Local news', category: 'data', icon: '📰' },
  { name: 'nar_sport', description: 'Now Ayrshire Radio - Sport news', category: 'data', icon: '⚽' },
  { name: 'nar_partners', description: 'Now Ayrshire Radio - Sponsor rotator', category: 'broadcast', icon: '🤝' },
  { name: 'travel_screen', description: 'Ayrshire travel info (full screen)', category: 'data', icon: '🚗' },
  { name: 'travel_times', description: 'Live travel times (Google/Waze)', category: 'data', icon: '🕐' },
];

const insertModType = db.prepare(
  "INSERT OR IGNORE INTO module_types (id, name, description, category, icon, default_config) VALUES (?, ?, ?, ?, ?, '{}')"
);
for (const m of newModuleTypes) {
  insertModType.run(uuidv4(), m.name, m.description, m.category, m.icon);
}

// ══════════════════════════════════════════
//  LAYOUTS — purpose-built for NAR
// ══════════════════════════════════════════

const insertLayout = db.prepare(
  "INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, ?, ?, ?)"
);

// ── 1. Presenter Main ──
// What the presenter sees during a live show: schedule, news, weather, clock, travel
const presenterMainId = uuidv4();
insertLayout.run(presenterMainId, studioId, 'Presenter — Live Show', 12, 8, JSON.stringify([
  // Top row: clock + on-air schedule + weather
  { type: 'clock', x: 0, y: 0, w: 2, h: 2, config: { format: '24h', showDate: true, background: 'transparent', color: '#ffffff' } },
  { type: 'nar_schedule', x: 2, y: 0, w: 5, h: 4, config: { accentColor: '#e11d48', showThumbnails: true, showGenres: true, maxUpcoming: 3 } },
  { type: 'weather', x: 7, y: 0, w: 3, h: 2, config: { lat: 55.46, lon: -4.63, location: 'Ayrshire' } },
  { type: 'travel_times', x: 10, y: 0, w: 2, h: 4, config: { compact: true, showDelayBadge: true, showNormalTime: false, title: 'TRAVEL' } },
  // Middle: news headlines + sport
  { type: 'nar_news', x: 0, y: 2, w: 2, h: 3, config: { categories: 'news', layout: 'list', showImages: false, compact: true, maxItems: 5, accentColor: '#3b82f6' } },
  { type: 'weather_radar', x: 7, y: 2, w: 3, h: 2, config: { lat: 55.46, lon: -4.63, zoom: 8 } },
  // Bottom: news ticker + partners
  { type: 'nar_news', x: 0, y: 5, w: 8, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
  { type: 'nar_partners', x: 0, y: 6, w: 12, h: 2, config: { layout: 'strip', rotateInterval: 4000, title: 'SPONSORED BY', accentColor: '#8b5cf6' } },
  { type: 'travel_screen', x: 8, y: 4, w: 4, h: 2, config: { showSections: ['roads', 'rail'], compactMode: true, title: 'TRAVEL UPDATE' } },
]));

// ── 2. Presenter — News Hour ──
// Expanded news focus for news bulletins
const presenterNewsId = uuidv4();
insertLayout.run(presenterNewsId, studioId, 'Presenter — News Hour', 12, 8, JSON.stringify([
  { type: 'clock', x: 0, y: 0, w: 2, h: 1, config: { format: '24h', background: 'transparent' } },
  { type: 'nar_news', x: 0, y: 1, w: 6, h: 5, config: { categories: 'all', layout: 'hero', autoScroll: true, scrollInterval: 10000, showExcerpts: true } },
  { type: 'nar_schedule', x: 6, y: 0, w: 3, h: 3, config: { accentColor: '#e11d48', compact: true } },
  { type: 'nar_sport', x: 6, y: 3, w: 3, h: 3, config: { categories: 'sport', layout: 'list', compact: true, showImages: false, maxItems: 4, accentColor: '#f97316' } },
  { type: 'weather', x: 9, y: 0, w: 3, h: 2, config: { lat: 55.46, lon: -4.63 } },
  { type: 'travel_times', x: 9, y: 2, w: 3, h: 4, config: { compact: true, title: 'TRAVEL TIMES' } },
  { type: 'nar_news', x: 0, y: 6, w: 9, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#dc2626' } },
  { type: 'nar_partners', x: 0, y: 7, w: 12, h: 1, config: { layout: 'strip', rotateInterval: 5000 } },
  { type: 'travel_screen', x: 9, y: 6, w: 3, h: 2, config: { showSections: ['roads'], compactMode: true } },
]));

// ── 3. Presenter — Travel & Weather ──
// For travel bulletins — big travel screen with weather
const presenterTravelId = uuidv4();
insertLayout.run(presenterTravelId, studioId, 'Presenter — Travel & Weather', 12, 8, JSON.stringify([
  { type: 'clock', x: 0, y: 0, w: 2, h: 1, config: { format: '24h' } },
  { type: 'travel_screen', x: 0, y: 1, w: 6, h: 5, config: { showSections: ['roads', 'rail', 'ferries', 'tros'], title: 'AYRSHIRE TRAVEL' } },
  { type: 'travel_times', x: 6, y: 0, w: 3, h: 4, config: { layout: 'list', title: 'JOURNEY TIMES' } },
  { type: 'weather', x: 9, y: 0, w: 3, h: 3, config: { lat: 55.46, lon: -4.63, location: 'Ayrshire' } },
  { type: 'weather_radar', x: 9, y: 3, w: 3, h: 3, config: { lat: 55.46, lon: -4.63, zoom: 8 } },
  { type: 'nar_schedule', x: 6, y: 4, w: 3, h: 2, config: { compact: true, accentColor: '#e11d48' } },
  { type: 'nar_news', x: 0, y: 6, w: 9, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
  { type: 'nar_partners', x: 0, y: 7, w: 12, h: 1, config: { layout: 'strip' } },
]));

// ── 4. Presenter — Sport ──
const presenterSportId = uuidv4();
insertLayout.run(presenterSportId, studioId, 'Presenter — Sport Focus', 12, 8, JSON.stringify([
  { type: 'clock', x: 0, y: 0, w: 2, h: 1, config: { format: '24h' } },
  { type: 'nar_sport', x: 0, y: 1, w: 6, h: 5, config: { categories: 'sport', layout: 'hero', autoScroll: true, scrollInterval: 8000, accentColor: '#f97316' } },
  { type: 'nar_schedule', x: 6, y: 0, w: 3, h: 3, config: { accentColor: '#e11d48' } },
  { type: 'nar_news', x: 6, y: 3, w: 3, h: 3, config: { categories: 'news', layout: 'list', compact: true, showImages: false, maxItems: 4 } },
  { type: 'weather', x: 9, y: 0, w: 3, h: 2, config: { lat: 55.46, lon: -4.63 } },
  { type: 'travel_times', x: 9, y: 2, w: 3, h: 4, config: { compact: true } },
  { type: 'nar_news', x: 0, y: 6, w: 9, h: 1, config: { categories: 'sport', layout: 'ticker', accentColor: '#f97316' } },
  { type: 'nar_partners', x: 0, y: 7, w: 12, h: 1, config: { layout: 'strip' } },
]));

// ── 5. News TV Monitor ──
const newsTVId = uuidv4();
insertLayout.run(newsTVId, studioId, 'News TV — Live Feed', 12, 8, JSON.stringify([
  { type: 'news_tv', x: 0, y: 0, w: 12, h: 7, config: {
    enabledChannels: ['sky-news', 'bbc-news', 'gb-news', 'al-jazeera'],
    defaultChannel: 'sky-news',
    mute: true,
    showChannelBar: true,
    barPosition: 'bottom',
    title: 'NEWS'
  }},
  { type: 'nar_news', x: 0, y: 7, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#dc2626' } },
]));

// ── 6. Guest Monitor — simpler view ──
const guestMonitorId = uuidv4();
insertLayout.run(guestMonitorId, studioId, 'Guest Monitor', 12, 8, JSON.stringify([
  { type: 'nar_schedule', x: 0, y: 0, w: 6, h: 4, config: { accentColor: '#e11d48', title: 'NOW AYRSHIRE RADIO', showThumbnails: true } },
  { type: 'clock', x: 6, y: 0, w: 3, h: 2, config: { format: '24h', showDate: true } },
  { type: 'weather', x: 9, y: 0, w: 3, h: 2, config: { lat: 55.46, lon: -4.63 } },
  { type: 'nar_news', x: 6, y: 2, w: 6, h: 4, config: { categories: 'all', layout: 'list', showImages: true, maxItems: 5 } },
  { type: 'nar_news', x: 0, y: 4, w: 6, h: 2, config: { categories: 'sport', layout: 'list', compact: true, showImages: false, maxItems: 4, title: 'SPORT', accentColor: '#f97316' } },
  { type: 'nar_news', x: 0, y: 6, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
  { type: 'nar_partners', x: 0, y: 7, w: 12, h: 1, config: { layout: 'strip', title: 'OUR PARTNERS' } },
]));

// ── 7. Studio Wall — visual, broadcast quality ──
const studioWallId = uuidv4();
insertLayout.run(studioWallId, studioId, 'Studio Wall — Broadcast', 12, 8, JSON.stringify([
  { type: 'nar_news', x: 0, y: 0, w: 8, h: 6, config: { categories: 'all', layout: 'hero', autoScroll: true, scrollInterval: 6000, showExcerpts: true } },
  { type: 'nar_schedule', x: 8, y: 0, w: 4, h: 3, config: { accentColor: '#e11d48', compact: false } },
  { type: 'weather', x: 8, y: 3, w: 4, h: 3, config: { lat: 55.46, lon: -4.63 } },
  { type: 'nar_news', x: 0, y: 6, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
  { type: 'nar_partners', x: 0, y: 7, w: 12, h: 1, config: { layout: 'strip', rotateInterval: 3000 } },
]));

// ── 8. Green Room — casual info display ──
const greenRoomId = uuidv4();
insertLayout.run(greenRoomId, studioId, 'Green Room', 12, 8, JSON.stringify([
  { type: 'clock', x: 0, y: 0, w: 3, h: 2, config: { format: '24h', showDate: true } },
  { type: 'nar_schedule', x: 3, y: 0, w: 5, h: 3, config: { accentColor: '#e11d48' } },
  { type: 'weather', x: 8, y: 0, w: 4, h: 3, config: { lat: 55.46, lon: -4.63 } },
  { type: 'nar_news', x: 0, y: 3, w: 6, h: 4, config: { categories: 'all', layout: 'list', showImages: true, maxItems: 6 } },
  { type: 'travel_times', x: 6, y: 3, w: 3, h: 4, config: { title: 'TRAVEL' } },
  { type: 'nar_partners', x: 9, y: 3, w: 3, h: 4, config: { layout: 'grid', gridCols: 2, gridRows: 3, rotateInterval: 8000 } },
  { type: 'nar_news', x: 0, y: 7, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
]));

// ── 9. Lobby Display — public-facing ──
const lobbyId = uuidv4();
insertLayout.run(lobbyId, studioId, 'Lobby / Public Display', 12, 8, JSON.stringify([
  { type: 'nar_news', x: 0, y: 0, w: 8, h: 5, config: { categories: 'all', layout: 'hero', autoScroll: true, scrollInterval: 8000, showExcerpts: true, title: 'NOW AYRSHIRE RADIO NEWS' } },
  { type: 'nar_schedule', x: 8, y: 0, w: 4, h: 3, config: { accentColor: '#e11d48', title: 'ON AIR' } },
  { type: 'weather', x: 8, y: 3, w: 4, h: 2, config: { lat: 55.46, lon: -4.63, location: 'Ayrshire' } },
  { type: 'nar_partners', x: 0, y: 5, w: 8, h: 2, config: { layout: 'grid', gridCols: 4, gridRows: 2, rotateInterval: 6000, title: 'OUR PARTNERS' } },
  { type: 'clock', x: 8, y: 5, w: 4, h: 2, config: { format: '24h', showDate: true } },
  { type: 'nar_news', x: 0, y: 7, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
]));

// ── 10. Breaking News ──
const breakingId = uuidv4();
insertLayout.run(breakingId, studioId, 'Breaking News', 12, 8, JSON.stringify([
  { type: 'breaking_news', x: 0, y: 0, w: 12, h: 2, config: { text: 'BREAKING NEWS', background: '#dc2626', color: '#ffffff' } },
  { type: 'news_tv', x: 0, y: 2, w: 8, h: 5, config: {
    enabledChannels: ['sky-news', 'bbc-news', 'gb-news'],
    defaultChannel: 'sky-news',
    mute: true,
    showChannelBar: true,
    barPosition: 'top'
  }},
  { type: 'nar_news', x: 8, y: 2, w: 4, h: 3, config: { categories: 'news', layout: 'list', compact: true, showImages: false, maxItems: 5 } },
  { type: 'travel_screen', x: 8, y: 5, w: 4, h: 2, config: { showSections: ['roads'], compactMode: true } },
  { type: 'nar_news', x: 0, y: 7, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#dc2626' } },
]));

// ── 11. Music Only (overnight/automation) ──
const musicOnlyId = uuidv4();
insertLayout.run(musicOnlyId, studioId, 'Music / Overnight', 12, 8, JSON.stringify([
  { type: 'nar_schedule', x: 0, y: 0, w: 12, h: 4, config: { accentColor: '#e11d48', title: 'NOW AYRSHIRE RADIO', showThumbnails: true, showGenres: true, maxUpcoming: 5 } },
  { type: 'clock', x: 0, y: 4, w: 4, h: 3, config: { format: '24h', showDate: true } },
  { type: 'weather', x: 4, y: 4, w: 4, h: 3, config: { lat: 55.46, lon: -4.63 } },
  { type: 'nar_partners', x: 8, y: 4, w: 4, h: 3, config: { layout: 'single', rotateInterval: 5000 } },
  { type: 'nar_news', x: 0, y: 7, w: 12, h: 1, config: { categories: 'all', layout: 'ticker', accentColor: '#e11d48' } },
]));

console.log(`Created ${11} layouts for NAR`);

// ══════════════════════════════════════════
//  SCREENS
// ══════════════════════════════════════════

const insertScreen = db.prepare(
  "INSERT INTO screens (id, studio_id, name, screen_number, current_layout_id) VALUES (?, ?, ?, ?, ?)"
);

const screen1 = uuidv4(); insertScreen.run(screen1, studioId, 'Presenter Monitor', 1, presenterMainId);
const screen2 = uuidv4(); insertScreen.run(screen2, studioId, 'Guest Monitor', 2, guestMonitorId);
const screen3 = uuidv4(); insertScreen.run(screen3, studioId, 'Studio Wall', 3, studioWallId);
const screen4 = uuidv4(); insertScreen.run(screen4, studioId, 'Green Room', 4, greenRoomId);
const screen5 = uuidv4(); insertScreen.run(screen5, studioId, 'Lobby Display', 5, lobbyId);

console.log('Created 5 screens');

// ══════════════════════════════════════════
//  SHOWS — from real NAR schedule
// ══════════════════════════════════════════

const insertShow = db.prepare(
  "INSERT INTO shows (id, studio_id, name, description, timeline, active) VALUES (?, ?, ?, ?, ?, ?)"
);

// Show definitions from the real NAR WordPress schedule
const narShows = {
  // Weekday shows
  '12524': { name: 'Through The Night Mix', desc: 'Overnight automated music mix — Pop', type: 'music' },
  '11999': { name: 'Ali & Michael in the Morning', desc: 'Weekday breakfast show 6am-10am — Chat, Happy Music, Pop', type: 'chat' },
  '1820':  { name: 'Mid-Mornings', desc: 'Weekday mid-morning show 10am-1pm — Pop, Vocal', type: 'music' },
  '1819':  { name: 'Afternoons', desc: 'Weekday afternoons 1pm-4pm — Chat, Happy Music, Pop', type: 'chat' },
  '1818':  { name: 'Drivetime', desc: 'Weekday drivetime 4pm-7pm — Comedy, Happy Music, Pop, Rock', type: 'chat' },
  '12333': { name: 'Evening Vibe', desc: 'Weekday evenings 7pm-10pm — Chat, Gossip, Happy Music, Pop', type: 'chat' },
  '1815':  { name: 'The Late Show', desc: 'Weekday late night 10pm-1am — Chillout, Happy Music', type: 'music' },
  // Friday specials
  '1812':  { name: 'Friday Night Live', desc: 'Friday evening 6pm-10pm', type: 'chat' },
  '12343': { name: 'Friday Late', desc: 'Friday late night 10pm-1am', type: 'music' },
  // Saturday
  '12327': { name: 'Weekend Breakfast', desc: 'Weekend morning show 6am-10am', type: 'chat' },
  '1813':  { name: 'Saturday Morning', desc: 'Saturday 10am-2pm', type: 'music' },
  '13770': { name: 'Saturday Afternoon', desc: 'Saturday 2pm-6pm', type: 'music' },
  '12325': { name: 'Saturday Night', desc: 'Saturday evening 6pm-10pm', type: 'chat' },
  '12447': { name: 'Saturday Late', desc: 'Saturday late 10pm-midnight', type: 'music' },
  '1817':  { name: 'Saturday After Hours', desc: 'Saturday midnight-2am', type: 'music' },
  // Sunday
  '12335': { name: 'Sunday Brunch', desc: 'Sunday 10am-1pm', type: 'chat' },
  '12337': { name: 'Sunday Afternoon', desc: 'Sunday 1pm-4pm', type: 'music' },
  '13316': { name: 'Sunday Sessions', desc: 'Sunday 4pm-7pm', type: 'music' },
  '12323': { name: 'Sunday Wind Down', desc: 'Sunday evening 7pm-10pm', type: 'chat' },
};

// Map show types to layouts
function getLayoutForShowType(type) {
  switch (type) {
    case 'chat': return presenterMainId;     // Full presenter view for chat shows
    case 'music': return musicOnlyId;        // Simpler view for music automation
    default: return presenterMainId;
  }
}

// Build weekly schedule with show objects
const weeklySchedule = {
  monday: [
    { time: '00:00', showId: '12524', end: '06:00' },
    { time: '06:00', showId: '11999', end: '10:00' },
    { time: '10:00', showId: '1820', end: '13:00' },
    { time: '13:00', showId: '1819', end: '16:00' },
    { time: '16:00', showId: '1818', end: '19:00' },
    { time: '19:00', showId: '12333', end: '22:00' },
    { time: '22:00', showId: '1815', end: '01:00' },
  ],
  tuesday: [
    { time: '01:00', showId: '12524', end: '06:00' },
    { time: '06:00', showId: '11999', end: '10:00' },
    { time: '10:00', showId: '1820', end: '13:00' },
    { time: '13:00', showId: '1819', end: '16:00' },
    { time: '16:00', showId: '1818', end: '19:00' },
    { time: '19:00', showId: '12333', end: '22:00' },
    { time: '22:00', showId: '1815', end: '01:00' },
  ],
  wednesday: [
    { time: '01:00', showId: '12524', end: '06:00' },
    { time: '06:00', showId: '11999', end: '10:00' },
    { time: '10:00', showId: '1820', end: '13:00' },
    { time: '13:00', showId: '1819', end: '16:00' },
    { time: '16:00', showId: '1818', end: '19:00' },
    { time: '19:00', showId: '12333', end: '22:00' },
    { time: '22:00', showId: '1815', end: '01:00' },
  ],
  thursday: [
    { time: '01:00', showId: '12524', end: '06:00' },
    { time: '06:00', showId: '11999', end: '10:00' },
    { time: '10:00', showId: '1820', end: '13:00' },
    { time: '13:00', showId: '1819', end: '16:00' },
    { time: '16:00', showId: '1818', end: '19:00' },
    { time: '19:00', showId: '12333', end: '22:00' },
    { time: '22:00', showId: '12524', end: '00:00' },
  ],
  friday: [
    { time: '00:00', showId: '12524', end: '06:00' },
    { time: '06:00', showId: '11999', end: '10:00' },
    { time: '10:00', showId: '1820', end: '13:00' },
    { time: '13:00', showId: '1819', end: '16:00' },
    { time: '16:00', showId: '1818', end: '18:00' },
    { time: '18:00', showId: '1812', end: '22:00' },
    { time: '22:00', showId: '12343', end: '01:00' },
  ],
  saturday: [
    { time: '06:00', showId: '12327', end: '10:00' },
    { time: '10:00', showId: '1813', end: '14:00' },
    { time: '14:00', showId: '13770', end: '18:00' },
    { time: '18:00', showId: '12325', end: '22:00' },
    { time: '22:00', showId: '12447', end: '00:00' },
    { time: '00:00', showId: '1817', end: '02:00' },
  ],
  sunday: [
    { time: '00:00', showId: '12524', end: '06:00' },
    { time: '06:00', showId: '12327', end: '10:00' },
    { time: '10:00', showId: '12335', end: '13:00' },
    { time: '13:00', showId: '12337', end: '16:00' },
    { time: '16:00', showId: '13316', end: '19:00' },
    { time: '19:00', showId: '12323', end: '22:00' },
    { time: '22:00', showId: '12524', end: '00:00' },
  ],
};

// Create a "show" per day with timeline referencing layouts
for (const [day, slots] of Object.entries(weeklySchedule)) {
  const showId = uuidv4();
  const dayName = day.charAt(0).toUpperCase() + day.slice(1);

  const timeline = slots.map(slot => {
    const show = narShows[slot.showId] || { name: 'Unknown', type: 'music' };
    return {
      time: slot.time,
      end: slot.end,
      layout_id: getLayoutForShowType(show.type),
      label: show.name,
      nar_show_id: slot.showId,
    };
  });

  insertShow.run(
    showId,
    studioId,
    `${dayName} Schedule`,
    `Full ${dayName} schedule for Now Ayrshire Radio`,
    JSON.stringify(timeline),
    day === getDayName() ? 1 : 0 // Active if today
  );
}

function getDayName() {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
}

console.log('Created 7 day schedules (shows)');

// ══════════════════════════════════════════
//  DONE
// ══════════════════════════════════════════

console.log('\n✅ Now Ayrshire Radio tenant fully seeded!');
console.log(`   Studio: ${studioId}`);
console.log('   Login: nar / NowAyrshire2026!');
console.log('   Screens: Presenter, Guest, Studio Wall, Green Room, Lobby');
console.log(`   Layouts: 11 purpose-built layouts`);
console.log('   Shows: 7-day weekly schedule from live NAR website');
console.log('\n   Available layouts:');
console.log('   • Presenter — Live Show (main presenter view)');
console.log('   • Presenter — News Hour (expanded news)');
console.log('   • Presenter — Travel & Weather (travel bulletin)');
console.log('   • Presenter — Sport Focus');
console.log('   • News TV — Live Feed (Sky/BBC/GB News)');
console.log('   • Guest Monitor');
console.log('   • Studio Wall — Broadcast');
console.log('   • Green Room');
console.log('   • Lobby / Public Display');
console.log('   • Breaking News');
console.log('   • Music / Overnight');

db.close();
