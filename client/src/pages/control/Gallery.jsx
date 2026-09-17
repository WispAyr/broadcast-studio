import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';

// Broadcast Studio — Gallery (P0)
// Supervises the pu2 engine over the /api/channel proxy: PGM/PVW, live rotation,
// AUTO▮MAN (take a show / clear override), and stream health.
// Colour law: on-air = rose, cued = sky, autopilot-healthy = emerald, stale = amber.

const POLL_MS = 3000;

function useClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function fmtElapsed(sinceSec) {
  if (!sinceSec) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - sinceSec));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function energyMeta(e) {
  if (e == null) return { label: '', cls: 'text-neutral-400 border-neutral-700' };
  if (e <= 0.35) return { label: 'CHILL', cls: 'text-emerald-300 border-emerald-700 bg-emerald-950/30' };
  if (e < 0.75) return { label: 'MID', cls: 'text-sky-300 border-sky-700 bg-sky-950/30' };
  return { label: 'ENERGETIC', cls: 'text-rose-300 border-rose-700 bg-rose-950/30' };
}

function Stat({ label, value, tone }) {
  const toneCls = tone === 'good' ? 'text-emerald-400'
    : tone === 'bad' ? 'text-rose-400'
    : tone === 'warn' ? 'text-amber-400' : 'text-neutral-200';
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">{label}</span>
      <span className={`text-sm font-mono font-semibold ${toneCls}`}>{value}</span>
    </div>
  );
}

