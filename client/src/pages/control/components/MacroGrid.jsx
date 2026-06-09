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

export default function MacroGrid({ layouts, onPushLayout, onBlackout, compact = false, studioId: studioIdProp }) {
  const [macros, setMacros] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('broadcast_macros')) || DEFAULT_MACROS;
    } catch { return DEFAULT_MACROS; }
  });
  const [editingMacro, setEditingMacro] = useState(null);

  const studioId = studioIdProp || (JSON.parse(localStorage.getItem('broadcast_user') || '{}').studio_id || null);

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
    if (!studioId) { console.warn('MacroGrid: no studioId; select a studio first'); return; }
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
          <div key={macro.id} className="relative group">
            <button
              onClick={() => executeMacro(macro)}
              onContextMenu={e => { e.preventDefault(); setEditingMacro(i); }}
              disabled={!macro.action}
              className={`w-full ${compact ? 'px-2 py-2 rounded-lg' : 'px-3 py-3 rounded-xl'} border text-sm font-bold transition-all shadow-lg ${macro.action ? (MACRO_COLORS[macro.color] || MACRO_COLORS.gray) : 'bg-gray-800/40 border-dashed border-gray-700 hover:border-gray-500 hover:bg-gray-800/70'}`}
              title={macro.action ? `${macro.name} (${macro.shortcut}) — Right-click to edit` : `Click edit or right-click to configure ${macro.shortcut}`}
            >
              <div className={`text-sm truncate ${macro.action ? 'text-white' : 'text-gray-500'}`}>{macro.name}</div>
              <div className={`text-[9px] font-mono mt-0.5 ${macro.action ? 'text-white/50' : 'text-gray-600'}`}>{macro.shortcut}</div>
              {!macro.action && <div className="text-gray-500 text-[8px] mt-0.5">Not configured</div>}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditingMacro(i); }}
              className="absolute top-0.5 right-0.5 p-1 rounded-md bg-black/30 text-white/60 hover:text-white hover:bg-black/60 opacity-60 group-hover:opacity-100 transition-opacity"
              title="Edit macro"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          </div>
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
              <>
                <input value={macros[editingMacro]?.config?.text || ''}
                  onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, text: e.target.value } })}
                  placeholder="Text to send..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                <input value={macros[editingMacro]?.config?.subtitle || ''}
                  onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, subtitle: e.target.value } })}
                  placeholder="Subtitle (optional)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
              </>
            )}

            {macros[editingMacro]?.action === 'push_overlay' && (
              <>
                <select value={macros[editingMacro]?.config?.overlayType || 'lower_third'}
                  onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, overlayType: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2">
                  <option value="lower_third">Lower Third</option>
                  <option value="logo_bug">Logo Bug</option>
                  <option value="countdown">Countdown</option>
                  <option value="ticker">Ticker</option>
                  <option value="coming_up">Coming Up</option>
                  <option value="now_playing">Now Playing</option>
                  <option value="announcement">Announcement</option>
                  <option value="cg_text">CG Text</option>
                </select>
                {['lower_third'].includes(macros[editingMacro]?.config?.overlayType) && (
                  <>
                    <input value={macros[editingMacro]?.config?.name || ''}
                      onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, name: e.target.value } })}
                      placeholder="Name" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                    <input value={macros[editingMacro]?.config?.title || ''}
                      onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, title: e.target.value } })}
                      placeholder="Title" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                  </>
                )}
                {['ticker','coming_up','cg_text','announcement'].includes(macros[editingMacro]?.config?.overlayType) && (
                  <input value={macros[editingMacro]?.config?.text || ''}
                    onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, text: e.target.value } })}
                    placeholder="Text" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                )}
                {macros[editingMacro]?.config?.overlayType === 'now_playing' && (
                  <>
                    <input value={macros[editingMacro]?.config?.artist || ''}
                      onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, artist: e.target.value } })}
                      placeholder="Artist" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                    <input value={macros[editingMacro]?.config?.song || ''}
                      onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, song: e.target.value } })}
                      placeholder="Song" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                  </>
                )}
                {macros[editingMacro]?.config?.overlayType === 'logo_bug' && (
                  <input value={macros[editingMacro]?.config?.url || ''}
                    onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, url: e.target.value } })}
                    placeholder="Logo URL" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                )}
                {macros[editingMacro]?.config?.overlayType === 'countdown' && (
                  <input type="datetime-local" value={macros[editingMacro]?.config?.targetTime || ''}
                    onChange={e => updateMacro(editingMacro, { config: { ...macros[editingMacro].config, targetTime: e.target.value } })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-2" />
                )}
              </>
            )}

            <div className="flex gap-1 mb-3">
              {Object.keys(MACRO_COLORS).map(c => (
                <button key={c} onClick={() => updateMacro(editingMacro, { color: c })}
                  className={`w-6 h-6 rounded-full border-2 ${macros[editingMacro]?.color === c ? 'border-white' : 'border-transparent'} ${c === 'red' ? 'bg-red-600' : c === 'green' ? 'bg-green-600' : c === 'blue' ? 'bg-blue-600' : c === 'yellow' ? 'bg-yellow-600' : c === 'purple' ? 'bg-purple-600' : 'bg-gray-600'}`} />
              ))}
            </div>

            <p className="text-[10px] text-gray-500 mb-3">Tip: right-click any macro to edit, or press {macros[editingMacro]?.shortcut} to run it.</p>

            <div className="flex gap-2 justify-between">
              <button
                onClick={() => { updateMacro(editingMacro, { name: macros[editingMacro].shortcut, action: '', config: {}, color: 'gray' }); setEditingMacro(null); }}
                className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-300 text-sm rounded-lg"
              >Clear</button>
              <button onClick={() => setEditingMacro(null)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
