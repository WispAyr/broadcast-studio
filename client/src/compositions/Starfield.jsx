import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const Starfield = ({
  starCount = 200,
  speed = 1,
  color = '#ffffff',
  background = '#000000',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame / fps) * speed;

  const stars = useMemo(() => {
    return Array.from({ length: starCount }).map((_, i) => ({
      x: ((i * 7919 + 1234) % 10000) / 10000,
      y: ((i * 6271 + 5678) % 10000) / 10000,
      z: ((i * 3571 + 9012) % 10000) / 10000,
      size: 0.5 + ((i * 2347) % 1000) / 1000 * 2.5,
    }));
  }, [starCount]);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
    }}>
      {stars.map((star, i) => {
        const z = ((star.z - t * 0.15) % 1 + 1) % 1;
        const depth = 1 - z;
        const screenX = (star.x - 0.5) / (z * 0.8 + 0.2) * width + width / 2;
        const screenY = (star.y - 0.5) / (z * 0.8 + 0.2) * height + height / 2;
        const size = star.size * depth * 4;
        const opacity = depth * depth;
        const streak = speed > 1.5 ? depth * 15 * speed : 0;

        if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) return null;

        return (
          <div key={i} style={{
            position: 'absolute',
            left: screenX, top: screenY,
            width: size + streak, height: size,
            borderRadius: streak > 0 ? '50% / 50%' : '50%',
            background: color,
            opacity,
            boxShadow: depth > 0.7 ? `0 0 ${size * 2}px ${color}40` : 'none',
          }} />
        );
      })}
    </div>
  );
};
