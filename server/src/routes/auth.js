const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, getUserByUsername, getUserById } = require('../db');
const { authenticate, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /login
router.post('/login', (req, res) => {
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
