import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../../lib/api';
import { Link } from 'react-router-dom';

// BroadcastPanel — the storm → YouTube channel's own controls, folded INTO Playout.
//
// When the operator selects the OBS channel in Playout, this appears above the clip
// log: the stream lifecycle, what show/scene is on air, and the YouTube title — the
// things you manage about the channel itself, in the same place you play clips to it.
// One surface for one physical output.
//
// It talks to the SAME /api/channel/* endpoints as the standalone Channel page, and
// reproduces its armed-STOP logic byte-for-byte — the panic path must behave
// identically wherever it lives. The deep YouTube features (chat moderation, scheduled
// premieres, thumbnail) stay on the full Channel page, linked from here, so this panel
// stays a control surface and not a wall.
//
// Colour law: red = on air, sky = cued/next, emerald = autopilot-healthy, amber = warn.

const POLL_MS = 3000;

function Stat({ label, value, tone }) {
  const cls = tone === 'good' ? 'text-emerald-400'
    : tone === 'bad' ? 'text-red-400'
    : tone === 'warn' ? 'text-amber-400' : 'text-neutral-200';
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">{label}</span>
      <span className={`text-sm font-mono font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

export default function BroadcastPanel() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [yt, setYt] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');
  const [titleDraft, setTitleDraft] = useState(null);
  const [armStop, setArmStop] = useState(false);
  const armTimer = useRef(null);
  const mounted = useRef(true);
  const suppressUntil = useRef(0);

  const poll = useCallback(() => {
    Promise.all([
      api.get('/channel/status'),
      api.get('/channel/config').catch(() => null),
      api.get('/channel/youtube').catch(() => null),
    ]).then(([st, cfg, y]) => {
      if (!mounted.current) return;
      setStatus(st); if (cfg) setConfig(cfg); if (y) setYt(y); setErr(null);
    }).catch((e) => { if (mounted.current) setErr(e.message || 'engine unreachable'); });
  }, []);

  useEffect(() => {
    mounted.current = true;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { mounted.current = false; clearInterval(id); if (armTimer.current) clearTimeout(armTimer.current); };
  }, [poll]);

  const obs = status?.obs || {};
  const show = status?.show || {};
  const shows = Array.isArray(config?.shows) ? config.shows : [];
  const rawOverride = config?.schedule?.override || null;
  const overrideActive = !!(rawOverride && Number(rawOverride.until) * 1000 > Date.now())
    && Date.now() > suppressUntil.current;
  const onAuto = !overrideActive;
  const sceneOverride = config?.scene_override || null;
  const sceneHeld = !!(sceneOverride && Number(sceneOverride.until) * 1000 > Date.now());
  const heldScene = sceneHeld ? sceneOverride.scene : null;
  const pgm = obs.current_scene || '—';
  const rotation = Array.isArray(show.rotation) ? show.rotation : [];
  const streaming = !!obs.streaming;
  const kbps = obs.kbps != null ? Math.round(obs.kbps) : null;
  const viewers = status?.youtube?.concurrent;
  const ytTitle = status?.youtube?.title || '';
  const titleShown = titleDraft != null ? titleDraft : ytTitle;
  const healthTone = !obs.connected ? 'bad' : streaming ? 'good' : 'warn';

  async function takeShow(id) {
    setBusy(id); suppressUntil.current = 0;
    try { await api.post('/channel/take', { show: id, minutes: 60 }); await poll(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function clearOverride() {
    setBusy('clear'); suppressUntil.current = Date.now() + 4000;
    try { await api.post('/channel/clear', {}); await poll(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function takeScene(name) {
    setBusy('take-' + name);
    try { await api.post('/channel/scene/take', { scene: name }); setTimeout(poll, 1200); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function releaseScene() {
    setBusy('release');
    try { await api.post('/channel/scene/clear', {}); setTimeout(poll, 1200); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function pushTitle() {
    if (!titleShown.trim()) return;
    setBusy('yt-title');
    try { await api.post('/channel/youtube/title', { title: titleShown }); setTitleDraft(null); setTimeout(poll, 1500); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function goLive() {
    setBusy('go-live');
    try { await api.post('/channel/stream/start', {}); setTimeout(poll, 2500); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  // The armed STOP — reproduced EXACTLY from the standalone Channel page. First click
  // arms (4s window); second click within that window fires. Ending a public stream
  // drops every viewer, so it must never be a single click, here or anywhere.
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

  return (
    <div className="border border-neutral-800 bg-neutral-950 rounded">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] tracking-widest text-neutral-400">BROADCAST CHANNEL</span>
        <span className="font-mono text-[10px] text-neutral-500">storm → YouTube</span>
        <div className="flex-1" />
        <Link to="/control/gallery" className="font-mono text-[10px] text-neutral-400 hover:text-sky-300 border border-neutral-800 rounded px-2 py-0.5 transition-colors"
          title="Chat, scheduled premieres, thumbnail and the full channel view">
          Full channel · chat / schedule ›
        </Link>
      </div>

      {/* stream lifecycle + health */}
      <div className="flex items-center gap-5 flex-wrap px-3 py-2.5 border-b border-neutral-900">
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
          <span className={`text-sm font-mono font-bold ${onAuto ? 'text-emerald-400' : 'text-amber-400'}`}>{onAuto ? 'AUTO' : 'MANUAL'}</span>
        </div>
        <Stat label="Bitrate" value={kbps != null ? `${kbps} kbps` : '—'} tone={healthTone} />
        <Stat label="OBS" value={obs.obs_version || (obs.connected ? 'connected' : 'down')} tone={obs.connected ? 'good' : 'bad'} />
        {status?.youtube?.live && <Stat label="YouTube" value={viewers != null ? `● ${viewers} watching` : '● live'} tone="good" />}
        {err && <span className="font-mono text-[10px] text-amber-400 ml-auto">{err}</span>}
      </div>

      {/* scene deck — click a scene to cut the director to it */}
      {rotation.length > 0 && (
        <div className="px-3 py-2 border-b border-neutral-900">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] tracking-widest text-neutral-500">SCENE DECK · CLICK TO TAKE</span>
            {sceneHeld && (
              <button onClick={releaseScene} disabled={busy === 'release'}
                className="font-mono text-[9px] text-amber-300 border border-amber-800 rounded px-1.5 py-0.5 hover:bg-amber-950">
                ◉ HELD · {heldScene} — RELEASE ▸
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rotation.map((sc) => {
              const isPgm = sc === pgm;
              const isHeld = sc === heldScene;
              return (
                <button key={sc} onClick={() => takeScene(sc)} disabled={busy === 'take-' + sc}
                  className={`font-mono text-[11px] px-2.5 py-1 rounded border transition ${
                    isPgm ? 'border-red-600 bg-red-950/40 text-red-200'
                    : isHeld ? 'border-amber-700 bg-amber-950/30 text-amber-200'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-sky-700 hover:text-sky-200'}`}>
                  {isPgm && <span className="text-red-400">● </span>}{sc}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* take a show / autopilot */}
      {shows.length > 0 && (
        <div className="px-3 py-2 border-b border-neutral-900">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] tracking-widest text-neutral-500">TAKE A SHOW</span>
            <div className="flex-1" />
            <button onClick={clearOverride} disabled={busy === 'clear'}
              className={`font-mono text-[9px] px-2 py-0.5 rounded border ${onAuto ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-neutral-700 text-neutral-400 hover:text-emerald-300 hover:border-emerald-800'}`}>
              {onAuto ? '● AUTO (schedule)' : 'CLEAR → AUTO'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shows.map((s) => {
              const on = show.id === s.id && !onAuto;
              return (
                <button key={s.id} onClick={() => takeShow(s.id)} disabled={busy === s.id}
                  className={`font-mono text-[11px] px-2.5 py-1 rounded border transition ${
                    on ? 'border-red-600 bg-red-950/40 text-red-200'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-sky-700 hover:text-sky-200'}`}>
                  {on && <span className="text-red-400">● </span>}{s.name}
                  {Array.isArray(s.scenes) && <span className="text-neutral-500 ml-1">· {s.scenes.length}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* YouTube title */}
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-widest text-neutral-500 shrink-0">YT TITLE</span>
        <input
          value={titleShown}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder="stream title…"
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200"
        />
        <button onClick={pushTitle} disabled={busy === 'yt-title' || !titleShown.trim()}
          className="font-mono text-[10px] px-2.5 py-1 border border-neutral-800 rounded text-neutral-300 hover:text-neutral-100 disabled:opacity-40">
          {busy === 'yt-title' ? 'pushing…' : 'PUSH ▸'}
        </button>
      </div>
    </div>
  );
}
