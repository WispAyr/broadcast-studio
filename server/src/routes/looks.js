const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────
// Looks — saved, reusable shader "looks" for the Shader Studio.
//
// A look is the full backdrop recipe as data: shader + palette + generic knobs
// + per-shader GLSL controls + finishing pass (+ an optional captured
// thumbnail). Scoped to a studio, or global (studio_id NULL = house style,
// visible to everyone). Author once in the Studio, then apply to any
// composition, scene or screen. This is the packaging layer the whole shader
// system was built toward.
// ──────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS looks (
    id TEXT PRIMARY KEY,
    studio_id TEXT,
    name TEXT NOT NULL,
    shader TEXT NOT NULL,
    colors TEXT DEFAULT '[]',
    background TEXT DEFAULT '#000000',
    params TEXT DEFAULT '{}',
    glsl_params TEXT DEFAULT '{}',
    finishing TEXT,
    thumbnail TEXT,
    tags TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const j = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    studio_id: row.studio_id,
    name: row.name,
    shader: row.shader,
    colors: j(row.colors, []),
    background: row.background,
    params: j(row.params, {}),
    glslParams: j(row.glsl_params, {}),
    finishing: row.finishing ? j(row.finishing, null) : null,
    thumbnail: row.thumbnail || null,
    tags: j(row.tags, []),
    sort_order: row.sort_order,
    global: row.studio_id == null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// List the caller's studio looks plus global house looks.
router.get('/', authenticate, (req, res) => {
  try {
    const sid = req.user.studio_id || null;
    const rows = db
      .prepare('SELECT * FROM looks WHERE studio_id = ? OR studio_id IS NULL ORDER BY sort_order, created_at DESC')
      .all(sid);
    res.json(rows.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a look from the Studio's current state.
// Body: { name, shader, colors[], background, params{}, glslParams{}, finishing|null, thumbnail?, tags[]?, global? }
router.post('/', authenticate, (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.shader) return res.status(400).json({ error: 'name and shader are required' });
    const id = uuidv4();
    // `global` looks require an admin-ish role; otherwise scope to the caller's studio.
    const canGlobal = b.global && (req.user.role === 'super_admin' || req.user.role === 'admin');
    const studioId = canGlobal ? null : (req.user.studio_id || null);
    db.prepare(`
      INSERT INTO looks (id, studio_id, name, shader, colors, background, params, glsl_params, finishing, thumbnail, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, studioId, b.name, b.shader,
      JSON.stringify(Array.isArray(b.colors) ? b.colors : []),
      b.background || '#000000',
      JSON.stringify(b.params || {}),
      JSON.stringify(b.glslParams || {}),
      b.finishing ? JSON.stringify(b.finishing) : null,
      b.thumbnail || null,
      JSON.stringify(Array.isArray(b.tags) ? b.tags : []),
    );
    res.status(201).json(serialize(db.prepare('SELECT * FROM looks WHERE id = ?').get(id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a look (rename, re-tune, re-capture thumbnail, reorder).
router.put('/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM looks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Look not found' });
    const b = req.body || {};
    const orNull = (v, ser) => (v === undefined ? null : ser ? JSON.stringify(v) : v);
    db.prepare(`
      UPDATE looks SET
        name = COALESCE(?, name),
        shader = COALESCE(?, shader),
        colors = COALESCE(?, colors),
        background = COALESCE(?, background),
        params = COALESCE(?, params),
        glsl_params = COALESCE(?, glsl_params),
        finishing = CASE WHEN ? = 1 THEN ? ELSE finishing END,
        thumbnail = COALESCE(?, thumbnail),
        tags = COALESCE(?, tags),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      orNull(b.name), orNull(b.shader),
      b.colors === undefined ? null : JSON.stringify(b.colors),
      orNull(b.background),
      b.params === undefined ? null : JSON.stringify(b.params),
      b.glslParams === undefined ? null : JSON.stringify(b.glslParams),
      b.finishing === undefined ? 0 : 1, b.finishing ? JSON.stringify(b.finishing) : null,
      orNull(b.thumbnail),
      b.tags === undefined ? null : JSON.stringify(b.tags),
      b.sort_order === undefined ? null : b.sort_order,
      req.params.id,
    );
    res.json(serialize(db.prepare('SELECT * FROM looks WHERE id = ?').get(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, (req, res) => {
  try {
    const r = db.prepare('DELETE FROM looks WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Look not found' });
    res.json({ message: 'Look deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
