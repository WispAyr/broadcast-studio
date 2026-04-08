import React, { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api';

export default function CueList({ layouts, onPushLayout, collapsed: controlledCollapsed, setCollapsed: controlledSetCollapsed, transitionType, transitionDuration, compact = false, inShell = false }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const setCollapsed = controlledSetCollapsed || setInternalCollapsed;
  const [cueLists, setCueLists] = useState([]);
  const [activeCueList, setActiveCueList] = useState(null);
  const [currentCueIndex, setCurrentCueIndex] = useState(-1);
  const [autoRun, setAutoRun] = useState(false);
  const [newCueName, setNewCueName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const autoRunTimerRef = useRef(null);

  const studioId = JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || 'default';

  useEffect(() => {
    fetchCueLists();
  }, []);

  useEffect(() => {
    if (!autoRun || !activeCueList) return;
    const cues = activeCueList.cues || [];
    const currentCue = cues[currentCueIndex];
    if (!currentCue?.autoAdvance || !currentCue?.autoAdvanceTime) return;

    autoRunTimerRef.current = setTimeout(() => {
      goNext();
    }, currentCue.autoAdvanceTime * 1000);

    return () => clearTimeout(autoRunTimerRef.current);
  }, [autoRun, currentCueIndex, activeCueList]);

  async function fetchCueLists() {
    try {
      const data = await api.get(`/cues?studio_id=${studioId}`);
      setCueLists(Array.isArray(data) ? data : data?.cueLists || []);
    } catch { /* ignore */ }
  }

  async function createCueList() {
    if (!newCueName.trim()) return;
    try {
      const data = await api.post('/cues', { studio_id: studioId, name: newCueName, cues: [] });
      setNewCueName('');
      fetchCueLists();
      if (data?.id) setActiveCueList({ id: data.id, name: newCueName, cues: [] });
    } catch (e) { alert('Failed: ' + e.message); }
  }

  async function saveCueList() {
    if (!activeCueList) return;
    try {
      await api.put(`/cues/${activeCueList.id}`, { name: activeCueList.name, cues: activeCueList.cues });
    } catch (e) { alert('Save failed: ' + e.message); }
  }

  function addCue() {
    if (!activeCueList) return;
    const cue = {
      id: Date.now().toString(),
      name: `Cue ${(activeCueList.cues?.length || 0) + 1}`,
      layoutId: layouts[0]?.id || '',
      transition: transitionType,
      duration: transitionDuration,
      autoAdvance: false,
      autoAdvanceTime: 5,
    };
    setActiveCueList(prev => ({ ...prev, cues: [...(prev.cues || []), cue] }));
  }

  function updateCue(index, updates) {
    setActiveCueList(prev => {
      const cues = [...(prev.cues || [])];
      cues[index] = { ...cues[index], ...updates };
      return { ...prev, cues };
    });
  }

  function removeCue(index) {
    setActiveCueList(prev => {
      const cues = [...(prev.cues || [])];
      cues.splice(index, 1);
      return { ...prev, cues };
    });
  }

  function goNext() {
    if (!activeCueList) return;
    const cues = activeCueList.cues || [];
    const next = Math.min(currentCueIndex + 1, cues.length - 1);
    setCurrentCueIndex(next);
    const cue = cues[next];
    if (cue?.layoutId) onPushLayout(cue.layoutId, cue.transition || transitionType, cue.duration || transitionDuration);
  }

  function goPrev() {
    if (!activeCueList) return;
    const prev = Math.max(currentCueIndex - 1, 0);
    setCurrentCueIndex(prev);
    const cue = (activeCueList.cues || [])[prev];
    if (cue?.layoutId) onPushLayout(cue.layoutId, cue.transition || transitionType, cue.duration || transitionDuration);
  }

  function goToCue(index) {
    setCurrentCueIndex(index);
    const cue = (activeCueList.cues || [])[index];
    if (cue?.layoutId) onPushLayout(cue.layoutId, cue.transition || transitionType, cue.duration || transitionDuration);
  }

  return (
    <div className={`bg-gray-900/80 border border-gray-800 rounded-xl transition-all ${collapsed ? 'w-10' : 'w-72'}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-2 py-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1"
      >
        {collapsed ? '▶' : '◀'} {!collapsed && 'Cue List'}
      </button>

      {!collapsed && (
        <div className="px-2 pb-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Cue list selector */}
          {!activeCueList ? (
            <>
              {cueLists.map(cl => (
                <button key={cl.id} onClick={() => { setActiveCueList(cl); setCurrentCueIndex(-1); }}
                  className="w-full text-left px-2 py-1.5 bg-gray-800/60 hover:bg-gray-700/60 rounded-lg text-sm text-gray-300 transition-colors">
                  {cl.name}
                </button>
              ))}
              <div className="flex gap-1">
                <input value={newCueName} onChange={e => setNewCueName(e.target.value)}
                  placeholder="New cue list..." className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                  onKeyDown={e => e.key === 'Enter' && createCueList()} />
                <button onClick={createCueList} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded">+</button>
              </div>
            </>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-1">
                <button onClick={() => { saveCueList(); setActiveCueList(null); }}
                  className="text-gray-500 hover:text-white text-xs">← Back</button>
                <span className="flex-1 text-white text-xs font-semibold truncate">{activeCueList.name}</span>
                <button onClick={saveCueList} className="text-blue-400 hover:text-blue-300 text-[10px]">Save</button>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button onClick={goPrev} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded">⏮ Prev</button>
                <button onClick={goNext} className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded font-bold">Next ⏭</button>
                <button onClick={() => setAutoRun(!autoRun)}
                  className={`px-2 py-1 text-xs rounded font-medium ${autoRun ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                  {autoRun ? '⏸ Auto' : '▶ Auto'}
                </button>
                <button onClick={addCue} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded ml-auto">+ Cue</button>
              </div>

              {/* Cue items */}
              {(activeCueList.cues || []).map((cue, i) => (
                <div key={cue.id}
                  onClick={() => goToCue(i)}
                  className={`px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-xs ${
                    i === currentCueIndex
                      ? 'bg-green-900/40 border-green-600/50 text-green-300'
                      : 'bg-gray-800/40 border-gray-700/30 text-gray-400 hover:bg-gray-800/70'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono w-4">{i + 1}</span>
                    <input value={cue.name} onClick={e => e.stopPropagation()}
                      onChange={e => updateCue(i, { name: e.target.value })}
                      className="flex-1 bg-transparent text-inherit text-xs border-none outline-none" />
                    <button onClick={e => { e.stopPropagation(); removeCue(i); }}
                      className="text-red-600 hover:text-red-400 text-[10px]">✕</button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <select value={cue.layoutId} onClick={e => e.stopPropagation()}
                      onChange={e => updateCue(i, { layoutId: e.target.value })}
                      className="flex-1 bg-gray-800 text-gray-300 text-[10px] rounded px-1 py-0.5 border-none">
                      {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <label className="flex items-center gap-0.5 text-[10px] text-gray-500">
                      <input type="checkbox" checked={cue.autoAdvance || false}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateCue(i, { autoAdvance: e.target.checked })} />
                      Auto
                    </label>
                    {cue.autoAdvance && (
                      <input type="number" value={cue.autoAdvanceTime || 5} min={1} max={300}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateCue(i, { autoAdvanceTime: parseInt(e.target.value) })}
                        className="w-10 bg-gray-800 text-gray-300 text-[10px] rounded px-1 py-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
