import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const QROverlay = ({
  url = 'ayrpavilion.co.uk',
  label = 'SCAN ME',
  subtitle = 'Book tickets online',
  accentColor = '#3b82f6',
  position = 'bottom-right',
  background = 'transparent',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const pulse = 0.95 + Math.sin(frame / 12) * 0.05;

  const posStyle = {
    'bottom-right': { bottom: 60, right: 60 },
    'bottom-left': { bottom: 60, left: 60 },
    'top-right': { top: 60, right: 60 },
    'top-left': { top: 60, left: 60 },
  }[position] || { bottom: 60, right: 60 };

  // Generate a simple QR-like pattern (decorative placeholder)
  const qrSize = 140;
  const cells = 11;
  const cellSize = qrSize / cells;

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        position: 'absolute', ...posStyle,
        opacity: slideIn, transform: `scale(${slideIn * pulse})`,
        background: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: 24,
        border: `2px solid ${accentColor}40`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: `0 0 30px rgba(0,0,0,0.5)`,
      }}>
        {/* QR placeholder */}
        <div style={{
          width: qrSize, height: qrSize, background: '#fff', borderRadius: 8, padding: 8,
          display: 'grid', gridTemplateColumns: `repeat(${cells}, 1fr)`, gap: 1,
        }}>
          {Array.from({ length: cells * cells }).map((_, i) => {
            const x = i % cells;
            const y = Math.floor(i / cells);
            // Corner finder patterns + pseudo random fill
            const isCorner = (x < 3 && y < 3) || (x >= cells - 3 && y < 3) || (x < 3 && y >= cells - 3);
            const isFilled = isCorner || ((x * 7 + y * 13 + 3) % 3 === 0);
            return (
              <div key={i} style={{
                background: isFilled ? '#000' : '#fff',
                borderRadius: 1,
              }} />
            );
          })}
        </div>

        <div style={{ color: accentColor, fontSize: 18, fontWeight: 800, letterSpacing: 4, marginTop: 12 }}>
          {label}
        </div>
        <div style={{ color: '#ffffff80', fontSize: 14, marginTop: 4 }}>
          {subtitle}
        </div>
        <div style={{ color: '#ffffff50', fontSize: 12, marginTop: 6 }}>
          {url}
        </div>
      </div>
    </div>
  );
};
