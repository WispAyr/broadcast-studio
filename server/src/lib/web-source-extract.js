// ─── Web source extraction ──────────────────────────────────────────────────
// Given an arbitrary web page, find the actual video stream behind its player.
//
// Technique borrowed from castor (github.com/stupside/castor, MIT): drive a
// headless Chrome over CDP, watch every request the page makes, and run an
// escalating "action pipeline" (autoplay → video.play() → click → largest
// iframe → play-button selectors) until a manifest appears in the network log.
// Then rank the candidates and hand back a concrete URL plus the headers
// needed to replay it.
//
// WHY: go2rtc takes a URL — it cannot click a page. This is the missing link
// between "a web page with video on it" and a first-class broadcast source.
//
// 🚨 This NEVER touches DRM. Encrypted streams are detected and refused: a
// Widevine/PlayReady/FairPlay manifest is useless without the keys and going
// after those is circumvention. Off-air TV stays on the HDHomeRun (docs/TUNER.md).

const { launch, sleep, withHardDeadline } = require('./cdp');

// ─── Classification ─────────────────────────────────────────────────────────

const HLS_MIME = /(application\/(vnd\.apple\.)?(x-)?mpegurl|audio\/(x-)?mpegurl)/i;
const DASH_MIME = /application\/dash\+xml/i;
const SEGMENT_RE = /\.(ts|m4s|cmfv|cmfa|aac|vtt)(\?|$)/i;
const PROGRESSIVE_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;

// Anything that smells like a DRM licence exchange. Presence of one of these
// is a hard stop, not a warning.
const DRM_URL_RE = /(widevine|playready|fairplay|\/wv\/|\/pr\/|drmtoday|keydelivery|get[_-]?licen[sc]e|licen[sc]e[_-]?(server|url|request)|\.lic(\?|$)|\/licen[sc]e(\?|\/|$))/i;
const DRM_MANIFEST_RE = /(#EXT-X-(SESSION-)?KEY[^\n]*METHOD=(?!NONE)|<ContentProtection|cenc:pssh|urn:uuid:edef8ba9)/i;

function pathOf(url) {
  try { return new URL(url).pathname; } catch { return url.split('?')[0]; }
}

function classify(url, mimeType = '') {
  const p = pathOf(url);
  if (/\.m3u8$/i.test(p) || HLS_MIME.test(mimeType)) return 'hls';
  if (/\.mpd$/i.test(p) || DASH_MIME.test(mimeType)) return 'dash';
  if (SEGMENT_RE.test(p) || /video\/mp2t/i.test(mimeType)) return 'segment';
  if (PROGRESSIVE_RE.test(p) && !/init/i.test(p)) return 'progressive';
  return null;
}

// Headers worth replaying. Cookie/Referer/Origin are the usual gate; anything
// else (auth tokens etc.) is deliberately not carried — if a source needs it,
// that is a sign we should not be pulling it.
const REPLAY_HEADERS = ['user-agent', 'referer', 'origin', 'cookie'];

function pickHeaders(raw = {}) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const lk = k.toLowerCase();
    if (REPLAY_HEADERS.includes(lk) && v) out[lk] = v;
  }
  return out;
}

// ─── Scoring ────────────────────────────────────────────────────────────────
// Higher is better. A master playlist beats a media playlist (go2rtc/ffmpeg can
// pick the rendition), both beat DASH, all beat a progressive file. Candidates
// whose origin also served segments get a big bump: that proves playback
// actually started rather than us having scraped a stale URL out of the page.

function score(c) {
  let s = 0;
  if (c.kind === 'hls') s += c.isMaster ? 100 : 80;
  else if (c.kind === 'dash') s += 60;
  else if (c.kind === 'progressive') s += 30;
  if (c.sawSegments) s += 50;
  if (c.live) s += 20;
  if (c.status >= 200 && c.status < 300) s += 10;
  if (c.fromVideoElement) s += 15;
  // Ad/preroll manifests are short-lived and live under an ad domain. The
  // penalty must exceed the best possible honest score (hls master + segments
  // + live + 2xx + video element = 195), or a preroll that genuinely played
  // can tie real content and win on sort order.
  if (/(\/ads?\/|adserver|doubleclick|imasdk|googlesyndication|innovid|spotx)/i.test(c.url)) s -= 500;
  return s;
}

