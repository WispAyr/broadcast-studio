import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const NARShowBanner = ({
  showName = 'Ali & Michael in the Morning',
  presenterName = 'Ali & Michael',
  showTime = '6AM - 10AM',
  style = 'morning',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;
  const exitSc = interpolate(exitP, [0, 1], [1, 0.95]);

  // Mesh background - warm tones
  const m1 = Math.sin(frame * 0.012) * 20;
  const m2 = Math.cos(frame * 0.015) * 15;
  const m3 = Math.sin(frame * 0.01 + 2) * 18;

  // Card entrance
  const cardSpr = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const cardSc = interpolate(cardSpr, [0, 1], [0.85, 1]);

  // Show name words staggered
  const words = showName.split(' ');
  const wordAnims = words.map((word, i) => {
    const s = spring({ frame, fps, delay: Math.round(0.3 * fps + i * 4), config: { damping: 12, stiffness: 100 } });
    return { word, y: interpolate(s, [0, 1], [40, 0]), op: s, i };
  });

  // Presenter
  const presOp = interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const presGlow = 0.4 + Math.sin(frame * 0.04) * 0.3;

  // Time
  const timeSpr = spring({ frame, fps, delay: Math.round(1.0 * fps), config: { damping: 16, stiffness: 80 } });

  // LIVE badge
  const liveSpr = spring({ frame, fps, delay: Math.round(1.3 * fps), config: { damping: 10, stiffness: 120 } });
  const liveDot = frame > 1.3 * fps ? 0.5 + Math.sin(frame * 0.15) * 0.5 : 0;

  // Waveform
  const wave = Array.from({ length: 60 }, (_, i) =>
    Math.sin(frame * 0.06 + i * 0.3) * 8 + Math.cos(frame * 0.04 + i * 0.5) * 5
  );

  const scanOp = 0.03 + Math.sin(frame * 0.08) * 0.015;
  const breathe = 1 + Math.sin(frame * 0.025) * 0.008;
  const refAngle = frame * 0.8;

  // Dot grid
  const dots = Array.from({ length: 30 }, (_, i) => ({
    x: (i % 6) * 20, y: Math.floor(i / 6) * 20, i,
  }));

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Warm mesh */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.45 * exitOp,
        background: `radial-gradient(ellipse 100% 80% at ${45 + m1}% ${40 + m2}%, rgba(247,148,29,0.18) 0%, transparent 55%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35 * exitOp,
        background: `radial-gradient(ellipse 80% 100% at ${60 + m2}% ${55 + m3}%, rgba(226,57,45,0.12) 0%, transparent 50%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 * exitOp,
        background: `radial-gradient(ellipse 90% 70% at ${35 + m3}% ${60 - m1}%, rgba(139,106,174,0.1) 0%, transparent 45%)`,
      }} />

      {/* Red dot grid corners */}
      <div style={{ position: 'absolute', top: 30, right: 30, opacity: 0.12 * exitOp }}>
        {dots.map(d => (
          <div key={d.i} style={{ position: 'absolute', right: d.x, top: d.y, width: 3, height: 3, borderRadius: '50%', background: '#E2392D' }} />
        ))}
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: scanOp, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${Math.floor(frame * 1.7)}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Main card */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${cardSc * exitSc * breathe})`,
        opacity: cardSpr * exitOp,
        width: 920, padding: '50px 60px',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
        {/* Refraction edge */}
        <div style={{
          position: 'absolute', inset: -1, borderRadius: 24, pointerEvents: 'none',
          background: `conic-gradient(from ${refAngle}deg at 50% 50%, transparent 0%, rgba(247,148,29,0.2) 10%, transparent 20%, rgba(226,57,45,0.15) 50%, transparent 60%, rgba(247,148,29,0.2) 90%, transparent 100%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          WebkitMaskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          maskComposite: 'exclude', WebkitMaskComposite: 'xor', padding: 1,
        }} />

        {/* Top wave decoration */}
        <svg style={{ position: 'absolute', top: -1, left: 40, right: 40, height: 20, opacity: 0.35 }} viewBox="0 0 840 20" preserveAspectRatio="none">
          <path d={`M0,10 ${wave.map((h, i) => `L${i * (840 / 60)},${10 + h}`).join(' ')}`}
            fill="none" stroke="url(#wgNar1)" strokeWidth="1.5" />
          <defs><linearGradient id="wgNar1"><stop offset="0%" stopColor="#8B6AAE" /><stop offset="50%" stopColor="#F7941D" /><stop offset="100%" stopColor="#E2392D" /></linearGradient></defs>
        </svg>

        {/* LIVE badge */}
        <div style={{
          position: 'absolute', top: -16, right: 40,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(135deg, #F7941D, #E2392D)', padding: '8px 20px', borderRadius: 20,
          transform: `scale(${liveSpr})`,
          boxShadow: '0 4px 16px rgba(226,57,45,0.4)',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', opacity: liveDot, boxShadow: '0 0 8px #fff' }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: 3 }}>LIVE</span>
        </div>

        {/* Logo top-left */}
        <div style={{ position: 'absolute', top: 20, left: 30, opacity: 0.6 * exitOp }}>
          <img src="/brands/nar/logo-main.png" style={{ width: 80, height: 'auto' }} />
        </div>

        {/* Show name - gradient text */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16, marginTop: 20 }}>
          {wordAnims.map(w => (
            <span key={w.i} style={{
              fontSize: 58, fontWeight: 900, lineHeight: 1.1,
              opacity: w.op * exitOp, transform: `translateY(${w.y}px)`, display: 'inline-block',
              background: 'linear-gradient(135deg, #F7941D 0%, #E2392D 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{w.word}</span>
          ))}
        </div>

        {/* Presenter */}
        <div style={{
          fontSize: 30, fontWeight: 400, color: '#ffffff', letterSpacing: 2,
          opacity: presOp * exitOp,
          textShadow: `0 0 20px rgba(247,148,29,${presGlow})`, marginBottom: 12,
        }}>with {presenterName}</div>

        {/* Time */}
        <div style={{
          fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
          letterSpacing: 6, textTransform: 'uppercase',
          opacity: timeSpr * exitOp,
          transform: `translateX(${interpolate(timeSpr, [0, 1], [-30, 0])}px)`,
          fontVariantNumeric: 'tabular-nums',
        }}>{showTime}</div>

        {/* Bottom wave */}
        <svg style={{ position: 'absolute', bottom: -1, left: 40, right: 40, height: 20, opacity: 0.25 }} viewBox="0 0 840 20" preserveAspectRatio="none">
          <path d={`M0,10 ${wave.map((h, i) => `L${i * (840 / 60)},${10 - h * 0.7}`).join(' ')}`}
            fill="none" stroke="url(#wgNar2)" strokeWidth="1.5" />
          <defs><linearGradient id="wgNar2"><stop offset="0%" stopColor="#E2392D" /><stop offset="50%" stopColor="#C94070" /><stop offset="100%" stopColor="#8ED8E8" /></linearGradient></defs>
        </svg>
      </div>

      {/* NAR branding */}
      <div style={{
        position: 'absolute', bottom: 36, left: 56,
        fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
        letterSpacing: 4, opacity: exitOp,
      }}>NOW AYRSHIRE RADIO</div>
    </div>
  );
};
