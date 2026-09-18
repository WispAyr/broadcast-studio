/**
 * Web source extraction — pure logic.
 *
 * These import the REAL modules (unlike ssrf.test.js, which re-implements the
 * function it tests and so cannot catch a regression in the shipped code).
 * Nothing here launches Chrome or touches the network.
 */

const { classify, score, DRM_URL_RE, DRM_MANIFEST_RE, pickHeaders } = require('../src/lib/web-source-extract');
const { isPrivateUrl, isPrivateHost } = require('../src/lib/net-guard');
const { buildSource, assertSafeSource } = require('../src/lib/go2rtc');

describe('classify', () => {
  test('recognises HLS by extension and by mime', () => {
    expect(classify('https://x.com/live.m3u8?a=tok')).toBe('hls');
    expect(classify('https://x.com/stream', 'application/vnd.apple.mpegurl')).toBe('hls');
    expect(classify('https://x.com/stream', 'application/x-mpegURL')).toBe('hls');
  });

  test('recognises DASH', () => {
    expect(classify('https://x.com/Manifest_1080p.mpd')).toBe('dash');
    expect(classify('https://x.com/m', 'application/dash+xml')).toBe('dash');
  });

  test('treats media segments as evidence, not answers', () => {
    expect(classify('https://cdn/0227livic-178966.ts')).toBe('segment');
    expect(classify('https://cdn/chunk-5.m4s')).toBe('segment');
    expect(classify('https://cdn/x', 'video/mp2t')).toBe('segment');
  });

  test('recognises progressive files but not init segments', () => {
    expect(classify('https://x.com/clip.mp4')).toBe('progressive');
    expect(classify('https://x.com/init.mp4')).toBeNull();
  });

  test('ignores everything else', () => {
    expect(classify('https://x.com/app.js', 'text/javascript')).toBeNull();
  });
});

describe('score ranking', () => {
  const base = { status: 200, sawSegments: false, live: false, isMaster: false, fromVideoElement: false };

  test('master playlist outranks media playlist outranks dash outranks mp4', () => {
    const master = score({ ...base, kind: 'hls', isMaster: true, url: 'https://a/m.m3u8' });
    const media = score({ ...base, kind: 'hls', url: 'https://a/m.m3u8' });
    const dash = score({ ...base, kind: 'dash', url: 'https://a/m.mpd' });
    const mp4 = score({ ...base, kind: 'progressive', url: 'https://a/v.mp4' });
    expect(master).toBeGreaterThan(media);
    expect(media).toBeGreaterThan(dash);
    expect(dash).toBeGreaterThan(mp4);
  });

  test('observed segment traffic beats a bare manifest — it proves playback started', () => {
    const played = score({ ...base, kind: 'hls', sawSegments: true, url: 'https://a/m.m3u8' });
    const guessed = score({ ...base, kind: 'hls', isMaster: true, url: 'https://a/m.m3u8' });
    expect(played).toBeGreaterThan(guessed);
  });

  test('ad manifests are pushed below everything real', () => {
    const ad = score({ ...base, kind: 'hls', isMaster: true, sawSegments: true, url: 'https://pubads.doubleclick.net/ondemand/hls/x.m3u8' });
    const real = score({ ...base, kind: 'progressive', url: 'https://a/v.mp4' });
    expect(ad).toBeLessThan(real);
  });
});

