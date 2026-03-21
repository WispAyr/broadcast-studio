import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const ParallaxSlideshow = ({
  text1 = 'BROADCAST',
  text2 = 'STUDIO',
  text3 = 'LIVE',
  color1 = '#00a8ff',
  color2 = '#ff3366',
  color3 = '#FFD700',
  background = '#0a1628',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  const entrySpr = spring({ frame, fps, config: { damping: 200, stiffness: 30 } });

  // FAR LAYER — large geometric shapes, very slow drift
  const farShapes = Array.from({ length: 8 }, (_, i) => {
    const seed = i * 97.3;
    const baseX = (seed * 3.7) % 120 - 10;
    const baseY = (seed * 5.1) % 100;
    const size = 80 + (seed % 200);
    const isCircle = i % 2 === 0;
    const driftX = Math.sin(frame * 0.003 + i * 1.2) * 30; // very slow
    const driftY = Math.cos(frame * 0.002 + i * 0.8) * 20;
    const rotation = frame * 0.05 + i * 45;
    const colors = [color1, color2, color3];
    const color = colors[i % 3];
    return { x: baseX + driftX, y: baseY + driftY, size, isCircle, rotation, color, i };
  });

  // MID LAYER — scrolling text cards at medium speed
  const midTexts = [text1, text2, text3, text1, text2, text3];
  const midSpeed = frame * 1.2;
  const midAnims = midTexts.map((text, i) => {
    const startX = 2200 + i * 500;
    const x = ((startX - midSpeed) % (midTexts.length * 500 + 2200)) - 300;
    const y = 35 + (i % 3) * 20;
    return { text, x, y, i };
  });

  // NEAR LAYER — fast small bright particles
  const nearParticles = Array.from({ length: 50 }, (_, i) => {
    const seed = i * 73.7;
    const speed = 2 + (seed % 4);
    const x = ((seed * 11.3 + frame * speed) % 2200) - 100;
    const y = (seed * 7.1) % 100;
    const size = 2 + (seed % 3);
    const brightness = 0.4 + (seed % 6) * 0.1;
    const colors = [color1, color2, color3, '#ffffff'];
    const color = colors[i % 4];
    return { x, y, size, brightness, color, i };
  });

  // Gradient overlay
  const gradShift = Math.sin(frame * 0.008) * 10;

  const grainSeed = Math.floor(frame * 1.3);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* FAR layer — geometric shapes, blurred for depth */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: 0.15 * entrySpr * exitOp,
        filter: 'blur(6px)',
      }}>
        {farShapes.map(s => (
          <div key={s.i} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: s.isCircle ? '50%' : 8,
            border: `2px solid ${s.color}`,
            transform: `rotate(${s.rotation}deg)`,
            background: `${s.color}08`,
          }} />
        ))}
      </div>

      {/* MID layer — scrolling glass text cards */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: entrySpr * exitOp,
      }}>
        {midAnims.map(m => (
          <div key={m.i} style={{
            position: 'absolute',
            left: m.x, top: `${m.y}%`,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 12, padding: '16px 32px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
              letterSpacing: 6,
            }}>{m.text}</span>
          </div>
        ))}
      </div>

      {/* NEAR layer — fast bright particles */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: entrySpr * exitOp,
      }}>
        {nearParticles.map(p => (
          <div key={p.i} style={{
            position: 'absolute',
            left: p.x, top: `${p.y}%`,
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: p.brightness,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}88`,
          }} />
        ))}
      </div>

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.3,
        background: `linear-gradient(${135 + gradShift}deg, ${color1}15 0%, transparent 40%, ${color2}10 70%, transparent 100%)`,
      }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />
    </div>
  );
};
