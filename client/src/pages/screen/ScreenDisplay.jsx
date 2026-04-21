import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import ModuleRenderer from '../../components/ModuleRenderer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ProjectionMapper } from '../../lib/webgl-projection';
import { getLayers, getChromaStyles } from '../../lib/layers';
import ChromaFilter from '../../components/ChromaFilter';

function OverlayRenderer({ overlay }) {
  const baseStyle = { position: 'absolute', animation: 'overlayIn 0.5s ease-out' };

  switch (overlay.type) {
    case 'lower_third':
      return (
        <div style={{ ...baseStyle, bottom: '10%', left: '5%', right: '30%' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(0,100,255,0.9), rgba(0,60,180,0.9))', padding: '16px 24px', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
            <div style={{ color: 'white', fontSize: '2.5vw', fontWeight: 'bold' }}>{overlay.name || ''}</div>
            {overlay.title && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.5vw', marginTop: '4px' }}>{overlay.title}</div>}
          </div>
        </div>
      );
    case 'logo_bug':
      return (
        <div style={{ ...baseStyle, top: '3%', right: '3%' }}>
          {overlay.url ? <img src={overlay.url} alt="Logo" style={{ height: '6vh', opacity: 0.8 }} /> : <div style={{ width: '6vh', height: '6vh', background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />}
        </div>
      );
    case 'countdown': {
      const target = overlay.targetTime ? new Date(overlay.targetTime).getTime() : 0;
      return <CountdownOverlay targetTime={target} />;
    }
    case 'ticker':
      return (
        <div style={{ ...baseStyle, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', padding: '8px 0', overflow: 'hidden' }}>
          <div style={{ color: 'white', fontSize: '2vw', whiteSpace: 'nowrap', animation: 'ticker 20s linear infinite' }}>
            {overlay.text || ''}
          </div>
          <style>{`@keyframes ticker { from { transform: translateX(100vw); } to { transform: translateX(-100%); } }`}</style>
        </div>
      );
    case 'coming_up':
      return (
        <div style={{ ...baseStyle, bottom: '15%', right: '5%', background: 'rgba(0,0,0,0.85)', padding: '16px 24px', borderRadius: '8px', borderLeft: '4px solid #facc15' }}>
          <div style={{ color: '#facc15', fontSize: '1.2vw', fontWeight: 'bold', textTransform: 'uppercase' }}>Coming Up Next</div>
          <div style={{ color: 'white', fontSize: '2vw', marginTop: '4px' }}>{overlay.text || ''}</div>
        </div>
      );
    case 'now_playing':
      return (
        <div style={{ ...baseStyle, bottom: '8%', left: '5%', background: 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(109,40,217,0.9))', padding: '12px 20px', borderRadius: '8px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1vw', textTransform: 'uppercase', letterSpacing: '2px' }}>Now Playing</div>
          <div style={{ color: 'white', fontSize: '2vw', fontWeight: 'bold' }}>{overlay.artist || ''}</div>
          {overlay.song && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.5vw' }}>{overlay.song}</div>}
        </div>
      );
    case 'announcement':
      return (
        <div style={{ ...baseStyle, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
          <div style={{ color: 'white', fontSize: '5vw', fontWeight: 'bold', textAlign: 'center', padding: '5%' }}>{overlay.text || ''}</div>
        </div>
      );
    case 'cg_text':
      return (
        <div style={{ ...baseStyle, bottom: '5%', left: '5%', right: '5%', textAlign: 'center' }}>
          <div style={{ color: 'white', fontSize: '3vw', fontWeight: 'bold', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{overlay.text || ''}</div>
        </div>
      );
    case 'incident': {
      // Severity-coloured banner pinned to the top of the screen. Used by the
      // dashboard "Push banner" button and the van emergency endpoint.
      const sev = overlay.severity || 'info';
      const palette = {
        info:     { bg: 'linear-gradient(90deg, #1e40af, #2563eb)', dot: '#60a5fa', label: 'NOTICE' },
        warning:  { bg: 'linear-gradient(90deg, #b45309, #d97706)', dot: '#fbbf24', label: 'ADVISORY' },
        danger:   { bg: 'linear-gradient(90deg, #991b1b, #dc2626)', dot: '#f87171', label: 'INCIDENT' },
        critical: { bg: 'linear-gradient(90deg, #7f1d1d, #b91c1c)', dot: '#fecaca', label: 'EMERGENCY' },
      }[sev] || { bg: 'linear-gradient(90deg, #334155, #475569)', dot: '#e2e8f0', label: 'NOTICE' };
      const isCritical = sev === 'critical';
      return (
        <div style={{
          ...baseStyle,
          top: 0, left: 0, right: 0,
          background: palette.bg,
          padding: '0.8vh 2.5vw',
          display: 'flex', alignItems: 'center', gap: '1.5vw',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          borderBottom: `3px solid ${palette.dot}`,
          animation: isCritical
            ? 'overlayIn 0.4s ease-out, incidentPulse 1.2s ease-in-out infinite'
            : 'overlayIn 0.4s ease-out',
        }}>
          <style>{`@keyframes incidentPulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }`}</style>
          <span style={{
            display: 'inline-block', width: '0.9vw', height: '0.9vw',
            borderRadius: '50%', background: palette.dot,
            boxShadow: `0 0 12px ${palette.dot}`,
            flexShrink: 0,
          }} />
          <span style={{
            color: 'rgba(255,255,255,0.75)', fontSize: '0.9vw',
            fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', flexShrink: 0,
          }}>{palette.label}</span>
          <span style={{
            color: 'white', fontSize: '1.4vw', fontWeight: 600,
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{overlay.text || ''}</span>
          {overlay.source && (
            <span style={{
              color: 'rgba(255,255,255,0.55)', fontSize: '0.85vw',
              fontFamily: 'monospace', flexShrink: 0,
            }}>{overlay.source}</span>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

function CountdownOverlay({ targetTime }) {
  const [remaining, setRemaining] = React.useState('');
  React.useEffect(() => {
    const iv = setInterval(() => {
      const diff = targetTime - Date.now();
      if (diff <= 0) { setRemaining('00:00'); return; }
      const m = String(Math.floor(diff / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setRemaining(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [targetTime]);
  return (
    <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '16px 32px', borderRadius: '12px' }}>
      <div style={{ color: 'white', fontSize: '6vw', fontWeight: 'bold', fontFamily: 'monospace' }}>{remaining}</div>
    </div>
  );
}

export default function ScreenDisplay() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const setupMode = searchParams.get('setup') === 'true';

  const [layout, setLayout] = useState(null);
  const [modules, setModules] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState('crossfade');
  const [prevModules, setPrevModules] = useState([]);
  const [prevLayout, setPrevLayout] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [overlays, setOverlays] = useState([]);
  const [identifyFlash, setIdentifyFlash] = useState(false);
  const [displayProfile, setDisplayProfile] = useState(null);
  const [transitionDurationMs, setTransitionDurationMs] = useState(600);
  const [disconnectBehavior, setDisconnectBehavior] = useState('message'); // 'message' | 'black' | 'freeze'
  const [screenDimensions, setScreenDimensions] = useState(null); // {width, height}

  const heartbeatRef = useRef(null);
  const socketRef = useRef(null);
  const gridRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const projectionRef = useRef(null);

  // Load cached layout from localStorage immediately (before WS connects)
  // so screen is never blank on browser restart / power cycle
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`bs_layout_v2_${id}`);
      if (cached) {
        const l = JSON.parse(cached);
        setLayout(l);
        const raw = typeof l.modules === 'string' ? JSON.parse(l.modules) : (l.modules || []);
        setModules(Array.isArray(raw) ? raw : (raw.layers ? raw.layers.flatMap(layer => layer.modules || []) : []));
      }
    } catch { /* corrupted cache — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Click-to-fullscreen: first tap/click anywhere requests browser fullscreen
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, []);

  // Smooth layout transition with effects
  const applyLayout = useCallback((newLayout, transition, duration) => {
    if (!newLayout) return;
    const effect = transition || newLayout.transition || 'crossfade';
    const dur = duration ? duration * 1000 : 600;
    setTransitionDurationMs(dur);
    setTransitionType(effect);
    setPrevLayout(layout);
    setPrevModules(modules);
    setTransitioning(true);
    setTimeout(() => {
      setLayout(newLayout);
      const raw = typeof newLayout.modules === 'string'
        ? JSON.parse(newLayout.modules)
        : (newLayout.modules || []);
      const mods = Array.isArray(raw) ? raw : (raw.layers ? raw.layers.flatMap(l => l.modules || []) : []);
      setModules(mods);
      // Persist to localStorage so cold-start has something to show
      try {
        localStorage.setItem(`bs_layout_v2_${id}`, JSON.stringify(newLayout));
      } catch { /* storage full or unavailable */ }
      setTimeout(() => {
        setTransitioning(false);
        setPrevLayout(null);
        setPrevModules([]);
      }, effect === 'cut' ? 0 : dur);
    }, effect === 'cut' ? 0 : 50);
  }, [layout, modules, id]);

  // Fetch screen data (public, no auth required)
  const fetchScreenData = useCallback(async () => {
    try {
      const res = await fetch(`/api/screens/${id}`);
      if (!res.ok) throw new Error('Failed to fetch screen');
      const data = await res.json();
      const screen = data.screen || data;

      if (screen.current_layout) {
        const l = screen.current_layout;
        setLayout(l);
        setModules(typeof l.modules === 'string' ? JSON.parse(l.modules) : (l.modules || []));
      } else if (screen.current_layout_id) {
        try {
          const layoutRes = await fetch(`/api/layouts/${screen.current_layout_id}`);
          if (layoutRes.ok) {
            const layoutData = await layoutRes.json();
            const l = layoutData.layout || layoutData;
            setLayout(l);
            setModules(typeof l.modules === 'string' ? JSON.parse(l.modules) : (l.modules || []));
          }
        } catch {
          // Layout fetch failed
        }
      }
      // Load display profile + disconnect behavior + dimensions
      if (screen.config) {
        const cfg = typeof screen.config === 'string' ? JSON.parse(screen.config || '{}') : screen.config;
        if (cfg.displayProfile) {
          const gp = screen.group_profile ? (typeof screen.group_profile === 'string' ? JSON.parse(screen.group_profile) : screen.group_profile) : {};
          setDisplayProfile({ ...gp, ...cfg.displayProfile });
        }
        if (cfg.disconnectBehavior) setDisconnectBehavior(cfg.disconnectBehavior);
        if (cfg.screenType === 'led' || cfg.screenType === 'video_wall') setDisconnectBehavior(prev => prev === 'message' ? 'black' : prev);
      }
      // Store configured dimensions
      if (screen.width && screen.height) {
        setScreenDimensions({ width: screen.width, height: screen.height });
      }
      setError(null);
    } catch (err) {
      setError(err.message);
      // Try with auth token as fallback
      try {
        const token = localStorage.getItem('broadcast_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/screens/${id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const screen = data.screen || data;
          if (screen.current_layout) {
            setLayout(screen.current_layout);
            setModules(typeof screen.current_layout.modules === 'string'
              ? JSON.parse(screen.current_layout.modules)
              : (screen.current_layout.modules || []));
            setError(null);
          }
        }
      } catch {
        // Both attempts failed
      }
    }
  }, [id]);

  useEffect(() => {
    fetchScreenData();
  }, [fetchScreenData]);

  // Keep stable refs for socket handlers
  const applyLayoutRef = useRef(applyLayout);
  applyLayoutRef.current = applyLayout;
  const fetchScreenDataRef = useRef(fetchScreenData);
  fetchScreenDataRef.current = fetchScreenData;

  // Socket connection with auto-reconnect
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnectCount(0);
      socket.emit('register_screen', { screenId: id });
      // Re-fetch layout + display profile on reconnect
      fetchScreenDataRef.current();
      // Re-fetch any counter modules so their values are fresh after a server
      // restart (counters are now persisted in DB, so this is authoritative)
      fetch(`/api/counter/all`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (Array.isArray(data)) {
            data.forEach(({ id: moduleId, count }) => {
              setModules(prev =>
                prev.map(m =>
                  m.id === moduleId ? { ...m, config: { ...m.config, count } } : m
                )
              );
            });
          }
        })
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setReconnectCount((prev) => prev + 1);
    });

    socket.on('set_layout', (data) => {
      if (data.layout) applyLayoutRef.current(data.layout);
    });

    socket.on('update_module', (data) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === data.moduleId ? { ...m, config: { ...m.config, ...data.config } } : m
        )
      );
    });

    socket.on('variable_update', (data) => {
      setModules((prev) =>
        prev.map((m) => {
          if (!m.config || m.config.variable_id !== data.id) return m;
          const field = m.config.variable_field || 'count';
          return { ...m, config: { ...m.config, [field]: data.value } };
        })
      );
    });

    socket.on('variable_snapshot', (data) => {
      const vars = data && data.variables;
      if (!vars || typeof vars !== 'object') return;
      setModules((prev) =>
        prev.map((m) => {
          if (!m.config || !m.config.variable_id) return m;
          const v = vars[m.config.variable_id];
          if (v === undefined) return m;
          const field = m.config.variable_field || 'count';
          return { ...m, config: { ...m.config, [field]: v } };
        })
      );
    });

    socket.on('sync_all', (data) => {
      if (data.layout) applyLayoutRef.current(data.layout);
    });

    socket.on('emergency_layout', (data) => {
      if (data.layout) applyLayoutRef.current(data.layout);
    });

    // Transition-aware layout push
    socket.on('push_layout_transition', (data) => {
      if (data.layoutId) {
        // Fetch the layout data and apply with transition
        fetch(`/api/layouts/${data.layoutId}`)
          .then(r => r.ok ? r.json() : null)
          .then(layoutData => {
            if (layoutData) {
              const l = layoutData.layout || layoutData;
              applyLayoutRef.current(l, data.transition, data.duration);
            }
          })
          .catch(() => {});
      }
    });

    // Overlay system
    socket.on('push_overlay', (data) => {
      if (data.overlay) {
        const overlayType = data.overlay.type;
        setOverlays(prev => {
          // Replace existing overlay of same type, or add new
          const filtered = prev.filter(o => o.type !== overlayType);
          return [...filtered, { ...data.overlay, _addedAt: Date.now() }];
        });
        // Auto-remove any overlay that carries a duration (seconds).
        // Used by announcements and by the incident-banner system for
        // timed advisories ("Race delayed 15min — clear in 10").
        if (data.overlay.duration) {
          setTimeout(() => {
            setOverlays(prev => prev.filter(o => o.type !== overlayType));
          }, data.overlay.duration * 1000);
        }
      }
    });

    socket.on('remove_overlay', (data) => {
      setOverlays(prev => prev.filter(o => o.type !== data.overlayType));
    });

    socket.on('clear_overlays', () => {
      setOverlays([]);
    });

    socket.on('identify_screen', () => {
      setIdentifyFlash(true);
      setTimeout(() => setIdentifyFlash(false), 2000);
    });

    socket.on('reload_screen', () => {
      window.location.reload();
    });

    socket.on('update_display_profile', (data) => {
      if (data.config?.displayProfile) {
        setDisplayProfile(prev => ({ ...(prev || {}), ...data.config.displayProfile }));
      }
      if (data.groupProfile) {
        setDisplayProfile(prev => ({ ...(data.groupProfile || {}), ...(prev || {}) }));
      }
      // Producer may have changed disconnect behaviour / screenType while we
      // were connected — apply without waiting for a reload.
      if (data.config?.disconnectBehavior) {
        setDisconnectBehavior(data.config.disconnectBehavior);
      }
      if (data.config?.screenType === 'led' || data.config?.screenType === 'video_wall') {
        setDisconnectBehavior(prev => prev === 'message' ? 'black' : prev);
      }
    });

    socket.on('update_module_text', (data) => {
      // Match strategy (in priority order):
      //   1. Exact moduleId match (targeted push).
      //   2. moduleType match (broadcast to every module of a given type —
      //      used by Dashboard/GodView "Push Text" which doesn't know the
      //      specific module uuid).
      //   3. Magic id '__live_text__' (legacy convention) matches any live_text module.
      const wantsTypeMatch = data.moduleType && !data.moduleId;
      const isLegacyBroadcast = data.moduleId === '__live_text__';
      setModules((prev) =>
        prev.map((m) => {
          const matchesId   = data.moduleId && m.id === data.moduleId && !isLegacyBroadcast;
          const matchesType = wantsTypeMatch && (m.type || m.module || m.module_type) === data.moduleType;
          const matchesLegacy = isLegacyBroadcast && (m.type || m.module || m.module_type) === 'live_text';
          if (matchesId || matchesType || matchesLegacy) {
            return { ...m, config: {
              ...m.config,
              text: data.text !== undefined ? data.text : m.config?.text,
              subtitle: data.subtitle !== undefined ? data.subtitle : m.config?.subtitle,
            }};
          }
          return m;
        })
      );
    });

    // Heartbeat every 10 seconds (was 30s) — matches tighter server pingInterval
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('screen_heartbeat', { screenId: id });
      }
    }, 10000);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('set_layout');
      socket.off('update_module');
      socket.off('sync_all');
      socket.off('emergency_layout');
      socket.off('update_module_text');
      socket.off('push_layout_transition');
      socket.off('push_overlay');
      socket.off('remove_overlay');
      socket.off('clear_overlays');
      socket.off('identify_screen');
      socket.off('reload_screen');
      socket.off('update_display_profile');
      clearInterval(heartbeatRef.current);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Initialize WebGL projection mapping
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (!sourceCanvasRef.current) {
      sourceCanvasRef.current = document.createElement('canvas');
    }
    sourceCanvasRef.current.width = canvas.width;
    sourceCanvasRef.current.height = canvas.height;

    let mapper;
    try {
      mapper = new ProjectionMapper(canvas, id);
      projectionRef.current = mapper;

      const cal = mapper.getCalibration();
      const hasWarp = cal.corners.some((c, i) => {
        const defaults = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
        return Math.abs(c.x - defaults[i].x) > 0.001 || Math.abs(c.y - defaults[i].y) > 0.001;
      });
      const hasTransform = hasWarp ||
        Math.abs(cal.scale.x - 1) > 0.001 || Math.abs(cal.scale.y - 1) > 0.001 ||
        Math.abs(cal.position.x) > 0.001 || Math.abs(cal.position.y) > 0.001;

      setProjectionActive(hasTransform || setupMode);

      if (setupMode) {
        mapper.enableSetup();
      }
    } catch {
      setProjectionActive(false);
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (sourceCanvasRef.current) {
        sourceCanvasRef.current.width = canvas.width;
        sourceCanvasRef.current.height = canvas.height;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapper) mapper.destroy();
      projectionRef.current = null;
    };
  }, [id, setupMode]);

  // Capture DOM content to source canvas and render via WebGL
  useEffect(() => {
    if (!projectionActive || !projectionRef.current || !gridRef.current) return;

    const mapper = projectionRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    let running = true;
    let frameId = null;

    const captureAndRender = () => {
      if (!running) return;

      const grid = gridRef.current;
      if (grid && sourceCanvas) {
        const ctx = sourceCanvas.getContext('2d');
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const clone = grid.cloneNode(true);
        clone.style.width = width + 'px';
        clone.style.height = height + 'px';
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '0';

        const data = new XMLSerializer().serializeToString(clone);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${data}</div>
          </foreignObject>
        </svg>`;

        const img = new Image();
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          mapper.setSourceTexture(sourceCanvas);
          mapper.render();
          if (running) frameId = requestAnimationFrame(captureAndRender);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          const bg = getComputedStyle(grid).backgroundColor || '#000';
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, width, height);
          mapper.setSourceTexture(sourceCanvas);
          mapper.render();
          if (running) frameId = requestAnimationFrame(captureAndRender);
        };

        img.src = url;
      } else {
        frameId = requestAnimationFrame(captureAndRender);
      }
    };

    frameId = requestAnimationFrame(captureAndRender);

    return () => {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [projectionActive, layout, modules]);

  const gridRows = layout?.grid_rows || 3;
  const gridColumns = layout?.grid_cols || layout?.grid_columns || 4;
  const background = layout?.background || '#000000';

  // Defensive: getLayers() walks user-authored module data and can throw on
  // malformed layouts (bad JSON, unexpected shapes). A crash here would unmount
  // the entire wall mid-broadcast, so fall back to a single pass-through layer.
  let renderedLayers;
  try {
    renderedLayers = getLayers(layout?.modules ?? modules).sort((a, b) => a.order - b.order);
  } catch (err) {
    console.error('[ScreenDisplay] getLayers failed, falling back to flat layer:', err);
    const flat = Array.isArray(modules) ? modules : [];
    renderedLayers = [{ id: 'fallback', order: 0, visible: true, opacity: 1, modules: flat }];
  }

  return (
    <div className="screen-display" style={{ background, position: 'relative', cursor: 'none',
      ...(screenDimensions ? { width: screenDimensions.width, height: screenDimensions.height, overflow: 'hidden' } : {}),
      ...(displayProfile ? {
        filter: [
          displayProfile.brightness !== undefined && displayProfile.brightness !== 100 ? `brightness(${displayProfile.brightness}%)` : '',
          displayProfile.contrast !== undefined && displayProfile.contrast !== 100 ? `contrast(${displayProfile.contrast}%)` : '',
          displayProfile.saturation !== undefined && displayProfile.saturation !== 100 ? `saturate(${displayProfile.saturation}%)` : '',
          displayProfile.colorTemp === 'warm' ? 'sepia(15%)' : displayProfile.colorTemp === 'cool' ? 'hue-rotate(10deg)' : '',
        ].filter(Boolean).join(' ') || undefined,
        transform: [
          displayProfile.rotation ? `rotate(${displayProfile.rotation}deg)` : '',
          displayProfile.flipH ? 'scaleX(-1)' : '',
          displayProfile.flipV ? 'scaleY(-1)' : '',
          displayProfile.contentScale && displayProfile.contentScale !== 100 ? `scale(${displayProfile.contentScale / 100})` : '',
          displayProfile.offsetX || displayProfile.offsetY ? `translate(${displayProfile.offsetX || 0}px, ${displayProfile.offsetY || 0}px)` : '',
        ].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
      } : {}),
    }}>
      <style>{`
        @keyframes slideInLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes slideInRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes dissolveIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        @keyframes dissolveOut { from { opacity: 1; filter: blur(0); } to { opacity: 0; filter: blur(10px); } }
        @keyframes wipeIn { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        @keyframes overlayIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Previous layout (transitioning out) */}
      {transitioning && prevLayout && prevModules.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateRows: `repeat(${prevLayout.grid_rows || 3}, 1fr)`,
          gridTemplateColumns: `repeat(${prevLayout.grid_cols || prevLayout.grid_columns || 4}, 1fr)`,
          width: '100vw', height: '100vh',
          background: prevLayout.background || '#000',
          gap: '2px',
          position: 'absolute', top: 0, left: 0, zIndex: 2,
          animation: transitionType === 'slide-left' ? 'slideOutLeft 0.6s ease-in-out forwards'
            : transitionType === 'slide-right' ? 'slideOutRight 0.6s ease-in-out forwards'
            : transitionType === 'zoom-in' ? undefined
            : transitionType === 'dissolve' ? 'dissolveOut 0.6s ease-in-out forwards'
            : undefined,
          opacity: transitionType === 'crossfade' || transitionType === 'zoom-in' ? 0 : undefined,
          transition: transitionType === 'crossfade' ? 'opacity 0.6s ease-in-out' : undefined,
        }}>
          {prevModules.map((mod, i) => (
            <div key={mod.id || `prev-${i}`} style={{
              gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
              gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
              overflow: 'hidden'
            }}>
              <ErrorBoundary silent name={mod.type || 'module'}>
              <ModuleRenderer socket={socketRef.current} type={mod.type || mod.module || mod.module_type} config={mod.config || {}} />
            </ErrorBoundary>

            </div>
          ))}
        </div>
      )}

      {/* Composition Layers */}
      <div
        ref={gridRef}
        style={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          opacity: projectionActive ? 0 : undefined,
          pointerEvents: projectionActive ? 'none' : 'auto',
          animation: transitioning ? (
            transitionType === 'slide-left' ? 'slideInLeft 0.6s ease-in-out'
            : transitionType === 'slide-right' ? 'slideInRight 0.6s ease-in-out'
            : transitionType === 'zoom-in' ? 'zoomIn 0.6s ease-in-out'
            : transitionType === 'dissolve' ? 'dissolveIn 0.6s ease-in-out'
            : undefined
          ) : undefined,
          transition: transitioning && transitionType === 'crossfade' ? 'opacity 0.6s ease-in-out' : undefined,
        }}
      >
        {renderedLayers.map((layer) => {
          if (!layer.visible) return null;
          const fullscreenMods = (layer.modules || []).filter(m => m.fullscreen);
          const gridMods = (layer.modules || []).filter(m => !m.fullscreen);
          const chromaStyles = getChromaStyles(layer);
          return (
            <React.Fragment key={layer.id}>
              <ChromaFilter layer={layer} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: layer.opacity ?? 1,
                mixBlendMode: chromaStyles.mixBlendMode || layer.blendMode || 'normal',
                filter: chromaStyles.filter || undefined,
                zIndex: layer.order,
                pointerEvents: 'none',
              }}
            >
              {/* Fullscreen modules in this layer */}
              {fullscreenMods.map((mod, i) => (
                <div
                  key={mod.id || `fs-${i}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    zIndex: mod.layer || 0,
                  }}
                >
                  <ErrorBoundary silent name={mod.type || 'module'}>
                  <ModuleRenderer socket={socketRef.current} type={mod.type || mod.module || mod.module_type} config={mod.config || {}} moduleId={mod.id} />
                  </ErrorBoundary>

                </div>
              ))}
              {/* Grid modules in this layer */}
              {gridMods.length > 0 && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: '2px',
                }}>
                  {gridMods.map((mod, i) => (
                    <div
                      key={mod.id || `mod-${i}`}
                      style={{
                        gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
                        gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
                        overflow: 'hidden',
                      }}
                    >
                    <ErrorBoundary silent name={mod.type || 'module'}>
                      <ModuleRenderer socket={socketRef.current} type={mod.type || mod.module || mod.module_type} config={mod.config || {}} moduleId={mod.id} />
                    </ErrorBoundary>

                    </div>
                  ))}
                </div>
              )}
            </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* WebGL Projection Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: projectionActive ? 10 : -1,
          opacity: projectionActive ? 1 : 0,
          pointerEvents: setupMode ? 'auto' : 'none',
        }}
      />

      {/* Overlay Layer */}
      {overlays.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }}>
          {overlays.map(ov => (
            <OverlayRenderer key={ov.type} overlay={ov} />
          ))}
        </div>
      )}

      {/* Identify Flash */}
      {identifyFlash && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'white', animation: 'identifyPulse 2s ease-out forwards', pointerEvents: 'none' }}>
          <style>{`@keyframes identifyPulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 0; } }`}</style>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
            <p style={{ fontSize: '4rem', fontWeight: 900, color: '#000' }}>SCREEN {id?.slice(0,8)}</p>
          </div>
        </div>
      )}

      {/* No layout message */}
      {!layout && !error && connected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black" style={{ zIndex: 20 }}>
          <div className="text-center">
            <p className="text-gray-500 text-lg">Waiting for layout...</p>
            <p className="text-gray-700 text-sm mt-2">Screen ID: {id}</p>
          </div>
        </div>
      )}

      {/* Disconnection handling — behavior-dependent */}
      {!connected && disconnectBehavior === 'black' && (
        <div className="fixed inset-0 bg-black z-50">
          {/* Subtle reconnect indicator — tiny dot in corner */}
          <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse opacity-30" />
        </div>
      )}
      {!connected && disconnectBehavior === 'freeze' && (
        /* freeze = keep last frame visible, just show subtle indicator */
        <div className="fixed bottom-2 right-2 z-50 w-2 h-2 rounded-full bg-amber-500 animate-pulse opacity-40" />
      )}
      {!connected && disconnectBehavior === 'message' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <p className="text-red-500 text-3xl font-bold mb-2">DISCONNECTED</p>
            <p className="text-gray-400 mb-1">Attempting to reconnect...</p>
            {reconnectCount > 0 && (
              <p className="text-gray-600 text-sm">Retry attempt {reconnectCount}</p>
            )}
            <div className="mt-4 flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
