import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const FamilyFun = ({
  title = 'FAMILY FUN DAY',
  subtitle = 'Ayr Pavilion',
  details = 'Games • Face Painting • Live Music • Food',
  accentColor = '#f472b6',
  secondaryColor = '#a78bfa',
  background = '#fef3c7',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const titleSpring = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 80 } });

  // Confetti particles
  const confetti = useMemo(() => {
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    return Array.from({ length: 50 }).map((_, i) => ({
      x: ((i * 7919) % 1000) / 10,
      delay: ((i * 3571) % 1000) / 1000 * 3,
      speed: 0.5 + ((i * 2347) % 1000) / 1000,
      color: colors[i % colors.length],
      size: 8 + ((i * 131) % 10),
      wobble: ((i * 997) % 1000) / 500 - 1,
      shape: i % 3, // 0=square, 1=circle, 2=triangle
    }));
  }, []);

  // Balloons
  const balloons = ['🎈', '🎈', '🎈', '🎈', '🎈'];
  const balloonColors = [accentColor, secondaryColor, '#fbbf24', '#34d399', '#60a5fa'];

  return (
    <div style={{
      width: '100%', height: '100%', background: `linear-gradient(180deg, #87CEEB, ${background})`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Confetti */}
      {confetti.map((c, i) => {
        const age = t - c.delay;
        if (age < 0) return null;
        const y = (age * c.speed * 150) % (height + 50) - 30;
        const x = (c.x / 100) * width + Math.sin(age * 3 + c.wobble * 5) * 30;
        const rotation = age * 200 * c.wobble;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y,
            width: c.size, height: c.size,
            background: c.color,
            borderRadius: c.shape === 1 ? '50%' : c.shape === 2 ? '0' : '2px',
            transform: `rotate(${rotation}deg)`,
            opacity: 0.8,
          }} />
        );
      })}

      {/* Balloons */}
      {balloons.map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${15 + i * 18}%`,
          bottom: 60 + Math.sin(t * 1.5 + i * 1.2) * 20,
          fontSize: 70, opacity: 0.3,
          filter: `hue-rotate(${i * 60}deg)`,
        }}>
          🎈
        </div>
      ))}

      {/* Sun */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: '#fbbf24',
        boxShadow: '0 0 60px #fbbf2480',
        opacity: 0.4,
      }} />

      {/* Title */}
      <div style={{
        fontSize: 110, fontWeight: 900, letterSpacing: 6,
        transform: `scale(${titleSpring})`,
        background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor}, #fbbf24)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.1))',
      }}>
        {title}
      </div>

      <div style={{
        fontSize: 36, color: '#78350f', fontWeight: 600, marginTop: 10, letterSpacing: 4,
        opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {subtitle}
      </div>

      <div style={{
        fontSize: 28, color: '#92400e', marginTop: 25,
        padding: '12px 30px', background: 'rgba(255,255,255,0.6)', borderRadius: 30,
        opacity: interpolate(frame, [35, 45], [0, 1], { extrapolateRight: 'clamp' }),
        letterSpacing: 2,
      }}>
        {details}
      </div>
    </div>
  );
};
