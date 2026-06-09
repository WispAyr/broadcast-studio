const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getLayoutById } = require('../db');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { requireStudioAuth } = require('../middleware/apiKey');
const { getIO } = require('../ws');
const { enrichLayout } = require('../lib/enrich-layout');
const { startTimeline, stopTimeline, getCurrentState } = require('../timeline');
const cardWall = require('../card-wall');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────
// Console buttons — the in-studio "dumb console" + Stream Deck trigger surface.
//
// One source of truth (console_buttons rows) renders as:
//   • the big-button touch console at /console (JWT), and
//   • a stable fire URL per button at /api/console/:studioId/fire/:buttonId
//     that a physical Stream Deck ("System → Website") or Bitfocus Companion
//     (Generic HTTP) hits — authed by an API key (X-API-Key header OR ?key=).
//
// Both paths run the SAME dispatcher, which reuses the existing layout/timeline/
// overlay plumbing. CRUD is JWT-only (producers configure from the main UI).
// ──────────────────────────────────────────────────────────────────────────

function safeParse(raw, fallback = {}) {
  try { return JSON.parse(raw || JSON.stringify(fallback)); } catch { return fallback; }
}

function serializeButton(row) {
  if (!row) return null;
  return {
    ...row,
    action_payload: safeParse(row.action_payload, {}),
    confirm: !!row.confirm,
    enabled: !!row.enabled,
  };
}

function studioOf(req) {
  return req.body?.studio_id || req.query?.studio_id || req.user?.studio_id;
}

// ── Action dispatcher ──────────────────────────────────────────────────────

function takeLayout(studioId, layoutId, io, { stopAuto = true } = {}) {
  const layout = getLayoutById(layoutId);
  if (!layout) throw new Error('layout not found');
  if (stopAuto) stopTimeline(studioId);
  const screens = db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE studio_id = ?').all(studioId);
  let applied = 0, locked = 0;
  for (const screen of screens) {
    if (!screen.accepts_broadcasts) { locked++; continue; }
    db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(layoutId, screen.id);
    const enriched = enrichLayout({ ...layout, modules: safeParse(layout.modules, []) }, screen.id);
    io.to(`screen:${screen.id}`).emit('set_layout', { layoutId, layout: enriched, source: 'console' });
    io.to(`studio:${studioId}`).emit('screen_preview', {
      screenId: screen.id, layoutId, layout: enriched, timestamp: new Date().toISOString(),
    });
    applied++;
  }
  return { applied, locked, total: screens.length };
}

