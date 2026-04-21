// Display Nodes — Electron kiosk control plane.
// Self-contained: creates its own tables on first import, seeds Office/pu1/pu2/bravo
// with the current hard-coded assignments, plus a starter layer library and group presets.
//
// Kiosks poll GET /api/display-nodes/by-host/:host every ~15s. That path is
// intentionally unauthenticated (it only returns URLs that are themselves public).
// Management endpoints use the standard authenticate middleware.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ──────────── Schema ────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS display_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS display_nodes (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    host TEXT NOT NULL UNIQUE,
    label TEXT,
    last_seen TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(location_id) REFERENCES display_locations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS display_slots (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    display_index INTEGER NOT NULL,
    match TEXT NOT NULL,
    slot_label TEXT,
    current_url TEXT,
    current_label TEXT,
    UNIQUE(node_id, display_index),
    FOREIGN KEY(node_id) REFERENCES display_nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS display_layers (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT,
    icon TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS display_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL,
    location_id TEXT,
    assignments TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(location_id) REFERENCES display_locations(id) ON DELETE CASCADE
  );
`);

// Bridge: each display_slot mirrors into a broadcast-studio `screens` row so they
// show up in GodView and can be assigned full layouts via the existing layout tooling.
// Added after initial ship (2026-04-20) so we ALTER rather than recreate.
try { db.exec("ALTER TABLE display_slots ADD COLUMN screen_id TEXT"); } catch (_) { /* column exists */ }
try { db.exec("ALTER TABLE display_slots ADD COLUMN power_state TEXT DEFAULT 'on'"); } catch (_) { /* column exists */ }
// Per-node revision counter. Kiosks can poll GET /version/:host (cheap, no
// heavy slot resolution) or — preferred — join socket room `kiosk:<host>` and
// listen for 'display_update' to react instantly when ops changes a slot.
try { db.exec("ALTER TABLE display_nodes ADD COLUMN revision INTEGER DEFAULT 0"); } catch (_) { /* column exists */ }

// Bump the node revision + emit socket event. Called after any mutation
// that changes what a kiosk should render.
function notifyNode(hostOrId) {
  try {
    // Accept either host string or node id
    let node = db.prepare('SELECT id, host FROM display_nodes WHERE host = ? OR id = ?').get(hostOrId, hostOrId);
    if (!node) return;
    db.prepare("UPDATE display_nodes SET revision = COALESCE(revision,0) + 1 WHERE id = ?").run(node.id);
    const rev = db.prepare('SELECT revision FROM display_nodes WHERE id = ?').get(node.id).revision;
    const { getIO } = require('../ws');
    try {
      getIO().to(`kiosk:${node.host}`).emit('display_update', {
        host: node.host, revision: rev, timestamp: new Date().toISOString(),
      });
    } catch { /* IO not ready at seed time */ }
  } catch (err) {
    console.warn('[display-nodes.notify] failed:', err.message);
  }
}

// Bump-by-slot convenience: look up the node for a given slot id, then bump.
function notifySlot(slotId) {
  try {
    const row = db.prepare('SELECT node_id FROM display_slots WHERE id = ?').get(slotId);
    if (row) notifyNode(row.node_id);
  } catch { /* best-effort */ }
}

const BS_PUBLIC_URL = (process.env.BROADCAST_STUDIO_PUBLIC_URL || 'https://broadcast.studio.wispayr.online').replace(/\/+$/, '');
const OFFICE_STUDIO_ID = '322ec380-5267-4c98-a4a9-174f237197e3'; // "Ops Office" studio

// ──────────── Seed ────────────
(function seedDisplays() {
  const layerSeeds = [
    { slug: 'prism-surface',   name: 'Prism Surface',   url: 'https://live.wispayr.online',                 category: 'ops',       icon: 'crosshair', description: 'Ops map + events' },
    { slug: 'ayrshire-hub',    name: 'Ayrshire Hub',    url: 'https://ayrshire.wispayr.online/?tv=1',       category: 'ayrshire',  icon: 'globe',     description: 'County live intel (TV mode)' },
    { slug: 'egpk-live',       name: 'EGPK Live',       url: 'https://egpk.info',                           category: 'aviation',  icon: 'plane',     description: 'Prestwick live radar' },
    { slug: 'em-globe',        name: 'EM Globe',        url: 'https://em.wispayr.online',                   category: 'space',     icon: 'globe',     description: '3D space weather' },
    { slug: 'chaseit',         name: 'Chaseit',         url: 'https://chase.wispayr.online',                category: 'weather',   icon: 'zap',       description: 'Storm chasing outlook' },
    { slug: 'wispmaps',        name: 'WispMaps',        url: 'https://maps.wispayr.online',                 category: 'ops',       icon: 'map',       description: 'Layered ops map' },
    { slug: 'search-ops',      name: 'SAR Search Ops',  url: 'https://search.wispayr.online',               category: 'ops',       icon: 'search',    description: 'Search surface' },
    { slug: 'ayrweather',      name: 'Ayr Weather',     url: 'https://weather.ayrshire.wispayr.online',     category: 'ayrshire',  icon: 'cloud',     description: 'Full Ayrshire weather' },
    { slug: 'ayrtraffic',      name: 'Ayr Traffic',     url: 'https://traffic.ayrshire.wispayr.online',     category: 'ayrshire',  icon: 'car',       description: 'A77/A78/A71 live' },
    { slug: 'ayrnews',         name: 'Ayrshire News',   url: 'https://news.ayrshire.wispayr.online',        category: 'ayrshire',  icon: 'list',      description: 'Local headlines' },
    { slug: 'trains',          name: 'Trains',          url: 'https://trains.wispayr.online',               category: 'ayrshire',  icon: 'train',     description: 'Ayrshire line departures' },
    { slug: 'fuel',            name: 'FuelPulse',       url: 'https://fuel.wispayr.online',                 category: 'ayrshire',  icon: 'fuel',      description: 'Forecourt prices' },
    { slug: 'wind-atlas',      name: 'Wind Atlas',      url: 'https://wind.wispayr.online',                 category: 'aviation',  icon: 'wind',      description: 'ADS-B upper winds' },
    { slug: 'dispatch-status', name: 'Dispatch Status', url: 'https://dispatch.wispayr.online/health',      category: 'ops',       icon: 'activity',  description: 'Gateway health (API only)' },
    { slug: 'blackout',        name: 'Blackout',        url: 'about:blank',                                 category: 'system',    icon: 'x',         description: 'Black screen' },
  ];
  const existingLayerCount = db.prepare('SELECT COUNT(*) AS c FROM display_layers').get().c;
  if (existingLayerCount === 0) {
    const insertLayer = db.prepare('INSERT INTO display_layers (id, slug, name, url, category, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    layerSeeds.forEach((l, i) => insertLayer.run(uuidv4(), l.slug, l.name, l.url, l.category, l.icon, l.description, i));
    console.log(`[display-nodes] seeded ${layerSeeds.length} layers`);
  }

  // Office location + nodes
  let office = db.prepare('SELECT * FROM display_locations WHERE name = ?').get('Office');
  if (!office) {
    const id = uuidv4();
    db.prepare('INSERT INTO display_locations (id, name) VALUES (?, ?)').run(id, 'Office');
    office = { id, name: 'Office' };
    console.log('[display-nodes] seeded location: Office');
  }

  const nodeSeeds = [
    { host: 'pu1',   label: "Ewan's iMac",       slots: [
      { display_index: 0, match: 'primary',   slot_label: 'Built-in 4.5K', current_layer: 'prism-surface' },
      { display_index: 1, match: 'secondary', slot_label: 'External 1080p', current_layer: 'ayrshire-hub' },
    ]},
    { host: 'pu2',   label: 'NOC iMac',          slots: [
      { display_index: 0, match: 'primary',   slot_label: 'Built-in 4.5K', current_layer: 'em-globe' },
    ]},
    { host: 'bravo', label: 'Bravo MacBook Pro', slots: [
      { display_index: 0, match: 'primary',   slot_label: 'Built-in Liquid Retina', current_layer: 'egpk-live' },
    ]},
  ];

  for (const n of nodeSeeds) {
    let node = db.prepare('SELECT * FROM display_nodes WHERE host = ?').get(n.host);
    if (!node) {
      const id = uuidv4();
      db.prepare('INSERT INTO display_nodes (id, location_id, host, label) VALUES (?, ?, ?, ?)')
        .run(id, office.id, n.host, n.label);
      node = { id, host: n.host };
      console.log(`[display-nodes] seeded node: ${n.host}`);
    }
    for (const s of n.slots) {
      const existing = db.prepare('SELECT id FROM display_slots WHERE node_id = ? AND display_index = ?')
        .get(node.id, s.display_index);
      if (existing) continue;
      const layer = db.prepare('SELECT url, name FROM display_layers WHERE slug = ?').get(s.current_layer);
      db.prepare('INSERT INTO display_slots (id, node_id, display_index, match, slot_label, current_url, current_label) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), node.id, s.display_index, s.match, s.slot_label, layer?.url || null, layer?.name || null);
    }
  }

  // Starter presets — only seed if none exist for Office
  const existingPresetCount = db.prepare('SELECT COUNT(*) AS c FROM display_presets WHERE location_id = ?').get(office.id).c;
  if (existingPresetCount === 0) {
    const byHost = (host, idx) => ({ host, display_index: idx });
    const layerUrl = (slug) => {
      const r = db.prepare('SELECT url, name FROM display_layers WHERE slug = ?').get(slug);
      return { url: r.url, label: r.name };
    };
    const makePreset = (name, icon, description, mapping) => {
      const assignments = Object.entries(mapping).map(([key, slug]) => {
        const [host, idxStr] = key.split(':');
        const { url, label } = layerUrl(slug);
        return { ...byHost(host, Number(idxStr)), url, label };
      });
      db.prepare('INSERT INTO display_presets (id, name, scope, location_id, assignments, description, icon) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), name, 'group', office.id, JSON.stringify(assignments), description, icon);
    };
    makePreset('Ops',           'crosshair', 'Default ops layout',
      { 'pu1:0': 'prism-surface', 'pu1:1': 'ayrshire-hub', 'pu2:0': 'em-globe',     'bravo:0': 'egpk-live' });
    makePreset('Aviation Focus','plane',    'Everything pointing at the skies',
      { 'pu1:0': 'egpk-live',      'pu1:1': 'wind-atlas',   'pu2:0': 'chaseit',      'bravo:0': 'ayrshire-hub' });
    makePreset('Ayrshire Focus','globe',    'Local county surfaces',
      { 'pu1:0': 'ayrshire-hub',   'pu1:1': 'ayrtraffic',   'pu2:0': 'ayrnews',      'bravo:0': 'egpk-live' });
    makePreset('Space Weather', 'zap',      'Aurora + geomagnetic',
      { 'pu1:0': 'em-globe',       'pu1:1': 'prism-surface','pu2:0': 'chaseit',      'bravo:0': 'egpk-live' });
    makePreset('Blackout',      'x',        'All screens dark',
      { 'pu1:0': 'blackout',       'pu1:1': 'blackout',     'pu2:0': 'blackout',     'bravo:0': 'blackout' });
    console.log('[display-nodes] seeded 5 starter presets');
  }

  // Backfill: ensure each slot has a matching `screens` row so they appear in GodView.
  const slotsNeedingScreen = db.prepare(`
    SELECT s.id AS slot_id, s.match, s.display_index, n.host, n.label AS node_label
      FROM display_slots s
      JOIN display_nodes n ON s.node_id = n.id
     WHERE s.screen_id IS NULL
  `).all();
  if (slotsNeedingScreen.length) {
    const insertScreen = db.prepare(
      'INSERT INTO screens (id, studio_id, name, screen_number, is_online) VALUES (?, ?, ?, ?, 0)'
    );
    const updateSlot = db.prepare('UPDATE display_slots SET screen_id = ? WHERE id = ?');
    // Find a safe screen_number per studio: max + 1, incrementing as we add.
    let nextNum = (db.prepare('SELECT COALESCE(MAX(screen_number), 0) AS m FROM screens WHERE studio_id = ?').get(OFFICE_STUDIO_ID).m) || 0;
    for (const s of slotsNeedingScreen) {
      const screenId = uuidv4();
      nextNum += 1;
      const name = `${s.host}-${s.match}${s.node_label ? ` · ${s.node_label}` : ''}`;
      insertScreen.run(screenId, OFFICE_STUDIO_ID, name, nextNum);
      updateSlot.run(screenId, s.slot_id);
      console.log(`[display-nodes] bridged slot ${s.host}/${s.match} → screen ${screenId} (#${nextNum})`);
    }
  }
})();

