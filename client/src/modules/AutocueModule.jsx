import React, { useState, useEffect, useRef } from 'react';

export default function AutocueModule({ config = {} }) {
  const text = config.text || config.script || 'Welcome to the show.\n\nThis is your autocue script. Edit the module config to set your script text.\n\nThe text will scroll automatically at the configured speed.\n\nYou can pause and resume scrolling by clicking.';
  const speed = config.speed || 40; // pixels per second
  const fontSize = config.fontSize || '2rem';
  const color = config.color || '#ffffff';
  const bg = config.background || '#000000';
  const lineHeight = config.lineHeight || '1.8';
  const mirror = config.mirror || false;

  const [paused, setPaused] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const animRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    setScrollPos(0);
    lastTimeRef.current = null;
  }, [text]);

  useEffect(() => {
    const animate = (timestamp) => {
      if (!paused && contentRef.current && containerRef.current) {
        if (lastTimeRef.current !== null) {
          const delta = (timestamp - lastTimeRef.current) / 1000;
          setScrollPos((prev) => {
            const maxScroll = contentRef.current.scrollHeight - containerRef.current.clientHeight;
            const next = prev + speed * delta;
            return next >= maxScroll ? maxScroll : next;
          });
        }
        lastTimeRef.current = timestamp;
      } else {
        lastTimeRef.current = null;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [paused, speed]);

  const lines = text.split('\n');

  return (
    <div
      ref={containerRef}
      onClick={() => setPaused((p) => !p)}
      className="w-full h-full overflow-hidden cursor-pointer relative"
      style={{
        background: bg,
        transform: mirror ? 'scaleX(-1)' : 'none',
      }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translateY(-${scrollPos}px)`,
          padding: '2rem',
          paddingTop: '100%',
        }}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            style={{
              color,
              fontSize,
              lineHeight,
              margin: '0.5em 0',
              textAlign: 'center',
              fontFamily: 'sans-serif',
            }}
          >
            {line || '\u00A0'}
          </p>
        ))}
      </div>
      {paused && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-600/80 text-white text-xs font-bold rounded">
          PAUSED
        </div>
      )}
    </div>
  );
}
