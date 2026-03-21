import React from 'react';
import { getChromaFilterId } from '../lib/layers';

/**
 * SVG filter for chroma key removal.
 * Renders an invisible SVG with a filter definition that makes pixels
 * matching the key color transparent, with tolerance + spill suppression.
 * 
 * Referenced by layers via CSS: filter: url(#chroma-{layerId})
 */
export default function ChromaFilter({ layer }) {
  const chroma = layer.chromaKey || 'none';
  if (chroma === 'none' || chroma === 'black') return null;

  const filterId = getChromaFilterId(layer.id);
  const tolerance = layer.chromaTolerance ?? 0.35;

  // Key color in 0-1 range
  let keyR, keyG, keyB;
  if (chroma === 'green') {
    keyR = 0.0; keyG = 0.8; keyB = 0.0;
  } else if (chroma === 'blue') {
    keyR = 0.0; keyG = 0.0; keyB = 0.8;
  } else {
    const hex = (layer.chromaColor || '#00ff00').replace('#', '');
    keyR = parseInt(hex.substr(0, 2), 16) / 255;
    keyG = parseInt(hex.substr(2, 2), 16) / 255;
    keyB = parseInt(hex.substr(4, 2), 16) / 255;
  }

  // Strategy: Use feColorMatrix to compute distance from key color,
  // then use feComponentTransfer to threshold it into alpha.
  //
  // 1. Subtract key color → near-key pixels become near-black
  // 2. Convert to luminance → single-channel distance
  // 3. Use as alpha: dark (close to key) = transparent, bright (far from key) = opaque
  // 4. Composite with original RGB

  const t = Math.max(0.01, tolerance);

  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
          {/* Compute difference from key color */}
          <feColorMatrix type="matrix" in="SourceGraphic" values={`
            1 0 0 0 ${-keyR}
            0 1 0 0 ${-keyG}
            0 0 1 0 ${-keyB}
            0 0 0 0 0
          `} result="diff" />

          {/* Convert to grayscale distance */}
          <feColorMatrix type="matrix" in="diff" values={`
            0 0 0 0 0
            0 0 0 0 0
            0 0 0 0 0
            0.33 0.33 0.33 0 0
          `} result="dist" />

          {/* Threshold: pixels with small distance (close to key) get low alpha */}
          <feComponentTransfer in="dist" result="alpha">
            <feFuncA type="linear" slope={1 / t} intercept={0} />
          </feComponentTransfer>

          {/* Merge: use original RGB with computed alpha */}
          <feComposite in="SourceGraphic" in2="alpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
