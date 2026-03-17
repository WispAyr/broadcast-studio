import React, { useState, useEffect } from 'react';

export default function CountdownModule({ config = {} }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const targetTime = config.target ? new Date(config.target).getTime() : null;
    const durationMs = config.duration ? config.duration * 1000 : null;
    const startTime = Date.now();

    function update() {
      let ms;
      if (targetTime) {
        ms = targetTime - Date.now();
      } else if (durationMs) {
        ms = durationMs - (Date.now() - startTime);
      } else {
        ms = 0;
      }
      setRemaining(Math.max(0, ms));
    }

    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [config.target, config.duration]);

  if (remaining === null) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isExpired = remaining <= 0;
  const isWarning = !isExpired && totalSeconds < (config.warningAt || 60);

  const display = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{
        background: config.background || 'transparent',
        color: isExpired
          ? (config.expiredColor || '#ef4444')
          : isWarning
          ? (config.warningColor || '#f59e0b')
          : (config.color || '#ffffff')
      }}
    >
      {config.label && (
        <span className="text-sm mb-2 opacity-70">{config.label}</span>
      )}
      <span
        className="font-mono font-bold"
        style={{ fontSize: config.fontSize || '4rem' }}
      >
        {isExpired ? (config.expiredText || '00:00') : display}
      </span>
    </div>
  );
}
