import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const Scoreboard = ({
  title = 'QUIZ SCOREBOARD',
  teams = 'Team Whisky — 42\nTeam Irn Bru — 38\nTeam Haggis — 35\nTeam Nessie — 29',
  accentColor = '#f59e0b',
  background = '#0a0a0a',
  textColor = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entries = teams.split('\n').filter(Boolean).map(line => {
    const parts = line.split('—').map(p => p.trim());
    return { name: parts[0], score: parseInt(parts[1]) || 0 };
  });

  const titleOpacity = spring({ frame, fps, config: { damping: 12 } });

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      width: '100%', height: '100%', background,
      fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 64, fontWeight: 900, color: accentColor, letterSpacing: 6,
        opacity: titleOpacity, transform: `scale(${titleOpacity})`, marginBottom: 50,
      }}>
        {title}
      </div>

      <div style={{ width: '70%' }}>
        {entries.map((entry, i) => {
          const delay = 15 + i * 12;
          const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
          const isTop = i < 3;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '18px 30px', marginBottom: 10,
              background: i === 0 ? `${accentColor}15` : '#ffffff08',
              borderRadius: 12,
              border: i === 0 ? `2px solid ${accentColor}40` : '2px solid transparent',
              opacity: s, transform: `translateX(${(1 - s) * 60}px)`,
            }}>
              <span style={{ fontSize: 36, width: 50, textAlign: 'center' }}>
                {medals[i] || `${i + 1}.`}
              </span>
              <span style={{
                flex: 1, fontSize: 36, fontWeight: 600, color: textColor,
              }}>
                {entry.name}
              </span>
              <span style={{
                fontSize: 48, fontWeight: 900, color: i === 0 ? accentColor : textColor,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {entry.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
