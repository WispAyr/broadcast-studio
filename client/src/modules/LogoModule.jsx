import React from 'react';

export default function LogoModule({ config = {} }) {
  const src = config.src || config.url || '';
  const maxWidth = config.maxWidth || '80%';
  const maxHeight = config.maxHeight || '80%';

  if (!src) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: config.background || 'transparent' }}
      >
        <span
          className="font-bold"
          style={{
            color: config.color || '#ffffff',
            fontSize: config.fontSize || '2rem'
          }}
        >
          {config.text || 'LOGO'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: config.background || 'transparent' }}
    >
      <img
        src={src}
        alt={config.alt || 'Logo'}
        style={{ maxWidth, maxHeight, objectFit: 'contain' }}
      />
    </div>
  );
}
