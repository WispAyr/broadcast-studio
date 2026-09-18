#!/usr/bin/env python3
"""
Pavilion kiosk → Broadcast Studio switch-over watcher.

The two Ayr Pavilion signage PCs (Trolink mini-PCs, both hostname
DESKTOP-5II44EK, Edge kiosk on a LOCAL signage.html) dropped off the venue
Wi-Fi on 2026-06-26 and have not been seen by the PIV UDM since. As soon as
either one re-joins the network this watcher:

  1. finds its current DHCP address via the PIV UDM (by MAC — the LAN was
     renumbered 192.168.1.0/24 → 192.168.4.0/22, so the old IPs are dead),
  2. checks WinRM (:5985) is reachable over the WG mesh,
  3. rewrites C:\\PavilionSignage\\kiosk-screen-<A|B>.bat so the Edge kiosk
     opens the Broadcast Studio screen URL instead of the local file
     (old .bat kept as kiosk-screen-<X>.bat.pre-bs), then kills msedge so the
     PavilionSignageWatch watchdog relaunches it on the new URL,
  4. verifies the Broadcast Studio screen row goes online.

Runs detached on small-server. Idempotent — a box already on the BS URL is
skipped. Screen IDs are read live from broadcast.db by screen name.

  nohup python3 /root/pavilion-kiosk-bs-switch-watcher.py >/dev/null 2>&1 &
  tail -f /var/log/pavilion-kiosk-bs-switch.log
"""
import datetime
import json
import os
import re
import socket
import sqlite3
import subprocess
import time

LOG = "/var/log/pavilion-kiosk-bs-switch.log"
DB = "/root/broadcast-studio/server/data/broadcast.db"
STUDIO_SLUG = "ayr-pavilion"

UDM_IP = "10.200.0.26"                 # PIV UDM Pro on the WG mesh
UDM_USER = "root"
UDM_PW = os.environ.get("PIV_UDM_PW", "RBTeeyKM142!")
HUB_PEER = "xNKUee8F/BC1wkpV+q+jayTyVqBE8MxMHl2ddcf2mVs="   # PIV UDM peer on the hub
LAN = "192.168.4.0/22"

KIOSKS = {  # screen letter → (MAC, Broadcast Studio screen name)
    "A": ("48:8f:4c:f8:72:61", "PIV — Screen A · What's On"),
    "B": ("48:8f:4c:f8:72:8b", "PIV — Screen B · Featured"),
}
WIN_USER, WIN_PW = "Administrator", os.environ.get("PIV_KIOSK_PW", "RBTeeyKM142!")
BS_BASE = "https://broadcast.studio.wispayr.online/screen/"

INTERVAL = 60            # seconds between polls
MAX_DAYS = 30            # give up after a month
RECENT_S = 600           # UDM last_seen must be within this to count as "online"


def log(msg):
    line = f"{datetime.datetime.now().isoformat(timespec='seconds')}  {msg}"
    with open(LOG, "a") as f:
        f.write(line + "\n")
    print(line, flush=True)


def sh(cmd, timeout=30):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except Exception as e:  # noqa: BLE001
        return 99, "", f"ERR:{e}"


def udm(cmd, timeout=40):
    """Run a shell command on the PIV UDM over the mesh.
    argv form (no local shell) so mongo's `$in` etc. survive untouched."""
    argv = [
        "sshpass", "-e", "ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=10", "-o", "LogLevel=ERROR", f"{UDM_USER}@{UDM_IP}", cmd,
    ]
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=timeout,
                           env={**os.environ, "SSHPASS": UDM_PW})
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except Exception as e:  # noqa: BLE001
        return 99, "", f"ERR:{e}"


def ensure_lan_route():
    """The hub's wg-van-watchdog re-syncs wg0.conf every minute; the /22 is
    persisted there now, but re-assert cheaply in case someone edits it out."""
    code, out, _ = sh("wg show wg0 allowed-ips")
    if code == 0 and any(HUB_PEER in ln and LAN in ln for ln in out.splitlines()):
        return True
    log(f"hub peer lost {LAN} — re-asserting")
    sh(f"wg set wg0 peer {HUB_PEER} allowed-ips 10.200.0.26/32,{LAN}")
    sh(f"ip route replace {LAN} dev wg0")
    return True


def kiosk_addresses():
    """{letter: (ip, age_s)} for kiosks the UDM has seen recently."""
    macs = [m for m, _ in KIOSKS.values()]
    q = ("db.user.find({mac:{$in:" + json.dumps(macs) + "}},{mac:1,last_ip:1,last_seen:1,_id:0})"
         ".forEach(function(d){print(JSON.stringify(d))})")
    code, out, err = udm(f"mongo --quiet --port 27117 ace --eval '{q}'; echo; date +%s")
    if code != 0 or not out:
        log(f"UDM query failed code={code} err={err[:120]}")
        return {}
    lines = [ln for ln in out.splitlines() if ln.strip()]
    try:
        now = int(lines[-1])
    except ValueError:
        now = int(time.time())
    found = {}
    for ln in lines[:-1]:
        try:
            d = json.loads(ln)
        except json.JSONDecodeError:
            continue
        for letter, (mac, _) in KIOSKS.items():
            if d.get("mac") == mac and d.get("last_ip"):
                ls = d.get("last_seen") or 0
                if isinstance(ls, dict):
                    ls = int(ls.get("$numberLong", 0))
                found[letter] = (d["last_ip"], now - int(ls))
    return found


