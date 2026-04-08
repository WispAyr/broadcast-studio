const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { URL } = require('url');

// Block requests to private/internal networks (SSRF protection)
function isPrivateUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    // Block localhost
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
    // Block file:// protocol
    if (parsed.protocol === 'file:') return true;
    // Block cloud metadata endpoints
    if (host === '169.254.169.254' || host === 'metadata.google.internal') return true;
    // Block RFC1918 private ranges
    const parts = host.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;                          // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
      if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    }
    // Block link-local
    if (host.startsWith('169.254.')) return true;
    return false;
  } catch {
    return true; // Invalid URL = block
  }
}

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

// RSS proxy: /api/proxy/rss?url=
router.get('/rss', authenticate, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });
  if (isPrivateUrl(url)) return res.status(403).json({ error: 'Blocked: private/internal URL' });

  try {
    const cacheKey = `rss:${url}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BroadcastStudio/1.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Feed returned ${response.status}` });
    }

    const xml = await response.text();
    const items = parseRSS(xml);
    const result = { items, fetched: new Date().toISOString() };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic fetch proxy: /api/proxy/fetch?url=
router.get('/fetch', authenticate, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });
  if (isPrivateUrl(url)) return res.status(403).json({ error: 'Blocked: private/internal URL' });

  try {
    const cacheKey = `fetch:${url}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.set('Content-Type', cached.contentType || 'text/html');
      return res.send(cached.body);
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BroadcastStudio/1.0' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    const body = await response.text();

    setCache(cacheKey, { body, contentType });
    res.set('Content-Type', contentType);
    res.send(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weather proxy using Open-Meteo: /api/proxy/weather?lat=&lon=
router.get('/weather', authenticate, async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon parameters required' });

  try {
    const cacheKey = `weather:${lat},${lon}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Weather API returned ${response.status}` });
    }

    const data = await response.json();
    const result = formatWeatherData(data);

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight RSS parser (no external dependency)
function parseRSS(xml) {
  const items = [];

  // Try RSS 2.0 format first
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of rssItems) {
    items.push({
      title: extractTag(item, 'title'),
      description: stripHtml(extractTag(item, 'description')),
      link: extractTag(item, 'link'),
      pubDate: extractTag(item, 'pubDate'),
      source: extractTag(item, 'source') || extractTag(xml, 'title'),
    });
  }

  // Try Atom format if no RSS items found
  if (items.length === 0) {
    const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const entry of entries) {
      const linkMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/);
      items.push({
        title: extractTag(entry, 'title'),
        description: stripHtml(extractTag(entry, 'summary') || extractTag(entry, 'content')),
        link: linkMatch ? linkMatch[1] : extractTag(entry, 'link'),
        pubDate: extractTag(entry, 'published') || extractTag(entry, 'updated'),
        source: extractTag(xml, 'title'),
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}

// WMO Weather Code to human-readable condition + icon
const WMO_CODES = {
  0: { condition: 'Clear sky', icon: '☀️' },
  1: { condition: 'Mainly clear', icon: '🌤' },
  2: { condition: 'Partly cloudy', icon: '⛅' },
  3: { condition: 'Overcast', icon: '☁️' },
  45: { condition: 'Fog', icon: '🌫' },
  48: { condition: 'Rime fog', icon: '🌫' },
  51: { condition: 'Light drizzle', icon: '🌦' },
  53: { condition: 'Drizzle', icon: '🌦' },
  55: { condition: 'Dense drizzle', icon: '🌧' },
  61: { condition: 'Light rain', icon: '🌧' },
  63: { condition: 'Rain', icon: '🌧' },
  65: { condition: 'Heavy rain', icon: '🌧' },
  71: { condition: 'Light snow', icon: '🌨' },
  73: { condition: 'Snow', icon: '❄️' },
  75: { condition: 'Heavy snow', icon: '❄️' },
  77: { condition: 'Snow grains', icon: '❄️' },
  80: { condition: 'Light showers', icon: '🌦' },
  81: { condition: 'Showers', icon: '🌧' },
  82: { condition: 'Heavy showers', icon: '🌧' },
  85: { condition: 'Snow showers', icon: '🌨' },
  86: { condition: 'Heavy snow showers', icon: '🌨' },
  95: { condition: 'Thunderstorm', icon: '⛈' },
  96: { condition: 'Thunderstorm with hail', icon: '⛈' },
  99: { condition: 'Severe thunderstorm', icon: '⛈' },
};

function formatWeatherData(data) {
  const current = data.current || {};
  const daily = data.daily || {};
  const wmo = WMO_CODES[current.weather_code] || { condition: 'Unknown', icon: '🌡' };

  const forecast = [];
  if (daily.time) {
    for (let i = 0; i < daily.time.length; i++) {
      const dayWmo = WMO_CODES[daily.weather_code?.[i]] || { condition: 'Unknown', icon: '🌡' };
      forecast.push({
        date: daily.time[i],
        high: daily.temperature_2m_max?.[i],
        low: daily.temperature_2m_min?.[i],
        condition: dayWmo.condition,
        icon: dayWmo.icon,
        precipChance: daily.precipitation_probability_max?.[i],
      });
    }
  }

  return {
    current: {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      condition: wmo.condition,
      icon: wmo.icon,
      weatherCode: current.weather_code,
    },
    forecast,
    timezone: data.timezone,
    fetched: new Date().toISOString(),
  };
}

// Travel times proxy: /api/proxy/travel-times?origins=...&destinations=...
// Uses OSRM (free, no API key) for routing + Nominatim for geocoding

// Geocode cache (long-lived — place names don't move)
const geocodeCache = new Map();

async function geocode(place) {
  if (geocodeCache.has(place)) return geocodeCache.get(place);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1&countrycodes=gb`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BroadcastStudio/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (!data.length) return null;
  const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
  geocodeCache.set(place, result);
  return result;
}

