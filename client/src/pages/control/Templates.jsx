import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('custom');
  const navigate = useNavigate();

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const data = await api.get('/templates');
      setTemplates(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function createTemplate() {
    if (!newName.trim()) return;
    try {
      const t = await api.post('/templates', {
        name: newName.trim(),
        category: newCategory,
        duration: 5,
        fps: 30,
        elements: []
      });
      setShowCreate(false);
      setNewName('');
      navigate(`/control/templates/${t.id}/edit`);
    } catch (err) { console.error(err); }
  }

  async function duplicateTemplate(t) {
    try {
      const dup = await api.post('/templates', {
        name: `${t.name} (copy)`,
        category: t.category,
        duration: t.duration,
        fps: t.fps,
        elements: t.elements
      });
      loadTemplates();
    } catch (err) { console.error(err); }
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) { console.error(err); }
  }

  const categories = [...new Set(templates.map(t => t.category))];

  if (loading) return <div className="p-8 text-gray-500 animate-pulse">Loading templates...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="text-gray-400 mt-1">Create and manage Remotion compositions visually</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">New Template</h2>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTemplate()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-4 focus:outline-none focus:border-blue-500"
              placeholder="My Template"
              autoFocus
            />
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-6 focus:outline-none focus:border-blue-500"
            >
              <option value="custom">Custom</option>
              <option value="lower-third">Lower Third</option>
              <option value="full-screen">Full Screen</option>
              <option value="overlay">Overlay</option>
              <option value="transition">Transition</option>
              <option value="stinger">Stinger</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={createTemplate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-lg mb-2">No templates yet</p>
          <p className="text-sm">Create your first template to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map(t => (
            <div
              key={t.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all group cursor-pointer"
              onClick={() => navigate(`/control/templates/${t.id}/edit`)}
            >
              {/* Preview area */}
              <div className="aspect-video bg-gray-950 relative flex items-center justify-center">
                {t.thumbnail ? (
                  <img src={t.thumbnail} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-700 text-4xl">🎨</div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); duplicateTemplate(t); }}
                    className="p-1.5 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
                    title="Duplicate"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTemplate(t.id); }}
                    className="p-1.5 bg-gray-800/90 hover:bg-red-600 rounded-lg text-gray-400 hover:text-white"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="absolute bottom-2 left-2">
                  <span className="text-xs bg-gray-800/90 text-gray-300 px-2 py-0.5 rounded">{t.category}</span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="text-xs bg-gray-800/90 text-gray-300 px-2 py-0.5 rounded">{t.duration}s · {t.fps}fps</span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-white font-medium truncate">{t.name}</h3>
                {t.description && <p className="text-gray-500 text-sm truncate mt-0.5">{t.description}</p>}
                <p className="text-gray-600 text-xs mt-1">{(t.elements || []).length} elements</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
