import React, { useState, useEffect } from 'react';

export default function KiltwalkSponsorModule({ config = {} }) {
  const sponsors = config.sponsors || [];
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const showTierLabel = config.showTierLabel !== false;
  const bg = config.background || '#1a1a2e';

  const tierColors = {
    headline: '#f8af35',
    gold: '#f8af35',
    partner: '#80cef4',
    event: '#008bc7',
  };

  const tierLabels = {
    headline: 'HEADLINE SPONSOR',
    gold: 'GOLD SPONSOR',
    partner: 'OFFICIAL PARTNER',
    event: 'EVENT SPONSOR',
  };

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const current = sponsors[index] || {};
    const dur = (current.duration || 6) * 1000;
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % sponsors.length);
        setFading(false);
      }, 400);
    }, dur);
    return () => clearTimeout(timer);
  }, [index, sponsors]);

  if (!sponsors.length) {
    return <div className="w-full h-full flex items-center justify-center" style={{ background: bg }}>
      <span className="text-gray-500">No sponsors configured</span>
    </div>;
  }

  const sponsor = sponsors[index] || {};
  const tierColor = tierColors[sponsor.tier] || '#80cef4';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: bg }}>
      <style>{`
        @keyframes sponsorFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sponsorShine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .sponsor-card {
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .sponsor-card.fading {
          opacity: 0;
          transform: scale(0.95);
        }
      `}</style>

      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, ${tierColor} 0%, transparent 50%),
                          radial-gradient(circle at 80% 50%, ${tierColor} 0%, transparent 50%)`,
      }} />

      {/* Tier label */}
      {showTierLabel && (
        <div className="absolute top-4 left-0 right-0 text-center">
          <span className="uppercase tracking-[0.4em] text-sm font-black px-6 py-2 rounded-full"
            style={{ color: tierColor, background: `${tierColor}15`, border: `1px solid ${tierColor}22` }}>
            {tierLabels[sponsor.tier] || sponsor.tier}
          </span>
        </div>
      )}

      {/* Sponsor logo */}
      <div className={`sponsor-card flex flex-col items-center gap-4 ${fading ? 'fading' : ''}`}
        style={{ animation: !fading ? 'sponsorFadeIn 0.4s ease-out' : undefined }}>
        {sponsor.logo ? (
          <div className="relative">
            {/* Glow behind logo */}
            <div className="absolute inset-0 rounded-3xl" style={{
              background: `radial-gradient(circle, ${tierColor}15 0%, transparent 70%)`,
              filter: 'blur(40px)',
              transform: 'scale(1.5)',
            }} />
            <img src={sponsor.logo} alt={sponsor.name}
              className="max-h-48 max-w-[70%] mx-auto object-contain"
              style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {/* Shine effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 h-full w-1/3 -skew-x-12"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                  animation: 'sponsorShine 4s ease-in-out infinite',
                }} />
            </div>
          </div>
        ) : (
          <span className="text-3xl font-bold" style={{ color: tierColor }}>{sponsor.name}</span>
        )}

        {/* Sponsor name */}
        <span className="text-2xl font-black opacity-90" style={{ color: '#ffffff' }}>
          {sponsor.name}
        </span>

        {/* Role if provided */}
        {sponsor.role && (
          <span className="text-sm uppercase tracking-[0.3em] opacity-50 font-bold" style={{ color: '#ffffff' }}>
            {sponsor.role}
          </span>
        )}
      </div>

      {/* Progress dots */}
      {sponsors.length > 1 && (
        <div className="absolute bottom-4 flex gap-2">
          {sponsors.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              width: i === index ? '20px' : '6px',
              height: '6px',
              background: i === index ? tierColor : 'rgba(255,255,255,0.2)',
            }} />
          ))}
        </div>
      )}

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{
        background: `linear-gradient(90deg, transparent, ${tierColor}66, transparent)`,
      }} />
    </div>
  );
}
