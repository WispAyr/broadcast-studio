import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Library — the media, with the five numbers that make it playable.
//
// A file browser tells you a clip is 47MB. A playout library tells you it runs 12.4s,
// starts at 0.8, has a 2s tail you can fade the next item into, sits at −16 LUFS, and
// is an ident. Those are the numbers the log times against and the engine segues on,
// and until someone sets them the asset is just a file.
//
// Everything here is editable in place, because the person who knows where a clip's
// tail starts is the person watching it, not the person who uploaded it.
// ─────────────────────────────────────────────────────────────────────────────

const KINDS = ['clip', 'vt', 'ident', 'bumper', 'sting', 'break', 'filler', 'still', 'promo', 'audio'];

const KIND_TONE = {
  break:  'text-amber-300 border-amber-800 bg-amber-950/30',
  promo:  'text-amber-300 border-amber-800 bg-amber-950/30',
  ident:  'text-violet-300 border-violet-800 bg-violet-950/30',
  bumper: 'text-violet-300 border-violet-800 bg-violet-950/30',
  sting:  'text-violet-300 border-violet-800 bg-violet-950/30',
  filler: 'text-neutral-400 border-neutral-700 bg-neutral-900/50',
  vt:     'text-sky-300 border-sky-800 bg-sky-950/30',
};

const secs = (s) => (s == null ? '—' : `${Number(s).toFixed(1)}s`);

function StatusPill({ m }) {
  if (m.ingest_status === 'failed') {
    return <span className="font-mono text-[9px] text-rose-400 border border-rose-900 rounded px-1" title={m.ingest_error}>FAILED</span>;
  }
  if (!['ready', 'new'].includes(m.ingest_status)) {
    return <span className="font-mono text-[9px] text-sky-400 border border-sky-900 rounded px-1 animate-pulse">{m.ingest_status.toUpperCase()}</span>;
  }
  if (m.media_type === 'video' && !m.master_path) {
    return <span className="font-mono text-[9px] text-amber-400 border border-amber-900 rounded px-1"
      title="No house master. Playout will refuse this item — mixed frame rates and codecs are what make a deck stutter.">NO MASTER</span>;
  }
  if (m.expired) {
    return <span className="font-mono text-[9px] text-rose-400 border border-rose-900 rounded px-1" title="expired — the engine will never air this">EXPIRED</span>;
  }
  return <span className="font-mono text-[9px] text-emerald-500 border border-emerald-900 rounded px-1">READY</span>;
}

