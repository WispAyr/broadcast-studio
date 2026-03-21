import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const MatrixRain = ({
  characters = 'アイウエオカキクケコサシスセソ0123456789ABCDEF',
  color = '#00ff41',
  background = '#000000',
  density = 30,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const charSize = 22;
  const cols = Math.min(density, Math.floor(width / charSize));
  const rows = Math.floor(height / charSize);
  const chars = characters.split('');

  const columns = useMemo(() => {
    return Array.from({ length: cols }).map((_, i) => ({
      x: (i / cols) * width + charSize / 2,
      speed: 0.5 + ((i * 7919) % 1000) / 1000 * 1.5,
      offset: ((i * 3571) % 1000) / 1000 * rows,
      length: 8 + ((i * 2347) % 20),
    }));
  }, [cols, width, rows]);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
    }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {columns.map((col, ci) => {
          const head = (col.offset + t * col.speed * speed * 8) % (rows + col.length);
          return Array.from({ length: col.length }).map((_, ri) => {
            const row = head - ri;
            if (row < 0 || row >= rows) return null;
            const charIdx = Math.floor(((ci * 31 + ri * 17 + frame * 3) % chars.length + chars.length) % chars.length);
            const opacity = ri === 0 ? 1 : Math.max(0, 1 - ri / col.length);
            const isHead = ri === 0;
            return (
              <text
                key={`${ci}-${ri}`}
                x={col.x} y={row * charSize + charSize}
                fill={isHead ? '#ffffff' : color}
                opacity={opacity}
                fontSize={charSize}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {chars[charIdx]}
              </text>
            );
          });
        })}
      </svg>
    </div>
  );
};
