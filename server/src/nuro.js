/**
 * nuro.js — Nuro ecosystem integration for Broadcast Studio
 *
 * Handles:
 *  - Periodic heartbeat POST to the Nuro hub
 *  - Periodic telemetry POST to the Nuro hub
 *  - sendNuroAlert() — outbound alert to Dispatch
 *
 * All comms are skipped gracefully if NURO_HUB_URL / NURO_DISPATCH_URL
 * are not set, so the studio runs standalone without Nuro.
 */

const { db } = require('./db');

const SERVICE_LABEL   = 'Broadcast Studio';
const SERVICE_ICON    = '🎙';
const SERVICE_VERSION = '1.0.0';
const START_TIME      = Date.now();

function uptimeSeconds() {
  return Math.floor((Date.now() - START_TIME) / 1000);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nuroHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.NURO_SERVICE_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.NURO_SERVICE_TOKEN}`;
  }
  return headers;
}

async function postToNuro(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: nuroHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json().catch(() => ({}));
}

// ── Live telemetry snapshot ───────────────────────────────────────────────────

function buildTelemetry() {
  const screens      = db.prepare('SELECT id, is_online FROM screens').all();
  const onlineCount  = screens.filter(s => s.is_online).length;
  const activeShow   = db.prepare('SELECT name FROM shows WHERE active = 1 LIMIT 1').get();

  return {
    service:        'broadcast-studio',
    label:          SERVICE_LABEL,
    screens_online: onlineCount,
    screens_total:  screens.length,
    active_show:    activeShow?.name || null,
    uptime_s:       uptimeSeconds(),
    timestamp:      new Date().toISOString(),
  };
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

async function sendHeartbeat() {
  const hubUrl = process.env.NURO_HUB_URL;
  if (!hubUrl) return;

  const payload = {
    version:    SERVICE_VERSION,
    label:      SERVICE_LABEL,
    icon:       SERVICE_ICON,
    uptime_s:   uptimeSeconds(),
    interfaces: [
      {
        label:      'HTTP API',
        path:       `http://localhost:${process.env.PORT || 3945}`,
        latency_ms: 0,
        priority:   1,
      },
    ],
  };

  try {
    await postToNuro(`${hubUrl}/api/heartbeat`, payload);
    console.log('[nuro] heartbeat sent ✓');
  } catch (err) {
    console.warn('[nuro] heartbeat failed:', err.message);
  }
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

async function sendTelemetry() {
  const hubUrl = process.env.NURO_HUB_URL;
  if (!hubUrl) return;

  try {
    await postToNuro(`${hubUrl}/api/telemetry`, buildTelemetry());
    console.log('[nuro] telemetry sent ✓');
  } catch (err) {
    console.warn('[nuro] telemetry failed:', err.message);
  }
}

// ── Outbound alert to Dispatch ────────────────────────────────────────────────

/**
 * Send an alert from Broadcast Studio upstream to Dispatch/Nuro.
 *
 * @param {object} payload
 * @param {string} payload.type      'EMERGENCY' | 'WARNING' | 'INFO'
 * @param {string} payload.title
 * @param {string} [payload.body]
 * @param {string} [payload.studio_id]
 */
async function sendNuroAlert(payload) {
  const dispatchUrl = process.env.NURO_DISPATCH_URL;
  if (!dispatchUrl) {
    console.warn('[nuro] sendNuroAlert skipped — NURO_DISPATCH_URL not set');
    return { ok: false, reason: 'NURO_DISPATCH_URL not configured' };
  }

  const body = {
    source:    'broadcast-studio',
    type:      payload.type     || 'INFO',
    title:     payload.title    || 'Broadcast Studio Alert',
    body:      payload.body     || '',
    studio_id: payload.studio_id || null,
    timestamp: new Date().toISOString(),
    meta:      buildTelemetry(),
  };

  try {
    const result = await postToNuro(`${dispatchUrl}/api/events/inbound`, body);
    console.log('[nuro] outbound alert sent ✓', payload.type, payload.title);
    return { ok: true, result };
  } catch (err) {
    console.error('[nuro] outbound alert failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Start heartbeat + telemetry loops.
 * Call once after the server is listening.
 */
function startNuro() {
  if (!process.env.NURO_HUB_URL) {
    console.log('[nuro] NURO_HUB_URL not set — running in standalone mode');
    return;
  }

  console.log('[nuro] starting integration with hub:', process.env.NURO_HUB_URL);

  // Initial burst
  sendHeartbeat();
  sendTelemetry();

  // Recurring loops
  setInterval(sendHeartbeat,  30_000);   // every 30 s
  setInterval(sendTelemetry,  60_000);   // every 60 s
}

// ── Nuro capabilities manifest ─────────────────────────────────────────────────

/**
 * Returns the full Nuro capabilities object for GET /api/nuro.
 * Includes live telemetry streams.
 */
function getNuroManifest() {
  const screens     = db.prepare('SELECT id, is_online FROM screens').all();
  const onlineCount = screens.filter(s => s.is_online).length;
  const activeShow  = db.prepare('SELECT name FROM shows WHERE active = 1 LIMIT 1').get();

  return {
    version:     '2.0',
    label:       SERVICE_LABEL,
    icon:        SERVICE_ICON,
    description: 'Multi-tenant broadcast screen control system',
    capabilities: [
      'alert_receive',
      'screen_push',
      'layout_control',
      'emergency_override',
      'telemetry',
    ],
    streams: [
      {
        label: 'Screens Online',
        type:  'gauge',
        value: onlineCount,
        max:   screens.length,
      },
      {
        label: 'Total Screens',
        type:  'gauge',
        value: screens.length,
      },
      {
        label: 'Active Show',
        type:  'string',
        value: activeShow?.name || 'None',
      },
      {
        label: 'Uptime',
        type:  'duration_s',
        value: uptimeSeconds(),
      },
      {
        label: 'System Status',
        type:  'gauge',
        value: 100,
      },
    ],
    endpoints: {
      alert_inbound:  '/api/nuro/alert',
      send_alert:     '/api/nuro/send-alert',
      alert_log:      '/api/nuro/alerts',
      health:         '/api/health',
    },
  };
}

module.exports = { startNuro, sendNuroAlert, getNuroManifest, buildTelemetry };