export default function Gallery() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');
  const [music, setMusic] = useState(null);
  const [vibeLocal, setVibeLocal] = useState(null);
  const vibeTimer = useRef(null);
  const [pgmShot, setPgmShot] = useState(null);
  const pgmScene = useRef(null);
  const [yt, setYt] = useState(null);
  const [titleDraft, setTitleDraft] = useState(null);
  const [chatOn, setChatOn] = useState(false);
  const [chat, setChat] = useState([]);
  const chatTok = useRef(null);
  const [armStop, setArmStop] = useState(false);
  const armTimer = useRef(null);
  const [upcoming, setUpcoming] = useState([]);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedWhen, setSchedWhen] = useState('');
  const [, force] = useState(0);
  const clock = useClock();
  const mounted = useRef(true);
  // optimistic: after clicking clear we suppress the override locally until the
  // next poll confirms, so the director-side stale `src` never flashes MANUAL.
  const suppressUntil = useRef(0);

  const poll = useCallback(() => {
    Promise.all([
      api.get('/channel/status'),
      api.get('/channel/config').catch(() => null),
      api.get('/channel/music').catch(() => null),
      api.get('/channel/youtube').catch(() => null),
    ]).then(([st, cfg, mus, y]) => {
      if (!mounted.current) return;
      setStatus(st); if (cfg) setConfig(cfg); if (mus) setMusic(mus); if (y) setYt(y); setErr(null);
    }).catch((e) => { if (mounted.current) setErr(e.message || 'engine unreachable'); });
  }, []);

  useEffect(() => {
    mounted.current = true;
    poll();
    const id = setInterval(poll, POLL_MS);
    const tick = setInterval(() => force((n) => n + 1), 1000);
    return () => { mounted.current = false; clearInterval(id); clearInterval(tick); };
  }, [poll]);

  // live PGM frame — screenshot the current program scene every 5s
  useEffect(() => {
    let alive = true;
    const grab = () => {
      const sc = pgmScene.current;
      if (!sc) return;
      api.get('/channel/screenshot?source=' + encodeURIComponent(sc))
        .then((r) => { if (alive && r && r.image) setPgmShot({ scene: sc, img: r.image }); })
        .catch(() => {});
    };
    grab();
    const id = setInterval(grab, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // upcoming scheduled broadcasts — on mount only (quota; re-fetched after mutations)
  // inline (not loadUpcoming) so this effect doesn't reference a const defined lower = TDZ crash
  useEffect(() => { api.get('/channel/youtube/upcoming').then((r) => setUpcoming(r.items || [])).catch(() => {}); }, []);

  // live chat — polls ONLY while toggled on (quota-metered); floor 12s
  useEffect(() => {
    if (!chatOn) { setChat([]); chatTok.current = null; return; }
    let alive = true, timer = null;
    const tick = () => {
      api.get('/channel/youtube/chat' + (chatTok.current ? '?pageToken=' + encodeURIComponent(chatTok.current) : ''))
        .then((r) => {
          if (!alive) return;
          if (r.messages && r.messages.length) setChat((c) => {
            const seen = new Set(c.map((m) => m.id));
            return [...c, ...r.messages.filter((m) => !seen.has(m.id))].slice(-80);
          });
          if (r.nextPageToken) chatTok.current = r.nextPageToken;
          timer = setTimeout(tick, Math.max(Number(r.pollMs) || 12000, 12000));
        })
        .catch(() => { if (alive) timer = setTimeout(tick, 15000); });
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [chatOn]);

  const obs = status?.obs || {};
  const show = status?.show || {};
  const shows = Array.isArray(config?.shows) ? config.shows : [];
  const rawOverride = config?.schedule?.override || null;
  const overrideActive = !!(rawOverride && Number(rawOverride.until) * 1000 > Date.now())
    && Date.now() > suppressUntil.current;
  const override = overrideActive ? rawOverride : null;
  const onAuto = !overrideActive;
  const sceneOverride = config?.scene_override || null;
  const sceneHeld = !!(sceneOverride && Number(sceneOverride.until) * 1000 > Date.now());
  const heldScene = sceneHeld ? sceneOverride.scene : null;
  const pgm = obs.current_scene || '—';
  const pvw = obs.next_scene || '—';
  pgmScene.current = obs.current_scene || null;
  const rotation = Array.isArray(show.rotation) ? show.rotation : [];
  const streaming = !!obs.streaming;
  const kbps = obs.kbps != null ? Math.round(obs.kbps) : null;
  const congestion = obs.congestion;

  async function takeShow(id) {
    setBusy(id);
    suppressUntil.current = 0;
    try { await api.post('/channel/take', { show: id, minutes: 60 }); await poll(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function clearOverride() {
    setBusy('clear');
    suppressUntil.current = Date.now() + 4000; // avoid a pre-clear poll flashing MANUAL
    try { await api.post('/channel/clear', {}); await poll(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }

  // --- music DJ controls ---
  const vibeShown = vibeLocal != null ? vibeLocal : (music?.vibe != null ? music.vibe : 25);
  function onVibe(v) {
    setVibeLocal(v);
    if (vibeTimer.current) clearTimeout(vibeTimer.current);
    vibeTimer.current = setTimeout(async () => {
      try { await api.post('/channel/music/vibe', { value: v }); await poll(); }
      catch (e) { setErr(e.message); }
      finally { setVibeLocal(null); }
    }, 350);
  }
  async function skipTrack() {
    setBusy('skip-track');
    try { await api.post('/channel/music/skip', {}); setTimeout(poll, 1600); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }

  // --- scene deck (vision mixer) ---
  async function takeScene(name) {
    setBusy('take-' + name);
    try { await api.post('/channel/scene/take', { scene: name }); setTimeout(poll, 1200); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function releaseScene() {
    setBusy('release');
    try { await api.post('/channel/scene/clear', {}); setTimeout(poll, 1200); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }

  // --- YouTube Tier-2 (title + auto) ---
  const ytTitle = status?.youtube?.title || '';
  const ytLive = !!status?.youtube?.live;
  const ytAutoOn = !!yt?.auto;
  const titleShown = titleDraft != null ? titleDraft : ytTitle;
  async function pushTitle() {
    if (!titleShown.trim()) return;
    setBusy('yt-title');
    try { await api.post('/channel/youtube/title', { title: titleShown }); setTitleDraft(null); setTimeout(poll, 1500); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function toggleAuto() {
    setBusy('yt-auto');
    try { const r = await api.post('/channel/youtube/auto', { enabled: !ytAutoOn }); setYt((y) => ({ ...(y || {}), auto: r.auto })); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function setThumb() {
    setBusy('yt-thumb');
    try { await api.post('/channel/youtube/thumbnail', {}); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  // --- stream on/off (guarded) ---
  async function goLive() {
    setBusy('go-live');
    try { await api.post('/channel/stream/start', {}); setTimeout(poll, 2500); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  // --- chat moderation ---
  async function deleteMsg(id) {
    try { await api.post('/channel/youtube/chat/delete', { id }); setChat((c) => c.filter((m) => m.id !== id)); }
    catch (e) { setErr(e.message); }
  }
  // --- scheduled premieres ---
  const loadUpcoming = useCallback(() => {
    api.get('/channel/youtube/upcoming').then((r) => setUpcoming(r.items || [])).catch(() => {});
  }, []);
  async function schedule() {
    if (!schedTitle.trim() || !schedWhen) return;
    setBusy('sched');
    try { await api.post('/channel/youtube/schedule', { title: schedTitle, startTime: new Date(schedWhen).toISOString(), privacy: 'public' }); setSchedTitle(''); setSchedWhen(''); loadUpcoming(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function delSched(id) {
    try { await api.post('/channel/youtube/schedule/delete', { id }); loadUpcoming(); }
    catch (e) { setErr(e.message); }
  }
  function stopStream() {
    if (!armStop) {
      setArmStop(true);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmStop(false), 4000);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmStop(false); setBusy('stop');
    api.post('/channel/stream/stop', {})
      .then(() => setTimeout(poll, 2500))
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(''));
  }

  const healthTone = !obs.connected ? 'bad' : streaming ? 'good' : 'warn';

  return (
    <div className="p-6 text-neutral-100 min-h-full bg-neutral-950">
      {/* identity — this is the STORM -> YOUTUBE channel, distinct from clip Playout */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-lg font-bold text-white">Channel</h1>
        <span className="text-xs text-neutral-400">Storm &rarr; YouTube — shows, scenes, stream &amp; metadata</span>
        <div className="flex-1" />
        <Link to="/control/playout" className="text-xs font-mono text-neutral-400 hover:text-sky-300 border border-neutral-800 rounded px-2 py-1 transition-colors">Clip playout &rsaquo;</Link>
      </div>
      {/* status bar */}
      <div className="flex items-center gap-6 flex-wrap border border-neutral-800 rounded-xl bg-neutral-900/60 px-5 py-3 mb-5">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${streaming ? 'bg-red-500 shadow-[0_0_10px] shadow-red-500 animate-pulse' : 'bg-neutral-600'}`} />
          <span className="font-mono text-sm font-bold tracking-wider">{streaming ? 'STREAM LIVE' : 'STREAM OFF'}</span>
        </div>
        {streaming ? (
          <button onClick={stopStream} disabled={busy === 'stop'}
            className={`px-3 py-1 rounded font-mono text-[11px] font-bold border transition ${
              armStop ? 'border-red-500 bg-red-600 text-white animate-pulse'
              : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-red-600 hover:text-red-300'}`}>
            {busy === 'stop' ? 'stopping…' : armStop ? 'CONFIRM STOP ✕' : 'STOP STREAM'}
          </button>
        ) : (
          <button onClick={goLive} disabled={busy === 'go-live'}
            className="px-3 py-1 rounded font-mono text-[11px] font-bold border border-red-600 bg-red-950/40 text-red-200 hover:bg-red-900/50 transition">
            {busy === 'go-live' ? 'going live…' : '● GO LIVE'}
          </button>
        )}
        <Stat label="Show" value={show.name || '—'} />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">Driver</span>
          <span className={`text-sm font-mono font-bold ${onAuto ? 'text-emerald-400' : 'text-amber-400'}`}>
            {onAuto ? 'AUTO' : 'MANUAL'}
          </span>
        </div>
        <Stat label="Bitrate" value={kbps != null ? `${kbps} kbps` : '—'} tone={healthTone} />
        <Stat label="OBS" value={obs.obs_version || (obs.connected ? 'connected' : 'down')} tone={obs.connected ? 'good' : 'bad'} />
        {status?.youtube?.live && (
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">YouTube</span>
            <span className="text-sm font-mono font-semibold text-rose-400">
              ● {status.youtube.concurrent != null ? Number(status.youtube.concurrent).toLocaleString() : '—'}
              <span className="text-neutral-500 font-normal"> watching</span>
            </span>
          </div>
        )}
        <div className="ml-auto font-mono text-lg font-bold tabular-nums">{clock}</div>
      </div>

      {err && (
        <div className="mb-4 border border-rose-800 bg-rose-950/40 text-rose-300 rounded-lg px-4 py-2 font-mono text-sm">
          engine: {err}
        </div>
      )}

      {/* PGM / PVW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl border-2 border-red-600/70 bg-neutral-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-red-950/40">
            <span className="font-mono text-xs font-bold tracking-widest text-rose-400">● PROGRAM</span>
            <span className="font-mono text-xs text-neutral-400">on YouTube{show.on_air_since ? ` · ${fmtElapsed(show.on_air_since)}` : ''}</span>
          </div>
          <div className="aspect-video bg-black relative flex items-center justify-center">
            {pgmShot?.img
              ? <img src={pgmShot.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : <span className="text-3xl font-black tracking-tight text-neutral-100">{pgm}</span>}
            {pgmShot?.img && (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-black/60 font-mono text-xs font-bold tracking-wide text-neutral-100">{pgm}</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border-2 border-sky-500/60 bg-neutral-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-sky-950/30">
            <span className="font-mono text-xs font-bold tracking-widest text-sky-400">PREVIEW</span>
            <span className="font-mono text-xs text-neutral-400">cued next</span>
          </div>
          <div className="aspect-video flex items-center justify-center bg-black">
            <span className="text-3xl font-black tracking-tight text-neutral-300">{pvw}</span>
          </div>
        </div>
      </div>

      {/* scene deck — click any scene to TAKE it on air */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2 gap-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">Scene deck · click to take · {show.name || ''}</span>
          {sceneHeld && (
            <button onClick={releaseScene} disabled={busy === 'release'}
              className="px-3 py-1 rounded-lg font-mono text-[11px] font-bold border border-amber-600 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 transition whitespace-nowrap">
              {busy === 'release' ? 'releasing…' : `◉ HELD · ${heldScene} — RELEASE ▸`}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {rotation.length === 0 && <span className="text-neutral-600 font-mono text-sm">—</span>}
          {rotation.map((s, i) => (
            <button key={`${s}-${i}`} onClick={() => takeScene(s)} disabled={busy === 'take-' + s}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition ${
                s === pgm ? 'border-rose-600 bg-rose-950/40 text-rose-200'
                : s === pvw ? 'border-sky-600 bg-sky-950/30 text-sky-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-sky-600 hover:bg-neutral-800'}${
                s === heldScene ? ' ring-1 ring-amber-500' : ''}`}>
              {s === pgm ? '● ' : ''}{busy === 'take-' + s ? 'taking…' : s}
            </button>
          ))}
        </div>
      </div>

      {/* control: AUTO / take a show */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">Take a show</span>
          <button
            onClick={clearOverride}
            disabled={onAuto || busy === 'clear'}
            className={`px-4 py-2 rounded-lg font-mono text-xs font-bold border transition ${
              onAuto ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-500/60 cursor-default'
              : 'border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'}`}>
            {onAuto ? '● AUTO (schedule)' : busy === 'clear' ? 'clearing…' : 'RETURN TO AUTO ▸'}
          </button>
        </div>
        {!onAuto && override && (
          <div className="mb-3 font-mono text-xs text-amber-400">
            MANUAL — pinned “{shows.find((s) => s.id === override.show)?.name || override.show}”
            {override.until ? ` until ${new Date(override.until * 1000).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5)}` : ''}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {shows.map((sh) => {
            const active = sh.id === show.id;
            return (
              <button key={sh.id}
                onClick={() => takeShow(sh.id)}
                disabled={busy === sh.id}
                className={`text-left px-3 py-2.5 rounded-lg border font-mono transition ${
                  active ? 'border-rose-600 bg-rose-950/30' : 'border-neutral-800 bg-neutral-900 hover:border-sky-600 hover:bg-neutral-800'}`}>
                <div className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                  {sh.name}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {busy === sh.id ? 'taking…' : `${(sh.scenes || []).length} scenes`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* music DJ — dynamic bed */}
      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Music · DJ{music?.count ? ` · ${music.count} tracks` : ''}
          </span>
          <button onClick={skipTrack} disabled={busy === 'skip-track'}
            className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-sky-600 hover:bg-neutral-800 transition">
            {busy === 'skip-track' ? 'skipping…' : 'SKIP ▸'}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-100 truncate">{music?.now?.title || '—'}</div>
            <div className="text-[11px] text-neutral-500 font-mono truncate">next · {music?.next?.title || '—'}</div>
          </div>
          {music?.now && (() => { const m = energyMeta(music.now.energy); return (
            <span className={`ml-auto shrink-0 px-2 py-1 rounded font-mono text-[10px] font-bold border ${m.cls}`}>{m.label}</span>
          ); })()}
        </div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-mono mb-1">
          <span className="text-emerald-400">◄ Laid-back</span>
          <span className="text-neutral-400">Vibe {Math.round(vibeShown)}</span>
          <span className="text-rose-400">Energetic ►</span>
        </div>
        <input type="range" min="0" max="100" value={vibeShown}
          onChange={(e) => onVibe(Number(e.target.value))}
          className="w-full accent-sky-500 cursor-pointer" />
        <div className="flex gap-2 mt-3">
          {[['Laid-back', 20], ['Balanced', 50], ['Energetic', 85]].map(([lbl, v]) => (
            <button key={v} onClick={() => onVibe(v)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition ${
                Math.abs(vibeShown - v) < 8 ? 'border-sky-600 bg-sky-950/30 text-sky-200'
                : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-sky-600 hover:bg-neutral-800'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* YouTube — Tier-2 live title + auto-title */}
      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            YouTube{ytLive ? ' · ● live' : (yt && !yt.hasCreds ? ' · not connected' : '')}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={setThumb} disabled={busy === 'yt-thumb' || !yt?.hasCreds}
              className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-sky-600 hover:bg-neutral-800 transition disabled:opacity-40">
              {busy === 'yt-thumb' ? 'setting…' : 'SET THUMB ▸'}
            </button>
            <button onClick={toggleAuto} disabled={busy === 'yt-auto' || !yt?.hasCreds}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition disabled:opacity-40 ${
                ytAutoOn ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300' : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-sky-600'}`}>
              {busy === 'yt-auto' ? '…' : ytAutoOn ? '◉ AUTO-TITLE ON' : 'AUTO-TITLE OFF'}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={titleShown} onChange={(e) => setTitleDraft(e.target.value)} disabled={ytAutoOn || !yt?.hasCreds}
            placeholder={yt?.hasCreds ? 'live video title…' : 'connect YouTube to edit'}
            className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 focus:border-sky-600 outline-none disabled:opacity-50" />
          <button onClick={pushTitle} disabled={busy === 'yt-title' || ytAutoOn || !yt?.hasCreds || titleShown === ytTitle}
            className="px-4 py-2 rounded-lg font-mono text-xs font-bold border border-rose-600 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50 transition disabled:opacity-40 disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-500">
            {busy === 'yt-title' ? 'pushing…' : 'PUSH TITLE ▸'}
          </button>
        </div>
        <div className="mt-2 text-[11px] font-mono text-neutral-500 truncate">
          {ytAutoOn ? 'Auto-titling from the active show — manual edit disabled.' : 'On air: ' + (ytTitle || '—')}
        </div>
      </div>

      {/* Live chat — on demand (quota-metered) */}
      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">Live chat{chatOn ? ' · ● watching' : ''}</span>
          <button onClick={() => setChatOn((v) => !v)} disabled={!yt?.hasCreds}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition disabled:opacity-40 ${
              chatOn ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300' : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-sky-600'}`}>
            {chatOn ? '◉ LIVE' : 'SHOW CHAT'}
          </button>
        </div>
        {chatOn ? (
          <div className="max-h-56 overflow-y-auto space-y-1.5 font-mono text-sm pr-1">
            {chat.length === 0 && <div className="text-neutral-600 text-xs">no messages yet…</div>}
            {chat.map((m) => (
              <div key={m.id} className="group flex gap-2 items-start">
                <span className={`shrink-0 ${m.owner ? 'text-amber-400' : m.mod ? 'text-sky-400' : 'text-neutral-400'}`}>{m.author}:</span>
                <span className="text-neutral-200 break-words flex-1">{m.text}</span>
                <button onClick={() => deleteMsg(m.id)} title="delete message"
                  className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-400 text-xs shrink-0 transition">✕</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-neutral-500">Off — chat polling uses quota, so it only runs while you're watching.</div>
        )}
      </div>

      {/* Scheduled premieres — upcoming broadcasts */}
      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-3">Scheduled · upcoming broadcasts</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          <input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} placeholder="event title…"
            className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 focus:border-sky-600 outline-none" />
          <input type="datetime-local" value={schedWhen} onChange={(e) => setSchedWhen(e.target.value)}
            className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm font-mono text-neutral-100 focus:border-sky-600 outline-none" />
          <button onClick={schedule} disabled={busy === 'sched' || !schedTitle.trim() || !schedWhen || !yt?.hasCreds}
            className="px-4 py-2 rounded-lg font-mono text-xs font-bold border border-sky-600 bg-sky-950/40 text-sky-200 hover:bg-sky-900/50 transition disabled:opacity-40 disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-500">
            {busy === 'sched' ? 'scheduling…' : 'SCHEDULE ▸'}
          </button>
        </div>
        <div className="space-y-1.5">
          {upcoming.length === 0 && <div className="text-neutral-600 font-mono text-xs">no upcoming broadcasts</div>}
          {upcoming.map((b) => (
            <div key={b.id} className="group flex items-center gap-3 text-sm">
              <span className="font-mono text-[11px] text-sky-300 shrink-0 w-28">{new Date(b.startTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-neutral-200 truncate flex-1">{b.title}</span>
              <span className="font-mono text-[10px] text-neutral-500 shrink-0">{b.privacy}</span>
              <button onClick={() => delSched(b.id)} title="delete scheduled broadcast"
                className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-400 text-xs shrink-0 transition">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