function logBroadcast(studioId, kind, overlay, userId) {
  try {
    db.prepare(`INSERT INTO broadcast_log (id, studio_id, kind, severity, message, duration_ms, source, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(uuidv4(), studioId, kind, overlay.severity || 'info', overlay.message || '',
        overlay.duration_ms || 0, 'console', userId || null);
  } catch { /* broadcast_log may not exist in older DBs */ }
}

async function pushNowPlaying(studioId, payload, io) {
  const moduleId = payload.moduleId || 'now-playing';
  // Live track + show from broadcast.radio (station 7719 for NAR). Pushes the
  // structured feed to nar_nowplaying modules AND a text lower-third fallback.
  try {
    const { fetchNowPlaying } = require('../nowplaying');
    const stationId = payload.stationId || process.env.NAR_STATION_ID || '7719';
    const np = await fetchNowPlaying(stationId);
    io.to(`studio:${studioId}`).emit('update_module_config', { moduleId, config: { nowPlaying: np } });
    const text = np.isMusic && np.title ? np.title : (np.onAir?.title || 'Now Ayrshire Radio');
    const subtitle = np.isMusic ? np.artist : (np.onAir?.presenter || '');
    io.to(`studio:${studioId}`).emit('update_module_text', { moduleId, text, subtitle });
    return { moduleId, nowPlaying: { artist: np.artist, title: np.title, show: np.onAir?.title } };
  } catch (e) {
    io.to(`studio:${studioId}`).emit('update_module_text', { moduleId, text: 'Now Ayrshire Radio', subtitle: '' });
    return { moduleId, error: e.message };
  }
}

async function dispatchAction(studioId, button, io, userId) {
  const type = button.action_type;
  const p = safeParse(button.action_payload, {});
  switch (type) {
    case 'take_layout': {
      if (!p.layout_id) throw new Error('layout_id required');
      return { type, ...takeLayout(studioId, p.layout_id, io) };
    }
    case 'blackout': {
      const bl = db.prepare("SELECT id FROM layouts WHERE studio_id = ? AND name LIKE '%Blackout%' LIMIT 1").get(studioId)
        || db.prepare("SELECT id FROM layouts WHERE name LIKE '%Blackout%' LIMIT 1").get();
      if (!bl) throw new Error('no Blackout layout found');
      return { type, ...takeLayout(studioId, bl.id, io) };
    }
    case 'apply_scene': {
      if (!p.scene_id) throw new Error('scene_id required');
      const scene = db.prepare('SELECT * FROM screen_scenes WHERE id = ?').get(p.scene_id);
      if (!scene) throw new Error('scene not found');
      stopTimeline(studioId);
      const assignments = safeParse(scene.assignments, []);
      let applied = 0, locked = 0;
      for (const a of assignments) {
        const screen = db.prepare('SELECT id, accepts_broadcasts FROM screens WHERE id = ?').get(a.screen_id);
        const layout = getLayoutById(a.layout_id);
        if (!screen || !layout) continue;
        if (!screen.accepts_broadcasts) { locked++; continue; }
        db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE id = ?")
          .run(a.layout_id, a.screen_id);
        const enriched = enrichLayout({ ...layout, modules: safeParse(layout.modules, []) }, screen.id);
        io.to(`screen:${screen.id}`).emit('set_layout', { layoutId: a.layout_id, layout: enriched, source: 'console' });
        io.to(`studio:${studioId}`).emit('screen_preview', {
          screenId: screen.id, layoutId: a.layout_id, layout: enriched, timestamp: new Date().toISOString(),
        });
        applied++;
      }
      return { type, applied, locked };
    }
    case 'resume_schedule': {
      const show = db.prepare('SELECT * FROM shows WHERE studio_id = ? AND active = 1').get(studioId);
      if (!show) throw new Error('no active show to resume');
      startTimeline(studioId, show);
      return { type, show_id: show.id };
    }
    case 'card_wall_take': {
      // Hold a TV card on the main screen wall (wall-scoped, does NOT touch
      // other monitors). Holds until the next scheduled show unless minutes set.
      if (!p.layout_id) throw new Error('layout_id required');
      cardWall.override(studioId, p.layout_id, p.minutes ? Number(p.minutes) : null);
      return { type, layout_id: p.layout_id };
    }
    case 'card_wall_resume': {
      // Drop any manual card and return the wall to the daypart schedule.
      cardWall.resume(studioId);
      return { type };
    }
    case 'breaking_news': {
      const overlay = {
        type: 'incident',
        severity: p.severity || 'danger',
        message: p.message || 'BREAKING NEWS',
        icon: p.icon || '⚠',
        duration_ms: p.duration_ms || 0,
      };
      io.to(`studio:${studioId}`).emit('push_overlay', { overlay });
      logBroadcast(studioId, 'incident', overlay, userId);
      if (p.duration_ms) {
        setTimeout(() => {
          try { io.to(`studio:${studioId}`).emit('remove_overlay', { overlayType: 'incident' }); } catch {}
        }, p.duration_ms);
      }
      return { type, message: overlay.message };
    }
    case 'clear_overlays': {
      io.to(`studio:${studioId}`).emit('clear_overlays', {});
      logBroadcast(studioId, 'clear', {}, userId);
      return { type };
    }
    case 'push_overlay': {
      // Generic transient-graphic push. action_payload IS the overlay object
      // (must carry a `type`, e.g. sl_lower_third / sl_sting / sl_breaking).
      // A `duration` (seconds) auto-dismisses it client-side; for safety we
      // also schedule a server-side remove_overlay by type.
      const overlay = p.overlay || p;
      if (!overlay || !overlay.type) throw new Error('overlay.type required');
      io.to(`studio:${studioId}`).emit('push_overlay', { overlay });
      if (overlay.duration) {
        setTimeout(() => {
          try { io.to(`studio:${studioId}`).emit('remove_overlay', { overlayType: overlay.type }); } catch {}
        }, overlay.duration * 1000);
      }
      return { type, overlay_type: overlay.type };
    }
    case 'remove_overlay': {
      // Pull a specific overlay type (e.g. the persistent score bug).
      if (!p.overlay_type) throw new Error('overlay_type required');
      io.to(`studio:${studioId}`).emit('remove_overlay', { overlayType: p.overlay_type });
      return { type, overlay_type: p.overlay_type };
    }
    case 'live_text': {
      if (!p.moduleId) throw new Error('moduleId required');
      io.to(`studio:${studioId}`).emit('update_module_text', {
        moduleId: p.moduleId, text: p.text || '', subtitle: p.subtitle || '',
      });
      return { type, moduleId: p.moduleId };
    }
    case 'module_config': {
      if (!p.moduleId) throw new Error('moduleId required');
      io.emit('update_module_config', { moduleId: p.moduleId, config: p.config || {} });
      return { type, moduleId: p.moduleId };
    }
    case 'now_playing': {
      return { type, ...(await pushNowPlaying(studioId, p, io)) };
    }
    case 'reload_screens': {
      const screens = db.prepare('SELECT id FROM screens WHERE studio_id = ?').all(studioId);
      for (const s of screens) io.to(`screen:${s.id}`).emit('reload_screen', {});
      return { type, count: screens.length };
    }
    case 'webhook': {
      if (!p.url) throw new Error('url required');
      const r = await fetch(p.url, {
        method: p.method || 'POST',
        headers: p.headers || { 'Content-Type': 'application/json' },
        body: p.body ? (typeof p.body === 'string' ? p.body : JSON.stringify(p.body)) : undefined,
      });
      return { type, status: r.status };
    }
    default:
      throw new Error('unknown action_type: ' + type);
  }
}

// ── CRUD (JWT only — producers configure from the main UI) ──────────────────

router.get('/buttons', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const rows = db.prepare('SELECT * FROM console_buttons WHERE studio_id = ? ORDER BY sort_order, created_at').all(studioId);
    res.json(rows.map(serializeButton));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/buttons', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    const { label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order } = req.body;
    if (!studioId || !label || !action_type) return res.status(400).json({ error: 'studio_id, label, action_type required' });
    const id = uuidv4();
    const maxOrder = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studioId)?.m ?? -1;
    db.prepare(`INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, studioId, label, sublabel || null, icon || null, color || null, action_type,
        JSON.stringify(action_payload || {}), confirm ? 1 : 0, enabled === false ? 0 : 1,
        sort_order ?? (maxOrder + 1));
    res.status(201).json(serializeButton(db.prepare('SELECT * FROM console_buttons WHERE id = ?').get(id)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/buttons/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM console_buttons WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'button not found' });
    const { label, sublabel, icon, color, action_type, action_payload, confirm, enabled, sort_order } = req.body;
    db.prepare(`UPDATE console_buttons SET
        label = COALESCE(?, label),
        sublabel = ?,
        icon = ?,
        color = ?,
        action_type = COALESCE(?, action_type),
        action_payload = COALESCE(?, action_payload),
        confirm = COALESCE(?, confirm),
        enabled = COALESCE(?, enabled),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now')
      WHERE id = ?`)
      .run(
        label ?? null,
        sublabel === undefined ? existing.sublabel : (sublabel || null),
        icon === undefined ? existing.icon : (icon || null),
        color === undefined ? existing.color : (color || null),
        action_type ?? null,
        action_payload === undefined ? null : JSON.stringify(action_payload || {}),
        confirm === undefined ? null : (confirm ? 1 : 0),
        enabled === undefined ? null : (enabled ? 1 : 0),
        sort_order === undefined ? null : sort_order,
        req.params.id,
      );
    res.json(serializeButton(db.prepare('SELECT * FROM console_buttons WHERE id = ?').get(req.params.id)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/buttons/:id', authenticate, (req, res) => {
  try {
    const r = db.prepare('DELETE FROM console_buttons WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'button not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/buttons/reorder', authenticate, (req, res) => {
  try {
    const { order } = req.body; // array of button ids in desired order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    const upd = db.prepare("UPDATE console_buttons SET sort_order = ?, updated_at = datetime('now') WHERE id = ?");
    const tx = db.transaction(() => order.forEach((id, i) => upd.run(i, id)));
    tx();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Current on-air state — for highlighting the live button + deck feedback.
router.get('/state', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const screens = db.prepare('SELECT id, name, current_layout_id, is_online, accepts_broadcasts FROM screens WHERE studio_id = ?').all(studioId);
    // Most common current layout = "on air"
    const counts = {};
    for (const s of screens) if (s.current_layout_id) counts[s.current_layout_id] = (counts[s.current_layout_id] || 0) + 1;
    const onAirId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
    const onAir = onAirId ? getLayoutById(onAirId) : null;
    let timeline = { active: false };
    try { timeline = getCurrentState(studioId); } catch {}
    res.json({
      screens,
      on_air_layout_id: onAirId,
      on_air_layout_name: onAir ? onAir.name : null,
      timeline,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Seed a sensible default NAR button grid (idempotent-ish: only seeds if empty).
router.post('/seed-defaults', authenticate, (req, res) => {
  try {
    const studioId = studioOf(req);
    if (!studioId) return res.status(400).json({ error: 'studio_id required' });
    const existing = db.prepare('SELECT COUNT(*) c FROM console_buttons WHERE studio_id = ?').get(studioId).c;
    if (existing > 0 && !req.body.force) return res.status(409).json({ error: 'buttons already exist; pass force:true to add anyway' });

    const layoutId = (name) => db.prepare('SELECT id FROM layouts WHERE studio_id = ? AND name = ? LIMIT 1').get(studioId, name)?.id || null;
    const NAVY = '#1E2A35', ORANGE = '#F7941D', RED = '#E2392D', BLUE = '#2563eb', GREEN = '#16a34a', SLATE = '#475569', PURPLE = '#7c3aed';

    const defs = [
      { label: 'Live Show', sublabel: 'Presenter view', icon: '🎙️', color: ORANGE, action_type: 'take_layout', payload: { layout_id: layoutId('Presenter — Live Show') } },
      { label: 'News Hour', sublabel: 'Expanded news', icon: '📰', color: BLUE, action_type: 'take_layout', payload: { layout_id: layoutId('Presenter — News Hour') } },
      { label: 'Travel & Wx', sublabel: 'Travel bulletin', icon: '🚗', color: '#0891b2', action_type: 'take_layout', payload: { layout_id: layoutId('Presenter — Travel & Weather') } },
      { label: 'Sport', sublabel: 'Sport focus', icon: '⚽', color: '#ea580c', action_type: 'take_layout', payload: { layout_id: layoutId('Presenter — Sport Focus') } },
      { label: 'Studio Wall', sublabel: 'Broadcast wall', icon: '📺', color: NAVY, action_type: 'take_layout', payload: { layout_id: layoutId('Studio Wall — Broadcast') } },
      { label: 'Music', sublabel: 'Overnight / automation', icon: '🎵', color: PURPLE, action_type: 'take_layout', payload: { layout_id: layoutId('Music / Overnight') } },
      { label: 'Now / Next', sublabel: 'Push current show', icon: '💿', color: '#db2777', action_type: 'now_playing', payload: { moduleId: 'now-playing' } },
      { label: 'BREAKING', sublabel: 'Red banner', icon: '🚨', color: RED, action_type: 'breaking_news', confirm: true, payload: { severity: 'critical', message: 'BREAKING NEWS', duration_ms: 0 } },
      { label: 'Clear Banner', sublabel: 'Remove overlays', icon: '🧹', color: SLATE, action_type: 'clear_overlays', payload: {} },
      { label: 'Resume Schedule', sublabel: 'Back to auto', icon: '🔄', color: GREEN, action_type: 'resume_schedule', payload: {} },
      { label: 'Reload Screens', sublabel: 'Refresh displays', icon: '♻️', color: SLATE, action_type: 'reload_screens', confirm: true, payload: {} },
      { label: 'Blackout', sublabel: 'All screens dark', icon: '⬛', color: '#111827', action_type: 'blackout', confirm: true, payload: {} },
    ];

    let order = db.prepare('SELECT MAX(sort_order) m FROM console_buttons WHERE studio_id = ?').get(studioId)?.m ?? -1;
    const ins = db.prepare(`INSERT INTO console_buttons (id, studio_id, label, sublabel, icon, color, action_type, action_payload, confirm, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const created = [];
    const tx = db.transaction(() => {
      for (const d of defs) {
        const id = uuidv4();
        ins.run(id, studioId, d.label, d.sublabel || null, d.icon || null, d.color || null, d.action_type,
          JSON.stringify(d.payload || {}), d.confirm ? 1 : 0, ++order);
        created.push(id);
      }
    });
    tx();
    res.status(201).json({ ok: true, created: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FIRE (JWT or API key; also accepts ?key= for Stream Deck "Website" buttons) ──

function consoleFireAuth(req, res, next) {
  // Allow the API key to arrive as a query param so a bare Stream Deck
  // "System → Website" button (URL only, no headers) can authenticate.
  if (!req.headers['x-api-key'] && req.query.key) req.headers['x-api-key'] = req.query.key;
  optionalAuthenticate(req, res, () => requireStudioAuth(req, res, next));
}

async function handleFire(req, res) {
  try {
    const { studioId, buttonId } = req.params;
    const button = db.prepare('SELECT * FROM console_buttons WHERE id = ? AND studio_id = ?').get(buttonId, studioId);
    if (!button) return res.status(404).json({ error: 'button not found' });
    if (!button.enabled) return res.status(409).json({ error: 'button disabled' });
    const result = await dispatchAction(studioId, button, getIO(), req.user?.id);
    res.json({ ok: true, button: button.label, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

router.post('/:studioId/fire/:buttonId', consoleFireAuth, handleFire);
router.get('/:studioId/fire/:buttonId', consoleFireAuth, handleFire);

module.exports = router;
