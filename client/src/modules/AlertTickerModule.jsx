import React, { useState, useEffect } from 'react';

const MOCK_ALERTS = [
  { id: 1, text: 'WEATHER WARNING: Yellow warning for rain across Ayrshire until 18:00', severity: 'warning' },
  { id: 2, text: 'TRAFFIC: A78 closed between Troon and Irvine due to accident. Seek alternative routes.', severity: 'critical' },
  { id: 3, text: 'EVENT: Ayr Racecourse gates open at 12:00 - expect heavy traffic on A79', severity: 'info' },
  { id: 4, text: 'SCHOOL: Ayr Academy closed today due to heating fault', severity: 'warning' },
  { id: 5, text: 'FERRY: CalMac services running normally from Ardrossan', severity: 'info' },
];

const severityStyles = {
  critical: { bg: '#dc2626', color: '#ffffff', icon: '\u26a0' },
  warning: { bg: '#d97706', color: '#ffffff', icon: '\u26a0' },
  info: { bg: '#2563eb', color: '#ffffff', icon: '\u2139' },
};

export default function AlertTickerModule({ config = {} }) {
  const alerts = config.alerts || config.items || MOCK_ALERTS;
  const speed = config.speed || 30;
  const bg = config.background || '#1e1e1e';
  const mode = config.mode || 'scroll'; // 'scroll' or 'cycle'
  const cycleSpeed = config.cycleSpeed || 5000;

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (mode !== 'cycle' || alerts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length);
    }, cycleSpeed);
    return () => clearInterval(timer);
  }, [mode, cycleSpeed, alerts.length]);

  if (mode === 'cycle') {
    const alert = alerts[currentIndex] || alerts[0];
    if (!alert) return null;
    const style = severityStyles[alert.severity] || severityStyles.info;

    return (
      <div
        className="w-full h-full flex items-center overflow-hidden"
        style={{ background: style.bg }}
      >
        <div className="flex items-center gap-3 px-4 w-full transition-all duration-500">
          <span className="text-lg shrink-0">{style.icon}</span>
          <p className="text-sm font-semibold" style={{ color: style.color }}>
            {alert.text}
          </p>
        </div>
      </div>
    );
  }

  // Scrolling mode
  const fullText = alerts.map((a) => {
    const style = severityStyles[a.severity] || severityStyles.info;
    return `${style.icon} ${a.text}`;
  }).join('     \u2022     ');

  return (
    <div
      className="w-full h-full flex items-center overflow-hidden"
      style={{ background: bg }}
    >
      <div
        className="whitespace-nowrap"
        style={{
          animation: `alert-scroll ${speed}s linear infinite`,
          color: '#ffffff',
          fontSize: config.fontSize || '1rem',
          fontWeight: 600,
        }}
      >
        <span>{fullText}</span>
        <span className="mx-12">{'\u2022'}</span>
        <span>{fullText}</span>
      </div>
      <style>{`
        @keyframes alert-scroll {
          0% { transform: translateX(50%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