describe('DRM detection', () => {
  test.each([
    'https://drm-widevine-licensing.axtest.net/AcquireLicense',
    'https://lic.drmtoday.com/license-proxy-widevine/cenc/',
    'https://example.com/playready/rightsmanager.asmx',
    'https://example.com/api/getLicense?id=4',
    'https://example.com/wv/keys',
    'https://example.com/fairplay/ckc',
  ])('flags licence endpoint %s', (url) => {
    expect(DRM_URL_RE.test(url)).toBe(true);
  });

  test.each([
    'https://cdn.example.com/live.m3u8?a=tok',
    'https://media.example.com/Manifest_1080p.mpd',
    'https://cdn.example.com/seg-1.ts',
    // "licensed" content in a path must not trip the gate
    'https://example.com/licensed-images/photo.jpg',
  ])('does not flag ordinary URL %s', (url) => {
    expect(DRM_URL_RE.test(url)).toBe(false);
  });

  test('flags encrypted HLS and protected DASH manifests', () => {
    expect(DRM_MANIFEST_RE.test('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x"\n')).toBe(true);
    expect(DRM_MANIFEST_RE.test('<ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/>')).toBe(true);
    expect(DRM_MANIFEST_RE.test('<cenc:pssh>AAAA</cenc:pssh>')).toBe(true);
  });

  test('METHOD=NONE is not DRM', () => {
    expect(DRM_MANIFEST_RE.test('#EXT-X-KEY:METHOD=NONE\n')).toBe(false);
  });

  test('a clean live playlist is not DRM', () => {
    expect(DRM_MANIFEST_RE.test('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:3.0,\nseg.ts\n')).toBe(false);
  });
});

describe('pickHeaders', () => {
  test('keeps only replayable headers and drops the rest', () => {
    const h = pickHeaders({
      Referer: 'https://site/', Origin: 'https://site', 'User-Agent': 'UA',
      Cookie: 'a=1', Authorization: 'Bearer secret', 'X-Api-Key': 'nope',
    });
    expect(h).toEqual({ referer: 'https://site/', origin: 'https://site', 'user-agent': 'UA', cookie: 'a=1' });
    expect(h.authorization).toBeUndefined();
    expect(h['x-api-key']).toBeUndefined();
  });
});

describe('net-guard', () => {
  test.each([
    'http://10.200.0.10/admin',      // the WireGuard mesh
    'http://10.0.0.24/',             // NAR studio LAN
    'http://192.168.1.1/',
    'http://172.16.4.5/',
    'http://127.0.0.1:1984/api',
    'http://localhost:3945/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/',
    'http://100.64.3.2/',            // CGNAT
    'http://box.local/',
    'file:///etc/passwd',
    'not a url',
  ])('blocks %s', (u) => {
    expect(isPrivateUrl(u)).toBe(true);
  });

  test.each([
    'https://www.skylinewebcams.com/en/webcam/x.html',
    'https://broadcast.studio.wispayr.online/',
    'http://11.0.0.1/',              // 11/8 is public
    'https://8.8.8.8/',
  ])('allows %s', (u) => {
    expect(isPrivateUrl(u)).toBe(false);
  });

  test('IPv6 unique-local and link-local are blocked', () => {
    expect(isPrivateHost('fd00::1')).toBe(true);
    expect(isPrivateHost('fe80::1')).toBe(true);
  });
});

describe('go2rtc source building', () => {
  test('builds a copy-codec ffmpeg source', () => {
    expect(buildSource('https://cdn/live.m3u8?a=tok'))
      .toBe('ffmpeg:https://cdn/live.m3u8?a=tok#video=copy#audio=copy');
  });

  test('rejects sources with spaces — go2rtc refuses them as insecure', () => {
    // This is why header replay needs a relay rather than an ffmpeg -headers arg.
    expect(() => assertSafeSource('ffmpeg:https://cdn/live.m3u8#input=-headers Referer: x'))
      .toThrow(/spaces/);
  });
});

// ─── Refresher policy ───────────────────────────────────────────────────────
// The heart of the background refresher: when is it safe to re-register a
// stream, given that doing so forces go2rtc to reconnect and glitches anyone
// watching? Pure function, so no relay or browser is needed.

const { decide, backoffUntil } = require('../src/lib/web-source-refresher');
const { STALE_MS } = require('../src/lib/web-source-store');

const NOW = Date.UTC(2026, 8, 17, 12, 0, 0);
const agoMs = (ms) => new Date(NOW - ms).toISOString();
const src = (over = {}) => ({
  key: 'cam', stream: 'web-cam', status: 'ok',
  resolvedAt: agoMs(1000), consecutiveFailures: 0, ...over,
});
const idle = { 'web-cam': { producers: [], consumers: null } };
const watched = { 'web-cam': { producers: [], consumers: [{ id: 1 }] } };
const empty = {};

