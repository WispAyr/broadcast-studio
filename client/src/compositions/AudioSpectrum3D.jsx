import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const AudioSpectrum3D = ({
  barCount = 32,
  color1 = '#00a8ff',
  color2 = '#ff3366',
  floorColor = '#111',
  background = '#000000',
  beatSpeed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Entrance
  const entrySpr = spring({ frame, fps, config: { damping: 200, stiffness: 30 } });

  const rows = 5;
  const cols = barCount;
  const t = frame * 0.05 * beatSpeed;

  // Generate bar heights — bass heavy, treble detailed
  const getBarHeight = (col, row) => {
    const bassWeight = 1 - (col / cols) * 0.6; // bass heavier on left
    const h1 = Math.sin(t * 2 + col * 0.3 + row * 0.5) * 0.5 + 0.5;
    const h2 = Math.cos(t * 1.5 + col * 0.2 - row * 0.3) * 0.3 + 0.5;
    const h3 = Math.sin(t * 3.5 + col * 0.6) * 0.2 + 0.3;
    const beat = Math.pow(Math.sin(t * 1.2) * 0.5 + 0.5, 2); // periodic beat
    return (h1 * h2 * bassWeight + h3 * beat) * 120 + 5;
  };

  // Color gradient over time
  const hueShift = Math.sin(frame * 0.01) * 20;

  // Grid lines on floor
  const gridLines = Array.from({ length: 20 }, (_, i) => {
    const z = (i / 20) * 100;
    const opacity = interpolate(z, [0, 100], [0.15, 0.02]);
    return { z, opacity, i };
  });

  const grainSeed = Math.floor(frame * 1.3);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 * exitOp,
        background: `radial-gradient(ellipse 80% 60% at 50% 80%, ${color1}20 0%, transparent 60%)`,
      }} />

      {/* 3D perspective container */}
      <div style={{
        position: 'absolute', inset: 0,
        perspective: 800, perspectiveOrigin: '50% 35%',
        opacity: entrySpr * exitOp,
      }}>
        {/* Floor plane */}
        <div style={{
          position: 'absolute', bottom: '10%', left: '5%', right: '5%', height: '55%',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(65deg)',
          transformOrigin: '50% 100%',
        }}>
          {/* Floor grid horizontal lines */}
          {gridLines.map(g => (
            <div key={g.i} style={{
              position: 'absolute', left: 0, right: 0,
              top: `${g.z}%`, height: 1,
              background: `linear-gradient(90deg, transparent, ${color1}${Math.round(g.opacity * 255).toString(16).padStart(2, '0')}, ${color2}${Math.round(g.opacity * 200).toString(16).padStart(2, '0')}, transparent)`,
            }} />
          ))}
          {/* Vertical grid */}
          {Array.from({ length: cols + 1 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(i / cols) * 100}%`, width: 1,
              background: `linear-gradient(180deg, ${color1}08, ${color1}18)`,
            }} />
          ))}
        </div>

        {/* Bar rows — back to front for proper z-ordering */}
        {Array.from({ length: rows }, (_, rowIdx) => {
          const row = rows - 1 - rowIdx; // render back rows first
          const depth = row / (rows - 1); // 0=front, 1=back
          const yOffset = 30 + depth * 30; // percentage from top
          const scale = 1 - depth * 0.4;
          const rowOpacity = 1 - depth * 0.3;

          return (
            <div key={row} style={{
              position: 'absolute',
              top: `${yOffset}%`, left: '8%', right: '8%',
              height: 200,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2,
              transform: `scale(${scale})`,
              opacity: rowOpacity,
              zIndex: rows - row,
            }}>
              {Array.from({ length: cols }, (_, col) => {
                const h = getBarHeight(col, row) * entrySpr;
                const colorProgress = col / cols;
                const barColor = `linear-gradient(to top, ${color1}, ${color2})`;
                const glowIntensity = h > 60 ? 0.5 : 0.2;

                return (
                  <div key={col} style={{
                    flex: 1, maxWidth: 20, height: h,
                    background: barColor,
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.85,
                    boxShadow: `0 -${Math.min(h * 0.1, 8)}px ${Math.min(h * 0.2, 16)}px ${color1}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')}`,
                  }} />
                );
              })}
            </div>
          );
        })}

        {/* Floor reflection — front row bars reflected */}
        <div style={{
          position: 'absolute',
          top: '62%', left: '8%', right: '8%',
          height: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 2,
          transform: 'scaleY(-0.4)',
          opacity: 0.12 * exitOp,
          maskImage: 'linear-gradient(to bottom, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          filter: 'blur(2px)',
        }}>
          {Array.from({ length: cols }, (_, col) => {
            const h = getBarHeight(col, 0) * entrySpr;
            return (
              <div key={col} style={{
                flex: 1, maxWidth: 20, height: h * 0.6,
                background: `linear-gradient(to top, ${color1}, ${color2})`,
                borderRadius: '2px 2px 0 0',
              }} />
            );
          })}
        </div>
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />
    </div>
  );
};
