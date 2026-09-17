// ─── Extractor client — in-process or shared service ────────────────────────
// The extractor is estate-level capability, not a Broadcast Studio feature:
// Prism, drones-admin and anything else with a "put this web video on a
// surface" problem wants the same thing. Rather than every app growing its own
// headless-Chrome fleet, one service can front it.
//
//   WEB_SOURCE_EXTRACTOR_URL unset  → run extract() in this process (default)
//   WEB_SOURCE_EXTRACTOR_URL set    → POST to the shared service
//
// The contract is identical either way, so callers never branch on it. See
// src/web-source-service.js for the server side.

const { extract } = require('./web-source-extract');

const EXTRACTOR_URL = (process.env.WEB_SOURCE_EXTRACTOR_URL || '').replace(/\/+$/, '');
const EXTRACTOR_TOKEN = process.env.WEB_SOURCE_EXTRACTOR_TOKEN || '';

function isRemote() {
  return Boolean(EXTRACTOR_URL);
}

async function extractVia(pageUrl, opts = {}) {
  if (!isRemote()) return extract(pageUrl, opts);

  // Allow generously more than the extractor's own hard deadline so a remote
  // timeout is reported by the service (with its steps and diagnosis) rather
  // than guessed at by us.
  const budget = (opts.timeoutMs || 45000) + 30000;

  let res;
  try {
    res = await fetch(`${EXTRACTOR_URL}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EXTRACTOR_TOKEN ? { Authorization: `Bearer ${EXTRACTOR_TOKEN}` } : {}),
      },
      body: JSON.stringify({ pageUrl, ...opts }),
      signal: AbortSignal.timeout(budget),
    });
  } catch (e) {
    return {
      ok: false,
      reason: 'extractor-unreachable',
      message: `Shared extractor at ${EXTRACTOR_URL} did not answer: ${e.message}`,
      pageUrl,
    };
  }

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return {
      ok: false,
      reason: 'extractor-error',
      message: `Shared extractor returned ${res.status}: ${text.slice(0, 300)}`,
      pageUrl,
    };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, reason: 'extractor-error', message: 'Shared extractor returned malformed JSON', pageUrl };
  }
}

async function extractorHealth() {
  if (!isRemote()) return { mode: 'in-process' };
  try {
    const r = await fetch(`${EXTRACTOR_URL}/health`, {
      headers: EXTRACTOR_TOKEN ? { Authorization: `Bearer ${EXTRACTOR_TOKEN}` } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { mode: 'remote', url: EXTRACTOR_URL, up: false, error: `HTTP ${r.status}` };
    return { mode: 'remote', url: EXTRACTOR_URL, up: true, ...(await r.json().catch(() => ({}))) };
  } catch (e) {
    return { mode: 'remote', url: EXTRACTOR_URL, up: false, error: e.message };
  }
}

module.exports = { extractVia, extractorHealth, isRemote };
