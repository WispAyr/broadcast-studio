// ─── Resolve pipeline ───────────────────────────────────────────────────────
// One definition of "resolve a web source", shared by the HTTP route and the
// background refresher so the two can never drift apart.
//
//   extract ─▶ replay probe ─▶ pick delivery path ─▶ register with go2rtc
//
// The replay probe is the load-bearing step and the reason the delivery path is
// decided per source rather than assumed: a manifest that the browser can fetch
// is not necessarily one that ffmpeg can fetch.

const { extractVia } = require('./extract-client');
const { isPrivateUrl } = require('./net-guard');
const go2rtc = require('./go2rtc');
const relay = require('./web-source-relay');
const store = require('./web-source-store');

// ─── Extraction queue ───────────────────────────────────────────────────────
// One headless Chrome at a time. Concurrent resolves are the easiest way to
// knock over whichever box this lands on, and the refresher fires on a timer
// with no idea what an operator is doing.

let chain = Promise.resolve();
let inFlight = 0;

function enqueue(fn) {
  inFlight += 1;
  const run = chain.then(fn, fn);
  chain = run.catch(() => {}).finally(() => { inFlight -= 1; });
  return run;
}

const queueDepth = () => inFlight;

// ─── Replay probe ───────────────────────────────────────────────────────────

async function probeReplay(streamUrl, headers = {}) {
  const attempt = async (hdrs) => {
    try {
      const res = await fetch(streamUrl, { headers: hdrs, redirect: 'follow', signal: AbortSignal.timeout(8000) });
      return res.ok;
    } catch {
      return false;
    }
  };

  if (await attempt({})) return { replay: 'direct' };

  const withHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    if (['referer', 'origin', 'user-agent'].includes(k)) withHeaders[k] = v;
  }
  if (Object.keys(withHeaders).length && await attempt(withHeaders)) {
    return { replay: 'headers-required', headers: withHeaders };
  }
  return { replay: 'unplayable' };
}

/**
 * Resolve one source end to end and register it with the relay.
 *
 * @param {string} key
 * @param {object} opts
 * @param {string} opts.relayBase  absolute base URL go2rtc can reach BS on,
 *        required only for the headers-required path
 * @param {string} opts.trigger    'operator' | 'refresh' — recorded, for audit
 * @returns {Promise<{ok:boolean, ...}>}
 */
async function resolveSource(key, { relayBase, trigger = 'operator' } = {}) {
  const cfg = store.load();
  const src = cfg.sources.find((s) => s.key === key);
  if (!src) return { ok: false, reason: 'not-found', message: 'no such source' };
  if (isPrivateUrl(src.pageUrl)) return { ok: false, reason: 'blocked', message: 'Blocked: private/internal URL' };

  const markFailed = (reason, message, extra = {}) => {
    store.update(key, (s) => {
      s.status = 'failed';
      s.lastError = `${reason}: ${message}`;
      s.lastAttemptAt = new Date().toISOString();
      s.consecutiveFailures = (s.consecutiveFailures || 0) + 1;
      s.lastTrigger = trigger;
    });
    return { ok: false, key, reason, message, ...extra };
  };

  let result;
  try {
    result = await enqueue(() => extractVia(src.pageUrl, {
      consent: src.consent === 'reject' ? 'reject' : 'off',
    }));
  } catch (e) {
    return markFailed('error', e.message);
  }

  if (!result.ok) {
    return markFailed(result.reason, result.message || 'extraction failed', {
      steps: result.steps,
      embeds: result.embeds,
      drmEvidence: result.drmEvidence,
    });
  }

  const probe = await probeReplay(result.stream.url, result.stream.headers);
  if (probe.replay === 'unplayable') {
    return markFailed('unplayable',
      'Manifest found but it will not fetch outside the browser session — likely IP- or cookie-bound.',
      { streamUrl: result.stream.url });
  }

  // ── Delivery path. Direct wherever possible; the relay costs an extra hop.
  const name = src.stream || store.streamName(key);
  let source;
  let delivery;

  if (probe.replay === 'direct') {
    source = go2rtc.buildSource(result.stream.url);
    delivery = 'direct';
  } else {
    if (!relayBase) {
      return markFailed('relay-unconfigured',
        'Stream needs Referer/Origin headers, which means relaying through this server — but no relay base URL is set. Set WEB_SOURCE_RELAY_BASE to a URL the go2rtc relay can reach.',
        { streamUrl: result.stream.url, headers: probe.headers });
    }
    // Mint the relay token once and keep it: rotating it on every refresh would
    // break a relay that go2rtc is actively pulling.
    let token = src.relayToken;
    if (!token) {
      token = relay.newToken();
      store.update(key, (s) => { s.relayToken = token; });
    }
    const relayUrl = `${relayBase.replace(/\/+$/, '')}/api/web-sources/${encodeURIComponent(key)}/relay.ts?t=${token}`;
    try {
      source = go2rtc.buildSource(relayUrl);
    } catch (e) {
      return markFailed('relay-unconfigured', `relay URL rejected by go2rtc rules: ${e.message}`);
    }
    delivery = 'relay';
    // The upstream URL changed, so any relay currently running is reading a
    // stale manifest — drop it and let go2rtc reconnect to the new one.
    relay.stopRelay(key);
  }

  let put;
  try {
    put = await go2rtc.putStream(cfg.host, name, source);
  } catch (e) {
    return markFailed('relay-register', e.message, { streamUrl: result.stream.url });
  }

  store.update(key, (s) => {
    s.stream = name;
    s.status = 'ok';
    s.kind = result.stream.kind;
    s.live = result.stream.live;
    s.isMaster = result.stream.isMaster;
    s.streamUrl = result.stream.url;
    s.headers = result.stream.headers;
    s.delivery = delivery;
    s.confidence = result.confidence;
    s.consentWall = result.consentWall;
    s.steps = result.steps;
    s.resolvedAt = new Date().toISOString();
    s.lastAttemptAt = new Date().toISOString();
    s.lastError = null;
    s.consecutiveFailures = 0;
    s.lastTrigger = trigger;
    s.relayPersisted = put.persisted;
    s.relayWarning = put.warning || null;
  });

  return {
    ok: true,
    key,
    stream: name,
    play: { host: cfg.host, stream: name },
    kind: result.stream.kind,
    live: result.stream.live,
    delivery,
    confidence: result.confidence,
    elapsedMs: result.elapsedMs,
    steps: result.steps,
    relayPersisted: put.persisted,
    relayWarning: put.warning || null,
  };
}

module.exports = { resolveSource, probeReplay, enqueue, queueDepth };
