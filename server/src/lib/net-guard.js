// ─── SSRF guard ─────────────────────────────────────────────────────────────
// Shared version of the blocklist that routes/proxy.js carries inline.
//
// This matters MORE for web-source extraction than for a plain fetch proxy: the
// extractor drives a real browser, so an unguarded page URL would let anyone
// with an operator token point Chrome at 10.200.0.x and read back whatever the
// WireGuard mesh serves. Block first, resolve later.

const { URL } = require('url');

function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  if (h.startsWith('169.254.')) return true;

  // IPv4 literals
  const parts = h.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p) && Number(p) <= 255)) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true;                         // 10/8 — includes the WG mesh
    if (a === 127) return true;                        // loopback
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12
    if (a === 192 && b === 168) return true;           // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0 || a >= 224) return true;              // this-network, multicast, reserved
  }

  // IPv6 loopback / link-local / unique-local
  if (h === '::' || /^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)) return true;

  return false;
}

function isPrivateUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    return isPrivateHost(parsed.hostname);
  } catch {
    return true; // unparseable = blocked
  }
}

module.exports = { isPrivateUrl, isPrivateHost };
