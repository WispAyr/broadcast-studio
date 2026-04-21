import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { confirmAsync } from '../../lib/dialog';

const DEFAULT_PROFILE = {
  brightness: 100, contrast: 100, saturation: 100,
  blackLevel: 0, gamma: 1.0, colorTemp: 'neutral',
  rotation: 0, flipH: false, flipV: false,
  contentScale: 100, offsetX: 0, offsetY: 0, contentFit: 'cover',
};

// Quick-select presets for the Display tab. These mutate the image-correction
// subset of the profile and preserve orientation/offset tweaks the user has
// already dialled in, so picking "High contrast" won't throw away a 90° rotate.
const DISPLAY_PRESETS = {
  factory:      { brightness: 100, contrast: 100, saturation: 100, blackLevel: 0,  gamma: 1.0, colorTemp: 'neutral' },
  highContrast: { brightness: 110, contrast: 135, saturation: 110, blackLevel: 5,  gamma: 1.1, colorTemp: 'neutral' },
  warm:         { brightness: 105, contrast: 105, saturation: 115, blackLevel: 0,  gamma: 1.0, colorTemp: 'warm'    },
  cool:         { brightness: 105, contrast: 105, saturation: 110, blackLevel: 0,  gamma: 1.0, colorTemp: 'cool'    },
  daylight:     { brightness: 130, contrast: 115, saturation: 105, blackLevel: 0,  gamma: 0.9, colorTemp: 'neutral' },
  nightDim:     { brightness: 70,  contrast: 95,  saturation: 90,  blackLevel: 10, gamma: 1.1, colorTemp: 'warm'    },
};

