// Layer utilities for backward-compatible layout layer management

/**
 * Normalize a layout's module data into layers format.
 * If layout has layers[], use them. Otherwise wrap flat modules[] into a single "Main" layer.
 */
export function getLayers(modulesData) {
  if (!modulesData) return [createLayer('Main', 0)];
  
  // If it's a string, parse it
  const data = typeof modulesData === 'string' ? JSON.parse(modulesData) : modulesData;
  
  // New format: { layers: [...] } or just an object with layers key
  if (data.layers && Array.isArray(data.layers)) {
    return data.layers.map(l => ({
      id: l.id || generateLayerId(),
      name: l.name || 'Layer',
      order: l.order ?? 0,
      visible: l.visible !== false,
      locked: !!l.locked,
      opacity: l.opacity ?? 1.0,
      blendMode: l.blendMode || 'normal',
      chromaKey: l.chromaKey || 'none',
      chromaColor: l.chromaColor || '#00ff00',
      chromaTolerance: l.chromaTolerance ?? 0.35,
      modules: Array.isArray(l.modules) ? l.modules : [],
    }));
  }
  
  // Old format: flat array of modules
  if (Array.isArray(data)) {
    return [{
      id: generateLayerId(),
      name: 'Main',
      order: 0,
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'normal',
      modules: data,
    }];
  }
  
  return [createLayer('Main', 0)];
}

/**
 * Convert layers back to the storage format.
 * Keeps backward compat by also including flat modules[] from all layers.
 */
export function layersToStorage(layers) {
  const allModules = layers.flatMap(l => l.modules || []);
  return {
    layers,
    modules: allModules, // backward compat fallback
  };
}

export function createLayer(name = 'New Layer', order = 0) {
  return {
    id: generateLayerId(),
    name,
    order,
    visible: true,
    locked: false,
    opacity: 1.0,
    blendMode: 'normal',
    chromaKey: 'none',
    chromaColor: '#00ff00',
    chromaTolerance: 0.35,
    modules: [],
  };
}

export function generateLayerId() {
  return 'layer_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen (removes black)' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'luminosity', label: 'Luminosity' },
];

export const CHROMA_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'black', label: '⬛ Remove Black' },
  { value: 'green', label: '🟩 Green Screen' },
  { value: 'blue', label: '🟦 Blue Screen' },
  { value: 'custom', label: '🎨 Custom Color' },
];

/**
 * Get the CSS styles needed for a layer's chroma key setting.
 * - black: uses mix-blend-mode screen (removes black perfectly)
 * - green/blue/custom: uses an SVG filter for per-pixel chroma removal
 */
export function getChromaStyles(layer) {
  const chroma = layer.chromaKey || 'none';
  if (chroma === 'none') return {};
  if (chroma === 'black') return { mixBlendMode: 'screen' };
  return { filter: `url(#${getChromaFilterId(layer.id)})` };
}

export function getChromaFilterId(layerId) {
  return `chroma-${layerId}`;
}
