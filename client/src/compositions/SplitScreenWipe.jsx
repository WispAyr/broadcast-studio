import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const SplitScreenWipe = ({
  leftText = 'BEFORE',
  rightText = 'AFTER',
  leftColor = '#00a8ff',
  rightColor = '#ff3366',
  barColor = '#FFD700',
  background = '#0a1628',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Diagonal divider animation
  const dividerSpr = spring({ frame, fps, config: { damping: 15, stiffness: 60, mass: 1.2 } });
  const dividerX = interpolate(dividerSpr, [0, 1], [-200, 960]); // center of 1920

  // Angle of diagonal (degrees)
  const angle = 12;
  const angleRad = (angle * Math.PI) / 180;

  // Left side slides in
  const leftSpr = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const leftX = interpolate(leftSpr, [0, 1], [-400, 0]);

  // Right side slides in
  const rightSpr = spring({ frame, fps, delay: Math.round(0.2 * fps), config: { damping: 14, stiffness: 70 } });
  const rightX = interpolate(rightSpr, [0, 1], [400, 0]);

  // Text staggered reveal
  const leftTextSpr = spring({ frame, fps, delay: Math.round(0.5 * fps), config: { damping: 12, stiffness: 90 } });
  const rightTextSpr = spring({ frame, fps, delay: Math.round(0.7 * fps), config: { damping: 12, stiffness: 90 } });

  // Particle trail along divider
  const particles = Array.from({ length: 30 }, (_, i) => {
    const t = i / 30;
    const py = t * 1080;
    const px = dividerX + Math.tan(angleRad) * (py - 540);
    const pOp = interpolate(dividerSpr, [t * 0.8, t * 0.8 + 0.3], [0, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const shimmer = 0.5 + Math.sin(frame * 0.1 + i * 0.5) * 0.5;
    return { x: px, y: py, op: pOp * shimmer * exitOp, i };
  });

  // Divider glow pulse
  const glowPulse = 0.5 + Math.sin(frame * 0.06) * 0.3;

  const grainSeed = Math.floor(frame * 1.3);

  // Clip paths for each side using the diagonal
  const skewOffset = Math.tan(angleRad) * 540; // offset at center height

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Left side */}
      <div style={{
        position: 'absolute', inset: 0,
        clipPath: `polygon(0 0, ${dividerX + skewOffset}px 0, ${dividerX - skewOffset}px 100%, 0 100%)`,
        transform: `translateX(${leftX}px)`, opacity: exitOp,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, ${leftColor}20 0%, ${background} 60%)`,
        }} />
        {/* Left tint */}
        <div style={{ position: 'absolute', inset: 0, background: `${leftColor}08` }} />

        {/* Left text */}
        <div style={{
          position: 'absolute', top: '50%', left: '22%',
          transform: `translate(-50%, -50%) scale(${interpolate(leftTextSpr, [0, 1], [0.8, 1])})`,
          opacity: leftTextSpr * exitOp,
        }}>
          <div style={{
            fontSize: 72, fontWeight: 900, color: '#ffffff', letterSpacing: 8,
            textShadow: `0 0 40px ${leftColor}66, 0 4px 12px rgba(0,0,0,0.6)`,
          }}>{leftText}</div>
          <div style={{
            width: interpolate(leftTextSpr, [0, 1], [0, 200]), height: 3,
            background: leftColor, borderRadius: 2, marginTop: 12,
            boxShadow: `0 0 12px ${leftColor}66`,
          }} />
        </div>
      </div>

      {/* Right side */}
      <div style={{
        position: 'absolute', inset: 0,
        clipPath: `polygon(${dividerX + skewOffset}px 0, 100% 0, 100% 100%, ${dividerX - skewOffset}px 100%)`,
        transform: `translateX(${rightX}px)`, opacity: exitOp,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(225deg, ${rightColor}20 0%, ${background} 60%)`,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: `${rightColor}08` }} />

        {/* Right text */}
        <div style={{
          position: 'absolute', top: '50%', left: '78%',
          transform: `translate(-50%, -50%) scale(${interpolate(rightTextSpr, [0, 1], [0.8, 1])})`,
          opacity: rightTextSpr * exitOp,
        }}>
          <div style={{
            fontSize: 72, fontWeight: 900, color: '#ffffff', letterSpacing: 8,
            textShadow: `0 0 40px ${rightColor}66, 0 4px 12px rgba(0,0,0,0.6)`,
          }}>{rightText}</div>
          <div style={{
            width: interpolate(rightTextSpr, [0, 1], [0, 200]), height: 3,
            background: rightColor, borderRadius: 2, marginTop: 12,
            boxShadow: `0 0 12px ${rightColor}66`,
          }} />
        </div>
      </div>

      {/* Divider bar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: dividerX - 3, width: 6,
        transform: `rotate(${-angle}deg) scaleY(1.3)`,
        transformOrigin: '50% 50%',
        background: barColor,
        boxShadow: `0 0 20px ${barColor}88, 0 0 40px ${barColor}44, -4px 0 20px ${leftColor}44, 4px 0 20px ${rightColor}44`,
        opacity: dividerSpr * exitOp,
      }} />

      {/* Particle trail */}
      {particles.map(p => (
        <div key={p.i} style={{
          position: 'absolute', left: p.x - 3, top: p.y - 3,
          width: 6, height: 6, borderRadius: '50%',
          background: barColor, opacity: p.op,
          boxShadow: `0 0 8px ${barColor}88`,
        }} />
      ))}

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.5) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />
    </div>
  );
};
