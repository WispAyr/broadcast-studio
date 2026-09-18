import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSocketStatus } from '../../../lib/useSocketStatus';

const railItems = [
  { path: 'dashboard', label: 'Dashboard', d: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { path: 'layouts', label: 'Layouts', d: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z' },
  { path: 'screens', label: 'Screens', d: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: 'media', label: 'Media', d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: 'schedule', label: 'Schedule', d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: 'settings', label: 'Settings', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function IconRail({ onToggleMode, user }) {
  const socketStatus = useSocketStatus();

  return (
    <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col h-full shrink-0">
      <button
        type="button"
        onClick={onToggleMode}
        className="w-full h-12 flex items-center justify-center hover:bg-gray-800 transition-colors border-b border-gray-800 text-blue-400"
        title="Exit to Studio mode (⌘⇧L)"
        aria-label="Exit Live desk to Studio mode"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
        </svg>
      </button>

      <nav className="flex-1 flex flex-col items-center py-2 gap-1 overflow-y-auto" aria-label="Studio pages">
        {railItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onToggleMode}
            className={({ isActive }) =>
              `w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-400 hover:text-white ${
                isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'
              }`
            }
            title={`${item.label} (exits Live desk)`}
            aria-label={`${item.label} — opens in Studio mode`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.d} />
            </svg>
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-2 py-3 border-t border-gray-800">
        <div
          className={`w-2 h-2 rounded-full ${socketStatus.connected ? 'bg-green-400' : socketStatus.reconnecting ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`}
          title={socketStatus.connected ? 'Connected' : socketStatus.reconnecting ? 'Reconnecting' : 'Disconnected'}
          aria-label={socketStatus.connected ? 'Connected' : socketStatus.reconnecting ? 'Reconnecting' : 'Disconnected'}
        />
        {user && (
          <div
            className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px]"
            title={`${user.username} (${user.role?.replace('_', ' ')})`}
          >
            {user.username?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
