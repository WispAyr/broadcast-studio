const Database = require('better-sqlite3');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = new Database('data/broadcast.db');

// ── Create Kiltwalk Studio ──
const studioId = uuid();
db.prepare(`INSERT OR IGNORE INTO studios (id, name, slug, config, active) VALUES (?, ?, ?, ?, 1)`)
  .run(studioId, 'Kiltwalk Glasgow 2026', 'kiltwalk-glasgow', JSON.stringify({
    brand: {
      primary: '#1a1a2e',      // Kiltwalk navy
      secondary: '#e94560',    // Kiltwalk red/pink
      accent: '#0f3460',       // Deep blue
      highlight: '#ffffff',
      tartan: true,
    },
    event: {
      name: 'Glasgow Kiltwalk 2026',
      date: '2026-04-25',
      routes: ['Mighty Stride (23 miles)', 'Big Stroll (14 miles)', 'Wee Wander (6 miles)'],
      headline_sponsor: 'Arnold Clark',
      gold_sponsor: 'Johnston Carmichael',
    },
  }));
console.log('Created studio:', studioId);

// ── Create Kiltwalk user ──
const userId = uuid();
const hash = bcrypt.hashSync('Kiltwalk2026!', 10);
db.prepare(`INSERT OR IGNORE INTO users (id, username, password, name, role, studio_id, active) VALUES (?,?,?,?,?,?,1)`)
  .run(userId, 'kiltwalk', hash, 'Kiltwalk Producer', 'admin', studioId);
console.log('Created user: kiltwalk / Kiltwalk2026!');

