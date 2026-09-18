# Web sources — an arbitrary web page as a broadcast source

`go2rtc` takes a URL. It cannot click a page. This is the missing link between
"a web page with video on it" and a first-class source that a screen can play.

Technique borrowed from [castor](https://github.com/stupside/castor) (Go, MIT):
drive a headless Chrome over CDP, watch every request the page makes, and run an
escalating action pipeline until a manifest appears in the network log.

Operator UI: **Control ▸ Build ▸ Web Sources** (`/control/web-sources`).

## Topology

```
page URL ─▶ extractor (headless Chrome + CDP)
              │  autoplay → video.play() → click → largest iframe → play button
              ▼
         manifest URL (+ the headers needed to replay it)
              │  replay probe: can something that is NOT the browser fetch this?
              │
     ┌────────┴─────────┐
  direct            headers-required
     │                  │
     │            relay.ts (ffmpeg -headers, piped as MPEG-TS by this server)
     │                  │
     └────────┬─────────┘
              ▼
    go2rtc PUT /api/streams?name=web-<key>&src=ffmpeg:<url>
              ▼
    `go2rtc_feed` module on any screen — no new delivery path
```

Screens only ever see a go2rtc stream **name**.

## Why it is built this way

- **Resolve is never on the air path.** An operator resolves when they add a
  source; the refresher resolves on a timer. A scraper heuristic is not allowed
  to black out a wall mid-show.
- **The public `GET` is a safe projection.** Resolved URLs carry session tokens
  and relay tokens are credentials; neither is exposed.
- **Staleness comes from the resolver's clock**, not from "nothing has
  complained lately" — cf. the heartbeat rule.
- **DRM is refused, not worked around.** Off-air TV stays on the HDHomeRun
  (see [TUNER.md](TUNER.md)).

## API

All operator routes need a JWT. `GET /` is public because screens are.

| Route | Auth | What |
|---|---|---|
| `GET /api/web-sources` | — | safe projection: key, label, stream name, status, stale |
| `GET /api/web-sources/full` | ✔ | as above **plus** resolved URLs (never relay tokens) |
| `GET /api/web-sources/health` | ✔ | relay, extractor, refresher, live relays, per-source state |
| `POST /api/web-sources` | ✔ | define `{key, label, pageUrl, consent, autoRefresh}` |
| `PATCH /api/web-sources/:key` | ✔ | edit label / consent / autoRefresh / pageUrl |
| `POST /api/web-sources/probe` | ✔ | one-shot extraction, saves nothing — "try this page" |
| `POST /api/web-sources/:key/resolve` | ✔ | extract → probe → register |
| `POST /api/web-sources/refresh` | ✔ | run a refresher pass now |
| `DELETE /api/web-sources/:key` | ✔ | remove, stop any relay, deregister |
| `PUT /api/web-sources/host` | ✔ | point at a different go2rtc relay |
| `GET /api/web-sources/:key/relay.ts` | token | the relay stream itself (go2rtc pulls this) |

Registry is file-backed at `server/data/web-sources.json`, written
write-then-rename so a crash cannot tear it.

Point a `go2rtc_feed` module at `{ host: <relay>, stream: "web-<key>" }`.
Re-resolving updates the relay **in place** — the stream name never changes, so
layouts are never touched.

## Failure modes it reports (rather than hiding)

| `reason` | Meaning |
|---|---|
| `drm` | Widevine/PlayReady/FairPlay detected. Refused, with evidence. |
| `consent-wall` | A cookie banner blocked playback and we did not (or could not) decline it. |
| `no-stream-found` | No manifest appeared. **Check `embeds`** — see below. |
| `unplayable` | Manifest found but will not fetch outside the browser session. |
| `relay-unconfigured` | Needs headers, but `WEB_SOURCE_RELAY_BASE` is not set. |
| `extractor-unreachable` | The shared extraction service did not answer. |

### Embedded players — read this first when a page "has no video"

**Most pages do not host their own player.** On failure the extractor returns
`embeds`: the third-party iframes it saw, largest first. Pointing it at the
embed URL is usually the answer, and the UI gives you a one-click **Probe this**
for each.

Worked example — Troon Yacht Haven. The webcams page yields nothing, because the
cams are `ipcamlive` iframes. Both embeds resolve instantly when targeted
directly, on *different* shard hosts with opaque stream ids you could not guess:

```
https://g0.ipcamlive.com/player/player.php?alias=tyhmarina2  →  s104…/stream.m3u8
https://g0.ipcamlive.com/player/player.php?alias=tyhfuel     →  s124…/stream.m3u8
```

⚠ Those embed URLs carry **`autoplay=0`** (the host page wants a poster frame).
Navigated to directly that parks the player forever and no manifest is ever
requested. The extractor normalises `autoplay=0|false|no|off → 1` and forces
`mute=1`, reporting `autoplay-normalised` in `steps` and the real URL in
`navigatedUrl`. It never changes *which* page is fetched.

### Consent walls

Default is `consent: "off"` — we do **not** click consent banners on the
operator's behalf unless asked. With `consent: "reject"` the extractor presses
only the decline control (`Reject all`, `I Do Not Accept Cookies`, `Necessary
only`…) and never an accept button; an explicit accept-all guard stops a
loosely-worded decline pattern landing on the wrong control.

Note that declining **correctly leaves third-party embeds blocked** on sites
that gate them behind consent (CMAL's harbour cams are Twitch embeds behind
Complianz, for example). That is the banner working, not a bug.

## The relay (`headers-required`)

go2rtc **refuses any source containing a space** (`source with spaces may be
insecure`, HTTP 400), so ffmpeg `-headers` cannot be injected through its API.
Instead this server pipes the stream itself:

```
go2rtc ──GET──▶ /api/web-sources/:key/relay.ts?t=<token> ──ffmpeg -headers──▶ origin
```

- ffmpeg's lifetime **is** the HTTP response's: when go2rtc disconnects the
  process is killed. No supervisor, no respawn storm, nothing to leak.
- The endpoint is **not** JWT-protected — go2rtc cannot hold an operator token.
  It is gated by a per-source random token compared in constant time, which no
  read route ever exposes.
- Header values come from a scraped page, so CR/LF is stripped from them before
  they reach ffmpeg — otherwise a hostile origin could inject extra headers.
- ⚠ **Topology cost:** the media takes an extra hop through whichever box runs
  BS. For a venue relay on another site that is a WAN round trip each way. This
  is the fallback for the minority, not the default.

Set `WEB_SOURCE_RELAY_BASE` to a URL the relay can reach this server on.
Concurrency is capped by `WEB_SOURCE_MAX_RELAYS` (default 4).

## Never dark — snapshot fallback

A wall that goes black is worse than a wall showing the harbour as it looked
ninety seconds ago. The refresher grabs a still from go2rtc's own
`/api/frame.jpeg` **while each stream is healthy** (no second decode pipeline),
and the player shows that still when the feed drops.

🚨 **`/api/frame.jpeg` is version-dependent.** go2rtc **1.9.2** — which is what
runs on small-server, load-bearing for `van-spectrum` and its ONVIF shim —
answers **200 with a zero-byte body** for every stream. A status-code check
passes and you still have nothing. The capture therefore validates the *bytes*
are a JPEG, and falls back to taking the frame with **ffmpeg straight from the
origin URL**, which works on any relay version. Verified on production: 72 KB
captured via the ffmpeg path. `capture()` reports which path it used as `via`.

`GET /api/web-sources/:key/snapshot.jpg` — public, because screens are. Always
carries `X-Snapshot-Age-Ms`. Stills older than `WEB_SOURCE_SNAPSHOT_MAX_AGE_MS`
(24h) are not served at all: better to admit we have nothing than to put last
week's weather on a wall.

`Go2rtcFeedModule` picks this up with **zero config** — a stream named
`web-<key>` resolves its still automatically. Disable per instance with
`fallback: false`, or point elsewhere with `fallbackKey`.

### 🚨 The honesty rule

A frozen frame that looks live is worse than a black screen, because an
operator will believe it. So:

- the still is **always** badged `LAST FRAME · <age>`, in amber, and the age
  rounds **down** so it never overstates freshness;
- the live dot goes **amber** whenever the feed is down — red means live and
  nothing else;
- with no still to show, the badge reads `No signal` rather than nothing;
- the badge survives `showLabel: false` as a corner chip. A bare unmarked still
  is the one thing this feature must never produce.

### Stall detection, not just errors

**A dead feed does not reliably raise an error.** Kill the relay under a
connected WebRTC player and the peer connection sits there quite happily: the
picture goes black while `status` stays `live`. Watching for an error is not
enough — the module watches whether `currentTime` is still advancing, and
treats 6s of no movement as down. This was found by killing go2rtc under a live
tile and watching it stay black with a pulsing red dot.

Note also that `DELETE /api/streams` does **not** tear down established consumer
sessions — an existing viewer keeps playing. Deleting a stream is not a way to
test a feed dying; kill the relay.

## Background refresher

Tokenised manifest URLs expire. The refresher (60s cadence, started with the
server) keeps them alive. Its policy is deliberately careful about live output,
because re-registering a stream forces go2rtc to reconnect:

| Situation | Action |
|---|---|
| Failed, never resolved, or **missing from the relay** (it restarted) | refresh now — nothing to protect |
| Past 80% of the stale window, **nobody watching** | refresh — free, and it is fresh for the next start |
| Past 80%, **someone watching** | defer — refreshing would glitch them |
| Past **2×** the window, someone watching | refresh anyway — a 1s reconnect beats a dead reconnect later |
| Repeated failures | exponential backoff, 60s → 30m cap |

Per-source `autoRefresh: false` opts out. `GET /health` shows the decision and
its reason for every source, so the policy is never a black box.

Tunables: `WEB_SOURCE_STALE_MS` (45m), `WEB_SOURCE_REFRESH_TICK_MS` (60s),
`WEB_SOURCE_REFRESH_PER_TICK` (3).

## Beyond video — data extraction for siphon

Same rig, different question:

| | asks |
|---|---|
| `POST /extract` | "what manifest is this player pulling?" |
| `POST /extract-data` | "what does this page's own JavaScript fetch?" |

A site with no public API usually still **has** one — its own front end is
calling it. `/extract-data` drives the page, watches for JSON/XML/CSV responses,
ranks them, and returns a **poll spec**: url, method, headers, and (for POST)
the request body and its content-type.

🚨 **The browser is a discovery tool, not a polling tool.** Chrome per poll is
untenable at siphon's scale (~8s and a whole browser per fetch, times hundreds
of sources). Discover once, pin the spec, then poll with an ordinary HTTP
client forever — the same resolve-then-pin shape as web sources. `replay.replayable`
in the result tells you whether that will work; if it is false, this approach
will not work for that page.

