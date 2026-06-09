import React, { useEffect, useState, useCallback } from 'react';
import IngestFeedModule from './IngestFeedModule';

/**
 * IngestGridModule — live mosaic of all active ingest slots.
 * Polls the ingest centre API and renders up to max_slots feeds in a grid.
 *
 * Config:
 *   ingest_api    — ingest centre API (default: https://live.wispayr.online/api/ingest)
 *   event_tag     — filter slots by event_tag (optional)
 *   max_slots     — max feeds to show (default: 4)
 *   go2rtc_host   — go2rtc API base (default: https://live.wispayr.online/go2rtc)
 *   show_labels   — show slot name overlays (default: true)
 *   show_waiting  — show waiting state for offline slots (default: false)
 *   poll_interval — poll interval in ms (default: 8000)
 *   background    — background color (default: #000)
 *   highlight_live — bring live slots to front (default: true)
 */
export default function IngestGridModule({ config = {} }) {
  const {
    ingest_api = 'https://live.wispayr.online/api/ingest',
    event_tag,
    max_slots = 4,
    go2rtc_host = 'https://live.wispayr.online/go2rtc',
    show_labels = true,
    show_waiting = false,
    poll_interval = 8000,
    background = '#000000',
    highlight_live = true,
  } = config;

  const [slots, setSlots] = useState([]);
  const [error, setError] = useState('');

  const fetchSlots = useCallback(async () => {
    try {
      const url = event_tag
        ? `${ingest_api}/slots?event_tag=${encodeURIComponent(event_tag)}`
        : `${ingest_api}/slots`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      let fetched = data.slots || [];
      if (highlight_live) {
        fetched = [...fetched].sort((a, b) => {
          if (a.live && !b.live) return -1; if (!a.live && b.live) return 1;
          return (a.display_order||0) - (b.display_order||0);
        });
      }
      setSlots(fetched.slice(0, max_slots)); setError('');
    } catch (e) { setError(`Ingest API: ${e.message}`); }
  }, [ingest_api, event_tag, max_slots, highlight_live]);

  useEffect(() => {
    fetchSlots();
    const timer = setInterval(fetchSlots, poll_interval);
    return () => clearInterval(timer);
  }, [fetchSlots, poll_interval]);

  const count = slots.length;
  const gridStyle = count <= 1 ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    : count === 2 ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
    : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };

  if (!count && !error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background }}>
        <span className="text-5xl opacity-20">📡</span>
        <div className="text-center">
          <p className="text-gray-500 text-sm font-semibold">No ingest slots</p>
          {event_tag && <p className="text-gray-600 text-xs mt-0.5">Event: {event_tag}</p>}
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
    <div className="w-full h-full grid gap-0.5" style={{ background, ...gridStyle }}>
      {slots.map((slot, i) => {
        const isThirdOfThree = count === 3 && i === 2;
        return (
          <div key={slot.id} className="relative overflow-hidden"
            style={isThirdOfThree ? { gridColumn: '1 / -1' } : {}}>
            <IngestFeedModule config={{
              slot_id: slot.id, slot_name: slot.name, go2rtc_host,
              show_label: show_labels, show_waiting, ingest_api, background,
              ...(slot.type === 'iframe' && slot.iframe_url ? { mode: 'iframe', iframe_url: slot.iframe_url } : {}),
            }} />
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
