import React, { useState, useEffect, useCallback } from 'react';
import api, { getMe } from '../../lib/api';

// ──────────────────────────────────────────────────────────────────────────
// /control/console — producer config for the in-studio console + Stream Deck.
// Build the button grid here; it renders at /console (touch) and each button
// gets a stable fire URL a Stream Deck / Bitfocus Companion can hit.
// ──────────────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  { value: 'take_layout', label: 'Take layout (override schedule)', needs: ['layout'] },
  { value: 'apply_scene', label: 'Apply scene (multi-screen)', needs: ['scene'] },
  { value: 'now_playing', label: 'Push Now / Next show', needs: ['moduleId'] },
  { value: 'breaking_news', label: 'Breaking-news banner', needs: ['severity', 'message', 'duration'] },
  { value: 'live_text', label: 'Live text / lower-third', needs: ['moduleId', 'text', 'subtitle'] },
  { value: 'module_config', label: 'Set module config (JSON)', needs: ['moduleId', 'config'] },
  { value: 'clear_overlays', label: 'Clear banners/overlays', needs: [] },
  { value: 'resume_schedule', label: 'Resume auto schedule', needs: [] },
  { value: 'reload_screens', label: 'Reload all screens', needs: [] },
  { value: 'blackout', label: 'Blackout (all dark)', needs: [] },
  { value: 'webhook', label: 'Webhook (HTTP call)', needs: ['url', 'method'] },
];

