require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { seed } = require('./db');
const { setupWebSocket } = require('./ws');
const { getCurrentState } = require('./timeline');
const { authenticate } = require('./middleware/auth');

// Run seed on startup
seed();

// Ensure Blackout layout exists
(function ensureBlackout() {
  const { db } = require('./db');
  const { v4: uuidv4 } = require('uuid');
  const existing = db.prepare("SELECT id FROM layouts WHERE name LIKE '%Blackout%' LIMIT 1").get();
  if (!existing) {
    const id = uuidv4();
    const studioRow = db.prepare("SELECT id FROM studios LIMIT 1").get();
    const studioId = studioRow ? studioRow.id : 'default';
    db.prepare("INSERT INTO layouts (id, studio_id, name, grid_rows, grid_cols, modules) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, studioId, '⬛ Blackout', 1, 1, '[]');
    console.log('Created system Blackout layout:', id);
  }
})();

const app = express();
const server = http.createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Middleware
app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/studios', require('./routes/studios'));
app.use('/api/screens', require('./routes/screens'));
app.use('/api/screen-groups', require('./routes/screen-groups'));
app.use('/api/shows', require('./routes/shows'));
app.use('/api/layouts', require('./routes/layouts'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/proxy', require('./routes/proxy'));
app.use('/api/travel', require('./routes/travel'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/cues', require('./routes/cues'));
app.use('/api/autocue', require('./routes/autocue'));
app.use('/api/autocue-scripts', require('./routes/autocue-scripts'));
app.use("/api/obs", require("./routes/obs"));
app.use("/api/egpk", require("./routes/egpk"));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use('/player', express.static(path.join(__dirname, '..', 'public', 'player')));

// Timeline routes (inline)
const { startTimeline, stopTimeline } = require('./timeline');
const { db, getShowById, getLayoutById } = require('./db');

// GET /api/timeline/current
app.get('/api/timeline/current', authenticate, (req, res) => {
  try {
    const studioId = req.user.studio_id || req.query.studio_id;
    if (!studioId) {
      return res.status(400).json({ error: 'studio_id is required' });
    }
    const state = getCurrentState(studioId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timeline/override
app.post('/api/timeline/override', authenticate, (req, res) => {
  try {
    const { studio_id, layout_id } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!studioId || !layout_id) {
      return res.status(400).json({ error: 'studio_id and layout_id are required' });
    }

    const layout = getLayoutById(layout_id);
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    // Stop the current timeline
    stopTimeline(studioId);

    // Set layout on all studio screens
    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE studio_id = ?").run(layout_id, studioId);

    const { getIO } = require('./ws');
    getIO().to(`studio:${studioId}`).emit('set_layout', {
      layoutId: layout_id,
      layout: { ...layout, modules: JSON.parse(layout.modules) },
      source: 'override'
    });

    res.json({ message: 'Timeline overridden', layout_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timeline/resume
app.post('/api/timeline/resume', authenticate, (req, res) => {
  try {
    const { studio_id } = req.body;
    const studioId = studio_id || req.user.studio_id;
    if (!studioId) {
      return res.status(400).json({ error: 'studio_id is required' });
    }

    // Find active show for studio
    const activeShow = db.prepare('SELECT * FROM shows WHERE studio_id = ? AND active = 1').get(studioId);
    if (!activeShow) {
      return res.status(404).json({ error: 'No active show for this studio' });
    }

    startTimeline(studioId, activeShow);
    res.json({ message: 'Timeline resumed', show_id: activeShow.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Siphon data proxy — avoids CORS issues for screen modules

const SIPHON_ENDPOINTS = {
  weather: 'http://142.202.191.208:3882/api/weather/ayr',
  aqi: 'http://142.202.191.208:3882/api/weather/ayr',
  marine: 'http://142.202.191.208:3882/api/marine',
  radiation: 'http://142.202.191.208:3882/api/radiation/monitors',
  grid: 'http://142.202.191.208:3882/api/grid/frequency',
  proton: 'http://142.202.191.208:3882/api/proton-flux',
  earthquakes: 'http://142.202.191.208:3882/api/earthquakes',
};
app.get('/api/siphon-proxy/:preset', async (req, res) => {
  const preset = req.params.preset;
  const url = SIPHON_ENDPOINTS[preset];
  if (!url) return res.status(404).json({ error: 'Unknown preset' });
  try {
    const r = await fetch(url, { timeout: 8000 });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});


// ── Live Counter Control API ──
// GET /api/counter/:id — get current count
// POST /api/counter/:id/bump — increment by delta (default 1)
// POST /api/counter/:id/set — set absolute value
// POST /api/counter/:id/reset — reset to 0
app.get('/api/counter/:id', (req, res) => {
  if (!global._counterState) global._counterState = {};
  res.json({ id: req.params.id, count: global._counterState[req.params.id] || 0 });
});

app.post('/api/counter/:id/bump', express.json(), (req, res) => {
  if (!global._counterState) global._counterState = {};
  const id = req.params.id;
  const delta = req.body?.delta || 1;
  global._counterState[id] = (global._counterState[id] || 0) + delta;
  // Push to all screens via WebSocket
  const { getIO } = require('./ws');
  try {
    getIO().emit('update_module_config', { moduleId: id, config: { count: global._counterState[id] } });
  } catch {}
  res.json({ id, count: global._counterState[id] });
});

app.post('/api/counter/:id/set', express.json(), (req, res) => {
  if (!global._counterState) global._counterState = {};
  const id = req.params.id;
  global._counterState[id] = req.body?.value || 0;
  const { getIO } = require('./ws');
  try {
    getIO().emit('update_module_config', { moduleId: id, config: { count: global._counterState[id] } });
  } catch {}
  res.json({ id, count: global._counterState[id] });
});

app.post('/api/counter/:id/reset', (req, res) => {
  if (!global._counterState) global._counterState = {};
  global._counterState[req.params.id] = 0;
  const { getIO } = require('./ws');
  try {
    getIO().emit('update_module_config', { moduleId: req.params.id, config: { count: 0 } });
  } catch {}
  res.json({ id: req.params.id, count: 0 });
});

// Generic module config update API
app.post('/api/modules/:moduleId/config', express.json(), (req, res) => {
  const { getIO } = require('./ws');
  const config = req.body || {};
  try {
    const io = getIO();
    const sockets = io.sockets.sockets.size;
    io.emit('update_module_config', { moduleId: req.params.moduleId, config });
    console.log('[module-config] Emitted to', sockets, 'sockets:', req.params.moduleId, JSON.stringify(config).slice(0, 80));
  } catch (e) {
    console.error('[module-config] Emit error:', e.message);
  }
  res.json({ ok: true, moduleId: req.params.moduleId, config });
});


// Serve static files from client build
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

// Nuro streams endpoint
app.get('/api/nuro', (req, res) => {
  res.json({ version: '2.0', label: 'Broadcast Studio', icon: '\U0001f399', description: 'Audio broadcast production', streams: [
    { label: 'System Status', type: 'gauge', value: 100 },
  ]});
});

app.use(express.static(clientDist));

// SPA fallback - any non-API route serves index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3945;
server.listen(PORT, () => {
  console.log(`Broadcast Studio running on port ${PORT}`);
});
