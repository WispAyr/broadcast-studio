/**
 * screen-claims.js — one ordered answer to "what should this screen be showing?"
 *
 * READ THIS BEFORE ADDING A FOURTH THING THAT PUSHES TO A SCREEN.
 *
 * Before this, "temporarily take a screen and give it back" was implemented by
 * SAVING the old layout in a column and restoring it later
 * (`screens.pre_blackout_layout_id`). One save slot serves exactly one takeover.
 * Add a second (trigger-driven Cutaway) and the two corrupt each other:
 *
 *   1. screen shows Programme
 *   2. cutaway fires          -> saves Programme, pushes Door Cam
 *   3. operator hits Blackout -> captures current_layout_id, which is now DOOR CAM
 *   4. cutaway expires        -> restores Programme -> Programme is on air DURING A BLACKOUT
 *   5. operator hits Restore  -> returns to DOOR CAM
 *
 * A convenience feature silently defeating the panic button. So: stop saving.
 *
 * Every temporary thing is now a CLAIM at a priority. A screen shows the
 * highest-priority live claim; with no claims it shows its programme —
 * `screens.current_layout_id`, which a takeover NEVER overwrites. The programme
 * column IS the save slot, so there is nothing to corrupt and takeovers may nest
 * in any order. Blackout during cutaway stays black when the cutaway expires,
 * because the cutaway simply drops out underneath it.
 *
 * Only the TOP layer is in effect. Blackout (900) does not merely outrank a
 * Cutaway (500) for the layout — it suppresses the cutaway's overlay too. A door
 * camera PIP must not survive on top of a safety cut.
 *
 * Expiry is ABSOLUTE TIME IN THE DB swept by tick(), never setTimeout: an
 * in-memory timer strands a screen on the door camera if this process restarts
 * mid-hold. Every pushed overlay ALSO carries `duration`, so the screen clears
 * itself even if this server dies outright. Two independent dead-man switches,
 * because the failure mode here is "wrong thing, on air, forever".
 */

const { v4: uuidv4 } = require('uuid');
const { db, getLayoutById } = require('./db');
const { getIO } = require('./ws');
const { enrichLayout } = require('./lib/enrich-layout');

// Priority ladder. Programme is the implicit floor (no claim row).
const LAYERS = Object.freeze({
  cutaway:   500,   // trigger-driven, ALWAYS expires, respects the padlock
  blackout:  900,   // manual safety cut, never expires, ignores the padlock
  emergency: 1000,  // override everything
});

// Mirrors SYNTHETIC_BLACK in routes/screens.js — the guaranteed floor when a
// studio has no blackout layout of its own. Never persisted.
const SYNTHETIC_BLACK_ID = '__black__';
const SYNTHETIC_BLACK = {
  id: SYNTHETIC_BLACK_ID, name: '⬛ Blackout',
  grid_cols: 1, grid_rows: 1, modules: [], background: '#000000',
};

(function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS screen_claims (
      id            TEXT PRIMARY KEY,
      screen_id     TEXT NOT NULL,
      layer         TEXT NOT NULL,
      priority      INTEGER NOT NULL,
      layout_id     TEXT,             -- take the screen to this layout
      overlay       TEXT,             -- JSON overlay pushed OVER the programme
      source        TEXT,             -- 'blackout' | 'cutaway:<rule id>' | ...
      expires_at_ms INTEGER,          -- epoch ms; NULL = never expires
      max_hold_ms   INTEGER,          -- absolute ceiling, ignores extensions
      created_at_ms INTEGER NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);
  // One claim per layer per screen — re-claiming the same layer extends it
  // rather than stacking duplicates that would each need expiring.
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_screen_claims_layer ON screen_claims(screen_id, layer)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_screen_claims_expiry ON screen_claims(expires_at_ms)');

  const cols = db.prepare('PRAGMA table_info(screens)').all().map(c => c.name);
  // What we last actually pushed, so resolve() is idempotent and we don't spam
  // a screen with identical set_layout on every 5s tick.
  if (!cols.includes('effective_layer')) {
    db.exec("ALTER TABLE screens ADD COLUMN effective_layer TEXT DEFAULT 'programme'");
  }
  if (!cols.includes('effective_layout_id')) {
    db.exec('ALTER TABLE screens ADD COLUMN effective_layout_id TEXT');
  }
})();

