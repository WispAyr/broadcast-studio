// ─── Web sources ────────────────────────────────────────────────────────────
// Turns an arbitrary web page carrying video into a first-class broadcast
// source, by way of go2rtc.
//
//   page URL ──▶ extractor (headless Chrome + CDP) ──▶ manifest URL
//                                                        │
//                                  direct ───────────────┤
//                                  headers-required ─▶ relay.ts ─┐
//                                                        │       │
//                                            go2rtc PUT ─┴───────┘
//                                                        ▼
//                        existing `go2rtc_feed` / `live_tv` module on a screen
//
// This file is the HTTP layer only. The pipeline lives in lib/web-source-*.js
// so the background refresher runs exactly the same code path an operator does.
//
// Deliberate design decisions:
//
//  • RESOLVE IS NEVER ON THE AIR PATH. Screens only ever see a go2rtc stream
//    NAME. A scraper heuristic must never be able to black out a wall.
//  • The public GET is a safe projection — resolved URLs carry session tokens
//    and relay tokens are credentials.
//  • DRM is refused by the extractor, not worked around. Off-air TV stays on
//    the HDHomeRun (docs/TUNER.md).

const express = require('express');

const { authenticate } = require('../middleware/auth');
const { isPrivateUrl } = require('../lib/net-guard');
const { extractVia, extractorHealth } = require('../lib/extract-client');
const { resolveSource, probeReplay, enqueue, queueDepth } = require('../lib/web-source-resolver');
const refresher = require('../lib/web-source-refresher');
const relay = require('../lib/web-source-relay');
const store = require('../lib/web-source-store');
const snapshot = require('../lib/web-source-snapshot');
const go2rtc = require('../lib/go2rtc');

const router = express.Router();

