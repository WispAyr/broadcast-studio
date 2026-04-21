import React, { useMemo, useRef, useState, useEffect } from 'react';
import ModuleRenderer from './ModuleRenderer';
import ErrorBoundary from './ErrorBoundary';
import { getLayers } from '../lib/layers';

// ─── Module type metadata (used only by the schematic fallback) ─────────────
const MODULE_COLORS = {
  clock: '#3b82f6', time: '#3b82f6', time_local: '#3b82f6',
  weather: '#06b6d4', weather_radar: '#06b6d4',
  text: '#8b5cf6', live_text: '#a855f7', autocue: '#a855f7',
  image: '#10b981', media: '#10b981', slideshow: '#10b981',
  youtube: '#ef4444', video: '#ef4444', camera_feed: '#ef4444',
  breaking_news: '#f59e0b', alert_ticker: '#f59e0b', news_ticker: '#f59e0b',
  iframe: '#6366f1', web_source: '#6366f1',
  remotion: '#ec4899', canva: '#ec4899',
  social: '#14b8a6', social_embed: '#14b8a6',
  rss_feed: '#f97316', travel: '#f97316',
  visualizer: '#d946ef', qrcode: '#64748b',
  countdown: '#eab308', color: '#374151',
};

// Compact SVG glyphs replace the old emoji. Kept minimal — these only appear in
// the schematic fallback, where recognisability > artistic fidelity.
const ICON_PATHS = {
  clock:        <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></>,
  time:         <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></>,
  weather:      <><circle cx="17" cy="9" r="3" /><path d="M5 16a4 4 0 0 1 4-4h1a5 5 0 0 1 9 3" /></>,
  text:         <><path d="M5 4h14M5 12h14M5 20h10" /></>,
  live_text:    <><path d="M5 4h14M5 12h8M5 20h14" /></>,
  autocue:      <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h10M7 17h6" /></>,
  image:        <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="8.5" cy="10" r="1.5" /></>,
  media:        <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9v6l5-3Z" /></>,
  slideshow:    <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M17 9v6" /></>,
  youtube:      <><rect x="2" y="6" width="20" height="12" rx="3" /><path d="M10 9v6l5-3Z" /></>,
  video:        <><rect x="3" y="6" width="15" height="12" rx="2" /><path d="m18 10 3-2v8l-3-2Z" /></>,
  camera_feed:  <><path d="M3 7h3l2-3h8l2 3h3v12H3Z" /><circle cx="12" cy="13" r="4" /></>,
  breaking_news:<><circle cx="12" cy="12" r="9" /><path d="M12 7v5M12 16h.01" /></>,
  alert_ticker: <><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></>,
  news_ticker:  <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h10M7 17h6" /></>,
  iframe:       <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  web_source:   <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18" /></>,
  remotion:     <><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" /><path d="m3 9 2-5 4 1-2 4M9 5l4 1-2 4M13 6l4 1-2 4" /></>,
  canva:        <><path d="M12 3a9 9 0 1 0 0 18c1 0 1.8-.8 1.8-1.8 0-.6-.3-1.1-.7-1.5-.4-.4-.7-.9-.7-1.5 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.8-4-6.4-9-6.4Z" /></>,
  social:       <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8 11 8-4M8 13l8 4" /></>,
  rss_feed:     <><path d="M4 4a16 16 0 0 1 16 16" /><path d="M4 11a9 9 0 0 1 9 9" /><circle cx="5" cy="19" r="1.5" fill="currentColor" /></>,
  travel:       <><path d="M3 16v-4l2-5h14l2 5v4" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  visualizer:   <><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 12h2" /></>,
  qrcode:       <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M17 20h4M20 17v4" /></>,
  countdown:    <><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9 2h6" /></>,
  color:        <><circle cx="12" cy="12" r="9" /></>,
};

function SchematicCell({ type, compact }) {
  const paths = ICON_PATHS[type] || ICON_PATHS.color;
  return (
    <div className="flex flex-col items-center gap-0.5 text-gray-300">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ width: compact ? 10 : 14, height: compact ? 10 : 14 }} aria-hidden="true">
        {paths}
      </svg>
      <span className="text-gray-400 truncate px-0.5" style={{ fontSize: compact ? 7 : 9 }}>
        {type.replace(/_/g, ' ')}
      </span>
    </div>
  );
}

function flattenModules(rawModules) {
  const raw = typeof rawModules === 'string' ? JSON.parse(rawModules) : rawModules;
  if (Array.isArray(raw)) return raw;
  if (raw?.layers) return raw.layers.flatMap(l => l.modules || []);
  if (raw?.modules) return Array.isArray(raw.modules) ? raw.modules : [];
  return [];
}

