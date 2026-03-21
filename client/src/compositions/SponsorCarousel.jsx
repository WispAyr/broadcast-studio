import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const SponsorCarousel = ({ sponsors = '', intervalSec = 3, style = 'fade', background = 'transparent' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const urls = sponsors.split('\n').filter(Boolean);
  if (urls.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: background === 'transparent' ? 'transparent' : background }}>
        <span style={{ color: '#666', fontSize: 20 }}>Add sponsor logo URLs</span>
      </div>
    );
  }

  const framesPerSponsor = intervalSec * fps;
  const currentIndex = Math.floor(frame / framesPerSponsor) % urls.length;
  const localFrame = frame % framesPerSponsor;
  const transFrames = 15;

  const enterProgress = interpolate(localFrame, [0, transFrames], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const exitProgress = interpolate(localFrame, [framesPerSponsor - transFrames, framesPerSponsor], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const getStyle = () => {
    switch (style) {
      case 'slide':
        return {
          transform: `translateX(${interpolate(enterProgress, [0, 1], [100, 0])}%) translateX(${interpolate(exitProgress, [0, 1], [0, -100])}%)`,
          opacity: 1,
        };
      case 'zoom':
        return {
          transform: `scale(${interpolate(enterProgress, [0, 1], [0.5, 1])}) scale(${interpolate(exitProgress, [0, 1], [1, 0.5])})`,
          opacity: enterProgress * (1 - exitProgress),
        };
      case 'flip':
        return {
          transform: `perspective(600px) rotateY(${interpolate(enterProgress, [0, 1], [90, 0])}deg) rotateY(${interpolate(exitProgress, [0, 1], [0, -90])}deg)`,
          opacity: 1,
        };
      default: // fade
        return { opacity: enterProgress * (1 - exitProgress) };
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: background === 'transparent' ? 'transparent' : background,
    }}>
      <div style={{ ...getStyle(), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={urls[currentIndex]} alt="" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
      </div>
    </div>
  );
};
