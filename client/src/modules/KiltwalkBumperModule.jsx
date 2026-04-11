import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Kiltwalk Bumper Adverts — rotating promo cards with QR codes,
 * sponsor highlights, calls-to-action, and stat celebrations.
 *
 * Bumper types:
 *   qr_signup    — QR code to sign up for next year
 *   qr_donate    — QR code to donate / sponsor a walker
 *   sponsor_hero — full-screen sponsor spotlight with logo + message
 *   stat_card    — celebration stat (£40M raised, 1800 charities, etc)
 *   promo        — generic promo card with image + text
 *   social       — social media CTA (#Kiltwalk, @kiltwalk)
 */

const DEFAULT_BUMPERS = [
  {
    type: 'qr_signup',
    title: 'WALK WITH US NEXT YEAR',
    subtitle: 'Edinburgh Kiltwalk — September 2026',
    qrUrl: 'https://www.thekiltwalk.co.uk/events/edinburgh',
    cta: 'Scan to register',
    duration: 8,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    accentColor: '#f8af35',
  },
  {
    type: 'sponsor_hero',
    title: 'HEADLINE SPONSOR',
    sponsorName: 'Arnold Clark',
    sponsorLogo: '/assets/kiltwalk/arnold-clark.png',
    message: 'Proud to support Scotland\'s biggest charity walk',
    duration: 8,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 100%)',
    accentColor: '#f8af35',
  },
  {
    type: 'stat_card',
    stat: '£40M+',
    label: 'raised for Scottish charities since 2016',
    icon: '💜',
    duration: 6,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #3f1a3e 100%)',
    accentColor: '#e63b2b',
  },
  {
    type: 'qr_donate',
    title: 'SPONSOR A WALKER',
    subtitle: 'Every penny goes to their chosen charity',
    qrUrl: 'https://www.justgiving.com/campaign/kiltwalk',
    cta: 'Scan to donate',
    duration: 8,
    bg: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)',
    accentColor: '#008bc7',
  },
  {
    type: 'stat_card',
    stat: '1,800',
    label: 'Scottish charities supported in 2025',
    icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    duration: 6,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #0a3d2e 100%)',
    accentColor: '#006a47',
  },
  {
    type: 'social',
    title: 'SHARE YOUR JOURNEY',
    handles: ['@kiltwalk', '#Kiltwalk2026', '#Glasgow'],
    icon: '📸',
    duration: 6,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 100%)',
    accentColor: '#80cef4',
  },
  {
    type: 'sponsor_hero',
    title: 'GOLD SPONSOR',
    sponsorName: 'Johnston Carmichael',
    sponsorLogo: '/assets/kiltwalk/jcca.svg',
    message: 'Counting down the miles with you',
    duration: 8,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #2d3a1f 100%)',
    accentColor: '#f8af35',
  },
  {
    type: 'stat_card',
    stat: '125%',
    label: 'of your fundraising goes to charity with Gift Aid',
    icon: '🎁',
    duration: 6,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #3d2d1f 100%)',
    accentColor: '#f8af35',
  },
];

