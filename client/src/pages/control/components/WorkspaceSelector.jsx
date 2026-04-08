import React, { useState, useRef, useEffect } from 'react';
import { WORKSPACE_PRESETS } from '../panels/panelRegistry';

export default function WorkspaceSelector({ activeWorkspaceId, workspaces, onSwitch, onSave, onDelete, onReset }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSave() {
    if (!newName.trim()) return;
    onSave(newName.trim());
    setNewName('');
    setSaving(false);
  }

  const currentName = workspaces[activeWorkspaceId]?.name || 'Default';
  const presetIds = Object.keys(WORKSPACE_PRESETS);
  const customIds = Object.keys(workspaces).filter(id => !presetIds.includes(id));

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-[11px] text-gray-300 hover:text-white hover:bg-gray-700/60 transition-colors">
        <span className="text-[10px]">📐</span>
        <span className="font-medium">{currentName}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Presets */}
          <div className="px-2 py-1.5">
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Presets</p>
            {presetIds.map(id => (
              <button key={id} onClick={() => { onSwitch(id); setOpen(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                  activeWorkspaceId === id ? 'text-blue-400 bg-blue-600/10' : 'text-gray-300 hover:bg-gray-700'
                }`}>
                {workspaces[id]?.name || WORKSPACE_PRESETS[id]?.name}
              </button>
            ))}
          </div>

          {/* Custom workspaces */}
          {customIds.length > 0 && (
            <div className="px-2 py-1.5 border-t border-gray-700">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Saved</p>
              {customIds.map(id => (
                <div key={id} className="flex items-center gap-1">
                  <button onClick={() => { onSwitch(id); setOpen(false); }}
                    className={`flex-1 text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                      activeWorkspaceId === id ? 'text-blue-400 bg-blue-600/10' : 'text-gray-300 hover:bg-gray-700'
                    }`}>
                    {workspaces[id]?.name}
                  </button>
                  <button onClick={() => onDelete(id)}
                    className="px-1 text-gray-600 hover:text-red-400 text-[10px]" title="Delete">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="px-2 py-1.5 border-t border-gray-700">
            {saving ? (
              <div className="flex gap-1">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Workspace name..."
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-[11px] text-white outline-none"
                  autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
                <button onClick={handleSave} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded">Save</button>
              </div>
            ) : (
              <button onClick={() => setSaving(true)}
                className="w-full text-left px-2 py-1.5 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                + Save Current As...
              </button>
            )}
            <button onClick={() => { onReset(); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded text-[11px] text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors">
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
