# TODO — known bugs

## ✅ Screens page layout dropdown (fixed 2026-07-14)

**Was:** Screens dropdown used `PUT` without `set_layout` WS emit; "No Layout"
could not clear via `COALESCE`.

**Fixed:**
- Server `PUT /screens/:id` handles explicit clear of `current_layout_id` and
  emits `set_layout` / `screen_preview` when layout changes.
- Client `Screens.jsx` `handleSetLayout` uses `POST .../layout` to push and
  `PUT` with `current_layout_id: ''` to clear.

---

## Remaining / follow-ups
- Transition type/duration still UI-only on Live desk (hard cut until API exists).
- Workspace presets still localStorage-only (multi-seat share not yet server-backed).
