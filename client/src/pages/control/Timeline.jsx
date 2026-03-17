import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

export default function Timeline() {
  const [activeShow, setActiveShow] = useState(null);
  const [shows, setShows] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTime, setNewTime] = useState('');
  const [newLayoutId, setNewLayoutId] = useState('');
  const [overrideLayoutId, setOverrideLayoutId] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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

      const active = allShows.find((s) => s.is_active);
      if (active) {
        setActiveShow(active);
        setTimeline(active.timeline || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function saveTimeline(newTimeline) {
    if (!activeShow) return;
    try {
      await api.put(`/shows/${activeShow.id}`, { timeline: newTimeline });
      setTimeline(newTimeline);
    } catch (err) {
      alert('Failed to save timeline: ' + err.message);
    }
  }

  function addEntry() {
    if (!newTime || !newLayoutId) return;
    const layout = layouts.find((l) => l.id === newLayoutId);
    const entry = {
      time: newTime,
      layout_id: newLayoutId,
      layout_name: layout ? layout.name : 'Unknown'
    };
    const newTimeline = [...timeline, entry].sort((a, b) => a.time.localeCompare(b.time));
    saveTimeline(newTimeline);
    setNewTime('');
    setNewLayoutId('');
  }

  function removeEntry(index) {
    const newTimeline = timeline.filter((_, i) => i !== index);
    saveTimeline(newTimeline);
  }

  async function handleOverride() {
    if (!overrideLayoutId) return;
    try {
      await api.post('/screens/sync', { layout_id: overrideLayoutId });
      setIsOverriding(true);
    } catch (err) {
      alert('Override failed: ' + err.message);
    }
  }

  async function handleResumeAutomation() {
    setIsOverriding(false);
    setOverrideLayoutId('');
    // Re-apply timeline by triggering a refresh
    fetchData();
  }

  function getCurrentTimePosition() {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  }

  function getTimePosition(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    return (totalMinutes / (24 * 60)) * 100;
  }

  function getLayoutName(layoutId) {
    const layout = layouts.find((l) => l.id === layoutId);
    return layout ? layout.name : 'Unknown';
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
          {activeShow && (
            <p className="text-gray-400 mt-1">
              Active show: <span className="text-green-400">{activeShow.name}</span>
            </p>
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
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
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

      {!activeShow ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No active show. Activate a show to use the timeline.</p>
        </div>
      ) : (
        <>
          {/* Current Time */}
          <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Current Time:</span>
              <span className="text-white text-lg font-mono">
                {currentTime.toLocaleTimeString()}
              </span>
              {isOverriding && (
                <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded-full">
                  Manual Override Active
                </span>
              )}
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
                {/* Timeline entries */}
                {timeline.map((entry, i) => {
                  const left = getTimePosition(entry.time);
                  const nextEntry = timeline[i + 1];
                  const right = nextEntry ? getTimePosition(nextEntry.time) : 100;
                  const width = right - left;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 h-full bg-blue-600/40 border-l-2 border-blue-400 flex items-center px-2"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${entry.time} - ${entry.layout_name || getLayoutName(entry.layout_id)}`}
                    >
                      <span className="text-xs text-white truncate">
                        {entry.layout_name || getLayoutName(entry.layout_id)}
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
              {timeline.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-white font-mono text-sm">{entry.time}</span>
                    <span className="text-gray-400 text-sm">
                      {entry.layout_name || getLayoutName(entry.layout_id)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeEntry(i)}
                    className="text-red-400 hover:text-red-300 text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
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
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Layout</label>
                <select
                  value={newLayoutId}
                  onChange={(e) => setNewLayoutId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a layout...</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
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
