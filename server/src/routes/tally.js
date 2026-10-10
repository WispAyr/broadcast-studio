/**
 * routes/tally.js — ON AIR / MIC LIVE tally for studio screens.
 *
 * The studio-tap relay on the playout PC POSTs its view of the studio to
 * /api/tally/ingest every 2 s and on change. This file owns what that is allowed
 * to do to a screen, and — because a tally light that lies is worse than none —
 * most of it is about what happens when the relay goes quiet.
 *
 * WHAT A SCREEN CAN SHOW (per screen, `screens.tally_mode`)
 *   off       — default. Nothing, ever.
 *   banner    — a red ON AIR / MIC LIVE bar over the programme (content stays up).
 *   takeover  — a full-screen ON AIR / MIC LIVE card, as a CLAIM in the claim stack
 *               (layer `tally`, 400 — see screen-claims.js for why it sits BELOW
 *               cutaway). If the claim cannot be in effect (a cutaway outranks it,
 *               or the screen is padlocked) the screen falls back to the banner, so
 *               the room is never told less than a banner screen would tell it.
 *
 * Nothing reaches any screen unless the tally studio is ARMED and the screen's
 * mode is not `off`. Studios ship DISARMED.
 *
 * UNKNOWN IS NOT OFF, AND STALE IS NOT OFF
 *   studioLive/micLive null  -> show nothing on air (unknown ≠ live); the control
 *                               UI says "unknown" and why.
 *   no ingest for stale_ms   -> studio is LOST. Screens in banner/takeover show a
 *   (default 8 s)               small amber TALLY LOST chip, never a red ON AIR and
 *                               never silence: the last thing we heard might be
 *                               "mic off" and it may no longer be true.
 *
 * THE TAKEOVER CAN NEVER BE STRANDED
 *   Only an ingest creates or extends a tally claim, with a hold of stale_ms. The
 *   1 s loop here only ever RELEASES claims (disarmed / mode changed / not live /
 *   lost). So if the relay stops, the claim expires by itself in the DB sweep; if
 *   this loop dies, the claim still expires; and if this whole server dies, the
 *   pushed overlay carries `duration` and the screen drops it locally. Same three
 *   dead-man switches as a cutaway.
 *
 * BLACKOUT / EMERGENCY suppress every tally overlay (banner, chip and card), the
 * same way blackout suppresses the cutaway PIP. The card is suppressed by the
 * resolver (only the top claim is in effect); the banner/chip by this file
 * checking the claim stack on every evaluation.
 *
 * PADLOCK (`accepts_broadcasts` = 0) blocks the TAKEOVER claim, exactly like a
 * cutaway: a locked screen's programme is not replaced. It does NOT block the
 * banner: the banner never replaces content, is opted into per screen by an
 * operator setting that screen's own tally_mode, and is a warning to the room.
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { getIO } = require('../ws');
const { authenticate } = require('../middleware/auth');
const claims = require('../screen-claims');

const router = express.Router();

const DEFAULT_STALE_MS = Math.max(3000, parseInt(process.env.TALLY_STALE_MS, 10) || 8000);
const NEW_BOOT_WINDOW_MS = 120000;   // same rule as studio-tap PROTOCOL.md replay rule
const REFRESH_MS = 5000;             // periodic re-send of display state to each screen
const LOOP_MS = 1000;
const MODES = ['off', 'banner', 'takeover'];
const SHOWS = ['both', 'on_air', 'mic'];
const CONFIDENCE = ['log', 'api', 'none'];
const WRITE_ROLES = ['super_admin', 'admin', 'producer'];

(function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tally_studios (
      id             TEXT PRIMARY KEY,           -- relay's studio id, e.g. 'studio-1'
      bs_studio_id   TEXT NOT NULL,              -- owning Broadcast Studio studio (tenant scope)
      name           TEXT NOT NULL,
      armed          INTEGER NOT NULL DEFAULT 0, -- ships disarmed, always
      stale_ms       INTEGER NOT NULL DEFAULT ${DEFAULT_STALE_MS},
      state          TEXT,                       -- last accepted {relay, seq, sentAt, tally, feed}
      received_at_ms INTEGER,                    -- server clock at last accepted ingest
      relay_src      TEXT,
      relay_boot     TEXT,
      relay_seq      INTEGER,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tally_keys (
      id           TEXT PRIMARY KEY,
      tally_studio TEXT NOT NULL,
      name         TEXT NOT NULL,
      key_hash     TEXT NOT NULL,
      key_prefix   TEXT NOT NULL,
      active       INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tally_keys_hash ON tally_keys(key_hash)');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tally_events (
      id           TEXT PRIMARY KEY,
      tally_studio TEXT,
      at_ms        INTEGER NOT NULL,
      outcome      TEXT NOT NULL,
      detail       TEXT
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_tally_events_at ON tally_events(at_ms DESC)');

  const cols = db.prepare('PRAGMA table_info(screens)').all().map(c => c.name);
  if (!cols.includes('tally_mode'))   db.exec("ALTER TABLE screens ADD COLUMN tally_mode TEXT DEFAULT 'off'");
  if (!cols.includes('tally_studio')) db.exec('ALTER TABLE screens ADD COLUMN tally_studio TEXT');
  if (!cols.includes('tally_show'))   db.exec("ALTER TABLE screens ADD COLUMN tally_show TEXT DEFAULT 'both'");
})();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const now = () => Date.now();

let evCount = 0;
function logEvent(studioId, outcome, detail) {
  try {
    db.prepare('INSERT INTO tally_events (id, tally_studio, at_ms, outcome, detail) VALUES (?,?,?,?,?)')
      .run(uuidv4(), studioId || null, now(), outcome, detail ? String(detail).slice(0, 500) : null);
    if (++evCount % 200 === 0) {
      db.prepare('DELETE FROM tally_events WHERE id NOT IN (SELECT id FROM tally_events ORDER BY at_ms DESC LIMIT 5000)').run();
    }
  } catch { /* evidence is best-effort; never fail an ingest over it */ }
}

