import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const ClubNight = ({
  title = 'CLUB NIGHT',
  subtitle = 'Ayr Pavilion',
  date = 'THIS FRIDAY',
  color1 = '#ff00ff',
  color2 = '#00ffff',
  color3 = '#ff0066',
  background = '#000000',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const titleScale = interpolate(frame, [0, 20], [0.5, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const beatPulse = 1 + Math.abs(Math.sin(t * 4)) * 0.04;

  // Laser beams
  const laserCount = 8;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Pulsing bg glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${color1}15, transparent 50%)`,
        transform: `scale(${beatPulse * 1.5})`,
      }} />

      {/* Laser beams */}
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.3 }}>
        {Array.from({ length: laserCount }).map((_, i) => {
          const angle = Math.sin(t * 1.5 + i * 0.8) * 40;
          const startX = width / 2;
          const endX = startX + Math.sin((angle + i * 45) * Math.PI / 180) * width;
          const colors = [color1, color2, color3];
          return (
            <line key={i}
              x1={startX} y1={0}
              x2={endX} y2={height}
              stroke={colors[i % 3]} strokeWidth="2" opacity="0.6"
            />
          );
        })}
      </svg>

      {/* Date badge */}
      <div style={{
        fontSize: 28, fontWeight: 700, letterSpacing: 8,
        color: color2, marginBottom: 15,
        opacity: interpolate(frame, [25, 35], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {date}
      </div>

      {/* Main title */}
      <div style={{
        fontSize: 150, fontWeight: 900, letterSpacing: 10,
        opacity: titleOpacity, transform: `scale(${titleScale * beatPulse})`,
        background: `linear-gradient(90deg, ${color1}, ${color2}, ${color3})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textShadow: 'none',
        filter: `drop-shadow(0 0 30px ${color1}80)`,
      }}>
        {title}
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 32, color: '#ffffff60', letterSpacing: 6, marginTop: 10,
        opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {subtitle}
      </div>

      {/* Bottom equalizer bars */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 4, padding: '0 20%',
      }}>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 20 + Math.abs(Math.sin(t * 6 + i * 0.5)) * 60;
          const colors = [color1, color2, color3];
          return (
            <div key={i} style={{
              width: 8, height: h, borderRadius: '4px 4px 0 0',
              background: `linear-gradient(to top, ${colors[i % 3]}80, ${colors[i % 3]})`,
              opacity: 0.6,
            }} />
          );
        })}
      </div>
    </div>
  );
};
