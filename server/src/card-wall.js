const { db, getLayoutById } = require('./db');
const { getIO } = require('./ws');
const { enrichLayout } = require('./lib/enrich-layout');

// ──────────────────────────────────────────────────────────────────────────
// Card Wall — recurring daypart "now on air" graphic for the main screen wall.
//
// Distinct from the studio-wide timeline engine (timeline.js), which switches
// EVERY screen to a data-grid layout. The card wall is scoped to ONE screen
// (the studio wall) and shows the full-screen show card for the current slot,
// auto-switching by day-of-week + time, with a manual override that holds
// until the next show starts (or until explicitly resumed / expires).
//
//   card_wall            — one row per studio: target screen + override state
//   card_wall_schedule   — weekly slots: (dow, start) -> card layout
//
// A single 30s interval ticks every enabled studio. apply() honours the
// screen padlock (accepts_broadcasts) just like the console dispatcher.
// ──────────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS card_wall (
    studio_id TEXT PRIMARY KEY,
    screen_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    override_layout_id TEXT,
    override_slot_key TEXT,
    override_until TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS card_wall_schedule (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    dow INTEGER NOT NULL,                 -- 0=Sun .. 6=Sat (JS getDay)
    start TEXT NOT NULL,                  -- 'HH:MM'
    layout_id TEXT NOT NULL,
    label TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_card_sched_studio ON card_wall_schedule(studio_id, dow, start);
`);

// In-memory: last layout applied per studio, to avoid redundant emits.
const lastApplied = new Map();
let intervalId = null;

// Resolve day-of-week + HH:MM in Europe/London regardless of the server's
// own timezone — this is a UK radio schedule, so BST/GMT must be honoured or
// every card would switch an hour off in summer.
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const LONDON_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});
function londonParts(d = new Date()) {
  const p = {};
  for (const part of LONDON_FMT.formatToParts(d)) p[part.type] = part.value;
  let hour = p.hour === '24' ? '00' : p.hour; // some ICU builds emit '24' at midnight
  return { dow: DOW[p.weekday], hhmm: `${hour}:${p.minute}` };
}

// Resolve the scheduled slot for `now`. Picks the latest slot whose start <=
// now on the current day; if today has no earlier slot (e.g. small hours), it
// walks back day-by-day to find the last slot that is still "running" — so an
// evening show that has no explicit overnight successor lingers until the next
// morning's first slot, which matches how a radio schedule actually behaves.
function scheduledSlot(studioId, now = new Date()) {
  const rows = db.prepare('SELECT * FROM card_wall_schedule WHERE studio_id = ?').all(studioId);
  if (!rows.length) return null;
  const byDow = {};
  for (const r of rows) (byDow[r.dow] ||= []).push(r);
  for (const k of Object.keys(byDow)) byDow[k].sort((a, b) => a.start.localeCompare(b.start));

  const { dow: today, hhmm: t } = londonParts(now);
  for (let back = 0; back < 7; back++) {
    const dow = (today - back + 7) % 7;
    const slots = byDow[dow];
    if (!slots || !slots.length) continue;
    if (back === 0) {
      let match = null;
      for (const s of slots) if (s.start <= t) match = s;
      if (match) return { ...match, key: `${match.dow}-${match.start}` };
      // No slot started yet today — fall through to previous day's last slot.
    } else {
      const last = slots[slots.length - 1];
      return { ...last, key: `${last.dow}-${last.start}` };
    }
  }
  return null;
}

function getWall(studioId) {
  return db.prepare('SELECT * FROM card_wall WHERE studio_id = ?').get(studioId);
}

// Decide what SHOULD be on the wall right now: an active override, else the
// scheduled slot. Clears an override that has expired or whose show has ended.
function resolveTarget(studioId, now = new Date()) {
  const wall = getWall(studioId);
  if (!wall || !wall.enabled) return null;
  const slot = scheduledSlot(studioId, now);

  if (wall.override_layout_id) {
    const expiredByTime = wall.override_until && new Date(wall.override_until) <= now;
    const showChanged = wall.override_slot_key && slot && slot.key !== wall.override_slot_key;
    if (expiredByTime || showChanged) {
      db.prepare("UPDATE card_wall SET override_layout_id=NULL, override_slot_key=NULL, override_until=NULL, updated_at=datetime('now') WHERE studio_id=?").run(studioId);
    } else {
      return { layout_id: wall.override_layout_id, label: 'Manual', source: 'card-wall-override', screen_id: wall.screen_id, slot };
    }
  }
  if (!slot) return null;
  return { layout_id: slot.layout_id, label: slot.label, source: 'card-wall', screen_id: wall.screen_id, slot };
}

function apply(screenId, layoutId, source, label) {
  const screen = db.prepare('SELECT id, accepts_broadcasts, studio_id FROM screens WHERE id = ?').get(screenId);
  if (!screen) return { applied: false, reason: 'screen missing' };
  if (!screen.accepts_broadcasts) return { applied: false, reason: 'locked' };
  const layout = getLayoutById(layoutId);
  if (!layout) return { applied: false, reason: 'layout missing' };

  db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?").run(layoutId, screenId);
  const enriched = enrichLayout({ ...layout, modules: JSON.parse(layout.modules || '[]') }, screenId);
  const io = getIO();
  io.to(`screen:${screenId}`).emit('set_layout', { layoutId, layout: enriched, source, label });
  io.to(`studio:${screen.studio_id}`).emit('screen_preview', {
    screenId, layoutId, layout: enriched, timestamp: new Date().toISOString(),
  });
  return { applied: true };
}

function tick(studioId, { force = false } = {}) {
  const target = resolveTarget(studioId);
  if (!target) return;
  const sig = `${target.screen_id}:${target.layout_id}`;
  if (!force && lastApplied.get(studioId) === sig) return;
  const r = apply(target.screen_id, target.layout_id, target.source, target.label);
  if (r.applied) {
    lastApplied.set(studioId, sig);
    console.log(`Card wall: ${target.source} → "${target.label || target.layout_id}" on screen ${target.screen_id}`);
  } else if (r.reason === 'locked') {
    // Screen padlocked — clear our cache so we re-apply once it unlocks.
    lastApplied.delete(studioId);
  }
}

function tickAll(opts) {
  const walls = db.prepare('SELECT studio_id FROM card_wall WHERE enabled = 1').all();
  for (const w of walls) {
    try { tick(w.studio_id, opts); } catch (e) { console.error('Card wall tick error', w.studio_id, e.message); }
  }
}

// ── Public control surface (used by routes + console dispatcher) ────────────

function override(studioId, layoutId, minutes) {
  const wall = getWall(studioId);
  if (!wall) throw new Error('card wall not configured for studio');
  if (!getLayoutById(layoutId)) throw new Error('layout not found');
  const slot = scheduledSlot(studioId);
  const until = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
  db.prepare("UPDATE card_wall SET override_layout_id=?, override_slot_key=?, override_until=?, updated_at=datetime('now') WHERE studio_id=?")
    .run(layoutId, slot ? slot.key : null, until, studioId);
  tick(studioId, { force: true });
  return getState(studioId);
}

function resume(studioId) {
  db.prepare("UPDATE card_wall SET override_layout_id=NULL, override_slot_key=NULL, override_until=NULL, updated_at=datetime('now') WHERE studio_id=?").run(studioId);
  tick(studioId, { force: true });
  return getState(studioId);
}

function setEnabled(studioId, enabled) {
  const wall = getWall(studioId);
  if (!wall) throw new Error('card wall not configured for studio');
  db.prepare("UPDATE card_wall SET enabled=?, updated_at=datetime('now') WHERE studio_id=?").run(enabled ? 1 : 0, studioId);
  if (enabled) tick(studioId, { force: true });
  return getState(studioId);
}

function getState(studioId) {
  const wall = getWall(studioId);
  if (!wall) return { configured: false };
  const now = new Date();
  const slot = scheduledSlot(studioId, now);
  const target = resolveTarget(studioId, now);
  const schedule = db.prepare('SELECT * FROM card_wall_schedule WHERE studio_id = ? ORDER BY dow, start').all(studioId);
  const screen = db.prepare('SELECT id, name, current_layout_id, accepts_broadcasts, is_online FROM screens WHERE id = ?').get(wall.screen_id);

  const enrich = (id) => { const l = id ? getLayoutById(id) : null; return l ? { id: l.id, name: l.name } : null; };
  return {
    configured: true,
    enabled: !!wall.enabled,
    screen,
    on_air: target ? { layout: enrich(target.layout_id), label: target.label, source: target.source } : null,
    scheduled: slot ? { layout: enrich(slot.layout_id), label: slot.label, dow: slot.dow, start: slot.start } : null,
    override: wall.override_layout_id ? { layout: enrich(wall.override_layout_id), until: wall.override_until } : null,
    schedule: schedule.map(s => ({ ...s, layout: enrich(s.layout_id) })),
  };
}

function replaceSchedule(studioId, slots) {
  const { v4: uuidv4 } = require('uuid');
  const del = db.prepare('DELETE FROM card_wall_schedule WHERE studio_id = ?');
  const ins = db.prepare('INSERT INTO card_wall_schedule (id, studio_id, dow, start, layout_id, label, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    del.run(studioId);
    slots.forEach((s, i) => ins.run(uuidv4(), studioId, s.dow, s.start, s.layout_id, s.label || null, s.sort_order ?? i));
  })();
  tick(studioId, { force: true });
  return getState(studioId);
}

function start() {
  if (intervalId) return;
  // Tick shortly after boot so screens that reconnect get the right card, then
  // every 30s. Slot boundaries are on the minute, so 30s is ample resolution.
  setTimeout(() => tickAll({ force: true }), 4000);
  intervalId = setInterval(() => tickAll(), 30000);
  console.log('Card wall engine started (30s tick)');
}

function stop() { if (intervalId) { clearInterval(intervalId); intervalId = null; } }

module.exports = { start, stop, tick, tickAll, override, resume, setEnabled, getState, replaceSchedule, scheduledSlot };
