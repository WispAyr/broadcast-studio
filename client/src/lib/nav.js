// The navigation, in ONE place.
//
// The sidebar and the ⌘K command palette both read this. They used to keep separate
// hardcoded lists, so the palette silently omitted the newest pages (Playout, Rundown,
// Clocks) — an operator hitting ⌘K for the page they most needed got nothing. One
// source means the palette can never drift from the nav again.
//
// Grouped by the JOB the operator is doing, not by noun, and ordered by how close each
// group is to air. 27 flat peers became six task groups plus a tenant packs group, so
// the four or five pages used on air aren't buried in a linear scan.

export const NAV_GROUPS = [
  {
    title: 'On Air', // the live surfaces — top of the list because this is where a fault is
    items: [
      { path: 'playout', label: 'Playout', icon: 'media' },   // clip/log playout to screens + channels
      { path: 'gallery', label: 'Channel', icon: 'film' },    // the storm → YouTube broadcast channel
      { path: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { path: 'console', label: 'Console', icon: 'console' },
    ],
  },
  {
    title: 'Run', // running a show live
    items: [
      { path: 'rundown', label: 'Rundown', icon: 'autocue' },
      { path: 'clocks', label: 'Clocks', icon: 'clock' },
      { path: 'autocue', label: 'Autocue', icon: 'autocue' },
      { path: 'timeline', label: 'Timeline', icon: 'clock' },
      { path: 'schedule', label: 'Schedule', icon: 'clock' },
      { path: 'shows', label: 'Shows', icon: 'film' },
    ],
  },
  {
    title: 'Media', // clips, music, graphics
    items: [
      // Media (the raw /api/uploads file browser) was RETIRED 2026-07-15: usage data
      // showed it near-dead (~6 hits) next to Library's live playout store (~35+).
      // /control/media now redirects to /control/library.
      { path: 'library', label: 'Library', icon: 'media' },
      { path: 'music', label: 'Music', icon: 'media' },
      { path: 'content', label: 'Content', icon: 'media' },
    ],
  },
  {
    title: 'Screens', // physical output devices
    items: [
      { path: 'screens', label: 'Screens', icon: 'monitor' },
      { path: 'displays', label: 'Kiosks', icon: 'monitor' }, // relabelled from "Displays" — it's the office kiosks, a different device population
      { path: 'cutaway', label: 'Cutaway', icon: 'monitor' }, // outside triggers that briefly take a screen; the arm/disarm lives here
      { path: 'scenes', label: 'Scenes', icon: 'layout' },
      { path: 'deck', label: 'Deck', icon: 'grid' },
    ],
  },
  {
    title: 'Design', // build the looks
    items: [
      { path: 'layouts', label: 'Layouts', icon: 'layout' },
      { path: 'templates', label: 'Templates', icon: 'templates' },
      { path: 'shaders', label: 'Shader Studio', icon: 'shader' },
      { path: 'workgroups', label: 'Workgroups', icon: 'console' },
    ],
  },
  {
    title: 'System',
    items: [
      { path: 'variables', label: 'Variables', icon: 'variables' },
      { path: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
  {
    title: 'Packs',
    // Customer/event-specific surfaces. Grouped and pushed to the bottom so they stop
    // interleaving with the daily pages. TODO: gate per-tenant once getMe() returns
    // studio.enabledModules — a Pavilion operator has no business seeing Kiltwalk Ops.
    pack: true,
    items: [
      { path: 'egpk', label: 'EGPK Live', icon: 'plane' },
      { path: 'kiltwalk', label: 'Kiltwalk Ops', icon: 'plane' },
      { path: 'studio', label: 'NAR Studio', icon: 'clock' },
    ],
  },
];

// The flat list, derived — never hand-maintained. The palette and anything else that
// needs "every page" reads this, so adding a page in NAV_GROUPS makes it reachable
// everywhere at once.
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
