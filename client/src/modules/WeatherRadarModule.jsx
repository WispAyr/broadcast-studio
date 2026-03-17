import React from 'react';

export default function WeatherRadarModule({ config = {} }) {
  const lat = config.lat || config.latitude || 55.46;
  const lon = config.lon || config.longitude || -4.63;
  const zoom = config.zoom || 8;
  const src = config.src || config.url || `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=mph&zoom=${zoom}&overlay=radar&product=radar&level=surface&lat=${lat}&lon=${lon}`;
  const bg = config.background || '#000000';

  return (
    <div className="w-full h-full" style={{ background: bg }}>
      <iframe
        src={src}
        title="Weather Radar"
        className="w-full h-full border-0"
        style={{ border: 'none' }}
        allow="autoplay"
        loading="lazy"
      />
    </div>
  );
}
