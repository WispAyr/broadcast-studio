import React, { useState, useEffect, useRef } from 'react';

export default function RSSModule({ config = {} }) {
  const feedUrl = config.feedUrl || config.url || '';
  const refreshInterval = (config.refreshInterval || 300) * 1000;
  const maxItems = config.maxItems || 10;
  const displayStyle = config.displayStyle || 'cards';
  const background = config.background || '#000000';
  const color = config.color || '#ffffff';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickerOffset, setTickerOffset] = useState(0);
  const tickerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!feedUrl) { setLoading(false); return; }

    let cancelled = false;
    async function fetchFeed() {
      try {
        const res = await fetch(`/api/proxy/rss?url=${encodeURIComponent(feedUrl)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setItems((data.items || []).slice(0, maxItems));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFeed();
    const interval = setInterval(fetchFeed, refreshInterval);
    return () => { cancelled = true; clearInterval(interval); };
  }, [feedUrl, refreshInterval, maxItems]);

  // Ticker animation
  useEffect(() => {
    if (displayStyle !== 'ticker' || items.length === 0) return;
    const speed = config.tickerSpeed || 60; // px/s
    let offset = 0;
    let last = performance.now();

    function animate(now) {
      const dt = (now - last) / 1000;
      last = now;
      offset -= speed * dt;
      const el = tickerRef.current;
      if (el && offset < -el.scrollWidth) offset = window.innerWidth;
      setTickerOffset(offset);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [displayStyle, items, config.tickerSpeed]);

  if (!feedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <span className="text-sm">No feed URL configured</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color }}>
        <span className="text-sm opacity-60">Loading feed...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#ef4444' }}>
        <span className="text-sm">Feed error: {error}</span>
      </div>
    );
  }

  // Ticker style
  if (displayStyle === 'ticker') {
    const tickerText = items.map(i => i.title).join('  ●  ');
    return (
      <div className="w-full h-full flex items-center overflow-hidden" style={{ background, color }}>
        <div
          ref={tickerRef}
          className="whitespace-nowrap text-lg font-medium"
          style={{ transform: `translateX(${tickerOffset}px)` }}
        >
          {tickerText}
        </div>
      </div>
    );
  }

  // List style
  if (displayStyle === 'list') {
    return (
      <div className="w-full h-full overflow-y-auto p-3" style={{ background, color }}>
        {items.map((item, i) => (
          <div key={i} className="py-2 border-b border-white/10 last:border-0">
            <p className="text-sm font-semibold leading-tight">{item.title}</p>
            {item.pubDate && (
              <p className="text-xs opacity-50 mt-0.5">{new Date(item.pubDate).toLocaleString()}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Cards style (default)
  return (
    <div className="w-full h-full overflow-y-auto p-3 space-y-2" style={{ background, color }}>
      {items.map((item, i) => (
        <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-sm font-semibold leading-tight">{item.title}</p>
          {item.description && (
            <p className="text-xs opacity-70 mt-1 line-clamp-2">{item.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {item.source && <span className="text-xs opacity-40">{item.source}</span>}
            {item.pubDate && (
              <span className="text-xs opacity-40">{new Date(item.pubDate).toLocaleString()}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
