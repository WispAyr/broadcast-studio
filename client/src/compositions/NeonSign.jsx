import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const NeonSign = ({
  text = 'OPEN',
  color = '#ff00ff',
  secondaryColor = '#00ffff',
  background = '#0a0a0a',
  fontSize = 160,
  flickerSpeed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Flicker pattern - pseudo random based on frame
  const flicker1 = Math.sin(t * 30 * flickerSpeed) > 0.3 ? 1 : 0.4;
  const flicker2 = Math.sin(t * 47 * flickerSpeed + 1.5) > 0.1 ? 1 : 0.6;
  const mainFlicker = frame < 15 ? (frame % 4 < 2 ? 0.3 : 1) : flicker1 * flicker2;
  const glow = 0.7 + Math.sin(t * 3) * 0.3;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden',
    }}>
      {/* Wall texture */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 21px),
          repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 21px)`,
      }} />

      {/* Glow on wall */}
      <div style={{
        position: 'absolute', width: '70%', height: '50%',
        background: `radial-gradient(ellipse, ${color}${Math.round(mainFlicker * 20).toString(16).padStart(2, '0')}, transparent)`,
        filter: 'blur(60px)',
      }} />

      {/* Main text */}
      <div style={{
        fontSize, fontWeight: 900, color,
        opacity: mainFlicker,
        textShadow: `
          0 0 10px ${color},
          0 0 20px ${color},
          0 0 40px ${color},
          0 0 80px ${color}80,
          0 0 120px ${color}40
        `,
        letterSpacing: 12,
        position: 'relative',
      }}>
        {text}
      </div>
    </div>
  );
};
