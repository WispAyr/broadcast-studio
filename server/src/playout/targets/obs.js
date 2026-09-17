// ─────────────────────────────────────────────────────────────────────────────
// Playout target: OBS (the pu2 storm channel → YouTube).
//
// The same engine, the same log, the same as-run. Only the deck is different: instead
// of two <video> elements in a browser, it's two ffmpeg_source inputs in an OBS scene,
// driven through the pu2 agent on the reverse tunnel.
//
// Two things make this safe rather than clever:
//
//  1. THE FILE MUST BE LOCAL TO OBS. pu2 already proves an ffmpeg_source can pull a
//     remote mp4 (PrestwickReel does), and it is exactly the wrong pattern for air —
//     one network blip and the channel goes black. So a master is rsync'd to pu2
//     BEFORE it is cued, and an item whose file didn't make the trip is skipped with
//     a reason rather than gambled on.
//
//  2. THE DIRECTOR STAYS IN CHARGE. Taking a clip to air is not a raw OBS scene poke —
//     it goes through the existing `scene_override` the director already honours at
//     priority 7. So the channel's own safety logic (breaking-news pre-emption, dwell,
//     the return to rotation) is untouched, and playout is a citizen of it rather than
//     a thing fighting it.
//
// CROSSFADE: grok checked, and the honest answer is that a bare ffmpeg_source has no
// opacity filter — SetSceneItemEnabled is a hard cut. So on this target an xfade
// DEGRADES TO A CUT, and we say so in the log rather than pretending the segue happened.
// ─────────────────────────────────────────────────────────────────────────────
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { db } = require('../../db');

const AGENT      = process.env.PU2_AGENT_URL  || 'http://127.0.0.1:3866';   // reverse tunnel
const PU2_SSH    = process.env.PU2_SSH        || 'noc@10.200.0.8';          // over WireGuard
const PU2_MEDIA  = process.env.PU2_MEDIA_ROOT || '/Users/noc/storm-director/media/masters';
const OBS_SCENE  = process.env.PU2_OBS_SCENE  || 'Playout';
const UPLOADS    = path.join(__dirname, '..', '..', '..', 'data', 'uploads');
const PRIVATE    = path.join(__dirname, '..', '..', '..', 'data', 'private');

// Which masters we've already shipped, and which are in flight.
//
// The in-flight map is load-bearing, not an optimisation. The engine re-offers an
// unacknowledged cue every 3 seconds (because a socket cue into an empty room would
// otherwise deadlock the channel). A screen ACKs in under a second, so it never
// re-fires. An rsync of a 50MB master over WireGuard takes fifteen — so without
// single-flighting, every re-cue kicks off ANOTHER copy of the same file, and a
// slow link makes the stampede worse exactly when it can least afford it.
// Same file, same promise.
const shipped = new Set();
const inflight = new Map();

function agent(pathname, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  return fetch(`${AGENT}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: ctl.signal,
  })
    .then(r => r.json())
    .finally(() => clearTimeout(t));
}

function sh(cmd, args, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => { c.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    c.stderr.on('data', d => { err = (err + d).slice(-2000); });
    c.on('error', e => { clearTimeout(timer); reject(e); });
    c.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.trim()}`)); });
  });
}

// Ship a master to pu2. Returns the absolute path ON PU2, or throws — and a throw here
// is the right outcome: better a skipped item with "master never reached the engine
// host" in the log than a cue pointing at a file that isn't there.
async function ensureOnPu2(mediaRow) {
  const rel = mediaRow.master_path;
  if (!rel) throw new Error('no house master — play out is masters-only');

  const local = path.join(mediaRow.private ? PRIVATE : UPLOADS, rel);
  if (!fs.existsSync(local)) throw new Error(`master missing on disk: ${rel}`);

  const remoteName = `${mediaRow.id}${path.extname(rel)}`;
  const remote = `${PU2_MEDIA}/${remoteName}`;
  if (shipped.has(mediaRow.id)) return remote;
  if (inflight.has(mediaRow.id)) return inflight.get(mediaRow.id);

  // --partial so a dropped WG link resumes rather than leaving a truncated file that
  // OBS would happily play half of.
  const p = sh('rsync', ['-a', '--partial', '--timeout=60', local, `${PU2_SSH}:${remote}`])
    .then(() => {
      shipped.add(mediaRow.id);
      console.log(`[playout obs] shipped master ${mediaRow.name} → pu2`);
      return remote;
    })
    .finally(() => inflight.delete(mediaRow.id));

  inflight.set(mediaRow.id, p);
  return p;
}

