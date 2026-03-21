import React from 'react';

export default function TextModule({ config = {} }) {
  const text = config.text || config.content || '';
  const subtitle = config.subtitle || '';
  const align = config.align || 'center';
  const style = config.style || 'default'; // 'default', 'lower-third', 'name-title', 'headline'
  const bg = config.background;
  const color = config.color || '#ffffff';
  const accentColor = config.accentColor || '#3b82f6';

  // Lower-third broadcast style
  if (style === 'lower-third' || style === 'name-title') {
    return (
      <div className="w-full h-full flex flex-col justify-end relative overflow-hidden"
        style={{ background: bg || 'transparent' }}>
        <style>{`
          @keyframes lowerThirdSlide {
            from { transform: translateX(-100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes lowerThirdAccent {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
        `}</style>

        <div className="relative" style={{ animation: 'lowerThirdSlide 0.5s ease-out forwards' }}>
          {/* Accent bar */}
          <div className="h-0.5" style={{ background: accentColor, transformOrigin: 'left', animation: 'lowerThirdAccent 0.3s ease-out 0.2s forwards', transform: 'scaleX(0)' }} />

          {/* Main bar */}
          <div className="flex items-stretch">
            {/* Accent block */}
            <div className="px-4 py-2.5 flex items-center" style={{ background: accentColor }}>
              <span className="text-white font-black text-base uppercase tracking-wider" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                {text}
              </span>
            </div>

            {/* Subtitle block */}
            {subtitle && (
              <div className="px-4 py-2.5 flex items-center"
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <span className="text-white text-sm font-medium opacity-90">{subtitle}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Headline style
  if (style === 'headline') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden"
        style={{ background: bg || 'linear-gradient(145deg, #0a0e1a, #111827)', color }}>
        <style>{`
          @keyframes headlineFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.05), transparent 70%)' }} />
        <div className="relative z-10 text-center" style={{ animation: 'headlineFade 0.6s ease-out' }}>
          <span className="font-black leading-tight block" style={{
            fontSize: config.fontSize || '2.5rem', letterSpacing: '-0.02em',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)', textAlign: align
          }}>
            {text}
          </span>
          {subtitle && (
            <span className="block mt-3 text-base font-medium opacity-50 uppercase tracking-[0.2em]">{subtitle}</span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}44, transparent)` }} />
      </div>
    );
  }

  // Default - upgraded
  return (
    <div className="w-full h-full flex items-center justify-center p-4"
      style={{ background: bg || 'transparent', color, textAlign: align }}>
      <div>
        <span style={{
          fontSize: config.fontSize || '1.5rem',
          fontWeight: config.fontWeight || 'normal',
          fontFamily: config.fontFamily || 'inherit',
          lineHeight: 1.4
        }}>
          {text}
        </span>
        {subtitle && (
          <p className="mt-1 opacity-50 text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
