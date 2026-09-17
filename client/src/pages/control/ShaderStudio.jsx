import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShaderView, SHADERS, GLSL_SHADERS, DEFAULT_PALETTE } from '../../components/ShaderLayer';
import { glslControls, glslDefaults } from '../../components/glsl/library';
import { PostFXView, POSTFX_PRESETS, POSTFX_KNOBS } from '../../components/PostFX';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

const BASE_PARAMS = { scale: 1, speed: 1, softness: 0.6, distortion: 0.8, rotation: 0 };

// Grab the live preview's WebGL canvas as a small JPEG data-URI for the look
// thumbnail. GLSLShader runs with preserveDrawingBuffer, so the last frame is
// still readable. Paper shaders / capture failure → null (gallery shows a swatch).
function captureThumb(host) {
  try {
    const cvs = host && host.querySelector('canvas');
    if (!cvs || !cvs.width) return null;
    const t = document.createElement('canvas');
    t.width = 256; t.height = 144;
    t.getContext('2d').drawImage(cvs, 0, 0, 256, 144);
    return t.toDataURL('image/jpeg', 0.5);
  } catch {
    return null;
  }
}

const FINISH_PRESET_NAMES = Object.keys(POSTFX_PRESETS);

const GLSL_SET = new Set(GLSL_SHADERS);

// A lively procedural spectrum so audio-reactive GLSL shaders (spectrum-bars)
// animate in the Studio preview even without an audio source.
function proceduralSpectrum(tMs) {
  const t = tMs / 1000;
  const s = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    const bass = 1 - i / 22;
    s[i] = Math.max(0, (0.35 + 0.5 * Math.abs(Math.sin(t * 2.2 + i * 0.6) * Math.cos(t * 0.7 + i))) * bass);
  }
  return s;
}

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

/**
 * Curated one-click looks. Each is a hand-tuned combination of shader + palette
 * + background + knobs that renders as a broadcast-ready backdrop. The swatch is
 * built live from the palette so the gallery previews the vibe at a glance.
 */
