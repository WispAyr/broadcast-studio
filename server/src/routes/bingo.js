// ── Bingo game engine + control API ──
//
// Authoritative game state lives here (the SERVER draws numbers so the game is
// fair and every screen agrees). Screens are dumb: they fetch `/api/bingo/:id`
// once on load and then follow the `bingo_update` socket event.
//
// Mirrors the counter pattern (see index.js) but with its own dedicated socket
// event so calling a number doesn't remount the screen module — animations on
// the flashboard stay smooth. State survives restarts via a JSON snapshot.
//
// Two variants: '90' (UK, 1–90) and '75' (US, 1–75, B-I-N-G-O columns).
// Numbers can arrive two ways:
//   POST /:id/draw        server picks a fair random remaining ball (digital game)
//   POST /:id/call {number}  operator types a ball drawn on a physical machine

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
router.use(express.json());

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'bingo-games.json');
const VARIANTS = { '90': 90, '75': 75 };
const PHASES = ['eyes_down', 'one_line', 'two_lines', 'full_house', 'winner'];

let games = {};
try {
  games = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
  const n = Object.keys(games).length;
  if (n) console.log(`[bingo] Restored ${n} game(s) from disk`);
} catch { games = {}; }

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(games));
    } catch (e) { console.error('[bingo] persist error:', e.message); }
  }, 250);
}

function defaults(id) {
  return {
    id,
    variant: '90',       // '90' | '75'
    drawn: [],           // numbers in call order (oldest → newest)
    phase: 'eyes_down',  // caller-set stage label
    brand: 'generic',    // named brand pack resolved on the screen
    branding: null,      // optional inline overrides { title, logo, bg, accent }
    updatedAt: Date.now(),
  };
}

function getGame(id) {
  if (!games[id]) games[id] = defaults(id);
  const g = games[id];
  if (!VARIANTS[g.variant]) g.variant = '90';
  if (!Array.isArray(g.drawn)) g.drawn = [];
  return g;
}

function maxBall(g) { return VARIANTS[g.variant] || 90; }

function emit(g) {
  try { require('../ws').getIO().emit('bingo_update', { gameId: g.id, state: publicState(g) }); }
  catch (e) { /* io not ready yet */ }
}

function touch(g) { g.updatedAt = Date.now(); persist(); emit(g); }

function publicState(g) {
  const max = maxBall(g);
  const drawn = g.drawn;
  return {
    id: g.id,
    variant: g.variant,
    max,
    drawn,
    current: drawn.length ? drawn[drawn.length - 1] : null,
    previous: drawn.length > 1 ? drawn[drawn.length - 2] : null,
    recent: drawn.slice(-6).reverse(),
    count: drawn.length,
    remaining: max - drawn.length,
    phase: g.phase,
    brand: g.brand,
    branding: g.branding || null,
    updatedAt: g.updatedAt,
  };
}

// GET current state — screens + console hydrate from this on load / reconnect
router.get('/:id', (req, res) => {
  res.json(publicState(getGame(req.params.id)));
});

// Draw the next fair random ball from the remaining pool (digital game)
router.post('/:id/draw', (req, res) => {
  const g = getGame(req.params.id);
  const max = maxBall(g);
  if (g.drawn.length >= max) {
    return res.status(409).json({ error: 'All balls have been called', ...publicState(g) });
  }
  const seen = new Set(g.drawn);
  const pool = [];
  for (let n = 1; n <= max; n++) if (!seen.has(n)) pool.push(n);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  g.drawn.push(pick);
  touch(g);
  res.json(publicState(g));
});

// Manually call a specific ball (operator reads it off a physical machine)
router.post('/:id/call', (req, res) => {
  const g = getGame(req.params.id);
  const max = maxBall(g);
  const n = parseInt(req.body && req.body.number, 10);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    return res.status(400).json({ error: `number must be between 1 and ${max}` });
  }
  if (g.drawn.includes(n)) {
    return res.status(409).json({ error: `${n} has already been called`, ...publicState(g) });
  }
  g.drawn.push(n);
  touch(g);
  res.json(publicState(g));
});

// Undo the last ball (mis-key / duplicate on the machine)
router.post('/:id/undo', (req, res) => {
  const g = getGame(req.params.id);
  g.drawn.pop();
  touch(g);
  res.json(publicState(g));
});

// Reset / new game (optionally switch variant + brand at the same time)
router.post('/:id/reset', (req, res) => {
  const g = getGame(req.params.id);
  const v = req.body && req.body.variant != null ? String(req.body.variant) : null;
  if (v && VARIANTS[v]) g.variant = v;
  if (req.body && req.body.brand) g.brand = String(req.body.brand);
  g.drawn = [];
  g.phase = 'eyes_down';
  touch(g);
  res.json(publicState(g));
});

// Set the game stage label shown on the board
router.post('/:id/phase', (req, res) => {
  const g = getGame(req.params.id);
  const p = String((req.body && req.body.phase) || 'eyes_down');
  g.phase = PHASES.includes(p) ? p : p; // allow custom labels too
  touch(g);
  res.json(publicState(g));
});

// Switch variant — changing it always starts a fresh game (board size differs)
router.post('/:id/variant', (req, res) => {
  const g = getGame(req.params.id);
  const v = String(req.body && req.body.variant);
  if (!VARIANTS[v]) return res.status(400).json({ error: 'variant must be "90" or "75"' });
  if (v !== g.variant) { g.variant = v; g.drawn = []; g.phase = 'eyes_down'; }
  touch(g);
  res.json(publicState(g));
});

// Brand pack (named) + optional inline overrides
router.post('/:id/brand', (req, res) => {
  const g = getGame(req.params.id);
  if (req.body && req.body.brand) g.brand = String(req.body.brand);
  if (req.body && 'branding' in req.body) g.branding = req.body.branding || null;
  touch(g);
  res.json(publicState(g));
});

module.exports = router;
