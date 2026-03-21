import React, { useState, useEffect, useRef } from 'react';

export default function NewsTickerModule({ config = {} }) {
  const feedUrls = (config.feedUrls || config.feedUrl || 'https://feeds.bbci.co.uk/news/rss.xml').split(',').map(u => u.trim()).filter(Boolean);
  const speed = config.speed || 80;
  const separator = config.separator || '  ●  ';
  const background = config.background;
  const color = config.color || '#ffffff';
  const fontSize = config.fontSize || '1.1rem';
  const showSource = config.showSource !== false;
  const refreshInterval = (config.refreshInterval || 300) * 1000;

  const [headlines, setHeadlines] = useState([]);
  const [offset, setOffset] = useState(0);
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      const allItems = [];
      for (const url of feedUrls) {
        try {
          const res = await fetch(`/api/proxy/rss?url=${encodeURIComponent(url)}`);
          if (res.ok) {
            const data = await res.json();
            (data.items || []).slice(0, 8).forEach(item => {
              allItems.push({
                title: item.title,
                source: item.source || new URL(url).hostname.replace('feeds.', '').replace('www.', ''),
              });
            });
          }
        } catch {}
      }
      if (!cancelled) setHeadlines(allItems);
    }
    fetchAll();
    const interval = setInterval(fetchAll, refreshInterval);
    return () => { cancelled = true; clearInterval(interval); };
  }, [feedUrls.join(','), refreshInterval]);

  useEffect(() => {
    if (headlines.length === 0) return;
    let pos = 0, last = performance.now();
    function animate(now) {
      const dt = (now - last) / 1000;
      last = now;
      pos -= speed * dt;
      const el = textRef.current;
      if (el && pos < -el.scrollWidth / 2) pos += el.scrollWidth / 2;
      setOffset(pos);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [headlines, speed]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center overflow-hidden relative"
      style={{ background: background || 'linear-gradient(90deg, #7f1d1d, #991b1b, #b91c1c, #991b1b, #7f1d1d)', color, fontSize }}>
      <style>{`
        @keyframes tickerGradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
      {/* Bottom edge highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.3), transparent)' }} />

      {/* LIVE badge */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 h-full relative z-10"
        style={{ background: 'linear-gradient(135deg, #000000, #1a1a1a)', borderRight: '2px solid rgba(255,255,255,0.1)' }}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#ffffff' }}>NEWS</span>
      </div>

      {/* Ticker content */}
      {headlines.length === 0 ? (
        <span className="px-4 opacity-50 text-sm">Loading headlines...</span>
      ) : (
        <div ref={textRef} className="whitespace-nowrap font-semibold" style={{ transform: `translateX(${offset}px)` }}>
          {headlines.map((h, i) => (
            <React.Fragment key={i}>
              {showSource && (
                <span className="inline-flex items-center mr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.7)', fontSize: '0.7em' }}>
                    {h.source}
                  </span>
                </span>
              )}
              <span>{h.title}</span>
              <span className="mx-4 opacity-30">●</span>
            </React.Fragment>
          ))}
          {/* Duplicate for seamless loop */}
          {headlines.map((h, i) => (
            <React.Fragment key={`d-${i}`}>
              {showSource && (
                <span className="inline-flex items-center mr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.7)', fontSize: '0.7em' }}>
                    {h.source}
                  </span>
                </span>
              )}
              <span>{h.title}</span>
              <span className="mx-4 opacity-30">●</span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(127,29,29,0.9))' }} />
    </div>
  );
}
