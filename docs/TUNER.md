# Off-air TV ingest (STV / BBC One) — Freeview/Freesat tuner

STV Player and BBC iPlayer live are **Widevine-DRM'd and UK/Scotland geo-locked**,
so they can't be pulled and restreamed. The clean, DRM-free, ToS-clean route is an
**off-air tuner at the venue** (you're in Scotland — STV regionalises correctly and
there's no geo issue). One aerial + tuner box covers both broadcasters:

| Channel | Freeview | Freesat |
|---|---|---|
| **STV** (ITV1 Scotland) | **103** | 103 |
| **BBC One Scotland** | 1 / 101 | 101 |

> Licensing for public showing at the venue: **TV Licence + MPLC + PPL PRS** (TheMusicLicence). The tuner route itself is clean (no service ToS, no DRM defeat).

## Topology (recommended: local at the venue)

```
Aerial ─▶ USB DVB-T2 tuner ─▶ Tvheadend ─▶ ffmpeg ─▶ mediamtx ─▶ HLS ─▶ CameraFeedModule
         (venue box / playout laptop, on the venue LAN)
```

Run it on a box **at the venue** (the playout laptop or a mini-PC). The venue screens
pull the HLS over the LAN — lowest latency, no internet round-trip. (You *can* push to
big-server's mediamtx instead for remote screens, but for a fan-zone the local box is best.)

## Setup

**1. Tuner + Tvheadend** (handles DVB tuning + exposes an HTTP MPEG-TS per channel):
```bash
sudo apt install tvheadend       # web UI on :9981, run the channel scan, map STV + BBC One
```
Tvheadend then serves each channel as TS at e.g. `http://<box>:9981/stream/channelid/<id>`.

**2. ffmpeg → mediamtx** (one per channel). mediamtx auth note: if pushing to *our*
big-server mediamtx, the path must be in `authHTTPExclude` for `publish` (see
`/etc/mediamtx/mediamtx.yml` — same pattern as `bbc-testcard`). For a local mediamtx
(no auth) just publish:
```bash
# STV
ffmpeg -nostdin -i "http://127.0.0.1:9981/stream/channelnumber/103" \
  -c:v libx264 -preset veryfast -profile:v high -g 50 -keyint_min 50 -sc_threshold 0 \
  -b:v 4500k -maxrate 5000k -bufsize 9000k -c:a aac -ar 48000 -b:a 128k \
  -rtsp_transport tcp -f rtsp rtsp://127.0.0.1:8554/stv-live
# BBC One — same, channelnumber/1 → rtsp://127.0.0.1:8554/bbc-one
```
Or add it to `mediamtx.yml` as a `runOnDemand` path (only ingests when a screen connects):
```yaml
paths:
  stv-live:
    runOnInit: ffmpeg -nostdin -i "http://127.0.0.1:9981/stream/channelnumber/103" -c:v libx264 -preset veryfast -profile:v high -g 50 -keyint_min 50 -sc_threshold 0 -b:v 4500k -maxrate 5000k -bufsize 9000k -c:a aac -ar 48000 -b:a 128k -rtsp_transport tcp -f rtsp rtsp://127.0.0.1:$RTSP_PORT/stv-live
    runOnInitRestart: yes
  bbc-one:
    runOnInit: ffmpeg -nostdin -i "http://127.0.0.1:9981/stream/channelnumber/1" ...same... rtsp://127.0.0.1:$RTSP_PORT/bbc-one
    runOnInitRestart: yes
```

**3. Point the screen at it.** The FanZone studio already has **📺 STV Live** and
**📺 BBC One** scenes (a `camera_feed` module). Set the module's `src` to your HLS URL:
- Local venue mediamtx: `http://<box-ip>:8888/stv-live/index.m3u8`
- Via big-server (already exposed): `https://live.wispayr.online/playout/stv-live/index.m3u8`

`CameraFeedModule` auto-loads hls.js, so any Chromium screen plays it. Push the scene
from the Live Mode hotbar at kick-off.

## Notes
- Transcode (don't `-c copy`) — off-air TS timestamps + codecs vary; libx264/aac gives
  mediamtx clean, monotonic frames (same lesson as the BBC R&D test card).
- The existing `bbc-testcard` path proves the whole mediamtx→screen chain works today.
- If the venue can only get **Freesat** (dish), use a Freesat box's HDMI into a USB
  capture dongle instead of a DVB-T2 tuner — same ffmpeg→mediamtx step after.
