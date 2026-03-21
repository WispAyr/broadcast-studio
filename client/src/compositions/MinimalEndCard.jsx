import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const MinimalEndCard = ({
  message = 'Thank you for listening',
  brandName = 'NOW AYRSHIRE RADIO',
  socialLine = '@NowAyrshireRadio',
  website = 'nowayrshireradio.com',
  style = 'elegant',
  accentColor = '#F7941D',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 1.2 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Fade to brand gradient at end
  const fadeToGrad = interpolate(frame, [exitStart - 0.5 * fps, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });

  // Blurred gradient background
  const bgShift1 = Math.sin(frame * 0.01) * 10;
  const bgShift2 = Math.cos(frame * 0.008) * 12;

  // Logo area entrance
  const logoSpr = spring({ frame, fps, config: { damping: 16, stiffness: 60 } });

  // "Thank You" with weight animation concept — using opacity trick
  const msgSpr = spring({ frame, fps, delay: Math.round(0.5 * fps), config: { damping: 14, stiffness: 60 } });
  const msgScale = interpolate(msgSpr, [0, 1], [0.9, 1]);
  // Simulated weight shift — thin to bold via two overlaid texts
  const thinOp = interpolate(frame, [0.5 * fps, 1.2 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const boldOp = interpolate(frame, [0.5 * fps, 1.2 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });

  // Thin accent lines drawing
  const line1Spr = spring({ frame, fps, delay: Math.round(0.8 * fps), config: { damping: 20, stiffness: 50 } });
  const line2Spr = spring({ frame, fps, delay: Math.round(1.0 * fps), config: { damping: 20, stiffness: 50 } });

  // Social handles slide in one by one
  const socials = [
    { icon: '📷', text: socialLine },
    { icon: '🌐', text: website },
  ];
  const socialAnims = socials.map((s, i) => {
    const spr = spring({ frame, fps, delay: Math.round(1.4 * fps + i * 8), config: { damping: 14, stiffness: 80 } });
    return { ...s, x: interpolate(spr, [0, 1], [60, 0]), op: spr, i };
  });

  // Micro-animations during hold — gentle float
  const floatY = frame > 2 * fps ? Math.sin(frame * 0.02) * 4 : 0;
  const floatY2 = frame > 2 * fps ? Math.sin(frame * 0.025 + 1) * 3 : 0;

  const grainSeed = Math.floor(frame * 1.3);
  const isVibrant = style === 'vibrant';

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Blurred gradient bg */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4 * exitOp,
        background: `radial-gradient(ellipse 80% 70% at ${50 + bgShift1}% ${45 + bgShift2}%, ${isVibrant ? 'rgba(247,148,29,0.2)' : 'rgba(247,148,29,0.1)'} 0%, transparent 55%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 * exitOp,
        background: `radial-gradient(ellipse 60% 60% at ${55 - bgShift2}% ${55 - bgShift1}%, rgba(226,57,45,0.08) 0%, transparent 45%)`,
      }} />

      {/* Fade to brand gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #F7941D, #E2392D)',
        opacity: fadeToGrad * 0.8,
      }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.5) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Logo */}
      <div style={{
        position: 'absolute', top: '25%', left: '50%',
        transform: `translate(-50%, ${floatY}px) scale(${interpolate(logoSpr, [0, 1], [0.7, 1])})`,
        opacity: logoSpr * exitOp,
      }}>
        <img src="/brands/nar/logo-main.png" style={{ width: 180, height: 'auto' }} />
      </div>

      {/* Brand name */}
      <div style={{
        position: 'absolute', top: '40%', left: '50%',
        transform: `translate(-50%, ${floatY}px)`,
        fontSize: 16, fontWeight: 800, letterSpacing: 8,
        color: 'rgba(255,255,255,0.5)',
        opacity: logoSpr * exitOp,
      }}>{brandName}</div>

      {/* Accent line 1 */}
      <div style={{
        position: 'absolute', top: '45%', left: '50%',
        transform: 'translateX(-50%)',
        width: interpolate(line1Spr, [0, 1], [0, 300]), height: 1,
        background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)`,
        opacity: exitOp,
      }} />

      {/* "Thank You" message with weight shift */}
      <div style={{
        position: 'absolute', top: '52%', left: '50%',
        transform: `translate(-50%, ${floatY2}px) scale(${msgScale})`,
        textAlign: 'center', opacity: exitOp,
      }}>
        {/* Thin version fading out */}
        <div style={{
          fontSize: 56, fontWeight: 200, color: '#ffffff',
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          opacity: thinOp * msgSpr, whiteSpace: 'nowrap',
          letterSpacing: 4,
        }}>{message}</div>
        {/* Bold version fading in */}
        <div style={{
          fontSize: 56, fontWeight: 700, color: '#ffffff',
          opacity: boldOp * msgSpr, whiteSpace: 'nowrap',
          letterSpacing: 2,
          textShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>{message}</div>
      </div>

      {/* Accent line 2 */}
      <div style={{
        position: 'absolute', top: '64%', left: '50%',
        transform: 'translateX(-50%)',
        width: interpolate(line2Spr, [0, 1], [0, 200]), height: 1,
        background: `linear-gradient(90deg, transparent, rgba(226,57,45,0.6), transparent)`,
        opacity: exitOp,
      }} />

      {/* Social handles */}
      <div style={{
        position: 'absolute', top: '70%', left: '50%',
        transform: `translate(-50%, ${floatY2}px)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        {socialAnims.map(s => (
          <div key={s.i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            opacity: s.op * exitOp,
            transform: `translateX(${s.x}px)`,
          }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <span style={{
              fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
              letterSpacing: 2,
            }}>{s.text}</span>
          </div>
        ))}
      </div>

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />
    </div>
  );
};
