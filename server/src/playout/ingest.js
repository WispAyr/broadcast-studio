// ─────────────────────────────────────────────────────────────────────────────
// Playout ingest — turns a file on disk into a playable media asset.
//
// The rule this file exists to enforce: PLAYOUT PLAYS MASTERS, NOT ORIGINALS.
// A VFR HEVC phone clip, a 60fps .mov and a 25fps .mp4 in the same running order
// will stutter and desync in any deck (browser or OBS). So every asset is probed,
// postered, and — when a master is asked for — transcoded to one house standard.
//
// Work is serialised through a single-slot queue and nice'd: this box also runs
// nginx, postgres and ~15 other pm2 apps, and an ffmpeg that starves them is a
// worse outcome than an ingest that takes a minute longer.
// ─────────────────────────────────────────────────────────────────────────────
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const diskguard = require('./diskguard');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
// Private (sponsor/ad) derivatives live OUTSIDE the nginx-served root entirely.
// A signed URL is worthless if the raw file is still fetchable by guessing the uuid,
// and nginx has no location for this directory — so there is no raw path to guess.
const PRIVATE_DIR = path.join(__dirname, '..', '..', 'data', 'private');

// House master standard. Everything that airs is conformed to this.
// 30fps because that is pu2's OBS Storm canvas — conform to the air canvas, or
// every clip judders on the way out. If the canvas changes, change this.
const HOUSE = {
  width:  parseInt(process.env.PLAYOUT_MASTER_W  || '1920', 10),
  height: parseInt(process.env.PLAYOUT_MASTER_H  || '1080', 10),
  fps:    parseInt(process.env.PLAYOUT_MASTER_FPS || '30', 10),
  lufs:   parseFloat(process.env.PLAYOUT_MASTER_LUFS || '-16'),
};
const NICE = process.env.PLAYOUT_NICE || '15';

const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv|m4v)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

function mediaTypeOf(filename) {
  if (VIDEO_EXT.test(filename)) return 'video';
  if (IMAGE_EXT.test(filename)) return 'image';
  if (AUDIO_EXT.test(filename)) return 'audio';
  return 'other';
}

// Editorial role defaults by technical type. The operator overrides this in the
// library — a 5s video is a sting, a 30s one is an ident, and only they know which.
function defaultKind(mediaType) {
  if (mediaType === 'video') return 'clip';
  if (mediaType === 'image') return 'still';
  if (mediaType === 'audio') return 'sting';
  return 'clip';
}

