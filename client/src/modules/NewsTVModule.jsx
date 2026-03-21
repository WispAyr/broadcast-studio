import React, { useState, useEffect, useMemo, useRef } from 'react';

const PRESET_CHANNELS = [
  { id: 'sky-news',    name: 'Sky News',        handle: 'SkyNews',             logo: '🔵', color: '#0072ce' },
  { id: 'bbc-news',   name: 'BBC News',         handle: 'BBCNews',             logo: '🔴', color: '#bb1919' },
  { id: 'gb-news',    name: 'GB News',          handle: 'GBNews',              logo: '🟠', color: '#e8590c' },
  { id: 'al-jazeera', name: 'Al Jazeera',       handle: 'AlJazeeraEnglish',    logo: '🟡', color: '#d4a017' },
  { id: 'france24',   name: 'France 24',        handle: 'FRANCE24English',     logo: '🔵', color: '#004a93' },
  { id: 'dw-news',    name: 'DW News',          handle: 'DWNews',              logo: '⚪', color: '#0b85c2' },
  { id: 'euronews',   name: 'Euronews',         handle: 'euronews',            logo: '🔵', color: '#003775' },
  { id: 'abc-aus',    name: 'ABC News (AU)',     handle: 'ABCNewsAustralia',    logo: '🟢', color: '#00843d' },
  { id: 'cna',        name: 'CNA',              handle: 'channelnewsasia',     logo: '🔴', color: '#c40000' },
  { id: 'times-radio',name: 'Times Radio',      handle: 'TimesRadio',          logo: '⚫', color: '#1d1d1b' },
  { id: 'tldr-news',  name: 'TLDR News',        handle: 'TLDRnewsEU',          logo: '🟣', color: '#7c3aed' },
];

function extractDirectVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^?&#]+)/);
  return m ? m[1] : null;
}

function buildEmbedUrl(videoId, mute) {
  if (!videoId) return null;
  const p = new URLSearchParams({ autoplay: '1', mute: mute ? '1' : '0', rel: '0', modestbranding: '1', controls: '0' });
  return `https://www.youtube.com/embed/${videoId}?${p}`;
}

// Resolve live video ID via server-side scraper (5-min cached)
const resolveCache = new Map();
async function resolveLiveVideoId(handle) {
  const key = handle;
  const cached = resolveCache.get(key);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.videoId;

  try {
    const res = await fetch(`/api/proxy/youtube-live?channel=${encodeURIComponent(handle)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const videoId = data.videoId || null;
    resolveCache.set(key, { videoId, ts: Date.now() });
    return videoId;
  } catch {
    return null;
  }
}

export default function NewsTVModule({ config = {} }) {
  const {
    channels: customChannels,
    defaultChannel,
    autoRotate = false,
    rotateIntervalMs = 300000,
    mute = true,
    showChannelBar = true,
    background = '#000000',
    title = 'NEWS',
    barPosition = 'bottom',
    enabledChannels,
  } = config;

  const allChannels = useMemo(() => {
    let base = PRESET_CHANNELS;
    if (enabledChannels?.length) base = base.filter(c => enabledChannels.includes(c.id));
    const custom = (customChannels || []).map((c, i) => ({
      id: c.id || `custom-${i}`,
      name: c.name || `Channel ${i + 1}`,
      handle: c.handle || null,
      url: c.url || null,
      logo: c.logo || '📺',
      color: c.color || '#666',
    }));
    return [...base, ...custom];
  }, [enabledChannels, customChannels]);

  const defaultIdx = Math.max(0, allChannels.findIndex(c => c.id === defaultChannel));
  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  const [isMuted, setIsMuted] = useState(mute);

  // Per-channel resolved video IDs
  const [videoIds, setVideoIds] = useState({});
  const [resolving, setResolving] = useState({});
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Resolve current + next channel proactively
  useEffect(() => {
    const toResolve = [allChannels[activeIdx]];
    const nextIdx = (activeIdx + 1) % allChannels.length;
    if (nextIdx !== activeIdx) toResolve.push(allChannels[nextIdx]);

    for (const ch of toResolve) {
      if (!ch || videoIds[ch.id] !== undefined || resolving[ch.id]) continue;

      // If it has a direct URL, extract immediately
      const direct = extractDirectVideoId(ch.url);
      if (direct) {
        setVideoIds(prev => ({ ...prev, [ch.id]: direct }));
        continue;
      }

      // Otherwise resolve via server
      if (ch.handle) {
        setResolving(prev => ({ ...prev, [ch.id]: true }));
        resolveLiveVideoId(ch.handle).then(vid => {
          if (!mountedRef.current) return;
          setVideoIds(prev => ({ ...prev, [ch.id]: vid }));
          setResolving(prev => ({ ...prev, [ch.id]: false }));
        });
      }
    }
  }, [activeIdx, allChannels]);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate || allChannels.length <= 1) return;
    const t = setInterval(() => setActiveIdx(p => (p + 1) % allChannels.length), rotateIntervalMs);
    return () => clearInterval(t);
  }, [autoRotate, rotateIntervalMs, allChannels.length]);

  const activeChannel = allChannels[activeIdx];
  const videoId = activeChannel ? videoIds[activeChannel.id] : undefined;
  const isResolving = activeChannel ? !!resolving[activeChannel.id] : false;
  const embedUrl = buildEmbedUrl(videoId, isMuted);

  const barEl = showChannelBar && (
    <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto shrink-0"
      style={{
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(8px)',
        borderTop: barPosition === 'bottom' ? '1px solid rgba(255,255,255,0.08)' : 'none',
        borderBottom: barPosition === 'top' ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}>
      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mr-2 flex items-center gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
        {title}
      </span>
      {allChannels.map((ch, idx) => (
        <button key={ch.id} onClick={() => setActiveIdx(idx)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition-all duration-200 ${
            idx === activeIdx ? 'text-white scale-105' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          style={idx === activeIdx ? { background: ch.color, boxShadow: `0 0 12px ${ch.color}55` } : {}}>
          {ch.logo} {ch.name}
        </button>
      ))}
      <button onClick={() => setIsMuted(m => !m)}
        className="ml-auto text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10 transition-colors shrink-0">
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col" style={{ background }}>
      {barPosition === 'top' && barEl}
      <div className="flex-1 relative min-h-0">
        {embedUrl ? (
          <iframe
            key={`${activeChannel?.id}-${isMuted}-${videoId}`}
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            title={activeChannel?.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center space-y-2">
              <p className="text-5xl">{activeChannel?.logo}</p>
              <p className="text-lg font-bold text-white">{activeChannel?.name}</p>
              {isResolving ? (
                <p className="text-sm text-gray-400 animate-pulse">Finding live stream…</p>
              ) : videoId === null ? (
                <p className="text-sm text-red-400">No live stream found</p>
              ) : (
                <p className="text-sm text-gray-500">Loading…</p>
              )}
            </div>
          </div>
        )}
        {!showChannelBar && activeChannel && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded text-xs font-bold text-white"
            style={{ background: `${activeChannel.color}cc`, backdropFilter: 'blur(4px)' }}>
            {activeChannel.logo} {activeChannel.name}
          </div>
        )}
      </div>
      {barPosition === 'bottom' && barEl}
    </div>
  );
}
