import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../lib/api';

// Broadcast Studio — Music Library. Tag each track's energy (drives the vibe-weighted
// DJ) and enable/disable it. Backed by /api/channel/music + /music/track (DJ hot-reloads).

const POLL_MS = 4000;
const TIERS = [
  { key: 'chill', label: 'CHILL', energy: 0.2, cls: 'text-emerald-300 border-emerald-600 bg-emerald-950/40', dot: 'bg-emerald-400' },
  { key: 'mid', label: 'MID', energy: 0.55, cls: 'text-sky-300 border-sky-600 bg-sky-950/40', dot: 'bg-sky-400' },
  { key: 'energetic', label: 'ENERGETIC', energy: 0.9, cls: 'text-rose-300 border-rose-600 bg-rose-950/40', dot: 'bg-rose-400' },
];
function tierOf(e) { if (e == null) return 'mid'; if (e <= 0.35) return 'chill'; if (e < 0.75) return 'mid'; return 'energetic'; }

export default function MusicLibrary() {
  const [music, setMusic] = useState(null);
  const [q, setQ] = useState('');
  const [vibeLocal, setVibeLocal] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState(null);
  const vibeTimer = useRef(null);
  const mounted = useRef(true);

  const poll = useCallback(() => {
    api.get('/channel/music')
      .then((m) => { if (mounted.current && m) { setMusic(m); setErr(null); } })
      .catch((e) => { if (mounted.current) setErr(e.message || 'engine unreachable'); });
  }, []);

  useEffect(() => {
    mounted.current = true; poll();
    const id = setInterval(poll, POLL_MS);
    return () => { mounted.current = false; clearInterval(id); };
  }, [poll]);

  const tracks = Array.isArray(music?.tracks) ? music.tracks : [];
  const vibeShown = vibeLocal != null ? vibeLocal : (music?.vibe != null ? music.vibe : 25);
  const counts = tracks.reduce((a, t) => {
    if (t.enabled === false) { a.off++; return a; }
    a[tierOf(t.energy)]++; return a;
  }, { chill: 0, mid: 0, energetic: 0, off: 0 });

  function onVibe(v) {
    setVibeLocal(v);
    if (vibeTimer.current) clearTimeout(vibeTimer.current);
    vibeTimer.current = setTimeout(async () => {
      try { await api.post('/channel/music/vibe', { value: v }); await poll(); }
      catch (e) { setErr(e.message); } finally { setVibeLocal(null); }
    }, 350);
  }
  async function skip() {
    setBusy('skip'); try { await api.post('/channel/music/skip', {}); setTimeout(poll, 1500); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function setEnergy(t, energy) {
    setBusy(t.file + ':e'); setMusic((m) => ({ ...m, tracks: m.tracks.map((x) => x.file === t.file ? { ...x, energy } : x) }));
    try { await api.post('/channel/music/track', { file: t.file, energy }); }
    catch (e) { setErr(e.message); poll(); } finally { setBusy(''); }
  }
  async function toggle(t) {
    const enabled = !(t.enabled !== false);
    setBusy(t.file + ':t'); setMusic((m) => ({ ...m, tracks: m.tracks.map((x) => x.file === t.file ? { ...x, enabled } : x) }));
    try { await api.post('/channel/music/track', { file: t.file, enabled }); }
    catch (e) { setErr(e.message); poll(); } finally { setBusy(''); }
  }

  const filtered = tracks.filter((t) => !q || (t.title || t.file).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 text-neutral-100 min-h-full bg-neutral-950">
      {/* now playing + vibe */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">Music DJ · {music?.count || tracks.filter((t) => t.enabled !== false).length} live tracks</span>
          <button onClick={skip} disabled={busy === 'skip'}
            className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-sky-600 hover:bg-neutral-800">
            {busy === 'skip' ? 'skipping…' : 'SKIP ▸'}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-100 truncate">{music?.now?.title || '—'}</div>
            <div className="text-[11px] text-neutral-500 font-mono truncate">next · {music?.next?.title || '—'}</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-mono mb-1">
          <span className="text-emerald-400">◄ Laid-back</span>
          <span className="text-neutral-400">Vibe {Math.round(vibeShown)}</span>
          <span className="text-rose-400">Energetic ►</span>
        </div>
        <input type="range" min="0" max="100" value={vibeShown} onChange={(e) => onVibe(Number(e.target.value))} className="w-full accent-sky-500 cursor-pointer" />
      </div>

      {err && <div className="mb-3 border border-rose-800 bg-rose-950/40 text-rose-300 rounded-lg px-4 py-2 font-mono text-sm">engine: {err}</div>}

      {/* library controls */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search tracks…"
          className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm font-mono text-neutral-200 focus:border-sky-600 outline-none w-56" />
        <div className="flex gap-3 font-mono text-[11px] text-neutral-400">
          <span><span className="text-emerald-400">●</span> {counts.chill} chill</span>
          <span><span className="text-sky-400">●</span> {counts.mid} mid</span>
          <span><span className="text-rose-400">●</span> {counts.energetic} energetic</span>
          <span className="text-neutral-600">{counts.off} off</span>
        </div>
      </div>

      {/* track list */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 divide-y divide-neutral-800/70 overflow-hidden">
        {filtered.length === 0 && <div className="p-6 text-center font-mono text-sm text-neutral-600">no tracks</div>}
        {filtered.map((t) => {
          const on = t.enabled !== false;
          const tier = tierOf(t.energy);
          const live = music?.now?.file === t.file;
          return (
            <div key={t.file} className={`flex items-center gap-3 px-4 py-2.5 ${on ? '' : 'opacity-45'} ${live ? 'bg-emerald-950/20' : ''}`}>
              <button onClick={() => toggle(t)} title={on ? 'enabled' : 'disabled'}
                className={`w-9 h-5 rounded-full shrink-0 relative transition ${on ? 'bg-emerald-600/70' : 'bg-neutral-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-neutral-100 truncate">{live && <span className="text-emerald-400">● </span>}{t.title || t.file}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {TIERS.map((tr) => (
                  <button key={tr.key} onClick={() => setEnergy(t, tr.energy)} disabled={busy === t.file + ':e'}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold border transition ${
                      tier === tr.key ? tr.cls : 'text-neutral-500 border-neutral-800 bg-neutral-900 hover:border-neutral-600'}`}>
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
