import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { connectSocket, getSocket } from '../../lib/socket';
import { useAudioBroadcast } from '../../lib/useAudioBroadcast';
import ScreenPreview from '../../components/ScreenPreview';
import ConfirmDialog from '../../components/ConfirmDialog';
import LayoutHotbar from './components/LayoutHotbar';
import SceneRail from './components/SceneRail';
import ScheduleRail from './components/ScheduleRail';
import IncidentBar from './components/IncidentBar';
import { useToast } from '../../components/Toast';

export default function Dashboard() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedSyncLayout, setSelectedSyncLayout] = useState('');
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [blackoutConfirmOpen, setBlackoutConfirmOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [quickTextOpen, setQuickTextOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickTextSubtitle, setQuickTextSubtitle] = useState('');
  const [quickTextScreen, setQuickTextScreen] = useState('all');
  const [selectedScreens, setSelectedScreens] = useState(new Set());

  // Nuro integration state
  const [nuroAlerts, setNuroAlerts] = useState([]);
  const [nuroExpanded, setNuroExpanded] = useState(false);
  const [nuroAvailable, setNuroAvailable] = useState(true);
  const [sendAlertOpen, setSendAlertOpen] = useState(false);
  const [sendAlertForm, setSendAlertForm] = useState({ type: 'INFO', title: '', body: '' });
  const [sendAlertLoading, setSendAlertLoading] = useState(false);

  const toast = useToast();
  const studioId = JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || 'default';
  const { active: audioBroadcast, level: audioLevel, toggle: toggleAudioBroadcast } = useAudioBroadcast(studioId);

  const fetchData = useCallback(async () => {
    try {
      const [screensData, layoutsData] = await Promise.all([api.get('/screens'), api.get('/layouts')]);
      setScreens(Array.isArray(screensData) ? screensData : Array.isArray(screensData?.screens) ? screensData.screens : []);
      setLayouts(Array.isArray(layoutsData) ? layoutsData : Array.isArray(layoutsData?.layouts) ? layoutsData.layouts : []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNuroAlerts = useCallback(async () => {
    try {
      const data = await api.get('/nuro/alerts?limit=20');
      if (data?.alerts) setNuroAlerts(data.alerts);
      setNuroAvailable(true);
    } catch (err) {
      // Distinguish "Nuro hub not reachable" (shows explicit banner) from other
      // errors (kept silent). 404 / 5xx / network-fetch failures all fall here.
      setNuroAvailable(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchNuroAlerts();
    const socket = connectSocket();
    socket.emit('join_studio', { studioId });

    socket.on('screen_status', (data) => {
      setScreens(prev => prev.map(s =>
        s.id === data.screenId ? { ...s, is_online: data.online !== undefined ? data.online : data.is_online, last_seen: data.last_seen || data.timestamp } : s
      ));
    });

    socket.on('screen_preview', (data) => {
      setScreens(prev => prev.map(s => s.id === data.screenId ? { ...s, current_layout: data.layout, current_layout_id: data.layoutId || s.current_layout_id, _previewUpdated: Date.now() } : s));
    });

    // Live Nuro alerts from the server WebSocket relay
    socket.on('nuro_alert', (alertData) => {
      setNuroAlerts(prev => [alertData, ...prev].slice(0, 20));
      setNuroExpanded(true); // auto-open panel on new alert
    });

    const refreshInterval = setInterval(fetchData, 15000);
    return () => {
      socket.off('screen_status');
      socket.off('screen_preview');
      socket.off('nuro_alert');
      clearInterval(refreshInterval);
    };
  }, [fetchData, fetchNuroAlerts]);

  // Keyboard shortcuts: 1-9 push layout, B blackout
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && num <= layouts.length) {
        handleHotbarPush(layouts.filter(l => !l.name?.includes('Blackout'))[num - 1]?.id);
      }
      if (e.key === 'b' || e.key === 'B') setBlackoutConfirmOpen(true);
      if (e.key === '?') setShowShortcuts(s => !s);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [layouts, blackoutActive]);

  function toggleScreen(screenId) {
    setSelectedScreens(prev => {
      const next = new Set(prev);
      if (next.has(screenId)) next.delete(screenId);
      else next.add(screenId);
      return next;
    });
  }

  function selectAll() {
    setSelectedScreens(new Set(screens.map(s => s.id)));
  }

  function selectNone() {
    setSelectedScreens(new Set());
  }

  async function handlePushLayout(screenId, layoutId) {
    try {
      await api.post(`/screens/${screenId}/layout`, { layout_id: layoutId });
      setLayoutDropdownOpen(null);
      setBlackoutActive(false);
      toast?.('Layout pushed', 'success');
      fetchData();
    } catch (err) { alert('Failed to push layout: ' + err.message); }
  }

  async function handleHotbarPush(layoutId) {
    if (!layoutId) return;
    try {
      const targets = selectedScreens.size > 0 ? [...selectedScreens] : screens.map(s => s.id);
      let pushed = 0, locked = 0;
      if (targets.length === screens.length) {
        // Studio-wide sync returns { pushed, locked, total } — surface it so
        // the operator sees how many screens skipped due to the padlock.
        const res = await api.post('/screens/sync', { layout_id: layoutId });
        pushed = res?.pushed ?? targets.length;
        locked = res?.locked ?? 0;
      } else {
        await Promise.all(targets.map(sid => api.post(`/screens/${sid}/layout`, { layout_id: layoutId })));
        pushed = targets.length;
      }
      const bl = layouts.find(l => l.id === layoutId);
      setBlackoutActive(bl?.name?.includes('Blackout') || false);
      const lockedNote = locked > 0 ? ` (${locked} locked)` : '';
      toast?.(`${pushed} screen${pushed !== 1 ? 's' : ''} updated${lockedNote}`, locked > 0 ? 'warning' : 'success');
      fetchData();
    } catch (err) {
      // Server rejects with 409 "Studio is public-only …" when the layout
      // isn't flagged public_safe. Show the message instead of a generic alert.
      toast?.(err.message || 'Push failed', 'error');
    }
  }

  async function handleBlackout() {
    const blackoutLayout = layouts.find(l => l.name?.includes('Blackout'));
    if (!blackoutLayout) { alert('No Blackout layout found.'); return; }
    if (blackoutActive) {
      const restore = layouts.find(l => !l.name?.includes('Blackout'));
      if (restore) await handleHotbarPush(restore.id);
      setBlackoutActive(false);
    } else {
      await handleHotbarPush(blackoutLayout.id);
      setBlackoutActive(true);
    }
    setBlackoutConfirmOpen(false);
  }



  async function handleSyncAll() {
    if (!selectedSyncLayout) return;
    try {
      const res = await api.post('/screens/sync', { layout_id: selectedSyncLayout });
      const pushed = res?.pushed ?? 0;
      const locked = res?.locked ?? 0;
      const lockedNote = locked > 0 ? ` (${locked} locked)` : '';
      toast?.(`${pushed} screen${pushed !== 1 ? 's' : ''} synced${lockedNote}`, locked > 0 ? 'warning' : 'success');
      setSyncModalOpen(false); setSelectedSyncLayout(''); fetchData();
    } catch (err) { toast?.(err.message || 'Sync failed', 'error'); }
  }

  function handleQuickText() {
    if (!quickText.trim()) return;
    const socket = connectSocket();
    if (quickTextScreen === 'all') {
      socket.emit('update_module_text', { studioId, moduleId: '__live_text__', text: quickText, subtitle: quickTextSubtitle });
    } else {
      socket.emit('update_module_text', { screenId: quickTextScreen, moduleId: '__live_text__', text: quickText, subtitle: quickTextSubtitle });
    }
    setQuickTextOpen(false); setQuickText(''); setQuickTextSubtitle('');
  }

  function getLayoutName(id) { return layouts.find(l => l.id === id)?.name || 'None'; }
  function getLayoutForScreen(screen) {
    if (screen.current_layout) return screen.current_layout;
    if (screen.current_layout_id) {
      const l = layouts.find(l => l.id === screen.current_layout_id);
      if (l) return { ...l, modules: typeof l.modules === 'string' ? JSON.parse(l.modules) : (l.modules || []) };
    }
    return null;
  }
  function formatLastSeen(ls) {
    if (!ls) return 'Never';
    const diff = Math.floor((Date.now() - new Date(ls)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(ls).toLocaleTimeString();
  }

  const liveLayoutId = (() => {
    const counts = {};
    screens.forEach(s => { if (s.current_layout_id) counts[s.current_layout_id] = (counts[s.current_layout_id] || 0) + 1; });
    let max = 0, id = null;
    Object.entries(counts).forEach(([k, v]) => { if (v > max) { max = v; id = k; } });
    return id;
  })();

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-7 w-32 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-800/50 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="bg-gray-950 p-4" style={{ minHeight: 160 }}>
                <div className="w-48 h-28 bg-gray-800 rounded animate-pulse mx-auto" />
              </div>
              <div className="p-4">
                <div className="h-5 w-32 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="h-3 w-24 bg-gray-800/50 rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-gray-800/50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-500 text-sm">{screens.length} screen{screens.length !== 1 ? 's' : ''}</span>
              {selectedScreens.size > 0 && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className="text-blue-400 text-sm font-medium">{selectedScreens.size} selected</span>
                </>
              )}
              <span className="text-gray-700">·</span>
              <span className={`inline-flex items-center gap-1.5 text-sm ${screens.filter(s => s.is_online).length > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                {screens.filter(s => s.is_online).length > 0 && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                  </span>
                )}
                {screens.filter(s => s.is_online).length} online
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 mr-2">
              <button onClick={selectAll}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedScreens.size === screens.length ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                }`}>All</button>
              <button onClick={selectNone}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedScreens.size === 0 ? 'bg-gray-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                }`}>None</button>
            </div>
            <button onClick={toggleAudioBroadcast}
              className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${audioBroadcast ? 'bg-green-600 shadow-lg shadow-green-600/40' : 'bg-gray-700 hover:bg-gray-600'}`}>
              {audioBroadcast ? (
                <>
                  <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-300" /></span>
                  <span>🎵 Live</span>
                  <span className="w-8 h-2 bg-green-900 rounded-full overflow-hidden"><span className="h-full bg-green-300 block rounded-full transition-all" style={{ width: `${audioLevel * 100}%` }} /></span>
                </>
              ) : <>🎵 Audio</>}
            </button>
            <button onClick={() => setSyncModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20">Sync All</button>
          </div>
        </div>

        {/* ── Nuro Alert Panel ──────────────────────────────────────── */}
        <div className={`mb-6 rounded-xl border overflow-hidden transition-all ${
          nuroAlerts.length > 0
            ? 'border-emerald-800/40 bg-emerald-950/20'
            : 'border-gray-800/50 bg-gray-900/40'
        }`}>
          <button
            onClick={() => setNuroExpanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors hover:bg-white/5"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">⬡</span>
              <span className={nuroAlerts.length > 0 ? 'text-emerald-300' : 'text-gray-400'}>
                Nuro Alerts
              </span>
              {nuroAlerts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  {nuroAlerts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setSendAlertOpen(true); }}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 transition-colors"
              >
                Send Alert
              </button>
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${nuroExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {nuroExpanded && (
            <div className="border-t border-gray-800/50">
              {!nuroAvailable ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-amber-400 text-sm font-medium">Nuro hub unavailable</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Can&apos;t reach <code className="font-mono">/api/nuro/alerts</code>.
                    The hub may be offline — inbound alerts from Dispatch/Prism won&apos;t appear until it returns.
                  </p>
                </div>
              ) : nuroAlerts.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-gray-600 text-sm">No inbound Nuro alerts yet</p>
                  <p className="text-gray-700 text-xs mt-1">Alerts from Dispatch or Prism will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/40 max-h-52 overflow-y-auto">
                  {nuroAlerts.map(alert => {
                    const typeColors = {
                      EMERGENCY: 'text-red-400 bg-red-500/10',
                      WARNING:   'text-amber-400 bg-amber-500/10',
                      INFO:      'text-blue-400 bg-blue-500/10',
                    };
                    const typeColor = typeColors[alert.type] || typeColors.INFO;
                    return (
                      <div key={alert.id} className="flex items-start gap-3 px-5 py-3">
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${typeColor}`}>
                          {alert.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 font-medium">{alert.title}</p>
                          {alert.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.body}</p>}
                          <p className="text-[10px] text-gray-600 mt-1">
                            {alert.source} · {new Date(alert.received_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Screen Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {screens.map(screen => {
            const layout = getLayoutForScreen(screen);
            const isOnline = screen.is_online;
            return (
              <div key={screen.id} onClick={() => toggleScreen(screen.id)}
                className={`bg-gray-900 rounded-xl border overflow-hidden transition-all cursor-pointer ${
                selectedScreens.has(screen.id)
                  ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10'
                  : isOnline ? 'border-gray-700/60 shadow-lg shadow-black/20 hover:border-gray-700' : 'border-gray-800/60 hover:border-gray-700'
              }`}>
                <div className="relative bg-gray-950 p-4 flex items-center justify-center" style={{ minHeight: 160 }}>
                  {/* Selection checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedScreens.has(screen.id)
                        ? 'bg-blue-600 border-blue-500'
                        : 'border-gray-600 bg-gray-800/60 hover:border-gray-500'
                    }`}>
                      {selectedScreens.has(screen.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {layout ? <ScreenPreview layout={layout} /> : (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-700 text-xs font-mono">NO LAYOUT</p>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
                      isOnline
                        ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/20'
                        : 'bg-gray-800/80 text-gray-500 ring-1 ring-gray-700/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 shadow-sm shadow-green-400/50' : 'bg-gray-600'}`} />
                      {isOnline ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm">{screen.name}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
                      <span className="text-gray-400">{getLayoutName(screen.current_layout_id)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-gray-400">{formatLastSeen(screen.last_seen)}</span>
                    </span>
                  </div>
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setLayoutDropdownOpen(layoutDropdownOpen === screen.id ? null : screen.id); }}
                      className="w-full px-3 py-2 bg-gray-800/80 hover:bg-gray-800 border border-gray-700/50 rounded-lg text-sm text-gray-300 font-medium transition-all hover:border-gray-600 flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                      Push Layout
                    </button>
                    {layoutDropdownOpen === screen.id && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {layouts.map(l => (
                          <button key={l.id} onClick={(e) => { e.stopPropagation(); handlePushLayout(screen.id, l.id); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${screen.current_layout_id === l.id ? 'text-blue-400 bg-blue-600/10' : 'text-gray-300 hover:bg-gray-700'}`}>
                            {l.name}{screen.current_layout_id === l.id && <span className="ml-2 text-xs text-gray-500">(current)</span>}
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

        {screens.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-800 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No screens registered</p>
            <p className="text-gray-700 text-sm mt-1">Add screens from the Screens page to get started</p>
          </div>
        )}
      </div>

      {/* ── Ops rails stack: Incidents → Schedule → Scenes → Layout hotbar ─ */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 80%, transparent 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        {/* Severity-coloured banner push — highest urgency, top of stack. */}
        <IncidentBar studioId={studioId} />
        {/* Queue a layout push for later ("Awards layout at 17:30"). */}
        <ScheduleRail studioId={studioId} layouts={layouts} screens={screens} />
        {/* Named scene snapshots — one-click studio-wide wall flip. */}
        <SceneRail studioId={studioId} onApplied={fetchData} />
        <LayoutHotbar
          layouts={layouts}
          liveLayoutId={liveLayoutId}
          onPush={handleHotbarPush}
          onBlackout={() => setBlackoutConfirmOpen(true)}
          onQuickText={() => setQuickTextOpen(true)}
          blackoutActive={blackoutActive}
        />
      </div>

      {/* Sync Modal */}
      {syncModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-2">Sync All Screens</h2>
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-800/30">
              <span className="text-amber-400 text-sm">⚠️</span>
              <span className="text-amber-300 text-xs">
                This will override layouts on {screens.filter(s => s.is_online).length} online screen{screens.filter(s => s.is_online).length !== 1 ? 's' : ''} simultaneously.
              </span>
            </div>
            <select value={selectedSyncLayout} onChange={e => setSelectedSyncLayout(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500">
              <option value="">Select a layout...</option>
              {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setSyncModalOpen(false); setSelectedSyncLayout(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSyncAll} disabled={!selectedSyncLayout}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">Sync All</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Text Modal */}
      

      {quickTextOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-purple-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-purple-400 mb-4">💬 Quick Text Update</h2>
            <p className="text-gray-400 text-sm mb-4">Push text to live_text modules on screen instantly.</p>
            <input value={quickText} onChange={e => setQuickText(e.target.value)} placeholder="Main text..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-3 focus:outline-none focus:border-purple-500" autoFocus />
            <input value={quickTextSubtitle} onChange={e => setQuickTextSubtitle(e.target.value)} placeholder="Subtitle (optional)..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-3 focus:outline-none focus:border-purple-500" />
            <select value={quickTextScreen} onChange={e => setQuickTextScreen(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-purple-500">
              <option value="all">All Screens</option>
              {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setQuickTextOpen(false); setQuickText(''); setQuickTextSubtitle(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={handleQuickText} disabled={!quickText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">Send Live</button>
            </div>
          </div>
        </div>
      )}

      {/* Nuro Send Alert Modal */}
      {sendAlertOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-emerald-800/40 p-6 w-full max-w-md shadow-2xl shadow-emerald-900/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⬡</span>
              <h2 className="text-lg font-semibold text-emerald-300">Send Nuro Alert</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">Push an alert from this studio upstream to the Nuro Dispatch engine.</p>
            <select
              value={sendAlertForm.type}
              onChange={e => setSendAlertForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-3 focus:outline-none focus:border-emerald-500"
            >
              <option value="INFO">ℹ INFO</option>
              <option value="WARNING">⚠ WARNING</option>
              <option value="EMERGENCY">🚨 EMERGENCY</option>
            </select>
            <input
              value={sendAlertForm.title}
              onChange={e => setSendAlertForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Alert title…"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-3 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <textarea
              value={sendAlertForm.body}
              onChange={e => setSendAlertForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Body (optional)…"
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-emerald-500 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSendAlertOpen(false); setSendAlertForm({ type: 'INFO', title: '', body: '' }); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >Cancel</button>
              <button
                disabled={!sendAlertForm.title.trim() || sendAlertLoading}
                onClick={async () => {
                  setSendAlertLoading(true);
                  try {
                    await api.post('/nuro/send-alert', sendAlertForm);
                    toast?.('Alert sent to Nuro', 'success');
                    setSendAlertOpen(false);
                    setSendAlertForm({ type: 'INFO', title: '', body: '' });
                  } catch (err) {
                    toast?.(err.message || 'Failed to send alert', 'error');
                  } finally {
                    setSendAlertLoading(false);
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {sendAlertLoading ? 'Sending…' : 'Send to Nuro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blackout Confirmation */}
      <ConfirmDialog
        open={blackoutConfirmOpen}
        title={blackoutActive ? 'Restore Screens' : 'Blackout All Screens'}
        message={blackoutActive
          ? 'This will restore all screens to their previous layout.'
          : `This will immediately blackout all ${screens.filter(s => s.is_online).length} online screen${screens.filter(s => s.is_online).length !== 1 ? 's' : ''}. Are you sure?`}
        confirmLabel={blackoutActive ? 'Restore' : 'Blackout'}
        variant={blackoutActive ? 'warning' : 'danger'}
        onConfirm={handleBlackout}
        onCancel={() => setBlackoutConfirmOpen(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">⌨️ Keyboard Shortcuts</h2>
            <div className="space-y-2">
              {[
                ['1 – 9', 'Push layout by number'],
                ['B', 'Toggle blackout'],
                ['?', 'Toggle this panel'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{desc}</span>
                  <kbd className="px-2 py-1 rounded bg-gray-800 text-gray-300 font-mono text-xs border border-gray-700">{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcuts(false)}
              className="mt-5 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
