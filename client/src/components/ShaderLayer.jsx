import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  SimplexNoise,
  MeshGradient,
  Warp,
  Waves,
  Swirl,
  Metaballs,
  Voronoi,
  DotOrbit,
  GrainGradient,
  NeuroNoise,
  SmokeRing,
  PerlinNoise,
  DotGrid,
  GodRays,
  Spiral,
  Dithering,
  PulsingBorder,
  ColorPanels,
  Water,
} from '@paper-design/shaders-react';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';

/**
 * Reusable, frame-driven Paper Design shader renderer.
 *
 * Determinism: Paper shaders animate off wall-clock (requestAnimationFrame),
 * which drifts and tears when the Remotion Player seeks or output is captured.
 * We pin the shader clock to the Remotion frame instead:
 *   - speed={0}  → stop the shader's own rAF loop
 *   - frame={ms} → set u_time directly (frame is milliseconds from zero)
 * so the shader steps deterministically and renders identically live or captured.
 *
 * Shared by the standalone ShaderBackground composition, scene-composition
 * backdrops, and the ShaderStudio control panel.
 */

export const SHADERS = [
  'simplex-noise', 'mesh-gradient', 'warp', 'waves', 'swirl',
  'metaballs', 'voronoi', 'dot-orbit', 'grain-gradient', 'neuro-noise',
  'smoke-ring', 'perlin-noise', 'dot-grid', 'god-rays', 'spiral',
  'dithering', 'pulsing-border', 'color-panels', 'water',
];

export const DEFAULT_PALETTE = ['#ff006a', '#8b5cf6', '#06b6d4', '#f59e0b'];

const FILL = { width: '100%', height: '100%' };

export function parseColors(colors) {
  if (Array.isArray(colors)) return colors.filter(Boolean);
  const list = String(colors || '')
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_PALETTE;
}

export const AUDIO_BANDS = ['bass', 'mid', 'treble', 'full'];

const BAND_RANGE = { bass: [0, 0.33], mid: [0.33, 0.66], treble: [0.66, 1], full: [0, 1] };

/** Mean amplitude (0..~1) of a frequency band from a visualizeAudio() spectrum. */
function bandAmplitude(spectrum, band = 'bass') {
  if (!spectrum || !spectrum.length) return 0;
  const [lo, hi] = BAND_RANGE[band] || BAND_RANGE.full;
  const a = Math.floor(lo * spectrum.length);
  const b = Math.max(a + 1, Math.ceil(hi * spectrum.length));
  let sum = 0;
  for (let i = a; i < b; i++) sum += spectrum[i];
  return sum / (b - a);
}

function containerStyleFor(absolute, opacity, background) {
  return absolute
    ? { position: 'absolute', inset: 0, overflow: 'hidden', opacity }
    : { width: '100%', height: '100%', background, overflow: 'hidden', opacity };
}

/**
 * Render a single Paper shader at a deterministic time.
 * @param {number} timeMs  shader clock in ms (u_time). Callers derive this from
 *                         the Remotion frame; pass an audio-modulated value for
 *                         reactive motion.
 */
