# Broadcast Studio — SpaceWall (Spatial Video Walls)

**Status:** Design / queued (do not implement during a live-event freeze)
**Author:** drafted 2026-06-05
**Scope:** Adds two capabilities broadcast-studio does not have today — a *spatial canvas* of physical screens, and *spanning one source across multiple physical screens*. Everything else SpaceWall-like (per-screen content, cloned content, grid-in-a-screen) already exists via `layouts` + `screen_scenes` and is **not** re-built here.

---

## 1. Why

Today every physical screen is an island: each registers via `register_screen`, gets a `layout` assigned (directly or via a `screen_scene`), and renders that layout independently. There is no model of **where screens sit in physical space**, and no way to make **one source fill a wall built from several panels** (each panel on its own player/browser).

A "video wall" in the real sense = N physical panels showing slices of one picture. That requires each panel to know its rectangle within a shared canvas and render only its viewport into the source. That is the gap this spec fills.

What we already have and explicitly reuse:
- `layouts` (grid_cols/grid_rows + modules `{type,x,y,w,h,config}`) — grid **inside** a single screen.
- `screen_scenes` + `POST /api/scenes/:id/apply` — named snapshot of per-screen layout assignments, atomic push. SpaceWall's "cloned / per-screen content" is this.
- Socket.IO `register_screen` / `set_layout` / `update_module_config` plumbing.
- go2rtc WebRTC source delivery (`https://live.wispayr.online/go2rtc`), already feeding `ingest-feed` / `go2rtc` modules.

## 2. Concepts

