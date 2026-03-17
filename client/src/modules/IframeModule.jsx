import React from 'react';

export default function IframeModule({ config = {} }) {
  const src = config.src || config.url || '';

  if (!src) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-sm">No URL set</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <iframe
        src={src}
        className="w-full h-full border-0"
        title={config.title || 'Embedded content'}
        sandbox={config.sandbox || 'allow-scripts allow-same-origin'}
        allow={config.allow || ''}
      />
    </div>
  );
}
