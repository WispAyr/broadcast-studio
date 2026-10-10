const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { bumpCounter, setCounter, getVariablesByStudio } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const access = require('./lib/access');

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
      console.warn(`Unauthorized ${action} attempt from ${socket.id} addr=${socket.handshake && socket.handshake.address}`);
      // Tell the sender. A control page whose socket was opened before login (or
      // with an expired token) used to fail silently — 670 push_layout_transition
      // attempts in 11 h from one God View tab on 9–10 Oct.
      socket.emit('control_denied', { action, reason: 'not signed in on this socket — reload the page or sign in again' });
      return false;
    }
    return true;
  }

  // Studio check for control events (review 2026-10-10, lib/access.js): the
  // caller must reach every studio the event targets. A screenId resolves to
  // its own studio. Viewers cannot send control events.
  const screenStudio = (id) => { const r = id && db.prepare('SELECT studio_id FROM screens WHERE id = ?').get(id); return r ? r.studio_id : null; };
  function allowStudios(socket, action, studioIds) {
    const d = access.decide({ user: socket.user, reachable: access.reachableFor(socket.user), studioIds: studioIds.filter(Boolean), write: true });
    if (d.ok) return true;
    if (access.LEGACY_OPEN()) { console.warn(`[access] would deny socket ${action} by ${socket.user?.username || 'anon'}: ${d.reason}`); return true; }
    console.warn(`[access] denied socket ${action} by ${socket.user?.username || 'anon'}: ${d.reason}`);
    socket.emit('control_denied', { action, reason: d.reason });
    return false;
  }
  // requireAuth + studio check for an event that targets { screenId } or { studioId }
  function control(socket, action, { screenId, studioId } = {}) {
    if (!requireAuth(socket, action)) return false;
    return allowStudios(socket, action, [screenId ? screenStudio(screenId) : null, studioId || null]);
  }

  io.on('connection', (socket) => {
    // A page that signs in after its socket opened sends its token here instead
    // of reconnecting (client lib/socket.js does this on login and on connect).
    socket.on('authenticate', ({ token } = {}) => {
      try { socket.user = jwt.verify(token, JWT_SECRET); socket.emit('authenticated', { ok: true, username: socket.user.username }); }
      catch { socket.emit('authenticated', { ok: false }); }
    });
    console.log(`Socket connected: ${socket.id} (auth: ${socket.user ? socket.user.username : 'none'})`);

    // Screen registration
    socket.on('register_screen', ({ screenId, studioId, caps }) => {
      // Look up the screen's actual studio from DB
      const screen = screenId && db.prepare('SELECT studio_id FROM screens WHERE id = ?').get(screenId);
      // Only a screen that exists joins a studio room, and only its OWN studio.
      // Before 2026-10-10 an unknown screenId plus any studioId joined that
      // studio's room, so an anonymous socket could watch a studio's previews
      // (layouts, with any links in them) by naming it.
      if (!screen) {
        console.warn(`register_screen for unknown screen ${String(screenId).slice(0, 64)} from ${socket.id} — ignored`);
        socket.emit('control_denied', { action: 'register_screen', reason: 'unknown screen' });
        return;
      }
      const resolvedStudio = screen.studio_id || 'default';

      socket.join(`screen:${screenId}`);
      socket.join(`studio:${resolvedStudio}`);

      // Store screen/studio info on socket for disconnect handling
      socket.screenId = screenId;
      socket.studioId = resolvedStudio;

      // Mark screen online
      db.prepare("UPDATE screens SET is_online = 1, last_seen = datetime('now') WHERE id = ?").run(screenId);

      // Playout capabilities. The screen tells US what it can do — we never assume.
      // A Studio Display will decode two 1080p streams and crossfade them; a phone
      // will not, and guessing wrong there means a black frame on air. Absence of a
      // capability means "can't", never "probably".
      if (caps && typeof caps === 'object') {
        try {
          const row = db.prepare('SELECT config FROM screens WHERE id = ?').get(screenId);
          const cfg = JSON.parse(row?.config || '{}');
          cfg.caps = caps;
          db.prepare('UPDATE screens SET config = ? WHERE id = ?').run(JSON.stringify(cfg), screenId);
        } catch (e) {
          console.warn('screen caps persist failed:', e.message);
        }
      }

      // Notify studio room
      io.to(`studio:${resolvedStudio}`).emit('screen_status', {
        screenId,
        is_online: true,
        timestamp: new Date().toISOString()
      });

      console.log(`Screen ${screenId} registered to studio ${resolvedStudio}`);

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
    socket.on('screen_heartbeat', ({ screenId } = {}) => {
      // a socket only speaks for the screen it registered as
      if (!socket.screenId || (screenId && screenId !== socket.screenId)) return;
      db.prepare("UPDATE screens SET last_seen = datetime('now') WHERE id = ?").run(socket.screenId);
    });

    // A VT (video module with returnLayoutId) finished playing on a screen —
    // put the screen back on the configured layout. Only the screen's own
    // registered socket carries screenId, so other sockets are ignored.
    socket.on('vt_ended', ({ returnLayoutId }) => {
      const screenId = socket.screenId;
      if (!screenId || !returnLayoutId) return;
      const layout = db.prepare('SELECT * FROM layouts WHERE id = ?').get(returnLayoutId);
      if (!layout) return;
      db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?")
        .run(returnLayoutId, screenId);
      try { layout.modules = typeof layout.modules === 'string' ? JSON.parse(layout.modules) : layout.modules; }
      catch { layout.modules = []; }
      io.to(`screen:${screenId}`).emit('set_layout', { layoutId: returnLayoutId, layout, source: 'vt_ended' });
      if (socket.studioId) {
        io.to(`studio:${socket.studioId}`).emit('screen_preview', {
          screenId, layoutId: returnLayoutId, layout, timestamp: new Date().toISOString(),
        });
      }
      console.log(`VT ended on screen ${screenId} — returned to layout "${layout.name}"`);
    });

    // ── playout deck callbacks ───────────────────────────────────────────
    // The screen's player module reporting on itself. screenId comes from the
    // socket, never from the payload, so a client can only speak for itself.
    const playout = require('./playout/engine');

    socket.on('playout_ready', ({ channel_id, item_id }) => {
      if (!socket.screenId || !channel_id || !item_id) return;
      playout.onReady(channel_id, item_id);
    });

    socket.on('playout_ended', ({ channel_id, item_id }) => {
      if (!socket.screenId || !channel_id || !item_id) return;
      // The file is the authority on its own length. Our clock is an estimate;
      // this is the fact.
      playout.onEnded(channel_id, item_id);
    });

    socket.on('playout_error', ({ channel_id, item_id, message }) => {
      if (!socket.screenId || !channel_id || !item_id) return;
      console.warn(`[playout] screen ${socket.screenId} failed item ${item_id}: ${message}`);
      playout.onError(channel_id, item_id, message || 'client error');
    });

    // Control actions from producers (auth required)
    socket.on('control_action', ({ action, screenId, studioId, layoutId, data }) => {
      if (!control(socket, 'control_action', { screenId: action === 'set_layout' ? screenId : null, studioId: action === 'set_layout' ? null : studioId })) return;
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
      if (!control(socket, 'update_module_text', { screenId, studioId })) return;
      const payload = { moduleId, text, subtitle };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('update_module_text', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_text', payload);
      }
    });

    // Live module config update — push config changes to screens in real-time
    // Was unauthenticated until 2026-10-10: any socket could rewrite module config
    // (now-playing, tickers, audio, counters) on every screen of every studio.
    // A missing studioId now means the caller's joined studio; an all-studios
    // emit is super_admin only.
    const scopeStudio = (socket, studioId) => studioId || (socket.user && socket.user.role === 'super_admin' ? null : socket.studioId || '__no_studio__');
    socket.on('update_module_config', ({ studioId: sid, moduleId, config } = {}) => {
      if (!control(socket, 'update_module_config', { studioId: scopeStudio(socket, sid) })) return;
      const studioId = scopeStudio(socket, sid);
      const payload = { moduleId, config, timestamp: Date.now() };
      if (studioId) {
        io.to(`studio:${studioId}`).emit('update_module_config', payload);
      } else {
        io.emit('update_module_config', payload);
      }
      console.log(`Module config update: ${moduleId}`, JSON.stringify(config).slice(0, 80));
    });

    // Counter bump — convenience event for incrementing a counter
    socket.on('counter_bump', ({ studioId: sid, moduleId, delta } = {}) => {
      if (!control(socket, 'counter_bump', { studioId: scopeStudio(socket, sid) })) return;
      const studioId = scopeStudio(socket, sid);
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
    socket.on('counter_set', ({ studioId: sid, moduleId, value } = {}) => {
      if (!control(socket, 'counter_set', { studioId: scopeStudio(socket, sid) })) return;
      const studioId = scopeStudio(socket, sid);
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
    // Signed-in only, and only a studio the user reaches (a studio room carries
    // layout previews, with any links in them). Screens join via register_screen.
    socket.on('join_studio', ({ studioId } = {}) => {
      if (studioId && !socket.user) { requireAuth(socket, 'join_studio'); return; }
      if (studioId && !access.decide({ user: socket.user, reachable: access.reachableFor(socket.user), studioIds: [studioId] }).ok) {
        if (!access.LEGACY_OPEN()) { console.warn(`[access] denied join_studio ${studioId} by ${socket.user.username}`); socket.emit('control_denied', { action: 'join_studio', reason: 'studio not in your access' }); return; }
        console.warn(`[access] would deny join_studio ${studioId} by ${socket.user.username} (BS_ACCESS_LEGACY_OPEN=1)`);
      }
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
      if (!control(socket, 'push_layout_transition', { screenId, studioId })) return;
      const payload = { layoutId, transition: transition || 'crossfade', duration: duration || 1 };
      // Public-only studios (ad-van LEDs) take public_safe layouts only — the REST
      // take path always checked this; the socket path did not.
      const layout = layoutId ? db.prepare('SELECT * FROM layouts WHERE id = ?').get(layoutId) : null;
      const publicOk = (sid) => {
        try { const { rejectIfPublicOnlyUnsafe } = require('./routes/screens'); return !layout || !rejectIfPublicOnlyUnsafe(sid, layout); }
        catch { return true; }
      };
      if (screenId) {
        if (!publicOk(screenStudio(screenId))) { socket.emit('control_denied', { action: 'push_layout_transition', reason: 'layout is not public-safe for this screen' }); return; }
        io.to(`screen:${screenId}`).emit('push_layout_transition', payload);
      } else if (studioId) {
        if (!publicOk(studioId)) { socket.emit('control_denied', { action: 'push_layout_transition', reason: 'layout is not public-safe for this studio' }); return; }
        io.to(`studio:${studioId}`).emit('push_layout_transition', payload);
      } else if (socket.user.role === 'super_admin') {
        // God View "all screens": every studio room that may take this layout
        // (was socket.broadcast.emit — every socket, public-only studios included).
        for (const { id } of db.prepare('SELECT id FROM studios').all()) if (publicOk(id)) io.to(`studio:${id}`).emit('push_layout_transition', payload);
      } else if (socket.studioId) {
        if (!allowStudios(socket, 'push_layout_transition', [socket.studioId]) || !publicOk(socket.studioId)) return;
        io.to(`studio:${socket.studioId}`).emit('push_layout_transition', payload);
      } else {
        socket.emit('control_denied', { action: 'push_layout_transition', reason: 'no studio or screen given' });
      }
    });

    // Overlay system (auth required)
    socket.on('push_overlay', ({ studioId, overlay, screenId }) => {
      if (!control(socket, 'push_overlay', { screenId, studioId })) return;
      const payload = { overlay };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('push_overlay', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('push_overlay', payload);
      }
    });

    socket.on('remove_overlay', ({ studioId, overlayType, screenId }) => {
      if (!control(socket, 'remove_overlay', { screenId, studioId })) return;
      const payload = { overlayType };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('remove_overlay', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('remove_overlay', payload);
      }
    });

    socket.on('clear_overlays', ({ studioId, screenId }) => {
      if (!control(socket, 'clear_overlays', { screenId, studioId })) return;
      if (screenId) {
        io.to(`screen:${screenId}`).emit('clear_overlays', {});
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('clear_overlays', {});
      }
    });

    // Identify screen — flash it so operator can find it (auth required)
    socket.on('identify_screen', ({ screenId }) => {
      if (!control(socket, 'identify_screen', { screenId })) return;
      if (screenId) {
        io.to(`screen:${screenId}`).emit('identify_screen', {});
      }
    });

    // Reload screen — force browser refresh (auth required)
    socket.on('reload_screen', ({ screenId }) => {
      if (!control(socket, 'reload_screen', { screenId })) return;
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
      if (!control(socket, 'autocue_control', { screenId, studioId })) return;
      const payload = { command, value };
      if (screenId) {
        io.to(`screen:${screenId}`).emit('autocue_control', payload);
      } else if (studioId) {
        io.to(`studio:${studioId}`).emit('autocue_control', payload);
      }
    });

    // Autocue position — relay position from screen back to studio controllers
    socket.on('autocue_position', (data = {}) => {
      // only into the studio this socket belongs to (a registered screen or a
      // signed-in page that joined it) — not any studio a payload names
      const studioId = socket.studioId;
      if (studioId) {
        socket.to(`studio:${studioId}`).emit('autocue_position', data);
      }
    });

    // Screen state snapshot — when a screen receives a layout, broadcast preview to studio
    socket.on('screen_state_update', ({ screenId: claimed, layoutId, layout } = {}) => {
      const studioId = socket.studioId;
      // a screen reports only for itself; a signed-in page may report any screen
      const screenId = socket.screenId || (socket.user ? claimed : null);
      if (!screenId) return;
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
    socket.on('disconnect', (reason) => {
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
      // Diagnostic (2026-09-18): the Pavilion kiosks reconnect every ~27.6s and the
      // bare id told us nothing. Log WHY, plus the transport and how long it lived.
      const livedMs = socket.handshake && socket.handshake.issued
        ? Date.now() - socket.handshake.issued
        : null;
      const transport = socket.conn && socket.conn.transport
        ? socket.conn.transport.name
        : '?';
      console.log(
        `Socket disconnected: ${socket.id} reason=${reason}` +
        ` transport=${transport}` +
        (livedMs === null ? '' : ` lived=${(livedMs / 1000).toFixed(1)}s`) +
        (socket.screenId ? ` screen=${socket.screenId}` : '') +
        ` addr=${socket.handshake && socket.handshake.address}`
      );
    });
  });

  // Stale-online sweep (review 2026-10-10). is_online was only ever cleared on a
  // socket disconnect, so a screen that vanished while this server was down (or
  // whose disconnect was lost) stayed "online" for weeks — the Ops Office iMacs
  // showed online with no heartbeat for 9–25 days. Screens heartbeat every 10 s;
  // after 90 s of silence with no socket holding the screen, it is offline.
  const sweep = setInterval(() => {
    try {
      const stale = db.prepare(`SELECT id, studio_id FROM screens WHERE is_online = 1
        AND (last_seen IS NULL OR last_seen < datetime('now', '-90 seconds'))`).all();
      for (const sc of stale) {
        const room = io.sockets.adapter.rooms.get(`screen:${sc.id}`);
        if (room && room.size > 0) continue;
        db.prepare('UPDATE screens SET is_online = 0 WHERE id = ?').run(sc.id);
        if (sc.studio_id) io.to(`studio:${sc.studio_id}`).emit('screen_status', { screenId: sc.id, is_online: false, timestamp: new Date().toISOString() });
        console.log(`Screen ${sc.id} marked offline (no heartbeat for 90 s)`);
      }
    } catch (e) { console.warn('stale-online sweep failed:', e.message); }
  }, 30000);
  sweep.unref?.();

  return io;
}

module.exports = { getIO, setupWebSocket };
