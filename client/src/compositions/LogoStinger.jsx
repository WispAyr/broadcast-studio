import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const LogoStinger = ({ logoUrl = '', text = '', accentColor = '#3b82f6', background = '#000000', style = 'zoom-spin' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });
  const exitS = spring({ frame: Math.max(0, frame - (durationInFrames - 15)), fps, config: { damping: 15, stiffness: 200 } });
  const exitScale = interpolate(exitS, [0, 1], [1, 0.3]);
  const exitOpacity = interpolate(exitS, [0, 1], [1, 0]);

  const anims = {
    'zoom-spin': () => {
      const scale = interpolate(s, [0, 1], [0, 1]) * exitScale;
      const rotation = interpolate(s, [0, 1], [180, 0]);
      return { transform: `scale(${scale}) rotate(${rotation}deg)`, opacity: exitOpacity };
    },
    'glitch': () => {
      const opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }) * exitOpacity;
      const x = frame < 15 ? Math.sin(frame * 23) * 15 : 0;
      const y = frame < 15 ? Math.cos(frame * 19) * 8 : 0;
      return { transform: `translate(${x}px, ${y}px) scale(${exitScale})`, opacity };
    },
    'wipe': () => {
      const clip = interpolate(frame, [0, 20], [100, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
      return { clipPath: `inset(0 ${clip}% 0 0)`, opacity: exitOpacity, transform: `scale(${exitScale})` };
    },
    'shatter': () => {
      const scale = interpolate(s, [0, 1], [3, 1]) * exitScale;
      const blur = interpolate(s, [0, 1], [20, 0]);
      return { transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity: s * exitOpacity };
    },
  };

  const animStyle = (anims[style] || anims['zoom-spin'])();

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: background === 'transparent' ? 'transparent' : background,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Accent ring */}
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        border: `3px solid ${accentColor}`, opacity: 0.3,
        transform: `scale(${interpolate(s, [0, 1], [0.5, 1.5])})`,
      }} />
      <div style={{ ...animStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {logoUrl ? (
          <img src={logoUrl} style={{ width: 200, height: 200, objectFit: 'contain' }} alt="" />
        ) : (
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#fff' }}>{text?.[0] || '★'}</span>
          </div>
        )}
        {text && <span style={{ color: '#fff', fontSize: 36, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{text}</span>}
      </div>
    </div>
  );
};
