import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const NARBreakingNews = ({
  headline = 'Major community event announced for Ayr seafront this summer',
  category = 'LOCAL NEWS',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Red flash on entry
  const flashOp = interpolate(frame, [0, 3, 8, 15], [0, 0.8, 0.4, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  // Camera shake (frames 8-18)
  const shakeActive = frame >= 8 && frame <= 18;
  const shakeX = shakeActive ? Math.sin(frame * 17.3) * (8 - (frame - 8) * 0.7) : 0;
  const shakeY = shakeActive ? Math.cos(frame * 13.7) * (6 - (frame - 8) * 0.5) : 0;

  // "BREAKING" stamp slams in
  const breakSpr = spring({ frame, fps, delay: 5, config: { damping: 8, stiffness: 200, mass: 0.6 } });
  const breakScale = interpolate(breakSpr, [0, 1], [3, 1]);
  const breakRotate = interpolate(breakSpr, [0, 1], [-5, 0]);

  // Pulsing red border
  const borderPulse = 0.5 + Math.sin(frame * 0.12) * 0.5;
  const borderOp = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Category tag
  const catSpr = spring({ frame, fps, delay: Math.round(0.6 * fps), config: { damping: 14, stiffness: 100 } });

  // Headline panel
  const panelSpr = spring({ frame, fps, delay: Math.round(0.8 * fps), config: { damping: 16, stiffness: 70 } });
  const panelY = interpolate(panelSpr, [0, 1], [60, 0]);

  // Headline words staggered
  const hWords = headline.split(' ');
  const hWordAnims = hWords.map((word, i) => {
    const d = Math.round(1.0 * fps + i * 2);
    const op = interpolate(frame, [d, d + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { word, op, i };
  });

  // Scrolling ticker at bottom
  const tickerText = `${category}: ${headline}  ●  NOW AYRSHIRE RADIO  ●  ${category}: ${headline}  ●  NOW AYRSHIRE RADIO  ●  `;
  const tickerX = -(frame * 3) % (tickerText.length * 10);

  // Alert icon - pulsing triangle
  const alertPulse = 0.7 + Math.sin(frame * 0.1) * 0.3;

  // Scanlines
  const scanOp = 0.04 + Math.sin(frame * 0.1) * 0.02;
  const grainSeed = Math.floor(frame * 1.3);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      transform: `translate(${shakeX}px, ${shakeY}px)`,
    }}>
      {/* Red flash overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle, rgba(226,57,45,0.8) 0%, rgba(226,57,45,0.4) 50%, transparent 80%)',
        opacity: flashOp, pointerEvents: 'none',
      }} />

      {/* Dark mesh */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4 * exitOp,
        background: `radial-gradient(ellipse 100% 80% at 50% 40%, rgba(226,57,45,0.15) 0%, transparent 55%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 * exitOp,
        background: `radial-gradient(ellipse 80% 100% at 30% 60%, rgba(247,148,29,0.1) 0%, transparent 50%)`,
      }} />

      {/* Pulsing red border */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        border: `3px solid rgba(226,57,45,${borderPulse * 0.8})`,
        boxShadow: `inset 0 0 40px rgba(226,57,45,${borderPulse * 0.15}), 0 0 20px rgba(226,57,45,${borderPulse * 0.1})`,
        opacity: borderOp * exitOp,
      }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 65% at 50% 50%, transparent 35%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.06,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: scanOp, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Logo top-right */}
      <div style={{ position: 'absolute', top: 40, right: 50, opacity: 0.5 * exitOp }}>
        <img src="/brands/nar/logo-main.png" style={{ width: 100, height: 'auto' }} />
      </div>

      {/* Alert icon */}
      <div style={{
        position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
        opacity: interpolate(frame, [0.3 * fps, 0.6 * fps], [0, alertPulse], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exitOp,
      }}>
        <svg width="50" height="45" viewBox="0 0 50 45">
          <path d="M25,2 L48,42 L2,42 Z" fill="none" stroke="#E2392D" strokeWidth="3" />
          <text x="25" y="36" textAnchor="middle" fill="#E2392D" fontSize="28" fontWeight="900">!</text>
        </svg>
      </div>

      {/* "BREAKING" stamp */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: `translate(-50%, -50%) scale(${breakScale}) rotate(${breakRotate}deg)`,
        opacity: breakSpr * exitOp,
      }}>
        <div style={{
          fontSize: 96, fontWeight: 900, letterSpacing: 16,
          background: 'linear-gradient(180deg, #F7941D 0%, #E2392D 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          textShadow: 'none',
          filter: `drop-shadow(0 0 30px rgba(226,57,45,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.6))`,
        }}>BREAKING</div>
      </div>

      {/* Category badge */}
      <div style={{
        position: 'absolute', top: '44%', left: '50%',
        transform: `translate(-50%, 0) scale(${catSpr})`,
        background: 'linear-gradient(90deg, #F7941D, #E2392D)', padding: '6px 24px', borderRadius: 4,
        opacity: catSpr * exitOp,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 4 }}>{category}</span>
      </div>

      {/* Headline glass panel */}
      <div style={{
        position: 'absolute', top: '52%', left: '50%', width: 1100,
        transform: `translate(-50%, ${panelY}px)`,
        opacity: panelSpr * exitOp,
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 16, padding: '30px 50px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {hWordAnims.map(w => (
            <span key={w.i} style={{
              fontSize: 40, fontWeight: 700, color: '#ffffff',
              opacity: w.op * exitOp, lineHeight: 1.3,
            }}>{w.word}</span>
          ))}
        </div>
      </div>

      {/* Scrolling ticker at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
        background: 'linear-gradient(90deg, #E2392D, #F7941D)',
        display: 'flex', alignItems: 'center', overflow: 'hidden',
        opacity: interpolate(frame, [1.5 * fps, 2 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exitOp,
      }}>
        <div style={{
          whiteSpace: 'nowrap', fontSize: 18, fontWeight: 700, color: '#ffffff',
          letterSpacing: 2, transform: `translateX(${tickerX}px)`,
        }}>
          {tickerText}{tickerText}
        </div>
      </div>

      {/* "BREAKING" small label in ticker */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: 50, width: 160,
        background: '#1E2A35', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: interpolate(frame, [1.5 * fps, 2 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exitOp,
        boxShadow: '4px 0 12px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#E2392D', letterSpacing: 4 }}>BREAKING</span>
      </div>
    </div>
  );
};
