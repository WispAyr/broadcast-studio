import React, { useState, useEffect, useRef, useMemo } from 'react';

const DEFAULT_VIEWS = [
  {
    label: 'Events',
    url: 'https://live.wispayr.online/events',
    seconds: 45,
  },
  {
    label: 'Active Event — Broadcast',
    url: 'https://live.wispayr.online/events?theme=broadcast&refresh=30',
    seconds: 90,
  },
];

export default function SurfaceCarouselModule({ config = {} }) {
  const views = useMemo(() => {
    const raw = Array.isArray(config.views) && config.views.length > 0 ? config.views : DEFAULT_VIEWS;
    return raw
      .map((v) => ({
        label: v.label || '',
        url: v.url || '',
        seconds: Math.max(5, Number(v.seconds) || 45),
      }))
      .filter((v) => v.url);
  }, [config.views]);

  const zoom = Number(config.zoom) || 100;
  const showLabel = config.showLabel !== false;
  const background = config.background || '#000';

  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (views.length === 0) return;
    startRef.current = Date.now();
    const iv = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(iv);
  }, [index, views.length]);

  useEffect(() => {
    if (views.length <= 1) return;
    const current = views[index];
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % views.length);
    }, current.seconds * 1000);
    return () => clearTimeout(timer);
  }, [index, views]);

  useEffect(() => {
    const refreshMs = Number(config.refreshSeconds) > 0 ? Number(config.refreshSeconds) * 1000 : 0;
    if (!refreshMs) return;
    const iv = setInterval(() => setReloadKey((k) => k + 1), refreshMs);
    return () => clearInterval(iv);
  }, [config.refreshSeconds]);

  if (views.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background, color: '#666' }}>
        <span className="text-sm">No views configured</span>
      </div>
    );
  }

  const current = views[index];
  const elapsed = (Date.now() - startRef.current) / 1000;
  const progress = Math.min(1, elapsed / current.seconds);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background }}>
      <iframe
        key={`${index}-${reloadKey}`}
        src={current.url}
        title={current.label || 'Surface view'}
        className="border-0"
        style={{
          width: `${10000 / zoom}%`,
          height: `${10000 / zoom}%`,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="fullscreen; geolocation; camera; microphone"
      />

      {showLabel && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '10px 20px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {views.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i === index ? '#22d3ee' : 'rgba(255,255,255,0.3)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>
            {current.label}
          </span>
          <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 1, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: '#22d3ee',
                transition: 'width 0.25s linear',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
