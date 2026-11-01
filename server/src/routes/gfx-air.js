/**
 * gfx-air: the NAR intranet's Graphics Studio takes a graphic to air on ONE Broadcast Studio screen, and clears it.
 * See docs/gfx-air.md.
 *
 *   POST /api/gfx-air/take   {screen, slot, take_id, url}  → push_overlay {type:'gfx_air_<slot>', url, take_id}
 *   POST /api/gfx-air/clear  {screen, slot, take_id}       → remove_overlay gfx_air_<slot> (the screen plays it out)
 *   GET  /api/gfx-air/state                                → what this server thinks is on each screen/slot
 *
 * OFF unless GFX_AIR_ENABLED=1: when off every route answers 404, exactly as if this file did not exist.
 * When on, every call needs:
 *   - x-gfx-air-key == GFX_AIR_KEY (24+ chars; one shared secret with the intranet, never a user token)
 *   - screen in GFX_AIR_SCREENS (comma-separated screen ids; no studio-wide pushes, ever)
 *   - url under GFX_AIR_ORIGIN + /graphics-player-screen.html (the intranet's signed air player, nothing else)
 *   - the screen unlocked (accepts_broadcasts, the padlock) and online (a socket in screen:<id>), so the intranet
 *     never records a take that no screen showed.
 * Nothing is persisted: a server or screen restart comes back with nothing on air (a take never replays on load).
 */
const crypto = require('crypto');
const express = require('express');

const SLOTS = ['full', 'l3', 'side', 'corner', 'bug'];
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const on = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function config(env = process.env) {
  return {
    enabled: on(env.GFX_AIR_ENABLED),
    key: String(env.GFX_AIR_KEY || ''),
    screens: list(env.GFX_AIR_SCREENS),
    origin: String(env.GFX_AIR_ORIGIN || '').replace(/\/+$/, ''),
  };
}

function keyOk(cfg, got) {
  if (cfg.key.length < 24) return false;
  const a = Buffer.from(cfg.key), b = Buffer.from(String(got || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Only the intranet's own air player, on the configured https origin (http only for localhost dev).
function urlOk(cfg, raw) {
  if (!cfg.origin || typeof raw !== 'string' || raw.length > 2000) return false;
  let u, o;
  try { u = new URL(raw); o = new URL(cfg.origin); } catch { return false; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(o.hostname);
  if (o.protocol !== 'https:' && !(local && o.protocol === 'http:')) return false;
  return u.origin === o.origin && u.pathname === '/graphics-player-screen.html' && u.searchParams.has('r') && u.searchParams.has('k') && !u.username && !u.password;
}

/** Validate a take/clear body. Returns { error, status } or { screen, slot, take_id, url }. */
function check(cfg, body, { needUrl }) {
  const b = body || {};
  if (!ID_RE.test(String(b.screen || ''))) return { status: 400, error: 'screen is required' };
  if (!cfg.screens.includes(b.screen)) return { status: 403, error: 'screen is not on the gfx-air allow list (GFX_AIR_SCREENS)' };
  if (!SLOTS.includes(b.slot)) return { status: 400, error: `slot must be one of ${SLOTS.join(', ')}` };
  if (b.take_id != null && !ID_RE.test(String(b.take_id))) return { status: 400, error: 'bad take_id' };
  if (needUrl) {
    if (!ID_RE.test(String(b.take_id || ''))) return { status: 400, error: 'take_id is required' };
    if (!urlOk(cfg, b.url)) return { status: 400, error: 'url must be the intranet air player on GFX_AIR_ORIGIN' };
  }
  return { screen: b.screen, slot: b.slot, take_id: b.take_id || null, url: b.url };
}

/**
 * @param {object} deps  env, getIO() → socket.io server, db (better-sqlite3) for the padlock, now()
 */
function makeGfxAir({ env = process.env, getIO, db, now = () => new Date().toISOString() } = {}) {
  const router = express.Router();
  const onAir = new Map(); // `${screen}:${slot}` → { take_id, url, at }

  router.use((req, res, next) => {
    const cfg = config(env);
    if (!cfg.enabled) return res.status(404).json({ error: 'Not found' });
    if (!keyOk(cfg, req.get('x-gfx-air-key'))) return res.status(401).json({ ok: false, error: 'bad gfx-air key' });
    req.gfxAir = cfg; next();
  });

  const locked = (screen) => { const s = db.prepare('SELECT accepts_broadcasts FROM screens WHERE id = ?').get(screen); return !s ? 'unknown screen' : !s.accepts_broadcasts ? 'locked' : null; };
  const online = async (screen) => (await getIO().in(`screen:${screen}`).fetchSockets()).length;

  router.post('/take', async (req, res) => {
    const c = check(req.gfxAir, req.body, { needUrl: true });
    if (c.error) return res.status(c.status).json({ ok: false, error: c.error });
    const lk = locked(c.screen);
    if (lk === 'unknown screen') return res.status(404).json({ ok: false, error: 'unknown screen' });
    if (lk) return res.status(423).json({ ok: false, error: 'Screen is locked against broadcasts' });
    const k = `${c.screen}:${c.slot}`, cur = onAir.get(k);
    if (cur && cur.take_id !== c.take_id) return res.status(409).json({ ok: false, error: 'that slot already has a graphic on air: clear it first', on_air: cur.take_id });
    const n = await online(c.screen);
    if (!n) return res.status(409).json({ ok: false, error: 'screen is offline: nothing was shown' });
    const overlay = { type: `gfx_air_${c.slot}`, url: c.url, take_id: c.take_id };
    getIO().to(`screen:${c.screen}`).emit('push_overlay', { overlay });
    onAir.set(k, { take_id: c.take_id, url: c.url, at: now() });
    console.log(`[gfx-air] TAKE ${c.take_id} → screen ${c.screen} slot ${c.slot} (${n} display${n === 1 ? '' : 's'})`);
    res.json({ ok: true, screens: n, overlay_type: overlay.type });
  });

  // Clear is allowed even if this server lost its memory (restart), so the desk can always get a graphic off.
  router.post('/clear', async (req, res) => {
    const c = check(req.gfxAir, req.body, { needUrl: false });
    if (c.error) return res.status(c.status).json({ ok: false, error: c.error });
    const k = `${c.screen}:${c.slot}`, cur = onAir.get(k);
    if (cur && c.take_id && cur.take_id !== c.take_id) return res.status(409).json({ ok: false, error: 'a different graphic is on air in that slot', on_air: cur.take_id });
    getIO().to(`screen:${c.screen}`).emit('remove_overlay', { overlayType: `gfx_air_${c.slot}` });
    onAir.delete(k);
    console.log(`[gfx-air] CLEAR ${c.take_id || '?'} → screen ${c.screen} slot ${c.slot}`);
    res.json({ ok: true });
  });

  router.get('/state', (req, res) => res.json({ ok: true, on_air: [...onAir].map(([k, v]) => ({ screen: k.split(':')[0], slot: k.split(':')[1], ...v })) }));

  return router;
}

module.exports = { makeGfxAir, config, urlOk, check, keyOk, SLOTS };
