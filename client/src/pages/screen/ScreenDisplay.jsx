import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import ModuleRenderer from '../../components/ModuleRenderer';
import { ProjectionMapper } from '../../lib/webgl-projection';

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
  const [reconnectCount, setReconnectCount] = useState(0);

  const heartbeatRef = useRef(null);
  const socketRef = useRef(null);
  const gridRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const projectionRef = useRef(null);

  // Smooth layout transition
  const applyLayout = useCallback((newLayout) => {
    if (!newLayout) return;
    setTransitioning(true);
    setTimeout(() => {
      setLayout(newLayout);
      const mods = typeof newLayout.modules === 'string'
        ? JSON.parse(newLayout.modules)
        : (newLayout.modules || []);
      setModules(mods);
      setTimeout(() => setTransitioning(false), 50);
    }, 300);
  }, []);

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

  // Socket connection with auto-reconnect
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnectCount(0);
      socket.emit('register_screen', { screenId: id, studioId: 'default' });
      // Re-fetch layout on reconnect
      fetchScreenData();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setReconnectCount((prev) => prev + 1);
    });

    socket.on('set_layout', (data) => {
      if (data.layout) applyLayout(data.layout);
    });

    socket.on('update_module', (data) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === data.moduleId ? { ...m, config: { ...m.config, ...data.config } } : m
        )
      );
    });

    socket.on('sync_all', (data) => {
      if (data.layout) applyLayout(data.layout);
    });

    socket.on('emergency_layout', (data) => {
      if (data.layout) applyLayout(data.layout);
    });

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('screen_heartbeat', { screenId: id });
      }
    }, 30000);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('set_layout');
      socket.off('update_module');
      socket.off('sync_all');
      socket.off('emergency_layout');
      clearInterval(heartbeatRef.current);
      disconnectSocket();
    };
  }, [id, applyLayout, fetchScreenData]);

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

  return (
    <div className="screen-display" style={{ background, position: 'relative' }}>
      {/* Layout Grid */}
      <div
        ref={gridRef}
        className={`transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          width: '100vw',
          height: '100vh',
          background,
          gap: '2px',
          opacity: projectionActive ? 0 : undefined,
          pointerEvents: projectionActive ? 'none' : 'auto',
          position: projectionActive ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      >
        {modules.map((mod, i) => (
          <div
            key={mod.id || `mod-${i}`}
            style={{
              gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
              gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
              overflow: 'hidden'
            }}
          >
            <ModuleRenderer type={mod.type || mod.module || mod.module_type} config={mod.config || {}} />
          </div>
        ))}
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

      {/* No layout message */}
      {!layout && !error && connected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black" style={{ zIndex: 20 }}>
          <div className="text-center">
            <p className="text-gray-500 text-lg">Waiting for layout...</p>
            <p className="text-gray-700 text-sm mt-2">Screen ID: {id}</p>
          </div>
        </div>
      )}

      {/* Disconnection overlay with reconnect info */}
      {!connected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <p className="text-red-500 text-3xl font-bold mb-2">DISCONNECTED</p>
            <p className="text-gray-400 mb-1">Attempting to reconnect...</p>
            {reconnectCount > 0 && (
              <p className="text-gray-600 text-sm">
                Retry attempt {reconnectCount}
              </p>
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
