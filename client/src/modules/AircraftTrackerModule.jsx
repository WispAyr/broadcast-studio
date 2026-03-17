import React from 'react';

export default function AircraftTrackerModule({ config = {} }) {
  const lat = config.lat || config.latitude || 55.46;
  const lon = config.lon || config.longitude || -4.63;
  const zoom = config.zoom || 9;
  const src = config.src || config.url || `https://globe.adsbexchange.com/?lat=${lat}&lon=${lon}&zoom=${zoom}&noui`;
  const bg = config.background || '#000000';

  return (
    <div className="w-full h-full" style={{ background: bg }}>
      <iframe
        src={src}
        title="Aircraft Tracker"
        className="w-full h-full border-0"
        style={{ border: 'none' }}
        allow="autoplay; fullscreen"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