describe('refresher decide()', () => {
  test('leaves a fresh source alone', () => {
    expect(decide(src(), idle, NOW)).toMatchObject({ action: 'skip', why: 'still fresh' });
  });

  test('refreshes a source that has never resolved', () => {
    expect(decide(src({ status: 'never', resolvedAt: null }), idle, NOW).action).toBe('refresh');
  });

  test('refreshes one that drifted out of the relay (relay restarted)', () => {
    const d = decide(src(), empty, NOW);
    expect(d.action).toBe('refresh');
    expect(d.why).toMatch(/missing from relay/);
  });

  test('refreshes eagerly once past 80% of the window WHILE IDLE', () => {
    const d = decide(src({ resolvedAt: agoMs(STALE_MS * 0.9) }), idle, NOW);
    expect(d.action).toBe('refresh');
  });

  test('DEFERS a stale source while a viewer is watching — refreshing glitches it', () => {
    const d = decide(src({ resolvedAt: agoMs(STALE_MS * 0.9) }), watched, NOW);
    expect(d.action).toBe('defer');
    expect(d.why).toMatch(/in use/);
  });

  test('but does not defer forever — past 2x the window it accepts the glitch', () => {
    const d = decide(src({ resolvedAt: agoMs(STALE_MS * 2.5) }), watched, NOW);
    expect(d.action).toBe('refresh');
    expect(d.why).toMatch(/far past expiry/);
  });

  test('honours autoRefresh: false', () => {
    expect(decide(src({ autoRefresh: false, status: 'failed' }), empty, NOW).action).toBe('skip');
  });

  test('backs off after repeated failures instead of hammering', () => {
    const failing = src({ status: 'failed', consecutiveFailures: 3, lastAttemptAt: agoMs(1000) });
    expect(decide(failing, empty, NOW).action).toBe('skip');
    // ...but retries once the backoff has elapsed
    const cooled = src({ status: 'failed', consecutiveFailures: 3, lastAttemptAt: agoMs(60 * 60 * 1000) });
    expect(decide(cooled, empty, NOW).action).toBe('refresh');
  });

  test('backoff grows with consecutive failures and is capped', () => {
    const at = agoMs(0);
    const w = (n) => backoffUntil({ consecutiveFailures: n, lastAttemptAt: at }) - NOW;
    expect(w(1)).toBe(60_000);
    expect(w(2)).toBe(120_000);
    expect(w(3)).toBe(240_000);
    expect(w(99)).toBe(30 * 60_000); // capped
  });
});

// ─── Relay ──────────────────────────────────────────────────────────────────

const { buildHeaderArg, tokenMatches, newToken } = require('../src/lib/web-source-relay');

describe('relay header building', () => {
  test('emits canonical CRLF-delimited headers', () => {
    expect(buildHeaderArg({ referer: 'https://site/', origin: 'https://site' }))
      .toBe('Referer: https://site/\r\nOrigin: https://site\r\n');
  });

  test('STRIPS CRLF out of values — a scraped header must not inject more headers', () => {
    const evil = { referer: 'https://site/\r\nX-Admin: 1\r\nHost: internal' };
    const out = buildHeaderArg(evil);
    expect(out).toBe('Referer: https://site/X-Admin: 1Host: internal\r\n');
    expect(out.split('\r\n').filter(Boolean)).toHaveLength(1); // exactly one header
  });

  test('ignores headers outside the replay allowlist', () => {
    expect(buildHeaderArg({ authorization: 'Bearer x', 'x-api-key': 'k' })).toBe('');
  });

  test('drops empty values rather than sending a blank header', () => {
    expect(buildHeaderArg({ referer: '   ', origin: 'https://site' })).toBe('Origin: https://site\r\n');
  });
});

