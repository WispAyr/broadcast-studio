# Off-air TV ingest — HDHomeRun → go2rtc → `live_tv` module

STV Player and BBC iPlayer live are **Widevine-DRM'd and geo/ToS-restricted**, so
they can't be pulled and restreamed. The clean route is **off-air reception at
the venue** (Scotland — STV regionalises correctly, no geo issue). The kit is a
**SiliconDust HDHomeRun** (network DVB-T2 tuner, 4 concurrent channels) + aerial.

> Licensing for public showing at the venue: **TV Licence + MPLC + PPL PRS**
> (TheMusicLicence). The tuner route itself is clean (no service ToS, no DRM
> defeat). Never push off-air content to the YouTube tee or any public restream.

## Topology

```
Aerial ─▶ HDHomeRun (LAN, :5004 HTTP MPEG-TS)
            └▶ go2rtc on the venue relay Mac (ffmpeg deinterlace + videotoolbox)
                 └▶ MSE/WebRTC ─▶ broadcast-studio `live_tv` module on every screen
```

Everything stays on the venue LAN — lowest latency, no internet round-trip, no
cloud servers touching broadcast content.

## Bring-up (one-time, ~10 min once the aerial works)

1. Plug the HDHomeRun into the venue LAN + aerial, then from the relay Mac run:
   ```bash
   bash docs/hdhomerun-bringup-mac.sh
   ```
   It discovers the tuner, runs/uses the channel scan, finds BBC One / STV /
   BBC Two / Channel 4 in the line-up, writes `~/livetv/go2rtc.yaml` and starts
   go2rtc. Each channel is an ffmpeg pipeline: `yadif` deinterlace (off-air HD
   is 1080i — without this, football pans comb badly) → `h264_videotoolbox`
   (hardware, cheap on Apple Silicon) + AAC. Transcode, don't `-c copy`: DVB
   timestamps/codecs vary and MP2/HE-AAC audio won't play in browsers.
2. Point the broadcast-studio channel registry at the relay Mac (JWT required):
   ```bash
   curl -X PUT https://broadcast.studio.wispayr.online/api/livetv \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"host":"http://<relay-mac-LAN-ip>:1984"}'
   ```
3. Seed scenes + console buttons (idempotent):
   ```bash
   node server/src/seed-livetv.js <studio-slug>
   ```

## Broadcast-studio integration

- **`live_tv` module** — config is just `{ channel: 'bbc-one' }`; stream name +
  go2rtc host resolve from **`/api/livetv`** (file-backed registry,
  `server/data/livetv.json`). Retune = one PUT, zero layout edits.
- **Audio** — `audio: 'auto'` (default) plays sound **only on PA/audio-output
  screens** (`?audio=1` or screen config `audioOutput: true`, same gate as
  stings/beds — see AUDIO.md, including the kiosk
  `--autoplay-policy=no-user-gesture-required` flag). Match sound joins the
  duck bus, so stings/voiceovers duck it automatically.
- **Seeded scenes** — `📺 BBC One Scotland`, `📺 STV`, `📺 BBC Two`,
  `📺 Channel 4` (full-screen, audio auto) + `📺 TV Multiview` (2×2, muted).
  Overlay graphics (sideliners score/lower-thirds, breaking) ride on top of a
  full-screen TV scene as normal overlays.
- **Console / Stream Deck** — seeded buttons `TV BBC ONE` / `TV STV` /
  `TV BBC TWO` / `TV C4` / `TV Multiview` / `TV Off — Resume` on `/console`,
  each with a fire URL for a Stream Deck "Website" button (see /control/console).
- **Transport** — default **MSE** (H.264+AAC as encoded, ~1 s latency). WebRTC
  is available per-module (`mode: 'webrtc'`) but needs an Opus track — add
  `#audio=opus` / a second audio stream to the go2rtc config if you want it.

## Match-day checklist

1. go2rtc running on the relay Mac (`curl http://<mac>:1984/api/streams`).
2. Screens on, PA screen flagged `audioOutput` (and kiosk autoplay flag set).
3. Fire `TV STV` (Sat 20:00 kick-off) / `TV BBC ONE` from /console or Stream Deck.
4. Graphics over the top via the usual overlay buttons; `TV Off — Resume` after.

## Fallbacks

- **Poor terrestrial signal** → Freesat: BBC One Scotland HD is FTA on Astra
  28.2°E; use a Freesat box's HDMI into a USB capture dongle, then the same
  ffmpeg → go2rtc step (or a SAT>IP server).
- **No Mac at the venue** → any Linux box: same script logic, swap
  `h264_videotoolbox` for `libx264 -preset veryfast` (or a Pi's `h264_v4l2m2m`).
- The old USB-tuner/Tvheadend path (`tuner-bringup.sh`) still works but is
  superseded by the HDHomeRun — no Tvheadend needed.
