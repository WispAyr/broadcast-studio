import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';

const ACCENT_COLORS = {
  sky: { bg: 'bg-sky-500/20', border: 'border-sky-500/40', text: 'text-sky-400', dot: 'bg-sky-400' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', dot: 'bg-amber-400' },
  violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-400', dot: 'bg-violet-400' },
  rose: { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-400', dot: 'bg-rose-400' },
};

const CATEGORY_LABELS = {
  core: 'Core Views',
  data: 'Data & Info',
  special: 'Special Events',
  community: 'Community',
  utility: 'Utility',
  weather: 'Weather',
  ayrshire: 'Ayrshire',
};

const ICON_MAP = {
  radar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="2" strokeWidth="1.5" />
      <line x1="12" y1="12" x2="20" y2="6" strokeWidth="2" />
    </svg>
  ),
  film: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>),
  layout: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>),
  list: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>),
  cloud: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-4.584-7A4.992 4.992 0 003 15z" /></svg>),
  shield: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>),
  radio: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a5 5 0 010-7.072m5.656 0a5 5 0 010 7.072M12 12h.01" /></svg>),
  fuel: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>),
  trophy: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15l-2 5h4l-2-5zm-4-8h8M5 3h14v4a7 7 0 01-14 0V3z" /></svg>),
  star: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>),
  camera: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" strokeWidth="1.5" /></svg>),
  heart: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>),
  terminal: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>),
  layers: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>),
  globe: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="1.5" /><path strokeLinecap="round" strokeWidth="1.5" d="M2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10A15 15 0 0112 2z" /></svg>),
  rewind: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>),
  'fast-forward': (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>),
  play: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><circle cx="12" cy="12" r="10" strokeWidth="1.5" /></svg>),
};

function SceneCard({ scene, isLive, isObs, onPushToScreen, onSetObs, screens }) {
  const accent = ACCENT_COLORS[scene.accent] || ACCENT_COLORS.sky;
  const [showPush, setShowPush] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className={`relative group rounded-xl border ${isLive ? accent.border + ' ' + accent.bg : 'border-gray-800 bg-gray-900/60'} hover:border-gray-600 transition-all overflow-hidden`}>
      {/* Preview iframe - lazy loaded on hover */}
      <div
        className="aspect-video bg-gray-950 relative cursor-pointer overflow-hidden"
        onClick={() => setPreviewOpen(true)}
      >
        {previewOpen ? (
          <iframe
            src={scene.url}
            className="w-full h-full border-0 pointer-events-none"
            style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className={accent.text}>{ICON_MAP[scene.icon] || ICON_MAP.radar}</div>
            <span className="text-xs text-gray-500">Click to preview</span>
          </div>
        )}
        {isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 rounded-full px-2.5 py-1">
            <div className={`w-2 h-2 rounded-full ${accent.dot} animate-pulse`} />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
          </div>
        )}
        {isObs && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-purple-900/80 rounded-full px-2.5 py-1">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">OBS</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={`${accent.text}`}>{ICON_MAP[scene.icon] || ICON_MAP.radar}</span>
          <h3 className="text-sm font-semibold text-white truncate">{scene.name}</h3>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{scene.description}</p>

        <div className="flex gap-2">
          {/* Push to screen */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowPush(!showPush)}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            >
              Push to Screen
            </button>
            {showPush && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 max-h-48 overflow-y-auto">
                {screens.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { onPushToScreen(scene, s.id); setShowPush(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    {s.name}
                  </button>
                ))}
                {screens.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500">No screens configured</div>
                )}
              </div>
            )}
          </div>

          {/* Set as OBS scene */}
          <button
            onClick={() => onSetObs(scene)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-900/50 hover:bg-purple-800/60 text-purple-300 transition-colors"
            title="Push to OBS"
          >
            OBS
          </button>
        </div>
      </div>
    </div>
  );
}

