import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import LayoutThumb from './LayoutThumb';
import { useToast } from './Toast';

// CommandPalette — ⌘K / Ctrl+K everywhere in the control app.
//
// One box that does the app-y things an operator actually needs mid-show:
//   • jump to any control page                      (Enter → navigate)
//   • TAKE any layout to every unlocked screen      (Enter → /screens/sync)
//   • open any screen's display output              (Enter → new tab)
//   • open any template in the gallery              (Enter → navigate)
// Results are fuzzy-filtered, keyboard-first (↑↓ Enter Esc), and layouts show
// their real thumbnails so a take is never a guess.

const PAGES = [
  ['dashboard', 'Dashboard'], ['console', 'Console'], ['shows', 'Shows'], ['layouts', 'Layouts'],
  ['screens', 'Screens'], ['displays', 'Displays'], ['media', 'Media'], ['timeline', 'Timeline'],
  ['schedule', 'Schedule'], ['templates', 'Templates'], ['variables', 'Variables'],
  ['settings', 'Settings'], ['egpk', 'EGPK Live'], ['autocue', 'Autocue'], ['kiltwalk', 'Kiltwalk Ops'],
];

// cheap subsequence fuzzy score: lower = better, null = no match
function fuzzy(query, text) {
  const q = query.toLowerCase(), t = text.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx >= 0) return idx; // contiguous match, earlier is better
  let ti = 0, gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    gaps += found - ti;
    ti = found + 1;
  }
  return 100 + gaps; // subsequence match ranks below contiguous
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [layouts, setLayouts] = useState([]);
  const [screens, setScreens] = useState([]);
  const [templates, setTemplates] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load searchable data when the palette opens (cheap, cached by the browser)
  useEffect(() => {
    if (!open) return;
    setQuery(''); setSel(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    api.get('/layouts').then(d => setLayouts(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/screens').then(d => setScreens(Array.isArray(d) ? d : [])).catch(() => {});
    api.get('/templates').then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {});
  }, [open]);

  const items = useMemo(() => {
    const out = [];
    for (const [path, label] of PAGES) {
      const s = fuzzy(query, label);
      if (s !== null) out.push({ kind: 'page', score: s - 0.5, label, hint: 'Go to page', path });
    }
    for (const l of layouts) {
      const s = fuzzy(query, l.name || '');
      if (s !== null) out.push({ kind: 'layout', score: s, label: l.name, hint: 'Take to all screens', layout: l });
    }
    for (const sc of screens) {
      const s = fuzzy(query, sc.name || '');
      if (s !== null) out.push({ kind: 'screen', score: s + 0.25, label: sc.name, hint: 'Open display output', screen: sc });
    }
    for (const t of templates) {
      const s = fuzzy(query, t.name || '');
      if (s !== null) out.push({ kind: 'template', score: s + 0.5, label: t.name, hint: 'Open in Templates', template: t });
    }
    out.sort((a, b) => a.score - b.score);
    return out.slice(0, 12);
  }, [query, layouts, screens, templates]);

  useEffect(() => { setSel(0); }, [query]);

  const run = useCallback(async (item) => {
    if (!item) return;
    if (item.kind === 'page') { navigate(`/control/${item.path}`); onClose(); return; }
    if (item.kind === 'screen') { window.open(`/screen/${item.screen.id}`, '_blank'); onClose(); return; }
    if (item.kind === 'template') { navigate('/control/templates'); onClose(); return; }
    if (item.kind === 'layout') {
      onClose();
      try {
        const res = await api.post('/screens/sync', { layout_id: item.layout.id });
        toast?.(`Took “${item.layout.name}” to ${res?.pushed ?? 'all'} screens${res?.locked ? ` (${res.locked} locked)` : ''}`, 'success');
      } catch (e) {
        toast?.(`Take failed: ${e.message}`, 'error');
      }
    }
  }, [navigate, onClose, toast]);

  // keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, sel, run, onClose]);

  // keep selection in view
  useEffect(() => {
    listRef.current?.children[sel]?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  const KIND_BADGE = {
    page: ['PAGE', '#3b82f6'], layout: ['TAKE', '#16a34a'], screen: ['SCREEN', '#8b5cf6'], template: ['TPL', '#f59e0b'],
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(3,6,12,0.62)', backdropFilter: 'blur(6px)', animation: 'cpFade 0.12s ease-out' }}
      onMouseDown={onClose}>
      <style>{`
        @keyframes cpFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cpPop { from { opacity: 0; transform: translateY(-12px) scale(0.985); } to { opacity: 1; transform: none; } }
      `}</style>
      <div className="w-full max-w-xl bg-gray-900 border border-gray-700/70 rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'cpPop 0.16s cubic-bezier(.2,.9,.3,1)' }}
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, take layouts, open screens…"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none" />
          <kbd className="text-[10px] text-gray-600 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-600 text-sm">No matches</div>
          )}
          {items.map((it, i) => {
            const [badge, color] = KIND_BADGE[it.kind];
            return (
              <button key={`${it.kind}-${it.label}-${i}`}
                onMouseEnter={() => setSel(i)} onClick={() => run(it)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                style={{ background: i === sel ? 'rgba(59,130,246,0.14)' : 'transparent' }}>
                {it.kind === 'layout'
                  ? <LayoutThumb layout={it.layout} className="w-12 h-7" />
                  : <span className="w-12 h-7 flex items-center justify-center rounded border border-gray-800 bg-gray-950 text-[9px] font-bold tracking-wider" style={{ color }}>{badge}</span>}
                <span className="flex-1 min-w-0 truncate text-sm text-gray-200">{it.label}</span>
                <span className="text-[10px] text-gray-600 shrink-0">{it.hint}</span>
                {i === sel && <kbd className="text-[10px] text-gray-500 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 shrink-0">↵</kbd>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-800 text-[10px] text-gray-600">
          <span><kbd className="bg-gray-800 border border-gray-700 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="bg-gray-800 border border-gray-700 rounded px-1">↵</kbd> run</span>
          <span className="ml-auto text-gray-700">Layouts take to every unlocked screen</span>
        </div>
      </div>
    </div>
  );
}
