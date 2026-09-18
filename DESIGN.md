# Broadcast Studio — DESIGN

The operator-interface design system. Evaluated 2026-07-14 (5-lens workgroup, adversarially
verified — 18 findings survived, 31 refuted — + a hard-numbers evidence pass). Nielsen 22/40.

## The diagnosis (root cause, not symptoms)
**"On air" is not a first-class, app-wide concept.** It is re-invented per page — rose in Playout,
emerald in DeckDesigner, red in ClockTally, a screen-layout string in AppStatusBar. Everything else
(three colour vocabularies, 27 flat nav items, a status bar that only knows about the venue wall,
silent failed takes) grows from that one absent spine: nobody owns the truth of what is live, so
nothing can reliably display or protect it.

## The colour law (highest-leverage rule)
Enforced by ONE rule a developer cannot get wrong:
**If it stays on screen and it is red, it is on air. If it is red and not on air, it is a bug.**
(Momentary danger — a delete button, an error toast — may keep red: transient, contextual, never
competes with the tally glance. The ban is on *persistent* red that isn't a live surface.)

| Colour | Token | MEANS | NEVER for |
|---|---|---|---|
| RED `#ef4444` + `animate-pulse` | `bs-air` | ON AIR / transmitting / program. Only persistent red. | Mode toggles, offline dots, idle nav, selection. A pulsing-red mode toggle is banned. |
| AMBER `#f59e0b` | `bs-warn` | attention / warning / held / stale / expired / reconnecting / offline | success, ready, on-air. Retire `yellow-*`/`orange-*` into this. |
| GREEN `#10b981` | `bs-cued` | preview / cued / ready / ok / connected / now-playing-in-a-picker | any live-to-air state. Green Save is banned. |
| BLUE `#3b82f6` | `bs-accent` | primary action / selection / editing | status of any kind. Never "healthy", "live", "warning". |
| NEUTRAL greys | `bs-bg/panel/subpanel/border/muted/text` | all structure, idle, disabled, muted metadata | any status meaning. |

Delete: purple/violet/indigo/cyan/pink/sky/rose have no meaning — remove.
Re-point rose→red (air) and sky→green (cued) on Playout/Rundown/Gallery. Green Save → blue.
**Do NOT run a 2,800-usage gray-*→bs-* codemod** — invisible churn, real regression risk on a live
tool. Fill the tokens; adopt only where already editing a file. (Measured: bs-* adoption = 0%.)

## The on-air spine
One persistent bar on EVERY page (drop `hidden lg:flex`), THREE labelled indicators, each its own
red-when-live dot: **WALL** (venue screens) · **STREAM** (YouTube + viewers) · **CHANNEL** (playout).
Never a global grey "OFF AIR" while any one subsystem broadcasts. Event-driven + 60s poll safety net.
Panic control = BLACKOUT of the **venue wall only** (never a reflex all-stop — killing the public
YouTube stream drops every viewer and is the worse incident).
Blackout correctness: add `is_blackout` flag + per-screen `pre_blackout_layout_id`; restore the
captured layouts exactly (today it string-matches a name and restores an arbitrary layout).

## The guard ladder (friction ∝ irreversibility × blast radius, NOT how scary the word is)
0. **Fires instantly** — reversible, self-correcting: TAKE (gated on ready), Playout STOP, layout push,
   apply scene, apply preset. Correct as-is; do NOT add confirms.
1. **Fires with loud failure** — any live push that can 4xx: LiveMode take, Dashboard push. No native
   `alert()` anywhere (it freezes the clock + on-air bar + sockets mid-show).
2. **Confirm dialog, default focus on Cancel** for danger: delete, studio-wide sync, Console "Test".
3. **Arm-then-fire** — irreversible public: STOP STREAM (YouTube kill) only. Already correct in Gallery.
4. **Type-to-confirm** — reserved for future bulk-destructive. Nothing needs it today.

## IA — 27 flat → 6 task groups (by JOB, not noun), customer packs tenant-gated
ON AIR (Playout·Dashboard·Console; Gallery merges into Playout) · RUN (Rundown·Clocks·Autocue·
Timeline·Schedule·Shows) · MEDIA (Media·Library·Music·Content) · SCREENS (Screens·Displays→"Kiosks"·
Scenes·Deck) · DESIGN (Layouts·Templates·Shaders·Workgroups) · SYSTEM (Variables·Settings).
EGPK/Kiltwalk/NAR Studio → studio packs, hidden for non-tenants (reuse the role-gate; add
`studio.enabledModules`). ⌘K palette stays the fast-path and must derive from `navItems` (today it
misses Playout/Rundown/Clocks — half the app is unreachable by ⌘K).

## Measured facts the redesign must answer (grok, read-only)
- **820KB eager entry, UNCOMPRESSED** — nginx `gzip_types` is commented out. ~3.6× free win, no code.
- gray-500 (318×) = 4.16:1, gray-600 (158×) = 2.66:1 on gray-950 — both FAIL WCAG AA body. Ban on dark.
- 71 onClick-on-div, 0 `focus-visible`, 127 `outline-none`, 0 `sr-only` — keyboard is not a real path.
- 205 red-* utilities in control chrome; 13 font-size steps; on-air label rendered at `text-[8px]`.
- API gravity (real access.log): channel/layouts/screens/playout/console HOT; timeline/templates/
  display-nodes/uploads COLD. **Media route ~6 hits vs Library warmer** — data says Media should die
  (disagrees with the workgroup's "keep both, relabel"; resolve on usage, not aesthetics).
