import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import { useSocketStatus } from '../lib/useSocketStatus';

// AppStatusBar — persistent broadcast chrome across the control app.
// Live Europe/London clock, what's ON AIR right now, socket health, and the
// ⌘K command-palette trigger. This is what makes the suite read as one
// running application rather than a stack of admin pages.

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

export default function AppStatusBar({ studioName, user, onOpenPalette }) {
  const now = useClock();
  const { connected, reconnecting } = useSocketStatus();
  const [onAir, setOnAir] = useState(null);
  const debounceRef = useRef(null);

  // ON AIR summary: event-driven via the studio socket room — any take
  // (console, palette, card wall, timeline, sync) emits screen_preview /
  // set_layout / sync_all, which triggers a debounced refresh. A slow 60s
  // poll remains as a safety net for missed events / reconnects.
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/console/state')
      .then(d => { if (alive) setOnAir(d?.on_air_layout_name || null); })
      .catch(() => {});
    const refresh = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(load, 350);
    };
    load();
    const t = setInterval(load, 60000);

    let socket = null;
    if (user?.studio_id) {
      socket = connectSocket();
      socket.emit('join_studio', { studioId: user.studio_id });
      socket.on('screen_preview', refresh);
      socket.on('set_layout', refresh);
      socket.on('sync_all', refresh);
      socket.on('connect', () => { socket.emit('join_studio', { studioId: user.studio_id }); refresh(); });
    }
    return () => {
      alive = false; clearInterval(t); clearTimeout(debounceRef.current);
      if (socket) { socket.off('screen_preview', refresh); socket.off('set_layout', refresh); socket.off('sync_all', refresh); }
    };
  }, [user?.studio_id]);

  const [hh, mm, ss] = TIME_FMT.format(now).split(':');
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  return (
    <div className="hidden lg:flex items-center gap-4 h-11 px-4 bg-gray-900/80 border-b border-gray-800/80 shrink-0 select-none"
      style={{ backdropFilter: 'blur(12px)' }}>
      {/* ON AIR */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full ${onAir ? 'bg-red-500 animate-ping opacity-60' : ''}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${onAir ? 'bg-red-500' : 'bg-gray-700'}`} />
        </span>
        <span className="text-[10px] font-black tracking-[0.18em] text-gray-500 shrink-0">ON AIR</span>
        <span className="text-xs font-semibold text-gray-200 truncate max-w-[26rem]" title={onAir || ''}>
          {onAir || '—'}
        </span>
      </div>

      <div className="flex-1" />

      {/* ⌘K trigger */}
      <button onClick={onOpenPalette}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors text-xs">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        Search & take
        <kbd className="text-[10px] text-gray-500 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      {/* connection */}
      <div className="flex items-center gap-1.5 text-[11px]" title={connected ? 'Realtime link up' : reconnecting ? 'Reconnecting…' : 'Disconnected'}>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : reconnecting ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`} />
        <span className={connected ? 'text-emerald-400/90' : reconnecting ? 'text-amber-400' : 'text-red-400'}>
          {connected ? 'Live' : reconnecting ? 'Reconnecting' : 'Offline'}
        </span>
      </div>

      {/* studio + clock */}
      <span className="text-[11px] text-gray-600 border-l border-gray-800 pl-4 truncate max-w-[14rem]">{studioName}</span>
      <div className="text-right leading-none">
        <div className="font-mono text-base font-bold text-white tabular-nums">
          {hh}:{mm}<span className="text-gray-500">:{ss}</span>
        </div>
        <div className="text-[9px] tracking-[0.2em] text-gray-600 uppercase">{DATE_FMT.format(now)}</div>
      </div>
    </div>
  );
}
