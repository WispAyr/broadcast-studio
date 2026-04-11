/**
 * Tests for login rate limiting.
 * We extract the rate limiter logic to test in isolation.
 */

// Replicate the rate limiter from auth.js for isolated testing
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

function checkLoginRate(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || (now - record.windowStart > LOGIN_WINDOW_MS)) {
    loginAttempts.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  record.count++;
  if (record.count > LOGIN_MAX_ATTEMPTS) return false;
  return true;
}

describe('Login Rate Limiter', () => {
  beforeEach(() => {
    loginAttempts.clear();
  });

  test('allows first 5 attempts from the same IP', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRate('1.2.3.4')).toBe(true);
    }
  });

  test('blocks the 6th attempt from the same IP', () => {
    for (let i = 0; i < 5; i++) {
      checkLoginRate('1.2.3.4');
    }
    expect(checkLoginRate('1.2.3.4')).toBe(false);
  });

  test('continues blocking after 6th attempt', () => {
    for (let i = 0; i < 5; i++) {
      checkLoginRate('1.2.3.4');
    }
    expect(checkLoginRate('1.2.3.4')).toBe(false);
    expect(checkLoginRate('1.2.3.4')).toBe(false);
    expect(checkLoginRate('1.2.3.4')).toBe(false);
  });

  test('tracks different IPs separately', () => {
    for (let i = 0; i < 5; i++) {
      checkLoginRate('1.2.3.4');
    }
    expect(checkLoginRate('1.2.3.4')).toBe(false); // blocked
    expect(checkLoginRate('5.6.7.8')).toBe(true);   // different IP, allowed
  });

  test('resets after window expires', () => {
    // Simulate: manual timestamp manipulation
    const now = Date.now();
    loginAttempts.set('1.2.3.4', { windowStart: now - LOGIN_WINDOW_MS - 1000, count: 10 });
    
    // Should reset because window has expired
    expect(checkLoginRate('1.2.3.4')).toBe(true);
    expect(loginAttempts.get('1.2.3.4').count).toBe(1); // reset to 1
  });
});
