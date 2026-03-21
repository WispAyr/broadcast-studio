import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const NARCountdown = ({
  showName = 'The Evening Show',
  minutes = 5,
  seconds = 0,
  promoText = 'With DJ Sarah — Music, Chat & Local News',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Total seconds counting down based on frame
  const totalSec = minutes * 60 + seconds;
  const elapsed = frame / fps;
  const remaining = Math.max(0, totalSec - elapsed);
  const dispMin = Math.floor(remaining / 60);
  const dispSec = Math.floor(remaining % 60);
  const minStr = String(dispMin).padStart(2, '0');
  const secStr = String(dispSec).padStart(2, '0');

  // Progress through countdown (0 to 1)
  const countProgress = totalSec > 0 ? 1 - (remaining / totalSec) : 0;

  // Color shift from orange to red as countdown progresses
  const hue = interpolate(countProgress, [0, 1], [30, 0]); // orange to red
  const urgencyColor = `hsl(${hue}, 85%, 50%)`;

  // "COMING UP" label
  const labelSpr = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });

  // Number digits entrance
  const numSpr = spring({ frame, fps, delay: Math.round(0.3 * fps), config: { damping: 12, stiffness: 70 } });
  const numScale = interpolate(numSpr, [0, 1], [0.5, 1]);

  // Show name
  const showSpr = spring({ frame, fps, delay: Math.round(0.6 * fps), config: { damping: 14, stiffness: 80 } });

  // Promo text
  const promoOp = interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });

  // Energy ring around numbers - pulsing
  const ringPulse = 0.6 + Math.sin(frame * 0.08) * 0.4;
  const ringRotation = frame * 0.5;

  // Particle burst on second change
  const currentSec = Math.floor(remaining);
  const secFrac = remaining - currentSec;
  const burstActive = secFrac > 0.9; // last 0.1s of each second
  const burstParticles = burstActive ? Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const dist = (1 - secFrac) * 80 / 0.1;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      op: secFrac,
      i,
    };
  }) : [];

  // Flip clock digit styling helper
  const FlipDigit = ({ digit, size = 100 }) => (
    <div style={{
      width: size * 0.7, height: size, position: 'relative',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      {/* Top half - lighter */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: size * 0.8, fontWeight: 900, color: '#ffffff',
          lineHeight: 1, transform: 'translateY(50%)',
          fontVariantNumeric: 'tabular-nums',
        }}>{digit}</span>
      </div>
      {/* Bottom half - darker */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: size * 0.8, fontWeight: 900, color: '#ffffff',
          lineHeight: 1, transform: 'translateY(-50%)',
          fontVariantNumeric: 'tabular-nums',
        }}>{digit}</span>
      </div>
      {/* Split line */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
        background: 'rgba(0,0,0,0.3)', transform: 'translateY(-1px)',
      }} />
      {/* Subtle reflection */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );

  const breathe = 1 + Math.sin(frame * 0.025) * 0.006;
  const grainSeed = Math.floor(frame * 1.5);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Warm ambient */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4 * exitOp,
        background: `radial-gradient(ellipse 80% 70% at 50% 45%, rgba(247,148,29,0.12) 0%, transparent 55%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 * exitOp,
        background: `radial-gradient(ellipse 60% 60% at 60% 55%, rgba(226,57,45,0.08) 0%, transparent 45%)`,
      }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Logo top-left */}
      <div style={{ position: 'absolute', top: 40, left: 50, opacity: 0.5 * exitOp }}>
        <img src="/brands/nar/logo-main.png" style={{ width: 90, height: 'auto' }} />
      </div>

      {/* "COMING UP" label */}
      <div style={{
        position: 'absolute', top: '18%', left: '50%',
        transform: `translateX(-50%) scale(${labelSpr})`,
        fontSize: 20, fontWeight: 800, letterSpacing: 8,
        background: 'linear-gradient(90deg, #F7941D, #E2392D)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        opacity: labelSpr * exitOp,
      }}>COMING UP</div>

      {/* Show name */}
      <div style={{
        position: 'absolute', top: '25%', left: '50%',
        transform: `translateX(-50%)`,
        fontSize: 52, fontWeight: 900, color: '#ffffff',
        opacity: showSpr * exitOp,
        textShadow: '0 4px 16px rgba(0,0,0,0.4)',
        textAlign: 'center', whiteSpace: 'nowrap',
      }}>{showName}</div>

      {/* Main countdown display */}
      <div style={{
        position: 'absolute', top: '42%', left: '50%',
        transform: `translate(-50%, -10%) scale(${numScale * breathe})`,
        display: 'flex', alignItems: 'center', gap: 16,
        opacity: numSpr * exitOp,
      }}>
        {/* Energy ring behind */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(-50%, -50%) rotate(${ringRotation}deg)`,
          width: 340, height: 340, borderRadius: '50%',
          border: `3px solid transparent`,
          backgroundImage: `conic-gradient(from 0deg, ${urgencyColor}00, ${urgencyColor}${Math.round(ringPulse * 180).toString(16).padStart(2, '0')}, ${urgencyColor}00)`,
          backgroundOrigin: 'border-box', backgroundClip: 'border-box',
          opacity: 0.5,
          boxShadow: `0 0 30px ${urgencyColor}33`,
        }} />

        {/* Burst particles */}
        {burstParticles.map(p => (
          <div key={p.i} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
            width: 4, height: 4, borderRadius: '50%',
            background: urgencyColor, opacity: p.op * 0.8,
            boxShadow: `0 0 8px ${urgencyColor}`,
          }} />
        ))}

        {/* Minutes */}
        <FlipDigit digit={minStr[0]} size={120} />
        <FlipDigit digit={minStr[1]} size={120} />

        {/* Colon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: 0.5 + Math.sin(frame * 0.15) * 0.5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
        </div>

        {/* Seconds */}
        <FlipDigit digit={secStr[0]} size={120} />
        <FlipDigit digit={secStr[1]} size={120} />
      </div>

      {/* Reflection below numbers */}
      <div style={{
        position: 'absolute', top: '68%', left: '50%',
        transform: 'translate(-50%, 0) scaleY(-1)',
        display: 'flex', gap: 16, opacity: 0.08 * exitOp,
        maskImage: 'linear-gradient(to bottom, black, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
        height: 60, overflow: 'hidden',
      }}>
        <div style={{ fontSize: 96, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: 8 }}>
          {minStr}:{secStr}
        </div>
      </div>

      {/* Promo text */}
      <div style={{
        position: 'absolute', bottom: '12%', left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 22, fontWeight: 400, color: 'rgba(255,255,255,0.6)',
        opacity: promoOp * exitOp, textAlign: 'center',
        maxWidth: 700,
      }}>{promoText}</div>

      {/* NAR branding */}
      <div style={{
        position: 'absolute', bottom: 30, right: 40,
        fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.2)',
        letterSpacing: 4, opacity: exitOp,
      }}>NOW AYRSHIRE RADIO</div>
    </div>
  );
};
