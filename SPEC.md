# Broadcast Studio - Screen Control System

## Overview
Multi-tenant studio screen control system. Each tenant (studio) gets their own screens, shows, layouts, and modules. A central control server manages everything via WebSockets for real-time updates.

**URL:** `broadcast.studio.local-connect.uk`

## Architecture

```
Producer (Control Panel UI)
        │ WebSocket
        ▼
  Control Server (Node.js + Express + Socket.IO)
        │
    ┌───┼───┐
    ▼   ▼   ▼
  Screen Screen Screen
  (Browser clients loading /screen/:id)
```

## Tech Stack (MANDATORY)
- **Backend:** Node.js, Express, Socket.IO, better-sqlite3
- **Frontend:** React + Vite + Tailwind CSS
- **Database:** SQLite (single file, `server/data/broadcast.db`)
- **Dark theme:** gray-950 backgrounds (consistent with our other apps)
- **Port:** 3945

## Multi-Tenancy
Each tenant is a "Studio". Studios are isolated:
- Each studio has its own screens, shows, layouts, modules
- Studio admin creates via login (username/password, bcryptjs + JWT)
- Super admin can manage all studios
- Default super admin: `admin / BroadcastAdmin2026!`

## Data Model

### Studios (tenants)
```sql
CREATE TABLE studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  config TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1
);
```

