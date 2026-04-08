import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSocketStatus } from '../../../lib/useSocketStatus';

const railItems = [
  { path: 'dashboard', icon: '📊', label: 'Dashboard' },
  { path: 'shows', icon: '🎬', label: 'Shows' },
  { path: 'layouts', icon: '🔲', label: 'Layouts' },
  { path: 'screens', icon: '🖥️', label: 'Screens' },
  { path: 'media', icon: '🖼️', label: 'Media' },
  { path: 'timeline', icon: '⏱️', label: 'Timeline' },
  { path: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function IconRail({ onToggleMode, user }) {
  const socketStatus = useSocketStatus();

  return (
    <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col h-full shrink-0">
      {/* Mode toggle */}
      <button
        onClick={onToggleMode}
        className="w-full h-12 flex items-center justify-center text-lg hover:bg-gray-800 transition-colors border-b border-gray-800"
        title="Switch to Studio mode (Ctrl+L)"
      >
        <div className="relative">
          <span className="text-red-400">🔴</span>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </div>
      </button>

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-1 overflow-y-auto">
        {railItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onToggleMode}
            className={({ isActive }) =>
              `w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`
            }
            title={item.label}
          >
            {item.icon}
          </NavLink>
        ))}
      </nav>

      {/* Connection + user */}
      <div className="flex flex-col items-center gap-2 py-3 border-t border-gray-800">
        <div className={`w-2 h-2 rounded-full ${socketStatus.connected ? 'bg-green-400' : socketStatus.reconnecting ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`}
          title={socketStatus.connected ? 'Connected' : socketStatus.reconnecting ? 'Reconnecting' : 'Disconnected'} />
        {user && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px]"
            title={`${user.username} (${user.role?.replace('_', ' ')})`}>
            {user.username?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
