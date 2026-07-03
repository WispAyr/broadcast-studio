import React from 'react';
import { ShaderLayer } from '../components/ShaderLayer';

/**
 * GPU shader background composition powered by @paper-design/shaders-react.
 * Thin wrapper over the shared, frame-driven ShaderLayer (see that file for the
 * determinism notes). Exposed in the composition registry as "Shader Background".
 */
export const ShaderBackground = ({
  shader = 'simplex-noise',
  colors = '#ff006a\n#8b5cf6\n#06b6d4\n#f59e0b',
  background = '#000000',
  scale = 1,
  speed = 1,
  softness = 0.6,
  distortion = 0.8,
  rotation = 0,
}) => (
  <ShaderLayer
    shader={shader}
    colors={colors}
    background={background}
    scale={scale}
    speed={speed}
    softness={softness}
    distortion={distortion}
    rotation={rotation}
  />
);
