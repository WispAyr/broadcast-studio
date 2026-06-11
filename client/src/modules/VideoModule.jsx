import React, { useRef } from 'react';

export default function VideoModule({ config = {}, socket }) {
  const src = config.src || config.url || '';
  const autoplay = config.autoplay !== false;
  // A return layout implies VT-style one-shot playback, so it disables loop.
  const returnLayoutId = config.returnLayoutId || '';
  const loop = config.loop !== false && !returnLayoutId;
  const muted = config.muted !== false;
  const endedRef = useRef(false);

  function handleEnded() {
    if (!returnLayoutId || endedRef.current) return;
    endedRef.current = true;
    // Ask the server to put this screen back on the configured layout. Only
    // registered screen sockets carry a screenId, so editor previews are inert.
    try { socket?.emit('vt_ended', { returnLayoutId }); } catch { /* no socket — preview */ }
  }

  if (!src) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-sm">No video set</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ background: config.background || '#000' }}>
      <video
        src={src}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        onEnded={handleEnded}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
