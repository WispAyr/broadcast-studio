import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';

export default function useLiveData() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const studioId = JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || 'default';
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [screensData, layoutsData] = await Promise.all([api.get('/screens'), api.get('/layouts')]);
      if (!mountedRef.current) return;
      setScreens(Array.isArray(screensData) ? screensData : Array.isArray(screensData?.screens) ? screensData.screens : []);
      setLayouts(Array.isArray(layoutsData) ? layoutsData : Array.isArray(layoutsData?.layouts) ? layoutsData.layouts : []);
    } catch (err) {
      console.error('Failed to fetch live data:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
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
    liveLayoutId,
    onlineCount,
    fetchData,
  };
}
