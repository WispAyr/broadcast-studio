// ─────────────────────────────────────────────────────────────────────────────
// /media/s/:id — signed delivery for PRIVATE media.
//
// The problem this solves: /uploads is served straight off disk by nginx, with no
// auth and a one-year immutable cache. That is correct and fast for house idents and
// station filler. It is completely wrong for a sponsor's ad — an unauthenticated
// UUID URL is scrapable inventory, and "we ran your spot 40 times" is not a claim you
// want to make about a file anyone could have watched for free.
//
// So a private asset is never handed out as a /uploads path. The ENGINE mints a
// short-lived signed URL at cue time and hands it to the screen over its authenticated
// socket. The screen doesn't know or care that the URL is different. That seam was
// built into the engine from the start, which is why turning this on costs nothing on
// the client.
//
// Delivery still goes through nginx sendfile via X-Accel-Redirect when it's available
// — verifying the signature must not mean pumping the bytes through Node.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
const PRIVATE_DIR = path.join(__dirname, '..', '..', 'data', 'private');

// nginx must be told about this: an `internal` location aliasing the uploads root.
// Without it we fall back to streaming from Node, which works but puts video back on
// the event loop — acceptable for a 30s spot, not for a feature.
const XACCEL = process.env.PLAYOUT_XACCEL_PREFIX || null;   // e.g. '/protected'

const TTL_S = parseInt(process.env.PLAYOUT_SIGNED_TTL_S || '900', 10);   // 15 min

function sign(id, exp) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${id}:${exp}`).digest('base64url');
}

// Called by the engine, not by a client. The expiry is short because the only thing
// that needs the URL is a deck that is about to play it.
function signedUrl(id) {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  return `/media/s/${id}?exp=${exp}&sig=${sign(id, exp)}`;
}

router.get('/s/:id', (req, res) => {
  const { id } = req.params;
  const exp = parseInt(req.query.exp, 10);
  const sig = String(req.query.sig || '');

  if (!exp || !sig) return res.status(400).send('unsigned');
  if (exp < Math.floor(Date.now() / 1000)) return res.status(410).send('link expired');

  const expected = sign(id, exp);
  // Constant-time — a signature check that leaks timing is a signature check that
  // can be brute-forced.
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).send('bad signature');

  const m = db.prepare('SELECT master_path, original_path, private FROM media_assets WHERE id = ?').get(id);
  if (!m) return res.status(404).send('not found');

  // A private asset only ever has a master — the original stays in the public root
  // and must never be handed back through this route, or the whole exercise is moot.
  const rel = (m.private ? m.master_path : (m.master_path || m.original_path) || '');
  if (!rel) return res.status(404).send('no playable file');
  const root = m.private ? PRIVATE_DIR : UPLOADS_DIR;

  if (XACCEL) {
    // Hand the bytes back to nginx. It does sendfile + byte-range; Node does the auth
    // and then gets out of the way.
    res.setHeader('X-Accel-Redirect', `${XACCEL}/${m.private ? 'private' : 'public'}/${rel.split(path.sep).join('/')}`);
    res.setHeader('Content-Type', 'video/mp4');
    // Private media must never be cached by a proxy on the way out.
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    return res.end();
  }

  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return res.status(404).send('missing on disk');
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');
  // express handles Range for us here; a deck seeking to its in-point depends on it.
  return res.sendFile(abs);
});

// Poster for a private asset. The control-room grid needs a thumbnail in a plain
// <img> tag, which can't carry an Authorization header — but a 480px still is not the
// inventory, and it is useless without the signed video. Served by id only.
router.get('/poster/:id', (req, res) => {
  const m = db.prepare('SELECT poster_path, private FROM media_assets WHERE id = ?').get(req.params.id);
  if (!m?.poster_path) return res.status(404).send('no poster');
  const abs = path.join(m.private ? PRIVATE_DIR : UPLOADS_DIR, m.poster_path);
  if (!fs.existsSync(abs)) return res.status(404).send('missing');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(abs);
});

module.exports = { router, signedUrl };
