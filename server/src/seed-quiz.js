/**
 * QuizCast scenes — one-tap "Quiz Live" + "Quiz Join" layouts.
 *
 * Creates two full-screen layouts per studio so an operator can push a quiz
 * to the venue screens in one tap from the Live Mode hotbar:
 *   - "🎯 Quiz Live"  — QuizCast big-screen game view (mode: screen)
 *   - "🎯 Quiz — Join" — standalone scan-to-join card (mode: join)
 *
 * The join CODE is intentionally left blank: the operator sets it live from the
 * Live Mode "Quiz" panel (or the layout editor) once the host starts a QuizCast
 * session and gets its 5-char code. The module shows a "no code" prompt until
 * then, so pushing an empty scene is safe.
 *
 * Run:
 *   node server/src/seed-quiz.js                 # all active studios
 *   node server/src/seed-quiz.js now-ayrshire    # one studio by slug
 *
 * Idempotent: reuses layouts by (studio_id, name).
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'broadcast.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const QUIZ_BASE = process.env.QUIZ_BASE || 'https://quiz.wispayr.online';

const SCENES = [
  { name: '🎯 Quiz Live', mode: 'screen', bg: '#000000' },
  { name: '🎯 Quiz — Join', mode: 'join', bg: '#0b1020' },
];

const slugArg = process.argv[2];
const studios = slugArg
  ? db.prepare('SELECT * FROM studios WHERE slug = ?').all(slugArg)
  : db.prepare('SELECT * FROM studios WHERE active = 1').all();

if (studios.length === 0) {
  console.error(slugArg ? `No studio with slug "${slugArg}".` : 'No active studios.');
  process.exit(1);
}

const hasBackground = db.prepare('PRAGMA table_info(layouts)').all().some((c) => c.name === 'background');

for (const studio of studios) {
  for (const scene of SCENES) {
    const modulesJson = JSON.stringify([
      {
        id: uuidv4(),
        type: 'quiz',
        fullscreen: true,
        x: 0, y: 0, w: 12, h: 8,
        config: { base: QUIZ_BASE, mode: scene.mode, code: '' },
      },
    ]);

    const existing = db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ?').get(studio.id, scene.name);
    if (existing) {
      db.prepare("UPDATE layouts SET modules = ?, grid_cols = 12, grid_rows = 8, updated_at = datetime('now') WHERE id = ?")
        .run(modulesJson, existing.id);
      console.log(`[${studio.slug}] updated: ${scene.name}`);
    } else {
      const id = uuidv4();
      if (hasBackground) {
        db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background) VALUES (?, ?, ?, 12, 8, ?, ?)')
          .run(id, studio.id, scene.name, modulesJson, scene.bg);
      } else {
        db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules) VALUES (?, ?, ?, 12, 8, ?)')
          .run(id, studio.id, scene.name, modulesJson);
      }
      console.log(`[${studio.slug}] created: ${scene.name}`);
    }
  }
}

console.log('');
console.log('─'.repeat(60));
console.log('QuizCast scenes ready.');
console.log('Operator flow: start a session in QuizCast → note the 5-char code →');
console.log('push "🎯 Quiz Live" → set the code in the Live Mode "Quiz" panel.');
console.log('─'.repeat(60));

db.close();
