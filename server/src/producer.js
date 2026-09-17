// server/src/producer.js — the Virtual Producer.
// Reads the live channel signals every ~45s and publishes a ranked, DATA-GROUNDED
// editorial rundown (ordered scenes + headline + why + source value + breaking flag).
// Deterministic ranking (no LLM); every headline number is a passthrough of a real feed
// value — no fabrication. The director stays the executor; operators supervise via the page.
const AGENT = process.env.PU2_AGENT_URL || 'http://127.0.0.1:3866';
const W = 'https://weather.ayrshire.wispayr.online';

async function j(url, ms = 6000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}

function auroraRank(a) { if (!a) return 0; const s = String(a.status || '').toLowerCase();
  if (s === 'red') return 2; if (s === 'amber' || s === 'orange') return 1; if (a.visible_scotland) return 1; return 0; }
function metRank(m) { // storm.wispayr met warnings or weather.ayrshire/api/warnings
  const ws = (m && (m.warnings || [])) || []; let r = 0;
  for (const w of ws) { const lv = String((w && (w.level || w.severity)) || '').toLowerCase();
    r = Math.max(r, lv === 'red' ? 3 : (lv === 'amber' || lv === 'orange') ? 2 : lv === 'yellow' ? 1 : 0); } return r; }

const DESC = {
  'EGPK-Summary': "Today's movements at Glasgow Prestwick", 'EGPK-Ramp': "On the ground at Prestwick — the apron",
  'EGPK-Daily': "The day's traffic through Prestwick", 'EGPK-Radar': 'The approach picture at Prestwick',
  'EGPK-LiveTV': 'Live over Glasgow Prestwick', 'On-Final': 'Watching the approach at Prestwick',
  'UK-Mil': 'The UK military air picture', 'Wind-Atlas': 'Live winds over Britain, from passing aircraft',
  'Tides': 'Tides & marine along the Ayrshire coast', 'AIS': 'Live shipping in the Firth of Clyde',
  'Wildfire': 'Wildfire watch across the west', 'Aurora': 'Space weather & the aurora outlook',
  'Coastguard': 'Search & rescue watch over the Clyde', 'Weather': 'Your Ayrshire weather',
  'Roads': 'Roads & travel across Ayrshire', 'Storm': 'Storm watch across the west of Scotland',
  'Explainer': 'How WispAyr works', 'Met-Warnings': 'Met Office weather warnings',
  'Sky-Tonight': 'The night sky over Ayrshire', 'Rail': 'Ayrshire trains — live departures',
  'On-This-Day': 'On this day through history', 'Fuel-Watch': 'Cheapest fuel across Ayrshire',
  'Ayr-News': 'The Ayrshire news desk — live headlines',
};

