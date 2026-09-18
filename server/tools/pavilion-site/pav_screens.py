"""
Ayr Pavilion — venue screens control (ayrpavilion.com/screens-admin).

Mirrors the NAR intranet "Screens" tab: the website is only the operator UI;
every push goes through Broadcast Studio's screen API for the Ayr Pavilion
studio. Auth = the same client-portal login the events-admin uses (token is
validated against client-portal /api/auth/validate on every call).

Deployed as /root/marketing-sites/pav_screens.py and included from server.py
BEFORE the catch-all route. Env (in /root/marketing-sites/.env):
  PAV_BS_URL        https://broadcast.studio.wispayr.online
  PAV_BS_TOKEN      long-lived BS JWT for the `pavilion` studio admin user
  PAV_BS_STUDIO_ID  f18214ce-c1c4-472f-b42e-add3922fd318
"""
import logging
import os
import re
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse

logger = logging.getLogger("pav_screens")
router = APIRouter()

SITES_DIR = Path(__file__).parent / "sites"
BS_URL = os.getenv("PAV_BS_URL", "https://broadcast.studio.wispayr.online").rstrip("/")
BS_TOKEN = os.getenv("PAV_BS_TOKEN", "")
BS_STUDIO_ID = os.getenv("PAV_BS_STUDIO_ID", "f18214ce-c1c4-472f-b42e-add3922fd318")
BS_STUDIO_NAME = "Ayr Pavilion"
PORTAL_AUTH = "http://localhost:5000/api/auth/validate"
PAV_HOSTS = ("ayrpavilion.com", "www.ayrpavilion.com", "localhost", "127.0.0.1")

# Layouts offered as one-click presets, in display order. Anything else in the
# studio is listed under "more" so operators can still reach it.
PRESETS = [
    ("Pavilion: What's On — Screen A (Portrait)",          "What's On",          "Rotating hero cards, every upcoming event"),
    ("Pavilion: What's On — Screen B Featured (Portrait)", "What's On · Featured", "Featured events first, then the rest"),
    ("Pavilion: Calendar Timeline (Portrait)",             "Calendar Timeline",  "Animated timeline of the whole season"),
    ("Pavilion: What's On (Landscape)",                    "What's On (wide)",   "For a landscape display"),
    ("Pavilion: Calendar Timeline (Landscape)",            "Timeline (wide)",    "For a landscape display"),
]
BLANK_NAME = "⬛ Blank"


def _bs_ready():
    return bool(BS_URL and BS_TOKEN and BS_STUDIO_ID)


async def _require_portal_user(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="login required")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(PORTAL_AUTH, headers={"Authorization": auth}, timeout=8.0)
    except Exception as e:  # noqa: BLE001
        logger.error("pav-screens auth check failed: %s", e)
        raise HTTPException(status_code=502, detail="auth service unavailable")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return r.json().get("user") or {}


async def _bs(method, path, json=None, auth=True, timeout=12.0):
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {BS_TOKEN}"
    async with httpx.AsyncClient() as client:
        r = await client.request(method, f"{BS_URL}{path}", json=json, headers=headers, timeout=timeout)
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=f"Broadcast Studio: {r.text[:200]}")
    try:
        return r.json()
    except ValueError:
        return None


async def _studio_layouts():
    layouts = await _bs("GET", f"/api/layouts?studio_id={BS_STUDIO_ID}")
    return [l for l in (layouts or []) if l.get("studio_id") == BS_STUDIO_ID]


async def _studio_screens():
    allscreens = await _bs("GET", "/api/screens/deploy", auth=False)
    return [s for s in (allscreens or []) if s.get("studio_name") == BS_STUDIO_NAME]


def _is_pav_host(request: Request):
    host = request.headers.get("host", "localhost").split(":")[0]
    return host in PAV_HOSTS


# ── page ─────────────────────────────────────────────────────────────────
@router.get("/screens-admin", response_class=HTMLResponse)
async def serve_screens_admin(request: Request):
    if not _is_pav_host(request):
        return HTMLResponse(content="<h1>Not Found</h1>", status_code=404)
    page = SITES_DIR / "ayrpavilion_com_screens.html"
    if not page.exists():
        return HTMLResponse(content="<h1>Not Found</h1>", status_code=404)
    return HTMLResponse(content=page.read_text())


# ── API ──────────────────────────────────────────────────────────────────
@router.get("/api/pav-screens/state")
async def screens_state(request: Request):
    """Screens + presets in one call (polled every 10s by the page)."""
    await _require_portal_user(request)
    if not _bs_ready():
        return JSONResponse(status_code=503, content={"detail": "Broadcast Studio link not configured"})
    screens = await _studio_screens()
    layouts = await _studio_layouts()
    by_name = {l["name"]: l for l in layouts}
    presets = []
    for name, label, blurb in PRESETS:
        l = by_name.get(name)
        if l:
            presets.append({"id": l["id"], "name": name, "label": label, "blurb": blurb, "orientation": l.get("orientation")})
    preset_ids = {p["id"] for p in presets}
    more = [{"id": l["id"], "name": l["name"], "orientation": l.get("orientation")}
            for l in layouts if l["id"] not in preset_ids and not l.get("is_blackout") and l.get("name") != BLANK_NAME]
    out = []
    for s in screens:
        out.append({
            "id": s["id"], "name": s["name"], "number": s.get("screen_number"),
            "online": bool(s.get("is_online")), "last_seen": s.get("last_seen"),
            "showing": s.get("layout_name"),
            "display_url": f"{BS_URL}/screen/{s['id']}",
            "preview_url": f"{BS_URL}/screen/{s['id']}?preview=1&fit=1",
        })
    return {"screens": out, "presets": presets, "more": more, "bs_url": BS_URL}


async def _target_screen(screen_id: str):
    screens = await _studio_screens()
    s = next((x for x in screens if x["id"] == screen_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="Not an Ayr Pavilion screen")
    return s


@router.post("/api/pav-screens/{screen_id}/layout")
async def push_layout(screen_id: str, request: Request):
    user = await _require_portal_user(request)
    body = await request.json()
    layout_id = str(body.get("layout_id") or "")
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", layout_id):
        raise HTTPException(status_code=400, detail="layout_id required")
    await _target_screen(screen_id)
    layouts = await _studio_layouts()
    if not any(l["id"] == layout_id for l in layouts):
        raise HTTPException(status_code=400, detail="Layout is not in the Ayr Pavilion studio")
    await _bs("POST", f"/api/screens/{screen_id}/layout", json={"layout_id": layout_id})
    logger.info("pav-screens: %s pushed layout %s to screen %s", user.get("username"), layout_id, screen_id)
    return {"ok": True}


async def _blank_layout_id():
    layouts = await _studio_layouts()
    for l in layouts:
        if l.get("is_blackout") or l.get("name") == BLANK_NAME:
            return l["id"]
    created = await _bs("POST", "/api/layouts", json={
        "name": BLANK_NAME, "studio_id": BS_STUDIO_ID, "grid_cols": 12, "grid_rows": 8,
        "modules": [], "background": "#000000", "orientation": "portrait", "is_blackout": 1, "public_safe": 1,
    })
    return created["id"]


@router.post("/api/pav-screens/{screen_id}/blank")
async def blank_screen(screen_id: str, request: Request):
    user = await _require_portal_user(request)
    await _target_screen(screen_id)
    layout_id = await _blank_layout_id()
    await _bs("POST", f"/api/screens/{screen_id}/layout", json={"layout_id": layout_id})
    logger.info("pav-screens: %s blanked screen %s", user.get("username"), screen_id)
    return {"ok": True}
