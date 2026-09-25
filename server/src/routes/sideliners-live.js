// routes/sideliners-live.js — external data feeds + the SideLiners director.
//
//   /api/datafeeds/sideliners/public         PUBLIC  live/results/upcoming + stale flag (graphics pages read this)
//   /api/datafeeds/sideliners/table/:league  PUBLIC  league table (bounded set of leagues)
//   /api/datafeeds/sideliners/fixture/:id    PUBLIC  one of today's fixtures
//   /api/datafeeds                           JWT     feed health
//   /api/datafeeds/:source/events            JWT     recent events
//   /api/sl-director/:studioId …             JWT     director state, mode, arm, take, dismiss, pull, manual
//
// The public reads are football facts the station airs anyway, served from
// BS's own snapshot, so hitting them costs no upstream quota.
const express = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authenticateApiKey } = require('../middleware/apiKey');
const feeds = require('../datafeeds');
const director = require('../sl-director');

const datafeeds = express.Router();
const pub = (req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cache-Control', 'no-store'); next(); };

datafeeds.get('/sideliners/public', pub, (req, res) => res.json(feeds.publicView('sideliners')));
datafeeds.get('/sideliners/fixture/:id', pub, (req, res) => {
  const f = feeds.fixture('sideliners', req.params.id);
  if (!f) return res.status(404).json({ ok: false, error: 'not in today\'s feed' });
  res.json({ ok: true, stale: feeds.health('sideliners').stale, fixture: f });
});
datafeeds.get('/sideliners/table/:league', pub, async (req, res) => {
  try {
    const t = await feeds.table('sideliners', req.params.league);
    if (!t || t.ok === false) return res.status(404).json({ ok: false, error: (t && t.error) || 'not served' });
    res.json(t);
  } catch (e) { res.status(502).json({ ok: false, error: e.message }); }
});
datafeeds.get('/', authenticate, (req, res) => res.json({ sources: feeds.sources().map(feeds.health) }));
datafeeds.get('/:source/events', authenticate, (req, res) => {
  if (!feeds.sources().includes(req.params.source)) return res.status(404).json({ error: 'unknown source' });
  res.json({ events: feeds.recentEvents(req.params.source, req.query.limit) });
});

const dir = express.Router({ mergeParams: true });
// Two ways in: a BS login (that studio's users, or super_admin), or a studio API
// key carrying the 'sl-director' scope. The key is how the NAR intranet drives
// the director for presenters who have no BS account; it names the person
// acting in X-Actor, which goes into the director's log.
dir.use((req, res, next) => {
  const key = authenticateApiKey(req);
  if (key) {
    if (!(key.scopes || []).includes('sl-director')) return res.status(403).json({ error: 'key lacks sl-director scope' });
    req.apiKey = key; return next();
  }
  optionalAuthenticate(req, res, () => req.user ? next() : res.status(401).json({ error: 'authentication required' }));
});
dir.param('studioId', (req, res, next, id) => {
  if (req.apiKey) return req.apiKey.studio_id === id ? next() : res.status(403).json({ error: 'key not valid for this studio' });
  if (req.user.role === 'super_admin' || req.user.studio_id === id) return next();
  res.status(403).json({ error: 'not your studio' });
});
const who = req => req.apiKey
  ? `${String(req.headers['x-actor'] || 'unknown').replace(/[^\w .@-]/g, '').slice(0, 40)} (${req.apiKey.name})`
  : (req.user && (req.user.username || req.user.name || req.user.email)) || 'operator';
const wrap = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(400).json({ error: e.message }); } };

dir.get('/:studioId', wrap(req => director.state(req.params.studioId)));
dir.post('/:studioId/mode', wrap(req => {
  const mode = req.body && req.body.mode;
  if (mode === 'auto') director.arm(req.params.studioId, req.body.hours);   // AUTO is always armed + time-limited
  else director.saveCfg(req.params.studioId, { mode, armedUntil: 0 });
  return director.state(req.params.studioId);
}));
dir.put('/:studioId/settings', wrap(req => {
  const allowed = Object.keys(director.DEFAULT_SETTINGS);
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  director.saveCfg(req.params.studioId, { settings: patch });
  return director.state(req.params.studioId);
}));
dir.post('/:studioId/take/:cueId', wrap(req => director.take(req.params.studioId, req.params.cueId, who(req))));
dir.post('/:studioId/take-next', wrap(req => director.takeNext(req.params.studioId, who(req))));
dir.post('/:studioId/dismiss/:cueId', wrap(req => director.dismiss(req.params.studioId, req.params.cueId, who(req))));
dir.post('/:studioId/pull', wrap(req => director.pull(req.params.studioId, who(req))));
dir.post('/:studioId/manual', wrap(req => director.manual(req.params.studioId, req.body || {}, who(req))));

module.exports = { datafeeds, director: dir };
