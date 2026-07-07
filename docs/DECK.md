# Deck — screen-control surface

A **Deck** is a grid of buttons an operator builds to control a studio's screens —
take a layout, apply a scene, blackout, reload — aimed at one screen, a group, or
all of them. The same deck drives the operator page and a full-screen touch panel.

- **Designer:** `/control/deck`
- **Touch surface:** `/deck/:id` (a staff tablet or on-wall panel)

Deck buttons are stored as `console_buttons` rows tagged with a `deck_id`, so they
fire through the exact same dispatch as the classic console and Stream Deck — a
button only ever changes a screen **when someone presses it**.

## Quick start

Seed a ready-made deck (one Take button per layout, plus Blackout + Reload):

```bash
node server/seed-deck.js ["studio slug or name"]   # defaults to the studio with the most layouts
```

Then open `/control/deck`, pick the deck, and hit **Live**. Or bookmark
`/deck/<deck-id>` on a tablet (printed by the seed script).

## Building a deck

1. **New** → name it. Set the grid size (default 6 × 4).
2. **Click an empty cell** (or drag a Library preset) to drop a button. Drag a
   button between cells to move it; the inspector edits everything.
3. **Inspector**
   - **Look** — label, icon (emoji), colour.
   - **Action** — see below.
   - **Target** — All screens · a specific screen · a screen group.
   - **Placement** — x / y / w / h.
   - **Shortcut** — a key (`F1`, `1`, `q`…) that fires the button in Live.

## Actions

| Action | Does |
|---|---|
| `Take Layout` | Puts a layout on the target screen(s) |
| `Apply Scene` | Applies a saved multi-screen scene |
| `Blackout` | Blacks out the target |
| `Reload Screens` | Force-reloads the screens |
| `Clear Overlays` | Clears studio overlays |

## Modes — a button can hold state

Set **Mode** in the inspector:

- **Momentary** (default) — fires once per press.
- **Toggle** — two states with their own action/colour/label. Each press flips
  OFF ⇄ ON; the tile shows the current state. (e.g. OFF = default layout,
  ON = a "LIVE" layout.)
- **Multi-state** — cycles N states, each with its own action. Tile shows `N/M`.

State is stored server-side and pushed to every surface, so the operator page,
the touch panel and a Stream Deck all show the same lit state.

## Sequences — one press, several actions

On a momentary button, **"+ Run several actions in sequence"** turns it into an
ordered list. Each step has its own action, target and a **delay before** it (ms).
Great for an intro: *take a slate → 2 s later take the wide → super a lower-third.*

## Live mode

Flip **Edit ↔ Live**. In Live:

- Tap a button (or press its shortcut) to fire it.
- A `Take Layout` button lights **green (● LIVE)** when its layout is actually on
  its target — driven live off the screens.
- **Guarded** buttons (Confirm) ask before firing.
- The **Program** panel shows what's on each screen.

## Touch surface — `/deck/:id`

The same deck rendered full-screen for a tablet or on-wall panel: big tiles, tap
to fire, live tally, guarded buttons arm-then-fire (tap once to arm, again to
confirm), first tap goes fullscreen.

Needs an operator/staff session on the device (open it once from the control app,
then bookmark). A `DRAFT` watermark shows on unpublished decks.

## Draft → Published

A deck is a **Draft** while you build it. **Publish** when it's ready. (The touch
surface watermarks drafts so you don't run a half-built deck by accident.)

## Safety

Firing changes live screens — that's the point. On a **live venue**, that's the
operator's job at showtime: build and publish the deck ahead of time, then hand
the operator the deck. Don't fire at production walls from a config session.
