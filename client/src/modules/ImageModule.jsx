import React from 'react';

export default function ImageModule({ config = {} }) {
  const src = config.src || config.url || '';
  const fit = config.fit || 'contain';

  if (!src) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-sm">No image set</span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full"
      style={{ background: config.background || 'transparent' }}
    >
      <img
        src={src}
        alt={config.alt || ''}
        className="w-full h-full"
        style={{ objectFit: fit }}
      />
    </div>
  );
}
