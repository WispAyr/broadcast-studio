/**
 * Pavilion Festival event cache (client-side).
 * Single subscribable source for all PavilionFestival* modules so we hit the
 * server once for the whole layout instead of N times. localStorage backs it
 * up so the kiosk survives a network drop.
 */

const STORAGE_KEY = 'pavilion-festival-event-v1';
const POLL_MS = 60_000;
const HARD_STALE_MS = 24 * 60 * 60_000;

let state = {
  data: null,           // event JSON
  fetchedAt: 0,         // ms
  loading: false,
  error: null,
  stale: false,         // true once we couldn't refresh past FRESH_MS
};
const subs = new Set();
let pollTimer = null;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && obj.data && obj.fetchedAt) {
      state.data = obj.data;
      state.fetchedAt = obj.fetchedAt;
      state.stale = (Date.now() - obj.fetchedAt) > POLL_MS;
    }
  } catch {}
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      data: state.data,
      fetchedAt: state.fetchedAt,
    }));
  } catch {}
}

function notify() {
  for (const fn of subs) {
    try { fn(state); } catch {}
  }
}

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  state.error = null;
  notify();
  try {
    const r = await fetch('/api/pavilion-festival/event', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    state.data = data;
    state.fetchedAt = Date.now();
    state.stale = false;
    state.error = null;
    saveToStorage();
  } catch (err) {
    state.error = err;
    if (state.data && (Date.now() - state.fetchedAt) < HARD_STALE_MS) {
      state.stale = true;
    } else {
      // Drop nothing — keep last-known data so the kiosk never blanks.
      state.stale = true;
    }
  } finally {
    state.loading = false;
    notify();
  }
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(refresh, POLL_MS);
  // Page-visibility refresh — when the kiosk comes back from screen-off, get fresh data.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
  }
}

let initialised = false;
function init() {
  if (initialised) return;
  initialised = true;
  loadFromStorage();
  refresh();
  ensurePolling();
}

export function subscribePavilionEvent(fn) {
  init();
  subs.add(fn);
  // Fire immediately with current state.
  try { fn(state); } catch {}
  return () => subs.delete(fn);
}

export function getPavilionEventSync() {
  init();
  return state;
}

// ── Helpers used by modules ────────────────────────────────────────────────

/** Parse a schedule entry's start/end times (or returns null if TBA). */
export function parseScheduleTime(entry) {
  if (!entry || !entry.start || entry.start === 'TBA') return null;
  const ts = Date.parse(entry.start);
  if (Number.isNaN(ts)) return null;
  return new Date(ts);
}

/** Group all sets by stage for a given day (YYYY-MM-DD). Returns [{stage, schedule}]. */
export function getStagesForDay(eventData, dayIso) {
  if (!eventData?.stages) return [];
  return eventData.stages
    .map((stage) => {
      const schedule = (stage.schedule || []).filter(s => !dayIso || s.day === dayIso);
      return { stage, schedule };
    })
    .filter(s => s.schedule.length > 0);
}

/** Return today's day-of-festival ISO date if we're on one of them, else first day. */
export function getActiveDay(eventData, now = new Date()) {
  if (!eventData?.dates?.days) return null;
  const today = now.toISOString().slice(0, 10);
  const match = eventData.dates.days.find(d => d.date === today);
  if (match) return match.date;
  // Pre-event: highlight day 1. Post-event: highlight last day.
  return eventData.dates.days[0]?.date || null;
}

/** Compute now / next per stage for the active day. Falls back to ordering by category if all TBA. */
export function computeNowNextPerStage(eventData, now = new Date()) {
  const activeDay = getActiveDay(eventData, now);
  if (!activeDay) return [];
  const stages = getStagesForDay(eventData, activeDay);
  return stages.map(({ stage, schedule }) => {
    const withTimes = schedule
      .map(e => ({ ...e, _t: parseScheduleTime(e) }))
      .filter(e => e._t);

    if (withTimes.length === 0) {
      // No times yet → show headliner first, then support, then djs in their list order.
      const headliners = schedule.filter(s => s.headliner);
      const support = schedule.filter(s => s.category === 'support' && !s.headliner);
      const others = schedule.filter(s => s.category !== 'headliner' && s.category !== 'support');
      const ordered = [...headliners, ...support, ...others];
      return {
        stage,
        nowSet: ordered[0] || null,
        nextSet: ordered[1] || null,
        upcoming: ordered.slice(2, 5),
        timesKnown: false,
      };
    }

    withTimes.sort((a, b) => a._t - b._t);
    let nowSet = null;
    let nextSet = null;
    const t = now.getTime();
    for (let i = 0; i < withTimes.length; i++) {
      const cur = withTimes[i];
      const nxt = withTimes[i + 1];
      const setEnd = nxt ? nxt._t.getTime() : (cur._t.getTime() + 90 * 60_000);
      if (t >= cur._t.getTime() && t < setEnd) {
        nowSet = cur;
        nextSet = nxt || null;
        break;
      }
      if (t < cur._t.getTime()) {
        nextSet = cur;
        break;
      }
    }
    const upcoming = withTimes.filter(s => !nowSet || s._t > nowSet._t).slice(0, 4);
    return { stage, nowSet, nextSet, upcoming, timesKnown: true };
  });
}

/** Format a schedule start time as HH:MM, or "TBA". */
export function formatStart(entry) {
  const t = parseScheduleTime(entry);
  if (!t) return 'TBA';
  return t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
