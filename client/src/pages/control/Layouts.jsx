import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import ModulePicker from '../../components/ModulePicker';

export default function Layouts() {
  const [layouts, setLayouts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleConfigJson, setModuleConfigJson] = useState('{}');
  const saveTimer = useRef(null);

  async function fetchLayouts() {
    try {
      const data = await api.get('/layouts');
      setLayouts(data.layouts || data || []);
    } catch (err) {
      console.error('Failed to fetch layouts:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLayouts();
  }, []);

  useEffect(() => {
    if (selectedId) {
      api
        .get(`/layouts/${selectedId}`)
        .then((data) => {
          const layout = data.layout || data;
          setSelectedLayout(layout);
          setModules(layout.modules || []);
        })
        .catch((err) => console.error('Failed to fetch layout:', err));
    }
  }, [selectedId]);

  const autoSave = useCallback(
    (layoutData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!selectedId) return;
        try {
          await api.put(`/layouts/${selectedId}`, layoutData);
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }, 1000);
    },
    [selectedId]
  );

  function updateLayout(updates) {
    const updated = { ...selectedLayout, ...updates };
    setSelectedLayout(updated);
    autoSave(updates);
  }

  async function handleNewLayout() {
    try {
      const data = await api.post('/layouts', {
        name: 'New Layout',
        grid_rows: 3,
        grid_columns: 4,
        background: '#000000'
      });
      fetchLayouts();
      setSelectedId(data.layout?.id || data.id);
    } catch (err) {
      alert('Failed to create layout: ' + err.message);
    }
  }

  async function handleDeleteLayout() {
    if (!selectedId || !confirm('Delete this layout?')) return;
    try {
      await api.delete(`/layouts/${selectedId}`);
      setSelectedId(null);
      setSelectedLayout(null);
      setModules([]);
      fetchLayouts();
    } catch (err) {
      alert('Failed to delete layout: ' + err.message);
    }
  }

  function handleModuleSelect(moduleType) {
    const newModule = {
      id: 'temp_' + Date.now(),
      module: moduleType.name || moduleType.id,
      module_type: moduleType.name || moduleType.id,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      config: {}
    };
    const newModules = [...modules, newModule];
    setModules(newModules);
    setShowModulePicker(false);
    autoSave({ modules: newModules });
  }

  function removeModule(index) {
    const newModules = modules.filter((_, i) => i !== index);
    setModules(newModules);
    if (selectedModule === index) {
      setSelectedModule(null);
    }
    autoSave({ modules: newModules });
  }

  function updateModulePlacement(index, field, value) {
    const newModules = [...modules];
    newModules[index] = { ...newModules[index], [field]: parseInt(value) || 0 };
    setModules(newModules);
    autoSave({ modules: newModules });
  }

  function updateModuleConfig(index) {
    try {
      const config = JSON.parse(moduleConfigJson);
      const newModules = [...modules];
      newModules[index] = { ...newModules[index], config };
      setModules(newModules);
      autoSave({ modules: newModules });
    } catch {
      alert('Invalid JSON');
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading layouts...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Layout list */}
      <div className="w-64 border-r border-gray-800 bg-gray-900/50 p-4 overflow-y-auto hide-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Layouts</h2>
          <button
            onClick={handleNewLayout}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            + New
          </button>
        </div>
        <div className="space-y-1">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => setSelectedId(layout.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedId === layout.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {layout.name}
            </button>
          ))}
          {layouts.length === 0 && (
            <p className="text-gray-600 text-sm px-3">No layouts yet</p>
          )}
        </div>
      </div>

      {/* Grid builder */}
      <div className="flex-1 p-8 overflow-y-auto hide-scrollbar">
        {selectedLayout ? (
          <>
            {/* Layout info */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 mr-4">
                <input
                  type="text"
                  value={selectedLayout.name || ''}
                  onChange={(e) => updateLayout({ name: e.target.value })}
                  className="text-2xl font-bold bg-transparent text-white border-none outline-none w-full"
                  placeholder="Layout name"
                />
                <input
                  type="text"
                  value={selectedLayout.description || ''}
                  onChange={(e) => updateLayout({ description: e.target.value })}
                  className="text-sm bg-transparent text-gray-400 border-none outline-none w-full mt-1"
                  placeholder="Description"
                />
              </div>
              <button
                onClick={handleDeleteLayout}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Grid controls */}
            <div className="flex items-center gap-4 mb-6 bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Rows:</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={selectedLayout.grid_rows || 3}
                  onChange={(e) => updateLayout({ grid_rows: parseInt(e.target.value) || 3 })}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Columns:</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={selectedLayout.grid_columns || 4}
                  onChange={(e) => updateLayout({ grid_columns: parseInt(e.target.value) || 4 })}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Background:</label>
                <input
                  type="color"
                  value={selectedLayout.background || '#000000'}
                  onChange={(e) => updateLayout({ background: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-700"
                />
              </div>
              <button
                onClick={() => setShowModulePicker(true)}
                className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Add Module
              </button>
            </div>

            {/* Grid Preview */}
            <div className="mb-6">
              <div
                className="border border-gray-700 rounded-lg overflow-hidden"
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(${selectedLayout.grid_rows || 3}, 80px)`,
                  gridTemplateColumns: `repeat(${selectedLayout.grid_columns || 4}, 1fr)`,
                  background: selectedLayout.background || '#000000',
                  gap: '2px'
                }}
              >
                {modules.map((mod, i) => (
                  <div
                    key={mod.id || i}
                    onClick={() => {
                      setSelectedModule(i);
                      setModuleConfigJson(JSON.stringify(mod.config || {}, null, 2));
                    }}
                    className={`flex items-center justify-center cursor-pointer transition-colors ${
                      selectedModule === i
                        ? 'bg-blue-600/30 border-2 border-blue-500'
                        : 'bg-gray-800/80 border border-gray-700 hover:bg-gray-700/80'
                    }`}
                    style={{
                      gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
                      gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`
                    }}
                  >
                    <span className="text-xs text-gray-300 font-medium">
                      {mod.module_type || mod.module || 'Module'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Module list & config */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Modules ({modules.length})
              </h3>
              {modules.map((mod, i) => (
                <div
                  key={mod.id || i}
                  className={`bg-gray-900 rounded-lg border p-4 ${
                    selectedModule === i ? 'border-blue-500' : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">
                      {mod.module_type || mod.module || 'Module'}
                    </span>
                    <button
                      onClick={() => removeModule(i)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {['x', 'y', 'w', 'h'].map((field) => (
                      <div key={field}>
                        <label className="text-xs text-gray-500 uppercase">{field}</label>
                        <input
                          type="number"
                          min="0"
                          value={mod[field] || 0}
                          onChange={(e) => updateModulePlacement(i, field, e.target.value)}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                  {selectedModule === i && (
                    <div className="mt-3">
                      <label className="text-xs text-gray-500 uppercase">Config (JSON)</label>
                      <textarea
                        value={moduleConfigJson}
                        onChange={(e) => setModuleConfigJson(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        rows={4}
                      />
                      <button
                        onClick={() => updateModuleConfig(i)}
                        className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        Apply Config
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Module Picker Modal */}
            {showModulePicker && (
              <ModulePicker
                onSelect={handleModuleSelect}
                onClose={() => setShowModulePicker(false)}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a layout or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
