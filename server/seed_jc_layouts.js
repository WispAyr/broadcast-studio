const Database = require('better-sqlite3');
const { v4: uuid } = require('uuid');
const db = new Database('/root/broadcast-studio/server/data/broadcast.db');

const STUDIO_ID = 'c642f3fb-6c12-43a8-8f29-ca273f3f3ba6';
const URL_BASE = `/uploads/${STUDIO_ID}`;

// Slug used to dedupe re-runs
const slides = [
  {
    slug: 'jc-title-live-feed-walker-count',
    name: 'JC — Title + Live Feed + Walker Count',
    image: 'jc-slide-1.png',
    // Background only — video + counter widgets are added manually in the layout editor.
  },
  { slug: 'jc-finish-line-congrats', name: 'JC — Finish Line Congratulations', image: 'jc-slide-2.png' },
  { slug: 'jc-powered-by-grit', name: 'JC — Powered by Grit', image: 'jc-slide-3.png' },
  { slug: 'jc-numbers-brought-by', name: 'JC — Numbers Brought To You By', image: 'jc-slide-4.png' },
  { slug: 'jc-we-crunched-numbers', name: 'JC — You Walked, We Crunched', image: 'jc-slide-5.png' },
  { slug: 'jc-creating-impact', name: 'JC — Creating Impact', image: 'jc-slide-6.png' },
  { slug: 'jc-pure-dead-brilliant', name: 'JC — Pure Dead Brilliant', image: 'jc-slide-7.png' },
];

// Delete any prior rows we inserted for these names (rerun-safe)
const names = slides.map(s => s.name);
const placeholders = names.map(() => '?').join(',');
const deleted = db.prepare(`DELETE FROM layouts WHERE studio_id = ? AND name IN (${placeholders})`).run(STUDIO_ID, ...names);
console.log(`Removed ${deleted.changes} prior JC layout rows`);

const insert = db.prepare(`INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background, orientation, resolution_w, resolution_h) VALUES (?,?,?,?,?,?,?,?,?,?)`);

for (const s of slides) {
  const modules = [
    { module: 'image', x: 0, y: 0, w: 12, h: 8, config: { src: `${URL_BASE}/${s.image}`, fit: 'cover', alt: s.name } },
    ...(s.overlays || []),
  ];
  insert.run(uuid(), STUDIO_ID, s.name, 12, 8, JSON.stringify(modules), '#e63b2b', 'landscape', 1920, 1080);
  console.log(`+ ${s.name}  (${modules.length} module${modules.length > 1 ? 's' : ''})`);
}

console.log(`\nDone. ${slides.length} JC layouts seeded into studio ${STUDIO_ID}.`);
db.close();
