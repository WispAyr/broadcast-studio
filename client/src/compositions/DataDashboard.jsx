import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const DataDashboard = ({
  kpi1Label = 'Listeners', kpi1Value = 12847,
  kpi2Label = 'Requests', kpi2Value = 342,
  kpi3Label = 'Songs Played', kpi3Value = 1856,
  kpi4Label = 'Hours Live', kpi4Value = 4200,
  title = 'LIVE STATS',
  accentColor = '#00a8ff',
  background = '#0a1628',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Title
  const titleSpr = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });

  const kpis = [
    { label: kpi1Label, value: kpi1Value, trend: 'up', color: '#22c55e' },
    { label: kpi2Label, value: kpi2Value, trend: 'up', color: '#22c55e' },
    { label: kpi3Label, value: kpi3Value, trend: 'up', color: '#22c55e' },
    { label: kpi4Label, value: kpi4Value, trend: 'down', color: '#ef4444' },
  ];

  const kpiAnims = kpis.map((kpi, i) => {
    const delay = Math.round(0.4 * fps + i * 6);
    const spr = spring({ frame, fps, delay, config: { damping: 14, stiffness: 70 } });
    const countSpr = spring({ frame, fps, delay: delay + 5, config: { damping: 200, stiffness: 25 } });
    const displayVal = Math.round(kpi.value * countSpr);

    // SVG sparkline
    const sparkPoints = Array.from({ length: 20 }, (_, j) => {
      const y = 20 + Math.sin(j * 0.8 + i * 2) * 12 + Math.cos(j * 0.3 + i) * 8;
      return `${j * 6},${y}`;
    }).join(' ');

    // Stroke dashoffset animation
    const dashProgress = countSpr;

    return { ...kpi, spr, displayVal, sparkPoints, dashProgress, i };
  });

  const breathe = 1 + Math.sin(frame * 0.025) * 0.005;
  const grainSeed = Math.floor(frame * 1.3);

  // Grid background pattern
  const gridOp = 0.04 + Math.sin(frame * 0.03) * 0.01;

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Subtle grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: gridOp,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.25 * exitOp,
        background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${accentColor}18 0%, transparent 60%)`,
      }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)',
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

      {/* Title */}
      <div style={{
        position: 'absolute', top: 60, left: '50%',
        transform: `translateX(-50%) scale(${titleSpr})`,
        fontSize: 24, fontWeight: 800, letterSpacing: 8,
        color: accentColor, opacity: titleSpr * exitOp,
      }}>{title}</div>

      {/* Accent line under title */}
      <div style={{
        position: 'absolute', top: 100, left: '50%',
        transform: 'translateX(-50%)',
        width: interpolate(titleSpr, [0, 1], [0, 200]), height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        opacity: exitOp,
      }} />

      {/* 2x2 KPI grid */}
      <div style={{
        position: 'absolute', top: '18%', left: '50%',
        transform: `translate(-50%, 0) scale(${breathe})`,
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 28, width: 900,
      }}>
        {kpiAnims.map(k => (
          <div key={k.i} style={{
            transform: `scale(${interpolate(k.spr, [0, 1], [0.85, 1])})`,
            opacity: k.spr * exitOp,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 18, padding: '30px 36px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Background sparkline */}
            <svg style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, opacity: 0.15 }} viewBox="0 0 120 40" preserveAspectRatio="none">
              <polyline points={k.sparkPoints} fill="none" stroke={accentColor}
                strokeWidth="2" strokeDasharray="200"
                strokeDashoffset={interpolate(k.dashProgress, [0, 1], [200, 0])} />
            </svg>

            {/* Label */}
            <div style={{
              fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
              letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12,
            }}>{k.label}</div>

            {/* Large number */}
            <div style={{
              fontSize: 56, fontWeight: 900, color: '#ffffff',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              marginBottom: 8,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>{k.displayVal.toLocaleString()}</div>

            {/* Trend arrow */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                {k.trend === 'up' ? (
                  <path d="M8,2 L14,10 L10,10 L10,14 L6,14 L6,10 L2,10 Z" fill={k.color} />
                ) : (
                  <path d="M8,14 L14,6 L10,6 L10,2 L6,2 L6,6 L2,6 Z" fill={k.color} />
                )}
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: k.color }}>
                {k.trend === 'up' ? '+12.4%' : '-3.2%'}
              </span>
            </div>

            {/* Accent line top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, ${accentColor}, transparent)`,
              borderRadius: '18px 18px 0 0',
              opacity: 0.6,
            }} />
          </div>
        ))}
      </div>
    </div>
  );
};
