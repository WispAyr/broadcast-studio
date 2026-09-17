// ─── go2rtc REST client ─────────────────────────────────────────────────────
// Registers extracted web streams with the venue relay's go2rtc so they become
// ordinary named sources — the same thing the `live_tv` and `go2rtc_feed`
// modules already play. No new delivery path on the screen side.
//
// Hard-won API notes (go2rtc 1.9.14, verified live):
//   • PUT /api/streams?name=&src=   adds a stream. **POST does nothing** and
//     returns 400 with an empty body — it looks like it worked, it didn't.
//   • DELETE /api/streams?src=<NAME>  removes it (the param is `src`, but the
//     value is the stream NAME, not the source URL).
//   • go2rtc REFUSES any src containing a space ("source with spaces may be
//     insecure", 400). So ffmpeg `-headers` cannot be injected via the API —
//     see needsRelay() in the web-sources route for what we do instead.
//   • A 400 saying `yaml: line N: did not find expected key` means the stream
//     WAS added in memory but go2rtc could not persist it. Cause: the relay's
//     go2rtc.yaml uses flow-style `streams: {}`. Use block style (or omit the
//     key entirely) or every API-added stream dies on restart.

const DEFAULT_TIMEOUT = 8000;

function base(host) {
  return String(host || '').replace(/\/+$/, '');
}

/** go2rtc's own rule — mirror it so we fail with a useful message, not a 400. */
function assertSafeSource(src) {
  if (/\s/.test(src)) {
    throw new Error('go2rtc rejects sources containing spaces — this stream needs an ffmpeg relay instead');
  }
  return src;
}

/** Build a go2rtc source string for a plain HLS/DASH/progressive URL. */
function buildSource(streamUrl, { copy = true } = {}) {
  const src = copy
    ? `ffmpeg:${streamUrl}#video=copy#audio=copy`
    : `ffmpeg:${streamUrl}#video=h264#audio=aac`;
  return assertSafeSource(src);
}

async function api(host, path, { method = 'GET', timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const url = `${base(host)}${path}`;
  const res = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, text };
}

async function listStreams(host) {
  const r = await api(host, '/api/streams');
  if (!r.ok) throw new Error(`go2rtc list failed (${r.status}) ${r.text.slice(0, 200)}`);
  try { return JSON.parse(r.text || '{}'); } catch { return {}; }
}

/**
 * Add/replace a stream. Returns { persisted } — false means the stream is live
 * now but will NOT survive a go2rtc restart (see the yaml note above).
 */
async function putStream(host, name, src) {
  assertSafeSource(src);
  const q = `?name=${encodeURIComponent(name)}&src=${encodeURIComponent(src)}`;
  const r = await api(host, `/api/streams${q}`, { method: 'PUT' });
  if (r.ok) return { persisted: true };

  // The in-memory add may still have succeeded — confirm before calling it a
  // failure, because a config-write error is recoverable and a lie is not.
  if (/yaml:/i.test(r.text)) {
    const streams = await listStreams(host).catch(() => ({}));
    if (streams[name]) return { persisted: false, warning: r.text.trim() };
  }
  throw new Error(`go2rtc put failed (${r.status}) ${r.text.slice(0, 200)}`);
}

async function deleteStream(host, name) {
  const r = await api(host, `/api/streams?src=${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`go2rtc delete failed (${r.status}) ${r.text.slice(0, 200)}`);
  return true;
}

async function health(host) {
  try {
    const r = await api(host, '/api', { timeoutMs: 3000 });
    if (!r.ok) return { up: false, error: `HTTP ${r.status}` };
    const j = JSON.parse(r.text || '{}');
    return { up: true, version: j.version, host: j.host };
  } catch (e) {
    return { up: false, error: e.message };
  }
}

module.exports = { listStreams, putStream, deleteStream, health, buildSource, assertSafeSource };
