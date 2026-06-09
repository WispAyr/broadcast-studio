const express = require('express');
const { authenticate } = require('../middleware/auth');
const cardWall = require('../card-wall');

const router = express.Router();
router.use(authenticate);

function studioOf(req) {
  return req.body?.studio_id || req.query?.studio_id || req.user?.studio_id;
}

// GET /api/card-wall — current on-air card, scheduled slot, override, schedule.
router.get('/', (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    res.json(cardWall.getState(studioId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/card-wall/override { layout_id, minutes? }
// Hold a card on the wall. Without `minutes` it holds until the next scheduled
// show starts (or an explicit /resume).
router.post('/override', (req, res) => {
  try {
    const studioId = studioOf(req);
    const { layout_id, minutes } = req.body;
    if (!studioId || !layout_id) return res.status(400).json({ error: 'studio_id and layout_id required' });
    res.json(cardWall.override(studioId, layout_id, minutes ? Number(minutes) : null));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/card-wall/resume — drop any override, back to the daypart schedule.
router.post('/resume', (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    res.json(cardWall.resume(studioId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/card-wall/enable  |  /disable
router.post('/enable', (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    res.json(cardWall.setEnabled(studioId, true));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/disable', (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    res.json(cardWall.setEnabled(studioId, false));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/card-wall/schedule { slots: [{ dow, start, layout_id, label }] }
router.put('/schedule', (req, res) => {
  try {
    const studioId = studioOf(req);
    const { slots } = req.body;
    if (!studioId || !Array.isArray(slots)) return res.status(400).json({ error: 'studio_id and slots[] required' });
    for (const s of slots) {
      if (typeof s.dow !== 'number' || s.dow < 0 || s.dow > 6) return res.status(400).json({ error: 'each slot needs dow 0-6' });
      if (!/^\d{2}:\d{2}$/.test(s.start || '')) return res.status(400).json({ error: 'each slot needs start "HH:MM"' });
      if (!s.layout_id) return res.status(400).json({ error: 'each slot needs layout_id' });
    }
    res.json(cardWall.replaceSchedule(studioId, slots));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
