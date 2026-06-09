import React from 'react';

/**
 * CallGridModule — the studio-call program grid as a layout source.
 *
 * Renders every guest currently ON AIR in a remote video call (studio-call /
 * LiveKit SFU on live.wispayr.online) as a client-composited grid. Drop this on
 * a screen/layout to put the whole panel of remote callers to air.
 *
 * Config:
 *   room        — studio-call room id (from the producer console URL)
 *   base        — studio-call surface base (default https://live.wispayr.online/call)
 *   transparent — transparent background for overlaying (default true)
 *   show_all    — also show admitted-but-not-yet-on-air guests (default false)
 */
export default function CallGridModule({ config = {} }) {
  const {
    room,
    base = 'https://live.wispayr.online/call',
    transparent = true,
    show_all = false,
  } = config;

  if (!room) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-sm">CallGrid: set a room id</span>
      </div>
    );
  }

  const params = new URLSearchParams();
  if (transparent) params.set('bg', 'transparent');
  if (show_all) params.set('show', 'all');
  const src = `${base.replace(/\/+$/, '')}/grid/${encodeURIComponent(room)}?${params}`;

  return (
    <div className="w-full h-full">
      <iframe
        src={src}
        className="w-full h-full border-0"
        title={config.title || `Call grid · ${room}`}
        allow="autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
