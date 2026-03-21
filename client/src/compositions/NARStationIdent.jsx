import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

// Heart SVG for the "O" in "NOW" — core brand motif
const HeartO = ({ size = 100, opacity = 1, style = {} }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 100 90" style={{ display: 'inline-block', verticalAlign: 'middle', opacity, ...style }}>
    <defs>
      <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F7941D" />
        <stop offset="50%" stopColor="#EF6830" />
        <stop offset="100%" stopColor="#E2392D" />
      </linearGradient>
    </defs>
    <path d="M50,85 C25,65 0,50 0,30 C0,13 13,0 30,0 C39,0 47,5 50,12 C53,5 61,0 70,0 C87,0 100,13 100,30 C100,50 75,65 50,85Z"
      fill="url(#heartGrad)" />
  </svg>
);

export const NARStationIdent = ({
  tagline = 'Made in Ayrshire… for Ayrshire',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Phase timing
  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;
  const exitSc = interpolate(exitP, [0, 1], [1, 1.15]);

  // Aurora mesh in brand warm tones
  const aFade = interpolate(frame, [0, 0.8 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const a1 = Math.sin(frame * 0.015) * 15;
  const a2 = Math.cos(frame * 0.012) * 20;
  const a3 = Math.sin(frame * 0.018 + 1.5) * 12;

  // Particles - warm colored
  const particles = Array.from({ length: 70 }, (_, i) => {
    const seed = i * 137.508;
    const x = (seed * 7.3) % 100;
    const y = (seed * 13.1) % 100;
    const size = 1.5 + (seed % 5);
    const speed = 0.3 + (seed % 4) * 0.2;
    const delay = (seed % 40);
    const pf = Math.max(0, frame - delay);
    const pOp = interpolate(pf, [0, 15, 80, 120], [0, 0.9, 0.5, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
    const drift = Math.sin(frame * 0.015 * speed + i) * 30;
    const rise = pf * speed * 0.6;
    const glow = size * (2 + Math.sin(frame * 0.04 + i) * 1.5);
    const colors = ['#F7941D', '#EF6830', '#E2392D', '#C94070', '#8B6AAE', '#8ED8E8'];
    const color = colors[i % colors.length];
    return { x, y, size, opacity: pOp * exitOp, drift, rise, glow, color, i };
  });

  // Logo entrance - fades and scales up
  const logoSpr = spring({ frame, fps, delay: Math.round(0.3 * fps), config: { damping: 14, stiffness: 70 } });
  const logoScale = interpolate(logoSpr, [0, 1], [0.7, 1]);

  // "N" smashes from left
  const nSpr = spring({ frame, fps, delay: Math.round(0.6 * fps), config: { damping: 10, stiffness: 120, mass: 0.8 } });
  const nX = interpolate(nSpr, [0, 1], [-400, 0]);
  const nBlur = interpolate(nSpr, [0, 0.5, 1], [15, 5, 0]);

  // Heart "O" - scales up with bounce
  const heartSpr = spring({ frame, fps, delay: Math.round(0.9 * fps), config: { damping: 8, stiffness: 100, mass: 1 } });
  const heartScale = interpolate(heartSpr, [0, 1], [0, 1]);
  const heartPulse = frame > 1.5 * fps ? 1 + Math.sin(frame * 0.06) * 0.04 : 1;

  // "W" slides from right
  const wSpr = spring({ frame, fps, delay: Math.round(1.1 * fps), config: { damping: 10, stiffness: 120, mass: 0.8 } });
  const wX = interpolate(wSpr, [0, 1], [400, 0]);
  const wBlur = interpolate(wSpr, [0, 0.5, 1], [15, 5, 0]);

  // "AYRSHIRE RADIO" types letter by letter below
  const subText = 'AYRSHIRE RADIO';
  const subStart = Math.round(1.6 * fps);
  const subLetters = subText.split('').map((char, i) => {
    const ld = subStart + i * 2;
    const lo = interpolate(frame, [ld, ld + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { char, opacity: lo * exitOp, i };
  });

  // Accent line draws
  const lineSpr = spring({ frame, fps, delay: Math.round(2.4 * fps), config: { damping: 18, stiffness: 60 } });
  const lineW = interpolate(lineSpr, [0, 1], [0, 600]);

  // Tagline
  const tagDelay = 2.8 * fps;
  const tagOp = interpolate(frame, [tagDelay, tagDelay + 0.6 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const tagY = interpolate(frame, [tagDelay, tagDelay + 0.6 * fps], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });

  // Shimmer and breathe
  const breathe = frame > 1.5 * fps ? 1 + Math.sin(frame * 0.03) * 0.008 : 1;
  const shimmer = 0.7 + Math.sin(frame * 0.06) * 0.3;

  // Visualizer bars - warm gradient
  const barCount = 80;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const barIn = interpolate(frame, [15 + i * 0.4, 40 + i * 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const w1 = Math.sin(frame * 0.08 + i * 0.35) * 0.5 + 0.5;
    const w2 = Math.cos(frame * 0.05 + i * 0.25) * 0.3 + 0.5;
    const w3 = Math.sin(frame * 0.12 + i * 0.5) * 0.2 + 0.3;
    return (w1 * w2 * 90 + w3 * 30 + 5) * barIn;
  });

  // Wave decoration colors matching brand wave
  const waveColors = ['#8B6AAE', '#C94070', '#EF6830', '#F7941D', '#E2392D', '#8ED8E8'];

  // Dot grid pattern in corners
  const dotGrid = Array.from({ length: 40 }, (_, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    return { x: col * 18 + 40, y: row * 18 + 40, i };
  });

  const grainSeed = Math.floor(frame * 1.3);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Warm aurora mesh layers */}
      <div style={{ position: 'absolute', inset: 0, opacity: aFade * exitOp * 0.5,
        background: `radial-gradient(ellipse 120% 80% at ${50 + a1}% ${40 + a2}%, rgba(247,148,29,0.2) 0%, transparent 60%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: aFade * exitOp * 0.4,
        background: `radial-gradient(ellipse 100% 90% at ${30 + a2}% ${55 + a3}%, rgba(226,57,45,0.15) 0%, transparent 55%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: aFade * exitOp * 0.35,
        background: `radial-gradient(ellipse 80% 120% at ${70 + a3}% ${35 + a1}%, rgba(139,106,174,0.12) 0%, transparent 50%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: aFade * exitOp * 0.25,
        background: `radial-gradient(ellipse 60% 60% at ${55 - a1}% ${65 - a2}%, rgba(201,64,112,0.1) 0%, transparent 45%)`,
      }} />

      {/* Red dot grid - top right corner */}
      <div style={{ position: 'absolute', top: 0, right: 0, opacity: 0.15 * exitOp }}>
        {dotGrid.map(d => (
          <div key={d.i} style={{
            position: 'absolute', right: d.x, top: d.y,
            width: 4, height: 4, borderRadius: '50%',
            background: '#E2392D',
          }} />
        ))}
      </div>
      {/* Dot grid - bottom left corner */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, opacity: 0.12 * exitOp }}>
        {dotGrid.map(d => (
          <div key={d.i} style={{
            position: 'absolute', left: d.x, bottom: d.y + 120,
            width: 4, height: 4, borderRadius: '50%',
            background: '#E2392D',
          }} />
        ))}
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 65% at 50% 45%, transparent 40%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Film grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '150px 150px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.035, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Particles */}
      {particles.map(p => (
        <div key={p.i} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y - p.rise * 0.4}%`,
          transform: `translateX(${p.drift}px)`,
          width: p.size, height: p.size, borderRadius: '50%',
          background: p.color, opacity: p.opacity,
          boxShadow: `0 0 ${p.glow}px ${p.color}`,
        }} />
      ))}

      {/* Warm anamorphic streak */}
      <div style={{
        position: 'absolute', top: '38%', left: '-10%', width: '120%', height: 3,
        background: 'linear-gradient(90deg, transparent 0%, rgba(247,148,29,0.0) 20%, rgba(247,148,29,0.15) 40%, rgba(255,255,255,0.25) 50%, rgba(226,57,45,0.15) 60%, rgba(226,57,45,0.0) 80%, transparent 100%)',
        opacity: interpolate(frame, [0.8 * fps, 1.5 * fps], [0, shimmer], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exitOp,
        filter: 'blur(2px)',
      }} />

      {/* Main content */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transform: `scale(${exitSc * breathe})`, opacity: exitOp,
      }}>
        {/* Logo image */}
        <div style={{
          opacity: logoSpr, transform: `scale(${logoScale})`, marginBottom: 24,
        }}>
          <img src="/brands/nar/logo-main.png" style={{ width: 220, height: 'auto' }} />
        </div>

        {/* "N ❤ W" large wordmark */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          marginBottom: 8,
        }}>
          {/* N */}
          <span style={{
            fontSize: 140, fontWeight: 900, color: '#ffffff', lineHeight: 1,
            transform: `translateX(${nX}px)`, filter: `blur(${nBlur}px)`,
            opacity: interpolate(nSpr, [0, 0.3, 1], [0, 0.8, 1]),
            textShadow: `0 0 30px rgba(247,148,29,${shimmer * 0.4}), 0 2px 4px rgba(0,0,0,0.8)`,
          }}>N</span>

          {/* Heart O */}
          <div style={{
            transform: `scale(${heartScale * heartPulse})`,
            filter: `drop-shadow(0 0 20px rgba(247,148,29,${shimmer * 0.5}))`,
          }}>
            <HeartO size={110} />
          </div>

          {/* W */}
          <span style={{
            fontSize: 140, fontWeight: 900, color: '#ffffff', lineHeight: 1,
            transform: `translateX(${wX}px)`, filter: `blur(${wBlur}px)`,
            opacity: interpolate(wSpr, [0, 0.3, 1], [0, 0.8, 1]),
            textShadow: `0 0 30px rgba(226,57,45,${shimmer * 0.4}), 0 2px 4px rgba(0,0,0,0.8)`,
          }}>W</span>
        </div>

        {/* "AYRSHIRE RADIO" letter by letter */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 16 }}>
          {subLetters.map(l => (
            <span key={l.i} style={{
              fontSize: 36, fontWeight: 600, display: 'inline-block',
              opacity: l.opacity, letterSpacing: 8,
              color: 'rgba(255,255,255,0.8)',
              minWidth: l.char === ' ' ? 20 : undefined,
            }}>{l.char}</span>
          ))}
        </div>

        {/* Accent line - orange to red gradient */}
        <div style={{
          width: lineW, height: 3, marginTop: 8,
          background: 'linear-gradient(90deg, transparent, #F7941D 20%, #EF6830 50%, #E2392D 80%, transparent)',
          boxShadow: '0 0 12px rgba(247,148,29,0.4), 0 0 24px rgba(226,57,45,0.2)',
        }} />

        {/* Tagline */}
        <div style={{
          fontSize: 24, fontWeight: 300, letterSpacing: 6,
          textTransform: 'uppercase', marginTop: 20,
          opacity: tagOp * exitOp, transform: `translateY(${tagY}px)`,
          background: 'linear-gradient(90deg, #F7941D, #E2392D)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>{tagline}</div>
      </div>

      {/* Wave visualizer - multi-color brand wave */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2,
        opacity: exitOp * 0.7,
        maskImage: 'linear-gradient(to right, transparent 2%, black 15%, black 85%, transparent 98%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 2%, black 15%, black 85%, transparent 98%)',
      }}>
        {bars.map((h, i) => {
          const colorIdx = Math.floor((i / barCount) * waveColors.length);
          const c = waveColors[Math.min(colorIdx, waveColors.length - 1)];
          return (
            <div key={i} style={{
              width: Math.max(1, (1920 / barCount) - 3), height: h,
              background: `linear-gradient(to top, ${c}, ${waveColors[(colorIdx + 1) % waveColors.length]})`,
              borderRadius: '2px 2px 0 0', opacity: 0.8,
              boxShadow: h > 40 ? `0 -4px 8px ${c}44` : 'none',
            }} />
          );
        })}
      </div>
    </div>
  );
};