// The editor. A video, a playhead, and buttons that take the numbers FROM the playhead —
// because nobody can type the exact second a tail starts, but everyone can see it.
function Editor({ m, onClose, onSaved, onIngest, busy }) {
  const vid = useRef(null);
  // A private asset has no public URL, so the editor asks the server for a signed one.
  // The operator who is trusted to put it to air is trusted to watch it.
  const [src, setSrc] = useState(m.private ? null : m.url);
  useEffect(() => {
    if (!m.private) { setSrc(m.url); return; }
    let alive = true;
    api.get(`/media/${m.id}/preview`).then(r => { if (alive) setSrc(r.url); }).catch(() => {});
    return () => { alive = false; };
  }, [m.id, m.private, m.url]);

  const [f, setF] = useState({
    name: m.name, kind: m.kind || 'clip',
    in_s: m.in_s ?? 0, out_s: m.out_s ?? '', intro_s: m.intro_s ?? 0, outro_s: m.outro_s ?? 0,
    expires_at: m.expires_at ? String(m.expires_at).slice(0, 10) : '',
    private: !!m.private,
  });
  const [t, setT] = useState(0);
  const [err, setErr] = useState('');

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const fromHead = (k) => set(k, Math.round(t * 10) / 10);

  const save = async () => {
    setErr('');
    try {
      await onSaved(m.id, {
        name: f.name, kind: f.kind,
        in_s: Number(f.in_s) || 0,
        out_s: f.out_s === '' ? null : Number(f.out_s),
        intro_s: Number(f.intro_s) || 0,
        outro_s: Number(f.outro_s) || 0,
        expires_at: f.expires_at || null,
        private: f.private ? 1 : 0,
      });
    } catch (e) { setErr(e.message); }
  };

  const dur = m.duration_s || 0;
  const mark = (v) => (dur ? `${(Math.min(Number(v) || 0, dur) / dur) * 100}%` : '0%');

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60" />
      <div className="w-[520px] bg-neutral-950 border-l border-neutral-800 overflow-y-auto p-5 space-y-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-start justify-between gap-3">
          <input value={f.name} onChange={e => set('name', e.target.value)}
            className="flex-1 bg-transparent border-b border-neutral-800 focus:border-neutral-600 outline-none text-lg text-neutral-100 pb-1" />
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-300 text-xl leading-none">✕</button>
        </div>

        {/* the clip itself — you cannot set a tail you cannot see */}
        <div className="bg-black rounded overflow-hidden">
          {m.media_type === 'video' && src ? (
            <video ref={vid} src={src} controls className="w-full aspect-video"
              onTimeUpdate={e => setT(e.target.currentTime)} />
          ) : m.media_type === 'video' ? (
            <div className="aspect-video flex items-center justify-center font-mono text-[11px] text-neutral-400 text-center px-6">
              PRIVATE — fetching a signed link…
            </div>
          ) : (
            <div className="aspect-video flex items-center justify-center font-mono text-[11px] text-neutral-400">
              {m.media_type.toUpperCase()}
            </div>
          )}
        </div>

        {/* the cue points, drawn on the timeline */}
        {dur > 0 && (
          <div className="relative h-6 bg-neutral-900 rounded overflow-hidden">
            <div className="absolute inset-y-0 bg-neutral-800"
              style={{ left: mark(f.in_s), right: f.out_s === '' ? 0 : `${100 - (Math.min(Number(f.out_s), dur) / dur) * 100}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-emerald-500" style={{ left: mark(f.in_s) }} title="in" />
            {f.out_s !== '' && <div className="absolute inset-y-0 w-0.5 bg-rose-500" style={{ left: mark(f.out_s) }} title="out" />}
            {Number(f.intro_s) > 0 && (
              <div className="absolute inset-y-0 bg-sky-500/25" style={{ left: mark(f.in_s), width: `${(Number(f.intro_s) / dur) * 100}%` }} title="intro — safe talkover window" />
            )}
            {Number(f.outro_s) > 0 && (
              <div className="absolute inset-y-0 bg-amber-500/25"
                style={{ left: `${((( f.out_s === '' ? dur : Number(f.out_s)) - Number(f.outro_s)) / dur) * 100}%`, width: `${(Number(f.outro_s) / dur) * 100}%` }}
                title="outro — the tail the next item may overlap into" />
            )}
            <div className="absolute inset-y-0 w-px bg-white" style={{ left: mark(t) }} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            ['in_s', 'IN', 'where the item starts'],
            ['out_s', 'OUT', 'where it stops — blank means the end of the file'],
            ['intro_s', 'INTRO', 'safe talkover window at the head — how long before the content really begins'],
            ['outro_s', 'OUTRO', 'the tail. This is where the NEXT item may start overlapping — it is what makes a segue rather than a gap.'],
          ].map(([k, label, hint]) => (
            <div key={k}>
              <label className="font-mono text-[10px] text-neutral-500 tracking-wider" title={hint}>{label}</label>
              <div className="flex gap-1 mt-1">
                <input type="number" step="0.1" min="0" value={f[k]}
                  onChange={e => set(k, e.target.value)}
                  placeholder={k === 'out_s' ? 'end' : '0'}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm tabular-nums" />
                <button onClick={() => fromHead(k)} disabled={!dur}
                  title="set from the playhead"
                  className="font-mono text-[9px] px-2 border border-neutral-800 rounded text-neutral-500 hover:text-neutral-100 disabled:opacity-30">
                  ⤓
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] text-neutral-500 tracking-wider">KIND</label>
            <select value={f.kind} onChange={e => set('kind', e.target.value)}
              className="mt-1 w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm">
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-neutral-500 tracking-wider" title="After this date the engine will never air it — a campaign that ends by itself">
              EXPIRES
            </label>
            <input type="date" value={f.expires_at} onChange={e => set('expires_at', e.target.value)}
              className="mt-1 w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm" />
          </div>
        </div>

        <label className="flex items-start gap-2 p-3 border border-neutral-800 rounded bg-neutral-900/40 cursor-pointer">
          <input type="checkbox" checked={f.private} onChange={e => set('private', e.target.checked)} className="mt-0.5" />
          <span>
            <span className="text-sm text-neutral-200">Private (sponsor / paid)</span>
            <span className="block font-mono text-[10px] text-neutral-500 mt-0.5 leading-relaxed">
              Moves the file out of the public web root and makes the engine hand screens a
              short-lived signed link instead. Turn this on for anything a client is paying for —
              otherwise the file is fetchable by anyone with the URL.
            </span>
          </span>
        </label>

        {/* technical truth — read only, because ffprobe knows and we don't */}
        <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-neutral-500 border-t border-neutral-900 pt-3">
          <span>DUR {secs(m.duration_s)}</span>
          <span>{m.width ? `${m.width}×${m.height}` : '—'}</span>
          <span>{m.fps ? `${m.fps}fps` : '—'}</span>
          <span>{m.vcodec || '—'}</span>
          <span>{m.lufs != null ? `${m.lufs.toFixed(1)} LUFS` : 'unmeasured'}</span>
          <span>{m.plays_count || 0} plays</span>
        </div>

        {m.ingest_error && (
          <div className="font-mono text-[10px] text-rose-400 border border-rose-950 bg-rose-950/20 rounded p-2">
            {m.ingest_error}
          </div>
        )}

        {err && <div className="font-mono text-[11px] text-rose-400">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={busy}
            className="flex-1 py-2 rounded bg-neutral-200 text-neutral-900 font-mono text-[11px] tracking-widest hover:bg-white disabled:opacity-50">
            SAVE
          </button>
          <button onClick={() => onIngest(m.id, true)} disabled={busy}
            title="Conform this asset to the house master (1080p30 CFR, AAC 48k, loudness-levelled). Playout will not air a video without one."
            className="px-4 py-2 rounded border border-sky-800 text-sky-300 font-mono text-[11px] tracking-widest hover:bg-sky-950 disabled:opacity-50">
            {m.master_path ? 'RE-MASTER' : 'MAKE MASTER'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Library() {
  const [media, setMedia] = useState([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [queue, setQueue] = useState(0);

  const user = (() => { try { return JSON.parse(localStorage.getItem('broadcast_user') || 'null'); } catch { return null; } })();
  const isSuper = user?.role === 'super_admin' && !user?.studio_id;
  const [studios, setStudios] = useState([]);
  const [studioId, setStudioId] = useState('');
  const qs = isSuper && studioId ? `?studio_id=${encodeURIComponent(studioId)}` : '';

  useEffect(() => {
    if (!isSuper) return;
    api.get('/studios').then(r => { if (r?.length) { setStudios(r); setStudioId(p => p || r[0].id); } }).catch(() => {});
  }, [isSuper]);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/media${qs}`);
      setMedia(d.media || []);
      setQueue(d.queue_depth || 0);
      setOpen(o => (o ? (d.media || []).find(x => x.id === o.id) || null : null));
    } catch (e) { setMsg(e.message); }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  // While anything is ingesting, keep looking — an encode takes about as long as the
  // clip does, and an operator staring at a stale "MASTERING" badge will click it again.
  useEffect(() => {
    if (!queue && !media.some(m => !['ready', 'new', 'failed'].includes(m.ingest_status))) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [queue, media, load]);

  const act = async (fn, note) => {
    setBusy(true); setMsg('');
    try { await fn(); if (note) setMsg(note); await load(); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const scan = () => act(async () => {
    const r = await api.post(`/media/scan${qs}`, {});
    setMsg(`adopted ${r.added} file${r.added === 1 ? '' : 's'} from disk`);
  });
  const save = (id, body) => act(async () => { await api.patch(`/media/${id}`, body); }, 'saved');
  const doIngest = (id, master) => act(async () => { await api.post(`/media/${id}/ingest`, { master }); }, master ? 'mastering — this takes about as long as the clip runs' : 'queued');

  const shown = media.filter(m =>
    (!kind || m.kind === kind) &&
    (!q || m.name?.toLowerCase().includes(q.toLowerCase()))
  );

  const noMaster = media.filter(m => m.media_type === 'video' && !m.master_path).length;

  return (
    <div className="p-5 space-y-4 text-neutral-200">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg text-neutral-100">Library</h1>
        <span className="font-mono text-[10px] text-neutral-400">
          {media.length} assets · {media.filter(m => m.master_path).length} mastered
        </span>
        {queue > 0 && <span className="font-mono text-[10px] text-sky-400 animate-pulse">◌ {queue} in the ingest queue</span>}

        <div className="flex-1" />

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="search…"
          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm w-48" />
        <select value={kind} onChange={e => setKind(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm">
          <option value="">all kinds</option>
          {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        {isSuper && (
          <select value={studioId} onChange={e => setStudioId(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400">
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button onClick={scan} disabled={busy}
          title="Register files already sitting in this studio's upload folder. Idempotent — it only picks up what's new."
          className="font-mono text-[10px] px-3 py-1.5 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-100">
          SCAN DISK
        </button>
      </div>

      {noMaster > 0 && (
        <div className="font-mono text-[11px] text-amber-400/90 border border-amber-950 bg-amber-950/20 rounded px-3 py-2">
          ⚠ {noMaster} video{noMaster === 1 ? '' : 's'} without a house master. Playout will refuse them —
          open one and hit MAKE MASTER. (Mixed frame rates and codecs are what make a deck stutter; this library
          currently holds everything from 25fps to a file claiming 31.579.)
        </div>
      )}

      {msg && <div className="font-mono text-[11px] text-neutral-400">{msg}</div>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {shown.map(m => (
          <button key={m.id} onClick={() => setOpen(m)}
            className="text-left border border-neutral-800 bg-neutral-950 rounded overflow-hidden hover:border-neutral-600 transition">
            <div className="aspect-video bg-black relative">
              {m.poster_url
                ? <img src={m.poster_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-neutral-500">
                    {m.media_type.toUpperCase()}
                  </div>}
              {m.private ? (
                <span className="absolute top-1 right-1 font-mono text-[9px] text-amber-300 bg-neutral-950/80 border border-amber-900 rounded px-1"
                  title="private — served only over a signed link">🔒</span>
              ) : null}
              {m.effective_duration_s != null && (
                <span className="absolute bottom-1 right-1 font-mono text-[9px] text-neutral-300 bg-black/70 rounded px-1 tabular-nums">
                  {secs(m.effective_duration_s)}
                </span>
              )}
            </div>
            <div className="p-2 space-y-1">
              <div className="text-xs text-neutral-200 truncate">{m.name}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-mono text-[9px] px-1 rounded border ${KIND_TONE[m.kind] || 'text-neutral-500 border-neutral-800'}`}>
                  {m.kind}
                </span>
                <StatusPill m={m} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="py-16 text-center font-mono text-[11px] text-neutral-500">
          NOTHING HERE — hit SCAN DISK to adopt what's already in the upload folder
        </div>
      )}

      {open && (
        <Editor m={open} busy={busy} onClose={() => setOpen(null)} onSaved={save} onIngest={doIngest} />
      )}
    </div>
  );
}
