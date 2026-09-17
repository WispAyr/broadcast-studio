/**
 * Ayr Pavilion "What's On" proxy + cache.
 *
 * Upstream is the public events API on ayrpavilion.com. This route serves a
 * normalised, stale-while-revalidate copy to Broadcast Studio screens so the
 * two Pavilion kiosks never blank when the upstream (or the venue uplink)
 * hiccups.
 *
 * GET  /api/pavilion-events          200 { events:[...], fetchedAt, ageMs, stale }
 *                                    503 { error:'no_cached_events' } only when the
 *                                        cache is empty AND upstream fails.
 * POST /api/pavilion-events/refresh  force an upstream refetch.
 *
 * Normalisation: booleans coerced ('True'/'False' strings tolerated), poster
 * URLs made absolute, ticket URLs validated, lineup split into an array on
 * newline / pipe ONLY (act names contain commas — "Earth, Wind & Fire").
 */
const express = require('express');
const router = express.Router();

const UPSTREAM = process.env.PAVILION_EVENTS_UPSTREAM
  || 'https://ayrpavilion.com/api/ayr-pavilion/events';
const IMG_BASE = process.env.PAVILION_IMG_BASE || 'https://ayrpavilion.com/images/';
const FRESH_MS = 5 * 60_000;                 // serve from cache without refetch for 5 min
const HARD_STALE_MS = 7 * 24 * 60 * 60_000;  // keep serving a stale copy for up to 7 days

let cache = null;   // { events, fetchedAt }
let inFlight = null;

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function clean(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return (s === 'None' || s === 'null' || s === 'undefined') ? '' : s;
}

function posterUrl(p) {
  const s = clean(p);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : IMG_BASE + s.replace(/^\/+/, '');
}

function httpUrl(u) {
  const s = clean(u);
  return /^https?:\/\//i.test(s) ? s : '';
}

function lineupList(raw) {
  const s = clean(raw);
  if (!s) return [];
  return s.replace(/\\n/g, '\n').split(/\n|\|/).map(x => x.trim()).filter(Boolean);
}

function normalise(ev) {
  // "External · Skiddle"-style types are really the ticketing provider, not a genre.
  let eventType = clean(ev.event_type);
  let provider = clean(ev.external_provider).replace(/^external[ ·.]*/i, "");
  const extMatch = eventType.match(/^external[ ·.:-]*(.*)$/i);
  if (extMatch) { if (!provider) provider = extMatch[1].trim(); eventType = ""; }
  return {
    id: String(ev.id ?? ''),
    title: clean(ev.title),
    slug: clean(ev.slug),
    description: clean(ev.description),
    event_date: clean(ev.event_date),          // YYYY-MM-DD
    event_time: clean(ev.event_time),          // HH:MM or free text
    venue: clean(ev.venue) || 'Ayr Pavilion, Ayr',
    event_type: eventType,
    lineup: lineupList(ev.lineup),
    featured: toBool(ev.featured),
    online: ev.online == null ? true : toBool(ev.online),
    status: clean(ev.status) || 'scheduled',
    ticket_url: httpUrl(ev.ticket_url),
    external_url: httpUrl(ev.external_url),
    external_provider: provider,
    poster_image: posterUrl(ev.poster_image),
    updated_at: clean(ev.updated_at),
  };
}

async function fetchUpstream() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const r = await fetch(UPSTREAM, { signal: ctrl.signal, headers: { 'user-agent': 'broadcast-studio/pavilion-events' } });
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      const raw = await r.json();
      const list = Array.isArray(raw) ? raw : (raw.events || raw.data || []);
      const events = list.map(normalise).filter(e => e.title && e.event_date);
      cache = { events, fetchedAt: Date.now() };
      return cache;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}

function payload(c, now, stale) {
  return { events: c.events, fetchedAt: c.fetchedAt, ageMs: now - c.fetchedAt, stale };
}

router.get('/', async (req, res) => {
  const now = Date.now();
  const fresh = cache && (now - cache.fetchedAt) < FRESH_MS;
  const usable = cache && (now - cache.fetchedAt) < HARD_STALE_MS;

  if (fresh) return res.json(payload(cache, now, false));

  fetchUpstream().catch(err => console.warn('[pavilion-events] upstream fetch failed:', err.message));

  if (usable) return res.json(payload(cache, now, true));

  try {
    const c = await fetchUpstream();
    return res.json(payload(c, Date.now(), false));
  } catch (err) {
    if (cache) return res.json(payload(cache, now, true)); // older than hard-stale, but better than blank
    return res.status(503).json({ error: 'no_cached_events', detail: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const c = await fetchUpstream();
    res.json({ ok: true, fetchedAt: c.fetchedAt, count: c.events.length });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// Warm the cache at boot so the first screen paint is instant.
fetchUpstream().catch(err => console.warn('[pavilion-events] warm-up fetch failed:', err.message));

module.exports = router;
