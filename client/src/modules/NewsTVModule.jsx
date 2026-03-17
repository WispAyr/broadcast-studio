import React, { useState, useEffect, useCallback, useMemo } from 'react';

const PRESET_CHANNELS = [
  { id: 'sky-news', name: 'Sky News', handle: 'SkyNews', logo: '🔵', color: '#0072ce' },
  { id: 'gb-news', name: 'GB News', handle: 'GBNews', logo: '🟠', color: '#e8590c' },
  { id: 'bbc-news', name: 'BBC News', handle: 'BBCNews', logo: '🔴', color: '#bb1919' },
  { id: 'al-jazeera', name: 'Al Jazeera', handle: 'AlJazeeraEnglish', logo: '🟡', color: '#d4a017' },
  { id: 'france24', name: 'France 24', handle: 'FRANCE24English', logo: '🔵', color: '#004a93' },
  { id: 'dw-news', name: 'DW News', handle: 'DWNews', logo: '⚪', color: '#0b85c2' },
  { id: 'euronews', name: 'Euronews', handle: 'euronews', logo: '🔵', color: '#003775' },
  { id: 'abc-aus', name: 'ABC News (AU)', handle: 'ABCNewsAustralia', logo: '🟢', color: '#00843d' },
  { id: 'cna', name: 'CNA', handle: 'channelnewsasia', logo: '🔴', color: '#c40000' },
  { id: 'ndtv', name: 'NDTV', handle: 'ndtv', logo: '🔴', color: '#e51a22' },
  { id: 'times-radio', name: 'Times Radio', handle: 'TimesRadio', logo: '⚫', color: '#1d1d1b' },
  { id: 'tldr-news', name: 'TLDR News', handle: 'TLDRnewsEU', logo: '🟣', color: '#7c3aed' },
];

function buildEmbedUrl(channel, mute = true) {
  // If it has a direct URL/videoId, use that
  if (channel.url) {
    const match = channel.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^?&#]+)/);
    if (match) {
      const params = new URLSearchParams({
        autoplay: '1',
        mute: mute ? '1' : '0',
        rel: '0',
        modestbranding: '1',
        controls: '0',
      });
      return `https://www.youtube.com/embed/${match[1]}?${params.toString()}`;
    }
  }

  // Use channel handle for live embed
  if (channel.handle) {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: mute ? '1' : '0',
      rel: '0',
      modestbranding: '1',
      controls: '0',
    });
    // YouTube supports live embed via channel page embed
    return `https://www.youtube.com/embed/live_stream?channel=${channel.handle}&${params.toString()}`;
  }

  return null;
}

export default function NewsTVModule({ config = {} }) {
  const {
    channels: customChannels,
    defaultChannel,
    autoRotate = false,
    rotateIntervalMs = 300000, // 5 min default
    mute = true,
    showChannelBar = true,
    showControls = false,
    background = '#000000',
    title = 'NEWS',
    barPosition = 'bottom', // 'top' or 'bottom'
    enabledChannels, // array of channel ids to show, null = all presets
  } = config;

  // Build channel list from presets + custom
  const allChannels = useMemo(() => {
    let base = PRESET_CHANNELS;
    if (enabledChannels && Array.isArray(enabledChannels)) {
      base = base.filter(c => enabledChannels.includes(c.id));
    }
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

  const defaultIdx = allChannels.findIndex(c => c.id === defaultChannel);
  const [activeIdx, setActiveIdx] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [isMuted, setIsMuted] = useState(mute);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate || allChannels.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % allChannels.length);
    }, rotateIntervalMs);
    return () => clearInterval(timer);
  }, [autoRotate, rotateIntervalMs, allChannels.length]);

  const activeChannel = allChannels[activeIdx] || allChannels[0];
  const embedUrl = activeChannel ? buildEmbedUrl(activeChannel, isMuted) : null;

  if (!activeChannel) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <div className="text-center">
          <p className="text-4xl mb-2">📺</p>
          <p className="text-sm">No channels configured</p>
        </div>
      </div>
    );
  }

  const barEl = showChannelBar && (
    <div
      className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        borderTop: barPosition === 'bottom' ? '1px solid rgba(255,255,255,0.1)' : 'none',
        borderBottom: barPosition === 'top' ? '1px solid rgba(255,255,255,0.1)' : 'none',
      }}
    >
      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mr-2 flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        {title}
      </span>
      {allChannels.map((ch, idx) => (
        <button
          key={ch.id}
          onClick={() => setActiveIdx(idx)}
          className={`
            px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition-all duration-200
            ${idx === activeIdx
              ? 'text-white shadow-lg scale-105'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
            }
          `}
          style={idx === activeIdx ? {
            background: ch.color,
            boxShadow: `0 0 12px ${ch.color}44`,
          } : {}}
        >
          <span className="mr-1">{ch.logo}</span>
          {ch.name}
        </button>
      ))}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="ml-auto text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10 transition-colors"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col" style={{ background }}>
      {barPosition === 'top' && barEl}
      <div className="flex-1 relative">
        {embedUrl ? (
          <iframe
            key={`${activeChannel.id}-${isMuted}`}
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            title={activeChannel.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-4xl mb-2">{activeChannel.logo}</p>
              <p className="text-lg font-bold">{activeChannel.name}</p>
              <p className="text-sm mt-1 opacity-60">No stream URL available</p>
            </div>
          </div>
        )}
        {/* Channel indicator overlay */}
        {!showChannelBar && (
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
