import React from 'react';

export default function LayoutHotbar({ layouts, liveLayoutId, onPush, onBlackout, onQuickText, blackoutActive }) {
  const filtered = layouts.filter(l => !l.name?.includes('Blackout'));

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {filtered.map((layout, i) => {
          const isLive = layout.id === liveLayoutId;
          return (
            <button key={layout.id} onClick={() => onPush(layout.id)}
              className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all border ${isLive ? 'bg-green-900/30 border-green-500/50 shadow-lg shadow-green-500/20' : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-700/60 hover:border-gray-600'}`}
              style={{ minWidth: 90 }}>
              <div className="w-16 h-10 rounded border border-gray-700 overflow-hidden bg-gray-950"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(layout.grid_cols || 3, 6)}, 1fr)`, gridTemplateRows: `repeat(${Math.min(layout.grid_rows || 2, 4)}, 1fr)`, gap: '1px' }}>
                {Array.from({ length: Math.min((layout.grid_cols || 3) * (layout.grid_rows || 2), 24) }).map((_, j) => (
                  <div key={j} className="bg-gray-800/70 rounded-sm" />
                ))}
              </div>
              <span className="text-[10px] font-medium truncate max-w-[80px]" style={{ color: isLive ? '#4ade80' : '#9ca3af' }}>{layout.name}</span>
              {isLive && <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider px-1.5 py-0.5 bg-green-500/20 rounded-full" style={{ textShadow: '0 0 8px rgba(74,222,128,0.5)' }}>LIVE</span>}
              {i < 9 && <span className="text-[9px] text-gray-600 font-mono">{i + 1}</span>}
            </button>
          );
        })}
        <div className="flex-1" />
        {/* Quick Text */}
        {onQuickText && (
          <button onClick={onQuickText}
            className="shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all border bg-purple-900/30 border-purple-700/40 hover:bg-purple-800/40 text-purple-400" style={{ minWidth: 70 }}>
            <span className="text-lg">💬</span>
            <span className="text-[10px] font-medium">Text</span>
          </button>
        )}
        {/* Blackout */}
        {onBlackout && (
          <button onClick={onBlackout}
            className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all border font-bold ${blackoutActive ? 'bg-red-900/50 border-red-500/60 shadow-lg shadow-red-500/30 text-red-400' : 'bg-gray-900/80 border-red-900/40 hover:bg-red-900/30 text-red-500 hover:text-red-400'}`}
            style={{ minWidth: 80, animation: blackoutActive ? 'pulse 2s ease-in-out infinite' : undefined }}>
            <span className="text-2xl">⬛</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Blackout</span>
            <span className="text-[9px] text-gray-600 font-mono">B</span>
          </button>
        )}
      </div>
      {/* Keyboard shortcut hints */}
      <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-gray-800/50">
        {[['1-9', 'Layouts'], ['B', 'Blackout'], ['?', 'Shortcuts']].map(([k, v]) => (
          <span key={k} className="text-gray-700 text-[9px]">
            <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-500 font-mono text-[9px]">{k}</kbd> {v}
          </span>
        ))}
      </div>
    </div>
  );
}
