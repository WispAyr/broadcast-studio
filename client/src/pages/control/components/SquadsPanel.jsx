import React, { useState } from 'react';
import { connectSocket } from '../../../lib/socket';
import { SCOTLAND, HAITI } from '../../../data/squads';

// Squads panel — fire a player PROFILE or a GOALSCORER graphic over the screens.
// Reuses the overlay system: push_overlay { type: 'player_profile' | 'goal', player, minute, duration }.
// Click "Profile" for a player feature; "⚽" to bring up the goal graphic when they score.

const ini = (n) => n.split(' ').map((w) => w[0]).slice(-2).join('');

export default function SquadsPanel({ studioId, screens = [], inShell }) {
  const [target, setTarget] = useState('studio');
  const [tab, setTab] = useState('SCO');
  const [minute, setMinute] = useState('');
  const [hold, setHold] = useState(false); // hold = stay on screen until cleared
  const [l3, setL3] = useState(true); // lower-third (overlay match) vs full-screen

  const tgt = () => (target === 'studio' ? { studioId } : { screenId: target, studioId });
  const players = tab === 'HAI' ? HAITI : SCOTLAND;
  const tint = tab === 'HAI' ? '#101a5c' : '#0a2a66';

  const fire = (player, type) => {
    const s = connectSocket();
    s.emit('push_overlay', {
      ...tgt(),
      overlay: {
        type, player,
        layout: l3 ? 'lower' : 'full',
        minute: type === 'goal' && minute ? Number(minute) : undefined,
        sound: type === 'goal' ? `/uploads/${studioId}/goal.mp3` : undefined,
        duration: hold ? undefined : (type === 'goal' ? 12 : 14),
      },
    });
  };
  const clear = () => {
    const s = connectSocket();
    s.emit('remove_overlay', { ...tgt(), overlayType: 'goal' });
    s.emit('remove_overlay', { ...tgt(), overlayType: 'player_profile' });
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
        <button onClick={clear} className="px-2 py-1 rounded text-[10px] font-bold bg-red-600/30 text-red-400 hover:bg-red-600/50">CLEAR</button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-md overflow-hidden border border-gray-700">
          {['SCO', 'HAI'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-bold ${tab === t ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{t}</button>
          ))}
        </div>
        <input value={minute} onChange={(e) => setMinute(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="min'"
          className="w-14 px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs" title="Goal minute (optional)" />
        <div className="flex rounded-md overflow-hidden border border-gray-700 ml-auto">
          {[['L3', true], ['Full', false]].map(([lbl, v]) => (
            <button key={lbl} onClick={() => setL3(v)}
              className={`px-2 py-1 text-[10px] font-bold ${l3 === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{lbl}</button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
          <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} className="accent-purple-500" /> hold
        </label>
      </div>

      <div className="space-y-1 max-h-[42vh] overflow-y-auto pr-1">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-gray-800/40 px-2 py-1">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: tint }}>
              {p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" style={{ objectPosition: 'top center' }} /> : (p.number ?? ini(p.name))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white font-medium truncate leading-tight">{p.name}</div>
              <div className="text-[10px] text-gray-500 truncate">{p.pos} · {p.club}{p.role ? ` · ${p.role}` : ''}</div>
            </div>
            <button onClick={() => fire(p, 'player_profile')} title="Show profile"
              className="px-2 py-1 rounded text-[10px] font-semibold bg-gray-700/70 text-gray-200 hover:bg-gray-600">Profile</button>
            <button onClick={() => fire(p, 'goal')} title="Goal graphic"
              className="px-2 py-1 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/40">⚽</button>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-gray-600">Tip: set the minute, hit ⚽ when they score. “hold” keeps it up until you press CLEAR.</p>
    </div>
  );
  return inShell ? body : body;
}
