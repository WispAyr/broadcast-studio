import React, { useEffect, useRef, useState } from 'react';

export default function CameraFeedModule({ config = {} }) {
  const src = config.src || config.url || '';
  const bg = config.background || '#000000';
  const label = config.label || config.name || '';
  const muted = config.muted !== false;
  const autoplay = config.autoplay !== false;

  const videoRef = useRef(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    setError(false);
    setLoaded(false);

    const video = videoRef.current;

    // Check if HLS stream (.m3u8)
    if (src.includes('.m3u8')) {
      // Try native HLS first (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        if (autoplay) video.play().catch(() => {});
      } else {
        // Dynamically load hls.js
        import('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js')
          .then((mod) => {
            const Hls = mod.default;
            if (Hls.isSupported()) {
              const hls = new Hls({ enableWorker: false });
              hls.loadSource(src);
              hls.attachMedia(video);
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (autoplay) video.play().catch(() => {});
              });
              hls.on(Hls.Events.ERROR, () => setError(true));
            } else {
              setError(true);
            }
          })
          .catch(() => {
            // Fall back to direct video src
            video.src = src;
            if (autoplay) video.play().catch(() => {});
          });
      }
    } else {
      // Regular video stream / file
      video.src = src;
      if (autoplay) video.play().catch(() => {});
    }
  }, [src, autoplay]);

  if (!src) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center"
        style={{ background: bg }}
      >
        <span className="text-4xl mb-2 opacity-30">{'\ud83d\udcf7'}</span>
        <span className="text-gray-500 text-sm">No camera feed configured</span>
        {label && <span className="text-gray-600 text-xs mt-1">{label}</span>}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ background: bg }}>
      <video
        ref={videoRef}
        muted={muted}
        autoPlay={autoplay}
        playsInline
        className="w-full h-full object-cover"
        onLoadedData={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {label && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1">
          <span className="text-white text-xs font-medium">{label}</span>
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <span className="text-red-400 text-sm font-medium">Feed Unavailable</span>
          <span className="text-gray-500 text-xs mt-1">{label || src}</span>
        </div>
      )}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-gray-400 text-sm animate-pulse">Connecting...</span>
        </div>
      )}
    </div>
  );
}