// The base URL go2rtc must use to pull a relayed stream from us. Explicit
// config wins; otherwise infer from the request, which is right for a
// single-host deployment and wrong behind an unusual proxy — hence the override.
function relayBaseFor(req) {
  if (process.env.WEB_SOURCE_RELAY_BASE) return process.env.WEB_SOURCE_RELAY_BASE.replace(/\/+$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return host ? `${proto}://${host}` : null;
}

// ─── Read ───────────────────────────────────────────────────────────────────

// GET /api/web-sources — safe projection (screens + editor)
router.get('/', (req, res) => {
  res.json(store.publicView(store.load()));
});

// GET /api/web-sources/full — operator view (no relay tokens)
router.get('/full', authenticate, (req, res) => {
  res.json(store.operatorView(store.load()));
});

// GET /api/web-sources/health — heartbeat for the whole subsystem.
// Reports from the resolver's clock; never infers health from absence of noise.
router.get('/health', authenticate, async (req, res) => {
  const cfg = store.load();
  const [relayHost, extractor] = await Promise.all([
    go2rtc.health(cfg.host),
    extractorHealth(),
  ]);

  let registered = {};
  if (relayHost.up) registered = await go2rtc.listStreams(cfg.host).catch(() => ({}));
  const decisions = refresher.status().decisions;

  res.json({
    relay: relayHost,
    extractor,
    refresher: refresher.status(),
    relays: relay.relayStatus(),
    maxRelays: relay.MAX_CONCURRENT,
    queueDepth: queueDepth(),
    staleMs: store.STALE_MS,
    sources: cfg.sources.map((s) => {
      const name = s.stream || store.streamName(s.key);
      return {
        key: s.key,
        status: s.status || 'never',
        stale: store.isStale(s),
        delivery: s.delivery || null,
        resolvedAt: s.resolvedAt || null,
        registeredInRelay: Boolean(registered[name]),
        viewers: registered[name]?.consumers?.length || 0,
        snapshot: snapshot.status(s.key),
        consecutiveFailures: s.consecutiveFailures || 0,
        lastError: s.lastError || null,
        nextRefresh: decisions[s.key] || null,
      };
    }),
  });
});

// ─── Write ──────────────────────────────────────────────────────────────────

// POST /api/web-sources — define a source (does not resolve it)
router.post('/', authenticate, (req, res) => {
  const { key, label, pageUrl, consent, autoRefresh } = req.body || {};
  if (!key || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(key)) {
    return res.status(400).json({ error: 'key must be lower-case alphanumeric/dashes, 2-41 chars' });
  }
  if (!pageUrl || typeof pageUrl !== 'string') return res.status(400).json({ error: 'pageUrl required' });
  if (isPrivateUrl(pageUrl)) return res.status(403).json({ error: 'Blocked: private/internal URL' });
  if (consent && !['off', 'reject'].includes(consent)) {
    return res.status(400).json({ error: 'consent must be "off" or "reject"' });
  }

  const cfg = store.load();
  const existing = cfg.sources.find((s) => s.key === key);
  const entry = {
    key,
    label: label || key,
    pageUrl,
    consent: consent || 'off',
    autoRefresh: autoRefresh !== false,
    stream: store.streamName(key),
    status: existing?.status || 'never',
    resolvedAt: existing?.resolvedAt || null,
    lastError: existing?.lastError || null,
  };
  if (existing) Object.assign(existing, entry);
  else cfg.sources.push(entry);
  store.save(cfg);
  res.json(entry);
});

// PATCH /api/web-sources/:key — edit without re-creating
router.patch('/:key', authenticate, (req, res) => {
  const { label, consent, autoRefresh, pageUrl } = req.body || {};
  if (pageUrl && isPrivateUrl(pageUrl)) return res.status(403).json({ error: 'Blocked: private/internal URL' });
  if (consent && !['off', 'reject'].includes(consent)) {
    return res.status(400).json({ error: 'consent must be "off" or "reject"' });
  }
  const updated = store.update(req.params.key, (s) => {
    if (label !== undefined) s.label = label;
    if (consent !== undefined) s.consent = consent;
    if (autoRefresh !== undefined) s.autoRefresh = Boolean(autoRefresh);
    if (pageUrl !== undefined) {
      s.pageUrl = pageUrl;
      // The page changed, so whatever we resolved before is about it, not this.
      s.status = 'never';
      s.resolvedAt = null;
      s.consecutiveFailures = 0;
    }
  });
  if (!updated) return res.status(404).json({ error: 'no such source' });
  const { relayToken, ...safe } = updated;
  res.json(safe);
});

// PUT /api/web-sources/host — point at a different go2rtc relay
router.put('/host', authenticate, (req, res) => {
  const { host } = req.body || {};
  if (!host || typeof host !== 'string') return res.status(400).json({ error: 'host required' });
  const cfg = store.load();
  cfg.host = host.replace(/\/+$/, '');
  store.save(cfg);
  res.json({ host: cfg.host });
});

// POST /api/web-sources/probe — one-shot extraction, saves nothing.
// The "try this page before I commit to it" path.
router.post('/probe', authenticate, async (req, res) => {
  const { pageUrl, consent } = req.body || {};
  if (!pageUrl) return res.status(400).json({ error: 'pageUrl required' });
  if (isPrivateUrl(pageUrl)) return res.status(403).json({ error: 'Blocked: private/internal URL' });
  try {
    const result = await enqueue(() => extractVia(pageUrl, { consent: consent === 'reject' ? 'reject' : 'off' }));
    if (result.ok) {
      const probe = await probeReplay(result.stream.url, result.stream.headers);
      return res.json({ ...result, ...probe });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/web-sources/:key/resolve — extract, verify, register with go2rtc
router.post('/:key/resolve', authenticate, async (req, res) => {
  const result = await resolveSource(req.params.key, { relayBase: relayBaseFor(req), trigger: 'operator' });
  if (!result.ok) return res.status(result.reason === 'not-found' ? 404 : 422).json(result);
  res.json(result);
});

// POST /api/web-sources/refresh — run a refresher pass right now
router.post('/refresh', authenticate, async (req, res) => {
  try {
    res.json(await refresher.tick({ relayBase: relayBaseFor(req) }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/web-sources/:key — remove definition, stop any relay, deregister
router.delete('/:key', authenticate, async (req, res) => {
  const cfg = store.load();
  const i = cfg.sources.findIndex((s) => s.key === req.params.key);
  if (i < 0) return res.status(404).json({ error: 'no such source' });
  const [removed] = cfg.sources.splice(i, 1);
  store.save(cfg);
  relay.stopRelay(removed.key);
  snapshot.remove(removed.key);
  await go2rtc.deleteStream(cfg.host, removed.stream || store.streamName(removed.key)).catch(() => {});
  res.json({ ok: true, key: removed.key });
});

// ─── Relay ──────────────────────────────────────────────────────────────────

// GET /api/web-sources/:key/relay.ts?t=<token>
//
// NOT JWT-protected: go2rtc pulls this itself and cannot hold an operator
// token. Gated instead by a per-source random token, compared in constant time,
// which is never exposed by any read route. Only reachable for sources that
// actually resolved to the headers-required path.
router.get('/:key/relay.ts', (req, res) => {
  const cfg = store.load();
  const src = cfg.sources.find((s) => s.key === req.params.key);
  if (!src) return res.status(404).json({ error: 'no such source' });
  if (!relay.tokenMatches(src.relayToken, req.query.t)) {
    return res.status(403).json({ error: 'bad or missing relay token' });
  }
  if (src.delivery !== 'relay' || !src.streamUrl) {
    return res.status(409).json({ error: 'this source is not configured for relay delivery' });
  }
  relay.serveRelay(res, req, { key: src.key, url: src.streamUrl, headers: src.headers || {} });
});

// GET /api/web-sources/:key/snapshot.jpg
//
// The last frame we captured while this source was healthy — the "never dark"
// fallback. Public, because screens are unauthenticated and these are frames of
// pages that were already public (the SSRF guard blocks anything internal).
//
// 🚨 Always carries its AGE. A still that looks live is worse than a black
// screen, because an operator will believe it. Callers must show the age.
router.get('/:key/snapshot.jpg', (req, res) => {
  const s = snapshot.read(req.params.key);
  if (!s) return res.status(404).json({ error: 'no snapshot held for this source' });
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.set('X-Snapshot-Age-Ms', String(Math.round(s.ageMs)));
  res.set('Last-Modified', new Date(Date.now() - s.ageMs).toUTCString());
  res.sendFile(s.file);
});

module.exports = router;
