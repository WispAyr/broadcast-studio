// ─────────────────────────────────────────────────────────────────────────────
// /api/media — the playout media library.
//
// This promotes `media_assets` (created inert by Content Fabric CF-1) into the
// real library. That choice is deliberate: CF already gives this table tags,
// collections, visibility and grants for resource_type='media', which IS Myriad's
// category / folder / who-can-use-what model. Building a second media table would
// mean rebuilding all of that.
//
// What a playout library knows that a file browser does not: how long the item
// runs, where it starts and ends, where its intro and tail sit, and how loud it is.
// Those five numbers are what make a segue look professional instead of a cut with
// a gap in it.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const ingest = require('../playout/ingest');

const router = express.Router();
const UPLOADS_DIR = ingest.UPLOADS_DIR;

// ── migration ────────────────────────────────────────────────────────────────
// Additive only. media_assets already exists (id, studio_id, name, path, kind,
// tags, created_at) and is empty, so there is nothing to backfill or break.
const EXISTING = new Set(db.prepare('PRAGMA table_info(media_assets)').all().map(c => c.name));
const COLUMNS = {
  media_type:    "TEXT DEFAULT 'video'",   // technical: video | image | audio
  original_path: 'TEXT',                   // relative to data/uploads
  master_path:   'TEXT',                   // the conformed file the log actually plays
  poster_path:   'TEXT',
  duration_s:    'REAL',
  in_s:          'REAL DEFAULT 0',         // trim in
  out_s:         'REAL',                   // trim out (NULL = to the end)
  intro_s:       'REAL DEFAULT 0',         // safe talkover / lower-third window at the head
  outro_s:       'REAL DEFAULT 0',         // length of the tail — where the next item may overlap
  fade_out_s:    'REAL DEFAULT 0',
  width:         'INTEGER',
  height:        'INTEGER',
  fps:           'REAL',
  vcodec:        'TEXT',
  acodec:        'TEXT',
  has_audio:     'INTEGER DEFAULT 0',
  size_bytes:    'INTEGER',
  lufs:          'REAL',
  true_peak:     'REAL',
  normalised:    'INTEGER DEFAULT 0',
  ready:         'INTEGER DEFAULT 0',
  ingest_status: "TEXT DEFAULT 'new'",     // new|queued|probing|poster|mastering|ready|failed
  ingest_error:  'TEXT',
  expires_at:    'TEXT',                   // an expired sponsor spot must never air
  plays_count:   'INTEGER DEFAULT 0',
  last_played_at:'TEXT',
  private:       'INTEGER DEFAULT 0',    // sponsor/ad content — never served from public /uploads
  notes:         'TEXT',
  updated_at:    'TEXT',
};
for (const [col, decl] of Object.entries(COLUMNS)) {
  if (!EXISTING.has(col)) {
    try { db.exec(`ALTER TABLE media_assets ADD COLUMN ${col} ${decl}`); }
    catch (e) { console.error(`[media] add column ${col} failed:`, e.message); }
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_media_studio ON media_assets(studio_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_media_kind   ON media_assets(studio_id, kind)');

// Editorial roles. `kind` is what the log schedules against — a clock asks for an
// ident, not for "some file". Technical type lives in media_type.
const KINDS = ['clip', 'vt', 'ident', 'bumper', 'sting', 'break', 'filler', 'still', 'promo', 'audio'];

// ── helpers ──────────────────────────────────────────────────────────────────
function studioOf(req) {
  const requested = req.query.studio_id || req.body?.studio_id;
  if (requested && req.user?.role === 'super_admin') return String(requested);
  return req.user?.studio_id || String(requested || 'shared');
}

function urlFor(rel) { return rel ? `/uploads/${rel.split(path.sep).join('/')}` : null; }

// The single number the log times against. Trim wins over container duration.
function effectiveDuration(row) {
  const out = row.out_s ?? row.duration_s;
  if (out == null) return null;
  return Math.max(0, out - (row.in_s || 0));
}

function shape(row) {
  return {
    ...row,
    tags: (() => { try { return JSON.parse(row.tags || '[]'); } catch { return []; } })(),
    // A private asset has no public URL — the engine mints a signed one at cue time.
    url: row.private ? null : urlFor(row.master_path || row.original_path),
    original_url: row.private ? null : urlFor(row.original_path),
    poster_url: row.private ? `/media/poster/${row.id}` : urlFor(row.poster_path),
    effective_duration_s: effectiveDuration(row),
    expired: !!(row.expires_at && new Date(row.expires_at) < new Date()),
  };
}

// ── GET /api/media — the library ─────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    const where = ['studio_id = @studio_id'];
    const params = { studio_id: studioId };

    if (req.query.kind)       { where.push('kind = @kind');             params.kind = req.query.kind; }
    if (req.query.media_type) { where.push('media_type = @media_type'); params.media_type = req.query.media_type; }
    if (req.query.ready === '1') where.push('ready = 1');
    if (req.query.q) { where.push('LOWER(name) LIKE @q'); params.q = `%${String(req.query.q).toLowerCase()}%`; }

    const rows = db.prepare(
      `SELECT * FROM media_assets WHERE ${where.join(' AND ')} ORDER BY created_at DESC`
    ).all(params);

    res.json({ media: rows.map(shape), queue_depth: ingest.queueDepth() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authenticate, (req, res) => {
  const row = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(shape(row));
});

// ── POST /api/media/scan — adopt the files already on disk ───────────────────
// There are 170 files and 708MB in data/uploads that predate the library. Rather
// than ask anyone to re-upload, walk the studio's folder and register what's there.
// Idempotent: keyed on original_path, so re-running only picks up what's new.
router.post('/scan', authenticate, requireRole(['super_admin', 'admin', 'producer']), (req, res) => {
  try {
    const studioId = studioOf(req);
    const folder = req.user?.role === 'super_admin' && req.query.studio_id
      ? path.basename(String(req.query.studio_id))
      : (req.user?.studio_id || 'shared');
    const dir = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(dir)) return res.json({ added: 0, media: [] });

    const known = new Set(
      db.prepare('SELECT original_path FROM media_assets WHERE studio_id = ?').all(studioId)
        .map(r => r.original_path).filter(Boolean)
    );
    const getName = db.prepare('SELECT original_name FROM upload_meta WHERE filename = ?');
    const insert = db.prepare(`
      INSERT INTO media_assets (id, studio_id, name, path, kind, tags, media_type, original_path, ingest_status)
      VALUES (@id, @studio_id, @name, @path, @kind, '[]', @media_type, @original_path, 'new')
    `);

    const added = [];
    for (const filename of fs.readdirSync(dir)) {
      if (filename.startsWith('.') || filename.startsWith('_')) continue;   // _poster / _master are ours
      const abs = path.join(dir, filename);
      let stat; try { stat = fs.statSync(abs); } catch { continue; }
      if (!stat.isFile()) continue;

      const rel = path.join(folder, filename);
      if (known.has(rel)) continue;

      const mediaType = ingest.mediaTypeOf(filename);
      if (mediaType === 'other') continue;

      const id = uuidv4();
      insert.run({
        id, studio_id: studioId,
        name: getName.get(filename)?.original_name || filename,
        path: rel,
        kind: ingest.defaultKind(mediaType),
        media_type: mediaType,
        original_path: rel,
      });
      // Probe + poster only. Mastering is deliberately opt-in — it is the expensive
      // step and this box has 15 other apps on it.
      ingest.enqueue(id, { master: false });
      added.push(id);
    }
    res.json({ added: added.length, queue_depth: ingest.queueDepth() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/media/:id — the cue points ────────────────────────────────────
// This is the editorially load-bearing endpoint: in/out/intro/outro are what the
// engine uses to time a segue.
const EDITABLE = ['name', 'kind', 'in_s', 'out_s', 'intro_s', 'outro_s', 'fade_out_s', 'expires_at', 'notes', 'private'];
router.patch('/:id', authenticate, requireRole(['super_admin', 'admin', 'producer']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });

    const sets = [], params = { id: req.params.id };
    for (const k of EDITABLE) {
      if (!(k in req.body)) continue;
      let v = req.body[k];
      if (k === 'kind' && !KINDS.includes(v)) return res.status(400).json({ error: `kind must be one of ${KINDS.join('|')}` });
      if (['in_s', 'out_s', 'intro_s', 'outro_s', 'fade_out_s'].includes(k)) {
        v = v === null || v === '' ? null : Number(v);
        if (v !== null && (!Number.isFinite(v) || v < 0)) return res.status(400).json({ error: `${k} must be a positive number` });
      }
      sets.push(`${k} = @${k}`); params[k] = v;
    }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });

    // A trim that ends before it starts would hand the engine a negative duration
    // and put a hole in the log. Reject it here, not at air.
    const inS  = 'in_s'  in req.body ? Number(req.body.in_s)  : (row.in_s || 0);
    const outS = 'out_s' in req.body ? (req.body.out_s === null || req.body.out_s === '' ? null : Number(req.body.out_s)) : row.out_s;
    if (outS != null && outS <= inS) return res.status(400).json({ error: 'out_s must be greater than in_s' });
    if (outS != null && row.duration_s && outS > row.duration_s + 0.5) {
      return res.status(400).json({ error: `out_s exceeds the file duration (${row.duration_s.toFixed(1)}s)` });
    }

    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE media_assets SET ${sets.join(', ')} WHERE id = @id`).run(params);

    // Marking an asset private has to MOVE it, not just flag it. The derivatives live
    // under data/uploads, which nginx serves publicly off disk — so a "private" spot
    // whose master is still sitting there is fetchable by anyone who guesses the uuid,
    // and the signed URL protects nothing. Move it out of the served root entirely.
    if ('private' in req.body && (req.body.private ? 1 : 0) !== (row.private ? 1 : 0)) {
      const toPrivate = !!req.body.private;
      const from = toPrivate ? ingest.UPLOADS_DIR : ingest.PRIVATE_DIR;
      const to   = toPrivate ? ingest.PRIVATE_DIR : ingest.UPLOADS_DIR;
      for (const rel of [row.master_path, row.poster_path]) {
        if (!rel) continue;
        const src = path.join(from, rel), dst = path.join(to, rel);
        try {
          if (fs.existsSync(src)) {
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.renameSync(src, dst);
          }
        } catch (e) {
          console.error(`[media] failed to move ${rel} → ${toPrivate ? 'private' : 'public'}:`, e.message);
          return res.status(500).json({ error: `privacy change failed: the file could not be moved (${e.message}). The flag has been reverted so it cannot lie about where the file is.` });
        }
      }
    }

    res.json(shape(db.prepare('SELECT * FROM media_assets WHERE id = ?').get(req.params.id)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/media/:id/ingest — (re)probe, and optionally build the master ──
router.post('/:id/ingest', authenticate, requireRole(['super_admin', 'admin', 'producer']), (req, res) => {
  const row = db.prepare('SELECT id FROM media_assets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  ingest.enqueue(req.params.id, { master: !!req.body?.master });
  res.json({ queued: true, master: !!req.body?.master, queue_depth: ingest.queueDepth() });
});

// ── DELETE /api/media/:id — the row, and the derived files we made ───────────
// The original is left on disk on purpose: /api/uploads owns it, layouts may still
// reference it by URL, and a library delete should not be able to destroy source
// material. Only the poster and master — which this library created — are removed.
router.delete('/:id', authenticate, requireRole(['super_admin', 'admin', 'producer']), (req, res) => {
  const row = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  for (const rel of [row.poster_path, row.master_path]) {
    if (!rel) continue;
    try { fs.unlinkSync(path.join(UPLOADS_DIR, rel)); } catch { /* already gone */ }
  }
  db.prepare('DELETE FROM media_assets WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, original_kept: row.original_path });
});

// A private asset still has to be watchable BY THE CONTROL ROOM — you cannot set the
// out-point of a clip you can't see. So an authenticated operator can mint the same
// short-lived signed link the engine uses. The asset stays off the public web; the
// people who are allowed to cut it to air are allowed to look at it.
router.get('/:id/preview', authenticate, requireRole(['super_admin', 'admin', 'producer', 'director', 'operator']), (req, res) => {
  const m = db.prepare('SELECT id, private, master_path, original_path FROM media_assets WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'not found' });
  if (!m.private) return res.json({ url: urlFor(m.master_path || m.original_path) });
  res.json({ url: require('./media-stream').signedUrl(m.id) });
});

router.get('/meta/kinds', authenticate, (req, res) => res.json({ kinds: KINDS, house: ingest.HOUSE }));

module.exports = router;
