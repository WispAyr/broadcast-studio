const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getLayoutById } = require('../db');
const { authenticate } = require('../middleware/auth');
const { getIO } = require('../ws');
const { enrichLayout } = require('../lib/enrich-layout');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────
// Scheduled layouts — "apply layout X to screen/scene at time T".
//
//   POST   /api/scheduled-layouts            — create
//   GET    /api/scheduled-layouts            — list upcoming + recent fired
//   DELETE /api/scheduled-layouts/:id        — cancel
//
// A background worker (started from index.js) polls every 15s for due rows
// and applies them. Honours padlock (accepts_broadcasts=0 → skipped, logged).
// Honours public_only studios (scene-apply style — fails the whole schedule
// entry with status='failed' if the target layout isn't public_safe).
// ──────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_layouts (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    scope TEXT NOT NULL,                -- 'screen' | 'studio' | 'scene'
    target_id TEXT,                     -- screen.id, or scene.id; NULL for studio-wide
    layout_id TEXT,                     -- NULL for scene-scope (scene carries its own assignments)
    scheduled_at TEXT NOT NULL,         -- ISO timestamp
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'fired' | 'failed' | 'cancelled'
    fired_at TEXT,
    result TEXT,                        -- JSON: { applied, locked, skipped, error? }
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sched_layouts_due ON scheduled_layouts(status, scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_sched_layouts_studio ON scheduled_layouts(studio_id, scheduled_at);
`);

function serializeRow(row) {
  if (!row) return null;
  let result = null;
  try { result = row.result ? JSON.parse(row.result) : null; } catch { /* keep as string */ }
  return { ...row, result };
}

// ── REST ───────────────────────────────────────────────────────────────────

router.get('/', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    // Upcoming + last 24h of fired entries, newest first.
    const rows = db.prepare(`
      SELECT * FROM scheduled_layouts
      WHERE studio_id = ?
        AND (status = 'pending' OR datetime(fired_at) > datetime('now','-1 day'))
      ORDER BY scheduled_at ASC
    `).all(studioId);
    res.json(rows.map(serializeRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, (req, res) => {
  try {
    const { scope, target_id, layout_id, scheduled_at, note } = req.body;
    const studioId = req.body.studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    if (!['screen', 'studio', 'scene'].includes(scope)) {
      return res.status(400).json({ error: "scope must be one of: screen | studio | scene" });
    }
    if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at required (ISO timestamp)' });
    if (scope === 'screen' && !target_id) return res.status(400).json({ error: 'target_id (screen) required' });
    if (scope === 'scene' && !target_id) return res.status(400).json({ error: 'target_id (scene) required' });
    if ((scope === 'screen' || scope === 'studio') && !layout_id) {
      return res.status(400).json({ error: 'layout_id required for screen/studio scope' });
    }

    // Sanity: scheduled_at must parse + be in the future (small slack for clock drift).
    const t = new Date(scheduled_at);
    if (isNaN(t.getTime())) return res.status(400).json({ error: 'scheduled_at is not a valid date' });

    const id = uuidv4();
    db.prepare(`INSERT INTO scheduled_layouts
      (id, studio_id, scope, target_id, layout_id, scheduled_at, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, studioId, scope, target_id || null, layout_id || null,
           t.toISOString(), note || null, req.user?.id || null);

    const row = db.prepare('SELECT * FROM scheduled_layouts WHERE id = ?').get(id);
    res.status(201).json(serializeRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM scheduled_layouts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Scheduled item not found' });
    if (row.status !== 'pending') {
      return res.status(409).json({ error: `Cannot cancel — status is '${row.status}'` });
    }
    db.prepare("UPDATE scheduled_layouts SET status='cancelled', fired_at=datetime('now') WHERE id=?")
      .run(req.params.id);
    res.json({ message: 'Scheduled item cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Worker ─────────────────────────────────────────────────────────────────
// Fires every 15s. Picks up pending entries with scheduled_at <= now and
// applies them one-by-one. Results get written back into the row.

function applyScreen(screenId, layoutId) {
  const screen = db.prepare('SELECT id, studio_id, accepts_broadcasts FROM screens WHERE id = ?').get(screenId);
  const layout = getLayoutById(layoutId);
  if (!screen || !layout) return { applied: 0, locked: 0, skipped: 1 };
  if (!screen.accepts_broadcasts) return { applied: 0, locked: 1, skipped: 0 };

  db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(layoutId, screenId);

  try { layout.modules = typeof layout.modules === 'string' ? JSON.parse(layout.modules) : layout.modules; }
  catch { layout.modules = []; }
  const enriched = enrichLayout(layout, screen.id);
  try {
    const io = getIO();
    io.to(`screen:${screen.id}`).emit('set_layout', { layoutId, layout: enriched });
    if (screen.studio_id) {
      io.to(`studio:${screen.studio_id}`).emit('screen_preview', {
        screenId: screen.id, layoutId, layout: enriched,
        timestamp: new Date().toISOString(),
      });
    }
  } catch { /* io not ready — DB is still consistent */ }
  return { applied: 1, locked: 0, skipped: 0 };
}

function applyStudioLayout(studioId, layoutId) {
  // Fan out to every screen in the studio that accepts broadcasts.
  const studio = db.prepare('SELECT public_only FROM studios WHERE id = ?').get(studioId);
  const layout = getLayoutById(layoutId);
  if (!layout) return { applied: 0, locked: 0, skipped: 0, error: 'layout not found' };
  if (studio?.public_only && !layout.public_safe) {
    return { applied: 0, locked: 0, skipped: 0, error: `public-only studio blocked non-public_safe layout "${layout.name}"` };
  }
  const screens = db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE studio_id = ?').all(studioId);
  let applied = 0, locked = 0;
  for (const s of screens) {
    const r = applyScreen(s.id, layoutId);
    applied += r.applied; locked += r.locked;
  }
  return { applied, locked, skipped: 0 };
}

function applyScene(sceneId) {
  // Delegate to the scenes module logic by re-executing the same rules here
  // (kept local so the scheduler can skip HTTP roundtrip).
  const scene = db.prepare('SELECT * FROM screen_scenes WHERE id = ?').get(sceneId);
  if (!scene) return { applied: 0, locked: 0, skipped: 0, error: 'scene not found' };
  let assignments;
  try { assignments = JSON.parse(scene.assignments || '[]'); } catch { assignments = []; }
  if (!assignments.length) return { applied: 0, locked: 0, skipped: 0, error: 'scene empty' };

  const studio = db.prepare('SELECT public_only FROM studios WHERE id = ?').get(scene.studio_id);
  if (studio?.public_only) {
    for (const a of assignments) {
      const layout = getLayoutById(a.layout_id);
      if (layout && !layout.public_safe) {
        return { applied: 0, locked: 0, skipped: 0,
                 error: `public-only studio blocked non-public_safe layout "${layout.name}"` };
      }
    }
  }
  let applied = 0, locked = 0, skipped = 0;
  for (const a of assignments) {
    const r = applyScreen(a.screen_id, a.layout_id);
    applied += r.applied; locked += r.locked; skipped += r.skipped;
  }
  return { applied, locked, skipped };
}

function fireDueOne(row) {
  try {
    let result;
    if (row.scope === 'screen')      result = applyScreen(row.target_id, row.layout_id);
    else if (row.scope === 'studio') result = applyStudioLayout(row.studio_id, row.layout_id);
    else if (row.scope === 'scene')  result = applyScene(row.target_id);
    else                             result = { error: `unknown scope '${row.scope}'` };

    const status = result.error ? 'failed' : 'fired';
    db.prepare("UPDATE scheduled_layouts SET status=?, fired_at=datetime('now'), result=? WHERE id=?")
      .run(status, JSON.stringify(result), row.id);
    console.log(`[scheduler] ${row.id} ${status}:`, result);
  } catch (err) {
    db.prepare("UPDATE scheduled_layouts SET status='failed', fired_at=datetime('now'), result=? WHERE id=?")
      .run(JSON.stringify({ error: err.message }), row.id);
    console.warn(`[scheduler] ${row.id} threw:`, err.message);
  }
}

function tick() {
  try {
    const due = db.prepare(`SELECT * FROM scheduled_layouts
                            WHERE status='pending' AND datetime(scheduled_at) <= datetime('now')
                            ORDER BY scheduled_at ASC LIMIT 20`).all();
    for (const row of due) fireDueOne(row);
  } catch (err) {
    console.warn('[scheduler.tick] failed:', err.message);
  }
}

function startScheduler() {
  // 15s cadence — good enough for live-event timing (stages flip on minutes,
  // not seconds). Tight enough that an operator who schedules "now+30s" sees
  // it fire.
  setInterval(tick, 15 * 1000);
  setTimeout(tick, 5 * 1000); // First sweep shortly after boot
  console.log('[scheduler] layout scheduler started (15s cadence)');
}

module.exports = { router, startScheduler };
