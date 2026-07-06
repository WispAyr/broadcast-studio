import { useState, useEffect } from 'react';

/**
 * Live-data hooks for NAR broadcast compositions.
 *
 * These let a Remotion composition show REAL current data (now-playing track,
 * on-air show, weather, news) instead of frozen hand-typed values, while
 * falling back to the composition's schema props whenever the feed is missing.
 *
 * Determinism: pass `live: false` to disable all network activity, so an
 * offline / deterministic render uses only the passed-in props. When `live`
 * is true (the default for studio screens) the hook polls and the composition
 * re-renders as data changes.
 */

// Poll a JSON endpoint on an interval with graceful failure. Returns the latest
// successful payload (or null until the first success). Keeps last-good on a
// transient error so a blip doesn't flash the card back to fallback.
function usePolledJson(url, { enabled = true, intervalMs = 15000 } = {}) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled || !url) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        /* keep last-good; the composition falls back to its props */
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [url, enabled, intervalMs]);
  return data;
}

// NAR station on broadcast.radio. Feed also carries onAir/next show + history,
// so this one endpoint powers Now Playing, Show Banner and Countdown.
export const NAR_STATION_ID = 7719;
// Ayr, Scotland.
export const AYR_COORDS = { lat: 55.4586, lon: -4.6292 };

export function useNowPlaying({ stationId = NAR_STATION_ID, live = true, intervalMs = 15000 } = {}) {
  return usePolledJson(`/api/nowplaying/${stationId}`, { enabled: live, intervalMs });
}

export function useWeatherLive({ lat = AYR_COORDS.lat, lon = AYR_COORDS.lon, live = true, intervalMs = 300000 } = {}) {
  return usePolledJson(`/api/proxy/weather?lat=${lat}&lon=${lon}`, { enabled: live, intervalMs });
}

export function useNewsLive({ url = '', live = true, intervalMs = 120000 } = {}) {
  const q = url ? `/api/proxy/rss?url=${encodeURIComponent(url)}` : null;
  return usePolledJson(q, { enabled: live && !!url, intervalMs });
}

// ── formatting helpers ───────────────────────────────────────────────────────

// Epoch-ms → "6AM" / "9:30PM".
export function fmtHour(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12; if (h === 0) h = 12;
  const m = d.getMinutes();
  return m ? `${h}:${String(m).padStart(2, '0')}${ampm}` : `${h}${ampm}`;
}

// on-air show start/end (epoch ms) → "6AM - 10AM".
export function fmtShowTime(start, end) {
  if (!start && !end) return '';
  return `${fmtHour(start)} - ${fmtHour(end)}`;
}

// Weather proxy `forecast` array → NARWeather's "Today 12°|Tue 14°|Wed 11°".
export function forecastToString(forecast, days = 3) {
  if (!Array.isArray(forecast)) return '';
  return forecast.slice(0, days).map((d, i) => {
    const label = i === 0 ? 'Today' : new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' });
    return `${label} ${Math.round(d.high)}°`;
  }).join('|');
}

// Seconds until an epoch-ms instant (never negative), or null.
export function secondsUntil(ms) {
  if (!ms) return null;
  return Math.max(0, Math.floor((Number(ms) - Date.now()) / 1000));
}
