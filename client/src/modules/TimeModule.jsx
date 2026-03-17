import React, { useMemo } from 'react';

/**
 * Time — by Local Connect
 * https://time.local-connect.uk
 * 
 * 14 clock modes, fully configurable via layout editor.
 * 
 * CONFIG OPTIONS:
 *   mode          - Clock mode (see MODES below)
 *   theme         - Color theme: amber, green, blue, red, white, cyan, purple, pink, matrix
 *   timezone      - IANA timezone string (e.g. 'Europe/London', 'America/New_York')
 *   label         - Display label/name shown on the clock
 *   callsign      - Ham radio callsign (for shack/contest modes)
 *   grid          - Maidenhead grid locator (for shack/contest modes)
 *   target        - Target date ISO string (for countdown mode)
 *   fullscreen    - Request fullscreen on load (default: true for embeds)
 *   showControls  - Show back button / settings in the iframe (default: false)
 *   workMinutes   - Pomodoro work period in minutes (default: 25)
 *   breakMinutes  - Pomodoro break period in minutes (default: 5)
 *   background    - Container background color
 *   baseUrl       - Override base URL (default: https://time.local-connect.uk)
 */

const MODES = [
  // Broadcast & Studio
  { id: 'broadcast',  name: 'Broadcast Clock',   desc: 'Professional segment wheel with sweep hand', category: 'broadcast' },
  { id: 'studio-led', name: 'Studio LED',        desc: 'Green dot matrix with sweep second indicator', category: 'broadcast' },
  { id: 'analogue',   name: 'Analogue Studio',   desc: 'Traditional clock face with smooth hands', category: 'broadcast' },
  { id: 'flip',       name: 'Digital Flip',      desc: 'Retro split-flap departure board style', category: 'broadcast' },
  { id: 'minimal',    name: 'Minimal',           desc: 'Ultra-clean massive time digits', category: 'broadcast' },
  { id: 'nixie',      name: 'Nixie Tube',        desc: 'Warm orange glow vintage tube display', category: 'broadcast' },
  // Ham Radio
  { id: 'shack',      name: 'Radio Shack',       desc: 'UTC, callsign, grid locator', category: 'ham' },
  { id: 'contest',    name: 'Contest Clock',     desc: 'QSO counter, elapsed time, band tracking', category: 'ham' },
  { id: 'propagation',name: 'Propagation',       desc: 'Grey line map, solar data, band conditions', category: 'ham' },
  // Utility
  { id: 'world',      name: 'World Clock',       desc: 'Multiple timezone columns side by side', category: 'utility' },
  { id: 'countdown',  name: 'Countdown',         desc: 'Countdown to a target date with urgency colours', category: 'utility' },
  { id: 'binary',     name: 'Binary Clock',      desc: 'BCD columns with LED indicators', category: 'utility' },
  { id: 'spectrum',   name: 'Spectrum',           desc: 'Rainbow colour sweep synced to seconds', category: 'utility' },
  { id: 'pomodoro',   name: 'Pomodoro',          desc: 'Work/break timer with configurable intervals', category: 'utility' },
];

const THEMES = [
  { id: '',       name: 'Default (mode-specific)' },
  { id: 'amber',  name: 'Amber' },
  { id: 'green',  name: 'Green' },
  { id: 'blue',   name: 'Blue' },
  { id: 'red',    name: 'Red' },
  { id: 'white',  name: 'White' },
  { id: 'cyan',   name: 'Cyan' },
  { id: 'purple', name: 'Purple' },
  { id: 'pink',   name: 'Pink' },
  { id: 'matrix', name: 'Matrix' },
];

const COMMON_TIMEZONES = [
  { id: '', name: 'Local (browser)' },
  { id: 'Europe/London', name: 'London (GMT/BST)' },
  { id: 'Europe/Paris', name: 'Paris (CET/CEST)' },
  { id: 'Europe/Berlin', name: 'Berlin (CET/CEST)' },
  { id: 'Europe/Moscow', name: 'Moscow (MSK)' },
  { id: 'America/New_York', name: 'New York (EST/EDT)' },
  { id: 'America/Chicago', name: 'Chicago (CST/CDT)' },
  { id: 'America/Denver', name: 'Denver (MST/MDT)' },
  { id: 'America/Los_Angeles', name: 'Los Angeles (PST/PDT)' },
  { id: 'Asia/Tokyo', name: 'Tokyo (JST)' },
  { id: 'Asia/Shanghai', name: 'Shanghai (CST)' },
  { id: 'Asia/Dubai', name: 'Dubai (GST)' },
  { id: 'Australia/Sydney', name: 'Sydney (AEST/AEDT)' },
  { id: 'Pacific/Auckland', name: 'Auckland (NZST/NZDT)' },
  { id: 'UTC', name: 'UTC' },
];

