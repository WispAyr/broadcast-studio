import React, { useState, useMemo } from 'react';
import { Player } from '@remotion/player';
import compositions, { getCompositionList, getCompositionCategories, getComposition } from '../compositions';

export default function RemotionModule({ config = {} }) {
  const {
    compositionId = '',
    loop = true,
    autoPlay = true,
    playbackRate = 1,
    durationOverride = 0,
    showControls = false,
    inputProps = {},
  } = config;

  const comp = getComposition(compositionId);

  if (!comp) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#0a0a0a', color: '#666', fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ fontSize: 48 }}>🎬</span>
        <span style={{ fontSize: 16, fontWeight: 500 }}>Remotion Module</span>
        <span style={{ fontSize: 13, color: '#444' }}>Select a composition in config</span>
      </div>
    );
  }

  const { component: Comp, meta, schema } = comp;
  const fps = meta.fps || 30;
  const duration = durationOverride > 0 ? durationOverride : meta.defaultDuration || 5;
  const durationInFrames = Math.ceil(duration * fps);

  // Merge schema defaults with user inputProps
  const mergedProps = useMemo(() => {
    const defaults = {};
    if (schema) {
      Object.entries(schema).forEach(([key, def]) => {
        defaults[key] = def.default;
      });
    }
    return { ...defaults, ...inputProps };
  }, [schema, inputProps]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'transparent' }}>
      <Player
        component={Comp}
        inputProps={mergedProps}
        durationInFrames={durationInFrames}
        compositionWidth={meta.width || 1920}
        compositionHeight={meta.height || 1080}
        fps={fps}
        loop={loop}
        autoPlay={autoPlay}
        playbackRate={playbackRate}
        controls={showControls}
        style={{ width: '100%', height: '100%' }}
        renderLoading={() => (
          <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#333', fontSize: 14 }}>Loading...</span>
          </div>
        )}
      />
    </div>
  );
}

// Config component for the layout editor
export function RemotionModuleConfig({ config, onChange }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const categories = getCompositionCategories();
  const allComps = getCompositionList();
  const comp = config.compositionId ? getComposition(config.compositionId) : null;

  const filtered = selectedCategory === 'all'
    ? allComps
    : allComps.filter(c => c.category === selectedCategory);

  const catNames = [...new Set(allComps.map(c => c.category))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Composition picker */}
      <label style={{ fontSize: 12, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Composition</label>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: selectedCategory === 'all' ? '#3b82f6' : '#1f2937', color: selectedCategory === 'all' ? '#fff' : '#9ca3af',
          }}
        >All</button>
        {catNames.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: selectedCategory === cat ? '#3b82f6' : '#1f2937', color: selectedCategory === cat ? '#fff' : '#9ca3af',
              textTransform: 'capitalize',
            }}
          >{cat}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => {
              const compData = getComposition(c.id);
              const defaults = {};
              if (compData?.schema) {
                Object.entries(compData.schema).forEach(([k, v]) => { defaults[k] = v.default; });
              }
              onChange({ ...config, compositionId: c.id, inputProps: defaults });
            }}
            style={{
              padding: '8px 10px', borderRadius: 8, border: config.compositionId === c.id ? '2px solid #3b82f6' : '1px solid #374151',
              background: config.compositionId === c.id ? '#1e3a5f' : '#111827',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{c.name}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{c.description?.substring(0, 50)}</div>
          </button>
        ))}
      </div>

      {/* Input props editor */}
      {comp && comp.schema && (
        <>
          <div style={{ borderTop: '1px solid #1f2937', marginTop: 4, paddingTop: 8 }}>
            <label style={{ fontSize: 12, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Properties</label>
          </div>
          {Object.entries(comp.schema).map(([key, def]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{def.label || key}</label>
              {def.type === 'color' ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={config.inputProps?.[key] || def.default}
                    onChange={e => onChange({ ...config, inputProps: { ...config.inputProps, [key]: e.target.value } })}
                    style={{ width: 32, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={config.inputProps?.[key] || def.default}
                    onChange={e => onChange({ ...config, inputProps: { ...config.inputProps, [key]: e.target.value } })}
                    style={{ flex: 1, background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '4px 8px', color: '#e5e7eb', fontSize: 12 }}
                  />
                </div>
              ) : def.type === 'select' ? (
                <select
                  value={config.inputProps?.[key] || def.default}
                  onChange={e => onChange({ ...config, inputProps: { ...config.inputProps, [key]: e.target.value } })}
                  style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 8px', color: '#e5e7eb', fontSize: 12 }}
                >
                  {def.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : def.type === 'textarea' ? (
                <textarea
                  value={config.inputProps?.[key] || def.default}
                  onChange={e => onChange({ ...config, inputProps: { ...config.inputProps, [key]: e.target.value } })}
                  rows={3}
                  style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 8px', color: '#e5e7eb', fontSize: 12, resize: 'vertical' }}
                />
              ) : def.type === 'number' ? (
                <input
                  type="number"
                  value={config.inputProps?.[key] ?? def.default}
                  min={def.min}
                  max={def.max}
                  onChange={e => onChange({ ...config, inputProps: { ...config.inputProps, [key]: Number(e.target.value) } })}
                  style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 8px', color: '#e5e7eb', fontSize: 12, width: 80 }}
                />
              ) : (
                <input
                  type="text"
                  value={config.inputProps?.[key] || def.default}
                  onChange={e => onChange({ ...config, inputProps: { ...config.inputProps, [key]: e.target.value } })}
                  style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 8px', color: '#e5e7eb', fontSize: 12 }}
                />
              )}
            </div>
          ))}
        </>
      )}

      {/* Playback settings */}
      <div style={{ borderTop: '1px solid #1f2937', marginTop: 4, paddingTop: 8 }}>
        <label style={{ fontSize: 12, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Playback</label>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
          <input type="checkbox" checked={config.loop !== false} onChange={e => onChange({ ...config, loop: e.target.checked })} />
          Loop
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
          <input type="checkbox" checked={config.autoPlay !== false} onChange={e => onChange({ ...config, autoPlay: e.target.checked })} />
          Auto-play
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: '#9ca3af', minWidth: 60 }}>Speed</label>
        <input
          type="range" min={0.1} max={3} step={0.1}
          value={config.playbackRate || 1}
          onChange={e => onChange({ ...config, playbackRate: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 11, color: '#6b7280', minWidth: 30 }}>{config.playbackRate || 1}x</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: '#9ca3af', minWidth: 60 }}>Duration</label>
        <input
          type="number" min={1} max={300}
          value={config.durationOverride || (comp?.meta?.defaultDuration || 5)}
          onChange={e => onChange({ ...config, durationOverride: Number(e.target.value) })}
          style={{ width: 60, background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '4px 8px', color: '#e5e7eb', fontSize: 12 }}
        />
        <span style={{ fontSize: 11, color: '#6b7280' }}>seconds</span>
      </div>
    </div>
  );
}
