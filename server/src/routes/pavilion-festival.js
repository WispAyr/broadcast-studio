/**
 * Pavilion Festival proxy + cache.
 * Fetches the event JSON from prism-surface (live.wispayr.online) and serves a
 * stale-while-revalidate copy to broadcast-studio kiosks. Survives upstream
 * outages by serving the last good payload (TTL: 24h hard-stale).
 *
 * GET /api/pavilion-festival/event
 *   200 { ...eventJson, _cache: { fetchedAt, ageMs, stale } }
 *   503 { error: 'no_cached_event' }   only when cache is empty AND upstream fails
 */
const express = require('express');
const router = express.Router();

const UPSTREAM = process.env.PAVILION_FESTIVAL_UPSTREAM
  || 'https://live.wispayr.online/api/events/pavilion-festival-2026';
const FRESH_MS = 60_000;          // serve from cache without refetch for 60s
const HARD_STALE_MS = 24 * 60 * 60_000; // serve stale up to 24h after last good fetch

let cache = null;          // { data, fetchedAt }
let inFlight = null;

async function fetchUpstream() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(UPSTREAM, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      const data = await r.json();
      cache = { data, fetchedAt: Date.now() };
      return cache;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}

router.get('/event', async (req, res) => {
  const now = Date.now();
  const fresh = cache && (now - cache.fetchedAt) < FRESH_MS;
  const stale = cache && (now - cache.fetchedAt) < HARD_STALE_MS;

  if (fresh) {
    return res.json({
      ...cache.data,
      _cache: { fetchedAt: cache.fetchedAt, ageMs: now - cache.fetchedAt, stale: false },
    });
  }

  // Stale — kick off revalidation but serve cached if we have it.
  fetchUpstream().catch((err) => {
    console.warn('[pavilion-festival] upstream fetch failed:', err.message);
  });

  if (stale) {
    return res.json({
      ...cache.data,
      _cache: { fetchedAt: cache.fetchedAt, ageMs: now - cache.fetchedAt, stale: true },
    });
  }

  // No cache yet — wait for the in-flight fetch.
  try {
    const c = await fetchUpstream();
    return res.json({
      ...c.data,
      _cache: { fetchedAt: c.fetchedAt, ageMs: 0, stale: false },
    });
  } catch (err) {
    return res.status(503).json({ error: 'no_cached_event', detail: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const c = await fetchUpstream();
    res.json({ ok: true, fetchedAt: c.fetchedAt });
  } catch (err) {
    res.status(502).json({ error: 'fetch_failed', detail: err.message });
  }
});

// Warm cache on module load.
fetchUpstream().catch(() => {});

module.exports = router;
