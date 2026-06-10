#!/usr/bin/env bash
# Live TV bring-up — HDHomeRun → go2rtc on the venue relay Mac.
#
#   aerial -> HDHomeRun (:5004 MPEG-TS) -> go2rtc (ffmpeg yadif + videotoolbox)
#          -> broadcast-studio `live_tv` module (MSE)
#
# Usage:  bash docs/hdhomerun-bringup-mac.sh [tuner-ip]
# Idempotent. Writes ~/livetv/go2rtc.yaml + a LaunchAgent, then prints the
# broadcast-studio wiring steps (PUT /api/livetv + seed).
set -euo pipefail

DIR="$HOME/livetv"
mkdir -p "$DIR"

echo "== 1/5  Tools (ffmpeg + go2rtc via Homebrew) =="
command -v brew >/dev/null || { echo "Homebrew required: https://brew.sh"; exit 1; }
command -v ffmpeg >/dev/null || brew install ffmpeg
command -v go2rtc >/dev/null || brew install go2rtc

echo "== 2/5  Find the HDHomeRun =="
TUNER="${1:-}"
if [ -z "$TUNER" ]; then
  TUNER=$(curl -fsS --max-time 5 https://my.hdhomerun.com/discover 2>/dev/null \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["LocalIP"])' 2>/dev/null || true)
fi
if [ -z "$TUNER" ]; then
  TUNER=$(curl -fsS --max-time 3 http://hdhomerun.local/discover.json 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["BaseURL"].split("//")[1].split(":")[0])' 2>/dev/null || true)
fi
[ -n "$TUNER" ] || { echo "Can't auto-discover. Re-run with the tuner IP: bash $0 192.168.x.x"; exit 1; }
echo "   tuner: $TUNER"

echo "== 3/5  Channel line-up =="
LINEUP=$(curl -fsS "http://$TUNER/lineup.json") || {
  echo "No line-up — run the channel scan first: http://$TUNER (Channel Lineup → Scan), then re-run."; exit 1; }

# Map our channel keys to line-up entries by name (prefer HD variants).
url_for() { # $1 = grep-pattern for GuideName
  echo "$LINEUP" | python3 -c '
import json,sys,re
pat = sys.argv[1]
chans = json.load(sys.stdin)
hd = [c for c in chans if re.search(pat, c.get("GuideName",""), re.I) and "HD" in c.get("GuideName","")]
any_ = [c for c in chans if re.search(pat, c.get("GuideName",""), re.I)]
pick = (hd or any_)
print(pick[0]["URL"] if pick else "")' "$1"
}

BBC1=$(url_for '^BBC One')
BBC2=$(url_for '^BBC Two')
STV=$(url_for '^(STV|ITV1)')
CH4=$(url_for '^Channel 4')
for v in BBC1:"$BBC1" STV:"$STV" BBC2:"$BBC2" CH4:"$CH4"; do echo "   ${v%%:*} -> ${v#*:}"; done
[ -n "$BBC1" ] && [ -n "$STV" ] || { echo "BBC One / STV not found in line-up — check aerial + rescan."; exit 1; }

echo "== 4/5  go2rtc config =="
# yadif: off-air HD is 1080i — deinterlace or football pans comb.
# videotoolbox: hardware H.264, ~free on Apple Silicon. AAC for browser MSE.
FF='-hide_banner -nostdin -fflags +genpts -i {INPUT} -map 0:v:0 -map 0:a:0 -vf yadif=0:-1:0 -pix_fmt yuv420p -c:v h264_videotoolbox -realtime 1 -profile:v high -b:v 4500k -maxrate 5000k -bufsize 9000k -g 50 -c:a aac -ar 48000 -ac 2 -b:a 128k -rtsp_transport tcp -f rtsp {output}'
emit() { # $1 key, $2 input URL
  [ -n "$2" ] && echo "  $1: exec:ffmpeg ${FF/\{INPUT\}/$2}"
}
{
  echo "api:"
  echo "  listen: \":1984\""
  echo "streams:"
  emit bbc-one "$BBC1"
  emit stv "$STV"
  emit bbc-two "$BBC2"
  emit channel4 "$CH4"
} > "$DIR/go2rtc.yaml"
echo "   wrote $DIR/go2rtc.yaml"

echo "== 5/5  LaunchAgent (start now + at login) =="
PLIST="$HOME/Library/LaunchAgents/online.wispayr.livetv-go2rtc.plist"
GO2RTC_BIN=$(command -v go2rtc)
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>online.wispayr.livetv-go2rtc</string>
  <key>ProgramArguments</key><array>
    <string>${GO2RTC_BIN}</string>
    <string>-config</string>
    <string>${DIR}/go2rtc.yaml</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${DIR}/go2rtc.log</string>
  <key>StandardErrorPath</key><string>${DIR}/go2rtc.log</string>
</dict></plist>
EOF
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 2

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<this-mac-ip>")
cat <<DONE

────────────────────────────────────────────────────────────────────
✅ go2rtc up — UI http://${IP}:1984 (streams tab shows each channel live)
Quick test:   ffplay "http://${IP}:1984/api/stream.mp4?src=stv"

Wire broadcast-studio at it (once):
  curl -X PUT https://broadcast.studio.wispayr.online/api/livetv \\
    -H "Authorization: Bearer \$TOKEN" -H 'Content-Type: application/json' \\
    -d '{"host":"http://${IP}:1984"}'
Then fire the seeded console buttons: TV BBC ONE / TV STV / TV Multiview.
Streams are on-demand — tuners are only in use while a screen is watching.
────────────────────────────────────────────────────────────────────
DONE
