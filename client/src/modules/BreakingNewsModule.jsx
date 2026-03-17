import React from 'react';

export default function BreakingNewsModule({ config = {} }) {
  const headline = config.headline || config.text || 'BREAKING NEWS: This is a breaking news alert';
  const subtext = config.subtext || '';
  const speed = config.speed || 25;
  const bg = config.background || '#cc0000';
  const textColor = config.color || '#ffffff';
  const bannerStyle = config.style || 'full'; // 'full', 'banner', 'ticker'
  const urgent = config.urgent !== false;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: bg }}
    >
      {/* Breaking News Label */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/30 shrink-0">
        {urgent && (
          <span className="inline-block w-3 h-3 bg-white rounded-full animate-pulse" />
        )}
        <span
          className="text-sm font-black uppercase tracking-widest"
          style={{ color: textColor }}
        >
          Breaking News
        </span>
        {urgent && (
          <span className="inline-block w-3 h-3 bg-white rounded-full animate-pulse" />
        )}
      </div>

      {/* Main headline area */}
      {bannerStyle === 'ticker' ? (
        <div className="flex-1 flex items-center overflow-hidden">
          <div
            className="whitespace-nowrap"
            style={{
              color: textColor,
              fontSize: '1.5rem',
              fontWeight: 800,
              animation: `breaking-scroll ${speed}s linear infinite`,
            }}
          >
            {headline}
            <span className="mx-8 opacity-50">&#9679;</span>
            {headline}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p
            className="font-black leading-tight"
            style={{
              color: textColor,
              fontSize: config.fontSize || '1.75rem',
            }}
          >
            {headline}
          </p>
          {subtext && (
            <p
              className="mt-2 opacity-80 text-sm"
              style={{ color: textColor }}
            >
              {subtext}
            </p>
          )}
        </div>
      )}

      {/* Bottom scrolling ticker */}
      {bannerStyle !== 'ticker' && subtext && (
        <div className="bg-black/40 py-1 overflow-hidden shrink-0">
          <div
            className="whitespace-nowrap text-sm"
            style={{
              color: textColor,
              animation: `breaking-scroll ${speed}s linear infinite`,
            }}
          >
            {subtext}
            <span className="mx-8 opacity-50">&#9679;</span>
            {subtext}
          </div>
        </div>
      )}

      <style>{`
        @keyframes breaking-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
