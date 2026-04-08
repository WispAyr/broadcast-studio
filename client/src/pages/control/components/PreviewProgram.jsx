import React from 'react';
import ScreenPreview from '../../../components/ScreenPreview';

export default function PreviewProgram({ previewLayout, programLayout, onTake, onCut, transitionType, transitionDuration, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* PVW compact */}
        <div className="flex-1 bg-gray-900 rounded-lg border border-yellow-800/40 overflow-hidden">
          <div className="px-2 py-1 bg-yellow-900/20 border-b border-yellow-800/20 flex items-center justify-between">
            <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">PVW</span>
            {previewLayout && <span className="text-yellow-300/60 text-[10px] truncate ml-1">{previewLayout.name}</span>}
          </div>
          <div className="aspect-video bg-black flex items-center justify-center" style={{ maxHeight: 80 }}>
            {previewLayout ? <ScreenPreview layout={previewLayout} /> : <p className="text-gray-700 text-[10px]">No preview</p>}
          </div>
        </div>
        {/* Take/Cut compact */}
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onCut} disabled={!previewLayout}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">Cut</button>
          <button onClick={onTake} disabled={!previewLayout}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-700 text-white text-xs font-bold rounded uppercase tracking-wider shadow-lg shadow-red-600/30">TAKE</button>
        </div>
        {/* PGM compact */}
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
          <div className="aspect-video bg-black flex items-center justify-center" style={{ maxHeight: 80 }}>
            {programLayout ? <ScreenPreview layout={programLayout} /> : <p className="text-gray-700 text-[10px]">No program</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Preview (PVW) */}
      <div className="bg-gray-900 rounded-xl border border-yellow-800/50 overflow-hidden">
        <div className="px-3 py-1.5 bg-yellow-900/30 border-b border-yellow-800/30 flex items-center justify-between">
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">PVW — Preview</span>
          {previewLayout && <span className="text-yellow-300/70 text-xs">{previewLayout.name}</span>}
        </div>
        <div className="aspect-video bg-black flex items-center justify-center relative">
          {previewLayout ? <ScreenPreview layout={previewLayout} /> : <p className="text-gray-600 text-sm">Click a layout to preview</p>}
        </div>
      </div>
      {/* Program (PGM) */}
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
        <div className="aspect-video bg-black flex items-center justify-center">
          {programLayout ? <ScreenPreview layout={programLayout} /> : <p className="text-gray-600 text-sm">No layout live</p>}
        </div>
      </div>
      {/* Take / Cut buttons */}
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
