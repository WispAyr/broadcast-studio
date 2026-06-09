import React from 'react';

// Scotland branding hero — animated saltire + drifting tartan + Tartan Army energy.
// High-impact, all CSS (runs live on the wall, no video render). Use as a full
// scene or behind other graphics. config: { title, subtitle, kicker, mode }.
//   mode: 'saltire' (default, big flag + text) | 'tartan' (tartan band bg only)

const HEAD = "'Anton','Oswald','Rajdhani',sans-serif";
const SALTIRE = '#0065bf';
const SALTIRE_DEEP = '#003d77';

// A tartan weave built from layered repeating gradients (navy/blue/white threads).
const tartan = {
  backgroundColor: '#0a2a66',
  backgroundImage: [
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 6px, transparent 6px 52px)',
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 26px, transparent 26px 52px)',
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 6px, transparent 6px 52px)',
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 26px, transparent 26px 52px)',
    'repeating-linear-gradient(90deg, rgba(120,170,255,0.18) 0 3px, transparent 3px 104px)',
  ].join(','),
};

export default function ScotlandHero({ config = {} }) {
  const title = config.title || 'SCOTLAND';
  const subtitle = config.subtitle ?? 'THE TARTAN ARMY';
  const kicker = config.kicker ?? 'WORLD CUP 26';
  const mode = config.mode || 'saltire';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: SALTIRE_DEEP, fontFamily: HEAD }}>
      <style>{`
        @keyframes saltireWave { 0%,100% { transform: translateY(-2%) skewY(-0.6deg); } 50% { transform: translateY(2%) skewY(0.6deg); } }
        @keyframes tartanDrift { from { background-position: 0 0,0 0,0 0,0 0,0 0; } to { background-position: 104px 104px, 104px 104px, 104px 104px, 104px 104px, 208px 0; } }
        @keyframes sweep { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(220%) skewX(-20deg); } }
        @keyframes heroIn { from { opacity: 0; transform: translateY(40px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes flagPulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.12); } }
      `}</style>

      {/* drifting tartan base */}
      <div style={{ position: 'absolute', inset: '-10%', ...tartan, animation: 'tartanDrift 18s linear infinite', opacity: mode === 'tartan' ? 0.9 : 0.5 }} />

      {/* waving saltire */}
      {mode !== 'tartan' && (
        <div style={{ position: 'absolute', inset: '-8%', animation: 'saltireWave 7s ease-in-out infinite, flagPulse 5s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(130% 130% at 50% 40%, ${SALTIRE} 0%, ${SALTIRE_DEEP} 90%)`, opacity: 0.6 }} />
          {/* the white diagonal cross */}
          <div style={{ position: 'absolute', top: '50%', left: '-15%', width: '130%', height: '13%', background: '#fff', transform: 'translateY(-50%) rotate(26deg)', boxShadow: '0 0 60px rgba(255,255,255,0.5)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '-15%', width: '130%', height: '13%', background: '#fff', transform: 'translateY(-50%) rotate(-26deg)', boxShadow: '0 0 60px rgba(255,255,255,0.5)' }} />
        </div>
      )}

      {/* light sweep */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', animation: 'sweep 6s ease-in-out infinite' }} />

      {/* vignette */}
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 300px 80px rgba(0,0,20,0.6)' }} />

      {/* text */}
      {(title || subtitle) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', animation: 'heroIn 0.8s cubic-bezier(.2,.8,.2,1) both' }}>
          {kicker ? <div style={{ color: '#cfe4ff', fontSize: '3vh', letterSpacing: '0.4em', fontFamily: "'Oswald',sans-serif", fontWeight: 600, textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>{kicker}</div> : null}
          <div style={{ color: '#fff', fontSize: '20vh', lineHeight: 0.9, letterSpacing: '0.02em', textShadow: '0 8px 40px rgba(0,0,0,.6), 0 0 60px rgba(0,101,191,.6)' }}>{title}</div>
          {subtitle ? <div style={{ color: '#fff', fontSize: '4.5vh', letterSpacing: '0.3em', marginTop: '1vh', fontFamily: "'Oswald',sans-serif", fontWeight: 600, opacity: 0.92, textShadow: '0 2px 12px rgba(0,0,0,.7)' }}>{subtitle}</div> : null}
        </div>
      )}
    </div>
  );
}
