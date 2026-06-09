const crypto = require('crypto');
const { getApiKeyByHash, touchApiKey } = require('../db');

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateKey() {
  const raw = 'bs_' + crypto.randomBytes(24).toString('base64url');
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, 10) };
}

function authenticateApiKey(req) {
  const raw = req.headers['x-api-key'];
  if (!raw) return null;
  const row = getApiKeyByHash(hashKey(raw));
  if (!row) return null;
  try { touchApiKey(row.id); } catch {}
  let scopes = [];
  try { scopes = JSON.parse(row.scopes || '[]'); } catch {}
  return { id: row.id, studio_id: row.studio_id, name: row.name, scopes };
}

function requireStudioAuth(req, res, next) {
  const studioId = req.params.studioId;
  if (!studioId) return res.status(400).json({ error: 'studioId required' });

  const apiKey = authenticateApiKey(req);
  if (apiKey) {
    if (apiKey.studio_id !== studioId) {
      return res.status(403).json({ error: 'API key not authorized for this studio' });
    }
    req.apiKey = apiKey;
    req.authType = 'api_key';
    return next();
  }

  if (req.user) {
    const role = req.user.role;
    const userStudio = req.user.studio_id;
    if (role === 'super_admin' || userStudio === studioId) {
      req.authType = 'user';
      return next();
    }
    return res.status(403).json({ error: 'user not authorized for this studio' });
  }

  return res.status(401).json({ error: 'authentication required (Bearer token or X-API-Key)' });
}

module.exports = { hashKey, generateKey, authenticateApiKey, requireStudioAuth };