def port_open(ip, port=5985, timeout=4):
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except OSError:
        return False


def screen_ids():
    con = sqlite3.connect(DB)
    try:
        sid = con.execute("select id from studios where slug=?", (STUDIO_SLUG,)).fetchone()
        if not sid:
            return {}
        out = {}
        for letter, (_, name) in KIOSKS.items():
            row = con.execute("select id from screens where studio_id=? and name=?", (sid[0], name)).fetchone()
            if row:
                out[letter] = row[0]
        return out
    finally:
        con.close()


def screen_online(screen_id):
    con = sqlite3.connect(DB)
    try:
        row = con.execute("select is_online,last_seen from screens where id=?", (screen_id,)).fetchone()
        return row
    finally:
        con.close()


def winrm_ps(ip, ps):
    import winrm  # pywinrm is installed on small-server
    s = winrm.Session(f"http://{ip}:5985", auth=(WIN_USER, WIN_PW), transport="basic",
                      read_timeout_sec=60, operation_timeout_sec=45)
    r = s.run_ps(ps)
    return r.status_code, r.std_out.decode(errors="replace").strip(), r.std_err.decode(errors="replace").strip()


def switch_ps(letter, url):
    # Rewrites the kiosk launcher to open the BS screen URL. Keeps a one-time
    # backup. Tolerates either the known file:// URL form or any --kiosk "<url>".
    return r'''
$ErrorActionPreference='Continue'
$base='C:\PavilionSignage'
$bat=Join-Path $base ('kiosk-screen-' + '%(letter)s' + '.bat')
$url='%(url)s'
if(!(Test-Path $bat)){ $alt=Get-ChildItem $base -Filter 'kiosk*.bat' -ErrorAction SilentlyContinue | Select-Object -First 1; if($alt){ $bat=$alt.FullName } }
if(!(Test-Path $bat)){ Write-Output 'NO_BAT'; Get-ChildItem $base | Select-Object -ExpandProperty Name; exit }
$txt=Get-Content $bat -Raw
if($txt -match [regex]::Escape($url)){ Write-Output ('ALREADY ' + $bat); exit }
$bak="$bat.pre-bs"; if(!(Test-Path $bak)){ Copy-Item $bat $bak -Force }
$new=[regex]::Replace($txt,'--kiosk\s+"[^"]*"',('--kiosk "' + $url + '"'))
if($new -eq $txt){ $new=[regex]::Replace($txt,'file:///[^\s"]*',$url) }
if($new -eq $txt){ Write-Output 'NO_MATCH'; Write-Output $txt; exit }
Set-Content -Path $bat -Value $new -Encoding ASCII
Write-Output ('REWROTE ' + $bat)
Write-Output (Get-Content $bat -Raw)
taskkill /f /im msedge.exe 2>$null | Out-Null
Write-Output 'EDGE_KILLED'
''' % {"letter": letter, "url": url}


def main():
    ids = screen_ids()
    if len(ids) < len(KIOSKS):
        log(f"missing Broadcast Studio screens for {set(KIOSKS) - set(ids)} — run seed-pavilion-whatson.js first")
        return
    log("=== watcher started === " + ", ".join(f"{k}={KIOSKS[k][0]}→{BS_BASE}{v}" for k, v in ids.items()))
    done = {}
    deadline = time.time() + MAX_DAYS * 86400
    last_seen_report = {}
    while len(done) < len(KIOSKS) and time.time() < deadline:
        ensure_lan_route()
        addrs = kiosk_addresses()
        for letter in KIOSKS:
            if letter in done:
                continue
            info = addrs.get(letter)
            if not info:
                continue
            ip, age = info
            if age > RECENT_S:
                if last_seen_report.get(letter) != ip:
                    log(f"Screen {letter} last seen by UDM {age // 3600}h ago at {ip} — waiting")
                    last_seen_report[letter] = ip
                continue
            if not port_open(ip):
                log(f"Screen {letter} is on the LAN at {ip} (seen {age}s ago) but WinRM :5985 not reachable yet")
                continue
            url = BS_BASE + ids[letter]
            log(f"Screen {letter} ONLINE at {ip} — switching Edge kiosk to {url}")
            try:
                code, out, err = winrm_ps(ip, switch_ps(letter, url))
            except Exception as e:  # noqa: BLE001
                log(f"Screen {letter} WinRM error: {e}")
                continue
            if "REWROTE" in out or "ALREADY" in out:
                log(f"Screen {letter} {out.splitlines()[0]}")
                done[letter] = ip
            else:
                log(f"Screen {letter} unexpected code={code} out={out[:300]!r} err={err[:200]!r}")
        if len(done) < len(KIOSKS):
            time.sleep(INTERVAL)

    # verify BS registration for the switched boxes
    time.sleep(45)
    for letter, ip in done.items():
        row = screen_online(ids[letter])
        log(f"Screen {letter} ({ip}) Broadcast Studio row: is_online={row[0] if row else '?'} last_seen={row[1] if row else '?'}")
    log(f"=== watcher finished === results: {done}")


if __name__ == "__main__":
    main()