// ──────────── Helpers ────────────
const toSlotRow = (s) => ({
  id: s.id, display_index: s.display_index, match: s.match,
  slot_label: s.slot_label, url: s.current_url, label: s.current_label,
  screen_id: s.screen_id,
  power_state: s.power_state || 'on',
});

function loadNodeWithSlots(host) {
  const node = db.prepare('SELECT * FROM display_nodes WHERE host = ?').get(host);
  if (!node) return null;
  const slots = db.prepare('SELECT * FROM display_slots WHERE node_id = ? ORDER BY display_index').all(node.id);
  return { ...node, slots: slots.map(toSlotRow) };
}

// If the slot's BS screen has a layout assigned, we hand the kiosk a /screen/<id>
// URL so ScreenDisplay renders the composition. Otherwise kiosks load the raw URL.
function effectiveUrlForSlot(slot) {
  if (!slot.screen_id) return { url: slot.url, label: slot.label };
  const screen = db.prepare('SELECT id, name, current_layout_id FROM screens WHERE id = ?').get(slot.screen_id);
  if (screen && screen.current_layout_id) {
    return { url: `${BS_PUBLIC_URL}/screen/${screen.id}`, label: screen.name || slot.label };
  }
  return { url: slot.url, label: slot.label };
}

function applyAssignment({ host, display_index, url, label }) {
  const node = db.prepare('SELECT id FROM display_nodes WHERE host = ?').get(host);
  if (!node) throw new Error(`unknown host ${host}`);
  const slot = db.prepare('SELECT id, screen_id FROM display_slots WHERE node_id = ? AND display_index = ?').get(node.id, display_index);
  if (!slot) return false;
  db.prepare('UPDATE display_slots SET current_url = ?, current_label = ? WHERE id = ?')
    .run(url, label || null, slot.id);
  // Raw-URL assignment wins over any stale layout on the bridged screen.
  if (slot.screen_id) {
    db.prepare("UPDATE screens SET current_layout_id = NULL, updated_at = datetime('now') WHERE id = ?").run(slot.screen_id);
  }
  return true;
}

