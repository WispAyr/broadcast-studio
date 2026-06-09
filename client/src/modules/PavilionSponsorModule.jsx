import React, { useEffect, useRef, useState } from 'react';

/**
 * Pavilion Festival — sponsor slot. Cinematic redesign.
 * Hero sponsor card with crossfade transition, accent rays, drop-shadow logos,
 * and progress dots. Designed as a placeholder until real assets land — drop
 * image URLs into config.sponsors and it picks up automatically.
 *
 * config:
 *   sponsors        — [{ name, logoUrl, message?, bgColor?, accentColor?, durationMs? }]
 *   defaultDuration — ms per sponsor when entry has no durationMs (default 8000)
 *   header          — string above the sponsor block (default "Brought to you by")
 *   accentColor
 */
export default function PavilionSponsorModule({ config = {} }) {
  const sponsors = Array.isArray(config.sponsors) && config.sponsors.length > 0
    ? config.sponsors
    : DEFAULT_PLACEHOLDER;
  const [idx, setIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [orientation, setOrientation] = useState('landscape');
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width, h = e.contentRect.height;
      setOrientation(h > w * 1.1 ? 'portrait' : 'landscape');
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const dur = sponsors[idx]?.durationMs || config.defaultDuration || 8000;
    const t = setTimeout(() => {
      setTransitioning(true);
      setTimeout(() => {
        setIdx((idx + 1) % sponsors.length);
        setTransitioning(false);
      }, 450);
    }, dur);
    return () => clearTimeout(t);
  }, [idx, sponsors, config.defaultDuration]);

  const sponsor = sponsors[idx] || sponsors[0];
  const bg = sponsor.bgColor || 'linear-gradient(165deg, #050510 0%, #0e0a1a 50%, #1a0d24 100%)';
  const accent = sponsor.accentColor || config.accentColor || '#ffb020';
  const header = config.header || 'Brought to you by';
  const isPortrait = orientation === 'portrait';

  return (
    <div ref={ref} className={`w-full h-full flex flex-col relative overflow-hidden transition-opacity duration-500 ${transitioning ? 'opacity-0' : 'opacity-100'}`} style={{
      background: bg, color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    }}>
      <KeyFrames />

      {/* Backdrop accents */}
      <div className="absolute pointer-events-none" style={{
        top: '-20%', left: '-15%', width: '80%', height: '80%',
        background: `radial-gradient(ellipse, ${accent}22 0%, transparent 60%)`,
        filter: 'blur(80px)',
      }} />
      <div className="absolute pointer-events-none" style={{
        bottom: '-25%', right: '-15%', width: '70%', height: '70%',
        background: `radial-gradient(ellipse, ${accent}1a 0%, transparent 60%)`,
        filter: 'blur(80px)',
      }} />
      {/* Light rays */}
      <div className="absolute pointer-events-none" style={{
        top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', height: '70%',
        background: `conic-gradient(from 200deg at 50% 100%, transparent 0deg, ${accent}11 30deg, transparent 60deg, ${accent}08 80deg, transparent 100deg, ${accent}11 130deg, transparent 160deg)`,
        opacity: 0.7,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
        backgroundSize: '40px 40px', opacity: 0.4,
      }} />

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center" style={{
        padding: isPortrait ? '5vh 5vw' : '5vh 8vw',
        animation: !transitioning ? 'pavSponsorIn 0.6s ease-out' : undefined,
      }}>
        {/* Header pill */}
        <div style={{
          fontSize: isPortrait ? '2vh' : '1.8vh',
          letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 800,
          color: accent,
          padding: '0.8vh 2vh', borderRadius: '99px',
          background: `${accent}15`, border: `1px solid ${accent}44`,
          marginBottom: isPortrait ? '5vh' : '4vh',
        }}>
          ✦ {header} ✦
        </div>

        {/* Logo or text */}
        {sponsor.logoUrl ? (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            style={{
              maxWidth: isPortrait ? '75vw' : '55vw',
              maxHeight: isPortrait ? '40vh' : '50vh',
              objectFit: 'contain',
              filter: `drop-shadow(0 8px 30px rgba(0,0,0,0.5)) drop-shadow(0 0 60px ${accent}33)`,
            }}
          />
        ) : (
          <div style={{
            fontSize: isPortrait ? '9vh' : '12vh',
            fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1,
            background: `linear-gradient(180deg, #fff 0%, ${accent} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            textShadow: `0 0 80px ${accent}55`, textAlign: 'center',
          }}>
            {sponsor.name}
          </div>
        )}

        {sponsor.tier && (
          <div style={{
            marginTop: '2vh',
            fontSize: '1.5vh', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
            padding: '0.6vh 1.4vh', borderRadius: '0.4vh',
            color: accent, border: `1px solid ${accent}66`, background: `${accent}15`,
          }}>{sponsor.tier}</div>
        )}

        {sponsor.message && (
          <div style={{
            marginTop: isPortrait ? '4vh' : '3vh',
            fontSize: isPortrait ? '2.7vh' : '2.5vh',
            fontWeight: 500, color: 'rgba(255,255,255,0.85)',
            maxWidth: '85%', lineHeight: 1.4, textAlign: 'center',
            letterSpacing: '0.01em',
          }}>{sponsor.message}</div>
        )}
      </div>

      {/* Progress dots */}
      {sponsors.length > 1 && (
        <div className="absolute z-10 flex" style={{
          left: '50%', bottom: '4vh', transform: 'translateX(-50%)', gap: '0.8vh',
        }}>
          {sponsors.map((_, i) => (
            <div key={i} style={{
              width: i === idx ? '3vh' : '0.8vh', height: '0.8vh', borderRadius: '99px',
              background: i === idx ? accent : 'rgba(255,255,255,0.25)',
              boxShadow: i === idx ? `0 0 12px ${accent}88` : 'none',
              transition: 'all 0.4s ease',
            }} />
          ))}
        </div>
      )}

      {/* Festival mark */}
      <div className="absolute z-10" style={{
        bottom: '1.6vh', left: '50%', transform: 'translateX(-50%)',
        fontSize: '1.2vh', color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 700,
      }}>Pavilion Festival 2026</div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10" style={{
        height: '0.4vh',
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        boxShadow: `0 -2px 20px ${accent}66`,
      }} />
    </div>
  );
}

function KeyFrames() {
  return (
    <style>{`
      @keyframes pavSponsorIn {
        from { opacity: 0; transform: scale(0.97); }
        to { opacity: 1; transform: scale(1); }
      }
    `}</style>
  );
}

const DEFAULT_PLACEHOLDER = [
  {
    name: 'Sponsor slot',
    message: 'Sponsor content lands here — drop a logo and a one-line message into the module config.',
    bgColor: 'linear-gradient(165deg, #050510 0%, #1a0a14 50%, #2a0d1d 100%)',
    accentColor: '#ffb020',
    durationMs: 7000,
  },
];
