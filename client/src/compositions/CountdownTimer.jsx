import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const CountdownTimer = ({ targetTime = '', label = 'STARTING IN', color = '#ffffff', accentColor = '#ef4444', background = 'transparent', style = 'flip' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [remaining, setRemaining] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    if (!targetTime) return;
    const update = () => {
      let target;
      if (targetTime.includes(':') && !targetTime.includes('T')) {
        const [h, m] = targetTime.split(':').map(Number);
        target = new Date();
        target.setHours(h, m, 0, 0);
        if (target < new Date()) target.setDate(target.getDate() + 1);
      } else {
        target = new Date(targetTime);
      }
      const diff = Math.max(0, target - Date.now());
      setRemaining({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetTime]);

  const pad = (n) => String(n).padStart(2, '0');
  const pulse = Math.sin(frame / fps * Math.PI * 2) * 0.1 + 1;
  const isUrgent = remaining.h === 0 && remaining.m < 1;

  const digitStyle = (value) => {
    const base = {
      fontSize: 120, fontWeight: 900, fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      color: isUrgent ? accentColor : color,
      letterSpacing: '0.05em',
    };
    switch (style) {
      case 'flip':
        return { ...base, background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' };
      case 'radial':
        return { ...base, fontSize: 100 };
      case 'dramatic':
        return { ...base, fontSize: 160, textShadow: `0 0 40px ${isUrgent ? accentColor : color}44, 0 0 80px ${isUrgent ? accentColor : color}22` };
      default:
        return { ...base, fontSize: 90 };
    }
  };

  const renderRadialRing = (value, max, label) => {
    const pct = value / max;
    const r = 60;
    const circ = 2 * Math.PI * r;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width={140} height={140}>
          <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
          <circle cx={70} cy={70} r={r} fill="none" stroke={isUrgent ? accentColor : color} strokeWidth={4}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            transform="rotate(-90 70 70)" strokeLinecap="round" />
          <text x={70} y={75} textAnchor="middle" fill={isUrgent ? accentColor : color} fontSize={44} fontWeight="bold" fontFamily="'JetBrains Mono', monospace">{pad(value)}</text>
        </svg>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
      background: background === 'transparent' ? 'transparent' : background,
      fontFamily: "'Inter', sans-serif",
      transform: isUrgent ? `scale(${pulse})` : 'none',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{label}</span>

      {style === 'radial' ? (
        <div style={{ display: 'flex', gap: 32 }}>
          {renderRadialRing(remaining.h, 24, 'Hours')}
          {renderRadialRing(remaining.m, 60, 'Minutes')}
          {renderRadialRing(remaining.s, 60, 'Seconds')}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: style === 'flip' ? 12 : 4 }}>
          <span style={digitStyle()}>{pad(remaining.h)}</span>
          <span style={{ fontSize: 80, color: 'rgba(255,255,255,0.3)', fontWeight: 300 }}>:</span>
          <span style={digitStyle()}>{pad(remaining.m)}</span>
          <span style={{ fontSize: 80, color: 'rgba(255,255,255,0.3)', fontWeight: 300 }}>:</span>
          <span style={digitStyle()}>{pad(remaining.s)}</span>
        </div>
      )}
    </div>
  );
};