- **Wall** — a named virtual canvas (e.g. 3840×2160 wall-units) belonging to a studio. Holds a set of **screen placements** and zero or more **wall sources**.
- **Placement** — a physical screen positioned on the canvas: `{screen_id, x, y, w, h, rotation}` in wall-units. Mirrors how the panels are physically hung (irregular, mixed-size, tilted are all allowed).
- **Wall source** — a single content source (go2rtc stream, URL/iframe, dashboard, image) with its own bounding rect on the same canvas. The source is rendered *as one image across the whole wall*; each panel shows the slice that falls within its placement.
- **Render mode per source**: `span` (slice across panels — the new behaviour), `clone` (every panel shows the whole source), or `per-screen` (defer to that screen's normal layout — i.e. the screen opts out of the wall).

The wall-unit coordinate space is arbitrary and unitless; only ratios matter. Convention: use the wall's intended pixel resolution so placements read naturally.

## 3. Data Model (additions only)

```sql
-- A spatial canvas of physical screens for one studio.
CREATE TABLE walls (
  id          TEXT PRIMARY KEY,
  studio_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  canvas_w    INTEGER NOT NULL DEFAULT 3840,   -- wall-units
  canvas_h    INTEGER NOT NULL DEFAULT 2160,
  background  TEXT NOT NULL DEFAULT '#000000',
  placements  TEXT NOT NULL DEFAULT '[]',       -- JSON [{screen_id,x,y,w,h,rotation}]
  sources     TEXT NOT NULL DEFAULT '[]',       -- JSON [WallSource] (see below)
  public_safe INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (studio_id) REFERENCES studios(id)
);
```

`placements` JSON element:
```jsonc
{ "screen_id": "uuid", "x": 0, "y": 0, "w": 1920, "h": 1080, "rotation": 0 }
```

`sources` JSON element (`WallSource`):
```jsonc
{
  "id": "src1",
  "kind": "go2rtc" | "iframe" | "image" | "dashboard",
  "mode": "span" | "clone",        // per-screen = screen simply absent from this wall
  "rect": { "x": 0, "y": 0, "w": 3840, "h": 2160 },  // bounding box on the canvas (span mode)
  "z": 0,
  "config": {                        // kind-specific, mirrors existing module configs
    "stream": "drone-1",            // go2rtc
    "go2rtc_host": "https://live.wispayr.online/go2rtc",
    "url": "https://…",             // iframe/dashboard
    "src": "https://…",             // image
    "muted": true
  }
}
```

No change to `screens` — placements reference `screens.id`. A screen may appear in at most one wall placement at a time (enforced in the route, not the schema).

## 4. The spanning math (client render)

Each physical screen browser already loads `/screen/:id` and knows its own `screen_id`. When that screen is part of an active wall:

1. Look up its placement `P = {x,y,w,h,rotation}` and the wall's active `WallSource S` with `mode:"span"` and rect `R = {x,y,w,h}`.
2. The panel must show the region of `S` that geometrically falls inside `P`. Render the source element at the **full wall-source size** inside an `overflow:hidden` viewport sized to the panel, then translate/scale so the correct slice is visible:

```
scaleX = P.w / R.w * (R covers canvas → use canvas ratios)   // see helper below
```

Concretely, for a panel of on-device pixel size `(pxW, pxH)` rendering source `S` whose rect on the canvas is `R`, and panel placement `P`:

```js
// fraction of the source visible on this panel:
const k = pxW / P.w;                 // wall-units → device px for this panel
const srcDevW = R.w * k;             // source rendered width in device px
const srcDevH = R.h * k;
const offsetX = (P.x - R.x) * k;     // how far the source is shifted left of this panel
const offsetY = (P.y - R.y) * k;
// element styles:
//   width: srcDevW; height: srcDevH;
//   transform: translate(-offsetX, -offsetY) rotate(-P.rotation around panel center if tilted)
//   parent: overflow:hidden, width:pxW, height:pxH
```

For `clone` mode the panel just renders the source full-bleed (existing behaviour). Rotation is applied as a CSS `rotate()` on the viewport when the panel is physically tilted.

This is **pure client-side compositing** — the same approach already noted for CallGrid ("grid composited client-side"). No server-side mosaic, no Docker, no GPU mixer.

## 5. Sync

- Every panel subscribes to the **same** go2rtc stream over WebRTC; frames land within a few ms of each other. Adequate for fanzone / finish-line / signage walls.
- True genlock is not achievable in software and is out of scope. If a future wall needs frame-perfect sync, that is a hardware-decoder problem, not this feature.
- Layout/source changes are pushed over the existing socket (`wall_update`, below) so all panels switch on the same tick.

## 6. API Routes (additions)

```
GET    /api/walls                 List walls for studio
POST   /api/walls                 Create wall
GET    /api/walls/:id             Get wall (placements + sources)
PUT    /api/walls/:id             Update wall (geometry/sources) → pushes wall_update to member screens
DELETE /api/walls/:id
POST   /api/walls/:id/activate    Make this wall live on its member screens (sets each screen into wall mode)
POST   /api/walls/:id/deactivate  Return member screens to their normal layout
GET    /api/walls/:id/preview     Server-rendered thumbnail spec (geometry + source list) for the designer
```

All behind `authenticate` + studio scoping, identical to `layouts`/`scenes`. `public_safe` honoured on activate exactly like scenes.

## 7. WebSocket Events (additions)

Client → Server:
- (reuse) `register_screen` — screen announces `screen_id`; server replies with wall placement if the screen is a member of an active wall.

Server → Screen:
- `enter_wall` `{ wall_id, placement, sources, canvas_w, canvas_h }` — screen switches into wall-render mode.
- `wall_update` `{ sources, placement }` — live geometry/source change while in wall mode.
- `exit_wall` `{}` — screen returns to its normal `set_layout` path.

Server → Control:
- `wall_state` `{ wall_id, members: [{screen_id, online}] }` — designer live status.

## 8. Frontend

### Designer — `/control/walls`
- Canvas editor (same dark theme). Drag screen rectangles onto the canvas; resize; set rotation; snap-to-edge and snap-to-sibling guides.
- Palette of the studio's registered screens (online state badge) to drop onto the canvas.
- Drop a **wall source** (pick from go2rtc streams / URL / image / dashboard), draw/aim its rect, choose `span` or `clone`.
- Live mini-preview: each placement shows a thumbnail of its computed slice.
- Save → `walls` row. "Activate" → `POST /activate`.
- Reuses the source-picker and module-config components from the existing layout editor.

### Screen — `/screen/:id` (extend, do not fork)
- On `enter_wall`, mount a `WallViewport` that implements §4. On `exit_wall`, fall back to the normal `ModuleRenderer` layout path.
- `WallViewport` wraps the same `Go2rtcFeed`/`IngestFeed`/iframe renderers already in `client/src/modules/`, sized/translated per the spanning math, inside `ErrorBoundary` (consistent with existing screen rendering).

## 9. Relationship to the (separate) grid wall-designer

There are two designer surfaces and they share the canvas UI but model different things:
- **Layout designer** (separate task): grid **inside one screen** — writes `layouts.modules`.
- **SpaceWall designer** (this doc): sources **across many screens** — writes `walls`.
A screen can be driven by a normal layout *or* be a member of an active wall, never both at once (`enter_wall` supersedes `set_layout`; `exit_wall` restores it).

## 10. Build phases

1. **Schema + CRUD** — `walls` table, routes, studio scoping, tests (mirror `scenes.js`). No UI.
2. **Screen render path** — `enter_wall`/`wall_update`/`exit_wall` events + `WallViewport` spanning math; validate with two browser windows faking two placements of one go2rtc stream.
3. **Designer UI** — `/control/walls` canvas editor + source picker + activate bar.
4. **Polish** — rotation, snap guides, per-placement live thumbnails, `public_safe` enforcement on activate.

Phases 1–2 deliver the actual capability (a real wall works headless via API); 3–4 make it operable.

## 11. Explicit non-goals

- No server-side video mosaic / compositor (client-side CSS transform only).
- No frame-perfect genlock.
- No new infra, no Docker, no protocol beyond the existing Socket.IO + go2rtc.
- Not rebuilding cloned/per-screen/grid content — those are `screen_scenes` + `layouts` and stay as-is.

## 12. Where it pays off

Spanning only earns its keep when **one logical wall is several physical panels on several players**. The current "Kiltwalk LED (Bravo)" is a single screen on a single Mac — spanning adds nothing there *yet*. It becomes valuable for a true multi-panel LED wall or a fanzone built from several independently-driven TVs — the same Pi-media-node direction as the Showrunner van system.
