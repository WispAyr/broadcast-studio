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
app.use('/api/shows', require('./routes/shows'));
app.use('/api/layouts', require('./routes/layouts'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/proxy', require('./routes/proxy'));
app.use('/api/travel', require('./routes/travel'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

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

// Serve static files from client build
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback - any non-API route serves index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = 3945;
server.listen(PORT, () => {
  console.log(`Broadcast Studio running on port ${PORT}`);
});
