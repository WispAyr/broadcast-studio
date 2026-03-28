import React from 'react';

const FONT_MAP = {
  '1994 Stencil (Black Ops One)': "'Black Ops One', sans-serif",
  'Inter': 'Inter, sans-serif',
  'Roboto': 'Roboto, sans-serif',
  'Montserrat': 'Montserrat, sans-serif',
  'Oswald': 'Oswald, sans-serif',
  'Poppins': 'Poppins, sans-serif',
  'Bebas Neue': "'Bebas Neue', sans-serif",
  'Raleway': 'Raleway, sans-serif',
  'Playfair Display': "'Playfair Display', serif",
  'Anton': 'Anton, sans-serif',
  'Bangers': 'Bangers, cursive',
  'Russo One': "'Russo One', sans-serif",
  'Orbitron': 'Orbitron, sans-serif',
  'Rajdhani': 'Rajdhani, sans-serif',
  'Teko': 'Teko, sans-serif',
  'Permanent Marker': "'Permanent Marker', cursive",
  'Press Start 2P': "'Press Start 2P', monospace",
  'Audiowide': 'Audiowide, sans-serif',
  'Righteous': 'Righteous, sans-serif',
};

const MOTION_CSS = {
  none: '',
  pulse: `@keyframes textPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }`,
  breathe: `@keyframes textBreathe { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }`,
  fadeIn: `@keyframes textFadeIn { from { opacity: 0; } to { opacity: 1; } }`,
  slideUp: `@keyframes textSlideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }`,
  slideDown: `@keyframes textSlideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }`,
  slideLeft: `@keyframes textSlideLeft { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }`,
  slideRight: `@keyframes textSlideRight { from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); } }`,
  scaleIn: `@keyframes textScaleIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }`,
  typewriter: `@keyframes textTypewriter { from { max-width: 0; } to { max-width: 100%; } }`,
  glitch: `@keyframes textGlitch { 0%,100% { transform: translate(0); } 20% { transform: translate(-2px, 1px); } 40% { transform: translate(2px, -1px); } 60% { transform: translate(-1px, -2px); } 80% { transform: translate(1px, 2px); } }`,
  glow: `@keyframes textGlow { 0%,100% { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor; } 50% { text-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor; } }`,
};

function getMotionStyle(motion, speed) {
  const speeds = { slow: '3s', normal: '1.5s', fast: '0.6s' };
  const dur = speeds[speed] || speeds.normal;
  const looping = ['pulse', 'breathe', 'glitch', 'glow'];
  const iter = looping.includes(motion) ? 'infinite' : '1';
  const name = {
    pulse: 'textPulse', breathe: 'textBreathe', fadeIn: 'textFadeIn',
    slideUp: 'textSlideUp', slideDown: 'textSlideDown', slideLeft: 'textSlideLeft',
    slideRight: 'textSlideRight', scaleIn: 'textScaleIn', typewriter: 'textTypewriter',
    glitch: 'textGlitch', glow: 'textGlow',
  }[motion];
  if (!name) return {};
  return { animation: `${name} ${dur} ease-out ${iter}` };
}

export default function TextModule({ config = {} }) {
  const text = config.text || config.content || '';
  const subtitle = config.subtitle || '';
  const align = config.align || 'center';
  const vertAlign = config.vertAlign || 'center';
  const style = config.style || 'default';
  const bg = config.background;
  const color = config.color || '#ffffff';
  const accentColor = config.accentColor || '#3b82f6';
  const fontFamily = FONT_MAP[config.fontFamily] || config.fontFamily || 'inherit';
  const motion = config.motion || 'none';
  const motionSpeed = config.motionSpeed || 'normal';
  const motionStyle = getMotionStyle(motion, motionSpeed);
  const motionCss = MOTION_CSS[motion] || '';

  const textStyle = {
    fontSize: config.fontSize || '1.5rem',
    fontWeight: config.fontWeight || '700',
    fontFamily,
    letterSpacing: config.letterSpacing || '0',
    lineHeight: config.lineHeight || '1.2',
    wordSpacing: config.wordSpacing ? config.wordSpacing + 'px' : 'normal',
    textTransform: config.textTransform || 'none',
    textShadow: config.textShadow || 'none',
    WebkitTextStroke: config.strokeWidth ? `${config.strokeWidth}px ${config.stroke || '#000'}` : 'none',
  };

  // Lower-third broadcast style
  if (style === 'lower-third' || style === 'name-title') {
    return (
      <div className="w-full h-full flex flex-col justify-end relative overflow-hidden"
        style={{ background: bg || 'transparent' }}>
        <style>{`
          @keyframes lowerThirdSlide { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes lowerThirdAccent { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          ${motionCss}
        `}</style>
        <div className="relative" style={{ animation: 'lowerThirdSlide 0.5s ease-out forwards' }}>
          <div className="h-0.5" style={{ background: accentColor, transformOrigin: 'left', animation: 'lowerThirdAccent 0.3s ease-out 0.2s forwards', transform: 'scaleX(0)' }} />
          <div className="flex items-stretch">
            <div className="px-4 py-2.5 flex items-center" style={{ background: accentColor }}>
              <span style={{ ...textStyle, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)', ...motionStyle }}>
                {text}
              </span>
            </div>
            {subtitle && (
              <div className="px-4 py-2.5 flex items-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)' }}>
                <span className="text-white text-sm font-medium opacity-90" style={{ fontFamily }}>{subtitle}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Headline style
  if (style === 'headline') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden"
        style={{ background: bg || 'linear-gradient(145deg, #0a0e1a, #111827)', color }}>
        <style>{`
          @keyframes headlineFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          ${motionCss}
        `}</style>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.05), transparent 70%)' }} />
        <div className="relative z-10 text-center" style={{ animation: 'headlineFade 0.6s ease-out', ...motionStyle }}>
          <span style={{ ...textStyle, display: 'block', textAlign: align }}>
            {text}
          </span>
          {subtitle && (
            <span className="block mt-3 text-base font-medium opacity-50 uppercase tracking-[0.2em]" style={{ fontFamily }}>{subtitle}</span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}44, transparent)` }} />
      </div>
    );
  }

  // Default - full featured
  const vAlignMap = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
  const hAlignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const noSafeZone = config.noSafeZone === true || config.noSafeZone === 'true';

  return (
    <div className="w-full h-full flex"
      style={{
        background: bg || 'transparent',
        color,
        textAlign: align,
        alignItems: vAlignMap[vertAlign] || 'center',
        justifyContent: hAlignMap[align] || 'center',
        padding: noSafeZone ? 0 : (config.padding || '1rem'),
        overflow: config.overflow || (noSafeZone ? 'visible' : 'hidden'),
      }}>
      {motionCss && <style>{motionCss}</style>}
      <div style={motionStyle}>
        <span style={{ ...textStyle, whiteSpace: config.whiteSpace || 'nowrap' }}>
          {text}
        </span>
        {subtitle && (
          <p className="mt-1 opacity-50 text-sm" style={{ fontFamily }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
