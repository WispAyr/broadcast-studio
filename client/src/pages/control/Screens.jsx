import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

export default function Screens() {
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);
  const [formData, setFormData] = useState({ name: '', screen_number: 1 });

  async function fetchData() {
    try {
      const [screensData, layoutsData] = await Promise.all([
        api.get('/screens'),
        api.get('/layouts')
      ]);
      setScreens(screensData.screens || screensData || []);
      setLayouts(layoutsData.layouts || layoutsData || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function resetForm() {
    setFormData({ name: '', screen_number: 1 });
    setShowForm(false);
    setEditingScreen(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingScreen) {
        await api.put(`/screens/${editingScreen.id}`, formData);
      } else {
        await api.post('/screens', formData);
      }
      resetForm();
      fetchData();
    } catch (err) {
      alert('Failed to save screen: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this screen?')) return;
    try {
      await api.delete(`/screens/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete screen: ' + err.message);
    }
  }

  async function handleSetLayout(screenId, layoutId) {
    try {
      await api.put(`/screens/${screenId}`, { current_layout_id: layoutId || null });
      fetchData();
    } catch (err) {
      alert('Failed to set layout: ' + err.message);
    }
  }

  async function handleToggleSync(screen) {
    const newMode = screen.sync_mode === 'synced' ? 'independent' : 'synced';
    try {
      await api.put(`/screens/${screen.id}`, { sync_mode: newMode });
      fetchData();
    } catch (err) {
      alert('Failed to toggle sync mode: ' + err.message);
    }
  }

  function startEdit(screen) {
    setEditingScreen(screen);
    setFormData({ name: screen.name, screen_number: screen.screen_number });
    setShowForm(true);
  }

  function getLayoutName(layoutId) {
    const layout = layouts.find((l) => l.id === layoutId);
    return layout ? layout.name : 'None';
  }

  function openScreenDisplay(screen) {
    window.open(`/screen/${screen.id}`, '_blank');
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading screens...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Screens</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add Screen
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingScreen ? 'Edit Screen' : 'New Screen'}
          </h2>
          <form onSubmit={handleSubmit} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Screen name"
                required
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-300 mb-1">Number</label>
              <input
                type="number"
                min="1"
                value={formData.screen_number}
                onChange={(e) =>
                  setFormData({ ...formData, screen_number: parseInt(e.target.value) || 1 })
                }
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {editingScreen ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Layout
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sync
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {screens.map((screen) => (
              <tr key={screen.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4 text-white font-medium">{screen.name}</td>
                <td className="px-6 py-4 text-gray-400">{screen.screen_number}</td>
                <td className="px-6 py-4">
                  <span
                    className={`flex items-center gap-1.5 text-sm ${
                      screen.is_online ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        screen.is_online ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    />
                    {screen.is_online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={screen.current_layout_id || ''}
                    onChange={(e) => handleSetLayout(screen.id, e.target.value)}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {layouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleSync(screen)}
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      screen.sync_mode === 'synced'
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {screen.sync_mode === 'synced' ? 'Synced' : 'Independent'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openScreenDisplay(screen)}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => startEdit(screen)}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(screen.id)}
                      className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {screens.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No screens registered yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