// score a scene from the live signals. Returns {score, headline, why, breaking, tone}
function assess(scene, s) {
  const st = (s.tv && s.tv.stats) || {};
  const wc = (s.warn && s.warn.counts) || {};
  const inbound = Math.max(Number(st.inboundCount) || 0, Number(s.appr) || 0);
  const lightning = Number(wc.lightning) || 0, shelter = Number(wc.take_shelter) || 0;
  const mil = !!st.militaryInZone, aur = auroraRank(s.aur), met = metRank(s.met);
  const cgAir = ((s.cg && s.cg.aircraft) || []).length || 0;
  const launches = ((s.cg && s.cg.launches) || []).length || 0;
  const base = { headline: DESC[scene] || scene, why: 'in rotation', breaking: false, tone: '', score: 20 };

  switch (scene) {
    case 'On-Final': case 'EGPK-Radar': case 'EGPK-LiveTV':
      if (inbound > 0) return { score: 72 + inbound * 6, breaking: false, tone: 'hot',
        headline: `${inbound} aircraft on approach to Glasgow Prestwick`, why: `${inbound} inbound (egpk feed)` };
      return { ...base, score: 22 };
    case 'UK-Mil':
      if (mil) return { score: 86, breaking: false, tone: 'mil', headline: 'Military aircraft transiting the Prestwick zone', why: 'military in zone (egpk feed)' };
      return { ...base, score: 26 };
    case 'Storm':
      if (shelter > 0) return { score: 100, breaking: true, tone: 'crit', headline: `Take-shelter lightning — ${shelter} strikes close by`, why: `${shelter} take-shelter (storm feed)` };
      if (lightning > 0) return { score: 74, breaking: false, tone: 'hot', headline: `${lightning} lightning strikes across the west`, why: `${lightning} strikes (storm feed)` };
      return { ...base, score: 16, headline: 'Storm watch — quiet for now', why: 'no lightning' };
    case 'Met-Warnings':
      if (met >= 3) return { score: 98, breaking: true, tone: 'crit', headline: 'RED Met Office weather warning in force', why: 'red met warning' };
      if (met >= 2) return { score: 82, breaking: false, tone: 'hot', headline: 'Amber Met Office weather warning in force', why: 'amber met warning' };
      if (met >= 1) return { score: 55, breaking: false, tone: 'warn', headline: 'Yellow Met Office weather warning active', why: 'yellow met warning' };
      return { score: 6, headline: 'No active weather warnings', why: 'none', breaking: false, tone: '' };
    case 'Coastguard':
      if (cgAir > 0) return { score: 80, breaking: false, tone: 'hot', headline: `${cgAir} SAR aircraft airborne over the Clyde`, why: `${cgAir} SAR airborne (adsb)` };
      if (launches > 0) return { score: 60, breaking: false, tone: 'warn', headline: `${launches} RNLI lifeboat launch today`, why: `${launches} launches (rnli)` };
      return { ...base, score: 24 };
    case 'Aurora': case 'Sky-Tonight':
      if (aur >= 2) return { score: 90, breaking: false, tone: 'hot', headline: 'Aurora likely tonight — strong space-weather activity', why: 'aurora red' };
      if (aur >= 1) return { score: 64, breaking: false, tone: 'warn', headline: 'Aurora watch elevated — keep an eye to the north', why: 'aurora amber/visible' };
      return { ...base, score: scene === 'Sky-Tonight' ? 30 : 20 };
    case 'Wildfire':
      if (s.fire && s.fire.count > 0) return { score: 70, breaking: false, tone: 'hot', headline: `${s.fire.count} wildfire hotspots detected in the region`, why: `${s.fire.count} FIRMS hotspots` };
      return { ...base, score: 14 };
    case 'Rail':
      if (s.rail && s.rail.disrupted) return { score: 58, breaking: false, tone: 'warn', headline: `${s.rail.disrupted} trains delayed or cancelled`, why: `${s.rail.disrupted} disrupted (scotrail)` };
      return { ...base, score: 28 };
    case 'Ayr-News': return { ...base, score: 34, why: 'news desk' };
    case 'Fuel-Watch': return { ...base, score: 30, why: 'daytime service' };
    case 'Explainer': return { ...base, score: 5, why: 'evergreen filler' };
    case 'On-This-Day': case 'Sky-Tonight2': return { ...base, score: 26, why: 'evergreen' };
    default: return base;
  }
}

async function build() {
  const status = await j(AGENT + '/api/status');
  if (!status) return { ok: false, error: 'engine unreachable' };
  const show = status.show || {}, obs = status.obs || {};
  const rotation = Array.isArray(show.rotation) && show.rotation.length ? show.rotation : [];
  const [tv, warn, aur, cg, met, adsb, fire, rail] = await Promise.all([
    j('https://egpk.info/api/tv/state'), j('https://storm.wispayr.online/api/storm/warnings'),
    j(W + '/api/aurora'), j(W + '/api/seg/coastguard'), j(W + '/api/warnings'),
    j(W + '/api/egpk/adsb'), j(W + '/api/arcus/firms/status'), j('https://trains.wispayr.online/api/all'),
  ]);
  // derive approach count from adsb (low+close+toward) — reuse a light version
  let appr = 0; try {
    for (const a of (adsb && adsb.aircraft) || []) {
      const alt = a.alt_baro, gs = a.gs || 0; if (typeof alt !== 'number' || alt >= 4000 || gs < 40 || a.isOnGround) continue;
      const dLat = (a.lat - 55.5094), dLon = (a.lon - -4.5867); const km = Math.sqrt(dLat * dLat + (dLon * 0.567) * (dLon * 0.567)) * 111;
      if (km < 15) appr++;
    }
  } catch { /* ignore */ }
  let railDis = 0; try { const all = ((rail && rail.northbound && rail.northbound.departures) || []).concat((rail && rail.southbound && rail.southbound.departures) || []);
    railDis = all.filter((x) => x.cancelled || (x.delay_mins || 0) > 0).length; } catch { /* */ }
  const fireCount = (fire && (fire.count || (fire.hotspots && fire.hotspots.length))) || 0;
  const sig = { tv, warn, aur, cg, met, appr, fire: { count: fireCount }, rail: { disrupted: railDis } };

  const items = rotation.map((scene) => ({ scene, onair: scene === obs.current_scene, ...assess(scene, sig) }));
  items.sort((a, b) => (b.breaking - a.breaking) || (b.score - a.score));
  items.forEach((it, i) => { it.rank = i + 1; });
  return { ok: true, show: show.name || null, onair: obs.current_scene || null, tier: show.tier || null,
    updated: Date.now(), breaking: items.some((i) => i.breaking), items };
}

let _rundown = { ok: false, items: [] };
async function tick() { try { const r = await build(); if (r.ok) _rundown = r; } catch { /* keep last */ } }
function getRundown() { return _rundown; }
tick(); setInterval(tick, 45000);

module.exports = { getRundown, build };
