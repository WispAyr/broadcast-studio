import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

export default function Shows() {
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
      } else {
        await api.post('/shows', formData);
      }
      resetForm();
      fetchShows();
    } catch (err) {
      alert('Failed to save show: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this show?')) return;
    try {
      await api.delete(`/shows/${id}`);
      fetchShows();
    } catch (err) {
      alert('Failed to delete show: ' + err.message);
    }
  }

  async function handleActivate(id) {
    try {
      await api.post(`/shows/${id}/activate`, {});
      fetchShows();
    } catch (err) {
      alert('Failed to activate show: ' + err.message);
    }
  }

  async function handleDeactivate(id) {
    try {
      await api.post(`/shows/${id}/deactivate`, {});
      fetchShows();
    } catch (err) {
      alert('Failed to deactivate show: ' + err.message);
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
        <h1 className="text-2xl font-bold text-white">Shows</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
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
            className={`bg-gray-900 rounded-xl border p-6 ${
              show.is_active ? 'border-green-600' : 'border-gray-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-white">{show.name}</h3>
                  {show.is_active && (
                    <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                </div>
                {show.description && (
                  <p className="text-gray-400 text-sm mb-3">{show.description}</p>
                )}
                {show.timeline && Array.isArray(show.timeline) && show.timeline.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Timeline</p>
                    <div className="flex flex-wrap gap-2">
                      {show.timeline.map((entry, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300"
                        >
                          {entry.time} - {entry.layout_name || entry.layout_id}
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
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {shows.length === 0 && !showForm && (
        <div className="text-center py-16">
          <p className="text-gray-500">No shows yet. Create your first show to get started.</p>
        </div>
      )}
    </div>
  );
}
