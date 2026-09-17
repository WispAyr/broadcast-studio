// server/src/youtube.js — YouTube Data API v3 (Tier-2) via stored OAuth refresh token.
// Reads youtube_oauth.json (root-only). Caches the access token. Never logs secrets.
const fs = require('fs');
const path = require('path');

const CRED_PATH = process.env.YT_OAUTH_PATH || path.join(__dirname, '..', '..', 'youtube_oauth.json');
let _cred = null, _access = null, _accessExp = 0;

function hasCreds() { try { return fs.existsSync(CRED_PATH); } catch { return false; } }
function cred() { if (!_cred) _cred = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8')); return _cred; }

async function accessToken() {
  if (_access && Date.now() < _accessExp - 60000) return _access;
  const c = cred();
  const body = new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token, grant_type: 'refresh_token' });
  const r = await fetch(c.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (!j.access_token) throw new Error('token refresh failed: ' + JSON.stringify(j).slice(0, 160));
  _access = j.access_token; _accessExp = Date.now() + (j.expires_in || 3600) * 1000;
  return _access;
}

async function api(p, { method = 'GET', body } = {}) {
  const tok = await accessToken();
  const r = await fetch('https://www.googleapis.com/youtube/v3/' + p, {
    method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('yt ' + r.status + ': ' + JSON.stringify(j.error || j).slice(0, 260));
  return j;
}

// The currently-active live broadcast (the on-air stream), or null.
async function activeBroadcast() {
  const j = await api('liveBroadcasts?part=snippet,status&broadcastStatus=active&broadcastType=all&maxResults=1');
  const b = (j.items || [])[0];
  if (!b) return null;
  return { id: b.id, title: b.snippet.title, description: b.snippet.description || '',
           scheduledStartTime: b.snippet.scheduledStartTime, status: b.status && b.status.lifeCycleStatus };
}

// Update the live title (and optionally description). liveBroadcasts.update requires
// title + scheduledStartTime in the snippet, so we preserve the existing ones.
async function setMeta({ title, description }) {
  const b = await activeBroadcast();
  if (!b) throw new Error('no active broadcast');
  const snippet = { title: title != null ? String(title).slice(0, 100) : b.title,
                    scheduledStartTime: b.scheduledStartTime || new Date(0).toISOString() };
  snippet.description = description != null ? String(description).slice(0, 5000) : b.description;
  await api('liveBroadcasts?part=snippet', { method: 'PUT', body: { id: b.id, snippet } });
  return { id: b.id, title: snippet.title };
}

// Set the live video's custom thumbnail from a JPEG buffer (thumbnails.set media upload).
async function setThumbnail(buf) {
  const b = await activeBroadcast();
  if (!b) throw new Error('no active broadcast');
  const tok = await accessToken();
  const r = await fetch('https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=' + b.id + '&uploadType=media', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'image/jpeg' }, body: buf,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('thumb ' + r.status + ': ' + JSON.stringify(j.error || j).slice(0, 220));
  return { id: b.id };
}

// Live-chat id of the active broadcast (null if chat disabled/absent).
async function liveChatId() {
  const j = await api('liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all&maxResults=1');
  const b = (j.items || [])[0];
  return b && b.snippet ? (b.snippet.liveChatId || null) : null;
}

// One page of live chat. Returns messages + nextPageToken + the interval YouTube wants us to wait.
async function listChat(chatId, pageToken) {
  const p = 'liveChat/messages?part=snippet,authorDetails&maxResults=50&liveChatId=' + encodeURIComponent(chatId) +
            (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
  const j = await api(p);
  const messages = (j.items || []).map((m) => ({
    id: m.id,
    author: m.authorDetails && m.authorDetails.displayName,
    text: m.snippet && m.snippet.displayMessage,
    ts: m.snippet && m.snippet.publishedAt,
    owner: !!(m.authorDetails && m.authorDetails.isChatOwner),
    mod: !!(m.authorDetails && m.authorDetails.isChatModerator),
  }));
  return { messages, nextPageToken: j.nextPageToken, pollMs: Number(j.pollingIntervalMillis) || 8000 };
}

// Delete a live-chat message (moderation). Requires owner/mod on the channel.
async function deleteChatMessage(id) {
  const tok = await accessToken();
  const r = await fetch('https://www.googleapis.com/youtube/v3/liveChat/messages?id=' + encodeURIComponent(id), {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + tok },
  });
  if (!r.ok && r.status !== 204) {
    const j = await r.json().catch(() => ({}));
    throw new Error('del ' + r.status + ': ' + JSON.stringify(j.error || j).slice(0, 160));
  }
  return { ok: true };
}

// Create a scheduled (upcoming) broadcast — a promotable event with a countdown.
async function scheduleBroadcast({ title, startTime, description, privacy }) {
  const body = {
    snippet: { title: String(title).slice(0, 100), scheduledStartTime: startTime,
               description: description ? String(description).slice(0, 5000) : undefined },
    status: { privacyStatus: privacy || 'public', selfDeclaredMadeForKids: false },
    contentDetails: { enableAutoStart: false, enableAutoStop: false, latencyPreference: 'normal' },
  };
  const j = await api('liveBroadcasts?part=snippet,status,contentDetails', { method: 'POST', body });
  return { id: j.id, title: j.snippet && j.snippet.title, startTime: j.snippet && j.snippet.scheduledStartTime };
}

// List upcoming scheduled broadcasts.
async function upcomingBroadcasts() {
  const j = await api('liveBroadcasts?part=snippet,status&broadcastStatus=upcoming&broadcastType=all&maxResults=10');
  return (j.items || []).map((b) => ({ id: b.id, title: b.snippet.title,
    startTime: b.snippet.scheduledStartTime, privacy: b.status && b.status.privacyStatus }));
}
async function deleteBroadcast(id) {
  const tok = await accessToken();
  const r = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?id=' + encodeURIComponent(id), {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
  if (!r.ok && r.status !== 204) { const j = await r.json().catch(() => ({})); throw new Error('del ' + r.status + ': ' + JSON.stringify(j.error || j).slice(0, 160)); }
  return { ok: true };
}

module.exports = { hasCreds, accessToken, api, activeBroadcast, setMeta, setThumbnail, liveChatId, listChat,
  deleteChatMessage, scheduleBroadcast, upcomingBroadcasts, deleteBroadcast };
