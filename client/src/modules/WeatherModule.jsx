import React, { useState, useEffect } from 'react';
import useEventContext from '../hooks/useEventContext';

/* ─── SVG Weather Icons ─── */
const WeatherIcons = {
  sun: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="12" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5"/>
      {[0,45,90,135,180,225,270,315].map(a => (
        <line key={a} x1="32" y1="8" x2="32" y2="14" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round"
          transform={`rotate(${a} 32 32)`}/>
      ))}
    </svg>
  ),
  partlyCloudy: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="9" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1"/>
      {[0,60,120,180,240,300].map(a => (
        <line key={a} x1="24" y1="9" x2="24" y2="13" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"
          transform={`rotate(${a} 24 24)`}/>
      ))}
      <path d="M18 44c-5 0-9-3.5-9-8s4-8 9-8c.7-4.5 4.8-8 9.5-8 5.3 0 9.5 4 9.5 9 0 .3 0 .7-.1 1C41 30.5 44 34 44 38c0 3.5-3 6-6 6H18z" fill="rgba(255,255,255,0.9)" stroke="rgba(200,200,200,0.5)" strokeWidth="1"/>
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 46c-6 0-10-4-10-9s4.5-9 10-9c1-5 5.5-9 11-9 6 0 11 4.5 11 10v1c4.5.5 8 4 8 8 0 4.5-4 8-8 8H16z" fill="rgba(255,255,255,0.85)" stroke="rgba(180,180,180,0.4)" strokeWidth="1"/>
    </svg>
  ),
  rain: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 36c-5 0-8-3-8-7s3.5-7 8-7c.8-4 4.5-7 9-7 5 0 9 3.5 9 8v.5C36 24 39 27 39 30.5c0 3-2.5 5.5-5.5 5.5H14z" fill="rgba(200,210,220,0.85)" stroke="rgba(150,160,170,0.4)" strokeWidth="1"/>
      {[[18,42,18,50],[26,44,26,52],[34,42,34,50]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
      ))}
    </svg>
  ),
  heavyRain: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 32c-5 0-8-3-8-7s3.5-7 8-7c.8-4 4.5-7 9-7 5 0 9 3.5 9 8v.5C36 20 39 23 39 26.5c0 3-2.5 5.5-5.5 5.5H14z" fill="rgba(160,175,190,0.9)" stroke="rgba(120,130,140,0.4)" strokeWidth="1"/>
      {[[14,38,12,48],[22,40,20,50],[30,38,28,48],[18,44,16,54],[26,46,24,56]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
      ))}
    </svg>
  ),
  snow: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 34c-5 0-8-3-8-7s3.5-7 8-7c.8-4 4.5-7 9-7 5 0 9 3.5 9 8v.5C36 22 39 25 39 28.5c0 3-2.5 5.5-5.5 5.5H14z" fill="rgba(210,220,235,0.85)" stroke="rgba(180,190,200,0.4)" strokeWidth="1"/>
      {[[18,42],[26,46],[34,42],[22,50],[30,50]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="white" opacity="0.9"/>
      ))}
    </svg>
  ),
  thunder: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 32c-5 0-8-3-8-7s3.5-7 8-7c.8-4 4.5-7 9-7 5 0 9 3.5 9 8v.5C36 20 39 23 39 26.5c0 3-2.5 5.5-5.5 5.5H14z" fill="rgba(140,150,170,0.9)" stroke="rgba(100,110,130,0.4)" strokeWidth="1"/>
      <polygon points="28,34 22,46 27,46 24,56 34,42 29,42 32,34" fill="#FBBF24" stroke="#F59E0B" strokeWidth="0.5"/>
    </svg>
  ),
  fog: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {[28,36,44,52].map((y,i) => (
        <line key={i} x1="10" y1={y} x2="54" y2={y} stroke="rgba(200,210,220,0.6)" strokeWidth="3" strokeLinecap="round"/>
      ))}
    </svg>
  ),
  night: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M38 12c-12 0-22 10-22 22s10 22 22 22c-4.5-3.5-7.5-9-7.5-15.5 0-10.5 8.5-19 19-19-3-5.5-8.5-9.5-11.5-9.5z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1"/>
    </svg>
  ),
  wind: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 24h30c4 0 7-3 7-7s-3-7-7-7" stroke="rgba(200,220,240,0.8)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M12 34h26c3 0 5 2 5 5s-2 5-5 5" stroke="rgba(200,220,240,0.6)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M8 44h18c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5" stroke="rgba(200,220,240,0.4)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  ),
};

