const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getShowsByStudio, getShowById } = require('../db');
const { authenticate } = require('../middleware/auth');
const { startTimeline, stopTimeline } = require('../timeline');

const router = express.Router();

router.use(authenticate);

// GET / - list shows for studio
router.get('/', (req, res) => {
  try {
    let shows;
    if (req.user.role === 'super_admin') {
      shows = db.prepare('SELECT * FROM shows').all();
    } else {
      shows = getShowsByStudio(req.user.studio_id);
    }
    res.json(shows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create show
router.post('/', (req, res) => {
  try {
    const { name, description, timeline, studio_id } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!name || !studioId) {
      return res.status(400).json({ error: 'name and studio_id are required' });
    }

    const id = uuidv4();
    const timelineJson = timeline ? JSON.stringify(timeline) : '[]';

    db.prepare('INSERT INTO shows (id, studio_id, name, description, timeline) VALUES (?, ?, ?, ?, ?)').run(id, studioId, name, description || null, timelineJson);

    const show = getShowById(id);
    res.status(201).json(show);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get show
router.get('/:id', (req, res) => {
  try {
    const show = getShowById(req.params.id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.json(show);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update show
router.put('/:id', (req, res) => {
  try {
    const show = getShowById(req.params.id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    const { name, description, timeline } = req.body;
    const timelineJson = timeline ? JSON.stringify(timeline) : null;

    db.prepare(`
      UPDATE shows SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        timeline = COALESCE(?, timeline),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, description !== undefined ? description : null, timelineJson, req.params.id);

    const updated = getShowById(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - delete show
router.delete('/:id', (req, res) => {
  try {
    const show = getShowById(req.params.id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Stop timeline if active
    if (show.active) {
      stopTimeline(show.studio_id);
    }

    db.prepare('DELETE FROM shows WHERE id = ?').run(req.params.id);
    res.json({ message: 'Show deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/activate - activate show
router.post('/:id/activate', (req, res) => {
  try {
    const show = getShowById(req.params.id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Deactivate other shows in this studio
    db.prepare("UPDATE shows SET active = 0, updated_at = datetime('now') WHERE studio_id = ?").run(show.studio_id);

    // Activate this show
    db.prepare("UPDATE shows SET active = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);

    // Start timeline
    startTimeline(show.studio_id, { ...show, active: 1 });

    const updated = getShowById(req.params.id);
    res.json({ message: 'Show activated', show: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/deactivate - deactivate show
router.post('/:id/deactivate', (req, res) => {
  try {
    const show = getShowById(req.params.id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    db.prepare("UPDATE shows SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);

    // Stop timeline
    stopTimeline(show.studio_id);

    const updated = getShowById(req.params.id);
    res.json({ message: 'Show deactivated', show: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
