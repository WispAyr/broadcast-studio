const { Server } = require('socket.io');
const { db } = require('./db');

let io = null;

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

function setupWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Screen registration
    socket.on('register_screen', ({ screenId, studioId }) => {
      socket.join(`screen:${screenId}`);
      socket.join(`studio:${studioId}`);

      // Store screen/studio info on socket for disconnect handling
      socket.screenId = screenId;
      socket.studioId = studioId;

      // Mark screen online
      db.prepare("UPDATE screens SET is_online = 1, last_seen = datetime('now') WHERE id = ?").run(screenId);

      // Notify studio room
      io.to(`studio:${studioId}`).emit('screen_status', {
        screenId,
        is_online: true,
        timestamp: new Date().toISOString()
      });

      console.log(`Screen ${screenId} registered to studio ${studioId}`);
    });

    // Screen heartbeat
    socket.on('screen_heartbeat', ({ screenId }) => {
      db.prepare("UPDATE screens SET last_seen = datetime('now') WHERE id = ?").run(screenId);
    });

    // Control actions from producers
    socket.on('control_action', ({ action, screenId, studioId, layoutId, data }) => {
      switch (action) {
        case 'set_layout':
          io.to(`screen:${screenId}`).emit('set_layout', { layoutId, data });
          break;
        case 'sync_all':
          io.to(`studio:${studioId}`).emit('sync_all', { layoutId, data });
          break;
        case 'emergency_layout':
          io.to(`studio:${studioId}`).emit('emergency_layout', { layoutId, data });
          break;
        default:
          console.log(`Unknown control action: ${action}`);
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      if (socket.screenId) {
        db.prepare('UPDATE screens SET is_online = 0 WHERE id = ?').run(socket.screenId);

        if (socket.studioId) {
          io.to(`studio:${socket.studioId}`).emit('screen_status', {
            screenId: socket.screenId,
            is_online: false,
            timestamp: new Date().toISOString()
          });
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { getIO, setupWebSocket };
