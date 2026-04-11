import React from 'react';

export default function KiltwalkRouteModule({ config = {} }) {
  const routes = config.routes || [
    { name: 'Mighty Stride', distance: '23 miles', registered: 2500, finished: 0, color: '#e63b2b', start: 'Glasgow Green' },
    { name: 'Big Stroll', distance: '14.5 miles', registered: 4000, finished: 0, color: '#008bc7', start: 'Clydebank' },
    { name: 'Wee Wander', distance: '3 miles', registered: 3500, finished: 0, color: '#006a47', start: 'Loch Lomond Shores' },
  ];
  const logo = config.logo || '/assets/kiltwalk/logo.svg';
  const totalReg = routes.reduce((s, r) => s + (r.registered || 0), 0);
  const totalFin = routes.reduce((s, r) => s + (r.finished || 0), 0);
  const overallPct = totalReg > 0 ? Math.round((totalFin / totalReg) * 100) : 0;

  return (
    <div className="w-full h-full flex flex-col p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0e1a 0%, #1a1a2e 100%)' }}>
      <style>{`
        @keyframes routeBarFill {
          from { width: 0; }
        }
        @keyframes routeFadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-6 opacity-70" />
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/50">Route Progress</span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white">{overallPct}%</span>
          <span className="text-xs text-white/40 ml-1">complete</span>
        </div>
      </div>

      {/* Routes */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        {routes.map((route, i) => {
          const pct = route.registered > 0 ? Math.round((route.finished / route.registered) * 100) : 0;
          return (
            <div key={route.name} style={{ animation: `routeFadeIn 0.5s ease-out ${i * 0.15}s both` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: route.color }} />
                  <span className="text-sm font-bold text-white">{route.name}</span>
                  <span className="text-xs text-white/30">{route.distance}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">{route.start}</span>
                  <span className="text-sm font-bold text-white">
                    {(route.finished || 0).toLocaleString()}
                    <span className="text-white/30 font-normal"> / {(route.registered || 0).toLocaleString()}</span>
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-6 rounded-full relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full relative" style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${route.color}, ${route.color}cc)`,
                  animation: 'routeBarFill 1.5s ease-out',
                  boxShadow: `0 0 20px ${route.color}44`,
                  minWidth: pct > 0 ? '30px' : '0',
                }}>
                  {/* Shimmer */}
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div className="absolute top-0 h-full w-1/2 -skew-x-12"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
                  </div>
                </div>
                {/* Percentage label */}
                {pct > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/70">
                    {pct}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total bar */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold">All Routes</span>
          <span className="text-sm font-bold text-white">
            {totalFin.toLocaleString()} <span className="text-white/30">/ {totalReg.toLocaleString()} walkers</span>
          </span>
        </div>
      </div>
    </div>
  );
}
