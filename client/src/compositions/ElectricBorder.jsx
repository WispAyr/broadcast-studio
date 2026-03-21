import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

// Seeded pseudo-random
const seededRandom = (seed) => {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const ElectricBorder = ({
  color = '#00a8ff',
  intensity = 5,
  background = 'transparent',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  const entrySpr = spring({ frame, fps, config: { damping: 200, stiffness: 40 } });

  const intNorm = intensity / 10; // 0 to 1

  // Generate lightning bolt SVG paths along each edge
  // Each frame gets slightly different paths for crackling effect
  const generateBoltPath = (startX, startY, endX, endY, segments, seed) => {
    const points = [{ x: startX, y: startY }];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = startX + (endX - startX) * t;
      const baseY = startY + (endY - startY) * t;
      // Perpendicular offset
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / len;
      const perpY = dx / len;
      const jitter = (seededRandom(seed + i * 7.3 + frame * 0.7) - 0.5) * 40 * intNorm;
      points.push({ x: baseX + perpX * jitter, y: baseY + perpY * jitter });
    }
    points.push({ x: endX, y: endY });
    return `M${points.map(p => `${p.x},${p.y}`).join(' L')}`;
  };

  // 4 edges with multiple bolts each
  const boltsPerEdge = Math.round(2 + intNorm * 3);
  const segments = 12;

  const edges = [
    { name: 'top', gen: (i) => generateBoltPath(i * (1920 / boltsPerEdge), 15, (i + 1) * (1920 / boltsPerEdge), 15, segments, i * 100 + 1) },
    { name: 'bottom', gen: (i) => generateBoltPath(i * (1920 / boltsPerEdge), 1065, (i + 1) * (1920 / boltsPerEdge), 1065, segments, i * 100 + 2) },
    { name: 'left', gen: (i) => generateBoltPath(15, i * (1080 / boltsPerEdge), 15, (i + 1) * (1080 / boltsPerEdge), segments, i * 100 + 3) },
    { name: 'right', gen: (i) => generateBoltPath(1905, i * (1080 / boltsPerEdge), 1905, (i + 1) * (1080 / boltsPerEdge), segments, i * 100 + 4) },
  ];

  const allBolts = edges.flatMap((edge, ei) =>
    Array.from({ length: boltsPerEdge }, (_, i) => ({
      path: edge.gen(i),
      key: `${ei}-${i}`,
    }))
  );

  // Random flicker/brightness variation
  const flicker = 0.6 + seededRandom(frame * 3.7) * 0.4;
  const flicker2 = 0.5 + seededRandom(frame * 5.1 + 100) * 0.5;

  // Corner nodes that pulse
  const corners = [
    { x: 15, y: 15 },
    { x: 1905, y: 15 },
    { x: 15, y: 1065 },
    { x: 1905, y: 1065 },
  ];
  const cornerPulse = 0.5 + Math.sin(frame * 0.12) * 0.5;

  // Multiple energy colors
  const color2 = '#ff3366';
  const color3 = '#8b5cf6';

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
    }}>
      {/* Inner vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        boxShadow: `inset 0 0 80px ${color}22, inset 0 0 160px ${color}11`,
        opacity: entrySpr * exitOp,
        pointerEvents: 'none',
      }} />

      {/* Lightning SVG overlay */}
      <svg style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        opacity: entrySpr * exitOp,
      }} viewBox="0 0 1920 1080">
        <defs>
          <filter id="elecGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="elecBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
          </filter>
        </defs>

        {/* Bloom layer */}
        <g filter="url(#elecBloom)" opacity={0.4 * flicker}>
          {allBolts.map(b => (
            <path key={`bloom-${b.key}`} d={b.path} fill="none" stroke={color} strokeWidth={4} />
          ))}
        </g>

        {/* Main bolts — primary color */}
        <g filter="url(#elecGlow)" opacity={flicker}>
          {allBolts.map(b => (
            <path key={`main-${b.key}`} d={b.path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
          ))}
        </g>

        {/* Secondary color bolts — offset frame for variety */}
        <g filter="url(#elecGlow)" opacity={flicker2 * 0.5}>
          {allBolts.slice(0, Math.floor(allBolts.length * 0.5)).map(b => {
            // Regenerate with different seed for color2
            const altPath = b.path.replace(/(\d+\.?\d*)/g, (m) => (parseFloat(m) + seededRandom(frame * 2.3 + parseFloat(m)) * 6 - 3).toFixed(1));
            return <path key={`sec-${b.key}`} d={altPath} fill="none" stroke={color2} strokeWidth={1.5} strokeLinecap="round" />;
          })}
        </g>

        {/* Corner nodes */}
        {corners.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={8 + cornerPulse * 4} fill={color} opacity={cornerPulse * 0.6} filter="url(#elecBloom)" />
            <circle cx={c.x} cy={c.y} r={4} fill="#ffffff" opacity={cornerPulse * 0.9} />
          </g>
        ))}
      </svg>

      {/* Subtle scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.02, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        backgroundSize: '100% 4px',
      }} />
    </div>
  );
};
