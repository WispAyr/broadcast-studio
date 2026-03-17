import React, { useState, useEffect, useMemo } from 'react';

/**
 * Now Ayrshire Radio — On Air / Schedule Module
 * Pulls from: /wp-json/proradio/v1/schedule-today-full
 * Shows: current show, up next, and today's remaining schedule
 */

const SCHEDULE_API = 'https://www.nowayrshireradio.co.uk/wp-json/proradio/v1/schedule-today-full';

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014').replace(/&#8211;/g, '\u2013').replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201C').replace(/&#8221;/g, '\u201D');
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function getGenreTags(tags) {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.map(t => t.name).filter(Boolean);
}

export default function NARScheduleModule({ config = {} }) {
  const {
    apiUrl = SCHEDULE_API,
    refreshInterval = 60000,
    background = 'transparent',
    color = '#ffffff',
    accentColor = '#e11d48',
    showThumbnails = true,
    showGenres = true,
    maxUpcoming = 4,
    title = 'NOW AYRSHIRE RADIO',
    compact = false,
  } = config;

  const [schedule, setSchedule] = useState([]);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let mounted = true;
    const fetchSchedule = async () => {
      try {
        const proxyUrl = `/api/proxy/fetch?url=${encodeURIComponent(apiUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          data = JSON.parse(text);
        }
        if (mounted && Array.isArray(data)) setSchedule(data);
        setError(null);
      } catch (e) {
        if (mounted) setError(e.message);
      }
    };
    fetchSchedule();
    const timer = setInterval(fetchSchedule, refreshInterval);
    const clockTimer = setInterval(() => setNow(new Date()), 15000);
    return () => { mounted = false; clearInterval(timer); clearInterval(clockTimer); };
  }, [apiUrl, refreshInterval]);

  const { onAir, upNext, upcoming } = useMemo(() => {
    if (!schedule.length) return { onAir: null, upNext: null, upcoming: [] };

    let currentShow = null;
    let nextShow = null;
    const laterShows = [];

    for (let i = 0; i < schedule.length; i++) {
      const show = schedule[i];
      const start = new Date(show.broadcaststart);
      const end = new Date(show.broadcastend);

      if (now >= start && now < end) {
        currentShow = show;
      } else if (now < start) {
        if (!nextShow) {
          nextShow = show;
        } else {
          laterShows.push(show);
        }
      }
    }

    return {
      onAir: currentShow,
      upNext: nextShow,
      upcoming: laterShows.slice(0, maxUpcoming),
    };
  }, [schedule, now, maxUpcoming]);

  if (error && !schedule.length) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <div className="text-center">
          <p className="text-3xl mb-2">📻</p>
          <p className="text-sm">Schedule unavailable</p>
          <p className="text-xs opacity-50 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background, color }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `2px solid ${accentColor}` }}>
        <span className="text-lg">📻</span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {title}
        </span>
        <span className="ml-auto text-xs opacity-50">
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* On Air — Hero */}
      {onAir && (
        <div className="flex gap-3 p-4" style={{ background: `${accentColor}15` }}>
          {showThumbnails && onAir.thumbnail && (
            <img
              src={onAir.thumbnail}
              alt=""
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              style={{ boxShadow: `0 0 20px ${accentColor}33` }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-white"
                style={{ background: accentColor }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                On Air
              </span>
              <span className="text-xs opacity-50">
                {formatTime(onAir.broadcaststart)} – {formatTime(onAir.broadcastend)}
              </span>
            </div>
            <h2 className={`font-bold leading-tight truncate ${compact ? 'text-base' : 'text-xl'}`}>
              {decodeHtml(onAir.name)}
            </h2>
            {showGenres && getGenreTags(onAir.tags).length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {getGenreTags(onAir.tags).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Up Next */}
      {upNext && (
        <div className="flex gap-3 px-4 py-3 border-b border-white/5">
          {showThumbnails && upNext.thumbnail && !compact && (
            <img src={upNext.thumbnail} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 opacity-80" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">Up Next</span>
              <span className="text-[10px] opacity-30">
                {formatTime(upNext.broadcaststart)} – {formatTime(upNext.broadcastend)}
              </span>
            </div>
            <p className="text-sm font-semibold truncate opacity-80">{decodeHtml(upNext.name)}</p>
          </div>
        </div>
      )}

      {/* Remaining schedule */}
      {upcoming.length > 0 && (
        <div className="flex-1 overflow-hidden px-4 py-2">
          <p className="text-[10px] uppercase tracking-widest opacity-30 mb-2 font-semibold">Later Today</p>
          <div className="space-y-1.5">
            {upcoming.map((show, i) => (
              <div key={show.uid || i} className="flex items-center gap-3 py-1">
                <span className="text-xs opacity-40 w-20 flex-shrink-0">
                  {formatTime(show.broadcaststart)}
                </span>
                <span className="text-sm truncate opacity-60">{decodeHtml(show.name)}</span>
                {showGenres && getGenreTags(show.tags).length > 0 && (
                  <span className="ml-auto text-[10px] opacity-30 flex-shrink-0">
                    {getGenreTags(show.tags)[0]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
