// ─────────────────────────────────────────────────────────────────────────────
// Playout engine — the thing that makes this a playout system and not a video player.
//
// Five laws, and every design decision below is downstream of one of them:
//
//  1. THE LOG IS THE TRUTH, THE PLAYER FOLLOWS. Nothing reaches air that isn't an
//     item in a log. A cart-wall hit doesn't bypass the log — it inserts an item at
//     NOW. That's why the as-run can be trusted: there is no other path to air.
//  2. NEVER BLACK. If the next item isn't ready when the current one ends, we take
//     filler. If there's no filler, we take the standby layout. Black is a bug.
//  3. PRELOAD, THEN TAKE. A deck that hasn't reported `ready` is never taken. It's
//     skipped and logged. Playout doesn't gamble.
//  4. MASTERS ONLY. A video item plays its conformed master or it doesn't play.
//     (The library's own files prove why: 31.579fps VFR sitting next to 25fps.)
//  5. AS-RUN IS WRITTEN AT AIR, NOT AT PLAN. aired_at on take, ended_at on the next
//     take. That's what makes proof-of-play evidence rather than an intention.
// ─────────────────────────────────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const TICK_MS = 500;
const RECUE_MS = 3000;   // re-offer an unacknowledged cue this often

// ── schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS playout_channels (
    id          TEXT PRIMARY KEY,
    studio_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'screen',   -- screen | screen_group | obs
    target_ref  TEXT,                             -- screen.id | group.id | obs channel
    policy      TEXT DEFAULT '{}',                -- {filler_kind, standby_layout_id, autopilot}
    mode        TEXT DEFAULT 'MAN',               -- MAN | AUTO
    active_log_id TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playout_logs (
    id          TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL,
    studio_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    service_day TEXT,
    status      TEXT DEFAULT 'draft',             -- draft | armed | on_air | done
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playout_items (
    id            TEXT PRIMARY KEY,
    log_id        TEXT NOT NULL,
    seq           INTEGER NOT NULL,
    title         TEXT,
    source_type   TEXT NOT NULL DEFAULT 'media',  -- media | layout | scene
    source_ref    TEXT NOT NULL,
    start_mode    TEXT DEFAULT 'soft',            -- hard | soft | manual
    planned_start TEXT,                           -- ISO; only meaningful for hard
    dur_s         REAL,                           -- planned; resolved from media if null
    segue         TEXT DEFAULT 'cut',             -- cut | xfade
    overlap_s     REAL DEFAULT 0,
    hold          INTEGER DEFAULT 0,              -- pinned: autopilot may not reorder/skip
    skip          INTEGER DEFAULT 0,
    is_break      INTEGER DEFAULT 0,
    -- as-run --
    status        TEXT DEFAULT 'pending',         -- pending | cued | on_air | played | skipped | failed
    aired_at      TEXT,
    ended_at      TEXT,
    actual_dur_s  REAL,
    fail_reason   TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pitems_log ON playout_items(log_id, seq);
`);

// ── queries ──────────────────────────────────────────────────────────────────
const Q = {
  channel:    db.prepare('SELECT * FROM playout_channels WHERE id = ?'),
  channels:   db.prepare('SELECT * FROM playout_channels WHERE studio_id = ? ORDER BY created_at'),
  allChannels:db.prepare('SELECT * FROM playout_channels'),
  items:      db.prepare('SELECT * FROM playout_items WHERE log_id = ? ORDER BY seq'),
  item:       db.prepare('SELECT * FROM playout_items WHERE id = ?'),
  media:      db.prepare('SELECT * FROM media_assets WHERE id = ?'),
  filler:     db.prepare(`SELECT * FROM media_assets
                          WHERE studio_id = ? AND kind = ? AND ready = 1 AND master_path IS NOT NULL
                            AND (expires_at IS NULL OR expires_at > datetime('now'))
                          ORDER BY COALESCE(last_played_at, '1970') ASC LIMIT 1`),
  setItem:    db.prepare('UPDATE playout_items SET status = @status, fail_reason = @fail_reason WHERE id = @id'),
  aired:      db.prepare("UPDATE playout_items SET status='on_air', aired_at=datetime('now'), fail_reason=NULL WHERE id=?"),
  ended:      db.prepare(`UPDATE playout_items SET status='played', ended_at=datetime('now'),
                          actual_dur_s=@dur WHERE id=@id`),
  played:     db.prepare("UPDATE media_assets SET plays_count = COALESCE(plays_count,0)+1, last_played_at = datetime('now') WHERE id = ?"),
};

const parse = (s, fallback) => { try { return JSON.parse(s || ''); } catch { return fallback; } };

// ─────────────────────────────────────────────────────────────────────────────
// Resolve an item into something a deck can actually play.
// This is where law 4 is enforced — and where a bad item is caught on the bench
// instead of on air.
// ─────────────────────────────────────────────────────────────────────────────
function resolve(item) {
  if (item.source_type !== 'media') {
    // layout/scene items don't use a deck; the target applies them directly.
    return { ok: true, kind: item.source_type, ref: item.source_ref, dur_s: item.dur_s || 10 };
  }

  const m = Q.media.get(item.source_ref);
  if (!m) return { ok: false, reason: 'media missing from library' };
  if (!m.ready) return { ok: false, reason: `not ingested (${m.ingest_status})` };
  if (m.expires_at && new Date(m.expires_at) < new Date()) {
    // An expired sponsor spot must never air. This is the line that keeps a
    // proof-of-play report honest.
    return { ok: false, reason: 'expired' };
  }
  if (m.media_type === 'video' && !m.master_path) {
    return { ok: false, reason: 'no house master — play out is masters-only' };
  }

  const inS  = m.in_s || 0;
  const outS = m.out_s ?? m.duration_s;
  const dur  = item.dur_s ?? (outS != null ? Math.max(0, outS - inS) : null);
  if (m.media_type !== 'image' && !dur) return { ok: false, reason: 'unknown duration' };

  return {
    ok: true,
    kind: 'media',
    media_id: m.id,
    // The engine mints the URL, never the client. A public ident is served straight
    // off disk by nginx; a private sponsor spot gets a short-lived signed link that
    // nobody can share or scrape. The screen cannot tell the difference, which is
    // exactly why this seam was built in from the start.
    url: m.private
      ? require('../routes/media-stream').signedUrl(m.id)
      : `/uploads/${(m.master_path || m.original_path).split('\\').join('/')}`,
    poster: m.poster_path ? `/uploads/${m.poster_path.split('\\').join('/')}` : null,
    in_s: inS,
    out_s: outS,
    dur_s: m.media_type === 'image' ? (item.dur_s || 10) : dur,
    intro_s: m.intro_s || 0,
    outro_s: m.outro_s || 0,
    has_audio: !!m.has_audio,
    title: item.title || m.name,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime state. Deliberately NOT persisted: if the process restarts mid-show the
// honest thing is to come up idle and let a human take, not to guess what was on
// air three seconds ago and cut to it.
// ─────────────────────────────────────────────────────────────────────────────
const runtime = new Map();   // channelId -> state

function stateOf(channelId) {
  if (!runtime.has(channelId)) {
    runtime.set(channelId, {
      onAir: null,          // { itemId, deck, resolved, startedAt, durMs }
      cued:  null,          // { itemId, deck, resolved, ready }
      lastError: null,
      fillerPlays: 0,
    });
  }
  return runtime.get(channelId);
}

// ── targets ──────────────────────────────────────────────────────────────────
let targets = {};
function registerTarget(type, impl) { targets[type] = impl; }
function targetFor(ch) { return targets[ch.target_type]; }

// ─────────────────────────────────────────────────────────────────────────────
// The tick.
// ─────────────────────────────────────────────────────────────────────────────
function nextPending(items) {
  return items.find(i => !i.skip && (i.status === 'pending' || i.status === 'cued'));
}

function cue(ch, st, item) {
  const target = targetFor(ch);
  if (!target) return;

  const r = resolve(item);
  if (!r.ok) {
    // Law 3: a bad item is skipped on the bench, loudly, and the log records why.
    Q.setItem.run({ id: item.id, status: 'skipped', fail_reason: r.reason });
    st.lastError = `${item.title || item.id}: ${r.reason}`;
    console.warn(`[playout ${ch.name}] skipped "${item.title}" — ${r.reason}`);
    return;
  }

  // Deck B if A is on air, and vice versa. With a single-decoder client this is
  // still correct — the target just ignores the deck letter and hard-cuts.
  const deck = st.onAir?.deck === 'A' ? 'B' : 'A';
  st.cued = { itemId: item.id, deck, resolved: r, ready: false, cuedAt: Date.now(), lastCueAt: Date.now() };
  Q.setItem.run({ id: item.id, status: 'cued', fail_reason: null });
  target.cue(ch, { deck, item, ...r });
}

function take(ch, st, reason) {
  const target = targetFor(ch);
  const cued = st.cued;
  if (!target || !cued) return;

  const now = Date.now();

  // Close out the outgoing item — this is the as-run write, and it happens at air.
  if (st.onAir) {
    Q.ended.run({ id: st.onAir.itemId, dur: (now - st.onAir.startedAt) / 1000 });
  }

  const r = cued.resolved;
  target.take(ch, { deck: cued.deck, item_id: cued.itemId, segue: reason.segue || 'cut', overlap_s: reason.overlap_s || 0, item: r });

  Q.aired.run(cued.itemId);
  if (r.media_id) Q.played.run(r.media_id);

  st.onAir = {
    itemId: cued.itemId, deck: cued.deck, resolved: r,
    startedAt: now, durMs: (r.dur_s || 0) * 1000,
  };
  st.cued = null;
  st.ranOut = false;
  console.log(`[playout ${ch.name}] TAKE ${cued.deck} — "${r.title}" (${reason.why})`);
}

// Never black. Build a filler item on the fly and put it in the log, so even the
// failure path leaves an as-run trail.
function takeFiller(ch, st, logId) {
  const policy = parse(ch.policy, {});
  const kind = policy.filler_kind || 'filler';
  const m = Q.filler.get(ch.studio_id, kind);
  if (!m) {
    st.lastError = 'DEAD AIR: nothing ready, and no filler in the library';
    console.error(`[playout ${ch.name}] ${st.lastError}`);
    const target = targetFor(ch);
    if (target?.standby && policy.standby_layout_id) target.standby(ch, policy.standby_layout_id);
    return;
  }

  const maxSeq = db.prepare('SELECT COALESCE(MAX(seq),0) s FROM playout_items WHERE log_id = ?').get(logId).s;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO playout_items (id, log_id, seq, title, source_type, source_ref, start_mode, dur_s, segue, status)
    VALUES (@id, @log_id, @seq, @title, 'media', @ref, 'soft', @dur, 'cut', 'pending')
  `).run({
    id, log_id: logId, seq: maxSeq + 1,
    title: `⟳ FILLER — ${m.name}`, ref: m.id,
    dur: (m.out_s ?? m.duration_s) - (m.in_s || 0),
  });
  st.fillerPlays++;
  cue(ch, st, Q.item.get(id));
}

