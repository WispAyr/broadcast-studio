import React, { useState, useEffect } from 'react';

/**
 * Generic live data module — pulls from any siphon/prism endpoint and renders
 * as a styled telemetry card. Configurable for weather, AQI, grid, marine, etc.
 */

const PRESETS = {
  weather: {
    endpoint: '/api/siphon-proxy/weather',
    label: 'LIVE WEATHER',
    icon: '🌤️',
    extract: (d) => {
      const c = d?.forecast?.current || d?.current || {};
      return [
        { label: 'Temperature', value: c.temperature_2m != null ? `${Math.round(c.temperature_2m)}°C` : '--', color: '#f8af35' },
        { label: 'Wind', value: c.wind_speed_10m != null ? `${Math.round(c.wind_speed_10m)} mph` : '--', color: '#80cef4' },
        { label: 'Gusts', value: c.wind_gusts_10m != null ? `${Math.round(c.wind_gusts_10m)} mph` : '--', color: '#e63b2b' },
        { label: 'Rain', value: c.precipitation != null ? `${c.precipitation} mm` : '--', color: '#008bc7' },
        { label: 'Humidity', value: c.relative_humidity_2m != null ? `${c.relative_humidity_2m}%` : '--', color: '#006a47' },
      ];
    },
  },
  aqi: {
    endpoint: '/api/siphon-proxy/aqi',
    label: 'AIR QUALITY',
    icon: '💨',
    extract: (d) => {
      const c = d?.air_quality?.current || d?.current || {};
      const aqi = c.european_aqi;
      const level = aqi <= 20 ? 'Good' : aqi <= 40 ? 'Fair' : aqi <= 60 ? 'Moderate' : aqi <= 80 ? 'Poor' : 'Very Poor';
      const color = aqi <= 20 ? '#22c55e' : aqi <= 40 ? '#84cc16' : aqi <= 60 ? '#eab308' : aqi <= 80 ? '#f97316' : '#ef4444';
      return [
        { label: 'AQI Index', value: aqi != null ? String(aqi) : '--', color, large: true },
        { label: 'Level', value: level, color },
        { label: 'PM2.5', value: c.pm2_5 != null ? `${c.pm2_5} µg/m³` : '--', color: '#80cef4' },
        { label: 'PM10', value: c.pm10 != null ? `${c.pm10} µg/m³` : '--', color: '#f8af35' },
        { label: 'Ozone', value: c.ozone != null ? `${c.ozone} µg/m³` : '--', color: '#008bc7' },
      ];
    },
  },
  marine: {
    endpoint: '/api/siphon-proxy/marine',
    label: 'MARINE CONDITIONS',
    icon: '🌊',
    extract: (d) => {
      const c = d?.marine?.current || d?.current || {};
      return [
        { label: 'Wave Height', value: c.wave_height != null ? `${c.wave_height} m` : '--', color: '#008bc7', large: true },
        { label: 'Wave Period', value: c.wave_period != null ? `${c.wave_period}s` : '--', color: '#80cef4' },
        { label: 'Wave Dir', value: c.wave_direction != null ? `${c.wave_direction}°` : '--', color: '#f8af35' },
        { label: 'Sea Temp', value: c.sea_surface_temperature != null ? `${c.sea_surface_temperature}°C` : '--', color: '#006a47' },
      ];
    },
  },
  radiation: {
    endpoint: '/api/siphon-proxy/radiation',
    label: 'RADIATION MONITORING',
    icon: '☢️',
    extract: (d) => {
      return [
        { label: 'Stations', value: d?.total_stations != null ? String(d.total_stations) : '--', color: '#22c55e' },
        { label: 'Average', value: d?.avg_usv_h != null ? `${d.avg_usv_h} µSv/h` : '--', color: '#84cc16' },
        { label: 'Maximum', value: d?.max_usv_h != null ? `${d.max_usv_h} µSv/h` : '--', color: '#f8af35' },
        { label: 'Elevated', value: d?.elevated_count != null ? String(d.elevated_count) : '0', color: d?.elevated_count > 0 ? '#ef4444' : '#22c55e' },
      ];
    },
  },
  grid: {
    endpoint: '/api/siphon-proxy/grid',
    label: 'UK GRID FREQUENCY',
    icon: '⚡',
    extract: (d) => {
      const hz = d?.current_hz || d?.frequency;
      const dev = hz ? Math.abs(hz - 50.0) : null;
      const color = dev != null && dev > 0.1 ? '#ef4444' : dev != null && dev > 0.05 ? '#f8af35' : '#22c55e';
      return [
        { label: 'Frequency', value: hz != null ? `${hz.toFixed(3)} Hz` : '--', color, large: true },
        { label: 'Deviation', value: dev != null ? `${dev.toFixed(3)} Hz` : '--', color },
        { label: 'Status', value: dev != null ? (dev < 0.05 ? 'Normal' : dev < 0.1 ? 'Watch' : 'Alert') : '--', color },
      ];
    },
  },
  proton: {
    endpoint: '/api/siphon-proxy/proton',
    label: 'SOLAR PROTON FLUX',
    icon: '☀️',
    extract: (d) => {
      const data = d?.data || d;
      return [
        { label: 'Level', value: data?.level || '--', color: data?.level === 'nominal' ? '#22c55e' : '#f97316' },
        { label: '≥10 MeV', value: data?.flux_10mev != null ? `${data.flux_10mev.toFixed(2)} pfu` : '--', color: '#f8af35' },
        { label: '≥100 MeV', value: data?.flux_100mev != null ? `${data.flux_100mev.toFixed(4)} pfu` : '--', color: '#80cef4' },
      ];
    },
  },
};

