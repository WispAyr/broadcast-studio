import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';
import BroadcastPanel from './panels/BroadcastPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Playout — the operator's surface.
//
// Shaped like the thing it replaces: two decks across the top (what's ON AIR and
// what's CUED), THE LOG down the middle, the library and cart wall to the side.
// One big TAKE. One AUTO ▮ MAN switch. Everything else is detail.
//
// Colour law (house): rose = on air, sky = cued, amber = held/armed, emerald =
// autopilot healthy. Nothing else gets to use rose.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 1000;   // the countdown has to be believable

const mmss = (s) => {
  if (s == null || !isFinite(s)) return '—';
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const KIND_TONE = {
  break:  'text-amber-300 border-amber-800 bg-amber-950/30',
  ident:  'text-violet-300 border-violet-800 bg-violet-950/30',
  bumper: 'text-violet-300 border-violet-800 bg-violet-950/30',
  sting:  'text-violet-300 border-violet-800 bg-violet-950/30',
  filler: 'text-neutral-400 border-neutral-700 bg-neutral-900/50',
  vt:     'text-sky-300 border-sky-800 bg-sky-950/30',
};

function Deck({ tone, tag, item, ready }) {
  const rose = tone === 'pgm';
  const border = rose ? 'border-red-700' : 'border-sky-800';
  const text = rose ? 'text-red-400' : 'text-sky-400';
  const pct = item?.dur_s ? Math.min(100, ((item.elapsed_s || 0) / item.dur_s) * 100) : 0;

  return (
    <div className={`flex-1 border ${border} bg-neutral-950 rounded overflow-hidden`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${border} bg-neutral-900/60`}>
        <span className={`font-mono text-[11px] tracking-widest ${text}`}>{tag}</span>
        {tone === 'pvw' && item && (
          <span className={`font-mono text-[10px] tracking-wider ${ready ? 'text-emerald-400' : 'text-amber-400'}`}>
            {ready ? '● READY' : '◌ LOADING'}
          </span>
        )}
        {tone === 'pgm' && item && (
          <span className="font-mono text-[11px] text-red-300 tabular-nums">−{mmss(item.remaining_s)}</span>
        )}
      </div>

      <div className="relative aspect-video bg-black flex items-center justify-center">
        {item?.poster
          ? <img src={item.poster} alt="" className="w-full h-full object-cover opacity-90" />
          : <span className="font-mono text-[11px] text-neutral-500 tracking-widest">
              {item ? 'NO POSTER' : '○ EMPTY'}
            </span>}
        {rose && item && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-red-500" style={{ width: `${pct}%` }} />
        )}
      </div>

      <div className="px-3 py-2 min-h-[46px]">
        <div className="text-sm text-neutral-100 truncate">{item?.title || <span className="text-neutral-400">—</span>}</div>
        {item && (
          <div className="font-mono text-[10px] text-neutral-500 mt-0.5 tabular-nums">
            {tone === 'pgm'
              ? `${mmss(item.elapsed_s)} / ${mmss(item.dur_s)} · deck ${item.deck}`
              : `${mmss(item.dur_s)} · deck ${item.deck}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Playout() {
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState('');
  const [state, setState] = useState(null);
  const [media, setMedia] = useState([]);
  const [search, setSearch] = useState('');
  const [asrun, setAsrun] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const armed = useRef(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('broadcast_user') || 'null'); } catch { return null; } })();
  const isSuper = user?.role === 'super_admin' && !user?.studio_id;
  const [studioId, setStudioId] = useState('');
  const [studios, setStudios] = useState([]);
  const qs = isSuper && studioId ? `?studio_id=${encodeURIComponent(studioId)}` : '';

  useEffect(() => {
    if (!isSuper) return;
    api.get('/studios').then(rows => {
      if (Array.isArray(rows) && rows.length) { setStudios(rows); setStudioId(p => p || rows[0].id); }
    }).catch(() => {});
  }, [isSuper]);

  const loadChannels = useCallback(async () => {
    try {
      const d = await api.get(`/playout/channels${qs}`);
      setChannels(d.channels || []);
      setChannelId(prev => prev || d.channels?.[0]?.channel?.id || '');
    } catch (e) { setErr(e.message); }
  }, [qs]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  useEffect(() => {
    api.get(`/media${qs}${qs ? '&' : '?'}ready=1`).then(d => setMedia(d.media || [])).catch(() => {});
  }, [qs]);

  // The poll IS the countdown. 1s, because an operator watching a clock tick in
  // 3-second jumps does not trust it.
  useEffect(() => {
    if (!channelId) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.get(`/playout/channels/${channelId}`);
        if (alive) { setState(s); setErr(''); }
      } catch (e) { if (alive) setErr(e.message); }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const load = () => api.get(`/playout/channels/${channelId}/asrun`).then(d => setAsrun(d.asrun || [])).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [channelId]);

  const act = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const ch = state?.channel;
  const onAir = state?.on_air;
  const cued = state?.cued;
  const items = state?.items || [];
  const auto = ch?.mode === 'AUTO';

  const take = () => act(async () => { setState(await api.post(`/playout/channels/${channelId}/take`, {})); });
  const setMode = (mode) => act(async () => {
    await api.post(`/playout/channels/${channelId}/mode`, { mode });
    setState(await api.get(`/playout/channels/${channelId}`));
  });
  const cart = (mediaId) => act(async () => {
    const r = await api.post(`/playout/channels/${channelId}/cart`, { media_id: mediaId });
    setState(r.state);
  });
  const addToLog = (mediaId) => act(async () => {
    if (!ch?.active_log_id) throw new Error('channel has no active log');
    await api.post(`/playout/logs/${ch.active_log_id}/items`, { source_ref: mediaId });
  });
  const patchItem = (id, body) => act(async () => { await api.patch(`/playout/items/${id}`, body); });

  const filtered = media.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.kind?.includes(search.toLowerCase())
  );

  const nextUp = items.find(i => i.status === 'cued') || items.find(i => i.status === 'pending' && !i.skip);

  return (
    <div className="p-5 space-y-4 text-neutral-200">

      {/* identity — clip/log playout, distinct from the storm -> YouTube Channel surface */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-neutral-100">Playout</h1>
        <span className="text-xs text-neutral-400">Clips &amp; the log — to your screens and channels</span>
        <div className="flex-1" />
        <Link to="/control/gallery" className="text-xs font-mono text-neutral-400 hover:text-sky-300 border border-neutral-800 rounded px-2 py-1 transition-colors">Storm channel &rsaquo;</Link>
      </div>

      {/* status bar — the one line that says whether the channel is alive */}
      <div className="flex items-center gap-4 flex-wrap border border-neutral-800 bg-neutral-950 rounded px-4 py-2.5">
        <span className={`font-mono text-[11px] tracking-widest ${onAir ? 'text-red-400' : 'text-neutral-400'}`}>
          {onAir ? '● ON AIR' : '○ OFF AIR'}
        </span>

        <select
          value={channelId}
          onChange={e => setChannelId(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm"
        >
          {channels.length === 0 && <option value="">no channels</option>}
          {channels.map(c => <option key={c.channel.id} value={c.channel.id}>{c.channel.name}</option>)}
        </select>

        {isSuper && (
          <select value={studioId} onChange={e => { setStudioId(e.target.value); setChannelId(''); }}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400">
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        <div className="flex rounded overflow-hidden border border-neutral-800">
          <button onClick={() => setMode('MAN')} disabled={busy}
            className={`px-3 py-1 font-mono text-[11px] tracking-widest ${!auto ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-500 hover:text-neutral-300'}`}>
            MAN
          </button>
          <button onClick={() => setMode('AUTO')} disabled={busy}
            className={`px-3 py-1 font-mono text-[11px] tracking-widest ${auto ? 'bg-emerald-500 text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'}`}>
            AUTO
          </button>
        </div>

        <span className="font-mono text-[10px] text-neutral-400">
          {ch?.target_type}:{(ch?.target_ref || '—').slice(0, 8)}
        </span>

        {state?.filler_plays > 0 && (
          <span className="font-mono text-[10px] text-amber-400" title="Times the engine had to reach for filler because the next item wasn't ready">
            ⟳ FILLER ×{state.filler_plays}
          </span>
        )}

        <div className="flex-1" />

        {state?.last_error && (
          <span className="font-mono text-[10px] text-amber-400 truncate max-w-md" title={state.last_error}>
            ⚠ {state.last_error}
          </span>
        )}
        {err && <span className="font-mono text-[10px] text-amber-400">{err}</span>}
      </div>

      {/* The storm channel's own controls, folded in: selecting the OBS channel shows
          its stream / show / scene / YouTube controls right here, above the clip decks —
          one surface for the whole physical output. Screen channels don't show it. */}
      {ch?.target_type === 'obs' && <BroadcastPanel />}

      {/* decks + take */}
      <div className="flex gap-4 items-stretch">
        <Deck tone="pgm" tag="PROGRAM" item={onAir} />
        <Deck tone="pvw" tag="PREVIEW" item={cued} ready={cued?.ready} />

        <div className="w-36 flex flex-col gap-2">
          <button
            onClick={take}
            disabled={busy || !cued?.ready}
            title={!cued ? 'nothing cued' : !cued.ready ? 'the cued deck has not finished loading — playout will not take a deck that is not ready' : 'take the cued item to air'}
            className={`flex-1 rounded border font-mono text-sm tracking-widest transition
              ${cued?.ready
                ? 'border-red-600 bg-red-600/90 text-white hover:bg-red-500'
                : 'border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
          >
            TAKE
          </button>
          <button
            onClick={() => act(async () => { await api.post(`/playout/channels/${channelId}/stop`, {}); })}
            disabled={busy || !onAir}
            className="py-2 rounded border border-neutral-800 bg-neutral-950 font-mono text-[10px] tracking-widest text-neutral-500 hover:text-amber-400 hover:border-amber-900"
          >
            STOP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4">

        {/* THE LOG */}
        <div className="border border-neutral-800 bg-neutral-950 rounded">
          <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-widest text-neutral-400">THE LOG</span>
            <span className="font-mono text-[10px] text-neutral-400">
              {items.filter(i => i.status === 'pending').length} to run · {items.filter(i => i.status === 'played').length} played
            </span>
          </div>

          <div className="divide-y divide-neutral-900 max-h-[46vh] overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center font-mono text-[11px] text-neutral-500">
                LOG EMPTY — add media from the library
              </div>
            )}
            {items.map(i => {
              const isOn = i.status === 'on_air';
              const isCued = i.status === 'cued';
              const dead = i.status === 'played' || i.status === 'skipped' || i.skip;
              return (
                <div key={i.id}
                  className={`flex items-center gap-3 px-3 py-1.5 text-sm
                    ${isOn ? 'bg-red-950/30 border-l-2 border-red-600'
                      : isCued ? 'bg-sky-950/20 border-l-2 border-sky-700'
                      : 'border-l-2 border-transparent'}
                    ${dead ? 'opacity-40' : ''}`}>

                  <span className="font-mono text-[10px] text-neutral-400 w-6 tabular-nums">{i.seq}</span>

                  {i.start_mode === 'hard' && (
                    <span className="font-mono text-[9px] text-amber-400 border border-amber-800 rounded px-1"
                      title={`HARD START — must hit ${i.planned_start}. The engine will cut the item before it to make this time.`}>
                      HARD
                    </span>
                  )}
                  {i.start_mode === 'manual' && (
                    <span className="font-mono text-[9px] text-neutral-400 border border-neutral-700 rounded px-1" title="waits for the operator">MAN</span>
                  )}
                  {i.hold ? <span className="font-mono text-[9px] text-amber-300" title="pinned — autopilot may not move or skip it">📌</span> : null}
                  {i.is_break ? <span className="font-mono text-[9px] text-amber-300 border border-amber-800 rounded px-1">BREAK</span> : null}

                  <span className="flex-1 truncate text-neutral-200">{i.title}</span>

                  {i.segue === 'xfade' && (
                    <span className="font-mono text-[9px] text-neutral-500" title={`crossfade, ${i.overlap_s}s overlap`}>
                      ⤫{i.overlap_s}s
                    </span>
                  )}

                  <span className="font-mono text-[10px] text-neutral-500 tabular-nums w-12 text-right">{mmss(i.dur_s)}</span>

                  <span className={`font-mono text-[9px] w-16 text-right tracking-wider
                    ${isOn ? 'text-rose-400' : isCued ? 'text-sky-400'
                      : i.status === 'skipped' || i.status === 'failed' ? 'text-amber-500' : 'text-neutral-400'}`}
                    title={i.fail_reason || ''}>
                    {i.status.toUpperCase()}
                  </span>

                  {!dead && !isOn && (
                    <div className="flex gap-1">
                      <button onClick={() => patchItem(i.id, { hold: !i.hold })}
                        className="font-mono text-[9px] px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-500 hover:text-amber-300 hover:border-amber-800">
                        PIN
                      </button>
                      <button onClick={() => patchItem(i.id, { skip: 1 })}
                        className="font-mono text-[9px] px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-500 hover:text-amber-400 hover:border-amber-900">
                        SKIP
                      </button>
                    </div>
                  )}

                  {i.fail_reason && (
                    <span className="font-mono text-[9px] text-amber-600 max-w-[180px] truncate" title={i.fail_reason}>
                      {i.fail_reason}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {nextUp && (
            <div className="px-3 py-1.5 border-t border-neutral-900 font-mono text-[10px] text-neutral-500">
              NEXT ▸ <span className="text-sky-400">{nextUp.title}</span>
              {auto ? <span className="text-emerald-500 ml-2">autopilot will take it</span>
                    : <span className="text-neutral-400 ml-2">waiting for TAKE</span>}
            </div>
          )}
        </div>

        {/* library + cart wall */}
        <div className="border border-neutral-800 bg-neutral-950 rounded flex flex-col">
          <div className="px-3 py-2 border-b border-neutral-800">
            <span className="font-mono text-[11px] tracking-widest text-neutral-400">LIBRARY</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search…"
              className="mt-2 w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto max-h-[46vh] divide-y divide-neutral-900">
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center font-mono text-[10px] text-neutral-500">
                NOTHING READY — ingest media first
              </div>
            )}
            {filtered.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-900/60">
                {m.poster_url
                  ? <img src={m.poster_url} alt="" className="w-12 h-7 object-cover rounded-sm bg-black" />
                  : <div className="w-12 h-7 rounded-sm bg-neutral-900" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate text-neutral-200">{m.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`font-mono text-[9px] px-1 rounded border ${KIND_TONE[m.kind] || 'text-neutral-500 border-neutral-800'}`}>
                      {m.kind}
                    </span>
                    <span className="font-mono text-[9px] text-neutral-400 tabular-nums">{mmss(m.effective_duration_s)}</span>
                    {!m.master_path && (
                      <span className="font-mono text-[9px] text-amber-600" title="no house master — this item cannot air until it is mastered">
                        NO MASTER
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => addToLog(m.id)} disabled={busy}
                  className="font-mono text-[9px] px-1.5 py-1 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-100">
                  +LOG
                </button>
                <button onClick={() => cart(m.id)} disabled={busy || !m.master_path}
                  title="fire it next — inserts into the log at NOW, so it still lands in the as-run"
                  className="font-mono text-[9px] px-1.5 py-1 border border-amber-900 rounded text-amber-400 hover:bg-amber-600 hover:text-neutral-950 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-amber-400">
                  CART
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* as-run — what ACTUALLY aired */}
      <div className="border border-neutral-800 bg-neutral-950 rounded">
        <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-widest text-neutral-400">AS-RUN</span>
          <span className="font-mono text-[10px] text-neutral-400">what actually aired · last 24h</span>
          <div className="flex-1" />
          <button
            onClick={async () => {
              // Fetch with the auth header, then hand the browser a blob — a plain <a download>
              // can't carry a Bearer token, and this endpoint is (rightly) not public.
              try {
                const res = await fetch(`/api/playout/channels/${channelId}/proof-of-play?format=csv`, {
                  headers: { Authorization: `Bearer ${localStorage.getItem('broadcast_token')}` },
                });
                if (!res.ok) throw new Error(await res.text());
                const url = URL.createObjectURL(await res.blob());
                const a = document.createElement('a');
                a.href = url;
                a.download = `proof-of-play-${(ch?.name || 'channel').replace(/\W+/g, '-')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { setErr(e.message); }
            }}
            disabled={!channelId}
            title="Every break and promo that aired on this channel: when, for how long, and — included, not hidden — the ones that were skipped or failed."
            className="font-mono text-[10px] px-2 py-1 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-100 disabled:opacity-40"
          >
            PROOF OF PLAY ↓ CSV
          </button>
        </div>
        <div className="max-h-40 overflow-y-auto divide-y divide-neutral-900">
          {asrun.length === 0 && (
            <div className="px-3 py-6 text-center font-mono text-[10px] text-neutral-500">NOTHING HAS AIRED YET</div>
          )}
          {asrun.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-1 font-mono text-[10px]">
              <span className="text-neutral-500 tabular-nums">{(r.aired_at || '').slice(11, 19)}</span>
              <span className="flex-1 truncate text-neutral-300">{r.media_name || r.title}</span>
              {r.is_break ? <span className="text-amber-400">BREAK</span> : null}
              <span className="text-neutral-400 tabular-nums w-14 text-right">
                {r.actual_dur_s ? `${r.actual_dur_s.toFixed(1)}s` : '—'}
              </span>
              <span className={r.status === 'played' ? 'text-emerald-600' : 'text-rose-500'}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
