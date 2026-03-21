import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const GlassmorphismClock = ({
  hours = 10,
  minutes = 8,
  seconds = 30,
  dateText = 'Tuesday, 18 March 2026',
  accentColor = '#00a8ff',
  background = '#0a1628',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  const entrySpr = spring({ frame, fps, config: { damping: 14, stiffness: 60 } });
  const entryScale = interpolate(entrySpr, [0, 1], [0.8, 1]);

  // Clock time calculation — smooth sub-frame interpolation
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + frame / fps;
  const secAngle = (totalSeconds % 60) / 60 * 360;
  const minAngle = ((totalSeconds / 60) % 60) / 60 * 360;
  const hourAngle = ((totalSeconds / 3600) % 12) / 12 * 360;

  // Background blobs orbiting
  const blobs = [
    { color: accentColor, size: 200, orbitR: 250, speed: 0.008, phase: 0 },
    { color: '#ff3366', size: 160, orbitR: 280, speed: 0.006, phase: 2 },
    { color: '#8b5cf6', size: 180, orbitR: 220, speed: 0.01, phase: 4 },
    { color: '#22d3ee', size: 140, orbitR: 300, speed: 0.007, phase: 1 },
  ];
  const blobAnims = blobs.map((b, i) => {
    const angle = frame * b.speed + b.phase;
    const x = 960 + Math.cos(angle) * b.orbitR;
    const y = 540 + Math.sin(angle) * b.orbitR;
    return { ...b, x, y, i };
  });

  // Tick marks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const angle = (i / 60) * 360;
    const glowOp = isHour ? 0.8 : 0.3;
    const tickLen = isHour ? 20 : 10;
    const tickWidth = isHour ? 3 : 1;
    return { angle, isHour, glowOp, tickLen, tickWidth, i };
  });

  // Outer ring gradient rotation
  const ringRotation = frame * 0.3;

  // Date entrance
  const dateSpr = spring({ frame, fps, delay: Math.round(0.5 * fps), config: { damping: 16, stiffness: 70 } });

  const clockR = 220; // clock radius
  const grainSeed = Math.floor(frame * 1.3);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Orbiting blobs behind glass */}
      {blobAnims.map(b => (
        <div key={b.i} style={{
          position: 'absolute',
          left: b.x - b.size / 2, top: b.y - b.size / 2,
          width: b.size, height: b.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${b.color}55 0%, ${b.color}00 70%)`,
          filter: 'blur(40px)', opacity: 0.6 * exitOp,
        }} />
      ))}

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Main clock container */}
      <div style={{
        position: 'absolute', top: '46%', left: '50%',
        transform: `translate(-50%, -50%) scale(${entryScale})`,
        opacity: entrySpr * exitOp,
      }}>
        {/* Outer gradient ring */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(-50%, -50%) rotate(${ringRotation}deg)`,
          width: clockR * 2 + 30, height: clockR * 2 + 30, borderRadius: '50%',
          background: `conic-gradient(from 0deg, ${accentColor}44, transparent 30%, #ff336644 50%, transparent 70%, ${accentColor}44)`,
          maskImage: 'radial-gradient(circle, transparent 87%, black 88%, black 100%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 87%, black 88%, black 100%, transparent 100%)',
        }} />

        {/* Frosted glass circle */}
        <div style={{
          width: clockR * 2, height: clockR * 2, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          position: 'relative',
        }}>
          {/* Reflection arc on glass */}
          <div style={{
            position: 'absolute', top: 15, left: 40, width: clockR * 1.4, height: clockR * 0.6,
            borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
            transform: 'rotate(-10deg)', pointerEvents: 'none',
          }} />

          {/* Tick marks */}
          {ticks.map(t => (
            <div key={t.i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: t.tickWidth, height: t.tickLen,
              background: `rgba(255,255,255,${t.glowOp})`,
              transformOrigin: `50% ${clockR}px`,
              transform: `translate(-50%, -${clockR}px) rotate(${t.angle}deg)`,
              borderRadius: 1,
              boxShadow: t.isHour ? `0 0 4px rgba(255,255,255,0.3)` : 'none',
            }} />
          ))}

          {/* Hour hand */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 6, height: clockR * 0.5, borderRadius: 3,
            background: '#ffffff',
            transformOrigin: '50% 0%',
            transform: `translate(-50%, 0) rotate(${hourAngle}deg) translateY(-${clockR * 0.5}px)`,
            boxShadow: '0 0 8px rgba(0,0,0,0.3)',
          }} />

          {/* Minute hand */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 4, height: clockR * 0.7, borderRadius: 2,
            background: 'rgba(255,255,255,0.9)',
            transformOrigin: '50% 0%',
            transform: `translate(-50%, 0) rotate(${minAngle}deg) translateY(-${clockR * 0.7}px)`,
            boxShadow: '0 0 6px rgba(0,0,0,0.2)',
          }} />

          {/* Second hand */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 2, height: clockR * 0.8, borderRadius: 1,
            background: accentColor,
            transformOrigin: '50% 0%',
            transform: `translate(-50%, 0) rotate(${secAngle}deg) translateY(-${clockR * 0.8}px)`,
            boxShadow: `0 0 8px ${accentColor}88`,
          }} />

          {/* Center dot */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}66`,
          }} />
        </div>
      </div>

      {/* Date text below */}
      <div style={{
        position: 'absolute', top: '75%', left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 22, fontWeight: 400, color: 'rgba(255,255,255,0.6)',
        letterSpacing: 4, opacity: dateSpr * exitOp,
      }}>{dateText}</div>

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />
    </div>
  );
};
