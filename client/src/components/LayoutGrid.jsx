import React from 'react';

export default function LayoutGrid({
  rows = 3,
  columns = 4,
  modules = [],
  background = '#000000',
  width,
  height,
  editMode = false,
  selectedModule = null,
  onModuleClick,
  onCellClick,
  renderModule
}) {
  return (
    <div
      className="rounded overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        width: width || '100%',
        height: height || '100%',
        background,
        gap: '2px'
      }}
    >
      {modules.map((mod, i) => (
        <div
          key={mod.id || i}
          onClick={() => onModuleClick && onModuleClick(i, mod)}
          className={`overflow-hidden transition-colors ${
            editMode ? 'cursor-pointer' : ''
          } ${
            selectedModule === i
              ? 'ring-2 ring-blue-500'
              : editMode
              ? 'hover:ring-1 hover:ring-gray-500'
              : ''
          }`}
          style={{
            gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
            gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`
          }}
        >
          {renderModule ? (
            renderModule(mod, i)
          ) : (
            <div className="w-full h-full bg-gray-800 border border-gray-700 flex items-center justify-center">
              <span className="text-xs text-gray-400">
                {mod.module_type || mod.module || 'Module'}
              </span>
            </div>
          )}
        </div>
      ))}

      {/* Empty cells for edit mode */}
      {editMode &&
        Array.from({ length: rows * columns }).map((_, i) => {
          const cellRow = Math.floor(i / columns);
          const cellCol = i % columns;
          // Check if any module occupies this cell
          const isOccupied = modules.some(
            (m) =>
              cellCol >= (m.x || 0) &&
              cellCol < (m.x || 0) + (m.w || 1) &&
              cellRow >= (m.y || 0) &&
              cellRow < (m.y || 0) + (m.h || 1)
          );
          if (isOccupied) return null;
          return (
            <div
              key={`empty-${i}`}
              onClick={() => onCellClick && onCellClick(cellRow, cellCol)}
              className="bg-gray-900/50 border border-gray-800 border-dashed hover:bg-gray-800/50 cursor-pointer transition-colors"
              style={{
                gridRow: `${cellRow + 1}`,
                gridColumn: `${cellCol + 1}`
              }}
            />
          );
        })}
    </div>
  );
}
