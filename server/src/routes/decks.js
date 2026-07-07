const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────
// Decks — a placed, named control surface for a studio: a grid of buttons the
// operator lays out and fires to control the studio's screens (take a layout,
// apply a scene, blackout…).
//
// A Deck's buttons are stored as `console_buttons` rows tagged with
// `deck_id` + placement (`x,y,w,h`) + a default `target`. This is ADDITIVE on
// top of the existing button table, so the legacy /console + Stream Deck fire
// path (POST /api/console/:studioId/fire/:buttonId) keeps working unchanged and
// deck buttons fire through the very same dispatcher. See routes/console.js.
// ──────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    name TEXT NOT NULL,
    grid_cols INTEGER DEFAULT 6,
    grid_rows INTEGER DEFAULT 4,
    status TEXT DEFAULT 'draft',        -- draft | published
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

function safeParse(raw, fallback = {}) {
  try { return JSON.parse(raw || JSON.stringify(fallback)); } catch { return fallback; }
}

function serializeButton(row) {
  if (!row) return null;
  return { ...row, action_payload: safeParse(row.action_payload, {}), states: row.states ? safeParse(row.states, []) : [], confirm: !!row.confirm, enabled: !!row.enabled };
}

function studioOf(req) {
  return req.body?.studio_id || req.query?.studio_id || req.user?.studio_id;
}

// GET /api/decks?studio_id= — list decks for a studio (with button counts)
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const rows = db.prepare('SELECT * FROM decks WHERE studio_id = ? ORDER BY updated_at DESC').all(studioId);
    const counts = db.prepare(
      "SELECT deck_id, COUNT(*) n FROM console_buttons WHERE deck_id IS NOT NULL GROUP BY deck_id"
    ).all();
    const cmap = Object.fromEntries(counts.map(c => [c.deck_id, c.n]));
    res.json(rows.map(r => ({ ...r, button_count: cmap[r.id] || 0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/decks/:id — a deck plus its placed buttons
router.get('/:id', authenticate, (req, res) => {
  try {
    const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(req.params.id);
    if (!deck) return res.status(404).json({ error: 'deck not found' });
    const buttons = db.prepare('SELECT * FROM console_buttons WHERE deck_id = ? ORDER BY y, x').all(req.params.id);
    res.json({ ...deck, buttons: buttons.map(serializeButton) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/decks — create a deck
router.post('/', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    const { name, grid_cols, grid_rows, status } = req.body;
    if (!studioId || !name) return res.status(400).json({ error: 'studio_id and name required' });
    const id = uuidv4();
    db.prepare(`INSERT INTO decks (id, studio_id, name, grid_cols, grid_rows, status)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, studioId, name, grid_cols || 6, grid_rows || 4, status === 'published' ? 'published' : 'draft');
    res.status(201).json(db.prepare('SELECT * FROM decks WHERE id = ?').get(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/decks/:id — rename / resize / publish
router.put('/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM decks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'deck not found' });
    const { name, grid_cols, grid_rows, status } = req.body;
    db.prepare(`UPDATE decks SET
        name = COALESCE(?, name),
        grid_cols = COALESCE(?, grid_cols),
        grid_rows = COALESCE(?, grid_rows),
        status = COALESCE(?, status),
        updated_at = datetime('now')
      WHERE id = ?`)
      .run(name ?? null, grid_cols ?? null, grid_rows ?? null, status ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM decks WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/decks/:id — remove the deck and its buttons
router.delete('/:id', authenticate, (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM console_buttons WHERE deck_id = ?').run(req.params.id);
      return db.prepare('DELETE FROM decks WHERE id = ?').run(req.params.id);
    });
    const r = tx();
    if (!r.changes) return res.status(404).json({ error: 'deck not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
