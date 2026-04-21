import React, { useState } from 'react';
import ScreenPreview from '../../../components/ScreenPreview';
import api from '../../../lib/api';

function formatLastSeen(ls) {
  if (!ls) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ls)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(ls).toLocaleTimeString();
}

export default function LiveScreenGrid({ screens, layouts, onPushLayout, fetchData }) {
  const [dropdownOpen, setDropdownOpen] = useState(null);

  function getLayoutForScreen(screen) {
    if (screen.current_layout) return screen.current_layout;
    if (screen.current_layout_id) {
      const l = layouts.find(l => l.id === screen.current_layout_id);
      if (l) return { ...l, modules: typeof l.modules === 'string' ? JSON.parse(l.modules) : (l.modules || []) };
    }
    return null;
  }

  function getLayoutName(id) { return layouts.find(l => l.id === id)?.name || 'None'; }

  async function handlePush(screenId, layoutId) {
    try {
      await api.post(`/screens/${screenId}/layout`, { layout_id: layoutId });
      setDropdownOpen(null);
      fetchData?.();
    } catch (err) {
      console.error('Failed to push layout:', err);
    }
  }

  async function toggleLock(screen, e) {
    e.stopPropagation();
    const next = screen.accepts_broadcasts ? 0 : 1;
    try {
      await api.put(`/screens/${screen.id}`, { accepts_broadcasts: next });
      fetchData?.();
    } catch (err) {
      console.error('Lockout toggle failed:', err);
    }
  }

  if (screens.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No screens registered
      </div>
    );
  }

  const cols = screens.length <= 2 ? 2 : screens.length <= 4 ? 2 : screens.length <= 9 ? 3 : 4;

  return (
    <div className={`grid gap-2 p-2 h-full auto-rows-fr`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {screens.map(screen => {
        const layout = getLayoutForScreen(screen);
        const isOnline = screen.is_online;
        return (
          <div key={screen.id} className={`relative bg-gray-900 rounded-lg border overflow-hidden flex flex-col ${
            isOnline ? 'border-gray-700/60' : 'border-gray-800/40'
          }`}>
            {/* Preview */}
            <div className="flex-1 bg-gray-950 flex items-center justify-center min-h-0 relative">
              {layout ? <ScreenPreview layout={layout} /> : (
                <span className="text-gray-700 text-[10px] font-mono uppercase">No Layout</span>
              )}
              {/* Status badge + padlock */}
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <button
                  onClick={e => toggleLock(screen, e)}
                  title={screen.accepts_broadcasts === 0 ? 'Locked out of studio-wide pushes. Click to unlock.' : 'Accepts studio-wide pushes. Click to lock.'}
                  className={`p-1 rounded-full backdrop-blur-sm transition-colors ${screen.accepts_broadcasts === 0 ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/40' : 'bg-gray-800/80 text-gray-500 ring-1 ring-gray-700/30 hover:text-gray-300'}`}>
                  {screen.accepts_broadcasts === 0 ? (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  ) : (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                  )}
                </button>
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
                  isOnline ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/20' : 'bg-gray-800/80 text-gray-500 ring-1 ring-gray-700/30'
                }`}>
                  <span className={`w-1 h-1 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {isOnline ? 'Live' : 'Off'}
                </span>
              </div>
            </div>
            {/* Info strip */}
            <div className="px-2 py-1.5 flex items-center justify-between bg-gray-900/95 border-t border-gray-800/50">
              <div className="min-w-0 flex-1">
                <p className="text-white text-[11px] font-semibold truncate">{screen.name}</p>
                <p className="text-gray-500 text-[9px] truncate">{getLayoutName(screen.current_layout_id)} · {formatLastSeen(screen.last_seen)}</p>
              </div>
              <div className="relative">
                <button onClick={() => setDropdownOpen(dropdownOpen === screen.id ? null : screen.id)}
                  className="px-1.5 py-1 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 rounded text-[9px] text-gray-400 hover:text-white transition-colors">
                  Push
                </button>
                {dropdownOpen === screen.id && (
                  <div className="absolute bottom-full right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto w-40">
                    {layouts.map(l => (
                      <button key={l.id} onClick={() => handlePush(screen.id, l.id)}
                        className={`w-full text-left px-2 py-1.5 text-[10px] transition-colors ${screen.current_layout_id === l.id ? 'text-blue-400 bg-blue-600/10' : 'text-gray-300 hover:bg-gray-700'}`}>
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
