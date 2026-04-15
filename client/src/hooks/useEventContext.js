/**
 * useEventContext(eventId)
 *
 * When a module config carries `eventId`, modules can call this to fetch the
 * event's location/hub/config once and use those values to override their
 * own hardcoded defaults. Fetches `/api/prism-proxy/events/:id/context` which
 * is always 200 (no lens computation required).
 *
 * Return shape:
 *   { loading, error, event, lat, lon, location, hub }
 *
 * If `eventId` is falsy, returns an inert object with everything null so
 * callers can unconditionally spread-over their defaults:
 *
 *   const ctx = useEventContext(config.eventId);
 *   const lat = ctx.lat ?? config.lat ?? 55.46;
 */
import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useEventContext(eventId) {
  const [state, setState] = useState({
    loading: Boolean(eventId),
    error: null,
    event: null,
    lat: null,
    lon: null,
    location: null,
    hub: null,
  });

  useEffect(() => {
    if (!eventId) {
      setState({
        loading: false,
        error: null,
        event: null,
        lat: null,
        lon: null,
        location: null,
        hub: null,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/prism-proxy/events/${encodeURIComponent(eventId)}/context`
        );
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok || j?.error) {
          setState((s) => ({ ...s, loading: false, error: j?.error || `HTTP ${r.status}` }));
          return;
        }
        const ev = j.event || {};
        setState({
          loading: false,
          error: null,
          event: ev,
          lat: ev.location_lat ?? null,
          lon: ev.location_lon ?? null,
          location: ev.location ?? null,
          hub: ev.hub_airport ?? null,
        });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}

export default useEventContext;
