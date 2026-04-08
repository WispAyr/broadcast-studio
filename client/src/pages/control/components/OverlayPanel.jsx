import React, { useState } from 'react';
import { getSocket } from '../../../lib/socket';

const OVERLAY_TYPES = [
  { id: 'lower_third', label: 'Lower Third', icon: '📝', color: 'blue' },
  { id: 'logo_bug', label: 'Logo Bug', icon: '🎯', color: 'purple' },
  { id: 'countdown', label: 'Countdown', icon: '⏱', color: 'yellow' },
  { id: 'ticker', label: 'Ticker', icon: '📜', color: 'green' },
  { id: 'coming_up', label: 'Coming Up', icon: '➡️', color: 'orange' },
  { id: 'now_playing', label: 'Now Playing', icon: '🎤', color: 'pink' },
  { id: 'announcement', label: 'Announcement', icon: '📢', color: 'red' },
  { id: 'cg_text', label: 'CG Text', icon: '📊', color: 'cyan' },
];

const colorMap = {
  blue: 'bg-blue-600/20 border-blue-600/40 text-blue-400 hover:bg-blue-600/30',
  purple: 'bg-purple-600/20 border-purple-600/40 text-purple-400 hover:bg-purple-600/30',
  yellow: 'bg-yellow-600/20 border-yellow-600/40 text-yellow-400 hover:bg-yellow-600/30',
  green: 'bg-green-600/20 border-green-600/40 text-green-400 hover:bg-green-600/30',
  orange: 'bg-orange-600/20 border-orange-600/40 text-orange-400 hover:bg-orange-600/30',
  pink: 'bg-pink-600/20 border-pink-600/40 text-pink-400 hover:bg-pink-600/30',
  red: 'bg-red-600/20 border-red-600/40 text-red-400 hover:bg-red-600/30',
  cyan: 'bg-cyan-600/20 border-cyan-600/40 text-cyan-400 hover:bg-cyan-600/30',
};

const activeColorMap = {
  blue: 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30',
  purple: 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30',
  yellow: 'bg-yellow-600 border-yellow-500 text-white shadow-lg shadow-yellow-600/30',
  green: 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/30',
  orange: 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/30',
  pink: 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/30',
  red: 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30',
  cyan: 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/30',
};

