import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { confirmAsync } from '../../lib/dialog';

export default function Shows() {
  const toast = useToast();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  async function fetchShows() {
    try {
      const data = await api.get('/shows');
      setShows(data.shows || data || []);
    } catch (err) {
      console.error('Failed to fetch shows:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShows();
  }, []);

  function resetForm() {
    setFormData({ name: '', description: '' });
    setShowForm(false);
    setEditingShow(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingShow) {
        await api.put(`/shows/${editingShow.id}`, formData);
        toast?.('Show updated', 'success');
      } else {
        await api.post('/shows', formData);
        toast?.('Show created', 'success');
      }
      resetForm();
      fetchShows();
    } catch (err) {
      toast?.(`Save failed: ${err.message}`, 'error');
    }
  }

  async function handleDelete(id) {
    const show = shows.find(s => s.id === id);
    if (!await confirmAsync({
      title: 'Delete show?',
      message: `"${show?.name || id}" and its timeline entries will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`/shows/${id}`);
      toast?.('Show deleted', 'success');
      fetchShows();
    } catch (err) {
      toast?.(`Delete failed: ${err.message}`, 'error');
    }
  }

  async function handleActivate(id) {
    try {
      await api.post(`/shows/${id}/activate`, {});
      toast?.('Show activated', 'success');
      fetchShows();
    } catch (err) {
      toast?.(`Activate failed: ${err.message}`, 'error');
    }
  }

  async function handleDeactivate(id) {
    try {
      await api.post(`/shows/${id}/deactivate`, {});
      toast?.('Show deactivated', 'success');
      fetchShows();
    } catch (err) {
      toast?.(`Deactivate failed: ${err.message}`, 'error');
    }
  }

  function startEdit(show) {
    setEditingShow(show);
    setFormData({ name: show.name, description: show.description || '' });
    setShowForm(true);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading shows...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Shows</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your broadcast shows and timelines</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Show
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingShow ? 'Edit Show' : 'New Show'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Show name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Show description"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editingShow ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shows list */}
      <div className="space-y-4">
        {shows.map((show) => (
          <div
            key={show.id}
            className={`bg-gray-900 rounded-xl border p-6 transition-all hover:border-gray-700 ${
              show.is_active ? 'border-green-600/50 shadow-lg shadow-green-900/10' : 'border-gray-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-white">{show.name}</h3>
                  {show.is_active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-green-500/15 text-green-400 text-[10px] font-semibold uppercase tracking-wider rounded-full ring-1 ring-green-500/20">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                      </span>
                      Live
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-800 text-gray-500 text-[10px] font-semibold uppercase tracking-wider rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                {show.description && (
                  <p className="text-gray-400 text-sm mb-3">{show.description}</p>
                )}
                {show.timeline && Array.isArray(show.timeline) && show.timeline.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Timeline</p>
                    <div className="flex flex-wrap gap-2">
                      {show.timeline.map((entry, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-gray-800/80 rounded-md text-xs text-gray-400 font-mono"
                        >
                          {entry.time} — {entry.layout_name || entry.layout_id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => startEdit(show)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  Edit
                </button>
                {show.is_active ? (
                  <button
                    onClick={() => handleDeactivate(show.id)}
                    className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-sm rounded-lg transition-colors"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(show.id)}
                    className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm rounded-lg transition-colors"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={() => handleDelete(show.id)}
                  className="px-2.5 py-1.5 bg-transparent hover:bg-red-600/15 text-gray-600 hover:text-red-400 text-sm rounded-lg transition-colors"
                  title="Delete show"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {shows.length === 0 && !showForm && (
        <div className="text-center py-20">
          <svg className="w-12 h-12 text-gray-800 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <p className="text-gray-500 font-medium">No shows yet</p>
          <p className="text-gray-700 text-sm mt-1">Create your first show to start scheduling broadcasts</p>
        </div>
      )}
    </div>
  );
}
