const express = require('express');
const crypto = require('crypto');
const {
  getVariablesByStudio,
  getVariable,
  createVariable,
  setVariableValue,
  bumpVariable,
  resetVariable,
  updateVariableMeta,
  deleteVariable,
  getStudioById,
  getApiKeysByStudio,
  createApiKey,
  revokeApiKey,
} = require('../db');
const { optionalAuthenticate } = require('../middleware/auth');
const { requireStudioAuth, generateKey } = require('../middleware/apiKey');

const router = express.Router({ mergeParams: true });

// Any route here accepts either JWT (Bearer) or X-API-Key, scoped to :studioId
router.use(optionalAuthenticate, requireStudioAuth);

function emitVariableUpdate(studioId, variable) {
  try {
    const { getIO } = require('../ws');
    getIO().to(`studio:${studioId}`).emit('variable_update', {
      id: variable.id,
      name: variable.name,
      kind: variable.kind,
      value: variable.value,
      timestamp: Date.now(),
    });
  } catch {}
}

function validateStudio(req, res) {
  const studio = getStudioById(req.params.studioId);
  if (!studio) { res.status(404).json({ error: 'studio not found' }); return null; }
  return studio;
}

// ── Variables CRUD ─────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  if (!validateStudio(req, res)) return;
  res.json(getVariablesByStudio(req.params.studioId));
});

router.get('/:id', (req, res) => {
  if (!validateStudio(req, res)) return;
  const v = getVariable(req.params.studioId, req.params.id);
  if (!v) return res.status(404).json({ error: 'variable not found' });
  res.json(v);
});

router.post('/', express.json(), (req, res) => {
  if (!validateStudio(req, res)) return;
  const { id, name, kind, value, default_value, metadata } = req.body || {};
  if (!id || !name || !kind) return res.status(400).json({ error: 'id, name, kind required' });
  if (!/^[a-zA-Z0-9:_\-.]+$/.test(id)) return res.status(400).json({ error: 'id must be [a-zA-Z0-9:_-.]' });
  try {
    const existing = getVariable(req.params.studioId, id);
    if (existing) return res.status(409).json({ error: 'variable already exists' });
    const created = createVariable(req.params.studioId, { id, name, kind, value, default_value, metadata });
    emitVariableUpdate(req.params.studioId, created);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', express.json(), (req, res) => {
  if (!validateStudio(req, res)) return;
  const { value, name, metadata, default_value } = req.body || {};
  let variable = getVariable(req.params.studioId, req.params.id);
  if (!variable) return res.status(404).json({ error: 'variable not found' });
  if (name !== undefined || metadata !== undefined || default_value !== undefined) {
    variable = updateVariableMeta(req.params.studioId, req.params.id, { name, metadata, default_value });
  }
  if (value !== undefined) {
    variable = setVariableValue(req.params.studioId, req.params.id, value);
    emitVariableUpdate(req.params.studioId, variable);
  } else {
    emitVariableUpdate(req.params.studioId, variable);
  }
  res.json(variable);
});

router.post('/:id/bump', express.json(), (req, res) => {
  if (!validateStudio(req, res)) return;
  const delta = (req.body && req.body.delta) ?? 1;
  try {
    const v = bumpVariable(req.params.studioId, req.params.id, delta);
    if (!v) return res.status(404).json({ error: 'variable not found' });
    emitVariableUpdate(req.params.studioId, v);
    res.json(v);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reset', (req, res) => {
  if (!validateStudio(req, res)) return;
  const v = resetVariable(req.params.studioId, req.params.id);
  if (!v) return res.status(404).json({ error: 'variable not found' });
  emitVariableUpdate(req.params.studioId, v);
  res.json(v);
});

router.delete('/:id', (req, res) => {
  if (!validateStudio(req, res)) return;
  const ok = deleteVariable(req.params.studioId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'variable not found' });
  res.json({ ok: true });
});

// ── API keys for this studio (user auth only; API-keys can't mint keys) ────
// Separate router for /api/studios/:studioId/api-keys

const keyRouter = express.Router({ mergeParams: true });
keyRouter.use(optionalAuthenticate, requireStudioAuth);

keyRouter.get('/', (req, res) => {
  if (req.authType !== 'user') return res.status(403).json({ error: 'user auth required' });
  res.json(getApiKeysByStudio(req.params.studioId));
});

keyRouter.post('/', express.json(), (req, res) => {
  if (req.authType !== 'user') return res.status(403).json({ error: 'user auth required' });
  const { name, scopes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = crypto.randomUUID();
  const key = generateKey();
  const meta = createApiKey({
    id,
    studio_id: req.params.studioId,
    name,
    key_hash: key.hash,
    key_prefix: key.prefix,
    scopes: scopes || ['variables:write'],
  });
  res.status(201).json({ ...meta, key: key.raw, _note: 'store this key now — it will not be shown again' });
});

keyRouter.delete('/:keyId', (req, res) => {
  if (req.authType !== 'user') return res.status(403).json({ error: 'user auth required' });
  const ok = revokeApiKey(req.params.keyId);
  if (!ok) return res.status(404).json({ error: 'key not found' });
  res.json({ ok: true });
});

module.exports = { router, keyRouter };