export default function KiltwalkBumperModule({ config = {} }) {
  const bumpers = config.bumpers || DEFAULT_BUMPERS;
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (bumpers.length <= 1) return;
    const current = bumpers[index];
    const dur = (current?.duration || 8) * 1000;
    const timer = setTimeout(() => {
      setTransitioning(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % bumpers.length);
        setTransitioning(false);
      }, 500);
    }, dur);
    return () => clearTimeout(timer);
  }, [index, bumpers]);

  const bumper = bumpers[index] || {};
  const bg = bumper.bg || 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)';
  const accent = bumper.accentColor || '#f8af35';

  const renderBumper = () => {
    switch (bumper.type) {
      case 'qr_signup':
      case 'qr_donate':
        return (
          <div className="flex items-center justify-center gap-12 flex-1">
            <div className="flex flex-col items-start">
              <span className="text-4xl font-black text-white mb-3">{bumper.title}</span>
              <span className="text-xl text-white/60 mb-6">{bumper.subtitle}</span>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
                background: `${accent}20`, border: `2px solid ${accent}44`,
              }}>
                <span className="text-lg">📱</span>
                <span className="text-lg font-bold" style={{ color: accent }}>{bumper.cta}</span>
              </div>
            </div>
            <div className="relative">
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <QRCodeSVG value={bumper.qrUrl || 'https://thekiltwalk.co.uk'} size={200} bgColor="#ffffff" fgColor="#1a1a2e" level="M" includeMargin={true} style={{ borderRadius: "12px" }} />
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: accent, color: '#1a1a2e' }}>
                {bumper.type === 'qr_signup' ? 'SIGN UP' : 'DONATE'}
              </div>
            </div>
          </div>
        );

      case 'sponsor_hero':
        return (
          <div className="flex flex-col items-center justify-center flex-1 gap-6">
            <span className="text-sm uppercase tracking-[0.4em] font-bold px-4 py-1 rounded-full"
              style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}22` }}>
              {bumper.title}
            </span>
            {bumper.sponsorLogo && (
              <img src={bumper.sponsorLogo} alt={bumper.sponsorName}
                className="max-h-28 max-w-[60%] object-contain"
                style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))' }} />
            )}
            <span className="text-3xl font-black text-white">{bumper.sponsorName}</span>
            <span className="text-lg text-white/50">{bumper.message}</span>
          </div>
        );

      case 'stat_card':
        return (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <span className="text-6xl">{bumper.icon}</span>
            <span className="text-7xl font-black" style={{ color: accent,
              textShadow: `0 0 40px ${accent}44, 0 0 80px ${accent}22` }}>
              {bumper.stat}
            </span>
            <span className="text-xl text-white/70 text-center max-w-md">{bumper.label}</span>
          </div>
        );

      case 'social':
        return (
          <div className="flex flex-col items-center justify-center flex-1 gap-6">
            <span className="text-6xl">{bumper.icon}</span>
            <span className="text-4xl font-black text-white">{bumper.title}</span>
            <div className="flex gap-4">
              {(bumper.handles || []).map(h => (
                <span key={h} className="text-2xl font-bold px-4 py-2 rounded-xl"
                  style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}22` }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <span className="text-3xl font-black text-white">{bumper.title || 'KILTWALK'}</span>
            <span className="text-lg text-white/50">{bumper.subtitle || ''}</span>
          </div>
        );
    }
  };

  return (
    <div className={`w-full h-full flex flex-col relative overflow-hidden transition-opacity duration-500 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: bg }}>
      <style>{`
        @keyframes bumperShine {
          0% { left: -50%; }
          100% { left: 150%; }
        }
        @keyframes bumperFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Tartan overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `repeating-linear-gradient(0deg, ${accent} 0px, transparent 1px, transparent 50px, ${accent} 51px),
                          repeating-linear-gradient(90deg, ${accent} 0px, transparent 1px, transparent 50px, ${accent} 51px)`,
      }} />

      {/* Corner glow */}
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full" style={{
        background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`,
      }} />

      {/* Logo */}
      <div className="absolute top-4 left-4 z-10">
        <img src="/assets/kiltwalk/logo.svg" alt="" className="h-8 opacity-70" />
      </div>

      {/* Content */}
      <div className="flex-1 flex p-8" style={{ animation: !transitioning ? 'bumperFadeIn 0.5s ease-out' : undefined }}>
        {renderBumper()}
      </div>

      {/* Progress dots */}
      {bumpers.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {bumpers.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              width: i === index ? '24px' : '6px', height: '6px',
              background: i === index ? accent : 'rgba(255,255,255,0.15)',
            }} />
          ))}
        </div>
      )}

      {/* Route accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex">
        <div className="flex-1" style={{ background: '#e63b2b' }} />
        <div className="flex-1" style={{ background: '#008bc7' }} />
        <div className="flex-1" style={{ background: '#006a47' }} />
      </div>
    </div>
  );
}
