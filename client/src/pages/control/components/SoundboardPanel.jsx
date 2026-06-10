import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';
import { connectSocket } from '../../../lib/socket';

// Soundboard / Cart wall.
//
// Fires audio + video "stings" (jingles, SFX, sweepers, bumpers) over air, and
// drives a looping music bed — both via the screen player's audio engine
// (push_overlay {type:'sting'|'bed'}). Targets the PA-feed screen, a single
// screen, or the whole studio. Stings auto-duck the bed and clear themselves
// when they finish; the bed loops until stopped.
//
// Audio is only audible on screens flagged as audio outputs (config.audioOutput
// or ?audio=1); on muted video walls a video sting still shows its visual.

const TV_TYPES = ['live_tv', 'livetv', 'tv_channel'];
const BED_TYPES = ['audio', 'audio_bed', 'music_bed'];

const isAudio = (f) => f.type === 'audio' || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.url || f.filename || '');
const isVideo = (f) => f.type === 'video' || /\.(mp4|webm|mov|avi)$/i.test(f.url || f.filename || '');
const nameOf = (f) => (f.originalName || f.filename || f.url || '').replace(/^[0-9a-f-]{36}/i, '').replace(/^[-_.]/, '') || f.filename;

// ─── Mixer — live faders for in-layout audio sources ─────────────────────────
// Reads the target screens' current layouts and shows a fader per audio-capable
// module (live TV channels, audio beds). Changes go out as SOFT
// update_module_config (merge without remount, so the TV stream never drops).
// SOLO routes one TV channel's audio when several are on screen (multiview).
function MixerSection({ studioId, screens, target }) {
  const [rows, setRows] = useState([]);
  const [levels, setLevels] = useState({}); // moduleId → { volume, muted }

  const refresh = useCallback(() => {
    const tgtScreens = target === 'studio' ? screens : screens.filter((s) => s.id === target);
    const layoutIds = [...new Set(tgtScreens.map((s) => s.current_layout_id).filter(Boolean))];
    Promise.all(layoutIds.map((id) => api.get(`/layouts/${id}`).catch(() => null)))
      .then((layouts) => {
        const out = [];
        const seen = new Set();
        layouts.filter(Boolean).forEach((lay) => {
          const showing = tgtScreens.filter((s) => s.current_layout_id === lay.id).map((s) => s.name);
          (Array.isArray(lay.modules) ? lay.modules : []).forEach((m) => {
            const type = m.type || m.module || m.module_type;
            const tv = TV_TYPES.includes(type);
            if ((!tv && !BED_TYPES.includes(type)) || !m.id || seen.has(m.id)) return;
            seen.add(m.id);
            out.push({ moduleId: m.id, tv, config: m.config || {}, screens: showing });
          });
        });
        setRows(out);
        setLevels((prev) => {
          const next = { ...prev };
          out.forEach((r) => {
            if (!next[r.moduleId]) {
              next[r.moduleId] = {
                volume: typeof r.config.volume === 'number' ? r.config.volume : (r.tv ? 1 : 0.8),
                muted: r.tv ? r.config.audio === 'off' : false,
              };
            }
          });
          return next;
        });
      });
  }, [screens, target, studioId]);

  useEffect(() => { refresh(); }, [refresh]);

  const send = (moduleId, cfg) => {
    const s = connectSocket();
    s.emit('update_module_config', { studioId, moduleId, config: { ...cfg, _soft: true } });
  };

  const setVol = (r, v) => {
    setLevels((l) => ({ ...l, [r.moduleId]: { ...l[r.moduleId], volume: v } }));
    send(r.moduleId, { volume: v });
  };
  const toggleMute = (r) => {
    const muted = !levels[r.moduleId]?.muted;
    setLevels((l) => ({ ...l, [r.moduleId]: { ...l[r.moduleId], muted } }));
    if (r.tv) send(r.moduleId, { audio: muted ? 'off' : 'auto' });
    else send(r.moduleId, { volume: muted ? 0 : (levels[r.moduleId]?.volume ?? 0.8) });
  };
  const solo = (r) => {
    setLevels((l) => {
      const next = { ...l };
      rows.filter((x) => x.tv).forEach((x) => {
        const on = x.moduleId === r.moduleId;
        next[x.moduleId] = { ...next[x.moduleId], muted: !on };
        send(x.moduleId, { audio: on ? 'auto' : 'off' });
      });
      return next;
    });
  };

  if (!rows.length) return null;
  const tvCount = rows.filter((r) => r.tv).length;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-amber-400">Mixer · on-screen sources</span>
        <button onClick={refresh} title="Re-read current layouts"
          className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 hover:text-white">↻</button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const lv = levels[r.moduleId] || { volume: 1, muted: false };
          const label = r.tv ? `📺 ${(r.config.channel || 'TV').toUpperCase()}` : `🎵 ${r.config.title || 'Bed'}`;
          return (
            <div key={r.moduleId} className="flex items-center gap-1.5">
              <span className="w-24 truncate text-[10px] font-semibold text-gray-300" title={r.screens.join(', ')}>{label}</span>
              <input type="range" min="0" max="1" step="0.05" value={lv.muted ? 0 : lv.volume}
                disabled={lv.muted}
                onChange={(e) => setVol(r, parseFloat(e.target.value))}
                className={`flex-1 ${r.tv ? 'accent-amber-500' : 'accent-green-500'} disabled:opacity-40`} />
              <button onClick={() => toggleMute(r)} title={lv.muted ? 'Unmute' : 'Mute'}
                className={`w-6 py-0.5 rounded text-[10px] font-bold ${lv.muted ? 'bg-red-600/60 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>M</button>
              {r.tv && tvCount > 1 && (
                <button onClick={() => solo(r)} title="Solo — this channel's audio only"
                  className={`w-6 py-0.5 rounded text-[10px] font-bold ${!lv.muted && rows.filter((x) => x.tv && x.moduleId !== r.moduleId).every((x) => levels[x.moduleId]?.muted) ? 'bg-amber-500/70 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>S</button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-gray-600 mt-1">Sound plays on audio-output screens only. Faders survive stream — no retune.</p>
    </div>
  );
}

export default function SoundboardPanel({ studioId, screens = [], inShell }) {
  const [files, setFiles] = useState([]);
  const [target, setTarget] = useState('studio'); // 'studio' | screenId
  const [bed, setBed] = useState({ url: null, volume: 0.8, playing: false, name: '' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/uploads')
      .then((data) => setFiles((Array.isArray(data) ? data : []).filter((f) => isAudio(f) || isVideo(f))))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Build the target fields for a socket emit.
  const tgt = () => (target === 'studio' ? { studioId } : { screenId: target, studioId });

  const fireSting = useCallback((f) => {
    const s = connectSocket();
    s.emit('push_overlay', {
      ...tgt(),
      overlay: { type: 'sting', url: f.url, audioOnly: isAudio(f), fit: 'cover', maxDuration: 60 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, studioId]);

  const pushBed = useCallback((url, volume, name) => {
    const s = connectSocket();
    s.emit('push_overlay', { ...tgt(), overlay: { type: 'bed', url, volume } });
    setBed({ url, volume, playing: true, name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, studioId]);

  const stopBed = useCallback(() => {
    const s = connectSocket();
    s.emit('remove_overlay', { ...tgt(), overlayType: 'bed' });
    setBed((b) => ({ ...b, playing: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, studioId]);

  const setBedVolume = (v) => {
    setBed((b) => ({ ...b, volume: v }));
    if (bed.playing && bed.url) pushBed(bed.url, v, bed.name);
  };

  const stopAll = () => {
    const s = connectSocket();
    s.emit('remove_overlay', { ...tgt(), overlayType: 'sting' });
    stopBed();
  };

  const audioFiles = files.filter(isAudio);
  const videoFiles = files.filter(isVideo);

  const Cart = ({ f, accent }) => (
    <button
      onClick={() => fireSting(f)}
      onDoubleClick={() => isAudio(f) && pushBed(f.url, bed.volume, nameOf(f))}
      title={`${nameOf(f)}  •  click = fire sting${isAudio(f) ? ', double-click = set as bed' : ''}`}
      className={`h-12 px-2 rounded-md text-[11px] font-semibold text-left leading-tight truncate transition-all ${accent} active:scale-95`}
    >
      {nameOf(f)}
    </button>
  );

  const body = (
    <div className="p-2 space-y-3">
      {/* Target */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">Target</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}
          className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs">
          <option value="studio">All screens (studio)</option>
          {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={stopAll} title="Stop stings + bed"
          className="px-2 py-1 rounded text-[10px] font-bold bg-red-600/30 text-red-400 hover:bg-red-600/50">STOP</button>
      </div>

      {/* Mixer — faders for live TV / audio modules in the current layouts */}
      <MixerSection studioId={studioId} screens={screens} target={target} />

      {/* Bed */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-green-400">Music Bed</span>
          <span className={`text-[10px] ${bed.playing ? 'text-green-400' : 'text-gray-600'}`}>
            {bed.playing ? `▶ ${bed.name}` : 'stopped'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min="0" max="1" step="0.05" value={bed.volume}
            onChange={(e) => setBedVolume(parseFloat(e.target.value))} className="flex-1 accent-green-500" />
          <button onClick={stopBed} disabled={!bed.playing}
            className="px-2 py-1 rounded text-[10px] bg-gray-800 text-gray-300 disabled:opacity-40">Stop</button>
        </div>
        <p className="text-[9px] text-gray-600 mt-1">Double-click an audio cart to load it as the bed.</p>
      </div>

      {loading && <p className="text-gray-500 text-xs text-center py-2">Loading carts…</p>}

      {/* Audio carts */}
      {audioFiles.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Audio · stings & SFX</div>
          <div className="grid grid-cols-2 gap-1">
            {audioFiles.map((f) => <Cart key={f.url} f={f} accent="bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/60" />)}
          </div>
        </div>
      )}

      {/* Video stings */}
      {videoFiles.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Video · stings & bumpers</div>
          <div className="grid grid-cols-2 gap-1">
            {videoFiles.map((f) => <Cart key={f.url} f={f} accent="bg-indigo-900/40 text-indigo-200 hover:bg-indigo-800/60" />)}
          </div>
        </div>
      )}

      {!loading && files.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-3">No audio/video uploaded yet — add files in Media.</p>
      )}
    </div>
  );

  return inShell ? body : body;
}