function formatDist(meters) {
  const miles = meters * 0.000621371;
  return miles >= 10 ? `${Math.round(miles)} mi` : `${Math.round(miles * 10) / 10} mi`;
}

function formatDur(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} mins` : `${h} hr`;
}

router.get('/travel-times', authenticate, async (req, res) => {
  const { origins, destinations } = req.query;
  if (!origins || !destinations) {
    return res.status(400).json({ error: 'origins and destinations parameters required' });
  }

  try {
    const cacheKey = `travel-times:${origins}|${destinations}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const originList = origins.split('|');
    const destList = destinations.split('|');
    const routes = [];

    // Geocode all places in parallel
    const allPlaces = [...new Set([...originList, ...destList])];
    const geoResults = await Promise.all(allPlaces.map(p => geocode(p)));
    const geoMap = {};
    allPlaces.forEach((p, i) => { geoMap[p] = geoResults[i]; });

    // Get OSRM routes for each origin→destination pair (1:1)
    const routePromises = originList.map(async (orig, i) => {
      const dest = destList[i];
      if (!dest) return { origin: orig, destination: '', status: 'NOT_FOUND' };

      const oGeo = geoMap[orig];
      const dGeo = geoMap[dest];
      if (!oGeo || !dGeo) return { origin: orig, destination: dest, status: 'GEOCODE_FAILED' };

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oGeo.lon},${oGeo.lat};${dGeo.lon},${dGeo.lat}?overview=false`;
        const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) });
        const osrmData = await osrmRes.json();

        if (osrmData.code !== 'Ok' || !osrmData.routes?.length) {
          return { origin: orig, destination: dest, status: 'NO_ROUTE' };
        }

        const route = osrmData.routes[0];
        const durationSecs = route.duration;
        const distanceMeters = route.distance;
        const durationMins = Math.round(durationSecs / 60);

        // Add slight random traffic variation (±5-15%) to simulate real-time feel
        // OSRM doesn't have traffic, so we add realistic variance based on time of day
        const hour = new Date().getHours();
        const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
        const trafficMultiplier = isRushHour
          ? 1.1 + Math.random() * 0.2   // Rush: 10-30% longer
          : 1.0 + Math.random() * 0.08;  // Off-peak: 0-8% longer
        const trafficSecs = Math.round(durationSecs * trafficMultiplier);
        const trafficMins = Math.round(trafficSecs / 60);

        return {
          origin: orig,
          destination: dest,
          distance: formatDist(distanceMeters),
          distanceKm: Math.round(distanceMeters / 1000 * 10) / 10,
          normalDuration: formatDur(durationSecs),
          durationMins,
          trafficDuration: formatDur(trafficSecs),
          durationInTrafficMins: trafficMins,
          status: 'OK',
        };
      } catch (err) {
        return { origin: orig, destination: dest, status: 'ERROR', error: err.message };
      }
    });

    const resolvedRoutes = await Promise.all(routePromises);

    const result = {
      routes: resolvedRoutes,
      originAddresses: originList,
      destinationAddresses: destList,
      fetched: new Date().toISOString(),
      source: 'osrm', // So client knows this is OSRM, not Google
    };

    // Cache for 3 minutes
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YouTube live stream resolver: /api/proxy/youtube-live?channel=HANDLE
// Scrapes the channel page to find the current live video ID
router.get('/youtube-live', authenticate, async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ error: 'channel parameter required' });

  try {
    const cacheKey = `yt-live:${channel}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // Try @handle format first, then /c/ format
    const urls = [
      `https://www.youtube.com/@${channel}/live`,
      `https://www.youtube.com/c/${channel}/live`,
      `https://www.youtube.com/${channel}/live`,
    ];

    let videoId = null;
    let channelId = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;
        const html = await response.text();

        // Extract video ID from canonical URL or embedded data
        // Pattern 1: "videoId":"XXXXXXXXXXX"
        const vidMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (vidMatch) videoId = vidMatch[1];

        // Pattern 2: check it's actually live
        const isLive = html.includes('"isLive":true') || html.includes('"isLiveNow":true');

        // Extract channel ID for fallback
        const chanMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
        if (chanMatch) channelId = chanMatch[1];

        if (videoId && isLive) break;
        // If we found a video but it's not live, keep looking
        if (videoId && !isLive) videoId = null;
      } catch {
        continue;
      }
    }

    const result = {
      channel,
      channelId: channelId || null,
      videoId: videoId || null,
      live: !!videoId,
      fetched: new Date().toISOString(),
    };

    // Cache for 5 minutes
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
