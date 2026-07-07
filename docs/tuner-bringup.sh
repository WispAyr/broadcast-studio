#!/usr/bin/env bash
# SideLiner's FanZone — off-air tuner bring-up (run on the VENUE box / Pi).
#
# Turns a USB DVB-T2 tuner (or Pi TV HAT) + aerial into HLS feeds for the
# broadcast-studio 📺 STV Live / 📺 BBC One scenes:
#   aerial -> Tvheadend -> ffmpeg -> mediamtx -> HLS -> CameraFeedModule
#
# Usage:  sudo bash tuner-bringup.sh
# Then do the one manual step (Tvheadend channel scan, see end), and point the
# BS scene `src` at the printed HLS URL.
#
# Safe to re-run. Targets Debian/Raspberry Pi OS (arm64/armhf/amd64).
set -euo pipefail

MTX_DIR=/opt/mediamtx
TVH_USER="${TVH_USER:-stream}"          # Tvheadend streaming user (create in TVH web UI)
TVH_PASS="${TVH_PASS:-stream}"
TVH="http://${TVH_USER}:${TVH_PASS}@127.0.0.1:9981"

echo "== 1/4  Install Tvheadend + ffmpeg =="
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y tvheadend ffmpeg curl
#   ^ the tvheadend installer prompts for an admin user/pass on first install.
#     DVB firmware: on Raspberry Pi OS run `sudo apt install firmware-realtek
#     firmware-misc-nonfree` (or copy your tuner's blob into /lib/firmware) then reboot.

echo "== 2/4  Install mediamtx (local) =="
if [ ! -x "$MTX_DIR/mediamtx" ]; then
  mkdir -p "$MTX_DIR"; cd "$MTX_DIR"
  case "$(uname -m)" in
    aarch64) A=linux_arm64v8 ;; armv7l) A=linux_armv7 ;; x86_64) A=linux_amd64 ;;
    *) echo "unknown arch $(uname -m)"; exit 1 ;;
  esac
  V=$(curl -fsSL https://api.github.com/repos/bluenviron/mediamtx/releases/latest | grep -oE '"tag_name": *"[^"]+"' | head -1 | cut -d'"' -f4)
  curl -fsSL "https://github.com/bluenviron/mediamtx/releases/download/${V}/mediamtx_${V}_${A}.tar.gz" | tar xz
fi

echo "== 3/4  Write mediamtx config (STV ch103, BBC One ch1) =="
# Transcode (not copy) — off-air TS timestamps/codecs vary; clean H.264/AAC for HLS.
# On a Pi, swap `-c:v libx264 -preset veryfast` for `-c:v h264_v4l2m2m` (HW encoder) to spare CPU.
cat > "$MTX_DIR/mediamtx.yml" <<YML
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: mpegts
rtspAddress: :8554
paths:
  stv-live:
    runOnInit: ffmpeg -nostdin -i "${TVH}/stream/channelnumber/103" -map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -profile:v high -g 50 -keyint_min 50 -sc_threshold 0 -b:v 4500k -maxrate 5000k -bufsize 9000k -c:a aac -ar 48000 -b:a 128k -rtsp_transport tcp -f rtsp rtsp://127.0.0.1:\$RTSP_PORT/stv-live
    runOnInitRestart: yes
  bbc-one:
    runOnInit: ffmpeg -nostdin -i "${TVH}/stream/channelnumber/1" -map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -profile:v high -g 50 -keyint_min 50 -sc_threshold 0 -b:v 4500k -maxrate 5000k -bufsize 9000k -c:a aac -ar 48000 -b:a 128k -rtsp_transport tcp -f rtsp rtsp://127.0.0.1:\$RTSP_PORT/bbc-one
    runOnInitRestart: yes
YML

echo "== 4/4  Start mediamtx =="
pkill -f "$MTX_DIR/mediamtx" 2>/dev/null || true
sleep 1
( cd "$MTX_DIR" && nohup ./mediamtx mediamtx.yml > mediamtx.log 2>&1 & )
sleep 2

IP=$(hostname -I | awk '{print $1}')
cat <<DONE

────────────────────────────────────────────────────────────────────
✅ mediamtx running.  ONE manual step left:

  1. Open Tvheadend:  http://${IP}:9981
  2. Configuration → DVB Inputs → run a muxes scan for your region,
     then map services. Create a user "${TVH_USER}" / "${TVH_PASS}"
     with "Streaming" permission (Configuration → Users → Access entries).
  3. Confirm STV is on channel-number 103 and BBC One on 1 (adjust the
     channelnumber in ${MTX_DIR}/mediamtx.yml if your line-up differs).

Then point the broadcast-studio scenes at these HLS URLs (local LAN):
   📺 STV Live  →  http://${IP}:8888/stv-live/index.m3u8
   📺 BBC One   →  http://${IP}:8888/bbc-one/index.m3u8

(Edit the camera_feed module's src on those scenes in the Layouts editor.)
Test:  ffplay http://${IP}:8888/stv-live/index.m3u8
────────────────────────────────────────────────────────────────────
DONE
