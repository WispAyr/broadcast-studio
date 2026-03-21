import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const TextScramble = ({ text = 'COMING UP NEXT', color = '#22d3ee', background = 'transparent', fontSize = 100, scrambleChars = '!<>-_\\/[]{}—=+*^?#________' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chars = scrambleChars.split('');
  const revealDuration = text.length * 3;

  const randomChars = useMemo(() => {
    // Pre-generate random characters for consistency
    return Array.from({ length: text.length * 60 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    );
  }, [text, chars.join('')]);

  const displayText = useMemo(() => {
    return text.split('').map((char, i) => {
      const charRevealFrame = 10 + i * 2.5;
      if (frame >= charRevealFrame + 8) return char;
      if (frame < charRevealFrame - 5) return ' ';
      // Scrambling phase
      const idx = (i * 60 + frame) % randomChars.length;
      return randomChars[idx];
    }).join('');
  }, [frame, text, randomChars]);

  const opacity = interpolate(frame, [5, 12], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const glowPulse = Math.sin(frame / fps * 4) * 5 + 15;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: background === 'transparent' ? 'transparent' : background,
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <span style={{
        fontSize, fontWeight: 700, color, letterSpacing: '0.05em',
        opacity, textTransform: 'uppercase',
        textShadow: `0 0 ${glowPulse}px ${color}88, 0 0 ${glowPulse * 2}px ${color}44`,
      }}>{displayText}</span>
    </div>
  );
};
