import React from 'react';

export default function QRCodeModule({ config = {} }) {
  const url = config.url || 'https://example.com';
  const label = config.label || '';
  const showUrl = config.showUrl !== false;
  const qrColor = (config.color || '#ffffff').replace('#', '');
  const qrBg = (config.background || '#000000').replace('#', '');
  const size = config.size || 300;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=${qrColor}&bgcolor=${qrBg}&format=svg`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: `#${qrBg}` }}>
      {/* Glass panel */}
      <div className="relative z-10 flex flex-col items-center p-8 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
        <img
          src={qrSrc}
          alt={`QR: ${url}`}
          style={{ width: Math.min(size, 280), height: Math.min(size, 280) }}
          className="rounded-lg"
        />
        {label && (
          <p className="mt-4 text-lg font-bold tracking-wide" style={{ color: `#${qrColor}` }}>
            {label}
          </p>
        )}
        {showUrl && (
          <p className="mt-1 text-sm opacity-50 font-mono" style={{ color: `#${qrColor}` }}>
            {url}
          </p>
        )}
      </div>
    </div>
  );
}