// ── Derived studio status ────────────────────────────────────────────────────
function parseState(row) {
  if (!row || !row.state) return null;
  try { return JSON.parse(row.state); } catch { return null; }
}

/** 'never' (no ingest yet) | 'lost' (stale) | 'ok' */
function statusOf(row, t = now()) {
  if (!row || !row.received_at_ms) return 'never';
  return (t - row.received_at_ms) > (row.stale_ms || DEFAULT_STALE_MS) ? 'lost' : 'ok';
}

function summarise(row, t = now()) {
  const st = parseState(row);
  const status = statusOf(row, t);
  const tally = st?.tally || null;
  return {
    id: row.id, name: row.name, bs_studio_id: row.bs_studio_id,
    armed: !!row.armed, stale_ms: row.stale_ms,
    status,
    received_at_ms: row.received_at_ms || null,
    age_ms: row.received_at_ms ? t - row.received_at_ms : null,
    // Only trust the values while fresh. A lost studio reports null (unknown).
    studioLive: status === 'ok' ? (tally?.studioLive ?? null) : null,
    micLive: status === 'ok' ? (tally?.micLive ?? null) : null,
    last: st,   // raw last-accepted payload, for the control UI (reasons, feed, relay)
    relay: { src: row.relay_src, boot: row.relay_boot, seq: row.relay_seq },
    rejected_count: row.rejected_count,
  };
}

