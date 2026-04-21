const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { requireStudioAuth } = require('../middleware/apiKey');
const { getIO } = require('../ws');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────
// Broadcast — operator tools that push transient state across a studio.
//
//   POST   /api/broadcast/incident            — JWT auth, push severity banner
//   DELETE /api/broadcast/incident            — JWT auth, clear banner
//   GET    /api/broadcast/incident/recent     — JWT auth, last 50 (audit)
//   POST   /api/broadcast/emergency/:studioId — x-api-key auth, red banner
//                                               from a van or field tablet
//
// All of these render as the `incident` overlay type on ScreenDisplay.
// Every push goes to broadcast_log so ops can see what was sent + when.
// ──────────────────────────────────────────────────────────────────────────

// Audit log: every banner push, every clear, every emergency trigger.
db.exec(`
  CREATE TABLE IF NOT EXISTS broadcast_log (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    kind TEXT NOT NULL,        -- 'incident' | 'emergency' | 'clear'
    severity TEXT,             -- 'info' | 'warning' | 'danger' | 'critical'
    message TEXT,
    duration_ms INTEGER,
    source TEXT,               -- 'dashboard' | 'emergency:<label>' | 'api'
    user_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_broadcast_log_studio ON broadcast_log(studio_id, created_at DESC);
`);

function logBroadcast(row) {
  try {
    db.prepare(`INSERT INTO broadcast_log (id, studio_id, kind, severity, message, duration_ms, source, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), row.studio_id, row.kind, row.severity || null,
           row.message || null, row.duration_ms || null, row.source || null, row.user_id || null);
  } catch (err) {
    console.warn('[broadcast.log] insert failed:', err.message);
  }
}

function emitIncident(studioId, { severity, message, duration_ms, icon, source }) {
  const overlay = {
    type: 'incident',
    severity: severity || 'info',
    text: message || '',
    icon: icon || null,
    source: source || null,
    timestamp: new Date().toISOString(),
    // Overlay code uses `duration` (seconds) for auto-remove
    duration: duration_ms ? Math.round(duration_ms / 1000) : undefined,
  };
  try {
    getIO().to(`studio:${studioId}`).emit('push_overlay', { overlay });
  } catch (err) {
    console.warn('[broadcast.emit] failed:', err.message);
  }
  return overlay;
}

function emitClear(studioId) {
  try {
    getIO().to(`studio:${studioId}`).emit('remove_overlay', { overlayType: 'incident' });
  } catch (err) {
    console.warn('[broadcast.clear] failed:', err.message);
  }
}

// POST /api/broadcast/incident — auth'd ops pushing a banner to their studio.
// Body: { studio_id?, severity, message, duration_ms?, icon? }
router.post('/incident', authenticate, (req, res) => {
  try {
    const studioId = req.body.studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const { severity, message, duration_ms, icon } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: 'message required' });
    const validSev = ['info', 'warning', 'danger', 'critical'];
    const sev = validSev.includes(severity) ? severity : 'info';

    const overlay = emitIncident(studioId, {
      severity: sev, message: String(message).trim(), duration_ms, icon,
      source: 'dashboard',
    });
    logBroadcast({
      studio_id: studioId, kind: 'incident', severity: sev,
      message: String(message).trim(), duration_ms: duration_ms || null,
      source: 'dashboard', user_id: req.user?.id || null,
    });
    res.json({ message: 'Incident banner pushed', overlay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/broadcast/incident — clear the banner (same studio).
router.delete('/incident', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    emitClear(studioId);
    logBroadcast({
      studio_id: studioId, kind: 'clear', source: 'dashboard',
      user_id: req.user?.id || null,
    });
    res.json({ message: 'Incident banner cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/broadcast/incident/recent — audit feed for the incident rail UI.
router.get('/incident/recent', authenticate, (req, res) => {
  try {
    const studioId = req.query.studio_id || req.user.studio_id;
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const rows = db.prepare(`SELECT * FROM broadcast_log WHERE studio_id = ?
                             ORDER BY created_at DESC LIMIT ?`).all(studioId, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/broadcast/emergency/:studioId — van/field tablet one-tap push.
// Auth: x-api-key (scoped to studio via existing middleware).
// Body: { message?, label? } — label is a short tag for the audit log
// (e.g. "van-01" or "marshal-6"). Defaults to a hard-coded red critical
// banner with 15-min auto-clear.
const emergencyRouter = express.Router({ mergeParams: true });
emergencyRouter.use(optionalAuthenticate, requireStudioAuth);
emergencyRouter.post('/', express.json(), (req, res) => {
  try {
    const studioId = req.params.studioId;
    const message = (req.body?.message && String(req.body.message).trim()) || 'EMERGENCY — operator response required';
    const label = (req.body?.label && String(req.body.label).trim().slice(0, 32)) || 'field';
    // Critical red, 15 min TTL, big alarm icon.
    const overlay = emitIncident(studioId, {
      severity: 'critical',
      message,
      duration_ms: 15 * 60 * 1000,
      icon: 'alarm',
      source: `emergency:${label}`,
    });
    logBroadcast({
      studio_id: studioId, kind: 'emergency', severity: 'critical',
      message, duration_ms: 15 * 60 * 1000,
      source: `emergency:${label}`,
    });
    res.json({ message: 'Emergency banner pushed', overlay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, emergencyRouter };
