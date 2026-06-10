/**
 * Branded template library — NOW Ayrshire Radio + SideLiner's packs.
 *
 * The Templates feature shipped with essentially no content (a handful of
 * empty test rows). This seeds production-ready, keyframe-animated templates
 * that play live via the `template` module / TemplateModule:
 *
 *   NAR (studio slug now-ayrshire):
 *     • NAR — Lower Third          (guest/caller strap)
 *     • NAR — Breaking Strip       (full-width red breaking bar)
 *     • NAR — Coming Up            (full-frame next-show slate)
 *     • NAR — Ident Slate          (station ident wash)
 *   SideLiner's (studio slug sideliners-fanzone):
 *     • SL — Lower Third
 *     • SL — Title Slate
 *     • SL — Score Strip           (corner score bug)
 *     • SL — Sting Wash            (3s transition slate)
 *
 * Idempotent: templates are matched by (studio_id, name) and updated in
 * place, so operator edits to OTHER templates are never touched.
 * Run: node server/seed-templates.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');

const FPS = 30;
const W = 1920, H = 1080;

// ── Brand palettes ──────────────────────────────────────────────────────────
const NAR = { orange: '#F7941D', red: '#E2392D', navy: '#1E2A35', deep: '#11181f', pink: '#f4a3c7', font: 'Poppins' };
const SL = { purple: '#7a2f9e', hi: '#a44ad0', navy: '#241a40', deep: '#15102b', gold: '#ffd24a', font: 'Oswald' };

// ── Element builders (mirror TemplateEditor's defaultElement shape) ─────────
const baseStyle = { fill: '#ffffff', stroke: '', strokeWidth: 0, borderRadius: 0, shadow: '', blur: 0 };
const baseText = {
  content: '', fontFamily: 'Inter', fontSize: 64, fontWeight: 700, align: 'left', vertAlign: 'center',
  letterSpacing: 0, lineHeight: 1.2, kerning: 0, textTransform: 'none', wordSpacing: 0,
  animIn: 'none', animOut: 'none', animDuration: 0.5, animDelay: 0, animStagger: 0.05, padding: 0, whiteSpace: 'nowrap',
};

function el(type, name, keyframes, extra = {}) {
  return {
    id: uuid(), type, name, locked: false, visible: true,
    keyframes, easing: extra.easing || { default: 'easeOut' },
    style: { ...baseStyle, ...(extra.style || {}) },
    textConfig: { ...baseText, ...(extra.text || {}) },
    shapeConfig: { shape: 'rectangle' },
    imageConfig: { src: '', fit: 'contain' },
    videoConfig: { src: '', fit: 'cover', loop: true, autoplay: true, muted: true },
    particleConfig: { count: 50, color: '#ff6600', speed: 2, size: 4, spread: 360, ...(extra.particles || {}) },
    iconConfig: { icon: 'star' },
    gradientConfig: extra.gradient || { stops: [{ color: '#1a1a2e', pos: 0 }, { color: '#16213e', pos: 50 }, { color: '#0f3460', pos: 100 }], angle: 135 },
  };
}
// keyframe helper: kf(frame, x, y, w, h, opacity, scale, rotation)
const kf = (x, y, w, h, opacity = 1, scale = 1, rotation = 0) => ({ x, y, width: w, height: h, opacity, scale, rotation });

// ── SVG thumbnail (data URI) so the gallery isn't a wall of grey boxes ──────
function thumb(bg, accent, label, sub) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
  <rect width="320" height="180" fill="${bg}"/>
  <rect x="20" y="118" width="8" height="36" fill="${accent}"/>
  <rect x="34" y="118" width="170" height="36" fill="${accent}" opacity="0.25"/>
  <text x="40" y="142" font-family="Helvetica,Arial" font-size="17" font-weight="700" fill="#ffffff">${label}</text>
  ${sub ? `<text x="22" y="40" font-family="Helvetica,Arial" font-size="13" font-weight="700" letter-spacing="2" fill="${accent}">${sub}</text>` : ''}
</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// ════════════════════════════════════════════════════════════════════════════
//  NAR pack
// ════════════════════════════════════════════════════════════════════════════

function narLowerThird() {
  return [
    // accent bar sweeps in
    el('shape', 'Accent bar', {
      '0': kf(-700, 846, 14, 158, 0), '10': kf(120, 846, 14, 158, 1),
    }, { style: { fill: NAR.orange }, easing: { default: 'easeOut' } }),
    // navy panel slides in just behind it
    el('shape', 'Panel', {
      '0': kf(-820, 846, 820, 158, 0), '14': kf(146, 846, 820, 158, 1),
    }, { style: { fill: NAR.navy, shadow: '0 12px 40px rgba(0,0,0,0.5)' }, easing: { default: 'easeOut' } }),
    // gold kicker chip
    el('shape', 'Kicker chip', {
      '8': kf(170, 818, 0, 44, 0), '18': kf(170, 818, 300, 44, 1),
    }, { style: { fill: NAR.orange } }),
    el('text', 'Kicker', {
      '12': kf(186, 822, 270, 36, 0), '20': kf(186, 822, 270, 36, 1),
    }, { text: { content: 'IN THE STUDIO', fontFamily: NAR.font, fontSize: 24, fontWeight: 800, letterSpacing: 3, align: 'left' }, style: { fill: NAR.navy } }),
    // name + role
    el('text', 'Name', {
      '12': kf(186, 880, 760, 64, 0), '22': kf(186, 872, 760, 64, 1),
    }, { text: { content: 'Guest Name', fontFamily: NAR.font, fontSize: 52, fontWeight: 800, align: 'left' }, style: { fill: '#ffffff' } }),
    el('text', 'Role', {
      '16': kf(186, 948, 760, 40, 0), '26': kf(186, 940, 760, 40, 1),
    }, { text: { content: 'NOW Ayrshire Radio', fontFamily: NAR.font, fontSize: 30, fontWeight: 600, align: 'left' }, style: { fill: NAR.orange } }),
  ];
}

function narBreaking() {
  return [
    // full-width strip rises from the bottom edge
    el('shape', 'Strip', {
      '0': kf(0, 1080, 1920, 150, 1), '10': kf(0, 930, 1920, 150, 1),
    }, { style: { fill: NAR.red, shadow: '0 -10px 40px rgba(0,0,0,0.45)' }, easing: { default: 'easeOut' } }),
    // BREAKING tab — darker block, pulses
    el('shape', 'Tab', {
      '6': kf(0, 930, 0, 150, 1), '14': kf(0, 930, 420, 150, 1),
    }, { style: { fill: '#9c1f15' } }),
    el('text', 'BREAKING', {
      '10': kf(30, 975, 360, 60, 0), '16': kf(30, 975, 360, 60, 1),
      '60': kf(30, 975, 360, 60, 1), '75': kf(30, 975, 360, 60, 0.55),
      '90': kf(30, 975, 360, 60, 1), '105': kf(30, 975, 360, 60, 0.55),
      '120': kf(30, 975, 360, 60, 1),
    }, { text: { content: 'BREAKING', fontFamily: NAR.font, fontSize: 48, fontWeight: 800, letterSpacing: 4, align: 'center' }, style: { fill: '#ffffff' }, easing: { default: 'easeInOut' } }),
    el('text', 'Headline', {
      '14': kf(470, 985, 1400, 56, 0), '24': kf(460, 977, 1400, 56, 1),
    }, { text: { content: 'Edit this headline in the template editor…', fontFamily: NAR.font, fontSize: 42, fontWeight: 600, align: 'left' }, style: { fill: '#ffffff' } }),
  ];
}

function narComingUp() {
  return [
    el('gradient', 'Background', { '0': kf(0, 0, W, H) }, {
      gradient: { stops: [{ color: NAR.navy, pos: 0 }, { color: NAR.deep, pos: 70 }, { color: '#0a0e13', pos: 100 }], angle: 135 },
    }),
    el('particles', 'Embers', { '0': kf(1100, 100, 800, 900, 0.5) }, {
      particles: { count: 36, color: NAR.orange, speed: 1, size: 5, spread: 360 },
    }),
    el('shape', 'Kicker chip', {
      '0': kf(160, 330, 0, 56, 0), '10': kf(160, 330, 320, 56, 1),
    }, { style: { fill: NAR.orange } }),
    el('text', 'Kicker', {
      '6': kf(180, 338, 280, 44, 0), '14': kf(180, 338, 280, 44, 1),
    }, { text: { content: 'COMING UP', fontFamily: NAR.font, fontSize: 30, fontWeight: 800, letterSpacing: 5, align: 'left' }, style: { fill: NAR.navy } }),
    el('text', 'Title', {
      '8': kf(156, 470, 1600, 140, 0), '20': kf(156, 440, 1600, 140, 1),
    }, { text: { content: 'Show Name Here', fontFamily: NAR.font, fontSize: 120, fontWeight: 800, align: 'left' }, style: { fill: '#ffffff' }, easing: { default: 'spring' } }),
    el('text', 'Subtitle', {
      '16': kf(160, 620, 1500, 60, 0), '26': kf(160, 600, 1500, 60, 1),
    }, { text: { content: 'Weekdays from 6am · NOW Ayrshire Radio', fontFamily: NAR.font, fontSize: 44, fontWeight: 500, align: 'left' }, style: { fill: NAR.pink } }),
    // underline accent grows
    el('shape', 'Underline', {
      '20': kf(160, 700, 0, 10, 1), '34': kf(160, 700, 720, 10, 1),
    }, { style: { fill: NAR.orange } }),
  ];
}

function narIdent() {
  return [
    el('gradient', 'Wash', { '0': kf(0, 0, W, H) }, {
      gradient: { stops: [{ color: NAR.orange, pos: 0 }, { color: '#e2638f', pos: 45 }, { color: NAR.navy, pos: 100 }], angle: 120 },
    }),
    el('text', 'Wordmark', {
      '0': kf(260, 420, 1400, 160, 0, 0.7), '14': kf(260, 420, 1400, 160, 1, 1),
    }, { text: { content: 'NOW Ayrshire Radio', fontFamily: NAR.font, fontSize: 130, fontWeight: 800, align: 'center' }, style: { fill: '#ffffff', shadow: '0 10px 50px rgba(0,0,0,0.35)' }, easing: { default: 'spring' } }),
    el('text', 'Tagline', {
      '12': kf(260, 600, 1400, 60, 0), '24': kf(260, 585, 1400, 60, 1),
    }, { text: { content: 'Get turned on to that local feeling · across Ayrshire', fontFamily: NAR.font, fontSize: 40, fontWeight: 600, align: 'center' }, style: { fill: '#ffffff' } }),
  ];
}

// ════════════════════════════════════════════════════════════════════════════
//  SideLiner's pack
// ════════════════════════════════════════════════════════════════════════════

function slLowerThird() {
  return [
    el('shape', 'Kicker tab', {
      '0': kf(-400, 832, 260, 42, 0), '10': kf(96, 832, 260, 42, 1),
    }, { style: { fill: SL.gold } }),
    el('text', 'Kicker', {
      '6': kf(112, 838, 230, 32, 0), '14': kf(112, 838, 230, 32, 1),
    }, { text: { content: 'ON AIR', fontFamily: SL.font, fontSize: 24, fontWeight: 700, letterSpacing: 4, align: 'left', textTransform: 'uppercase' }, style: { fill: SL.navy } }),
    el('shape', 'Panel', {
      '4': kf(-900, 884, 880, 150, 0), '16': kf(96, 884, 880, 150, 1),
    }, { style: { fill: SL.purple, shadow: '0 12px 40px rgba(0,0,0,0.5)' } }),
    el('shape', 'Panel edge', {
      '14': kf(96, 884, 0, 150, 1), '24': kf(96, 884, 10, 150, 1),
    }, { style: { fill: SL.gold } }),
    el('text', 'Name', {
      '14': kf(136, 906, 800, 60, 0), '24': kf(136, 898, 800, 60, 1),
    }, { text: { content: 'Scott Watson', fontFamily: SL.font, fontSize: 52, fontWeight: 700, align: 'left' }, style: { fill: '#ffffff' } }),
    el('text', 'Role', {
      '18': kf(136, 972, 800, 36, 0), '28': kf(136, 964, 800, 36, 1),
    }, { text: { content: "SideLiner's · Ayrshire's Best Sports Show", fontFamily: SL.font, fontSize: 28, fontWeight: 500, align: 'left' }, style: { fill: SL.hi } }),
  ];
}

function slTitleSlate() {
  return [
    el('gradient', 'Background', { '0': kf(0, 0, W, H) }, {
      gradient: { stops: [{ color: SL.navy, pos: 0 }, { color: SL.deep, pos: 100 }], angle: 135 },
    }),
    el('shape', 'Kicker tab', {
      '0': kf(160, 360, 0, 52, 0), '10': kf(160, 360, 330, 52, 1),
    }, { style: { fill: SL.gold } }),
    el('text', 'Kicker', {
      '6': kf(180, 368, 300, 40, 0), '14': kf(180, 368, 300, 40, 1),
    }, { text: { content: "SIDELINER'S", fontFamily: SL.font, fontSize: 30, fontWeight: 700, letterSpacing: 5, align: 'left' }, style: { fill: SL.navy } }),
    el('text', 'Title', {
      '8': kf(156, 490, 1650, 130, 0), '20': kf(156, 460, 1650, 130, 1),
    }, { text: { content: 'The Big Talking Point', fontFamily: SL.font, fontSize: 110, fontWeight: 700, align: 'left' }, style: { fill: '#ffffff' }, easing: { default: 'spring' } }),
    el('text', 'Subtitle', {
      '16': kf(160, 630, 1500, 56, 0), '26': kf(160, 612, 1500, 56, 1),
    }, { text: { content: 'Your shouts · text 81400', fontFamily: SL.font, fontSize: 42, fontWeight: 500, align: 'left' }, style: { fill: SL.hi } }),
    el('particles', 'Sparks', { '0': kf(1300, 150, 600, 800, 0.4) }, {
      particles: { count: 28, color: SL.gold, speed: 1, size: 4, spread: 360 },
    }),
  ];
}

function slScoreStrip() {
  return [
    // navy strip drops in top-left
    el('shape', 'Strip', {
      '0': kf(70, -140, 600, 96, 1), '10': kf(70, 56, 600, 96, 1),
    }, { style: { fill: SL.navy, shadow: '0 10px 30px rgba(0,0,0,0.5)' }, easing: { default: 'easeOut' } }),
    el('text', 'Home', {
      '8': kf(95, 80, 150, 52, 0), '16': kf(95, 80, 150, 52, 1),
    }, { text: { content: 'SCO', fontFamily: SL.font, fontSize: 44, fontWeight: 700, align: 'center' }, style: { fill: '#ffffff' } }),
    el('shape', 'Score chip', {
      '6': kf(262, 70, 0, 68, 1), '14': kf(262, 70, 150, 68, 1),
    }, { style: { fill: SL.gold } }),
    el('text', 'Score', {
      '12': kf(262, 80, 150, 50, 0), '18': kf(262, 80, 150, 50, 1),
    }, { text: { content: '0 - 0', fontFamily: SL.font, fontSize: 46, fontWeight: 700, align: 'center' }, style: { fill: SL.navy } }),
    el('text', 'Away', {
      '8': kf(430, 80, 150, 52, 0), '16': kf(430, 80, 150, 52, 1),
    }, { text: { content: 'HAI', fontFamily: SL.font, fontSize: 44, fontWeight: 700, align: 'center' }, style: { fill: '#ffffff' } }),
    el('shape', 'Minute chip', {
      '14': kf(670, 56, 0, 96, 1), '20': kf(670, 56, 110, 96, 1),
    }, { style: { fill: SL.purple } }),
    el('text', 'Minute', {
      '18': kf(670, 84, 110, 44, 0), '24': kf(670, 84, 110, 44, 1),
    }, { text: { content: "45'", fontFamily: SL.font, fontSize: 40, fontWeight: 700, align: 'center' }, style: { fill: '#ffffff' } }),
  ];
}

function slStingWash() {
  return [
    // gold sweep crosses the frame behind the wordmark
    el('shape', 'Sweep', {
      '0': kf(-2200, 0, 2000, 1080, 0.9, 1, 0), '20': kf(2200, 0, 2000, 1080, 0.9, 1, 0),
    }, { style: { fill: SL.gold }, easing: { default: 'easeInOut' } }),
    el('gradient', 'Wash', {
      '0': kf(0, 0, W, H, 0), '8': kf(0, 0, W, H, 1),
    }, { gradient: { stops: [{ color: SL.purple, pos: 0 }, { color: SL.navy, pos: 60 }, { color: SL.deep, pos: 100 }], angle: 135 } }),
    el('text', 'Wordmark', {
      '6': kf(360, 460, 1200, 160, 0, 0.6), '18': kf(360, 460, 1200, 160, 1, 1),
    }, { text: { content: "SideLiner's", fontFamily: SL.font, fontSize: 150, fontWeight: 700, align: 'center' }, style: { fill: '#ffffff', shadow: '0 0 60px rgba(255,210,74,0.45)' }, easing: { default: 'spring' } }),
  ];
}

// ════════════════════════════════════════════════════════════════════════════
//  Seed
// ════════════════════════════════════════════════════════════════════════════

const PACKS = [
  { slug: 'now-ayrshire', templates: [
    { name: 'NAR — Lower Third', category: 'lower-third', duration: 6, elements: narLowerThird(), th: thumb(NAR.navy, NAR.orange, 'Guest Name', 'IN THE STUDIO') },
    { name: 'NAR — Breaking Strip', category: 'lower-third', duration: 8, elements: narBreaking(), th: thumb('#220b08', NAR.red, 'BREAKING', 'NOW AYRSHIRE') },
    { name: 'NAR — Coming Up', category: 'fullscreen', duration: 6, elements: narComingUp(), th: thumb(NAR.deep, NAR.orange, 'Show Name Here', 'COMING UP') },
    { name: 'NAR — Ident Slate', category: 'fullscreen', duration: 5, elements: narIdent(), th: thumb(NAR.orange, '#ffffff', 'NOW Ayrshire Radio', '') },
  ]},
  { slug: 'sideliners-fanzone', templates: [
    { name: 'SL — Lower Third', category: 'lower-third', duration: 6, elements: slLowerThird(), th: thumb(SL.navy, SL.gold, 'Scott Watson', 'ON AIR') },
    { name: 'SL — Title Slate', category: 'fullscreen', duration: 5, elements: slTitleSlate(), th: thumb(SL.deep, SL.gold, 'The Big Talking Point', "SIDELINER'S") },
    { name: 'SL — Score Strip', category: 'overlay', duration: 8, elements: slScoreStrip(), th: thumb(SL.navy, SL.gold, 'SCO 0-0 HAI', 'SCORE') },
    { name: 'SL — Sting Wash', category: 'fullscreen', duration: 3, elements: slStingWash(), th: thumb(SL.purple, SL.gold, "SideLiner's", 'STING') },
  ]},
];

for (const pack of PACKS) {
  const studio = db.prepare('SELECT id, name FROM studios WHERE slug = ?').get(pack.slug);
  if (!studio) { console.warn(`[skip] studio '${pack.slug}' not found`); continue; }
  for (const t of pack.templates) {
    const elements = JSON.stringify(t.elements);
    const ex = db.prepare('SELECT id FROM templates WHERE studio_id = ? AND name = ?').get(studio.id, t.name);
    if (ex) {
      db.prepare(`UPDATE templates SET category=?, duration=?, fps=?, width=?, height=?, elements=?, thumbnail=?, updated_at=datetime('now') WHERE id=?`)
        .run(t.category, t.duration, FPS, W, H, elements, t.th, ex.id);
      console.log(`[update] ${studio.name} · ${t.name}`);
    } else {
      db.prepare(`INSERT INTO templates (id, studio_id, name, description, category, duration, fps, width, height, elements, thumbnail)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(uuid(), studio.id, t.name, null, t.category, t.duration, FPS, W, H, elements, t.th);
      console.log(`[create] ${studio.name} · ${t.name}`);
    }
  }
}

console.log('\n✅ Template library seeded. Play them on screen via the `template` module (templateId), or edit in /control/templates.');
db.close();