const now = () => Date.now();

function layoutFor(layoutId) {
  if (!layoutId) return null;
  if (layoutId === SYNTHETIC_BLACK_ID) return { ...SYNTHETIC_BLACK };
  const l = getLayoutById(layoutId);
  if (!l) return null;
  return { ...l, modules: Array.isArray(l.modules) ? l.modules : JSON.parse(l.modules || '[]') };
}

/** Live (unexpired) claims for a screen, strongest first. */
function liveClaims(screenId) {
  return db.prepare(
    `SELECT * FROM screen_claims
      WHERE screen_id = ? AND (expires_at_ms IS NULL OR expires_at_ms > ?)
      ORDER BY priority DESC, created_at_ms DESC`
  ).all(screenId, now());
}

/** The single claim in effect, or null meaning "show the programme". */
function effectiveClaim(screenId) {
  return liveClaims(screenId)[0] || null;
}

/**
 * Add or extend a claim.
 *   ttlMs      — how long this claim lives from now. null = never expires.
 *   maxHoldMs  — hard ceiling measured from the claim's ORIGINAL creation, so a
 *                trigger that keeps re-firing can't hold a screen forever.
 * Returns the stored claim.
 */
function claim({ screenId, layer, layoutId = null, overlay = null, source = null, ttlMs = null, maxHoldMs = null }) {
  const priority = LAYERS[layer];
  if (!priority) throw new Error(`unknown claim layer: ${layer}`);

  const existing = db.prepare('SELECT * FROM screen_claims WHERE screen_id = ? AND layer = ?').get(screenId, layer);
  const createdAtMs = existing ? existing.created_at_ms : now();

  let expiresAtMs = ttlMs == null ? null : now() + ttlMs;
  // The ceiling wins over any extension. Without this, "extend on every trigger"
  // means a person standing in the zone (or a stuck alarm) owns the screen.
  const ceiling = maxHoldMs != null ? createdAtMs + maxHoldMs : null;
  if (expiresAtMs != null && ceiling != null) expiresAtMs = Math.min(expiresAtMs, ceiling);

  db.prepare(`
    INSERT INTO screen_claims (id, screen_id, layer, priority, layout_id, overlay, source, expires_at_ms, max_hold_ms, created_at_ms)
    VALUES (@id, @screen_id, @layer, @priority, @layout_id, @overlay, @source, @expires_at_ms, @max_hold_ms, @created_at_ms)
    ON CONFLICT(screen_id, layer) DO UPDATE SET
      layout_id = excluded.layout_id,
      overlay = excluded.overlay,
      source = excluded.source,
      expires_at_ms = excluded.expires_at_ms,
      max_hold_ms = excluded.max_hold_ms
  `).run({
    id: existing ? existing.id : uuidv4(),
    screen_id: screenId, layer, priority,
    layout_id: layoutId,
    overlay: overlay ? JSON.stringify(overlay) : null,
    source,
    expires_at_ms: expiresAtMs,
    max_hold_ms: maxHoldMs,
    created_at_ms: createdAtMs,
  });

  return db.prepare('SELECT * FROM screen_claims WHERE screen_id = ? AND layer = ?').get(screenId, layer);
}

function release(screenId, layer) {
  db.prepare('DELETE FROM screen_claims WHERE screen_id = ? AND layer = ?').run(screenId, layer);
}

/** True if a live claim exists on this layer. */
function held(screenId, layer) {
  const c = db.prepare('SELECT expires_at_ms FROM screen_claims WHERE screen_id = ? AND layer = ?').get(screenId, layer);
  return !!c && (c.expires_at_ms == null || c.expires_at_ms > now());
}

/**
 * Push whatever this screen SHOULD be showing, if that differs from what we last
 * pushed. Idempotent — safe to call on every tick and after every claim change.
 * Returns { changed, layer, layoutId }.
 */
