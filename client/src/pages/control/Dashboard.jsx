import React, { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { connectSocket } from '../../lib/socket';
import ScreenPreview from '../../components/ScreenPreview';

export default function Dashboard() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [selectedSyncLayout, setSelectedSyncLayout] = useState('');
  const [selectedEmergencyLayout, setSelectedEmergencyLayout] = useState('');
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [screensData, layoutsData] = await Promise.all([
        api.get('/screens'),
        api.get('/layouts')
      ]);
      setScreens(screensData.screens || screensData || []);
      setLayouts(layoutsData.layouts || layoutsData || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const socket = connectSocket();

    socket.on('screen_status', (data) => {
      setScreens((prev) =>
        prev.map((s) =>
          s.id === data.screenId
            ? { ...s, is_online: data.online !== undefined ? data.online : data.is_online, last_seen: data.last_seen || data.timestamp }
            : s
        )
      );
    });

    socket.on('screen_preview', (data) => {
      setScreens((prev) =>
        prev.map((s) =>
          s.id === data.screenId ? { ...s, current_layout: data.layout } : s
        )
      );
    });

    // Refresh data periodically
    const refreshInterval = setInterval(fetchData, 15000);

    return () => {
      socket.off('screen_status');
      socket.off('screen_preview');
      clearInterval(refreshInterval);
    };
  }, [fetchData]);

  async function handlePushLayout(screenId, layoutId) {
    try {
      await api.post(`/screens/${screenId}/layout`, { layout_id: layoutId });
      setLayoutDropdownOpen(null);
      fetchData();
    } catch (err) {
      alert('Failed to push layout: ' + err.message);
    }
  }

  async function handleSyncAll() {
    if (!selectedSyncLayout) return;
    try {
      await api.post('/screens/sync', { layout_id: selectedSyncLayout });
      setSyncModalOpen(false);
      setSelectedSyncLayout('');
      fetchData();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  }

  async function handleEmergency() {
    if (!selectedEmergencyLayout) return;
    try {
      await api.post('/screens/emergency', { layout_id: selectedEmergencyLayout });
      setEmergencyModalOpen(false);
      setSelectedEmergencyLayout('');
      fetchData();
    } catch (err) {
      alert('Emergency override failed: ' + err.message);
    }
  }

  function getLayoutName(layoutId) {
    const layout = layouts.find((l) => l.id === layoutId);
    return layout ? layout.name : 'None';
  }

  function getLayoutForScreen(screen) {
    if (screen.current_layout) return screen.current_layout;
    if (screen.current_layout_id) {
      const layout = layouts.find((l) => l.id === screen.current_layout_id);
      if (layout) {
        return {
          ...layout,
          modules: typeof layout.modules === 'string' ? JSON.parse(layout.modules) : (layout.modules || [])
        };
      }
    }
    return null;
  }

  function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Never';
    const d = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return d.toLocaleTimeString();
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            {screens.length} screen{screens.length !== 1 ? 's' : ''} &middot;{' '}
            {screens.filter((s) => s.is_online).length} online
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setSyncModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sync All
          </button>
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Emergency Override
          </button>
        </div>
      </div>

      {/* Screen Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {screens.map((screen) => {
          const layout = getLayoutForScreen(screen);
          return (
            <div
              key={screen.id}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              {/* Preview */}
              <div className="bg-gray-950 p-4 flex items-center justify-center relative" style={{ minHeight: 160 }}>
                {layout ? (
                  <ScreenPreview layout={layout} />
                ) : (
                  <p className="text-gray-600 text-sm">No layout assigned</p>
                )}
                {/* Online indicator overlay */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      screen.is_online
                        ? 'bg-green-900/60 text-green-400'
                        : 'bg-red-900/60 text-red-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        screen.is_online ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                      }`}
                    />
                    {screen.is_online ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-semibold">{screen.name}</h3>
                  <span className="text-gray-600 text-xs">#{screen.screen_number}</span>
                </div>

                <div className="text-sm text-gray-400 space-y-1 mb-3">
                  <p>Layout: <span className="text-gray-300">{screen.current_layout_id ? getLayoutName(screen.current_layout_id) : 'None'}</span></p>
                  <p>Last seen: <span className="text-gray-300">{formatLastSeen(screen.last_seen)}</span></p>
                </div>

                {/* Push Layout dropdown */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setLayoutDropdownOpen(layoutDropdownOpen === screen.id ? null : screen.id)
                    }
                    className="w-full px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg text-sm text-blue-400 font-medium transition-colors"
                  >
                    Push Layout
                  </button>
                  {layoutDropdownOpen === screen.id && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                      {layouts.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => handlePushLayout(screen.id, l.id)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            screen.current_layout_id === l.id
                              ? 'text-blue-400 bg-blue-600/10'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {l.name}
                          {screen.current_layout_id === l.id && (
                            <span className="ml-2 text-xs text-gray-500">(current)</span>
                          )}
                        </button>
                      ))}
                      {layouts.length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-500">No layouts available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {screens.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">No screens registered yet.</p>
          <p className="text-gray-600 text-sm mt-1">Open a screen display URL to register a screen.</p>
        </div>
      )}

      {/* Sync Modal */}
      {syncModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Sync All Screens</h2>
            <p className="text-gray-400 text-sm mb-4">
              Push a layout to all screens simultaneously.
            </p>
            <select
              value={selectedSyncLayout}
              onChange={(e) => setSelectedSyncLayout(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a layout...</option>
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSyncModalOpen(false); setSelectedSyncLayout(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncAll}
                disabled={!selectedSyncLayout}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Sync All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-red-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-red-400 mb-4">Emergency Override</h2>
            <p className="text-gray-400 text-sm mb-4">
              Override ALL screens immediately with an emergency layout. This bypasses timeline automation.
            </p>
            <select
              value={selectedEmergencyLayout}
              onChange={(e) => setSelectedEmergencyLayout(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-red-500"
            >
              <option value="">Select emergency layout...</option>
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setEmergencyModalOpen(false); setSelectedEmergencyLayout(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergency}
                disabled={!selectedEmergencyLayout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Activate Emergency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
