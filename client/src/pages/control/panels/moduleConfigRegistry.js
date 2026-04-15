// Maps module types to their operator-facing configurable fields.
// These define what controls appear in the dynamic config panels during live mode.
// Field types: text, number, datetime, button_group, tag_group, range, textarea, toggle

const MODULE_CONFIGS = {
  live_text: {
    label: 'Live Text',
    icon: '📝',
    color: 'purple',
    fields: [
      { key: 'text', type: 'text', label: 'Main Text', placeholder: 'Enter text...' },
      { key: 'subtitle', type: 'text', label: 'Subtitle', placeholder: 'Subtitle (optional)...' },
    ],
    socketEvent: 'update_module_text',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, text: values.text || '', subtitle: values.subtitle || '',
    }),
  },

  countdown: {
    label: 'Countdown',
    icon: '⏱️',
    color: 'yellow',
    fields: [
      { key: 'targetTime', type: 'datetime', label: 'Target Time' },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { targetTime: values.targetTime },
    }),
  },

  ticker: {
    label: 'Ticker',
    icon: '📜',
    color: 'green',
    fields: [
      { key: 'text', type: 'textarea', label: 'Ticker Text', placeholder: 'Scrolling text...' },
      { key: 'speed', type: 'range', label: 'Speed', min: 1, max: 10, step: 1, default: 5 },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { text: values.text, speed: values.speed },
    }),
  },

  text: {
    label: 'Text',
    icon: '📄',
    color: 'cyan',
    fields: [
      { key: 'text', type: 'textarea', label: 'Content', placeholder: 'Text content...' },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { text: values.text },
    }),
  },

  breaking_news: {
    label: 'Breaking News',
    icon: '🔴',
    color: 'red',
    fields: [
      { key: 'headline', type: 'text', label: 'Headline', placeholder: 'Breaking news headline...' },
      { key: 'body', type: 'textarea', label: 'Body', placeholder: 'Story details...' },
      { key: 'urgent', type: 'toggle', label: 'Urgent', default: false },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { headline: values.headline, body: values.body, urgent: values.urgent },
    }),
  },

  qrcode: {
    label: 'QR Code',
    icon: '📱',
    color: 'blue',
    fields: [
      { key: 'url', type: 'text', label: 'URL', placeholder: 'https://...' },
      { key: 'label', type: 'text', label: 'Label', placeholder: 'Scan me!' },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { url: values.url, label: values.label },
    }),
  },

  image: {
    label: 'Image',
    icon: '🖼️',
    color: 'orange',
    fields: [
      { key: 'url', type: 'text', label: 'Image URL', placeholder: 'https://...' },
      { key: 'fit', type: 'button_group', label: 'Fit', options: ['cover', 'contain', 'fill'], default: 'cover' },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { url: values.url, fit: values.fit },
    }),
  },

  'prism-lens': {
    label: 'Prism Lens',
    icon: '🔬',
    color: 'cyan',
    fields: [
      { key: 'picker', type: 'custom', component: 'PrismLensPicker' },
      { key: 'refreshSecs', type: 'number', label: 'Refresh (s)', default: 60, min: 5 },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId,
      moduleId,
      config: {
        ...(values.picker || {}),
        refreshSecs: values.refreshSecs || 60,
      },
    }),
  },

  'em-globe': {
    label: 'EM Globe',
    icon: '🌐',
    color: 'indigo',
    fields: [
      { key: 'preset', type: 'button_group', label: 'Preset',
        options: ['space-weather', 'aurora', 'solar-wind', 'satellites', 'near-earth', 'seismic', 'flare-ops'],
        default: 'space-weather' },
      { key: 'kiosk', type: 'toggle', label: 'Kiosk (hide chrome)', default: true },
      { key: 'autocycle', type: 'number', label: 'Auto-cycle (s, 0=off)', default: 0, min: 0 },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId,
      moduleId,
      config: {
        preset: values.preset,
        kiosk: values.kiosk,
        autocycle: values.autocycle || 0,
      },
    }),
  },

  color: {
    label: 'Color Fill',
    icon: '🎨',
    color: 'pink',
    fields: [
      { key: 'color', type: 'text', label: 'Color', placeholder: '#000000' },
    ],
    socketEvent: 'update_module_config',
    buildPayload: (studioId, moduleId, values) => ({
      studioId, moduleId, config: { color: values.color },
    }),
  },
};

export default MODULE_CONFIGS;

// Get config for a module type, returns null if not configurable
export function getModuleConfig(moduleType) {
  return MODULE_CONFIGS[moduleType] || null;
}
