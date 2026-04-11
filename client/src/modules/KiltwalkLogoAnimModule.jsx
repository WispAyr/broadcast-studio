import React, { useState, useEffect } from 'react';

/**
 * Kiltwalk Logo Animation — full-screen branded ident/bumper with
 * animated logo, light effects, tartan shimmer, and particle trails.
 *
 * Perfect for: transitions between layouts, pre-show idents, ad breaks.
 */

export default function KiltwalkLogoAnimModule({ config = {} }) {
  const [phase, setPhase] = useState(0);
  const variant = config.variant || 'shimmer'; // shimmer | pulse | reveal | tartan
  const tagline = config.tagline || 'Glasgow Kiltwalk 2026';
  const subtext = config.subtext || 'Every step changes lives';
  const bg = config.background || 'linear-gradient(135deg, #0a0e1a 0%, #1a1a2e 50%, #0f3460 100%)';

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: bg }}>
      <style>{`
        @keyframes logoReveal {
          0% { transform: scale(0.6) translateY(20px); opacity: 0; filter: blur(10px); }
          40% { transform: scale(1.08) translateY(-5px); opacity: 1; filter: blur(0); }
          60% { transform: scale(0.98) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes logoGlow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(248,175,53,0.3)) drop-shadow(0 0 60px rgba(248,175,53,0.1)); }
          50% { filter: drop-shadow(0 0 40px rgba(248,175,53,0.5)) drop-shadow(0 0 100px rgba(248,175,53,0.2)); }
        }
        @keyframes logoShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes logoParticle {
          0% { transform: translate(0, 0) scale(1); opacity: 0.8; }
          50% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        @keyframes tartanWeave {
          0% { transform: rotate(0deg) scale(1); opacity: 0.03; }
          50% { opacity: 0.06; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.03; }
        }
        @keyframes lightSweep {
          0% { transform: translateX(-100%) rotate(20deg); }
          100% { transform: translateX(200%) rotate(20deg); }
        }
        @keyframes taglineFade {
          0% { opacity: 0; transform: translateY(15px); letter-spacing: 0.8em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.4em; }
        }
        @keyframes subtextFade {
          0% { opacity: 0; }
          100% { opacity: 0.6; }
        }
        @keyframes outerRing {
          0% { transform: scale(0.8) rotate(0deg); opacity: 0; }
          30% { opacity: 0.15; }
          100% { transform: scale(2.5) rotate(180deg); opacity: 0; }
        }
        @keyframes accentLine {
          0% { width: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { width: 200px; opacity: 0.4; }
        }
        @keyframes colourBars {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>

      {/* Animated tartan background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(230,59,43,0.04) 0px, transparent 2px, transparent 35px),
          repeating-linear-gradient(90deg, rgba(0,139,199,0.04) 0px, transparent 2px, transparent 35px),
          repeating-linear-gradient(45deg, rgba(248,175,53,0.02) 0px, transparent 1px, transparent 50px)
        `,
        animation: 'tartanWeave 60s linear infinite',
      }} />

      {/* Radial glow behind logo */}
      <div className="absolute rounded-full" style={{
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(248,175,53,0.08) 0%, rgba(0,139,199,0.04) 40%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -55%)',
      }} />

      {/* Expanding ring effect */}
      {phase >= 1 && (
        <>
          <div className="absolute rounded-full border" style={{
            width: '200px', height: '200px',
            borderColor: 'rgba(248,175,53,0.2)',
            top: '50%', left: '50%', transform: 'translate(-50%, -60%)',
            animation: 'outerRing 3s ease-out forwards',
          }} />
          <div className="absolute rounded-full border" style={{
            width: '200px', height: '200px',
            borderColor: 'rgba(128,206,244,0.15)',
            top: '50%', left: '50%', transform: 'translate(-50%, -60%)',
            animation: 'outerRing 3s ease-out 0.3s forwards',
          }} />
        </>
      )}

      {/* Floating particles */}
      {phase >= 1 && Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const dist = 150 + Math.random() * 200;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const colors = ['#e63b2b', '#008bc7', '#f8af35', '#006a47', '#80cef4', '#fff'];
        return (
          <div key={i} className="absolute rounded-full" style={{
            width: `${3 + Math.random() * 5}px`,
            height: `${3 + Math.random() * 5}px`,
            background: colors[i % colors.length],
            top: '45%', left: '50%',
            '--dx': `${dx}px`, '--dy': `${dy}px`,
            animation: `logoParticle ${1.5 + Math.random() * 2}s ease-out ${0.2 + Math.random() * 0.8}s forwards`,
          }} />
        );
      })}

      {/* Logo */}
      <div className="relative z-10" style={{
        animation: phase >= 1 ? 'logoReveal 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
        opacity: phase >= 1 ? undefined : 0,
      }}>
        <img src="/assets/kiltwalk/logo.svg" alt="Kiltwalk"
          className="h-28 md:h-36 lg:h-44"
          style={{
            animation: phase >= 2 ? 'logoGlow 3s ease-in-out infinite' : 'none',
          }}
        />
        {/* Light sweep across logo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 h-full w-1/3" style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            animation: phase >= 2 ? 'lightSweep 4s ease-in-out 0.5s infinite' : 'none',
          }} />
        </div>
      </div>

      {/* Accent lines */}
      {phase >= 2 && (
        <div className="relative z-10 flex items-center gap-4 mt-6">
          <div style={{
            height: '1px', background: 'linear-gradient(90deg, transparent, #f8af35)',
            animation: 'accentLine 1s ease-out forwards',
          }} />
          <div className="w-2 h-2 rounded-full bg-amber-400/50" />
          <div style={{
            height: '1px', background: 'linear-gradient(270deg, transparent, #f8af35)',
            animation: 'accentLine 1s ease-out forwards',
          }} />
        </div>
      )}

      {/* Tagline */}
      {phase >= 2 && (
        <div className="relative z-10 mt-6 text-center">
          <div className="text-lg md:text-xl uppercase font-black tracking-[0.4em] text-white"
            style={{ animation: 'taglineFade 1.2s ease-out forwards' }}>
            {tagline}
          </div>
        </div>
      )}

      {/* Subtext */}
      {phase >= 3 && (
        <div className="relative z-10 mt-3 text-center">
          <div className="text-sm md:text-base italic text-white/60"
            style={{ animation: 'subtextFade 1.5s ease-out forwards' }}>
            {subtext}
          </div>
        </div>
      )}

      {/* Bottom route colour bars */}
      <div className="absolute bottom-0 left-0 right-0 h-2 flex overflow-hidden">
        {['#e63b2b', '#008bc7', '#006a47'].map((c, i) => (
          <div key={c} className="flex-1" style={{
            background: c,
            transformOrigin: 'left',
            animation: phase >= 2 ? `colourBars 0.8s ease-out ${0.3 + i * 0.15}s both` : 'none',
          }} />
        ))}
      </div>

      {/* Top subtle vignette */}
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)' }} />
    </div>
  );
}