export default function TimeModule({ config = {} }) {
  const {
    mode = 'broadcast',
    theme = '',
    timezone = '',
    label = '',
    callsign = '',
    grid = '',
    target = '',
    fullscreen = true,
    workMinutes,
    breakMinutes,
    background = '#000000',
    baseUrl = 'https://time.local-connect.uk',
  } = config;

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (theme) params.set('theme', theme);
    if (timezone) params.set('tz', timezone);
    if (label) params.set('name', label);
    if (callsign) params.set('call', callsign);
    if (grid) params.set('grid', grid);
    if (target) params.set('target', target);
    if (fullscreen) params.set('fs', '1');
    if (workMinutes) params.set('work', String(workMinutes));
    if (breakMinutes) params.set('break', String(breakMinutes));

    const qs = params.toString();
    return `${baseUrl}/${mode}${qs ? '?' + qs : ''}`;
  }, [mode, theme, timezone, label, callsign, grid, target, fullscreen, workMinutes, breakMinutes, baseUrl]);

  return (
    <div className="w-full h-full relative" style={{ background }}>
      <iframe
        src={url}
        className="w-full h-full border-0"
        style={{ display: 'block', overflow: 'hidden' }}
        title={label || `Time — ${mode}`}
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

// Export metadata for the layout editor to discover
TimeModule.MODES = MODES;
TimeModule.THEMES = THEMES;
TimeModule.TIMEZONES = COMMON_TIMEZONES;

// Config schema for auto-generating editor UI
TimeModule.CONFIG_SCHEMA = {
  mode: {
    type: 'select',
    label: 'Clock Mode',
    options: MODES.map(m => ({ value: m.id, label: `${m.name} — ${m.desc}` })),
    default: 'broadcast',
    group: 'appearance',
  },
  theme: {
    type: 'select',
    label: 'Color Theme',
    options: THEMES.map(t => ({ value: t.id, label: t.name })),
    default: '',
    group: 'appearance',
  },
  timezone: {
    type: 'select',
    label: 'Timezone',
    options: COMMON_TIMEZONES.map(t => ({ value: t.id, label: t.name })),
    default: '',
    group: 'time',
    allowCustom: true,
    customPlaceholder: 'Or enter IANA timezone...',
  },
  label: {
    type: 'text',
    label: 'Display Label',
    placeholder: 'e.g. Studio A, London, ON AIR',
    default: '',
    group: 'display',
  },
  callsign: {
    type: 'text',
    label: 'Callsign',
    placeholder: 'e.g. GM3ABC',
    default: '',
    group: 'ham',
    showWhen: { mode: ['shack', 'contest'] },
  },
  grid: {
    type: 'text',
    label: 'Grid Locator',
    placeholder: 'e.g. IO75su',
    default: '',
    group: 'ham',
    showWhen: { mode: ['shack', 'contest', 'propagation'] },
  },
  target: {
    type: 'datetime',
    label: 'Target Date/Time',
    default: '',
    group: 'countdown',
    showWhen: { mode: ['countdown'] },
  },
  workMinutes: {
    type: 'number',
    label: 'Work Period (minutes)',
    default: 25,
    min: 1,
    max: 120,
    group: 'pomodoro',
    showWhen: { mode: ['pomodoro'] },
  },
  breakMinutes: {
    type: 'number',
    label: 'Break Period (minutes)',
    default: 5,
    min: 1,
    max: 60,
    group: 'pomodoro',
    showWhen: { mode: ['pomodoro'] },
  },
  fullscreen: {
    type: 'toggle',
    label: 'Fullscreen Mode',
    default: true,
    group: 'display',
  },
  background: {
    type: 'color',
    label: 'Container Background',
    default: '#000000',
    group: 'display',
  },
};

TimeModule.CONFIG_GROUPS = [
  { id: 'appearance', label: '🎨 Appearance' },
  { id: 'time', label: '🕐 Time' },
  { id: 'display', label: '📺 Display' },
  { id: 'ham', label: '📡 Ham Radio' },
  { id: 'countdown', label: '⏱ Countdown' },
  { id: 'pomodoro', label: '🍅 Pomodoro' },
];
