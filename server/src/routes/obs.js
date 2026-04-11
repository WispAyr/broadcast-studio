const express = require('express');
const router = express.Router();
const { obsManager } = require('../obs-manager');
const { authenticate } = require('../middleware/auth');

// All OBS routes require auth
router.use(authenticate);

// GET /api/obs/status
router.get('/status', (req, res) => {
  res.json(obsManager.getStatus());
});

// POST /api/obs/connect
router.post('/connect', async (req, res) => {
  try {
    const result = await obsManager.connect(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/obs/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    await obsManager.disconnect();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/obs/scenes
router.get('/scenes', async (req, res) => {
  try {
    const data = await obsManager.getScenes();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/obs/scene
router.post('/scene', async (req, res) => {
  try {
    const { sceneName } = req.body;
    if (!sceneName) return res.status(400).json({ error: 'sceneName required' });
    const result = await obsManager.setScene(sceneName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/obs/source-url — update browser source URL in a scene
router.post('/source-url', async (req, res) => {
  try {
    const { sceneName, url } = req.body;
    if (!sceneName || !url) return res.status(400).json({ error: 'sceneName and url required' });
    const result = await obsManager.setSceneSource(sceneName, url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/obs/stream
router.get('/stream', async (req, res) => {
  try {
    const status = await obsManager.getStreamStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/obs/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await obsManager.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
