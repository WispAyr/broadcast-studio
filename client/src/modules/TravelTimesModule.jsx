import React, { useState, useEffect, useMemo } from 'react';

const DEFAULT_ROUTES = [
  { id: 'ayr-glasgow', from: 'Ayr, Scotland', to: 'Glasgow, Scotland', label: 'Ayr → Glasgow', normalMins: 50 },
  { id: 'ayr-kilmarnock', from: 'Ayr, Scotland', to: 'Kilmarnock, Scotland', label: 'Ayr → Kilmarnock', normalMins: 20 },
  { id: 'ayr-prestwick', from: 'Ayr, Scotland', to: 'Prestwick Airport, Scotland', label: 'Ayr → Prestwick Airport', normalMins: 10 },
  { id: 'ayr-troon', from: 'Ayr, Scotland', to: 'Troon, Scotland', label: 'Ayr → Troon', normalMins: 12 },
  { id: 'glasgow-ayr', from: 'Glasgow, Scotland', to: 'Ayr, Scotland', label: 'Glasgow → Ayr', normalMins: 50 },
  { id: 'ayr-edinburgh', from: 'Ayr, Scotland', to: 'Edinburgh, Scotland', label: 'Ayr → Edinburgh', normalMins: 80 },
];

function getDelayStatus(actualMins, normalMins) {
  if (!actualMins || !normalMins) return 'unknown';
  const ratio = actualMins / normalMins;
  if (ratio <= 1.1) return 'green';
  if (ratio <= 1.35) return 'amber';
  return 'red';
}

function formatDuration(mins) {
  if (!mins) return '—';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDelayText(actualMins, normalMins) {
  if (!actualMins || !normalMins) return '';
  const diff = actualMins - normalMins;
  if (diff <= 2) return '';
  return `+${Math.round(diff)} min`;
}

const STATUS = {
  green: { bg: 'rgba(34,197,94,0.06)', border: '#22c55e', text: '#4ade80', glow: '0 0 12px rgba(34,197,94,0.12)', pill: 'rgba(34,197,94,0.12)' },
  amber: { bg: 'rgba(245,158,11,0.06)', border: '#f59e0b', text: '#fbbf24', glow: '0 0 12px rgba(245,158,11,0.12)', pill: 'rgba(245,158,11,0.12)' },
  red: { bg: 'rgba(239,68,68,0.06)', border: '#ef4444', text: '#f87171', glow: '0 0 12px rgba(239,68,68,0.15)', pill: 'rgba(239,68,68,0.12)' },
  unknown: { bg: 'rgba(107,114,128,0.06)', border: '#6b7280', text: '#9ca3af', glow: '0 0 8px rgba(107,114,128,0.08)', pill: 'rgba(107,114,128,0.1)' },
};

export default function TravelTimesModule({ config = {} }) {
  const {
    routes = DEFAULT_ROUTES, refreshInterval = 180000, background, color = '#ffffff',
    title = 'TRAVEL TIMES', showWazeEmbed = false, wazeCenter = '55.46,-4.63',
    wazeZoom = 11, layout = 'list', compact = false, showNormalTime = true, showDelayBadge = true,
  } = config;

  const [travelData, setTravelData] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchTimes = async () => {
      try {
        const origins = routes.map(r => r.from).join('|');
        const destinations = routes.map(r => r.to).join('|');
        const res = await fetch(`/api/proxy/travel-times?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (mounted) { setTravelData(data); setLastUpdated(new Date()); setError(null); }
      } catch (e) { if (mounted) setError(e.message); }
    };
    fetchTimes();
    const timer = setInterval(fetchTimes, refreshInterval);
    return () => { mounted = false; clearInterval(timer); };
  }, [refreshInterval, routes]);

  const routesWithData = useMemo(() => {
    return routes.map((route, i) => {
      const td = travelData.routes?.[i];
      const actualMins = td?.durationInTrafficMins || td?.durationMins || null;
      const status = getDelayStatus(actualMins, route.normalMins);
      return {
        ...route, actualMins, status,
        normalDurationText: td?.normalDuration || formatDuration(route.normalMins),
        trafficDurationText: td?.trafficDuration || (actualMins ? formatDuration(actualMins) : '—'),
        distance: td?.distance || '',
        delayText: getDelayText(actualMins, route.normalMins),
      };
    });
  }, [routes, travelData]);

  const wazeEmbedUrl = `https://embed.waze.com/iframe?zoom=${wazeZoom}&lat=${wazeCenter.split(',')[0]}&lon=${wazeCenter.split(',')[1]}&pin=1`;

  const routeList = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(15px)', borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#60A5FA" opacity="0.8">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">{title}</span>
        {lastUpdated && (
          <span className="ml-auto text-[10px] opacity-30" style={{ fontVariantNumeric: 'tabular-nums' }}>
            Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Routes */}
      <div className={`flex-1 overflow-y-auto ${layout === 'grid' ? 'p-3 grid grid-cols-2 gap-2 auto-rows-min' : ''}`}>
        {routesWithData.map((route, idx) => {
          const s = STATUS[route.status];
          if (layout === 'grid') {
            return (
              <div key={route.id} className="rounded-lg p-3 transition-all"
                style={{ background: s.bg, borderLeft: `3px solid ${s.border}`, boxShadow: s.glow, backdropFilter: 'blur(8px)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={s.text} opacity="0.7"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
                  <span className="text-xs font-bold truncate" style={{ color: s.text }}>{route.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black" style={{ color: s.text, fontVariantNumeric: 'tabular-nums' }}>{route.trafficDurationText}</span>
                  {showDelayBadge && route.delayText && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: s.pill, color: s.text, border: `1px solid ${s.border}33` }}>
                      {route.delayText}
                    </span>
                  )}
                </div>
                {showNormalTime && route.distance && (
                  <p className="text-[10px] opacity-30 mt-1">{route.distance} · Usually {route.normalDurationText}</p>
                )}
              </div>
            );
          }

          return (
            <div key={route.id} className={`flex items-center gap-3 px-4 ${compact ? 'py-2' : 'py-3'} transition-all`}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg, boxShadow: s.glow, border: `1px solid ${s.border}22` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={s.text} opacity="0.8"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate ${compact ? 'text-xs' : 'text-sm'}`}>{route.label}</p>
                {showNormalTime && route.distance && <p className="text-[10px] opacity-25">{route.distance}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <span className={`font-black ${compact ? 'text-base' : 'text-lg'}`} style={{ color: s.text, fontVariantNumeric: 'tabular-nums' }}>
                    {route.trafficDurationText}
                  </span>
                  {showNormalTime && <p className="text-[10px] opacity-25">Usually {route.normalDurationText}</p>}
                </div>
                {showDelayBadge && route.delayText && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: s.pill, color: s.text, border: `1px solid ${s.border}33` }}>
                    {route.delayText}
                  </span>
                )}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${route.status === 'red' ? 'animate-pulse' : ''}`}
                  style={{ background: s.border, boxShadow: s.glow }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const bg = background || 'linear-gradient(180deg, #0a0e1a 0%, #111827 50%, #0d1117 100%)';

  if (layout === 'split' || showWazeEmbed) {
    return (
      <div className="w-full h-full flex" style={{ background: bg, color }}>
        <div className="w-1/2 flex flex-col">{routeList}</div>
        <div className="w-1/2" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <iframe src={wazeEmbedUrl} className="w-full h-full border-0" title="Waze Live Map" allow="geolocation" />
        </div>
      </div>
    );
  }

  return <div className="w-full h-full flex flex-col" style={{ background: bg, color }}>{routeList}</div>;
}