const PRESETS = [
  // ── Broadcast-grade GLSL (our own WebGL2 engine) ──────────────────────────
  { name: 'Aurora',        emoji: '🌌', shader: 'aurora',       bg: '#01040a', colors: ['#00ffa3', '#00b3ff', '#7a5cff', '#00ffa3'], p: { scale: 1.1, speed: 0.5, softness: 0.7, distortion: 0.7, rotation: 0 } },
  { name: 'Liquid Dream',  emoji: '🫧', shader: 'plasma-flow',  bg: '#05010f', colors: ['#0ea5e9', '#7a5cff', '#ff4fd8', '#00ffd0'], p: { scale: 1.3, speed: 0.6, softness: 0.6, distortion: 1.0, rotation: 0 } },
  { name: 'Deep Nebula',   emoji: '💜', shader: 'nebula',       bg: '#04010a', colors: ['#7a5cff', '#ff4fd8', '#00d4ff', '#ffffff'], p: { scale: 1.0, speed: 0.5, softness: 0.6, distortion: 0.8, rotation: 0 } },
  { name: 'Kaleidoscope',  emoji: '🔷', shader: 'kaleidoscope', bg: '#02040a', colors: ['#ff006a', '#ffd24a', '#00d4ff', '#8b5cf6'], p: { scale: 1.0, speed: 0.6, softness: 0.5, distortion: 0.6, rotation: 0 } },
  { name: 'Hyperspace',    emoji: '🚀', shader: 'warp-tunnel',  bg: '#01030a', colors: ['#00e5ff', '#7a5cff', '#ffffff'],            p: { scale: 1.2, speed: 0.8, softness: 0.5, distortion: 0.6, rotation: 0 } },
  { name: 'Pool Caustics', emoji: '💧', shader: 'caustics',     bg: '#021b2b', colors: ['#00d4ff', '#67e8f9', '#ffffff'],            p: { scale: 1.1, speed: 0.6, softness: 0.5, distortion: 0.7, rotation: 0 } },
  { name: 'Cell Glow',     emoji: '🔬', shader: 'voronoi-glow', bg: '#03010a', colors: ['#00ff9d', '#00b3ff', '#ff4fd8'],            p: { scale: 1.1, speed: 0.5, softness: 0.6, distortion: 0.6, rotation: 0 } },
  { name: 'Silk Gradient', emoji: '🪷', shader: 'liquid-mesh',  bg: '#12081f', colors: ['#ff71ce', '#01cdfe', '#b967ff', '#fffb96'], p: { scale: 1.2, speed: 0.4, softness: 0.9, distortion: 0.7, rotation: 0 } },
  { name: 'Hex Pulse',     emoji: '⬡', shader: 'hex-grid',      bg: '#02040a', colors: ['#00e5ff', '#7a5cff', '#ff4fd8'],            p: { scale: 1.0, speed: 0.6, softness: 0.6, distortion: 0.6, rotation: 0 }, glslParams: { density: 0.5, edge: 0.7, pulse: 0.6 } },
  { name: 'Molten Ridge',  emoji: '🏔️', shader: 'ridged-fractal', bg: '#0a0400', colors: ['#ffcf5c', '#ff5c00', '#7a1500'],          p: { scale: 1.0, speed: 0.5, softness: 0.5, distortion: 0.6, rotation: 0 }, glslParams: { sharpness: 0.6, warp: 0.5 } },
  { name: 'Warp Stars',    emoji: '✦', shader: 'starfield',     bg: '#01020a', colors: ['#ffffff', '#7a5cff', '#00e5ff'],            p: { scale: 1.0, speed: 0.6, softness: 0.5, distortion: 0.6, rotation: 0 }, glslParams: { density: 0.6, speed: 0.5, streak: 0.6 } },
  { name: 'Retro CRT',     emoji: '📺', shader: 'crt',          bg: '#02040a', colors: ['#00ff9d', '#00b3ff', '#ff4fd8', '#ffd24a'], p: { scale: 1.2, speed: 0.5, softness: 0.5, distortion: 0.6, rotation: 0 }, glslParams: { scanlines: 0.5, curvature: 0.4, aberration: 0.5 } },
  { name: 'Spectrum',      emoji: '📊', shader: 'spectrum-bars', bg: '#03010a', colors: ['#00e5ff', '#7a5cff', '#ff4fd8', '#ffd24a'], p: { scale: 1.0, speed: 0.6, softness: 0.5, distortion: 0.6, rotation: 0 }, glslParams: { bars: 1.0, height: 0.7 } },
  // ── Paper Design component shaders ────────────────────────────────────────
  { name: 'Vapor Mesh',    emoji: '📼', shader: 'mesh-gradient', bg: '#1a0033', colors: ['#00ffa3', '#00b3ff', '#7a5cff', '#00ffa3'], p: { scale: 1.2, speed: 0.5, softness: 0.9, distortion: 0.8, rotation: 20 } },
  { name: 'Molten Chrome', emoji: '🔥', shader: 'liquid-metal',  bg: '#0a0500', colors: ['#ffb347', '#ff7a00'],                       p: { scale: 1.0, speed: 0.6, softness: 0.4, distortion: 0.6, rotation: 30 } },
  { name: 'Liquid Silver', emoji: '🪞', shader: 'liquid-metal',  bg: '#05070a', colors: ['#e6edf5', '#9fb3c8'],                       p: { scale: 1.2, speed: 0.4, softness: 0.3, distortion: 0.4, rotation: 0 } },
  { name: 'Deep Space',    emoji: '🚀', shader: 'simplex-noise', bg: '#000000', colors: ['#1b1035', '#3a1d6e', '#0a0420', '#120a2a'], p: { scale: 1.6, speed: 0.3, softness: 0.8, distortion: 0.6, rotation: 0 } },
  { name: 'Nebula Bloom',  emoji: '💠', shader: 'smoke-ring',    bg: '#05010f', colors: ['#ff4fd8', '#7a5cff', '#00d4ff'],            p: { scale: 1.1, speed: 0.5, softness: 0.7, distortion: 0.8, rotation: 0 } },
  { name: 'Emerald Tide',  emoji: '🌊', shader: 'waves',         bg: '#021b17', colors: ['#00ff9d'],                                  p: { scale: 1.4, speed: 0.8, softness: 0.6, distortion: 0.8, rotation: 10 } },
  { name: 'Solar Flare',   emoji: '☀️', shader: 'god-rays',      bg: '#0a0400', colors: ['#ffd24a', '#ff7a00', '#ff2d55'],            p: { scale: 1.0, speed: 0.6, softness: 0.5, distortion: 0.8, rotation: 40 } },
  { name: 'Plasma Storm',  emoji: '⚡', shader: 'swirl',          bg: '#05010a', colors: ['#ff006a', '#8b5cf6', '#00d4ff'],            p: { scale: 1.3, speed: 1.0, softness: 0.6, distortion: 1.0, rotation: 60 } },
  { name: 'Bioluminesce',  emoji: '🦑', shader: 'gem-smoke',     bg: '#00060a', colors: ['#00ffd0', '#0088ff', '#00ff88'],            p: { scale: 1.1, speed: 0.5, softness: 0.8, distortion: 1.0, rotation: 15 } },
  { name: 'Inferno',       emoji: '🌋', shader: 'gem-smoke',     bg: '#0a0200', colors: ['#ff3d00', '#ff9e00', '#ffd000'],            p: { scale: 1.1, speed: 0.7, softness: 0.7, distortion: 1.2, rotation: 20 } },
  { name: 'Vaporwave',     emoji: '📼', shader: 'mesh-gradient', bg: '#1a0033', colors: ['#ff71ce', '#01cdfe', '#b967ff', '#fffb96'], p: { scale: 1.0, speed: 0.4, softness: 0.85, distortion: 1.0, rotation: 0 } },
  { name: 'Neon Grid',     emoji: '🕹️', shader: 'dot-grid',      bg: '#04020a', colors: ['#00ffff', '#ff00e6'],                       p: { scale: 1.4, speed: 0, softness: 0.5, distortion: 0.5, rotation: 0 } },
  { name: 'Voronoi Ice',   emoji: '❄️', shader: 'voronoi',       bg: '#02121f', colors: ['#bfefff', '#4aa8ff', '#ffffff'],            p: { scale: 1.2, speed: 0.5, softness: 0.6, distortion: 0.6, rotation: 0 } },
  { name: 'Cotton Candy',  emoji: '🍬', shader: 'grain-gradient', bg: '#1a1626', colors: ['#ffd1e8', '#c1c8ff', '#d1fff0'],           p: { scale: 1.0, speed: 0.4, softness: 0.9, distortion: 0.6, rotation: 0 } },
  { name: 'Gold Warp',     emoji: '🏆', shader: 'warp',          bg: '#0a0400', colors: ['#ffcf5c', '#ff8a00', '#c2410c'],            p: { scale: 1.0, speed: 0.5, softness: 0.5, distortion: 1.2, rotation: 30 } },
  { name: 'Hypnotwist',    emoji: '🌀', shader: 'spiral',        bg: '#04010a', colors: ['#00e5ff', '#7a5cff'],                       p: { scale: 1.2, speed: 0.6, softness: 0.4, distortion: 1.0, rotation: 0 } },
];

