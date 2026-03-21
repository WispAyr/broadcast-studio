import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const ArtistSpotlight = ({
  artistName = 'DJ SHADOW',
  genre = 'Electronic',
  setTime = '10:00 PM',
  description = 'Award-winning artist bringing the beats',
  accentColor = '#ec4899',
  background = '#000000',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = interpolate(frame, [0, 90], [1.1, 1], { extrapolateRight: 'clamp' });
  const nameSpring = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 100 } });
  const badgeSpring = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const detailOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });
  const glowPulse = Math.sin(frame / 15) * 0.3 + 0.7;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Radial spotlight */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${accentColor}30 0%, transparent 60%)`,
        transform: `scale(${bgScale})`,
      }} />

      {/* Animated rings */}
      {[200, 300, 400].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', width: r + frame * 0.5, height: r + frame * 0.5,
          border: `2px solid ${accentColor}${15 + i * 5}`,
          borderRadius: '50%', opacity: glowPulse - i * 0.15,
        }} />
      ))}

      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
        {/* Genre badge */}
        <div style={{
          transform: `scale(${badgeSpring})`,
          display: 'inline-block', padding: '8px 28px', borderRadius: 30,
          background: accentColor, color: '#fff', fontSize: 22,
          fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 20,
        }}>
          {genre}
        </div>

        {/* Artist name */}
        <div style={{
          fontSize: 140, fontWeight: 900, color: '#fff',
          transform: `translateY(${(1 - nameSpring) * 60}px)`,
          opacity: nameSpring, letterSpacing: 6,
          textShadow: `0 0 60px ${accentColor}80, 0 0 120px ${accentColor}40`,
        }}>
          {artistName}
        </div>

        {/* Set time */}
        <div style={{
          opacity: detailOpacity, fontSize: 48, color: accentColor,
          fontWeight: 300, marginTop: 10, letterSpacing: 8,
        }}>
          {setTime}
        </div>

        {/* Description */}
        <div style={{
          opacity: detailOpacity, fontSize: 28, color: '#ffffff99',
          marginTop: 15, maxWidth: 700, margin: '15px auto 0',
        }}>
          {description}
        </div>
      </div>
    </div>
  );
};
