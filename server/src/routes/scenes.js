const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getLayoutById } = require('../db');
const { authenticate } = require('../middleware/auth');
const { getIO } = require('../ws');
const { enrichLayout } = require('../lib/enrich-layout');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────
// Screen scenes — named snapshots of layout-per-screen assignments for a
// studio. Built for live-event ops: save the current wall, name it
// ("Race Start", "Mid-Event", "Awards"), then one-click apply it later.
//
// Apply path respects both safety flags:
//   • public_only studios reject the whole scene if ANY layout isn't
//     public_safe (fail-loud, not partial — a public wall either goes all
//     safe or nothing).
//   • accepts_broadcasts=0 screens are skipped silently per-screen, and
//     the response surfaces the count so operators see what happened.
// ──────────────────────────────────────────────────────────────────────────

function parseAssignments(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function serializeScene(row) {
  if (!row) return null;
  return { ...row, assignments: parseAssignments(row.assignments) };
}

// List scenes for a studio (or all, for super_admin).
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    let rows;
    if (studioId) {
      rows = db.prepare('SELECT * FROM screen_scenes WHERE studio_id = ? ORDER BY sort_order, created_at').all(studioId);
    } else if (req.user.role === 'super_admin') {
      rows = db.prepare('SELECT * FROM screen_scenes ORDER BY studio_id, sort_order, created_at').all();
    } else {
      return res.status(400).json({ error: 'studio_id required' });
    }
    res.json(rows.map(serializeScene));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a scene. Body: { name, studio_id?, description?, icon?, assignments: [{screen_id, layout_id}] }
// If `snapshot: true`, captures the current layout of every screen in the
// studio (operator just names it + hits save).
router.post('/', authenticate, (req, res) => {
  try {
    const { name, description, icon, snapshot } = req.body;
    const studioId = req.body.studio_id || req.user.studio_id;
    if (!name || !studioId) return res.status(400).json({ error: 'name and studio_id are required' });

    let assignments = Array.isArray(req.body.assignments) ? req.body.assignments : [];

    if (snapshot) {
      const screens = db.prepare('SELECT id, current_layout_id FROM screens WHERE studio_id = ?').all(studioId);
      assignments = screens
        .filter(s => s.current_layout_id)
        .map(s => ({ screen_id: s.id, layout_id: s.current_layout_id }));
    }

    const id = uuidv4();
    db.prepare('INSERT INTO screen_scenes (id, studio_id, name, description, icon, assignments) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, studioId, name, description || null, icon || null, JSON.stringify(assignments));

    const row = db.prepare('SELECT * FROM screen_scenes WHERE id = ?').get(id);
    res.status(201).json(serializeScene(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a scene — rename, replace assignments, swap icon, etc.
router.put('/:id', authenticate, (req, res) => {
  try {
    const scene = db.prepare('SELECT * FROM screen_scenes WHERE id = ?').get(req.params.id);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const { name, description, icon, assignments, sort_order } = req.body;
    const assignJson = Array.isArray(assignments) ? JSON.stringify(assignments) : null;
    db.prepare(`
      UPDATE screen_scenes SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        assignments = COALESCE(?, assignments),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null,
      description === undefined ? null : description,
      icon === undefined ? null : icon,
      assignJson,
      sort_order === undefined ? null : sort_order,
      req.params.id,
    );

    const row = db.prepare('SELECT * FROM screen_scenes WHERE id = ?').get(req.params.id);
    res.json(serializeScene(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a scene.
router.delete('/:id', authenticate, (req, res) => {
  try {
    const r = db.prepare('DELETE FROM screen_scenes WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Scene not found' });
    res.json({ message: 'Scene deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply a scene — atomic layout assignment to every screen in the scene.
// Response: { applied, locked, skipped, total }
// - applied: screens that received the push
// - locked:  accepts_broadcasts=0 screens (silently skipped, surfaced for the toast)
// - skipped: screens/layouts that weren't found (cleanup the scene)
router.post('/:id/apply', authenticate, (req, res) => {
  try {
    const scene = db.prepare('SELECT * FROM screen_scenes WHERE id = ?').get(req.params.id);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const assignments = parseAssignments(scene.assignments);
    if (assignments.length === 0) {
      return res.status(400).json({ error: 'Scene has no assignments' });
    }

    // Public-only guard: if the studio is public-only, EVERY layout in the
    // scene must be public_safe. Fail loudly before touching any screen.
    const studio = db.prepare('SELECT public_only FROM studios WHERE id = ?').get(scene.studio_id);
    if (studio && studio.public_only) {
      for (const a of assignments) {
        const layout = getLayoutById(a.layout_id);
        if (!layout) continue; // not-found handled below
        if (!layout.public_safe) {
          return res.status(409).json({
            error: `Studio is public-only — scene contains non-public_safe layout "${layout.name}"`,
          });
        }
      }
    }

    const io = getIO();
    let applied = 0, locked = 0, skipped = 0;

    const tx = db.transaction(() => {
      for (const a of assignments) {
        const screen = db.prepare('SELECT id, studio_id, accepts_broadcasts FROM screens WHERE id = ?').get(a.screen_id);
        const layout = getLayoutById(a.layout_id);
        if (!screen || !layout) { skipped++; continue; }
        if (!screen.accepts_broadcasts) { locked++; continue; }

        db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?")
          .run(a.layout_id, a.screen_id);

        // Fire socket events after the txn commits. Collect for later.
        applied++;
      }
    });
    tx();

    // Emit the layout push + preview per screen (after txn so DB is consistent).
    for (const a of assignments) {
      const screen = db.prepare('SELECT id, studio_id, accepts_broadcasts FROM screens WHERE id = ?').get(a.screen_id);
      if (!screen || !screen.accepts_broadcasts) continue;
      const layout = getLayoutById(a.layout_id);
      if (!layout) continue;
      try { layout.modules = typeof layout.modules === 'string' ? JSON.parse(layout.modules) : layout.modules; }
      catch { layout.modules = []; }
      const enriched = enrichLayout(layout, screen.id);
      try {
        io.to(`screen:${screen.id}`).emit('set_layout', { layoutId: a.layout_id, layout: enriched });
        if (screen.studio_id) {
          io.to(`studio:${screen.studio_id}`).emit('screen_preview', {
            screenId: screen.id,
            layoutId: a.layout_id,
            layout: enriched,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('[scenes.apply] emit failed:', e.message);
      }
    }

    res.json({
      message: `Scene "${scene.name}" applied`,
      scene_id: scene.id,
      applied,
      locked,
      skipped,
      total: assignments.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
