import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const ParticleTitle = ({ title = 'BOOTS N BEATS', particleColor = '#f59e0b', textColor = '#ffffff', background = '#000000', particleCount = 100, fontSize = 140 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 6,
      speed: 0.3 + Math.random() * 2,
      delay: Math.random() * 30,
      angle: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 2,
    }));
  }, [particleCount]);

  const titleOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const titleScale = interpolate(frame, [20, 45], [0.7, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const glowIntensity = interpolate(frame, [20, 50, 60], [0, 40, 20], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: background === 'transparent' ? 'transparent' : background,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Particles */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        {particles.map((p, i) => {
          const localFrame = Math.max(0, frame - p.delay);
          const travel = localFrame * p.speed;
          const cx = p.x + Math.cos(p.angle) * travel * 0.5 + p.drift * localFrame * 0.1;
          const cy = p.y - travel * 0.3;
          const opacity = interpolate(localFrame, [0, 5, 40, 60], [0, 0.8, 0.6, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          const size = p.size * interpolate(localFrame, [0, 10, 50], [0.5, 1, 0.2], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={size} fill={particleColor} opacity={opacity} />
          );
        })}
      </svg>

      {/* Title */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: titleOpacity, transform: `scale(${titleScale})`,
      }}>
        <h1 style={{
          fontSize, fontWeight: 900, color: textColor, letterSpacing: '-0.02em', margin: 0,
          textShadow: `0 0 ${glowIntensity}px ${particleColor}, 0 0 ${glowIntensity * 2}px ${particleColor}44`,
          textTransform: 'uppercase',
        }}>{title}</h1>
      </div>
    </div>
  );
};
