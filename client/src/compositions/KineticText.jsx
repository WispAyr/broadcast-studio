import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const KineticText = ({ words = 'BOOTS\nAND\nBEATS', color = '#ffffff', accentColor = '#f59e0b', background = 'transparent', fontSize = 180, style = 'slam' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wordList = words.split('\n').filter(Boolean);
  const framesPerWord = Math.floor(durationInFrames / (wordList.length + 1));

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: background === 'transparent' ? 'transparent' : background,
      fontFamily: "'Inter', 'Impact', sans-serif", overflow: 'hidden',
    }}>
      {wordList.map((word, i) => {
        const start = i * framesPerWord;
        const isActive = frame >= start;
        const localFrame = frame - start;
        if (!isActive) return null;

        let transform = '', opacity = 1, textColor = color;
        const isAccent = i % 2 === 1;
        if (isAccent) textColor = accentColor;

        switch (style) {
          case 'slam': {
            const s = spring({ frame: localFrame, fps, config: { damping: 8, stiffness: 200 } });
            const scale = interpolate(s, [0, 1], [4, 1]);
            opacity = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            transform = `scale(${scale})`;
            break;
          }
          case 'wave': {
            const s = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 100 } });
            const y = interpolate(s, [0, 1], [200, 0]);
            const rotation = interpolate(s, [0, 1], [15, 0]);
            opacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            transform = `translateY(${y}px) rotate(${rotation}deg)`;
            break;
          }
          case 'rotate': {
            const s = spring({ frame: localFrame, fps, config: { damping: 10, stiffness: 150 } });
            const rot = interpolate(s, [0, 1], [90, 0]);
            opacity = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            transform = `rotateX(${rot}deg)`;
            break;
          }
          case 'glitch': {
            opacity = interpolate(localFrame, [0, 3], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            const glitchX = localFrame < 8 ? (Math.sin(localFrame * 13) * 10) : 0;
            const glitchY = localFrame < 8 ? (Math.cos(localFrame * 17) * 5) : 0;
            transform = `translate(${glitchX}px, ${glitchY}px)`;
            break;
          }
        }

        // Fade out previous word
        const fadeOut = i < wordList.length - 1
          ? interpolate(frame, [start + framesPerWord - 5, start + framesPerWord], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
          : 1;

        return (
          <div key={i} style={{
            position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: opacity * fadeOut, transform,
          }}>
            <span style={{
              fontSize, fontWeight: 900, color: textColor, letterSpacing: '-0.03em',
              textShadow: `0 0 60px ${textColor}66, 0 4px 20px rgba(0,0,0,0.5)`,
              textTransform: 'uppercase',
            }}>{word}</span>
          </div>
        );
      })}
    </div>
  );
};
