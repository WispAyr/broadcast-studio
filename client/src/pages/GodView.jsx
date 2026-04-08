import React, { useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket, getSocket } from '../lib/socket';
import { useAudioBroadcast } from '../lib/useAudioBroadcast';
import api from '../lib/api';

const storedUser = JSON.parse(localStorage.getItem('broadcast_user') || '{}');
const STUDIO_ID = storedUser.studio_id || null; // resolved dynamically below if null
const TRANSITIONS = ['crossfade', 'slide', 'zoom', 'dissolve', 'wipe', 'cut'];

function formatLastSeen(ts) {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums font-mono">
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// Audio level meter bar
function AudioMeter({ level }) {
  return (
    <div className="flex items-center gap-1 h-4">
      {Array.from({ length: 12 }).map((_, i) => {
        const threshold = i / 12;
        const active = level > threshold;
        const color = i < 8 ? 'bg-green-400' : i < 10 ? 'bg-yellow-400' : 'bg-red-400';
        return <div key={i} className={`w-1 rounded-full transition-all duration-75 ${active ? color : 'bg-white/10'}`}
          style={{ height: active ? '100%' : '30%' }} />;
      })}
    </div>
  );
}

function ScreenTile({ screen, layout, onClick, selected }) {
  const isOnline = screen.is_online;
  const screenUrl = `/screen/${screen.id}`;
  return (
    <div onClick={() => onClick(screen)}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group
        ${selected ? 'ring-2 ring-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'ring-1 ring-white/5 hover:ring-white/20'}`}
      style={{ background: '#0a0e1a' }}>
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div className="absolute inset-0 bg-gray-950">
          {isOnline ? (
            <iframe src={screenUrl} className="w-full h-full border-0 pointer-events-none"
              style={{ transform: 'scale(1)', transformOrigin: 'top left' }} title={screen.name} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-600 text-xs font-medium uppercase tracking-widest">Offline</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2"
        style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{screen.name}</p>
          <p className="text-gray-500 text-xs truncate">{layout?.name || 'No layout'}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isOnline ? (
            <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span className="text-green-400 text-xs font-medium">LIVE</span></>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400 text-xs font-medium">{formatLastSeen(screen.last_seen)}</span></>
          )}
        </div>
      </div>
      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-400"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        SCR {screen.screen_number}
      </div>
      <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors pointer-events-none" />
    </div>
  );
}

// ---- Modals ----
function QuickTextModal({ onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="rounded-2xl p-6 w-[420px]" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-4">💬 Quick Text Push</h3>
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          placeholder="Main text..." className="w-full mb-3 px-4 py-2.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm outline-none focus:border-blue-500" />
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)" className="w-full mb-4 px-4 py-2.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm outline-none focus:border-blue-500" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
          <button onClick={() => { onSubmit(text, subtitle); onClose(); }}
            className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: '#2563eb' }}>Push Text</button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementModal({ onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(5);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="rounded-2xl p-6 w-[420px]" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-4">📢 Announcement</h3>
        <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder="Announcement text..." className="w-full mb-3 px-4 py-2.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm outline-none focus:border-blue-500 resize-none" />
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gray-400 text-sm">Duration:</span>
          <input type="range" min={3} max={15} value={duration} onChange={e => setDuration(+e.target.value)} className="flex-1" />
          <span className="text-white text-sm font-mono w-8">{duration}s</span>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
          <button onClick={() => { onSubmit(text, duration); onClose(); }}
            className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: '#dc2626' }}>Announce</button>
        </div>
      </div>
    </div>
  );
}

function NowPlayingModal({ onClose, onSubmit }) {
  const [artist, setArtist] = useState('');
  const [song, setSong] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="rounded-2xl p-6 w-[420px]" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-4">🎤 Now Playing</h3>
        <input ref={inputRef} value={artist} onChange={e => setArtist(e.target.value)}
          placeholder="Artist name..." className="w-full mb-3 px-4 py-2.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm outline-none focus:border-blue-500" />
        <input value={song} onChange={e => setSong(e.target.value)}
          placeholder="Song title..." className="w-full mb-4 px-4 py-2.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm outline-none focus:border-blue-500" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
          <button onClick={() => { onSubmit(artist, song); onClose(); }}
            className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: '#7c3aed' }}>Push Now Playing</button>
        </div>
      </div>
    </div>
  );
}