describe('relay token', () => {
  test('matches itself and rejects everything else', () => {
    const t = newToken();
    expect(tokenMatches(t, t)).toBe(true);
    expect(tokenMatches(t, `${t}x`)).toBe(false);
    expect(tokenMatches(t, '')).toBe(false);
    expect(tokenMatches(t, undefined)).toBe(false);
    expect(tokenMatches(undefined, t)).toBe(false);
  });

  test('tokens are long and unguessable', () => {
    expect(newToken().length).toBeGreaterThanOrEqual(32);
    expect(newToken()).not.toBe(newToken());
  });
});

// ─── Player URL normalisation ───────────────────────────────────────────────
// Embed URLs scraped off a host page carry autoplay=0, because the host wants a
// poster frame until someone clicks. Navigated to directly that parks the
// player forever and no manifest is ever requested — this was a real failure on
// the Troon Yacht Haven cams, whose embeds are exactly that.

const { normalisePlayerUrl } = require('../src/lib/web-source-extract');

describe('normalisePlayerUrl', () => {
  test('flips autoplay=0 and forces mute (browsers block unmuted autoplay)', () => {
    const out = new URL(normalisePlayerUrl('https://g0.ipcamlive.com/player/player.php?alias=x&autoplay=0'));
    expect(out.searchParams.get('autoplay')).toBe('1');
    expect(out.searchParams.get('mute')).toBe('1');
  });

  test.each(['false', 'no', 'off', '0'])('treats autoplay=%s as off', (v) => {
    expect(new URL(normalisePlayerUrl(`https://h/p?autoplay=${v}`)).searchParams.get('autoplay')).toBe('1');
  });

  test('handles the autostart / auto_play spellings too', () => {
    expect(new URL(normalisePlayerUrl('https://h/p?autostart=false')).searchParams.get('autostart')).toBe('1');
    expect(new URL(normalisePlayerUrl('https://h/p?auto_play=0')).searchParams.get('auto_play')).toBe('1');
  });

  test('leaves a URL alone when autoplay is already on or absent', () => {
    const on = 'https://h/p?alias=x&autoplay=1&mute=1';
    expect(normalisePlayerUrl(on)).toBe(on);
    const none = 'https://h/p?alias=x';
    expect(normalisePlayerUrl(none)).toBe(none);
  });

  test('does not clobber an explicit mute choice', () => {
    const out = new URL(normalisePlayerUrl('https://h/p?autoplay=0&mute=0'));
    expect(out.searchParams.get('mute')).toBe('0');
  });

  test('NEVER changes which page is fetched', () => {
    const out = new URL(normalisePlayerUrl('https://g0.ipcamlive.com/player/player.php?alias=tyhmarina2&autoplay=0'));
    expect(out.origin).toBe('https://g0.ipcamlive.com');
    expect(out.pathname).toBe('/player/player.php');
    expect(out.searchParams.get('alias')).toBe('tyhmarina2');
  });

  test('passes a malformed URL through untouched rather than throwing', () => {
    expect(normalisePlayerUrl('not a url')).toBe('not a url');
  });
});

// ─── Snapshot cache ("never dark") ──────────────────────────────────────────

const snapshot = require('../src/lib/web-source-snapshot');

