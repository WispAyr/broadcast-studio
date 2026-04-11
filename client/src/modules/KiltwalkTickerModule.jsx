import React from 'react';

export default function KiltwalkTickerModule({ config = {} }) {
  const items = config.items || [
    '🏴󠁧󠁢󠁳󠁣󠁴󠁿 The Kiltwalk has raised over £40 million for Scottish charities since 2016',
    '💜 Every penny raised goes to your chosen charity — The Hunter Foundation tops up by 50%',
    '🎉 Thank you to all our amazing Kiltwalkers!',
    '🏅 2025 Glasgow Kiltwalk raised £4.5 million for 900 Scottish charities',
  ];
  const speed = config.speed || 60;
  const bg = config.background || '#1a1a2e';
  const accentColor = config.accentColor || '#f8af35';

  const text = items.join('     ★     ');
  // Double for seamless loop
  const doubled = text + '     ★     ' + text;
  const duration = doubled.length / speed * 2;

  return (
    <div className="w-full h-full flex items-center relative overflow-hidden"
      style={{ background: bg }}>
      <style>{`
        @keyframes kiltTickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: `linear-gradient(90deg, #e63b2b, #008bc7, #006a47, #f8af35, #e63b2b)`,
        backgroundSize: '200% 100%',
      }} />

      {/* Kiltwalk badge */}
      <div className="flex-shrink-0 px-4 py-1 z-10 h-full flex items-center" style={{
        background: `linear-gradient(90deg, ${bg}, ${bg}ee)`,
      }}>
        <img src="/assets/kiltwalk/logo.svg" alt="" className="h-5 opacity-80" />
      </div>

      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden">
        <div className="whitespace-nowrap" style={{
          animation: `kiltTickerScroll ${duration}s linear infinite`,
          color: '#ffffff',
          fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}>
          {doubled}
        </div>
      </div>

      {/* Fade edges */}
      <div className="absolute left-16 top-0 bottom-0 w-8 pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${bg}, transparent)` }} />
      <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
        style={{ background: `linear-gradient(270deg, ${bg}, transparent)` }} />
    </div>
  );
}
