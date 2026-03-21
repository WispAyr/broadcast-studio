import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

// CSS-only weather icons
const SunIcon = ({ frame, size = 100 }) => {
  const rayRotation = frame * 0.5;
  const glowPulse = 0.6 + Math.sin(frame * 0.04) * 0.2;
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* Warmth glow */}
      <div style={{
        position: 'absolute', inset: -20, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(247,148,29,${glowPulse * 0.3}) 20%, transparent 70%)`,
      }} />
      {/* Rays */}
      {rays.map((angle, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%', width: 3, height: size * 0.38,
          background: 'linear-gradient(to top, rgba(247,148,29,0.6), transparent)',
          transformOrigin: '50% 0%',
          transform: `translate(-50%, 0) rotate(${angle + rayRotation}deg) translateY(-${size * 0.35}px)`,
          borderRadius: 2,
        }} />
      ))}
      {/* Sun body */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: size * 0.45, height: size * 0.45, borderRadius: '50%',
        background: 'linear-gradient(135deg, #F7941D 0%, #EF6830 50%, #E2392D 100%)',
        boxShadow: '0 0 30px rgba(247,148,29,0.5), 0 0 60px rgba(247,148,29,0.2)',
      }} />
    </div>
  );
};

const RainDrop = ({ x, delay, speed, frame }) => {
  const cycle = ((frame - delay) * speed * 0.8) % 100;
  const y = cycle;
  const op = interpolate(cycle, [0, 10, 80, 100], [0, 0.7, 0.7, 0]);
  return (
    <div style={{
      position: 'absolute', left: x, top: `${y}%`,
      width: 2, height: 12, borderRadius: 2,
      background: 'linear-gradient(to bottom, rgba(142,216,232,0.8), rgba(142,216,232,0.2))',
      opacity: op,
    }} />
  );
};

const CloudShape = ({ x, y, scale = 1, opacity = 0.8, drift = 0 }) => (
  <div style={{
    position: 'absolute', left: x + drift, top: y, transform: `scale(${scale})`, opacity,
  }}>
    <div style={{
      display: 'flex', position: 'relative',
    }}>
      <div style={{ width: 50, height: 35, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', position: 'absolute', left: 0, top: 10 }} />
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', position: 'absolute', left: 20, top: 0 }} />
      <div style={{ width: 55, height: 35, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', position: 'absolute', left: 40, top: 8 }} />
      <div style={{ width: 80, height: 20, borderRadius: 10, background: 'rgba(255,255,255,0.85)', position: 'absolute', left: 0, top: 25 }} />
    </div>
  </div>
);

export const NARWeather = ({
  temperature = '14',
  condition = 'Partly Cloudy',
  location = 'Ayr, Scotland',
  forecast = 'Mon 12°|Tue 14°|Wed 11°',
  background = '#1E2A35',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - 0.8 * fps;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const exitOp = 1 - exitP;

  // Temperature count-up
  const tempNum = parseInt(temperature) || 14;
  const tempSpr = spring({ frame, fps, delay: Math.round(0.5 * fps), config: { damping: 200, stiffness: 30 } });
  const displayTemp = Math.round(tempNum * tempSpr);

  // Condition text
  const condSpr = spring({ frame, fps, delay: Math.round(0.8 * fps), config: { damping: 14, stiffness: 80 } });

  // Location
  const locOp = interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });

  // Forecast cards
  const forecastItems = forecast.split('|').map(f => f.trim());
  const cardAnims = forecastItems.map((item, i) => {
    const s = spring({ frame, fps, delay: Math.round(1.4 * fps + i * 6), config: { damping: 12, stiffness: 90 } });
    const parts = item.split(' ');
    return { day: parts[0] || '', temp: parts[1] || '', scale: s, op: s, i };
  });

  // Cloud parallax drift
  const cloudDrift1 = Math.sin(frame * 0.008) * 20;
  const cloudDrift2 = Math.sin(frame * 0.006 + 1) * 15;

  // Rain drops for rainy conditions
  const isRainy = condition.toLowerCase().includes('rain') || condition.toLowerCase().includes('shower');
  const rainDrops = isRainy ? Array.from({ length: 20 }, (_, i) => ({
    x: 10 + (i * 37.7 % 80), delay: i * 3, speed: 0.8 + (i % 3) * 0.3, i,
  })) : [];

  const breathe = 1 + Math.sin(frame * 0.025) * 0.006;
  const grainSeed = Math.floor(frame * 1.4);

  return (
    <div style={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Warm ambient glow */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35 * exitOp,
        background: 'radial-gradient(ellipse 80% 70% at 30% 35%, rgba(247,148,29,0.15) 0%, transparent 55%)',
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.25 * exitOp,
        background: 'radial-gradient(ellipse 60% 60% at 70% 60%, rgba(139,106,174,0.1) 0%, transparent 45%)',
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

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
        backgroundSize: '100% 4px',
      }} />

      {/* Decorative clouds with parallax */}
      <CloudShape x={100} y={80} scale={1.2} opacity={0.15 * exitOp} drift={cloudDrift1} />
      <CloudShape x={1400} y={120} scale={0.9} opacity={0.12 * exitOp} drift={cloudDrift2} />
      <CloudShape x={800} y={60} scale={0.7} opacity={0.08 * exitOp} drift={-cloudDrift1 * 0.5} />

      {/* Rain drops if rainy */}
      {rainDrops.map(r => <RainDrop key={r.i} x={`${r.x}%`} delay={r.delay} speed={r.speed} frame={frame} />)}

      {/* Logo top-left */}
      <div style={{ position: 'absolute', top: 40, left: 50, opacity: 0.5 * exitOp }}>
        <img src="/brands/nar/logo-main.png" style={{ width: 90, height: 'auto' }} />
      </div>

      {/* "WEATHER" label */}
      <div style={{
        position: 'absolute', top: 48, left: 160,
        fontSize: 14, fontWeight: 800, letterSpacing: 6, opacity: 0.6 * exitOp,
        background: 'linear-gradient(90deg, #F7941D, #E2392D)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>WEATHER</div>

      {/* Main weather display */}
      <div style={{
        position: 'absolute', top: '25%', left: '10%',
        transform: `scale(${breathe})`, opacity: exitOp,
      }}>
        {/* Sun/weather icon */}
        <div style={{ marginBottom: 20 }}>
          <SunIcon frame={frame} size={120} />
        </div>
      </div>

      {/* Temperature + condition */}
      <div style={{
        position: 'absolute', top: '22%', left: '38%',
        opacity: exitOp,
      }}>
        {/* Location */}
        <div style={{
          fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
          letterSpacing: 3, marginBottom: 12, opacity: locOp,
        }}>{location}</div>

        {/* Big temperature */}
        <div style={{
          fontSize: 140, fontWeight: 900, lineHeight: 1, marginBottom: 8,
          background: 'linear-gradient(180deg, #ffffff 20%, rgba(255,255,255,0.7) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          fontVariantNumeric: 'tabular-nums',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
        }}>
          {displayTemp}°
        </div>

        {/* Condition */}
        <div style={{
          fontSize: 30, fontWeight: 400, color: 'rgba(255,255,255,0.8)',
          opacity: condSpr,
          transform: `translateX(${interpolate(condSpr, [0, 1], [-20, 0])}px)`,
        }}>{condition}</div>
      </div>

      {/* 3-day forecast cards */}
      <div style={{
        position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 24,
      }}>
        {cardAnims.map(c => (
          <div key={c.i} style={{
            transform: `scale(${interpolate(c.scale, [0, 1], [0.8, 1])})`,
            opacity: c.op * exitOp,
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 16, padding: '24px 40px',
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center', minWidth: 120,
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, marginBottom: 8 }}>{c.day}</div>
            <div style={{
              fontSize: 36, fontWeight: 800,
              background: 'linear-gradient(180deg, #F7941D, #E2392D)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{c.temp}</div>
          </div>
        ))}
      </div>

      {/* NAR branding */}
      <div style={{
        position: 'absolute', bottom: 30, right: 40,
        fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.2)',
        letterSpacing: 4, opacity: exitOp,
      }}>NOW AYRSHIRE RADIO</div>
    </div>
  );
};
