import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const GlitchOverlay = ({
  intensity = 3,
  color1 = '#ff0000',
  color2 = '#00ffff',
  frequency = 2,
  background = 'transparent',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  // Glitch triggers at intervals
  const glitchCycle = t * frequency;
  const isGlitching = (glitchCycle % 3) < 0.3 || (glitchCycle % 7) < 0.15;
  const glitchAmount = isGlitching ? intensity : 0;

  // Pseudo-random from frame
  const rand = (seed) => ((seed * 9301 + 49297) % 233280) / 233280;

  const slices = isGlitching ? Array.from({ length: 8 }).map((_, i) => ({
    top: rand(frame * 31 + i * 7) * 100,
    height: 2 + rand(frame * 17 + i * 13) * 8,
    offsetX: (rand(frame * 23 + i * 11) - 0.5) * 40 * intensity,
  })) : [];

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
    }}>
      {/* RGB shift */}
      {isGlitching && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: color1, mixBlendMode: 'multiply',
            opacity: 0.1 * glitchAmount,
            transform: `translateX(${glitchAmount * 3}px)`,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: color2, mixBlendMode: 'multiply',
            opacity: 0.1 * glitchAmount,
            transform: `translateX(${-glitchAmount * 3}px)`,
          }} />
        </>
      )}

      {/* Slice displacement */}
      {slices.map((slice, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: `${slice.top}%`, height: `${slice.height}%`,
          background: `linear-gradient(90deg, ${color1}10 0%, transparent 30%, transparent 70%, ${color2}10 100%)`,
          transform: `translateX(${slice.offsetX}px)`,
        }} />
      ))}

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }} />

      {/* Static noise flash */}
      {isGlitching && (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05 * intensity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      )}
    </div>
  );
};
