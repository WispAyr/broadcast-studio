/**
 * cutaway-stream-proxy.js — a same-origin HTTPS window onto go2rtc.
 *
 * WHY THIS EXISTS
 * Screens load from https://broadcast.studio.wispayr.online. go2rtc serves plain
 * http:// on the studio LAN. Chromium blocks that as mixed content, so the Cutaway
 * PIP renders its frame and label but the video stays BLACK. Proxying go2rtc under
 * this origin makes the page, its JS and its signalling socket all https/wss.
 *
 * WHY NOT routes/proxy.js
 * That one deliberately BLOCKS RFC1918 as SSRF protection, because it takes a
 * user-supplied URL. Do not weaken it. This is a separate, deliberately narrow
 * proxy: ONE upstream, fixed in env, never taken from the request. There is no
 * URL parameter to point it somewhere else, so it is not an open relay.
 *
 * WHY A DUMB PATH-PREFIX PROXY IS ENOUGH
 * go2rtc's player is fully relative — stream.html loads `./video-stream.js` and
 * builds its socket as `new URL('api/ws?src=..', location.href)`. Mounted under a
 * prefix, every one of those resolves back through this prefix on its own. No HTML
 * rewriting, no vendored JS, no custom WebRTC client.
 *
 * WHAT DOES *NOT* COME THROUGH HERE
 * The WebRTC media. The browser negotiates over the proxied socket and then
 * connects straight to go2rtc's ICE candidate (10.0.0.24:8555) on the studio LAN.
 * Only the page, its assets and the signalling are proxied — which is all that
 * mixed content actually cares about. So this proxy carries almost no traffic and
 * is not in the video path.
 *
 * ACCESS
 * Screen pages are unauthenticated by design (a screen is just a browser on a URL),
 * so this cannot sit behind `authenticate`. It is gated on a shared token that the
 * Cutaway overlay embeds in the stream URL at push time. If CUTAWAY_STREAM_TOKEN is
 * unset the proxy REFUSES to serve rather than quietly exposing a door camera to
 * anyone who can reach the origin — an unset secret is a mistake, not a mode.
 *
 * The token is a PATH SEGMENT, not a query param, and that is load-bearing:
 * stream.html builds its socket as `new URL('api/ws?src=..', location.href)`, which
 * keeps the path but DROPS the query — a `?k=` token would silently vanish on the
 * WebSocket upgrade and the gate would reject its own player. In the path, relative
 * resolution carries it for free.
 */

const express = require('express');
const http = require('http');
const net = require('net');
const { URL } = require('url');

const PREFIX = '/api/cutaway/stream';
const router = express.Router();

const upstream = () => process.env.CUTAWAY_STREAM_UPSTREAM || '';
const token = () => process.env.CUTAWAY_STREAM_TOKEN || '';

/**
 * Split "/<token>/rest?query" into { ok, rest }. The token is the FIRST path
 * segment; everything after it is what go2rtc actually sees.
 */
function splitToken(pathWithQuery) {
  const t = token();
  if (!upstream() || !t) return { ok: false, configured: false };
  const p = pathWithQuery.startsWith('/') ? pathWithQuery.slice(1) : pathWithQuery;
  const slash = p.indexOf('/');
  const given = slash === -1 ? p.split('?')[0] : p.slice(0, slash);
  if (given !== t) return { ok: false, configured: true };
  return { ok: true, configured: true, rest: slash === -1 ? '/' : p.slice(slash) };
}

router.use((req, res) => {
  const split = splitToken(req.originalUrl.slice(PREFIX.length) || '/');
  if (!split.configured) {
    return res.status(503).json({ error: 'CUTAWAY_STREAM_UPSTREAM/TOKEN not configured — refusing to serve a camera unauthenticated' });
  }
  if (!split.ok) return res.status(401).json({ error: 'Unauthorized' });

  const u = new URL(upstream());
  const proxied = http.request({
    hostname: u.hostname,
    port: u.port || 80,
    path: split.rest,
    method: req.method,
    headers: { ...req.headers, host: u.host },
  }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  proxied.on('error', (e) => {
    if (!res.headersSent) res.status(502).json({ error: `stream upstream unreachable: ${e.message}` });
  });
  req.pipe(proxied);
});

/**
 * Raw TCP relay for the signalling socket. Deliberately not the `ws` library: we
 * do not need to parse frames, only to move bytes, and a dumb relay cannot get the
 * framing wrong.
 */
function handleUpgrade(req, socket, head) {
  const split = splitToken(req.url.slice(PREFIX.length) || '/');
  if (!split.ok) { socket.destroy(); return; }

  const u = new URL(upstream());
  const up = net.connect(Number(u.port || 80), u.hostname, () => {
    // Rewrite Origin to the upstream's own. go2rtc checks Origin against Host and
    // rejects the mismatch a proxy inevitably creates ("request origin not allowed
    // by Upgrader.CheckOrigin"), which shows up as the player looping on "loading".
    // Rewriting here is better than setting `api: origin: "*"` on go2rtc: that would
    // drop its origin protection for every caller, not just this one proxy.
    const hdrs = Object.entries(req.headers)
      .filter(([k]) => !['host', 'origin'].includes(k.toLowerCase()))
      .map(([k, v]) => `${k}: ${v}`).join('\r\n');
    up.write(`GET ${split.rest} HTTP/1.1\r\nHost: ${u.host}\r\nOrigin: ${u.origin}\r\n${hdrs}\r\n\r\n`);
    if (head && head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
}

/**
 * Wire the relay onto the http server.
 *
 * ⚠ You CANNOT just `server.on('upgrade', ...)` alongside socket.io. engine.io
 * attaches its own upgrade listener and, for any path that is not its own, calls
 * socket.destroy() after ~1s (`destroyUpgrade` defaults to true). Node runs every
 * listener, so ours would relay the socket and engine.io would then kill it a
 * second later — which presents as the go2rtc player looping connect → close
 * forever with the video stuck on "loading".
 *
 * So we take socket.io's listeners off, put ours in front, and hand everything
 * that is not ours back to them untouched. Screens keep their control channel.
 */
function attach(server) {
  const existing = server.listeners('upgrade');
  server.removeAllListeners('upgrade');
  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith(PREFIX)) {
      try { handleUpgrade(req, socket, head); }
      catch (err) { console.warn('[cutaway-stream] upgrade failed:', err.message); socket.destroy(); }
      return;
    }
    for (const l of existing) l.call(server, req, socket, head);
  });
}

module.exports = { router, attach, PREFIX };
