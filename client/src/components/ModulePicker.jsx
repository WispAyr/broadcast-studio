import React, { useState, useEffect } from 'react';
import api from '../lib/api';

const categoryIcons = {
  time: '&#128339;',
  media: '&#127909;',
  data: '&#128202;',
  broadcast: '&#128225;',
  situational: '&#9889;'
};

const categoryLabels = {
  time: 'Time',
  media: 'Media',
  data: 'Data & Feeds',
  broadcast: 'Broadcast',
  situational: 'Situational'
};

export default function ModulePicker({ onSelect, onClose }) {
  const [moduleTypes, setModuleTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/modules')
      .then((data) => {
        setModuleTypes(data.modules || data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch modules:', err);
        // Provide fallback module types
        setModuleTypes([
          { id: 'clock', name: 'clock', category: 'time', description: 'Clock display' },
          { id: 'countdown', name: 'countdown', category: 'time', description: 'Countdown timer' },
          { id: 'image', name: 'image', category: 'media', description: 'Image display' },
          { id: 'video', name: 'video', category: 'media', description: 'Video player' },
          { id: 'text', name: 'text', category: 'data', description: 'Text display' },
          { id: 'ticker', name: 'ticker', category: 'data', description: 'Scrolling ticker' },
          { id: 'iframe', name: 'iframe', category: 'media', description: 'Embedded webpage' },
          { id: 'color', name: 'color', category: 'situational', description: 'Solid color fill' },
          { id: 'weather', name: 'weather', category: 'data', description: 'Weather display' },
          { id: 'logo', name: 'logo', category: 'broadcast', description: 'Logo overlay' }
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Group by category
  const grouped = moduleTypes.reduce((acc, mod) => {
    const cat = mod.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mod);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Add Module</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {loading ? (
            <p className="text-gray-400 text-center">Loading modules...</p>
          ) : (
            Object.entries(grouped).map(([category, mods]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {categoryLabels[category] || category}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {mods.map((mod) => (
                    <button
                      key={mod.id || mod.name}
                      onClick={() => onSelect(mod)}
                      className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
                    >
                      <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-sm">
                        {mod.icon ? (
                          <span>{mod.icon}</span>
                        ) : (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: categoryIcons[category] || '&#9632;'
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium capitalize">{mod.name}</p>
                        {mod.description && (
                          <p className="text-gray-500 text-xs">{mod.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
