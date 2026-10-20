/**
 * player/onair: who is on air comes from BS's own now-playing feed, never from the analytics sample.
 */
const fs = require('fs');
const path = require('path');
const { match } = require('../public/player/onair/js/onair-now.js');
const DIR = path.join(__dirname, '..', 'public', 'player', 'onair');
const NAMES = ['Billy & Bex', 'Amanda Jean', 'Liam Dolan', 'Ali & Michael', 'Sideliners', 'Bex'];
const T = 1792520000000;
const np = (title, extra = {}) => ({ offAir: false, onAir: { title, presenter: null, start: T - 3600e3, end: T + 3600e3, ...extra } });

describe('on-air match', () => {
  test('live show maps to the presenter with analytics', () => {
    expect(match(np('Evening Vibe with Amanda Jean'), NAMES, T)).toEqual({ presenter: 'Amanda Jean', show: 'Evening Vibe with Amanda Jean' });
    expect(match(np('Up the Road with Billy and Bex'), NAMES, T).presenter).toBe('Billy & Bex');
    expect(match(np('Drivetime', { presenter: 'Liam Dolan' }), NAMES, T).presenter).toBe('Liam Dolan');
  });
  test('automated, unknown, off air, stale or missing feed → no on-air claim', () => {
    expect(match(np('Non-Stop Nights'), NAMES, T)).toBeNull();
    expect(match(np('Nonstop Nights with Amanda Jean'), NAMES, T)).toBeNull();
    expect(match(np('The Late Show - with Billy Sturgeon'), NAMES, T)).toBeNull();
    expect(match({ ...np('Evening Vibe with Amanda Jean'), offAir: true }, NAMES, T)).toBeNull();
    expect(match(np('Evening Vibe with Amanda Jean', { end: T - 600e3 }), NAMES, T)).toBeNull();
    expect(match(null, NAMES, T)).toBeNull();
    expect(match({}, NAMES, T)).toBeNull();
  });
});

describe('no hardcoded "now" claims', () => {
  test('the sample carries no current presenter', () => {
    const s = JSON.parse(fs.readFileSync(path.join(DIR, 'sample', 'onair.analytics.json'), 'utf8'));
    expect(s.current).toBeNull();
  });
  test('presenter page reads the same-origin now-playing feed, has the neutral heading, ignores the analytics current', () => {
    const h = fs.readFileSync(path.join(DIR, 'presenter.html'), 'utf8');
    expect(h).toMatch(/\/api\/nowplaying\//);
    expect(h).toMatch(/Voices of Now Ayrshire Radio/);
    expect(h).not.toMatch(/v\.current/);
  });
  test('only the presenter page may say who is on air', () => {
    for (const f of ['words.html', 'places.html', 'halloween.html', 'sequence.html']) {
      const h = fs.readFileSync(path.join(DIR, f), 'utf8');
      expect(h).not.toMatch(/On air now|current\.presenter|'On air'/);
    }
  });
});
