// Now Ayrshire Radio (NAR) consumer route — pass-through to siphon /api/nar/*.
//
// Siphon (on pu2) owns ingest + 60s-to-1d cache; this route just proxies, stamps
// CORS, and keeps a 10s in-memory mirror so a screen tab refresh storm doesn't
// hammer pu2 over WAN. If siphon goes down, last-known-good response is held
// for STALE_GRACE_MS so screens degrade gracefully instead of going blank.
//
// SIPHON_BASE env override lets dev point at a local siphon when needed;
// production default is the public big-server-routed pu2 endpoint.

const express = require('express');
const router = express.Router();

const SIPHON_BASE = process.env.SIPHON_BASE || 'http://142.202.191.208:3882';
const FRESH_TTL_MS = 10 * 1000;             // serve mirror without re-fetch
const STALE_GRACE_MS = 10 * 60 * 1000;      // serve mirror as fallback up to 10m

const mirror = new Map();  // path -> { body, ts }

async function fetchSiphon(path, qs) {
  const url = `${SIPHON_BASE}/api/nar${path}${qs ? `?${qs}` : ''}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'broadcast-studio/nar-proxy' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    const err = new Error(`siphon ${r.status}`);
    err.status = r.status;
    err.body = txt;
    throw err;
  }
  return r.json();
}

async function serve(req, res, path) {
  const qs = req.originalUrl.includes('?')
    ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1)
    : '';
  const key = `${path}?${qs}`;
  const cached = mirror.get(key);

  if (cached && Date.now() - cached.ts < FRESH_TTL_MS) {
    return res.json(cached.body);
  }

  try {
    const data = await fetchSiphon(path, qs);
    mirror.set(key, { body: data, ts: Date.now() });
    res.json(data);
  } catch (e) {
    if (cached && Date.now() - cached.ts < STALE_GRACE_MS) {
      return res.json({ ...cached.body, stale: true, fallback: 'last-known-good' });
    }
    res.status(e.status || 502).json({ error: e.message, source: 'siphon' });
  }
}

router.get('/current',  (req, res) => serve(req, res, '/current'));
router.get('/schedule', (req, res) => serve(req, res, '/schedule'));
router.get('/news',     (req, res) => serve(req, res, '/news'));
router.get('/events',   (req, res) => serve(req, res, '/events'));
router.get('/shows',    (req, res) => serve(req, res, '/shows'));
router.get('/',         (req, res) => serve(req, res, ''));

module.exports = router;