function Slider({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${active ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
      {children}
    </button>
  );
}

function buildCssFilter(p) {
  const parts = [];
  if (p.brightness !== 100) parts.push(`brightness(${p.brightness}%)`);
  if (p.contrast !== 100) parts.push(`contrast(${p.contrast}%)`);
  if (p.saturation !== 100) parts.push(`saturate(${p.saturation}%)`);
  if (p.blackLevel > 0) parts.push(`brightness(${100 - p.blackLevel}%)`);
  if (p.gamma !== 1.0) {
    const g = 1 / p.gamma;
    parts.push(`contrast(${100 * g}%)`);
  }
  if (p.colorTemp === 'warm') parts.push('sepia(15%)');
  else if (p.colorTemp === 'cool') parts.push('hue-rotate(10deg)');
  return parts.join(' ') || 'none';
}

function buildTransform(p) {
  const parts = [];
  if (p.rotation) parts.push(`rotate(${p.rotation}deg)`);
  if (p.flipH) parts.push('scaleX(-1)');
  if (p.flipV) parts.push('scaleY(-1)');
  if (p.contentScale && p.contentScale !== 100) parts.push(`scale(${p.contentScale / 100})`);
  if (p.offsetX || p.offsetY) parts.push(`translate(${p.offsetX || 0}px, ${p.offsetY || 0}px)`);
  return parts.join(' ') || 'none';
}

function mergeProfiles(groupProfile, screenConfig) {
  const base = { ...DEFAULT_PROFILE, ...(groupProfile || {}) };
  return { ...base, ...(screenConfig?.displayProfile || {}) };
}

function DisplayPreview({ profile }) {
  const filter = buildCssFilter(profile);
  const transform = buildTransform(profile);
  return (
    <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Live Preview</p>
      <div className="relative overflow-hidden rounded" style={{ width: '100%', aspectRatio: '16/9', background: '#111' }}>
        <div style={{ width: '100%', height: '100%', filter, transform, objectFit: profile.contentFit || 'cover',
          background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 'bold',
          transformOrigin: 'center center',
        }}>
          Sample Content
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-2 font-mono break-all">filter: {filter}</p>
      <p className="text-xs text-gray-600 font-mono break-all">transform: {transform}</p>
    </div>
  );
}

function GeneralTab({ screen, formData, setFormData, groups }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Screen Name</label>
        <input type="text" value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Orientation</label>
        <select value={formData.orientation} onChange={e => setFormData(d => ({ ...d, orientation: e.target.value }))}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Width</label>
          <input type="number" value={formData.width} onChange={e => setFormData(d => ({ ...d, width: parseInt(e.target.value) || 1920 }))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Height</label>
          <input type="number" value={formData.height} onChange={e => setFormData(d => ({ ...d, height: parseInt(e.target.value) || 1080 }))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Screen Group</label>
        <select value={formData.group_id || ''} onChange={e => setFormData(d => ({ ...d, group_id: e.target.value || null }))}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
          <option value="">No Group</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function DisplayTab({ profile, setProfile, screens, currentScreenId }) {
  const handleCopyFrom = (sourceId) => {
    const src = screens.find(s => s.id === sourceId);
    if (src) {
      const srcConfig = typeof src.config === 'string' ? JSON.parse(src.config || '{}') : (src.config || {});
      if (srcConfig.displayProfile) setProfile(srcConfig.displayProfile);
    }
  };

  const applyPreset = (key) => {
    const preset = DISPLAY_PRESETS[key];
    if (!preset) return;
    setProfile(p => ({ ...p, ...preset }));
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-1">
        <div className="mb-3">
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['factory', 'Factory'],
              ['highContrast', 'High Contrast'],
              ['warm', 'Warm'],
              ['cool', 'Cool'],
              ['daylight', 'Daylight'],
              ['nightDim', 'Night Dim'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => applyPreset(key)}
                className="px-2.5 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
        <Slider label="Brightness" value={profile.brightness} onChange={v => setProfile(p => ({ ...p, brightness: v }))} min={50} max={200} unit="%" />
        <Slider label="Contrast" value={profile.contrast} onChange={v => setProfile(p => ({ ...p, contrast: v }))} min={50} max={200} unit="%" />
        <Slider label="Saturation" value={profile.saturation} onChange={v => setProfile(p => ({ ...p, saturation: v }))} min={0} max={200} unit="%" />
        <Slider label="Black Level" value={profile.blackLevel} onChange={v => setProfile(p => ({ ...p, blackLevel: v }))} min={0} max={50} />
        <Slider label="Gamma" value={profile.gamma} onChange={v => setProfile(p => ({ ...p, gamma: v }))} min={0.5} max={2.5} step={0.1} />

        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Color Temperature</label>
          <div className="flex gap-2">
            {['warm', 'neutral', 'cool'].map(t => (
              <button key={t} onClick={() => setProfile(p => ({ ...p, colorTemp: t }))}
                className={`flex-1 px-3 py-1.5 rounded text-sm capitalize ${profile.colorTemp === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Rotation</label>
          <div className="flex gap-2">
            {[0, 90, 180, 270].map(r => (
              <button key={r} onClick={() => setProfile(p => ({ ...p, rotation: r }))}
                className={`flex-1 px-3 py-1.5 rounded text-sm ${profile.rotation === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{r}°</button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={profile.flipH} onChange={e => setProfile(p => ({ ...p, flipH: e.target.checked }))} className="accent-blue-500" /> Flip H
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={profile.flipV} onChange={e => setProfile(p => ({ ...p, flipV: e.target.checked }))} className="accent-blue-500" /> Flip V
          </label>
        </div>

        <Slider label="Content Scale" value={profile.contentScale} onChange={v => setProfile(p => ({ ...p, contentScale: v }))} min={50} max={200} unit="%" />
        <Slider label="Offset X" value={profile.offsetX} onChange={v => setProfile(p => ({ ...p, offsetX: v }))} min={-500} max={500} unit="px" />
        <Slider label="Offset Y" value={profile.offsetY} onChange={v => setProfile(p => ({ ...p, offsetY: v }))} min={-500} max={500} unit="px" />

        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Content Fit</label>
          <select value={profile.contentFit} onChange={e => setProfile(p => ({ ...p, contentFit: e.target.value }))}
            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={() => setProfile({ ...DEFAULT_PROFILE })}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded transition-colors">Reset to Defaults</button>
          <select onChange={e => { if (e.target.value) handleCopyFrom(e.target.value); e.target.value = ''; }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm focus:outline-none">
            <option value="">Copy from...</option>
            {screens.filter(s => s.id !== currentScreenId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <DisplayPreview profile={profile} />
      </div>
    </div>
  );
}

function ViewportTab({ profile, formData }) {
  const w = formData.width || 1920;
  const h = formData.height || 1080;
  const aspect = w / h;
  const filter = buildCssFilter(profile);
  const transform = buildTransform(profile);

  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">Visual preview of content positioning within the screen frame</p>
      <div className="flex justify-center">
        <div style={{ width: '100%', maxWidth: 600, aspectRatio: `${aspect}`, position: 'relative', border: '2px solid #374151', borderRadius: 8, background: '#000', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 4, left: 8, color: '#6b7280', fontSize: 10, zIndex: 10 }}>{w}×{h} ({formData.orientation})</div>
          <div style={{ position: 'absolute', inset: 0, filter, transform, transformOrigin: 'center center', objectFit: profile.contentFit,
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 50%, #4a1942 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'white', gap: 4 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Content Area</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
              Scale: {profile.contentScale}% | Offset: ({profile.offsetX}, {profile.offsetY}) | Fit: {profile.contentFit}
            </div>
          </div>
          {/* Safe zone guides */}
          <div style={{ position: 'absolute', inset: '5%', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 4, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: '10%', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 4, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
}

function ScreenGroupsPanel({ groups, setGroups, fetchGroups }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE });

  function startEdit(g) {
    setEditing(g.id);
    setName(g.name);
    const p = typeof g.profile === 'string' ? JSON.parse(g.profile || '{}') : (g.profile || {});
    setProfile({ ...DEFAULT_PROFILE, ...p });
  }

  async function handleSave() {
    try {
      if (editing && editing !== 'new') {
        await api.put(`/screen-groups/${editing}`, { name, profile });
        toast?.('Group updated', 'success');
      } else {
        await api.post('/screen-groups', { name, profile });
        toast?.('Group created', 'success');
      }
      setEditing(null);
      setName('');
      setProfile({ ...DEFAULT_PROFILE });
      fetchGroups();
    } catch (err) { toast?.(`Save failed: ${err.message}`, 'error'); }
  }

  async function handleDelete(id) {
    if (!await confirmAsync({ title: 'Delete group?', message: 'This removes the group. Screens using it will fall back to their own display profile.', confirmLabel: 'Delete', variant: 'danger' })) return;
    try {
      await api.delete(`/screen-groups/${id}`);
      toast?.('Group deleted', 'success');
      fetchGroups();
    } catch (err) { toast?.(`Delete failed: ${err.message}`, 'error'); }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Screen Groups</h2>
        <button onClick={() => { setEditing('new'); setName(''); setProfile({ ...DEFAULT_PROFILE }); }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">New Group</button>
      </div>

      {groups.length === 0 && !editing && <p className="text-gray-500 text-sm">No groups yet.</p>}

      {groups.map(g => (
        <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
          <span className="text-white">{g.name}</span>
          <div className="flex gap-2">
            <button onClick={() => startEdit(g)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded">Edit</button>
            <button onClick={() => handleDelete(g.id)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded">Delete</button>
          </div>
        </div>
      ))}

      {editing && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Group Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Default Display Profile</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Slider label="Brightness" value={profile.brightness} onChange={v => setProfile(p => ({ ...p, brightness: v }))} min={50} max={200} unit="%" />
              <Slider label="Contrast" value={profile.contrast} onChange={v => setProfile(p => ({ ...p, contrast: v }))} min={50} max={200} unit="%" />
              <Slider label="Saturation" value={profile.saturation} onChange={v => setProfile(p => ({ ...p, saturation: v }))} min={0} max={200} unit="%" />
            </div>
            <DisplayPreview profile={profile} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Save Group</button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Screens() {
  const toast = useToast();
  const [screens, setScreens] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState(1);
  const [showGroups, setShowGroups] = useState(false);

  // Form data for the selected screen
  const [formData, setFormData] = useState({ name: '', orientation: 'landscape', width: 1920, height: 1080, group_id: null });
  const [displayProfile, setDisplayProfile] = useState({ ...DEFAULT_PROFILE });

  const fetchScreens = useCallback(async () => {
    try {
      const [screensData, layoutsData] = await Promise.all([api.get('/screens'), api.get('/layouts')]);
      setScreens(screensData.screens || screensData || []);
      setLayouts(layoutsData.layouts || layoutsData || []);
    } catch (err) { console.error('Failed to fetch:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await api.get('/screen-groups');
      setGroups(data.groups || data || []);
    } catch { setGroups([]); }
  }, []);

  useEffect(() => { fetchScreens(); fetchGroups(); }, [fetchScreens, fetchGroups]);

  function selectScreen(screen) {
    setSelectedScreen(screen);
    setActiveTab('general');
    const config = typeof screen.config === 'string' ? JSON.parse(screen.config || '{}') : (screen.config || {});
    setFormData({
      name: screen.name, orientation: screen.orientation || 'landscape',
      width: screen.width || 1920, height: screen.height || 1080, group_id: screen.group_id || null,
    });
    // Merge group profile with screen overrides
    const group = groups.find(g => g.id === screen.group_id);
    const groupProfile = group ? (typeof group.profile === 'string' ? JSON.parse(group.profile || '{}') : (group.profile || {})) : {};
    setDisplayProfile(mergeProfiles(groupProfile, config));
  }

  async function handleSaveScreen() {
    if (!selectedScreen) return;
    try {
      const config = { displayProfile };
      await api.put(`/screens/${selectedScreen.id}`, {
        name: formData.name, orientation: formData.orientation,
        width: formData.width, height: formData.height,
        group_id: formData.group_id, config,
      });
      toast?.('Screen saved', 'success');
      fetchScreens();
      setSelectedScreen(s => ({ ...s, ...formData, config }));
    } catch (err) { toast?.(`Save failed: ${err.message}`, 'error'); }
  }

  async function handleAddScreen(e) {
    e.preventDefault();
    try {
      await api.post('/screens', { name: newName, screen_number: newNumber });
      toast?.('Screen created', 'success');
      setShowAddForm(false);
      setNewName('');
      setNewNumber(1);
      fetchScreens();
    } catch (err) { toast?.(`Create failed: ${err.message}`, 'error'); }
  }

  async function handleDelete(id) {
    const screen = screens.find(s => s.id === id);
    if (!await confirmAsync({
      title: 'Delete screen?',
      message: `"${screen?.name || id}" will be removed. Any display currently pointing at this screen ID will go to "Screen not found".`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`/screens/${id}`);
      toast?.('Screen deleted', 'success');
      if (selectedScreen?.id === id) setSelectedScreen(null);
      fetchScreens();
    } catch (err) { toast?.(`Delete failed: ${err.message}`, 'error'); }
  }

  async function handleSetLayout(screenId, layoutId) {
    const nextId = layoutId ? layoutId : null;
    try {
      await api.put(`/screens/${screenId}`, { current_layout_id: nextId });
      setScreens(prev => prev.map(s => s.id === screenId ? { ...s, current_layout_id: nextId } : s));
      fetchScreens();
    } catch (err) { toast?.(`Layout change failed: ${err.message}`, 'error'); }
  }

  // Toggle the padlock (accepts_broadcasts). When 0, the screen is excluded
  // from studio-wide /screens/sync pushes but still receives direct
  // single-screen assignments and the emergency override.
  async function toggleAcceptsBroadcasts(screen) {
    const next = screen.accepts_broadcasts ? 0 : 1;
    try {
      await api.put(`/screens/${screen.id}`, { accepts_broadcasts: next });
      setScreens(prev => prev.map(s => s.id === screen.id ? { ...s, accepts_broadcasts: next } : s));
      toast?.(next ? 'Screen unlocked — accepts broadcasts' : 'Screen locked out of broadcasts', 'success');
    } catch (err) { toast?.(`Lockout toggle failed: ${err.message}`, 'error'); }
  }

  if (loading) return <div className="p-8 flex items-center justify-center h-full"><p className="text-gray-400">Loading screens...</p></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Screens</h1>
          <p className="text-sm text-gray-500 mt-1">{screens.length} screen{screens.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGroups(!showGroups)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
            {showGroups ? 'Hide' : 'Show'} Groups
          </button>
          <button onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Add Screen</button>
        </div>
      </div>

      {showGroups && <ScreenGroupsPanel groups={groups} setGroups={setGroups} fetchGroups={fetchGroups} />}

      {showAddForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <form onSubmit={handleAddScreen} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" required />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-300 mb-1">Number</label>
              <input type="number" min="1" value={newNumber} onChange={e => setNewNumber(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Create</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">Cancel</button>
          </form>
        </div>
      )}

      <div className="flex gap-6">
        {/* Screen list */}
        <div className={`${selectedScreen ? 'w-80 flex-shrink-0' : 'w-full'}`}>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {screens.map((screen, idx) => (
              <div key={screen.id} onClick={() => selectScreen(screen)}
                className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-all ${
                  selectedScreen?.id === screen.id
                    ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-800/50 border-l-2 border-l-transparent'
                } ${idx < screens.length - 1 ? 'border-b border-gray-800/60' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${screen.is_online ? 'bg-green-400 shadow-sm shadow-green-400/40' : 'bg-gray-600'}`} />
                  <div>
                    <p className="text-white text-sm font-medium">{screen.name}</p>
                    <p className="text-gray-600 text-xs">#{screen.screen_number}{screen.group_id ? ` · ${groups.find(g => g.id === screen.group_id)?.name || 'Group'}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={screen.current_layout_id || ''} onChange={e => { e.stopPropagation(); handleSetLayout(screen.id, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-blue-500">
                    <option value="">No Layout</option>
                    {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button onClick={e => { e.stopPropagation(); toggleAcceptsBroadcasts(screen); }}
                    className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${screen.accepts_broadcasts === 0 ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400' : 'bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-300'}`}
                    title={screen.accepts_broadcasts === 0 ? 'Locked: studio-wide pushes will SKIP this screen. Click to unlock.' : 'Unlocked: accepts studio-wide pushes. Click to lock out.'}>
                    {screen.accepts_broadcasts === 0 ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                    )}
                  </button>
                  <button onClick={e => { e.stopPropagation(); window.open(`/screen/${screen.id}`, '_blank'); }}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs rounded-md transition-colors" title="Open screen">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(screen.id); }}
                    className="px-2.5 py-1.5 bg-transparent hover:bg-red-600/15 text-gray-600 hover:text-red-400 text-xs rounded-md transition-colors" title="Delete screen">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {screens.length === 0 && <div className="text-center py-12"><p className="text-gray-500 text-sm">No screens registered.</p></div>}
          </div>
        </div>

        {/* Editor panel */}
        {selectedScreen && (
          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
              <div className="flex gap-1">
                <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')}>General</TabButton>
                <TabButton active={activeTab === 'display'} onClick={() => setActiveTab('display')}>Display</TabButton>
                <TabButton active={activeTab === 'viewport'} onClick={() => setActiveTab('viewport')}>Viewport</TabButton>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveScreen} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">Save</button>
                <button onClick={() => setSelectedScreen(null)} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Close</button>
              </div>
            </div>
            <div className="p-6">
              {activeTab === 'general' && <GeneralTab screen={selectedScreen} formData={formData} setFormData={setFormData} groups={groups} />}
              {activeTab === 'display' && <DisplayTab profile={displayProfile} setProfile={setDisplayProfile} screens={screens} currentScreenId={selectedScreen.id} />}
              {activeTab === 'viewport' && <ViewportTab profile={displayProfile} formData={formData} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
