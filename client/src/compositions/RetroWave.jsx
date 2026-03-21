import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const RetroWave = ({
  text = '',
  sunColor = '#ff006a',
  gridColor = '#ff00ff',
  skyColor1 = '#0a001a',
  skyColor2 = '#1a0040',
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * speed;

  const gridLines = 20;
  const horizLines = 12;
  const gridScroll = (t * 50) % 100;

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      background: `linear-gradient(180deg, ${skyColor1} 0%, ${skyColor2} 45%, #000 55%)`,
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Stars */}
      {Array.from({ length: 50 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 37.7) % 100}%`, top: `${(i * 23.3) % 45}%`,
          width: 2, height: 2, borderRadius: '50%',
          background: '#fff',
          opacity: 0.3 + Math.sin(t * 2 + i) * 0.3,
        }} />
      ))}

      {/* Sun */}
      <div style={{
        position: 'absolute', left: '50%', top: '35%', transform: 'translate(-50%, -50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: `linear-gradient(180deg, #ffde00, ${sunColor})`,
        boxShadow: `0 0 80px ${sunColor}80, 0 0 160px ${sunColor}40`,
        clipPath: `polygon(0 0, 100% 0, 100% ${50 + Math.sin(t * 0.5) * 5}%, 0 ${50 + Math.sin(t * 0.5) * 5}%)`,
      }}>
        {/* Sun lines */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${55 + i * 7}%`, height: `${3 + i * 1.5}%`,
            background: `linear-gradient(180deg, ${skyColor1}, ${skyColor2})`,
          }} />
        ))}
      </div>

      {/* Ground / Grid */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
        perspective: 400, perspectiveOrigin: '50% 0%', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: 'rotateX(60deg)', transformOrigin: 'top center',
        }}>
          {/* Vertical grid lines */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const x = (i / gridLines) * 100;
              return <line key={`v${i}`} x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%" stroke={gridColor} strokeWidth="1" opacity="0.4" />;
            })}
            {Array.from({ length: horizLines }).map((_, i) => {
              const y = ((i / horizLines) * 100 + gridScroll) % 100;
              return <line key={`h${i}`} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke={gridColor} strokeWidth="1" opacity="0.4" />;
            })}
          </svg>
        </div>
      </div>

      {/* Optional text */}
      {text && (
        <div style={{
          position: 'absolute', top: '10%', width: '100%', textAlign: 'center',
          fontSize: 90, fontWeight: 900, letterSpacing: 8,
          color: '#fff',
          textShadow: `0 0 20px ${sunColor}, 0 0 60px ${sunColor}80`,
        }}>
          {text}
        </div>
      )}
    </div>
  );
};