/**
 * Resolve a web page to a playable stream.
 *
 * @param {string} pageUrl
 * @param {object} opts
 * @param {number} opts.timeoutMs   overall budget (default 45s)
 * @param {number} opts.settleMs    how long to keep watching after first hit (default 4s)
 * @param {boolean} opts.headless   default true
 * @param {'off'|'reject'} opts.consent  cookie-banner handling; default 'off'
 *        (we do NOT click consent banners on the operator's behalf unless asked
 *        — we report the wall and let them decide)
 * @returns {Promise<{ok:boolean, ...}>}
 */
async function extract(pageUrl, opts = {}) {
  // `timeoutMs` below is only advisory — individual steps consult it. The hard
  // deadline is the backstop that force-closes the browser; see cdp.js.
  const softMs = opts.timeoutMs || 45000;
  return withHardDeadline((publish) => runExtraction(pageUrl, opts, publish), softMs + 15000);
}

async function runExtraction(pageUrl, opts = {}, publish = () => {}) {
  const {
    timeoutMs = 45000,
    settleMs = 4000,
    headless = true,
    consent = 'off',
    userAgent,
  } = opts;

  const started = Date.now();
  const left = () => timeoutMs - (Date.now() - started);

  const candidates = new Map();   // url -> candidate
  const requestMeta = new Map();  // requestId -> { url, headers }
  const segmentOrigins = new Set();
  const drmHits = [];
  const steps = [];
  let consentWall = false;
  let consentControlFound = false;

  const session = await launch({ headless, userAgent });
  publish(session); // hand the session to the hard-deadline wrapper immediately

  try {
    session.on('Network.requestWillBeSent', (p) => {
      const url = p.request?.url || '';
      if (!/^https?:/i.test(url)) return;
      requestMeta.set(p.requestId, { url, headers: p.request.headers || {} });
      if (DRM_URL_RE.test(url)) drmHits.push(url.slice(0, 200));
    });

    // Cookies and other browser-added headers only show up here, not in
    // requestWillBeSent — merge them in so the replay headers are complete.
    session.on('Network.requestWillBeSentExtraInfo', (p) => {
      const meta = requestMeta.get(p.requestId);
      if (meta) meta.headers = { ...meta.headers, ...(p.headers || {}) };
    });

    session.on('Network.responseReceived', (p) => {
      const url = p.response?.url || '';
      if (!/^https?:/i.test(url)) return;
      const kind = classify(url, p.response.mimeType);
      if (!kind) return;

      if (kind === 'segment') {
        try { segmentOrigins.add(new URL(url).origin + pathOf(url).replace(/[^/]*$/, '')); } catch { /* ignore */ }
        return;
      }

      const meta = requestMeta.get(p.requestId) || { headers: {} };
      if (!candidates.has(url)) {
        candidates.set(url, {
          url,
          kind,
          status: p.response.status,
          mimeType: p.response.mimeType,
          requestId: p.requestId,
          headers: pickHeaders(meta.headers),
          isMaster: false,
          live: false,
          sawSegments: false,
          fromVideoElement: false,
          at: Date.now() - started,
        });
      }
    });

    await session.send('Network.enable');
    await session.send('Page.enable');
    await session.send('Runtime.enable');

    const navUrl = normalisePlayerUrl(pageUrl);
    if (navUrl !== pageUrl) steps.push('autoplay-normalised');
    steps.push('navigate');
    await session.send('Page.navigate', { url: navUrl }, Math.min(30000, Math.max(5000, left())));
    await sleep(1500);

    // ── Consent walls. A UK council/parliament webcast almost always sits
    // behind one, and every second spent clicking a player that is covered by
    // a modal is wasted — so we check before the action pipeline. But CMPs
    // often inject late, so this is idempotent and gets a second chance once
    // the page has settled.
    let consentDone = false;
    const maybeHandleConsent = async () => {
      if (consentDone) return;
      const wall = await detectConsentWall(session);
      if (!wall) return;
      consentWall = true;
      if (consent !== 'reject') { consentDone = true; return; }
      steps.push('consent-reject');
      const clicked = await rejectConsent(session);
      consentControlFound = clicked;
      consentDone = true;
      if (!clicked) return;
      await sleep(1500);
      // Most CMPs only wire up the player on the next page load.
      await session.send('Page.navigate', { url: navUrl }, Math.min(30000, Math.max(5000, left()))).catch(() => {});
      await sleep(2500);
      consentWall = await detectConsentWall(session);
    };
    await maybeHandleConsent();

    // ── Action pipeline. Each step escalates; we stop as soon as we have a
    // manifest candidate, exactly like castor's click → iframe → click chain.
    const haveManifest = () => [...candidates.values()].some((c) => c.kind === 'hls' || c.kind === 'dash');

    const actions = [
      ['autoplay-wait', async () => { await sleep(Math.min(3000, Math.max(0, left()))); }],

      // Second bite at a late-injected CMP, now that the page has settled.
      ['consent-check', async () => { await maybeHandleConsent(); }],

      ['video.play()', async () => {
        await session.send('Runtime.evaluate', {
          expression: `(() => {
            const vs = [...document.querySelectorAll('video')];
            vs.forEach(v => { try { v.muted = true; v.play(); } catch (e) {} });
            return vs.length;
          })()`,
          returnByValue: true,
          awaitPromise: false,
        }).catch(() => {});
        await sleep(2500);
      }],

      ['click-centre', async () => {
        await clickAt(session, 640, 360);
        await sleep(2500);
      }],

      ['largest-iframe', async () => {
        const r = await session.send('Runtime.evaluate', {
          expression: `(() => {
            const f = [...document.querySelectorAll('iframe')]
              .map(el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, a: r.width*r.height }; })
              .filter(o => o.a > 10000)
              .sort((a, b) => b.a - a.a)[0];
            return f ? JSON.stringify(f) : '';
          })()`,
          returnByValue: true,
        }).catch(() => null);
        const raw = r?.result?.value;
        if (!raw) return;
        const f = JSON.parse(raw);
        await clickAt(session, Math.round(f.x), Math.round(f.y));
        await sleep(2500);
      }],

      ['play-button', async () => {
        await session.send('Runtime.evaluate', {
          expression: `(() => {
            const sel = ['button[aria-label*="lay" i]','.vjs-big-play-button','.jw-icon-playback',
                         '.plyr__control--overlaid','[class*="play-button" i]','[class*="playButton" i]',
                         '[data-testid*="play" i]','button[title*="lay" i]'];
            let n = 0;
            for (const s of sel) for (const el of document.querySelectorAll(s)) { try { el.click(); n++; } catch (e) {} }
            return n;
          })()`,
          returnByValue: true,
        }).catch(() => {});
        await sleep(2500);
      }],
    ];

    for (const [name, run] of actions) {
      if (haveManifest() || left() < settleMs + 1000) break;
      steps.push(name);
      await run();
    }

    // Let late segment traffic land so sawSegments is meaningful.
    await sleep(Math.min(settleMs, Math.max(0, left())));

    // ── Enrich candidates: master vs media, live vs VOD, DRM in the manifest.
    for (const c of candidates.values()) {
      if (c.kind !== 'hls' && c.kind !== 'dash') continue;
      let body = '';
      try {
        const r = await session.send('Network.getResponseBody', { requestId: c.requestId }, 5000);
        body = r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body;
      } catch { /* body may be evicted — fall back to URL-only heuristics */ }
      if (body) {
        c.isMaster = /#EXT-X-STREAM-INF/i.test(body) || /<AdaptationSet/i.test(body);
        c.live = c.kind === 'hls'
          ? (!/#EXT-X-ENDLIST/i.test(body) && /#EXTINF/i.test(body))
          : /type\s*=\s*"dynamic"/i.test(body);
        if (DRM_MANIFEST_RE.test(body)) c.drm = true;
      }
      const base = c.url.replace(/[^/]*$/, '');
      c.sawSegments = [...segmentOrigins].some((o) => o.startsWith(base) || base.startsWith(o));
    }

    // What the <video> element itself ended up on — a direct hit when the page
    // is not using MSE (a blob: URL means it is, and the network log wins).
    try {
      const r = await session.send('Runtime.evaluate', {
        expression: `(() => {
          const v = [...document.querySelectorAll('video')].find(v => v.currentSrc || v.src);
          return v ? (v.currentSrc || v.src) : '';
        })()`,
        returnByValue: true,
      });
      const vs = r?.result?.value || '';
      if (vs && !vs.startsWith('blob:')) {
        if (candidates.has(vs)) candidates.get(vs).fromVideoElement = true;
        else {
          const kind = classify(vs);
          if (kind && kind !== 'segment') {
            candidates.set(vs, {
              url: vs, kind, status: 200, mimeType: '', headers: {},
              isMaster: false, live: false, sawSegments: false, fromVideoElement: true,
              at: Date.now() - started,
            });
          }
        }
      }
    } catch { /* ignore */ }

    const pageTitle = await session.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })
      .then((r) => r?.result?.value || '').catch(() => '');

    // ── DRM gate. Refuse before we hand anything back.
    const drmCandidates = [...candidates.values()].filter((c) => c.drm);
    if (drmHits.length || drmCandidates.length) {
      return {
        ok: false,
        reason: 'drm',
        message: 'Stream is DRM-protected — refused. Off-air TV belongs on the HDHomeRun (docs/TUNER.md).',
        drmEvidence: [...new Set(drmHits)].slice(0, 5).concat(drmCandidates.map((c) => `manifest:${c.url.slice(0, 120)}`)),
        pageUrl, navigatedUrl: navUrl, pageTitle, steps, elapsedMs: Date.now() - started,
      };
    }

    const ranked = [...candidates.values()]
      .map((c) => ({ ...c, score: score(c) }))
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) {
      // Most "no stream" pages do not host the player themselves — the video
      // lives in a third-party embed (ipcamlive, YouTube, Twitch, a council
      // webcast provider). Hand those back: pointing the extractor straight at
      // the embed URL is usually the answer, and an operator cannot guess it.
      const embeds = await findEmbeds(session);

      // A consent wall we could not find a decline control for is a WEAK
      // signal — the page merely mentions cookies. Do not send the operator
      // chasing a banner that is not blocking anything.
      const blockedByConsent = consentWall && (consent === 'off' || consentControlFound);

      return {
        ok: false,
        reason: blockedByConsent ? 'consent-wall' : 'no-stream-found',
        message: blockedByConsent
          ? (consent === 'off'
            ? 'A cookie/consent wall blocked playback. Re-run with consent="reject", or resolve it manually.'
            : 'Declined the consent banner but playback stayed blocked — third-party embeds often stay blocked by design when you decline.')
          : embeds.length
            ? 'No manifest appeared on this page, but it embeds a third-party player. Try extracting the embed URL directly.'
            : 'No manifest or media file appeared. The page may need a login, a real click, or may not carry video.',
        embeds,
        pageUrl, navigatedUrl: navUrl, pageTitle, steps, consentWall, elapsedMs: Date.now() - started,
      };
    }

    const best = ranked[0];
    return {
      ok: true,
      pageUrl,
      navigatedUrl: navUrl,
      pageTitle,
      stream: {
        url: best.url,
        kind: best.kind,
        isMaster: best.isMaster,
        live: best.live,
        headers: best.headers,
      },
      confidence: best.sawSegments ? 'high' : (best.kind === 'hls' || best.kind === 'dash') ? 'medium' : 'low',
      alternatives: ranked.slice(1, 6).map((c) => ({ url: c.url, kind: c.kind, score: c.score, live: c.live })),
      steps,
      consentWall,
      elapsedMs: Date.now() - started,
    };
  } finally {
    await session.close();
  }
}

