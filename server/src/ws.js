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
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Screen registration
    socket.on('register_screen', ({ screenId, studioId }) => {
      // Look up the screen's actual studio from DB
      const screen = db.prepare('SELECT studio_id FROM screens WHERE id = ?').get(screenId);
      const resolvedStudio = (screen && screen.studio_id) || studioId || 'default';

      socket.join(`screen:${screenId}`);
      socket.join(`studio:${resolvedStudio}`);

      // Store screen/studio info on socket for disconnect handling
      socket.screenId = screenId;
      socket.studioId = resolvedStudio;

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

    // Live text update — push new text to a specific module on screen(s)
    socket.on('update_module_text', ({ screenId, studioId, moduleId, text, subtitle }) => {
      const payload = { moduleId, text, subtitle };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('update_module_text', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_text', payload);
      }
    });

    // Join a studio room (for dashboard/control clients)
    socket.on('join_studio', ({ studioId }) => {
      if (studioId) {
        socket.join(`studio:${studioId}`);
        socket.studioId = studioId;
        console.log(`Socket ${socket.id} joined studio ${studioId}`);
      }
    });

    // Layout transition — relay transition metadata to screens
    socket.on('push_layout_transition', ({ studioId, layoutId, transition, duration, screenId }) => {
      const payload = { layoutId, transition: transition || 'crossfade', duration: duration || 1 };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('push_layout_transition', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('push_layout_transition', payload);
      } else {
        // Broadcast to all screens if no studio/screen specified (e.g. from God View)
        socket.broadcast.emit('push_layout_transition', payload);
      }
    });

    // Overlay system
    socket.on('push_overlay', ({ studioId, overlay, screenId }) => {
      const payload = { overlay };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('push_overlay', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('push_overlay', payload);
      }
    });

    socket.on('remove_overlay', ({ studioId, overlayType, screenId }) => {
      const payload = { overlayType };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('remove_overlay', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('remove_overlay', payload);
      }
    });

    socket.on('clear_overlays', ({ studioId, screenId }) => {
      if (screenId) {
        io.to(`screen:${screenId}`).emit('clear_overlays', {});
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('clear_overlays', {});
      }
    });

    // Identify screen — flash it so operator can find it
    socket.on('identify_screen', ({ screenId }) => {
      if (screenId) {
        io.to(`screen:${screenId}`).emit('identify_screen', {});
      }
    });

    // Reload screen — force browser refresh
    socket.on('reload_screen', ({ screenId }) => {
      if (screenId) {
        io.to(`screen:${screenId}`).emit('reload_screen', {});
      }
    });

    // Visualizer audio data relay — broadcast to ALL connected sockets (screens + dashboards)
    socket.on('visualizer_audio_data', (data) => {
      const studioId = data.studioId || socket.studioId;
      if (studioId) {
        socket.to(`studio:${studioId}`).emit('visualizer_audio_data', {
          frequencyData: data.frequencyData,
          waveformData: data.waveformData,
          timestamp: data.timestamp,
        });
      } else {
        // Fallback: broadcast to all sockets except sender
        socket.broadcast.emit('visualizer_audio_data', {
          frequencyData: data.frequencyData,
          waveformData: data.waveformData,
          timestamp: data.timestamp,
        });
      }
    });

    // Autocue control — relay commands to target screen/studio
    socket.on('autocue_control', ({ screenId, studioId, command, value }) => {
      const payload = { command, value };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('autocue_control', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('autocue_control', payload);
      }
    });

    // Autocue position — relay position from screen back to studio controllers
    socket.on('autocue_position', (data) => {
      const studioId = data.studioId || socket.studioId;
      if (studioId) {
        socket.to(`studio:${studioId}`).emit('autocue_position', data);
      }
    });

    // Screen state snapshot — when a screen receives a layout, broadcast preview to studio
    socket.on('screen_state_update', ({ screenId, layoutId, layout }) => {
      const studioId = socket.studioId;
      if (studioId) {
        io.to(`studio:${studioId}`).emit('screen_preview', {
          screenId,
          layoutId,
          layout,
          timestamp: new Date().toISOString()
        });
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
