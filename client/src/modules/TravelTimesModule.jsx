import React, { useState, useEffect, useMemo } from 'react';

/**
 * Travel Times Module — Live journey times for Ayrshire routes
 * Uses Google Maps Distance Matrix API (via backend proxy) + Waze embed
 * Shows real-time driving times with traffic vs normal comparison
 */

const DEFAULT_ROUTES = [
  { id: 'ayr-glasgow', from: 'Ayr, Scotland', to: 'Glasgow, Scotland', label: 'Ayr → Glasgow', icon: '🏙️', normalMins: 50 },
  { id: 'ayr-kilmarnock', from: 'Ayr, Scotland', to: 'Kilmarnock, Scotland', label: 'Ayr → Kilmarnock', icon: '🏘️', normalMins: 20 },
  { id: 'ayr-prestwick', from: 'Ayr, Scotland', to: 'Prestwick Airport, Scotland', label: 'Ayr → Prestwick Airport', icon: '✈️', normalMins: 10 },
  { id: 'kilmarnock-glasgow', from: 'Kilmarnock, Scotland', to: 'Glasgow, Scotland', label: 'Kilmarnock → Glasgow', icon: '🏙️', normalMins: 35 },
  { id: 'irvine-glasgow', from: 'Irvine, Scotland', to: 'Glasgow, Scotland', label: 'Irvine → Glasgow', icon: '🏙️', normalMins: 40 },
  { id: 'ayr-troon', from: 'Ayr, Scotland', to: 'Troon, Scotland', label: 'Ayr → Troon', icon: '⛳', normalMins: 12 },
  { id: 'ayr-girvan', from: 'Ayr, Scotland', to: 'Girvan, Scotland', label: 'Ayr → Girvan', icon: '🌊', normalMins: 25 },
  { id: 'ayr-edinburgh', from: 'Ayr, Scotland', to: 'Edinburgh, Scotland', label: 'Ayr → Edinburgh', icon: '🏰', normalMins: 80 },
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

const STATUS_STYLES = {
  green: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', text: '#4ade80', glow: 'rgba(34,197,94,0.15)' },
  amber: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#fbbf24', glow: 'rgba(245,158,11,0.15)' },
  red: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#f87171', glow: 'rgba(239,68,68,0.15)' },
  unknown: { bg: 'rgba(107,114,128,0.12)', border: '#6b7280', text: '#9ca3af', glow: 'rgba(107,114,128,0.1)' },
};

export default function TravelTimesModule({ config = {} }) {
  const {
    routes = DEFAULT_ROUTES,
    refreshInterval = 180000, // 3 min (API quota friendly)
    background = 'transparent',
    color = '#ffffff',
    title = 'TRAVEL TIMES',
    showWazeEmbed = false,
    wazeCenter = '55.46,-4.63',
    wazeZoom = 11,
    layout = 'list', // 'list', 'grid', 'split' (split = list + waze map)
    compact = false,
    showNormalTime = true,
    showDelayBadge = true,
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
        if (mounted) {
          setTravelData(data);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e.message);
      }
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
        ...route,
        actualMins,
        normalDurationText: td?.normalDuration || formatDuration(route.normalMins),
        trafficDurationText: td?.trafficDuration || (actualMins ? formatDuration(actualMins) : '—'),
        distance: td?.distance || '',
        status,
        delayText: getDelayText(actualMins, route.normalMins),
      };
    });
  }, [routes, travelData]);

  const wazeEmbedUrl = `https://embed.waze.com/iframe?zoom=${wazeZoom}&lat=${wazeCenter.split(',')[0]}&lon=${wazeCenter.split(',')[1]}&pin=1`;

  const routeList = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '2px solid rgba(59,130,246,0.5)' }}>
        <span className="text-lg">🕐</span>
        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{title}</span>
        {lastUpdated && (
          <span className="ml-auto text-[10px] opacity-30">
            Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Routes */}
      <div className={`flex-1 overflow-y-auto ${layout === 'grid' ? 'p-3 grid grid-cols-2 gap-2 auto-rows-min' : ''}`}>
        {routesWithData.map((route) => {
          const s = STATUS_STYLES[route.status];
          if (layout === 'grid') {
            return (
              <div key={route.id} className="rounded-lg p-3 border-l-3 transition-all"
                style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{route.icon}</span>
                  <span className="text-xs font-bold truncate" style={{ color: s.text }}>{route.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ color: s.text }}>{route.trafficDurationText}</span>
                  {showDelayBadge && route.delayText && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${s.border}33`, color: s.text }}>
                      {route.delayText}
                    </span>
                  )}
                </div>
                {showNormalTime && route.distance && (
                  <p className="text-[10px] opacity-40 mt-1">{route.distance} • Usually {route.normalDurationText}</p>
                )}
              </div>
            );
          }

          return (
            <div key={route.id} className={`flex items-center gap-3 px-4 ${compact ? 'py-2' : 'py-3'} border-b border-white/5`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg, boxShadow: `0 0 10px ${s.glow}` }}>
                <span className="text-sm">{route.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate ${compact ? 'text-xs' : 'text-sm'}`}>{route.label}</p>
                {showNormalTime && route.distance && (
                  <p className="text-[10px] opacity-30">{route.distance}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <span className={`font-bold ${compact ? 'text-base' : 'text-lg'}`} style={{ color: s.text }}>
                    {route.trafficDurationText}
                  </span>
                  {showNormalTime && (
                    <p className="text-[10px] opacity-30">Usually {route.normalDurationText}</p>
                  )}
                </div>
                {showDelayBadge && route.delayText && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{ background: `${s.border}22`, color: s.text, border: `1px solid ${s.border}44` }}>
                    {route.delayText}
                  </span>
                )}
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.border }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (layout === 'split' || showWazeEmbed) {
    return (
      <div className="w-full h-full flex" style={{ background, color }}>
        <div className="w-1/2 flex flex-col">{routeList}</div>
        <div className="w-1/2 border-l border-white/10">
          <iframe
            src={wazeEmbedUrl}
            className="w-full h-full border-0"
            title="Waze Live Map"
            allow="geolocation"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col" style={{ background, color }}>
      {routeList}
    </div>
  );
}