Worked example — CalMac service status, which has no public API:

```bash
curl -s -X POST http://<extractor>:3946/extract-data \
  -H "Authorization: Bearer $WEB_SOURCE_EXTRACTOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pageUrl":"https://www.calmac.co.uk/service-status","match":"graphql","consent":"reject"}'
```

Finds `https://apim.calmac.co.uk/graphql` (a 64KB POST), reports it replayable
with no headers, and the spec then polls with plain curl — verified returning
30 routes including Ardrossan–Brodick and Largs–Cumbrae.

### Safety rules that are not optional here

- **Credentials are named, never returned.** `Authorization`, `X-Api-Key` and
  friends are stripped; the result reports `requiresSecretHeaders: ["authorization"]`
  so a human decides. Handing a scraped bearer token to a poller silently is
  not ours to do.
- **Writes are refused.** Only `GET` and `POST` are replayable, and a POST body
  that looks like a GraphQL `mutation` is rejected. A poll loop must never be
  able to fire someone else's write call.
- **A 200 is not proof.** The replay probe also checks the body is non-trivial,
  because a login page returns 200 too and a source that quietly polls an empty
  shell is worse than one that fails loudly.
- **A discovered endpoint is undocumented and unpromised.** It can change shape
  or vanish. If a feed matters operationally, ask the owner for a real API.

