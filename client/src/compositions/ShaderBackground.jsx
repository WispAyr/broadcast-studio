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
 * GPU shader background powered by @paper-design/shaders-react.
 *
 * Determinism: Paper shaders normally animate off wall-clock (requestAnimationFrame).
 * That drifts and can't be scrubbed/seeked, so it would tear when the Remotion Player
 * seeks or when output is captured. We instead pin the shader clock to Remotion's frame:
 *   - speed={0}  → stop the shader's own rAF loop entirely
 *   - frame={ms} → set u_time directly (frame is milliseconds from zero)
 * Every Remotion frame re-renders with a new `frame` prop, so the shader steps forward
 * deterministically and renders identically live or captured. The `speed` schema knob
 * just scales how fast we advance that frame clock.
 */

const PALETTE = ['#ff006a', '#8b5cf6', '#06b6d4', '#f59e0b'];

const FILL = { width: '100%', height: '100%' };

function parseColors(colors) {
  if (Array.isArray(colors)) return colors;
  const list = String(colors || '')
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean);
  return list.length ? list : PALETTE;
}

export const ShaderBackground = ({
  shader = 'simplex-noise',
  colors = '#ff006a\n#8b5cf6\n#06b6d4\n#f59e0b',
  background = '#000000',
  scale = 1,
  speed = 1,
  softness = 0.6,
  distortion = 0.8,
  rotation = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Remotion frame -> milliseconds, scaled by the speed knob. Deterministic.
  const timeMs = (frame / fps) * 1000 * speed;

  const colorList = parseColors(colors);

  // Common deterministic motion props applied to every shader.
  const motion = { speed: 0, frame: timeMs, style: FILL };

  let el;
  switch (shader) {
    case 'mesh-gradient':
      el = <MeshGradient {...motion} colors={colorList} distortion={distortion} swirl={softness} scale={scale} />;
      break;
    case 'warp':
      el = <Warp {...motion} colors={colorList} proportion={0.5} softness={softness} distortion={distortion} scale={scale} rotation={rotation} />;
      break;
    case 'waves':
      el = <Waves {...motion} colorFront={colorList[0]} colorBack={background} scale={scale} rotation={rotation} />;
      break;
    case 'swirl':
      el = <Swirl {...motion} colors={colorList} scale={scale} rotation={rotation} />;
      break;
    case 'metaballs':
      el = <Metaballs {...motion} colors={colorList} colorBack={background} scale={scale} />;
      break;
    case 'voronoi':
      el = <Voronoi {...motion} colors={colorList} stepsPerColor={2} scale={scale} />;
      break;
    case 'dot-orbit':
      el = <DotOrbit {...motion} colors={colorList} colorBack={background} scale={scale} />;
      break;
    case 'grain-gradient':
      el = <GrainGradient {...motion} colors={colorList} softness={softness} scale={scale} rotation={rotation} />;
      break;
    case 'neuro-noise':
      el = <NeuroNoise {...motion} colorFront={colorList[0]} colorMid={colorList[1] || colorList[0]} colorBack={background} scale={scale} />;
      break;
    case 'simplex-noise':
    default:
      el = <SimplexNoise {...motion} colors={colorList} softness={softness} scale={scale} rotation={rotation} />;
      break;
  }

  return (
    <div style={{ width: '100%', height: '100%', background, overflow: 'hidden' }}>
      {el}
    </div>
  );
};
