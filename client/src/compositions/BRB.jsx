import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const BRB = ({
  text = 'BE RIGHT BACK',
  subtitle = 'The show continues shortly',
  accentColor = '#6366f1',
  background = '#0a0a0a',
  style = 'geometric',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const textOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' });
  const breathe = 0.95 + Math.sin(t * 1.5) * 0.05;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Animated background pattern */}
      {style === 'geometric' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const cx = (i % 4) * (width / 3) + width / 6;
            const cy = Math.floor(i / 4) * (height / 2) + height / 4;
            const size = 100 + Math.sin(t + i) * 30;
            const rotation = t * 20 + i * 30;
            return (
              <rect key={i} x={cx - size / 2} y={cy - size / 2} width={size} height={size}
                fill="none" stroke={accentColor} strokeWidth="1"
                transform={`rotate(${rotation}, ${cx}, ${cy})`} />
            );
          })}
        </svg>
      )}

      {style === 'dots' && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08 }}>
          {Array.from({ length: 80 }).map((_, i) => {
            const x = ((i * 47) % 100);
            const y = ((i * 31) % 100);
            const s = 3 + Math.sin(t * 2 + i * 0.5) * 2;
            return (
              <div key={i} style={{
                position: 'absolute', left: `${x}%`, top: `${y}%`,
                width: s, height: s, borderRadius: '50%', background: accentColor,
              }} />
            );
          })}
        </div>
      )}

      {/* Main text */}
      <div style={{
        opacity: textOpacity, transform: `scale(${breathe})`, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 100, fontWeight: 900, color: '#ffffff', letterSpacing: 12,
          textShadow: `0 0 40px ${accentColor}40`,
        }}>
          {text}
        </div>
        <div style={{
          fontSize: 28, color: '#ffffff50', marginTop: 15, letterSpacing: 4,
        }}>
          {subtitle}
        </div>

        {/* Animated dots */}
        <div style={{ marginTop: 40, display: 'flex', gap: 12, justifyContent: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: '50%', background: accentColor,
              opacity: 0.3 + (Math.sin(t * 3 + i * 1.2) * 0.5 + 0.5) * 0.7,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
};
