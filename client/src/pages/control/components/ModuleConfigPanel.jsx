import React, { useState, useCallback } from 'react';
import { getSocket } from '../../../lib/socket';

// Renders a dynamic config panel for a single configurable module.
// Fields are auto-generated from the module config registry.

export default function ModuleConfigPanel({ moduleConfig, studioId }) {
  const { moduleId, fields, socketEvent, buildPayload, currentConfig } = moduleConfig;

  // Initialize field values from current config
  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach(f => {
      initial[f.key] = currentConfig?.[f.key] ?? f.default ?? '';
    });
    return initial;
  });

  const updateField = useCallback((key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const pushUpdate = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socketEvent) return;
    const payload = buildPayload(studioId, moduleId, values);
    socket.emit(socketEvent, payload);
  }, [values, socketEvent, buildPayload, studioId, moduleId]);

  // Auto-push on Enter key for text inputs
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') pushUpdate();
  }, [pushUpdate]);

  return (
    <div className="p-2 space-y-2">
      {fields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(val) => updateField(field.key, val)}
          onKeyDown={handleKeyDown}
        />
      ))}
      <button
        onClick={pushUpdate}
        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
      >
        Push Update
      </button>
    </div>
  );
}

function FieldRenderer({ field, value, onChange, onKeyDown }) {
  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5 block">{field.label}</label>
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={field.placeholder}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-blue-500"
          />
        </div>
      );

    case 'textarea':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5 block">{field.label}</label>
          <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-blue-500 resize-none"
          />
        </div>
      );

    case 'number':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5 block">{field.label}</label>
          <input
            type="number"
            value={value ?? 0}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            onKeyDown={onKeyDown}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-blue-500"
          />
        </div>
      );

    case 'datetime':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5 block">{field.label}</label>
          <input
            type="datetime-local"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-blue-500"
          />
        </div>
      );

    case 'range':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5 flex items-center justify-between">
            <span>{field.label}</span>
            <span className="text-gray-400 font-mono">{value ?? field.default}</span>
          </label>
          <input
            type="range"
            value={value ?? field.default ?? 5}
            onChange={e => onChange(parseFloat(e.target.value))}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            className="w-full h-1.5 accent-blue-500"
          />
        </div>
      );

    case 'button_group':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 block">{field.label}</label>
          <div className="flex gap-1">
            {(field.options || []).map(opt => (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  value === opt
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case 'tag_group':
      return (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 block">{field.label}</label>
          <div className="flex flex-wrap gap-1">
            {(field.options || []).map(opt => (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{field.label}</label>
          <button
            onClick={() => onChange(!value)}
            className={`w-8 h-4 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
      );

    default:
      return null;
  }
}
