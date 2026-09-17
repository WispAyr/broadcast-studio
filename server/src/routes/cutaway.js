/**
 * routes/cutaway.js — Cutaway: an external trigger temporarily takes a screen,
 * then the screen goes back by itself.
 *
 * Named for the broadcast term: cut away to a shot, then cut back. The automatic
 * return is the whole point, so it is owned HERE and not by the thing that fired.
 *
 * WHY THE TRIGGER IS ONLY AN EDGE
 * A camera can tell you "person detected". It cannot be trusted to tell you the
 * event ENDED — a dropped webhook, a Protect restart, a UDM reboot or someone
 * editing the alarm all mean the "over" message never lands, and the failure is
 * a door camera stranded on air, silently, forever. So a trigger carries no
 * duration: it starts or extends a HOLD that this server times out. Losing a
 * trigger costs you a shot you wanted; it cannot cost you a screen you can't
 * get back.
 *
 * That is also why we do not parse the webhook body. The SOURCE is the
 * discriminator (one source per alarm), so an authenticated POST is simply an
 * edge. Protect's payload shape changes between versions; a trigger that breaks
 * on upgrade because we destructured it is a self-inflicted outage. Body is
 * logged raw as evidence, and otherwise ignored.
 *
 * Three timings, all per-rule:
 *   dwell    — how long a hold lasts; each new trigger slides it (lingering keeps the shot)
 *   maxHold  — ceiling from the FIRST trigger; a jammed zone cannot own a screen
 *   cooldown — measured from the start of the last hold; a busy door cannot flap the wall
 *
 * Cutaways RESPECT the `accepts_broadcasts` padlock, unlike blackout, which
 * ignores it by design. Blackout is a safety cut; a door camera is not, and must
 * never override a screen an operator deliberately locked.
 *
 * Cutaways ship DISARMED. Nothing reaches a live screen until an operator arms it.
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');
const claims = require('../screen-claims');

const router = express.Router();

const DEFAULTS = { dwell_ms: 20000, max_hold_ms: 180000, cooldown_ms: 10000 };

(function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cutaway_sources (
      id          TEXT PRIMARY KEY,
      studio_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      key_hash    TEXT NOT NULL,
      key_prefix  TEXT NOT NULL,
      active      INTEGER DEFAULT 1,
      last_seen_at TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cutaways (
      id            TEXT PRIMARY KEY,
      studio_id     TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      name          TEXT NOT NULL,
      scope         TEXT NOT NULL DEFAULT 'screen',   -- 'screen' | 'group' | 'studio'
      target_id     TEXT,                             -- screen.id | screen_groups.id | NULL for studio
      action        TEXT NOT NULL DEFAULT 'overlay',  -- 'overlay' (PIP over programme) | 'layout' (full take)
      layout_id     TEXT,                             -- action='layout'
      overlay       TEXT,                             -- action='overlay': JSON payload
      dwell_ms      INTEGER NOT NULL DEFAULT 20000,
      max_hold_ms   INTEGER NOT NULL DEFAULT 180000,
      cooldown_ms   INTEGER NOT NULL DEFAULT 10000,
      armed         INTEGER NOT NULL DEFAULT 0,       -- ships disarmed, always
      last_fired_ms INTEGER,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cutaway_events (
      id         TEXT PRIMARY KEY,
      cutaway_id TEXT,
      source_id  TEXT NOT NULL,
      at         TEXT DEFAULT (datetime('now')),
      at_ms      INTEGER NOT NULL,
      outcome    TEXT NOT NULL,   -- fired | extended | suppressed_* | no_targets
      detail     TEXT,
      raw        TEXT
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_cutaway_events_at ON cutaway_events(at_ms DESC)');
})();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function logEvent(sourceId, cutawayId, outcome, detail, raw) {
  db.prepare('INSERT INTO cutaway_events (id, cutaway_id, source_id, at_ms, outcome, detail, raw) VALUES (?,?,?,?,?,?,?)')
    .run(uuidv4(), cutawayId || null, sourceId, Date.now(), outcome, detail || null, raw ? JSON.stringify(raw).slice(0, 4000) : null);
}

/** Resolve a rule's scope to concrete screens. */
function targetsFor(rule) {
  if (rule.scope === 'screen') {
    return db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE id = ?').all(rule.target_id);
  }
  if (rule.scope === 'group') {
    return db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE group_id = ?').all(rule.target_id);
  }
  return db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE studio_id = ?').all(rule.studio_id);
}

