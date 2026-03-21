import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const DrinkMenu = ({
  title = 'BAR MENU',
  items = 'Pint of Lager — £5.50\nGin & Tonic — £7.00\nJack & Coke — £7.50\nHouse Wine — £6.00\nCocktail Special — £8.50',
  featuredDrink = '🍹 TONIGHT\'S SPECIAL: Boots n Beats Bourbon Sour — £9',
  accentColor = '#f59e0b',
  background = '#0c0a09',
  textColor = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drinks = items.split('\n').filter(Boolean);

  const titleSpring = spring({ frame, fps, config: { damping: 12 } });
  const featuredPulse = 0.85 + Math.sin(frame / 12) * 0.15;

  return (
    <div style={{
      width: '100%', height: '100%', background,
      fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {/* Decorative top line */}
      <div style={{
        width: interpolate(frame, [0, 20], [0, 600], { extrapolateRight: 'clamp' }),
        height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        marginBottom: 30,
      }} />

      {/* Title */}
      <div style={{
        fontSize: 80, fontWeight: 900, color: accentColor,
        letterSpacing: 12, opacity: titleSpring,
        transform: `scale(${titleSpring})`,
      }}>
        {title}
      </div>

      {/* Menu items */}
      <div style={{ marginTop: 50, width: '65%' }}>
        {drinks.map((drink, i) => {
          const delay = 15 + i * 8;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15 } });
          const parts = drink.split('—').map(p => p.trim());
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '16px 0', borderBottom: `1px solid ${accentColor}20`,
              opacity: s, transform: `translateY(${(1 - s) * 20}px)`,
            }}>
              <span style={{ color: textColor, fontSize: 36, fontWeight: 500 }}>{parts[0]}</span>
              <span style={{
                flex: 1, borderBottom: `1px dotted ${accentColor}30`,
                margin: '0 20px', height: 1, alignSelf: 'center',
              }} />
              <span style={{ color: accentColor, fontSize: 38, fontWeight: 700 }}>{parts[1] || ''}</span>
            </div>
          );
        })}
      </div>

      {/* Featured drink */}
      <div style={{
        marginTop: 50, padding: '18px 40px', borderRadius: 12,
        background: `${accentColor}20`, border: `2px solid ${accentColor}50`,
        transform: `scale(${featuredPulse})`,
        opacity: interpolate(frame, [60, 75], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        <span style={{ color: accentColor, fontSize: 30, fontWeight: 700 }}>{featuredDrink}</span>
      </div>
    </div>
  );
};