const COLORS = ['#F7941D', '#E2392D', '#1E2A35', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#475569', '#111827'];
const EMPTY = { label: '', sublabel: '', icon: '🎙️', color: '#F7941D', action_type: 'take_layout', action_payload: {}, confirm: false, enabled: true };

export default function ControlConsole() {
  const [studioId, setStudioId] = useState(null);
  const [studios, setStudios] = useState([]);
  const [buttons, setButtons] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [editing, setEditing] = useState(null); // button object or null
  const [msg, setMsg] = useState(null);
  const [deckKey, setDeckKey] = useState(null);
  const [showDeck, setShowDeck] = useState(false);

  const origin = window.location.origin;

  useEffect(() => {
    getMe().then(async d => {
      const u = d.user || d;
      if (u.studio_id) { setStudioId(u.studio_id); }
      else { // super_admin — pick a studio
        try { const all = await api.get('/studios'); setStudios(all); setStudioId(all[0]?.id || null); } catch {}
      }
    });
  }, []);

  const load = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const [b, l] = await Promise.all([
        api.get(`/console/buttons?studio_id=${sid}`),
        api.get(`/layouts?studio_id=${sid}`),
      ]);
      setButtons(b); setLayouts(l);
      try { setScenes(await api.get(`/scenes?studio_id=${sid}`)); } catch { setScenes([]); }
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  }, []);

  useEffect(() => { load(studioId); }, [studioId, load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000); };

  async function save(btn) {
    try {
      if (btn.id) await api.put(`/console/buttons/${btn.id}`, btn);
      else await api.post('/console/buttons', { ...btn, studio_id: studioId });
      setEditing(null); load(studioId); flash('ok', 'Saved');
    } catch (e) { flash('err', e.message); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this button?')) return;
    try { await api.delete(`/console/buttons/${id}`); load(studioId); } catch (e) { flash('err', e.message); }
  }
  async function move(idx, dir) {
    const arr = [...buttons]; const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setButtons(arr);
    try { await api.post('/console/buttons/reorder', { order: arr.map(b => b.id) }); } catch (e) { flash('err', e.message); }
  }
  async function testFire(btn) {
    try { const r = await api.post(`/console/${studioId}/fire/${btn.id}`, {}); flash('ok', `Fired: ${r.button}`); }
    catch (e) { flash('err', e.message); }
  }
  async function seedDefaults() {
    try { const r = await api.post('/console/seed-defaults', { studio_id: studioId }); flash('ok', `Added ${r.created} buttons`); load(studioId); }
    catch (e) { flash('err', e.message); }
  }
  async function mintDeckKey() {
    try {
      const r = await api.post(`/studios/${studioId}/api-keys`, { name: 'Stream Deck', scopes: ['console:fire'] });
      setDeckKey(r.key); setShowDeck(true);
    } catch (e) { flash('err', e.message); }
  }

  const fireUrl = (b) => `${origin}/api/console/${studioId}/fire/${b.id}?key=${deckKey || 'YOUR_KEY'}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-white">Studio Console</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 font-bold uppercase tracking-wider">Presenter + Stream Deck</span>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Build the big-button console presenters use at <a href="/console" target="_blank" rel="noreferrer" className="text-blue-400 underline">/console</a>.
        Each button also gets a Stream Deck trigger URL.
      </p>

      {studios.length > 0 && (
        <select value={studioId || ''} onChange={e => setStudioId(e.target.value)} className="mb-4 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
          {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {msg && <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{msg.text}</div>}

      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setEditing({ ...EMPTY })} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm transition">+ Add button</button>
        <button onClick={seedDefaults} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition border border-gray-700">Seed NAR defaults</button>
        <button onClick={() => setShowDeck(s => !s)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition border border-gray-700">🎚️ Stream Deck setup</button>
        <a href="/console" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition border border-gray-700">Open /console ↗</a>
      </div>

      {/* Stream Deck panel */}
      {showDeck && (
        <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h3 className="text-white font-bold mb-2 flex items-center gap-2">🎚️ Stream Deck / Bitfocus Companion</h3>
          <ol className="text-sm text-gray-400 list-decimal ml-5 space-y-1 mb-3">
            <li>Mint a key below (stored hashed; shown once).</li>
            <li><b>Stream Deck:</b> add a <i>System → Website</i> button, paste a button's URL, tick "Access in background".</li>
            <li><b>Companion (better):</b> Generic HTTP module → <code className="text-gray-300">POST</code> the same URL (drop the <code>?key=</code> and send <code>X-API-Key</code> header instead).</li>
          </ol>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={mintDeckKey} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition">Mint Stream Deck key</button>
            {deckKey && <code className="text-xs bg-black/40 px-2 py-1 rounded text-emerald-300 break-all">{deckKey}</code>}
            {deckKey && <span className="text-[11px] text-amber-400">copy now — shown once</span>}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {buttons.map(b => (
              <div key={b.id} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate text-gray-300">{b.icon} {b.label}</span>
                <code className="flex-1 truncate text-gray-500 bg-black/30 px-2 py-1 rounded">{fireUrl(b)}</code>
                <button onClick={() => navigator.clipboard?.writeText(fireUrl(b))} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200">Copy</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Button grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {buttons.map((b, i) => (
          <div key={b.id} className="rounded-xl p-3 flex flex-col gap-2 border border-gray-800" style={{ background: `linear-gradient(160deg, ${b.color || '#334155'}22, #0d1119)` }}>
            <div className="flex items-start gap-2">
              <div className="text-3xl leading-none">{b.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm truncate">{b.label}</div>
                <div className="text-[11px] text-gray-500 truncate">{b.sublabel}</div>
              </div>
              {!b.enabled && <span className="text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded uppercase">off</span>}
              {b.confirm && <span title="Confirms first">🔒</span>}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{ACTION_TYPES.find(a => a.value === b.action_type)?.label || b.action_type}</div>
            <div className="flex items-center gap-1 mt-auto pt-1">
              <button onClick={() => move(i, -1)} className="px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white text-xs">↑</button>
              <button onClick={() => move(i, 1)} className="px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white text-xs">↓</button>
              <button onClick={() => testFire(b)} className="px-2 py-1 rounded bg-gray-800 text-blue-400 hover:text-blue-300 text-xs">Test</button>
              <button onClick={() => setEditing({ ...b })} className="ml-auto px-2 py-1 rounded bg-gray-800 text-gray-300 hover:text-white text-xs">Edit</button>
              <button onClick={() => remove(b.id)} className="px-2 py-1 rounded bg-gray-800 text-rose-400 hover:text-rose-300 text-xs">✕</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ButtonEditor
          btn={editing} layouts={layouts} scenes={scenes}
          onCancel={() => setEditing(null)} onSave={save}
        />
      )}
    </div>
  );
}

