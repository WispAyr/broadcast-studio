import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShaderView, SHADERS, DEFAULT_PALETTE } from '../../components/ShaderLayer';
import { useToast } from '../../components/Toast';

/**
 * Shader Studio — a live control surface for the Paper Design shaders.
 *
 * Pick a shader, tune the palette and knobs, and copy the result straight into
 * a composition as either inputProps JSON (for the "Shader Background" comp or
 * any shaderBg-aware scene) or a ready-to-paste <ShaderBackground/> snippet.
 *
 * The preview drives ShaderView's deterministic clock from a rAF loop so it
 * animates live while tuning — the exact same renderer the compositions use.
 */

const KNOBS = [
  { key: 'scale', label: 'Scale', min: 0.1, max: 4, step: 0.05 },
  { key: 'speed', label: 'Speed', min: 0, max: 5, step: 0.05 },
  { key: 'softness', label: 'Softness', min: 0, max: 1, step: 0.01 },
  { key: 'distortion', label: 'Distortion', min: 0, max: 2, step: 0.05 },
  { key: 'rotation', label: 'Rotation', min: 0, max: 360, step: 1 },
];

export default function ShaderStudio() {
  const toast = useToast();
  const [shader, setShader] = useState('simplex-noise');
  const [colors, setColors] = useState([...DEFAULT_PALETTE]);
  const [background, setBackground] = useState('#000000');
  const [params, setParams] = useState({ scale: 1, speed: 1, softness: 0.6, distortion: 0.8, rotation: 0 });
  const [timeMs, setTimeMs] = useState(0);

  // Live rAF clock, scaled by speed — smooth preview while tuning.
  const raf = useRef();
  const last = useRef(null);
  const acc = useRef(0);
  const speedRef = useRef(params.speed);
  speedRef.current = params.speed;
  useEffect(() => {
    const tick = (t) => {
      if (last.current != null) acc.current += (t - last.current) * speedRef.current;
      last.current = t;
      setTimeMs(acc.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const setParam = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const setColor = (i, v) => setColors((c) => c.map((x, j) => (j === i ? v : x)));
  const addColor = () => setColors((c) => [...c, '#ffffff']);
  const removeColor = (i) => setColors((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c));

  // The prop set a composition needs.
  const inputProps = useMemo(
    () => ({ shader, colors: colors.join('\n'), background, ...params }),
    [shader, colors, background, params]
  );

  const jsonSnippet = useMemo(() => JSON.stringify(inputProps, null, 2), [inputProps]);
  const tsxSnippet = useMemo(() => {
    const c = JSON.stringify(colors);
    return `<ShaderBackground\n  shader="${shader}"\n  colors={${c}}\n  background="${background}"\n  scale={${params.scale}}\n  speed={${params.speed}}\n  softness={${params.softness}}\n  distortion={${params.distortion}}\n  rotation={${params.rotation}}\n/>`;
  }, [shader, colors, background, params]);

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      toast?.(`${what} copied to clipboard`, 'success');
    } catch {
      toast?.('Copy failed — select and copy manually', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4 overflow-auto">
      {/* Preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">Shader Studio</h1>
            <p className="text-gray-400 text-sm">Paper Design GPU shaders — tune and export for any composition backdrop.</p>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-800 bg-black aspect-video shadow-2xl">
          <ShaderView
            shader={shader}
            colors={colors}
            background={background}
            scale={params.scale}
            softness={params.softness}
            distortion={params.distortion}
            rotation={params.rotation}
            timeMs={timeMs}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Export */}
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide">inputProps JSON</label>
              <button onClick={() => copy(jsonSnippet, 'JSON')} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">Copy JSON</button>
            </div>
            <textarea readOnly value={jsonSnippet} rows={8} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-xs font-mono" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide">&lt;ShaderBackground/&gt; TSX</label>
              <button onClick={() => copy(tsxSnippet, 'TSX')} className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">Copy TSX</button>
            </div>
            <textarea readOnly value={tsxSnippet} rows={8} className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-xs font-mono" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full lg:w-80 shrink-0 space-y-5">
        {/* Shader picker */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Shader</label>
          <div className="grid grid-cols-2 gap-1.5">
            {SHADERS.map((s) => (
              <button
                key={s}
                onClick={() => setShader(s)}
                className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                  s === shader
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-gray-800/70 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Palette */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Palette</label>
            <button onClick={addColor} className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg transition-colors">+ Add</button>
          </div>
          <div className="space-y-1.5">
            {colors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border border-gray-700 bg-gray-800" />
                <input type="text" value={c} onChange={(e) => setColor(i, e.target.value)} className="flex-1 px-2 py-1 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm font-mono" />
                <button onClick={() => removeColor(i)} className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/40 transition-colors" title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Background */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Background</label>
          <div className="flex items-center gap-2">
            <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border border-gray-700 bg-gray-800" />
            <input type="text" value={background} onChange={(e) => setBackground(e.target.value)} className="flex-1 px-2 py-1 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm font-mono" />
          </div>
        </div>

        {/* Knobs */}
        <div className="space-y-3">
          {KNOBS.map((k) => (
            <div key={k.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</label>
                <span className="text-xs text-gray-400 font-mono">{Number(params[k.key]).toFixed(k.step < 1 ? 2 : 0)}</span>
              </div>
              <input
                type="range"
                min={k.min}
                max={k.max}
                step={k.step}
                value={params[k.key]}
                onChange={(e) => setParam(k.key, parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
