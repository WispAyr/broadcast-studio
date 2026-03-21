import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const TicketCTA = ({
  headline = 'GET YOUR TICKETS',
  eventName = 'BOOTS N BEATS',
  price = 'From £15',
  url = 'ayrpavilion.co.uk',
  urgency = 'LIMITED AVAILABILITY',
  accentColor = '#ef4444',
  background = '#000000',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainSpring = spring({ frame: frame - 5, fps, config: { damping: 10, stiffness: 80 } });
  const urgencyPulse = Math.sin(frame / 8) * 0.5 + 0.5;
  const shimmer = (frame * 4) % 600 - 100;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative',
    }}>
      {/* Animated bg pulse */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${accentColor}15, transparent 60%)`,
        transform: `scale(${1 + urgencyPulse * 0.3})`,
      }} />

      {/* Urgency banner */}
      <div style={{
        background: accentColor, padding: '10px 40px', borderRadius: 4,
        opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' }),
        transform: `scale(${0.9 + urgencyPulse * 0.1})`,
        marginBottom: 30, position: 'relative', zIndex: 1,
      }}>
        <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: 6 }}>{urgency}</span>
      </div>

      {/* Event name */}
      <div style={{
        fontSize: 48, color: '#ffffff60', fontWeight: 300, letterSpacing: 8,
        opacity: mainSpring, position: 'relative', zIndex: 1,
      }}>
        {eventName}
      </div>

      {/* Main headline */}
      <div style={{
        fontSize: 120, fontWeight: 900, color: '#fff', letterSpacing: 4,
        transform: `scale(${mainSpring})`, position: 'relative', zIndex: 1,
        overflow: 'hidden',
      }}>
        {headline}
        {/* Shimmer effect */}
        <div style={{
          position: 'absolute', top: 0, left: shimmer, width: 100, height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
        }} />
      </div>

      {/* Price */}
      <div style={{
        fontSize: 56, fontWeight: 700, color: accentColor, marginTop: 20,
        opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp' }),
        position: 'relative', zIndex: 1,
      }}>
        {price}
      </div>

      {/* URL */}
      <div style={{
        fontSize: 32, color: '#ffffff80', marginTop: 30,
        opacity: interpolate(frame, [45, 55], [0, 1], { extrapolateRight: 'clamp' }),
        padding: '12px 30px', border: '1px solid #ffffff30', borderRadius: 8,
        position: 'relative', zIndex: 1,
      }}>
        🎫 {url}
      </div>
    </div>
  );
};
