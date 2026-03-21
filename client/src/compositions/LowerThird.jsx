import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const LowerThird = ({ name = 'Speaker Name', title = 'Event Host', accentColor = '#3b82f6', style = 'modern', position = 'bottom-left' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterEnd = 20;
  const exitStart = durationInFrames - 20;
  const slideIn = interpolate(frame, [5, enterEnd], [-300, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const slideOut = frame > exitStart ? interpolate(frame, [exitStart, durationInFrames], [0, -300], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }) : 0;
  const opacity = interpolate(frame, [5, 15, exitStart, durationInFrames], [0, 1, 1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const barWidth = interpolate(frame, [0, enterEnd], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const posStyle = {
    'bottom-left': { bottom: 80, left: 60 },
    'bottom-right': { bottom: 80, right: 60 },
    'top-left': { top: 80, left: 60 },
    'top-right': { top: 80, right: 60 },
  }[position] || { bottom: 80, left: 60 };

  const renderStyle = () => {
    switch (style) {
      case 'minimal':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 4, height: 50, background: accentColor, borderRadius: 2, transform: `scaleY(${barWidth})` }} />
            <div>
              <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{name}</div>
              <div style={{ color: '#aaa', fontSize: 20, fontWeight: 400 }}>{title}</div>
            </div>
          </div>
        );
      case 'bold':
        return (
          <div style={{ background: accentColor, padding: '16px 32px', borderRadius: 4 }}>
            <div style={{ color: '#fff', fontSize: 36, fontWeight: 900, textTransform: 'uppercase' }}>{name}</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: 500, marginTop: 4 }}>{title}</div>
          </div>
        );
      case 'glassmorphism':
        return (
          <div style={{
            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 12, padding: '20px 32px', border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: `0 8px 32px ${accentColor}22`,
          }}>
            <div style={{ width: `${barWidth * 100}%`, height: 2, background: accentColor, borderRadius: 1, marginBottom: 12 }} />
            <div style={{ color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em' }}>{name}</div>
            <div style={{ color: accentColor, fontSize: 18, fontWeight: 500, letterSpacing: '0.05em', marginTop: 4 }}>{title}</div>
          </div>
        );
      default: // modern
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: accentColor, padding: '10px 24px', borderRadius: '6px 6px 0 0' }}>
              <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{name}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.75)', padding: '8px 24px', borderRadius: '0 0 6px 6px' }}>
              <div style={{ color: '#ddd', fontSize: 18, fontWeight: 500 }}>{title}</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: "'Inter', sans-serif" }}>
      <div style={{
        position: 'absolute', ...posStyle,
        transform: `translateX(${slideIn + slideOut}px)`,
        opacity,
      }}>
        {renderStyle()}
      </div>
    </div>
  );
};
