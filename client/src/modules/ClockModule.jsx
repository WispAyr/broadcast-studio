import React, { useState, useEffect } from 'react';

export default function ClockModule({ config = {} }) {
  const [time, setTime] = useState(new Date());
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setColonVisible(v => !v);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const format = config.format || '24h';
  const showSeconds = config.showSeconds !== false;
  const showDate = config.showDate || false;
  const timezone = config.timezone || undefined;
  const bg = config.background;
  const color = config.color || '#ffffff';

  const opts = { hour12: format === '12h', ...(timezone && { timeZone: timezone }) };
  const h = time.toLocaleString('en-GB', { hour: '2-digit', ...opts });
  const m = time.toLocaleString('en-GB', { minute: '2-digit', ...opts });
  const s = time.toLocaleString('en-GB', { second: '2-digit', ...opts });

  const dateStr = showDate ? time.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    ...(timezone && { timeZone: timezone })
  }) : '';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: bg || 'linear-gradient(145deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)', color }}>
      <style>{`
        @keyframes clockPulseGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(96,165,250,0.3), 0 0 60px rgba(96,165,250,0.1); }
          50% { text-shadow: 0 0 30px rgba(96,165,250,0.5), 0 0 80px rgba(96,165,250,0.2); }
        }
        @keyframes clockBgShift {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.25; }
        }
        .clock-digit {
          font-variant-numeric: tabular-nums;
          animation: clockPulseGlow 4s ease-in-out infinite;
        }
        .clock-colon {
          transition: opacity 0.15s ease;
        }
        .clock-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          animation: clockBgShift 8s ease-in-out infinite;
        }
      `}</style>

      {/* Background orbs */}
      <div className="clock-bg-orb" style={{ width: '200px', height: '200px', background: 'rgba(59,130,246,0.15)', top: '-50px', right: '-50px' }} />
      <div className="clock-bg-orb" style={{ width: '150px', height: '150px', background: 'rgba(139,92,246,0.1)', bottom: '-30px', left: '-30px', animationDelay: '4s' }} />

      {/* Time display */}
      <div className="relative z-10 flex items-baseline gap-0" style={{ fontSize: config.fontSize || '5rem' }}>
        <span className="clock-digit font-black">{h.padStart(2, '0')}</span>
        <span className="clock-digit font-black clock-colon" style={{ opacity: colonVisible ? 1 : 0.2, margin: '0 0.05em' }}>:</span>
        <span className="clock-digit font-black">{m.padStart(2, '0')}</span>
        {showSeconds && (
          <>
            <span className="clock-digit font-black clock-colon" style={{ opacity: colonVisible ? 1 : 0.2, fontSize: '0.6em', margin: '0 0.05em' }}>:</span>
            <span className="clock-digit font-black" style={{ fontSize: '0.6em', opacity: 0.6 }}>{s.padStart(2, '0')}</span>
          </>
        )}
      </div>

      {/* Date */}
      {showDate && (
        <div className="relative z-10 mt-3 text-sm uppercase tracking-[0.25em] font-medium opacity-40">
          {dateStr}
        </div>
      )}

      {/* Label */}
      {config.label && (
        <div className="relative z-10 mt-2 text-xs uppercase tracking-[0.3em] opacity-30 font-semibold">
          {config.label}
        </div>
      )}

      {/* Subtle bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.3), transparent)' }} />
    </div>
  );
}
