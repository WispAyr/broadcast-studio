#!/bin/bash
# Apply van-spectrum ONVIF camera to halio.
# Run on halio (10.42.42.161) as wispayr.
set -euo pipefail

ONVIF_DIR="/home/wispayr/onvif-server"
CONF="$ONVIF_DIR/config.yaml"
STAMP="$(date +%Y%m%d-%H%M%S)"

# 1. Backup existing config
cp "$CONF" "$CONF.bak-$STAMP"
echo "backup: $CONF.bak-$STAMP"

# 2. Append van-spectrum entry under the top-level 'onvif:' list.
#    We detect if the last line already ends with the last existing entry
#    and append. If the entry is already present, skip.
if grep -q "name: van-spectrum" "$CONF"; then
    echo "van-spectrum entry already in $CONF — skipping append"
else
    cat >> "$CONF" <<'EOF'

  - mac: a2:a2:a2:a2:a2:a3
    ports:
      server: 8083
      rtsp: 8657
      snapshot: 8582
    name: van-spectrum
    uuid: f83c0ec5-76f0-4a9b-a987-ceca0f73b1ae
    highQuality:
      rtsp: /van-spectrum
      snapshot: /van-spectrum
      width: 1920
      height: 1080
      framerate: 15
      bitrate: 1024
      quality: 4
    lowQuality:
      rtsp: /van-spectrum
      snapshot: /van-spectrum
      width: 1920
      height: 1080
      framerate: 15
      bitrate: 1024
      quality: 4
    target:
      hostname: 10.200.0.9
      ports:
        rtsp: 8554
EOF
    echo "appended van-spectrum entry to $CONF"
fi

# 3. Add macvlan for the new MAC/IP (10.42.42.202)
if ! ip link show onvif-vanspec >/dev/null 2>&1; then
    sudo ip link add onvif-vanspec link eth0 address a2:a2:a2:a2:a2:a3 type macvlan mode bridge
    sudo ip addr add 10.42.42.202/24 dev onvif-vanspec
    sudo ip link set onvif-vanspec up
    echo "created macvlan onvif-vanspec (10.42.42.202, a2:a2:a2:a2:a2:a3)"
else
    echo "macvlan onvif-vanspec already exists"
fi

# 4. Persist macvlan across reboots — append to onvif-macvlan.service
#    (only if not already present)
if ! grep -q "onvif-vanspec" /etc/systemd/system/onvif-macvlan.service 2>/dev/null; then
    sudo cp /etc/systemd/system/onvif-macvlan.service /etc/systemd/system/onvif-macvlan.service.bak-$STAMP
    sudo sed -i '/\[Install\]/i ExecStart=/sbin/ip link add onvif-vanspec link eth0 address a2:a2:a2:a2:a2:a3 type macvlan mode bridge\nExecStart=/sbin/ip addr add 10.42.42.202/24 dev onvif-vanspec\nExecStart=/sbin/ip link set onvif-vanspec up' /etc/systemd/system/onvif-macvlan.service
    sudo systemctl daemon-reload
    echo "patched onvif-macvlan.service for onvif-vanspec"
fi

# 5. Verify upstream RTSP is reachable from halio over WG
echo "--- checking upstream RTSP over WG ---"
timeout 8 ffprobe -v error -rtsp_transport tcp -show_entries stream=codec_name,width,height rtsp://10.200.0.9:8554/van-spectrum 2>&1 | head -6 || echo "WARN: upstream RTSP probe failed — check WG route to 10.200.0.9:8554"

# 6. Restart onvif-server
sudo systemctl restart onvif-server
sleep 2
systemctl is-active onvif-server
echo "--- onvif-server log tail ---"
sudo journalctl -u onvif-server --since "30 seconds ago" -n 20 --no-pager | tail -15

echo
echo "DONE. In UDM Protect, retry 'Add Device' — van-spectrum should appear as 10.42.42.202."
