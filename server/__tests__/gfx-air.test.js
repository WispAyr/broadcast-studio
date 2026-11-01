/**
 * gfx-air: intranet Graphics Studio → one screen. Off by default; keyed; allow-listed screens; intranet player only;
 * padlock and offline screens refused; one graphic per slot; clear always possible.
 */
const express = require('express');
const http = require('http');
const Database = require('better-sqlite3');
const { makeGfxAir, urlOk, config } = require('../src/routes/gfx-air');

const KEY = 'k'.repeat(32);
const ORIGIN = 'https://intranet.example.org';
const URL_OK = `${ORIGIN}/graphics-player-screen.html?r=abc-123&k=sig&aspect=16%3A9&take=t1&hold=1`;
const ENV_ON = { GFX_AIR_ENABLED: '1', GFX_AIR_KEY: KEY, GFX_AIR_SCREENS: 'scr-1,scr-locked,scr-off', GFX_AIR_ORIGIN: ORIGIN };

function fakeIO(onlineScreens) {
  const emitted = [];
  return {
    emitted,
    io: {
      to: (room) => ({ emit: (ev, data) => emitted.push({ room, ev, data }) }),
      in: (room) => ({ fetchSockets: async () => (onlineScreens.includes(room.replace('screen:', '')) ? [{}] : []) }),
    },
  };
}

async function harness(env) {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE screens (id TEXT PRIMARY KEY, accepts_broadcasts INTEGER)');
  db.prepare('INSERT INTO screens VALUES (?,?)').run('scr-1', 1);
  db.prepare('INSERT INTO screens VALUES (?,?)').run('scr-locked', 0);
  db.prepare('INSERT INTO screens VALUES (?,?)').run('scr-off', 1);
  db.prepare('INSERT INTO screens VALUES (?,?)').run('scr-other', 1);
  const f = fakeIO(['scr-1', 'scr-locked', 'scr-other']);
  const app = express(); app.use(express.json());
  app.use('/api/gfx-air', makeGfxAir({ env, getIO: () => f.io, db }));
  const srv = await new Promise((r) => { const s = http.createServer(app).listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/api/gfx-air`;
  const call = async (p, body, key = KEY) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(key ? { 'x-gfx-air-key': key } : {}) }, body: body && JSON.stringify(body) });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  };
  return { call, emitted: f.emitted, close: () => srv.close() };
}

describe('gfx-air', () => {
  test('off by default: every route is a plain 404 and nothing is emitted', async () => {
    expect(config({}).enabled).toBe(false);
    const h = await harness({ ...ENV_ON, GFX_AIR_ENABLED: '' });
    try {
      expect((await h.call('/take', { screen: 'scr-1', slot: 'l3', take_id: 't1', url: URL_OK })).status).toBe(404);
      expect((await h.call('/state')).status).toBe(404);
      expect(h.emitted).toEqual([]);
    } finally { h.close(); }
  });

  test('url allow list: only the intranet air player on the configured origin', () => {
    const cfg = config(ENV_ON);
    expect(urlOk(cfg, URL_OK)).toBe(true);
    expect(urlOk(cfg, 'https://evil.example/graphics-player-screen.html?r=a&k=b')).toBe(false);
    expect(urlOk(cfg, `${ORIGIN}/other.html?r=a&k=b`)).toBe(false);
    expect(urlOk(cfg, `${ORIGIN}/graphics-player-screen.html?t=name-strap`)).toBe(false);
    expect(urlOk(cfg, `javascript:alert(1)`)).toBe(false);
    expect(urlOk(config({ ...ENV_ON, GFX_AIR_ORIGIN: 'http://intranet.example.org' }), URL_OK.replace('https', 'http'))).toBe(false);
    expect(urlOk(config({ ...ENV_ON, GFX_AIR_ORIGIN: 'http://127.0.0.1:4799' }), 'http://127.0.0.1:4799/graphics-player-screen.html?r=a&k=b')).toBe(true);
    expect(urlOk(config({ ...ENV_ON, GFX_AIR_ORIGIN: '' }), URL_OK)).toBe(false);
  });

  test('take → one screen as gfx_air_<slot>; guards; clear plays it out', async () => {
    const h = await harness(ENV_ON);
    try {
      expect((await h.call('/take', { screen: 'scr-1', slot: 'l3', take_id: 't1', url: URL_OK }, null)).status).toBe(401);
      expect((await h.call('/take', { screen: 'scr-1', slot: 'l3', take_id: 't1', url: URL_OK }, 'x'.repeat(32))).status).toBe(401);
      expect((await h.call('/take', { screen: 'scr-other', slot: 'l3', take_id: 't1', url: URL_OK })).status).toBe(403);
      expect((await h.call('/take', { screen: 'scr-1', slot: 'banner', take_id: 't1', url: URL_OK })).status).toBe(400);
      expect((await h.call('/take', { screen: 'scr-1', slot: 'l3', take_id: 't1', url: 'https://evil.example/x' })).status).toBe(400);
      expect((await h.call('/take', { screen: 'scr-locked', slot: 'l3', take_id: 't1', url: URL_OK })).status).toBe(423);
      const off = await h.call('/take', { screen: 'scr-off', slot: 'l3', take_id: 't1', url: URL_OK });
      expect(off.status).toBe(409); expect(off.j.error).toMatch(/offline/);
      expect(h.emitted).toEqual([]);

      const ok = await h.call('/take', { screen: 'scr-1', slot: 'l3', take_id: 't1', url: URL_OK });
      expect(ok.status).toBe(200); expect(ok.j.screens).toBe(1);
      expect(h.emitted).toEqual([{ room: 'screen:scr-1', ev: 'push_overlay', data: { overlay: { type: 'gfx_air_l3', url: URL_OK, take_id: 't1' } } }]);
      const busy = await h.call('/take', { screen: 'scr-1', slot: 'l3', take_id: 't2', url: URL_OK });
      expect(busy.status).toBe(409);
      expect((await h.call('/state')).j.on_air).toEqual([expect.objectContaining({ screen: 'scr-1', slot: 'l3', take_id: 't1' })]);
      expect((await h.call('/clear', { screen: 'scr-1', slot: 'l3', take_id: 't2' })).status).toBe(409);
      expect((await h.call('/clear', { screen: 'scr-1', slot: 'l3', take_id: 't1' })).status).toBe(200);
      expect(h.emitted.at(-1)).toEqual({ room: 'screen:scr-1', ev: 'remove_overlay', data: { overlayType: 'gfx_air_l3' } });
      // after a restart (no memory) a clear still goes out
      expect((await h.call('/clear', { screen: 'scr-1', slot: 'l3' })).status).toBe(200);
      expect(h.emitted.filter((e) => e.room !== 'screen:scr-1')).toEqual([]);
    } finally { h.close(); }
  });

  test('a short key never enables it', async () => {
    const h = await harness({ ...ENV_ON, GFX_AIR_KEY: 'short' });
    try { expect((await h.call('/state', null, 'short')).status).toBe(401); } finally { h.close(); }
  });
});
