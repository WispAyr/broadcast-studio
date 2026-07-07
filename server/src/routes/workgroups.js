const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────────────────
// Workgroups (Content Fabric CF-4) — a named group of users with an access
// scope (which studios/sites they can operate). Lets an operator belong to
// more than one studio: e.g. an "Ops" workgroup spanning every operational
// studio, so ops staff get everything operational without being super_admin.
//
// Additive + safe: this only WIDENS which studios a user's picker offers (via
// GET /api/me/access). It does not tighten existing per-route checks. Management
// is super_admin/admin only. Builds toward grants/collections access (CF-3).
// ──────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS workgroups (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, icon TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workgroup_members (
    id TEXT PRIMARY KEY, workgroup_id TEXT NOT NULL, user_id TEXT NOT NULL,
    UNIQUE (workgroup_id, user_id),
    FOREIGN KEY (workgroup_id) REFERENCES workgroups(id)
  );
  CREATE TABLE IF NOT EXISTS workgroup_studios (
    id TEXT PRIMARY KEY, workgroup_id TEXT NOT NULL, studio_id TEXT NOT NULL,
    UNIQUE (workgroup_id, studio_id),
    FOREIGN KEY (workgroup_id) REFERENCES workgroups(id)
  );
`);

// Studios a user can access = all (super_admin) · else own studio ∪ studios
// granted through any workgroup they're a member of.
function accessibleStudios(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return db.prepare('SELECT id, name, slug, site_id FROM studios ORDER BY name').all();
  const byId = new Map();
  if (user.studio_id) {
    const s = db.prepare('SELECT id, name, slug, site_id FROM studios WHERE id = ?').get(user.studio_id);
    if (s) byId.set(s.id, s);
  }
  const viaWg = db.prepare(`
    SELECT DISTINCT s.id, s.name, s.slug, s.site_id FROM studios s
    JOIN workgroup_studios ws ON ws.studio_id = s.id
    JOIN workgroup_members wm ON wm.workgroup_id = ws.workgroup_id
    WHERE wm.user_id = ?`).all(user.id);
  viaWg.forEach(s => byId.set(s.id, s));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── /api/me — the current user's effective access ──────────────────────────
const me = express.Router();
me.get('/access', authenticate, (req, res) => {
  try {
    const studios = accessibleStudios(req.user);
    const workgroups = req.user.role === 'super_admin'
      ? db.prepare('SELECT id, name, icon FROM workgroups ORDER BY name').all()
      : db.prepare('SELECT w.id, w.name, w.icon FROM workgroups w JOIN workgroup_members m ON m.workgroup_id = w.id WHERE m.user_id = ? ORDER BY w.name').all(req.user.id);
    res.json({ role: req.user.role, home_studio_id: req.user.studio_id || null, studios, workgroups });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── /api/workgroups — management (super_admin / admin) ──────────────────────
const workgroups = express.Router();
const manage = [authenticate, requireRole(['super_admin', 'admin'])];

workgroups.get('/', ...manage, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM workgroups ORDER BY name').all();
    const sc = db.prepare('SELECT workgroup_id, COUNT(*) n FROM workgroup_studios GROUP BY workgroup_id').all();
    const mc = db.prepare('SELECT workgroup_id, COUNT(*) n FROM workgroup_members GROUP BY workgroup_id').all();
    const s = Object.fromEntries(sc.map(r => [r.workgroup_id, r.n])), m = Object.fromEntries(mc.map(r => [r.workgroup_id, r.n]));
    res.json(rows.map(r => ({ ...r, studio_count: s[r.id] || 0, member_count: m[r.id] || 0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

workgroups.get('/:id', ...manage, (req, res) => {
  try {
    const wg = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!wg) return res.status(404).json({ error: 'workgroup not found' });
    const studios = db.prepare('SELECT s.id, s.name FROM studios s JOIN workgroup_studios ws ON ws.studio_id = s.id WHERE ws.workgroup_id = ? ORDER BY s.name').all(req.params.id);
    const members = db.prepare('SELECT u.id, u.username, u.name, u.role FROM users u JOIN workgroup_members wm ON wm.user_id = u.id WHERE wm.workgroup_id = ? ORDER BY u.username').all(req.params.id);
    res.json({ ...wg, studios, members });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

workgroups.post('/', ...manage, (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    db.prepare('INSERT INTO workgroups (id, name, description, icon) VALUES (?, ?, ?, ?)').run(id, name, description || null, icon || null);
    res.status(201).json(db.prepare('SELECT * FROM workgroups WHERE id = ?').get(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

workgroups.put('/:id', ...manage, (req, res) => {
  try {
    const { name, description, icon } = req.body;
    db.prepare("UPDATE workgroups SET name = COALESCE(?, name), description = ?, icon = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name ?? null, description === undefined ? null : description, icon === undefined ? null : icon, req.params.id);
    const row = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'workgroup not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

workgroups.delete('/:id', ...manage, (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM workgroup_studios WHERE workgroup_id = ?').run(req.params.id);
      db.prepare('DELETE FROM workgroup_members WHERE workgroup_id = ?').run(req.params.id);
      return db.prepare('DELETE FROM workgroups WHERE id = ?').run(req.params.id);
    });
    if (!tx().changes) return res.status(404).json({ error: 'workgroup not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Studios in the workgroup's scope
workgroups.post('/:id/studios', ...manage, (req, res) => {
  try {
    const { studio_id } = req.body;
    if (!studio_id) return res.status(400).json({ error: 'studio_id required' });
    try { db.prepare('INSERT INTO workgroup_studios (id, workgroup_id, studio_id) VALUES (?, ?, ?)').run(uuidv4(), req.params.id, studio_id); } catch { /* dup */ }
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
workgroups.delete('/:id/studios', ...manage, (req, res) => {
  try {
    db.prepare('DELETE FROM workgroup_studios WHERE workgroup_id = ? AND studio_id = ?').run(req.params.id, req.body.studio_id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Members
workgroups.post('/:id/members', ...manage, (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try { db.prepare('INSERT INTO workgroup_members (id, workgroup_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), req.params.id, user_id); } catch { /* dup */ }
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
workgroups.delete('/:id/members', ...manage, (req, res) => {
  try {
    db.prepare('DELETE FROM workgroup_members WHERE workgroup_id = ? AND user_id = ?').run(req.params.id, req.body.user_id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { workgroups, me, accessibleStudios };
