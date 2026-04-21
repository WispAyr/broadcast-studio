/**
 * Layout enrichment — rewrites gated URLs in a layout's modules so kiosk
 * screens can render auth-gated surfaces without a logged-in session.
 *
 * Any iframe or surface_carousel module whose URL host matches a configured
 * audience gets `?surface_token=<hmac-signed token>` appended. The signing
 * key is shared with the target app (SURFACE_SIGNING_KEY env); the token is
 * validated there via the same lib/surface-token logic (JS) or app/surface
 * module (Python).
 *
 * Host→audience map is env-driven via SURFACE_AUDIENCE_MAP
 *   "live.wispayr.online=prism-surface,foo.wispayr.online=foo-surface"
 * Defaults cover live.wispayr.online → prism-surface.
 */
const { mint } = require('./surface-token');

function parseHostMap(raw) {
  const out = {};
  if (!raw) return out;
  for (const entry of String(raw).split(',')) {
    const [host, aud] = entry.split('=').map((s) => (s || '').trim());
    if (host && aud) out[host.toLowerCase()] = aud;
  }
  return out;
}

const DEFAULT_MAP = { 'live.wispayr.online': 'prism-surface' };

function getHostMap() {
  const fromEnv = parseHostMap(process.env.SURFACE_AUDIENCE_MAP);
  return { ...DEFAULT_MAP, ...fromEnv };
}

// Simple in-memory token cache, keyed by aud+screenId. Tokens are reused
// until within TOKEN_REFRESH_MARGIN_S of expiry. Prevents minting on every
// request; fresh process wipes the cache (fine, they're cheap to mint).
const TOKEN_CACHE = new Map();
const TOKEN_TTL_S = 3600;
const TOKEN_REFRESH_MARGIN_S = 300;

function getOrMintToken(aud, screenId) {
  const key = `${aud}:${screenId || '*'}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = TOKEN_CACHE.get(key);
  if (cached && cached.exp - now > TOKEN_REFRESH_MARGIN_S) return cached.token;
  try {
    const { token, claims } = mint({
      aud,
      screenId: screenId || 'shared',
      ttlSeconds: TOKEN_TTL_S,
    });
    TOKEN_CACHE.set(key, { token, exp: claims.exp });
    return token;
  } catch (err) {
    // Surface-token signing key not configured — fail open so the layout
    // still renders (kiosk sees the same 401 it always did). Loud log so
    // ops notices.
    if (!getOrMintToken._warned) {
      console.warn('[surface-token] not minting:', err.message);
      getOrMintToken._warned = true;
    }
    return null;
  }
}

function rewriteUrl(urlStr, screenId, hostMap) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    return urlStr;
  }
  const aud = hostMap[u.hostname.toLowerCase()];
  if (!aud) return urlStr;
  if (u.searchParams.has('surface_token')) return urlStr; // already signed
  const tok = getOrMintToken(aud, screenId);
  if (!tok) return urlStr;
  u.searchParams.set('surface_token', tok);
  return u.toString();
}

function enrichModules(modules, screenId) {
  if (!Array.isArray(modules)) return modules;
  const hostMap = getHostMap();
  return modules.map((m) => {
    if (!m || typeof m !== 'object' || !m.config) return m;
    const out = { ...m, config: { ...m.config } };
    // Any module that embeds via config.url / config.src. Several module
    // types (iframe, video, web-source, remotion) check `src` as an alias
    // for `url`, so sign both. Keep this list intentionally small — adding
    // a field here is a footgun if downstream renderers treat it as UGC.
    for (const field of ['url', 'src']) {
      if (typeof out.config[field] === 'string') {
        out.config[field] = rewriteUrl(out.config[field], screenId, hostMap);
      }
    }
    // surface_carousel: views[].url
    if (Array.isArray(out.config.views)) {
      out.config.views = out.config.views.map((v) =>
        v && typeof v === 'object' && typeof v.url === 'string'
          ? { ...v, url: rewriteUrl(v.url, screenId, hostMap) }
          : v
      );
    }
    return out;
  });
}

function enrichLayout(layout, screenId) {
  if (!layout || typeof layout !== 'object') return layout;
  let modules = layout.modules;
  if (typeof modules === 'string') {
    try {
      modules = JSON.parse(modules);
    } catch {
      return layout;
    }
  }
  const enriched = enrichModules(modules, screenId);
  return { ...layout, modules: enriched };
}

module.exports = { enrichLayout, enrichModules };
