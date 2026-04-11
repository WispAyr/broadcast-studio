import React, { useState, useEffect, useRef } from 'react';
import moduleRegistry from '../modules/index';
import { getSocket, connectSocket } from '../lib/socket';

export default function ModuleRenderer({ type, config = {}, moduleId }) {
  const [liveConfig, setLiveConfig] = useState(config);
  const [renderKey, setRenderKey] = useState(0);
  const Component = moduleRegistry[type];

  // Sync with incoming config prop changes
  useEffect(() => {
    setLiveConfig(prev => ({ ...prev, ...config }));
  }, [JSON.stringify(config)]);

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
