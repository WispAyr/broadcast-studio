import React, { useMemo } from 'react';

/**
 * TrafficAyrshireModule — embeds the studio view of
 * https://traffic.ayrshire.wispayr.online/studio (NAR Travel).
 *
 * Config:
 *   base:   override base URL (default https://traffic.ayrshire.wispayr.online)
 *   path:   override path (default /studio)
 *   src:    full URL override; if set, base/path are ignored
 *   title:  iframe accessibility title
 *   showLabel: show 'TRAVEL · NAR' overlay (default false — the embedded
 *              page already carries its own branding)
 */
export default function TrafficAyrshireModule({ config = {} }) {
  const {
    base = 'https://traffic.ayrshire.wispayr.online',
    path = '/studio',
    src,
    title = 'NAR Travel — Ayrshire',
    showLabel = false,
  } = config;

  const url = useMemo(() => src || `${base}${path}`, [src, base, path]);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#000' }}>
      <iframe
        key={url}
        src={url}
        title={title}
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        allow="autoplay"
      />
      {showLabel && (
        <div
          className="absolute top-2 left-3 pointer-events-none"
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 11,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}
        >
          TRAVEL · NAR
        </div>
      )}
    </div>
  );
}
