// routes/channel.js — Broadcast Studio control plane -> pu2 engine agent.
// The pu2 storm-director control-agent (control-panel/server.py) is reverse-tunnelled
// to this host at 127.0.0.1:3866. This router is the BS-side proxy: reads are open to
// logged-in operators; live actions (take/clear) require auth. No pu2 changes needed.
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticate, optionalAuthenticate, requireRole } = require('../middleware/auth');
const youtube = require('../youtube');
const producer = require('../producer');

// Roles allowed to control what's on air (take shows/scenes). Read stays open to any
// logged-in user; live cuts are gated so a future read-only role can't touch air.
const AIR_ROLES = ['super_admin', 'admin', 'director', 'operator', 'producer'];

const AGENT = process.env.PU2_AGENT_URL || 'http://127.0.0.1:3866';
const TIMEOUT_MS = 6000;

async function agent(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(AGENT + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return { status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

function relay(res, method, path, body) {
  return agent(method, path, body).then(
    (r) => res.status(r.status).json(r.data),
    (err) => res.status(502).json({ ok: false, error: 'engine unreachable', detail: String(err && err.message || err) })
  );
}

// ---- Virtual Producer: the live editorial rundown ----
router.get('/rundown', optionalAuthenticate, (req, res) => res.json(producer.getRundown()));

// ---- reads (available to logged-in control users) ----
router.get('/status', optionalAuthenticate, (req, res) => relay(res, 'GET', '/api/status'));
router.get('/schedule', optionalAuthenticate, (req, res) => relay(res, 'GET', '/api/schedule'));

// /config is sanitised: the raw engine config carries the YouTube api_key and other
// secrets — never relay those to the browser. Whitelist the fields the Gallery needs.
router.get('/config', optionalAuthenticate, (req, res) => {
  agent('GET', '/api/config').then(
    (r) => {
      const c = r.data || {};
      res.status(r.status).json({
        scenes: Array.isArray(c.scenes) ? c.scenes.map((s) => ({ name: s.name, dwell: s.dwell, enabled: s.enabled })) : [],
        shows: Array.isArray(c.shows) ? c.shows.map((s) => ({ id: s.id, name: s.name, scenes: s.scenes })) : [],
        schedule: c.schedule && typeof c.schedule === 'object'
          ? { override: c.schedule.override || null, default_show: c.schedule.default_show, slots: c.schedule.slots }
          : {},
        scene_override: c.scene_override || null,
      });
    },
    (err) => res.status(502).json({ ok: false, error: 'engine unreachable', detail: String(err && err.message || err) })
  );
});

// ---- live actions (auth required — these change what airs on YouTube) ----
// POST /api/channel/take { show, minutes }  -> pin a show as an override
router.post('/take', authenticate, requireRole(AIR_ROLES), (req, res) => {
  const show = (req.body && req.body.show || '').toString();
  if (!show) return res.status(400).json({ ok: false, error: 'show required' });
  const minutes = Number(req.body && req.body.minutes) || 60;
  return relay(res, 'POST', '/api/schedule/take', { show, minutes });
});

// POST /api/channel/clear  -> drop the override, back to schedule (AUTO)
router.post('/clear', authenticate, requireRole(AIR_ROLES), (req, res) => relay(res, 'POST', '/api/schedule/clear'));

// scene-level cuts (vision mixer) — take/hold a specific scene, or release to auto
router.post('/scene/take', authenticate, requireRole(AIR_ROLES), (req, res) => {
  const scene = (req.body && req.body.scene || '').toString();
  if (!scene) return res.status(400).json({ ok: false, error: 'scene required' });
  const minutes = Number(req.body && req.body.minutes) || 2;
  return relay(res, 'POST', '/api/scene/take', { scene, minutes });
});
router.post('/scene/clear', authenticate, requireRole(AIR_ROLES), (req, res) => relay(res, 'POST', '/api/scene/clear'));

// stream on/off — OBS StartStream/StopStream (broadcast auto-starts/stops to match).
// STOP takes the channel off air — the UI hard-guards it (arm then fire).
router.post('/stream/start', authenticate, requireRole(AIR_ROLES), (req, res) => relay(res, 'POST', '/api/stream/start'));
router.post('/stream/stop', authenticate, requireRole(AIR_ROLES), (req, res) => relay(res, 'POST', '/api/stream/stop'));

// live PGM frame — screenshot the current program scene from OBS
router.get('/screenshot', optionalAuthenticate, (req, res) => {
  const src = (req.query.source || '').toString();
  if (!src) return res.status(400).json({ ok: false, error: 'source required' });
  return relay(res, 'GET', '/api/screenshot?source=' + encodeURIComponent(src));
});

// ---- music DJ (dynamic bed) ----
router.get('/music', optionalAuthenticate, (req, res) => relay(res, 'GET', '/api/music'));
router.post('/music/vibe', authenticate, (req, res) => {
  const value = Number(req.body && req.body.value);
  if (!isFinite(value)) return res.status(400).json({ ok: false, error: 'value (0-100) required' });
  return relay(res, 'POST', '/api/music/vibe', { value });
});
router.post('/music/skip', authenticate, (req, res) => relay(res, 'POST', '/api/music/skip'));
router.post('/music/track', authenticate, (req, res) => relay(res, 'POST', '/api/music/track', req.body || {}));

// ---- YouTube Tier-2 (OAuth): live title + auto-title ----
// Display uses the cheap Tier-1 poller (status.youtube); the API is only hit on writes.
const AUTO_PATH = path.join(__dirname, '..', '..', 'data', 'yt_autotitle.json');
let ytAuto = false;
try { ytAuto = !!JSON.parse(fs.readFileSync(AUTO_PATH, 'utf8')).enabled; } catch { /* default off */ }
let lastPushed = null, lastPushAt = 0;

function buildTitle(status) {
  const show = (status && status.show && status.show.name) || 'Ayrshire';
  return '🔴 WispAyr Live · ' + show + ' — Prestwick, the Clyde & Ayrshire';
}
async function autoTitleTick() {
  if (!ytAuto || !youtube.hasCreds()) return;
  try {
    const st = (await agent('GET', '/api/status')).data;
    const t = buildTitle(st);
    if (t !== lastPushed && Date.now() - lastPushAt > 60000) {
      await youtube.setMeta({ title: t });
      lastPushed = t; lastPushAt = Date.now();
    }
  } catch { /* transient — try next tick */ }
}
setInterval(autoTitleTick, 60000);

router.get('/youtube', optionalAuthenticate, (req, res) => {
  res.json({ hasCreds: youtube.hasCreds(), auto: ytAuto });
});
router.post('/youtube/title', authenticate, requireRole(AIR_ROLES), (req, res) => {
  const title = (req.body && req.body.title || '').toString();
  if (!title.trim()) return res.status(400).json({ ok: false, error: 'title required' });
  youtube.setMeta({ title, description: req.body && req.body.description }).then(
    (r) => { lastPushed = null; res.json({ ok: true, ...r }); },
    (e) => res.status(502).json({ ok: false, error: e.message })
  );
});
router.post('/youtube/auto', authenticate, requireRole(AIR_ROLES), (req, res) => {
  ytAuto = !!(req.body && req.body.enabled);
  try { fs.mkdirSync(path.dirname(AUTO_PATH), { recursive: true }); fs.writeFileSync(AUTO_PATH, JSON.stringify({ enabled: ytAuto })); } catch { /* non-fatal */ }
  if (ytAuto) autoTitleTick();
  res.json({ ok: true, auto: ytAuto });
});
// Capture the current on-air board (1280px) and set it as the live thumbnail.
router.post('/youtube/thumbnail', authenticate, requireRole(AIR_ROLES), (req, res) => {
  (async () => {
    const st = (await agent('GET', '/api/status')).data;
    const scene = st && st.obs && st.obs.current_scene;
    if (!scene) return res.status(400).json({ ok: false, error: 'no program scene' });
    const shot = (await agent('GET', '/api/screenshot?source=' + encodeURIComponent(scene) + '&w=1280')).data;
    const b64 = (shot && shot.image || '').split(',').pop();
    if (!b64) return res.status(502).json({ ok: false, error: 'no image from engine' });
    const r = await youtube.setThumbnail(Buffer.from(b64, 'base64'));
    res.json({ ok: true, scene, ...r });
  })().catch((e) => res.status(502).json({ ok: false, error: e.message }));
});

// Live chat — ON DEMAND only (quota: 5u/call). The UI polls this while the operator
// is watching, respecting the returned pollMs. chatId cached 5min to save a lookup.
let _chatId = null, _chatIdAt = 0;
async function chatId() {
  if (_chatId && Date.now() - _chatIdAt < 300000) return _chatId;
  _chatId = await youtube.liveChatId(); _chatIdAt = Date.now();
  return _chatId;
}
router.get('/youtube/chat', authenticate, (req, res) => {
  (async () => {
    if (!youtube.hasCreds()) return res.json({ enabled: false, messages: [] });
    const cid = await chatId();
    if (!cid) return res.json({ enabled: false, messages: [], reason: 'chat disabled on this stream' });
    const r = await youtube.listChat(cid, req.query.pageToken);
    res.json({ enabled: true, ...r });
  })().catch((e) => res.status(502).json({ ok: false, error: e.message }));
});
router.post('/youtube/chat/delete', authenticate, requireRole(AIR_ROLES), (req, res) => {
  const id = (req.body && req.body.id || '').toString();
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  youtube.deleteChatMessage(id).then(() => res.json({ ok: true }), (e) => res.status(502).json({ ok: false, error: e.message }));
});

// ---- scheduled premieres (upcoming broadcasts) ----
router.get('/youtube/upcoming', authenticate, (req, res) => {
  if (!youtube.hasCreds()) return res.json({ items: [] });
  youtube.upcomingBroadcasts().then((items) => res.json({ items }), (e) => res.status(502).json({ ok: false, error: e.message }));
});
router.post('/youtube/schedule', authenticate, requireRole(AIR_ROLES), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.startTime) return res.status(400).json({ ok: false, error: 'title and startTime required' });
  if (isNaN(Date.parse(b.startTime))) return res.status(400).json({ ok: false, error: 'startTime must be ISO 8601' });
  youtube.scheduleBroadcast(b).then((r) => res.json({ ok: true, ...r }), (e) => res.status(502).json({ ok: false, error: e.message }));
});
router.post('/youtube/schedule/delete', authenticate, requireRole(AIR_ROLES), (req, res) => {
  const id = (req.body && req.body.id || '').toString();
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  youtube.deleteBroadcast(id).then(() => res.json({ ok: true }), (e) => res.status(502).json({ ok: false, error: e.message }));
});

module.exports = router;
