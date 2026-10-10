// node --test client/src/lib/xpVarsBridge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createXpVarsBridge, bridgeable, postVars } from './xpVarsBridge.js';

test('only xp:* ids are stored and forwarded', () => {
  const b = createXpVarsBridge(); const seen = [];
  b.subscribe((c) => seen.push(c));
  assert.deepEqual(b.publish({ 'xp:studio.clock': { value: { bsOffsetMs: 12 }, liveness: 'live' }, 'home-score': 3, 'xpfoo': 1 }), { 'xp:studio.clock': { value: { bsOffsetMs: 12 }, liveness: 'live' } });
  assert.deepEqual(Object.keys(b.snapshot()), ['xp:studio.clock']);
  assert.equal(seen.length, 1);
  b.publish({ counter: 9 }); assert.equal(seen.length, 1, 'non-xp update notifies nobody');
});

test('same-origin, non-proxied frames only', () => {
  const o = 'https://broadcast.studio.wispayr.online';
  assert.equal(bridgeable('/player/nar/wall.html', o, false), true);
  assert.equal(bridgeable(o + '/player/nar/wall.html?x=1', o, false), true);
  assert.equal(bridgeable('/player/nar/wall.html', o, true), false);
  assert.equal(bridgeable('/api/proxy/fetch?url=https%3A%2F%2Fexample.com', o, false), false);
  assert.equal(bridgeable('https://example.com/page', o, false), false);
  assert.equal(bridgeable('', o, false), false);
});

test('postVars targets the screen origin, never "*"', () => {
  const calls = []; const win = { postMessage: (m, t) => calls.push([m, t]) };
  assert.equal(postVars(win, { 'xp:a': 1 }, 'https://bs.example'), true);
  assert.deepEqual(calls, [[{ bs: 'vars', v: 1, vars: { 'xp:a': 1 } }, 'https://bs.example']]);
  assert.equal(postVars(win, {}, 'https://bs.example'), false);
});
