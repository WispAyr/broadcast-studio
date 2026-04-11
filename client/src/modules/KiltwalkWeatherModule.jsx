import React, { useState, useEffect } from 'react';

export default function KiltwalkWeatherModule({ config = {} }) {
  const [weather, setWeather] = useState(null);
  const endpoint = config.endpoint || '/api/weather/ayr';
  const siphonBase = config.siphonBase || '/api/siphon-proxy';

  useEffect(() => {
    async function fetchWeather() {
      try {
        const r = await fetch(`${siphonBase}${endpoint}`);
        if (r.ok) setWeather(await r.json());
      } catch {}
    }
    fetchWeather();
    const timer = setInterval(fetchWeather, 300000);
    return () => clearInterval(timer);
  }, [endpoint, siphonBase]);

  const current = weather?.forecast?.current || weather?.current || {};
  const temp = current.temperature_2m;
  const wind = current.wind_speed_10m;
  const precip = current.precipitation;
  const humidity = current.relative_humidity_2m;

  const getCondition = () => {
    if (precip > 2) return { icon: '🌧️', label: 'Rainy', advice: 'Waterproofs essential' };
    if (precip > 0) return { icon: '🌦️', label: 'Showers', advice: 'Pack a waterproof' };
    if (wind > 30) return { icon: '💨', label: 'Windy', advice: 'Layer up!' };
    if (temp > 18) return { icon: '☀️', label: 'Warm', advice: 'Stay hydrated' };
    if (temp > 10) return { icon: '⛅', label: 'Mild', advice: 'Great walking weather' };
    return { icon: '🌤️', label: 'Cool', advice: 'Wrap up warm' };
  };

  const cond = getCondition();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0e1a 0%, #1a1a2e 100%)' }}>

      {/* Condition icon */}
      <span className="text-5xl mb-2">{cond.icon}</span>

      {/* Temperature */}
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-black text-white">{temp != null ? Math.round(temp) : '--'}</span>
        <span className="text-xl text-white/50">°C</span>
      </div>

      <span className="text-sm font-bold text-white/70 mb-3">{cond.label}</span>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-white/40">
        {wind != null && <span>💨 {Math.round(wind)} mph</span>}
        {humidity != null && <span>💧 {humidity}%</span>}
        {precip != null && <span>🌧 {precip} mm</span>}
      </div>

      {/* Walker advice */}
      <div className="mt-3 px-3 py-1.5 rounded-full" style={{
        background: 'rgba(248,175,53,0.1)',
        border: '1px solid rgba(248,175,53,0.2)',
      }}>
        <span className="text-xs font-bold" style={{ color: '#f8af35' }}>🏃 {cond.advice}</span>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{
        background: 'linear-gradient(90deg, transparent, #80cef444, transparent)',
      }} />
    </div>
  );
}