function tick(ch) {
  const st = stateOf(ch.id);
  const target = targetFor(ch);
  if (!target || !ch.active_log_id) return;

  const items = Q.items.all(ch.active_log_id);
  const now = Date.now();

  // Keep a deck warm at all times.
  if (!st.cued) {
    const next = nextPending(items);
    if (next) cue(ch, st, next);
  } else if (!st.cued.ready && now - st.cued.lastCueAt > RECUE_MS) {
    // Re-offer. A cue is fire-and-forget over a socket — if the screen was offline,
    // rebooting, or hadn't connected yet, that message landed in an empty room and
    // the channel would wait forever for a `ready` that can never come. Loading the
    // same file twice is harmless; a channel deadlocked on a lost packet is not.
    st.cued.lastCueAt = now;
    const item = Q.item.get(st.cued.itemId);
    if (item) {
      target.cue(ch, { deck: st.cued.deck, item, ...st.cued.resolved });
    }
  }

  // Nothing on air. In AUTO the engine starts the channel itself; in MAN it does
  // NOT — MAN means manual, and an operator who has taken manual control must not
  // find that something put itself to air behind them. Starting a channel is a
  // human act (feedback_bs_live_operator_only); only the SEGUE is automatable.
  if (!st.onAir) {
    if (ch.mode === 'AUTO' && st.cued?.ready) {
      const item = Q.item.get(st.cued.itemId);
      if (item.start_mode === 'manual') return;
      // A hard item is a time you must HIT, not a time you may beat. Starting a
      // channel must not fire a junction early just because the deck happens to be
      // loaded — an ident that runs at 21:58 for a 22:00 junction is as wrong as one
      // that runs at 22:02. Hold until it is due.
      if (item.start_mode === 'hard' && item.planned_start) {
        if (Date.now() < new Date(item.planned_start).getTime()) return;
      }
      take(ch, st, { why: 'autopilot start', segue: 'cut' });
    }
    return;
  }

  const elapsed   = now - st.onAir.startedAt;
  const remaining = st.onAir.durMs - elapsed;
  const cuedItem  = st.cued ? Q.item.get(st.cued.itemId) : null;

  // A HARD start pre-empts. This is what a top-of-hour junction and an ad break
  // actually are: a time you must hit, even if it means cutting the item you're on.
  if (cuedItem?.start_mode === 'hard' && cuedItem.planned_start) {
    const due = new Date(cuedItem.planned_start).getTime();
    if (now >= due && st.cued.ready) {
      take(ch, st, { why: 'hard start', segue: cuedItem.segue, overlap_s: cuedItem.overlap_s });
      return;
    }
  }

  // RUN-OUT. The item has finished and there is nothing cued to replace it.
  //
  // In MAN the engine must not TAKE anything (that's the operator's job, and the whole
  // point of MAN). But leaving the output sitting on a finished item is dead air — a
  // frozen last frame on a live channel — and "never black" does not have a MAN
  // exemption. So we hand the output back: the screen goes to its standby layout, the
  // OBS channel goes back to the director's rotation. Nothing NEW goes to air; the
  // dead thing just stops being on it.
  if (remaining <= 0 && !st.cued && !nextPending(items)) {
    if (!st.ranOut) {
      st.ranOut = true;
      const policy = parse(ch.policy, {});
      console.warn(`[playout ${ch.name}] ran out after "${st.onAir.resolved.title}" — handing the output back rather than sitting on a dead frame`);
      Q.ended.run({ id: st.onAir.itemId, dur: (now - st.onAir.startedAt) / 1000 });
      if (target.standby) target.standby(ch, policy.standby_layout_id);
      st.onAir = null;
    }
    return;
  }

  if (ch.mode !== 'AUTO') return;          // MAN: the operator takes. Nothing rolls on its own.
  if (cuedItem?.start_mode === 'manual') return;

  // The segue point. For a crossfade we start the next item while this one is still
  // running out its tail — that's what outro_s/overlap_s are FOR, and it's the whole
  // difference between a segue and a gap.
  const overlapMs = ((cuedItem?.segue === 'xfade')
    ? (cuedItem.overlap_s || st.onAir.resolved.outro_s || 1)
    : 0) * 1000;

  if (remaining <= overlapMs + TICK_MS / 2) {
    if (st.cued?.ready) {
      take(ch, st, { why: 'segue', segue: cuedItem?.segue || 'cut', overlap_s: (cuedItem?.overlap_s || st.onAir.resolved.outro_s || 0) });
    } else if (remaining <= 0) {
      // Law 2. We ran out and the next deck isn't there.
      console.warn(`[playout ${ch.name}] next item not ready at end of "${st.onAir.resolved.title}" — filler`);
      if (st.cued) Q.setItem.run({ id: st.cued.itemId, status: 'pending', fail_reason: 'not ready in time' });
      st.cued = null;
      takeFiller(ch, st, ch.active_log_id);
    }
  }
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    for (const ch of Q.allChannels.all()) {
      try { tick(ch); } catch (e) { console.error(`[playout ${ch.id}] tick failed:`, e.message); }
    }
  }, TICK_MS);
  console.log(`[playout] engine started (${TICK_MS}ms tick)`);
}

