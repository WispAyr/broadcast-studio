import React, { useState, useEffect, useRef } from 'react';

export default function ClockTally({ screensOnline = 0, blackoutActive = false }) {
  const [time, setTime] = useState(new Date());
  const [showStarted, setShowStarted] = useState(null);
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now);
      if (showStarted) {
        const diff = now - showStarted;
        const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
        setElapsed(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showStarted]);

  const isLive = screensOnline > 0 && !blackoutActive;

  return (
    <div className="flex items-center gap-3">
      {/* Event timer */}
      <button
        onClick={() => setShowStarted(showStarted ? null : new Date())}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all ${
          showStarted ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-gray-800 text-gray-500 hover:text-gray-400'
        }`}
        title={showStarted ? 'Click to reset timer' : 'Click to start show timer'}
      >
        <span>⏱</span>
        <span>{showStarted ? elapsed : '00:00:00'}</span>
      </button>

      {/* On Air tally */}
      {isLive && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded-lg animate-pulse shadow-lg shadow-red-600/40">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span className="text-white text-xs font-bold uppercase tracking-wider">On Air</span>
        </div>
      )}

      {/* Live clock */}
      <div className="text-white font-mono text-sm bg-gray-800/80 px-3 py-1 rounded-lg border border-gray-700/50">
        {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}