module.exports = {
  // Cue = ship the file, point the free deck at it, do NOT play it. The engine will
  // not take a deck that hasn't reported ready, so we report ready ourselves once the
  // agent confirms the file is loaded — the OBS deck has no `canplaythrough` to wait on.
  async cue(ch, { deck, item, media_id }) {
    const engine = require('../engine');
    try {
      const m = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(media_id);
      if (!m) throw new Error('media missing from library');

      const remote = await ensureOnPu2(m);
      const r = await agent('/api/video/cue', { deck, file: remote });
      if (!r?.ok) throw new Error(r?.error || 'agent refused the cue');

      engine.onReady(ch.id, item.id);
    } catch (e) {
      // Fail loudly into the log, never silently into a black frame.
      console.error(`[playout obs] cue failed for "${item.title}": ${e.message}`);
      engine.onError(ch.id, item.id, e.message);
    }
  },

  async take(ch, { deck, item_id, segue, overlap_s, item }) {
    const engine = require('../engine');
    try {
      // An xfade cannot be honoured here. Say so rather than reporting a segue that
      // didn't happen — a lie in the as-run is worse than a hard cut.
      if (segue === 'xfade') {
        console.warn('[playout obs] xfade requested but this target is cut-only (a bare ffmpeg_source has no opacity filter) — cutting');
      }

      // VERIFY THE DECK AT THE MOMENT OF AIR.
      //
      // `ready` is a latch: the engine sets it when the cue is acknowledged and then
      // believes it. But this target lives on another machine — OBS can restart, the
      // agent can restart, someone can hit stop — and the engine has no way to know
      // its loaded deck was emptied behind its back. It would then cheerfully take a
      // deck with no file in it, which is a black frame on a live channel.
      // So: trust the latch to schedule, but check the deck before cutting to it.
      const state = await agent('/api/video/state');
      const loaded = state?.[deck]?.file || '';
      if (!loaded) {
        throw new Error(`deck ${deck} is empty at the moment of take — the file was lost after it was cued (OBS or the agent restarted). Refusing to cut to a black deck.`);
      }

      const r = await agent('/api/video/take', { deck, segue: 'cut', overlap_s: overlap_s || 0 });
      if (!r?.ok) throw new Error(r?.error || 'agent refused the take');

      // Put the channel on the Playout scene through the director's OWN override, not
      // by poking OBS behind its back — so breaking-news pre-emption and the return to
      // rotation still work. If the director rejects it, that is a FAILURE, not a
      // footnote: the clip is playing on a scene nobody is watching.
      const sc = await agent('/api/scene/take', { scene: OBS_SCENE, minutes: 30 });
      if (!sc?.ok) {
        await agent('/api/video/stop', {}).catch(() => {});
        throw new Error(`the director refused the scene: ${sc?.error || 'unknown'}. The clip never reached air.`);
      }

      // CONFIRM THE CUT ACTUALLY LANDED.
      //
      // The director polls for a scene override every `poll_s` (8s on this channel), so
      // asking for a cut and getting `ok` means the request was ACCEPTED, not that the
      // clip is on the programme. Without this check the as-run would record an
      // aired_at for an item that never appeared — and an as-run that records things
      // that didn't happen is not evidence, it's a guess with a timestamp on it.
      //
      // (It also means anything shorter than the poll interval can be over before it
      // is cut to. The real fix for short-form is a lower director poll_s; until then
      // this at least refuses to LIE about it.)
      const deadline = Date.now() + 14000;
      let landed = false;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1000));
        const st = await agent('/api/video/state').catch(() => null);
        if (st?.program_scene === OBS_SCENE) { landed = true; break; }
      }
      if (!landed) {
        throw new Error(`the cut was accepted but never reached the programme within 14s (the director polls every ${process.env.PU2_POLL_S || 8}s). The item did not air.`);
      }
      console.log(`[playout obs] cut landed — "${item?.title || item_id}" is on the programme`);
    } catch (e) {
      console.error(`[playout obs] TAKE FAILED: ${e.message}`);
      engine.onError(ch.id, item_id, e.message);
    }
  },

  async stop(ch) {
    try {
      // ORDER MATTERS. Hand the channel back to the director FIRST, and only then
      // empty the decks. Do it the other way round — as I did, on air — and for the
      // seconds between the two calls the program is sitting on a Playout scene whose
      // decks you have just emptied. That is a blank scene on a live channel.
      // Get off the scene, then tidy up behind you.
      await agent('/api/scene/clear', {});
      await agent('/api/video/stop', {});
    } catch (e) {
      console.error(`[playout obs] stop failed: ${e.message}`);
    }
  },

  // There is no standby layout on this target — the standby IS the director's rotation,
  // which is a better fallback than anything we could invent.
  standby(ch) {
    agent('/api/scene/clear', {}).catch(() => {});
  },
};
