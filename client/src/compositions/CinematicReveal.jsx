import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const CinematicReveal = ({
  title = 'EPIC TITLE',
  subtitle = 'The Story Begins',
  color = '#ffffff',
  accentColor = '#FFD700',
  background = '#000000',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Letterbox bars animate in
  const letterboxSpr = spring({ frame, fps, config: { damping: 200, stiffness: 40 } });
  const barHeight = interpolate(letterboxSpr, [0, 1], [0, 80]);

  // Particle dust field with depth of field
  const dustParticles = Array.from({ length: 100 }, (_, i) => {
    const seed = i * 137.508 + 42;
    const baseX = (seed * 7.3) % 100;
    const baseY = (seed * 13.1) % 100;
    const depth = (seed * 3.7) % 1; // 0=far, 1=near
    const size = 1 + depth * 4;
    const brightness = 0.2 + depth * 0.8;
    const speed = 0.1 + depth * 0.4;
    const drift = Math.sin(frame * 0.01 * speed + i * 0.7) * (10 + depth * 30);
    const fall = (frame * speed * 0.3 + i * 17) % 110 - 5;
    const op = interpolate(fall, [-5, 5, 100, 110], [0, brightness * 0.6, brightness * 0.4, 0]) * exitOp;
    return { x: baseX, y: fall, size, op, drift, depth, i };
  });

  // Anamorphic lens flare sweep
  const flareX = interpolate(frame, [0.5 * fps, 2.5 * fps], [-20, 120], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const flareOp = interpolate(frame, [0.5 * fps, 1 * fps, 2 * fps, 2.5 * fps], [0, 0.6, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Multiple light streaks at different angles
  const streaks = [
    { angle: -8, delay: 0.3, speed: 0.8, width: 3, color: `${accentColor}44` },
    { angle: 5, delay: 0.5, speed: 1.0, width: 2, color: `${accentColor}33` },
    { angle: -3, delay: 0.7, speed: 0.6, width: 4, color: 'rgba(255,255,255,0.15)' },
    { angle: 12, delay: 0.4, speed: 1.2, width: 1.5, color: `${accentColor}22` },
  ];
  const streakAnims = streaks.map((s, i) => {
    const x = interpolate(frame, [s.delay * fps, (s.delay + 2.5) * fps], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const op = interpolate(frame, [s.delay * fps, (s.delay + 0.5) * fps, (s.delay + 2) * fps, (s.delay + 2.5) * fps], [0, 0.8, 0.6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { ...s, x, op: op * exitOp, i };
  });

  // Title pull-back: 130% -> 100%
  const titleDelay = 0.8 * fps;
  const titleSpr = spring({ frame, fps, delay: Math.round(titleDelay), config: { damping: 15, stiffness: 50, mass: 1.5 } });
  const titleScale = interpolate(titleSpr, [0, 1], [1.3, 1]);
  const titleOp = interpolate(titleSpr, [0, 0.2, 1], [0, 0.5, 1]);

  // Title letters with individual delay
  const titleLetters = title.split('').map((char, i) => {
    const ld = Math.round(titleDelay + i * 2);
    const ls = spring({ frame, fps, delay: ld, config: { damping: 12, stiffness: 80 } });
    return { char, op: ls, y: interpolate(ls, [0, 1], [20, 0]), i };
  });

  // Subtitle types out
  const subDelay = 2 * fps;
  const subLetters = subtitle.split('').map((char, i) => {
    const d = subDelay + i * 2;
    const op = interpolate(frame, [d, d + 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { char, op, i };
  });

  // Vignette intensity
  const vignetteOp = interpolate(frame, [0, 1 * fps], [0.8, 0.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const grainSeed = Math.floor(frame * 1.3);
  const breathe = frame > 2 * fps ? 1 + Math.sin(frame * 0.02) * 0.005 : 1;

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Dark ambient glow */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 * exitOp,
        background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${accentColor}15 0%, transparent 60%)`,
      }} />

      {/* Dust particles */}
      {dustParticles.map(p => (
        <div key={p.i} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          transform: `translateX(${p.drift}px)`,
          width: p.size, height: p.size, borderRadius: '50%',
          background: p.depth > 0.6 ? accentColor : '#ffffff',
          opacity: p.op,
          boxShadow: p.depth > 0.5 ? `0 0 ${p.size * 2}px ${accentColor}66` : 'none',
          filter: p.depth < 0.3 ? 'blur(1px)' : 'none',
        }} />
      ))}

      {/* Light streaks */}
      {streakAnims.map(s => (
        <div key={s.i} style={{
          position: 'absolute', top: '48%', left: `${s.x}%`,
          width: 150, height: s.width,
          background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
          transform: `rotate(${s.angle}deg)`,
          opacity: s.op, filter: 'blur(1px)',
        }} />
      ))}

      {/* Main anamorphic lens flare */}
      <div style={{
        position: 'absolute', top: '46%', left: `${flareX}%`,
        width: 300, height: 6,
        background: `linear-gradient(90deg, transparent, ${accentColor}88, rgba(255,255,255,0.6), ${accentColor}88, transparent)`,
        opacity: flareOp * exitOp,
        filter: 'blur(3px)',
        transform: 'translateX(-50%)',
      }} />
      {/* Flare bloom */}
      <div style={{
        position: 'absolute', top: '44%', left: `${flareX}%`,
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(255,255,255,0.3) 0%, ${accentColor}22 40%, transparent 70%)`,
        opacity: flareOp * exitOp * 0.7,
        transform: 'translate(-50%, -50%)',
        filter: 'blur(8px)',
      }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 65% 55% at 50% 50%, transparent 30%, rgba(0,0,0,${vignetteOp}) 100%)`,
      }} />

      {/* Film grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.07,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '150px 150px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Title */}
      <div style={{
        position: 'absolute', top: '44%', left: '50%',
        transform: `translate(-50%, -50%) scale(${titleScale * breathe})`,
        opacity: titleOp * exitOp,
        display: 'flex', gap: 4,
      }}>
        {titleLetters.map(l => (
          <span key={l.i} style={{
            fontSize: 100, fontWeight: 900, color, display: 'inline-block',
            opacity: l.op, transform: `translateY(${l.y}px)`,
            letterSpacing: 12,
            textShadow: `0 0 40px ${accentColor}66, 0 0 80px ${accentColor}33, 0 4px 8px rgba(0,0,0,0.8)`,
            minWidth: l.char === ' ' ? 30 : undefined,
          }}>{l.char}</span>
        ))}
      </div>

      {/* Subtitle */}
      <div style={{
        position: 'absolute', top: '56%', left: '50%',
        transform: 'translate(-50%, 0)',
        display: 'flex', gap: 0,
        opacity: exitOp,
      }}>
        {subLetters.map(l => (
          <span key={l.i} style={{
            fontSize: 28, fontWeight: 300, color: 'rgba(255,255,255,0.7)',
            display: 'inline-block', opacity: l.op,
            letterSpacing: 4,
            minWidth: l.char === ' ' ? 10 : undefined,
          }}>{l.char}</span>
        ))}
      </div>

      {/* Letterbox bars */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: barHeight,
        background: '#000', zIndex: 10,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: barHeight,
        background: '#000', zIndex: 10,
      }} />
    </div>
  );
};
