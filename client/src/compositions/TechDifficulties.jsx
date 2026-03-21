import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const TechDifficulties = ({
  text = 'TECHNICAL DIFFICULTIES',
  subtitle = 'Please stand by — we\'ll be back shortly',
  accentColor = '#ef4444',
  background = '#111111',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  // Pseudo-random noise
  const rand = (s) => ((s * 9301 + 49297) % 233280) / 233280;

  // TV static effect - rows of random brightness
  const staticRows = 60;
  const showStatic = ((t * 3) % 5) < 0.4; // Periodic static bursts

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', overflow: 'hidden', position: 'relative',
    }}>
      {/* CRT scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.06,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.4) 3px, rgba(0,0,0,0.4) 6px)',
      }} />

      {/* Static noise burst */}
      {showStatic && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
          {Array.from({ length: staticRows }).map((_, i) => (
            <div key={i} style={{
              height: height / staticRows,
              background: `rgba(${rand(frame * 31 + i) > 0.5 ? 255 : 0},${rand(frame * 17 + i) > 0.5 ? 255 : 0},${rand(frame * 13 + i) > 0.5 ? 255 : 0},${rand(frame * 7 + i) * 0.3})`,
            }} />
          ))}
        </div>
      )}

      {/* Color bars (classic TV test pattern) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '15%',
        display: 'flex', opacity: 0.3,
      }}>
        {['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000'].map((c, i) => (
          <div key={i} style={{ flex: 1, background: c }} />
        ))}
      </div>

      {/* VCR tracking line */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: `${((t * 40) % 120) - 10}%`, height: 4,
        background: 'rgba(255,255,255,0.1)',
      }} />

      {/* Main content */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Warning icon */}
        <div style={{
          fontSize: 80, marginBottom: 20,
          animation: 'none',
          opacity: 0.5 + Math.sin(t * 4) * 0.5,
        }}>
          ⚠️
        </div>

        <div style={{
          fontSize: 72, fontWeight: 900, color: '#ffffff',
          letterSpacing: 6,
          textShadow: `${Math.sin(t * 20) * 2}px 0 ${accentColor}`,
        }}>
          {text}
        </div>

        <div style={{
          fontSize: 24, color: '#ffffff60', marginTop: 20, letterSpacing: 2,
        }}>
          {subtitle}
        </div>

        {/* Blinking REC indicator */}
        <div style={{
          marginTop: 40, display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: 'center', opacity: 0.5,
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: accentColor,
            opacity: Math.sin(t * 3) > 0 ? 1 : 0.2,
          }} />
          <span style={{ color: accentColor, fontSize: 18, letterSpacing: 3 }}>STANDBY</span>
        </div>
      </div>
    </div>
  );
};
