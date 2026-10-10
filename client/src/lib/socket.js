import { io } from 'socket.io-client';

let socket = null;

const currentToken = () => { try { return localStorage.getItem('broadcast_token'); } catch { return null; } };

export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ['websocket', 'polling'], // polling fallback for restrictive proxies
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // was 30s — faster recovery
      randomizationFactor: 0.2,
      timeout: 20000,
      // A function, not a value: read the token on EVERY (re)connect. The socket
      // is a singleton created on first use — often before login — and used to
      // keep that empty auth for the life of the tab, so control events from it
      // were refused as unauthenticated (review 2026-10-10).
      auth: (cb) => { const token = currentToken(); cb(token ? { token } : {}); },
    });
    // Signed in after the socket connected: authenticate it in place.
    socket.on('control_denied', ({ reason } = {}) => {
      const token = currentToken();
      if (token && /not signed in/.test(reason || '')) socket.emit('authenticate', { token });
      else if (reason) console.warn('[socket] control denied:', reason);
    });
  }
  return socket;
}

/** Call after login/logout so an open socket picks up the new identity. */
export function reauthenticateSocket() {
  if (!socket) return;
  const token = currentToken();
  if (token && socket.connected) socket.emit('authenticate', { token });
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
}