// ── Create Screens ──
const screens = [
  { name: 'Finish Line LED Wall', num: 1, w: 1920, h: 1080, orient: 'landscape', group: 'finish' },
  { name: 'Start Line LED', num: 2, w: 1920, h: 1080, orient: 'landscape', group: 'start' },
  { name: 'Sponsor Board Left', num: 3, w: 1080, h: 1920, orient: 'portrait', group: 'sponsors' },
  { name: 'Sponsor Board Right', num: 4, w: 1080, h: 1920, orient: 'portrait', group: 'sponsors' },
  { name: 'VIP Marquee Screen', num: 5, w: 1920, h: 1080, orient: 'landscape', group: 'vip' },
  { name: 'Commentary Position', num: 6, w: 1920, h: 1080, orient: 'landscape', group: 'commentary' },
];
const screenIds = {};
for (const s of screens) {
  const id = uuid();
  screenIds[s.group + s.num] = id;
  db.prepare(`INSERT INTO screens (id, studio_id, name, screen_number, orientation, width, height, group_id, config) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, studioId, s.name, s.num, s.orient, s.w, s.h, s.group, '{}');
}
console.log('Created', screens.length, 'screens');

// ── Add Kiltwalk-specific module types ──
const newModules = [
  {
    id: 'kiltwalk-finisher-counter',
    name: 'Finisher Counter',
    description: 'Large animated counter showing total finishers with live increment animation',
    category: 'event',
    icon: '🏁',
    default_config: JSON.stringify({
      title: 'FINISHERS',
      count: 0,
      animate: true,
      fontSize: '180px',
      color: '#ffffff',
      accentColor: '#e94560',
      showConfetti: true,
    }),
  },
  {
    id: 'kiltwalk-hourly-stats',
    name: 'Hourly Stats',
    description: 'Stats panel: finishers this hour, %, pace, projected total',
    category: 'event',
    icon: '📊',
    default_config: JSON.stringify({
      thisHour: 0,
      percentComplete: 0,
      avgPaceMin: 0,
      projectedTotal: 0,
      showGraph: true,
    }),
  },
  {
    id: 'kiltwalk-sponsor-rotation',
    name: 'Sponsor Rotation',
    description: 'Rotating sponsor logos with tier-based display duration',
    category: 'event',
    icon: '🤝',
    default_config: JSON.stringify({
      sponsors: [
        { name: 'Arnold Clark', tier: 'headline', logo: '/assets/kiltwalk/arnold-clark.png', duration: 10 },
        { name: 'Johnston Carmichael', tier: 'gold', logo: '/assets/kiltwalk/jcca.png', duration: 8 },
        { name: 'Lidl', tier: 'partner', logo: '/assets/kiltwalk/lidl.png', duration: 6 },
        { name: 'Trespass', tier: 'partner', logo: '/assets/kiltwalk/trespass.png', duration: 6 },
        { name: 'Tunnocks', tier: 'partner', logo: '/assets/kiltwalk/tunnocks.png', duration: 6 },
        { name: "Walker's Shortbread", tier: 'partner', logo: '/assets/kiltwalk/walkers.png', duration: 6 },
        { name: 'Macb', tier: 'partner', logo: '/assets/kiltwalk/macb.png', duration: 5 },
        { name: 'JustGiving', tier: 'partner', logo: '/assets/kiltwalk/justgiving.png', duration: 5 },
      ],
      transitionEffect: 'fade',
      showTierLabel: true,
    }),
  },
  {
    id: 'kiltwalk-route-progress',
    name: 'Route Progress',
    description: 'Visual progress bars for each route (Mighty Stride, Big Stroll, Wee Wander)',
    category: 'event',
    icon: '🗺️',
    default_config: JSON.stringify({
      routes: [
        { name: 'Mighty Stride', distance: '23 miles', registered: 2500, finished: 0, color: '#e94560' },
        { name: 'Big Stroll', distance: '14 miles', registered: 4000, finished: 0, color: '#0f3460' },
        { name: 'Wee Wander', distance: '6 miles', registered: 3500, finished: 0, color: '#16a085' },
      ],
    }),
  },
  {
    id: 'kiltwalk-live-camera',
    name: 'Live Camera Feed',
    description: 'HLS/RTSP camera feed for finish line or course cameras',
    category: 'event',
    icon: '📹',
    default_config: JSON.stringify({
      url: '',
      label: 'FINISH LINE CAM',
      overlay: true,
      overlayPosition: 'bottom-left',
    }),
  },
  {
    id: 'kiltwalk-charity-ticker',
    name: 'Charity Ticker',
    description: 'Scrolling ticker showing recent charity fundraising milestones',
    category: 'event',
    icon: '💝',
    default_config: JSON.stringify({
      speed: 60,
      items: [
        'The Kiltwalk has raised over £40 million for Scottish charities since 2016',
        'Every penny raised goes to your chosen charity — The Hunter Foundation tops up by 50%',
        'Thank you to all our amazing Kiltwalkers!',
      ],
    }),
  },
  {
    id: 'kiltwalk-weather-compact',
    name: 'Event Weather',
    description: 'Compact weather for event day — temp, wind, rain chance',
    category: 'event',
    icon: '🌤️',
    default_config: JSON.stringify({
      source: 'siphon',
      endpoint: '/api/weather/glasgow',
      showForecast: true,
      compact: true,
    }),
  },
];

for (const m of newModules) {
  db.prepare(`INSERT OR REPLACE INTO module_types (id, name, description, category, icon, default_config) VALUES (?,?,?,?,?,?)`)
    .run(m.id, m.name, m.description, m.category, m.icon, m.default_config);
}
console.log('Created', newModules.length, 'module types');

// ── Create Layouts ──

// Layout 1: FINISH LINE HERO — Big counter, camera, sponsors
const layout1 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout1, studioId, 'Finish Line — Hero Counter', 12, 8, JSON.stringify([
    // Giant finisher counter — center top, massive
    { module: 'kiltwalk-finisher-counter', x: 0, y: 0, w: 8, h: 4, config: { title: 'FINISHERS', fontSize: '240px', showConfetti: true } },
    // Live camera feed — right side
    { module: 'kiltwalk-live-camera', x: 8, y: 0, w: 4, h: 4, config: { label: 'FINISH LINE', overlay: true } },
    // Route progress bars — bottom left
    { module: 'kiltwalk-route-progress', x: 0, y: 4, w: 4, h: 3, config: {} },
    // Hourly stats — bottom center
    { module: 'kiltwalk-hourly-stats', x: 4, y: 4, w: 4, h: 3, config: {} },
    // Sponsor rotation — bottom right
    { module: 'kiltwalk-sponsor-rotation', x: 8, y: 4, w: 4, h: 3, config: {} },
    // Charity ticker — very bottom full width
    { module: 'kiltwalk-charity-ticker', x: 0, y: 7, w: 12, h: 1, config: { speed: 50 } },
  ]));
console.log('Layout 1: Finish Line — Hero Counter');

// Layout 2: CAMERA FOCUS — Big camera, overlay stats
const layout2 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout2, studioId, 'Finish Line — Camera Focus', 12, 8, JSON.stringify([
    // Camera takes most of the screen
    { module: 'kiltwalk-live-camera', x: 0, y: 0, w: 12, h: 6, config: { label: 'LIVE — FINISH LINE', overlay: true, overlayPosition: 'top-right' } },
    // Counter overlaid bottom-left (smaller)
    { module: 'kiltwalk-finisher-counter', x: 0, y: 6, w: 4, h: 2, config: { title: 'CROSSED THE LINE', fontSize: '80px' } },
    // Hourly pace
    { module: 'kiltwalk-hourly-stats', x: 4, y: 6, w: 4, h: 2, config: { compact: true } },
    // Sponsor rotation
    { module: 'kiltwalk-sponsor-rotation', x: 8, y: 6, w: 4, h: 2, config: {} },
  ]));
console.log('Layout 2: Finish Line — Camera Focus');

// Layout 3: FULL STATS — Data-heavy for VIP/commentary
const layout3 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout3, studioId, 'Stats Dashboard', 12, 8, JSON.stringify([
    // Counter top-left
    { module: 'kiltwalk-finisher-counter', x: 0, y: 0, w: 4, h: 3, config: { title: 'TOTAL FINISHERS', fontSize: '120px' } },
    // Hourly stats top-center
    { module: 'kiltwalk-hourly-stats', x: 4, y: 0, w: 4, h: 3, config: { showGraph: true } },
    // Weather top-right
    { module: 'kiltwalk-weather-compact', x: 8, y: 0, w: 4, h: 3, config: {} },
    // Route progress — full width middle
    { module: 'kiltwalk-route-progress', x: 0, y: 3, w: 8, h: 3, config: {} },
    // Camera — right middle
    { module: 'kiltwalk-live-camera', x: 8, y: 3, w: 4, h: 3, config: { label: 'COURSE CAM' } },
    // Clock
    { module: 'clock', x: 0, y: 6, w: 3, h: 2, config: { format: '24h', showSeconds: true, label: 'EVENT TIME' } },
    // Sponsor rotation
    { module: 'kiltwalk-sponsor-rotation', x: 3, y: 6, w: 5, h: 2, config: {} },
    // Charity ticker
    { module: 'kiltwalk-charity-ticker', x: 8, y: 6, w: 4, h: 2, config: {} },
  ]));
console.log('Layout 3: Stats Dashboard');

// Layout 4: SPONSOR SHOWCASE — For sponsor boards (portrait)
const layout4 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout4, studioId, 'Sponsor Showcase (Portrait)', 6, 12, JSON.stringify([
    // Big sponsor logo rotation
    { module: 'kiltwalk-sponsor-rotation', x: 0, y: 0, w: 6, h: 6, config: { transitionEffect: 'slide', showTierLabel: true } },
    // Finisher counter
    { module: 'kiltwalk-finisher-counter', x: 0, y: 6, w: 6, h: 3, config: { title: 'FINISHERS', fontSize: '100px' } },
    // Route progress
    { module: 'kiltwalk-route-progress', x: 0, y: 9, w: 6, h: 3, config: {} },
  ]));
console.log('Layout 4: Sponsor Showcase (Portrait)');

// Layout 5: MINIMAL — Clean counter + camera only
const layout5 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout5, studioId, 'Minimal — Counter + Camera', 12, 8, JSON.stringify([
    // Camera full background
    { module: 'kiltwalk-live-camera', x: 0, y: 0, w: 12, h: 8, config: { label: '', overlay: false } },
    // Counter overlaid bottom-center (will need CSS overlay in the module)
    { module: 'kiltwalk-finisher-counter', x: 3, y: 5, w: 6, h: 3, config: { title: 'FINISHERS', fontSize: '160px', background: 'rgba(0,0,0,0.7)', showConfetti: false } },
  ]));
console.log('Layout 5: Minimal — Counter + Camera');

// Layout 6: TICKER HEAVY — For start line / course info
const layout6 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout6, studioId, 'Start Line — Countdown', 12, 8, JSON.stringify([
    // Big event branding text
    { module: 'text', x: 0, y: 0, w: 12, h: 2, config: { text: 'GLASGOW KILTWALK 2026', fontSize: '72px', align: 'center', color: '#ffffff', background: '#1a1a2e' } },
    // Route info
    { module: 'kiltwalk-route-progress', x: 0, y: 2, w: 8, h: 3, config: {} },
    // Weather
    { module: 'kiltwalk-weather-compact', x: 8, y: 2, w: 4, h: 3, config: {} },
    // Sponsors
    { module: 'kiltwalk-sponsor-rotation', x: 0, y: 5, w: 6, h: 2, config: {} },
    // Clock / countdown
    { module: 'countdown', x: 6, y: 5, w: 6, h: 2, config: { targetTime: '2026-04-25T08:00:00', label: 'START IN', completedText: 'WALK ON!' } },
    // Ticker
    { module: 'kiltwalk-charity-ticker', x: 0, y: 7, w: 12, h: 1, config: {} },
  ]));
console.log('Layout 6: Start Line — Countdown');

// Layout 7: EMERGENCY — Weather warning / course closure
const layout7 = uuid();
db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?,?,?,?,?,?)`)
  .run(layout7, studioId, 'Emergency — Course Alert', 12, 8, JSON.stringify([
    { module: 'text', x: 0, y: 0, w: 12, h: 3, config: { text: '⚠️ COURSE UPDATE', fontSize: '96px', align: 'center', color: '#ffffff', background: '#e94560' } },
    { module: 'text', x: 1, y: 3, w: 10, h: 3, config: { text: 'Please follow marshal instructions', fontSize: '48px', align: 'center', color: '#ffffff', background: '#1a1a2e' } },
    { module: 'kiltwalk-weather-compact', x: 0, y: 6, w: 6, h: 2, config: {} },
    { module: 'clock', x: 6, y: 6, w: 6, h: 2, config: { format: '24h', showSeconds: true } },
  ]));
console.log('Layout 7: Emergency — Course Alert');

// ── Create a Show (timeline) ──
const showId = uuid();
db.prepare(`INSERT INTO shows (id, studio_id, name, description, timeline, active, config) VALUES (?,?,?,?,?,?,?)`)
  .run(showId, studioId, 'Glasgow Kiltwalk — Event Day', 'Full event day timeline for finish line screens',
    JSON.stringify([
      { time: '07:00', layout_id: layout6, label: 'Pre-event — Start Line Countdown' },
      { time: '08:00', layout_id: layout2, label: 'Race Start — Camera Focus' },
      { time: '09:30', layout_id: layout1, label: 'First Finishers — Hero Counter' },
      { time: '10:00', layout_id: layout3, label: 'Mid-morning — Stats Dashboard' },
      { time: '10:30', layout_id: layout1, label: 'Peak Finishers — Hero Counter' },
      { time: '12:00', layout_id: layout2, label: 'Lunch — Camera Focus' },
      { time: '13:00', layout_id: layout3, label: 'Afternoon — Stats Dashboard' },
      { time: '15:00', layout_id: layout1, label: 'Final Push — Hero Counter' },
      { time: '17:00', layout_id: layout5, label: 'Wind Down — Minimal' },
    ]),
    0, '{}');
console.log('Created show: Glasgow Kiltwalk — Event Day');

console.log('\n✅ Kiltwalk Glasgow studio ready');
console.log('   Login: kiltwalk / Kiltwalk2026!');
console.log('   Screens:', screens.length);
console.log('   Layouts: 7');
console.log('   Modules: 7 new event-specific types');
console.log('   Show: 1 full-day timeline');

db.close();
