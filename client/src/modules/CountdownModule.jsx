import React, { useState, useEffect } from 'react';

export default function CountdownModule({ config = {} }) {
  const [remaining, setRemaining] = useState(null);
  const [flashPhase, setFlashPhase] = useState(false);
  const [showNow, setShowNow] = useState(false);

  useEffect(() => {
    const targetTime = config.target ? new Date(config.target).getTime() : null;
    const durationMs = config.duration ? config.duration * 1000 : null;
    const startTime = Date.now();
    function update() {
      let ms;
      if (targetTime) ms = targetTime - Date.now();
      else if (durationMs) ms = durationMs - (Date.now() - startTime);
      else ms = 0;
      setRemaining(Math.max(0, ms));
    }
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [config.target, config.duration]);

  // Flash effect when hitting zero
  useEffect(() => {
    if (remaining === 0 && !showNow) {
      setFlashPhase(true);
      setTimeout(() => { setFlashPhase(false); setShowNow(true); }, 1500);
    }
  }, [remaining, showNow]);

  if (remaining === null) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const isExpired = remaining <= 0;
  const isCritical = !isExpired && totalSeconds < 10;
  const isDanger = !isExpired && totalSeconds < 60;
  const isWarning = !isExpired && totalSeconds < 300;

  const accentColor = isExpired ? '#ef4444'
    : isCritical ? '#ef4444'
    : isDanger ? '#ef4444'
    : isWarning ? '#f59e0b'
    : '#ffffff';

  const glowColor = isExpired ? 'rgba(239,68,68,0.4)'
    : isCritical ? 'rgba(239,68,68,0.35)'
    : isDanger ? 'rgba(239,68,68,0.2)'
    : isWarning ? 'rgba(245,158,11,0.15)'
    : 'rgba(255,255,255,0.05)';

  const segments = hours > 0
    ? [{ v: hours, l: 'HRS' }, { v: minutes, l: 'MIN' }, { v: seconds, l: 'SEC' }]
    : [{ v: minutes, l: 'MIN' }, { v: seconds, l: 'SEC' }];

  const labelTop = config.labelTop || config.label || '';
  const labelBottom = config.labelBottom || '';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: config.background || 'linear-gradient(145deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)', color: config.color || '#ffffff' }}>
      <style>{`
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes countdownGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes flashBang {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes nowPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes celebrate {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes criticalPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .countdown-digit-box {
          ${isCritical ? 'animation: criticalPulse 0.5s ease-in-out infinite;' : ''}
          ${isDanger && !isCritical ? 'animation: countdownPulse 1s ease-in-out infinite;' : ''}
        }
      `}</style>

      {/* Flash overlay */}
      {flashPhase && (
        <div className="absolute inset-0 z-50 bg-white" style={{ animation: 'flashBang 1.5s ease-out forwards' }} />
      )}

      {/* Background glow */}
      <div className="absolute rounded-full" style={{
        width: '400px', height: '400px',
        background: glowColor,
        filter: 'blur(100px)',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        animation: isCritical ? 'countdownGlow 0.5s ease-in-out infinite' : 'countdownGlow 3s ease-in-out infinite',
      }} />

      {/* Top Label */}
      {labelTop && (
        <span className="relative z-10 text-sm uppercase tracking-[0.3em] font-bold opacity-50 mb-6"
          style={{ fontSize: 'clamp(0.7rem, 1.5vw, 1rem)' }}>{labelTop}</span>
      )}

      {/* Countdown or NOW */}
      {isExpired && showNow ? (
        <div className="relative z-10 flex flex-col items-center" style={{ animation: 'celebrate 0.6s ease-out' }}>
          <span className="font-black" style={{
            fontSize: config.fontSize || 'clamp(4rem, 15vw, 10rem)',
            color: '#22c55e',
            textShadow: '0 0 40px rgba(34,197,94,0.5), 0 0 80px rgba(34,197,94,0.3)',
            animation: 'nowPulse 2s ease-in-out infinite',
            lineHeight: 1,
          }}>
            {config.expiredText || 'NOW'}
          </span>
          {/* Celebration particles */}
          <div className="flex gap-2 mt-4 text-2xl">
            {'🎉✨🎊'.split('').map((e, i) => (
              <span key={i} style={{ animation: `celebrate 0.6s ease-out ${i * 0.15}s both` }}>{e}</span>
            ))}
          </div>
        </div>
      ) : isExpired ? (
        <div className="relative z-10" style={{ animation: 'criticalPulse 1s ease-in-out infinite' }}>
          <span className="font-black" style={{
            fontSize: config.fontSize || 'clamp(3rem, 12vw, 8rem)',
            color: accentColor,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
          }}>
            00:00
          </span>
        </div>
      ) : (
        <div className="relative z-10 flex items-center gap-3 md:gap-6 countdown-digit-box">
          {segments.map((seg, i) => (
            <React.Fragment key={seg.l}>
              {i > 0 && (
                <span className="font-light opacity-20" style={{
                  fontSize: 'clamp(1.5rem, 4vw, 3rem)', color: accentColor,
                  animation: isCritical ? 'criticalPulse 0.5s ease-in-out infinite' : undefined,
                }}>:</span>
              )}
              <div className="flex flex-col items-center">
                <div className="rounded-2xl px-3 md:px-6 py-2 md:py-4 relative"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${accentColor}22`,
                    boxShadow: `0 0 30px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  }}>
                  <span className="font-black" style={{
                    fontSize: config.fontSize || 'clamp(3rem, 10vw, 7rem)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    color: accentColor,
                    textShadow: `0 0 30px ${glowColor}`,
                    display: 'block',
                  }}>
                    {String(seg.v).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold opacity-30 mt-2">{seg.l}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Bottom Label */}
      {labelBottom && (
        <span className="relative z-10 text-sm uppercase tracking-[0.3em] font-bold opacity-50 mt-6"
          style={{ fontSize: 'clamp(0.7rem, 1.5vw, 1rem)' }}>{labelBottom}</span>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{
        background: `linear-gradient(90deg, transparent, ${accentColor}44, transparent)`
      }} />
    </div>
  );
}
