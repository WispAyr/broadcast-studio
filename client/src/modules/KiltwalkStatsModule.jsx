import React from 'react';

export default function KiltwalkStatsModule({ config = {} }) {
  const thisHour = config.thisHour || 0;
  const percentComplete = config.percentComplete || 0;
  const avgPaceMin = config.avgPaceMin || 0;
  const projectedTotal = config.projectedTotal || 0;
  const peakHour = config.peakHour || '--';
  const showGraph = config.showGraph !== false;
  const hourlyData = config.hourlyData || [];

  const stats = [
    { label: 'THIS HOUR', value: thisHour.toLocaleString(), color: '#f8af35', icon: '⏱' },
    { label: 'COMPLETE', value: `${percentComplete}%`, color: '#e63b2b', icon: '✓' },
    { label: 'AVG PACE', value: avgPaceMin ? `${Math.floor(avgPaceMin / 60)}h${String(avgPaceMin % 60).padStart(2, '0')}m` : '--', color: '#008bc7', icon: '🏃' },
    { label: 'PROJECTED', value: projectedTotal ? projectedTotal.toLocaleString() : '--', color: '#006a47', icon: '📊' },
  ];

  // Mini sparkline from hourly data
  const maxVal = Math.max(...hourlyData.map(d => d || 0), 1);

  return (
    <div className="w-full h-full flex flex-col p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0e1a 0%, #1a1a2e 100%)' }}>
      <style>{`
        @keyframes statPop {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/50">📊 Hourly Stats</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {stats.map((stat, i) => (
          <div key={stat.label} className="rounded-xl p-3 flex flex-col justify-center"
            style={{
              background: `${stat.color}08`,
              border: `1px solid ${stat.color}15`,
              animation: `statPop 0.4s ease-out ${i * 0.1}s both`,
            }}>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: `${stat.color}88` }}>
              {stat.icon} {stat.label}
            </span>
            <span className="text-2xl font-black" style={{ color: stat.color, lineHeight: 1.1 }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Mini sparkline */}
      {showGraph && hourlyData.length > 1 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="flex items-end gap-[2px] h-12">
            {hourlyData.map((val, i) => (
              <div key={i} className="flex-1 rounded-t transition-all" style={{
                height: `${(val / maxVal) * 100}%`,
                background: i === hourlyData.length - 1 ? '#f8af35' : 'rgba(255,255,255,0.1)',
                minHeight: '2px',
              }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/20">08:00</span>
            <span className="text-[9px] text-white/20">NOW</span>
          </div>
        </div>
      )}
    </div>
  );
}
