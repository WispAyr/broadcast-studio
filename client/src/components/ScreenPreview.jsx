import React, { useMemo } from 'react';
import ModuleRenderer from './ModuleRenderer';

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

function getModuleColor(type) {
  return MODULE_COLORS[type] || '#4b5563';
}

function getModuleIcon(type) {
  const icons = {
    clock: '🕐', time: '🕐', time_local: '🕰',
    weather: '🌤', weather_radar: '🌧',
    text: '📝', live_text: '💬', autocue: '📜',
    image: '🖼', media: '🎬', slideshow: '🎞',
    youtube: '▶️', video: '📹', camera_feed: '📷',
    breaking_news: '🔴', alert_ticker: '⚡', news_ticker: '📰',
    iframe: '🌐', web_source: '🌐',
    remotion: '🎬', canva: '🎨',
    social: '💬', social_embed: '📱',
    rss_feed: '📰', travel: '🚗',
    visualizer: '🎵', qrcode: '📱',
    countdown: '⏱', color: '🎨',
  };
  return icons[type] || '▪️';
}

export default function ScreenPreview({ layout, size = 'normal' }) {
  if (!layout) return null;

  const gridRows = layout.grid_rows || 3;
  const gridColumns = layout.grid_cols || layout.grid_columns || 4;
  const rawModules = layout.modules || [];
  const modules = useMemo(() => {
    const raw = typeof rawModules === 'string' ? JSON.parse(rawModules) : rawModules;
    if (Array.isArray(raw)) return raw;
    if (raw?.layers) return raw.layers.flatMap(l => l.modules || []);
    if (raw?.modules) return Array.isArray(raw.modules) ? raw.modules : [];
    return [];
  }, [rawModules]);

  const isLarge = size === 'large';
  const w = isLarge ? 320 : 200;
  const h = isLarge ? 180 : 120;

  return (
    <div
      className="rounded border border-gray-700 overflow-hidden relative"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        width: w,
        height: h,
        background: layout.background || '#000000',
        gap: '1px',
      }}
    >
      {modules.map((mod, i) => {
        const type = mod.type || mod.module_type || mod.module || 'unknown';
        const color = getModuleColor(type);
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
            <div className="flex flex-col items-center gap-0.5">
              <span style={{ fontSize: isLarge ? 14 : 10 }}>{getModuleIcon(type)}</span>
              <span className="text-gray-400 truncate px-0.5" style={{ fontSize: isLarge ? 10 : 7 }}>
                {type.replace(/_/g, ' ')}
              </span>
            </div>
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
