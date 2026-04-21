import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

function PresetCard({ preset, onApply, disabled }) {
  const icons = { ops: 'OPS', aviation: 'AVN', ayrshire: 'AYR', space: 'SPC', blackout: 'BLK' };
  const tag = preset.icon && icons[preset.icon] ? icons[preset.icon] : preset.name.slice(0, 3).toUpperCase();
  return (
    <button
      onClick={() => onApply(preset)}
      disabled={disabled}
      className="group relative flex flex-col items-start gap-2 rounded-lg border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-blue-500 hover:bg-gray-800 disabled:opacity-50"
    >
      <div className="flex items-center gap-2">
        <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-blue-400 group-hover:bg-blue-950">{tag}</span>
        <span className="text-base font-medium text-white">{preset.name}</span>
      </div>
      {preset.description ? <p className="text-xs text-gray-400">{preset.description}</p> : null}
      <span className="text-xs text-gray-500">{preset.assignments.length} slot{preset.assignments.length === 1 ? '' : 's'}</span>
    </button>
  );
}

function SlotEditor({ slot, layers, onSet, onSetPower }) {
  const [open, setOpen] = useState(false);
  const current = layers.find(l => l.url === slot.current_url);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-800 px-4 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-300">
          <span className="font-mono text-xs text-gray-500">{slot.match}</span>
          {slot.slot_label ? <span className="ml-2 text-gray-500">— {slot.slot_label}</span> : null}
        </div>
        <div className="truncate text-sm text-white">
          {current ? current.name : slot.current_label || '—'}
        </div>
        <div className="truncate text-xs text-gray-500">{slot.current_url}</div>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetPower(slot, slot.power_state === 'off' ? 'on' : 'off')}
            title={slot.power_state === 'off' ? 'Wake screen' : 'Sleep screen (blank)'}
            className={`rounded border px-2 py-1.5 text-xs transition-colors ${
              slot.power_state === 'off'
                ? 'border-amber-600 bg-amber-950/40 text-amber-300 hover:border-amber-400'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500 hover:text-amber-300'
            }`}
          >
            {slot.power_state === 'off' ? '◐ asleep' : '○ sleep'}
          </button>
          <button
            onClick={() => setOpen(v => !v)}
            className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:border-blue-500 hover:text-white"
          >
            Change ▾
          </button>
        </div>
        {open ? (
          <div className="absolute right-0 z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl">
            {layers.map(layer => (
              <button
                key={layer.id}
                onClick={() => { setOpen(false); onSet(slot, layer); }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-gray-800"
              >
                <span className="text-sm text-white">{layer.name}</span>
                <span className="truncate text-xs text-gray-500">{layer.url}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Displays() {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [layers, setLayers] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [locs, lyrs, prs] = await Promise.all([
        api.get('/display-nodes'),
        api.get('/display-nodes/layers'),
        api.get('/display-nodes/presets'),
      ]);
      setLocations(locs || []);
      setLayers(lyrs || []);
      setPresets(prs || []);
    } catch (err) {
      toast('Failed to load displays: ' + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const applyPreset = async (preset) => {
    setApplying(true);
    try {
      const r = await api.post(`/display-nodes/presets/${preset.id}/apply`, {});
      toast(`Applied ${preset.name} (${r.applied}/${r.total} slots)`, 'success');
      await refresh();
    } catch (err) {
      toast('Apply failed: ' + (err.message || err), 'error');
    } finally {
      setApplying(false);
    }
  };

  const setSlot = async (slot, layer) => {
    try {
      await api.post(`/display-nodes/slots/${slot.id}/set`, { url: layer.url, label: layer.name });
      toast(`Set ${slot.match} → ${layer.name}`, 'success');
      await refresh();
    } catch (err) {
      toast('Set failed: ' + (err.message || err), 'error');
    }
  };

  const setSlotPower = async (slot, state) => {
    try {
      await api.post(`/display-nodes/slots/${slot.id}/power`, { state });
      toast(`${slot.match} → ${state === 'off' ? 'sleep' : 'wake'}`, 'success');
      await refresh();
    } catch (err) {
      toast('Power change failed: ' + (err.message || err), 'error');
    }
  };

  const setNodePower = async (node, state) => {
    try {
      await api.post(`/display-nodes/nodes/${node.host}/power`, { state });
      toast(`${node.host} → ${state === 'off' ? 'sleep' : 'wake'} all`, 'success');
      await refresh();
    } catch (err) {
      toast('Node power change failed: ' + (err.message || err), 'error');
    }
  };

  const layersByCategory = useMemo(() => {
    const m = new Map();
    for (const l of layers) {
      const k = l.category || 'other';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(l);
    }
    return m;
  }, [layers]);

  if (loading) return <div className="p-6 text-gray-400">Loading displays…</div>;

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Displays</h1>
        <p className="mt-1 text-sm text-gray-400">Control the office kiosks. Group presets swap all screens at once.</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Group presets</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {presets.map(p => <PresetCard key={p.id} preset={p} onApply={applyPreset} disabled={applying} />)}
        </div>
      </section>

      {locations.map(loc => (
        <section key={loc.id}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{loc.name}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loc.nodes.map(node => (
              <div key={node.id} className="rounded-lg border border-gray-800 bg-gray-950">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                  <div>
                    <div className="font-mono text-sm text-white">{node.host}</div>
                    {node.label ? <div className="text-xs text-gray-500">{node.label}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {node.slots.length > 0 ? (() => {
                      const allOff = node.slots.every(s => s.power_state === 'off');
                      return (
                        <button
                          onClick={() => setNodePower(node, allOff ? 'on' : 'off')}
                          title={allOff ? 'Wake all screens on this host' : 'Sleep all screens on this host'}
                          className={`rounded border px-2 py-1 text-xs transition-colors ${
                            allOff
                              ? 'border-amber-600 bg-amber-950/40 text-amber-300 hover:border-amber-400'
                              : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500 hover:text-amber-300'
                          }`}
                        >
                          {allOff ? '◐ wake all' : '○ sleep all'}
                        </button>
                      );
                    })() : null}
                    <div className="text-right text-xs text-gray-500">
                      {node.last_seen ? `seen ${new Date(node.last_seen).toLocaleTimeString()}` : 'never polled'}
                    </div>
                  </div>
                </div>
                {node.slots.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No slots</div>
                ) : (
                  node.slots.map(slot => <SlotEditor key={slot.id} slot={slot} layers={layers} onSet={setSlot} onSetPower={setSlotPower} />)
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Layer library</h2>
        <div className="space-y-4">
          {[...layersByCategory.entries()].map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">{cat}</div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {list.map(l => (
                  <div key={l.id} className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
                    <div className="text-sm text-white">{l.name}</div>
                    <div className="truncate text-xs text-gray-500">{l.url}</div>
                    {l.description ? <div className="mt-1 text-xs text-gray-600">{l.description}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
