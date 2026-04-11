const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const EGPK_BASE = 'https://egpk.info';

const SCENES = [
  { id: 'radar',       name: 'Live Radar',       description: 'ADS-B radar with range rings, runway, smart camera',    accent: 'sky',     icon: 'radar',    category: 'core' },
  { id: 'cinematic',   name: 'Cinematic',         description: 'WebGL 3D cinematic view with particle effects',         accent: 'sky',     icon: 'film',     category: 'core' },
  { id: 'overview',    name: 'Overview',          description: 'Full dashboard overview with all key metrics',           accent: 'sky',     icon: 'layout',   category: 'core' },
  { id: 'movements',   name: 'Live Movements',    description: 'Inbound/outbound scoreboard with flight cards',         accent: 'emerald', icon: 'list',     category: 'core' },
  { id: 'weather',     name: 'EGPK Weather',      description: 'Active runway, wind compass, conditions, raw METAR',    accent: 'sky',     icon: 'cloud',    category: 'data' },
  { id: 'military',    name: 'Military Transit',   description: 'Featured military aircraft with full data cards',       accent: 'amber',   icon: 'shield',   category: 'special' },
  { id: 'standby',     name: 'Standby',           description: 'Animated radar sweep shown when no traffic in zone',    accent: 'sky',     icon: 'radio',    category: 'utility' },
  { id: 'fuel',        name: 'Aviation Fuel',     description: 'Jet A-1 prices, sparkline, range indicator',            accent: 'amber',   icon: 'fuel',     category: 'data' },
  { id: 'leaderboard', name: 'Creator Pool',      description: 'Monthly photo impressions leaderboard',                 accent: 'emerald', icon: 'trophy',   category: 'community' },
  { id: 'rare',        name: 'Rare Sighting',     description: 'Unusual aircraft flagged by the system',                accent: 'violet',  icon: 'star',     category: 'special' },
  { id: 'photo',       name: 'Community Photo',   description: 'Random published community photo with credit',          accent: 'sky',     icon: 'camera',   category: 'community' },
  { id: 'sar',         name: 'SAR Scene',         description: 'Search and rescue operations monitoring',               accent: 'rose',    icon: 'heart',    category: 'special' },
  { id: 'command',     name: 'Command',           description: 'METAR + movement counts, WebGL tactical display',       accent: 'sky',     icon: 'terminal', category: 'core' },
  { id: 'airspace',    name: 'Airspace',          description: 'Dynamic airspace classification overlay',               accent: 'sky',     icon: 'layers',   category: 'data' },
  { id: 'globe',       name: 'Globe',             description: '3D globe view with flight routes',                      accent: 'sky',     icon: 'globe',    category: 'core' },
  { id: 'replay',      name: 'Replay',            description: 'Historical playback of recorded movements',             accent: 'sky',     icon: 'rewind',   category: 'utility' },
  { id: 'timelapse',   name: 'Timelapse',         description: 'Accelerated time-lapse of daily traffic',               accent: 'sky',     icon: 'fast-forward', category: 'utility' },

  // Ayrshire Weather & Data views
  { id: 'weather-ayrshire', name: 'Ayrshire Weather',  description: 'Full Ayrshire weather — 9 towns, marine, rivers, beaches, storm tracker', accent: 'sky',     icon: 'cloud',  category: 'weather', url: 'https://weather.ayrshire.wispayr.online' },
  { id: 'weather-ayr',     name: 'Ayr Weather',        description: 'Ayr weather conditions',                                                  accent: 'sky',     icon: 'cloud',  category: 'weather', url: 'https://weather.ayrshire.wispayr.online/#ayr' },
  { id: 'weather-troon',   name: 'Troon Weather',      description: 'Troon weather conditions',                                                accent: 'sky',     icon: 'cloud',  category: 'weather', url: 'https://weather.ayrshire.wispayr.online/#troon' },
  { id: 'weather-prestwick',name:'Prestwick Weather',   description: 'Prestwick weather conditions',                                            accent: 'sky',     icon: 'cloud',  category: 'weather', url: 'https://weather.ayrshire.wispayr.online/#prestwick' },
  { id: 'weather-kilmarnock',name:'Kilmarnock Weather', description: 'Kilmarnock weather conditions',                                           accent: 'sky',     icon: 'cloud',  category: 'weather', url: 'https://weather.ayrshire.wispayr.online/#kilmarnock' },
  { id: 'ayrshire-news',   name: 'Ayrshire News',      description: 'Ayrshire local news aggregator',                                          accent: 'emerald', icon: 'list',   category: 'ayrshire', url: 'https://news.ayrshire.wispayr.online' },
  { id: 'ayrshire-hub',    name: 'Ayrshire Hub',       description: 'Ayrshire community hub',                                                  accent: 'emerald', icon: 'globe',  category: 'ayrshire', url: 'https://ayrshire.wispayr.online' },
  { id: 'director',    name: 'Director (Auto)',    description: 'Auto-switching between scenes based on activity',       accent: 'sky',     icon: 'play',     category: 'utility' },
];

// GET /api/egpk/scenes — list all available TV scenes
router.get('/scenes', authenticate, (req, res) => {
  const scenes = SCENES.map(s => ({
    ...s,
    url: s.url || `${EGPK_BASE}/tv/${s.id === 'director' ? '' : s.id}`,
    thumbnail: s.url || `${EGPK_BASE}/tv/${s.id === 'director' ? '' : s.id}`,
  }));
  res.json({ scenes, baseUrl: EGPK_BASE });
});

// GET /api/egpk/scenes/:id — get single scene detail
router.get('/scenes/:id', authenticate, (req, res) => {
  const scene = SCENES.find(s => s.id === req.params.id);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  res.json({
    ...scene,
    url: scene.url || `${EGPK_BASE}/tv/${scene.id === 'director' ? '' : scene.id}`,
  });
});

module.exports = router;
