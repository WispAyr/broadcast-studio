import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';

// Some module icons come from the DB as HTML numeric entities (e.g. "&#128225;")
// rather than the literal emoji, which previously rendered as raw text. Decode
// both decimal and hex numeric entities to the actual character.
function decodeEntities(str) {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('&#')) return str;
  return str
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } });
}

// "travel_times" / "go2rtc-feed" → "Travel Times" / "Go2rtc Feed"
function prettyName(name = '') {
  return String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const categoryIcons = {
  time: '🕓', media: '🎬', data: '📊', broadcast: '📡',
  situational: '⚡', other: '🧩',
};
const categoryLabels = {
  time: 'Time', media: 'Media', data: 'Data & Feeds',
  broadcast: 'Broadcast', situational: 'Situational', other: 'Other',
};
// Display order for category sections.
const CATEGORY_ORDER = ['broadcast', 'media', 'data', 'time', 'situational', 'other'];

const FALLBACK_MODULES = [
  { id: 'clock', name: 'clock', category: 'time', description: 'Clock display' },
  { id: 'countdown', name: 'countdown', category: 'time', description: 'Countdown timer' },
  { id: 'image', name: 'image', category: 'media', description: 'Image display' },
  { id: 'video', name: 'video', category: 'media', description: 'Video player' },
  { id: 'text', name: 'text', category: 'data', description: 'Text display' },
  { id: 'ticker', name: 'ticker', category: 'data', description: 'Scrolling ticker' },
  { id: 'iframe', name: 'iframe', category: 'media', description: 'Embedded webpage' },
  { id: 'color', name: 'color', category: 'situational', description: 'Solid color fill' },
  { id: 'weather', name: 'weather', category: 'data', description: 'Weather display' },
  { id: 'logo', name: 'logo', category: 'broadcast', description: 'Logo overlay' },
];

const clamp2 = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  overflow: 'hidden', lineHeight: 1.35,
};

export default function ModulePicker({ onSelect, onClose }) {
  const [moduleTypes, setModuleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    api
      .get('/modules')
      .then((data) => setModuleTypes(data.modules || data || []))
      .catch((err) => {
        console.error('Failed to fetch modules:', err);
        setModuleTypes(FALLBACK_MODULES);
      })
      .finally(() => setLoading(false));
  }, []);

  // Focus search on open; Escape closes.
  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return moduleTypes;
    return moduleTypes.filter((m) =>
      `${m.name} ${prettyName(m.name)} ${m.description || ''} ${m.category || ''}`.toLowerCase().includes(q)
    );
  }, [moduleTypes, q]);

  // Group by category, then order sections consistently.
  const sections = useMemo(() => {
    const grouped = filtered.reduce((acc, mod) => {
      const cat = mod.category || 'other';
      (acc[cat] = acc[cat] || []).push(mod);
      return acc;
    }, {});
    const known = CATEGORY_ORDER.filter((c) => grouped[c]);
    const extra = Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [...known, ...extra].map((cat) => [
      cat,
      grouped[cat].slice().sort((a, b) => prettyName(a.name).localeCompare(prettyName(b.name))),
    ]);
  }, [filtered]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-5xl max-h-[88vh] my-auto overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Add Module</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading ? 'Loading…' : `${moduleTypes.length} modules available`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules…"
              className="w-full pl-9 pr-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[74px] bg-gray-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-400">No modules match “{query}”.</p>
            </div>
          ) : (
            sections.map(([category, mods]) => (
              <div key={category}>
                <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  <span className="text-sm">{categoryIcons[category] || categoryIcons.other}</span>
                  {categoryLabels[category] || prettyName(category)}
                  <span className="text-gray-600 font-normal normal-case tracking-normal">({mods.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mods.map((mod) => {
                    const icon = decodeEntities(mod.icon) || categoryIcons[mod.category] || categoryIcons.other;
                    return (
                      <button
                        key={mod.id || mod.name}
                        title={mod.description || prettyName(mod.name)}
                        onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onSelect(mod); }}
                        className="group flex items-start gap-3 p-3.5 bg-gray-800/70 hover:bg-gray-700/80 hover:ring-1 hover:ring-blue-500/50 rounded-xl text-left transition-all"
                      >
                        <div className="w-10 h-10 flex-shrink-0 bg-gray-700/70 group-hover:bg-gray-700 rounded-lg flex items-center justify-center text-xl leading-none transition-colors">
                          <span>{icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-semibold leading-tight truncate">{prettyName(mod.name)}</p>
                          {mod.description && (
                            <p className="text-gray-400 text-xs mt-1" style={clamp2}>{mod.description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
