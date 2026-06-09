const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getScreensByStudio, getScreenById, getLayoutById } = require('../db');
const { authenticate, optionalAuthenticate, requireRole } = require('../middleware/auth');
const { getIO } = require('../ws');
const { enrichLayout } = require('../lib/enrich-layout');

// Shared broadcast-safety helpers.
//
// (a) `accepts_broadcasts` = 1  — per-screen lockout. Default on. When an
//     operator pads-locks a screen (running a critical layout, doing a
//     QA pass, whatever) the bulk emits below skip it silently. Direct
//     single-screen actions still work — the lock is "don't clobber me",
//     not "disable me".
// (b) Studio `public_only` = 1  — the studio only accepts layouts that
//     have been explicitly flagged `public_safe`. Hard guard against an
//     ops SITREP ever landing on the ad-van LEDs.
function getBroadcastTargets(studioId) {
  return db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE studio_id = ?').all(studioId);
}

function rejectIfPublicOnlyUnsafe(studioId, layout) {
  const studio = db.prepare('SELECT public_only FROM studios WHERE id = ?').get(studioId);
  if (studio && studio.public_only && !layout.public_safe) {
    return `Studio is public-only — layout "${layout.name}" is not flagged public_safe`;
  }
  return null;
}

const router = express.Router();

// GET /deploy - public screen list for venue deploy page (no auth required)
// Only returns safe, minimal fields — no config or sensitive data
router.get('/deploy', (req, res) => {
  try {
    const screens = db.prepare(`
      SELECT
        sc.id,
        sc.name,
        sc.screen_number,
        sc.is_online,
        sc.last_seen,
        s.name  AS studio_name,
        l.name  AS layout_name
      FROM screens sc
      LEFT JOIN studios  s ON sc.studio_id = s.id
      LEFT JOIN layouts  l ON sc.current_layout_id = l.id
      ORDER BY s.name, sc.screen_number
    `).all();
    res.json(screens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET / - list screens (authenticated)
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

    const { name, screen_number, current_layout_id, orientation, width, height, config, group_id, accepts_broadcasts } = req.body;

    const configStr = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : undefined;
    // accepts_broadcasts: accept truthy/falsy explicitly — null means "don't
    // touch". Use an integer for SQLite.
    const ab = accepts_broadcasts === undefined ? null : (accepts_broadcasts ? 1 : 0);

    db.prepare(`
      UPDATE screens SET
        name = COALESCE(?, name),
        screen_number = COALESCE(?, screen_number),
        current_layout_id = COALESCE(?, current_layout_id),
        orientation = COALESCE(?, orientation),
        width = COALESCE(?, width),
        height = COALESCE(?, height),
        config = COALESCE(?, config),
        accepts_broadcasts = COALESCE(?, accepts_broadcasts),
        group_id = ${group_id !== undefined ? '?' : 'group_id'},
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null, screen_number || null, current_layout_id || null,
      orientation || null, width || null, height || null, configStr || null,
      ab,
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

    // Public-only studio guard — refuse non-safe layouts on public screens.
    const reject = rejectIfPublicOnlyUnsafe(screen.studio_id, layout);
    if (reject) return res.status(403).json({ error: reject });

    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?").run(layout_id, req.params.id);

    const parsedLayout = enrichLayout({ ...layout, modules: JSON.parse(layout.modules) }, req.params.id);
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

    // Public-only studio guard.
    const reject = rejectIfPublicOnlyUnsafe(studioId, layout);
    if (reject) return res.status(403).json({ error: reject });

    // Only push to screens that accept broadcasts. Padlocked screens are
    // left on whatever they're currently showing.
    const targets = getBroadcastTargets(studioId);
    const acceptedIds = targets.filter(s => s.accepts_broadcasts).map(s => s.id);
    const lockedIds = targets.filter(s => !s.accepts_broadcasts).map(s => s.id);

    if (acceptedIds.length > 0) {
      const placeholders = acceptedIds.map(() => '?').join(',');
      db.prepare(`UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`)
        .run(layout_id, ...acceptedIds);
    }

    const baseParsed = { ...layout, modules: JSON.parse(layout.modules) };
    // Studio-wide: use a shared-scoped token (sid="shared") for the sync_all emit.
    // Emit only to unlocked screens so locked kiosks don't even see the event.
    const enrichedShared = enrichLayout(baseParsed, null);
    for (const screenId of acceptedIds) {
      getIO().to(`screen:${screenId}`).emit('set_layout', {
        layoutId: layout_id,
        layout: enrichedShared
      });
    }

    // Preview to studio dashboards (not the screens themselves) — always
    // emitted so operators see what would have been pushed. Locked screens
    // get a preview too so the operator knows what's happening.
    for (const s of targets) {
      getIO().to(`studio:${studioId}`).emit('screen_preview', {
        screenId: s.id,
        layoutId: layout_id,
        layout: enrichLayout(baseParsed, s.id),
        timestamp: new Date().toISOString(),
        locked: !s.accepts_broadcasts
      });
    }

    res.json({
      message: 'Synced',
      studio_id: studioId,
      layout_id,
      pushed: acceptedIds.length,
      locked: lockedIds.length,
      total: targets.length
    });
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

    // Public-only guard applies to emergency too — even an emergency won't
    // put an ops layout on a public LED without an explicit public_safe flag.
    const reject = rejectIfPublicOnlyUnsafe(studioId, layout);
    if (reject) return res.status(403).json({ error: reject });

    // Emergency IGNORES the padlock — it's the override-everything channel.
    // Padlock is for "don't clobber me with routine sync_all" not "refuse
    // an emergency takeover". Intentional design choice.
    const targets = getBroadcastTargets(studioId);
    if (targets.length > 0) {
      const placeholders = targets.map(() => '?').join(',');
      db.prepare(`UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`)
        .run(layout_id, ...targets.map(s => s.id));
    }

    const enriched = enrichLayout({ ...layout, modules: JSON.parse(layout.modules) }, null);
    for (const s of targets) {
      getIO().to(`screen:${s.id}`).emit('emergency_layout', {
        layoutId: layout_id,
        layout: enriched
      });
    }

    res.json({
      message: 'Emergency layout applied',
      studio_id: studioId,
      layout_id,
      pushed: targets.length,
      note: 'emergency bypasses per-screen lockouts'
    });
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
      // Direct single-screen overlay — respect the padlock so an operator
      // running critical content isn't clobbered by a casual banner push.
      const target = db.prepare('SELECT accepts_broadcasts FROM screens WHERE id = ?').get(screen_id);
      if (target && !target.accepts_broadcasts) {
        return res.status(423).json({ error: 'Screen is locked against broadcasts' });
      }
      getIO().to(`screen:${screen_id}`).emit('push_overlay', payload);
      return res.json({ message: 'Overlay pushed', pushed: 1 });
    } else if (studio_id) {
      // Studio-wide overlay — only to unlocked screens.
      const targets = getBroadcastTargets(studio_id);
      const accepted = targets.filter(s => s.accepts_broadcasts);
      for (const s of accepted) {
        getIO().to(`screen:${s.id}`).emit('push_overlay', payload);
      }
      return res.json({
        message: 'Overlay pushed',
        pushed: accepted.length,
        locked: targets.length - accepted.length,
        total: targets.length
      });
    } else {
      return res.status(400).json({ error: 'screen_id or studio_id required' });
    }
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