// ── events from the target (a screen telling us what it actually did) ────────
function onReady(channelId, itemId) {
  const st = stateOf(channelId);
  if (st.cued && st.cued.itemId === itemId) st.cued.ready = true;
}

function onEnded(channelId, itemId) {
  // The client says the file ended. Trust it over our own clock — the file is the
  // authority on its own length, and a stalled network makes our maths a lie.
  const st = stateOf(channelId);
  if (st.onAir && st.onAir.itemId === itemId) st.onAir.durMs = Date.now() - st.onAir.startedAt;
}

function onError(channelId, itemId, message) {
  const st = stateOf(channelId);
  Q.setItem.run({ id: itemId, status: 'failed', fail_reason: String(message).slice(0, 300) });
  if (st.cued?.itemId === itemId) st.cued = null;
  st.lastError = `${itemId}: ${message}`;
}

// ── operator actions ─────────────────────────────────────────────────────────
function operatorTake(channelId) {
  const ch = Q.channel.get(channelId);
  const st = stateOf(channelId);
  if (!ch) throw new Error('no such channel');
  if (!st.cued) throw new Error('nothing cued');
  if (!st.cued.ready) throw new Error('cued item is not ready — refusing to take a deck that has not loaded');
  const item = Q.item.get(st.cued.itemId);
  take(ch, st, { why: 'operator TAKE', segue: item?.segue || 'cut', overlap_s: item?.overlap_s || 0 });
  return snapshot(channelId);
}

