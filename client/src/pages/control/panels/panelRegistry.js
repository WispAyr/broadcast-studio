// Static panel definitions for the live mode workspace.
// Each panel maps to a control surface component.

export const PANELS = [
  {
    id: 'screens',
    label: 'Screens',
    icon: '📺',
    defaultZone: 'center',
    defaultVisible: true,
    color: 'green',
    description: 'Live screen grid with status and push controls',
  },
  {
    id: 'pvwPgm',
    label: 'PVW / PGM',
    icon: '🎬',
    defaultZone: 'top',
    defaultVisible: true,
    color: 'red',
    description: 'Preview and Program monitors with Take/Cut',
  },
  {
    id: 'overlays',
    label: 'Overlays',
    icon: '🎭',
    defaultZone: 'right',
    defaultVisible: true,
    color: 'purple',
    description: 'Push and manage on-screen overlays',
  },
  {
    id: 'macros',
    label: 'Macros',
    icon: '⌨️',
    defaultZone: 'right',
    defaultVisible: true,
    color: 'blue',
    description: 'F1-F8 programmable macro buttons',
  },
  {
    id: 'cueList',
    label: 'Cue List',
    icon: '📋',
    defaultZone: 'left',
    defaultVisible: false,
    color: 'yellow',
    description: 'Sequential cue playback',
  },
  {
    id: 'transitions',
    label: 'Transitions',
    icon: '🔄',
    defaultZone: 'top',
    defaultVisible: true,
    color: 'cyan',
    description: 'Transition type and duration controls',
  },
  {
    id: 'clockTally',
    label: 'Clock / Tally',
    icon: '🕐',
    defaultZone: 'top',
    defaultVisible: true,
    color: 'white',
    description: 'Live clock, show timer, on-air tally',
  },
  {
    id: 'hotbar',
    label: 'Layout Hotbar',
    icon: '🎛️',
    defaultZone: 'bottom',
    defaultVisible: true,
    color: 'gray',
    description: 'Quick layout switching with keyboard shortcuts',
  },
];

// Built-in workspace presets
export const WORKSPACE_PRESETS = {
  default: {
    name: 'Default',
    panels: {
      screens: { visible: true, zone: 'center' },
      pvwPgm: { visible: true, zone: 'top' },
      overlays: { visible: true, zone: 'right' },
      macros: { visible: true, zone: 'right' },
      cueList: { visible: false, zone: 'left' },
      transitions: { visible: true, zone: 'top' },
      clockTally: { visible: true, zone: 'top' },
      hotbar: { visible: true, zone: 'bottom' },
    },
  },
  minimal: {
    name: 'Minimal',
    panels: {
      screens: { visible: true, zone: 'center' },
      pvwPgm: { visible: false, zone: 'top' },
      overlays: { visible: false, zone: 'right' },
      macros: { visible: false, zone: 'right' },
      cueList: { visible: false, zone: 'left' },
      transitions: { visible: false, zone: 'top' },
      clockTally: { visible: true, zone: 'top' },
      hotbar: { visible: true, zone: 'bottom' },
    },
  },
  fullProduction: {
    name: 'Full Production',
    panels: {
      screens: { visible: true, zone: 'center' },
      pvwPgm: { visible: true, zone: 'top' },
      overlays: { visible: true, zone: 'right' },
      macros: { visible: true, zone: 'right' },
      cueList: { visible: true, zone: 'left' },
      transitions: { visible: true, zone: 'top' },
      clockTally: { visible: true, zone: 'top' },
      hotbar: { visible: true, zone: 'bottom' },
    },
  },
};

export const DEFAULT_WORKSPACE_ID = 'default';

// Panel color map for PanelShell borders
export const PANEL_COLORS = {
  green: 'border-green-500',
  red: 'border-red-500',
  purple: 'border-purple-500',
  blue: 'border-blue-500',
  yellow: 'border-yellow-500',
  cyan: 'border-cyan-500',
  white: 'border-gray-400',
  gray: 'border-gray-600',
  orange: 'border-orange-500',
  pink: 'border-pink-500',
};

export const PANEL_BG_COLORS = {
  green: 'bg-green-500/10',
  red: 'bg-red-500/10',
  purple: 'bg-purple-500/10',
  blue: 'bg-blue-500/10',
  yellow: 'bg-yellow-500/10',
  cyan: 'bg-cyan-500/10',
  white: 'bg-gray-400/10',
  gray: 'bg-gray-600/10',
  orange: 'bg-orange-500/10',
  pink: 'bg-pink-500/10',
};
