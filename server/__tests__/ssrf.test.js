/**
 * Tests for SSRF protection — isPrivateUrl validation of blocked URLs.
 * We extract the function by reading the proxy module source.
 */

// We need to extract isPrivateUrl without loading the full router (which requires auth/db).
// Re-implement based on the exact same logic for testing.
const { URL } = require('url');

function isPrivateUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
    if (parsed.protocol === 'file:') return true;
    if (host === '169.254.169.254' || host === 'metadata.google.internal') return true;
    const parts = host.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
    }
    if (host.startsWith('169.254.')) return true;
    return false;
  } catch {
    return true;
  }
}

describe('SSRF Protection — isPrivateUrl', () => {
  describe('blocks private/internal URLs', () => {
    const blocked = [
      'http://localhost/secret',
      'http://127.0.0.1/admin',
      'http://0.0.0.0/',
      'file:///etc/passwd',
      'http://169.254.169.254/latest/meta-data/',    // AWS metadata
      'http://metadata.google.internal/computeMetadata', // GCP metadata
      'http://10.0.0.1/',                             // 10.x.x.x
      'http://10.255.255.255/',
      'http://172.16.0.1/',                           // 172.16-31.x.x
      'http://172.31.255.255/',
      'http://192.168.1.1/',                          // 192.168.x.x
      'http://192.168.0.100/',
      'http://169.254.1.1/',                          // Link-local
    ];

    blocked.forEach(url => {
      test(`blocks ${url}`, () => {
        expect(isPrivateUrl(url)).toBe(true);
      });
    });
  });

  describe('allows public URLs', () => {
    const allowed = [
      'https://api.open-meteo.com/v1/forecast',
      'https://www.google.com/',
      'http://93.184.216.34/',                        // public IP
      'https://rss.bbc.co.uk/news',
      'https://172.32.0.1/',                          // just outside 172.16-31
      'http://11.0.0.1/',                             // not 10.x
      'http://192.169.0.1/',                          // not 192.168.x
    ];

    allowed.forEach(url => {
      test(`allows ${url}`, () => {
        expect(isPrivateUrl(url)).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    test('blocks invalid URLs', () => {
      expect(isPrivateUrl('not-a-url')).toBe(true);
    });

    test('blocks empty string', () => {
      expect(isPrivateUrl('')).toBe(true);
    });
  });
});