// ── What should one screen show? ─────────────────────────────────────────────
// Returns the payload pushed to the screen as `tally_state`, and whether a
// takeover claim is WANTED (the loop only uses that to release, never to create).
function evaluate(screen, row, t = now()) {
  const off = { v: 1, mode: 'off', banner: null, lost: false, suppressed: false, takeover: false };
  const mode = MODES.includes(screen.tally_mode) ? screen.tally_mode : 'off';
  if (mode === 'off' || !row || !row.armed) return { payload: off, wantClaim: false };
  // Tenant guard: a screen may only follow a tally studio of its own BS studio.
  if (row.bs_studio_id !== screen.studio_id) return { payload: off, wantClaim: false };

  const show = SHOWS.includes(screen.tally_show) ? screen.tally_show : 'both';
  const s = summarise(row, t);
  const onAir = (show === 'both' || show === 'on_air') && s.studioLive === true;
  const micLive = (show === 'both' || show === 'mic') && s.micLive === true;
  const suppressed = claims.held(screen.id, 'blackout') || claims.held(screen.id, 'emergency');
  const lost = s.status !== 'ok';   // 'never' while armed is also "we don't know"

  const wantClaim = mode === 'takeover' && !lost && (onAir || micLive) && !!screen.accepts_broadcasts;

  // The card is showing iff our claim is the one in effect. Anything else (a
  // cutaway on top, padlock, the instant before the claim lands) gets the banner,
  // so a takeover screen never says less than a banner screen would.
  const eff = claims.effectiveClaim(screen.id);
  const cardUp = !!(eff && eff.layer === 'tally');

  const payload = {
    v: 1, mode, studio: row.id, studioName: row.name,
    suppressed,
    lost: !suppressed && lost,
    takeover: !suppressed && cardUp,
    banner: (!suppressed && !lost && !cardUp && (onAir || micLive)) ? { onAir, micLive } : null,
    // Client dead-man: if no refresh within this window the screen replaces any
    // banner with TALLY LOST rather than keep asserting a stale state.
    validMs: REFRESH_MS * 3,
  };
  return { payload, wantClaim, onAir, micLive };
}

const lastSent = new Map();   // screenId -> { json, at }
function emitScreen(screenId, payload, force = false) {
  const json = JSON.stringify(payload);
  const prev = lastSent.get(screenId);
  const t = now();
  // Half a loop of slack so the 1 s tick lands the refresh at ~5 s, not 5-6 s.
  if (!force && prev && prev.json === json && (t - prev.at) < REFRESH_MS - LOOP_MS / 2) return;
  lastSent.set(screenId, { json, at: t });
  try { getIO().to(`screen:${screenId}`).emit('tally_state', payload); } catch {}
}

const screensFollowing = (studioId) => db.prepare(
  "SELECT id, studio_id, tally_mode, tally_studio, tally_show, accepts_broadcasts FROM screens WHERE tally_studio = ?"
).all(studioId);

// Drops the row even if it has already expired but not yet been swept, so the
// claim table never shows a tally hold that is not wanted.
function releaseClaim(screenId) {
  const row = db.prepare("SELECT 1 FROM screen_claims WHERE screen_id = ? AND layer = 'tally'").get(screenId);
  if (row) { claims.release(screenId, 'tally'); claims.applyScreen(screenId); }
}

/**
 * Re-evaluate every screen following `studioId`.
 *   fromIngest = true  -> may CREATE/EXTEND takeover claims (fresh evidence only)
 *   fromIngest = false -> may only RELEASE them
 */
function settleStudio(studioId, { fromIngest = false, force = false } = {}) {
  const row = db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(studioId);
  const t = now();
  for (const scr of screensFollowing(studioId)) {
    const pre = evaluate(scr, row, t);
    if (pre.wantClaim && fromIngest) {
      const hadClaim = claims.held(scr.id, 'tally');
      claims.claim({
        screenId: scr.id, layer: 'tally', source: `tally:${studioId}`,
        overlay: { kind: 'tally', onAir: !!pre.onAir, micLive: !!pre.micLive, studioName: row.name },
        ttlMs: row.stale_ms || DEFAULT_STALE_MS,
        maxHoldMs: null,   // a show lasts hours; freshness of ingest is the bound, not a ceiling
      });
      // Re-push when the card is (or becomes) the top layer; its payload carries
      // the duration dead-man and must be refreshed. Skip when outranked — the
      // resolver will surface it when the higher claim drops.
      const eff = claims.effectiveClaim(scr.id);
      if (!hadClaim || (eff && eff.layer === 'tally')) claims.applyScreen(scr.id);
    } else if (!pre.wantClaim) {
      releaseClaim(scr.id);
    }
    emitScreen(scr.id, evaluate(scr, row, t).payload, force);
  }
}

