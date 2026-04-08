import React, { useState, useEffect } from 'react';
import { getSocket } from '../../../lib/socket';

const MACRO_COLORS = {
  red: 'bg-red-700 hover:bg-red-600 border-red-600 shadow-red-700/30',
  green: 'bg-green-700 hover:bg-green-600 border-green-600 shadow-green-700/30',
  blue: 'bg-blue-700 hover:bg-blue-600 border-blue-600 shadow-blue-700/30',
  yellow: 'bg-yellow-700 hover:bg-yellow-600 border-yellow-600 shadow-yellow-700/30',
  purple: 'bg-purple-700 hover:bg-purple-600 border-purple-600 shadow-purple-700/30',
  gray: 'bg-gray-700 hover:bg-gray-600 border-gray-600 shadow-gray-700/30',
};

const MACRO_ACTIONS = [
  { id: 'push_layout', label: 'Push Layout' },
  { id: 'send_text', label: 'Send Text' },
  { id: 'blackout', label: 'Blackout' },
  { id: 'push_overlay', label: 'Push Overlay' },
  { id: 'clear_overlays', label: 'Clear Overlays' },
];

const DEFAULT_MACROS = Array.from({ length: 8 }, (_, i) => ({
  id: `macro_${i}`,
  name: `F${i + 1}`,
  action: '',
  config: {},
  color: 'gray',
  shortcut: `F${i + 1}`,
}));

export default function MacroGrid({ layouts, onPushLayout, onBlackout, compact = false }) {
  const [macros, setMacros] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('broadcast_macros')) || DEFAULT_MACROS;
    } catch { return DEFAULT_MACROS; }
  });
  const [editingMacro, setEditingMacro] = useState(null);

  const studioId = JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || 'default';

  // Save macros to localStorage
  useEffect(() => {
    localStorage.setItem('broadcast_macros', JSON.stringify(macros));
  }, [macros]);

  // Keyboard shortcuts F1-F8
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const fKey = e.key.match(/^F(\d+)$/);
      if (fKey) {
        const idx = parseInt(fKey[1]) - 1;
        if (idx >= 0 && idx < macros.length) {
          e.preventDefault();
          executeMacro(macros[idx]);
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [macros]);

  function executeMacro(macro) {
    if (!macro.action) return;
    const socket = getSocket();
    switch (macro.action) {
      case 'push_layout':
        if (macro.config.layoutId) onPushLayout(macro.config.layoutId);
        break;
      case 'send_text':
        socket.emit('update_module_text', { studioId, moduleId: '__live_text__', text: macro.config.text || '', subtitle: macro.config.subtitle || '' });
        break;
      case 'blackout':
        onBlackout();
        break;
      case 'push_overlay':
        socket.emit('push_overlay', { studioId, overlay: { type: macro.config.overlayType || 'lower_third', ...macro.config } });
        break;
      case 'clear_overlays':
        socket.emit('clear_overlays', { studioId });
        break;
    }
  }

  function updateMacro(index, updates) {
    setMacros(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  return (
    <div className="mt-4">
      {!compact && <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Macros</h3>}
      <div className={compact ? 'grid grid-cols-4 gap-1.5' : 'grid grid-cols-4 gap-2'}>
        {macros.map((macro, i) => (
          <button
            key={macro.id}
            onClick={() => executeMacro(macro)}
            onContextMenu={e => { e.preventDefault(); setEditingMacro(i); }}
            className={`relative ${compact ? 'px-2 py-2 rounded-lg' : 'px-3 py-3 rounded-xl'} border text-sm font-bold transition-all shadow-lg ${MACRO_COLORS[macro.color] || MACRO_COLORS.gray}`}
            title={`${macro.name} (${macro.shortcut}) — Right-click to edit`}
          >
            <div className="text-white text-sm truncate">{macro.name}</div>
            <div className="text-white/50 text-[9px] font-mono mt-0.5">{macro.shortcut}</div>
            {!macro.action && <div className="text-white/30 text-[8px] mt-0.5">Not configured</div>}
          </button>
        ))}
      </div>

      {/* Macro editor */}
      {editingMacro !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-3">Edit Macro — {macros[editingMacro]?.shortcut}</h3>
            <input value={macros[editingMacro]?.name || ''} onChange={e => updateMacro(editingMacro, { name: e.target.value })}
              placeholder="Name" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />

            <select value={macros[editingMacro]?.action || ''} onChange={e => updateMacro(editingMacro, { action: e.target.value, config: {} })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2">
              <option value="">No action</option>
              {MACRO_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>

            {macros[editingMacro]?.action === 'push_layout' && (
              <select value={macros[editingMacro]?.config?.layoutId || ''}
                onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, layoutId: e.target.value } })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2">
                <option value="">Select layout...</option>
                {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}

            {macros[editingMacro]?.action === 'send_text' && (
              <input value={macros[editingMacro]?.config?.text || ''}
                onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, text: e.target.value } })}
                placeholder="Text to send..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
            )}

            <div className="flex gap-1 mb-3">
              {Object.keys(MACRO_COLORS).map(c => (
                <button key={c} onClick={() => updateMacro(editingMacro, { color: c })}
                  className={`w-6 h-6 rounded-full border-2 ${macros[editingMacro]?.color === c ? 'border-white' : 'border-transparent'} ${c === 'red' ? 'bg-red-600' : c === 'green' ? 'bg-green-600' : c === 'blue' ? 'bg-blue-600' : c === 'yellow' ? 'bg-yellow-600' : c === 'purple' ? 'bg-purple-600' : 'bg-gray-600'}`} />
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingMacro(null)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