// A cart-wall hit. Law 1: it does not bypass the log, it inserts into it — so it
// lands in the as-run like everything else.
function insertNow(channelId, mediaId, { title } = {}) {
  const ch = Q.channel.get(channelId);
  if (!ch?.active_log_id) throw new Error('channel has no active log');
  const m = Q.media.get(mediaId);
  if (!m) throw new Error('no such media');

  const st = stateOf(channelId);
  const items = Q.items.all(ch.active_log_id);
  const next = nextPending(items);
  const seq = next ? next.seq : (items.at(-1)?.seq || 0) + 1;

  // Push everything after it down, so the insert lands next and the running order
  // behind it survives intact.
  db.prepare('UPDATE playout_items SET seq = seq + 1 WHERE log_id = ? AND seq >= ?').run(ch.active_log_id, seq);

  const id = uuidv4();
  db.prepare(`
    INSERT INTO playout_items (id, log_id, seq, title, source_type, source_ref, start_mode, dur_s, segue, status)
    VALUES (@id, @log, @seq, @title, 'media', @ref, 'soft', @dur, 'cut', 'pending')
  `).run({
    id, log: ch.active_log_id, seq,
    title: title || m.name, ref: mediaId,
    dur: (m.out_s ?? m.duration_s) - (m.in_s || 0),
  });

  // Re-cue: whatever was warm is no longer what's next.
  if (st.cued) { Q.setItem.run({ id: st.cued.itemId, status: 'pending', fail_reason: null }); st.cued = null; }
  cue(ch, st, Q.item.get(id));
  return id;
}

