/**
 * routes/nuro.js — Nuro integration REST endpoints
 *
 * POST /api/nuro/alert      — inbound alert from Dispatch / Prism
 * POST /api/nuro/send-alert — producer triggers outbound alert to Dispatch
 * GET  /api/nuro/alerts     — list recent inbound alerts from SQLite log
 */

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { db }   = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendNuroAlert } = require('../nuro');

const router = express.Router();

// ── Ensure nuro_alerts table exists ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS nuro_alerts (
    id           TEXT PRIMARY KEY,
    received_at  TEXT DEFAULT (datetime('now')),
    type         TEXT NOT NULL DEFAULT 'INFO',
    title        TEXT NOT NULL DEFAULT '',
    body         TEXT DEFAULT '',
    source       TEXT DEFAULT 'unknown',
    target_studio TEXT,
    action       TEXT DEFAULT 'log',
    handled      INTEGER DEFAULT 0,
    raw          TEXT DEFAULT '{}'
  )
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function verifyNuroToken(req) {
  const token = process.env.NURO_SERVICE_TOKEN;
  if (!token) return true; // if no token configured, allow all (dev mode)
  const auth = req.headers['authorization'] || req.headers['x-nuro-token'] || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return provided === token;
}

// ── POST /api/nuro/alert ──────────────────────────────────────────────────────
// Inbound alert from Dispatch or Prism.
// Body: { type, title, body, source, target_studio, action }
// action: 'overlay' | 'ticker' | 'layout' | 'log'  (default: 'overlay')

router.post('/alert', async (req, res) => {
  if (!verifyNuroToken(req)) {
    return res.status(401).json({ error: 'Unauthorized — invalid Nuro token' });
  }

  const {
    type          = 'INFO',
    title         = 'Nuro Alert',
    body          = '',
    source        = 'nuro',
    target_studio = null,
    action        = 'overlay',
  } = req.body || {};

  // Persist to audit log
  const id = uuidv4();
  db.prepare(`
    INSERT INTO nuro_alerts (id, type, title, body, source, target_studio, action, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, title, body, source, target_studio, action, JSON.stringify(req.body));

  console.log(`[nuro] inbound alert [${type}] "${title}" action=${action} source=${source}`);

  // Resolve target sockets via Socket.IO
  try {
    const { getIO } = require('../ws');
    const io = getIO();

    // Determine which studio room(s) to target
    let roomTargets = [];
    if (target_studio) {
      // Try matching by slug first, then by id
      const studio = db.prepare('SELECT id FROM studios WHERE slug = ? OR id = ?').get(target_studio, target_studio);
      if (studio) {
        roomTargets = [`studio:${studio.id}`];
      }
    }

    if (roomTargets.length === 0) {
      // Broadcast to all studio rooms
      const studios = db.prepare('SELECT id FROM studios WHERE active = 1').all();
      roomTargets = studios.map(s => `studio:${s.id}`);
    }

    // Build the screen payload based on requested action
    const alertPayload = {
      id,
      type,
      title,
      body,
      source,
      action,
      timestamp: new Date().toISOString(),
    };

    for (const room of roomTargets) {
      switch (action) {
        case 'overlay':
          io.to(room).emit('push_overlay', {
            overlay: {
              type: 'nuro_alert',
              severity: type,
              title,
              body,
              source,
              id,
              autoDismiss: type === 'INFO' ? 10000 : 0,
            },
          });
          break;

        case 'ticker':
          // Push to any alert_ticker or news_ticker modules currently on screen
          io.to(room).emit('update_module_config', {
            moduleId: '__nuro_ticker__',
            config: {
              alerts: [{ id, text: `[${type}] ${title}${body ? ': ' + body : ''}`, severity: type.toLowerCase() }],
              nuroUpdate: true,
              timestamp: Date.now(),
            },
          });
          break;

        case 'layout':
          // Emergency layout override for EMERGENCY type
          if (type === 'EMERGENCY') {
            const studioId = room.replace('studio:', '');
            const emgLayout = db.prepare(
              "SELECT id, modules FROM layouts WHERE studio_id = ? AND (name LIKE '%Emergency%' OR name LIKE '%Breaking%') LIMIT 1"
            ).get(studioId);
            if (emgLayout) {
              io.to(room).emit('emergency_layout', {
                layoutId: emgLayout.id,
                layout: { ...emgLayout, modules: JSON.parse(emgLayout.modules || '[]') },
                source: 'nuro',
              });
            } else {
              // Fallback to overlay if no emergency layout exists
              io.to(room).emit('push_overlay', {
                overlay: { type: 'nuro_alert', severity: 'EMERGENCY', title, body, source, id },
              });
            }
          }
          break;

        case 'log':
        default:
          // Silent — already logged to DB above
          break;
      }

      // Always push an alert notification event to control panels
      io.to(room).emit('nuro_alert', alertPayload);
    }

    // Mark as handled
    db.prepare('UPDATE nuro_alerts SET handled = 1 WHERE id = ?').run(id);

  } catch (wsErr) {
    console.error('[nuro] WebSocket emit error:', wsErr.message);
    // Still return 200 — the alert is logged
  }

  res.json({ ok: true, id, action });
});

// ── POST /api/nuro/send-alert ─────────────────────────────────────────────────
// Producer-triggered outbound alert to Dispatch.
// Requires authentication.

router.post('/send-alert', authenticate, async (req, res) => {
  const {
    type      = 'INFO',
    title     = 'Studio Alert',
    body      = '',
    studio_id = null,
  } = req.body || {};

  if (!title?.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const result = await sendNuroAlert({ type, title, body, studio_id });
  res.json(result);
});

// ── GET /api/nuro/alerts ──────────────────────────────────────────────────────
// List recent inbound Nuro alerts (newest first).
// Requires authentication.

router.get('/alerts', authenticate, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const alerts = db.prepare(
    'SELECT id, received_at, type, title, body, source, target_studio, action, handled FROM nuro_alerts ORDER BY received_at DESC LIMIT ?'
  ).all(limit);
  res.json({ alerts });
});

// ── DELETE /api/nuro/alerts/:id ───────────────────────────────────────────────

router.delete('/alerts/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM nuro_alerts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
