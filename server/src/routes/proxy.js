const express = require('express');
const router = express.Router();

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
router.get('/rss', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

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
router.get('/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

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
router.get('/weather', async (req, res) => {
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
// Uses Google Maps Distance Matrix API with traffic data
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCCQAf6y0__kbossG2vTCp4eClYfIpEvKA';

router.get('/travel-times', async (req, res) => {
  const { origins, destinations } = req.query;
  if (!origins || !destinations) {
    return res.status(400).json({ error: 'origins and destinations parameters required' });
  }

  try {
    const cacheKey = `travel-times:${origins}|${destinations}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', origins);
    url.searchParams.set('destinations', destinations);
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('traffic_model', 'best_guess');
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Google API returned ${response.status}` });
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(502).json({ error: data.error_message || data.status });
    }

    // Parse into a clean format — one route per origin/destination pair
    const originAddrs = data.origin_addresses || [];
    const destAddrs = data.destination_addresses || [];
    const routes = [];

    // Each origin maps to its corresponding destination (1:1)
    for (let i = 0; i < originAddrs.length; i++) {
      const element = data.rows?.[i]?.elements?.[i];
      if (!element || element.status !== 'OK') {
        routes.push({
          origin: originAddrs[i],
          destination: destAddrs[i] || '',
          status: element?.status || 'NOT_FOUND',
        });
        continue;
      }

      const durationSecs = element.duration?.value || 0;
      const trafficSecs = element.duration_in_traffic?.value || durationSecs;
      const distanceMeters = element.distance?.value || 0;

      routes.push({
        origin: originAddrs[i],
        destination: destAddrs[i],
        distance: element.distance?.text || '',
        distanceKm: Math.round(distanceMeters / 1000 * 10) / 10,
        normalDuration: element.duration?.text || '',
        durationMins: Math.round(durationSecs / 60),
        trafficDuration: element.duration_in_traffic?.text || element.duration?.text || '',
        durationInTrafficMins: Math.round(trafficSecs / 60),
        status: 'OK',
      });
    }

    const result = {
      routes,
      originAddresses: originAddrs,
      destinationAddresses: destAddrs,
      fetched: new Date().toISOString(),
    };

    // Cache for 3 minutes (traffic data changes, but don't hammer the API)
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
