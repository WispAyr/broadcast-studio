import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Clocks — the hour, as a shape.
//
// A clock is a wheel of slots: "an ident at the top, a segment, a break at 15,
// filler to the end." It does not play anything. It BUILDS A LOG, and the log plays.
// That separation is what keeps one runtime and one as-run — and it means the
// operator can look at the hour the clock produced, and change it, before it airs.
//
// A slot either names a specific clip or names a KIND ("give me an ident"), in which
// case the clock picks the least-recently-played one that can actually air. That's
// what stops the same sting running four times in an hour, and it's why an expired
// sponsor spot simply stops being scheduled instead of needing someone to remember it.
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_KINDS = ['segment', 'ident', 'bumper', 'sting', 'break', 'filler', 'junction', 'promo', 'vt'];

const KIND_TONE = {
  junction: 'text-amber-300 border-amber-700 bg-amber-950/40',
  break:    'text-amber-300 border-amber-800 bg-amber-950/30',
  ident:    'text-violet-300 border-violet-800 bg-violet-950/30',
  bumper:   'text-violet-300 border-violet-800 bg-violet-950/30',
  sting:    'text-violet-300 border-violet-800 bg-violet-950/30',
  filler:   'text-neutral-400 border-neutral-700 bg-neutral-900/50',
  segment:  'text-sky-300 border-sky-800 bg-sky-950/30',
  vt:       'text-sky-300 border-sky-800 bg-sky-950/30',
};

