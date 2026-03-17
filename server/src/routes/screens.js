const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getScreensByStudio, getScreenById, getLayoutById } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getIO } = require('../ws');

const router = express.Router();

router.use(authenticate);

// GET / - list screens
router.get('/', (req, res) => {
  try {
    let screens;
    if (req.user.role === 'super_admin') {
      screens = db.prepare('SELECT * FROM screens').all();
    } else {
      screens = getScreensByStudio(req.user.studio_id);
    }
    res.json(screens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create screen
router.post('/', (req, res) => {
  try {
    const { name, screen_number, studio_id } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!name || !screen_number || !studioId) {
      return res.status(400).json({ error: 'name, screen_number, and studio_id are required' });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO screens (id, studio_id, name, screen_number) VALUES (?, ?, ?, ?)').run(id, studioId, name, screen_number);

    const screen = getScreenById(id);
    res.status(201).json(screen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get screen
router.get('/:id', (req, res) => {
  try {
    const screen = getScreenById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }
    res.json(screen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update screen
router.put('/:id', (req, res) => {
  try {
    const screen = getScreenById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    const { name, screen_number, current_layout_id } = req.body;
    db.prepare(`
      UPDATE screens SET
        name = COALESCE(?, name),
        screen_number = COALESCE(?, screen_number),
        current_layout_id = COALESCE(?, current_layout_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, screen_number || null, current_layout_id || null, req.params.id);

    const updated = getScreenById(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - delete screen
router.delete('/:id', (req, res) => {
  try {
    const screen = getScreenById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    db.prepare('DELETE FROM screens WHERE id = ?').run(req.params.id);
    res.json({ message: 'Screen deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/layout - set screen's current layout
router.post('/:id/layout', (req, res) => {
  try {
    const screen = getScreenById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    const { layout_id } = req.body;
    if (!layout_id) {
      return res.status(400).json({ error: 'layout_id is required' });
    }

    const layout = getLayoutById(layout_id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?").run(layout_id, req.params.id);

    // Emit to screen room
    getIO().to(`screen:${req.params.id}`).emit('set_layout', {
      layoutId: layout_id,
      layout: { ...layout, modules: JSON.parse(layout.modules) }
    });

    res.json({ message: 'Layout set', screen_id: req.params.id, layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sync - sync all studio screens to one layout
router.post('/sync', (req, res) => {
  try {
    const { layout_id, studio_id } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!layout_id || !studioId) {
      return res.status(400).json({ error: 'layout_id and studio_id are required' });
    }

    const layout = getLayoutById(layout_id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    // Update all screens in studio
    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE studio_id = ?").run(layout_id, studioId);

    // Emit to studio room
    getIO().to(`studio:${studioId}`).emit('sync_all', {
      layoutId: layout_id,
      layout: { ...layout, modules: JSON.parse(layout.modules) }
    });

    res.json({ message: 'All screens synced', studio_id: studioId, layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /emergency - emergency override all screens
router.post('/emergency', (req, res) => {
  try {
    const { layout_id, studio_id } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!layout_id || !studioId) {
      return res.status(400).json({ error: 'layout_id and studio_id are required' });
    }

    const layout = getLayoutById(layout_id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    // Update all screens in studio
    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE studio_id = ?").run(layout_id, studioId);

    // Emit emergency to studio room
    getIO().to(`studio:${studioId}`).emit('emergency_layout', {
      layoutId: layout_id,
      layout: { ...layout, modules: JSON.parse(layout.modules) }
    });

    res.json({ message: 'Emergency layout applied', studio_id: studioId, layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
