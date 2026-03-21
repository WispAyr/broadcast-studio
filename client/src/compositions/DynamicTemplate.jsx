import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

const ICON_PATHS = {
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  play: 'M5 3l14 9-14 9V3z',
  zap: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
};

function getEasing(type) {
  switch (type) {
    case 'easeIn': return Easing.in(Easing.cubic);
    case 'easeOut': return Easing.out(Easing.cubic);
    case 'easeInOut': return Easing.inOut(Easing.cubic);
    case 'bounce': return Easing.bounce;
    case 'spring': return Easing.out(Easing.back(1.7));
    default: return Easing.linear;
  }
}

function interpolateProperty(keyframes, frame, prop, easing) {
  const frameNums = Object.keys(keyframes).map(Number).sort((a, b) => a - b);
  const entries = frameNums.filter(f => keyframes[f]?.[prop] !== undefined);
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return keyframes[entries[0]][prop];

  const easingType = easing?.[prop] || easing?.default || 'linear';
  return interpolate(frame, entries, entries.map(f => keyframes[f][prop]), {
    easing: getEasing(easingType),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function DynamicElement({ element, frame }) {
  if (!element.visible) return null;

  const props = {};
  for (const p of ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'scale']) {
    const v = interpolateProperty(element.keyframes, frame, p, element.easing);
    if (v !== undefined) props[p] = v;
  }

  const { x = 0, y = 0, width = 100, height = 100, rotation = 0, opacity = 1, scale: s = 1 } = props;
  const st = element.style || {};

  const baseStyle = {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    transform: `rotate(${rotation}deg) scale(${s})`,
    opacity,
  };

  if (element.type === 'text') {
    const tc = element.textConfig || {};
    return (
      <div style={{
        ...baseStyle,
        color: st.fill || '#fff',
        fontFamily: tc.fontFamily || 'Inter',
        fontSize: tc.fontSize || 64,
        fontWeight: tc.fontWeight || 700,
        textAlign: tc.align || 'center',
        letterSpacing: tc.letterSpacing || 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: tc.align === 'left' ? 'flex-start' : tc.align === 'right' ? 'flex-end' : 'center',
        textShadow: st.shadow || 'none',
        filter: st.blur ? `blur(${st.blur}px)` : 'none',
      }}>
        {tc.content || ''}
      </div>
    );
  }

  if (element.type === 'shape') {
    const sc = element.shapeConfig || {};
    if (sc.shape === 'circle') {
      return <div style={{ ...baseStyle, borderRadius: '50%', background: st.fill || '#3b82f6', border: st.stroke ? `${st.strokeWidth || 2}px solid ${st.stroke}` : 'none' }} />;
    }
    if (sc.shape === 'triangle') {
      return (
        <div style={{ ...baseStyle }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="50,0 100,100 0,100" fill={st.fill || '#3b82f6'} />
          </svg>
        </div>
      );
    }
    return <div style={{ ...baseStyle, background: st.fill || '#3b82f6', borderRadius: st.borderRadius || 0, border: st.stroke ? `${st.strokeWidth || 2}px solid ${st.stroke}` : 'none' }} />;
  }

  if (element.type === 'image') {
    const ic = element.imageConfig || {};
    return (
      <div style={{ ...baseStyle, overflow: 'hidden', borderRadius: st.borderRadius || 0 }}>
        {ic.src && <img src={ic.src} style={{ width: '100%', height: '100%', objectFit: ic.fit || 'contain' }} />}
      </div>
    );
  }

  if (element.type === 'icon') {
    const iconName = element.iconConfig?.icon || 'star';
    return (
      <div style={{ ...baseStyle }}>
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={st.fill || '#fbbf24'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON_PATHS[iconName] || ICON_PATHS.star} />
        </svg>
      </div>
    );
  }

  if (element.type === 'gradient') {
    const gc = element.gradientConfig || { stops: [{ color: '#1a1a2e', pos: 0 }, { color: '#0f3460', pos: 100 }], angle: 135 };
    const grad = `linear-gradient(${gc.angle || 135}deg, ${gc.stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
    return <div style={{ ...baseStyle, background: grad }} />;
  }

  if (element.type === 'particles') {
    const pc = element.particleConfig || {};
    const count = Math.min(pc.count || 50, 200);
    const particles = useMemo(() => Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * (pc.speed || 2),
      vy: (Math.random() - 0.5) * (pc.speed || 2),
      size: (pc.size || 4) * (0.5 + Math.random()),
      phase: Math.random() * Math.PI * 2,
    })), [count, width, height, pc.speed, pc.size]);

    return (
      <div style={{ ...baseStyle, overflow: 'hidden' }}>
        {particles.map((p, i) => {
          const px = ((p.x + p.vx * frame) % width + width) % width;
          const py = ((p.y + p.vy * frame) % height + height) % height;
          return (
            <div key={i} style={{
              position: 'absolute',
              left: px,
              top: py,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: pc.color || '#ff6600',
              opacity: 0.3 + 0.7 * Math.abs(Math.sin(frame * 0.05 + p.phase)),
            }} />
          );
        })}
      </div>
    );
  }

  return null;
}

export default function DynamicTemplate({ elements = [], templateData }) {
  const frame = useCurrentFrame();
  const els = elements.length ? elements : (templateData?.elements || []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      {els.map(el => (
        <DynamicElement key={el.id} element={el} frame={frame} />
      ))}
    </div>
  );
}
