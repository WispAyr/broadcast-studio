import React, { useEffect, useState, useCallback } from 'react';
import IngestFeedModule from './IngestFeedModule';

/**
 * IngestGridModule — live mosaic of all active ingest slots.
 *
 * Polls the ingest centre for the current slot list and renders up to
 * max_slots feeds in a responsive grid. Ideal for fanzones where multiple
 * phone streams come in simultaneously.
 *
 * Config:
 *   ingest_api    — ingest centre API base (default: /api/ingest)
 *   event_tag     — filter to slots with this event_tag (optional)
 *   max_slots     — maximum number of slots to show (default: 4)
 *   go2rtc_host   — go2rtc API base (default: /go2rtc)
 *   show_labels   — show slot name overlays (default: true)
 *   show_waiting  — show waiting state for offline slots (default: false)
 *   poll_interval — how often to poll for slot list in ms (default: 8000)
 *   background    — background color (default: #000)
 *   highlight_live — bring live slots to front (default: true)
 */
export default function IngestGridModule({ config = {} }) {
  const {
    ingest_api = '/api/ingest',
    event_tag,
    max_slots = 4,
    go2rtc_host = '/go2rtc',
    show_labels = true,
    show_waiting = false,
    poll_interval = 8000,
    background = '#000000',
    highlight_live = true,
  } = config;

  const [slots, setSlots] = useState([]);
  const [error, setError] = useState('');
  const [lastPoll, setLastPoll] = useState(null);

  const fetchSlots = useCallback(async () => {
    try {
      const url = event_tag
        ? `${ingest_api}/slots?event_tag=${encodeURIComponent(event_tag)}`
        : `${ingest_api}/slots`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      let fetched = data.slots || [];

      // Sort: live first if highlight_live, then by display_order
      if (highlight_live) {
        fetched = [...fetched].sort((a, b) => {
          if (a.live && !b.live) return -1;
          if (!a.live && b.live) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });
      }

      setSlots(fetched.slice(0, max_slots));
      setError('');
      setLastPoll(Date.now());
    } catch (e) {
      setError(`Ingest API: ${e.message}`);
    }
  }, [ingest_api, event_tag, max_slots, highlight_live]);

  useEffect(() => {
    fetchSlots();
    const timer = setInterval(fetchSlots, poll_interval);
    return () => clearInterval(timer);
  }, [fetchSlots, poll_interval]);

  // ── Grid layout calculation ─────────────────────────────────────────────
  const count = slots.length;
  const gridStyle = (() => {
    if (count <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    if (count === 3) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
  })();

  // ── No slots ────────────────────────────────────────────────────────────
  if (!count && !error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background }}>
        <span className="text-5xl opacity-20">📡</span>
        <div className="text-center">
          <p className="text-gray-500 text-sm font-semibold">No ingest slots</p>
          {event_tag && <p className="text-gray-600 text-xs mt-0.5">Event: {event_tag}</p>}
          <p className="text-gray-700 text-xs mt-2">Create slots in the Ingest Centre</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background }}>
        <span className="text-red-400 text-sm font-semibold">Ingest Centre unavailable</span>
        <span className="text-gray-600 text-xs">{error}</span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full grid gap-0.5"
      style={{ background, ...gridStyle }}
    >
      {slots.map((slot, i) => {
        // If slot 3 and only 3 total, span 2 cols to fill the gap
        const isThirdOfThree = count === 3 && i === 2;
        return (
          <div
            key={slot.id}
            className="relative overflow-hidden"
            style={isThirdOfThree ? { gridColumn: '1 / -1' } : {}}
          >
            <IngestFeedModule
              config={{
                slot_id: slot.id,
                slot_name: slot.name,
                go2rtc_host,
                show_label: show_labels,
                show_waiting,
                ingest_api,
                background,
                ...(slot.type === 'iframe' && slot.iframe_url
                  ? { mode: 'iframe', iframe_url: slot.iframe_url }
                  : {}),
              }}
            />
            {/* Live indicator dot in top-right corner */}
            {slot.live && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 backdrop-blur rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-white font-bold tracking-wide">LIVE</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
