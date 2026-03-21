import React, { useState, useEffect, useMemo } from 'react';

const SCHEDULE_API = 'https://www.nowayrshireradio.co.uk/wp-json/proradio/v1/schedule-today-full';

function decodeHtml(str) {
  if (!str) return '';
  return str.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014').replace(/&#8211;/g, '\u2013').replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201C').replace(/&#8221;/g, '\u201D');
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function getGenreTags(tags) {
  return (tags || []).map(t => t.name).filter(Boolean);
}

function getShowProgress(start, end) {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now < s) return 0;
  if (now > e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

export default function NARScheduleModule({ config = {} }) {
  const {
    apiUrl = SCHEDULE_API, refreshInterval = 60000, background, color = '#ffffff',
    accentColor = '#e11d48', showThumbnails = true, showGenres = true,
    maxUpcoming = 4, title = 'NOW AYRSHIRE RADIO', compact = false,
  } = config;

  const [schedule, setSchedule] = useState([]);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let mounted = true;
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`/api/proxy/fetch?url=${encodeURIComponent(apiUrl)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) data = await res.json();
        else data = JSON.parse(await res.text());
        if (mounted && Array.isArray(data)) setSchedule(data);
        setError(null);
      } catch (e) { if (mounted) setError(e.message); }
    };
    fetchSchedule();
    const timer = setInterval(fetchSchedule, refreshInterval);
    const clockTimer = setInterval(() => setNow(new Date()), 15000);
    return () => { mounted = false; clearInterval(timer); clearInterval(clockTimer); };
  }, [apiUrl, refreshInterval]);

  const { onAir, upNext, upcoming } = useMemo(() => {
    if (!schedule.length) return { onAir: null, upNext: null, upcoming: [] };
    let currentShow = null, nextShow = null;
    const laterShows = [];
    for (const show of schedule) {
      const start = new Date(show.broadcaststart);
      const end = new Date(show.broadcastend);
      if (now >= start && now < end) currentShow = show;
      else if (now < start) { if (!nextShow) nextShow = show; else laterShows.push(show); }
    }
    return { onAir: currentShow, upNext: nextShow, upcoming: laterShows.slice(0, maxUpcoming) };
  }, [schedule, now, maxUpcoming]);

  const bg = background || 'linear-gradient(180deg, #0a0e1a, #111827)';

  if (error && !schedule.length) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: bg, color: '#666' }}>
        <div className="text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#444" className="mx-auto mb-2">
            <path d="M20 6H8.3L12 2.3 10.6.9l-5 5h-.1L4 7.4V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
          </svg>
          <p className="text-sm">Schedule unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: bg, color }}>
      <style>{`
        @keyframes onAirPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(225,29,72,0.2); }
          50% { box-shadow: 0 0 30px rgba(225,29,72,0.4); }
        }
        @keyframes progressShimmer {
          from { background-position: -200% 0; }
          to { background-position: 200% 0; }
        }
        @keyframes schedFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sched-fade { animation: schedFadeIn 0.5s ease-out forwards; }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(15px)', borderBottom: `2px solid ${accentColor}33` }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={accentColor} opacity="0.8">
          <path d="M20 6H8.3L12 2.3 10.6.9l-5 5h-.1L4 7.4V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
        </svg>
        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>{title}</span>
        <span className="ml-auto text-xs opacity-40 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* On Air — Hero */}
      {onAir && (
        <div className="flex gap-4 p-4 sched-fade relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`, animation: 'onAirPulse 3s ease-in-out infinite' }}>
          {/* Accent glow */}
          <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full opacity-20" style={{ background: accentColor, filter: 'blur(40px)' }} />

          {showThumbnails && onAir.thumbnail && (
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ boxShadow: `0 4px 20px ${accentColor}33` }}>
              <img src={onAir.thumbnail} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 60%, rgba(0,0,0,0.4))' }} />
            </div>
          )}
          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] text-white"
                style={{ background: accentColor }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                ON AIR
              </span>
              <span className="text-xs opacity-40 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(onAir.broadcaststart)} – {formatTime(onAir.broadcastend)}
              </span>
            </div>
            <h2 className={`font-black leading-tight truncate ${compact ? 'text-base' : 'text-xl'}`}>
              {decodeHtml(onAir.name)}
            </h2>
            {showGenres && getGenreTags(onAir.tags).length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {getGenreTags(onAir.tags).map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wider"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {/* Progress bar */}
            <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${getShowProgress(onAir.broadcaststart, onAir.broadcastend)}%`,
                  background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)`,
                  backgroundSize: '200% 100%',
                  animation: 'progressShimmer 2s linear infinite',
                }} />
            </div>
          </div>
        </div>
      )}

      {/* Up Next */}
      {upNext && (
        <div className="flex gap-3 px-4 py-3 sched-fade" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', animationDelay: '0.15s', opacity: 0 }}>
          {showThumbnails && upNext.thumbnail && !compact && (
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 opacity-70">
              <img src={upNext.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-35">Up Next</span>
              <span className="text-[10px] opacity-25 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(upNext.broadcaststart)} – {formatTime(upNext.broadcastend)}
              </span>
            </div>
            <p className="text-sm font-semibold truncate opacity-70">{decodeHtml(upNext.name)}</p>
          </div>
        </div>
      )}

      {/* Remaining schedule */}
      {upcoming.length > 0 && (
        <div className="flex-1 overflow-hidden px-4 py-2">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-25 mb-2.5 font-bold">Later Today</p>
          <div className="space-y-1">
            {upcoming.map((show, i) => (
              <div key={show.uid || i} className="flex items-center gap-3 py-1.5 sched-fade"
                style={{ animationDelay: `${0.3 + i * 0.1}s`, opacity: 0 }}>
                <span className="text-xs opacity-30 w-14 flex-shrink-0 font-mono text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(show.broadcaststart)}
                </span>
                <div className="w-px h-4 opacity-10 bg-white" />
                <span className="text-sm truncate opacity-50">{decodeHtml(show.name)}</span>
                {showGenres && getGenreTags(show.tags).length > 0 && (
                  <span className="ml-auto text-[10px] opacity-20 flex-shrink-0">{getGenreTags(show.tags)[0]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
