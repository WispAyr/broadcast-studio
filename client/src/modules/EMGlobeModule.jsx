import React, { useMemo } from 'react';

/**
 * EMGlobeModule — embed em.wispayr.online with a named preset view.
 *
 * All data enrichment lives in em-globe itself (prism-backed). This module
 * is a pure iframe consumer that passes preset config via URL params.
 *
 * Config:
 *   preset:     'space-weather' | 'aurora' | 'solar-wind' | 'satellites'
 *               | 'near-earth' | 'seismic' | 'flare-ops'
 *   layers:     comma-separated overrides to enable (e.g. "aurora,quakes")
 *   hide:       comma-separated layers to disable
 *   cam:        'system' | 'earth' | 'sun' | 'moon'
 *   rotate:     boolean (default inherited from preset)
 *   charts:     boolean (overrides preset)
 *   kiosk:      boolean (hide chrome — default true for broadcast use)
 *   autocycle:  seconds between automatic preset rotations (0 = disabled)
 *   base:       override base URL (default https://em.wispayr.online/)
 */

const PRESETS = [
  { key: 'space-weather', label: 'Space Weather Overview' },
  { key: 'aurora', label: 'Aurora Watch' },
  { key: 'solar-wind', label: 'Solar Wind & Magnetosphere' },
  { key: 'satellites', label: 'Satellites & Debris' },
  { key: 'near-earth', label: 'Near-Earth Objects' },
  { key: 'seismic', label: 'Seismic & Tidal' },
  { key: 'flare-ops', label: 'Flare / Radio Ops' },
];

export { PRESETS as EM_GLOBE_PRESETS };

export default function EMGlobeModule({ config = {} }) {
  const {
    preset = 'space-weather',
    layers,
    hide,
    cam,
    rotate,
    charts,
    kiosk = true,
    autocycle = 0,
    base = 'https://em.wispayr.online/',
  } = config;

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (preset) params.set('preset', preset);
    if (layers) params.set('layers', layers);
    if (hide) params.set('hide', hide);
    if (cam) params.set('cam', cam);
    if (rotate != null) params.set('rotate', rotate ? '1' : '0');
    if (charts != null) params.set('charts', charts ? '1' : '0');
    if (kiosk) params.set('kiosk', '1');
    if (autocycle && autocycle > 0) params.set('autocycle', String(autocycle));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [preset, layers, hide, cam, rotate, charts, kiosk, autocycle, base]);

  const presetMeta = PRESETS.find((p) => p.key === preset);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#000' }}>
      <iframe
        key={url}
        src={url}
        title={presetMeta?.label || 'EM Globe'}
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        allow="accelerometer; autoplay; fullscreen"
      />
      {config.showLabel !== false && (
        <div
          className="absolute top-2 left-3 pointer-events-none"
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 11,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}
        >
          {presetMeta?.label || preset}
          {autocycle > 0 && (
            <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.5)' }}>
              · cycle {autocycle}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}
