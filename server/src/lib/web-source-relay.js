// ─── Header-injecting relay ─────────────────────────────────────────────────
// Some CDNs only serve their manifest with the right Referer/Origin. go2rtc
// REFUSES any source containing a space ("source with spaces may be insecure"),
// so ffmpeg `-headers "Referer: …"` cannot be passed through its API at all.
//
// The way round it: BS serves the stream itself as MPEG-TS over plain HTTP, and
// go2rtc pulls a simple, spaceless URL:
//
//   go2rtc  ──GET──▶  /api/web-sources/:key/relay.ts?t=<token>  ──ffmpeg -headers──▶  origin
//
// ffmpeg's lifetime is the HTTP response's: when go2rtc disconnects, the pipe
// closes and the process is killed. No supervisor, no respawn storm, nothing to
// leak — the relay exists exactly as long as something is pulling it.
//
// ⚠ Topology cost: the media takes an extra hop through whichever box runs BS.
// For a venue relay on a different site that is a WAN round trip each way. This
// is the fallback for the headers-required minority, not the default path.

const { spawn } = require('child_process');
const crypto = require('crypto');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const MAX_CONCURRENT = Number(process.env.WEB_SOURCE_MAX_RELAYS || 4);

// key -> { proc, startedAt, bytes }
const active = new Map();

const CANONICAL = { referer: 'Referer', origin: 'Origin', 'user-agent': 'User-Agent', cookie: 'Cookie' };

/**
 * Build the value for ffmpeg's -headers.
 *
 * 🚨 Header values come from a scraped page, so they are untrusted. A value
 * containing CR/LF would inject arbitrary extra headers into the upstream
 * request — strip them rather than trusting the origin site.
 */
function buildHeaderArg(headers = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(headers)) {
    const name = CANONICAL[String(k).toLowerCase()];
    if (!name) continue;
    const value = String(v).replace(/[\r\n]/g, '').trim();
    if (!value) continue;
    lines.push(`${name}: ${value}`);
  }
  return lines.length ? `${lines.join('\r\n')}\r\n` : '';
}

function newToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/** Constant-time compare so the relay token cannot be guessed a byte at a time. */
function tokenMatches(expected, given) {
  if (!expected || !given) return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(given));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Pipe the source to `res` as MPEG-TS, injecting headers.
 * Resolves when the relay has been wired up (not when it ends).
 */
function serveRelay(res, req, { key, url, headers }) {
  if (active.size >= MAX_CONCURRENT && !active.has(key)) {
    res.status(503).json({ error: `relay limit reached (${MAX_CONCURRENT} concurrent)` });
    return null;
  }

  // A second puller for the same key replaces the first — go2rtc reconnecting
  // should not leave the old ffmpeg reading the origin forever.
  stopRelay(key);

  const headerArg = buildHeaderArg(headers);
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error'];
  if (headerArg) args.push('-headers', headerArg);
  args.push(
    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
    '-i', url,
    '-c', 'copy',
    '-f', 'mpegts',
    'pipe:1',
  );

  let proc;
  try {
    proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    res.status(500).json({ error: `cannot start ffmpeg: ${e.message}` });
    return null;
  }

  const entry = { proc, startedAt: Date.now(), bytes: 0, lastError: null };
  active.set(key, entry);

  res.writeHead(200, {
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'no-store',
    Connection: 'close',
  });

  proc.stdout.on('data', (chunk) => { entry.bytes += chunk.length; });
  proc.stdout.pipe(res);

  let stderrTail = '';
  proc.stderr.on('data', (d) => {
    stderrTail = (stderrTail + d.toString()).slice(-2000);
    entry.lastError = stderrTail.trim().split('\n').pop();
  });

  const cleanup = () => {
    if (active.get(key) === entry) active.delete(key);
    try { proc.kill('SIGKILL'); } catch { /* already gone */ }
  };

  proc.on('error', (e) => { entry.lastError = e.message; cleanup(); try { res.end(); } catch { /* ignore */ } });
  proc.on('exit', () => { cleanup(); try { res.end(); } catch { /* ignore */ } });
  req.on('close', cleanup);
  res.on('close', cleanup);

  return entry;
}

function stopRelay(key) {
  const entry = active.get(key);
  if (!entry) return false;
  active.delete(key);
  try { entry.proc.kill('SIGKILL'); } catch { /* ignore */ }
  return true;
}

function relayStatus() {
  return [...active.entries()].map(([key, e]) => ({
    key,
    upMs: Date.now() - e.startedAt,
    bytes: e.bytes,
    lastError: e.lastError,
  }));
}

module.exports = { serveRelay, stopRelay, relayStatus, newToken, tokenMatches, buildHeaderArg, MAX_CONCURRENT };