function applyScreen(screenId) {
  const screen = db.prepare('SELECT id, studio_id, current_layout_id, effective_layer, effective_layout_id FROM screens WHERE id = ?').get(screenId);
  if (!screen) return { changed: false };

  const eff = effectiveClaim(screenId);
  const layer = eff ? eff.layer : 'programme';
  // An overlay claim leaves the programme layout up and floats over it.
  const wantLayoutId = eff ? (eff.layout_id || screen.current_layout_id) : screen.current_layout_id;

  const sameLayer = screen.effective_layer === layer;
  const sameLayout = (screen.effective_layout_id || null) === (wantLayoutId || null);
  // Overlay claims re-push while live: the payload carries a `duration` dead-man
  // switch that the screen counts down locally, so it must be refreshed or the
  // screen clears itself mid-hold.
  const isLiveOverlay = !!(eff && eff.overlay);
  if (sameLayer && sameLayout && !isLiveOverlay) return { changed: false, layer, layoutId: wantLayoutId };

  const io = getIO();
  const prevLayer = screen.effective_layer;

  // Leaving a layer that floated an overlay — take its overlay down.
  if (prevLayer && prevLayer !== 'programme' && prevLayer !== layer) {
    try { io.to(`screen:${screenId}`).emit('remove_overlay', { overlayType: `claim_${prevLayer}` }); } catch {}
  }

  if (!sameLayout) {
    const layout = layoutFor(wantLayoutId);
    if (layout) {
      const enriched = enrichLayout({ ...layout }, screenId);
      try {
        io.to(`screen:${screenId}`).emit('set_layout', { layoutId: layout.id, layout: enriched, source: `claim:${layer}` });
        io.to(`studio:${screen.studio_id}`).emit('screen_preview', {
          screenId, layoutId: layout.id, layout: enriched, timestamp: new Date().toISOString(),
        });
      } catch {}
    }
  }

  if (eff && eff.overlay) {
    let payload;
    try { payload = JSON.parse(eff.overlay); } catch { payload = null; }
    if (payload) {
      // Second dead-man switch: even if this server dies mid-hold, the screen
      // drops the overlay by itself when `duration` runs out.
      const remainingMs = eff.expires_at_ms != null ? Math.max(0, eff.expires_at_ms - now()) : null;
      const overlay = {
        ...payload,
        type: `claim_${eff.layer}`,
        ...(remainingMs != null ? { duration: Math.ceil(remainingMs / 1000) } : {}),
      };
      try { io.to(`screen:${screenId}`).emit('push_overlay', { overlay }); } catch {}
    }
  }

  db.prepare("UPDATE screens SET effective_layer = ?, effective_layout_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(layer, wantLayoutId || null, screenId);

  return { changed: true, layer, layoutId: wantLayoutId };
}

/** Drop expired claims and re-settle every screen they touched. */
function sweep() {
  const t = now();
  const expired = db.prepare('SELECT DISTINCT screen_id FROM screen_claims WHERE expires_at_ms IS NOT NULL AND expires_at_ms <= ?').all(t);
  if (expired.length) {
    db.prepare('DELETE FROM screen_claims WHERE expires_at_ms IS NOT NULL AND expires_at_ms <= ?').run(t);
    for (const row of expired) {
      try { applyScreen(row.screen_id); } catch (err) {
        console.warn('[claims.sweep] apply failed for', row.screen_id, err.message);
      }
    }
  }
  return expired.length;
}

let started = false;
function start() {
  if (started) return;
  started = true;
  // 2s: the revert is on-air, so a late return is visible. Cheap — the sweep is
  // an indexed lookup that usually matches nothing.
  setInterval(() => { try { sweep(); } catch (err) { console.warn('[claims.sweep]', err.message); } }, 2000);
  // A restart must not strand a screen on a claim that expired while we were down.
  setTimeout(() => { try { sweep(); } catch {} }, 3000);
}

module.exports = {
  LAYERS, SYNTHETIC_BLACK_ID, SYNTHETIC_BLACK,
  claim, release, held, liveClaims, effectiveClaim, applyScreen, sweep, start,
};
