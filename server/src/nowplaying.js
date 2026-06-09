// ──────────────────────────────────────────────────────────────────────────
// Now-playing feed — broadcast.radio cloud API (the platform NAR streams on).
//
//   GET https://api.broadcast.radio/api/nowplaying/<stationId>?size=20
//   → { body: { now_playing: {title, artist, artworkUrl, startDate, mediaItemType},
//               schedule: [ {start_tza,end_tza, content:[{contentTypeId, display_title, href}]} ] } }
//
// No auth required, reachable from the cloud. This is richer than the ProRadio
// WordPress feed: live TRACK metadata + show titles that include the presenter
// ("Mid-Mornings with Liam Dolan"). NAR station id = 7719.
//
// We poll per station, cache the normalised result, and (optionally) push it to
// a studio's screens over socket so a `nar_nowplaying` module updates instantly.
// ──────────────────────────────────────────────────────────────────────────

const BR_API = 'https://api.broadcast.radio';

const cache = {};    // stationId -> normalised now-playing
const pollers = {};  // stationId -> interval handle

function absArtwork(url) {
  if (!url) return null;
  const abs = url.startsWith('http') ? url : BR_API + url;
  // The widget asks for 100px thumbs; bump to something crisp for a TV wall.
  return abs.replace(/w=100&h=100/, 'w=512&h=512');
}

function contentBySlug(entry, slug) {
  if (!entry || !Array.isArray(entry.content)) return null;
  return entry.content.find(c => c.contentType?.slug === slug || (slug === 'show' && c.contentTypeId === 8)) || null;
}

function pickShow(entry) {
  if (!entry) return null;
  const show = contentBySlug(entry, 'show') || (Array.isArray(entry.content) ? entry.content[0] : null);
  const presenter = contentBySlug(entry, 'presenter');
  if (!show && !presenter) return null;
  return {
    title: show?.display_title || null,
    presenter: presenter?.display_title || null,
    href: show?.href ? (show.href.startsWith('http') ? show.href : BR_API + show.href) : null,
    start: entry.start_tza || null,
    end: entry.end_tza || null,
  };
}

function normaliseTrack(t) {
  if (!t) return null;
  return {
    artist: t.artist || '',
    title: t.title || '',
    artwork: absArtwork(t.artworkUrl),
    startedAt: t.startDate || null,
    mediaItemId: t.mediaItemId ?? null,
  };
}

async function fetchNowPlaying(stationId) {
  const r = await fetch(`${BR_API}/api/nowplaying/${stationId}?size=20`, { timeout: 8000 });
  if (!r.ok) throw new Error(`broadcast.radio ${r.status}`);
  const d = await r.json();
  const np = d.body?.now_playing || {};
  const sched = Array.isArray(d.body?.schedule) ? d.body.schedule : [];
  const recent = Array.isArray(d.body?.recently_played) ? d.body.recently_played : [];
  const now = Date.now();

  let onAir = null, next = null;
  for (const s of sched) {
    if (s.current || (s.start_tza <= now && now < s.end_tza)) onAir = pickShow(s);
    else if (s.start_tza > now && !next) next = pickShow(s);
  }

  // `default:true` = a fallback/off-air placeholder, render as station ident.
  const offAir = !!np.default;
  // mediaItemType 7 = song. Anything with an artist we treat as music.
  const isMusic = !offAir && (np.mediaItemType === 7 || (!!np.artist && !!np.title));

  return {
    artist: np.artist || '',
    title: np.title || '',
    artwork: absArtwork(np.artworkUrl),
    startedAt: np.startDate || null,
    mediaItemType: np.mediaItemType ?? null,
    isMusic,
    offAir,
    onAir,
    next,
    history: recent.map(normaliseTrack).filter(t => t && t.title).slice(0, 5),
    stationId: Number(stationId),
    fetchedAt: new Date().toISOString(),
  };
}

function getCachedNowPlaying(stationId) {
  return cache[stationId] || null;
}

// Poll a station. If studioId+moduleId given, push live updates to that studio's
// screens via the same `update_module_config` channel modules already listen on.
function startNowPlayingPoll(stationId, { studioId, moduleId = 'now-playing', intervalMs = 15000 } = {}) {
  if (pollers[stationId]) return;
  const tick = async () => {
    try {
      const np = await fetchNowPlaying(stationId);
      const changed = JSON.stringify(cache[stationId]?.title) !== JSON.stringify(np.title)
        || cache[stationId]?.artist !== np.artist;
      cache[stationId] = np;
      if (studioId) {
        try {
          const { getIO } = require('./ws');
          getIO().to(`studio:${studioId}`).emit('update_module_config', { moduleId, config: { nowPlaying: np } });
        } catch {}
      }
      if (changed) console.log(`[nowplaying] ${stationId}: ${np.artist} — ${np.title}`);
    } catch (e) {
      // keep last good value on a blip
    }
  };
  tick();
  pollers[stationId] = setInterval(tick, intervalMs);
  console.log(`[nowplaying] polling station ${stationId} every ${intervalMs}ms`);
}

// Auto-start NAR (station 7719) once the studio exists.
function startNarNowPlaying() {
  try {
    const { db } = require('./db');
    const stationId = process.env.NAR_STATION_ID || '7719';
    const studio = db.prepare("SELECT id FROM studios WHERE slug = 'now-ayrshire'").get();
    startNowPlayingPoll(stationId, { studioId: studio?.id, moduleId: 'now-playing' });
  } catch (e) {
    console.warn('[nowplaying] NAR auto-start failed:', e.message);
  }
}

module.exports = { fetchNowPlaying, getCachedNowPlaying, startNowPlayingPoll, startNarNowPlaying };
