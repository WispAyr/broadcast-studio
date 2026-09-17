// ─── Web source registry ────────────────────────────────────────────────────
// File-backed, same pattern as livetv.json — survives restarts with no schema
// migration. Shared by the HTTP routes and the background refresher so there is
// exactly one definition of "what is stale" and one public projection.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'web-sources.json');
const STREAM_PREFIX = 'web-';

// How long a resolved manifest is trusted. Tokenised CDN URLs
// (…/live.m3u8?a=<session>) routinely expire inside an hour.
const STALE_MS = Number(process.env.WEB_SOURCE_STALE_MS || 45 * 60 * 1000);

const DEFAULTS = {
  host: process.env.LIVETV_GO2RTC || 'http://localhost:1984',
  sources: [],
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return {
      host: raw.host || DEFAULTS.host,
      sources: Array.isArray(raw.sources) ? raw.sources : [],
    };
  } catch {
    return { ...DEFAULTS, sources: [] };
  }
}

function save(cfg) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  // Write-then-rename: a torn registry would lose every source at once, and
  // the refresher writes on a timer while operators are editing.
  const tmp = `${DATA_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, DATA_PATH);
}

/** Mutate one source atomically: read fresh, apply, write. */
function update(key, fn) {
  const cfg = load();
  const src = cfg.sources.find((s) => s.key === key);
  if (!src) return null;
  fn(src);
  save(cfg);
  return src;
}

const streamName = (key) => `${STREAM_PREFIX}${key}`;

function isStale(src) {
  if (!src.resolvedAt) return true;
  return Date.now() - new Date(src.resolvedAt).getTime() > STALE_MS;
}

/**
 * Refresh proactively, before the token actually expires, so a source is
 * already fresh when something next tries to start it.
 */
function isDueForRefresh(src, fraction = 0.8) {
  if (!src.resolvedAt) return true;
  return Date.now() - new Date(src.resolvedAt).getTime() > STALE_MS * fraction;
}

/**
 * What a screen / unauthenticated caller may see. Resolved URLs carry session
 * tokens and relay tokens are credentials — neither belongs here.
 */
function publicView(cfg) {
  return {
    host: cfg.host,
    sources: cfg.sources.map((s) => ({
      key: s.key,
      label: s.label || s.key,
      stream: s.stream || streamName(s.key),
      kind: s.kind || null,
      live: s.live ?? null,
      status: s.status || 'never',
      stale: isStale(s),
      resolvedAt: s.resolvedAt || null,
    })),
  };
}

/** Operator view: everything except the relay token, which is a credential. */
function operatorView(cfg) {
  return {
    host: cfg.host,
    sources: cfg.sources.map(({ relayToken, ...s }) => ({
      ...s,
      stale: isStale(s),
      dueForRefresh: isDueForRefresh(s),
      hasRelay: Boolean(relayToken),
    })),
  };
}

module.exports = {
  load, save, update, streamName, isStale, isDueForRefresh,
  publicView, operatorView, STALE_MS, DATA_PATH,
};