// Screens whose tally was switched off or pointed elsewhere still need one final
// "off" and any claim dropped. Called from config changes.
function settleScreen(screenId) {
  const scr = db.prepare('SELECT id, studio_id, tally_mode, tally_studio, tally_show, accepts_broadcasts FROM screens WHERE id = ?').get(screenId);
  if (!scr) return;
  const row = scr.tally_studio ? db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(scr.tally_studio) : null;
  const ev = evaluate(scr, row);
  if (!ev.wantClaim) releaseClaim(scr.id);
  const src = claims.liveClaims(scr.id).find(c => c.layer === 'tally');
  if (src && src.source !== `tally:${scr.tally_studio}`) releaseClaim(scr.id);   // re-pointed
  emitScreen(scr.id, evaluate(scr, row).payload, true);
}

// ── The loop: staleness, release, periodic refresh ───────────────────────────
const lastStatus = new Map();   // studioId -> status, for lost/recovered evidence
function tick() {
  const t = now();
  for (const row of db.prepare('SELECT * FROM tally_studios').all()) {
    const st = statusOf(row, t);
    const prev = lastStatus.get(row.id);
    if (prev && prev !== st) {
      if (st === 'lost') logEvent(row.id, 'lost', `no ingest for ${t - row.received_at_ms}ms (stale after ${row.stale_ms}ms)`);
      if (prev === 'lost' && st === 'ok') logEvent(row.id, 'recovered', null);
    }
    lastStatus.set(row.id, st);
    settleStudio(row.id, { fromIngest: false });
  }
  // Belt and braces: any tally claim whose screen no longer asks for takeover.
  for (const c of db.prepare("SELECT screen_id, source FROM screen_claims WHERE layer = 'tally'").all()) {
    const scr = db.prepare('SELECT tally_mode, tally_studio FROM screens WHERE id = ?').get(c.screen_id);
    if (!scr || scr.tally_mode !== 'takeover' || c.source !== `tally:${scr.tally_studio}`) releaseClaim(c.screen_id);
  }
}

let started = false;
function start() {
  if (started) return;
  started = true;
  setInterval(() => { try { tick(); } catch (err) { console.warn('[tally.tick]', err.message); } }, LOOP_MS);
}

// ── Rate limits ──────────────────────────────────────────────────────────────
const buckets = new Map();
function limited(key, limit, windowMs) {
  const t = now();
  const arr = (buckets.get(key) || []).filter(ts => t - ts < windowMs);
  arr.push(t);
  buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear();   // bounded memory under a spray
  return arr.length > limit;
}
const clientIp = (req) => {
  const ra = req.socket?.remoteAddress || '';
  // Behind nginx every caller is loopback; trust X-Real-IP only from loopback.
  if (/^(::ffff:)?127\.|^::1$/.test(ra)) return String(req.headers['x-real-ip'] || ra);
  return ra;
};

// ── Body validation ──────────────────────────────────────────────────────────
const isIso = (s) => typeof s === 'string' && s.length <= 40 && !Number.isNaN(Date.parse(s));
const triBool = (v) => v === true || v === false || v === null;
const shortStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object';
  if (JSON.stringify(body).length > 16384) return 'body too large';
  const { studio, relay, seq, sentAt, tally, feed } = body;
  if (!shortStr(studio, 64) || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(studio)) return 'studio invalid';
  if (!relay || typeof relay !== 'object') return 'relay required';
  if (!shortStr(relay.src, 64)) return 'relay.src invalid';
  if (!shortStr(relay.boot, 64) || relay.boot.length < 4) return 'relay.boot invalid';
  if (relay.version != null && !shortStr(relay.version, 32)) return 'relay.version invalid';
  if (!Number.isSafeInteger(seq) || seq < 1) return 'seq must be a positive integer';
  if (!isIso(sentAt)) return 'sentAt must be ISO-8601';
  if (!tally || typeof tally !== 'object') return 'tally required';
  if (!triBool(tally.studioLive)) return 'tally.studioLive must be true|false|null';
  if (!triBool(tally.micLive)) return 'tally.micLive must be true|false|null';
  if (!Array.isArray(tally.playersOpen) || tally.playersOpen.length > 64 || !tally.playersOpen.every(n => Number.isInteger(n) && n >= 0 && n < 1000)) return 'tally.playersOpen must be int[]';
  if (!Array.isArray(tally.reasons) || tally.reasons.length > 32 || !tally.reasons.every(r => typeof r === 'string' && r.length <= 200)) return 'tally.reasons must be string[]';
  if (!CONFIDENCE.includes(tally.confidence)) return `tally.confidence must be ${CONFIDENCE.join('|')}`;
  if (tally.since != null && !isIso(tally.since)) return 'tally.since must be ISO-8601 or null';
  if (feed != null && typeof feed !== 'object') return 'feed must be an object';
  return null;
}

