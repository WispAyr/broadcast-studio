import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useLiveData from '../../hooks/useLiveData';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';

// Content manager (Content Fabric CF-2) — organise content into Collections
// ("taskings") and tag it. Bundle layouts / decks / scenes together, tag them,
// and reuse the bundle to build displays. Uses the CF-1 API; no server change.

const TYPES = [
  { key: 'layout', label: 'Layouts', icon: '🔲' },
  { key: 'deck', label: 'Decks', icon: '🎛️' },
  { key: 'scene', label: 'Scenes', icon: '🎭' },
];

export default function ContentManager() {
  const { studioId, studios, setStudioId, canSwitchStudios } = useLiveData();
  const toast = useToast();

  const [collections, setCollections] = useState([]);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);        // { ...collection, items:[] }
  const [resources, setResources] = useState({ layout: [], deck: [], scene: [] });
  const [tab, setTab] = useState('layout');
  const [query, setQuery] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [allStudios, setAllStudios] = useState([]);      // grant targets
  const [grantsByRes, setGrantsByRes] = useState({});    // "type:id" -> [{grantee_type,grantee_id}]

  useEffect(() => { api.get('/studios').then(s => setAllStudios(s || [])).catch(() => {}); }, []);
  const grantKey = (type, id) => `${type}:${id}`;
  const loadGrants = useCallback((type, id) => {
    api.get(`/content/${type}/${id}/grants`).then(g => setGrantsByRes(p => ({ ...p, [grantKey(type, id)]: g }))).catch(() => {});
  }, []);
  const grantedTo = (type, id, studioId) => (grantsByRes[grantKey(type, id)] || []).some(g => g.grantee_type === 'studio' && g.grantee_id === studioId);
  async function setVisibility(type, id, v) {
    setResources(r => ({ ...r, [type]: r[type].map(x => x.id === id ? { ...x, visibility: v } : x) }));
    try { await api.put(`/content/${type}/${id}/visibility`, { visibility: v }); if (v === 'shared') loadGrants(type, id); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  async function toggleGrant(type, id, studioId, on) {
    setGrantsByRes(p => { const k = grantKey(type, id); const cur = p[k] || []; return { ...p, [k]: on ? [...cur, { grantee_type: 'studio', grantee_id: studioId }] : cur.filter(g => !(g.grantee_type === 'studio' && g.grantee_id === studioId)) }; });
    try { await (on ? api.post(`/content/${type}/${id}/grants`, { grantee_type: 'studio', grantee_id: studioId }) : api.delete(`/content/${type}/${id}/grants`, { grantee_type: 'studio', grantee_id: studioId })); }
    catch (e) { toast?.(e.message, 'error'); }
  }

  const loadCollections = useCallback(async () => {
    try { setCollections(await api.get('/collections')); } catch (e) { toast?.(e.message, 'error'); }
  }, [toast]);
  useEffect(() => { loadCollections(); }, [loadCollections]);

  // Resources for the current studio (for adding + tagging).
  const loadResources = useCallback(async () => {
    if (!studioId) { setResources({ layout: [], deck: [], scene: [] }); return; }
    const out = {};
    await Promise.all(TYPES.map(async t => {
      try { out[t.key] = await api.get(`/content/${t.key}?studio_id=${studioId}`); } catch { out[t.key] = []; }
    }));
    setResources(out);
  }, [studioId]);
  useEffect(() => { loadResources(); }, [loadResources]);

  useEffect(() => {
    if (!selId) { setDetail(null); return; }
    api.get(`/collections/${selId}`).then(setDetail).catch(e => toast?.(e.message, 'error'));
  }, [selId, toast]);

  // Load grants for any already-shared resources in view.
  useEffect(() => {
    (resources[tab] || []).forEach(r => { if (r.visibility === 'shared' && !grantsByRes[grantKey(tab, r.id)]) loadGrants(tab, r.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, tab]);

  const inCollection = useCallback((type, id) => detail?.items?.some(it => it.resource_type === type && it.resource_id === id), [detail]);

  async function createCollection() {
    const name = window.prompt('New collection name', 'World Cup Fanzone kit');
    if (!name) return;
    try { const c = await api.post('/collections', { name }); await loadCollections(); setSelId(c.id); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  async function del() {
    try { await api.delete(`/collections/${selId}`); toast?.('Collection deleted', 'success'); setSelId(null); loadCollections(); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  async function toggleItem(type, id, on) {
    // optimistic
    setDetail(d => ({ ...d, items: on
      ? [...(d.items || []), { resource_type: type, resource_id: id, name: resources[type]?.find(r => r.id === id)?.name }]
      : (d.items || []).filter(it => !(it.resource_type === type && it.resource_id === id)) }));
    try {
      if (on) await api.post(`/collections/${selId}/items`, { resource_type: type, resource_id: id });
      else await api.delete(`/collections/${selId}/items`, { resource_type: type, resource_id: id });
      loadCollections();
    } catch (e) { toast?.(e.message, 'error'); }
  }
  async function saveTags(type, id, tagsStr) {
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    setResources(r => ({ ...r, [type]: r[type].map(x => x.id === id ? { ...x, tags } : x) }));
    try { await api.put(`/content/${type}/${id}/tags`, { tags }); } catch (e) { toast?.(e.message, 'error'); }
  }

  const q = query.trim().toLowerCase();
  const list = useMemo(() => (resources[tab] || []).filter(r => !q || `${r.name} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q)), [resources, tab, q]);
  const itemsByType = useMemo(() => {
    const m = { layout: [], deck: [], scene: [] };
    (detail?.items || []).forEach(it => { (m[it.resource_type] = m[it.resource_type] || []).push(it); });
    return m;
  }, [detail]);

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/60 shrink-0">
        <span className="text-sm font-semibold text-white">Content</span>
        {canSwitchStudios && studios.length > 0 && (
          <select value={studioId || ''} onChange={e => setStudioId(e.target.value)} className="px-2 py-1 bg-gray-900 border border-gray-700 text-white rounded text-xs">
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <span className="text-xs text-gray-500 ml-2">Bundle content into collections for a tasking, and tag it.</span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Collections list */}
        <div className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
          <div className="p-2 border-b border-gray-800">
            <button onClick={createCollection} className="w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded">+ New collection</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {collections.map(c => (
              <div key={c.id} onClick={() => setSelId(c.id)}
                className={`px-2.5 py-2 rounded-lg cursor-pointer border transition-colors ${selId === c.id ? 'bg-indigo-900/40 border-indigo-600' : 'bg-gray-900/60 border-transparent hover:bg-gray-800'}`}>
                <div className="text-sm text-white font-medium truncate">{c.icon} {c.name}</div>
                <div className="text-[10px] text-gray-500">{c.item_count} item{c.item_count !== 1 ? 's' : ''}</div>
              </div>
            ))}
            {collections.length === 0 && <p className="text-[11px] text-gray-600 px-1 py-2">No collections yet.</p>}
          </div>
        </div>

        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-3">🗂️</div>
              <p className="text-gray-300 font-semibold mb-1">Collections</p>
              <p className="text-gray-500 text-sm mb-4 max-w-xs">A collection bundles layouts, decks and scenes for a tasking. Pick one, or create a new one.</p>
              <button onClick={createCollection} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Create collection</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex min-w-0">
            {/* In this collection */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 border-r border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white truncate">{detail.icon} {detail.name}</h2>
                <button onClick={() => setConfirmDel(true)} className="px-2.5 py-1 text-red-400 hover:bg-red-950/40 text-xs rounded-lg shrink-0">Delete</button>
              </div>
              {TYPES.map(t => (
                <div key={t.key} className="mb-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">{t.icon} {t.label} ({itemsByType[t.key].length})</p>
                  <div className="space-y-1">
                    {itemsByType[t.key].map(it => (
                      <div key={it.resource_id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-gray-900/60 rounded-lg text-sm">
                        <span className="text-gray-200 truncate">{it.name || <span className="text-gray-600 italic">(missing)</span>}</span>
                        <button onClick={() => toggleItem(t.key, it.resource_id, false)} className="text-gray-500 hover:text-red-400 text-sm shrink-0">×</button>
                      </div>
                    ))}
                    {itemsByType[t.key].length === 0 && <p className="text-[11px] text-gray-700 italic px-1">none</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Add from studio + tag */}
            <div className="w-96 shrink-0 flex flex-col min-h-0">
              <div className="p-3 border-b border-gray-800 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Add content {studioId ? '' : '— pick a studio'}</p>
                <div className="flex gap-1">
                  {TYPES.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`flex-1 px-2 py-1 text-xs rounded ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{t.icon} {t.label}</button>
                  ))}
                </div>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search / filter by tag…"
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-xs" />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {list.map(r => {
                  const on = inCollection(tab, r.id);
                  return (
                    <div key={r.id} className={`px-2.5 py-2 rounded-lg border ${on ? 'bg-indigo-950/40 border-indigo-700/60' : 'bg-gray-900/60 border-gray-800'}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleItem(tab, r.id, !on)}
                          className={`shrink-0 w-5 h-5 rounded text-xs font-bold ${on ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{on ? '✓' : '+'}</button>
                        <span className="text-sm text-gray-200 truncate flex-1">{r.name}</span>
                      </div>
                      <input defaultValue={(r.tags || []).join(', ')} onBlur={e => saveTags(tab, r.id, e.target.value)}
                        placeholder="tags…" className="w-full mt-1.5 px-2 py-1 bg-gray-950 border border-gray-800 rounded text-[11px] text-gray-300 font-mono" />
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] font-mono uppercase text-gray-600">Access</span>
                        <select value={r.visibility || 'private'} onChange={e => setVisibility(tab, r.id, e.target.value)}
                          className="flex-1 px-1.5 py-0.5 bg-gray-950 border border-gray-800 rounded text-[11px] text-gray-300">
                          <option value="private">Private (this studio)</option>
                          <option value="shared">Shared → chosen studios</option>
                          <option value="global">Global (everyone)</option>
                        </select>
                      </div>
                      {r.visibility === 'shared' && (
                        <div className="mt-1 pl-2 border-l border-gray-800 space-y-0.5">
                          {allStudios.filter(s => s.id !== studioId).map(s => (
                            <label key={s.id} className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                              <input type="checkbox" checked={grantedTo(tab, r.id, s.id)} onChange={e => toggleGrant(tab, r.id, s.id, e.target.checked)} className="accent-indigo-500" />
                              <span className="truncate">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {list.length === 0 && <p className="text-[11px] text-gray-600 px-1 py-2">{studioId ? 'Nothing here.' : 'Pick a studio to browse its content.'}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={confirmDel} title="Delete collection"
        message={`Delete "${detail?.name}"? The content itself is not deleted — only the collection.`}
        confirmLabel="Delete" variant="danger"
        onConfirm={() => { setConfirmDel(false); del(); }} onCancel={() => setConfirmDel(false)} />
    </div>
  );
}
