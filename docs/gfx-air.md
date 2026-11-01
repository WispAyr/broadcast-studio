# gfx-air: NAR intranet Graphics Studio → one screen

The NAR intranet's Graphics Studio (`/graphics-air.html`, its Air desk) takes a graphic to air on **one** Broadcast
Studio screen and clears it. An approver (Ewan or Matt) presses TAKE and CLEAR there, and every action is audited
in the intranet's DB. This side only relays those two actions to the screen.

**Off by default.** Unless `GFX_AIR_ENABLED=1`, every `/api/gfx-air/*` route answers 404.

## API (server/src/routes/gfx-air.js)
| | Body | Does |
|---|---|---|
| `POST /api/gfx-air/take` | `{screen, slot, take_id, url}` | `push_overlay {type:'gfx_air_<slot>', url, take_id}` to `screen:<id>` |
| `POST /api/gfx-air/clear` | `{screen, slot, take_id?}` | `remove_overlay gfx_air_<slot>`. The screen plays the graphic out and unmounts it after 650 ms |
| `GET /api/gfx-air/state` | | what this server has taken (memory only) |

Every call needs `x-gfx-air-key` equal to `GFX_AIR_KEY` (24 or more characters; one shared secret with the
intranet, never a user JWT or a console API key).

A take is refused when:
- the screen is not in `GFX_AIR_SCREENS` (comma-separated ids; studio-wide pushes are never possible);
- the url is not `GFX_AIR_ORIGIN/graphics-player-screen.html?r=…&k=…` (the intranet's signed air player; https,
  or http on loopback for dev);
- the screen is padlocked (`accepts_broadcasts = 0`, 423);
- no display is connected (409, so the intranet never records a take nobody saw);
- the slot already has a different take (409: clear first).

A clear always goes out, even after a BS restart, so the desk can always get a graphic off.

## Screen (client/src/pages/screen/ScreenDisplay.jsx)
`gfx_air_*` overlays are a full-frame transparent iframe (`GfxAirOverlay`). Once the iframe loads, the screen posts
`{gfx:'in'}` to it. The player holds blank until then, so a page load alone never plays the graphic. On
`remove_overlay` it posts `{gfx:'out'}` and unmounts after 650 ms. `clear_overlays` (panic) removes it instantly.

Nothing is persisted: a reloaded screen or a restarted server comes back with no gfx-air graphic. The intranet
desk then still shows it on air, and CLEAR squares it up.

## Enabling (needs Ewan and an agreed window; see the intranet's docs/graphics-studio.md go-live plan)
```
GFX_AIR_ENABLED=1
GFX_AIR_KEY=<secret-handoff, never in chat>
GFX_AIR_ORIGIN=https://intranet.wispayr.online
GFX_AIR_SCREENS=<screen id>[,<screen id>…]
```
To roll back, unset `GFX_AIR_ENABLED` and restart.