// Embed URLs scraped off a host page routinely carry `autoplay=0`, because the
// host page wants a poster frame until the visitor clicks. Navigated to
// directly that leaves the player parked forever, and no manifest is ever
// requested — the commonest reason a KNOWN-GOOD embed extracts as
// "no-stream-found". Flip it, and force mute, because a browser will not
// autoplay unmuted anyway.
//
// Only ever relaxes playback of a page the operator already asked for; it never
// changes which page is fetched.
const AUTOPLAY_OFF = /^(0|false|no|off)$/i;

function normalisePlayerUrl(raw) {
  try {
    const u = new URL(raw);
    let changed = false;
    for (const param of ['autoplay', 'auto_play', 'autostart']) {
      const v = u.searchParams.get(param);
      if (v !== null && AUTOPLAY_OFF.test(v)) { u.searchParams.set(param, '1'); changed = true; }
    }
    if (changed && !u.searchParams.has('mute') && !u.searchParams.has('muted')) {
      u.searchParams.set('mute', '1');
    }
    return changed ? u.toString() : raw;
  } catch {
    return raw;
  }
}

// Third-party players embedded on the page, largest first. When extraction
// fails these are the lead: re-running against the embed URL (with autoplay=1)
// very often succeeds where the wrapper page does not.
async function findEmbeds(session) {
  const r = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const out = [...document.querySelectorAll('iframe')]
        .map(el => { const b = el.getBoundingClientRect(); return { url: el.src || '', area: Math.round(b.width * b.height) }; })
        .filter(o => o.url && /^https?:/.test(o.url))
        .sort((a, b) => b.area - a.area)
        .slice(0, 8);
      return JSON.stringify(out);
    })()`,
    returnByValue: true,
  }).catch(() => null);
  try { return JSON.parse(r?.result?.value || '[]'); } catch { return []; }
}

// Is a cookie/consent modal sitting between us and the player?
async function detectConsentWall(session) {
  const r = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const t = document.body ? document.body.innerText.slice(0, 4000) : '';
      const hit = /(accept all|accept cookies|do not accept|manage (your )?(cookie|consent)|we use cookies|cookie policy|privacy preferences)/i.test(t);
      const frames = [...document.querySelectorAll('iframe')].some(f => /(consent|cmp|sourcepoint|onetrust|quantcast|didomi|cookiebot)/i.test(f.src || ''));
      return hit || frames;
    })()`,
    returnByValue: true,
  }).catch(() => null);
  return !!r?.result?.value;
}

