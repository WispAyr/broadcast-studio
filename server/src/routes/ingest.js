/**
 * /api/ingest/* — transparent proxy to ingest-centre (port 3960)
 *
 * Broadcast Studio screens call /api/ingest/slots to get slot lists,
 * avoiding cross-origin issues since everything is on live.wispayr.online.
 *
 * The nginx config also has a direct /api/ingest/ → :3960 rule, but this
 * server-side proxy is used when Broadcast Studio's own express instance
 * handles the request (e.g. on non-live.wispayr.online deployments).
 */

const express = require('express');
const router = express.Router();

const INGEST_BASE = process.env.INGEST_CENTRE_URL || 'http://127.0.0.1:3960';

router.all('/*', async (req, res) => {
  const targetUrl = `${INGEST_BASE}/api${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  try {
    const fetchOpts = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'X-Forwarded-For': req.ip,
      },
      signal: AbortSignal.timeout(10000),
    };

    if (!['GET', 'HEAD'].includes(req.method) && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOpts);
    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    if (e.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Ingest Centre timeout' });
    }
    res.status(503).json({ error: 'Ingest Centre unavailable', detail: e.message });
  }
});

module.exports = router;