const mmss = (s) => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String(Math.round((s || 0) % 60)).padStart(2, '0')}`;

export default function Clocks() {
  const [clocks, setClocks] = useState([]);
  const [sel, setSel] = useState(null);
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState('');
  const [built, setBuilt] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

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
      const d = await api.get(`/playout/clocks${qs}`);
      setClocks(d.clocks || []);
      setSel(s => (s ? (d.clocks || []).find(c => c.id === s.id) || null : null));
      const ch = await api.get(`/playout/channels${qs}`);
      setChannels(ch.channels || []);
      setChannelId(p => p || ch.channels?.[0]?.channel?.id || '');
    } catch (e) { setMsg(e.message); }
  }, [qs]);

  useEffect(() => { load(); setBuilt(null); }, [load]);

  const act = async (fn) => {
    setBusy(true); setMsg('');
    try { await fn(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const create = () => act(async () => {
    const name = prompt('Clock name (e.g. "FanZone Hour")');
    if (!name) return;
    await api.post(`/playout/clocks${qs}`, { name, wheel: [{ at_s: 0, kind: 'junction' }] });
    await load();
  });

  const save = (wheel) => act(async () => {
    await api.put(`/playout/clocks/${sel.id}`, { wheel });
    setSel({ ...sel, wheel });
    await load();
  });

  const addSlot = () => {
    const last = sel.wheel[sel.wheel.length - 1];
    save([...sel.wheel, { at_s: (last?.at_s || 0) + 60, kind: 'segment' }]);
  };
  const patchSlot = (i, patch) => save(sel.wheel.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const delSlot = (i) => save(sel.wheel.filter((_, j) => j !== i));

  const build = (activate) => act(async () => {
    setBuilt(null);
    const r = await api.post(`/playout/clocks/${sel.id}/build`, { channel_id: channelId, activate });
    setBuilt(r);
    setMsg(activate ? 'built and armed on the channel' : 'built as a draft log');
  });

  const totalRun = (built?.items || []).reduce((a, i) => a + (i.dur_s || 0), 0);

  return (
    <div className="p-5 text-neutral-200 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg text-neutral-100">Clocks</h1>
        <span className="font-mono text-[10px] text-neutral-400">a clock builds an hour — the log plays it</span>
        <div className="flex-1" />
        {isSuper && (
          <select value={studioId} onChange={e => { setStudioId(e.target.value); setSel(null); }}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-400">
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button onClick={create} disabled={busy}
          className="font-mono text-[10px] px-3 py-1.5 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-100">
          + NEW CLOCK
        </button>
      </div>

      {msg && <div className="font-mono text-[11px] text-neutral-400">{msg}</div>}

      <div className="grid grid-cols-[220px_1fr] gap-4">

        {/* the clocks */}
        <div className="border border-neutral-800 bg-neutral-950 rounded divide-y divide-neutral-900">
          {clocks.length === 0 && (
            <div className="px-3 py-8 text-center font-mono text-[10px] text-neutral-500">NO CLOCKS YET</div>
          )}
          {clocks.map(c => (
            <button key={c.id} onClick={() => { setSel(c); setBuilt(null); }}
              className={`w-full text-left px-3 py-2 hover:bg-neutral-900 ${sel?.id === c.id ? 'bg-neutral-900 border-l-2 border-sky-600' : 'border-l-2 border-transparent'}`}>
              <div className="text-sm text-neutral-100">{c.name}</div>
              <div className="font-mono text-[10px] text-neutral-400">{c.wheel.length} slot{c.wheel.length === 1 ? '' : 's'}</div>
            </button>
          ))}
        </div>

        {/* the wheel */}
        <div className="border border-neutral-800 bg-neutral-950 rounded">
          {!sel ? (
            <div className="py-24 text-center font-mono text-[11px] text-neutral-500">
              PICK A CLOCK, OR MAKE ONE
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-neutral-100">{sel.name}</span>
                <span className="font-mono text-[10px] text-neutral-400">THE WHEEL</span>
                <div className="flex-1" />
                <button onClick={addSlot} disabled={busy}
                  className="font-mono text-[10px] px-2 py-1 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-100">
                  + SLOT
                </button>
              </div>

              <div className="divide-y divide-neutral-900">
                {sel.wheel.length === 0 && (
                  <div className="px-3 py-8 text-center font-mono text-[10px] text-neutral-500">EMPTY WHEEL</div>
                )}
                {[...sel.wheel].sort((a, b) => (a.at_s || 0) - (b.at_s || 0)).map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <input
                      type="number" min="0" step="1"
                      value={slot.at_s ?? 0}
                      onChange={e => patchSlot(i, { at_s: Number(e.target.value) })}
                      title="seconds from the top of the hour"
                      className="w-20 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm tabular-nums"
                    />
                    <span className="font-mono text-[10px] text-neutral-400 w-12">{mmss(slot.at_s)}</span>

                    <select value={slot.kind} onChange={e => patchSlot(i, { kind: e.target.value })}
                      className={`bg-neutral-900 border rounded px-2 py-1 text-xs font-mono ${KIND_TONE[slot.kind] || 'border-neutral-800 text-neutral-300'}`}>
                      {SLOT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>

                    {slot.kind === 'junction' ? (
                      <span className="font-mono text-[9px] text-amber-400 border border-amber-800 rounded px-1"
                        title="A junction is a TIME you must hit. The engine will cut the item before it to make this time.">
                        HARD
                      </span>
                    ) : (
                      <label className="flex items-center gap-1 font-mono text-[9px] text-neutral-500">
                        <input type="checkbox" checked={!!slot.hard}
                          onChange={e => patchSlot(i, { hard: e.target.checked })} />
                        hard
                      </label>
                    )}

                    <select value={slot.segue || 'cut'} onChange={e => patchSlot(i, { segue: e.target.value })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-xs font-mono text-neutral-400">
                      <option value="cut">cut</option>
                      <option value="xfade">xfade</option>
                    </select>
                    {slot.segue === 'xfade' && (
                      <input type="number" min="0" step="0.5" value={slot.overlap_s ?? 2}
                        onChange={e => patchSlot(i, { overlap_s: Number(e.target.value) })}
                        title="overlap in seconds"
                        className="w-14 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-xs tabular-nums" />
                    )}

                    <div className="flex-1" />
                    <span className="font-mono text-[9px] text-neutral-400">
                      {slot.ref ? 'fixed clip' : 'picks the least-recently-played'}
                    </span>
                    <button onClick={() => delSlot(i)}
                      className="font-mono text-[10px] text-neutral-400 hover:text-rose-400 px-1">✕</button>
                  </div>
                ))}
              </div>

              {/* build it */}
              <div className="px-3 py-2.5 border-t border-neutral-800 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-neutral-500">BUILD ONTO</span>
                <select value={channelId} onChange={e => setChannelId(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm">
                  {channels.length === 0 && <option value="">no channels</option>}
                  {channels.map(c => <option key={c.channel.id} value={c.channel.id}>{c.channel.name}</option>)}
                </select>
                <button onClick={() => build(false)} disabled={busy || !channelId}
                  className="font-mono text-[10px] px-3 py-1.5 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-100 disabled:opacity-40">
                  BUILD DRAFT
                </button>
                <button onClick={() => build(true)} disabled={busy || !channelId}
                  title="Build the hour AND make it the channel's active log. Nothing airs until the channel is taken or put in AUTO."
                  className="font-mono text-[10px] px-3 py-1.5 border border-sky-800 rounded text-sky-300 hover:bg-sky-950 disabled:opacity-40">
                  BUILD + ARM ▸
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* what the clock produced */}
      {built && (
        <div className="border border-neutral-800 bg-neutral-950 rounded">
          <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-widest text-neutral-400">THE HOUR IT BUILT</span>
            <span className="font-mono text-[10px] text-neutral-400">
              starts {String(built.starts_at).slice(11, 16)} · {built.items.length} items · runs {mmss(totalRun)}
            </span>
          </div>

          <div className="divide-y divide-neutral-900">
            {built.items.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="font-mono text-[10px] text-neutral-400 w-6 tabular-nums">{i.seq}</span>
                <span className={`font-mono text-[9px] px-1 rounded border ${KIND_TONE[i.kind] || 'text-neutral-500 border-neutral-800'}`}>
                  {i.kind}
                </span>
                {i.hard && (
                  <span className="font-mono text-[9px] text-amber-400 border border-amber-800 rounded px-1"
                    title={`must start at ${i.planned_start}`}>
                    HARD {String(i.planned_start).slice(11, 19)}
                  </span>
                )}
                <span className="flex-1 truncate text-neutral-200">{i.title}</span>
                <span className="font-mono text-[10px] text-neutral-500 tabular-nums">{mmss(i.dur_s)}</span>
              </div>
            ))}
          </div>

          {/* The warnings are the important half of this response. A slot the clock could
              not fill is a hole in the hour, and it has to be seen NOW — not discovered
              as a dead deck at :47. */}
          {built.warnings?.length > 0 && (
            <div className="px-3 py-2 border-t border-amber-950 bg-amber-950/20 space-y-1">
              {built.warnings.map((w, i) => (
                <div key={i} className="font-mono text-[10px] text-amber-400">⚠ {w}</div>
              ))}
            </div>
          )}
          {built.warnings?.length === 0 && (
            <div className="px-3 py-2 border-t border-neutral-900 font-mono text-[10px] text-emerald-600">
              ✓ every slot filled
            </div>
          )}
        </div>
      )}
    </div>
  );
}