// ---- Overlay Panel ----
function OverlayPanel({ onClose, overlays, setOverlays, socket }) {
  const emit = (type, data) => { if (socket) socket.emit('push_overlay', { studioId: STUDIO_ID, overlay: { type, ...data } }); };
  const remove = (type) => { if (socket) socket.emit('remove_overlay', { studioId: STUDIO_ID, overlayType: type }); };

  const toggle = (key, type, data) => {
    const next = { ...overlays, [key]: !overlays[key] };
    setOverlays(next);
    if (next[key]) emit(type, data);
    else remove(type);
  };

  const [lowerName, setLowerName] = useState('');
  const [lowerTitle, setLowerTitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [countdownTarget, setCountdownTarget] = useState('');
  const [tickerText, setTickerText] = useState('');
  const [comingUpText, setComingUpText] = useState('');

  return (
    <div className="fixed top-0 right-0 h-full w-80 z-[90] overflow-y-auto"
      style={{ background: 'rgba(10,14,26,0.98)', backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Overlays</h3>
        <div className="flex gap-2">
          <button onClick={() => { if (socket) socket.emit('clear_overlays', { studioId: STUDIO_ID }); setOverlays({}); }}
            className="px-2 py-1 rounded text-[10px] text-red-400 hover:text-red-300" style={{ background: 'rgba(239,68,68,0.1)' }}>Clear All</button>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
      </div>

      {/* Lower Third */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-medium">Lower Third</span>
          <button onClick={() => toggle('lowerThird', 'lower_third', { name: lowerName, title: lowerTitle })}
            className={`w-10 h-5 rounded-full transition-colors ${overlays.lowerThird ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${overlays.lowerThird ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <input value={lowerName} onChange={e => setLowerName(e.target.value)} placeholder="Name"
          className="w-full mb-2 px-3 py-1.5 rounded bg-white/5 text-white text-xs border border-white/10 outline-none" />
        <input value={lowerTitle} onChange={e => setLowerTitle(e.target.value)} placeholder="Title"
          className="w-full px-3 py-1.5 rounded bg-white/5 text-white text-xs border border-white/10 outline-none" />
        {overlays.lowerThird && <button onClick={() => emit('lower_third', { name: lowerName, title: lowerTitle })}
          className="mt-2 px-3 py-1 rounded text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/20">Update</button>}
      </div>

      {/* Logo Bug */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-medium">Logo Bug</span>
          <button onClick={() => toggle('logoBug', 'logo_bug', { url: logoUrl })}
            className={`w-10 h-5 rounded-full transition-colors ${overlays.logoBug ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${overlays.logoBug ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Logo URL"
          className="w-full px-3 py-1.5 rounded bg-white/5 text-white text-xs border border-white/10 outline-none" />
      </div>

      {/* Countdown */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-medium">Countdown Timer</span>
          <button onClick={() => toggle('countdown', 'countdown', { target: countdownTarget })}
            className={`w-10 h-5 rounded-full transition-colors ${overlays.countdown ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${overlays.countdown ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <input type="datetime-local" value={countdownTarget} onChange={e => setCountdownTarget(e.target.value)}
          className="w-full px-3 py-1.5 rounded bg-white/5 text-white text-xs border border-white/10 outline-none" />
      </div>

      {/* Ticker */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-medium">Scrolling Ticker</span>
          <button onClick={() => toggle('ticker', 'ticker', { text: tickerText })}
            className={`w-10 h-5 rounded-full transition-colors ${overlays.ticker ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${overlays.ticker ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="Ticker text..."
          className="w-full px-3 py-1.5 rounded bg-white/5 text-white text-xs border border-white/10 outline-none" />
      </div>

      {/* Coming Up Next */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-medium">Coming Up Next</span>
          <button onClick={() => toggle('comingUp', 'coming_up', { text: comingUpText })}
            className={`w-10 h-5 rounded-full transition-colors ${overlays.comingUp ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${overlays.comingUp ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <input value={comingUpText} onChange={e => setComingUpText(e.target.value)} placeholder="What's coming up..."
          className="w-full px-3 py-1.5 rounded bg-white/5 text-white text-xs border border-white/10 outline-none" />
      </div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function GodView() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showPushMenu, setShowPushMenu] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const mountedRef = useRef(true);

  // Production state
  const [transitionType, setTransitionType] = useState('crossfade');
  const [transitionDuration, setTransitionDuration] = useState(1);
  const [previewLayout, setPreviewLayout] = useState(null);
  const [programLayout, setProgramLayout] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [showPvwPgm, setShowPvwPgm] = useState(true);

  // Audio broadcast (shared hook)
  const { active: audioBroadcast, level: audioLevel, toggle: toggleAudioBroadcast } = useAudioBroadcast(STUDIO_ID);

  // Modals
  const [showQuickText, setShowQuickText] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [overlays, setOverlays] = useState({});

  // Screen-specific
  const [screenTransition, setScreenTransition] = useState('crossfade');

  const socketRef = useRef(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchData = useCallback(async () => {
    try {
      const [sd, ld] = await Promise.all([api.get('/screens'), api.get('/layouts')]);
      if (!mountedRef.current) return;
      setScreens(sd.screens || sd || []);
      setLayouts(ld.layouts || ld || []);
      setLastUpdate(new Date());
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    const socket = connectSocket();
    socketRef.current = socket;

    socket.emit('join_studio', { studioId: STUDIO_ID });

    socket.on('screen_status', ({ screenId, online, is_online, last_seen }) => {
      setScreens(prev => prev.map(s =>
        s.id === screenId ? { ...s, is_online: online ?? is_online, last_seen: last_seen || s.last_seen } : s
      ));
    });

    socket.on('screen_layout_changed', ({ screenId, layoutId }) => {
      setScreens(prev => prev.map(s =>
        s.id === screenId ? { ...s, current_layout_id: layoutId } : s
      ));
    });

    return () => {
      clearInterval(interval);
      socket.off('screen_status');
      socket.off('screen_layout_changed');
    };
  }, [fetchData]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  // ---- Actions ----
  async function pushLayoutToAll(layoutId, transition) {
    const layout = layouts.find(l => l.id === layoutId);
    if (!layout) return;
    const t = transition || transitionType;
    const socket = getSocket();
    try {
      // Push layout via sync API
      await api.post('/screens/sync', { layout_id: layoutId });
      // Emit transition event so screens animate
      socket.emit('push_layout_transition', { layoutId, transition: t, duration: transitionDuration });
      setProgramLayout(layout);
      setBlackoutActive(false);
      fetchData();
    } catch (err) {
      console.error('Push all failed:', err);
    }
  }

  async function pushBlackout() {
    const socket = getSocket();
    // Find blackout layout or push empty
    const blackout = layouts.find(l => l.name?.toLowerCase().includes('blackout'));
    if (blackout) {
      await pushLayoutToAll(blackout.id, 'cut');
    } else {
      // Push black to all screens via sync
      screens.filter(s => s.is_online).forEach(s => {
        socket.emit('control_action', { action: 'set_layout', screenId: s.id, layoutId: null, data: { layout: { background: '#000000', modules: [] } } });
      });
    }
    setBlackoutActive(true);
  }

  function pushQuickText(text, subtitle) {
    const socket = getSocket();
    socket.emit('update_module_text', { studioId: STUDIO_ID, text, subtitle });
  }

  function pushAnnouncement(text, duration) {
    const socket = getSocket();
    socket.emit('push_overlay', { studioId: STUDIO_ID, overlay: { type: 'announcement', text, duration } });
  }

  function pushNowPlaying(artist, song) {
    const socket = getSocket();
    socket.emit('push_overlay', { studioId: STUDIO_ID, overlay: { type: 'now_playing', artist, song } });
  }

  function identifyScreen(screenId) {
    const socket = getSocket();
    socket.emit('identify_screen', { screenId });
  }

  function reloadScreen(screenId) {
    const socket = getSocket();
    socket.emit('reload_screen', { screenId });
  }

  async function pushLayoutToScreen(screenId, layoutId) {
    try {
      await api.post(`/screens/${screenId}/layout`, { layout_id: layoutId });
      const socket = getSocket();
      socket.emit('push_layout_transition', { layoutId, transition: screenTransition || transitionType, duration: transitionDuration, screenId });
      setShowPushMenu(false);
      fetchData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  // TAKE: push preview to program
  function handleTake() {
    if (!previewLayout) return;
    pushLayoutToAll(previewLayout.id);
  }

  // CUT: instant push preview to program
  function handleCut() {
    if (!previewLayout) return;
    pushLayoutToAll(previewLayout.id, 'cut');
  }

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKey(e) {
      // Don't capture if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;
      if (key >= '1' && key <= '9') {
        const idx = parseInt(key) - 1;
        if (layouts[idx]) {
          e.preventDefault();
          pushLayoutToAll(layouts[idx].id);
        }
      } else if (key === 'b' || key === 'B') {
        e.preventDefault();
        pushBlackout();
      } else if (key === 't' || key === 'T') {
        e.preventDefault();
        setShowQuickText(true);
      } else if (key === 'a' || key === 'A') {
        e.preventDefault();
        toggleAudioBroadcast();
      } else if (key === ' ') {
        e.preventDefault();
        handleTake();
      } else if (key === 'Escape') {
        setShowQuickText(false);
        setShowAnnouncement(false);
        setShowNowPlaying(false);
        setShowOverlayPanel(false);
        setSelected(null);
      } else if (key === 'Tab') {
        e.preventDefault();
        if (screens.length === 0) return;
        const idx = selected ? screens.findIndex(s => s.id === selected.id) : -1;
        const next = (idx + 1) % screens.length;
        setSelected(screens[next]);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [layouts, screens, selected, previewLayout, audioBroadcast, transitionType, transitionDuration]);

  const onlineCount = screens.filter(s => s.is_online).length;
  function getLayout(screen) { return layouts.find(l => l.id === screen.current_layout_id) || null; }

  // Determine most common current layout as "program"
  useEffect(() => {
    if (!programLayout && screens.length > 0 && layouts.length > 0) {
      const counts = {};
      screens.forEach(s => { if (s.current_layout_id) counts[s.current_layout_id] = (counts[s.current_layout_id] || 0) + 1; });
      const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topId) setProgramLayout(layouts.find(l => l.id === topId) || null);
    }
  }, [screens, layouts]);

  const gridCols = screens.length <= 2 ? 2 : screens.length <= 4 ? 2 : screens.length <= 6 ? 3 : 4;

  const btnStyle = "px-3 py-1.5 rounded-lg text-xs font-medium transition-all";
  const glassBg = "rgba(255,255,255,0.05)";

  return (
    <div className="h-screen flex flex-col select-none overflow-hidden"
      style={{ background: '#060910', fontFamily: "'Inter', sans-serif" }}>

      {/* ===== TOP BAR ===== */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0 z-20"
        style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Left: branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-black text-xs uppercase tracking-widest">Broadcast Studio</span>
          </div>
          <span className="text-gray-700 text-xs">|</span>
          <span className="text-gray-400 text-[10px] uppercase tracking-widest">God View</span>
        </div>

        {/* Centre: quick actions */}
        <div className="flex items-center gap-2">
          <button onClick={pushBlackout}
            className={`${btnStyle} ${blackoutActive ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white'}`}
            style={blackoutActive ? {} : { background: glassBg }}
            title="Blackout All (B)">
            ⬛ {blackoutActive ? 'BLACKOUT' : 'Blackout'}
          </button>

          <button onClick={toggleAudioBroadcast}
            className={`${btnStyle} flex items-center gap-2 ${audioBroadcast ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'}`}
            style={audioBroadcast ? {} : { background: glassBg }}
            title="Audio Broadcast (A)">
            🎵 Audio
            {audioBroadcast && <AudioMeter level={audioLevel} />}
          </button>

          <button onClick={() => setShowQuickText(true)}
            className={`${btnStyle} text-gray-300 hover:text-white`} style={{ background: glassBg }}
            title="Quick Text (T)">
            💬 Text
          </button>

          <button onClick={() => setShowAnnouncement(true)}
            className={`${btnStyle} text-gray-300 hover:text-white`} style={{ background: glassBg }}
            title="Announcement">
            📢 Announce
          </button>

          <button onClick={() => setShowNowPlaying(true)}
            className={`${btnStyle} text-gray-300 hover:text-white`} style={{ background: glassBg }}
            title="Now Playing">
            🎤 Now Playing
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button onClick={() => setShowOverlayPanel(p => !p)}
            className={`${btnStyle} ${showOverlayPanel ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'}`}
            style={showOverlayPanel ? {} : { background: glassBg }}
            title="Overlay Panel">
            🎭 Overlays
          </button>

          <button onClick={() => setShowPvwPgm(p => !p)}
            className={`${btnStyle} ${showPvwPgm ? 'text-blue-400' : 'text-gray-500'}`}
            style={{ background: glassBg }}
            title="Toggle PVW/PGM">
            PVW/PGM
          </button>
        </div>

        {/* Right: tally + clock */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-semibold">{onlineCount} LIVE</span>
          </div>
          {screens.length - onlineCount > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-red-400 text-[10px] font-semibold">{screens.length - onlineCount} OFF</span>
            </div>
          )}
          <span className="text-gray-300 text-xs font-semibold"><Clock /></span>
          <a href="/control/dashboard" className="px-2 py-1 rounded-lg text-[10px] text-gray-500 hover:text-white transition-colors"
            style={{ background: glassBg }}>← Control</a>
        </div>
      </div>

      {/* ===== PVW / PGM BAR ===== */}
      {showPvwPgm && (
        <div className="flex items-center gap-4 px-4 py-2 shrink-0"
          style={{ background: 'rgba(6,9,16,0.95)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          {/* Preview */}
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-green-400"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>PVW</span>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {previewLayout ? (
                <span className="text-white text-xs font-medium">{previewLayout.name}</span>
              ) : (
                <span className="text-gray-600 text-xs italic">Click a layout in hotbar to preview</span>
              )}
            </div>
          </div>

          {/* TAKE / CUT */}
          <div className="flex gap-2 shrink-0">
            <button onClick={handleTake} disabled={!previewLayout}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                ${previewLayout ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}>
              TAKE
            </button>
            <button onClick={handleCut} disabled={!previewLayout}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                ${previewLayout ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}>
              CUT
            </button>
          </div>

          {/* Program */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="flex-1 flex items-center justify-end gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              {programLayout ? (
                <span className="text-red-400 text-xs font-medium">{programLayout.name}</span>
              ) : (
                <span className="text-gray-600 text-xs italic">No program</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-red-400"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>PGM</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCREEN GRID ===== */}
      <div className="flex-1 p-4 overflow-auto" style={{ paddingBottom: '140px' }}>
        {screens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <svg className="w-16 h-16 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 text-lg">No screens registered</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
            {screens.map(screen => (
              <ScreenTile key={screen.id} screen={screen} layout={getLayout(screen)}
                onClick={s => { setSelected(s); setShowPushMenu(false); }}
                selected={selected?.id === screen.id} />
            ))}
          </div>
        )}
      </div>

      {/* ===== SELECTED SCREEN PANEL ===== */}
      {selected && (
        <div className="fixed bottom-[120px] left-0 right-0 z-30 flex items-center justify-between px-6 py-3 gap-4"
          style={{ background: 'rgba(10,14,26,0.98)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${selected.is_online ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm">{selected.name}</p>
              <p className="text-gray-500 text-xs truncate">{getLayout(selected)?.name || 'No layout'} · Last seen {formatLastSeen(selected.last_seen)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Transition selector for this screen */}
            <select value={screenTransition} onChange={e => setScreenTransition(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs bg-white/5 text-gray-300 border border-white/10 outline-none">
              {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <button onClick={() => identifyScreen(selected.id)}
              className={`${btnStyle} text-yellow-400 hover:text-yellow-300`} style={{ background: 'rgba(234,179,8,0.1)' }}>
              🔦 Identify
            </button>

            <button onClick={() => reloadScreen(selected.id)}
              className={`${btnStyle} text-orange-400 hover:text-orange-300`} style={{ background: 'rgba(249,115,22,0.1)' }}>
              🔄 Reload
            </button>

            <a href={`/screen/${selected.id}`} target="_blank" rel="noopener noreferrer"
              className={`${btnStyle} text-gray-300 hover:text-white`} style={{ background: glassBg }}>
              Open ↗
            </a>

            <div className="relative">
              <button onClick={() => setShowPushMenu(p => !p)}
                className={`${btnStyle} text-white font-medium`} style={{ background: '#2563eb' }}>
                Push Layout ▾
              </button>
              {showPushMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl overflow-hidden shadow-2xl z-50"
                  style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Push to {selected.name}</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {layouts.map(l => (
                      <button key={l.id} onClick={() => pushLayoutToScreen(selected.id, l.id)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5
                          ${selected.current_layout_id === l.id ? 'text-blue-400' : 'text-gray-300'}`}>
                        {l.name}
                        {selected.current_layout_id === l.id && <span className="ml-2 text-[10px] text-blue-600 uppercase">active</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setSelected(null)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white transition-colors"
              style={{ background: glassBg }}>✕</button>
          </div>
        </div>
      )}

      {/* ===== LAYOUT HOTBAR (BOTTOM) ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-20"
        style={{ background: 'rgba(10,14,26,0.98)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Transition controls row */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-[10px] uppercase tracking-wider">Transition:</span>
            <div className="flex gap-1">
              {TRANSITIONS.map(t => (
                <button key={t} onClick={() => setTransitionType(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors
                    ${transitionType === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  style={transitionType !== t ? { background: 'rgba(255,255,255,0.03)' } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-[10px]">Duration:</span>
            <input type="range" min={0.3} max={3} step={0.1} value={transitionDuration}
              onChange={e => setTransitionDuration(+e.target.value)}
              className="w-20 h-1" />
            <span className="text-gray-400 text-[10px] font-mono w-8">{transitionDuration}s</span>
          </div>
        </div>

        {/* Layout cards */}
        <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto">
          <span className="text-gray-600 text-[10px] uppercase tracking-wider shrink-0 mr-1">Layouts:</span>
          {layouts.map((l, i) => {
            const isProgram = programLayout?.id === l.id;
            const isPreview = previewLayout?.id === l.id;
            return (
              <button key={l.id}
                onClick={() => {
                  if (previewLayout?.id === l.id) {
                    // Double-click = push directly
                    pushLayoutToAll(l.id);
                  } else {
                    setPreviewLayout(l);
                  }
                }}
                onDoubleClick={() => pushLayoutToAll(l.id)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all relative
                  ${isProgram ? 'ring-2 ring-red-500 text-white' : isPreview ? 'ring-2 ring-green-500 text-white' : 'text-gray-400 hover:text-white'}`}
                style={{ background: isProgram ? 'rgba(239,68,68,0.15)' : isPreview ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)' }}>
                {i < 9 && <span className="text-[9px] text-gray-600 absolute top-0.5 right-1">{i + 1}</span>}
                {l.name}
                {isProgram && <span className="ml-1.5 text-[8px] text-red-400 uppercase font-bold">PGM</span>}
                {isPreview && !isProgram && <span className="ml-1.5 text-[8px] text-green-400 uppercase font-bold">PVW</span>}
              </button>
            );
          })}
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center gap-3 px-4 pb-1.5">
          {[['1-9', 'Layouts'], ['B', 'Blackout'], ['T', 'Text'], ['A', 'Audio'], ['Space', 'Take'], ['Tab', 'Cycle'], ['Esc', 'Close']].map(([k, v]) => (
            <span key={k} className="text-gray-700 text-[9px]">
              <kbd className="px-1 py-0.5 rounded bg-white/5 text-gray-500 font-mono">{k}</kbd> {v}
            </span>
          ))}
        </div>
      </div>

      {/* ===== OVERLAY PANEL ===== */}
      {showOverlayPanel && (
        <OverlayPanel onClose={() => setShowOverlayPanel(false)} overlays={overlays}
          setOverlays={setOverlays} socket={getSocket()} />
      )}

      {/* ===== MODALS ===== */}
      {showQuickText && <QuickTextModal onClose={() => setShowQuickText(false)} onSubmit={pushQuickText} />}
      {showAnnouncement && <AnnouncementModal onClose={() => setShowAnnouncement(false)} onSubmit={pushAnnouncement} />}
      {showNowPlaying && <NowPlayingModal onClose={() => setShowNowPlaying(false)} onSubmit={pushNowPlaying} />}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input[type="range"] { -webkit-appearance: none; background: rgba(255,255,255,0.1); border-radius: 4px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #3b82f6; cursor: pointer; }
      `}</style>
    </div>
  );
}
