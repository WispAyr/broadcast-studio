/**
 * Ayr Pavilion "What's On" cache (client-side).
 * One subscribable source for every PavilionWhatsOn module on a screen, backed
 * by localStorage so a kiosk survives a network drop / reboot without blanking.
 */

const STORAGE_KEY = 'pavilion-whatson-v1';
const POLL_MS = 5 * 60_000;

let state = {
  events: null,      // normalised events array (from /api/pavilion-events)
  fetchedAt: 0,
  loading: false,
  error: null,
  stale: false,
};
const subs = new Set();
let pollTimer = null;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.events) && obj.fetchedAt) {
      state.events = obj.events;
      state.fetchedAt = obj.fetchedAt;
      state.stale = (Date.now() - obj.fetchedAt) > POLL_MS;
    }
  } catch {}
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ events: state.events, fetchedAt: state.fetchedAt }));
  } catch {}
}

function notify() {
  for (const fn of subs) { try { fn(state); } catch {} }
}

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  state.error = null;
  notify();
  try {
    const r = await fetch('/api/pavilion-events', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data.events)) throw new Error('bad payload');
    state.events = data.events;
    state.fetchedAt = Date.now();
    state.stale = !!data.stale;
    saveToStorage();
  } catch (err) {
    state.error = err;
    state.stale = true; // keep whatever we had — never blank the screen
  } finally {
    state.loading = false;
    notify();
  }
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(refresh, POLL_MS);
}

/** Subscribe to the cache; returns an unsubscribe fn. Fires immediately with current state. */
export function subscribePavilionWhatsOn(fn) {
  if (!state.events && !state.loading) loadFromStorage();
  subs.add(fn);
  fn(state);
  ensurePolling();
  if (!state.events || (Date.now() - state.fetchedAt) > POLL_MS) refresh();
  return () => { subs.delete(fn); };
}

export function refreshPavilionWhatsOn() { return refresh(); }

// ── Presentation helpers (shared so any future module renders dates the same way) ──

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseDate(d) {
  const [y, m, day] = String(d || '').split('-').map(Number);
  return (y && m && day) ? new Date(y, m - 1, day) : null;
}

export function whenLabel(d, now = new Date()) {
  const dt = parseDate(d); if (!dt) return '';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = Math.round((dt - today) / 86400000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  if (days <= 6) return 'THIS ' + DAYS[dt.getDay()].toUpperCase();
  if (days <= 13) return 'NEXT ' + DAYS[dt.getDay()].toUpperCase();
  return DAYS[dt.getDay()].toUpperCase() + ' ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()].toUpperCase();
}

export function dateLine(d) {
  const dt = parseDate(d); if (!dt) return '';
  return DAYS[dt.getDay()] + ' ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()] + ' ' + dt.getFullYear();
}

export function shortDate(d) {
  const dt = parseDate(d); if (!dt) return '';
  return DAYS[dt.getDay()] + ' ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()];
}

export function timeLabel(t) {
  if (!t) return '';
  t = String(t).trim();
  if (/[-–]/.test(t) || /\s/.test(t)) return t;       // ranges / free text kept as-is
  const m = t.match(/^(\d{1,2}):(\d{2})/); if (!m) return t;
  let h = +m[1]; const mm = m[2]; const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return h + (mm === '00' ? '' : ':' + mm) + ap;
}

/** Series key: same day + same title once "Session N" / "@ venue" noise is stripped. */
function seriesKey(ev) {
  const base = String(ev.title || '')
    .toLowerCase()
    .replace(/sess+ion\s*\d+/g, '')
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ev.event_date + '|' + base;
}

function seriesTitle(title) {
  return String(title || '')
    .replace(/\s*[-–—:]?\s*sess+ion\s*\d+/i, '')
    .replace(/\s*@.*$/, '')
    .replace(/[\s'"!]+$/, '')
    .trim();
}

/**
 * Curate the raw list for display:
 *  - upcoming only (event_date >= today), online, not cancelled
 *  - chronological; `featured` mode floats featured events to the front
 *  - same-day "Session 1..N" runs collapse into one card with all the times
 */
export function curateEvents(all, { mode = 'upcoming', now = new Date() } = {}) {
  if (!Array.isArray(all)) return [];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  let up = all.filter(e => {
    const d = parseDate(e.event_date);
    return d && d >= today && e.online !== false && !/cancel/i.test(e.status || '');
  });
  up.sort((a, b) => (a.event_date + (a.event_time || '')).localeCompare(b.event_date + (b.event_time || '')));

  // group series
  const groups = new Map();
  for (const e of up) {
    const k = seriesKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const merged = [];
  for (const list of groups.values()) {
    if (list.length < 2) { merged.push({ ...list[0], times: list[0].event_time ? [list[0].event_time] : [] }); continue; }
    const first = list[0];
    merged.push({
      ...first,
      title: seriesTitle(first.title) || first.title,
      times: list.map(x => x.event_time).filter(Boolean),
      sessions: list.length,
      featured: list.some(x => x.featured),
      poster_image: list.find(x => x.poster_image)?.poster_image || '',
      ticket_url: list.find(x => x.ticket_url)?.ticket_url || '',
      lineup: list.find(x => x.lineup && x.lineup.length)?.lineup || [],
    });
  }
  merged.sort((a, b) => (a.event_date + (a.event_time || '')).localeCompare(b.event_date + (b.event_time || '')));

  if (mode === 'featured') {
    return merged.filter(e => e.featured).concat(merged.filter(e => !e.featured));
  }
  return merged;
}