// Press the DECLINE control — never "accept all".
//
// Privacy stance, deliberate: we take the most privacy-preserving option the
// banner offers and nothing else. The accept-all guard is belt-and-braces so a
// loosely-worded decline pattern can never land on an accept button.
async function rejectConsent(session) {
  const r = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const decline = /(do not accept|don'?t accept|reject all|reject|decline|necessary only|only necessary|essential only|strictly necessary|continue without|no thanks|refuse)/i;
      const acceptAll = /(accept all|allow all|agree to all|accept recommended|^\\s*i accept\\b|^\\s*accept\\b|^\\s*allow\\b|^\\s*agree\\b|^\\s*ok\\b)/i;
      let n = 0;
      for (const el of document.querySelectorAll('button,a,input[type=button],input[type=submit],[role="button"]')) {
        const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
        if (!txt || txt.length > 60) continue;
        if (!decline.test(txt)) continue;
        if (acceptAll.test(txt) && !/do not|don'?t/i.test(txt)) continue;
        try { el.click(); n++; } catch (e) {}
      }
      return n;
    })()`,
    returnByValue: true,
  }).catch(() => null);
  return Number(r?.result?.value || 0) > 0;
}

async function clickAt(session, x, y) {
  const base = { x, y, button: 'left', clickCount: 1, buttons: 1 };
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base }).catch(() => {});
  await sleep(60);
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base }).catch(() => {});
}

module.exports = {
  extract, classify, score, DRM_URL_RE, DRM_MANIFEST_RE, pickHeaders, normalisePlayerUrl,
  // shared with the data extractor — one definition of "is a banner in the way"
  detectConsentWall, rejectConsent,
};
