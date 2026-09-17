#!/usr/bin/env node
// ─── Shared extraction service ──────────────────────────────────────────────
// Stream extraction is estate-level capability, not a Broadcast Studio feature.
// Prism, drones-admin and anything else with a "put this web video on a
// surface" problem wants the same thing — and none of them should grow their
// own headless-Chrome fleet. This puts one behind HTTP.
//
//   node src/web-source-service.js
//
//   WEB_SOURCE_SERVICE_PORT   default 3946
//   WEB_SOURCE_SERVICE_BIND   default 127.0.0.1
//   WEB_SOURCE_EXTRACTOR_TOKEN  shared secret; REQUIRED for a non-loopback bind
//   CHROME_PATH               browser override
//
// Clients set WEB_SOURCE_EXTRACTOR_URL (and the matching token) and get the
// identical contract they would from the in-process library — see
// lib/extract-client.js.
//
// Where this should run: NOT big-server (86% disk, and it is the intel plane).
// stream-server already carries ffmpeg and the encode-capacity cgroups.

const express = require('express');
const crypto = require('crypto');

const { extract } = require('./lib/web-source-extract');
const { extractData, probeReplay } = require('./lib/web-data-extract');
const { isPrivateUrl } = require('./lib/net-guard');
const { findChrome } = require('./lib/cdp');

const PORT = Number(process.env.WEB_SOURCE_SERVICE_PORT || 3946);
const BIND = process.env.WEB_SOURCE_SERVICE_BIND || '127.0.0.1';
const TOKEN = process.env.WEB_SOURCE_EXTRACTOR_TOKEN || '';
const MAX_QUEUE = Number(process.env.WEB_SOURCE_SERVICE_MAX_QUEUE || 20);

const isLoopback = BIND === '127.0.0.1' || BIND === '::1' || BIND === 'localhost';
if (!TOKEN && !isLoopback) {
  console.error(`FATAL: binding to ${BIND} without WEB_SOURCE_EXTRACTOR_TOKEN would expose a browser to the network`);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '64kb' }));

// Constant-time bearer check. Skipped only when no token is configured, which
// the startup guard above restricts to a loopback bind.
function requireToken(req, res, next) {
  if (!TOKEN) return next();
  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'bad or missing token' });
  }
  return next();
}

// One browser at a time, with a bounded waiting room. An unbounded queue just
// converts a flood into a very slow flood plus unbounded memory.
let chain = Promise.resolve();
let inFlight = 0;
let completed = 0;
let failed = 0;

function enqueue(fn) {
  if (inFlight >= MAX_QUEUE) return Promise.reject(new Error('extractor queue full'));
  inFlight += 1;
  const run = chain.then(fn, fn);
  chain = run.catch(() => {}).finally(() => { inFlight -= 1; });
  return run;
}

app.get('/health', requireToken, (req, res) => {
  let chrome = null;
  let error = null;
  try { chrome = findChrome(); } catch (e) { error = e.message; }
  res.json({
    up: true,
    service: 'web-source-extractor',
    chrome,
    error,
    queueDepth: inFlight,
    maxQueue: MAX_QUEUE,
    completed,
    failed,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.post('/extract', requireToken, async (req, res) => {
  const { pageUrl, consent, timeoutMs, settleMs, userAgent } = req.body || {};
  if (!pageUrl || typeof pageUrl !== 'string') return res.status(400).json({ error: 'pageUrl required' });

  // 🚨 This drives a real browser. Unguarded, a caller could read whatever the
  // host's private networks serve. Block before anything is launched.
  if (isPrivateUrl(pageUrl)) return res.status(403).json({ error: 'Blocked: private/internal URL' });

  try {
    const result = await enqueue(() => extract(pageUrl, {
      consent: consent === 'reject' ? 'reject' : 'off',
      ...(Number.isFinite(timeoutMs) ? { timeoutMs: Math.min(120_000, Math.max(5_000, timeoutMs)) } : {}),
      ...(Number.isFinite(settleMs) ? { settleMs: Math.min(20_000, Math.max(0, settleMs)) } : {}),
      ...(typeof userAgent === 'string' && userAgent ? { userAgent } : {}),
    }));
    if (result.ok) completed += 1; else failed += 1;
    res.json(result);
  } catch (e) {
    failed += 1;
    const full = /queue full/i.test(e.message);
    res.status(full ? 503 : 500).json({ ok: false, reason: full ? 'busy' : 'error', message: e.message });
  }
});

// POST /extract-data — "what does this page's own JavaScript fetch?"
//
// For sources with no public API. Returns a POLL SPEC: everything a plain HTTP
// client needs to fetch the endpoint again, so the browser is a discovery tool
// used once, not a polling tool used forever. See lib/web-data-extract.js.
app.post('/extract-data', requireToken, async (req, res) => {
  const { pageUrl, match, consent, timeoutMs, settleMs, maxCaptures, probe } = req.body || {};
  if (!pageUrl || typeof pageUrl !== 'string') return res.status(400).json({ error: 'pageUrl required' });
  if (isPrivateUrl(pageUrl)) return res.status(403).json({ error: 'Blocked: private/internal URL' });

  try {
    const result = await enqueue(() => extractData(pageUrl, {
      match: typeof match === 'string' ? match : undefined,
      consent: consent === 'reject' ? 'reject' : 'off',
      ...(Number.isFinite(timeoutMs) ? { timeoutMs: Math.min(120_000, Math.max(5_000, timeoutMs)) } : {}),
      ...(Number.isFinite(settleMs) ? { settleMs: Math.min(30_000, Math.max(0, settleMs)) } : {}),
      ...(Number.isFinite(maxCaptures) ? { maxCaptures: Math.min(100, Math.max(1, maxCaptures)) } : {}),
    }));

    // Probing is the point — it tells the caller whether it can drop the
    // browser entirely — but it fires a real request, so it is opt-out.
    if (result.ok && probe !== false) {
      result.replay = await probeReplay(result.best);
    }
    if (result.ok) completed += 1; else failed += 1;
    res.json(result);
  } catch (e) {
    failed += 1;
    const full = /queue full/i.test(e.message);
    res.status(full ? 503 : 500).json({ ok: false, reason: full ? 'busy' : 'error', message: e.message });
  }
});

if (require.main === module) {
  app.listen(PORT, BIND, () => {
    console.log(`[web-source-extractor] listening on ${BIND}:${PORT} (auth: ${TOKEN ? 'token' : 'none — loopback only'})`);
    try {
      console.log(`[web-source-extractor] chrome: ${findChrome()}`);
    } catch (e) {
      console.warn(`[web-source-extractor] WARNING: ${e.message}`);
    }
  });
}

module.exports = app;