// ──────────── Public (kiosk) ────────────
// Shape matches the on-disk .office-screens.json exactly so the kiosk can drop it in.
router.get('/by-host/:host', (req, res) => {
  const host = req.params.host;
  const node = loadNodeWithSlots(host);
  if (!node) return res.status(404).json({ error: `no node for host ${host}` });
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
  db.prepare("UPDATE display_nodes SET last_seen = datetime('now') WHERE id = ?").run(node.id);
  // Mark the bridged screens as online + bump last_seen so GodView shows them live.
  const bumpScreen = db.prepare("UPDATE screens SET is_online = 1, last_seen = datetime('now'), updated_at = datetime('now') WHERE id = ?");
  for (const s of node.slots) { if (s.screen_id) bumpScreen.run(s.screen_id); }
  res.json({
    host,
    displays: node.slots.map(s => {
      const { url, label } = effectiveUrlForSlot(s);
      return { match: s.match, url, label, power: s.power_state || 'on' };
    }),
  });
});

// ──────────── Admin ────────────
router.get('/', authenticate, (_req, res) => {
  const locations = db.prepare('SELECT * FROM display_locations').all();
  const nodes = db.prepare('SELECT * FROM display_nodes').all();
  const slots = db.prepare('SELECT * FROM display_slots').all();
  res.json(locations.map(l => ({
    ...l,
    nodes: nodes.filter(n => n.location_id === l.id).map(n => ({
      ...n,
      slots: slots.filter(s => s.node_id === n.id).map(toSlotRow),
    })),
  })));
});

