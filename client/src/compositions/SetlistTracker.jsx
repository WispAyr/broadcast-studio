import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const SetlistTracker = ({
  currentSong = 'Thunderstruck',
  currentArtist = 'AC/DC',
  nextSong = 'Sweet Home Alabama',
  nextArtist = 'Lynyrd Skynyrd',
  accentColor = '#22d3ee',
  background = 'transparent',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const pulse = Math.sin(frame / 10) * 0.5 + 0.5;
  const nextOpacity = interpolate(frame, [25, 40], [0, 0.7], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
      fontFamily: 'system-ui, sans-serif', padding: 60,
    }}>
      <div style={{
        transform: `translateX(${(1 - slideIn) * -400}px)`,
        opacity: slideIn,
      }}>
        {/* Now Playing */}
        <div style={{
          background: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: '24px 40px',
          borderLeft: `5px solid ${accentColor}`, minWidth: 500,
          boxShadow: `0 0 40px ${accentColor}30`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
          }}>
            {/* Animated equalizer bars */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 20 }}>
              {[0, 0.3, 0.6, 0.9].map((offset, i) => (
                <div key={i} style={{
                  width: 4, borderRadius: 2, background: accentColor,
                  height: 6 + Math.sin((frame / 4) + offset * 10) * 7 + 7,
                }} />
              ))}
            </div>
            <span style={{ color: accentColor, fontSize: 18, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>
              NOW PLAYING
            </span>
          </div>
          <div style={{ color: '#fff', fontSize: 48, fontWeight: 800 }}>{currentSong}</div>
          <div style={{ color: '#ffffff80', fontSize: 26, fontWeight: 400 }}>{currentArtist}</div>
        </div>

        {/* Next Up */}
        <div style={{
          opacity: nextOpacity, marginTop: 12, padding: '14px 40px',
          background: 'rgba(0,0,0,0.5)', borderRadius: 12, marginLeft: 20,
        }}>
          <span style={{ color: '#ffffff50', fontSize: 16, fontWeight: 600, letterSpacing: 2 }}>NEXT UP — </span>
          <span style={{ color: '#ffffff70', fontSize: 22 }}>{nextSong}</span>
          <span style={{ color: '#ffffff40', fontSize: 18 }}> · {nextArtist}</span>
        </div>
      </div>
    </div>
  );
};
