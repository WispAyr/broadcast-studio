import React, { useState, useEffect } from 'react';

export default function BreakingNewsModule({ config = {} }) {
  const headline = config.headline || config.text || 'BREAKING NEWS: This is a breaking news alert';
  const subtext = config.subtext || '';
  const speed = config.speed || 25;
  const textColor = config.color || '#ffffff';
  const bannerStyle = config.style || 'full';
  const urgent = config.urgent !== false;
  const [flash, setFlash] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setFlash(v => !v), 800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative" style={{ background: '#000' }}>
      <style>{`
        @keyframes breakingSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes breakingPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(220,0,0,0.3); }
          50% { box-shadow: 0 0 40px rgba(220,0,0,0.6); }
        }
        @keyframes breakingScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes breakingGradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes breakingFlash {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.7; }
        }
        .breaking-bar {
          background: linear-gradient(90deg, #8b0000, #cc0000, #ff1a1a, #cc0000, #8b0000);
          background-size: 200% 100%;
          animation: breakingGradient 4s ease-in-out infinite, breakingPulse 2s ease-in-out infinite;
        }
        .breaking-headline {
          animation: breakingSlideIn 0.6s ease-out forwards;
        }
        .breaking-ticker {
          animation: breakingScroll ${speed}s linear infinite;
        }
      `}</style>

      {/* Top banner bar */}
      <div className="breaking-bar flex items-center gap-3 px-5 py-2.5 shrink-0 relative z-10">
        {urgent && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
        )}
        <span className="text-sm font-black uppercase tracking-[0.3em]" style={{ color: textColor, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          Breaking News
        </span>
        {urgent && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
        )}
        {/* Timestamp */}
        <span className="ml-auto text-[10px] font-mono opacity-60" style={{ color: textColor, fontVariantNumeric: 'tabular-nums' }}>
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Accent line */}
      <div className="h-0.5 shrink-0" style={{ background: 'linear-gradient(90deg, #ff0000, #ff6600, #ff0000)' }} />

      {/* Main content */}
      {bannerStyle === 'ticker' ? (
        <div className="flex-1 flex items-center overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a0000, #0d0000)' }}>
          <div className="whitespace-nowrap breaking-ticker" style={{ color: textColor, fontSize: '1.5rem', fontWeight: 800 }}>
            <span>{headline}</span>
            <span className="mx-6 opacity-30">●</span>
            <span>{headline}</span>
            <span className="mx-6 opacity-30">●</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative"
          style={{ background: 'linear-gradient(180deg, #1a0000 0%, #0a0000 100%)' }}>
          {/* Subtle side glow */}
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(180deg, #cc0000, transparent)' }} />
          <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(180deg, #cc0000, transparent)' }} />

          <p className="font-black leading-tight breaking-headline"
            style={{ color: textColor, fontSize: config.fontSize || '2rem', textShadow: '0 2px 20px rgba(200,0,0,0.3)', letterSpacing: '-0.01em' }}>
            {headline}
          </p>
          {subtext && (
            <p className="mt-3 opacity-70 text-sm font-medium breaking-headline" style={{ color: textColor, animationDelay: '0.3s', opacity: 0 }}>
              {subtext}
            </p>
          )}
        </div>
      )}

      {/* Bottom ticker */}
      {bannerStyle !== 'ticker' && subtext && (
        <div className="shrink-0 overflow-hidden py-1.5 relative" style={{ background: 'rgba(150,0,0,0.4)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,0,0,0.5), transparent)' }} />
          <div className="whitespace-nowrap breaking-ticker text-sm font-medium" style={{ color: textColor }}>
            <span>{subtext}</span>
            <span className="mx-6 opacity-30">●</span>
            <span>{subtext}</span>
            <span className="mx-6 opacity-30">●</span>
          </div>
        </div>
      )}
    </div>
  );
}
