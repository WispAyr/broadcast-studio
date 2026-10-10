/**
 * Integration: REST + socket studio guards against a scratch DB (review 2026-10-10).
 *
 * Two studios, A and B. Producer `pa` lives in A; `pab` lives in A and reaches B via
 * a workgroup; `va` is a viewer in A. Checks that cross-studio writes are refused,
 * workgroup reach works, and the socket layer no longer lets anonymous or
 * out-of-studio sockets drive screens.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-access-'));
process.env.BS_DB_PATH = path.join(dir, 'test.db');
process.env.JWT_SECRET = 'test-secret-for-jest';
delete process.env.BS_ACCESS_LEGACY_OPEN;

const jwt = require('jsonwebtoken');
const express = require('express');
const { io: ioc } = require('socket.io-client');
const { db } = require('../src/db');
const { setupWebSocket } = require('../src/ws');
require('../src/routes/workgroups'); // creates workgroup tables
// Schema is spread across route modules (review finding): media.js adds the
// media_assets columns the playout engine (loaded per socket) prepares against.
require('../src/routes/content-fabric'); // creates media_assets (stub)
require('../src/routes/media');          // then adds its columns

const A = 'studio-a', B = 'studio-b';
let server, base, ioServer;
const tok = (u) => jwt.sign(u, process.env.JWT_SECRET, { expiresIn: '1h' });
const users = {
  pa: { id: 'u-pa', username: 'pa', role: 'producer', studio_id: A },
  pab: { id: 'u-pab', username: 'pab', role: 'producer', studio_id: A },
  va: { id: 'u-va', username: 'va', role: 'viewer', studio_id: A },
  sa: { id: 'u-sa', username: 'sa', role: 'super_admin', studio_id: null },
};

async function req(method, url, user, body) {
  const r = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${tok(users[user])}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

beforeAll(async () => {
  for (const [id, name] of [[A, 'Studio A'], [B, 'Studio B']]) {
    db.prepare('INSERT OR IGNORE INTO studios (id, name, slug) VALUES (?, ?, ?)').run(id, name, id);
  }
  for (const u of Object.values(users)) {
    db.prepare('INSERT OR IGNORE INTO users (id, username, password, name, role, studio_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(u.id, u.username, 'x', u.username, u.role, u.studio_id);
  }
  db.prepare("INSERT INTO workgroups (id, name) VALUES ('wg', 'AB')").run();
  db.prepare("INSERT INTO workgroup_studios (id, workgroup_id, studio_id) VALUES ('ws1', 'wg', ?)").run(B);
  db.prepare("INSERT INTO workgroup_members (id, workgroup_id, user_id) VALUES ('wm1', 'wg', 'u-pab')").run();
  db.prepare("INSERT INTO screens (id, studio_id, name, screen_number) VALUES ('scr-a', ?, 'A1', 1), ('scr-b', ?, 'B1', 1)").run(A, B);
  db.prepare("INSERT INTO layouts (id, studio_id, name) VALUES ('lay-a', ?, 'LA'), ('lay-b', ?, 'LB')").run(A, B);

  const app = express();
  app.use(express.json());
  app.use('/api/screens', require('../src/routes/screens'));
  app.use('/api/layouts', require('../src/routes/layouts'));
  server = http.createServer(app);
  ioServer = setupWebSocket(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  ioServer.close();
  await new Promise((r) => server.close(r));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('REST: screens', () => {
  test('producer cannot rename another studio\'s screen', async () => {
    expect((await req('PUT', '/api/screens/scr-b', 'pa', { name: 'x' })).status).toBe(403);
    expect(db.prepare("SELECT name FROM screens WHERE id='scr-b'").get().name).toBe('B1');
  });
  test('producer cannot delete another studio\'s screen', async () => {
    expect((await req('DELETE', '/api/screens/scr-b', 'pa')).status).toBe(403);
    expect(db.prepare("SELECT COUNT(*) n FROM screens WHERE id='scr-b'").get().n).toBe(1);
  });
  test('producer cannot take a layout on another studio\'s screen', async () => {
    expect((await req('POST', '/api/screens/scr-b/layout', 'pa', { layout_id: 'lay-b' })).status).toBe(403);
  });
  test('producer cannot put another studio\'s layout on own screen', async () => {
    expect((await req('POST', '/api/screens/scr-a/layout', 'pa', { layout_id: 'lay-b' })).status).toBe(403);
  });
  test('workgroup member can take a layout on the workgroup studio\'s screen', async () => {
    expect((await req('POST', '/api/screens/scr-b/layout', 'pab', { layout_id: 'lay-b' })).status).toBe(200);
  });
  test('viewer cannot write to own studio', async () => {
    expect((await req('PUT', '/api/screens/scr-a', 'va', { name: 'x' })).status).toBe(403);
  });
  test('studio-wide actions are checked: blackout of another studio refused', async () => {
    expect((await req('POST', '/api/screens/blackout', 'pa', { studio_id: B })).status).toBe(403);
  });
  test('overlay on another studio\'s screen refused', async () => {
    expect((await req('POST', '/api/screens/overlay', 'pa', { screen_id: 'scr-b', overlay: { type: 'x' } })).status).toBe(403);
  });
  test('list: workgroup member sees both studios\' screens', async () => {
    const r = await req('GET', '/api/screens', 'pab');
    expect(r.body.map((s) => s.id).sort()).toEqual(['scr-a', 'scr-b']);
  });
  test('list: plain producer sees only own studio', async () => {
    const r = await req('GET', '/api/screens', 'pa');
    expect(r.body.map((s) => s.id)).toEqual(['scr-a']);
  });
  test('super_admin can act anywhere', async () => {
    expect((await req('PUT', '/api/screens/scr-b', 'sa', { name: 'B1' })).status).toBe(200);
  });
});

describe('REST: layouts', () => {
  test('cross-studio listing by ?studio_id is refused', async () => {
    expect((await req('GET', `/api/layouts?studio_id=${B}`, 'pa')).status).toBe(403);
  });
  test('workgroup listing by ?studio_id is allowed', async () => {
    const r = await req('GET', `/api/layouts?studio_id=${B}`, 'pab');
    expect(r.status).toBe(200);
    expect(r.body.map((l) => l.id)).toContain('lay-b');
  });
  test('cannot edit or delete another studio\'s layout', async () => {
    expect((await req('PUT', '/api/layouts/lay-b', 'pa', { name: 'x' })).status).toBe(403);
    expect((await req('DELETE', '/api/layouts/lay-b', 'pa')).status).toBe(403);
    expect(db.prepare("SELECT name FROM layouts WHERE id='lay-b'").get().name).toBe('LB');
  });
  test('cannot create a layout in another studio', async () => {
    expect((await req('POST', '/api/layouts', 'pa', { name: 'x', studio_id: B })).status).toBe(403);
  });
});

describe('socket', () => {
  const connect = (user) => new Promise((resolve, reject) => {
    const s = ioc(base, { transports: ['websocket'], auth: user ? { token: tok(users[user]) } : {}, reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
  const next = (s, ev, ms = 800) => new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    s.once(ev, (d) => { clearTimeout(t); resolve(d); });
  });
  let screenB;
  beforeAll(async () => {
    screenB = await connect(null);
    screenB.emit('register_screen', { screenId: 'scr-b' });
    await new Promise((r) => setTimeout(r, 150));
  });
  afterAll(() => screenB.close());

  test('anonymous update_module_config is refused and never reaches a screen', async () => {
    const anon = await connect(null);
    const got = next(screenB, 'update_module_config');
    const denied = next(anon, 'control_denied');
    anon.emit('update_module_config', { studioId: B, moduleId: 'm', config: { text: 'pwned' } });
    expect(await denied).toMatchObject({ action: 'update_module_config' });
    expect(await got).toBeNull();
    anon.close();
  });
  test('anonymous socket cannot join a studio room by naming it', async () => {
    const anon = await connect(null);
    anon.emit('register_screen', { screenId: 'no-such-screen', studioId: B });
    anon.emit('join_studio', { studioId: B });
    const preview = next(anon, 'screen_preview');
    const sa = await connect('sa');
    sa.emit('screen_state_update', { screenId: 'scr-b', layoutId: 'lay-b', layout: {} });
    // sa has not joined B; use REST to cause a studio-B preview instead
    await req('POST', '/api/screens/scr-b/layout', 'sa', { layout_id: 'lay-b' });
    expect(await preview).toBeNull();
    anon.close(); sa.close();
  });
  test('producer cannot push a layout to another studio\'s screen', async () => {
    const pa = await connect('pa');
    const got = next(screenB, 'push_layout_transition');
    const denied = next(pa, 'control_denied');
    pa.emit('push_layout_transition', { screenId: 'scr-b', layoutId: 'lay-b' });
    expect(await denied).toMatchObject({ action: 'push_layout_transition' });
    expect(await got).toBeNull();
    pa.close();
  });
  test('workgroup producer can push to the workgroup studio', async () => {
    const pab = await connect('pab');
    const got = next(screenB, 'push_layout_transition');
    pab.emit('push_layout_transition', { screenId: 'scr-b', layoutId: 'lay-b' });
    expect(await got).toMatchObject({ layoutId: 'lay-b' });
    pab.close();
  });
  test('a socket that signs in after connecting can authenticate in place', async () => {
    const s = await connect(null);
    const ok = next(s, 'authenticated');
    s.emit('authenticate', { token: tok(users.pab) });
    expect(await ok).toMatchObject({ ok: true, username: 'pab' });
    const got = next(screenB, 'push_layout_transition');
    s.emit('push_layout_transition', { screenId: 'scr-b', layoutId: 'lay-b' });
    expect(await got).toMatchObject({ layoutId: 'lay-b' });
    s.close();
  });
  test('register_screen logs and emits with the DB studio (no more "studio undefined")', async () => {
    const pab = await connect('pab');
    pab.emit('join_studio', { studioId: B });
    await new Promise((r) => setTimeout(r, 100));
    const status = next(pab, 'screen_status');
    const s = await connect(null);
    s.emit('register_screen', { screenId: 'scr-b' });   // no studioId in the payload, as the real screens send
    expect(await status).toMatchObject({ screenId: 'scr-b', is_online: true });
    s.close(); pab.close();
  });
});

describe('BS_ACCESS_LEGACY_OPEN=1 escape hatch', () => {
  afterAll(() => { delete process.env.BS_ACCESS_LEGACY_OPEN; });
  test('restores the old open behaviour for REST and the previously-open socket events', async () => {
    process.env.BS_ACCESS_LEGACY_OPEN = '1';
    expect((await req('PUT', '/api/screens/scr-b', 'pa', { name: 'B1' })).status).toBe(200);
    const screen = await new Promise((resolve) => { const s = ioc(base, { transports: ['websocket'], reconnection: false }); s.on('connect', () => resolve(s)); });
    screen.emit('register_screen', { screenId: 'scr-b' });
    await new Promise((r) => setTimeout(r, 100));
    const anon = await new Promise((resolve) => { const s = ioc(base, { transports: ['websocket'], reconnection: false }); s.on('connect', () => resolve(s)); });
    const got = new Promise((resolve) => { const t = setTimeout(() => resolve(null), 800); screen.once('update_module_config', (d) => { clearTimeout(t); resolve(d); }); });
    anon.emit('update_module_config', { studioId: B, moduleId: 'm', config: { text: 'legacy' } });
    expect(await got).toMatchObject({ moduleId: 'm' });
    anon.close(); screen.close();
  });
});
