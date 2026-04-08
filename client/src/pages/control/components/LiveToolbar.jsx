import React from 'react';
import { PANELS } from '../panels/panelRegistry';
import WorkspaceSelector from './WorkspaceSelector';

export default function LiveToolbar({
  panels, togglePanel,
  activeWorkspaceId, workspaces, switchWorkspace, saveWorkspace, deleteWorkspace, resetWorkspace,
  onlineCount, screenCount, blackoutActive, onBlackout, onQuickText, audioBroadcast, onToggleAudio, audioLevel,
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/95 border-b border-gray-800 shrink-0"
      style={{ backdropFilter: 'blur(12px)' }}>
      {/* Panel toggle buttons */}
      <div className="flex items-center gap-1">
        {PANELS.map(panel => {
          const isVisible = panels[panel.id]?.visible;
          return (
            <button
              key={panel.id}
              onClick={() => togglePanel(panel.id)}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-all ${
                isVisible
                  ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30'
                  : 'bg-gray-800/40 text-gray-600 hover:text-gray-400 hover:bg-gray-800'
              }`}
              title={`${panel.label} (${isVisible ? 'visible' : 'hidden'})`}
            >
              {panel.icon}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-gray-700/50 mx-1" />

      {/* Workspace selector */}
      <WorkspaceSelector
        activeWorkspaceId={activeWorkspaceId}
        workspaces={workspaces}
        onSwitch={switchWorkspace}
        onSave={saveWorkspace}
        onDelete={deleteWorkspace}
        onReset={resetWorkspace}
      />

      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-gray-500">{screenCount} screens</span>
        <span className={`flex items-center gap-1 ${onlineCount > 0 ? 'text-green-400' : 'text-gray-600'}`}>
          {onlineCount > 0 && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
          )}
          {onlineCount} online
        </span>
      </div>

      <div className="w-px h-5 bg-gray-700/50 mx-1" />

      {/* Quick actions */}
      <div className="flex items-center gap-1">
        <button onClick={onToggleAudio}
          className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 transition-all ${
            audioBroadcast ? 'bg-green-600/20 text-green-400 ring-1 ring-green-500/30' : 'bg-gray-800/40 text-gray-500 hover:text-gray-300'
          }`}>
          🎵 {audioBroadcast ? 'Live' : 'Audio'}
          {audioBroadcast && (
            <span className="w-6 h-1.5 bg-green-900 rounded-full overflow-hidden">
              <span className="h-full bg-green-400 block rounded-full transition-all" style={{ width: `${(audioLevel || 0) * 100}%` }} />
            </span>
          )}
        </button>
        <button onClick={onQuickText}
          className="px-2 py-1 rounded-md text-[10px] font-medium bg-gray-800/40 text-gray-500 hover:text-purple-400 transition-colors">
          💬 Text
        </button>
        <button onClick={onBlackout}
          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
            blackoutActive
              ? 'bg-red-600/30 text-red-400 ring-1 ring-red-500/30 animate-pulse'
              : 'bg-gray-800/40 text-gray-500 hover:text-red-400'
          }`}>
          ⬛ {blackoutActive ? 'BLACKOUT' : 'Blackout'}
        </button>
      </div>
    </div>
  );
}
