/**
 * Surface tokens — JS port of deploy-gate's HMAC signer/verifier.
 *
 * Wire format matches app/surface.py on deploy-gate (big-server):
 *   <payload_b64url>.<sig_b64url>
 * payload is sorted-keys JSON {aud, exp, iat, jti, lid, sid}
 * sig is HMAC-SHA256 over payload_b64url.
 *
 * The signing key is shared with deploy-gate + any other app that needs
 * to mint or verify — distribute via SURFACE_SIGNING_KEY env. Keep the
 * Python canonical; this file mirrors its behaviour exactly.
 */
const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getKey() {
  const k = process.env.SURFACE_SIGNING_KEY;
  if (!k) throw new Error('SURFACE_SIGNING_KEY is not set');
  return Buffer.from(k, 'utf8');
}

function randJti() {
  return b64url(crypto.randomBytes(9));
}

function mint({ aud, screenId, layoutId = null, ttlSeconds = 900 }) {
  if (!aud || !screenId) throw new Error('aud and screenId are required');
  if (ttlSeconds < 30 || ttlSeconds > 7 * 86400) throw new Error('ttlSeconds must be 30..604800');
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: String(aud),
    exp: now + ttlSeconds,
    iat: now,
    jti: randJti(),
    lid: layoutId || '*',
    sid: String(screenId),
  };
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(crypto.createHmac('sha256', getKey()).update(payload).digest());
  return { token: `${payload}.${sig}`, claims };
}

function verify(token, { revokedSet } = {}) {
  if (typeof token !== 'string' || !token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected;
  try {
    expected = crypto.createHmac('sha256', getKey()).update(payload).digest();
  } catch {
    return null;
  }
  let given;
  try {
    given = b64urlDecode(sig);
  } catch {
    return null;
  }
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let claims;
  try {
    claims = JSON.parse(b64urlDecode(payload).toString('utf8'));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== 'object') return null;
  const { aud, sid, lid, iat, exp, jti } = claims;
  if (!aud || !sid || !jti || typeof exp !== 'number') return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;
  if (revokedSet && revokedSet.has(jti)) return null;
  return { aud, sid, lid: lid ?? null, iat, exp, jti };
}

module.exports = { mint, verify };