// ─── Live renderer: real ModuleRenderer at native resolution, CSS-scaled ───
//
// Approach mirrors how the Dashboard iframe tiles work, but without iframe
// overhead: render inside a fixed 1920×1080 box, then CSS `transform: scale`
// the box to fit the parent. Modules that use vw/vh units and percent layouts
// then look identical to the real wall.
function LivePreview({ layout, modules, aspectRatio }) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0.2);

  // Track parent width so the scale factor stays correct on resize.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0) setScale(w / NATIVE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gridRows = layout.grid_rows || 3;
  const gridColumns = layout.grid_cols || layout.grid_columns || 4;
  const background = layout.background || '#000000';

  // Layer-aware rendering — same as ScreenDisplay so fullscreen modules and
  // blend modes look right at preview time too.
  let layers;
  try {
    layers = getLayers(modules).sort((a, b) => a.order - b.order);
  } catch {
    layers = [{ id: 'flat', order: 0, visible: true, opacity: 1, modules }];
  }

  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden"
      style={{ paddingBottom: `${(1 / aspectRatio) * 100}%`, background }}
    >
      <div
        style={{
          position: 'absolute', top: 0, left: 0,
          width: NATIVE_W, height: NATIVE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {layers.map((layer) => {
          if (!layer.visible) return null;
          const fs  = (layer.modules || []).filter(m => m.fullscreen);
          const grd = (layer.modules || []).filter(m => !m.fullscreen);
          return (
            <div key={layer.id} style={{ position: 'absolute', inset: 0, opacity: layer.opacity ?? 1, zIndex: layer.order }}>
              {fs.map((mod, i) => (
                <div key={mod.id || `fs-${i}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                  <ErrorBoundary silent name={mod.type || 'module'}>
                    <ModuleRenderer type={mod.type || mod.module || mod.module_type} config={mod.config || {}} moduleId={mod.id} />
                  </ErrorBoundary>
                </div>
              ))}
              {grd.length > 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'grid',
                  gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: '2px',
                }}>
                  {grd.map((mod, i) => (
                    <div key={mod.id || `mod-${i}`} style={{
                      gridRow:    `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
                      gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
                      overflow: 'hidden',
                    }}>
                      <ErrorBoundary silent name={mod.type || 'module'}>
                        <ModuleRenderer type={mod.type || mod.module || mod.module_type} config={mod.config || {}} moduleId={mod.id} />
                      </ErrorBoundary>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NATIVE_W = 1920;
const NATIVE_H = 1080;

// ─── Public component ──────────────────────────────────────────────────────
// Props:
//   layout  — layout row or object (.modules can be string or array of layers)
//   size    — 'normal' | 'large'  (only used by schematic)
//   live    — when true, renders actual modules (ModuleRenderer). When false
//             or undefined, renders the lightweight schematic. Default: false
//             so existing callers keep today's behaviour.
//   fill    — when true, fills the parent container responsively instead of
//             using the fixed size box (useful inside PVW/PGM cards).
export default function ScreenPreview({ layout, size = 'normal', live = false, fill = false }) {
  if (!layout) return null;
  const modules = useMemo(() => flattenModules(layout.modules || []), [layout.modules]);

  if (live) {
    const aspect = (layout.width && layout.height) ? (layout.width / layout.height) : (NATIVE_W / NATIVE_H);
    return <LivePreview layout={layout} modules={modules} aspectRatio={aspect} />;
  }

  const gridRows = layout.grid_rows || 3;
  const gridColumns = layout.grid_cols || layout.grid_columns || 4;
  const isLarge = size === 'large';
  const box = fill
    ? { width: '100%', height: '100%' }
    : { width: isLarge ? 320 : 200, height: isLarge ? 180 : 120 };

  return (
    <div
      className="rounded border border-gray-700 overflow-hidden relative"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        ...box,
        background: layout.background || '#000000',
        gap: '1px',
      }}
    >
      {modules.map((mod, i) => {
        const type = mod.type || mod.module_type || mod.module || 'unknown';
        const color = MODULE_COLORS[type] || '#4b5563';
        return (
          <div
            key={mod.id || i}
            className="flex items-center justify-center overflow-hidden"
            style={{
              gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
              gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
              background: `${color}18`,
              borderLeft: `2px solid ${color}50`,
            }}
          >
            <SchematicCell type={type} compact={!isLarge} />
          </div>
        );
      })}
      {modules.length === 0 && (
        <div className="col-span-full row-span-full flex items-center justify-center">
          <span className="text-gray-600" style={{ fontSize: 10 }}>Empty</span>
        </div>
      )}
    </div>
  );
}
