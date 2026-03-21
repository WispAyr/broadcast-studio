import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const NARNowPlaying = ({
  artistName = 'Arctic Monkeys',
  trackTitle = 'Do I Wanna Know?',
  albumColor = '#F7941D',
  progress = 65,
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Vinyl record
  const vinylSpr = spring({ frame, fps, config: { damping: 15, stiffness: 60 } });
  const vinylRotation = frame * 2;
  const vinylScale = interpolate(vinylSpr, [0, 1], [0.6, 1]);

  const grooveCount = 20;
  const grooves = Array.from({ length: grooveCount }, (_, i) => ({
    r: 60 + i * 7,
    opacity: 0.1 + Math.sin(frame * 0.03 + i * 0.5) * 0.05,
  }));

  // Info card
  const cardSpr = spring({ frame, fps, delay: Math.round(0.5 * fps), config: { damping: 14, stiffness: 80 } });
  const cardX = interpolate(cardSpr, [0, 1], [300, 0]);

  // Track title letter-spacing
  const trackSpr = spring({ frame, fps, delay: Math.round(0.7 * fps), config: { damping: 12, stiffness: 90 } });
  const trackSpacing = interpolate(trackSpr, [0, 1], [12, 1]);

  // Artist
  const artistDelay = 0.9 * fps;
  const artistOp = interpolate(frame, [artistDelay, artistDelay + 0.4 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const artistSpacing = interpolate(frame, [artistDelay, artistDelay + 0.5 * fps], [20, 4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });

  // EQ bars
  const eqBars = Array.from({ length: 24 }, (_, i) => {
    const h1 = Math.sin(frame * 0.1 + i * 0.6) * 0.5 + 0.5;
    const h2 = Math.cos(frame * 0.07 + i * 0.4) * 0.3 + 0.5;
    return h1 * h2 * 40 + 5;
  });

  // Progress
  const progressSpr = spring({ frame, fps, delay: Math.round(1.2 * fps), config: { damping: 200, stiffness: 40 } });
  const progressW = progress * progressSpr;

  const ambientPulse = 0.3 + Math.sin(frame * 0.04) * 0.1;
  const breathe = 1 + Math.sin(frame * 0.025) * 0.008;
  const grainSeed = Math.floor(frame * 1.5);

  // Dot grid
  const dots = Array.from({ length: 25 }, (_, i) => ({
    x: (i % 5) * 20, y: Math.floor(i / 5) * 20, i,
  }));

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Ambient album glow */}
      <div style={{
        position: 'absolute', top: '40%', left: '30%', transform: 'translate(-50%, -50%)',
        width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${albumColor}33 0%, transparent 60%)`,
        opacity: ambientPulse * exitOp, filter: 'blur(60px)',
      }} />

      {/* Secondary warm glow */}
      <div style={{
        position: 'absolute', top: '60%', left: '65%', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(226,57,45,0.08) 0%, transparent 55%)',
        opacity: exitOp,
      }} />

      {/* Dot grid corner */}
      <div style={{ position: 'absolute', bottom: 30, right: 30, opacity: 0.1 * exitOp }}>
        {dots.map(d => (
          <div key={d.i} style={{ position: 'absolute', right: d.x, bottom: d.y, width: 3, height: 3, borderRadius: '50%', background: '#E2392D' }} />
        ))}
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Vinyl record */}
      <div style={{
        position: 'absolute', top: '50%', left: '28%',
        transform: `translate(-50%, -50%) scale(${vinylScale * breathe})`,
        opacity: vinylSpr * exitOp,
      }}>
        {/* Shadow */}
        <div style={{
          position: 'absolute', top: 20, left: 10, width: 340, height: 340, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)', filter: 'blur(30px)',
        }} />

        {/* Disc */}
        <div style={{
          width: 340, height: 340, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0a0a0a 30%, #1a1a1a 32%, #0a0a0a 100%)',
          transform: `rotate(${vinylRotation}deg)`,
          boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.4)',
          position: 'relative',
        }}>
          {grooves.map((g, i) => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: g.r * 2, height: g.r * 2, borderRadius: '50%',
              border: `1px solid rgba(255,255,255,${g.opacity})`,
            }} />
          ))}

          {/* Center label */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 90, height: 90, borderRadius: '50%',
            background: `radial-gradient(circle, ${albumColor} 0%, ${albumColor}88 70%, #111 100%)`,
            boxShadow: `0 0 20px ${albumColor}44`,
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 8, height: 8, borderRadius: '50%', background: '#fff',
              boxShadow: '0 0 4px rgba(255,255,255,0.5)',
            }} />
          </div>
        </div>

        {/* Reflection arc */}
        <div style={{
          position: 'absolute', top: 20, left: 40, width: 260, height: 140, borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
          transform: 'rotate(-20deg)', pointerEvents: 'none',
        }} />
      </div>

      {/* Info card */}
      <div style={{
        position: 'absolute', top: '50%', right: '8%',
        transform: `translate(${cardX}px, -50%) scale(${breathe})`,
        opacity: cardSpr * exitOp,
        width: 580, padding: '40px 50px',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
      }}>
        {/* NOW PLAYING label */}
        <div style={{
          fontSize: 13, fontWeight: 700, letterSpacing: 5, marginBottom: 16, opacity: 0.9,
          background: 'linear-gradient(90deg, #F7941D, #E2392D)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>NOW PLAYING</div>

        {/* Track title */}
        <div style={{
          fontSize: 44, fontWeight: 800, color: '#ffffff', lineHeight: 1.1,
          letterSpacing: trackSpacing, marginBottom: 12,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>{trackTitle}</div>

        {/* Artist */}
        <div style={{
          fontSize: 24, fontWeight: 400, color: 'rgba(255,255,255,0.65)',
          letterSpacing: artistSpacing, opacity: artistOp * exitOp, marginBottom: 28,
        }}>{artistName}</div>

        {/* EQ bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 45, marginBottom: 20 }}>
          {eqBars.map((h, i) => (
            <div key={i} style={{
              width: 4, height: h, borderRadius: 2,
              background: `linear-gradient(to top, #E2392D, #F7941D)`,
              opacity: 0.8,
            }} />
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
          <div style={{
            width: `${progressW}%`, height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #F7941D, #E2392D)',
            boxShadow: '0 0 12px rgba(247,148,29,0.4)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', right: -4, top: -4, width: 12, height: 12, borderRadius: '50%',
              background: '#fff', boxShadow: '0 0 8px #F7941D, 0 0 16px rgba(247,148,29,0.5)',
            }} />
          </div>
        </div>
      </div>

      {/* Logo bottom-left */}
      <div style={{ position: 'absolute', bottom: 30, left: 40, opacity: 0.4 * exitOp }}>
        <img src="/brands/nar/logo-main.png" style={{ width: 80, height: 'auto' }} />
      </div>
    </div>
  );
};
