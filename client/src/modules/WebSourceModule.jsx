import React, { useState, useEffect, useRef } from 'react';
import { xpVars, bridgeable, postVars } from '../lib/xpVarsBridge.js';

export default function WebSourceModule({ config = {} }) {
  const url = config.url || config.src || '';
  const refreshInterval = (config.refreshInterval || 0) * 1000;
  const zoom = config.zoom || 100;
  const useProxy = config.useProxy || false;
  const background = config.background || '#000000';
  const scrollX = config.scrollX || 0;
  const scrollY = config.scrollY || 0;

  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef(null);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval || !url) return;
    const interval = setInterval(() => setRefreshKey(k => k + 1), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, url]);

  // Scroll position
  useEffect(() => {
    if (!iframeRef.current || (!scrollX && !scrollY)) return;
    const iframe = iframeRef.current;
    const onLoad = () => {
      try {
        iframe.contentWindow.scrollTo(scrollX, scrollY);
      } catch {
        // Cross-origin, can't scroll
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [scrollX, scrollY, refreshKey]);

  // Crosspoint variables (xp:*) → same-origin pages: snapshot on load, then each change (see lib/xpVarsBridge.js).
  const src0 = useProxy ? `/api/proxy/fetch?url=${encodeURIComponent(url)}` : url;
  useEffect(() => {
    const iframe = iframeRef.current;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!iframe || !bridgeable(src0, origin, useProxy)) return;
    const onLoad = () => postVars(iframe.contentWindow, xpVars.snapshot(), origin);
    iframe.addEventListener('load', onLoad);
    const unsub = xpVars.subscribe((changed) => postVars(iframe.contentWindow, changed, origin));
    return () => { iframe.removeEventListener('load', onLoad); unsub(); };
  }, [src0, useProxy, refreshKey]);

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <span className="text-sm">No URL configured</span>
      </div>
    );
  }

  const src = useProxy ? `/api/proxy/fetch?url=${encodeURIComponent(url)}` : url;

  return (
    <div className="w-full h-full overflow-hidden" style={{ background }}>
      <iframe
        ref={iframeRef}
        key={refreshKey}
        src={src}
        className="border-0"
        style={{
          width: `${10000 / zoom}%`,
          height: `${10000 / zoom}%`,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
        }}
        title="Web Source"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
