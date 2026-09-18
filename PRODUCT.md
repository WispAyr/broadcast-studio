# Broadcast Studio — PRODUCT

## What it is
The operator control plane for WispAyr's live broadcast estate, at
`broadcast.studio.wispayr.online/control/*`. React + Vite + Tailwind, served static
by an Express app (pm2 `broadcast-studio`, small-server `/root/broadcast-studio`).
The server is canonical and hand-edited; the git checkout drifts. Deploy = build the
client on the server; restart only for server changes.

## Register
product. Design SERVES the task. The bar is a tool that disappears into the work —
Linear/Raycast/a broadcast gallery, not a marketing page. Density is a virtue.

## Who uses it
A broadcast operator. Expert, not a first-timer. Working in a dim room, under time
pressure, frequently mid-show. They are not exploring; they are trying to do one
specific thing fast and not put the wrong thing on air.

## What it does
- Pushes layouts/scenes/looks to venue + studio screens (browser kiosks).
- Runs a 24/7 TV channel (pu2 OBS → YouTube) via a director-override control plane.
- Video playout: a Log, dual-deck players, a cart wall, format clocks, as-run /
  proof-of-play. Two targets: browser screens and the OBS channel.
- Authoring: layouts, decks (cart surfaces), scenes, shaders, media library.
- Multi-tenant: Customer ▸ Site ▸ Studio, with Content Fabric collections/grants.

## Design context (the law, not preference)
- **red = ON AIR, and nothing else may use red.** The single load-bearing signal.
- Every guard must be proportional to blast radius: instant for cheap/reversible,
  arm-then-fire for on-air, name-to-confirm for destructive — and NEVER a confirm on
  the panic path (fast in an emergency is the whole point).
- Applying anything to a live venue screen stays operator-only (no autopilot to public).
- Colour-only signalling needs a text/shape backup (dim room, colour-blind operators).

## Known debt (2026-07-14, feeding the redesign)
- 27 flat nav items, no grouping.
- Three colour vocabularies coexist (raw gray-*, semantic bs-* tokens, and newer
  neutral-*/rose/sky/amber). The token system is defined and half-adopted.
- Probable duplicate pages: media vs library, console vs deck, timeline vs schedule
  vs clocks, screens vs displays. Customer-specific pages (kiltwalk/egpk/studio) sit
  in the global nav for everyone.