function ButtonEditor({ btn, layouts, scenes, onCancel, onSave }) {
  const [b, setB] = useState(btn);
  const needs = ACTION_TYPES.find(a => a.value === b.action_type)?.needs || [];
  const set = (k, v) => setB(p => ({ ...p, [k]: v }));
  const setP = (k, v) => setB(p => ({ ...p, action_payload: { ...p.action_payload, [k]: v } }));
  const p = b.action_payload || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">{b.id ? 'Edit' : 'New'} button</h2>

        {/* Preview */}
        <div className="flex justify-center mb-5">
          <div className="rounded-2xl p-4 w-36 flex flex-col items-center gap-1 text-center" style={{ minHeight: 110, background: `linear-gradient(160deg, ${b.color}, #0008)` }}>
            <div className="text-4xl">{b.icon || '⬜'}</div>
            <div className="text-white font-black text-sm leading-tight">{b.label || 'Label'}</div>
            <div className="text-white/60 text-[10px]">{b.sublabel}</div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Icon"><input value={b.icon || ''} onChange={e => set('icon', e.target.value)} className="inp text-2xl text-center" maxLength={4} /></Field>
            <div className="col-span-2"><Field label="Label"><input value={b.label} onChange={e => set('label', e.target.value)} className="inp" /></Field></div>
          </div>
          <Field label="Sub-label"><input value={b.sublabel || ''} onChange={e => set('sublabel', e.target.value)} className="inp" /></Field>

          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => <button key={c} onClick={() => set('color', c)} className="w-7 h-7 rounded-lg border-2" style={{ background: c, borderColor: b.color === c ? '#fff' : 'transparent' }} />)}
            </div>
          </Field>

          <Field label="Action">
            <select value={b.action_type} onChange={e => set('action_type', e.target.value)} className="inp">
              {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>

          {needs.includes('layout') && (
            <Field label="Layout">
              <select value={p.layout_id || ''} onChange={e => setP('layout_id', e.target.value)} className="inp">
                <option value="">— select —</option>
                {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          )}
          {needs.includes('scene') && (
            <Field label="Scene">
              <select value={p.scene_id || ''} onChange={e => setP('scene_id', e.target.value)} className="inp">
                <option value="">— select —</option>
                {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          {needs.includes('severity') && (
            <Field label="Severity">
              <select value={p.severity || 'danger'} onChange={e => setP('severity', e.target.value)} className="inp">
                {['info', 'warning', 'danger', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}
          {needs.includes('message') && <Field label="Message"><input value={p.message || ''} onChange={e => setP('message', e.target.value)} className="inp" placeholder="BREAKING NEWS" /></Field>}
          {needs.includes('duration') && <Field label="Auto-clear (ms, 0 = stays)"><input type="number" value={p.duration_ms ?? 0} onChange={e => setP('duration_ms', Number(e.target.value))} className="inp" /></Field>}
          {needs.includes('moduleId') && <Field label="Target module ID"><input value={p.moduleId || ''} onChange={e => setP('moduleId', e.target.value)} className="inp" placeholder="now-playing" /></Field>}
          {needs.includes('text') && <Field label="Text"><input value={p.text || ''} onChange={e => setP('text', e.target.value)} className="inp" /></Field>}
          {needs.includes('subtitle') && <Field label="Subtitle"><input value={p.subtitle || ''} onChange={e => setP('subtitle', e.target.value)} className="inp" /></Field>}
          {needs.includes('config') && <Field label="Config (JSON)"><textarea value={typeof p.config === 'string' ? p.config : JSON.stringify(p.config || {}, null, 2)} onChange={e => { try { setP('config', JSON.parse(e.target.value)); } catch { setP('config', e.target.value); } }} className="inp font-mono text-xs h-20" /></Field>}
          {needs.includes('url') && <Field label="URL"><input value={p.url || ''} onChange={e => setP('url', e.target.value)} className="inp" placeholder="https://…" /></Field>}
          {needs.includes('method') && <Field label="Method"><select value={p.method || 'POST'} onChange={e => setP('method', e.target.value)} className="inp">{['POST', 'GET', 'PUT'].map(m => <option key={m}>{m}</option>)}</select></Field>}

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-gray-300"><input type="checkbox" checked={!!b.confirm} onChange={e => set('confirm', e.target.checked)} /> Confirm before firing</label>
            <label className="flex items-center gap-2 text-gray-300"><input type="checkbox" checked={b.enabled !== false} onChange={e => set('enabled', e.target.checked)} /> Enabled</label>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold transition">Cancel</button>
          <button onClick={() => onSave(b)} disabled={!b.label} className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold transition disabled:opacity-40">Save</button>
        </div>
      </div>
      <style>{`.inp{width:100%;background:#111827;border:1px solid #374151;border-radius:8px;padding:8px 10px;color:#fff;font-size:14px}.inp:focus{outline:none;border-color:#f97316}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
