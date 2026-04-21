#!/bin/bash
# v2 — fixes YAML indentation (existing config uses 2-space, not 4-space).
set -euo pipefail

ONVIF_DIR="/home/wispayr/onvif-server"
CONF="$ONVIF_DIR/config.yaml"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Rebuild config from clean backup so we don't accumulate half-appends.
LATEST_BAK=$(ls -t "$CONF".bak-* 2>/dev/null | tail -1)
if [ -z "$LATEST_BAK" ]; then
    echo "no prior backup found — aborting to avoid clobbering a pristine config"
    exit 1
fi
cp "$LATEST_BAK" "$CONF"
echo "restored from $LATEST_BAK"
cp "$CONF" "$CONF.bak-$STAMP"

# Strip any previous van-spectrum entry (defensive — in case an old attempt left remnants)
python3 - <<'PY'
import yaml, sys
p = "/home/wispayr/onvif-server/config.yaml"
with open(p) as f:
    cfg = yaml.safe_load(f)
cfg['onvif'] = [e for e in cfg.get('onvif', []) if e.get('name') != 'van-spectrum']
cfg['onvif'].append({
    'mac': 'a2:a2:a2:a2:a2:a3',
    'ports': {'server': 8083, 'rtsp': 8657, 'snapshot': 8582},
    'name': 'van-spectrum',
    'uuid': 'f83c0ec5-76f0-4a9b-a987-ceca0f73b1ae',
    'highQuality': {
        'rtsp': '/van-spectrum',
        'snapshot': '/van-spectrum',
        'width': 1920, 'height': 1080,
        'framerate': 15, 'bitrate': 1024, 'quality': 4,
    },
    'lowQuality': {
        'rtsp': '/van-spectrum',
        'snapshot': '/van-spectrum',
        'width': 1920, 'height': 1080,
        'framerate': 15, 'bitrate': 1024, 'quality': 4,
    },
    'target': {
        'hostname': '10.200.0.9',
        'ports': {'rtsp': 8554},
    },
})
with open(p, 'w') as f:
    yaml.safe_dump(cfg, f, default_flow_style=False, sort_keys=False)
print("rewrote config cleanly with van-spectrum entry")
PY

# Macvlan — tolerant to already-present
if ! ip link show onvif-vanspec >/dev/null 2>&1; then
    sudo ip link add onvif-vanspec link eth0 address a2:a2:a2:a2:a2:a3 type macvlan mode bridge
    sudo ip addr add 10.42.42.202/24 dev onvif-vanspec
    sudo ip link set onvif-vanspec up
    echo "created macvlan onvif-vanspec"
else
    echo "macvlan onvif-vanspec already exists"
fi

# onvif-macvlan.service — only patch if not already present (previous run did this)
grep -q "onvif-vanspec" /etc/systemd/system/onvif-macvlan.service 2>/dev/null || {
    echo "NOTE: onvif-macvlan.service not yet patched — v1 should have done this. Skipping."
}

sudo systemctl restart onvif-server
sleep 2
systemctl is-active onvif-server
echo "--- journal tail ---"
sudo journalctl -u onvif-server --since "20 seconds ago" -n 20 --no-pager | tail -15
