const { db } = require('./db');
const { getIO } = require('./ws');

// ──────────────────────────────────────────────────────────────────────────
// Scoreboard — live match score state per studio, driving the sl_score corner
// bug. The operator nudges it from the /console scoreboard bar (or a Stream
// Deck via score_* console actions); every change re-pushes the sl_score
// overlay to the studio's screens (or removes it when hidden). One row per
// studio so the score survives a server restart mid-match.
//
// Renderer (per studio, default 'react'):
//   react — the built-in sl_score React bug in ScreenDisplay (unchanged).
//   rive  — the Rive bug at RIVE_SCORE_URL, as a gfx_score overlay. It is pushed
//           once when the bug comes on and removed when it goes off (gfx_* pages
//           animate out on removal); in between it follows `scoreboard_state`
//           on the studio room, so a goal or a clock nudge never remounts it.
// Every change emits `scoreboard_state` either way. Switch with
//   node server/scoreboard-renderer.js <studio-slug> rive|react
// ──────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS scoreboard (
    studio_id  TEXT PRIMARY KEY,
    home_name  TEXT NOT NULL DEFAULT 'SCO',
    away_name  TEXT NOT NULL DEFAULT 'HAI',
    home_goals INTEGER NOT NULL DEFAULT 0,
    away_goals INTEGER NOT NULL DEFAULT 0,
    minute     TEXT NOT NULL DEFAULT '',
    visible    INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
if (!db.prepare('PRAGMA table_info(scoreboard)').all().some((c) => c.name === 'renderer')) {
  db.exec("ALTER TABLE scoreboard ADD COLUMN renderer TEXT NOT NULL DEFAULT 'react'");
}

const RENDERERS = ['react', 'rive'];
const RIVE_SCORE_URL = '/player/sideliners/rive/overlay.html';
const DEFAULTS = { home_name: 'SCO', away_name: 'HAI', home_goals: 0, away_goals: 0, minute: '', visible: 0, renderer: 'react' };

function get(studioId) {
  const r = db.prepare('SELECT * FROM scoreboard WHERE studio_id = ?').get(studioId);
  return r || { studio_id: studioId, ...DEFAULTS };
}

function save(studioId, s) {
  db.prepare(`
    INSERT INTO scoreboard (studio_id, home_name, away_name, home_goals, away_goals, minute, visible, renderer, updated_at)
    VALUES (@studio_id, @home_name, @away_name, @home_goals, @away_goals, @minute, @visible, @renderer, datetime('now'))
    ON CONFLICT(studio_id) DO UPDATE SET
      home_name=@home_name, away_name=@away_name, home_goals=@home_goals,
      away_goals=@away_goals, minute=@minute, visible=@visible, renderer=@renderer, updated_at=datetime('now')
  `).run({ studio_id: studioId, ...s });
  return get(studioId);
}

// The Rive page reads its first frame from the URL, then follows scoreboard_state.
function riveUrl(s) {
  const q = new URLSearchParams({
    home: s.home_name, away: s.away_name,
    hs: String(s.home_goals), as: String(s.away_goals), clock: s.minute || '',
  });
  return `${RIVE_SCORE_URL}?${q}`;
}

// The overlay that shows the bug for this state, by renderer.
function overlayFor(s) {
  if (s.renderer === 'rive') return { type: 'gfx_score', url: riveUrl(s) };
  return {
    type: 'sl_score',
    home: s.home_name, away: s.away_name,
    score: `${s.home_goals}-${s.away_goals}`,
    minute: s.minute || '',
  };
}

// A screen that (re)registers while the bug is on gets it back. Overlays live
// only in the screen's page, so a reload mid-match used to drop the bug until
// the next score change (and, in the rive renderer, until the next show).
// Emits to that one socket only.
function replay(socket, studioId) {
  try {
    const s = get(studioId);
    if (s.visible) socket.emit('push_overlay', { overlay: overlayFor(s) });
  } catch { /* table not ready */ }
}

