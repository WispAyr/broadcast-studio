import React, { useMemo } from 'react';
import { MODULE_COLORS } from './ScreenPreview';

// LayoutThumb — tiny, *informative* layout thumbnail for lists and hotbars.
//
// Previously these spots drew an empty grid_cols×grid_rows lattice, so every
// layout looked identical. This renders what the layout actually is:
//   • a layout dominated by one image module → the actual image (cover-fit)
//   • otherwise → the module footprints as colour-coded blocks at their real
//     x/y/w/h positions (colours from ScreenPreview's MODULE_COLORS)
//   • no modules → muted empty frame
//
// Pure CSS, no live module rendering — cheap enough for 100+ rows.

function flatten(raw) {
  let m = raw;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { return []; } }
  if (!m) return [];
  if (Array.isArray(m)) return m;
  if (Array.isArray(m.layers)) return m.layers.flatMap(l => (Array.isArray(l?.modules) ? l.modules : []));
  if (Array.isArray(m.modules)) return m.modules;
  return [];
}

export default function LayoutThumb({ layout, className = '', style = {} }) {
  const modules = useMemo(() => flatten(layout?.modules), [layout?.modules]);
  const cols = layout?.grid_cols || layout?.grid_columns || 12;
  const rows = layout?.grid_rows || 8;
  const bg = layout?.background || '#0a0a12';

  // Hero image: one image/media module covering most of the canvas → show it.
  const hero = useMemo(() => {
    const imgs = modules.filter(m => ['image', 'media', 'slideshow'].includes(m.type) && (m.config?.src || m.config?.url));
    if (imgs.length !== 1 || modules.length > 2) return null;
    const m = imgs[0];
    const area = ((m.w || 1) * (m.h || 1)) / (cols * rows);
    return (m.fullscreen || area >= 0.6) ? (m.config.src || m.config.url) : null;
  }, [modules, cols, rows]);

  const frame = `relative overflow-hidden rounded border border-gray-700 bg-gray-950 shrink-0 ${className}`;

  if (hero) {
    return (
      <div className={frame} style={style}>
        <img src={hero} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>
    );
  }

  if (!modules.length) {
    return <div className={frame} style={{ ...style, background: bg }} />;
  }

  return (
    <div className={frame} style={{ ...style, background: bg }}>
      {modules.slice(0, 24).map((m, i) => {
        const c = MODULE_COLORS[m.type] || '#475569';
        const fs = m.fullscreen;
        return (
          <div key={m.id || i} style={{
            position: 'absolute',
            left: fs ? 0 : `${((m.x || 0) / cols) * 100}%`,
            top: fs ? 0 : `${((m.y || 0) / rows) * 100}%`,
            width: fs ? '100%' : `${((m.w || 1) / cols) * 100}%`,
            height: fs ? '100%' : `${((m.h || 1) / rows) * 100}%`,
            background: `${c}55`,
            border: `1px solid ${c}99`,
            borderRadius: 1,
          }} />
        );
      })}
    </div>
  );
}
