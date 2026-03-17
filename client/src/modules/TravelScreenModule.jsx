import React, { useState, useEffect, useRef } from 'react';

const STATUS_COLORS = {
  green: { bg: 'bg-emerald-900/40', border: 'border-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  amber: { bg: 'bg-amber-900/40', border: 'border-amber-500', text: 'text-amber-400', dot: 'bg-amber-400' },
  red: { bg: 'bg-red-900/40', border: 'border-red-500', text: 'text-red-400', dot: 'bg-red-400' },
};

const SECTION_ICONS = { roads: '🚗', rail: '🚆', ferries: '⛴', tros: '🚧' };
const SECTION_LABELS = { roads: 'ROADS', rail: 'RAIL', ferries: 'FERRIES', tros: 'TROs' };

const RAIL_STATUS_MAP = { good: 'green', minor: 'amber', major: 'red', cancelled: 'red' };
const FERRY_STATUS_MAP = { sailing: 'green', disrupted: 'amber', cancelled: 'red' };

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function AutoScrollContainer({ children }) {
  const ref = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    if (scrollHeight <= clientHeight) return;

    const interval = setInterval(() => {
      setScrollY(prev => {
        const next = prev + 1;
        if (next >= scrollHeight - clientHeight) return 0;
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [children]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = scrollY;
  }, [scrollY]);

  return (
    <div ref={ref} className="overflow-hidden flex-1" style={{ scrollBehavior: 'auto' }}>
      {children}
    </div>
  );
}

function StatusDot({ color }) {
  const c = STATUS_COLORS[color] || STATUS_COLORS.green;
  return <span className={`inline-block w-3 h-3 rounded-full ${c.dot} ${color === 'red' ? 'animate-pulse' : ''}`} />;
}

function TravelCard({ item, type, compact }) {
  let color, label, detail;

  if (type === 'roads') {
    color = item.severity || 'green';
    label = item.route;
    detail = compact ? item.title : `${item.title}${item.detail ? ' — ' + item.detail : ''}`;
  } else if (type === 'rail') {
    color = RAIL_STATUS_MAP[item.status] || 'green';
    label = item.line;
    detail = item.detail;
  } else if (type === 'ferries') {
    color = FERRY_STATUS_MAP[item.status] || 'green';
    label = item.route;
    detail = item.detail;
  }

  const c = STATUS_COLORS[color] || STATUS_COLORS.green;

  return (
    <div className={`${c.bg} border-l-4 ${c.border} rounded-r-lg px-4 py-3 mb-2`}>
      <div className="flex items-center justify-between">
        <span className={`font-bold text-lg ${c.text}`}>{label}</span>
        <StatusDot color={color} />
      </div>
      {detail && <p className="text-gray-300 text-sm mt-1 leading-snug">{detail}</p>}
    </div>
  );
}

function AllClearCard() {
  return (
    <div className="bg-emerald-900/30 border-l-4 border-emerald-500 rounded-r-lg px-4 py-3 mb-2">
      <span className="text-emerald-400 font-medium">✓ All services running normally</span>
    </div>
  );
}

function Section({ type, items, compact }) {
  return (
    <div className="flex-1 min-w-0 px-3">
      <h2 className="text-xl font-bold text-white mb-3 tracking-wider flex items-center gap-2">
        <span>{SECTION_ICONS[type]}</span>
        <span>{SECTION_LABELS[type]}</span>
      </h2>
      <AutoScrollContainer>
        {(!items || items.length === 0) ? (
          <AllClearCard />
        ) : (
          items.map((item, i) => <TravelCard key={item.id || i} item={item} type={type} compact={compact} />)
        )}
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

  const fetchData = async () => {
    try {
      const res = await fetch('/api/travel/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Travel fetch error:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const overallColor = data?.summary?.overall || 'green';
  const c = STATUS_COLORS[overallColor];

  return (
    <div className="w-full h-full bg-gray-950 text-white flex flex-col font-sans">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900/80 border-b border-gray-700/50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-widest uppercase">{title}</h1>
          <StatusDot color={overallColor} />
        </div>
        <div className="flex items-center gap-4 text-gray-400 text-sm">
          {error && <span className="text-red-400">⚠ {error}</span>}
          {data?.lastUpdated && (
            <span>Updated {formatTime(data.lastUpdated)}</span>
          )}
        </div>
      </div>

      {/* Main Content — sections side by side */}
      <div className="flex-1 flex min-h-0 py-4">
        {showSections.map(section => (
          <Section
            key={section}
            type={section}
            items={data?.sections?.[section]}
            compact={compact}
          />
        ))}
      </div>

      {/* Summary Bar */}
      {data?.summary && (
        <div className="flex items-center justify-center gap-8 px-6 py-3 bg-gray-900/80 border-t border-gray-700/50">
          {showSections.map(section => {
            const status = data.summary[section] || 'green';
            return (
              <div key={section} className="flex items-center gap-2 text-sm text-gray-300">
                <span>{SECTION_ICONS[section]}</span>
                <span className="uppercase font-medium">{SECTION_LABELS[section]}</span>
                <StatusDot color={status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
