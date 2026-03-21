import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const ComedyNight = ({
  title = 'COMEDY NIGHT',
  subtitle = 'Live at Ayr Pavilion',
  comedian = 'Featuring: Top Scottish Comics',
  accentColor = '#fbbf24',
  background = '#1a1008',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const spotlightOn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleSpring = spring({ frame: frame - 15, fps, config: { damping: 10 } });

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Brick wall pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08 }}>
        {Array.from({ length: 20 }).map((_, row) => (
          <div key={row} style={{
            display: 'flex', height: height / 20,
          }}>
            {Array.from({ length: 10 }).map((_, col) => (
              <div key={col} style={{
                flex: 1, border: '1px solid rgba(139,69,19,0.5)',
                marginLeft: row % 2 === 0 ? 0 : '-5%',
                background: `rgba(139,69,19,${0.03 + ((row * 7 + col * 3) % 5) * 0.01})`,
              }} />
            ))}
          </div>
        ))}
      </div>

      {/* Spotlight cone */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: `${300 * spotlightOn}px solid transparent`,
        borderRight: `${300 * spotlightOn}px solid transparent`,
        borderTop: `${height}px solid rgba(255,255,200,${0.04 * spotlightOn})`,
      }} />

      {/* Stage light at top */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        width: 60, height: 30, borderRadius: '0 0 30px 30px',
        background: '#333', opacity: spotlightOn,
      }}>
        <div style={{
          width: 20, height: 10, background: accentColor,
          borderRadius: '0 0 10px 10px', margin: '0 auto',
          boxShadow: `0 0 20px ${accentColor}`,
        }} />
      </div>

      {/* Microphone */}
      <div style={{
        fontSize: 90, marginBottom: 15,
        opacity: spotlightOn,
        transform: `rotate(${Math.sin(t * 0.5) * 3}deg)`,
      }}>
        🎤
      </div>

      {/* Title */}
      <div style={{
        fontSize: 120, fontWeight: 900, color: accentColor,
        transform: `scale(${titleSpring})`, letterSpacing: 6,
        textShadow: `0 0 30px ${accentColor}50`,
      }}>
        {title}
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 32, color: '#ffffff70', letterSpacing: 4, marginTop: 10,
        opacity: interpolate(frame, [30, 40], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {subtitle}
      </div>

      {/* Comedian */}
      <div style={{
        fontSize: 28, color: '#ffffff', marginTop: 25,
        padding: '10px 30px', background: `${accentColor}20`, borderRadius: 8,
        opacity: interpolate(frame, [40, 50], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {comedian}
      </div>
    </div>
  );
};