function setMode(channelId, mode) {
  if (!['MAN', 'AUTO'].includes(mode)) throw new Error('mode must be MAN or AUTO');
  db.prepare("UPDATE playout_channels SET mode = ?, updated_at = datetime('now') WHERE id = ?").run(mode, channelId);
  return mode;
}

function stop(channelId) {
  const ch = Q.channel.get(channelId);
  const st = stateOf(channelId);
  if (st.onAir) Q.ended.run({ id: st.onAir.itemId, dur: (Date.now() - st.onAir.startedAt) / 1000 });
  const target = targetFor(ch);
  if (target?.stop) target.stop(ch);
  runtime.set(channelId, { onAir: null, cued: null, lastError: null, fillerPlays: 0 });
}

// ── what the control room sees ───────────────────────────────────────────────
function snapshot(channelId) {
  const ch = Q.channel.get(channelId);
  if (!ch) return null;
  const st = stateOf(channelId);
  const now = Date.now();
  const items = ch.active_log_id ? Q.items.all(ch.active_log_id) : [];

  const onAir = st.onAir ? {
    item_id: st.onAir.itemId,
    deck: st.onAir.deck,
    title: st.onAir.resolved.title,
    poster: st.onAir.resolved.poster,
    dur_s: st.onAir.resolved.dur_s,
    elapsed_s: (now - st.onAir.startedAt) / 1000,
    remaining_s: Math.max(0, (st.onAir.durMs - (now - st.onAir.startedAt)) / 1000),
  } : null;

  const cued = st.cued ? {
    item_id: st.cued.itemId,
    deck: st.cued.deck,
    title: st.cued.resolved.title,
    poster: st.cued.resolved.poster,
    dur_s: st.cued.resolved.dur_s,
    ready: st.cued.ready,
  } : null;

  return {
    channel: { id: ch.id, name: ch.name, mode: ch.mode, target_type: ch.target_type, target_ref: ch.target_ref, active_log_id: ch.active_log_id },
    on_air: onAir,
    cued,
    last_error: st.lastError,
    filler_plays: st.fillerPlays,
    items: items.map(i => ({ ...i, hold: !!i.hold, skip: !!i.skip, is_break: !!i.is_break })),
  };
}

module.exports = {
  start, registerTarget, snapshot, resolve,
  onReady, onEnded, onError,
  operatorTake, insertNow, setMode, stop,
  stateOf, Q,
};
