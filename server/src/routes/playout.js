// ─────────────────────────────────────────────────────────────────────────────
// /api/playout — channels, logs, items, and the operator's four verbs:
// TAKE, CART, MODE, STOP.
//
// Role gating: reads are open to any logged-in user; anything that can reach a
// screen is gated to AIR_ROLES. Pushing a channel onto a public screen stays a
// human act (feedback_bs_live_operator_only) — autopilot lives INSIDE a channel,
// it does not get to choose which screens exist.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const engine = require('../playout/engine');
const clocks = require('../playout/clocks');

const router = express.Router();
const AIR = ['super_admin', 'admin', 'director', 'operator', 'producer'];
const air = requireRole(AIR);

function studioOf(req) {
  const requested = req.query.studio_id || req.body?.studio_id;
  if (requested && req.user?.role === 'super_admin') return String(requested);
  return req.user?.studio_id || String(requested || 'shared');
}

// ── channels ─────────────────────────────────────────────────────────────────
router.get('/channels', authenticate, (req, res) => {
  const rows = engine.Q.channels.all(studioOf(req));
  res.json({ channels: rows.map(c => engine.snapshot(c.id)) });
});

router.post('/channels', authenticate, air, (req, res) => {
  const { name, target_type = 'screen', target_ref, policy = {} } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!['screen', 'screen_group', 'obs'].includes(target_type)) {
    return res.status(400).json({ error: 'target_type must be screen|screen_group|obs' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO playout_channels (id, studio_id, name, target_type, target_ref, policy)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, studioOf(req), name, target_type, target_ref || null, JSON.stringify(policy));
  res.json(engine.snapshot(id));
});

router.get('/channels/:id', authenticate, (req, res) => {
  const snap = engine.snapshot(req.params.id);
  if (!snap) return res.status(404).json({ error: 'not found' });
  res.json(snap);
});

router.patch('/channels/:id', authenticate, air, (req, res) => {
  const ch = engine.Q.channel.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'not found' });
  const sets = [], params = { id: ch.id };
  for (const k of ['name', 'target_ref', 'active_log_id']) {
    if (k in (req.body || {})) { sets.push(`${k} = @${k}`); params[k] = req.body[k]; }
  }
  if ('policy' in (req.body || {})) { sets.push('policy = @policy'); params.policy = JSON.stringify(req.body.policy); }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE playout_channels SET ${sets.join(', ')} WHERE id = @id`).run(params);
  res.json(engine.snapshot(ch.id));
});

// ── logs ─────────────────────────────────────────────────────────────────────
router.post('/channels/:id/logs', authenticate, air, (req, res) => {
  const ch = engine.Q.channel.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'no such channel' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO playout_logs (id, channel_id, studio_id, name, service_day, status)
    VALUES (?, ?, ?, ?, date('now'), 'draft')
  `).run(id, ch.id, ch.studio_id, req.body?.name || `Log ${new Date().toISOString().slice(0, 16)}`);
  // A channel with no active log is a channel that can't do anything, so a freshly
  // created log becomes the active one unless the operator already has one running.
  if (!ch.active_log_id) db.prepare('UPDATE playout_channels SET active_log_id = ? WHERE id = ?').run(id, ch.id);
  res.json({ id, channel_id: ch.id });
});

