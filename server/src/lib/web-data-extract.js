// ─── Web DATA extraction ────────────────────────────────────────────────────
// The same rig as web-source-extract.js, pointed at a different question.
//
//   video:  "what manifest is this player pulling?"
//   data:   "what does this page's own JavaScript fetch?"
//
// A site with no public API usually still HAS an API — its own front end is
// calling one. Driving the page in a real browser and watching the network log
// finds it, along with the headers needed to call it directly.
//
// 🚨 THE BROWSER IS A DISCOVERY TOOL, NOT A POLLING TOOL.
// Running Chrome every poll is untenable: ~6s and a whole browser per fetch,
// times hundreds of sources. The point of this is to discover an endpoint ONCE
// and then poll it with an ordinary HTTP client forever — the same
// resolve-then-pin shape as web sources. `replayable` in the result is the
// field that tells a caller whether it can do that.

const { launch, sleep, withHardDeadline } = require('./cdp');
const { detectConsentWall, rejectConsent } = require('./web-source-extract');

// Response types worth capturing. Media and assets are noise here.
const DATA_MIME = /(application\/(json|.*\+json|xml|.*\+xml|x-ndjson|geo\+json)|text\/(json|xml|csv|plain))/i;

// Obvious telemetry/ads, which every page is full of and none of it is the data.
const NOISE_RE = /(google-analytics|googletagmanager|doubleclick|facebook\.|hotjar|segment\.io|sentry\.io|chartbeat|omtrdc|scorecardresearch|quantserve|newrelic|clarity\.ms|cdn-cgi)/i;

// Headers a caller could legitimately replay.
const REPLAY_HEADERS = ['user-agent', 'referer', 'origin', 'accept', 'accept-language', 'cookie'];

// 🚨 Headers we deliberately DO NOT return the values of. A bearer token
// scraped off someone's page and written into a source config is a credential
// decision for a human to make, not something to hand over silently. We report
// that one is REQUIRED, and name it, so the operator can decide.
const SECRET_HEADERS = ['authorization', 'x-api-key', 'api-key', 'x-auth-token', 'x-access-token', 'proxy-authorization'];

function pickHeaders(raw = {}) {
  const out = {};
  const secrets = [];
  for (const [k, v] of Object.entries(raw)) {
    const lk = k.toLowerCase();
    if (SECRET_HEADERS.includes(lk)) { secrets.push(lk); continue; }
    if (REPLAY_HEADERS.includes(lk) && v) out[lk] = v;
  }
  return { headers: out, secrets };
}

function scoreCapture(c) {
  let s = 0;
  if (/json/i.test(c.contentType)) s += 50;
  else if (/xml|csv/i.test(c.contentType)) s += 30;
  // Bigger payloads are usually the content; tiny ones are pings and configs.
  s += Math.min(40, Math.round((c.bytes || 0) / 2048));
  if (c.status >= 200 && c.status < 300) s += 10;
  if (c.method === 'GET') s += 15; // replayable without a body
  if (c.secrets?.length) s -= 25;  // usable, but needs a credential decision
  return s;
}

/**
 * Discover the data endpoints a page calls.
 *
 * @param {string} pageUrl
 * @param {object} opts
 * @param {string} [opts.match]       regex (as a string) filtering request URLs;
 *                                    omit to capture every data-ish response
 * @param {'off'|'reject'} [opts.consent]
 * @param {number} [opts.timeoutMs]   default 45s
 * @param {number} [opts.settleMs]    keep listening this long after load (default 6s)
 * @param {number} [opts.maxCaptures] default 25
 * @param {number} [opts.maxBodyBytes] per-body cap returned (default 256KB)
 */
async function extractData(pageUrl, opts = {}) {
  const softMs = opts.timeoutMs || 45000;
  return withHardDeadline((publish) => run(pageUrl, opts, publish), softMs + 15000);
}

