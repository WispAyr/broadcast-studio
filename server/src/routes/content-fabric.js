const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────────────────
// Content Fabric (CF-1) — the foundation for organising and (later) sharing
// content across a Customer → Site → Studio hierarchy.
//
//   • Hierarchy: customers ▸ sites ▸ studios (studios gain an optional site_id;
//     existing studios are backfilled under a default customer/site).
//   • Collections: named, cross-type bundles of content ("taskings") —
//     collection_items reference any resource by (resource_type, resource_id).
//   • Tags: a JSON `tags` array on every content type (layouts, decks, scenes,
//     media) — the same shape everywhere ("a pattern over the design").
//
// All additive + idempotent; nothing existing reads these yet, so it's safe to
// ship ahead of the UI. Visibility/grants (CF-3) and workgroups (CF-4) build on
// this. See docs / project memory.
// ──────────────────────────────────────────────────────────────────────────

// ── Schema (runs once at require-time) ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, icon TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS collection_items (
    id TEXT PRIMARY KEY, collection_id TEXT NOT NULL,
    resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE (collection_id, resource_type, resource_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id)
  );
  -- Media registry so uploaded assets are first-class taggable/collectable
  -- resources (populated by the uploads route in a later slice).
  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY, studio_id TEXT, name TEXT NOT NULL, path TEXT, kind TEXT,
    tags TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
