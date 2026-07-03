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
} from '@paper-design/shaders-react';

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
    case 'simplex-noise':
    default:
      return <SimplexNoise {...motion} colors={colorList} softness={softness} scale={scale} rotation={rotation} />;
  }
}

/**
 * Full ShaderLayer for use inside a Remotion composition. Reads the current
 * frame, converts to a deterministic ms clock scaled by `speed`, and fills its
 * container. Pass `absolute` to position it as a background behind other content.
 */
export function ShaderLayer({
  shader = 'simplex-noise',
  colors,
  background = '#000000',
  scale = 1,
  speed = 1,
  softness = 0.6,
  distortion = 0.8,
  rotation = 0,
  absolute = false,
  opacity = 1,
  timeScale = 1,
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Remotion frame -> milliseconds, scaled by speed (and any audio timeScale).
  const timeMs = (frame / fps) * 1000 * speed * timeScale;

  const containerStyle = absolute
    ? { position: 'absolute', inset: 0, overflow: 'hidden', opacity }
    : { width: '100%', height: '100%', background, overflow: 'hidden', opacity };

  return (
    <div style={containerStyle}>
      <ShaderView
        shader={shader}
        colors={colors}
        background={background}
        scale={scale}
        softness={softness}
        distortion={distortion}
        rotation={rotation}
        timeMs={timeMs}
      />
    </div>
  );
}

export default ShaderLayer;
