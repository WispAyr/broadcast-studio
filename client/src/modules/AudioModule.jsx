import React, { useEffect, useRef } from 'react';
import { onDuck, rampVolume, autoPlay } from '../lib/audioBus';

// Audio bed / playout player.
//
// Plays a single file or a playlist as a looping music bed. Lives in a layout
// (typically on the dedicated playout / PA-feed screen). Reacts to live config
// (play/pause, volume, track) pushed via update_module_config, and auto-ducks
// when a sting fires (listens on the audio bus). Fades on start/stop/track so
// it never clicks or jumps — "buttery" by default.
//
// config:
//   src        string                 single file URL
//   playlist   string[] | {url,title} keys  (overrides src; advances on end)
//   playing    bool   (default true)
//   volume     0..1   (default 0.8)
//   loop       bool   (default true)   loop the single src / wrap the playlist
//   fadeMs     number (default 800)
//   title      string                  now-playing label
//   showNowPlaying bool (default true)

function trackList(config) {
  if (Array.isArray(config.playlist) && config.playlist.length) {
    return config.playlist.map((t) => (typeof t === 'string' ? { url: t } : t)).filter((t) => t && t.url);
  }
  const src = config.src || config.url;
  return src ? [{ url: src, title: config.title }] : [];
}

export default function AudioModule({ config = {} }) {
  const audioRef = useRef(null);
  const baseVolRef = useRef(config.volume ?? 0.8);
  const duckRef = useRef(1);
  const idxRef = useRef(0);
  const [now, setNow] = React.useState(null);

  const tracks = trackList(config);
  const fadeMs = config.fadeMs ?? 800;
  const playing = config.playing !== false;
  const loop = config.loop !== false;
  const showNowPlaying = config.showNowPlaying !== false;

  // Effective volume = base × duck multiplier, ramped.
  const apply = (ms) => rampVolume(audioRef.current, baseVolRef.current * duckRef.current, ms);

  // Load + autoplay the current track.
  const tracksKey = tracks.map((t) => t.url).join('|');
  useEffect(() => {
    const el = audioRef.current;
    if (!el || tracks.length === 0) return;
    if (idxRef.current >= tracks.length) idxRef.current = 0;
    const track = tracks[idxRef.current];
    if (el.src !== track.url && !el.src.endsWith(track.url)) el.src = track.url;
    setNow(track.title || track.url.split('/').pop());
    el.volume = 0;
    let off = () => {};
    if (playing) { off = autoPlay(el); rampVolume(el, baseVolRef.current * duckRef.current, fadeMs); }
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracksKey]);

  // React to play/pause.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      const off = autoPlay(el);
      apply(fadeMs);
      return () => off();
    } else {
      rampVolume(el, 0, fadeMs);
      const t = setTimeout(() => { try { el.pause(); } catch {} }, fadeMs);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // React to volume changes.
  useEffect(() => {
    baseVolRef.current = config.volume ?? 0.8;
    apply(250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.volume]);

  // Duck under stings.
  useEffect(() => onDuck((gain, ms) => { duckRef.current = gain; apply(ms); }), []);

  // Advance the playlist (or loop a single track) on end.
  const handleEnded = () => {
    const el = audioRef.current;
    if (!el) return;
    if (tracks.length > 1) {
      idxRef.current += 1;
      if (idxRef.current >= tracks.length) { if (!loop) return; idxRef.current = 0; }
      const track = tracks[idxRef.current];
      el.src = track.url;
      setNow(track.title || track.url.split('/').pop());
      el.volume = baseVolRef.current * duckRef.current;
      autoPlay(el);
    } else if (loop) {
      el.currentTime = 0;
      autoPlay(el);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-1 text-center px-4">
        <span className="text-3xl">🔊</span>
        <span className="text-gray-500 text-sm">Audio bed — no file set</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: config.background || 'linear-gradient(135deg,#0b1020,#1a1740)' }}>
      <audio ref={audioRef} onEnded={handleEnded} preload="auto" playsInline />
      {showNowPlaying && (
        <div className="flex items-center gap-4 px-6">
          <EqBars playing={playing} />
          <div className="text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-white/40">{playing ? 'On Air' : 'Paused'}</div>
            <div className="text-white font-bold text-xl truncate max-w-[60vw]">{now}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function EqBars({ playing }) {
  return (
    <div className="flex items-end gap-1 h-10">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i}
          style={{
            width: 5, background: '#5b8cff', borderRadius: 2,
            height: playing ? '100%' : '20%',
            animation: playing ? `bsEq 0.9s ease-in-out ${i * 0.12}s infinite alternate` : 'none',
          }} />
      ))}
      <style>{`@keyframes bsEq { from { height: 20%; } to { height: 100%; } }`}</style>
    </div>
  );
}