describe('snapshot cache', () => {
  test('refuses keys that could escape the snapshot directory', () => {
    // The key reaches this from a URL path segment, so traversal is the risk.
    for (const bad of ['../../etc/passwd', 'a/b', './x', '..', '', 'UPPER', 'x'.repeat(50)]) {
      expect(snapshot.read(bad)).toBeNull();
      expect(snapshot.remove(bad)).toBe(false);
      expect(snapshot.status(bad)).toEqual({ has: false });
    }
  });

  test('reports nothing held for an unknown source', () => {
    expect(snapshot.status('definitely-not-a-real-source')).toEqual({ has: false });
  });

  describe('capture', () => {
    const realFetch = global.fetch;
    afterEach(() => { global.fetch = realFetch; snapshot.remove('jest-snap'); });

    const respond = (bytes, ok = true, status = 200) => {
      global.fetch = jest.fn(async () => ({
        ok, status,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      }));
    };

    // JPEG magic bytes, padded past the 1KB floor.
    const jpeg = (n = 2048) => { const b = Buffer.alloc(n, 0x20); b[0] = 0xff; b[1] = 0xd8; return b; };

    test('stores a real JPEG and reports its age', async () => {
      respond(jpeg());
      const r = await snapshot.capture('http://relay', 'web-x', 'jest-snap');
      expect(r.ok).toBe(true);
      const held = snapshot.read('jest-snap');
      expect(held).not.toBeNull();
      expect(held.ageMs).toBeLessThan(5000);
    });

    test('REJECTS a non-JPEG — caching go2rtc’s error page would poison the fallback', async () => {
      respond(Buffer.from('<html>error</html>'.padEnd(2048, ' ')));
      const r = await snapshot.capture('http://relay', 'web-x', 'jest-snap');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/not a JPEG/);
      expect(snapshot.read('jest-snap')).toBeNull();
    });

    test('rejects a suspiciously tiny frame', async () => {
      respond(Buffer.from([0xff, 0xd8, 0x00]));
      expect((await snapshot.capture('http://relay', 'web-x', 'jest-snap')).ok).toBe(false);
    });

    test('a dead stream is a normal outcome, not an exception', async () => {
      respond(Buffer.alloc(2048), false, 503);
      const r = await snapshot.capture('http://relay', 'web-x', 'jest-snap');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/503/);
    });

    test('a network failure never escalates', async () => {
      global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
      await expect(snapshot.capture('http://relay', 'web-x', 'jest-snap')).resolves.toMatchObject({ ok: false });
    });
  });
});

// ─── Data extraction (siphon-facing) ────────────────────────────────────────
// "What does this page's own JavaScript fetch?" — for sources with no public
// API. The browser is a DISCOVERY tool; the output is a poll spec a plain HTTP
// client can use forever after.

const wd = require('../src/lib/web-data-extract');

describe('data capture header handling', () => {
  test('keeps replayable headers', () => {
    const { headers } = wd.pickHeaders({ Referer: 'https://s/', Accept: 'application/json', 'Accept-Language': 'en-GB' });
    expect(headers).toEqual({ referer: 'https://s/', accept: 'application/json', 'accept-language': 'en-GB' });
  });

  test('🚨 NEVER returns credential values — only names them', () => {
    const { headers, secrets } = wd.pickHeaders({
      Authorization: 'Bearer super-secret', 'X-Api-Key': 'k-12345', Referer: 'https://s/',
    });
    expect(JSON.stringify(headers)).not.toMatch(/super-secret|k-12345/);
    expect(headers.authorization).toBeUndefined();
    expect(secrets.sort()).toEqual(['authorization', 'x-api-key']);
  });
});

describe('capture ranking', () => {
  const c = (o) => ({ contentType: 'application/json', status: 200, method: 'GET', bytes: 0, secrets: [], ...o });

  test('a fat JSON payload outranks a tiny ping', () => {
    expect(wd.scoreCapture(c({ bytes: 64000 }))).toBeGreaterThan(wd.scoreCapture(c({ bytes: 96 })));
  });

  test('JSON outranks XML/CSV at equal size', () => {
    expect(wd.scoreCapture(c({ bytes: 1000 }))).toBeGreaterThan(wd.scoreCapture(c({ bytes: 1000, contentType: 'text/csv' })));
  });

  test('a GET is preferred over a POST — it polls without a body', () => {
    expect(wd.scoreCapture(c({ bytes: 1000 }))).toBeGreaterThan(wd.scoreCapture(c({ bytes: 1000, method: 'POST' })));
  });

  test('needing a credential is a penalty, not a disqualification', () => {
    const withSecret = wd.scoreCapture(c({ bytes: 4000, secrets: ['authorization'] }));
    expect(withSecret).toBeLessThan(wd.scoreCapture(c({ bytes: 4000 })));
    expect(withSecret).toBeGreaterThan(0);
  });
});