// ── items ────────────────────────────────────────────────────────────────────
router.post('/logs/:logId/items', authenticate, air, (req, res) => {
  const log = db.prepare('SELECT * FROM playout_logs WHERE id = ?').get(req.params.logId);
  if (!log) return res.status(404).json({ error: 'no such log' });

  const b = req.body || {};
  if (!b.source_ref) return res.status(400).json({ error: 'source_ref required' });

  // Resolve the planned duration from the library so the log times against the
  // asset's TRIM, not its container length. An item whose media isn't playable is
  // still allowed into the log — it just gets caught at cue time and skipped with a
  // reason, which is more useful than a 400 here.
  let dur = b.dur_s ?? null;
  let title = b.title;
  if ((b.source_type || 'media') === 'media') {
    const m = engine.Q.media.get(b.source_ref);
    if (m) {
      if (dur == null) dur = (m.out_s ?? m.duration_s) - (m.in_s || 0);
      if (!title) title = m.name;
    }
  }

  const maxSeq = db.prepare('SELECT COALESCE(MAX(seq),0) s FROM playout_items WHERE log_id = ?').get(log.id).s;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO playout_items (id, log_id, seq, title, source_type, source_ref, start_mode,
                               planned_start, dur_s, segue, overlap_s, hold, is_break)
    VALUES (@id, @log, @seq, @title, @stype, @sref, @smode, @pstart, @dur, @segue, @overlap, @hold, @brk)
  `).run({
    id, log: log.id, seq: b.seq ?? maxSeq + 1,
    title: title || 'Untitled',
    stype: b.source_type || 'media', sref: b.source_ref,
    smode: ['hard', 'soft', 'manual'].includes(b.start_mode) ? b.start_mode : 'soft',
    pstart: b.planned_start || null,
    dur, segue: b.segue === 'xfade' ? 'xfade' : 'cut',
    overlap: b.overlap_s || 0,
    hold: b.hold ? 1 : 0, brk: b.is_break ? 1 : 0,
  });
  res.json({ id });
});

router.patch('/items/:id', authenticate, air, (req, res) => {
  const item = engine.Q.item.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  const sets = [], params = { id: item.id };
  for (const k of ['seq', 'title', 'start_mode', 'planned_start', 'dur_s', 'segue', 'overlap_s', 'hold', 'skip']) {
    if (k in (req.body || {})) {
      sets.push(`${k} = @${k}`);
      params[k] = ['hold', 'skip'].includes(k) ? (req.body[k] ? 1 : 0) : req.body[k];
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  db.prepare(`UPDATE playout_items SET ${sets.join(', ')} WHERE id = @id`).run(params);
  res.json(engine.Q.item.get(item.id));
});

// Reorder. Sent as a whole ordered list of ids — the client already knows the order
// it wants, and doing it atomically avoids a half-reordered log if a request drops.
router.post('/logs/:logId/reorder', authenticate, air, (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids[] required' });
  const upd = db.prepare('UPDATE playout_items SET seq = ? WHERE id = ? AND log_id = ?');
  db.transaction(() => ids.forEach((id, i) => upd.run(i + 1, id, req.params.logId)))();
  res.json({ ok: true });
});

router.delete('/items/:id', authenticate, air, (req, res) => {
  const item = engine.Q.item.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  // An item that already aired is evidence. Deleting it would put a hole in the
  // as-run, so it can be skipped but never removed.
  if (item.aired_at) return res.status(409).json({ error: 'item has aired — it is as-run evidence and cannot be deleted. Skip it instead.' });
  db.prepare('DELETE FROM playout_items WHERE id = ?').run(item.id);
  res.json({ deleted: true });
});

// ── the operator's verbs ─────────────────────────────────────────────────────
router.post('/channels/:id/take', authenticate, air, (req, res) => {
  try { res.json(engine.operatorTake(req.params.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/channels/:id/cart', authenticate, air, (req, res) => {
  try {
    const id = engine.insertNow(req.params.id, req.body?.media_id, { title: req.body?.title });
    res.json({ inserted: id, state: engine.snapshot(req.params.id) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/channels/:id/mode', authenticate, air, (req, res) => {
  try { res.json({ mode: engine.setMode(req.params.id, req.body?.mode) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/channels/:id/stop', authenticate, air, (req, res) => {
  engine.stop(req.params.id);
  res.json(engine.snapshot(req.params.id));
});

// ── as-run — the proof-of-play surface ───────────────────────────────────────
// What actually aired, when, and for how long. Not what was planned.
router.get('/channels/:id/asrun', authenticate, (req, res) => {
  const ch = engine.Q.channel.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'not found' });
  const since = req.query.since || new Date(Date.now() - 24 * 3600e3).toISOString();
  const rows = db.prepare(`
    SELECT i.id, i.title, i.source_ref, i.is_break, i.status, i.aired_at, i.ended_at, i.actual_dur_s,
           i.fail_reason, m.name AS media_name, m.kind AS media_kind
    FROM playout_items i
    LEFT JOIN playout_logs l ON l.id = i.log_id
    LEFT JOIN media_assets m ON m.id = i.source_ref
    WHERE l.channel_id = ? AND i.aired_at IS NOT NULL AND i.aired_at >= ?
    ORDER BY i.aired_at DESC LIMIT 500
  `).all(ch.id, since);
  res.json({ channel: ch.name, since, count: rows.length, asrun: rows });
});

// ── format clocks — the hour, as a shape ─────────────────────────────────────
router.get('/clocks', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM playout_clocks WHERE studio_id = ? ORDER BY name').all(studioOf(req));
  res.json({
    clocks: rows.map(c => ({ ...c, wheel: (() => { try { return JSON.parse(c.wheel || '[]'); } catch { return []; } })() })),
    slot_kinds: clocks.SLOT_KINDS,
  });
});

router.post('/clocks', authenticate, air, (req, res) => {
  const { name, wheel = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO playout_clocks (id, studio_id, name, wheel) VALUES (?, ?, ?, ?)')
    .run(id, studioOf(req), name, JSON.stringify(wheel));
  res.json({ id, name, wheel });
});

router.put('/clocks/:id', authenticate, air, (req, res) => {
  const c = db.prepare('SELECT id FROM playout_clocks WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  db.prepare("UPDATE playout_clocks SET name = COALESCE(@name, name), wheel = COALESCE(@wheel, wheel), updated_at = datetime('now') WHERE id = @id")
    .run({ id: req.params.id, name: req.body?.name ?? null, wheel: req.body?.wheel ? JSON.stringify(req.body.wheel) : null });
  res.json({ ok: true });
});

// Build an hour. The clock does not play — it produces a LOG, which the operator can
// edit before it airs and which the engine plays like any other. Warnings are the
// important part of the response: a slot the clock could not fill is a hole in the
// hour, and it must be seen NOW rather than discovered as a dead deck at :47.
router.post('/clocks/:id/build', authenticate, air, (req, res) => {
  try {
    const built = clocks.build(req.params.id, {
      channelId: req.body?.channel_id,
      startAt: req.body?.start_at,
    });
    if (req.body?.activate) {
      db.prepare('UPDATE playout_channels SET active_log_id = ? WHERE id = ?').run(built.log_id, req.body.channel_id);
    }
    res.json(built);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── proof of play ────────────────────────────────────────────────────────────
// What a sponsor is actually owed: the times their spot was on air, how long it was
// up for, and nothing that didn't happen. Sourced from as-run (written at air), never
// from the plan. Skipped and failed items are INCLUDED and marked as such — a report
// that quietly omits the spot that didn't run is worse than no report.
router.get('/channels/:id/proof-of-play', authenticate, (req, res) => {
  const ch = engine.Q.channel.get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'not found' });

  const from = req.query.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to   = req.query.to   || new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT m.id AS media_id, m.name AS spot, m.kind,
           i.aired_at, i.ended_at, i.actual_dur_s, i.status, i.fail_reason,
           m.duration_s AS booked_dur_s
    FROM playout_items i
    JOIN playout_logs l   ON l.id = i.log_id
    JOIN media_assets m   ON m.id = i.source_ref
    WHERE l.channel_id = ?
      AND (i.is_break = 1 OR m.kind IN ('break', 'promo'))
      AND (i.aired_at IS NOT NULL OR i.status IN ('skipped','failed'))
      AND date(COALESCE(i.aired_at, i.created_at)) BETWEEN ? AND ?
    ORDER BY i.aired_at DESC
  `).all(ch.id, from, to);

  const bySpot = {};
  for (const r of rows) {
    const b = bySpot[r.media_id] ||= { spot: r.spot, media_id: r.media_id, aired: 0, missed: 0, total_s: 0 };
    if (r.status === 'played' || r.status === 'on_air') { b.aired++; b.total_s += r.actual_dur_s || 0; }
    else b.missed++;
  }

  if (req.query.format === 'csv') {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      'spot,kind,aired_at,ended_at,actual_seconds,booked_seconds,status,reason',
      ...rows.map(r => [r.spot, r.kind, r.aired_at, r.ended_at,
        r.actual_dur_s != null ? r.actual_dur_s.toFixed(2) : '',
        r.booked_dur_s != null ? r.booked_dur_s.toFixed(2) : '',
        r.status, r.fail_reason].map(esc).join(',')),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="proof-of-play-${ch.name.replace(/\W+/g, '-')}-${from}_${to}.csv"`);
    return res.send(csv);
  }

  res.json({
    channel: ch.name, from, to,
    summary: Object.values(bySpot),
    plays: rows,
  });
});

module.exports = router;