router.get('/layers', authenticate, (_req, res) => {
  res.json(db.prepare('SELECT * FROM display_layers ORDER BY category, sort_order, name').all());
});

router.get('/presets', authenticate, (_req, res) => {
  const rows = db.prepare('SELECT * FROM display_presets ORDER BY created_at').all();
  res.json(rows.map(r => ({ ...r, assignments: JSON.parse(r.assignments) })));
});

router.post('/slots/:id/set', authenticate, (req, res) => {
  const { url, label } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  const slot = db.prepare('SELECT id, screen_id FROM display_slots WHERE id = ?').get(req.params.id);
  if (!slot) return res.status(404).json({ error: 'slot not found' });
  db.prepare('UPDATE display_slots SET current_url = ?, current_label = ? WHERE id = ?')
    .run(url, label || null, slot.id);
  if (slot.screen_id) {
    db.prepare("UPDATE screens SET current_layout_id = NULL, updated_at = datetime('now') WHERE id = ?").run(slot.screen_id);
  }
  notifySlot(slot.id);
  res.json({ ok: true });
});

router.post('/presets/:id/apply', authenticate, (req, res) => {
  const p = db.prepare('SELECT * FROM display_presets WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'preset not found' });
  const assignments = JSON.parse(p.assignments);
  const applied = db.transaction(() => assignments.map(applyAssignment)).call(null);
  // Preset typically spans multiple nodes — bump them all.
  try {
    const nodeIds = [...new Set(db.prepare('SELECT DISTINCT node_id FROM display_slots').all().map(r => r.node_id))];
    nodeIds.forEach(nid => notifyNode(nid));
  } catch { /* best-effort */ }
  res.json({ ok: true, applied: applied.filter(Boolean).length, total: assignments.length });
});

router.post('/presets', authenticate, (req, res) => {
  const { name, scope = 'group', location_name = 'Office', assignments, description, icon } = req.body || {};
  if (!name || !Array.isArray(assignments)) return res.status(400).json({ error: 'name + assignments required' });
  const loc = db.prepare('SELECT id FROM display_locations WHERE name = ?').get(location_name);
  const id = uuidv4();
  db.prepare('INSERT INTO display_presets (id, name, scope, location_id, assignments, description, icon) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, scope, loc?.id || null, JSON.stringify(assignments), description || null, icon || null);
  res.json({ id });
});

router.delete('/presets/:id', authenticate, (req, res) => {
  const r = db.prepare('DELETE FROM display_presets WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'preset not found' });
  res.json({ ok: true });
});


// ──────────── Power (sleep/wake) ────────────
// Per-slot: blanks the kiosk window for that display (loads a black data: URL).
// Per-node: blanks all slots on a host; kiosk additionally runs
// `pmset displaysleepnow` when EVERY slot on the host is off, so the physical
// panel power-saves. On macOS we can't sleep one panel selectively — this is
// the closest approximation.
function validPower(v) { return v === 'on' || v === 'off'; }

router.post('/slots/:id/power', authenticate, (req, res) => {
  const { state } = req.body || {};
  if (!validPower(state)) return res.status(400).json({ error: "state must be 'on' or 'off'" });
  const r = db.prepare('UPDATE display_slots SET power_state = ? WHERE id = ?').run(state, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'slot not found' });
  notifySlot(req.params.id);
  res.json({ ok: true, state });
});

router.post('/nodes/:host/power', authenticate, (req, res) => {
  const { state } = req.body || {};
  if (!validPower(state)) return res.status(400).json({ error: "state must be 'on' or 'off'" });
  const node = db.prepare('SELECT id FROM display_nodes WHERE host = ?').get(req.params.host);
  if (!node) return res.status(404).json({ error: 'node not found' });
  const r = db.prepare('UPDATE display_slots SET power_state = ? WHERE node_id = ?').run(state, node.id);
  notifyNode(node.id);
  res.json({ ok: true, state, slots_updated: r.changes });
});

// ──────────── Revision check for kiosk polling ────────────
// Kiosks on slow-poll can hit /version/:host (cheap integer compare) instead
// of the full /by-host/:host on every tick. When revision bumps, refresh.
// Public like by-host — returns only a counter.
router.get('/version/:host', (req, res) => {
  const row = db.prepare('SELECT revision FROM display_nodes WHERE host = ?').get(req.params.host);
  if (!row) return res.status(404).json({ error: 'node not found' });
  // Cache-buster for nginx / CDN
  res.set('Cache-Control', 'no-store');
  res.json({ host: req.params.host, revision: row.revision || 0 });
});

module.exports = router;