// ── Rate limit ───────────────────────────────────────────────────────────────
// A trigger endpoint that can move on-air screens should not be freely
// hammerable even by a caller holding the key. Cheap in-memory bucket; the real
// protection against flapping is per-rule cooldown, this just caps the damage.
const hits = new Map();
function rateLimited(sourceId, limit = 30, windowMs = 10000) {
  const t = Date.now();
  const arr = (hits.get(sourceId) || []).filter(ts => t - ts < windowMs);
  arr.push(t);
  hits.set(sourceId, arr);
  return arr.length > limit;
}

// ── POST /api/cutaway/trigger/:sourceId ──────────────────────────────────────
// The webhook. Protect Alarm Manager points here. Deliberately NOT `authenticate`
// (no JWT): machine caller, own credential, fail-CLOSED.
router.post('/trigger/:sourceId', (req, res) => {
  try {
    const source = db.prepare('SELECT * FROM cutaway_sources WHERE id = ?').get(req.params.sourceId);
    if (!source || !source.active) return res.status(404).json({ error: 'Unknown or inactive cutaway source' });

    // Fail CLOSED. (routes/nuro.js does `if (!token) return true` — dev-mode
    // fail-open. Not here: this endpoint moves what is on air.)
    const hdr = req.headers['x-cutaway-key'] || req.headers['authorization'] || '';
    const provided = String(hdr).startsWith('Bearer ') ? String(hdr).slice(7) : String(hdr);
    const ok = provided.length > 0 &&
      crypto.timingSafeEqual(Buffer.from(sha256(provided), 'hex'), Buffer.from(source.key_hash, 'hex'));
    if (!ok) {
      logEvent(source.id, null, 'suppressed_bad_key', 'rejected trigger', null);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (rateLimited(source.id)) {
      logEvent(source.id, null, 'suppressed_rate_limit', null, null);
      return res.status(429).json({ error: 'Rate limited' });
    }

    db.prepare("UPDATE cutaway_sources SET last_seen_at = datetime('now') WHERE id = ?").run(source.id);

    const rules = db.prepare('SELECT * FROM cutaways WHERE source_id = ?').all(source.id);
    if (!rules.length) {
      logEvent(source.id, null, 'no_rules', 'source fired but no cutaway rules bound', req.body);
      return res.json({ message: 'Accepted — no cutaway rules bound to this source', applied: 0 });
    }

    const t = Date.now();
    const results = [];

    for (const rule of rules) {
      if (!rule.armed) {
        logEvent(source.id, rule.id, 'suppressed_disarmed', rule.name, null);
        results.push({ cutaway: rule.name, outcome: 'suppressed_disarmed' });
        continue;
      }

      const targets = targetsFor(rule);
      if (!targets.length) {
        logEvent(source.id, rule.id, 'no_targets', rule.name, null);
        results.push({ cutaway: rule.name, outcome: 'no_targets' });
        continue;
      }

      let applied = 0, locked = 0, outranked = 0;
      const extending = targets.some(s => claims.held(s.id, 'cutaway'));

      // Cooldown gates STARTING a hold, never extending one — a person lingering
      // in the zone should keep the shot up, not be throttled out of it.
      if (!extending && rule.last_fired_ms && (t - rule.last_fired_ms) < rule.cooldown_ms) {
        logEvent(source.id, rule.id, 'suppressed_cooldown', `${t - rule.last_fired_ms}ms since last hold started`, null);
        results.push({ cutaway: rule.name, outcome: 'suppressed_cooldown' });
        continue;
      }

      for (const scr of targets) {
        // Respect the padlock. A door camera is not a safety cut.
        if (!scr.accepts_broadcasts) { locked++; continue; }

        // Do not claim underneath a blackout/emergency. We could — the resolver
        // would correctly keep it hidden — but the claim would still be live when
        // the operator restores, so the door camera would pop up the instant they
        // cleared the blackout. Refusing is the honest, predictable behaviour.
        if (claims.held(scr.id, 'blackout') || claims.held(scr.id, 'emergency')) { outranked++; continue; }

        claims.claim({
          screenId: scr.id,
          layer: 'cutaway',
          source: `cutaway:${rule.id}`,
          layoutId: rule.action === 'layout' ? rule.layout_id : null,
          overlay: rule.action === 'overlay' ? JSON.parse(rule.overlay || '{}') : null,
          ttlMs: rule.dwell_ms,
          maxHoldMs: rule.max_hold_ms,
        });
        claims.applyScreen(scr.id);
        applied++;
      }

      if (!extending && applied) {
        db.prepare('UPDATE cutaways SET last_fired_ms = ? WHERE id = ?').run(t, rule.id);
      }

      const outcome = applied ? (extending ? 'extended' : 'fired')
        : (outranked ? 'suppressed_blackout' : locked ? 'suppressed_locked' : 'no_targets');
      logEvent(source.id, rule.id, outcome, `applied=${applied} locked=${locked} outranked=${outranked}`, extending ? null : req.body);
      results.push({ cutaway: rule.name, outcome, applied, locked, outranked });
    }

    res.json({ message: 'Trigger accepted', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sources ──────────────────────────────────────────────────────────────────
router.get('/sources', authenticate, (req, res) => {
  const studioId = req.query.studio_id || req.user.studio_id;
  const rows = db.prepare('SELECT id, studio_id, name, key_prefix, active, last_seen_at, created_at FROM cutaway_sources WHERE studio_id = ?').all(studioId);
  res.json(rows);
});

// The secret is shown ONCE, here, and never again — only its hash is stored.
router.post('/sources', authenticate, (req, res) => {
  try {
    const studioId = req.body.studio_id || req.user.studio_id;
    const { name } = req.body;
    if (!studioId || !name) return res.status(400).json({ error: 'studio_id and name are required' });

    const secret = crypto.randomBytes(32).toString('base64url');
    const id = uuidv4();
    db.prepare('INSERT INTO cutaway_sources (id, studio_id, name, key_hash, key_prefix) VALUES (?,?,?,?,?)')
      .run(id, studioId, name, sha256(secret), secret.slice(0, 8));

    res.status(201).json({
      id, name, studio_id: studioId,
      key: secret,
      key_note: 'Shown once. Store it now — only a hash is kept.',
      webhook_url: `/api/cutaway/trigger/${id}`,
      header: 'X-Cutaway-Key: <key>',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Rules ────────────────────────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const studioId = req.query.studio_id || req.user.studio_id;
  res.json(db.prepare('SELECT * FROM cutaways WHERE studio_id = ?').all(studioId));
});

router.post('/', authenticate, (req, res) => {
  try {
    const studioId = req.body.studio_id || req.user.studio_id;
    const {
      source_id, name, scope = 'screen', target_id = null,
      action = 'overlay', layout_id = null, overlay = null,
      dwell_ms = DEFAULTS.dwell_ms, max_hold_ms = DEFAULTS.max_hold_ms, cooldown_ms = DEFAULTS.cooldown_ms,
    } = req.body || {};

    if (!studioId || !source_id || !name) return res.status(400).json({ error: 'studio_id, source_id and name are required' });
    if (!['screen', 'group', 'studio'].includes(scope)) return res.status(400).json({ error: 'scope must be screen|group|studio' });
    if (scope !== 'studio' && !target_id) return res.status(400).json({ error: `scope '${scope}' needs a target_id` });
    if (action === 'layout' && !layout_id) return res.status(400).json({ error: "action 'layout' needs a layout_id" });
    if (action === 'overlay' && !overlay) return res.status(400).json({ error: "action 'overlay' needs an overlay payload" });

    const id = uuidv4();
    db.prepare(`INSERT INTO cutaways (id, studio_id, source_id, name, scope, target_id, action, layout_id, overlay, dwell_ms, max_hold_ms, cooldown_ms, armed)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`)
      .run(id, studioId, source_id, name, scope, target_id, action, layout_id,
           overlay ? JSON.stringify(overlay) : null, dwell_ms, max_hold_ms, cooldown_ms);

    res.status(201).json({ ...db.prepare('SELECT * FROM cutaways WHERE id = ?').get(id), note: 'Created DISARMED — arm it when you want it on air.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Arm / disarm / retune.
router.patch('/:id', authenticate, (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM cutaways WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Not found' });

    const fields = ['name', 'scope', 'target_id', 'action', 'layout_id', 'dwell_ms', 'max_hold_ms', 'cooldown_ms', 'armed'];
    const sets = [], vals = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(f === 'armed' ? (req.body[f] ? 1 : 0) : req.body[f]); }
    }
    if (req.body.overlay !== undefined) { sets.push('overlay = ?'); vals.push(JSON.stringify(req.body.overlay)); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    db.prepare(`UPDATE cutaways SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id);

    // Disarming drops any hold this rule is currently keeping up, rather than
    // leaving the shot on air until it happens to time out.
    if (req.body.armed === false || req.body.armed === 0) {
      for (const scr of targetsFor(rule)) {
        const c = db.prepare('SELECT source FROM screen_claims WHERE screen_id = ? AND layer = ?').get(scr.id, 'cutaway');
        if (c && c.source === `cutaway:${rule.id}`) { claims.release(scr.id, 'cutaway'); claims.applyScreen(scr.id); }
      }
    }
    res.json(db.prepare('SELECT * FROM cutaways WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM cutaways WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ── Manual operator controls ─────────────────────────────────────────────────
// The UI cannot fire a rule the way Protect does: the webhook key is hashed and
// never stored, which is the point. So the operator's "cut now" is its own
// authenticated action.
//
// Manual fire works even when the rule is DISARMED. `armed` gates the AUTOMATIC
// trigger — it means "don't let the door decide". An operator deliberately
// pressing a button is not the door deciding. Padlock and blackout are still
// honoured: those are about the screen, not about who asked.
router.post('/:id/fire', authenticate, (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM cutaways WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Not found' });

    let applied = 0, locked = 0, outranked = 0;
    for (const scr of targetsFor(rule)) {
      if (!scr.accepts_broadcasts) { locked++; continue; }
      if (claims.held(scr.id, 'blackout') || claims.held(scr.id, 'emergency')) { outranked++; continue; }
      claims.claim({
        screenId: scr.id,
        layer: 'cutaway',
        source: `cutaway:${rule.id}`,
        layoutId: rule.action === 'layout' ? rule.layout_id : null,
        overlay: rule.action === 'overlay' ? JSON.parse(rule.overlay || '{}') : null,
        ttlMs: rule.dwell_ms,
        maxHoldMs: rule.max_hold_ms,
      });
      claims.applyScreen(scr.id);
      applied++;
    }
    logEvent(rule.source_id, rule.id, applied ? 'fired_manual' : (outranked ? 'suppressed_blackout' : locked ? 'suppressed_locked' : 'no_targets'),
      `by ${req.user?.username || 'operator'} — applied=${applied} locked=${locked} outranked=${outranked}`, null);
    res.json({ message: applied ? 'Cut' : 'Nothing applied', applied, locked, outranked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Give the screens back NOW rather than waiting out the dwell.
router.post('/:id/release', authenticate, (req, res) => {
  try {
    const rule = db.prepare('SELECT * FROM cutaways WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Not found' });

    let released = 0;
    for (const scr of targetsFor(rule)) {
      const c = db.prepare('SELECT source FROM screen_claims WHERE screen_id = ? AND layer = ?').get(scr.id, 'cutaway');
      if (c && c.source === `cutaway:${rule.id}`) {
        claims.release(scr.id, 'cutaway');
        claims.applyScreen(scr.id);
        released++;
      }
    }
    logEvent(rule.source_id, rule.id, 'released_manual', `by ${req.user?.username || 'operator'} — released=${released}`, null);
    res.json({ message: 'Released', released });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Evidence ─────────────────────────────────────────────────────────────────
// Every decision is logged, including the ones where nothing happened — "why did
// the wall not cut?" is the question you actually have to answer later.
router.get('/events', authenticate, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  res.json(db.prepare(`
    SELECT e.*, c.name AS cutaway_name, s.name AS source_name
      FROM cutaway_events e
      LEFT JOIN cutaways c ON e.cutaway_id = c.id
      LEFT JOIN cutaway_sources s ON e.source_id = s.id
     ORDER BY e.at_ms DESC LIMIT ?`).all(limit));
});

// Live state — what is being held right now, and by what.
router.get('/state', authenticate, (req, res) => {
  const studioId = req.query.studio_id || req.user.studio_id;
  res.json(db.prepare(`
    SELECT sc.screen_id, s.name AS screen_name, sc.layer, sc.source, sc.expires_at_ms
      FROM screen_claims sc JOIN screens s ON s.id = sc.screen_id
     WHERE s.studio_id = ? AND (sc.expires_at_ms IS NULL OR sc.expires_at_ms > ?)
     ORDER BY sc.priority DESC`).all(studioId, Date.now()));
});

module.exports = router;
