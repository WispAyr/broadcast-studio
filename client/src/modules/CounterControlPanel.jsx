import React, { useState, useEffect } from 'react';

function RouteStatsControl() {
  const [mighty, setMighty] = useState(0);
  const [big, setBig] = useState(0);
  const [wee, setWee] = useState(0);
  const [pace, setPace] = useState(0);
  const [pushed, setPushed] = useState('');

  const total = mighty + big + wee;
  const registered = 10000;
  const pct = Math.round((total / registered) * 100);

  const pushRoutes = async () => {
    try {
      await fetch('/api/modules/kiltwalk-route-progress/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routes: [
            { name: 'Mighty Stride', distance: '23 miles', registered: 2500, finished: mighty, color: '#e63b2b', start: 'Glasgow Green' },
            { name: 'Big Stroll', distance: '14.5 miles', registered: 4000, finished: big, color: '#008bc7', start: 'Clydebank' },
            { name: 'Wee Wander', distance: '3 miles', registered: 3500, finished: wee, color: '#006a47', start: 'Loch Lomond' },
          ],
        }),
      });
      await fetch('/api/modules/kiltwalk-hourly-stats/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thisHour: pace, percentComplete: pct, projectedTotal: registered }),
      });
      setPushed(`Pushed: ${total} finishers, ${pct}%, ${pace}/hr`);
    } catch (e) {
      setPushed(`Error: ${e.message}`);
    }
  };

  const presets = [
    { label: 'Early (10%)', m: 100, b: 200, w: 100, p: 80 },
    { label: 'Mid (30%)', m: 400, b: 1200, w: 800, p: 180 },
    { label: 'Peak (60%)', m: 1200, b: 2800, w: 2500, p: 320 },
    { label: 'Late (85%)', m: 2000, b: 3600, w: 3200, p: 150 },
    { label: 'Done (98%)', m: 2450, b: 3900, w: 3450, p: 40 },
  ];

  return (
    <div className="mt-6 pt-6 border-t border-gray-800">
      <h4 className="text-sm font-bold text-white mb-3">🗺️ Route Progress & Stats</h4>

      {/* Quick presets */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {presets.map(p => (
          <button key={p.label} onClick={() => { setMighty(p.m); setBig(p.b); setWee(p.w); setPace(p.p); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-all">
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-red-400 font-bold uppercase block mb-1">Mighty Stride</label>
          <input type="number" value={mighty} onChange={e => setMighty(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-center font-bold border border-red-900 focus:border-red-500 outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-blue-400 font-bold uppercase block mb-1">Big Stroll</label>
          <input type="number" value={big} onChange={e => setBig(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-center font-bold border border-blue-900 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-green-400 font-bold uppercase block mb-1">Wee Wander</label>
          <input type="number" value={wee} onChange={e => setWee(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-center font-bold border border-green-900 focus:border-green-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-amber-400 font-bold uppercase block mb-1">Pace /hour</label>
          <input type="number" value={pace} onChange={e => setPace(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-center font-bold border border-amber-900 focus:border-amber-500 outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Total</label>
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-white text-center font-bold border border-gray-700">
            {total.toLocaleString()}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Overall %</label>
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-center font-bold border border-gray-700"
            style={{ color: pct > 75 ? '#22c55e' : pct > 40 ? '#f8af35' : '#ffffff' }}>
            {pct}%
          </div>
        </div>
      </div>

      <button onClick={pushRoutes}
        className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #008bc7, #006a47)' }}>
        📡 Push to All Screens
      </button>
      {pushed && <span className="text-xs text-gray-500 mt-2 block text-center">{pushed}</span>}
    </div>
  );
}

export default function CounterControlPanel({ socket, studioId }) {
  const [count, setCount] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [bumpAmount, setBumpAmount] = useState(10);
  const [lastAction, setLastAction] = useState('');
  const moduleId = 'kiltwalk-finisher-counter';

  useEffect(() => {
    fetch(`/api/counter/${moduleId}`)
      .then(r => r.json())
      .then(d => setCount(d.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onUpdate({ moduleId: mid, config }) {
      if (mid === moduleId && config?.count != null) setCount(config.count);
    }
    socket.on('update_module_config', onUpdate);
    return () => socket.off('update_module_config', onUpdate);
  }, [socket]);

  const doAction = async (action, body = {}) => {
    try {
      const r = await fetch(`/api/counter/${moduleId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setCount(d.count);
      setLastAction(`${action} → ${d.count}`);
    } catch (e) {
      setLastAction(`Error: ${e.message}`);
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">🏁 Finisher Counter</h3>
          <span className="text-xs text-gray-500">Live — updates all screens instantly</span>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-amber-400 tabular-nums">{count.toLocaleString()}</div>
          <span className="text-xs text-gray-500">current count</span>
        </div>
      </div>

      {/* Quick bump */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[1, 5, 10, 50, 100].map(n => (
          <button key={n} onClick={() => doAction('bump', { delta: n })}
            className="py-3 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #e63b2b, #c42d1f)' }}>
            +{n}
          </button>
        ))}
      </div>

      {/* Custom bump */}
      <div className="flex gap-2 mb-4">
        <input type="number" value={bumpAmount} onChange={e => setBumpAmount(parseInt(e.target.value) || 0)}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-white text-center font-bold border border-gray-700 focus:border-amber-500 outline-none"
          placeholder="Custom" />
        <button onClick={() => doAction('bump', { delta: bumpAmount })}
          className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all">
          Bump +{bumpAmount}
        </button>
      </div>

      {/* Set exact */}
      <div className="flex gap-2 mb-4">
        <input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-white text-center font-bold border border-gray-700 focus:border-amber-500 outline-none"
          placeholder="Set exact count..." />
        <button onClick={() => { doAction('set', { value: parseInt(inputValue) || 0 }); setInputValue(''); }}
          className="px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">
          Set
        </button>
      </div>

      {/* Milestones */}
      <div className="mb-4">
        <span className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Quick milestones</span>
        <div className="flex gap-2 flex-wrap">
          {[500, 1000, 1500, 2000, 2500, 3000, 5000].map(n => (
            <button key={n} onClick={() => doAction('set', { value: n })}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 ${
                count >= n ? 'bg-gray-800 text-gray-500' : 'bg-gray-800 text-amber-400 border border-amber-400/20 hover:bg-amber-400/10'
              }`}>
              {n.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <button onClick={() => { if (confirm('Reset counter to 0?')) doAction('reset'); }}
          className="px-4 py-2 rounded-lg text-sm font-bold text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-all">
          ↺ Reset to 0
        </button>
        {lastAction && <span className="text-xs text-gray-600">{lastAction}</span>}
      </div>

      {/* Route Progress Controls */}
      <RouteStatsControl />
    </div>
  );
}