function getWeatherIcon(condition, icon) {
  const c = (condition || '').toLowerCase();
  const code = icon || '';
  if (c.includes('thunder') || c.includes('storm')) return WeatherIcons.thunder;
  if (c.includes('snow') || c.includes('sleet') || c.includes('ice')) return WeatherIcons.snow;
  if (c.includes('heavy rain') || c.includes('downpour')) return WeatherIcons.heavyRain;
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return WeatherIcons.rain;
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return WeatherIcons.fog;
  if (c.includes('wind')) return WeatherIcons.wind;
  if (c.includes('partly') || c.includes('mostly cloudy') || c.includes('broken')) return WeatherIcons.partlyCloudy;
  if (c.includes('cloud') || c.includes('overcast')) return WeatherIcons.cloud;
  if (c.includes('clear') || c.includes('sunny')) {
    const hour = new Date().getHours();
    return (hour >= 20 || hour < 6) ? WeatherIcons.night : WeatherIcons.sun;
  }
  return WeatherIcons.partlyCloudy;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

const gradients = {
  morning: 'linear-gradient(135deg, #1e3a5f 0%, #3b7dd8 40%, #87CEEB 100%)',
  afternoon: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 50%, #90CAF9 100%)',
  evening: 'linear-gradient(135deg, #1a1a2e 0%, #e94560 40%, #f4845f 100%)',
  night: 'linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #2d1b69 100%)',
  rain: 'linear-gradient(135deg, #1a1a2e 0%, #2c3e50 50%, #34495e 100%)',
  snow: 'linear-gradient(135deg, #2c3e50 0%, #4a6572 50%, #7f8fa6 100%)',
};

function getGradient(condition) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return gradients.rain;
  if (c.includes('snow') || c.includes('sleet')) return gradients.snow;
  return gradients[getTimeOfDay()];
}

