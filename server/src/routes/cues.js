const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Ensure table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cue_lists (
      id TEXT PRIMARY KEY,
      studio_id TEXT NOT NULL,
      name TEXT NOT NULL,
      cues TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (studio_id) REFERENCES studios(id)
    );
  `);
} catch (e) {
  console.error('Failed to create cue_lists table:', e.message);
}

// GET /api/cues?studio_id=xxx
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    const rows = db.prepare('SELECT * FROM cue_lists WHERE studio_id = ? ORDER BY updated_at DESC').all(studioId);
    const cueLists = rows.map(r => ({ ...r, cues: JSON.parse(r.cues || '[]') }));
    res.json(cueLists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cues
router.post('/', authenticate, (req, res) => {
  try {
    const { studio_id, name, cues } = req.body;
    const id = uuidv4();
    const sid = studio_id || req.user.studio_id;
    db.prepare('INSERT INTO cue_lists (id, studio_id, name, cues) VALUES (?, ?, ?, ?)').run(id, sid, name || 'Untitled', JSON.stringify(cues || []));
    res.json({ id, studio_id: sid, name, cues: cues || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/cues/:id
router.put('/:id', authenticate, (req, res) => {
  try {
    const { name, cues } = req.body;
    db.prepare("UPDATE cue_lists SET name = ?, cues = ?, updated_at = datetime('now') WHERE id = ?").run(name, JSON.stringify(cues || []), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cues/:id
router.delete('/:id', authenticate, (req, res) => {
  try {
    db.prepare('DELETE FROM cue_lists WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
