const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Ensure templates table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'custom',
    duration REAL DEFAULT 5,
    fps INTEGER DEFAULT 30,
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    elements TEXT DEFAULT '[]',
    thumbnail TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (studio_id) REFERENCES studios(id)
  );
`);

function parseElements(t) {
  if (!t) return t;
  try {
    return { ...t, elements: typeof t.elements === 'string' ? JSON.parse(t.elements) : t.elements };
  } catch { return { ...t, elements: [] }; }
}

// GET / — list templates
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    let templates;
    if (studioId) {
      templates = db.prepare('SELECT * FROM templates WHERE studio_id = ? ORDER BY updated_at DESC').all(studioId);
    } else if (req.user.role === 'super_admin') {
      templates = db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
    } else {
      templates = [];
    }
    res.json(templates.map(parseElements));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — create template
router.post('/', authenticate, (req, res) => {
  try {
    const { name, description, category, duration, fps, width, height, elements, studio_id } = req.body;
    let studioId = studio_id || req.user.studio_id;
    if (!studioId) {
      const first = db.prepare('SELECT id FROM studios LIMIT 1').get();
      if (first) studioId = first.id;
    }
    if (!name || !studioId) return res.status(400).json({ error: 'name and studio_id are required' });

    const id = uuidv4();
    const elementsJson = elements ? JSON.stringify(elements) : '[]';

    db.prepare(`INSERT INTO templates (id, studio_id, name, description, category, duration, fps, width, height, elements)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, studioId, name, description || '', category || 'custom',
      duration || 5, fps || 30, width || 1920, height || 1080, elementsJson
    );

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.status(201).json(parseElements(template));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', authenticate, (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (req.user.role !== 'super_admin' && req.user.studio_id && template.studio_id !== req.user.studio_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(parseElements(template));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id
router.put('/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (req.user.role !== 'super_admin' && req.user.studio_id && existing.studio_id !== req.user.studio_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, category, duration, fps, width, height, elements, thumbnail } = req.body;
    const elementsJson = elements ? JSON.stringify(elements) : null;

    db.prepare(`UPDATE templates SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      duration = COALESCE(?, duration),
      fps = COALESCE(?, fps),
      width = COALESCE(?, width),
      height = COALESCE(?, height),
      elements = COALESCE(?, elements),
      thumbnail = COALESCE(?, thumbnail),
      updated_at = datetime('now')
      WHERE id = ?`).run(
      name || null, description ?? null, category || null,
      duration || null, fps || null, width || null, height || null,
      elementsJson, thumbnail || null, req.params.id
    );

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    res.json(parseElements(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (req.user.role !== 'super_admin' && req.user.studio_id && existing.studio_id !== req.user.studio_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
