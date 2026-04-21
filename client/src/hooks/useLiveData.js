import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';

const LIVE_STUDIO_PREF_KEY = 'broadcast_live_studio_id';

function initialStudioId() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('broadcast_user') || '{}'); } catch { return {}; } })();
  if (user.role === 'super_admin') return localStorage.getItem(LIVE_STUDIO_PREF_KEY) || null;
  return user.studio_id || null;
}

export default function useLiveData() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [studios, setStudios] = useState([]);
  const [studioId, setStudioIdState] = useState(initialStudioId);
  const [loading, setLoading] = useState(true);

  const user = (() => { try { return JSON.parse(localStorage.getItem('broadcast_user') || '{}'); } catch { return {}; } })();
  const isSuperAdmin = user.role === 'super_admin';
  const mountedRef = useRef(true);

  function setStudioId(id) {
    setStudioIdState(id);
    if (isSuperAdmin && id) localStorage.setItem(LIVE_STUDIO_PREF_KEY, id);
  }

  // Super-admin: fetch studios for picker, auto-select first if none persisted
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/studios')
      .then((list) => {
        const arr = list || [];
        if (!mountedRef.current) return;
        setStudios(arr);
        setStudioIdState((curr) => {
          if (curr) return curr;
          if (arr.length === 0) return null;
          localStorage.setItem(LIVE_STUDIO_PREF_KEY, arr[0].id);
          return arr[0].id;
        });
      })
      .catch((err) => console.error('Failed to fetch studios:', err));
  }, [isSuperAdmin]);

  const fetchData = useCallback(async () => {
    if (!studioId) { setLoading(false); return; }
    try {
      const [screensData, layoutsData] = await Promise.all([
        api.get('/screens'),
        api.get(`/layouts?studio_id=${encodeURIComponent(studioId)}`),
      ]);
      if (!mountedRef.current) return;
      const allScreens = Array.isArray(screensData) ? screensData : Array.isArray(screensData?.screens) ? screensData.screens : [];
      // /screens returns all studios for super_admin — filter client-side to the selected studio
      setScreens(allScreens.filter((s) => s.studio_id === studioId));
      setLayouts(Array.isArray(layoutsData) ? layoutsData : Array.isArray(layoutsData?.layouts) ? layoutsData.layouts : []);
    } catch (err) {
      console.error('Failed to fetch live data:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [studioId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!studioId) { setLoading(false); return () => { mountedRef.current = false; }; }
    setLoading(true);
    fetchData();
    const socket = connectSocket();
    socket.emit('join_studio', { studioId });

    socket.on('screen_status', (data) => {
      setScreens(prev => prev.map(s =>
        s.id === data.screenId ? { ...s, is_online: data.online !== undefined ? data.online : data.is_online, last_seen: data.last_seen || data.timestamp } : s
      ));
    });

    socket.on('screen_preview', (data) => {
      setScreens(prev => prev.map(s =>
        s.id === data.screenId ? { ...s, current_layout: data.layout, current_layout_id: data.layoutId || s.current_layout_id, _previewUpdated: Date.now() } : s
      ));
    });

    const refreshInterval = setInterval(fetchData, 15000);
    return () => {
      mountedRef.current = false;
      socket.off('screen_status');
      socket.off('screen_preview');
      socket.emit('leave_studio', { studioId });
      clearInterval(refreshInterval);
    };
  }, [fetchData, studioId]);

  // Derive the most common layout as "live"
  const liveLayoutId = (() => {
    const counts = {};
    screens.forEach(s => { if (s.current_layout_id) counts[s.current_layout_id] = (counts[s.current_layout_id] || 0) + 1; });
    let max = 0, id = null;
    Object.entries(counts).forEach(([k, v]) => { if (v > max) { max = v; id = k; } });
    return id;
  })();

  const onlineCount = screens.filter(s => s.is_online).length;

  return {
    screens,
    layouts,
    loading,
    studioId,
    studios,
    setStudioId,
    isSuperAdmin,
    liveLayoutId,
    onlineCount,
    fetchData,
  };
}
