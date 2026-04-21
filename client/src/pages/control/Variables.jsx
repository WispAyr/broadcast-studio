import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { confirmAsync } from '../../lib/dialog';
import { connectSocket } from '../../lib/socket';

const KINDS = [
  { value: 'number',  label: 'Number'  },
  { value: 'string',  label: 'String'  },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum',    label: 'Enum'    },
  { value: 'json',    label: 'JSON'    },
];

function getUser() {
  try { return JSON.parse(localStorage.getItem('broadcast_user') || '{}'); }
  catch { return {}; }
}

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function formatRelative(ts) {
  if (!ts) return '';
  const t = new Date(ts.replace(' ', 'T') + 'Z').getTime();
  const d = Math.max(0, Date.now() - t);
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

const STUDIO_PREF_KEY = 'broadcast_variables_studio_id';

export default function Variables() {
  const toast = useToast();
  const user = getUser();
  const isSuperAdmin = user.role === 'super_admin';
  const [studios, setStudios] = useState([]);
  const [studioId, setStudioId] = useState(() => {
    if (isSuperAdmin) return localStorage.getItem(STUDIO_PREF_KEY) || null;
    return user.studio_id || null;
  });
  const [loading, setLoading] = useState(true);
  const [variables, setVariables] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState(null);
  const [showCreateKey, setShowCreateKey] = useState(false);

  const base = studioId ? `/studios/${studioId}/variables` : null;
  const keysBase = studioId ? `/studios/${studioId}/api-keys` : null;

  // Super-admin: load all studios for the picker; auto-select first if none persisted.
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/studios')
      .then((list) => {
        const arr = list || [];
        setStudios(arr);
        if (!studioId && arr.length > 0) {
          setStudioId(arr[0].id);
          localStorage.setItem(STUDIO_PREF_KEY, arr[0].id);
        }
      })
      .catch((err) => toast?.(`Studios load failed: ${err.message}`, 'error'));
  }, [isSuperAdmin]);

  function selectStudio(id) {
    setStudioId(id);
    localStorage.setItem(STUDIO_PREF_KEY, id);
    setVariables([]);
    setApiKeys([]);
    setLoading(true);
  }

  async function load() {
    try {
      const [vs, ks] = await Promise.all([
        api.get(base),
        api.get(keysBase).catch(() => []),
      ]);
      setVariables(vs || []);
      setApiKeys(ks || []);
    } catch (err) {
      toast?.(`Load failed: ${err.message}`, 'error');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!studioId) { setLoading(false); return; }
    setLoading(true);
    load();
    const socket = connectSocket();
    socket.emit('join_studio', { studioId });
    const onUpdate = (payload) => {
      setVariables(prev => prev.map(v => v.id === payload.id ? { ...v, value: payload.value, updated_at: new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '') } : v));
    };
    socket.on('variable_update', onUpdate);
    return () => {
      socket.off('variable_update', onUpdate);
      socket.emit('leave_studio', { studioId });
    };
  }, [studioId]);

  async function setValue(v, value) {
    try {
      const updated = await api.patch(`${base}/${encodeURIComponent(v.id)}`, { value });
      setVariables(prev => prev.map(x => x.id === v.id ? updated : x));
    } catch (err) {
      toast?.(`Update failed: ${err.message}`, 'error');
    }
  }

  async function bump(v, delta) {
    try {
      const updated = await api.post(`${base}/${encodeURIComponent(v.id)}/bump`, { delta });
      setVariables(prev => prev.map(x => x.id === v.id ? updated : x));
    } catch (err) {
      toast?.(`Bump failed: ${err.message}`, 'error');
    }
  }

  async function resetVar(v) {
    if (!await confirmAsync({
      title: 'Reset variable?',
      message: `Reset "${v.name}" back to its default value (${formatValue(v.default_value)}).`,
      confirmLabel: 'Reset',
    })) return;
    try {
      const updated = await api.post(`${base}/${encodeURIComponent(v.id)}/reset`, {});
      setVariables(prev => prev.map(x => x.id === v.id ? updated : x));
      toast?.('Reset', 'success');
    } catch (err) {
      toast?.(`Reset failed: ${err.message}`, 'error');
    }
  }

  async function deleteVar(v) {
    if (!await confirmAsync({
      title: 'Delete variable?',
      message: `"${v.name}" (${v.id}) will be removed. Any module bound to it will stop updating.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`${base}/${encodeURIComponent(v.id)}`);
      setVariables(prev => prev.filter(x => x.id !== v.id));
      toast?.('Deleted', 'success');
    } catch (err) {
      toast?.(`Delete failed: ${err.message}`, 'error');
    }
  }

  async function revokeKey(k) {
    if (!await confirmAsync({
      title: 'Revoke API key?',
      message: `"${k.name}" will stop working immediately. External drivers using it will fail.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`${keysBase}/${k.id}`);
      setApiKeys(prev => prev.filter(x => x.id !== k.id));
      toast?.('Revoked', 'success');
    } catch (err) {
      toast?.(`Revoke failed: ${err.message}`, 'error');
    }
  }

  if (!studioId) {
    if (isSuperAdmin && studios.length === 0) {
      return <div className="p-8 text-gray-500 animate-pulse">Loading studios…</div>;
    }
    if (!isSuperAdmin) {
      return <div className="p-8 text-gray-400">This account is not associated with a studio.</div>;
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Variables</h1>
          <p className="text-gray-400 mt-1">Named values modules can bind to. Drive from UI, webhook, or API key.</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && studios.length > 0 && (
            <select
              value={studioId || ''}
              onChange={(e) => selectStudio(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Studio scope"
            >
              {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowCreate(true)} disabled={!studioId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Variable
          </button>
        </div>
      </div>
      {loading && <div className="text-gray-500 animate-pulse mb-4">Loading variables…</div>}

      {variables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <p className="text-lg mb-2">No variables yet</p>
          <p className="text-sm">Create one to give modules and external drivers a named value to share.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Kind</th>
                <th className="px-4 py-3 text-left">Value</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variables.map(v => (
                <tr key={v.id} className="border-t border-gray-800 hover:bg-gray-850">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{v.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{v.id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{v.kind}</td>
                  <td className="px-4 py-3 min-w-[280px]"><ValueEditor v={v} onSet={setValue} onBump={bump} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatRelative(v.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => resetVar(v)} className="px-2 py-1 text-xs text-gray-300 hover:text-white mr-2">Reset</button>
                    <button onClick={() => deleteVar(v)} className="px-2 py-1 text-xs text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* API Keys */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">API Keys</h2>
            <p className="text-gray-400 text-sm mt-1">Let external drivers (Iris, scripts, webhooks) write variables for this studio.</p>
          </div>
          <button onClick={() => setShowCreateKey(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-sm font-medium">
            New Key
          </button>
        </div>
        {newKeyRaw && (
          <div className="mb-4 p-4 bg-amber-900/30 border border-amber-700 rounded-lg text-sm">
            <div className="text-amber-300 font-medium mb-2">Copy this key now — it will not be shown again.</div>
            <code className="block bg-black/50 text-amber-100 p-2 rounded font-mono break-all select-all">{newKeyRaw}</code>
            <button onClick={() => setNewKeyRaw(null)} className="mt-2 text-xs text-amber-300 hover:text-amber-200">Dismiss</button>
          </div>
        )}
        {apiKeys.length === 0 ? (
          <div className="text-gray-500 text-sm py-4">No API keys yet.</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Prefix</th>
                  <th className="px-4 py-3 text-left">Last used</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(k => (
                  <tr key={k.id} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-white">{k.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{k.key_prefix}…</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{k.last_used_at ? formatRelative(k.last_used_at) : 'never'}</td>
                    <td className="px-4 py-3">
                      {k.active ? <span className="text-green-400 text-xs">active</span> : <span className="text-gray-500 text-xs">revoked</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {k.active && (
                        <button onClick={() => revokeKey(k)} className="px-2 py-1 text-xs text-red-400 hover:text-red-300">Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateVariableModal
          base={base}
          onClose={() => setShowCreate(false)}
          onCreated={(v) => { setVariables(prev => [...prev, v]); setShowCreate(false); toast?.('Created', 'success'); }}
          onError={(msg) => toast?.(msg, 'error')}
        />
      )}

      {showCreateKey && (
        <CreateApiKeyModal
          base={keysBase}
          onClose={() => setShowCreateKey(false)}
          onCreated={(key, meta) => { setNewKeyRaw(key); setApiKeys(prev => [meta, ...prev]); setShowCreateKey(false); }}
          onError={(msg) => toast?.(msg, 'error')}
        />
      )}
    </div>
  );
}

function ValueEditor({ v, onSet, onBump }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (v.kind === 'number') {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => onBump(v, -1)} className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded text-white">−</button>
        <div className="text-white font-mono w-24 text-center text-lg">{formatValue(v.value)}</div>
        <button onClick={() => onBump(v, 1)} className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded text-white">+</button>
        <button onClick={() => onBump(v, 10)} className="px-2 h-7 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300">+10</button>
        {editing ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={() => { const n = Number(draft); if (!Number.isNaN(n)) onSet(v, n); setEditing(false); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm" type="number" />
        ) : (
          <button onClick={() => { setDraft(String(v.value ?? 0)); setEditing(true); }} className="text-xs text-gray-400 hover:text-white">Set…</button>
        )}
      </div>
    );
  }

  if (v.kind === 'boolean') {
    const on = !!v.value;
    return (
      <button onClick={() => onSet(v, !on)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${on ? 'bg-green-500/20 text-green-300 border border-green-600' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-green-400' : 'bg-gray-500'}`}></span>
        {on ? 'On' : 'Off'}
      </button>
    );
  }

  if (v.kind === 'enum') {
    const options = (v.metadata && Array.isArray(v.metadata.options)) ? v.metadata.options : [];
    return (
      <select value={v.value ?? ''} onChange={e => onSet(v, e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm">
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (v.kind === 'json') {
    return (
      <div className="flex items-center gap-2">
        <code className="text-gray-300 font-mono text-xs truncate max-w-[200px]">{formatValue(v.value)}</code>
        {editing ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
              className="w-60 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono text-xs" placeholder='{"key":"value"}' />
            <button onClick={() => { try { onSet(v, JSON.parse(draft)); setEditing(false); } catch { /* toast handled outside */ } }}
              className="text-xs text-blue-400 hover:text-blue-300">Save</button>
          </div>
        ) : (
          <button onClick={() => { setDraft(JSON.stringify(v.value)); setEditing(true); }} className="text-xs text-gray-400 hover:text-white">Edit…</button>
        )}
      </div>
    );
  }

  // string default
  return editing ? (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSet(v, draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
      className="w-60 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm" />
  ) : (
    <button onClick={() => { setDraft(v.value ?? ''); setEditing(true); }}
      className="text-left text-white font-mono truncate max-w-[260px] hover:text-blue-300">{formatValue(v.value)}</button>
  );
}

function CreateVariableModal({ base, onClose, onCreated, onError }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('number');
  const [defaultValue, setDefaultValue] = useState('');
  const [enumOptions, setEnumOptions] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!id.trim() || !name.trim()) { onError('id and name required'); return; }
    let parsedDefault = defaultValue;
    if (kind === 'number') parsedDefault = defaultValue === '' ? 0 : Number(defaultValue);
    else if (kind === 'boolean') parsedDefault = defaultValue === 'true';
    else if (kind === 'json') { try { parsedDefault = defaultValue ? JSON.parse(defaultValue) : null; } catch { onError('default must be valid JSON'); return; } }
    const metadata = {};
    if (kind === 'enum') {
      metadata.options = enumOptions.split(',').map(s => s.trim()).filter(Boolean);
      if (!metadata.options.length) { onError('enum needs at least one option'); return; }
      if (!parsedDefault) parsedDefault = metadata.options[0];
    }
    setSaving(true);
    try {
      const created = await api.post(base, { id: id.trim(), name: name.trim(), kind, value: parsedDefault, default_value: parsedDefault, metadata });
      onCreated(created);
    } catch (err) { onError(`Create failed: ${err.message}`); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">New Variable</h2>

        <label className="block text-sm text-gray-400 mb-1">ID <span className="text-gray-600">(namespace:name, machine-readable)</span></label>
        <input value={id} onChange={e => setId(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-3 font-mono text-sm"
          placeholder="kiltwalk:finishers" autoFocus />

        <label className="block text-sm text-gray-400 mb-1">Display name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-3"
          placeholder="Kiltwalk Finishers" />

        <label className="block text-sm text-gray-400 mb-1">Kind</label>
        <select value={kind} onChange={e => setKind(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-3">
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>

        {kind === 'enum' && (
          <>
            <label className="block text-sm text-gray-400 mb-1">Options <span className="text-gray-600">(comma-separated)</span></label>
            <input value={enumOptions} onChange={e => setEnumOptions(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-3"
              placeholder="red, amber, green" />
          </>
        )}

        <label className="block text-sm text-gray-400 mb-1">Default value</label>
        {kind === 'boolean' ? (
          <select value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-6">
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        ) : (
          <input value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-6 font-mono text-sm"
            placeholder={kind === 'number' ? '0' : kind === 'json' ? '{}' : ''} />
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateApiKeyModal({ base, onClose, onCreated, onError }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { onError('name required'); return; }
    setSaving(true);
    try {
      const resp = await api.post(base, { name: name.trim(), scopes: ['variables:write'] });
      const { key, ...meta } = resp;
      onCreated(key, meta);
    } catch (err) { onError(`Create failed: ${err.message}`); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">New API Key</h2>
        <label className="block text-sm text-gray-400 mb-1">Name <span className="text-gray-600">(who will use this key)</span></label>
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-4"
          placeholder="Iris van Pi — linecrossing driver" />
        <p className="text-xs text-gray-500 mb-6">Scope: <code className="text-gray-300">variables:write</code> on this studio only.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
