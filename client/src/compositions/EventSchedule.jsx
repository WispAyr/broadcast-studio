import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const EventSchedule = ({
  title = 'TONIGHT\'S LINEUP',
  items = '9:00 PM — DJ Shadow\n10:00 PM — The Headliners\n11:00 PM — MC Thunder\n11:30 PM — Grand Finale',
  accentColor = '#f59e0b',
  textColor = '#ffffff',
  background = '#0a0a0a',
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const lines = items.split('\n').filter(Boolean);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [-40, 0], { extrapolateRight: 'clamp' });
  const lineUnderline = interpolate(frame, [10, 30], [0, 100], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Subtle animated bg lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          height: 1, background: `${accentColor}15`,
          top: `${15 + i * 14}%`,
        }} />
      ))}

      <div style={{
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        fontSize: 72, fontWeight: 900, color: accentColor,
        marginTop: 80, letterSpacing: 8, textAlign: 'center',
      }}>
        {title}
        <div style={{
          height: 4, background: accentColor, marginTop: 10,
          width: `${lineUnderline}%`, margin: '10px auto 0',
        }} />
      </div>

      <div style={{ marginTop: 60, width: '80%' }}>
        {lines.map((line, i) => {
          const delay = 20 + i * 12;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
          const opacity = interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const parts = line.split('—').map(p => p.trim());

          return (
            <div key={i} style={{
              opacity, transform: `translateX(${(1 - s) * 80}px)`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 30px', marginBottom: 12,
              background: `${accentColor}10`, borderLeft: `4px solid ${accentColor}`,
              borderRadius: 8,
            }}>
              <span style={{ color: accentColor, fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {parts[0]}
              </span>
              <span style={{ color: textColor, fontSize: 40, fontWeight: 600, letterSpacing: 2 }}>
                {parts[1] || ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
