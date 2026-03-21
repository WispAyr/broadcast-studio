import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const PollResults = ({
  question = 'BEST ACT TONIGHT?',
  options = 'DJ Shadow — 45\nThe Headliners — 32\nMC Thunder — 18\nVocal Fire — 5',
  accentColor = '#8b5cf6',
  background = '#0a0a0a',
  textColor = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entries = options.split('\n').filter(Boolean).map(line => {
    const parts = line.split('—').map(p => p.trim());
    return { name: parts[0], votes: parseInt(parts[1]) || 0 };
  });
  const total = entries.reduce((s, e) => s + e.votes, 0) || 1;
  const sorted = [...entries].sort((a, b) => b.votes - a.votes);

  const barColors = [accentColor, '#22d3ee', '#f59e0b', '#ef4444', '#10b981'];

  return (
    <div style={{
      width: '100%', height: '100%', background,
      fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {/* Question */}
      <div style={{
        fontSize: 56, fontWeight: 900, color: textColor, letterSpacing: 4,
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        marginBottom: 50,
      }}>
        {question}
      </div>

      {/* Bars */}
      <div style={{ width: '75%' }}>
        {sorted.map((entry, i) => {
          const pct = (entry.votes / total) * 100;
          const delay = 15 + i * 10;
          const barWidth = interpolate(frame, [delay, delay + 30], [0, pct], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const opacity = interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const color = barColors[i % barColors.length];
          const isWinner = i === 0;

          return (
            <div key={i} style={{ marginBottom: 20, opacity }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginBottom: 6,
              }}>
                <span style={{
                  color: textColor, fontSize: 30, fontWeight: isWinner ? 800 : 500,
                }}>
                  {isWinner ? '👑 ' : ''}{entry.name}
                </span>
                <span style={{ color, fontSize: 30, fontWeight: 700 }}>
                  {Math.round(barWidth)}%
                </span>
              </div>
              <div style={{
                width: '100%', height: 36, background: '#ffffff10', borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${barWidth}%`, height: '100%', borderRadius: 8,
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  boxShadow: isWinner ? `0 0 20px ${color}60` : 'none',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total votes */}
      <div style={{
        marginTop: 30, color: '#ffffff40', fontSize: 22,
        opacity: interpolate(frame, [60, 75], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {total} total votes
      </div>
    </div>
  );
};
