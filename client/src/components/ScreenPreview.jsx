import React from 'react';

export default function ScreenPreview({ layout }) {
  if (!layout) return null;

  const gridRows = layout.grid_rows || 3;
  const gridColumns = layout.grid_columns || 4;
  const modules = layout.modules || [];

  return (
    <div
      className="rounded border border-gray-700 overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        width: 200,
        height: 120,
        background: layout.background || '#000000',
        gap: '1px'
      }}
    >
      {modules.map((mod, i) => (
        <div
          key={mod.id || i}
          className="bg-gray-800 border border-gray-700/50 flex items-center justify-center"
          style={{
            gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
            gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
            overflow: 'hidden'
          }}
        >
          <span className="text-[8px] text-gray-400 truncate px-0.5">
            {(mod.module_type || mod.module || 'mod').substring(0, 6)}
          </span>
        </div>
      ))}
    </div>
  );
}
