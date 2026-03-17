import React from 'react';

export default function TickerModule({ config = {} }) {
  const text = config.text || config.content || 'Ticker text goes here';
  const speed = config.speed || 30;
  const color = config.color || '#ffffff';
  const bg = config.background || 'transparent';
  const fontSize = config.fontSize || '1.25rem';

  return (
    <div
      className="w-full h-full flex items-center overflow-hidden"
      style={{ background: bg }}
    >
      <div
        className="whitespace-nowrap animate-ticker"
        style={{
          color,
          fontSize,
          animation: `ticker ${speed}s linear infinite`
        }}
      >
        {text}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-ticker {
          animation: ticker ${speed}s linear infinite;
        }
      `}</style>
    </div>
  );
}
