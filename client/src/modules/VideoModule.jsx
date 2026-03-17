import React from 'react';

export default function VideoModule({ config = {} }) {
  const src = config.src || config.url || '';
  const autoplay = config.autoplay !== false;
  const loop = config.loop !== false;
  const muted = config.muted !== false;

  if (!src) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-sm">No video set</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ background: config.background || '#000' }}>
      <video
        src={src}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
