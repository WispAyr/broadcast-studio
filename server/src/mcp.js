#!/usr/bin/env node
/**
 * Broadcast Studio MCP Server
 * Exposes all studio admin operations via Model Context Protocol (stdio transport).
 * 
 * For websocket operations (push_layout, push_overlay, etc.), makes HTTP calls
 * to the running Broadcast Studio server at localhost:3945.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const API_BASE = process.env.BROADCAST_API || 'http://127.0.0.1:3945';

// Open DB directly
const dbPath = path.join(__dirname, '..', 'data', 'broadcast.db');
const db = new Database(dbPath, { readonly: false });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Auth helper — get a JWT token for API calls
let cachedToken = null;
async function getToken() {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'BroadcastAdmin2026!' })
  });
  const data = await res.json();
  cachedToken = data.token;
  return cachedToken;
}

async function apiCall(method, path, body) {
  const token = await getToken();
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  return res.json();
}

// Create MCP server
const server = new McpServer({
  name: 'broadcast-studio',
  version: '1.0.0',
});

// --- READ-ONLY TOOLS (direct DB) ---

server.tool('list_studios', 'List all active studios', {}, async () => {
  const studios = db.prepare(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM screens sc WHERE sc.studio_id = s.id) as screen_count,
      (SELECT COUNT(*) FROM layouts l WHERE l.studio_id = s.id) as layout_count
    FROM studios s WHERE s.active = 1
  `).all();
  return { content: [{ type: 'text', text: JSON.stringify(studios, null, 2) }] };
});

server.tool('get_studio', 'Get studio details with screens and layouts', {
  studio_id: z.string().describe('Studio ID'),
}, async ({ studio_id }) => {
  const studio = db.prepare('SELECT * FROM studios WHERE id = ?').get(studio_id);
  if (!studio) return { content: [{ type: 'text', text: 'Studio not found' }], isError: true };
  const screens = db.prepare('SELECT * FROM screens WHERE studio_id = ?').all(studio_id);
  const layouts = db.prepare('SELECT * FROM layouts WHERE studio_id = ?').all(studio_id);
  layouts.forEach(l => { try { l.modules = JSON.parse(l.modules); } catch { l.modules = []; } });
  return { content: [{ type: 'text', text: JSON.stringify({ ...studio, screens, layouts }, null, 2) }] };
});

server.tool('list_screens', 'List screens for a studio', {
  studio_id: z.string().describe('Studio ID'),
}, async ({ studio_id }) => {
  const screens = db.prepare(`
    SELECT sc.*, l.name as layout_name, sg.name as group_name
    FROM screens sc
    LEFT JOIN layouts l ON sc.current_layout_id = l.id
    LEFT JOIN screen_groups sg ON sc.group_id = sg.id
    WHERE sc.studio_id = ?
    ORDER BY sc.screen_number
  `).all(studio_id);
  return { content: [{ type: 'text', text: JSON.stringify(screens, null, 2) }] };
});

server.tool('list_layouts', 'List all layouts for a studio', {
  studio_id: z.string().describe('Studio ID'),
}, async ({ studio_id }) => {
  const layouts = db.prepare('SELECT * FROM layouts WHERE studio_id = ?').all(studio_id);
  layouts.forEach(l => { try { l.modules = JSON.parse(l.modules); } catch { l.modules = []; } });
  return { content: [{ type: 'text', text: JSON.stringify(layouts, null, 2) }] };
});

server.tool('get_layout', 'Get layout with modules', {
  layout_id: z.string().describe('Layout ID'),
}, async ({ layout_id }) => {
  const layout = db.prepare('SELECT * FROM layouts WHERE id = ?').get(layout_id);
  if (!layout) return { content: [{ type: 'text', text: 'Layout not found' }], isError: true };
  try { layout.modules = JSON.parse(layout.modules); } catch { layout.modules = []; }
  return { content: [{ type: 'text', text: JSON.stringify(layout, null, 2) }] };
});

server.tool('list_screen_groups', 'List screen groups', {
  studio_id: z.string().optional().describe('Optional studio ID filter'),
}, async ({ studio_id }) => {
  const groups = studio_id
    ? db.prepare('SELECT * FROM screen_groups WHERE studio_id = ?').all(studio_id)
    : db.prepare('SELECT * FROM screen_groups').all();
  return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
});

server.tool('get_timeline', 'Get current timeline/schedule state', {
  studio_id: z.string().describe('Studio ID'),
}, async ({ studio_id }) => {
  const shows = db.prepare('SELECT * FROM shows WHERE studio_id = ?').all(studio_id);
  shows.forEach(s => { try { s.timeline = JSON.parse(s.timeline); } catch { s.timeline = []; } });
  return { content: [{ type: 'text', text: JSON.stringify(shows, null, 2) }] };
});

// --- WRITE TOOLS (direct DB) ---

server.tool('create_studio', 'Create a new studio', {
  name: z.string().describe('Studio name'),
  slug: z.string().describe('URL-friendly slug'),
}, async ({ name, slug }) => {
  const id = uuidv4();
  db.prepare('INSERT INTO studios (id, name, slug) VALUES (?, ?, ?)').run(id, name, slug);
  const studio = db.prepare('SELECT * FROM studios WHERE id = ?').get(id);
  return { content: [{ type: 'text', text: JSON.stringify(studio, null, 2) }] };
});

server.tool('register_screen', 'Register a new screen', {
  studio_id: z.string().describe('Studio ID'),
  name: z.string().describe('Screen name'),
  screen_number: z.number().describe('Screen number'),
}, async ({ studio_id, name, screen_number }) => {
  const id = uuidv4();
  db.prepare('INSERT INTO screens (id, studio_id, name, screen_number) VALUES (?, ?, ?, ?)').run(id, studio_id, name, screen_number);
  const screen = db.prepare('SELECT * FROM screens WHERE id = ?').get(id);
  return { content: [{ type: 'text', text: JSON.stringify(screen, null, 2) }] };
});

server.tool('update_screen', 'Update screen config', {
  screen_id: z.string().describe('Screen ID'),
  name: z.string().optional(),
  orientation: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  config: z.string().optional().describe('JSON config string'),
  group_id: z.string().optional().nullable(),
}, async ({ screen_id, name, orientation, width, height, config, group_id }) => {
  const result = await apiCall('PUT', `/api/screens/${screen_id}`, {
    name, orientation, width, height,
    config: config ? JSON.parse(config) : undefined,
    group_id,
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('create_layout', 'Create a new layout with modules', {
  studio_id: z.string().describe('Studio ID'),
  name: z.string().describe('Layout name'),
  grid_cols: z.number().optional().default(3),
  grid_rows: z.number().optional().default(3),
  modules: z.string().optional().describe('JSON array of modules'),
  background: z.string().optional().default('#000000'),
}, async ({ studio_id, name, grid_cols, grid_rows, modules, background }) => {
  const id = uuidv4();
  const modulesJson = modules || '[]';
  db.prepare('INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, studio_id, name, grid_cols, grid_rows, modulesJson, background);
  const layout = db.prepare('SELECT * FROM layouts WHERE id = ?').get(id);
  try { layout.modules = JSON.parse(layout.modules); } catch { layout.modules = []; }
  return { content: [{ type: 'text', text: JSON.stringify(layout, null, 2) }] };
});

server.tool('update_layout', 'Update layout modules/config', {
  layout_id: z.string().describe('Layout ID'),
  name: z.string().optional(),
  grid_cols: z.number().optional(),
  grid_rows: z.number().optional(),
  modules: z.string().optional().describe('JSON array of modules'),
  background: z.string().optional(),
}, async ({ layout_id, name, grid_cols, grid_rows, modules, background }) => {
  const result = await apiCall('PUT', `/api/layouts/${layout_id}`, {
    name, grid_cols, grid_rows,
    modules: modules ? JSON.parse(modules) : undefined,
    background,
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('create_screen_group', 'Create a screen group', {
  studio_id: z.string().describe('Studio ID'),
  name: z.string().describe('Group name'),
  profile: z.string().optional().describe('JSON profile config'),
}, async ({ studio_id, name, profile }) => {
  const id = uuidv4();
  const profileStr = profile || '{}';
  db.prepare('INSERT INTO screen_groups (id, studio_id, name, profile) VALUES (?, ?, ?, ?)').run(id, studio_id, name, profileStr);
  const group = db.prepare('SELECT * FROM screen_groups WHERE id = ?').get(id);
  return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
});

// --- WEBSOCKET TOOLS (via API) ---

server.tool('push_layout', 'Push a layout to screen(s)', {
  screen_id: z.string().optional().describe('Target screen ID (omit for all studio screens)'),
  studio_id: z.string().optional().describe('Studio ID (for sync all)'),
  layout_id: z.string().describe('Layout ID to push'),
}, async ({ screen_id, studio_id, layout_id }) => {
  if (screen_id) {
    const result = await apiCall('POST', `/api/screens/${screen_id}/layout`, { layout_id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } else if (studio_id) {
    const result = await apiCall('POST', '/api/screens/sync', { layout_id, studio_id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
  return { content: [{ type: 'text', text: 'Provide screen_id or studio_id' }], isError: true };
});

server.tool('push_overlay', 'Push an overlay to screen(s)', {
  screen_id: z.string().optional(),
  studio_id: z.string().optional(),
  overlay_type: z.string().describe('Overlay type (e.g. lower_third, breaking_news)'),
  overlay_data: z.string().describe('JSON overlay config'),
}, async ({ screen_id, studio_id, overlay_type, overlay_data }) => {
  // Use the API — overlays go through websocket
  const token = await getToken();
  // No direct REST for overlays, so we'll use a lightweight approach via the socket
  // Actually, let's create a helper endpoint or use direct emit pattern
  // For now, use the existing ws events via a small HTTP helper
  const overlay = { type: overlay_type, ...JSON.parse(overlay_data) };
  
  // We'll call the server's internal endpoint or construct an approach
  // Since there's no REST endpoint for overlays, let's add one approach:
  // Use fetch to a special endpoint we can add, or just describe the action
  const target = screen_id ? `screen:${screen_id}` : studio_id ? `studio:${studio_id}` : null;
  if (!target) return { content: [{ type: 'text', text: 'Provide screen_id or studio_id' }], isError: true };
  
  // For MCP, we'll make a POST to a utility endpoint
  const result = await apiCall('POST', '/api/screens/overlay', { screen_id, studio_id, overlay });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('clear_overlays', 'Clear overlays from screen(s)', {
  screen_id: z.string().optional(),
  studio_id: z.string().optional(),
}, async ({ screen_id, studio_id }) => {
  const result = await apiCall('POST', '/api/screens/clear-overlays', { screen_id, studio_id });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('blackout', 'Push blackout to all screens in a studio', {
  studio_id: z.string().describe('Studio ID'),
}, async ({ studio_id }) => {
  // Find or create a blackout layout
  let blackout = db.prepare("SELECT id FROM layouts WHERE studio_id = ? AND name = 'Blackout'").get(studio_id);
  if (!blackout) {
    const id = uuidv4();
    db.prepare("INSERT INTO layouts (id, studio_id, name, grid_cols, grid_rows, modules, background) VALUES (?, ?, 'Blackout', 1, 1, '[]', '#000000')").run(id, studio_id);
    blackout = { id };
  }
  const result = await apiCall('POST', '/api/screens/sync', { layout_id: blackout.id, studio_id });
  return { content: [{ type: 'text', text: JSON.stringify({ message: 'Blackout applied', ...result }, null, 2) }] };
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
