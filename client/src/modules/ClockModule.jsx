import React, { useState, useEffect } from 'react';

export default function ClockModule({ config = {} }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const format = config.format || '24h';
  const showSeconds = config.showSeconds !== false;
  const showDate = config.showDate || false;
  const timezone = config.timezone || undefined;

  const options = {
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds && { second: '2-digit' }),
    hour12: format === '12h',
    ...(timezone && { timeZone: timezone })
  };

  const timeStr = time.toLocaleTimeString(undefined, options);
  const dateStr = time.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(timezone && { timeZone: timezone })
  });

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{
        background: config.background || 'transparent',
        color: config.color || '#ffffff'
      }}
    >
      <span
        className="font-mono font-bold"
        style={{ fontSize: config.fontSize || '3rem' }}
      >
        {timeStr}
      </span>
      {showDate && (
        <span className="text-gray-400 mt-2" style={{ fontSize: '1rem' }}>
          {dateStr}
        </span>
      )}
      {config.label && (
        <span className="text-gray-500 mt-1 text-sm">{config.label}</span>
      )}
    </div>
  );
}
