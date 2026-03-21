const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');
const { getIO } = require('../ws');

const router = express.Router();

// GET / - list screen groups
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = req.user.studio_id || (req.user.role === 'super_admin' ? null : null);
    let groups;
    if (req.user.role === 'super_admin') {
      groups = db.prepare('SELECT * FROM screen_groups ORDER BY name').all();
    } else {
      groups = db.prepare('SELECT * FROM screen_groups WHERE studio_id = ? ORDER BY name').all(studioId);
    }
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create group
router.post('/', authenticate, (req, res) => {
  try {
    const { name, profile } = req.body;
    let studioId = req.body.studio_id || req.user.studio_id;
    if (!studioId) {
      const first = db.prepare('SELECT id FROM studios LIMIT 1').get();
      if (first) studioId = first.id;
    }
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    const profileStr = typeof profile === 'string' ? profile : JSON.stringify(profile || {});
    db.prepare('INSERT INTO screen_groups (id, studio_id, name, profile) VALUES (?, ?, ?, ?)').run(id, studioId, name, profileStr);
    const group = db.prepare('SELECT * FROM screen_groups WHERE id = ?').get(id);
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update group
router.put('/:id', authenticate, (req, res) => {
  try {
    const { name, profile } = req.body;
    const profileStr = profile !== undefined ? (typeof profile === 'string' ? profile : JSON.stringify(profile)) : undefined;

    db.prepare(`
      UPDATE screen_groups SET
        name = COALESCE(?, name),
        profile = COALESCE(?, profile),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, profileStr || null, req.params.id);

    const group = db.prepare('SELECT * FROM screen_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Notify all screens in this group to refresh
    const screens = db.prepare('SELECT id FROM screens WHERE group_id = ?').all(req.params.id);
    screens.forEach(s => {
      getIO().to(`screen:${s.id}`).emit('update_display_profile', { groupProfile: profile });
    });

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - delete group
router.delete('/:id', authenticate, (req, res) => {
  try {
    // Unlink screens from this group
    db.prepare('UPDATE screens SET group_id = NULL WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM screen_groups WHERE id = ?').run(req.params.id);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
