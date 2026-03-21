import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const HashtagWall = ({
  hashtag = '#BootsNBeats',
  subtitle = 'Share your photos!',
  posts = 'Having an amazing time! 🎶\nBest night out in Ayr! 🔥\nThis DJ is incredible 🎧\nLoving the vibes tonight ✨\nAyr Pavilion goes OFF 🎉',
  accentColor = '#e1306c',
  background = '#0a0a0a',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const messages = posts.split('\n').filter(Boolean);
  const visibleIdx = Math.floor(frame / 60) % messages.length;

  const hashtagSpring = spring({ frame, fps, config: { damping: 12 } });
  const msgFade = interpolate(frame % 60, [0, 10, 50, 60], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const msgSlide = interpolate(frame % 60, [0, 10], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%', background,
      fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {/* Hashtag */}
      <div style={{
        fontSize: 110, fontWeight: 900, letterSpacing: 4,
        background: `linear-gradient(135deg, ${accentColor}, #f59e0b, ${accentColor})`,
        backgroundSize: '200% 200%',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        transform: `scale(${hashtagSpring})`,
      }}>
        {hashtag}
      </div>

      <div style={{
        fontSize: 28, color: '#ffffff50', letterSpacing: 4, marginTop: 10,
        opacity: interpolate(frame, [15, 25], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {subtitle}
      </div>

      {/* Post card */}
      <div style={{
        marginTop: 50, padding: '30px 50px', maxWidth: 800,
        background: '#ffffff10', borderRadius: 16, borderLeft: `4px solid ${accentColor}`,
        opacity: msgFade, transform: `translateY(${msgSlide}px)`,
      }}>
        <div style={{ color: '#ffffff', fontSize: 36, fontWeight: 500, lineHeight: 1.4 }}>
          "{messages[visibleIdx]}"
        </div>
        <div style={{ color: '#ffffff40', fontSize: 20, marginTop: 10 }}>
          — @guest{visibleIdx + 1}
        </div>
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', gap: 8, marginTop: 30 }}>
        {messages.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i === visibleIdx ? accentColor : '#ffffff20',
          }} />
        ))}
      </div>
    </div>
  );
};
