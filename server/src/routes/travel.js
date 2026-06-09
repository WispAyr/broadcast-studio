const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'travel-config.json');

// --- Cache (reusing pattern from proxy.js) ---
const cache = new Map();

function getCached(key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// --- Config helpers ---
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    region: 'ayrshire',
    sources: {
      trafficScotland: { enabled: true, refreshMs: 120000 },
      scotrail: { enabled: true, refreshMs: 180000 },
      calmac: { enabled: true, refreshMs: 300000 },
      prestwickAirport: { enabled: false, refreshMs: 600000 },
      councilTROs: { enabled: true, refreshMs: 600000 }
    },
    routeFilter: ['A77', 'A78', 'M77', 'A71', 'A76', 'A719', 'A79', 'A70'],
    stations: ['AYR', 'PTW', 'TRN', 'KLM', 'IRV'],
    ferryRoutes: ['Ardrossan-Brodick', 'Largs-Cumbrae'],
    refreshIntervalMs: 120000
  };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// --- RSS Parser (same as proxy.js) ---
function parseRSS(xml) {
  const items = [];
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of rssItems) {
    items.push({
      title: extractTag(item, 'title'),
      description: stripHtml(extractTag(item, 'description')),
      link: extractTag(item, 'link'),
      pubDate: extractTag(item, 'pubDate'),
      category: extractTag(item, 'category'),
      georss: extractTag(item, 'georss:point'),
    });
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
}

// --- Fetcher helper ---
async function safeFetch(url, timeoutMs = 10000) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BroadcastStudio/1.0' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// --- Traffic Scotland ---
const AYRSHIRE_PLACES = ['ayr', 'troon', 'prestwick', 'kilmarnock', 'irvine', 'maybole', 'girvan', 'cumnock', 'saltcoats', 'ardrossan', 'largs', 'stewarton', 'dalry', 'west kilbride', 'galston', 'newmilns', 'catrine', 'muirkirk', 'patna', 'dalmellington'];

function isAyrshireRelevant(text, routeFilter) {
  const lower = (text || '').toLowerCase();
  for (const route of routeFilter) {
    if (lower.includes(route.toLowerCase())) return true;
  }
  for (const place of AYRSHIRE_PLACES) {
    if (lower.includes(place)) return true;
  }
  return false;
}

function classifySeverity(title, description) {
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  if (text.includes('closed') || text.includes('blocked') || text.includes('serious') || text.includes('major')) return 'red';
  if (text.includes('delay') || text.includes('roadworks') || text.includes('works') || text.includes('restriction') || text.includes('contraflow')) return 'amber';
  return 'green';
}

function extractRoute(title, routeFilter) {
  const upper = (title || '').toUpperCase();
  for (const route of routeFilter) {
    if (upper.includes(route.toUpperCase())) return route;
  }
  // Try to find any road pattern
  const match = upper.match(/[AMB]\d{1,4}/);
  return match ? match[0] : 'Unknown';
}

// Pulls DATEX II incidents + roadworks from the WispAyr siphon service
// (https://siphon.wispayr.online). Replaced the dead trafficscotland.org RSS
// feeds — upstream 404s everywhere, and siphon already ingests the same
// DATEX II source with richer fields (lat/lon, severity, datex_type).
const SIPHON_BASE = process.env.SIPHON_BASE || 'https://siphon.wispayr.online';