export function ShaderView({
  shader = 'simplex-noise',
  colors = DEFAULT_PALETTE,
  background = '#000000',
  scale = 1,
  softness = 0.6,
  distortion = 0.8,
  rotation = 0,
  timeMs = 0,
  style,
}) {
  const colorList = parseColors(colors);
  const motion = { speed: 0, frame: timeMs, style: style || FILL };

  switch (shader) {
    case 'mesh-gradient':
      return <MeshGradient {...motion} colors={colorList} distortion={distortion} swirl={softness} scale={scale} />;
    case 'warp':
      return <Warp {...motion} colors={colorList} proportion={0.5} softness={softness} distortion={distortion} scale={scale} rotation={rotation} />;
    case 'waves':
      return <Waves {...motion} colorFront={colorList[0]} colorBack={background} scale={scale} rotation={rotation} />;
    case 'swirl':
      return <Swirl {...motion} colors={colorList} scale={scale} rotation={rotation} />;
    case 'metaballs':
      return <Metaballs {...motion} colors={colorList} colorBack={background} scale={scale} />;
    case 'voronoi':
      return <Voronoi {...motion} colors={colorList} stepsPerColor={2} scale={scale} />;
    case 'dot-orbit':
      return <DotOrbit {...motion} colors={colorList} colorBack={background} scale={scale} />;
    case 'grain-gradient':
      return <GrainGradient {...motion} colors={colorList} softness={softness} scale={scale} rotation={rotation} />;
    case 'neuro-noise':
      return <NeuroNoise {...motion} colorFront={colorList[0]} colorMid={colorList[1] || colorList[0]} colorBack={background} scale={scale} />;
    case 'smoke-ring':
      return <SmokeRing {...motion} colors={colorList} colorBack={background} scale={scale} />;
    case 'perlin-noise':
      return <PerlinNoise {...motion} colorFront={colorList[0]} colorBack={background} softness={softness} scale={scale} />;
    case 'dot-grid':
      // Static shader (no motion clock) — renders a still dot lattice.
      return <DotGrid colorFill={colorList[0]} colorStroke={colorList[1] || colorList[0]} colorBack={background} scale={scale} style={style || FILL} />;
    case 'god-rays':
      return <GodRays {...motion} colors={colorList} colorBack={background} scale={scale} rotation={rotation} />;
    case 'spiral':
      return <Spiral {...motion} colorFront={colorList[0]} colorBack={background} distortion={distortion} softness={softness} scale={scale} rotation={rotation} />;
    case 'dithering':
      return <Dithering {...motion} colorFront={colorList[0]} colorBack={background} scale={scale} />;
    case 'pulsing-border':
      return <PulsingBorder {...motion} colors={colorList} colorBack={background} softness={softness} scale={scale} />;
    case 'color-panels':
      return <ColorPanels {...motion} colors={colorList} colorBack={background} scale={scale} />;
    case 'water':
      return <Water {...motion} colorBack={background} colorHighlight={colorList[0]} scale={scale} />;
    case 'simplex-noise':
    default:
      return <SimplexNoise {...motion} colors={colorList} softness={softness} scale={scale} rotation={rotation} />;
  }
}

// Non-reactive layer: pure frame-driven clock.
function StaticShaderLayer(p) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000 * p.speed * p.timeScale;
  return (
    <div style={containerStyleFor(p.absolute, p.opacity, p.background)}>
      <ShaderView
        shader={p.shader} colors={p.colors} background={p.background}
        scale={p.scale} softness={p.softness} distortion={p.distortion}
        rotation={p.rotation} timeMs={timeMs}
      />
    </div>
  );
}

// Audio-reactive layer: pulses `scale` from a frequency band of `audioSrc`.
// Deterministic — visualizeAudio(frame) is a pure function of the loaded audio
// data and the frame, so it renders identically live and in offline export.
// The clock stays purely frame-driven (no time jitter); only scale pumps.
function AudioReactiveShaderLayer(p) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(p.audioSrc);
  const timeMs = (frame / fps) * 1000 * p.speed * p.timeScale;

  let amp = 0;
  if (audioData) {
    const spectrum = visualizeAudio({ fps, frame, audioData, numberOfSamples: 16, optimizeFor: 'accuracy' });
    amp = bandAmplitude(spectrum, p.audioBand);
  }
  const pulse = 1 + amp * p.audioReactivity;

  return (
    <div style={containerStyleFor(p.absolute, p.opacity, p.background)}>
      <ShaderView
        shader={p.shader} colors={p.colors} background={p.background}
        scale={p.scale * pulse} softness={p.softness} distortion={p.distortion}
        rotation={p.rotation} timeMs={timeMs}
      />
    </div>
  );
}

/**
 * ShaderLayer for use inside a Remotion composition. Reads the current frame,
 * converts to a deterministic ms clock scaled by `speed`, and fills its
 * container. Pass `absolute` to position it as a background behind other
 * content. Pass `audioSrc` to make `scale` pulse to a frequency band
 * (`audioBand`) with intensity `audioReactivity` — deterministic per frame.
 */
export function ShaderLayer(props) {
  const p = {
    shader: 'simplex-noise', colors: undefined, background: '#000000',
    scale: 1, speed: 1, softness: 0.6, distortion: 0.8, rotation: 0,
    absolute: false, opacity: 1, timeScale: 1,
    audioSrc: '', audioReactivity: 1, audioBand: 'bass',
    ...props,
  };
  return p.audioSrc ? <AudioReactiveShaderLayer {...p} /> : <StaticShaderLayer {...p} />;
}

export default ShaderLayer;
