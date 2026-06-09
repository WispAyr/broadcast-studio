# Audio & Playout

Broadcast Studio plays music beds and fires audio/video **stings** (jingles,
SFX, sweepers, bumpers) over the screens, with automatic ducking and smooth
fades. This doc covers how it works and the one piece of setup that lives
*outside* the app (the kiosk autoplay flag).

## Concepts

- **Audio output screen** — a screen flagged as a PA feed. Only these screens
  emit sound. Set it one of two ways:
  - `?audio=1` on the screen URL (e.g. `/screen/<id>?audio=1`) — handy for a
    laptop playout.
  - `"audioOutput": true` in the screen's `config` JSON (Screens → edit).
  - Everything else is a **muted video wall**: a *video* sting still shows its
    visual there, but with no sound; an audio-only sting is silent.

- **Bed** — a looping music track. Two ways to run one:
  - **AudioModule** (`audio` module) placed in a layout — the permanent bed for
    a playout screen. Configurable live (src / play / volume / loop) from the
    Live Mode module panel.
  - **Soundboard → Music Bed** — load any audio cart as the bed on the fly.

- **Sting** — a one-shot cart fired over air. Ducks the bed while it plays and
  clears itself when the media ends (with a safety timeout). Video stings cover
  the screen (or set `position: 'corner'`); audio stings are sound-only.

## Operator flow (Live Mode)

1. Upload audio/video in **Media** (mp3/wav/ogg/m4a/aac/flac, mp4/webm/mov).
2. Open the **🎚️ Soundboard** panel (toolbar toggle).
3. Pick a **Target**: all screens (studio), or one screen.
4. **Click a cart** to fire a sting. **Double-click an audio cart** to load it
   as the bed. Drag the bed volume; **Stop** / **STOP** to clear.

## ⚠️ Kiosk autoplay (required for sound on locked-down displays)

Browsers block autoplay-with-sound without a user gesture. On a normal browser
the first click/keypress unlocks audio automatically (handled in-app). But a
kiosk display never gets a gesture, so the Chromium/Electron kiosk that drives
an **audio output** screen must launch with:

```
--autoplay-policy=no-user-gesture-required
```

Add this to the kiosk launch flags on whichever machine feeds the PA (the
display-node supervisor / Electron args / `chromium-browser` command). Muted
video walls don't need it. Also make sure that machine actually has a working
audio output device routed to the PA / mixing desk.

## How it fits together (for devs)

- `client/src/lib/audioBus.js` — window-event coordinator. Stings call
  `duck()` / `unduck()`; beds subscribe via `onDuck()` and ramp their volume.
  `autoPlay()` + `installUnlockListener()` handle the gesture-unlock fallback.
- `client/src/pages/screen/ScreenDisplay.jsx` — `StingOverlay` / `BedOverlay`
  render inside the existing overlay layer, driven by `push_overlay` /
  `remove_overlay` WS events (`type: 'sting' | 'bed'`). `audioOutput` gates sound.
- `client/src/modules/AudioModule.jsx` — layout bed; same duck bus.
- `client/src/pages/control/components/SoundboardPanel.jsx` — the cart wall.
