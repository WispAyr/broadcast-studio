import React, { useState, useEffect } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// nar_fuel — cheapest fuel in Ayrshire (fuel.wispayr.online). Great drivetime
// content. Fetches via the studio proxy (no CORS), ranks open stations by
// price for petrol (E10) + diesel (B7_STANDARD). NAR-branded board.
// ──────────────────────────────────────────────────────────────────────────

const FEED = 'https://fuel.wispayr.online/api/stations';
const FUELS = [
  { code: 'E10', label: 'Unleaded', icon: '⛽' },
  { code: 'B7_STANDARD', label: 'Diesel', icon: '🛢️' },
];

function priceOf(station, code) {
  const p = (station.prices || []).find(x => x.fuel_type === code);
  return p ? p.price : null;
}

function cheapest(stations, code, n) {
  return stations
    .filter(s => s.is_open_now !== false && priceOf(s, code) != null && !s.is_temporarily_closed && !s.is_permanently_closed)
    .map(s => ({ name: s.name || s.trading_name, brand: s.brand || s.brand_name, dist: s.distance, price: priceOf(s, code) }))
    .sort((a, b) => a.price - b.price)
    .slice(0, n);
}

export default function NARFuelModule({ config = {} }) {
  const {
    refreshInterval = 600000, accent = '#F7941D', background = '#1E2A35',
    count = 4, title = 'CHEAPEST FUEL · AYRSHIRE', fuels = ['E10', 'B7_STANDARD'],
  } = config;

  const [stations, setStations] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/proxy/fetch?url=${encodeURIComponent(FEED)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = JSON.parse(await res.text());
        if (on) { setStations(data.stations || data || []); setError(null); }
      } catch (e) { if (on) setError(e.message); }
    };
    load();
    const t = setInterval(load, refreshInterval);
    return () => { on = false; clearInterval(t); };
  }, [refreshInterval]);

  const cols = FUELS.filter(f => fuels.includes(f.code));

  if (error && !stations.length) {
    return <div className="w-full h-full flex items-center justify-center text-sm" style={{ background, color: '#888' }}>Fuel prices unavailable</div>;
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: `linear-gradient(180deg, ${accent}10, ${background})`, color: '#fff' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: `2px solid ${accent}33` }}>
        <span className="text-lg">⛽</span>
        <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{title}</span>
        <span className="ml-auto text-[10px] opacity-30">fuel.wispayr.online</span>
      </div>

      <div className="flex-1 grid gap-3 p-3 min-h-0" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
        {cols.map(fuel => {
          const list = cheapest(stations, fuel.code, count);
          const best = list[0];
          return (
            <div key={fuel.code} className="flex flex-col min-h-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm">{fuel.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">{fuel.label}</span>
                {best && <span className="ml-auto text-2xl font-black tabular-nums" style={{ color: accent }}>{best.price.toFixed(1)}<span className="text-xs opacity-50">p</span></span>}
              </div>
              <div className="space-y-1 overflow-hidden">
                {list.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg text-sm"
                    style={{ background: i === 0 ? `${accent}1a` : 'rgba(255,255,255,0.03)' }}>
                    <span className="w-4 text-center font-black opacity-40 text-xs">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate leading-tight">{s.brand || s.name}</div>
                      <div className="text-[10px] opacity-40 truncate">{s.name}{s.dist != null ? ` · ${s.dist.toFixed(1)}mi` : ''}</div>
                    </div>
                    <span className="font-black tabular-nums" style={{ color: i === 0 ? accent : '#fff' }}>{s.price.toFixed(1)}</span>
                  </div>
                ))}
                {!list.length && <div className="text-xs opacity-40 py-2">No prices</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