export default function WeatherModule({ config = {} }) {
  // Event scoping: if config.eventId is set, use the event's lat/lon/location
  // from its prism record. Explicit config.lat still wins (manual override).
  const ctx = useEventContext(config.eventId);
  const lat = config.lat ?? ctx.lat ?? 55.46;
  const lon = config.lon ?? ctx.lon ?? -4.63;
  const location = config.location || ctx.location || 'Ayr';
  const unit = config.unit || 'C';
  const displayStyle = config.displayStyle || 'current';
  const background = config.background;
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
        if (!cancelled) { setWeather(data); setError(null); }
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

  const condition = weather?.current?.condition || '';
  const bg = background || getGradient(condition);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: bg, color }}>
        <style>{weatherStyles}</style>
        <span className="text-sm opacity-60 weather-fade-in">Loading weather...</span>
      </div>
    );
  }

  if (error || !weather?.current) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4" style={{ background: bg, color }}>
        <style>{weatherStyles}</style>
        <span className="text-xs uppercase tracking-widest opacity-50 mb-2">{location}</span>
        <span className="text-5xl font-black" style={{ fontVariantNumeric: 'tabular-nums' }}>--°{unit}</span>
        <span className="text-xs opacity-40 mt-2">{error || 'No data'}</span>
      </div>
    );
  }

  const { current, forecast } = weather;

  if (displayStyle === 'current') {
    return (
      <div className="w-full h-full relative overflow-hidden" style={{ background: bg, color }}>
        <style>{weatherStyles}</style>
        <div className="weather-gradient-shift absolute inset-0" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 weather-fade-in">
          {/* Location badge */}
          <div className="flex items-center gap-2 mb-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="text-sm uppercase tracking-[0.2em] font-semibold opacity-70">{location}</span>
          </div>

          {/* Weather icon */}
          <div className="w-20 h-20 mb-4 weather-icon-float">
            {getWeatherIcon(current.condition, current.icon)}
          </div>

          {/* Temperature — massive */}
          <div className="relative">
            <span className="text-[6rem] font-black leading-none tracking-tight" style={{ fontVariantNumeric: 'tabular-nums', textShadow: '0 4px 30px rgba(0,0,0,0.3)' }}>
              {convertTemp(current.temperature)}°
            </span>
          </div>

          {/* Condition */}
          <span className="text-base font-medium uppercase tracking-widest opacity-80 mt-2">{current.condition}</span>

          {/* Stats bar */}
          <div className="flex gap-6 mt-5">
            {[
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.7"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z"/></svg>, label: 'FEELS', value: `${convertTemp(current.feelsLike)}°` },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.7"><path d="M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3c0-1.06.56-2.04 1.46-2.59L10.5 5h3l.54 9.41c.9.55 1.46 1.53 1.46 2.59z"/></svg>, label: 'WIND', value: `${Math.round(current.windSpeed)} km/h` },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.7"><path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z"/></svg>, label: 'HUMIDITY', value: `${current.humidity}%` },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {stat.icon}
                <span className="text-[9px] uppercase tracking-widest opacity-40">{stat.label}</span>
                <span className="text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Full with forecast
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ background: bg, color }}>
      <style>{weatherStyles}</style>
      <div className="weather-gradient-shift absolute inset-0" />

      {/* Current — top section */}
      <div className="relative z-10 flex items-center gap-4 p-4 weather-fade-in"
        style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="w-14 h-14 flex-shrink-0 weather-icon-float">
          {getWeatherIcon(current.condition, current.icon)}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black" style={{ fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
              {convertTemp(current.temperature)}°{unit}
            </span>
            <span className="text-sm font-medium uppercase tracking-wider opacity-70">{current.condition}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <span className="text-xs opacity-50 uppercase tracking-wider">{location}</span>
          </div>
        </div>
        <div className="text-right text-xs space-y-1 opacity-60">
          <div className="flex items-center gap-1 justify-end">
            <span>Feels {convertTemp(current.feelsLike)}°</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span>{Math.round(current.windSpeed)} km/h</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span>{current.humidity}%</span>
          </div>
        </div>
      </div>

      {/* Forecast — bottom section */}
      {forecast && forecast.length > 0 && (
        <div className="relative z-10 flex-1 flex gap-0 min-h-0 weather-fade-in" style={{ animationDelay: '0.3s' }}>
          {forecast.slice(0, 5).map((day, i) => {
            const dayName = i === 0 ? 'TODAY' : new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-center py-3 px-1 border-r border-white/5 last:border-r-0"
                style={{ background: i === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">{dayName}</span>
                <div className="w-10 h-10 mb-2">
                  {getWeatherIcon(day.condition || '', day.icon)}
                </div>
                <span className="text-lg font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{convertTemp(day.high)}°</span>
                <span className="text-xs opacity-40" style={{ fontVariantNumeric: 'tabular-nums' }}>{convertTemp(day.low)}°</span>
                {day.precipChance > 0 && (
                  <div className="flex items-center gap-0.5 mt-1">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="#60A5FA" opacity="0.6">
                      <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z"/>
                    </svg>
                    <span className="text-[10px] opacity-40">{day.precipChance}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const weatherStyles = `
  @keyframes weatherGradientShift {
    0%, 100% { opacity: 0.3; transform: scale(1.1) rotate(0deg); }
    50% { opacity: 0.5; transform: scale(1.2) rotate(3deg); }
  }
  .weather-gradient-shift {
    background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08) 0%, transparent 60%);
    animation: weatherGradientShift 15s ease-in-out infinite;
  }
  @keyframes weatherFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .weather-fade-in {
    animation: weatherFadeIn 0.8s ease-out forwards;
  }
  @keyframes weatherIconFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .weather-icon-float {
    animation: weatherIconFloat 4s ease-in-out infinite;
  }
`;
