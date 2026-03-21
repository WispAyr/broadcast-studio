import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const CountryNight = ({
  title = 'BOOTS N BEATS',
  subtitle = 'Country Night at Ayr Pavilion',
  date = 'Every Saturday',
  accentColor = '#d97706',
  background = '#1a0f00',
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  const titleSpring = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 80 } });
  const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(180deg, ${background}, #0d0800)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Rustic wood grain lines */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: `${i * 5.5}%`, height: 1,
          background: `linear-gradient(90deg, transparent 10%, ${accentColor}08 30%, ${accentColor}05 70%, transparent 90%)`,
        }} />
      ))}

      {/* Stars decoration */}
      <svg width="200" height="50" viewBox="0 0 200 50" style={{
        opacity: interpolate(frame, [5, 20], [0, 0.6], { extrapolateRight: 'clamp' }),
        marginBottom: 20,
      }}>
        {[0, 1, 2, 3, 4].map(i => {
          const cx = 20 + i * 40;
          return (
            <polygon key={i}
              points={`${cx},5 ${cx + 4},18 ${cx + 15},18 ${cx + 6},26 ${cx + 10},40 ${cx},32 ${cx - 10},40 ${cx - 6},26 ${cx - 15},18 ${cx - 4},18`}
              fill={accentColor} opacity={0.5 + Math.sin(t * 2 + i) * 0.3}
            />
          );
        })}
      </svg>

      {/* Guitar icon */}
      <div style={{
        fontSize: 80, marginBottom: 10,
        opacity: spring({ frame: frame - 5, fps, config: { damping: 14 } }),
      }}>
        🎸
      </div>

      {/* Main title */}
      <div style={{
        fontSize: 130, fontWeight: 900, color: accentColor,
        transform: `scale(${titleSpring})`, letterSpacing: 8,
        textShadow: `0 0 40px ${accentColor}60, 0 4px 0 #8B4513`,
      }}>
        {title}
      </div>

      {/* Decorative line */}
      <div style={{
        width: interpolate(frame, [15, 35], [0, 400], { extrapolateRight: 'clamp' }),
        height: 3, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        margin: '15px 0',
      }} />

      {/* Subtitle */}
      <div style={{
        opacity: subtitleOpacity, fontSize: 36, color: '#ffffff90',
        letterSpacing: 4, fontWeight: 300,
      }}>
        {subtitle}
      </div>

      {/* Date */}
      <div style={{
        opacity: subtitleOpacity, fontSize: 28, color: accentColor,
        marginTop: 20, padding: '8px 24px',
        border: `1px solid ${accentColor}40`, borderRadius: 4,
        letterSpacing: 6,
      }}>
        {date}
      </div>

      {/* Boot emoji accents */}
      <div style={{
        position: 'absolute', bottom: 40, left: 60, fontSize: 60, opacity: 0.15,
        transform: `rotate(-15deg)`,
      }}>👢</div>
      <div style={{
        position: 'absolute', bottom: 40, right: 60, fontSize: 60, opacity: 0.15,
        transform: `rotate(15deg) scaleX(-1)`,
      }}>👢</div>
    </div>
  );
};
