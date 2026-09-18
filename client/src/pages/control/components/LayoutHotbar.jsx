import React from 'react';
import LayoutThumb from '../../../components/LayoutThumb';

export default function LayoutHotbar({
  layouts,
  liveLayoutId,
  previewLayoutId,
  onPush,
  onDirectPush,
  onBlackout,
  onQuickText,
  blackoutActive,
  armMode = false,
}) {
  const filtered = layouts.filter((l) => !l.name?.includes('Blackout'));
  const shortName = (n = '') => n.replace(/^Card — /, '');

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {filtered.map((layout, i) => {
          const isLive = layout.id === liveLayoutId;
          const isPvw = layout.id === previewLayoutId;
          return (
            <button
              key={layout.id}
              type="button"
              onClick={(e) => {
                if (e.shiftKey && onDirectPush) onDirectPush(layout.id);
                else if (onPush) onPush(layout.id);
              }}
              title={armMode
                ? `${layout.name} — click to arm PVW, Shift+click to take`
                : layout.name}
              className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-all border min-h-[72px] ${
                isLive
                  ? 'bg-green-900/30 border-green-500/50 shadow-lg shadow-green-500/20'
                  : isPvw
                    ? 'bg-yellow-900/30 border-yellow-500/50 shadow-lg shadow-yellow-500/15'
                    : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-700/60 hover:border-gray-600'
              }`}
              style={{ minWidth: 96 }}
            >
              <LayoutThumb layout={layout} className="w-16 h-10" />
              <span
                className="text-xs font-medium truncate max-w-[88px]"
                style={{ color: isLive ? '#4ade80' : isPvw ? '#facc15' : '#d1d5db' }}
              >
                {shortName(layout.name)}
              </span>
              {isLive && (
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider px-1.5 py-0.5 bg-green-500/20 rounded-full">
                  LIVE
                </span>
              )}
              {isPvw && !isLive && (
                <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider px-1.5 py-0.5 bg-yellow-500/20 rounded-full">
                  PVW
                </span>
              )}
              {i < 9 && (
                <span className="text-[10px] text-gray-400 font-mono">{i + 1}</span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        {onQuickText && (
          <button
            type="button"
            onClick={onQuickText}
            className="shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all border bg-purple-900/30 border-purple-700/40 hover:bg-purple-800/40 text-purple-300"
            style={{ minWidth: 72 }}
            aria-label="Quick text"
          >
            <span className="text-lg" aria-hidden="true">💬</span>
            <span className="text-xs font-medium">Text</span>
          </button>
        )}
        {onBlackout && (
          <button
            type="button"
            onClick={onBlackout}
            className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all border font-bold ${
              blackoutActive
                ? 'bg-red-900/50 border-red-500/60 shadow-lg shadow-red-500/30 text-red-400'
                : 'bg-gray-900/80 border-red-900/40 hover:bg-red-900/30 text-red-400 hover:text-red-300'
            }`}
            style={{ minWidth: 80, animation: blackoutActive ? 'pulse 2s ease-in-out infinite' : undefined }}
            aria-label={blackoutActive ? 'Restore from blackout' : 'Blackout all screens'}
          >
            <span className="text-2xl" aria-hidden="true">⬛</span>
            <span className="text-xs font-bold uppercase tracking-wider">Blackout</span>
            <span className="text-[10px] text-gray-400 font-mono">B</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-gray-800/50 flex-wrap">
        {(armMode
          ? [['1-9', 'Arm PVW'], ['⇧1-9', 'Direct take'], ['↵', 'TAKE'], ['B', 'Blackout'], ['?', 'Help']]
          : [['1-9', 'Layouts'], ['B', 'Blackout'], ['?', 'Shortcuts']]
        ).map(([k, v]) => (
          <span key={k} className="text-gray-400 text-[11px]">
            <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px]">{k}</kbd> {v}
          </span>
        ))}
      </div>
    </div>
  );
}
