/**
 * Shared bits for the Ayr Pavilion signage modules (What's On, Calendar Timeline).
 */
import { useEffect, useRef, useState } from 'react';

export const FONT_ID = 'pavilion-whatson-fonts';
export const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500;600;700;800&display=swap';
export const DISPLAY = "'Anton', Impact, 'Arial Narrow Bold', system-ui, sans-serif";
export const BODY = "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const BG = '#070b18';
export const INK = '#f3f6ff';
export const MUTED = '#9fb0d4';
export const GOLD = '#ffd24a';
export const LINE = 'rgba(255,255,255,0.10)';

export function useFonts() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(FONT_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_ID; link.rel = 'stylesheet'; link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

/** Measure the module's own box (modules never trust the window — they may be previewed in the editor). */
export function useBox(initial = { w: 1080, h: 1920 }) {
  const ref = useRef(null);
  const [box, setBox] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

export function useClock(stepMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), stepMs);
    return () => clearInterval(iv);
  }, [stepMs]);
  return now;
}

export const gradientText = (a, b) => ({
  background: `linear-gradient(92deg, ${a}, ${b})`,
  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
});
