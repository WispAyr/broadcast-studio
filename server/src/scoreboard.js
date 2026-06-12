const { db } = require('./db');
const { getIO } = require('./ws');

// ──────────────────────────────────────────────────────────────────────────
// Scoreboard — live match score state per studio, driving the sl_score corner
// bug. The operator nudges it from the /console scoreboard bar (or a Stream
// Deck via score_* console actions); every change re-pushes the sl_score
// overlay to the studio's screens (or removes it when hidden). One row per
// studio so the score survives a server restart mid-match.
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

const DEFAULTS = { home_name: 'SCO', away_name: 'HAI', home_goals: 0, away_goals: 0, minute: '', visible: 0 };

function get(studioId) {
  const r = db.prepare('SELECT * FROM scoreboard WHERE studio_id = ?').get(studioId);
  return r || { studio_id: studioId, ...DEFAULTS };
}

function save(studioId, s) {
  db.prepare(`
    INSERT INTO scoreboard (studio_id, home_name, away_name, home_goals, away_goals, minute, visible, updated_at)
    VALUES (@studio_id, @home_name, @away_name, @home_goals, @away_goals, @minute, @visible, datetime('now'))
    ON CONFLICT(studio_id) DO UPDATE SET
      home_name=@home_name, away_name=@away_name, home_goals=@home_goals,
      away_goals=@away_goals, minute=@minute, visible=@visible, updated_at=datetime('now')
  `).run({ studio_id: studioId, ...s });
  return get(studioId);
}

// Push (or pull) the sl_score corner bug for this studio's screens.
function emit(studioId, s) {
  try {
    const io = getIO();
    if (s.visible) {
      io.to(`studio:${studioId}`).emit('push_overlay', {
        overlay: {
          type: 'sl_score',
          home: s.home_name, away: s.away_name,
          score: `${s.home_goals}-${s.away_goals}`,
          minute: s.minute || '',
        },
      });
    } else {
      io.to(`studio:${studioId}`).emit('remove_overlay', { overlayType: 'sl_score' });
    }
  } catch { /* io not ready */ }
}

// Merge a patch onto current state (ignoring undefined keys), clamp, persist,
// re-emit. Returns the saved row.
function apply(studioId, patch = {}) {
  const cur = get(studioId);
  const next = {
    home_name: cur.home_name, away_name: cur.away_name,
    home_goals: cur.home_goals, away_goals: cur.away_goals,
    minute: cur.minute, visible: cur.visible,
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
  const saved = save(studioId, next);
  emit(studioId, saved);
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

module.exports = { get, apply, adjust, adjustMinute, emit };
