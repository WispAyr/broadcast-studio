import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import { useSocketStatus } from '../lib/useSocketStatus';
import { Link } from 'react-router-dom';

// AppStatusBar — the ON-AIR SPINE. Persistent across the whole control app.
//
// The single most important thing this bar does is answer, from ANY page: "what am
// I actually broadcasting right now?" Three independent things can be on air —
//   WALL    the venue screen wall (studio-scoped)
//   STREAM  the OBS -> YouTube channel (with a live viewer count)
//   CHANNEL the playout channel running clips/idents to air (studio-scoped)
// The old bar tracked only the wall, so it read "OFF AIR" while YouTube was live —
// the exact blind spot that lets an on-air mistake go unnoticed. Each surface now
// has its own labelled, individually-lit indicator, and the bar can NEVER show a
// global "off air" while any one of them is broadcasting.
//
// Colour law: a red, pulsing dot means THAT surface is live, and nothing else in
// this persistent chrome may wear it. (The connection dot is amber when down, not
// red — an offline link is a warning, not an on-air state.)

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });

// One on-air indicator. Lit = this surface is live: red dot + ping + red value.
// Dark = idle: neutral dot, muted "—". The label never disappears, so the operator
// always knows the surface is being watched even when it is dark.
function AirIndicator({ label, live, value, title }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={title || (live ? `${label}: ${value}` : `${label}: off air`)}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {live && <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-ping opacity-60" />}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${live ? 'bg-red-500' : 'bg-gray-700'}`} />
      </span>
      <span className={`text-[10px] font-black tracking-[0.16em] shrink-0 ${live ? 'text-red-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-xs font-semibold truncate max-w-[14rem] ${live ? 'text-gray-100' : 'text-gray-600'}`}>
        {live ? value : '—'}
      </span>
    </div>
  );
}

export default function AppStatusBar({ studioName, user, onOpenPalette }) {
  const now = useClock();
  const { connected, reconnecting } = useSocketStatus();
  const [air, setAir] = useState({ wall: null, stream: null, viewers: null, facebook: null, channel: null });
  const debounceRef = useRef(null);

  // Pull all three surfaces. WALL + CHANNEL are studio-scoped; STREAM is the single
  // OBS/YouTube channel (there is one). Event-driven refresh via the studio socket
  // room for the wall, plus a 15s poll so the stream/viewer state stays honest —
  // "am I streaming" is not a question you want a 60s-stale answer to.
  useEffect(() => {
    let alive = true;
    const sid = user?.studio_id;
    const q = sid ? `?studio_id=${encodeURIComponent(sid)}` : '';

    const load = async () => {
      const [wall, stream, channels] = await Promise.all([
        api.get(`/console/state${q}`).catch(() => null),
        api.get('/channel/status').catch(() => null),
        api.get(`/playout/channels${q}`).catch(() => null),
      ]);
      if (!alive) return;
      // A failed fetch leaves that surface unknown rather than falsely "off" — the
      // one thing this bar must never do is claim dark while something is live.
      const onAirChannel = (channels?.channels || []).find(c => c?.on_air);
      setAir(prev => ({
        wall:    wall ? (wall.on_air_layout_name || null) : prev.wall,
        stream:  stream ? !!stream?.youtube?.live : prev.stream,
        viewers: stream?.youtube?.concurrent ?? null,
        facebook: stream ? !!stream?.obs?.facebook?.connected : prev.facebook,
        channel: channels ? (onAirChannel?.on_air?.title || null) : prev.channel,
      }));
    };
    const refresh = () => { clearTimeout(debounceRef.current); debounceRef.current = setTimeout(load, 350); };

    load();
    const t = setInterval(load, 15000);

    let socket = null;
    if (sid) {
      socket = connectSocket();
      socket.emit('join_studio', { studioId: sid });
      socket.on('screen_preview', refresh);
      socket.on('set_layout', refresh);
      socket.on('sync_all', refresh);
      socket.on('connect', () => { socket.emit('join_studio', { studioId: sid }); refresh(); });
    }
    return () => {
      alive = false; clearInterval(t); clearTimeout(debounceRef.current);
      if (socket) { socket.off('screen_preview', refresh); socket.off('set_layout', refresh); socket.off('sync_all', refresh); }
    };
  }, [user?.studio_id]);

  const [hh, mm, ss] = TIME_FMT.format(now).split(':');
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  return (
    <div className="flex items-center gap-4 h-11 px-4 bg-gray-900/80 border-b border-gray-800/80 shrink-0 select-none overflow-hidden"
      style={{ backdropFilter: 'blur(12px)' }}>

      {/* THE ON-AIR SPINE — three surfaces, each individually lit */}
      <div className="flex items-center gap-4 min-w-0">
        <AirIndicator label="WALL" live={!!air.wall} value={air.wall} />
        <span className="w-px h-4 bg-gray-800 shrink-0" />
        <Link to="/control/gallery" className="hover:opacity-80 transition-opacity" title="Open the channel controls">
          <AirIndicator
            label="STREAM"
            live={!!air.stream}
            value={air.viewers != null ? `YouTube · ${air.viewers}` : 'YouTube'}
            title={air.stream ? `Streaming to YouTube${air.viewers != null ? ` · ${air.viewers} watching` : ''} — open channel` : 'STREAM: off air — open channel'}
          />
        </Link>
        <span className="w-px h-4 bg-gray-800 shrink-0" />
        <AirIndicator
          label="FACEBOOK"
          live={!!air.facebook}
          value="Simulcast"
          title={air.facebook ? 'Simulcasting to the Facebook Page — bound to the channel stream' : 'FACEBOOK: not simulcasting'}
        />
        <span className="w-px h-4 bg-gray-800 shrink-0" />
        <AirIndicator label="CHANNEL" live={!!air.channel} value={air.channel} />
      </div>

      <div className="flex-1" />

      {/* ⌘K trigger */}
      <button onClick={onOpenPalette}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors text-xs shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <span className="hidden md:inline">Search &amp; take</span>
        <kbd className="text-[10px] text-gray-500 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      {/* connection — amber when down (a warning), never persistent red (that's on-air only) */}
      <div className="flex items-center gap-1.5 text-[11px] shrink-0" title={connected ? 'Realtime link up' : reconnecting ? 'Reconnecting…' : 'Disconnected'}>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        <span className={`hidden sm:inline ${connected ? 'text-emerald-400/90' : 'text-amber-400'}`}>
          {connected ? 'Live' : reconnecting ? 'Reconnecting' : 'Offline'}
        </span>
      </div>

      {/* studio + clock */}
      <span className="hidden xl:block text-[11px] text-gray-500 border-l border-gray-800 pl-4 truncate max-w-[14rem]">{studioName}</span>
      <div className="text-right leading-none shrink-0">
        <div className="font-mono text-base font-bold text-white tabular-nums">
          {hh}:{mm}<span className="text-gray-500">:{ss}</span>
        </div>
        <div className="hidden sm:block text-[9px] tracking-[0.2em] text-gray-600 uppercase">{DATE_FMT.format(now)}</div>
      </div>
    </div>
  );
}
