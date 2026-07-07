import React, { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';

// Workgroups admin — a workgroup is a group of users that can operate a set of
// studios. Members get those studios in their picker (via /api/me/access), so
// e.g. an "Ops" workgroup spanning every operational studio gives ops staff
// everything operational without super_admin. Config only; nothing fires.

export default function Workgroups() {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [allStudios, setAllStudios] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);   // { ...wg, studios:[], members:[] }
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    try { setGroups(await api.get('/workgroups')); } catch (e) { toast?.(e.message, 'error'); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/studios').then(s => setAllStudios(s || [])).catch(() => {});
    api.get('/auth/users').then(u => setAllUsers(Array.isArray(u) ? u : (u?.users || []))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!selId) { setDetail(null); return; }
    api.get(`/workgroups/${selId}`).then(setDetail).catch(e => toast?.(e.message, 'error'));
  }, [selId, toast]);

  async function createWg() {
    const name = window.prompt('New workgroup name', 'Ops');
    if (!name) return;
    try { const w = await api.post('/workgroups', { name }); await load(); setSelId(w.id); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  async function del() {
    try { await api.delete(`/workgroups/${selId}`); toast?.('Workgroup deleted', 'success'); setSelId(null); load(); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  const hasStudio = (id) => detail?.studios?.some(s => s.id === id);
  const hasMember = (id) => detail?.members?.some(m => m.id === id);
  async function toggleStudio(sid, on) {
    setDetail(d => ({ ...d, studios: on ? [...d.studios, allStudios.find(s => s.id === sid)] : d.studios.filter(s => s.id !== sid) }));
    try { await (on ? api.post(`/workgroups/${selId}/studios`, { studio_id: sid }) : api.delete(`/workgroups/${selId}/studios`, { studio_id: sid })); load(); }
    catch (e) { toast?.(e.message, 'error'); }
  }
  async function toggleMember(uid, on) {
    setDetail(d => ({ ...d, members: on ? [...d.members, allUsers.find(u => u.id === uid)] : d.members.filter(m => m.id !== uid) }));
    try { await (on ? api.post(`/workgroups/${selId}/members`, { user_id: uid }) : api.delete(`/workgroups/${selId}/members`, { user_id: uid })); load(); }
    catch (e) { toast?.(e.message, 'error'); }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/60 shrink-0">
        <span className="text-sm font-semibold text-white">Workgroups</span>
        <span className="text-xs text-gray-500 ml-2">Group users + studios so a team can operate several studios (e.g. Ops = everything operational).</span>
      </div>
      <div className="flex-1 flex min-h-0">
        {/* List */}
        <div className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
          <div className="p-2 border-b border-gray-800">
            <button onClick={createWg} className="w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded">+ New workgroup</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {groups.map(g => (
              <div key={g.id} onClick={() => setSelId(g.id)}
                className={`px-2.5 py-2 rounded-lg cursor-pointer border transition-colors ${selId === g.id ? 'bg-indigo-900/40 border-indigo-600' : 'bg-gray-900/60 border-transparent hover:bg-gray-800'}`}>
                <div className="text-sm text-white font-medium truncate">{g.icon} {g.name}</div>
                <div className="text-[10px] text-gray-500">{g.studio_count} studio{g.studio_count !== 1 ? 's' : ''} · {g.member_count} member{g.member_count !== 1 ? 's' : ''}</div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-[11px] text-gray-600 px-1 py-2">No workgroups yet — create one.</p>}
          </div>
        </div>

        {/* Detail */}
        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-300 font-semibold mb-1">Workgroups</p>
              <p className="text-gray-500 text-sm mb-4 max-w-xs">A workgroup lets a team operate several studios. Pick one, or create a new one.</p>
              <button onClick={createWg} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Create workgroup</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 overflow-y-auto p-5">
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{detail.icon} {detail.name}</h2>
                <button onClick={() => setConfirmDel(true)} className="px-3 py-1.5 text-red-400 hover:bg-red-950/40 text-sm rounded-lg">Delete</button>
              </div>
              {detail.description && <p className="text-sm text-gray-400 -mt-2">{detail.description}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Studios */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">Studios ({detail.studios.length})</p>
                  <div className="space-y-1">
                    {allStudios.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-900/60 rounded-lg text-sm text-gray-200 cursor-pointer hover:bg-gray-800">
                        <input type="checkbox" checked={!!hasStudio(s.id)} onChange={e => toggleStudio(s.id, e.target.checked)} className="accent-blue-500" />
                        {s.name}
                      </label>
                    ))}
                    {allStudios.length === 0 && <p className="text-[11px] text-gray-600">No studios.</p>}
                  </div>
                </div>
                {/* Members */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">Members ({detail.members.length})</p>
                  <div className="space-y-1">
                    {allUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-900/60 rounded-lg text-sm text-gray-200 cursor-pointer hover:bg-gray-800">
                        <input type="checkbox" checked={!!hasMember(u.id)} onChange={e => toggleMember(u.id, e.target.checked)} className="accent-blue-500" />
                        <span className="truncate">{u.name || u.username}</span>
                        <span className="text-[10px] text-gray-500 ml-auto">{u.role?.replace('_', ' ')}</span>
                      </label>
                    ))}
                    {allUsers.length === 0 && <p className="text-[11px] text-gray-600">No users.</p>}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-600 leading-snug">Members see these studios in their studio picker (Deck, Scenes, Live) — so an Ops workgroup spanning every operational studio gives ops staff everything operational, without super-admin.</p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={confirmDel} title="Delete workgroup"
        message={`Delete "${detail?.name}"? Members lose the extra studio access it granted.`}
        confirmLabel="Delete" variant="danger"
        onConfirm={() => { setConfirmDel(false); del(); }} onCancel={() => setConfirmDel(false)} />
    </div>
  );
}
