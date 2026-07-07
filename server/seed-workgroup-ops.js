/**
 * Seeds an "Ops" workgroup that spans EVERY active studio, so ops staff who are
 * members get everything operational in their studio picker without being
 * super_admin. Adds the 'admin' user as an initial member (add real ops staff
 * in /control/workgroups).
 *
 * Idempotent + non-destructive: reuses an existing "Ops" workgroup, only adds
 * missing studios/members. Config only — grants picker reach, fires nothing.
 *
 * Run:  node server/seed-workgroup-ops.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuid } = require('uuid');

const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));
db.pragma('journal_mode = WAL');

// Ensure schema (mirrors routes/workgroups.js) in case this runs pre-boot.
db.exec(`
  CREATE TABLE IF NOT EXISTS workgroups (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, icon TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS workgroup_members (id TEXT PRIMARY KEY, workgroup_id TEXT NOT NULL, user_id TEXT NOT NULL, UNIQUE (workgroup_id, user_id));
  CREATE TABLE IF NOT EXISTS workgroup_studios (id TEXT PRIMARY KEY, workgroup_id TEXT NOT NULL, studio_id TEXT NOT NULL, UNIQUE (workgroup_id, studio_id));
`);

let wg = db.prepare("SELECT * FROM workgroups WHERE name = 'Ops'").get();
if (!wg) {
  const id = uuid();
  db.prepare('INSERT INTO workgroups (id, name, description, icon) VALUES (?, ?, ?, ?)')
    .run(id, 'Ops', 'Operations — access to every studio', '🛠️');
  wg = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(id);
}

const studios = db.prepare('SELECT id, name FROM studios WHERE active = 1').all();
const addStudio = db.prepare('INSERT OR IGNORE INTO workgroup_studios (id, workgroup_id, studio_id) VALUES (?, ?, ?)');
let s = 0;
for (const st of studios) { if (addStudio.run(uuid(), wg.id, st.id).changes) s++; }

let m = 0;
const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (admin) {
  const r = db.prepare('INSERT OR IGNORE INTO workgroup_members (id, workgroup_id, user_id) VALUES (?, ?, ?)').run(uuid(), wg.id, admin.id);
  m += r.changes;
}

const totalStudios = db.prepare('SELECT COUNT(*) n FROM workgroup_studios WHERE workgroup_id = ?').get(wg.id).n;
const totalMembers = db.prepare('SELECT COUNT(*) n FROM workgroup_members WHERE workgroup_id = ?').get(wg.id).n;
console.log(`[workgroup] "Ops" ${wg.id}: +${s} studio(s), +${m} member(s) this run.`);
console.log(`            now ${totalStudios} studio(s) (of ${studios.length} active), ${totalMembers} member(s). Add ops staff in /control/workgroups.`);
