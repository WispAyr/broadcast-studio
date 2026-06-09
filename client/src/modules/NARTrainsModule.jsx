import React, { useState, useEffect } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// nar_trains — live ScotRail departures from Ayr (trains.wispayr.online).
// /api/all → { northbound:[...], southbound:[...] } each a list of services
// { scheduled, expected, destination, platform, delay_mins, cancelled }.
// Departure-board aesthetic. Great travel/drivetime content.
// ──────────────────────────────────────────────────────────────────────────

const FEED = 'https://trains.wispayr.online/api/all';

function statusOf(svc) {
  if (svc.cancelled) return { text: 'Cancelled', color: '#f87171' };
  if (svc.delay_mins > 0 || (svc.expected && svc.expected !== 'On Time' && svc.expected !== svc.scheduled)) {
    return { text: svc.expected || `+${svc.delay_mins}`, color: '#fbbf24' };
  }
  return { text: 'On Time', color: '#4ade80' };
}

function Board({ title, services, count }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <span className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#fbbf24' }}>{title}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {(Array.isArray(services) ? services : []).slice(0, count).map((s, i) => {
          const st = statusOf(s);
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: "'Share Tech Mono','Courier New',monospace" }}>
              <span className="text-lg font-bold tabular-nums" style={{ color: '#fde68a' }}>{s.scheduled}</span>
              <span className="flex-1 min-w-0 truncate text-base font-semibold">{s.destination}</span>
              {s.platform && <span className="text-xs opacity-50">Pl {s.platform}</span>}
              <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: st.color }}>{st.text}</span>
            </div>
          );
        })}
        {(!Array.isArray(services) || !services.length) && <div className="px-3 py-3 text-sm opacity-40">No departures</div>}
      </div>
    </div>
  );
}

export default function NARTrainsModule({ config = {} }) {
  const { refreshInterval = 30000, count = 4, station = 'Ayr', background = '#0b1220',
    northTitle = 'Northbound · Glasgow', southTitle = 'Southbound', layout = 'split' } = config;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/proxy/fetch?url=${encodeURIComponent(FEED)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const d = JSON.parse(await res.text());
        if (on) { setData(d); setError(null); }
      } catch (e) { if (on) setError(e.message); }
    };
    load();
    const t = setInterval(load, refreshInterval);
    return () => { on = false; clearInterval(t); };
  }, [refreshInterval]);

  if (error && !data) return <div className="w-full h-full flex items-center justify-center text-sm" style={{ background, color: '#888' }}>Train times unavailable</div>;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background, color: '#fff' }}>
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '2px solid rgba(251,191,36,0.3)' }}>
        <span className="text-base">🚆</span>
        <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: '#fbbf24' }}>{station} · Train Departures</span>
        <span className="ml-auto text-[10px] opacity-30">ScotRail</span>
      </div>
      <div className={`flex-1 min-h-0 flex ${layout === 'split' ? 'flex-row divide-x divide-white/10' : 'flex-col'}`}>
        <Board title={northTitle} services={data?.northbound?.departures || data?.northbound} count={count} />
        <Board title={southTitle} services={data?.southbound?.departures || data?.southbound} count={count} />
      </div>
    </div>
  );
}