### The siphon side

A collector for this is ~100 lines against siphon's existing plugin contract
(`@register("browser_discovered")`, `fetch` + `parse`). It is **not** in the
siphon repo: that tree is badly drifted (82 dirty files locally, 136 on
big-server, 8 ahead / 17 behind), and the standing rule is to sort the drift
before slipping an unrelated edit in. The module is written and ready to drop in
when that is done.

## Shared extraction service (Prism, drones-admin, …)

Extraction is estate-level capability, not a Broadcast Studio feature. Rather
than every app growing its own headless-Chrome fleet:

```bash
node server/src/web-source-service.js     # POST /extract, GET /health
```

Clients set `WEB_SOURCE_EXTRACTOR_URL` (+ `WEB_SOURCE_EXTRACTOR_TOKEN`) and get
the identical contract they would in-process — callers never branch on it.
`GET /api/web-sources/health` reports which mode is in use.

- Refuses to start on a non-loopback bind without a token — it fronts a browser.
- Bearer token compared in constant time; SSRF guard before anything launches.
- One browser at a time, bounded queue (`WEB_SOURCE_SERVICE_MAX_QUEUE`, 20).

**Where it should run:** not big-server (86% disk, and it is the intel plane).
stream-server already carries ffmpeg and the encode-capacity cgroups.

## go2rtc gotchas (1.9.14, verified live)

- **`PUT` adds a stream. `POST` does nothing** and returns 400 with an empty
  body — it looks like it worked.
- `DELETE /api/streams?src=<NAME>` — the param is `src`, the value is the *name*.
- 🚨 **A 400 saying `yaml: line N: did not find expected key` means the stream
  was added in memory but could not be persisted.** Cause: the relay's
  `go2rtc.yaml` uses flow-style `streams: {}`. Use block style or omit the key,
  or every API-added stream dies on the next restart. Surfaced as
  `relayPersisted: false`, not a failure. (`hdhomerun-bringup-mac.sh` already
  writes block style, so the venue relay is fine.)

## Operating notes

- **One extraction at a time**, shared by operators and the refresher.
- `CHROME_PATH` overrides browser discovery. **No npm dependency is added** —
  Node 22+ has a native `WebSocket`, so CDP is spoken directly.
- Extraction has a **hard deadline** (`timeoutMs` + 15s) that force-closes the
  browser. Without it a wedged navigation hangs forever, jams the queue and
  orphans a Chrome — which is exactly what the Troon page did before the fix.
- **Rights are not a technical question.** Extraction being easy does not make
  content yours. The rule from TUNER.md extends here: never push extracted
  content to the YouTube tee or any public restream without checking rights.
