import React, { useState, useEffect, useMemo, useRef } from 'react';
import moduleRegistry from '../modules/index';
import { getSocket, connectSocket } from '../lib/socket';

// Shallow stringify for dep comparison. Avoids calling JSON.stringify on every
// render (it throws on functions / circular refs and allocates per render);
// we only need a stable primitive that changes when top-level config changes.
function shallowHash(obj) {
  if (!obj || typeof obj !== 'object') return String(obj);
  try {
    const keys = Object.keys(obj).sort();
    return keys.map(k => {
      const v = obj[k];
      if (v === null || typeof v !== 'object') return `${k}:${v}`;
      return `${k}:[obj]`;
    }).join('|');
  } catch {
    return '';
  }
}

export default function ModuleRenderer({ type, config = {}, moduleId }) {
  const [liveConfig, setLiveConfig] = useState(config);
  const [renderKey, setRenderKey] = useState(0);
  const Component = moduleRegistry[type];

  const configHash = useMemo(() => shallowHash(config), [config]);

  // Sync with incoming config prop changes
  useEffect(() => {
    setLiveConfig(prev => ({ ...prev, ...config }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configHash]);

  // Listen for real-time config updates via WebSocket
  useEffect(() => {
    let socket = getSocket();
    if (!socket) socket = connectSocket();
    if (!socket) return;
    if (!socket.connected) socket.connect();

    function onConfigUpdate(payload) {
      const { moduleId: mid, config: newConfig } = payload;
      if (mid === moduleId || mid === type || mid === '*') {
        setLiveConfig(prev => ({ ...prev, ...newConfig }));
        // Force re-render by bumping key
        setRenderKey(k => k + 1);
      }
    }

    socket.on('update_module_config', onConfigUpdate);
    return () => socket.off('update_module_config', onConfigUpdate);
  }, [moduleId, type]);

  if (!Component) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-gray-600 text-xs">Unknown: {type}</span>
      </div>
    );
  }

  return <Component key={renderKey} config={liveConfig} moduleId={moduleId} />;
}
