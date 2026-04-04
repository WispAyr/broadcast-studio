const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));

// Migration
const cols = db.prepare("PRAGMA table_info(screens)").all().map(c => c.name);
console.log('Existing columns:', cols.join(', '));

if (!cols.includes('orientation')) {
  db.exec("ALTER TABLE screens ADD COLUMN orientation TEXT DEFAULT 'landscape'");
  console.log('Added orientation column');
}
if (!cols.includes('width')) {
  db.exec("ALTER TABLE screens ADD COLUMN width INTEGER DEFAULT 1920");
  console.log('Added width column');
}
if (!cols.includes('height')) {
  db.exec("ALTER TABLE screens ADD COLUMN height INTEGER DEFAULT 1080");
  console.log('Added height column');
}
if (!cols.includes('config')) {
  db.exec("ALTER TABLE screens ADD COLUMN config TEXT DEFAULT '{}'");
  console.log('Added config column');
}
if (!cols.includes('group_id')) {
  db.exec("ALTER TABLE screens ADD COLUMN group_id TEXT");
  console.log('Added group_id column');
}

db.exec(`CREATE TABLE IF NOT EXISTS screen_groups (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  profile TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (studio_id) REFERENCES studios(id)
)`);
console.log('screen_groups table ensured');

// Update screen orientations
const updates = {
  'Pavilion LED': { orientation: 'custom', width: 1024, height: 768 },
  'Advert Screen One': { orientation: 'portrait', width: 1080, height: 1920 },
  'Advert Screen Two': { orientation: 'portrait', width: 1080, height: 1920 },
  'Advert Screen Three': { orientation: 'portrait', width: 1080, height: 1920 },
};

const studioId = db.prepare('SELECT id FROM studios LIMIT 1').get()?.id;

for (const [name, vals] of Object.entries(updates)) {
  const existing = db.prepare('SELECT id FROM screens WHERE name = ?').get(name);
  if (existing) {
    db.prepare('UPDATE screens SET orientation = ?, width = ?, height = ? WHERE name = ?')
      .run(vals.orientation, vals.width, vals.height, name);
    console.log('Updated:', name);
  } else if (studioId) {
    const maxNum = db.prepare('SELECT MAX(screen_number) as m FROM screens').get()?.m || 0;
    db.prepare('INSERT INTO screens (id, studio_id, name, screen_number, orientation, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), studioId, name, maxNum + 1, vals.orientation, vals.width, vals.height);
    console.log('Created:', name);
  }
}

const after = db.prepare('SELECT name, orientation, width, height FROM screens').all();
console.log('\nFinal state:');
after.forEach(s => console.log(`  ${s.name}: ${s.orientation} ${s.width}x${s.height}`));
