import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const GradientWave = ({ colors = '#667eea\n#764ba2\n#f093fb\n#f5576c', speed = 1, style = 'mesh' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorList = colors.split('\n').filter(Boolean);
  const t = (frame / fps) * speed;

  if (style === 'linear') {
    const angle = (t * 30) % 360;
    return (
      <div style={{
        width: '100%', height: '100%',
        background: `linear-gradient(${angle}deg, ${colorList.join(', ')})`,
        transition: 'background 0.1s',
      }} />
    );
  }

  if (style === 'radial') {
    const x = 50 + Math.sin(t) * 30;
    const y = 50 + Math.cos(t * 0.7) * 30;
    return (
      <div style={{
        width: '100%', height: '100%',
        background: `radial-gradient(circle at ${x}% ${y}%, ${colorList.join(', ')})`,
      }} />
    );
  }

  if (style === 'conic') {
    const angle = (t * 40) % 360;
    return (
      <div style={{
        width: '100%', height: '100%',
        background: `conic-gradient(from ${angle}deg, ${colorList.join(', ')}, ${colorList[0]})`,
      }} />
    );
  }

  // mesh — multiple overlapping radial gradients
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: colorList[0] || '#000' }}>
      {colorList.map((color, i) => {
        const phase = (i / colorList.length) * Math.PI * 2;
        const x = 50 + Math.sin(t + phase) * 40;
        const y = 50 + Math.cos(t * 0.7 + phase) * 40;
        const size = 60 + Math.sin(t * 0.5 + i) * 20;
        return (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle ${size}% at ${x}% ${y}%, ${color}cc, transparent)`,
            mixBlendMode: 'screen',
          }} />
        );
      })}
    </div>
  );
};