// ── POST /api/tally/ingest ───────────────────────────────────────────────────
// Machine caller, own credential, fail-CLOSED: with no key configured there is
// nothing a caller can present that matches, so every request is 401.
router.post('/ingest', (req, res) => {
  try {
    const ip = clientIp(req);
    if (limited(`ip:${ip}`, 120, 60000)) return res.status(429).json({ error: 'Rate limited' });

    const hdr = String(req.headers.authorization || '');
    const provided = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
    if (!provided || provided.length < 16 || provided.length > 256) {
      if (limited(`bad:${ip}`, 20, 60000)) return res.status(429).json({ error: 'Rate limited' });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Lookup by hash of the secret: the stored value is a SHA-256 of 32 random
    // bytes, so neither the lookup nor its timing reveals anything usable.
    const key = db.prepare('SELECT * FROM tally_keys WHERE key_hash = ? AND active = 1').get(sha256(provided));
    if (!key) {
      if (limited(`bad:${ip}`, 20, 60000)) return res.status(429).json({ error: 'Rate limited' });
      logEvent(null, 'rejected_bad_key', `from ${ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (limited(`key:${key.id}`, 60, 10000)) {
      logEvent(key.tally_studio, 'rejected_rate_limit', key.name);
      return res.status(429).json({ error: 'Rate limited' });
    }

    const bad = validate(req.body);
    if (bad) {
      logEvent(key.tally_studio, 'rejected_invalid', bad);
      db.prepare('UPDATE tally_studios SET rejected_count = rejected_count + 1 WHERE id = ?').run(key.tally_studio);
      return res.status(400).json({ error: bad });
    }
    const b = req.body;
    // A key belongs to ONE studio. A valid key naming another studio is refused,
    // not re-routed — a mis-pasted key must not light somebody else's wall.
    if (b.studio !== key.tally_studio) {
      logEvent(key.tally_studio, 'rejected_wrong_studio', `key "${key.name}" sent studio=${b.studio}`);
      return res.status(403).json({ error: 'Key is not valid for this studio' });
    }
    const row = db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(b.studio);
    if (!row) return res.status(401).json({ error: 'Unauthorized' });

    // Replay: same (src, boot) -> seq must increase. New src/boot -> accept only
    // if sentAt is within ±120 s, so a captured request from an old boot can't
    // be replayed later (studio-tap PROTOCOL.md replay rule).
    const t = now();
    const sameStream = row.relay_src === b.relay.src && row.relay_boot === b.relay.boot;
    if (sameStream) {
      if (!(b.seq > (row.relay_seq || 0))) {
        db.prepare('UPDATE tally_studios SET rejected_count = rejected_count + 1 WHERE id = ?').run(row.id);
        logEvent(row.id, 'rejected_replay', `seq ${b.seq} <= ${row.relay_seq} (boot ${b.relay.boot})`);
        return res.status(409).json({ error: 'Replay or out-of-order seq', lastSeq: row.relay_seq });
      }
    } else if (Math.abs(t - Date.parse(b.sentAt)) > NEW_BOOT_WINDOW_MS) {
      db.prepare('UPDATE tally_studios SET rejected_count = rejected_count + 1 WHERE id = ?').run(row.id);
      logEvent(row.id, 'rejected_stale_boot', `new boot ${b.relay.boot} but sentAt ${b.sentAt} is >120s from server clock`);
      return res.status(409).json({ error: 'New relay boot with stale sentAt' });
    }

    const prev = parseState(row)?.tally || {};
    const wasLost = statusOf(row, t) !== 'ok';
    const state = {
      relay: { src: b.relay.src, version: b.relay.version || null, boot: b.relay.boot },
      seq: b.seq, sentAt: b.sentAt,
      tally: {
        studioLive: b.tally.studioLive, micLive: b.tally.micLive,
        playersOpen: b.tally.playersOpen, reasons: b.tally.reasons,
        confidence: b.tally.confidence, since: b.tally.since ?? null,
      },
      feed: b.feed == null ? null : (JSON.stringify(b.feed).length <= 4096 ? b.feed : { truncated: true }),
    };
    db.prepare(`UPDATE tally_studios SET state = ?, received_at_ms = ?, relay_src = ?, relay_boot = ?, relay_seq = ? WHERE id = ?`)
      .run(JSON.stringify(state), t, b.relay.src, b.relay.boot, b.seq, row.id);
    db.prepare("UPDATE tally_keys SET last_seen_at = datetime('now') WHERE id = ?").run(key.id);

    if (!sameStream) logEvent(row.id, 'relay_boot', `${b.relay.src} boot ${b.relay.boot} v${b.relay.version || '?'}`);
    if (wasLost && row.received_at_ms) logEvent(row.id, 'recovered', null);
    if (prev.studioLive !== b.tally.studioLive) logEvent(row.id, `studio_${b.tally.studioLive === null ? 'unknown' : b.tally.studioLive ? 'live' : 'off'}`, (b.tally.reasons || []).join('; '));
    if (prev.micLive !== b.tally.micLive) logEvent(row.id, `mic_${b.tally.micLive === null ? 'unknown' : b.tally.micLive ? 'live' : 'off'}`, null);
    lastStatus.set(row.id, 'ok');

    settleStudio(row.id, { fromIngest: true });
    res.json({ ok: true, seq: b.seq, armed: !!row.armed });
  } catch (err) {
    // Never leak internals to a machine caller.
    console.warn('[tally.ingest]', err.message);
    res.status(500).json({ error: 'ingest failed' });
  }
});

// ── Public: what should this screen show? (display payload only) ─────────────
// Screen pages are unauthenticated (like GET /api/screens/:id). This returns the
// derived on-screen state only — no reasons, feed, keys or relay detail — so the
// first paint does not wait for the 5 s socket refresh.
router.get('/screen/:screenId', (req, res) => {
  const scr = db.prepare('SELECT id, studio_id, tally_mode, tally_studio, tally_show, accepts_broadcasts FROM screens WHERE id = ?').get(req.params.screenId);
  if (!scr) return res.status(404).json({ error: 'Screen not found' });
  const row = scr.tally_studio ? db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(scr.tally_studio) : null;
  res.set('Cache-Control', 'no-store');
  res.json(evaluate(scr, row).payload);
});

// ── Admin ────────────────────────────────────────────────────────────────────
function scopeStudio(req, res) {
  const asked = req.query.studio_id || req.body?.studio_id || null;
  if (req.user.role === 'super_admin') {
    const sid = asked || req.user.studio_id;
    if (!sid) { res.status(400).json({ error: 'studio_id is required' }); return null; }
    return sid;
  }
  if (asked && asked !== req.user.studio_id) { res.status(403).json({ error: 'Not your studio' }); return null; }
  return req.user.studio_id;
}
const canWrite = (req, res) => {
  if (WRITE_ROLES.includes(req.user.role)) return true;
  res.status(403).json({ error: 'Insufficient permissions' });
  return false;
};
function ownStudio(req, res, id) {
  const row = db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(id);
  if (!row) { res.status(404).json({ error: 'Tally studio not found' }); return null; }
  if (req.user.role !== 'super_admin' && row.bs_studio_id !== req.user.studio_id) { res.status(404).json({ error: 'Tally studio not found' }); return null; }
  return row;
}

// Everything the control panel needs, in one poll.
router.get('/state', authenticate, (req, res) => {
  const sid = scopeStudio(req, res); if (!sid) return;
  const t = now();
  const studios = db.prepare('SELECT * FROM tally_studios WHERE bs_studio_id = ? ORDER BY name').all(sid).map(r => ({
    ...summarise(r, t),
    keys: db.prepare('SELECT id, name, key_prefix, active, last_seen_at, created_at FROM tally_keys WHERE tally_studio = ? ORDER BY created_at').all(r.id),
  }));
  const byId = Object.fromEntries(studios.map(s => [s.id, s]));
  const screens = db.prepare('SELECT id, name, studio_id, tally_mode, tally_studio, tally_show, accepts_broadcasts FROM screens WHERE studio_id = ? ORDER BY screen_number, name').all(sid)
    .map(scr => {
      const row = scr.tally_studio ? db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(scr.tally_studio) : null;
      const ev = evaluate(scr, row, t);
      return { ...scr, tally_mode: scr.tally_mode || 'off', tally_show: scr.tally_show || 'both', showing: ev.payload, studio_known: !!byId[scr.tally_studio] };
    });
  const events = db.prepare(`SELECT e.* FROM tally_events e
      LEFT JOIN tally_studios s ON s.id = e.tally_studio
     WHERE s.bs_studio_id = ? OR e.tally_studio IS NULL
     ORDER BY e.at_ms DESC LIMIT ?`).all(sid, Math.min(parseInt(req.query.limit, 10) || 30, 200));
  res.json({ now: t, studios, screens, events });
});

router.post('/studios', authenticate, (req, res) => {
  if (!canWrite(req, res)) return;
  const sid = scopeStudio(req, res); if (!sid) return;
  const { id, name, stale_ms } = req.body || {};
  if (!shortStr(id, 64) || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)) return res.status(400).json({ error: "id must match the relay's studio id, e.g. 'studio-1'" });
  if (!shortStr(name, 100)) return res.status(400).json({ error: 'name is required' });
  if (db.prepare('SELECT 1 FROM tally_studios WHERE id = ?').get(id)) return res.status(409).json({ error: 'Tally studio already exists' });
  const stale = stale_ms == null ? DEFAULT_STALE_MS : Math.min(60000, Math.max(3000, parseInt(stale_ms, 10) || DEFAULT_STALE_MS));
  db.prepare('INSERT INTO tally_studios (id, bs_studio_id, name, armed, stale_ms) VALUES (?,?,?,0,?)').run(id, sid, name, stale);
  logEvent(id, 'created', `by ${req.user.username || 'operator'}`);
  res.status(201).json({ ...summarise(db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(id)), note: 'Created DISARMED — nothing reaches a screen until an operator arms it.' });
});

// Arm / disarm / retune. Disarming takes everything down NOW.
router.patch('/studios/:id', authenticate, (req, res) => {
  if (!canWrite(req, res)) return;
  const row = ownStudio(req, res, req.params.id); if (!row) return;
  const sets = [], vals = [];
  if (req.body.name !== undefined) {
    if (!shortStr(req.body.name, 100)) return res.status(400).json({ error: 'name invalid' });
    sets.push('name = ?'); vals.push(req.body.name);
  }
  if (req.body.stale_ms !== undefined) {
    sets.push('stale_ms = ?'); vals.push(Math.min(60000, Math.max(3000, parseInt(req.body.stale_ms, 10) || DEFAULT_STALE_MS)));
  }
  if (req.body.armed !== undefined) { sets.push('armed = ?'); vals.push(req.body.armed ? 1 : 0); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE tally_studios SET ${sets.join(', ')} WHERE id = ?`).run(...vals, row.id);
  if (req.body.armed !== undefined) logEvent(row.id, req.body.armed ? 'armed' : 'disarmed', `by ${req.user.username || 'operator'}`);
  // Arming only ALLOWS display: a takeover claim still waits for the next fresh
  // ingest (<= 2 s). Disarming releases claims and clears screens immediately.
  settleStudio(row.id, { fromIngest: false, force: true });
  res.json(summarise(db.prepare('SELECT * FROM tally_studios WHERE id = ?').get(row.id)));
});

router.delete('/studios/:id', authenticate, (req, res) => {
  if (!canWrite(req, res)) return;
  const row = ownStudio(req, res, req.params.id); if (!row) return;
  db.prepare('UPDATE tally_studios SET armed = 0 WHERE id = ?').run(row.id);
  settleStudio(row.id, { force: true });
  db.prepare('UPDATE tally_keys SET active = 0 WHERE tally_studio = ?').run(row.id);
  db.prepare('DELETE FROM tally_studios WHERE id = ?').run(row.id);
  logEvent(row.id, 'deleted', `by ${req.user.username || 'operator'}`);
  res.json({ message: 'Deleted' });
});

// The secret is shown ONCE, here, and never again — only its hash is stored.
router.post('/studios/:id/keys', authenticate, (req, res) => {
  if (!canWrite(req, res)) return;
  const row = ownStudio(req, res, req.params.id); if (!row) return;
  const name = shortStr(req.body?.name, 100) ? req.body.name : 'studio-tap relay';
  const secret = crypto.randomBytes(32).toString('base64url');
  const id = uuidv4();
  db.prepare('INSERT INTO tally_keys (id, tally_studio, name, key_hash, key_prefix) VALUES (?,?,?,?,?)')
    .run(id, row.id, name, sha256(secret), secret.slice(0, 8));
  logEvent(row.id, 'key_created', `${name} (${secret.slice(0, 8)}…) by ${req.user.username || 'operator'}`);
  res.status(201).json({
    id, name, studio: row.id, key: secret,
    key_note: 'Shown once. Store it in the relay config now — only a hash is kept.',
    ingest_url: '/api/tally/ingest', header: 'Authorization: Bearer <key>',
  });
});

router.delete('/keys/:keyId', authenticate, (req, res) => {
  if (!canWrite(req, res)) return;
  const key = db.prepare('SELECT * FROM tally_keys WHERE id = ?').get(req.params.keyId);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  if (!ownStudio(req, res, key.tally_studio)) return;
  db.prepare('UPDATE tally_keys SET active = 0 WHERE id = ?').run(key.id);
  logEvent(key.tally_studio, 'key_revoked', `${key.name} (${key.key_prefix}…) by ${req.user.username || 'operator'}`);
  res.json({ message: 'Revoked' });
});

// Per-screen config.
router.put('/screens/:screenId', authenticate, (req, res) => {
  if (!canWrite(req, res)) return;
  const scr = db.prepare('SELECT id, studio_id, tally_mode, tally_studio, tally_show FROM screens WHERE id = ?').get(req.params.screenId);
  if (!scr || (req.user.role !== 'super_admin' && scr.studio_id !== req.user.studio_id)) return res.status(404).json({ error: 'Screen not found' });
  const mode = req.body.tally_mode ?? scr.tally_mode ?? 'off';
  const show = req.body.tally_show ?? scr.tally_show ?? 'both';
  const studio = req.body.tally_studio !== undefined ? (req.body.tally_studio || null) : scr.tally_studio;
  if (!MODES.includes(mode)) return res.status(400).json({ error: `tally_mode must be ${MODES.join('|')}` });
  if (!SHOWS.includes(show)) return res.status(400).json({ error: `tally_show must be ${SHOWS.join('|')}` });
  if (studio) {
    const row = db.prepare('SELECT bs_studio_id FROM tally_studios WHERE id = ?').get(studio);
    if (!row || row.bs_studio_id !== scr.studio_id) return res.status(400).json({ error: 'Unknown tally studio for this screen' });
  }
  if (mode !== 'off' && !studio) return res.status(400).json({ error: 'Pick which studio this screen follows' });
  db.prepare("UPDATE screens SET tally_mode = ?, tally_studio = ?, tally_show = ?, updated_at = datetime('now') WHERE id = ?").run(mode, studio, show, scr.id);
  logEvent(studio || scr.tally_studio, 'screen_config', `${scr.id.slice(0, 8)} -> ${mode}/${show} by ${req.user.username || 'operator'}`);
  settleScreen(scr.id);
  res.json(db.prepare('SELECT id, name, tally_mode, tally_studio, tally_show FROM screens WHERE id = ?').get(scr.id));
});

module.exports = router;
module.exports.start = start;
module.exports._internals = { evaluate, statusOf, validate, tick };