const rand = (a, b) => a + Math.random() * (b - a);
const randHex = () =>
  '#' + Array.from({ length: 3 }, () => Math.floor(rand(40, 256)).toString(16).padStart(2, '0')).join('');
const swatch = (colors) => `linear-gradient(120deg, ${colors.join(', ')})`;

export default function ShaderStudio() {
  const toast = useToast();
  const [shader, setShader] = useState('plasma-flow');
  const [colors, setColors] = useState(['#0ea5e9', '#7a5cff', '#ff4fd8', '#00ffd0']);
  const [background, setBackground] = useState('#05010f');
  const [params, setParams] = useState({ scale: 1.3, speed: 0.6, softness: 0.6, distortion: 1.0, rotation: 0 });
  const [glslParams, setGlslParams] = useState(() => glslDefaults('plasma-flow'));
  const [finish, setFinish] = useState(() => ({ ...POSTFX_PRESETS.broadcast, leakColor: '#ffd9a0' }));
  const [timeMs, setTimeMs] = useState(0);

  const [looks, setLooks] = useState([]);
  const [lookName, setLookName] = useState('');
  const [saving, setSaving] = useState(false);
  const previewRef = useRef(null);

  const activeControls = glslControls(shader);

  // Load saved looks (this studio + house looks).
  useEffect(() => {
    api.get('/looks').then(setLooks).catch(() => {});
  }, []);

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

  // Switching shader resets the advanced controls to that shader's defaults.
  const selectShader = (id) => {
    setShader(id);
    setGlslParams(glslDefaults(id));
  };

  const applyPreset = (preset) => {
    setShader(preset.shader);
    setColors([...preset.colors]);
    setBackground(preset.bg);
    setParams({ ...preset.p });
    setGlslParams(preset.glslParams ? { ...preset.glslParams } : glslDefaults(preset.shader));
    toast?.(`${preset.name} loaded`, 'success');
  };

  const randomize = () => {
    const s = SHADERS[Math.floor(Math.random() * SHADERS.length)];
    const n = 2 + Math.floor(Math.random() * 3);
    setShader(s);
    setColors(Array.from({ length: n }, randHex));
    setBackground('#02030a');
    setParams({
      scale: +rand(0.6, 2).toFixed(2),
      speed: +rand(0.2, 1.5).toFixed(2),
      softness: +rand(0.2, 1).toFixed(2),
      distortion: +rand(0.2, 1.6).toFixed(2),
      rotation: Math.floor(rand(0, 360)),
    });
    // Randomise the shader's own controls too, within their ranges.
    const gp = {};
    glslControls(s).forEach((c) => {
      const v = rand(c.min, c.max);
      gp[c.key] = c.step >= 1 ? Math.round(v) : +v.toFixed(2);
    });
    setGlslParams(gp);
    toast?.(`Randomised → ${s}`, 'success');
  };

  const setParam = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const setGlslParam = (k, v) => setGlslParams((p) => ({ ...p, [k]: v }));
  const setFinishParam = (k, v) => setFinish((f) => ({ ...f, [k]: v }));
  const applyFinishPreset = (name) => setFinish({ ...POSTFX_PRESETS[name], leakColor: finish.leakColor || '#ffd9a0' });

  // ── Saved looks: capture → save → apply → delete ──────────────────────────
  const saveLook = async () => {
    const name = lookName.trim();
    if (!name) { toast?.('Name the look first', 'error'); return; }
    setSaving(true);
    try {
      const hasFinish = POSTFX_KNOBS.some((k) => Number(finish[k.key]) > 0);
      const body = {
        name,
        shader,
        colors,
        background,
        params,
        glslParams: glslControls(shader).length ? glslParams : {},
        finishing: hasFinish ? finish : null,
        thumbnail: captureThumb(previewRef.current),
      };
      const created = await api.post('/looks', body);
      setLooks((l) => [created, ...l]);
      setLookName('');
      toast?.(`Saved "${name}"`, 'success');
    } catch (e) {
      toast?.(`Save failed: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyLook = (look) => {
    setShader(look.shader);
    setColors(look.colors && look.colors.length ? [...look.colors] : [...DEFAULT_PALETTE]);
    setBackground(look.background || '#000000');
    setParams({ ...BASE_PARAMS, ...(look.params || {}) });
    setGlslParams(look.glslParams && Object.keys(look.glslParams).length ? { ...look.glslParams } : glslDefaults(look.shader));
    setFinish(look.finishing ? { leakColor: '#ffd9a0', ...look.finishing } : { ...POSTFX_PRESETS.none, leakColor: '#ffd9a0' });
    toast?.(`Look "${look.name}" applied`, 'success');
  };

  const deleteLook = async (id) => {
    try {
      await api.delete(`/looks/${id}`);
      setLooks((l) => l.filter((x) => x.id !== id));
    } catch (e) {
      toast?.(`Delete failed: ${e.message}`, 'error');
    }
  };
  const setColor = (i, v) => setColors((c) => c.map((x, j) => (j === i ? v : x)));
  const addColor = () => setColors((c) => [...c, '#ffffff']);
  const removeColor = (i) => setColors((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c));

  // The prop set a composition needs. `glslParams` only travels when the shader
  // exposes advanced controls.
  // The finishing pass only travels when it's actually doing something.
  const finishActive = useMemo(
    () => POSTFX_KNOBS.some((k) => Number(finish[k.key]) > 0),
    [finish]
  );

  const inputProps = useMemo(
    () => ({
      shader,
      colors: colors.join('\n'),
      background,
      ...params,
      ...(activeControls.length ? { glslParams } : {}),
      ...(finishActive ? { finishing: finish } : {}),
    }),
    [shader, colors, background, params, glslParams, activeControls.length, finishActive, finish]
  );

  const jsonSnippet = useMemo(() => JSON.stringify(inputProps, null, 2), [inputProps]);
  const tsxSnippet = useMemo(() => {
    const c = JSON.stringify(colors);
    const paramsLine = activeControls.length ? `\n  glslParams={${JSON.stringify(glslParams)}}` : '';
    const finishLine = finishActive ? `\n  finishing={${JSON.stringify(finish)}}` : '';
    return `<ShaderBackground\n  shader="${shader}"\n  colors={${c}}\n  background="${background}"\n  scale={${params.scale}}\n  speed={${params.speed}}\n  softness={${params.softness}}\n  distortion={${params.distortion}}\n  rotation={${params.rotation}}${paramsLine}${finishLine}\n/>`;
  }, [shader, colors, background, params, glslParams, activeControls.length, finishActive, finish]);

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
            <p className="text-gray-400 text-sm">Broadcast-grade GLSL shaders (✦) + Paper Design — frame-deterministic, palette-driven, export to any composition backdrop.</p>
          </div>
        </div>
        <div ref={previewRef} className="rounded-2xl overflow-hidden border border-gray-800 bg-black aspect-video shadow-2xl">
          <PostFXView timeMs={timeMs} {...finish}>
            <ShaderView
              shader={shader}
              colors={colors}
              background={background}
              scale={params.scale}
              softness={params.softness}
              distortion={params.distortion}
              rotation={params.rotation}
              glslParams={glslParams}
              spectrum={proceduralSpectrum(timeMs)}
              timeMs={timeMs}
              style={{ width: '100%', height: '100%' }}
            />
          </PostFXView>
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

        {/* My Looks — saved, reusable, brandable backdrop recipes */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-sm font-semibold text-white">My Looks</label>
              <p className="text-xs text-gray-500">Save the current recipe — shader, palette, controls &amp; finishing — and reuse it anywhere.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveLook(); }}
              placeholder="Name this look…"
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
            />
            <button
              onClick={saveLook}
              disabled={saving}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving…' : '＋ Save look'}
            </button>
          </div>
          {looks.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No saved looks yet — tune a backdrop and save it.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {looks.map((look) => (
                <div key={look.id} className="group relative rounded-lg overflow-hidden border border-gray-800 bg-gray-900">
                  <button onClick={() => applyLook(look)} title={`Apply "${look.name}"`} className="block w-full text-left">
                    <div className="aspect-video w-full bg-black">
                      {look.thumbnail ? (
                        <img src={look.thumbnail} alt={look.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" style={{ background: swatch(look.colors && look.colors.length ? look.colors : ['#333', '#111']) }} />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-xs font-semibold text-white truncate">{look.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono truncate">
                        {look.shader}{look.global ? ' · house' : ''}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteLook(look.id)}
                    title="Delete look"
                    className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full lg:w-80 shrink-0 space-y-5">
        {/* Presets gallery */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Presets</label>
            <button
              onClick={randomize}
              className="px-2 py-0.5 bg-gradient-to-r from-fuchsia-600 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 text-white text-xs font-semibold rounded-lg transition-colors"
              title="Random shader, palette and knobs"
            >
              🎲 Surprise me
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const active = preset.shader === shader && preset.colors.join() === colors.join();
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  title={`${preset.name} · ${preset.shader}`}
                  className={`group relative h-12 rounded-lg overflow-hidden border text-left transition-transform hover:scale-[1.03] ${
                    active ? 'border-white ring-1 ring-white/60' : 'border-gray-700/70'
                  }`}
                >
                  <span className="absolute inset-0" style={{ background: swatch(preset.colors) }} />
                  <span className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
                  <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-[11px]">{preset.emoji}</span>
                    <span className="text-[11px] font-semibold text-white truncate drop-shadow">{preset.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shader picker — GLSL (broadcast-grade) shaders are marked with ✦ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Shader</label>
            <span className="text-[10px] text-cyan-400/80 font-mono">✦ = GLSL engine</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SHADERS.map((s) => {
              const glsl = GLSL_SET.has(s);
              return (
                <button
                  key={s}
                  onClick={() => selectShader(s)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-colors border flex items-center justify-between gap-1 ${
                    s === shader
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : glsl
                      ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-100 hover:bg-cyan-900/40'
                      : 'bg-gray-800/70 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="truncate">{s}</span>
                  {glsl && <span className="text-cyan-400 shrink-0">✦</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced — per-shader controls (map to uParam.x/y/z/w) */}
        {activeControls.length > 0 && (
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3">
            <label className="text-xs text-cyan-300 uppercase tracking-wide block mb-2">
              {shader} controls ✦
            </label>
            <div className="space-y-3">
              {activeControls.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">{c.label}</label>
                    <span className="text-xs text-cyan-300 font-mono">
                      {Number(glslParams[c.key] ?? c.default).toFixed(c.step >= 1 ? 0 : 2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={glslParams[c.key] ?? c.default}
                    onChange={(e) => setGlslParam(c.key, parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Finishing pass — the broadcast look layer (PostFX) */}
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/15 p-3">
          <label className="text-xs text-amber-300 uppercase tracking-wide block mb-2">Finishing ✦</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FINISH_PRESET_NAMES.map((name) => (
              <button
                key={name}
                onClick={() => applyFinishPreset(name)}
                className="px-2 py-1 rounded-lg text-xs font-mono border bg-amber-900/30 border-amber-800/50 text-amber-100 hover:bg-amber-800/40 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {POSTFX_KNOBS.map((k) => (
              <div key={k.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">{k.label}</label>
                  <span className="text-xs text-amber-300/90 font-mono">{Number(finish[k.key] ?? 0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={k.key === 'letterbox' ? 0.25 : 1}
                  step={0.01}
                  value={finish[k.key] ?? 0}
                  onChange={(e) => setFinishParam(k.key, parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs text-gray-400 flex-1">Leak colour</label>
              <input type="color" value={finish.leakColor || '#ffd9a0'} onChange={(e) => setFinishParam('leakColor', e.target.value)} className="w-8 h-7 rounded-lg cursor-pointer border border-gray-700 bg-gray-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
