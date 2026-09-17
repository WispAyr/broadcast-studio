// ─────────────────────────────────────────────────────────────────────────────
// Format clocks — the hour, as a shape.
//
// A clock is a WHEEL: "at :00 an ident, then a segment, at :15 a break, at :30 a
// junction you must hit, filler to the end." It does NOT play anything. It BUILDS
// A LOG, and the log plays. That separation is the one Myriad makes too, and it
// matters for three reasons:
//   - one runtime, not two (the engine never has to know clocks exist)
//   - the log stays the truth, so the as-run stays complete
//   - an operator can edit the built hour before it airs, which they will
//
// A slot either names a specific asset (ref) or names a KIND ("give me an ident"),
// in which case the clock picks the least-recently-played one that's actually
// playable. That's what stops the same sting running four times in an hour.
// ─────────────────────────────────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

db.exec(`
  CREATE TABLE IF NOT EXISTS playout_clocks (
    id         TEXT PRIMARY KEY,
    studio_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    wheel      TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Slot kinds map onto media kinds, except `junction` — which is a TIME, not a thing.
// A junction is "you will be here at :30", and the item that lands on it is whatever
// the slot names (usually an ident). Hard by definition: that's the whole point of it.
const SLOT_KINDS = ['segment', 'ident', 'bumper', 'sting', 'break', 'filler', 'junction', 'promo', 'vt'];

// The pool a kind-slot draws from. Least-recently-played first, and only things that
// can actually air — ready, mastered, unexpired. An expired sponsor spot is invisible
// to the clock, which is how a campaign ends by itself rather than by someone
// remembering to remove it.
const pickByKind = db.prepare(`
  SELECT * FROM media_assets
  WHERE studio_id = @studio AND kind = @kind
    AND ready = 1 AND master_path IS NOT NULL
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    AND id NOT IN (SELECT value FROM json_each(@used))
  ORDER BY COALESCE(last_played_at, '1970') ASC
  LIMIT 1
`);

const getMedia = db.prepare('SELECT * FROM media_assets WHERE id = ?');

function effDur(m) { return (m.out_s ?? m.duration_s) - (m.in_s || 0); }

/**
 * Build a log from a clock.
 *
 * Returns { log_id, items, warnings } — warnings matter: a slot the clock could not
 * fill is a hole in the hour, and the operator must SEE it now rather than discover
 * it as a dead deck at :47.
 */
function build(clockId, { channelId, startAt }) {
  const clock = db.prepare('SELECT * FROM playout_clocks WHERE id = ?').get(clockId);
  if (!clock) throw new Error('no such clock');

  const ch = db.prepare('SELECT * FROM playout_channels WHERE id = ?').get(channelId);
  if (!ch) throw new Error('no such channel');

  let wheel;
  try { wheel = JSON.parse(clock.wheel || '[]'); } catch { throw new Error('clock wheel is not valid JSON'); }
  if (!wheel.length) throw new Error('clock has no slots');

  // Default to the next top of the hour — the only start time anyone ever actually
  // wants, and the one a junction is measured against.
  const start = startAt ? new Date(startAt) : (() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  })();
  if (isNaN(start)) throw new Error('startAt is not a valid time');

  const logId = uuidv4();
  db.prepare(`
    INSERT INTO playout_logs (id, channel_id, studio_id, name, service_day, status)
    VALUES (?, ?, ?, ?, date('now'), 'draft')
  `).run(logId, ch.id, ch.studio_id, `${clock.name} — ${start.toISOString().slice(11, 16)}`);

  const insert = db.prepare(`
    INSERT INTO playout_items (id, log_id, seq, title, source_type, source_ref,
                               start_mode, planned_start, dur_s, segue, overlap_s, hold, is_break)
    VALUES (@id, @log, @seq, @title, 'media', @ref, @smode, @pstart, @dur, @segue, @overlap, @hold, @brk)
  `);

  const used = [];           // don't hand the same asset to two slots in one hour
  const items = [], warnings = [];
  let seq = 1;

  const sorted = [...wheel].sort((a, b) => (a.at_s || 0) - (b.at_s || 0));

  for (const slot of sorted) {
    const kind = slot.kind;
    if (!SLOT_KINDS.includes(kind)) { warnings.push(`unknown slot kind "${kind}" — skipped`); continue; }

    // Resolve the asset. An explicit ref wins; otherwise draw from the kind's pool.
    let m = null;
    if (slot.ref) {
      m = getMedia.get(slot.ref);
      if (!m) { warnings.push(`slot at ${slot.at_s}s names media ${slot.ref}, which is not in the library`); continue; }
    } else {
      // A junction slot with no ref is a bare time marker — it needs something to land
      // on, so it draws an ident by default.
      // `segment` is a slot word, not a media word — the library calls that a clip.
      // A junction with no named asset lands on an ident.
      const pool = kind === 'junction' ? 'ident' : kind === 'segment' ? 'clip' : kind;
      m = pickByKind.get({ studio: ch.studio_id, kind: pool, used: JSON.stringify(used) });
      if (!m) {
        warnings.push(`nothing playable of kind "${pool}" for the slot at ${slot.at_s}s — HOLE IN THE HOUR`);
        continue;
      }
    }
    used.push(m.id);

    // A junction is a time you must hit. Everything else flows.
    const hard = kind === 'junction' || !!slot.hard;
    const planned = new Date(start.getTime() + (slot.at_s || 0) * 1000).toISOString();

    let dur = effDur(m);
    // min_s/max_s are the clock's opinion about how long this slot should run. They
    // trim, they don't stretch — you cannot make a 20s ident fill a 3-minute hole,
    // and pretending otherwise is how you get dead air.
    if (slot.max_s && dur > slot.max_s) dur = slot.max_s;
    if (slot.min_s && dur < slot.min_s) {
      warnings.push(`"${m.name}" is ${dur.toFixed(0)}s but the slot at ${slot.at_s}s wants at least ${slot.min_s}s`);
    }

    const id = uuidv4();
    insert.run({
      id, log: logId, seq: seq++,
      title: m.name,
      ref: m.id,
      smode: hard ? 'hard' : 'soft',
      pstart: hard ? planned : null,
      dur,
      segue: slot.segue === 'xfade' ? 'xfade' : 'cut',
      overlap: slot.overlap_s || 0,
      hold: hard ? 1 : 0,          // you don't let autopilot reorder a junction
      brk: kind === 'break' ? 1 : 0,
    });
    items.push({ id, seq: seq - 1, kind, title: m.name, dur_s: dur, hard, planned_start: hard ? planned : null });
  }

  if (!items.length) {
    db.prepare('DELETE FROM playout_logs WHERE id = ?').run(logId);
    throw new Error('the clock built an empty hour — nothing in the library matched any slot');
  }

  return {
    log_id: logId,
    name: `${clock.name} — ${start.toISOString().slice(11, 16)}`,
    starts_at: start.toISOString(),
    total_s: items.reduce((a, i) => a + (i.dur_s || 0), 0),
    items,
    warnings,
  };
}

module.exports = { build, SLOT_KINDS };
