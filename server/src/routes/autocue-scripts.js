const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET / — list scripts for studio
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const scripts = db.prepare('SELECT id, studio_id, name, speed, font_size, created_at, updated_at FROM autocue_scripts WHERE studio_id = ? ORDER BY updated_at DESC').all(studioId);
    res.json(scripts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — create script
router.post('/', authenticate, (req, res) => {
  try {
    const { studio_id, name, content, speed, font_size } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const id = uuidv4();
    db.prepare('INSERT INTO autocue_scripts (id, studio_id, name, content, speed, font_size) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, studioId, name || 'Untitled Script', content || '', speed || 40, font_size || '2rem');
    res.status(201).json(db.prepare('SELECT * FROM autocue_scripts WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — get script
router.get('/:id', authenticate, (req, res) => {
  try {
    const script = db.prepare('SELECT * FROM autocue_scripts WHERE id = ?').get(req.params.id);
    if (!script) return res.status(404).json({ error: 'Script not found' });
    res.json(script);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update script
router.put('/:id', authenticate, (req, res) => {
  try {
    const script = db.prepare('SELECT * FROM autocue_scripts WHERE id = ?').get(req.params.id);
    if (!script) return res.status(404).json({ error: 'Script not found' });
    const { name, content, speed, font_size } = req.body;
    db.prepare("UPDATE autocue_scripts SET name = COALESCE(?, name), content = COALESCE(?, content), speed = COALESCE(?, speed), font_size = COALESCE(?, font_size), updated_at = datetime('now') WHERE id = ?")
      .run(name || null, content !== undefined ? content : null, speed || null, font_size || null, req.params.id);
    res.json(db.prepare('SELECT * FROM autocue_scripts WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM autocue_scripts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Script not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
