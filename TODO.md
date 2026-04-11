# TODO — known bugs

## 🐛 Screens page layout dropdown doesn't work

**Symptom:** On `/control/screens`, changing a screen's layout via the per-row
dropdown appears to succeed but:
- The connected screen keeps showing the old layout.
- Selecting "No Layout" has no effect at all.
- On next page load the dropdown sometimes shows a different value than what
  the screen is actually rendering (DB and UI diverge).

**Root causes — both in `server/src/routes/screens.js` `PUT /:id`:**

### Bug 1 — "No Layout" can't clear the assignment
```js
// routes/screens.js ~line 110
name || null, screen_number || null, current_layout_id || null,
```
The client sends `current_layout_id: ""` when the user picks the `<option value="">No Layout</option>`.
`"" || null` → `null`, which the SQL then passes to:
```sql
current_layout_id = COALESCE(?, current_layout_id)
```
`COALESCE(NULL, current_layout_id)` → keeps the existing value. So the layout
is never cleared from this endpoint.

**Fix:** Distinguish "not provided" from "explicitly empty". Handle
`current_layout_id` with its own branch (like `group_id` already does a few
lines below), and pass an empty string / explicit `NULL` through so the
`COALESCE` is bypassed when the caller wants to clear the field. Roughly:

```js
const clearingLayout = current_layout_id === '' || current_layout_id === null;
// then either build the SET clause conditionally, or use a sentinel that
// bypasses COALESCE.
```

### Bug 2 — No `set_layout` WebSocket emit
The `PUT /:id` handler only emits `update_display_profile` (display config).
It never emits `set_layout`, so the connected screen never receives the new
layout and keeps rendering whatever it last got. Compare with
`POST /:id/layout` (~line 163) which does it correctly:

```js
const parsedLayout = { ...layout, modules: JSON.parse(layout.modules) };
getIO().to(`screen:${req.params.id}`).emit('set_layout', {
  layoutId: layout_id,
  layout: parsedLayout
});
// plus the screen_preview broadcast to studio dashboards
```

**Fix:** In `PUT /:id`, when `current_layout_id` is actually changing, fetch
the new layout, parse its modules, emit `set_layout` to `screen:<id>`, and
emit `screen_preview` to `studio:<studio_id>` — mirroring `POST /:id/layout`.

### Easier alternative
Make the Screens page dropdown call `POST /api/screens/:id/layout` instead of
`PUT /api/screens/:id`. That endpoint already handles the socket emits and
broadcasts correctly. It can't clear the layout (guards on `layout_id`
required), so "No Layout" would need either a small tweak there or a
separate DELETE-style endpoint.

**Client code to change:**
`client/src/pages/control/Screens.jsx` → `handleSetLayout()` (around line
396-400) currently does:
```js
await api.put(`/screens/${screenId}`, { current_layout_id: layoutId || null });
```

---

## Context on the divergence
After this was diagnosed (2026-04-10), the DB had:
- Screen 1 / Screen 2 (Now Ayrshire Radio) → `current_layout_id = Stats Dashboard`
- But the dropdown in `/control/screens` was showing `Colours x Retrospect - Screen 1/2`

That's consistent with the dropdown letting the user pick a value the save
silently dropped (either because of Bug 1 when clearing/reassigning or
because the screen never received the new layout via Bug 2 and the UI got
reloaded from an older cached state).
