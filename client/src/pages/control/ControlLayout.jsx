import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { getMe } from '../../lib/api';
import { useSocketStatus } from '../../lib/useSocketStatus';
import { WorkspaceProvider, useWorkspaceContext } from '../../hooks/WorkspaceContext';
import IconRail from './components/IconRail';
import LiveMode from './LiveMode';
import NuroStatusBadge from '../../components/NuroStatusBadge';
import AppStatusBar from '../../components/AppStatusBar';
import CommandPalette from '../../components/CommandPalette';

// Grouped IA: RUN / PROGRAM / BUILD / FLEET / EVENT / SETTINGS
// Unique icon keys so operators can scan without reading every label.
const navGroups = [
  {
    id: 'run',
    label: 'Run',
    items: [
      { path: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { path: 'console', label: 'Console', icon: 'console' },
    ],
  },
  {
    id: 'program',
    label: 'Program',
    items: [
      { path: 'shows', label: 'Shows', icon: 'film' },
      { path: 'timeline', label: 'Timeline', icon: 'timeline' },
      { path: 'schedule', label: 'Schedule', icon: 'schedule' },
      { path: 'autocue', label: 'Autocue', icon: 'autocue' },
      { path: 'variables', label: 'Variables', icon: 'variables' },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    items: [
      { path: 'layouts', label: 'Layouts', icon: 'layout' },
      { path: 'scenes', label: 'Scenes', icon: 'scenes' },
      { path: 'templates', label: 'Templates', icon: 'templates' },
      { path: 'media', label: 'Media', icon: 'media' },
      { path: 'content', label: 'Content', icon: 'content' },
      { path: 'web-sources', label: 'Web Sources', icon: 'websource' },
      { path: 'shaders', label: 'Shader Studio', icon: 'shader' },
      { path: 'deck', label: 'Deck', icon: 'deck' },
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    items: [
      { path: 'screens', label: 'Screens', icon: 'monitor' },
      { path: 'displays', label: 'Displays', icon: 'display' },
      { path: 'workgroups', label: 'Workgroups', icon: 'users' },
    ],
  },
  {
    id: 'event',
    label: 'Event',
    items: [
      { path: 'studio', label: 'NAR Studio', icon: 'radio' },
      { path: 'egpk', label: 'EGPK Live', icon: 'plane' },
      { path: 'kiltwalk', label: 'Kiltwalk Ops', icon: 'walk' },
    ],
  },
  {
    id: 'settings',
    label: null,
    items: [
      { path: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const iconMap = {
  grid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  film: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  ),
  layout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  scenes: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16M15 9l5 3-5 3V9z" />
    </svg>
  ),
  media: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  content: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  monitor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  display: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8v5H8z" />
    </svg>
  ),
  timeline: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  schedule: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  templates: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  shader: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-6.714 2.143L12 21l-2.286-6.857L3 12l6.714-2.143L12 3z" />
    </svg>
  ),
  deck: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z" />
    </svg>
  ),
  plane: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  walk: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5a2 2 0 11-4 0 2 2 0 014 0zM9 22l2-6 2 2 3-6 3 2" />
    </svg>
  ),
  radio: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10a10 10 0 0116 0M7 13a6 6 0 0110 0M12 18a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  ),
  autocue: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  variables: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h10M4 17h16" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zm10 13v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  console: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8h2v2H8V8zm6 0h2v2h-2V8zM8 14h2v2H8v-2zm6 0h2v2h-2v-2z" />
    </svg>
  ),
  websource: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.4 3.8-5.4 3.8-9S14.5 5.4 12 3M12 21c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3M3.6 9h16.8M3.6 15h16.8" />
    </svg>
  ),
};

function NavItem({ item, onNavigate }) {
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`
      }
    >
      {iconMap[item.icon]}
      {item.label}
    </NavLink>
  );
}

export default function ControlLayout() {
  return (
    <WorkspaceProvider>
      <ControlLayoutInner />
    </WorkspaceProvider>
  );
}

function ControlLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studioName, setStudioName] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const socketStatus = useSocketStatus();
  const { mode, toggleMode } = useWorkspaceContext();

  useEffect(() => {
    getMe()
      .then((data) => {
        setUser(data.user || data);
        setStudioName(data.studio?.name || data.studioName || 'Studio');
      })
      .catch(() => {
        localStorage.removeItem('broadcast_token');
        localStorage.removeItem('broadcast_user');
        navigate('/login');
      });
  }, [navigate]);

  // Cmd/Ctrl+Shift+L toggles Live desk (avoids browser address-bar hijack of Cmd/Ctrl+L)
  // Cmd/Ctrl+K opens the command palette in both modes
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        toggleMode();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleMode]);

  function handleLogout() {
    localStorage.removeItem('broadcast_token');
    localStorage.removeItem('broadcast_user');
    navigate('/login');
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-950 items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  // ── LIVE MODE — same chrome as studio (palette + status) ──
  if (mode === 'live') {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <AppStatusBar studioName={studioName} user={user} onOpenPalette={() => setPaletteOpen(true)} />
        <div className="flex flex-1 min-h-0">
          <IconRail onToggleMode={toggleMode} user={user} />
          <LiveMode />
        </div>
      </div>
    );
  }

  // ── STUDIO MODE ──
  return (
    <div className="control-app flex h-screen bg-gray-950">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />}

      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full transition-transform duration-200`}>
        <div className="p-5 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
              B
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 truncate">{studioName}</p>
              <h1 className="text-sm font-bold text-white leading-tight">Broadcast Studio</h1>
            </div>
          </div>
          {/* Mode CTA is neutral blue — red pulse reserved for actual on-air state */}
          <button
            type="button"
            onClick={toggleMode}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-300 hover:bg-blue-600/25 hover:text-blue-200 transition-all text-xs font-bold uppercase tracking-wider"
            title="Enter Live desk (⌘⇧L / Ctrl+Shift+L)"
          >
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
            </span>
            Enter Live desk
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.path} item={item} onNavigate={() => setSidebarOpen(false)} />
                ))}
              </div>
            </div>
          ))}
          {user?.role === 'super_admin' && (
            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">System</p>
              <div className="space-y-0.5">
                <NavLink
                  to="admin"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'text-purple-400 hover:text-white hover:bg-purple-900/30'
                    }`
                  }
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Admin
                </NavLink>
                <NavLink
                  to="/god"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-600 text-white'
                        : 'text-amber-400 hover:text-white hover:bg-amber-900/30'
                    }`
                  }
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  God View
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-3 shrink-0">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {user.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.username}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{user.role?.replace('_', ' ')}</p>
              </div>
            </div>
          )}
          <div className={`mx-1 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            socketStatus.connected
              ? 'bg-green-500/10 text-green-400'
              : socketStatus.reconnecting
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400'
          }`}>
            {socketStatus.connected ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
                Connected
              </>
            ) : socketStatus.reconnecting ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Reconnecting…
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Disconnected
              </>
            )}
          </div>
          <NuroStatusBadge />
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-gray-800/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 h-12 bg-gray-900/95 border-b border-gray-800 shrink-0 sticky top-0 z-30">
          <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-800" aria-label="Toggle menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
          <span className="text-sm font-bold text-white">Broadcast Studio</span>
          <span className="text-xs text-gray-500 truncate">{studioName}</span>
        </div>
        <AppStatusBar studioName={studioName} user={user} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 bg-gray-950 overflow-y-auto hide-scrollbar">
          <div key={location.pathname} className="route-enter h-full min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
