import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { connectSocket, getSocket } from '../../lib/socket';
import ScreenPreview from '../../components/ScreenPreview';
import { useToast } from '../../components/Toast';

export default function Dashboard() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedSyncLayout, setSelectedSyncLayout] = useState('');
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [quickTextOpen, setQuickTextOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickTextSubtitle, setQuickTextSubtitle] = useState('');
  const [quickTextScreen, setQuickTextScreen] = useState('all');
  const [audioBroadcast, setAudioBroadcast] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const broadcastIntervalRef = useRef(null);
  const levelIntervalRef = useRef(null);

  const toast = useToast();
  const studioId = JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || 'default';

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

  useEffect(() => {
    fetchData();
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

    const refreshInterval = setInterval(fetchData, 15000);
    return () => { socket.off('screen_status'); socket.off('screen_preview'); clearInterval(refreshInterval); };
  }, [fetchData]);

  // Keyboard shortcuts: 1-9 push layout, B blackout
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && num <= layouts.length) {
        handleHotbarPush(layouts.filter(l => !l.name?.includes('Blackout'))[num - 1]?.id);
      }
      if (e.key === 'b' || e.key === 'B') handleBlackout();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [layouts, blackoutActive]);

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
      await api.post('/screens/sync', { layout_id: layoutId });
      const bl = layouts.find(l => l.id === layoutId);
      setBlackoutActive(bl?.name?.includes('Blackout') || false);
      toast?.('All screens synced', 'success');
      fetchData();
    } catch (err) { alert('Failed: ' + err.message); }
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
  }

  async function toggleAudioBroadcast() {
    if (audioBroadcast) {
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
      audioStreamRef.current = null; audioCtxRef.current = null; analyserRef.current = null;
      setAudioBroadcast(false); setAudioLevel(0);
      return;
    }
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        stream.getVideoTracks().forEach(t => t.stop());
        if (stream.getAudioTracks().length === 0) throw new Error('No audio');
      } catch { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }

      audioStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const socket = getSocket();
      broadcastIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const freq = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freq);
        const binSize = Math.floor(freq.length / 128);
        const downsampled = [];
        for (let i = 0; i < 128; i++) { let sum = 0; for (let j = 0; j < binSize; j++) sum += freq[i * binSize + j]; downsampled.push(Math.round(sum / binSize)); }
        socket.emit('visualizer_audio_data', { studioId, frequencyData: downsampled, timestamp: Date.now() });
      }, 50);

      levelIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const freq = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freq);
        let sum = 0; for (let i = 0; i < freq.length; i++) sum += freq[i];
        setAudioLevel(Math.min(1, (sum / freq.length / 255) * 3));
      }, 100);

      setAudioBroadcast(true);
      stream.getAudioTracks()[0]?.addEventListener('ended', () => toggleAudioBroadcast());
    } catch (err) { alert('Failed to capture audio: ' + err.message); }
  }

  useEffect(() => {
    return () => {
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  async function handleSyncAll() {
    if (!selectedSyncLayout) return;
    try {
      await api.post('/screens/sync', { layout_id: selectedSyncLayout });
      setSyncModalOpen(false); setSelectedSyncLayout(''); fetchData();
    } catch (err) { alert('Sync failed: ' + err.message); }
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1">
              {screens.length} screen{screens.length !== 1 ? 's' : ''} · {screens.filter(s => s.is_online).length} online
            </p>
          </div>
          <div className="flex gap-3">
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
            <button onClick={() => setSyncModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Sync All</button>
          </div>
        </div>

        {/* Screen Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {screens.map(screen => {
            const layout = getLayoutForScreen(screen);
            return (
              <div key={screen.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="bg-gray-950 p-4 flex items-center justify-center relative" style={{ minHeight: 160 }}>
                  {layout ? <ScreenPreview layout={layout} /> : <p className="text-gray-600 text-sm">No layout assigned</p>}
                  <div className="absolute top-2 right-2">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${screen.is_online ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${screen.is_online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                      {screen.is_online ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold">{screen.name}</h3>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1 mb-3">
                    <p>Layout: <span className="text-gray-300">{getLayoutName(screen.current_layout_id)}</span></p>
                    <p>Last seen: <span className="text-gray-300">{formatLastSeen(screen.last_seen)}</span></p>
                  </div>
                  <div className="relative">
                    <button onClick={() => setLayoutDropdownOpen(layoutDropdownOpen === screen.id ? null : screen.id)}
                      className="w-full px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg text-sm text-blue-400 font-medium transition-colors">
                      Push Layout
                    </button>
                    {layoutDropdownOpen === screen.id && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {layouts.map(l => (
                          <button key={l.id} onClick={() => handlePushLayout(screen.id, l.id)}
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
          <div className="text-center py-16"><p className="text-gray-500">No screens registered yet.</p></div>
        )}
      </div>

      {/* ── Layout Hotbar ──────────────────────────── */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 80%, transparent 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {layouts.filter(l => !l.name?.includes('Blackout')).map((layout, i) => {
              const isLive = layout.id === liveLayoutId;
              return (
                <button key={layout.id} onClick={() => handleHotbarPush(layout.id)}
                  className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all border ${isLive ? 'bg-green-900/30 border-green-500/50 shadow-lg shadow-green-500/20' : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-700/60 hover:border-gray-600'}`}
                  style={{ minWidth: 90 }}>
                  <div className="w-16 h-10 rounded border border-gray-700 overflow-hidden bg-gray-950"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(layout.grid_cols || 3, 6)}, 1fr)`, gridTemplateRows: `repeat(${Math.min(layout.grid_rows || 2, 4)}, 1fr)`, gap: '1px' }}>
                    {Array.from({ length: Math.min((layout.grid_cols || 3) * (layout.grid_rows || 2), 24) }).map((_, j) => (
                      <div key={j} className="bg-gray-800/70 rounded-sm" />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium truncate max-w-[80px]" style={{ color: isLive ? '#4ade80' : '#9ca3af' }}>{layout.name}</span>
                  {isLive && <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider px-1.5 py-0.5 bg-green-500/20 rounded-full" style={{ textShadow: '0 0 8px rgba(74,222,128,0.5)' }}>LIVE</span>}
                  {i < 9 && <span className="text-[9px] text-gray-600 font-mono">{i + 1}</span>}
                </button>
              );
            })}
            <div className="flex-1" />
            {/* Quick Text */}
            <button onClick={() => setQuickTextOpen(true)}
              className="shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all border bg-purple-900/30 border-purple-700/40 hover:bg-purple-800/40 text-purple-400" style={{ minWidth: 70 }}>
              <span className="text-lg">💬</span>
              <span className="text-[10px] font-medium">Text</span>
            </button>
            {/* Blackout */}
            <button onClick={handleBlackout}
              className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all border font-bold ${blackoutActive ? 'bg-red-900/50 border-red-500/60 shadow-lg shadow-red-500/30 text-red-400' : 'bg-gray-900/80 border-red-900/40 hover:bg-red-900/30 text-red-500 hover:text-red-400'}`}
              style={{ minWidth: 80, animation: blackoutActive ? 'pulse 2s ease-in-out infinite' : undefined }}>
              <span className="text-2xl">⬛</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Blackout</span>
              <span className="text-[9px] text-gray-600 font-mono">B</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sync Modal */}
      {syncModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Sync All Screens</h2>
            <p className="text-gray-400 text-sm mb-4">Push a layout to all screens simultaneously.</p>
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
    </div>
  );
}
