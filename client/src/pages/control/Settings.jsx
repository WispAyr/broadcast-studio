import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { confirmAsync } from '../../lib/dialog';

export default function Settings() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [studioInfo, setStudioInfo] = useState({ name: '', slug: '' });
  const [loading, setLoading] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'operator' });
  const [studioSaving, setStudioSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const meData = await api.get('/auth/me');
        const currentUser = meData.user || meData;
        setUser(currentUser);
        setStudioInfo({
          name: meData.studio?.name || '',
          slug: meData.studio?.slug || ''
        });

        if (currentUser.role === 'admin') {
          try {
            const usersData = await api.get('/users');
            setUsers(usersData.users || usersData || []);
          } catch {
            // Users endpoint may not exist
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleSaveStudio() {
    setStudioSaving(true);
    try {
      await api.put('/studio', studioInfo);
      toast?.('Studio settings saved', 'success');
    } catch (err) {
      toast?.(`Save failed: ${err.message}`, 'error');
    } finally {
      setStudioSaving(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      await api.post('/users', newUser);
      toast?.('User created', 'success');
      setNewUser({ username: '', password: '', role: 'operator' });
      setShowNewUser(false);
      const usersData = await api.get('/users');
      setUsers(usersData.users || usersData || []);
    } catch (err) {
      toast?.(`Create failed: ${err.message}`, 'error');
    }
  }

  async function handleDeleteUser(id) {
    const u = users.find(x => x.id === id);
    if (!await confirmAsync({
      title: 'Delete user?',
      message: `"${u?.username || id}" will lose access immediately. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`/users/${id}`);
      toast?.('User deleted', 'success');
      setUsers(users.filter((u) => u.id !== id));
    } catch (err) {
      toast?.(`Delete failed: ${err.message}`, 'error');
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading settings...</p>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Studio Info */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Studio Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Studio Name</label>
            <input
              type="text"
              value={studioInfo.name}
              onChange={(e) => setStudioInfo({ ...studioInfo, name: e.target.value })}
              disabled={!isAdmin}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:text-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={studioInfo.slug}
              onChange={(e) => setStudioInfo({ ...studioInfo, slug: e.target.value })}
              disabled={!isAdmin}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:text-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          {isAdmin && (
            <button
              onClick={handleSaveStudio}
              disabled={studioSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {studioSaving ? 'Saving...' : 'Save Studio Info'}
            </button>
          )}
        </div>
      </div>

      {/* Current User */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Your Account</h2>
        {user && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Username</span>
              <span className="text-white">{user.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Role</span>
              <span className="text-white capitalize">{user.role}</span>
            </div>
          </div>
        )}
      </div>

      {/* Users Management (admin only) */}
      {isAdmin && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Users</h2>
            <button
              onClick={() => setShowNewUser(!showNewUser)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add User
            </button>
          </div>

          {showNewUser && (
            <form onSubmit={handleCreateUser} className="mb-4 p-4 bg-gray-800 rounded-lg space-y-3">
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="Username"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Password"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewUser(false)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg"
              >
                <div>
                  <span className="text-white text-sm">{u.username}</span>
                  <span className="text-gray-500 text-xs ml-2 capitalize">{u.role}</span>
                </div>
                {u.id !== user.id && (
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="text-red-400 hover:text-red-300 text-xs transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-gray-600 text-sm">No users found.</p>
            )}
          </div>
        </div>
      )}

      {/* Theme placeholder */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Theme</h2>
        <p className="text-gray-500 text-sm">Theme customization coming soon.</p>
      </div>

      {/* About */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Application</span>
            <span className="text-white">Broadcast Studio</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Description</span>
            <span className="text-white">Multi-screen studio control system</span>
          </div>
        </div>
      </div>
    </div>
  );
}