export default function OverlayPanel({ activeOverlays, setActiveOverlays, collapsed: controlledCollapsed, setCollapsed: controlledSetCollapsed, compact = false, inShell = false }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const setCollapsed = controlledSetCollapsed || setInternalCollapsed;
  const [configOverlay, setConfigOverlay] = useState(null);
  const [overlayConfig, setOverlayConfig] = useState({});

  const studioId = JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || 'default';

  function pushOverlay(type, config = {}) {
    const socket = getSocket();
    socket.emit('push_overlay', { studioId, overlay: { type, ...config, id: `${type}_${Date.now()}` } });
    setActiveOverlays(prev => ({ ...prev, [type]: { ...config, active: true } }));
  }

  function removeOverlay(type) {
    const socket = getSocket();
    socket.emit('remove_overlay', { studioId, overlayType: type });
    setActiveOverlays(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }

  function clearAll() {
    const socket = getSocket();
    socket.emit('clear_overlays', { studioId });
    setActiveOverlays({});
  }

  function toggleOverlay(overlay) {
    if (activeOverlays[overlay.id]) {
      removeOverlay(overlay.id);
    } else {
      setConfigOverlay(overlay);
      setOverlayConfig({});
    }
  }

  function confirmPush() {
    if (!configOverlay) return;
    pushOverlay(configOverlay.id, overlayConfig);
    setConfigOverlay(null);
    setOverlayConfig({});
  }

  const content = (
    <div className={compact ? 'px-1.5 pb-2 space-y-1' : 'px-2 pb-3 space-y-1.5'}>
          {OVERLAY_TYPES.map(ov => {
            const isActive = !!activeOverlays[ov.id];
            return (
              <button
                key={ov.id}
                onClick={() => toggleOverlay(ov)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isActive ? activeColorMap[ov.color] : colorMap[ov.color]
                }`}
              >
                <span>{ov.icon}</span>
                <span className="flex-1 text-left">{ov.label}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
              </button>
            );
          })}

          {Object.keys(activeOverlays).length > 0 && (
            <button
              onClick={clearAll}
              className="w-full mt-2 px-2 py-1.5 rounded-lg border border-red-800/50 bg-red-900/20 text-red-400 text-xs font-medium hover:bg-red-900/40 transition-colors"
            >
              Clear All Overlays
            </button>
          )}
        </div>
      );

      {/* Config modal */}
  const configModal = configOverlay && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 w-full max-w-sm">
        <h3 className="text-white font-semibold mb-3">{configOverlay.icon} {configOverlay.label}</h3>

        {(configOverlay.id === 'lower_third') && (
          <>
            <input value={overlayConfig.name || ''} onChange={e => setOverlayConfig(p => ({ ...p, name: e.target.value }))}
              placeholder="Name" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" autoFocus />
            <input value={overlayConfig.title || ''} onChange={e => setOverlayConfig(p => ({ ...p, title: e.target.value }))}
              placeholder="Title" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" />
          </>
        )}

        {configOverlay.id === 'countdown' && (
          <input type="datetime-local" value={overlayConfig.targetTime || ''} onChange={e => setOverlayConfig(p => ({ ...p, targetTime: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" />
        )}

        {configOverlay.id === 'ticker' && (
          <input value={overlayConfig.text || ''} onChange={e => setOverlayConfig(p => ({ ...p, text: e.target.value }))}
            placeholder="Scrolling text..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" autoFocus />
        )}

        {configOverlay.id === 'coming_up' && (
          <input value={overlayConfig.text || ''} onChange={e => setOverlayConfig(p => ({ ...p, text: e.target.value }))}
            placeholder="Coming up next..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" autoFocus />
        )}

        {configOverlay.id === 'now_playing' && (
          <>
            <input value={overlayConfig.artist || ''} onChange={e => setOverlayConfig(p => ({ ...p, artist: e.target.value }))}
              placeholder="Artist" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" autoFocus />
            <input value={overlayConfig.song || ''} onChange={e => setOverlayConfig(p => ({ ...p, song: e.target.value }))}
              placeholder="Song" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" />
          </>
        )}

        {configOverlay.id === 'announcement' && (
          <>
            <input value={overlayConfig.text || ''} onChange={e => setOverlayConfig(p => ({ ...p, text: e.target.value }))}
              placeholder="Announcement text..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" autoFocus />
            <input type="number" value={overlayConfig.duration || 5} onChange={e => setOverlayConfig(p => ({ ...p, duration: parseInt(e.target.value) }))}
              placeholder="Duration (seconds)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" min="1" max="60" />
          </>
        )}

        {(configOverlay.id === 'cg_text') && (
          <textarea value={overlayConfig.text || ''} onChange={e => setOverlayConfig(p => ({ ...p, text: e.target.value }))}
            placeholder="CG text content..." rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3 resize-none" autoFocus />
        )}

        {configOverlay.id === 'logo_bug' && (
          <input value={overlayConfig.url || ''} onChange={e => setOverlayConfig(p => ({ ...p, url: e.target.value }))}
            placeholder="Logo URL..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-3" autoFocus />
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={() => { setConfigOverlay(null); setOverlayConfig({}); }}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">Cancel</button>
          <button onClick={confirmPush}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Push</button>
        </div>
      </div>
    </div>
  );

  // When rendered inside a PanelShell, just return the content
  if (inShell) {
    return <>{content}{configModal}</>;
  }

  // Standalone rendering with self-managed collapse
  return (
    <div className={`bg-gray-900/80 border border-gray-800 rounded-xl transition-all ${collapsed ? 'w-10' : 'w-64'}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-2 py-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1"
      >
        {collapsed ? '◀' : '▶'} {!collapsed && 'Overlays'}
      </button>
      {!collapsed && content}
      {configModal}
    </div>
  );
}
