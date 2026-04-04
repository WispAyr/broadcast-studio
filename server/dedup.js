const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data', 'broadcast.db'));

const screens = db.prepare('SELECT id, name, orientation, width, height, created_at FROM screens ORDER BY name, created_at').all();
const seen = {};
screens.forEach(s => {
  if (seen[s.name]) {
    console.log('Removing duplicate:', s.name, s.id);
    db.prepare('DELETE FROM screens WHERE id = ?').run(s.id);
  } else {
    seen[s.name] = true;
  }
});

// Ensure Pavilion LED is correct
db.prepare("UPDATE screens SET orientation = 'custom', width = 1024, height = 768 WHERE name = 'Pavilion LED'").run();

console.log('Final:');
db.prepare('SELECT name, orientation, width, height FROM screens').all().forEach(s => 
  console.log(`  ${s.name}: ${s.orientation} ${s.width}x${s.height}`)
);
