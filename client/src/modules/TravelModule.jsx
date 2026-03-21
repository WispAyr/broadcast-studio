import React, { useState, useEffect } from 'react';

const MOCK_TRAVEL = [
  { id: 1, type: 'road', route: 'A77 Southbound', status: 'delay', detail: 'Delays of 15 mins near Kilmarnock due to roadworks', severity: 'amber' },
  { id: 2, type: 'road', route: 'M77 Junction 4', status: 'clear', detail: 'All lanes running freely', severity: 'green' },
  { id: 3, type: 'rail', route: 'Ayr to Glasgow Central', status: 'delay', detail: 'Services running 10 mins late due to signal fault', severity: 'amber' },
  { id: 4, type: 'road', route: 'A78 Coast Road', status: 'incident', detail: 'Road closed between Troon and Irvine - accident. Expect diversions.', severity: 'red' },
  { id: 5, type: 'rail', route: 'Kilmarnock to Glasgow', status: 'clear', detail: 'Services running normally', severity: 'green' },
  { id: 6, type: 'ferry', route: 'Ardrossan to Brodick', status: 'clear', detail: 'Sailing on schedule', severity: 'green' },
];

const SEV = {
  green: { bg: 'rgba(34,197,94,0.06)', border: '#22c55e', text: '#4ade80', pill: 'rgba(34,197,94,0.12)', glow: '0 0 8px rgba(34,197,94,0.1)' },
  amber: { bg: 'rgba(245,158,11,0.06)', border: '#f59e0b', text: '#fbbf24', pill: 'rgba(245,158,11,0.12)', glow: '0 0 8px rgba(245,158,11,0.1)' },
  red: { bg: 'rgba(239,68,68,0.06)', border: '#ef4444', text: '#f87171', pill: 'rgba(239,68,68,0.12)', glow: '0 0 8px rgba(239,68,68,0.15)' },
};

const TYPE_ICONS = {
  road: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>,
  rail: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4z"/></svg>,
  ferry: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2z"/></svg>,
  bus: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/></svg>,
};

export default function TravelModule({ config = {} }) {
  const items = config.items || MOCK_TRAVEL;
  const bg = config.background;
  const color = config.color || '#ffffff';
  const title = config.title || 'Travel Update';
  const autoScroll = config.autoScroll !== false;
  const scrollSpeed = config.scrollSpeed || 6000;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!autoScroll || items.length <= 3) return;
    const timer = setInterval(() => setOffset(prev => (prev + 1) % items.length), scrollSpeed);
    return () => clearInterval(timer);
  }, [autoScroll, scrollSpeed, items.length]);

  const visible = [];
  for (let i = 0; i < Math.min(4, items.length); i++) visible.push(items[(offset + i) % items.length]);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col relative"
      style={{ background: bg || 'linear-gradient(180deg, #0a0e1a, #111827)', color }}>
      <style>{`
        @keyframes travelCardIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .travel-card { animation: travelCardIn 0.4s ease-out forwards; }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#60A5FA" opacity="0.8">
          <path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/>
        </svg>
        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">{title}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 flex flex-col gap-1.5 overflow-hidden p-3">
        {visible.map((item, idx) => {
          const sev = SEV[item.severity] || SEV.green;
          return (
            <div key={item.id} className="travel-card rounded-lg px-3 py-2.5 transition-all duration-500"
              style={{ background: sev.bg, borderLeft: `3px solid ${sev.border}`, boxShadow: sev.glow, backdropFilter: 'blur(8px)', animationDelay: `${idx * 0.1}s` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="opacity-60" style={{ color: sev.text }}>{TYPE_ICONS[item.type] || TYPE_ICONS.road}</span>
                <span className="text-xs font-bold" style={{ color: sev.text }}>{item.route}</span>
                <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider"
                  style={{ background: sev.pill, color: sev.text, border: `1px solid ${sev.border}33` }}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-snug">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
