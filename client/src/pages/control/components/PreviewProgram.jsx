import React from 'react';
import ScreenPreview from '../../../components/ScreenPreview';

// Renders the broadcast PVW / PGM pair with live-rendered previews (actual
// ModuleRenderer output, scaled down — identical to what lands on the wall).
// Falls back to the schematic when a layout has no modules.
function previewHasContent(layout) {
  const raw = layout?.modules;
  if (!raw) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (parsed?.layers) return parsed.layers.some(l => (l.modules || []).length > 0);
      if (parsed?.modules) return (parsed.modules || []).length > 0;
    } catch { return false; }
  }
  if (raw?.layers) return raw.layers.some(l => (l.modules || []).length > 0);
  return false;
}

function LiveOrFallback({ layout, fallbackText }) {
  if (!layout) return <p className="text-gray-600 text-sm">{fallbackText}</p>;
  return previewHasContent(layout)
    ? <ScreenPreview layout={layout} live />
    : <div className="flex items-center justify-center h-full w-full"><p className="text-gray-600 text-xs">Empty layout</p></div>;
}

export default function PreviewProgram({ previewLayout, programLayout, onTake, onCut, transitionType, transitionDuration, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-900 rounded-lg border border-yellow-800/40 overflow-hidden">
          <div className="px-2 py-1 bg-yellow-900/20 border-b border-yellow-800/20 flex items-center justify-between">
            <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">PVW</span>
            {previewLayout && <span className="text-yellow-300/60 text-[10px] truncate ml-1">{previewLayout.name}</span>}
          </div>
          <div className="aspect-video bg-black relative">
            <LiveOrFallback layout={previewLayout} fallbackText="No preview" />
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onCut} disabled={!previewLayout}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">Cut</button>
          <button onClick={onTake} disabled={!previewLayout}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-700 text-white text-xs font-bold rounded uppercase tracking-wider shadow-lg shadow-red-600/30">TAKE</button>
        </div>
        <div className="flex-1 bg-gray-900 rounded-lg border border-red-800/40 overflow-hidden">
          <div className="px-2 py-1 bg-red-900/20 border-b border-red-800/20 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">PGM</span>
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-red-600 rounded text-[8px] font-bold text-white animate-pulse">
                <span className="w-1 h-1 rounded-full bg-white" />LIVE
              </span>
            </div>
            {programLayout && <span className="text-red-300/60 text-[10px] truncate ml-1">{programLayout.name}</span>}
          </div>
          <div className="aspect-video bg-black relative">
            <LiveOrFallback layout={programLayout} fallbackText="No program" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-gray-900 rounded-xl border border-yellow-800/50 overflow-hidden">
        <div className="px-3 py-1.5 bg-yellow-900/30 border-b border-yellow-800/30 flex items-center justify-between">
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">PVW — Preview</span>
          {previewLayout && <span className="text-yellow-300/70 text-xs">{previewLayout.name}</span>}
        </div>
        <div className="aspect-video bg-black relative">
          <LiveOrFallback layout={previewLayout} fallbackText="Click a layout to preview" />
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl border border-red-800/50 overflow-hidden">
        <div className="px-3 py-1.5 bg-red-900/30 border-b border-red-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-xs font-bold uppercase tracking-wider">PGM — Program</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-600 rounded text-[9px] font-bold text-white animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>LIVE
            </span>
          </div>
          {programLayout && <span className="text-red-300/70 text-xs">{programLayout.name}</span>}
        </div>
        <div className="aspect-video bg-black relative">
          <LiveOrFallback layout={programLayout} fallbackText="No layout live" />
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-center gap-3">
        <button onClick={onCut} disabled={!previewLayout}
          className="px-8 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold rounded-lg transition-colors uppercase tracking-wider">Cut</button>
        <button onClick={onTake} disabled={!previewLayout}
          className="px-12 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-700 text-white font-bold rounded-lg transition-all uppercase tracking-wider text-lg shadow-lg shadow-red-600/30">TAKE</button>
        <span className="text-gray-500 text-xs ml-2">{transitionType} · {transitionDuration}s</span>
      </div>
    </div>
  );
}
