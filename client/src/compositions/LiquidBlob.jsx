import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const LiquidBlob = ({
  color1 = '#ff006a',
  color2 = '#8b5cf6',
  color3 = '#06b6d4',
  background = '#000000',
  speed = 1,
  blobCount = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * speed;

  const blobs = Array.from({ length: blobCount }).map((_, i) => {
    const phase = (i / blobCount) * Math.PI * 2;
    const colors = [color1, color2, color3];
    const x = 50 + Math.sin(t * 0.7 + phase) * 25;
    const y = 50 + Math.cos(t * 0.5 + phase * 1.3) * 25;
    const scale = 0.8 + Math.sin(t * 0.3 + i * 2) * 0.3;

    // Generate organic blob path using multiple sine waves
    const points = 8;
    const path = Array.from({ length: points }).map((_, p) => {
      const angle = (p / points) * Math.PI * 2;
      const r = 150 + Math.sin(angle * 3 + t * 2 + i) * 40 + Math.cos(angle * 2 - t * 1.5 + i) * 30;
      return `${Math.cos(angle) * r * scale},${Math.sin(angle) * r * scale}`;
    });

    return { x, y, path, color: colors[i % colors.length], phase };
  });

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
    }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: 'absolute' }}>
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -12" result="goo" />
          </filter>
        </defs>
        <g filter="url(#gooey)">
          {blobs.map((blob, i) => {
            const cx = (blob.x / 100) * 1920;
            const cy = (blob.y / 100) * 1080;
            const pts = blob.path.map((p, j) => {
              const [px, py] = p.split(',').map(Number);
              return [cx + px, cy + py];
            });
            // Create smooth closed path
            const d = pts.map((p, j) => (j === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ') + ' Z';
            return (
              <path key={i} d={d} fill={blob.color} opacity={0.7}>
              </path>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
