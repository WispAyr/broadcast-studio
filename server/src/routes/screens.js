const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getScreensByStudio, getScreenById, getLayoutById } = require('../db');
const { authenticate, optionalAuthenticate, requireRole } = require('../middleware/auth');
const { getIO } = require('../ws');

const router = express.Router();

// GET / - list screens
router.get('/', authenticate, (req, res) => {
  try {
    let screens;
    if (req.user.role === 'super_admin') {
      screens = db.prepare(`
        SELECT sc.*, s.name as studio_name, l.name as layout_name,
               sg.name as group_name, sg.profile as group_profile
        FROM screens sc
        LEFT JOIN studios s ON sc.studio_id = s.id
        LEFT JOIN layouts l ON sc.current_layout_id = l.id
        LEFT JOIN screen_groups sg ON sc.group_id = sg.id
        ORDER BY s.name, sc.screen_number
      `).all();
    } else {
      screens = db.prepare(`
        SELECT sc.*, s.name as studio_name, l.name as layout_name,
               sg.name as group_name, sg.profile as group_profile
        FROM screens sc
        LEFT JOIN studios s ON sc.studio_id = s.id
        LEFT JOIN layouts l ON sc.current_layout_id = l.id
        LEFT JOIN screen_groups sg ON sc.group_id = sg.id
        WHERE sc.studio_id = ?
        ORDER BY sc.screen_number
      `).all(req.user.studio_id);
    }
    res.json(screens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create screen
router.post('/', authenticate, (req, res) => {
  try {
    const { name, screen_number, studio_id } = req.body;
    let studioId = studio_id || req.user.studio_id;
    if (!studioId) {
      const first = db.prepare('SELECT id FROM studios LIMIT 1').get();
      if (first) studioId = first.id;
    }
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

// GET /:id - get screen (public for screen display pages)
router.get('/:id', optionalAuthenticate, (req, res) => {
  try {
    const screen = getScreenById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }
    // Also fetch group profile if screen has a group
    if (screen.group_id) {
      const group = db.prepare('SELECT * FROM screen_groups WHERE id = ?').get(screen.group_id);
      if (group) {
        screen.group_name = group.name;
        screen.group_profile = group.profile;
      }
    }
    res.json(screen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update screen
router.put('/:id', authenticate, (req, res) => {
  try {
    const screen = getScreenById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    const { name, screen_number, current_layout_id, orientation, width, height, config, group_id } = req.body;

    const configStr = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : undefined;

    db.prepare(`
      UPDATE screens SET
        name = COALESCE(?, name),
        screen_number = COALESCE(?, screen_number),
        current_layout_id = COALESCE(?, current_layout_id),
        orientation = COALESCE(?, orientation),
        width = COALESCE(?, width),
        height = COALESCE(?, height),
        config = COALESCE(?, config),
        group_id = ${group_id !== undefined ? '?' : 'group_id'},
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null, screen_number || null, current_layout_id || null,
      orientation || null, width || null, height || null, configStr || null,
      ...(group_id !== undefined ? [group_id || null] : []),
      req.params.id
    );

    const updated = getScreenById(req.params.id);

    // Notify screen display to refresh its display profile
    getIO().to(`screen:${req.params.id}`).emit('update_display_profile', {
      screenId: req.params.id,
      config: config || JSON.parse(updated.config || '{}'),
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - delete screen
router.delete('/:id', authenticate, (req, res) => {
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
router.post('/:id/layout', authenticate, (req, res) => {
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

    const parsedLayout = { ...layout, modules: JSON.parse(layout.modules) };
    getIO().to(`screen:${req.params.id}`).emit('set_layout', {
      layoutId: layout_id,
      layout: parsedLayout
    });

    // Broadcast preview update to studio dashboards
    const screenData = getScreenById(req.params.id);
    if (screenData) {
      getIO().to(`studio:${screenData.studio_id}`).emit('screen_preview', {
        screenId: req.params.id,
        layoutId: layout_id,
        layout: parsedLayout,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ message: 'Layout set', screen_id: req.params.id, layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sync - sync all studio screens to one layout
router.post('/sync', authenticate, (req, res) => {
  try {
    const { layout_id, studio_id } = req.body;
    let studioId = studio_id || req.user.studio_id;
    if (!studioId) { const first = db.prepare("SELECT id FROM studios LIMIT 1").get(); if (first) studioId = first.id; }
    if (!layout_id || !studioId) {
      return res.status(400).json({ error: 'layout_id and studio_id are required' });
    }

    const layout = getLayoutById(layout_id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE studio_id = ?").run(layout_id, studioId);

    const parsedLayout = { ...layout, modules: JSON.parse(layout.modules) };
    getIO().to(`studio:${studioId}`).emit('sync_all', {
      layoutId: layout_id,
      layout: parsedLayout
    });

    // Broadcast preview to all studio screens
    const studioScreens = getScreensByStudio(studioId);
    for (const s of studioScreens) {
      getIO().to(`studio:${studioId}`).emit('screen_preview', {
        screenId: s.id,
        layoutId: layout_id,
        layout: parsedLayout,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ message: 'All screens synced', studio_id: studioId, layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /emergency - emergency override all screens
router.post('/emergency', authenticate, (req, res) => {
  try {
    const { layout_id, studio_id } = req.body;
    let studioId = studio_id || req.user.studio_id;
    if (!studioId) { const first = db.prepare("SELECT id FROM studios LIMIT 1").get(); if (first) studioId = first.id; }
    if (!layout_id || !studioId) {
      return res.status(400).json({ error: 'layout_id and studio_id are required' });
    }

    const layout = getLayoutById(layout_id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE studio_id = ?").run(layout_id, studioId);

    getIO().to(`studio:${studioId}`).emit('emergency_layout', {
      layoutId: layout_id,
      layout: { ...layout, modules: JSON.parse(layout.modules) }
    });

    res.json({ message: 'Emergency layout applied', studio_id: studioId, layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /overlay - push overlay via REST (for MCP server)
router.post('/overlay', authenticate, (req, res) => {
  try {
    const { screen_id, studio_id, overlay } = req.body;
    if (!overlay) return res.status(400).json({ error: 'overlay is required' });
    const payload = { overlay };
    if (screen_id) {
      getIO().to(`screen:${screen_id}`).emit('push_overlay', payload);
    } else if (studio_id) {
      getIO().to(`studio:${studio_id}`).emit('push_overlay', payload);
    } else {
      return res.status(400).json({ error: 'screen_id or studio_id required' });
    }
    res.json({ message: 'Overlay pushed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /clear-overlays - clear overlays via REST (for MCP server)
router.post('/clear-overlays', authenticate, (req, res) => {
  try {
    const { screen_id, studio_id } = req.body;
    if (screen_id) {
      getIO().to(`screen:${screen_id}`).emit('clear_overlays', {});
    } else if (studio_id) {
      getIO().to(`studio:${studio_id}`).emit('clear_overlays', {});
    } else {
      return res.status(400).json({ error: 'screen_id or studio_id required' });
    }
    res.json({ message: 'Overlays cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
