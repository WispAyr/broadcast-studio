const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, getUserByUsername, getUserById } = require('../db');
const { authenticate, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Simple in-memory rate limiter for login (5 attempts per 15 min per IP)
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

function checkLoginRate(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || (now - record.windowStart > LOGIN_WINDOW_MS)) {
    loginAttempts.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  record.count++;
  if (record.count > LOGIN_MAX_ATTEMPTS) return false;
  return true;
}

// Cleanup stale entries every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.windowStart > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

// POST /login
router.post('/login', (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkLoginRate(clientIp)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, studio_id: user.studio_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        studio_id: user.studio_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /register (super_admin only)
router.post('/register', authenticate, requireRole(['super_admin']), (req, res) => {
  try {
    const { username, password, name, role, studio_id } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'username, password, name, and role are required' });
    }

    const existing = getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, username, password, name, role, studio_id) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, hashedPassword, name, role, studio_id || null);

    res.status(201).json({
      id,
      username,
      name,
      role,
      studio_id: studio_id || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users - list all users (super_admin only)
router.get('/users', authenticate, requireRole(['super_admin']), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.name, u.role, u.studio_id, u.active, u.created_at, u.updated_at,
             s.name as studio_name
      FROM users u
      LEFT JOIN studios s ON u.studio_id = s.id
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id - update user (super_admin only)
router.put('/users/:id', authenticate, requireRole(['super_admin']), (req, res) => {
  try {
    const { name, role, studio_id, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let hashedPassword = user.password;
    if (password) {
      hashedPassword = bcrypt.hashSync(password, 10);
    }

    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        studio_id = ?,
        password = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, role || null, studio_id !== undefined ? studio_id || null : user.studio_id, hashedPassword, req.params.id);

    const updated = db.prepare('SELECT id, username, name, role, studio_id, active, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:id - delete user (super_admin only)
router.delete('/users/:id', authenticate, requireRole(['super_admin']), (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /me
router.get('/me', authenticate, (req, res) => {
  try {
    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