function OBSPanel({ obsStatus, obsScenes, obsStream, obsStats, onConnect, onDisconnect, onSetScene }) {
  const connected = obsStatus?.connected;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">OBS Control</h2>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${connected ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <button
          onClick={connected ? onDisconnect : onConnect}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${connected ? 'bg-red-900/50 hover:bg-red-800/60 text-red-300' : 'bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300'}`}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {connected && (
        <>
          {/* Stream status */}
          {obsStream && (
            <div className="flex items-center gap-4 mb-3 text-xs">
              <div className={`flex items-center gap-1.5 ${obsStream.active ? 'text-red-400' : 'text-gray-500'}`}>
                <div className={`w-2 h-2 rounded-full ${obsStream.active ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                {obsStream.active ? 'LIVE' : 'Offline'}
              </div>
              {obsStream.active && obsStream.timecode && (
                <span className="text-gray-400 font-mono">{obsStream.timecode}</span>
              )}
              {obsStats && (
                <>
                  <span className="text-gray-500">{obsStats.fps?.toFixed(0)} fps</span>
                  <span className="text-gray-500">CPU {obsStats.cpuUsage?.toFixed(1)}%</span>
                </>
              )}
            </div>
          )}

          {/* Scene buttons */}
          {obsScenes && (
            <div className="flex flex-wrap gap-2">
              {obsScenes.scenes?.map(s => (
                <button
                  key={s.name}
                  onClick={() => onSetScene(s.name)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    s.name === obsScenes.current
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!connected && obsStatus && (
        <div className="text-xs text-gray-500">
          Target: {obsStatus.host}:{obsStatus.port}
        </div>
      )}
    </div>
  );
}

export default function EgpkScenes() {
  const [scenes, setScenes] = useState([]);
  const [screens, setScreens] = useState([]);
  const [liveSceneId, setLiveSceneId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [obsStatus, setObsStatus] = useState(null);
  const [obsScenes, setObsScenes] = useState(null);
  const [obsStream, setObsStream] = useState(null);
  const [obsStats, setObsStats] = useState(null);
  const [toast, setToast] = useState(null);
  const pollRef = useRef(null);

  // Load scenes and screens
  useEffect(() => {
    api.get('/egpk/scenes').then(d => setScenes(d.scenes || [])).catch(() => {});
    api.get('/screens').then(d => setScreens(Array.isArray(d) ? d : d.screens || [])).catch(() => {});
    api.get('/obs/status').then(d => setObsStatus(d)).catch(() => {});
  }, []);

  // Poll OBS status when connected
  useEffect(() => {
    if (!obsStatus?.connected) {
      setObsScenes(null);
      setObsStream(null);
      setObsStats(null);
      return;
    }
    const poll = () => {
      Promise.all([
        api.get('/obs/scenes').catch(() => null),
        api.get('/obs/stream').catch(() => null),
        api.get('/obs/stats').catch(() => null),
      ]).then(([sc, st, stats]) => {
        if (sc) setObsScenes(sc);
        if (st) setObsStream(st);
        if (stats) setObsStats(stats);
      });
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [obsStatus?.connected]);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleConnect = async () => {
    try {
      const r = await api.post('/obs/connect', {});
      if (r.ok) {
        showToast('Connected to OBS', 'success');
        setObsStatus({ ...obsStatus, connected: true });
      } else {
        showToast(`OBS connection failed: ${r.error}`, 'error');
      }
    } catch (err) {
      showToast('Failed to connect to OBS', 'error');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/obs/disconnect', {});
      setObsStatus({ ...obsStatus, connected: false });
      showToast('Disconnected from OBS');
    } catch {}
  };

  const handleSetObsScene = async (sceneName) => {
    try {
      await api.post('/obs/scene', { sceneName });
      setObsScenes(prev => prev ? { ...prev, current: sceneName } : prev);
      showToast(`OBS scene: ${sceneName}`, 'success');
    } catch (err) {
      showToast('Failed to switch OBS scene', 'error');
    }
  };

  const handlePushToScreen = async (scene, screenId) => {
    try {
      // Find or create a layout for this scene, then push it
      // First check if there's a layout with this scene name
      const layouts = await api.get('/layouts');
      const layoutList = Array.isArray(layouts) ? layouts : layouts.layouts || [];
      let layout = layoutList.find(l => l.name === `EGPK: ${scene.name}`);

      if (!layout) {
        // Create layout with iframe module
        const created = await api.post('/layouts', {
            name: `EGPK: ${scene.name}`,
            grid_cols: 1,
            grid_rows: 1,
            modules: JSON.stringify([{
              type: 'iframe',
              x: 0, y: 0, w: 1, h: 1,
              config: { url: scene.url, refreshInterval: 0 },
            }]),
          });
        layout = created;
      }

      if (layout?.id) {
        await api.post(`/screens/${screenId}/layout`, { layout_id: layout.id });
        setLiveSceneId(scene.id);
        showToast(`Pushed "${scene.name}" to screen`, 'success');
      }
    } catch (err) {
      showToast('Failed to push scene', 'error');
    }
  };

  const handleSetObs = async (scene) => {
    if (!obsStatus?.connected) {
      showToast('Connect to OBS first', 'error');
      return;
    }
    try {
      // Update the browser source URL in the current OBS scene
      const currentScene = obsScenes?.current;
      if (currentScene) {
        await api.post('/obs/source-url', { sceneName: currentScene, url: scene.url });
        showToast(`OBS source → ${scene.name}`, 'success');
      }
    } catch (err) {
      showToast('Failed to update OBS source', 'error');
    }
  };

  // Group scenes by category
  const categories = {};
  const filtered = filter === 'all' ? scenes : scenes.filter(s => s.category === filter);
  for (const s of filtered) {
    const cat = s.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(s);
  }

  const categoryOrder = ['core', 'data', 'weather', 'ayrshire', 'special', 'community', 'utility'];
  const uniqueCategories = [...new Set(scenes.map(s => s.category))];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">EGPK Live TV</h1>
          <p className="text-sm text-gray-400 mt-1">Broadcast scenes — EGPK, weather, and Ayrshire data</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://egpk.info/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            Open Director
          </a>
        </div>
      </div>

      {/* OBS Control Panel */}
      <OBSPanel
        obsStatus={obsStatus}
        obsScenes={obsScenes}
        obsStream={obsStream}
        obsStats={obsStats}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSetScene={handleSetObsScene}
      />

      {/* Category filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          All ({scenes.length})
        </button>
        {categoryOrder.filter(c => uniqueCategories.includes(c)).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {CATEGORY_LABELS[cat] || cat} ({scenes.filter(s => s.category === cat).length})
          </button>
        ))}
      </div>

      {/* Scene grid by category */}
      {categoryOrder.filter(c => categories[c]).map(cat => (
        <div key={cat} className="mb-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            {CATEGORY_LABELS[cat] || cat}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {categories[cat].map(scene => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isLive={liveSceneId === scene.id}
                isObs={false}
                screens={screens}
                onPushToScreen={handlePushToScreen}
                onSetObs={handleSetObs}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-600 text-white'
          : toast.type === 'error' ? 'bg-red-600 text-white'
          : 'bg-gray-700 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