describe('mutation guard', () => {
  test.each([
    '{"query":"mutation Foo {bar}"}',
    '{"query":"  mutation{delete}"}',
    "{'query':'mutation('}",
  ])('flags %s as a write', (body) => {
    expect(wd.MUTATION_RE.test(body)).toBe(true);
  });

  test.each([
    '{"query":"{ routes { name } }"}',
    '{"query":"query Routes {routes}"}',
    '{"query":"{ mutationSummary }"}',   // a FIELD called mutationSummary is not a mutation
  ])('does not flag read %s', (body) => {
    expect(wd.MUTATION_RE.test(body)).toBe(false);
  });
});

describe('probeReplay safety', () => {
  test('refuses to replay a GraphQL mutation', async () => {
    const r = await wd.probeReplay({ url: 'https://x/graphql', method: 'POST', body: '{"query":"mutation Del {x}"}' });
    expect(r.replayable).toBe(false);
    expect(r.why).toMatch(/mutation/);
  });

  test('refuses a POST with no captured body', async () => {
    const r = await wd.probeReplay({ url: 'https://x/api', method: 'POST', body: null });
    expect(r.replayable).toBe(false);
  });

  test.each(['PUT', 'DELETE', 'PATCH'])('refuses to replay %s on a poll', async (method) => {
    const r = await wd.probeReplay({ url: 'https://x/api', method, body: '{}' });
    expect(r.replayable).toBe(false);
    expect(r.why).toMatch(/not a safe method/);
  });
});

describe('pollSpec', () => {
  test('carries everything a non-browser client needs, and no body for a GET', () => {
    const spec = wd.pollSpec({
      url: 'https://x/api', method: 'GET', headers: { referer: 'https://x/' },
      postData: 'ignored', requestContentType: null, contentType: 'application/json',
      bytes: 10, secrets: [],
    });
    expect(spec.body).toBeNull();
    expect(spec.url).toBe('https://x/api');
    expect(spec.headers).toEqual({ referer: 'https://x/' });
  });

  test('carries the body and its content-type for a POST', () => {
    const spec = wd.pollSpec({
      url: 'https://x/graphql', method: 'POST', headers: {},
      postData: '{"query":"{a}"}', requestContentType: 'application/json',
      contentType: 'application/json', bytes: 10, secrets: [],
    });
    expect(spec.body).toBe('{"query":"{a}"}');
    expect(spec.requestContentType).toBe('application/json');
  });
});

// ─── go2rtc version trap ────────────────────────────────────────────────────
// go2rtc 1.9.2 (running on small-server, load-bearing for van-spectrum) answers
// /api/frame.jpeg with 200 and a ZERO-BYTE body. A status-code check passes and
// you still have nothing — found the hard way on production.

describe('snapshot: relay returning an empty 200', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; snapshot.remove('jest-empty'); });

  const relayReturns = (bytes) => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }));
  };

  test('isJpeg rejects an empty body, however cheerful the status code', () => {
    expect(snapshot.isJpeg(Buffer.alloc(0))).toBe(false);
    expect(snapshot.isJpeg(Buffer.from([0xff, 0xd8]))).toBe(false); // magic but far too small
    const real = Buffer.alloc(2048); real[0] = 0xff; real[1] = 0xd8;
    expect(snapshot.isJpeg(real)).toBe(true);
  });

  test('a zero-byte 200 is not cached, and says why', async () => {
    relayReturns(Buffer.alloc(0));
    const r = await snapshot.capture('http://relay', 'web-x', 'jest-empty');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not a JPEG/);
    expect(snapshot.read('jest-empty')).toBeNull();
  });

  test('with no streamUrl there is nothing to fall back to, and it fails honestly', async () => {
    relayReturns(Buffer.alloc(0));
    const r = await snapshot.capture('http://relay', 'web-x', 'jest-empty', {});
    expect(r.ok).toBe(false);
  });

  test('a good relay frame is used directly and reports via=relay', async () => {
    const jpg = Buffer.alloc(2048, 0x20); jpg[0] = 0xff; jpg[1] = 0xd8;
    relayReturns(jpg);
    const r = await snapshot.capture('http://relay', 'web-x', 'jest-empty');
    expect(r).toMatchObject({ ok: true, via: 'relay' });
  });
});
