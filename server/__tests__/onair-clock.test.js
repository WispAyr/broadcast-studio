/**
 * player/onair/clock.html: the station-wide studio clock — the SideLiner's clock's design, station branding, live feed only.
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'player', 'onair');
const SL = path.join(__dirname, '..', 'public', 'player', 'sideliners', 'clock.html');
const html = fs.readFileSync(path.join(DIR, 'clock.html'), 'utf8');
const visible = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('same design system as the SideLiner\'s clock: tokens, ring geometry, grid, time sync', () => {
  const sl = fs.readFileSync(SL, 'utf8');
  expect(html).toMatch(/href="css\/sl\.css"/);
  for (const rule of ['.dial { position: absolute; left: 110px; top: 70px; width: 800px; height: 800px; }', '.col { position: absolute; left: 1010px; width: 800px; top: 84px;',
    '.tickwrap { position: absolute; left: 100px; right: 100px; top: 950px; height: 76px; }', 'R = 356, RH = 392']) {
    expect(sl).toContain(rule); expect(html).toContain(rule);
  }
  expect(html).toMatch(/TIME_URL = SL\.p\('time', '\/api\/time'\)/);
});

test('station branding only: official logo, no show branding, no bare initials, no frequency, no sample data', () => {
  expect(html).toContain('logo/nar-stacked-white-tight.svg');
  expect(fs.existsSync(path.join(DIR, 'logo', 'nar-stacked-white-tight.svg'))).toBe(true);
  expect(visible).not.toMatch(/sideliners|SideLiner|kick-off|datafeeds/i);
  expect(visible).not.toMatch(/\bNAR\b/);
  expect(html).not.toMatch(/\b\d{2,3}\.\d\s*(FM|MHz)\b/i);
  expect(visible).not.toMatch(/Sample data|demoData/);
  expect(html).toMatch(/<title>Now Ayrshire Radio — Studio clock<\/title>/);
});

test('show panel + band come from the same-origin now-playing feed and drop stale or ended slots', () => {
  expect(html).toMatch(/'\/api\/nowplaying\/' \+ SL\.p\('station', '7719'\)/);
  expect(html).toMatch(/MAX_AGE = 180000/);
  expect(html).toMatch(/t < s\.end/);
});
