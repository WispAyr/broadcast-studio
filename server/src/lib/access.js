/**
 * lib/access.js — who may act on which studio (review 2026-10-10).
 *
 * One rule, used by REST and by the socket layer:
 *   reach   = super_admin → every studio; else home studio ∪ workgroup studios
 *             (routes/workgroups.js accessibleStudios — the same set the studio
 *             picker and /api/me/access show).
 *   write   = any role except `viewer`.
 *
 * Before this, REST write routes on screens/layouts and most socket control
 * events only checked "is logged in", so any account (a viewer included) could
 * take, edit or delete any studio's screens and layouts.
 *
 * Escape hatch: BS_ACCESS_LEGACY_OPEN=1 restores the old behaviour (decisions
 * are still logged as `[access] would deny …`) without a code rollback.
 */

const LEGACY_OPEN = () => process.env.BS_ACCESS_LEGACY_OPEN === '1';

/** Pure decision. `reachable` is a Set of studio ids, or 'all'. */
function decide({ user, reachable, studioIds = [], write = false }) {
  if (!user) return { ok: false, status: 401, reason: 'authentication required' };
  if (write && user.role === 'viewer') return { ok: false, status: 403, reason: 'viewer accounts are read-only' };
  if (user.role === 'super_admin' || reachable === 'all') return { ok: true };
  for (const id of studioIds) {
    if (!id) continue;
    if (!reachable || !reachable.has(id)) return { ok: false, status: 403, reason: 'studio not in your access' };
  }
  return { ok: true };
}

function reachableFor(user) {
  if (!user) return new Set();
  if (user.role === 'super_admin') return 'all';
  // required lazily: workgroups.js creates its tables on load
  const { accessibleStudios } = require('../routes/workgroups');
  const set = new Set(accessibleStudios(user).map((s) => s.id));
  if (user.studio_id) set.add(user.studio_id);
  return set;
}

function canReach(user, studioId) {
  return decide({ user, reachable: reachableFor(user), studioIds: [studioId] }).ok;
}

/** Apply a decision: true = proceed. Logs every denial; legacy mode lets it through. */
function enforce(res, d, what) {
  if (d.ok) return true;
  if (LEGACY_OPEN()) { console.warn(`[access] would deny ${what}: ${d.reason} (BS_ACCESS_LEGACY_OPEN=1)`); return true; }
  console.warn(`[access] denied ${what}: ${d.reason}`);
  if (res) res.status(d.status).json({ error: d.reason });
  return false;
}

/**
 * Express middleware for routes that act on studios. `resolve(req)` returns
 * the studio ids the request touches (missing records resolve to [] so the
 * route's own 404 still answers). Runs after `authenticate`.
 */
function guardStudios(resolve, { write = true } = {}) {
  return (req, res, next) => {
    let studioIds;
    try { studioIds = (resolve(req) || []).filter(Boolean); } catch (e) { return res.status(500).json({ error: e.message }); }
    const d = decide({ user: req.user, reachable: reachableFor(req.user), studioIds, write });
    if (enforce(res, d, `${req.method} ${req.baseUrl || ''}${req.path} by ${req.user?.username || '?'}`)) return next();
  };
}

module.exports = { decide, reachableFor, canReach, enforce, guardStudios, LEGACY_OPEN };