### Users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'producer', -- super_admin, admin, producer, viewer
  studio_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id)
);
```

### Screens
```sql
CREATE TABLE screens (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  screen_number INTEGER NOT NULL,
  current_layout_id TEXT,
  sync_mode TEXT DEFAULT 'independent', -- 'independent' or 'synced'
  config TEXT DEFAULT '{}',
  last_seen DATETIME,
  online INTEGER DEFAULT 0,
  FOREIGN KEY (studio_id) REFERENCES studios(id)
);
```

### Shows
```sql
CREATE TABLE shows (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  timeline TEXT DEFAULT '[]', -- JSON array of {time, layout_id}
  active INTEGER DEFAULT 0,
  config TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id)
);
```

### Layouts
```sql
CREATE TABLE layouts (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  grid_rows INTEGER DEFAULT 3,
  grid_columns INTEGER DEFAULT 3,
  modules TEXT DEFAULT '[]', -- JSON: [{module, x, y, w, h, config}]
  background TEXT DEFAULT '#000000',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id)
);
```

### Modules (available module types)
```sql
CREATE TABLE module_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_config TEXT DEFAULT '{}',
  icon TEXT,
  category TEXT -- 'time', 'media', 'data', 'broadcast', 'situational'
);
```

## Built-in Module Types (seed these)
1. **clock** - Digital/analog, countdown timer, show clock (category: time)
2. **weather** - Current conditions, forecast (category: data)
3. **youtube** - Video embed, playlist support (category: media)
4. **media** - Local video/image display for LED screens (category: media)
5. **autocue** - Scrolling script, presenter control (category: broadcast)
6. **social** - Social media feed display (category: broadcast)
7. **breaking_news** - Breaking news ticker/banner (category: broadcast)
8. **travel** - Traffic/transport info (category: data)
9. **countdown** - Countdown to specific time/event (category: time)
10. **iframe** - Embed any URL (category: media)
11. **text** - Static/scrolling text overlay (category: broadcast)
12. **image** - Static image display (category: media)
13. **weather_radar** - Weather radar map (category: situational)
14. **aircraft_tracker** - ADS-B aircraft tracker (category: situational)
15. **camera_feed** - Live camera RTSP/HLS stream (category: situational)
16. **alert_ticker** - Rolling alert/news ticker (category: situational)

## WebSocket Events

### Client → Server
- `register_screen` - Screen connects: `{screenId, studioId}`
- `screen_heartbeat` - Keep-alive from screen
- `control_action` - Producer action: `{action, target, data}`

### Server → Client (Screen)
- `set_layout` - Push new layout to screen
- `update_module` - Update single module config/data
- `sync_all` - Force all screens to same layout
- `emergency_layout` - Override everything with emergency layout
- `timeline_tick` - Timeline automation trigger

### Server → Client (Control Panel)
- `screen_status` - Screen online/offline
- `screen_preview` - Screen thumbnail/state update
- `timeline_update` - Current timeline position

## API Routes

### Auth
- `POST /api/auth/login` - Login (username + password)
- `POST /api/auth/register` - Register (super admin only)
- `GET /api/auth/me` - Current user info

### Studios (super admin)
- CRUD `/api/studios`

### Screens
- CRUD `/api/screens`
- `POST /api/screens/:id/layout` - Set screen layout
- `POST /api/screens/sync` - Sync all screens to one layout
- `POST /api/screens/emergency` - Emergency layout override

### Shows
- CRUD `/api/shows`
- `POST /api/shows/:id/activate` - Start a show (activates timeline)
- `POST /api/shows/:id/deactivate` - Stop show

### Layouts
- CRUD `/api/layouts`
- `GET /api/layouts/:id/preview` - Layout preview data

### Module Types
- `GET /api/modules` - List available module types

### Timeline
- `GET /api/timeline/current` - Current timeline state
- `POST /api/timeline/override` - Manual override
- `POST /api/timeline/resume` - Resume automation

## Frontend Pages

### Control Panel (`/control`)
- **Dashboard** - Live screen monitors (thumbnails/status of all screens)
- **Shows** - Manage shows, activate/deactivate
- **Layouts** - Create/edit layouts with drag-drop grid builder
- **Screens** - Manage screens, assign layouts
- **Timeline** - Visual timeline editor
- **Settings** - Studio settings, users

### Screen Display (`/screen/:id`)
- Full-screen, no chrome
- Registers via WebSocket on load
- Renders current layout with CSS Grid
- Each module renders in its grid cell
- Responsive to screen resolution
- Black background by default

### Login (`/login`)
- Username/password
- JWT stored in localStorage

### Landing (`/`)
- Simple branded landing page

## Screen Rendering
Each screen page (`/screen/:id`):
1. Connects WebSocket with `{screenId, studioId}`
2. Receives current layout
3. Renders CSS Grid based on layout config
4. Each module is a React component rendered in its grid cell
5. Listens for real-time updates (layout changes, module updates)
6. Full-screen, cursor hidden, no scrollbars

## Module Component Pattern
Each module is a self-contained React component:
```jsx
// modules/ClockModule.jsx
export default function ClockModule({ config }) {
  // config comes from layout's module config
  return <div>...</div>
}
```

Module registry maps module type strings to components:
```js
const MODULES = {
  clock: ClockModule,
  weather: WeatherModule,
  youtube: YouTubeModule,
  // etc
};
```

## Timeline Engine
Server-side timer that:
1. Checks active show's timeline every second
2. When current time matches a timeline entry, pushes layout change
3. Supports manual override (producer takes control)
4. Supports resume (return to automation)

## Emergency Layout
One-click override that:
1. Switches ALL screens to a predefined emergency layout
2. Bypasses all timeline automation
3. Broadcasts to all connected screens instantly
4. Logged with timestamp

## Key Behaviors
- Screens auto-reconnect on WebSocket disconnect
- Screens show "DISCONNECTED" overlay when server unreachable
- Control panel shows real-time screen status (online/offline/last seen)
- All state changes logged for audit
- Layouts saved instantly (no "save" button needed in editor)

## Seed Data
Create a default studio "Now Ayrshire Radio" with slug "now-ayrshire":
- 3 screens: "Presenter Monitor", "Guest Monitor", "Studio Wall"
- 3 sample layouts: "Default", "Breaking News", "Music Only"
- 1 sample show: "Breakfast Show" with a 3-entry timeline
- Seed all 16 module types

## File Structure
```
broadcast-studio/
├── server/
│   ├── src/
│   │   ├── index.js          # Express + Socket.IO server
│   │   ├── db.js             # SQLite setup + queries
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── studios.js
│   │   │   ├── screens.js
│   │   │   ├── shows.js
│   │   │   ├── layouts.js
│   │   │   └── modules.js
│   │   ├── ws.js             # WebSocket handler
│   │   ├── timeline.js       # Timeline automation engine
│   │   └── middleware/
│   │       └── auth.js       # JWT auth middleware
│   ├── data/                 # SQLite DB lives here
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── control/
│   │   │   │   ├── ControlLayout.jsx
│   │   │   │   ├── Dashboard.jsx    # Live screen monitors
│   │   │   │   ├── Shows.jsx
│   │   │   │   ├── Layouts.jsx      # Drag-drop layout builder
│   │   │   │   ├── Screens.jsx
│   │   │   │   ├── Timeline.jsx
│   │   │   │   └── Settings.jsx
│   │   │   └── screen/
│   │   │       └── ScreenDisplay.jsx  # Full-screen renderer
│   │   ├── modules/
│   │   │   ├── index.js        # Module registry
│   │   │   ├── ClockModule.jsx
│   │   │   ├── WeatherModule.jsx
│   │   │   ├── YouTubeModule.jsx
│   │   │   ├── MediaModule.jsx
│   │   │   ├── AutocueModule.jsx
│   │   │   ├── SocialModule.jsx
│   │   │   ├── BreakingNewsModule.jsx
│   │   │   ├── TravelModule.jsx
│   │   │   ├── CountdownModule.jsx
│   │   │   ├── IframeModule.jsx
│   │   │   ├── TextModule.jsx
│   │   │   ├── ImageModule.jsx
│   │   │   ├── WeatherRadarModule.jsx
│   │   │   ├── AircraftTrackerModule.jsx
│   │   │   ├── CameraFeedModule.jsx
│   │   │   └── AlertTickerModule.jsx
│   │   ├── components/
│   │   │   ├── ScreenPreview.jsx
│   │   │   ├── LayoutGrid.jsx
│   │   │   └── ModulePicker.jsx
│   │   └── lib/
│   │       ├── api.js
│   │       └── socket.js      # Socket.IO client wrapper
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── SPEC.md
└── README.md
```

## CRITICAL CONSTRAINTS
- SQLite only (better-sqlite3), NOT MongoDB
- Dark theme (gray-950 backgrounds)
- Port 3945
- Reuse Socket.IO patterns (similar to Sentinel's ws.js approach)
- All module components should be functional even if basic (show something, not just a placeholder div)
- The screen display page must work standalone — a browser loads `/screen/1` and it just works
- JWT secret: `broadcast-studio-jwt-2026`
- No external APIs needed initially — modules can use mock data where needed (weather, travel etc.)
