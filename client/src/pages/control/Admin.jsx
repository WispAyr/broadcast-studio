import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

// ─── Badges ──────────────────────────────────────────────────────────────────
const roleBadge = (role) => {
  const map = {
    super_admin: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    admin: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    producer: 'bg-green-500/20 text-green-300 border border-green-500/30',
    viewer: 'bg-gray-500/20 text-gray-400 border border-gray-600/30',
  };
  return map[role] || map.viewer;
};

const statusBadge = (online) =>
  online
    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
    : 'bg-gray-500/20 text-gray-500 border border-gray-600/30';

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <p className="text-white text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Generic Modal Wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Section: Clients ─────────────────────────────────────────────────────────
function switchToStudio(studio) {
  try {
    const raw = localStorage.getItem('broadcast_user');
    const user = raw ? JSON.parse(raw) : {};
    user.studio_id = studio.id;
    user.studio_name = studio.name;
    localStorage.setItem('broadcast_user', JSON.stringify(user));
  } catch (_) {}
  window.location.href = '/god';
}

function getActiveStudioId() {
  try {
    const raw = localStorage.getItem('broadcast_user');
    if (!raw) return null;
    return JSON.parse(raw).studio_id || null;
  } catch (_) { return null; }
}

function ClientsSection() {
  const [studios, setStudios] = useState([]);
  const activeStudioId = getActiveStudioId();
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', studio? }
  const [form, setForm] = useState({ name: '', slug: '', public_only: false });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/studios').then(setStudios).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function openCreate() { setForm({ name: '', slug: '', public_only: false }); setError(''); setModal({ mode: 'create' }); }
  function openEdit(s) { setForm({ name: s.name, slug: s.slug, public_only: !!s.public_only }); setError(''); setModal({ mode: 'edit', studio: s }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (modal.mode === 'create') {
        await api.post('/studios', form);
      } else {
        await api.put(`/studios/${modal.studio.id}`, form);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(s) {
    await api.put(`/studios/${s.id}`, { active: s.active ? 0 : 1 });
    load();
  }

  async function handleDelete(s) {
    setConfirm({ message: `Delete studio "${s.name}"? This action cannot be undone.`, onConfirm: async () => {
      await api.delete(`/studios/${s.id}`);
      setConfirm(null);
      load();
    }});
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Clients</h2>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors">
          <span>+ New Client</span>
        </button>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Slug</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Screens</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Layouts</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Users</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Created</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">Loading...</td></tr>
            ) : studios.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No studios yet</td></tr>
            ) : studios.map(s => (
              <tr key={s.id} className={`border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors ${s.id === activeStudioId ? 'bg-blue-900/20' : ''}`}>
                <td className="px-4 py-3 text-white font-medium">
                  {s.name}
                  {s.id === activeStudioId && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40">active</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-gray-600/20 text-gray-500 border border-gray-600/30'}`}>
                      {s.active ? 'Active' : 'Disabled'}
                    </span>
                    {s.public_only ? (
                      <span title="Public-only: only public_safe layouts can be pushed to screens in this studio" className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Public-only
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{s.screen_count ?? 0}</td>
                <td className="px-4 py-3 text-gray-300">{s.layout_count ?? 0}</td>
                <td className="px-4 py-3 text-gray-300">{s.user_count ?? 0}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => switchToStudio(s)} title="Switch to this studio and open God View" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">View →</button>
                    <button onClick={() => openEdit(s)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Edit</button>
                    <button onClick={() => toggleActive(s)} className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors">{s.active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => handleDelete(s)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Client' : 'Edit Client'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Studio Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Now Ayrshire Radio" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500" placeholder="now-ayrshire" />
            </div>
            <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <input id="public_only" type="checkbox" checked={form.public_only} onChange={e => setForm(f => ({ ...f, public_only: e.target.checked }))}
                className="mt-0.5 accent-amber-500" />
              <div>
                <label htmlFor="public_only" className="text-sm text-white font-medium cursor-pointer">Public-facing studio</label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Only layouts flagged <span className="text-amber-300">public_safe</span> can be pushed to screens in this studio.
                  Use for ad-vans, public LED walls, anything facing the public — blocks ops/SITREP content from landing accidentally.
                </p>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium">
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

// ─── Section: Users ───────────────────────────────────────────────────────────
function UsersSection({ studios }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'producer', studio_id: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/auth/users').then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function openCreate() { setForm({ username: '', password: '', name: '', role: 'producer', studio_id: '' }); setError(''); setModal({ mode: 'create' }); }
  function openEdit(u) { setForm({ username: u.username, password: '', name: u.name, role: u.role, studio_id: u.studio_id || '' }); setError(''); setModal({ mode: 'edit', user: u }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (modal.mode === 'create') {
        await api.post('/auth/register', { ...form, studio_id: form.studio_id || null });
      } else {
        const payload = { name: form.name, role: form.role, studio_id: form.studio_id || null };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${modal.user.id}`, payload);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(u) {
    setConfirm({ message: `Delete user "${u.username}"? This cannot be undone.`, onConfirm: async () => {
      await api.delete(`/auth/users/${u.id}`);
      setConfirm(null);
      load();
    }});
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Users</h2>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors">
          <span>+ New User</span>
        </button>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Username</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Studio</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">No users</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-white font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3 text-gray-300">{u.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{u.studio_name || <span className="text-purple-400 text-xs">Global</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(u)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Edit</button>
                    <button onClick={() => handleDelete(u)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New User' : 'Edit User'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {modal.mode === 'create' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Username</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{modal.mode === 'create' ? 'Password' : 'New Password (leave blank to keep)'}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required={modal.mode === 'create'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="super_admin">super_admin</option>
                <option value="admin">admin</option>
                <option value="producer">producer</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Studio (optional for super_admin)</label>
              <select value={form.studio_id} onChange={e => setForm(f => ({ ...f, studio_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">— Global (no studio) —</option>
                {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium">
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

// ─── Section: Screens ─────────────────────────────────────────────────────────
function ScreensSection({ studios }) {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [layouts, setLayouts] = useState([]);
  const [pushModal, setPushModal] = useState(null); // { screen }
  const [pushLayoutId, setPushLayoutId] = useState('');
  const [copied, setCopied] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/screens').then(setScreens).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function handleDelete(s) {
    setConfirm({ message: `Delete screen "${s.name}"?`, onConfirm: async () => {
      await api.delete(`/screens/${s.id}`);
      setConfirm(null);
      load();
    }});
  }

  async function toggleLock(s) {
    const next = s.accepts_broadcasts ? 0 : 1;
    await api.put(`/screens/${s.id}`, { accepts_broadcasts: next });
    setScreens(prev => prev.map(x => x.id === s.id ? { ...x, accepts_broadcasts: next } : x));
  }

  async function openPushLayout(screen) {
    const studioLayouts = await api.get(`/layouts?studio_id=${screen.studio_id}`).catch(() => []);
    setLayouts(Array.isArray(studioLayouts) ? studioLayouts : []);
    setPushLayoutId('');
    setPushModal({ screen });
  }

  async function handlePushLayout(e) {
    e.preventDefault();
    if (!pushLayoutId) return;
    await api.put(`/screens/${pushModal.screen.id}`, { current_layout_id: pushLayoutId });
    setPushModal(null);
    load();
  }

  function copyUrl(screen) {
    const url = `${window.location.origin}/screen/${screen.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(screen.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">All Screens</h2>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Screen</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Studio</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Layout</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">URL</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Loading...</td></tr>
            ) : screens.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">No screens</td></tr>
            ) : screens.map(s => (
              <tr key={s.id} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-400">{s.studio_name}</td>
                <td className="px-4 py-3 text-gray-500">{s.screen_number}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s.is_online)}`}>
                    {s.is_online ? 'Online' : 'Offline'}
                  </span>
                  {!s.is_online && s.last_seen && (
                    <span className="block text-xs text-gray-600 mt-0.5">{s.last_seen?.slice(0, 16)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{s.layout_name || <span className="text-gray-600">—</span>}</td>
                <td className="px-4 py-3">
                  <button onClick={() => copyUrl(s)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-mono">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copied === s.id ? 'Copied!' : 'Copy URL'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => toggleLock(s)} title={s.accepts_broadcasts === 0 ? 'Locked — skipped on studio-wide sync. Click to unlock.' : 'Unlocked — receives studio-wide sync. Click to lock out.'}
                      className={`text-xs transition-colors ${s.accepts_broadcasts === 0 ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}>
                      {s.accepts_broadcasts === 0 ? 'Locked' : 'Unlocked'}
                    </button>
                    <button onClick={() => openPushLayout(s)} className="text-xs text-green-400 hover:text-green-300 transition-colors">Push Layout</button>
                    <button onClick={() => handleDelete(s)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {pushModal && (
        <Modal title={`Push Layout → ${pushModal.screen.name}`} onClose={() => setPushModal(null)}>
          <form onSubmit={handlePushLayout} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Select Layout</label>
              <select value={pushLayoutId} onChange={e => setPushLayoutId(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">— Choose layout —</option>
                {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setPushModal(null)} className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors font-medium">Push</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [studios, setStudios] = useState([]);
  const [tab, setTab] = useState('clients');

  useEffect(() => {
    const stored = localStorage.getItem('broadcast_user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user.role !== 'super_admin') {
          navigate('/control/dashboard');
          return;
        }
      } catch {
        navigate('/login');
        return;
      }
    } else {
      navigate('/login');
      return;
    }

    api.get('/studios').then(setStudios).catch(console.error);
  }, [navigate]);

  const tabs = [
    { id: 'clients', label: 'Clients' },
    { id: 'users', label: 'Users' },
    { id: 'screens', label: 'Screens' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Super Admin</h1>
        <p className="text-sm text-gray-500">Manage studios, users, and screens across the platform</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clients' && <ClientsSection />}
      {tab === 'users' && <UsersSection studios={studios} />}
      {tab === 'screens' && <ScreensSection studios={studios} />}
    </div>
  );
}
