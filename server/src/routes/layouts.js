const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getLayoutsByStudio, getLayoutById } = require('../db');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

const router = express.Router();

// GET / - list layouts for studio
router.get('/', authenticate, (req, res) => {
  try {
    let layouts;
    if (req.query.studio_id) {
      layouts = getLayoutsByStudio(req.query.studio_id);
    } else if (req.user.role === 'super_admin') {
      layouts = db.prepare('SELECT * FROM layouts').all();
    } else {
      layouts = getLayoutsByStudio(req.user.studio_id);
    }
    // Parse modules JSON string for each layout
    const parsed = layouts.map(l => {
      try { return { ...l, modules: typeof l.modules === 'string' ? JSON.parse(l.modules) : l.modules }; }
      catch { return { ...l, modules: [] }; }
    });
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create layout
router.post('/', authenticate, (req, res) => {
  try {
    const { name, grid_cols, grid_rows, modules, studio_id, orientation, resolution_w, resolution_h, background } = req.body;
    let studioId = studio_id || req.user.studio_id;
    if (!studioId) {
      const first = db.prepare('SELECT id FROM studios LIMIT 1').get();
      if (first) studioId = first.id;
    }
    if (!name || !studioId) {
      return res.status(400).json({ error: 'name and studio_id are required' });
    }

    const id = uuidv4();
    const modulesJson = modules ? JSON.stringify(modules) : '[]';

    db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, orientation, resolution_w, resolution_h, background) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, studioId, name, grid_cols || 3, grid_rows || 3, modulesJson, orientation || 'landscape', resolution_w || 1920, resolution_h || 1080, background || '#000000');

    const layout = getLayoutById(id);
    res.status(201).json(layout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get layout (public for screen display)
router.get('/:id', optionalAuthenticate, (req, res) => {
  try {
    const layout = getLayoutById(req.params.id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    try { layout.modules = typeof layout.modules === 'string' ? JSON.parse(layout.modules) : layout.modules; } catch { layout.modules = []; }
    res.json(layout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update layout
router.put('/:id', authenticate, (req, res) => {
  try {
    const layout = getLayoutById(req.params.id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    const { name, grid_cols, grid_rows, modules, orientation, resolution_w, resolution_h, background } = req.body;
    const modulesJson = modules ? JSON.stringify(modules) : null;

    db.prepare(`
      UPDATE layouts SET
        name = COALESCE(?, name),
        grid_cols = COALESCE(?, grid_cols),
        grid_rows = COALESCE(?, grid_rows),
        modules = COALESCE(?, modules),
        orientation = COALESCE(?, orientation),
        resolution_w = COALESCE(?, resolution_w),
        resolution_h = COALESCE(?, resolution_h),
        background = COALESCE(?, background),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, grid_cols || null, grid_rows || null, modulesJson, orientation || null, resolution_w || null, resolution_h || null, background || null, req.params.id);

    const updated = getLayoutById(req.params.id);
    try { updated.modules = typeof updated.modules === 'string' ? JSON.parse(updated.modules) : updated.modules; } catch { updated.modules = []; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - delete layout
router.delete('/:id', authenticate, (req, res) => {
  try {
    const layout = getLayoutById(req.params.id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    // Unset from any screens referencing this layout first
    db.prepare("UPDATE screens SET current_layout_id = NULL WHERE current_layout_id = ?").run(req.params.id);

    db.prepare('DELETE FROM layouts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Layout deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/preview - return layout with parsed modules (public for screen display)
router.get('/:id/preview', optionalAuthenticate, (req, res) => {
  try {
    const layout = getLayoutById(req.params.id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    res.json({
      ...layout,
      modules: JSON.parse(layout.modules)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
