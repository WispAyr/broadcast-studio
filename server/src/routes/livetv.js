const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Live TV channel registry ────────────────────────────────────────────────
// Off-air channels ingested by the venue HDHomeRun → go2rtc relay (see
// docs/TUNER.md). Screens resolve a `live_tv` module's `channel` key against
// this registry, so retuning (new go2rtc host, channel line-up change) is a
// single PUT here — no layout edits.
//
// File-backed (server/data/livetv.json) so it survives restarts without a
// schema migration. GET is public (screens are unauthenticated); PUT needs JWT.

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'livetv.json');

const DEFAULTS = {
  // go2rtc API base on the venue relay box (the machine running
  // docs/hdhomerun-bringup-mac.sh). Override per-deployment via PUT or env.
  host: process.env.LIVETV_GO2RTC || 'http://localhost:1984',
  // Default playback transport: MSE keeps H.264+AAC as-is (no Opus needed).
  mode: 'mse',
  channels: [
    { key: 'bbc-one', label: 'BBC One Scotland', short: 'BBC ONE', color: '#bb1919', stream: 'bbc-one' },
    { key: 'stv', label: 'STV', short: 'STV', color: '#0084d6', stream: 'stv' },
    { key: 'bbc-two', label: 'BBC Two', short: 'BBC TWO', color: '#7d6c5b', stream: 'bbc-two' },
    { key: 'channel4', label: 'Channel 4', short: 'C4', color: '#1ddbb5', stream: 'channel4' },
  ],
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return {
      host: raw.host || DEFAULTS.host,
      mode: raw.mode || DEFAULTS.mode,
      channels: Array.isArray(raw.channels) && raw.channels.length ? raw.channels : DEFAULTS.channels,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(cfg) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(cfg, null, 2));
}

// GET /api/livetv — full registry (screens + editor)
router.get('/', (req, res) => {
  res.json(load());
});

// PUT /api/livetv — replace host/mode/channels (operator/admin)
router.put('/', authenticate, (req, res) => {
  const cur = load();
  const next = {
    host: typeof req.body.host === 'string' && req.body.host ? req.body.host.replace(/\/+$/, '') : cur.host,
    mode: ['mse', 'webrtc', 'mp4'].includes(req.body.mode) ? req.body.mode : cur.mode,
    channels: Array.isArray(req.body.channels) ? req.body.channels : cur.channels,
  };
  for (const ch of next.channels) {
    if (!ch || typeof ch.key !== 'string' || !ch.key || typeof ch.stream !== 'string' || !ch.stream) {
      return res.status(400).json({ error: 'each channel needs { key, stream } (label/short/color optional)' });
    }
  }
  save(next);
  res.json(next);
});

module.exports = router;
