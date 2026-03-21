import React, { useState, useEffect, useRef } from 'react';

const STATUS_CONFIG = {
  green: { bg: 'rgba(34,197,94,0.08)', border: '#22c55e', text: '#4ade80', glow: '0 0 12px rgba(34,197,94,0.15)', pill: 'rgba(34,197,94,0.15)', label: 'GOOD SERVICE' },
  amber: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#fbbf24', glow: '0 0 12px rgba(245,158,11,0.15)', pill: 'rgba(245,158,11,0.15)', label: 'DELAYS' },
  red: { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', text: '#f87171', glow: '0 0 12px rgba(239,68,68,0.2)', pill: 'rgba(239,68,68,0.15)', label: 'DISRUPTION' },
};

const SECTION_ICONS = {
  roads: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>,
  rail: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>,
  ferries: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/></svg>,
  tros: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>,
};

const SECTION_LABELS = { roads: 'ROADS', rail: 'RAIL', ferries: 'FERRIES', tros: 'TROs' };
const RAIL_STATUS_MAP = { good: 'green', minor: 'amber', major: 'red', cancelled: 'red' };
const FERRY_STATUS_MAP = { sailing: 'green', disrupted: 'amber', cancelled: 'red' };

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function StatusPill({ color }) {
  const c = STATUS_CONFIG[color] || STATUS_CONFIG.green;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: c.pill, color: c.text, border: `1px solid ${c.border}33` }}>
      <span className={`w-1.5 h-1.5 rounded-full ${color === 'red' ? 'animate-pulse' : ''}`} style={{ background: c.border }} />
      {c.label}
    </span>
  );
}

function AutoScrollContainer({ children }) {
  const ref = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollHeight <= el.clientHeight) return;
    const interval = setInterval(() => {
      setScrollY(prev => {
        const next = prev + 1;
        return next >= el.scrollHeight - el.clientHeight ? 0 : next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [children]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = scrollY; }, [scrollY]);
  return <div ref={ref} className="overflow-hidden flex-1" style={{ scrollBehavior: 'auto' }}>{children}</div>;
}

function TravelCard({ item, type, compact }) {
  let color, label, detail;
  if (type === 'roads') { color = item.severity || 'green'; label = item.route; detail = compact ? item.title : `${item.title}${item.detail ? ' — ' + item.detail : ''}`; }
  else if (type === 'rail') { color = RAIL_STATUS_MAP[item.status] || 'green'; label = item.line; detail = item.detail; }
  else if (type === 'ferries') { color = FERRY_STATUS_MAP[item.status] || 'green'; label = item.route; detail = item.detail; }
  const c = STATUS_CONFIG[color] || STATUS_CONFIG.green;

  return (
    <div className="rounded-lg px-4 py-3 mb-2 transition-all duration-300"
      style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, boxShadow: c.glow, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-base" style={{ color: c.text }}>{label}</span>
        <StatusPill color={color} />
      </div>
      {detail && <p className="text-gray-400 text-sm leading-snug">{detail}</p>}
    </div>
  );
}

function AllClearCard() {
  return (
    <div className="rounded-lg px-4 py-3 mb-2" style={{ background: 'rgba(34,197,94,0.06)', borderLeft: '3px solid #22c55e' }}>
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#4ade80"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        <span className="text-emerald-400 font-medium text-sm">All services running normally</span>
      </div>
    </div>
  );
}

function Section({ type, items, compact }) {
  return (
    <div className="flex-1 min-w-0 px-3 flex flex-col">
      <h2 className="text-sm font-bold text-white/80 mb-3 tracking-[0.2em] uppercase flex items-center gap-2 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="opacity-70">{SECTION_ICONS[type]}</span>
        <span>{SECTION_LABELS[type]}</span>
      </h2>
      <AutoScrollContainer>
        {(!items || items.length === 0) ? <AllClearCard /> : items.map((item, i) => <TravelCard key={item.id || i} item={item} type={type} compact={compact} />)}
      </AutoScrollContainer>
    </div>
  );
}

export default function TravelScreenModule({ config = {} }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const refreshInterval = config.refreshInterval || 120000;
  const showSections = config.showSections || ['roads', 'rail', 'ferries', 'tros'];
  const title = config.title || 'Ayrshire Travel';
  const compact = config.compactMode || false;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/travel/data');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json()); setError(null);
      } catch (err) { setError(err.message); }
    };
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const overallColor = data?.summary?.overall || 'green';

  return (
    <div className="w-full h-full text-white flex flex-col font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #111827 50%, #0d1117 100%)' }}>
      <style>{`
        @keyframes travelBgShift {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.1; }
        }
      `}</style>

      {/* Subtle background texture */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.06), transparent 70%)', animation: 'travelBgShift 10s ease-in-out infinite' }} />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 shrink-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#60A5FA" opacity="0.8"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
          <h1 className="text-lg font-black tracking-[0.15em] uppercase">{title}</h1>
          <StatusPill color={overallColor} />
        </div>
        <div className="flex items-center gap-4 text-gray-500 text-xs">
          {error && <span className="text-red-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
            {error}
          </span>}
          {data?.lastUpdated && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>Updated {formatTime(data.lastUpdated)}</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex min-h-0 py-3">
        {showSections.map((section, i) => (
          <React.Fragment key={section}>
            {i > 0 && <div className="w-px self-stretch my-2" style={{ background: 'rgba(255,255,255,0.05)' }} />}
            <Section type={section} items={data?.sections?.[section]} compact={compact} />
          </React.Fragment>
        ))}
      </div>

      {/* Summary Bar */}
      {data?.summary && (
        <div className="relative z-10 flex items-center justify-center gap-8 px-6 py-2.5 shrink-0"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {showSections.map(section => {
            const status = data.summary[section] || 'green';
            const c = STATUS_CONFIG[status];
            return (
              <div key={section} className="flex items-center gap-2 text-xs">
                <span className="opacity-60">{SECTION_ICONS[section]}</span>
                <span className="uppercase font-semibold tracking-wider opacity-60">{SECTION_LABELS[section]}</span>
                <span className={`w-2 h-2 rounded-full ${status === 'red' ? 'animate-pulse' : ''}`} style={{ background: c.border, boxShadow: c.glow }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
