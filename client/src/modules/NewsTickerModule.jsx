import React, { useState, useEffect, useRef } from 'react';

export default function NewsTickerModule({ config = {} }) {
  const feedUrls = (config.feedUrls || config.feedUrl || 'https://feeds.bbci.co.uk/news/rss.xml').split(',').map(u => u.trim()).filter(Boolean);
  const speed = config.speed || 80; // px/s
  const separator = config.separator || '  ●  ';
  const background = config.background || '#cc0000';
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
            const items = (data.items || []).slice(0, 8);
            items.forEach(item => {
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

  // Scroll animation
  useEffect(() => {
    if (headlines.length === 0) return;
    let pos = 0;
    let last = performance.now();

    function animate(now) {
      const dt = (now - last) / 1000;
      last = now;
      pos -= speed * dt;
      const el = textRef.current;
      const container = containerRef.current;
      if (el && container && pos < -el.scrollWidth / 2) {
        pos += el.scrollWidth / 2;
      }
      setOffset(pos);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [headlines, speed]);

  const tickerText = headlines.map(h =>
    showSource ? `${h.source}: ${h.title}` : h.title
  ).join(separator);

  // Double the text for seamless loop
  const doubledText = tickerText + separator + tickerText;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center overflow-hidden"
      style={{ background, color, fontSize }}
    >
      {headlines.length === 0 ? (
        <span className="px-4 opacity-60 text-sm">Loading headlines...</span>
      ) : (
        <div
          ref={textRef}
          className="whitespace-nowrap font-medium"
          style={{ transform: `translateX(${offset}px)` }}
        >
          {doubledText}
        </div>
      )}
    </div>
  );
}
