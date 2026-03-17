import React, { useState, useEffect } from 'react';

export default function WeatherModule({ config = {} }) {
  const lat = config.lat || 55.46;
  const lon = config.lon || -4.63;
  const location = config.location || 'Ayr';
  const unit = config.unit || 'C';
  const displayStyle = config.displayStyle || 'current';
  const background = config.background || 'transparent';
  const color = config.color || '#ffffff';
  const refreshInterval = (config.refreshInterval || 600) * 1000;

  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather() {
      try {
        const res = await fetch(`/api/proxy/weather?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setWeather(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, refreshInterval);
    return () => { cancelled = true; clearInterval(interval); };
  }, [lat, lon, refreshInterval]);

  function convertTemp(c) {
    if (unit === 'F') return Math.round(c * 9 / 5 + 32);
    return Math.round(c);
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color }}>
        <span className="text-sm opacity-60">Loading weather...</span>
      </div>
    );
  }

  if (error || !weather?.current) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4" style={{ background, color }}>
        <span className="text-sm opacity-70">{location}</span>
        <span className="text-4xl font-bold">--°{unit}</span>
        <span className="text-xs opacity-50 mt-1">{error || 'No data'}</span>
      </div>
    );
  }

  const { current, forecast } = weather;

  // Current only
  if (displayStyle === 'current') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4" style={{ background, color }}>
        <span className="text-sm opacity-70 mb-1">{location}</span>
        <span className="text-5xl mb-1">{current.icon}</span>
        <span className="text-4xl font-bold">
          {convertTemp(current.temperature)}°{unit}
        </span>
        <span className="text-sm opacity-70 mt-1">{current.condition}</span>
        <div className="flex gap-3 mt-2 text-xs opacity-50">
          <span>Feels {convertTemp(current.feelsLike)}°</span>
          <span>💨 {Math.round(current.windSpeed)} km/h</span>
          <span>💧 {current.humidity}%</span>
        </div>
      </div>
    );
  }

  // Full with forecast
  return (
    <div className="w-full h-full flex flex-col p-3 overflow-hidden" style={{ background, color }}>
      {/* Current */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{current.icon}</span>
        <div>
          <div className="text-2xl font-bold">{convertTemp(current.temperature)}°{unit}</div>
          <div className="text-xs opacity-70">{current.condition} · {location}</div>
        </div>
        <div className="ml-auto text-right text-xs opacity-50">
          <div>Feels {convertTemp(current.feelsLike)}°</div>
          <div>💨 {Math.round(current.windSpeed)} km/h</div>
        </div>
      </div>

      {/* Forecast */}
      {forecast && forecast.length > 0 && (
        <div className="flex gap-1 flex-1 min-h-0">
          {forecast.slice(0, 5).map((day, i) => {
            const dayName = i === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-center rounded p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="text-xs opacity-60">{dayName}</span>
                <span className="text-lg my-0.5">{day.icon}</span>
                <span className="text-xs font-semibold">{convertTemp(day.high)}°</span>
                <span className="text-xs opacity-50">{convertTemp(day.low)}°</span>
                {day.precipChance > 0 && (
                  <span className="text-xs opacity-40">💧{day.precipChance}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
