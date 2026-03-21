import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const TitleReveal = ({ title = 'YOUR TITLE', subtitle = '', color = '#ffffff', accentColor = '#3b82f6', background = '#000000', fontSize = 120, style = 'slide-up' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const styles = {
    'slide-up': () => {
      const y = interpolate(frame, [10, 30], [100, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const opacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const lineWidth = interpolate(frame, [0, 20], [0, 400], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      return { y, opacity, lineWidth, subtitleOpacity };
    },
    'fade-in': () => {
      const opacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const scale = interpolate(frame, [10, 40], [0.8, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const subtitleOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      return { y: 0, opacity, lineWidth: 0, subtitleOpacity, scale };
    },
    'typewriter': () => {
      const charsVisible = Math.floor(interpolate(frame, [10, 10 + title.length * 2], [0, title.length], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }));
      const subtitleOpacity = interpolate(frame, [10 + title.length * 2 + 10, 10 + title.length * 2 + 25], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      return { y: 0, opacity: 1, lineWidth: 0, subtitleOpacity, charsVisible, cursor: frame % 20 < 10 };
    },
    'split': () => {
      const split = interpolate(frame, [10, 30], [50, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const opacity = interpolate(frame, [5, 15], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      return { y: 0, opacity, lineWidth: 0, subtitleOpacity, split };
    },
  };

  const anim = (styles[style] || styles['slide-up'])();

  const displayTitle = anim.charsVisible !== undefined
    ? title.substring(0, anim.charsVisible) + (anim.cursor ? '|' : '')
    : title;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: background === 'transparent' ? 'transparent' : background,
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      overflow: 'hidden',
    }}>
      {anim.split !== undefined ? (
        <>
          <div style={{ display: 'flex', overflow: 'hidden' }}>
            <span style={{ color, fontSize, fontWeight: 900, letterSpacing: '-0.02em', transform: `translateX(-${anim.split}px)`, opacity: anim.opacity }}>{title.substring(0, Math.ceil(title.length / 2))}</span>
            <span style={{ color, fontSize, fontWeight: 900, letterSpacing: '-0.02em', transform: `translateX(${anim.split}px)`, opacity: anim.opacity }}>{title.substring(Math.ceil(title.length / 2))}</span>
          </div>
          {subtitle && <p style={{ color: accentColor, fontSize: fontSize * 0.3, opacity: anim.subtitleOpacity, marginTop: 10, fontWeight: 500, letterSpacing: '0.1em' }}>{subtitle}</p>}
        </>
      ) : (
        <>
          {anim.lineWidth > 0 && (
            <div style={{ width: anim.lineWidth, height: 3, background: accentColor, marginBottom: 20, borderRadius: 2 }} />
          )}
          <h1 style={{
            color, fontSize, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1,
            transform: `translateY(${anim.y || 0}px) scale(${anim.scale || 1})`,
            opacity: anim.opacity,
            textShadow: `0 0 40px ${accentColor}44`,
          }}>{displayTitle}</h1>
          {subtitle && (
            <p style={{ color: accentColor, fontSize: fontSize * 0.3, opacity: anim.subtitleOpacity, marginTop: 16, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{subtitle}</p>
          )}
        </>
      )}
    </div>
  );
};