`);
// studios gain an optional site_id; tags on every content type (idempotent).
for (const ddl of [
  'ALTER TABLE studios ADD COLUMN site_id TEXT',
  'ALTER TABLE layouts ADD COLUMN tags TEXT',
  'ALTER TABLE decks ADD COLUMN tags TEXT',
  'ALTER TABLE screen_scenes ADD COLUMN tags TEXT',
]) { try { db.exec(ddl); } catch { /* exists */ } }

// Backfill: ensure a default customer + site, and park any unassigned studio there.
(function backfill() {
  try {
    let cust = db.prepare("SELECT id FROM customers WHERE slug = 'wispayr'").get();
    if (!cust) { const id = uuidv4(); db.prepare('INSERT INTO customers (id, name, slug) VALUES (?, ?, ?)').run(id, 'WispAyr', 'wispayr'); cust = { id }; }
    let site = db.prepare('SELECT id FROM sites WHERE customer_id = ? AND slug = ?').get(cust.id, 'default');
    if (!site) { const id = uuidv4(); db.prepare('INSERT INTO sites (id, customer_id, name, slug) VALUES (?, ?, ?, ?)').run(id, cust.id, 'Default', 'default'); site = { id }; }
    db.prepare('UPDATE studios SET site_id = ? WHERE site_id IS NULL').run(site.id);
  } catch (e) { console.warn('[content-fabric] backfill skipped:', e.message); }
})();

// Whitelist of taggable / collectable resource types → (table, name column).
const RESOURCE = {
  layout: { table: 'layouts', name: 'name' },
  deck: { table: 'decks', name: 'name' },
  scene: { table: 'screen_scenes', name: 'name' },
  media: { table: 'media_assets', name: 'name' },
};
function parseTags(raw) { try { const t = JSON.parse(raw || '[]'); return Array.isArray(t) ? t : []; } catch { return []; } }

// ── Collections router ─────────────────────────────────────────────────────
const collections = express.Router();

collections.get('/', authenticate, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM collections ORDER BY name').all();
    const counts = db.prepare('SELECT collection_id, COUNT(*) n FROM collection_items GROUP BY collection_id').all();
    const cmap = Object.fromEntries(counts.map(c => [c.collection_id, c.n]));
    res.json(rows.map(r => ({ ...r, item_count: cmap[r.id] || 0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

collections.get('/:id', authenticate, (req, res) => {
  try {
    const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    if (!col) return res.status(404).json({ error: 'collection not found' });
    const items = db.prepare('SELECT * FROM collection_items WHERE collection_id = ? ORDER BY sort_order, added_at').all(req.params.id);
    const resolved = items.map(it => {
      const meta = RESOURCE[it.resource_type];
      let name = null;
      if (meta) {
        const row = db.prepare(`SELECT ${meta.name} AS name FROM ${meta.table} WHERE id = ?`).get(it.resource_id);
        name = row?.name || null;
      }
      return { ...it, name };
    });
    res.json({ ...col, items: resolved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

collections.post('/', authenticate, (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    db.prepare('INSERT INTO collections (id, name, description, icon) VALUES (?, ?, ?, ?)').run(id, name, description || null, icon || null);
    res.status(201).json(db.prepare('SELECT * FROM collections WHERE id = ?').get(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

collections.put('/:id', authenticate, (req, res) => {
  try {
    const { name, description, icon } = req.body;
    db.prepare("UPDATE collections SET name = COALESCE(?, name), description = ?, icon = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name ?? null, description === undefined ? null : description, icon === undefined ? null : icon, req.params.id);
    const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'collection not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

collections.delete('/:id', authenticate, (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM collection_items WHERE collection_id = ?').run(req.params.id);
      return db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
    });
    if (!tx().changes) return res.status(404).json({ error: 'collection not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

collections.post('/:id/items', authenticate, (req, res) => {
  try {
    const { resource_type, resource_id } = req.body;
    if (!RESOURCE[resource_type] || !resource_id) return res.status(400).json({ error: 'valid resource_type and resource_id required' });
    if (!db.prepare('SELECT 1 FROM collections WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'collection not found' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) m FROM collection_items WHERE collection_id = ?').get(req.params.id)?.m ?? -1;
    try {
      db.prepare('INSERT INTO collection_items (id, collection_id, resource_type, resource_id, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), req.params.id, resource_type, resource_id, maxOrder + 1);
    } catch { /* UNIQUE — already in the collection */ }
    res.status(201).json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

collections.delete('/:id/items', authenticate, (req, res) => {
  try {
    const { resource_type, resource_id } = req.body;
    db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND resource_type = ? AND resource_id = ?')
      .run(req.params.id, resource_type, resource_id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Customers / hierarchy router ───────────────────────────────────────────
const customers = express.Router();

// Full tree: customers ▸ sites ▸ studios.
customers.get('/', authenticate, (req, res) => {
  try {
    const custs = db.prepare('SELECT * FROM customers ORDER BY name').all();
    const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
    const studios = db.prepare('SELECT id, name, site_id FROM studios ORDER BY name').all();
    const tree = custs.map(c => ({
      ...c,
      sites: sites.filter(s => s.customer_id === c.id).map(s => ({
        ...s, studios: studios.filter(st => st.site_id === s.id),
      })),
    }));
    const unassigned = studios.filter(st => !st.site_id);
    res.json({ customers: tree, unassigned });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

customers.post('/', authenticate, (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    db.prepare('INSERT INTO customers (id, name, slug) VALUES (?, ?, ?)').run(id, name, (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

customers.post('/:id/sites', authenticate, (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!db.prepare('SELECT 1 FROM customers WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'customer not found' });
    const id = uuidv4();
    db.prepare('INSERT INTO sites (id, customer_id, name, slug) VALUES (?, ?, ?, ?)').run(id, req.params.id, name, (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    res.status(201).json(db.prepare('SELECT * FROM sites WHERE id = ?').get(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Move a studio under a site.
customers.put('/assign', authenticate, (req, res) => {
  try {
    const { studio_id, site_id } = req.body;
    if (!studio_id || !site_id) return res.status(400).json({ error: 'studio_id and site_id required' });
    if (!db.prepare('SELECT 1 FROM sites WHERE id = ?').get(site_id)) return res.status(404).json({ error: 'site not found' });
    db.prepare("UPDATE studios SET site_id = ?, updated_at = datetime('now') WHERE id = ?").run(site_id, studio_id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Content router: tags + a typed resource list for pickers ───────────────
const content = express.Router();

// List resources of a type (for the collection/tag pickers).
content.get('/:type', authenticate, (req, res) => {
  try {
    const meta = RESOURCE[req.params.type];
    if (!meta) return res.status(400).json({ error: 'unknown type' });
    const studioId = req.query.studio_id;
    const hasStudio = db.prepare(`PRAGMA table_info(${meta.table})`).all().some(c => c.name === 'studio_id');
    const rows = (hasStudio && studioId)
      ? db.prepare(`SELECT id, ${meta.name} AS name, tags FROM ${meta.table} WHERE studio_id = ? ORDER BY ${meta.name}`).all(studioId)
      : db.prepare(`SELECT id, ${meta.name} AS name, tags FROM ${meta.table} ORDER BY ${meta.name}`).all();
    res.json(rows.map(r => ({ ...r, tags: parseTags(r.tags) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Set tags on any content resource — one endpoint, every type (the pattern).
content.put('/:type/:id/tags', authenticate, (req, res) => {
  try {
    const meta = RESOURCE[req.params.type];
    if (!meta) return res.status(400).json({ error: 'unknown type' });
    const tags = Array.isArray(req.body.tags) ? req.body.tags.map(String) : [];
    const r = db.prepare(`UPDATE ${meta.table} SET tags = ? WHERE id = ?`).run(JSON.stringify(tags), req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'resource not found' });
    res.json({ ok: true, tags });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { collections, customers, content };
