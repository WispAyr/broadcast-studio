const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getAllStudios, getStudioById } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require super_admin
router.use(authenticate, requireRole(['super_admin']));

// GET / - list all studios with counts
router.get('/', (req, res) => {
  try {
    const studios = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM screens sc WHERE sc.studio_id = s.id) as screen_count,
        (SELECT COUNT(*) FROM layouts l WHERE l.studio_id = s.id) as layout_count,
        (SELECT COUNT(*) FROM users u WHERE u.studio_id = s.id) as user_count
      FROM studios s
      ORDER BY s.created_at DESC
    `).all();
    res.json(studios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create studio
router.post('/', (req, res) => {
  try {
    const { name, slug, public_only } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const id = uuidv4();
    const po = public_only ? 1 : 0;
    db.prepare('INSERT INTO studios (id, name, slug, public_only) VALUES (?, ?, ?, ?)').run(id, name, slug, po);

    const studio = getStudioById(id);
    res.status(201).json(studio);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Studio slug already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get studio
router.get('/:id', (req, res) => {
  try {
    const studio = getStudioById(req.params.id);
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }
    res.json(studio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update studio
router.put('/:id', (req, res) => {
  try {
    const studio = getStudioById(req.params.id);
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    const { name, slug, active, public_only } = req.body;
    const po = public_only === undefined ? null : (public_only ? 1 : 0);
    db.prepare(`
      UPDATE studios SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        active = COALESCE(?, active),
        public_only = COALESCE(?, public_only),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, slug || null, active !== undefined ? active : null, po, req.params.id);

    const updated = getStudioById(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', (req, res) => {
  try {
    const studio = getStudioById(req.params.id);
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    db.prepare("UPDATE studios SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: 'Studio deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
