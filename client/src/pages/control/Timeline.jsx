import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

export default function Timeline() {
  const toast = useToast();
  const [activeShow, setActiveShow] = useState(null);
  const [shows, setShows] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTime, setNewTime] = useState('');
  const [newLayoutId, setNewLayoutId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [overrideLayoutId, setOverrideLayoutId] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timelineState, setTimelineState] = useState(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchData() {
    try {
      const [showsData, layoutsData] = await Promise.all([
        api.get('/shows'),
        api.get('/layouts')
      ]);
      const allShows = showsData.shows || showsData || [];
      setShows(allShows);
      setLayouts(layoutsData.layouts || layoutsData || []);

      const active = allShows.find((s) => s.active || s.is_active);
      if (active) {
        setActiveShow(active);
        const tl = typeof active.timeline === 'string' ? JSON.parse(active.timeline) : (active.timeline || []);
        setTimeline(tl);
      }

      // Fetch timeline state
      try {
        const state = await api.get('/timeline/current');
        setTimelineState(state);
      } catch {
        // Timeline endpoint may require studio_id
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function saveTimeline(newTimeline) {
    if (!activeShow) return;
    try {
      await api.put(`/shows/${activeShow.id}`, { timeline: newTimeline });
      setTimeline(newTimeline);
    } catch (err) {
      toast?.(`Save timeline failed: ${err.message}`, 'error');
    }
  }

  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function addEntry() {
    if (!newTime || !newLayoutId) return;
    if (!TIME_RE.test(newTime)) {
      toast?.('Time must be HH:MM (00:00–23:59)', 'warning');
      return;
    }
    const layout = layouts.find((l) => l.id === newLayoutId);
    const entry = {
      time: newTime,
      layout_id: newLayoutId,
      layout_name: layout ? layout.name : 'Unknown',
      label: newLabel || (layout ? layout.name : '')
    };
    const newTimeline = [...timeline, entry].sort((a, b) => a.time.localeCompare(b.time));
    saveTimeline(newTimeline);
    setNewTime('');
    setNewLayoutId('');
    setNewLabel('');
  }

  function removeEntry(index) {
    const newTimeline = timeline.filter((_, i) => i !== index);
    saveTimeline(newTimeline);
  }

  // Reorder entries sharing the same time (e.g. two cues both at 10:00).
  // Timeline is sorted by time, so swap only works within equal-time runs.
  function moveEntry(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= timeline.length) return;
    if (timeline[index].time !== timeline[target].time) return;
    const next = [...timeline];
    [next[index], next[target]] = [next[target], next[index]];
    saveTimeline(next);
  }

  async function handleOverride() {
    if (!overrideLayoutId) return;
    try {
      await api.post('/timeline/override', { layout_id: overrideLayoutId });
      toast?.('Automation overridden', 'success');
      setIsOverriding(true);
    } catch (err) {
      toast?.(`Override failed: ${err.message}`, 'error');
    }
  }

  async function handleResumeAutomation() {
    try {
      await api.post('/timeline/resume', {});
      toast?.('Automation resumed', 'success');
      setIsOverriding(false);
      setOverrideLayoutId('');
      fetchData();
    } catch (err) {
      toast?.(`Resume failed: ${err.message}`, 'error');
    }
  }

  async function handleActivateShow(showId) {
    try {
      await api.post(`/shows/${showId}/activate`);
      toast?.('Show activated', 'success');
      fetchData();
    } catch (err) {
      toast?.(`Activate failed: ${err.message}`, 'error');
    }
  }

  async function handleDeactivateShow(showId) {
    try {
      await api.post(`/shows/${showId}/deactivate`);
      toast?.('Show deactivated', 'success');
      setActiveShow(null);
      setTimeline([]);
      setIsOverriding(false);
      fetchData();
    } catch (err) {
      toast?.(`Deactivate failed: ${err.message}`, 'error');
    }
  }

  function getCurrentTimePosition() {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    return ((hours * 60 + minutes) / (24 * 60)) * 100;
  }

  function getTimePosition(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return ((h * 60 + m) / (24 * 60)) * 100;
  }

  function getLayoutName(layoutId) {
    const layout = layouts.find((l) => l.id === layoutId);
    return layout ? layout.name : 'Unknown';
  }

  // Determine current active entry
  const nowTime = currentTime.toTimeString().slice(0, 5);
  let currentEntry = null;
  for (const entry of timeline) {
    if (entry.time <= nowTime) currentEntry = entry;
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading timeline...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Timeline</h1>
          {activeShow ? (
            <p className="text-gray-400 mt-1">
              Active show: <span className="text-green-400">{activeShow.name}</span>
            </p>
          ) : (
            <p className="text-gray-400 mt-1">No active show</p>
          )}
        </div>
        <div className="flex gap-3">
          {isOverriding ? (
            <button
              onClick={handleResumeAutomation}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Resume Automation
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={overrideLayoutId}
                onChange={(e) => setOverrideLayoutId(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Override layout...</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button
                onClick={handleOverride}
                disabled={!overrideLayoutId}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Manual Override
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Show selector (if no active show) */}
      {!activeShow && shows.length > 0 && (
        <div className="mb-8 bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Activate a Show
          </h3>
          <div className="space-y-2">
            {shows.map((show) => (
              <div key={show.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div>
                  <span className="text-white font-medium">{show.name}</span>
                  {show.description && (
                    <p className="text-gray-500 text-xs mt-0.5">{show.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleActivateShow(show.id)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Activate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeShow && (
        <>
          {/* Current Time + Status */}
          <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Current Time:</span>
                <span className="text-white text-lg font-mono">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>
              {currentEntry && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Now playing:</span>
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-full">
                    {currentEntry.label || currentEntry.layout_name || getLayoutName(currentEntry.layout_id)}
                  </span>
                </div>
              )}
              {isOverriding && (
                <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded-full">
                  Manual Override Active
                </span>
              )}
              <button
                onClick={() => handleDeactivateShow(activeShow.id)}
                className="ml-auto px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
              >
                Stop Show
              </button>
            </div>
          </div>

          {/* Visual Timeline */}
          <div className="mb-8 bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Timeline View
            </h3>
            <div className="relative" ref={timelineRef}>
              {/* Time markers */}
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
                  <span key={h}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>

              {/* Timeline bar */}
              <div className="relative h-16 bg-gray-800 rounded-lg overflow-hidden">
                {timeline.map((entry, i) => {
                  const left = getTimePosition(entry.time);
                  const nextEntry = timeline[i + 1];
                  const right = nextEntry ? getTimePosition(nextEntry.time) : 100;
                  const width = right - left;
                  const isActive = currentEntry === entry;
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 h-full border-l-2 flex items-center px-2 transition-colors ${
                        isActive ? 'bg-blue-600/50 border-blue-400' : 'bg-blue-600/25 border-blue-500/50'
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${entry.time} - ${entry.label || entry.layout_name || getLayoutName(entry.layout_id)}`}
                    >
                      <span className="text-xs text-white truncate">
                        {entry.label || entry.layout_name || getLayoutName(entry.layout_id)}
                      </span>
                    </div>
                  );
                })}

                {/* Current time indicator */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                  style={{ left: `${getCurrentTimePosition()}%` }}
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full -ml-[3px] -mt-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Entries list */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Timeline Entries
            </h3>
            <div className="space-y-2">
              {timeline.map((entry, i) => {
                const isActive = currentEntry === entry;
                const canMoveUp   = i > 0 && timeline[i - 1].time === entry.time;
                const canMoveDown = i < timeline.length - 1 && timeline[i + 1].time === entry.time;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      isActive ? 'bg-blue-900/30 border border-blue-800' : 'bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {isActive && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                      <span className="text-white font-mono text-sm">{entry.time}</span>
                      <span className="text-gray-300 text-sm">
                        {entry.label || entry.layout_name || getLayoutName(entry.layout_id)}
                      </span>
                      <span className="text-gray-600 text-xs">
                        ({getLayoutName(entry.layout_id)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveEntry(i, -1)}
                        disabled={!canMoveUp}
                        title={canMoveUp ? 'Move up (same-time cues)' : 'No same-time cue above'}
                        className="px-1.5 py-1 text-xs text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        aria-label="Move entry up"
                      >▲</button>
                      <button
                        onClick={() => moveEntry(i, 1)}
                        disabled={!canMoveDown}
                        title={canMoveDown ? 'Move down (same-time cues)' : 'No same-time cue below'}
                        className="px-1.5 py-1 text-xs text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        aria-label="Move entry down"
                      >▼</button>
                      <button
                        onClick={() => removeEntry(i)}
                        className="ml-2 text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {timeline.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">No timeline entries yet.</p>
              )}
            </div>
          </div>

          {/* Add entry */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Add Entry
            </h3>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-gray-400 mb-1">Layout</label>
                <select
                  value={newLayoutId}
                  onChange={(e) => setNewLayoutId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a layout...</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[150px]">
                <label className="block text-sm text-gray-400 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. News Hour"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={addEntry}
                disabled={!newTime || !newLayoutId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
