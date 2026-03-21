import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const WifiInfo = ({
  networkName = 'AyrPavilion-Guest',
  password = 'BootsNBeats2026',
  message = 'FREE WIFI',
  accentColor = '#22d3ee',
  background = '#0a0a0a',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainSpring = spring({ frame: frame - 5, fps, config: { damping: 12 } });
  const detailOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });
  const wavePhase = frame / 8;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* WiFi icon - animated signal arcs */}
      <div style={{
        position: 'relative', width: 120, height: 100, marginBottom: 30,
        opacity: mainSpring,
      }}>
        {[0, 1, 2].map(i => {
          const size = 40 + i * 35;
          const arcOpacity = 0.3 + (Math.sin(wavePhase + i * 0.8) * 0.5 + 0.5) * 0.7;
          return (
            <div key={i} style={{
              position: 'absolute', bottom: 10, left: '50%',
              width: size, height: size, borderRadius: '50%',
              border: `3px solid ${accentColor}`,
              borderBottom: 'none', borderLeft: 'none', borderRight: 'none',
              transform: `translateX(-50%) rotate(-45deg)`,
              transformOrigin: 'bottom center',
              opacity: arcOpacity,
            }} />
          );
        })}
        <div style={{
          position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)',
          width: 12, height: 12, borderRadius: '50%', background: accentColor,
        }} />
      </div>

      {/* Message */}
      <div style={{
        fontSize: 60, fontWeight: 900, color: '#ffffff', letterSpacing: 8,
        transform: `scale(${mainSpring})`,
      }}>
        {message}
      </div>

      {/* Network details */}
      <div style={{ opacity: detailOpacity, marginTop: 40, textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#ffffff40', fontSize: 18, letterSpacing: 4, marginBottom: 6 }}>NETWORK</div>
          <div style={{
            color: accentColor, fontSize: 42, fontWeight: 700, letterSpacing: 2,
            padding: '10px 30px', background: `${accentColor}10`, borderRadius: 8,
          }}>
            {networkName}
          </div>
        </div>
        <div>
          <div style={{ color: '#ffffff40', fontSize: 18, letterSpacing: 4, marginBottom: 6 }}>PASSWORD</div>
          <div style={{
            color: '#ffffff', fontSize: 48, fontWeight: 800, letterSpacing: 6,
            padding: '10px 30px', background: '#ffffff10', borderRadius: 8,
            fontFamily: 'monospace',
          }}>
            {password}
          </div>
        </div>
      </div>
    </div>
  );
};
