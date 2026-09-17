// ─── Background refresher ───────────────────────────────────────────────────
// Tokenised manifest URLs expire. Without this, every source quietly rots until
// an operator notices a dead wall — which is exactly the failure mode the
// heartbeat discipline exists to prevent.
//
// The policy is deliberately conservative about live output:
//
//  • REFRESH IMMEDIATELY when a source is broken or has drifted out of the
//    relay (registry says ok, go2rtc has never heard of it — e.g. the relay
//    restarted). There is nothing to protect; it is already not working.
//
//  • REFRESH WHEN IDLE once past 80% of the stale window. Re-registering a
//    stream forces go2rtc to reconnect, which is a visible glitch. If nobody is
//    pulling it, that costs nothing — so do it then, and the source is already
//    fresh when a wall next starts it.
//
//  • DEFER while something is watching, but NOT forever. Past 2× the stale
//    window a deferred source is refreshed anyway: a one-second reconnect beats
//    a wall that dies at the next reconnect with an expired token.
//
// Everything runs through the resolver's queue, so the refresher can never
// compete with an operator for the browser.

const { resolveSource } = require('./web-source-resolver');
const store = require('./web-source-store');
const go2rtc = require('./go2rtc');
const snapshot = require('./web-source-snapshot');

const TICK_MS = Number(process.env.WEB_SOURCE_REFRESH_TICK_MS || 60_000);
const MAX_PER_TICK = Number(process.env.WEB_SOURCE_REFRESH_PER_TICK || 3);
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;

let timer = null;
let running = false;
let lastTick = null;
const lastDecisions = new Map(); // key -> { action, why, at }

function backoffUntil(src) {
  const fails = src.consecutiveFailures || 0;
  if (!fails || !src.lastAttemptAt) return 0;
  const wait = Math.min(BACKOFF_BASE_MS * 2 ** (fails - 1), BACKOFF_MAX_MS);
  return new Date(src.lastAttemptAt).getTime() + wait;
}

function hasConsumers(streams, name) {
  const s = streams[name];
  if (!s) return false;
  return Array.isArray(s.consumers) && s.consumers.length > 0;
}

/**
 * Decide what to do with one source. Pure — takes the relay's stream map so the
 * decision is testable without a running go2rtc.
 */
function decide(src, streams, now = Date.now()) {
  if (src.autoRefresh === false) return { action: 'skip', why: 'auto-refresh disabled' };

  const until = backoffUntil(src);
  if (until && now < until) {
    return { action: 'skip', why: `backing off after ${src.consecutiveFailures} failures, retry in ${Math.round((until - now) / 1000)}s` };
  }

  const name = src.stream || store.streamName(src.key);
  const registered = Boolean(streams[name]);

  if (src.status === 'failed') return { action: 'refresh', why: 'previous attempt failed' };
  if (src.status === 'never' || !src.resolvedAt) return { action: 'refresh', why: 'never resolved' };
  if (!registered) return { action: 'refresh', why: 'missing from relay (drifted — relay probably restarted)' };

  const age = now - new Date(src.resolvedAt).getTime();
  if (age <= store.STALE_MS * 0.8) return { action: 'skip', why: 'still fresh' };

  if (hasConsumers(streams, name)) {
    if (age > store.STALE_MS * 2) {
      return { action: 'refresh', why: 'in use, but far past expiry — accepting a brief reconnect over a dead reconnect later' };
    }
    return { action: 'defer', why: 'in use by a viewer; refreshing would glitch it' };
  }

  return { action: 'refresh', why: 'past 80% of the stale window and idle' };
}

async function tick({ relayBase } = {}) {
  if (running) return { skipped: 'already running' };
  running = true;
  lastTick = new Date().toISOString();
  const done = [];

  try {
    const cfg = store.load();
    if (!cfg.sources.length) return { checked: 0, refreshed: 0 };

    let streams = {};
    try {
      streams = await go2rtc.listStreams(cfg.host);
    } catch (e) {
      // Relay unreachable: refreshing now would only register into the void.
      lastDecisions.set('*relay*', { action: 'skip', why: `relay unreachable: ${e.message}`, at: lastTick });
      return { checked: 0, refreshed: 0, error: `relay unreachable: ${e.message}` };
    }

    const now = Date.now();
    const due = [];
    for (const src of cfg.sources) {
      const d = decide(src, streams, now);
      lastDecisions.set(src.key, { ...d, at: lastTick });
      if (d.action === 'refresh') due.push({ key: src.key, why: d.why });
    }

    // Grab a still from every stream the relay currently HAS, before we go
    // changing anything. This is the "never dark" insurance: the moment to
    // capture a frame is while the stream is healthy, because once it dies
    // go2rtc cannot produce one.
    let snapped = 0;
    for (const src of cfg.sources) {
      const name = src.stream || store.streamName(src.key);
      if (!streams[name]) continue;
      const r = await snapshot.capture(cfg.host, name, src.key, {
        streamUrl: src.streamUrl, headers: src.headers,
      }).catch(() => ({ ok: false }));
      if (r.ok) snapped += 1;
    }
    snapshot.prune(cfg.sources.map((s) => s.key));

    // Oldest first, capped, so one broken source cannot starve the rest.
    for (const item of due.slice(0, MAX_PER_TICK)) {
      const r = await resolveSource(item.key, { relayBase, trigger: 'refresh' });
      done.push({ key: item.key, why: item.why, ok: r.ok, reason: r.reason });
      if (!r.ok) console.warn(`[web-sources] refresh ${item.key} failed: ${r.reason} — ${r.message}`);
    }

    return { checked: cfg.sources.length, refreshed: done.length, snapped, results: done, deferred: due.length - done.length };
  } finally {
    running = false;
  }
}

function start({ relayBase } = {}) {
  if (timer) return;
  timer = setInterval(() => {
    tick({ relayBase }).catch((e) => console.warn('[web-sources] refresher tick failed:', e.message));
  }, TICK_MS);
  timer.unref?.(); // never hold the process open on its own
  console.log(`[web-sources] refresher started (${Math.round(TICK_MS / 1000)}s cadence)`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function status() {
  return {
    running: Boolean(timer),
    busy: running,
    tickMs: TICK_MS,
    maxPerTick: MAX_PER_TICK,
    lastTick,
    decisions: Object.fromEntries(lastDecisions),
  };
}

module.exports = { start, stop, tick, decide, status, backoffUntil };
