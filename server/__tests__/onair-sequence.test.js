/** player/onair/sequence.html: rotation includes Weather Visuals' NAR weather screen, same fade/hold as the other slots. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'player', 'onair', 'sequence.html'), 'utf8');

function run(search) {
  const frames = [];
  const doc = { body: { appendChild: (f) => frames.push(f) }, createElement: () => ({ setAttribute() {}, classList: { add() {}, remove() {} }, src: '' }) };
  const timers = [];
  const ctx = { location: { search }, URLSearchParams, document: doc, setTimeout: (fn) => timers.push(fn), setInterval: (fn) => { ctx.tick = fn; } };
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx);
  const seen = [frames[0].src]; frames[0].onload();
  for (let i = 0; i < 5; i++) { ctx.tick(); const f = frames.find((x) => x.onload); seen.push(f.src); f.onload(); timers.splice(0).forEach((t) => t()); timers.splice(0).forEach((t) => t()); }
  return seen;
}

test('default rotation: words, places, weather, halloween, presenter; weather gets no query string', () => {
  expect(run('?demo=1')).toEqual(['words.html?demo=1', 'places.html?demo=1', 'https://weather.wispayr.online/screen/nar', 'halloween.html?demo=1', 'presenter.html?demo=1', 'words.html?demo=1']);
});

test('?pages= still filters; ?weather= override must be https', () => {
  expect(run('?pages=weather,words')).toEqual(['https://weather.wispayr.online/screen/nar', 'words.html', 'https://weather.wispayr.online/screen/nar', 'words.html', 'https://weather.wispayr.online/screen/nar', 'words.html']);
  expect(run('?pages=weather&weather=javascript:alert(1)')[0]).toBe('https://weather.wispayr.online/screen/nar');
});

test('same fade for every slot, no frequency', () => {
  expect(html).toContain('transition: opacity .5s ease');
  expect(html).not.toMatch(/87\.7|\bFM\b/);
});
