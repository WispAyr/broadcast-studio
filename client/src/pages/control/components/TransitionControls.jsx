import React from 'react';

const TRANSITION_TYPES = [
  { id: 'cut', label: 'Cut', icon: '⚡' },
  { id: 'crossfade', label: 'Crossfade', icon: '🔄' },
  { id: 'slide-left', label: 'Slide L', icon: '◀' },
  { id: 'slide-right', label: 'Slide R', icon: '▶' },
  { id: 'zoom', label: 'Zoom', icon: '🔍' },
  { id: 'dissolve', label: 'Dissolve', icon: '✨' },
  { id: 'wipe', label: 'Wipe', icon: '🔲' },
];

export default function TransitionControls({ transitionType, setTransitionType, transitionDuration, setTransitionDuration }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
      <span className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Trans</span>
      <div className="flex gap-1">
        {TRANSITION_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setTransitionType(t.id)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
              transitionType === t.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="range"
          min="0.3"
          max="3"
          step="0.1"
          value={transitionDuration}
          onChange={e => setTransitionDuration(parseFloat(e.target.value))}
          className="w-16 h-1 accent-blue-500"
        />
        <span className="text-gray-400 text-[10px] font-mono w-6">{transitionDuration}s</span>
      </div>
    </div>
  );
}

export { TRANSITION_TYPES };
