import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

export const NARSocialFeed = ({
  platform = 'instagram',
  handle = '@NowAyrshireRadio',
  message = 'Tune in now for the best local music! 🎶 #NowAyrshireRadio',
  username = 'ListenerMike',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  const platformEmoji = { instagram: '📷', twitter: '🐦', facebook: '👍', tiktok: '🎵' }[platform] || '📱';

  // Card entrance
  const cardSpr = spring({ frame, fps, delay: Math.round(0.3 * fps), config: { damping: 12, stiffness: 70 } });
  const cardScale = interpolate(cardSpr, [0, 1], [0.85, 1]);

  // Username
  const userSpr = spring({ frame, fps, delay: Math.round(0.6 * fps), config: { damping: 14, stiffness: 90 } });

  // Message words staggered
  const msgWords = message.split(' ');
  const msgAnims = msgWords.map((word, i) => {
    const d = Math.round(0.8 * fps + i * 2);
    const op = interpolate(frame, [d, d + 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { word, op, i };
  });

  // Quote marks
  const quoteSpr = spring({ frame, fps, delay: Math.round(0.5 * fps), config: { damping: 16, stiffness: 60 } });

  // Floating hearts/likes - bezier paths
  const hearts = Array.from({ length: 12 }, (_, i) => {
    const startDelay = 1.2 * fps + i * 8;
    const pf = Math.max(0, frame - startDelay);
    const progress = Math.min(pf / (2 * fps), 1);
    const startX = 700 + (i % 3) * 60;
    const startY = 500;
    // Bezier curve upward with gentle horizontal drift
    const t = progress;
    const cpX = startX + Math.sin(i * 2.3) * 80;
    const endX = startX + Math.sin(i * 1.7) * 120;
    const endY = 100;
    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * (startY - 200) + t * t * endY;
    const op = interpolate(progress, [0, 0.1, 0.7, 1], [0, 1, 0.8, 0]);
    const scale = interpolate(progress, [0, 0.2, 1], [0.3, 1, 0.6]);
    const emoji = i % 3 === 0 ? '❤️' : i % 3 === 1 ? '🧡' : '🔥';
    return { x, y, op: op * exitOp, scale, emoji, i };
  });

  // Gradient border animation on card
  const borderAngle = frame * 1.2;

  // Light orbs
  const orbs = Array.from({ length: 4 }, (_, i) => {
    const ox = 50 + Math.sin(frame * 0.01 + i * 1.5) * 30;
    const oy = 50 + Math.cos(frame * 0.012 + i * 2) * 25;
    const colors = ['rgba(247,148,29,0.08)', 'rgba(226,57,45,0.06)', 'rgba(139,106,174,0.07)', 'rgba(142,216,232,0.06)'];
    return { x: ox, y: oy, color: colors[i], size: 200 + i * 80, i };
  });

  const breathe = 1 + Math.sin(frame * 0.03) * 0.006;
  const grainSeed = Math.floor(frame * 1.5);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Moving light orbs */}
      {orbs.map(o => (
        <div key={o.i} style={{
          position: 'absolute', left: `${o.x}%`, top: `${o.y}%`,
          transform: 'translate(-50%, -50%)',
          width: o.size, height: o.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color} 0%, transparent 60%)`,
          opacity: exitOp,
        }} />
      ))}

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)',
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

      {/* Platform icon large */}
      <div style={{
        position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
        fontSize: 60, opacity: interpolate(frame, [0.2 * fps, 0.5 * fps], [0, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exitOp,
      }}>{platformEmoji}</div>

      {/* Main glass card */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${cardScale * breathe})`,
        opacity: cardSpr * exitOp,
        width: 800, padding: '50px 60px',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Animated gradient border */}
        <div style={{
          position: 'absolute', inset: -1, borderRadius: 24, pointerEvents: 'none',
          background: `conic-gradient(from ${borderAngle}deg, transparent 0%, rgba(247,148,29,0.25) 15%, transparent 30%, rgba(226,57,45,0.2) 55%, transparent 70%, rgba(139,106,174,0.15) 85%, transparent 100%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          WebkitMaskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          maskComposite: 'exclude', WebkitMaskComposite: 'xor', padding: 1.5,
        }} />

        {/* Opening quote */}
        <div style={{
          fontSize: 80, fontWeight: 300, lineHeight: 0.5, marginBottom: 20,
          opacity: quoteSpr * 0.3,
          background: 'linear-gradient(135deg, #F7941D, #E2392D)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>"</div>

        {/* Message - word by word */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {msgAnims.map(w => (
            <span key={w.i} style={{
              fontSize: 32, fontWeight: 500, color: '#ffffff', lineHeight: 1.5,
              opacity: w.op * exitOp,
            }}>{w.word}</span>
          ))}
        </div>

        {/* Username with verified badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          opacity: userSpr * exitOp,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #F7941D, #E2392D)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff', fontWeight: 700,
          }}>{username.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
              {username}
              <span style={{ fontSize: 14 }}>✓</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{handle}</div>
          </div>
        </div>
      </div>

      {/* Floating hearts */}
      {hearts.map(h => (
        <div key={h.i} style={{
          position: 'absolute', left: h.x, top: h.y,
          fontSize: 24, opacity: h.op,
          transform: `scale(${h.scale})`,
        }}>{h.emoji}</div>
      ))}

      {/* Logo bottom-right */}
      <div style={{ position: 'absolute', bottom: 30, right: 40, opacity: 0.4 * exitOp }}>
        <img src="/brands/nar/logo-main.png" style={{ width: 80, height: 'auto' }} />
      </div>
    </div>
  );
};
