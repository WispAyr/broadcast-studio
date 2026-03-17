import React, { useState, useEffect } from 'react';

const MOCK_TRAVEL = [
  { id: 1, type: 'road', route: 'A77 Southbound', status: 'delay', detail: 'Delays of 15 mins near Kilmarnock due to roadworks', severity: 'amber' },
  { id: 2, type: 'road', route: 'M77 Junction 4', status: 'clear', detail: 'All lanes running freely', severity: 'green' },
  { id: 3, type: 'rail', route: 'Ayr to Glasgow Central', status: 'delay', detail: 'Services running 10 mins late due to signal fault', severity: 'amber' },
  { id: 4, type: 'road', route: 'A78 Coast Road', status: 'incident', detail: 'Road closed between Troon and Irvine - accident. Expect diversions.', severity: 'red' },
  { id: 5, type: 'rail', route: 'Kilmarnock to Glasgow', status: 'clear', detail: 'Services running normally', severity: 'green' },
  { id: 6, type: 'ferry', route: 'Ardrossan to Brodick', status: 'clear', detail: 'Sailing on schedule', severity: 'green' },
];

const severityColors = {
  green: { bg: 'rgba(34,197,94,0.15)', border: '#22c55e', text: '#4ade80' },
  amber: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fbbf24' },
  red: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#f87171' },
};

const typeIcons = {
  road: '\ud83d\ude97',
  rail: '\ud83d\ude86',
  ferry: '\u26f4',
  bus: '\ud83d\ude8c',
};

export default function TravelModule({ config = {} }) {
  const items = config.items || MOCK_TRAVEL;
  const bg = config.background || 'transparent';
  const color = config.color || '#ffffff';
  const title = config.title || 'Travel Update';
  const autoScroll = config.autoScroll !== false;
  const scrollSpeed = config.scrollSpeed || 6000;

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!autoScroll || items.length <= 3) return;
    const timer = setInterval(() => {
      setOffset((prev) => (prev + 1) % items.length);
    }, scrollSpeed);
    return () => clearInterval(timer);
  }, [autoScroll, scrollSpeed, items.length]);

  const visible = [];
  for (let i = 0; i < Math.min(4, items.length); i++) {
    visible.push(items[(offset + i) % items.length]);
  }

  return (
    <div
      className="w-full h-full overflow-hidden p-3 flex flex-col"
      style={{ background: bg, color }}
    >
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <span>\ud83d\udea6</span> {title}
      </div>
      <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
        {visible.map((item) => {
          const sev = severityColors[item.severity] || severityColors.green;
          return (
            <div
              key={item.id}
              className="rounded px-3 py-2 border-l-3 transition-all duration-500"
              style={{
                background: sev.bg,
                borderLeft: `3px solid ${sev.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs">{typeIcons[item.type] || '\ud83d\udea6'}</span>
                <span className="text-xs font-bold" style={{ color: sev.text }}>
                  {item.route}
                </span>
                <span
                  className="text-xs ml-auto uppercase font-semibold"
                  style={{ color: sev.text }}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-snug">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
