import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const NextUp = ({
  label = 'COMING UP NEXT',
  artistName = 'THE HEADLINERS',
  subtitle = 'Live on the Main Stage',
  time = '10:30 PM',
  accentColor = '#ec4899',
  background = '#000000',
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const wipeWidth = interpolate(frame, [0, 20], [0, width], { extrapolateRight: 'clamp' });
  const labelSpring = spring({ frame: frame - 10, fps, config: { damping: 12 } });
  const nameSpring = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 80 } });
  const detailOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = Math.sin(frame / 15) * 0.15 + 0.85;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Accent wipe line */}
      <div style={{
        position: 'absolute', top: '30%', left: 0, height: 3,
        width: wipeWidth, background: `linear-gradient(90deg, transparent, ${accentColor})`,
      }} />
      <div style={{
        position: 'absolute', bottom: '30%', right: 0, height: 3,
        width: wipeWidth, background: `linear-gradient(270deg, transparent, ${accentColor})`,
      }} />

      {/* Label */}
      <div style={{
        fontSize: 32, fontWeight: 700, color: accentColor, letterSpacing: 10,
        opacity: labelSpring, transform: `translateY(${(1 - labelSpring) * -30}px)`,
        marginBottom: 15,
      }}>
        ▶ {label}
      </div>

      {/* Artist Name */}
      <div style={{
        fontSize: 120, fontWeight: 900, color: '#ffffff',
        transform: `scale(${nameSpring})`, letterSpacing: 4,
        textShadow: `0 0 40px ${accentColor}50`,
      }}>
        {artistName}
      </div>

      {/* Subtitle */}
      <div style={{ opacity: detailOpacity, fontSize: 32, color: '#ffffff70', marginTop: 10, letterSpacing: 3 }}>
        {subtitle}
      </div>

      {/* Time badge */}
      <div style={{
        opacity: detailOpacity, marginTop: 30,
        padding: '12px 36px', borderRadius: 8,
        border: `2px solid ${accentColor}60`, background: `${accentColor}15`,
        transform: `scale(${pulse})`,
      }}>
        <span style={{ color: accentColor, fontSize: 36, fontWeight: 700, letterSpacing: 4 }}>{time}</span>
      </div>
    </div>
  );
};
