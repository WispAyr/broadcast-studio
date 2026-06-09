import React from 'react';

/**
 * CallGuestModule — a single remote caller as a layout source.
 *
 * Renders one specific guest from a studio-call room (by LiveKit identity) so a
 * producer can place an individual caller anywhere in a layout — full-frame,
 * picture-in-picture, side-by-side, etc. Shows the guest whenever they are
 * connected (independent of the on-air grid).
 *
 * Config:
 *   room        — studio-call room id
 *   identity    — the guest's LiveKit identity (e.g. g_54c3b35f), shown in the
 *                 producer console / available from /api/call/rooms/:id
 *   base        — studio-call surface base (default https://live.wispayr.online/call)
 *   transparent — transparent background (default true)
 */
export default function CallGuestModule({ config = {} }) {
  const {
    room,
    identity,
    base = 'https://live.wispayr.online/call',
    transparent = true,
  } = config;

  if (!room || !identity) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-sm">CallGuest: set room + identity</span>
      </div>
    );
  }

  const params = new URLSearchParams({ only: identity });
  if (transparent) params.set('bg', 'transparent');
  const src = `${base.replace(/\/+$/, '')}/grid/${encodeURIComponent(room)}?${params}`;

  return (
    <div className="w-full h-full">
      <iframe
        src={src}
        className="w-full h-full border-0"
        title={config.title || `Call guest · ${identity}`}
        allow="autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
