// ─── Snapshot cache — "never dark" for web sources ──────────────────────────
// A wall that goes black is worse than a wall showing the harbour as it looked
// ninety seconds ago. So: grab a still WHILE the stream is healthy, and serve
// that still when it is not.
//
// Cache-while-healthy, serve-when-dead: a frame can only be grabbed while the
// stream is alive, which is exactly when it is not needed. Hence the cache.
//
// Two ways to get one. The relay's own /api/frame.jpeg is preferred (no decode
// on our side), but it is VERSION-DEPENDENT: go2rtc 1.9.2 answers 200 with a
// zero-byte body, so checking the status code is not enough — the bytes must
// be a real JPEG. When it is not, we take the frame ourselves with ffmpeg
// straight from the origin. That works on any relay version.
//
// 🚨 HONESTY RULE. A still frame that looks live is worse than a black screen,
// because an operator will believe it. Everything here reports the frame's AGE,
// the HTTP response carries it in a header, and the player badges it on screen.
// Nothing in this file may ever present a cached frame as live.

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'data', 'web-source-snapshots');
const MAX_BYTES = Number(process.env.WEB_SOURCE_SNAPSHOT_MAX_BYTES || 4 * 1024 * 1024);
// Past this, a still is too old to be worth showing at all — better to admit
// we have nothing than to put last week's weather on a wall.
const MAX_AGE_MS = Number(process.env.WEB_SOURCE_SNAPSHOT_MAX_AGE_MS || 24 * 60 * 60 * 1000);

const SAFE_KEY = /^[a-z0-9][a-z0-9-]{1,40}$/;
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

function isJpeg(buf) {
  return buf && buf.length >= 1024 && buf[0] === 0xff && buf[1] === 0xd8;
}

/**
 * Grab one frame with ffmpeg, straight from the origin URL.
 *
 * Needed because go2rtc's /api/frame.jpeg is version-dependent: 1.9.2 (running
 * on small-server, load-bearing for van-spectrum) answers 200 with a ZERO-BYTE
 * body for every stream, so a status-code check passes and you still get
 * nothing. Rather than require a relay upgrade under a production service, take
 * the frame ourselves — it costs one short-lived ffmpeg instead of a proxied
 * GET, and it works on any relay version.
 */
function captureViaFfmpeg(streamUrl, headers = {}, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const args = ['-nostdin', '-hide_banner', '-loglevel', 'error'];
    const hdr = Object.entries(headers)
      .filter(([k]) => ['referer', 'origin', 'user-agent'].includes(k.toLowerCase()))
      .map(([k, v]) => `${k.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())}: ${String(v).replace(/[\r\n]/g, '')}`)
      .join('\r\n');
    if (hdr) args.push('-headers', `${hdr}\r\n`);
    args.push('-i', streamUrl, '-frames:v', '1', '-q:v', '4', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1');

    let proc;
    try { proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { return resolve({ ok: false, reason: `ffmpeg spawn: ${e.message}` }); }

    const chunks = [];
    let err = '';
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    proc.stdout.on('data', (c) => chunks.push(c));
    proc.stderr.on('data', (d) => { err = (err + d.toString()).slice(-300); });
    proc.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, reason: e.message }); });
    proc.on('close', () => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      if (!isJpeg(buf)) return resolve({ ok: false, reason: err.trim().split('\n').pop() || 'ffmpeg produced no frame' });
      resolve({ ok: true, buf });
    });
  });
}

function fileFor(key) {
  if (!SAFE_KEY.test(key)) return null; // never let a key escape the directory
  return path.join(DIR, `${key}.jpg`);
}

/**
 * Pull a frame from the relay and cache it. Best-effort: a failure here is
 * normal (the stream may be down — that is the case we are insuring against)
 * and must never escalate.
 *
 * @returns {Promise<{ok:boolean, bytes?:number, reason?:string}>}
 */
async function capture(host, streamName, key, opts = {}) {
  const file = fileFor(key);
  if (!file) return { ok: false, reason: 'bad key' };

  // 1. Ask the relay — cheapest path, no decode, works on newer go2rtc.
  let buf = null;
  let why = '';
  try {
    const res = await fetch(`${String(host).replace(/\/+$/, '')}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const b = Buffer.from(await res.arrayBuffer());
      if (isJpeg(b)) buf = b; else why = `relay returned ${b.length}B, not a JPEG`;
    } else {
      why = `relay HTTP ${res.status}`;
    }
  } catch (e) {
    why = e.message;
  }

  // 2. Fall back to taking the frame ourselves. See captureViaFfmpeg.
  let via = 'relay';
  if (!buf && opts.streamUrl) {
    const r = await captureViaFfmpeg(opts.streamUrl, opts.headers || {});
    if (r.ok) { buf = r.buf; via = 'ffmpeg'; }
    else why = `${why}; ffmpeg: ${r.reason}`;
  }

  if (!buf) return { ok: false, reason: why || 'no frame available' };
  if (buf.length > MAX_BYTES) return { ok: false, reason: `frame too large (${buf.length}B)` };

  await fsp.mkdir(DIR, { recursive: true });
  // Write-then-rename: a screen may be reading this file right now, and half a
  // JPEG is a broken image on a wall.
  const tmp = `${file}.tmp`;
  await fsp.writeFile(tmp, buf);
  await fsp.rename(tmp, file);
  return { ok: true, bytes: buf.length, via };
}

/** @returns {{file:string, ageMs:number, bytes:number}|null} */
function read(key) {
  const file = fileFor(key);
  if (!file) return null;
  try {
    const st = fs.statSync(file);
    const ageMs = Date.now() - st.mtimeMs;
    if (ageMs > MAX_AGE_MS) return null;
    return { file, ageMs, bytes: st.size };
  } catch {
    return null;
  }
}

function status(key) {
  const s = read(key);
  return s ? { has: true, ageMs: s.ageMs, bytes: s.bytes } : { has: false };
}

function remove(key) {
  const file = fileFor(key);
  if (!file) return false;
  try { fs.unlinkSync(file); return true; } catch { return false; }
}

/** Drop stills for sources that no longer exist. */
function prune(liveKeys) {
  const keep = new Set(liveKeys);
  let removed = 0;
  try {
    for (const name of fs.readdirSync(DIR)) {
      if (!name.endsWith('.jpg')) continue;
      if (keep.has(name.slice(0, -4))) continue;
      try { fs.unlinkSync(path.join(DIR, name)); removed += 1; } catch { /* ignore */ }
    }
  } catch { /* no directory yet */ }
  return removed;
}

module.exports = { capture, captureViaFfmpeg, isJpeg, read, status, remove, prune, DIR, MAX_AGE_MS };
