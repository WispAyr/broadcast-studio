import React, { useState } from 'react';
import { connectSocket } from '../../../lib/socket';
import { FACTS, QUICK_STATS } from '../../../data/matchInfo';

// GFX panel — fire "Did You Know" facts + quick-stat lower-thirds over the match.
// Uses the `fact` overlay (label + text band). hold = stay until cleared.

export default function GfxPanel({ studioId, screens = [], inShell }) {
  const [target, setTarget] = useState('studio');
  const [hold, setHold] = useState(false);
  const tgt = () => (target === 'studio' ? { studioId } : { screenId: target, studioId });

  const fire = (label, text) => {
    connectSocket().emit('push_overlay', { ...tgt(), overlay: { type: 'fact', label, text, duration: hold ? undefined : 14 } });
  };
  const nowPlaying = () => connectSocket().emit('push_overlay', { ...tgt(), overlay: { type: 'now_playing_l3', stationId: 7719 } });
  const clear = () => {
    const s = connectSocket();
    ['fact', 'now_playing_l3'].forEach((t) => s.emit('remove_overlay', { ...tgt(), overlayType: t }));
  };

  const body = (
    <div className="p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">Target</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}
          className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs">
          <option value="studio">All screens</option>
          {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} className="accent-purple-500" /> hold
        </label>
        <button onClick={clear} className="px-2 py-1 rounded text-[10px] font-bold bg-red-600/30 text-red-400 hover:bg-red-600/50">CLEAR</button>
      </div>

      <button onClick={nowPlaying}
        className="w-full text-left px-3 py-2 rounded-md bg-purple-700/40 hover:bg-purple-600/60 transition-colors flex items-center gap-2">
        <span className="text-base">♪</span>
        <span className="text-[12px] text-white font-semibold">Now Playing lower-third</span>
        <span className="ml-auto text-[9px] text-purple-300">stays until CLEAR</span>
      </button>

      <div className="text-[10px] uppercase tracking-wider text-amber-400/80">Quick stats</div>
      <div className="grid grid-cols-1 gap-1">
        {QUICK_STATS.map((s, i) => (
          <button key={i} onClick={() => fire(s.label, s.text)}
            className="text-left px-2 py-1.5 rounded-md bg-indigo-900/30 hover:bg-indigo-800/50 transition-colors">
            <div className="text-[9px] uppercase tracking-wider text-amber-300/80">{s.label}</div>
            <div className="text-[11px] text-white truncate">{s.text}</div>
          </button>
        ))}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-amber-400/80 pt-1">Did You Know</div>
      <div className="space-y-1 max-h-[34vh] overflow-y-auto pr-1">
        {FACTS.map((f, i) => (
          <button key={i} onClick={() => fire('DID YOU KNOW', f)}
            className="w-full text-left px-2 py-1.5 rounded-md bg-gray-800/40 hover:bg-gray-700/60 text-[11px] text-gray-200 leading-snug transition-colors">
            {f}
          </button>
        ))}
      </div>
    </div>
  );
  return inShell ? body : body;
}
