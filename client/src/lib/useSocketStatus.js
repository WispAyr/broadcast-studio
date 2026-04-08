import { useState, useEffect } from 'react';
import { getSocket, connectSocket } from './socket';

/**
 * Hook that tracks the WebSocket connection status.
 * Returns { connected, reconnecting, lastEvent }.
 */
export function useSocketStatus() {
  const [status, setStatus] = useState({
    connected: false,
    reconnecting: false,
    lastEvent: null,
  });

  useEffect(() => {
    const socket = connectSocket();

    function onConnect() {
      setStatus({ connected: true, reconnecting: false, lastEvent: 'connected' });
    }
    function onDisconnect(reason) {
      setStatus({ connected: false, reconnecting: reason !== 'io client disconnect', lastEvent: 'disconnected' });
    }
    function onReconnecting(attempt) {
      setStatus(prev => ({ ...prev, reconnecting: true, lastEvent: `reconnecting (${attempt})` }));
    }
    function onReconnectFailed() {
      setStatus({ connected: false, reconnecting: false, lastEvent: 'reconnect_failed' });
    }
    function onReconnect() {
      setStatus({ connected: true, reconnecting: false, lastEvent: 'reconnected' });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnecting);
    socket.io.on('reconnect_failed', onReconnectFailed);
    socket.io.on('reconnect', onReconnect);

    // Set initial state
    if (socket.connected) {
      setStatus({ connected: true, reconnecting: false, lastEvent: 'connected' });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnecting);
      socket.io.off('reconnect_failed', onReconnectFailed);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  return status;
}