async function fetchSiphonJson(pathname, ttlMs) {
  const cacheKey = `siphon:${pathname}`;
  const cached = getCached(cacheKey, ttlMs);
  if (cached) return cached;
  const url = `${SIPHON_BASE}${pathname}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BroadcastStudio/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

function normaliseDatex(item, type, routeFilter) {
  const title = item.title || '';
  const desc = item.description || '';
  const route = extractRoute(title, routeFilter);
  const severity = item.severity === 'red' || item.severity === 'amber' || item.severity === 'green'
    ? item.severity
    : classifySeverity(title, desc);
  return {
    id: item.id || `datex-${type}-${hashCode(title + (item.url || ''))}`,
    route,
    type,
    severity,
    title: title || 'Traffic update',
    detail: desc,
    location: title,
    lat: item.lat ?? null,
    lon: item.lon ?? null,
    since: item.pub_date ? new Date(item.pub_date).toISOString() : new Date().toISOString(),
  };
}

async function fetchTrafficScotland(config) {
  const ttl = config.sources.trafficScotland.refreshMs || 120000;
  const [incidentsDoc, roadworksDoc] = await Promise.all([
    fetchSiphonJson('/api/traffic/datex2/incidents', ttl),
    fetchSiphonJson('/api/traffic/datex2/roadworks', ttl),
  ]);

  const incidents = Array.isArray(incidentsDoc?.incidents) ? incidentsDoc.incidents : [];
  const roadworks = Array.isArray(roadworksDoc?.roadworks) ? roadworksDoc.roadworks : [];

  const roads = [];
  for (const item of incidents) {
    const combined = `${item.title || ''} ${item.description || ''}`;
    if (!isAyrshireRelevant(combined, config.routeFilter)) continue;
    roads.push(normaliseDatex(item, 'incident', config.routeFilter));
  }
  for (const item of roadworks) {
    const combined = `${item.title || ''} ${item.description || ''}`;
    if (!isAyrshireRelevant(combined, config.routeFilter)) continue;
    roads.push(normaliseDatex(item, 'roadworks', config.routeFilter));
  }
  return roads;
}

// --- National Rail / ScotRail ---
async function fetchRailStatus(config) {
  const cacheKey = 'rail:status';
  const ttl = config.sources.scotrail?.refreshMs || 180000;
  let cached = getCached(cacheKey, ttl);
  if (cached) return cached;

  const rail = [];

  // Try National Rail RSS indicator
  const xml = await safeFetch('https://www.nationalrail.co.uk/service_disruptions/indicator.aspx');
  if (xml) {
    // Parse the operator-level status - look for ScotRail
    const operators = xml.match(/<Operator[\s>][\s\S]*?<\/Operator>/gi) || [];
    for (const op of operators) {
      const name = extractTag(op, 'Name');
      if (!name.toLowerCase().includes('scotrail')) continue;

      const status = extractTag(op, 'Status');
      const statusText = status || 'Unknown';
      let normalizedStatus = 'good';
      const lower = statusText.toLowerCase();
      if (lower.includes('major') || lower.includes('severe') || lower.includes('cancelled')) normalizedStatus = 'major';
      else if (lower.includes('minor') || lower.includes('delay') || lower.includes('disruption')) normalizedStatus = 'minor';

      // Get any specific messages
      const messages = op.match(/<Message[\s>][\s\S]*?<\/Message>/gi) || [];
      const details = messages.map(m => stripHtml(extractTag(m, 'Message') || m.replace(/<[^>]+>/g, ''))).filter(Boolean);

      rail.push({
        id: 'rail-scotrail-overall',
        line: 'ScotRail Services',
        status: normalizedStatus,
        detail: details.join('; ') || statusText,
        stations: config.stations || [],
      });
    }
  }

  // Try ScotRail service updates page as fallback
  if (rail.length === 0) {
    const html = await safeFetch('https://www.scotrail.co.uk/plan-your-journey/service-updates');
    if (html) {
      // Look for any disruption text mentioning our stations
      const stationNames = { AYR: 'Ayr', PTW: 'Prestwick', TRN: 'Troon', KLM: 'Kilmarnock', IRV: 'Irvine', GLC: 'Glasgow' };
      const hasDisruptions = (config.stations || []).some(code => {
        const name = stationNames[code] || code;
        return html.toLowerCase().includes(name.toLowerCase()) && (html.toLowerCase().includes('disruption') || html.toLowerCase().includes('cancel') || html.toLowerCase().includes('delay'));
      });

      rail.push({
        id: 'rail-scotrail-ayrshire',
        line: 'Ayr–Glasgow line',
        status: hasDisruptions ? 'minor' : 'good',
        detail: hasDisruptions ? 'Some disruptions reported on Ayrshire services' : 'Services running normally',
        stations: config.stations || [],
      });
    } else {
      // Both sources failed
      rail.push({
        id: 'rail-scotrail-ayrshire',
        line: 'Ayr–Glasgow line',
        status: 'good',
        detail: 'Unable to fetch live data — status assumed normal',
        stations: config.stations || [],
      });
    }
  }

  setCache(cacheKey, rail);
  return rail;
}

// --- CalMac Ferries ---
async function fetchCalMacStatus(config) {
  const cacheKey = 'calmac:status';
  const ttl = config.sources.calmac?.refreshMs || 300000;
  let cached = getCached(cacheKey, ttl);
  if (cached) return cached;

  const ferries = [];
  const targetRoutes = config.ferryRoutes || ['Ardrossan-Brodick', 'Largs-Cumbrae'];

  const html = await safeFetch('https://www.calmac.co.uk/service-status');
  if (html) {
    for (const route of targetRoutes) {
      const parts = route.split('-');
      const searchTerms = parts.map(p => p.toLowerCase());

      // Look for the route in the page and determine status
      const lower = html.toLowerCase();
      const routeFound = searchTerms.some(t => lower.includes(t));

      let status = 'sailing';
      let detail = 'Normal service';

      if (routeFound) {
        // Try to find status near route mentions
        const routeRegex = new RegExp(searchTerms.join('[\\s\\S]{0,500}'), 'i');
        const match = html.match(routeRegex);
        const context = match ? match[0].toLowerCase() : lower;

        if (context.includes('cancel') || context.includes('not sailing')) {
          status = 'cancelled';
          detail = 'Service cancelled';
        } else if (context.includes('disrupted') || context.includes('disruption') || context.includes('delay') || context.includes('amended')) {
          status = 'disrupted';
          detail = 'Service disrupted — check CalMac for details';
        }
      }

      ferries.push({
        id: `ferry-${route.toLowerCase().replace(/\s+/g, '-')}`,
        route,
        status,
        detail,
        nextSailing: '',
      });
    }
  } else {
    // CalMac unreachable
    for (const route of targetRoutes) {
      ferries.push({
        id: `ferry-${route.toLowerCase().replace(/\s+/g, '-')}`,
        route,
        status: 'sailing',
        detail: 'Unable to fetch live data — status assumed normal',
        nextSailing: '',
      });
    }
  }

  setCache(cacheKey, ferries);
  return ferries;
}

// --- Summary calculation ---
function calculateSummary(sections) {
  const getSectionStatus = (items, statusField, redValues, amberValues) => {
    if (!items || items.length === 0) return 'green';
    const hasRed = items.some(i => redValues.includes(i[statusField]));
    if (hasRed) return 'red';
    const hasAmber = items.some(i => amberValues.includes(i[statusField]));
    if (hasAmber) return 'amber';
    return 'green';
  };

  const roads = getSectionStatus(sections.roads, 'severity', ['red'], ['amber']);
  const rail = getSectionStatus(sections.rail, 'status', ['major', 'cancelled'], ['minor']);
  const ferries = getSectionStatus(sections.ferries, 'status', ['cancelled'], ['disrupted']);
  const tros = getSectionStatus(sections.tros || [], 'severity', ['red'], ['amber']);

  const statuses = [roads, rail, ferries, tros];
  let overall = 'green';
  if (statuses.includes('red')) overall = 'red';
  else if (statuses.includes('amber')) overall = 'amber';

  return { roads, rail, ferries, tros, overall };
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// --- Council TROs (scraped & cached) ---
// TRO pages for the three Ayrshire councils
const TRO_SOURCES = [
  {
    council: 'South Ayrshire',
    url: 'https://www.south-ayrshire.gov.uk/article/26658/temporary-traffic-regulation-orders',
    fallbackUrl: 'https://www.south-ayrshire.gov.uk/roads-and-transport/temporary-traffic-regulation-orders',
  },
  {
    council: 'East Ayrshire',
    url: 'https://www.east-ayrshire.gov.uk/Transport-and-streets/Roads-and-pavements/Temporary-traffic-orders.aspx',
    fallbackUrl: 'https://www.east-ayrshire.gov.uk/transport-and-streets/roads-and-pavements/temporary-traffic-orders',
  },
  {
    council: 'North Ayrshire',
    url: 'https://www.north-ayrshire.gov.uk/roads-and-parking/temporary-traffic-regulation-orders',
    fallbackUrl: 'https://www.north-ayrshire.gov.uk/article/35210/temporary-traffic-regulation-orders',
  },
];

// Lightweight TRO fetcher — tries to get HTML and parse TRO notices
// Falls back gracefully when councils have Cloudflare protection
async function fetchCouncilTROs() {
  const cacheKey = 'tros:all';
  const ttl = 600000; // 10 minute cache (TROs don't change frequently)
  const cached = getCached(cacheKey, ttl);
  if (cached) return cached;

  const tros = [];

  for (const source of TRO_SOURCES) {
    try {
      // Try primary and fallback URLs
      let html = await safeFetch(source.url, 15000);
      if (!html || html.includes('Just a moment') || html.includes('Error 404')) {
        html = await safeFetch(source.fallbackUrl, 15000);
      }
      if (!html || html.includes('Just a moment') || html.includes('Error 404')) {
        continue;
      }

      // Extract TRO entries from HTML
      // Most council pages list TROs in tables or lists with road name, dates, reason
      const troEntries = parseTROHtml(html, source.council);
      tros.push(...troEntries);
    } catch {
      // Silently skip failed councils
    }
  }

  setCache(cacheKey, tros);
  return tros;
}

// Parse TRO data from council HTML pages
// Handles common patterns: table rows, list items with road/date/reason
function parseTROHtml(html, council) {
  const tros = [];

  // Pattern 1: Table rows with TRO data
  const tableRows = html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) || [];
  for (const row of tableRows) {
    const cells = row.match(/<td[\s>][\s\S]*?<\/td>/gi) || [];
    if (cells.length >= 2) {
      const cellTexts = cells.map(c => stripHtml(c.replace(/<[^>]+>/g, '')));
      // Skip header rows
      if (cellTexts[0].toLowerCase().includes('road') && cellTexts[0].toLowerCase().includes('name')) continue;
      if (cellTexts[0].length < 3) continue;

      const roadName = cellTexts[0];
      const detail = cellTexts.slice(1).join(' — ');

      // Check if it looks like a real TRO (has road-like content)
      if (roadName && !roadName.toLowerCase().includes('cookie')) {
        tros.push({
          id: `tro-${council.toLowerCase().replace(/\s/g, '-')}-${hashCode(roadName + detail)}`,
          road: roadName,
          council: council,
          type: 'tro',
          detail: detail,
          severity: classifyTROSeverity(detail),
          source: 'council',
        });
      }
    }
  }

  // Pattern 2: List items or paragraphs with TRO content
  if (tros.length === 0) {
    const items = html.match(/<li[\s>][\s\S]*?<\/li>/gi) || [];
    for (const item of items) {
      const text = stripHtml(item);
      // Match patterns like road names or "temporary" keywords
      if (text.length > 20 && (
        /\b(road|street|avenue|drive|lane|crescent|close|place|way|terrace)\b/i.test(text) ||
        /\b(closure|closed|restrict|prohibit|suspend|temporary)\b/i.test(text)
      )) {
        tros.push({
          id: `tro-${council.toLowerCase().replace(/\s/g, '-')}-${hashCode(text)}`,
          road: text.substring(0, 80),
          council: council,
          type: 'tro',
          detail: text,
          severity: classifyTROSeverity(text),
          source: 'council',
        });
      }
    }
  }

  return tros;
}

function classifyTROSeverity(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('closed') || t.includes('closure') || t.includes('prohibit')) return 'red';
  if (t.includes('restrict') || t.includes('one way') || t.includes('speed') || t.includes('weight')) return 'amber';
  return 'amber'; // Default TROs to amber as they always affect traffic
}

// one.network embed URLs for Ayrshire councils (public embeddable maps)
const ONE_NETWORK_EMBEDS = {
  southAyrshire: 'https://one.network/uk/south-ayrshire?tm=a:South+Ayrshire&ly=rw,ci,tro',
  eastAyrshire: 'https://one.network/uk/east-ayrshire?tm=a:East+Ayrshire&ly=rw,ci,tro',
  northAyrshire: 'https://one.network/uk/north-ayrshire?tm=a:North+Ayrshire&ly=rw,ci,tro',
  allAyrshire: 'https://one.network/?swLat=55.15&swLng=-5.1&neLat=55.75&neLng=-4.2&ly=rw,ci,tro',
};

// --- Endpoints ---

// GET /api/travel/tro-embeds — returns one.network embed URLs
router.get('/tro-embeds', (req, res) => {
  res.json(ONE_NETWORK_EMBEDS);
});

// GET /api/travel/data — public, no auth needed
router.get('/data', async (req, res) => {
  try {
    const config = loadConfig();
    const sections = { roads: [], rail: [], ferries: [], tros: [], flights: [] };

    const promises = [];

    if (config.sources.trafficScotland?.enabled) {
      promises.push(
        fetchTrafficScotland(config).then(roads => { sections.roads = roads; }).catch(() => {})
      );
    }

    if (config.sources.scotrail?.enabled) {
      promises.push(
        fetchRailStatus(config).then(rail => { sections.rail = rail; }).catch(() => {})
      );
    }

    if (config.sources.calmac?.enabled) {
      promises.push(
        fetchCalMacStatus(config).then(ferries => { sections.ferries = ferries; }).catch(() => {})
      );
    }

    // Always try to fetch TROs
    promises.push(
      fetchCouncilTROs().then(tros => { sections.tros = tros; }).catch(() => {})
    );

    await Promise.all(promises);

    const summary = calculateSummary(sections);

    res.json({
      lastUpdated: new Date().toISOString(),
      sections,
      summary,
    });
  } catch (err) {
    console.error('Travel data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/travel/config — public
router.get('/config', (req, res) => {
  res.json(loadConfig());
});

// PUT /api/travel/config — requires auth
router.put('/config', authenticate, (req, res) => {
  try {
    const current = loadConfig();
    const updated = { ...current, ...req.body };
    saveConfig(updated);
    // Clear caches so new config takes effect
    cache.clear();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
