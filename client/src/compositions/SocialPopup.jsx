import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

const platformIcons = {
  instagram: { icon: '📸', gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' },
  twitter: { icon: '𝕏', gradient: 'linear-gradient(45deg, #1da1f2, #0d8ecf)' },
  facebook: { icon: 'f', gradient: 'linear-gradient(45deg, #1877f2, #0d65d9)' },
  tiktok: { icon: '♪', gradient: 'linear-gradient(45deg, #000, #25f4ee, #fe2c55)' },
  youtube: { icon: '▶', gradient: 'linear-gradient(45deg, #ff0000, #cc0000)' },
};

export const SocialPopup = ({ platform = 'instagram', handle = '@yourhandle', accentColor = '#e1306c', position = 'bottom-right' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterS = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const exitFrame = Math.max(0, frame - (durationInFrames - 20));
  const exitS = spring({ frame: exitFrame, fps, config: { damping: 15, stiffness: 200 } });

  const scale = interpolate(enterS, [0, 1], [0, 1]) * interpolate(exitS, [0, 1], [1, 0]);
  const slideX = interpolate(enterS, [0, 1], [50, 0]) + interpolate(exitS, [0, 1], [0, 50]);

  const p = platformIcons[platform] || platformIcons.instagram;

  const posStyle = {
    'bottom-left': { bottom: 60, left: 40 },
    'bottom-right': { bottom: 60, right: 40 },
    'top-left': { top: 60, left: 40 },
    'top-right': { top: 60, right: 40 },
    'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  }[position] || { bottom: 60, right: 40 };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: "'Inter', sans-serif" }}>
      <div style={{
        position: 'absolute', ...posStyle,
        transform: `${posStyle.transform || ''} scale(${scale}) translateX(${slideX}px)`.trim(),
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)',
        borderRadius: 60, padding: '12px 28px 12px 14px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${accentColor}33`,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: p.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: '#fff', fontWeight: 900,
        }}>{p.icon}</div>
        <span style={{
          color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em',
        }}>{handle}</span>
      </div>
    </div>
  );
};