async function run(pageUrl, opts, publish) {
  const {
    match,
    consent = 'off',
    timeoutMs = 45000,
    settleMs = 6000,
    maxCaptures = 25,
    maxBodyBytes = 256 * 1024,
    userAgent,
  } = opts;

  let matcher = null;
  if (match) {
    try { matcher = new RegExp(match, 'i'); } catch (e) {
      return { ok: false, reason: 'bad-match', message: `match is not a valid regex: ${e.message}`, pageUrl };
    }
  }

  const started = Date.now();
  const left = () => timeoutMs - (Date.now() - started);
  const steps = [];
  const requestMeta = new Map(); // requestId -> { method, headers }
  const seen = new Map();        // url -> capture
  let consentWall = false;

  const session = await launch({ headless: true, userAgent });
  publish(session);

  try {
    session.on('Network.requestWillBeSent', (p) => {
      requestMeta.set(p.requestId, {
        method: p.request?.method || 'GET',
        headers: p.request?.headers || {},
        postData: typeof p.request?.postData === 'string' ? p.request.postData.slice(0, 8192) : null,
      });
    });
    session.on('Network.requestWillBeSentExtraInfo', (p) => {
      const meta = requestMeta.get(p.requestId);
      if (meta) meta.headers = { ...meta.headers, ...(p.headers || {}) };
    });

    session.on('Network.responseReceived', (p) => {
      const url = p.response?.url || '';
      if (!/^https?:/i.test(url)) return;
      if (NOISE_RE.test(url)) return;
      const contentType = p.response.mimeType || '';
      if (!DATA_MIME.test(contentType)) return;
      if (matcher && !matcher.test(url)) return;
      if (seen.has(url)) return;

      const meta = requestMeta.get(p.requestId) || { method: 'GET', headers: {} };
      const { headers, secrets } = pickHeaders(meta.headers);
      // Content-Type is a REQUEST header here, needed to replay a POST body.
      const reqType = Object.entries(meta.headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
      seen.set(url, {
        requestContentType: reqType || null,
        url,
        method: meta.method,
        status: p.response.status,
        contentType,
        requestId: p.requestId,
        headers,
        secrets,
        postData: meta.postData,
        bytes: 0,
      });
    });

    await session.send('Network.enable');
    await session.send('Page.enable');
    await session.send('Runtime.enable');

    steps.push('navigate');
    await session.send('Page.navigate', { url: pageUrl }, Math.min(30000, Math.max(5000, left())));
    await sleep(1500);

    // A consent wall blocks the page's own XHRs just as thoroughly as it blocks
    // a video player.
    consentWall = await detectConsentWall(session);
    if (consentWall && consent === 'reject') {
      steps.push('consent-reject');
      if (await rejectConsent(session)) {
        await sleep(1000);
        await session.send('Page.navigate', { url: pageUrl }, Math.min(30000, Math.max(5000, left()))).catch(() => {});
        await sleep(2000);
        consentWall = await detectConsentWall(session);
      }
    }

    // Many dashboards only fetch once something scrolls into view.
    steps.push('scroll');
    await session.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight / 2)',
    }).catch(() => {});

    steps.push('settle');
    await sleep(Math.min(settleMs, Math.max(0, left())));

    // Pull bodies for what we caught.
    const captures = [...seen.values()];
    for (const c of captures) {
      try {
        const r = await session.send('Network.getResponseBody', { requestId: c.requestId }, 5000);
        const body = r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body;
        c.bytes = Buffer.byteLength(body || '');
        c.truncated = c.bytes > maxBodyBytes;
        c.body = c.truncated ? body.slice(0, maxBodyBytes) : body;
        if (/json/i.test(c.contentType)) {
          try { c.jsonKeys = Object.keys(JSON.parse(body)).slice(0, 40); } catch { /* array or partial */ }
        }
      } catch {
        c.bodyUnavailable = true; // evicted from the buffer; URL is still useful
      }
      delete c.requestId;
    }

    const pageTitle = await session.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })
      .then((r) => r?.result?.value || '').catch(() => '');

    const ranked = captures
      .map((c) => ({ ...c, score: scoreCapture(c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCaptures);

    if (!ranked.length) {
      return {
        ok: false,
        reason: consentWall ? 'consent-wall' : 'no-data-found',
        message: consentWall
          ? 'A cookie/consent wall blocked the page, so its own data calls never fired.'
          : matcher
            ? 'No data response matched. Try without `match` first to see everything the page fetches.'
            : 'The page made no JSON/XML/CSV requests — it may be server-rendered, in which case scrape the HTML instead.',
        pageUrl, pageTitle, steps, consentWall, elapsedMs: Date.now() - started,
      };
    }

    const best = ranked[0];
    return {
      ok: true,
      pageUrl,
      pageTitle,
      best: pollSpec(best),
      captures: ranked,
      consentWall,
      steps,
      elapsedMs: Date.now() - started,
    };
  } finally {
    await session.close();
  }
}

/**
 * Everything a non-browser client needs to fetch this endpoint again. This is
 * the actual deliverable — hand it to siphon and the browser is never needed
 * for this source again.
 */
function pollSpec(c) {
  return {
    url: c.url,
    method: c.method,
    headers: c.headers,
    body: c.method === 'GET' ? null : c.postData,
    requestContentType: c.requestContentType || null,
    contentType: c.contentType,
    bytes: c.bytes,
    requiresSecretHeaders: c.secrets || [],
  };
}

// A GraphQL mutation (or anything that names itself one) changes state at the
// far end. We discover endpoints; we do not fire other people's write calls to
// see what happens.
const MUTATION_RE = /(^|[\s{"'])mutation[\s({"']/i;

/**
 * Can this endpoint be polled WITHOUT a browser? That is the whole question —
 * if yes, siphon treats it as an ordinary HTTP source from here on and the
 * browser is never needed again.
 */
async function probeReplay(spec) {
  const { url, method = 'GET', headers = {}, body = null, requestContentType = null } = spec || {};

  if (method !== 'GET' && !body) {
    return { replayable: false, why: `${method} with no captured body — nothing to replay` };
  }
  if (method !== 'GET' && MUTATION_RE.test(body)) {
    return { replayable: false, why: 'body looks like a GraphQL mutation — refusing to replay a write call' };
  }
  if (!['GET', 'POST'].includes(method)) {
    return { replayable: false, why: `${method} is not a safe method to replay on a poll` };
  }

  const attempt = async (hdrs) => {
    try {
      const res = await fetch(url, {
        method,
        headers: method === 'POST' && requestContentType ? { 'content-type': requestContentType, ...hdrs } : hdrs,
        body: method === 'POST' ? body : undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return false;
      // A 200 that is not the data (a login page, an empty shell) is a false
      // positive, and a source that silently polls an empty body is worse than
      // one that fails loudly.
      const text = await res.text();
      return text.length > 16;
    } catch { return false; }
  };

  if (await attempt({})) return { replayable: true, needsHeaders: false, method };

  const subset = {};
  for (const [k, v] of Object.entries(headers)) {
    if (['referer', 'origin', 'user-agent', 'accept'].includes(k)) subset[k] = v;
  }
  if (Object.keys(subset).length && await attempt(subset)) {
    return { replayable: true, needsHeaders: true, headers: subset, method };
  }
  return { replayable: false, why: 'will not fetch outside the browser session — likely cookie- or IP-bound' };
}

module.exports = { extractData, probeReplay, scoreCapture, pickHeaders, pollSpec, MUTATION_RE, DATA_MIME };