export default function SiphonDataModule({ config = {} }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const preset = PRESETS[config.preset] || PRESETS.weather;
  const endpoint = config.endpoint || preset.endpoint;
  const label = config.label || preset.label;
  const icon = config.icon || preset.icon;
  const refreshMs = (config.refreshSecs || 60) * 1000;

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(endpoint);
        if (r.ok) {
          const d = await r.json();
          setData(d?.data || d);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
    const timer = setInterval(load, refreshMs);
    return () => clearInterval(timer);
  }, [endpoint, refreshMs]);

  const rows = data ? preset.extract(data) : [];

  return (
    <div className="w-full h-full flex flex-col p-4 relative overflow-hidden"
      style={{ background: config.background || 'linear-gradient(145deg, #0a0e1a 0%, #1a1a2e 100%)' }}>
      <style>{`
        @keyframes siphonFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes siphonPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/50">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background: loading ? '#f8af35' : '#22c55e',
            animation: loading ? 'siphonPulse 1s ease-in-out infinite' : undefined,
          }} />
          <span className="text-[9px] text-white/30 uppercase">LIVE</span>
        </div>
      </div>

      {/* Data rows */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        {rows.length === 0 && (
          <span className="text-sm text-white/30 text-center">
            {loading ? 'Loading...' : 'No data available'}
          </span>
        )}
        {rows.map((row, i) => (
          <div key={row.label} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
            style={{
              background: `${row.color}08`,
              animation: `siphonFadeIn 0.3s ease-out ${i * 0.08}s both`,
            }}>
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">{row.label}</span>
            <span className={`font-black ${row.large ? 'text-2xl' : 'text-base'}`}
              style={{ color: row.color, fontVariantNumeric: 'tabular-nums' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Source badge */}
      <div className="flex items-center justify-center gap-1.5 mt-2 opacity-30">
        <span className="text-[8px] uppercase tracking-wider text-white">Powered by Siphon + Prism</span>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{
        background: `linear-gradient(90deg, transparent, ${rows[0]?.color || '#80cef4'}44, transparent)`,
      }} />
    </div>
  );
}