// Push (or pull) the corner bug for this studio's screens. `prev` is the state
// before this change (absent on a bare re-emit); `goal` is 'home'|'away' when
// this change scored.
function emit(studioId, s, { prev = null, goal = null } = {}) {
  try {
    const io = getIO();
    const room = io.to(`studio:${studioId}`);
    room.emit('scoreboard_state', {
      home_name: s.home_name, away_name: s.away_name,
      home_goals: s.home_goals, away_goals: s.away_goals,
      minute: s.minute || '', visible: !!s.visible, goal,
    });
    if (s.renderer === 'rive') {
      if (s.visible && (!prev || !prev.visible || prev.renderer !== 'rive')) {
        room.emit('push_overlay', { overlay: overlayFor(s) });
      } else if (!s.visible && (!prev || prev.visible)) {
        room.emit('remove_overlay', { overlayType: 'gfx_score' });
      }
      // Switching react -> rive mid-show: take the React bug down.
      if (prev && prev.renderer !== 'rive' && prev.visible) {
        room.emit('remove_overlay', { overlayType: 'sl_score' });
      }
      return;
    }
    if (prev && prev.renderer === 'rive' && prev.visible) {
      room.emit('remove_overlay', { overlayType: 'gfx_score' });
    }
    if (s.visible) {
      room.emit('push_overlay', { overlay: overlayFor(s) });
    } else {
      room.emit('remove_overlay', { overlayType: 'sl_score' });
    }
  } catch { /* io not ready */ }
}

// Merge a patch onto current state (ignoring undefined keys), clamp, persist,
// re-emit. Returns the saved row. A side whose goals went up is flagged as the
// goal, whoever wrote it: console, Stream Deck or the sl-director data feed.
function apply(studioId, patch = {}) {
  const cur = get(studioId);
  const next = {
    home_name: cur.home_name, away_name: cur.away_name,
    home_goals: cur.home_goals, away_goals: cur.away_goals,
    minute: cur.minute, visible: cur.visible, renderer: cur.renderer || 'react',
  };
  for (const k of Object.keys(next)) {
    if (patch[k] !== undefined && patch[k] !== null) next[k] = patch[k];
  }
  next.home_name = String(next.home_name || 'HOME').toUpperCase().slice(0, 5);
  next.away_name = String(next.away_name || 'AWAY').toUpperCase().slice(0, 5);
  next.home_goals = Math.max(0, parseInt(next.home_goals, 10) || 0);
  next.away_goals = Math.max(0, parseInt(next.away_goals, 10) || 0);
  next.minute = String(next.minute || '');
  next.visible = next.visible ? 1 : 0;
  if (!RENDERERS.includes(next.renderer)) next.renderer = 'react';
  const goal = next.home_goals > (cur.home_goals || 0) ? 'home'
    : next.away_goals > (cur.away_goals || 0) ? 'away' : null;
  const saved = save(studioId, next);
  emit(studioId, saved, { prev: cur, goal });
  return saved;
}

// Bump one side's goals; scoring shows the bug automatically.
function adjust(studioId, side, delta = 1) {
  const cur = get(studioId);
  const key = side === 'away' ? 'away_goals' : 'home_goals';
  return apply(studioId, { [key]: (cur[key] || 0) + (parseInt(delta, 10) || 0), visible: 1 });
}

// Nudge the clock by parsing the leading integer of the minute string.
function adjustMinute(studioId, delta = 1) {
  const cur = get(studioId);
  const n = Math.max(0, (parseInt(cur.minute, 10) || 0) + (parseInt(delta, 10) || 0));
  return apply(studioId, { minute: `${n}'` });
}

function setRenderer(studioId, renderer) {
  if (!RENDERERS.includes(renderer)) throw new Error(`renderer must be one of ${RENDERERS.join(', ')}`);
  return apply(studioId, { renderer });
}

module.exports = { get, apply, adjust, adjustMinute, emit, replay, setRenderer, riveUrl, RIVE_SCORE_URL };
