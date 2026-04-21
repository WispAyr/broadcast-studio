const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { bumpCounter, setCounter, getVariablesByStudio } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

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
    pingTimeout: 30000,
    pingInterval: 10000,
    transports: ['websocket', 'polling'],
  });

  // Auth middleware — verify JWT if provided. Screen display pages
  // can connect without a token (they identify via register_screen),
  // but control actions will check socket.user before executing.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        socket.user = jwt.verify(token, JWT_SECRET);
      } catch {
        // Invalid token — still allow connection but mark as unauthenticated
        socket.user = null;
      }
    } else {
      socket.user = null;
    }
    next();
  });

  // Helper: require authenticated user for control actions
  function requireAuth(socket, action) {
    if (!socket.user) {
      console.warn(`Unauthorized ${action} attempt from ${socket.id}`);
      return false;
    }
    return true;
  }

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (auth: ${socket.user ? socket.user.username : 'none'})`);

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

      try {
        const vars = getVariablesByStudio(resolvedStudio) || [];
        const snap = {};
        for (const v of vars) snap[v.id] = v.value;
        socket.emit('variable_snapshot', { variables: snap, timestamp: Date.now() });
      } catch (e) {
        console.warn('variable_snapshot emit failed:', e.message);
      }
    });

    // Screen heartbeat
    socket.on('screen_heartbeat', ({ screenId }) => {
      db.prepare("UPDATE screens SET last_seen = datetime('now') WHERE id = ?").run(screenId);
    });

    // Control actions from producers (auth required)
    socket.on('control_action', ({ action, screenId, studioId, layoutId, data }) => {
      if (!requireAuth(socket, 'control_action')) return;
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

    // Live text update — push new text to a specific module on screen(s) (auth required)
    socket.on('update_module_text', ({ screenId, studioId, moduleId, text, subtitle }) => {
      if (!requireAuth(socket, 'update_module_text')) return;
      const payload = { moduleId, text, subtitle };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('update_module_text', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_text', payload);
      }
    });

    // Live module config update — push config changes to screens in real-time
    socket.on('update_module_config', ({ studioId, moduleId, config }) => {
      const payload = { moduleId, config, timestamp: Date.now() };
      if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_config', payload);
      } else {
        io.emit('update_module_config', payload);
      }
      console.log(`Module config update: ${moduleId}`, JSON.stringify(config).slice(0, 80));
    });

    // Counter bump — convenience event for incrementing a counter
    socket.on('counter_bump', ({ studioId, moduleId, delta }) => {
      const key = moduleId || 'default';
      const count = bumpCounter(key, delta || 1);
      const payload = { moduleId, config: { count }, timestamp: Date.now() };
      if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_config', payload);
      } else {
        io.emit('update_module_config', payload);
      }
      console.log(`Counter bump: ${key} -> ${count}`);
    });

    // Counter set — set absolute value
    socket.on('counter_set', ({ studioId, moduleId, value }) => {
      const key = moduleId || 'default';
      const count = setCounter(key, value || 0);
      const payload = { moduleId, config: { count }, timestamp: Date.now() };
      if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_config', payload);
      } else {
        io.emit('update_module_config', payload);
      }
      console.log(`Counter set: ${key} = ${count}`);
    });



    // Join a studio room (for dashboard/control clients)
    socket.on('join_studio', ({ studioId }) => {
      if (studioId) {
        socket.join(`studio:${studioId}`);
        socket.studioId = studioId;
        console.log(`Socket ${socket.id} joined studio ${studioId}`);
      }
    });

    // Join a kiosk room — Electron displays subscribe here so they get
    // `display_update` events the instant ops rearranges a slot, instead
    // of waiting for the 15s poll to catch up. Unauthenticated on purpose:
    // the host name is not a secret and the event carries only a revision
    // counter (no URLs leak).
    socket.on('join_kiosk', ({ host }) => {
      if (host) {
        socket.join(`kiosk:${host}`);
        socket.kioskHost = host;
        console.log(`Socket ${socket.id} joined kiosk ${host}`);
      }
    });

    // Layout transition — relay transition metadata to screens (auth required)
    socket.on('push_layout_transition', ({ studioId, layoutId, transition, duration, screenId }) => {
      if (!requireAuth(socket, 'push_layout_transition')) return;
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

    // Overlay system (auth required)
    socket.on('push_overlay', ({ studioId, overlay, screenId }) => {
      if (!requireAuth(socket, 'push_overlay')) return;
      const payload = { overlay };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('push_overlay', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('push_overlay', payload);
      }
    });

    socket.on('remove_overlay', ({ studioId, overlayType, screenId }) => {
      if (!requireAuth(socket, 'remove_overlay')) return;
      const payload = { overlayType };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('remove_overlay', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('remove_overlay', payload);
      }
    });

    socket.on('clear_overlays', ({ studioId, screenId }) => {
      if (!requireAuth(socket, 'clear_overlays')) return;
      if (screenId) {
        io.to(`screen:${screenId}`).emit('clear_overlays', {});
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('clear_overlays', {});
      }
    });

    // Identify screen — flash it so operator can find it (auth required)
    socket.on('identify_screen', ({ screenId }) => {
      if (!requireAuth(socket, 'identify_screen')) return;
      if (screenId) {
        io.to(`screen:${screenId}`).emit('identify_screen', {});
      }
    });

    // Reload screen — force browser refresh (auth required)
    socket.on('reload_screen', ({ screenId }) => {
      if (!requireAuth(socket, 'reload_screen')) return;
      if (screenId) {
        io.to(`screen:${screenId}`).emit('reload_screen', {});
      }
    });

    // Visualizer audio data relay (auth required)
    socket.on('visualizer_audio_data', (data) => {
      if (!requireAuth(socket, 'visualizer_audio_data')) return;
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

    // Autocue control (auth required)
    socket.on('autocue_control', ({ screenId, studioId, command, value }) => {
      if (!requireAuth(socket, 'autocue_control')) return;
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
        // Only flip offline if no other socket is still holding this screen.
        // Reconnect races + multi-tab previews used to mark screens offline
        // while the kiosk was still up.
        const room = io.sockets.adapter.rooms.get(`screen:${socket.screenId}`);
        const remaining = room ? room.size : 0;
        if (remaining === 0) {
          db.prepare('UPDATE screens SET is_online = 0 WHERE id = ?').run(socket.screenId);
          if (socket.studioId) {
            io.to(`studio:${socket.studioId}`).emit('screen_status', {
              screenId: socket.screenId,
              is_online: false,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { getIO, setupWebSocket };
