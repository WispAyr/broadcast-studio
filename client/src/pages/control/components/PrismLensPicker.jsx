import React, { useEffect, useMemo, useState } from 'react';

/**
 * PrismLensPicker — three-step config for a `prism-lens` module:
 *   1) pick an Event (GET /api/prism-proxy/events-admin)
 *   2) pick a Lens from that event's prism_lenses whitelist
 *      (or choose one of the built-in traffic lenses regardless of event)
 *   3) pick a Display mode
 *
 * Emits a single object via onChange:
 *   { endpoint, display, title, color, fields, cameraId, eventId }
 *
 * The parent spreads that object into the module's config at save time.
 */

// Built-in lens catalogue — endpoint, friendly label, default display, which
// fields it exposes, and a sensible accent colour. These are always available
// even if an event hasn't whitelisted them yet. When the user picks an event,
// its own whitelist is merged in.
const BUILT_IN_LENSES = [
  {
    key: 'traffic-network',
    label: 'Traffic — Network Overview',
    display: 'list',
    color: '#f8af35',
    fields: ['cameras_total', 'incidents_active', 'roadworks_active', 'vms_messages', 'health'],
  },
  {
    key: 'traffic-network',
    label: 'Traffic — Incident Trend (24h)',
    display: 'sparkline',
    color: '#ef4444',
    fields: ['incidents'],
  },
  {
    key: 'traffic-observations',
    label: 'Traffic — Observations Feed',
    display: 'observations',
    color: '#f8af35',
  },
  {
    key: 'traffic-cameras-enriched',
    label: 'Traffic — Camera with Nearby Alerts',
    display: 'image',
    color: '#80cef4',
  },
  {
    key: 'road-health',
    label: 'Road Health (Corridors)',
    display: 'list',
    color: '#f97316',
    fields: ['overall_score', 'health', 'total_incidents', 'total_roadworks', 'worst_corridor'],
  },
];

const DISPLAYS = ['bignum', 'list', 'sparkline', 'observations', 'image', 'json'];

export default function PrismLensPicker({ value, onChange }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventId, setEventId] = useState(value?.eventId || '');
  const [lensIdx, setLensIdx] = useState(0);
  const [display, setDisplay] = useState(value?.display || 'list');
  const [cameraId, setCameraId] = useState(value?.cameraId || '');
  const [cameras, setCameras] = useState([]);

  // Load events
  useEffect(() => {
    let cancelled = false;
    fetch('/api/prism-proxy/events-admin')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setEvents(j?.events || []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const activeEvent = useMemo(
    () => events.find((e) => String(e.id) === String(eventId)) || null,
    [events, eventId]
  );

  // Merge built-in lenses with event-scoped ones
  const availableLenses = useMemo(() => {
    const list = [...BUILT_IN_LENSES];
    if (activeEvent?.prism_lenses?.length) {
      for (const lk of activeEvent.prism_lenses) {
        if (!list.some((l) => l.key === lk)) {
          list.push({ key: lk, label: `${lk}  (from event)`, display: 'list', color: '#a78bfa' });
        }
      }
    }
    return list;
  }, [activeEvent]);

  const selectedLens = availableLenses[lensIdx] || availableLenses[0];

  // Auto-load cameras when display === 'image'
  useEffect(() => {
    if (display !== 'image') return undefined;
    let cancelled = false;
    fetch('/api/prism-proxy/traffic-cameras-enriched')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const data = j?.data || j;
        setCameras(data?.cameras || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [display]);

  // Propagate selection upward whenever any input changes
  useEffect(() => {
    if (!selectedLens) return;
    const config = {
      eventId: eventId || undefined,
      endpoint: selectedLens.key,
      display: display || selectedLens.display,
      title: selectedLens.label.toUpperCase(),
      color: selectedLens.color,
      fields: selectedLens.fields,
    };
    if (display === 'image' && cameraId) {
      config.cameraId = cameraId;
      config.imageUrlBase = '/api/prism-proxy/traffic/cameras/image/{image_name}';
    }
    onChange(config);
  }, [selectedLens, display, eventId, cameraId, onChange]);

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block">
        Event (optional — scopes the lens menu)
      </label>
      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:border-blue-500"
      >
        <option value="">— None —</option>
        {loading && <option disabled>Loading…</option>}
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name} {ev.status ? `· ${ev.status}` : ''}
          </option>
        ))}
      </select>
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      {activeEvent && (
        <div className="text-[10px] text-gray-500">
          {activeEvent.prism_lenses?.length || 0} lens binding
          {activeEvent.prism_lenses?.length === 1 ? '' : 's'} ·{' '}
          {activeEvent.siphon_rivers?.length || 0} data source
          {activeEvent.siphon_rivers?.length === 1 ? '' : 's'}
        </div>
      )}

      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mt-3">
        Lens
      </label>
      <select
        value={lensIdx}
        onChange={(e) => setLensIdx(Number(e.target.value))}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:border-blue-500"
      >
        {availableLenses.map((l, i) => (
          <option key={`${l.key}-${i}`} value={i}>
            {l.label}
          </option>
        ))}
      </select>

      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mt-3">
        Display
      </label>
      <div className="flex flex-wrap gap-1">
        {DISPLAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDisplay(d)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              display === d
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {display === 'image' && (
        <>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mt-3">
            Camera ({cameras.length} available)
          </label>
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:border-blue-500"
          >
            <option value="">— Select camera —</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.observation_count > 0 ? ` · ${c.observation_count} obs` : ''}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
