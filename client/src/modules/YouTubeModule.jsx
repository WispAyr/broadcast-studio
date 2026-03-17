import React, { useMemo } from 'react';

function parseYouTubeInput(input) {
  if (!input) return null;

  // Live stream URL
  const liveMatch = input.match(/youtube\.com\/live\/([^?&]+)/);
  if (liveMatch) return { type: 'video', id: liveMatch[1] };

  // Standard video URL
  const videoMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^?&#]+)/);
  if (videoMatch) return { type: 'video', id: videoMatch[1] };

  // Playlist URL
  const playlistMatch = input.match(/youtube\.com\/.*[?&]list=([^?&#]+)/);
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };

  // Channel live embed
  const channelMatch = input.match(/youtube\.com\/(channel|c|@)\/([^/?&#]+)/);
  if (channelMatch) return { type: 'channel', id: channelMatch[2] };

  // Direct video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return { type: 'video', id: input };

  // Playlist ID
  if (input.startsWith('PL') || input.startsWith('UU') || input.startsWith('RD')) {
    return { type: 'playlist', id: input };
  }

  return null;
}

export default function YouTubeModule({ config = {} }) {
  const input = config.url || config.src || config.videoId || '';
  const autoplay = config.autoplay !== false;
  const mute = config.mute !== false;
  const loop = config.loop || false;
  const background = config.background || '#000000';

  const parsed = useMemo(() => parseYouTubeInput(input), [input]);

  if (!parsed) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <div className="text-center">
          <p className="text-2xl mb-2">▶</p>
          <p className="text-sm">No YouTube URL configured</p>
          <p className="text-xs opacity-50 mt-1">Supports videos, live streams, playlists</p>
        </div>
      </div>
    );
  }

  const params = new URLSearchParams();
  if (autoplay) params.set('autoplay', '1');
  if (mute) params.set('mute', '1');
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('controls', config.showControls ? '1' : '0');

  let embedUrl;
  if (parsed.type === 'playlist') {
    params.set('listType', 'playlist');
    params.set('list', parsed.id);
    embedUrl = `https://www.youtube.com/embed?${params.toString()}`;
  } else {
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', parsed.id);
    }
    embedUrl = `https://www.youtube.com/embed/${parsed.id}?${params.toString()}`;
  }

  return (
    <div className="w-full h-full" style={{ background }}>
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        title="YouTube"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
