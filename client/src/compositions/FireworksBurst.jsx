import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const FireworksBurst = ({
  burstCount = 5,
  background = '#000005',
  colors = '#ff0040\n#00ff88\n#ffdd00\n#ff00ff\n#00ccff',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const colorList = colors.split('\n').filter(Boolean);

  const bursts = useMemo(() => {
    return Array.from({ length: burstCount }).map((_, i) => ({
      x: 0.2 + ((i * 3571) % 1000) / 1000 * 0.6,
      y: 0.2 + ((i * 7919) % 1000) / 1000 * 0.4,
      startFrame: i * 20 + ((i * 2347) % 15),
      particles: 40,
      color: colorList[i % colorList.length],
    }));
  }, [burstCount, colorList]);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
    }}>
      {bursts.map((burst, bi) => {
        const age = (frame - burst.startFrame) / fps;
        if (age < 0 || age > 3) return null;

        const cx = burst.x * width;
        const cy = burst.y * height;

        return (
          <React.Fragment key={bi}>
            {/* Launch trail */}
            {age < 0.4 && (
              <div style={{
                position: 'absolute',
                left: cx - 2, bottom: 0,
                width: 4, borderRadius: 2,
                height: interpolate(age, [0, 0.35], [0, height - cy], { extrapolateRight: 'clamp' }),
                background: `linear-gradient(to top, transparent, ${burst.color})`,
                opacity: interpolate(age, [0.3, 0.4], [1, 0], { extrapolateRight: 'clamp' }),
              }} />
            )}

            {/* Explosion particles */}
            {age >= 0.35 && Array.from({ length: burst.particles }).map((_, pi) => {
              const angle = (pi / burst.particles) * Math.PI * 2;
              const speed = 80 + ((pi * 131) % 100);
              const explosionAge = age - 0.35;
              const gravity = explosionAge * explosionAge * 120;
              const px = cx + Math.cos(angle) * speed * explosionAge;
              const py = cy + Math.sin(angle) * speed * explosionAge + gravity;
              const opacity = interpolate(explosionAge, [0, 0.8, 2], [1, 0.8, 0], { extrapolateRight: 'clamp' });
              const size = interpolate(explosionAge, [0, 1.5], [4, 1], { extrapolateRight: 'clamp' });

              return (
                <div key={pi} style={{
                  position: 'absolute', left: px, top: py,
                  width: size, height: size, borderRadius: '50%',
                  background: burst.color, opacity,
                  boxShadow: `0 0 ${size * 3}px ${burst.color}`,
                }} />
              );
            })}

            {/* Flash */}
            {age >= 0.35 && age < 0.5 && (
              <div style={{
                position: 'absolute', left: cx, top: cy,
                width: 200, height: 200, borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, ${burst.color}60, transparent)`,
                opacity: interpolate(age, [0.35, 0.5], [1, 0], { extrapolateRight: 'clamp' }),
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