// ── run a child process, capture stdout/stderr, never inherit the event loop ──
function run(cmd, args, { timeoutMs = 20 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('nice', ['-n', NICE, cmd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    child.stdout.on('data', d => { out += d; });
    // ffmpeg writes everything interesting (including loudnorm's JSON) to stderr,
    // and a long encode can produce a lot of it. Keep only the tail.
    child.stderr.on('data', d => { err = (err + d).slice(-16000); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} exited ${code}: ${err.split('\n').slice(-4).join(' ').trim()}`));
    });
  });
}

// ── ffprobe → the technical truth about a file ───────────────────────────────
async function probe(absPath) {
  const { out } = await run('ffprobe', [
    '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', absPath,
  ]);
  const j = JSON.parse(out);
  const v = (j.streams || []).find(s => s.codec_type === 'video');
  const a = (j.streams || []).find(s => s.codec_type === 'audio');

  // Frame rate arrives as a rational string ("25/1", "30000/1001"). r_frame_rate is
  // the container's nominal rate; for a VFR source it's a lie, but it's the lie the
  // decoder will act on, so it's what we record and what the master conform fixes.
  let fps = null;
  if (v?.r_frame_rate && v.r_frame_rate !== '0/0') {
    const [n, d] = v.r_frame_rate.split('/').map(Number);
    if (d) fps = Math.round((n / d) * 1000) / 1000;
  }

  return {
    duration_s: j.format?.duration ? parseFloat(j.format.duration) : null,
    size_bytes: j.format?.size ? parseInt(j.format.size, 10) : null,
    width:  v?.width  || null,
    height: v?.height || null,
    fps,
    vcodec: v?.codec_name || null,
    acodec: a?.codec_name || null,
    has_audio: a ? 1 : 0,
  };
}

// ── poster: one frame, cheap, the thing the library grid is made of ──────────
async function makePoster(absPath, posterAbs, atSeconds) {
  fs.mkdirSync(path.dirname(posterAbs), { recursive: true });
  // -ss BEFORE -i = input seek: ffmpeg jumps to the keyframe rather than decoding
  // from zero. On a 40-minute file that's the difference between 0.3s and 90s.
  await run('ffmpeg', [
    '-y', '-ss', String(Math.max(0, atSeconds || 0)), '-i', absPath,
    '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', posterAbs,
  ], { timeoutMs: 120000 });
  return fs.existsSync(posterAbs);
}

// ── master: conform to the house standard ────────────────────────────────────
// Everything the log plays points at a master. One resolution, one frame rate,
// one pixel format, one audio layout, moov atom at the head.
async function makeMaster(absPath, masterAbs, meta) {
  fs.mkdirSync(path.dirname(masterAbs), { recursive: true });
  const { width, height, fps, lufs } = HOUSE;

  const args = ['-y', '-i', absPath];

  // A silent asset still needs an audio track. A deck that switches between a
  // clip with audio and a clip without one produces a click at best, and in OBS
  // a dropped audio source at worst. Give every master the same shape.
  if (!meta.has_audio) {
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`, '-shortest');
  }

  args.push(
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
           `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
           `fps=${fps},format=yuv420p`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '20',
    '-g', String(fps * 2), '-keyint_min', String(fps),
    '-r', String(fps),                       // force CFR — the whole point
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    // Single-pass loudnorm: levels the asset AND prints the measured input values
    // to stderr, so we get the LUFS reading without a second decode pass.
    '-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11:print_format=json`,
    '-movflags', '+faststart',               // moov at the head — HTTP can start early
    masterAbs,
  );

  const { err } = await run('ffmpeg', args);

  // loudnorm's JSON is the last brace-block on stderr.
  let measured = null;
  const start = err.lastIndexOf('{');
  if (start >= 0) {
    try {
      const j = JSON.parse(err.slice(start, err.lastIndexOf('}') + 1));
      measured = {
        lufs: parseFloat(j.input_i),
        true_peak: parseFloat(j.input_tp),
      };
    } catch { /* the reading is a nicety; a master without it is still a master */ }
  }
  return { ok: fs.existsSync(masterAbs), measured };
}

// ─────────────────────────────────────────────────────────────────────────────
// The queue. One job at a time, in arrival order.
// ─────────────────────────────────────────────────────────────────────────────
const queue = [];
let running = false;
const listeners = new Set();

function onProgress(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(evt) { for (const fn of listeners) { try { fn(evt); } catch { /* a bad listener must not kill ingest */ } } }

function setStatus(id, status, extra = {}) {
  const cols = ['ingest_status = @status'];
  const params = { id, status, ...extra };
  for (const k of Object.keys(extra)) cols.push(`${k} = @${k}`);
  db.prepare(`UPDATE media_assets SET ${cols.join(', ')} WHERE id = @id`).run(params);
  emit({ id, status, ...extra });
}

function enqueue(assetId, { master = false } = {}) {
  if (queue.some(j => j.assetId === assetId)) return;
  queue.push({ assetId, master });
  setStatus(assetId, 'queued');
  pump();
}

async function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  try {
    await processAsset(job);
  } catch (e) {
    console.error('[ingest] job failed', job.assetId, e.message);
    try { setStatus(job.assetId, 'failed', { ingest_error: String(e.message).slice(0, 500), ready: 0 }); } catch { /* row may be gone */ }
  } finally {
    running = false;
    setImmediate(pump);
  }
}

async function processAsset({ assetId, master }) {
  const row = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(assetId);
  if (!row) throw new Error('asset gone');

  const absOriginal = path.join(UPLOADS_DIR, row.original_path);
  if (!fs.existsSync(absOriginal)) throw new Error(`file missing: ${row.original_path}`);

  setStatus(assetId, 'probing');
  const meta = row.media_type === 'image'
    ? { duration_s: null, size_bytes: fs.statSync(absOriginal).size, width: null, height: null, fps: null, vcodec: null, acodec: null, has_audio: 0 }
    : await probe(absOriginal);

  db.prepare(`
    UPDATE media_assets SET
      duration_s = @duration_s, size_bytes = @size_bytes, width = @width, height = @height,
      fps = @fps, vcodec = @vcodec, acodec = @acodec, has_audio = @has_audio
    WHERE id = @id
  `).run({ id: assetId, ...meta });

  // Poster. Take it a second in — frame zero of a clip is very often black or a
  // fade-up, which makes for a library of black rectangles.
  // Derivatives follow the asset's privacy, not the original's location.
  const outRoot = row.private ? PRIVATE_DIR : UPLOADS_DIR;
  const otherRoot = row.private ? UPLOADS_DIR : PRIVATE_DIR;

  // Writing the new derivative to the right root is only half the job: a copy left
  // behind in the OTHER root is still on disk, and if that other root is the public
  // one, the "private" asset is still downloadable by anyone who guesses the uuid.
  // A re-ingest after a privacy change is exactly when that happens. Sweep it.
  const sweepCounterpart = (rel) => {
    if (!rel) return;
    const stale = path.join(otherRoot, rel);
    try { if (fs.existsSync(stale)) { fs.unlinkSync(stale); console.log(`[ingest] removed stale derivative ${rel} from the ${row.private ? 'public' : 'private'} root`); } }
    catch (e) { console.error(`[ingest] could not remove stale ${rel}:`, e.message); }
  };

  if (row.media_type === 'video') {
    setStatus(assetId, 'poster');
    const posterRel = path.join(path.dirname(row.original_path), '_poster', `${assetId}.jpg`);
    const at = Math.min((row.in_s || 0) + 1, Math.max(0, (meta.duration_s || 2) - 0.5));
    try {
      if (await makePoster(absOriginal, path.join(outRoot, posterRel), at)) {
        sweepCounterpart(posterRel);
        db.prepare('UPDATE media_assets SET poster_path = ? WHERE id = ?').run(posterRel, assetId);
      }
    } catch (e) {
      console.warn('[ingest] poster failed', assetId, e.message); // not fatal
    }
  }

  if (master && row.media_type === 'video') {
    // The only step that writes gigabytes. broadcast.db, its WAL and nginx's roots
    // all live on this same volume, so an encode that runs it out of space doesn't
    // just fail the ingest — it takes the station down. Refuse rather than risk it.
    const guard = await diskguard.check({ kind: 'master', durationSec: meta.duration_s });
    if (!guard.ok) {
      setStatus(assetId, 'failed', { ingest_error: guard.reason, ready: 1 });
      console.error(`[ingest] ${guard.reason}`);
      return;
    }
    setStatus(assetId, 'mastering');
    const masterRel = path.join(path.dirname(row.original_path), '_master', `${assetId}.mp4`);
    const { ok, measured } = await makeMaster(absOriginal, path.join(outRoot, masterRel), meta);
    if (!ok) throw new Error('master transcode produced no file');
    sweepCounterpart(masterRel);
    db.prepare(`
      UPDATE media_assets SET master_path = @master_path, lufs = @lufs, true_peak = @true_peak, normalised = 1
      WHERE id = @id
    `).run({
      id: assetId, master_path: masterRel,
      lufs: measured?.lufs ?? null, true_peak: measured?.true_peak ?? null,
    });
  }

  setStatus(assetId, 'ready', { ready: 1, ingest_error: null });
}

function queueDepth() { return queue.length + (running ? 1 : 0); }

module.exports = {
  HOUSE, UPLOADS_DIR, PRIVATE_DIR,
  mediaTypeOf, defaultKind,
  probe, enqueue, onProgress, queueDepth,
};
