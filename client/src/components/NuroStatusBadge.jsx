/**
 * NuroStatusBadge.jsx
 *
 * Shows the Nuro hub connection status in the sidebar.
 * Polls GET /api/health once on mount, then again every 60 s.
 * Reads NURO_HUB_URL through the manifest endpoint so the
 * client never needs direct access to the hub.
 *
 * States:
 *   connected   — hub responded / /api/health ok
 *   standalone  — server returned standalone-mode (no NURO_HUB_URL)
 *   error       — fetch failed or server unreachable
 *   loading     — initial check in progress
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function checkNuroStatus() {
  try {
    const token = localStorage.getItem('broadcast_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Check our own health first
    const healthRes = await fetch(`${API_BASE}/api/health`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!healthRes.ok) return { state: 'error', label: 'Studio offline' };

    // Check Nuro manifest to see if hub integration is active
    const nuroRes = await fetch(`${API_BASE}/api/nuro`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!nuroRes.ok) return { state: 'standalone', label: 'Standalone' };

    const manifest = await nuroRes.json();
    const hasHub = manifest?.capabilities?.includes('telemetry');

    if (!hasHub) {
      return { state: 'standalone', label: 'Standalone' };
    }

    return {
      state:  'connected',
      label:  'Nuro connected',
      streams: manifest.streams || [],
    };
  } catch {
    return { state: 'error', label: 'Nuro unreachable' };
  }
}

export default function NuroStatusBadge() {
  const [status, setStatus] = useState({ state: 'loading', label: 'Checking…' });

  const refresh = useCallback(() => {
    checkNuroStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const colors = {
    loading:    'bg-gray-800/60 text-gray-500',
    connected:  'bg-emerald-500/10 text-emerald-400',
    standalone: 'bg-gray-700/40 text-gray-500',
    error:      'bg-red-500/10 text-red-400',
  };

  const dot = {
    loading:    'bg-gray-600 animate-pulse',
    connected:  'bg-emerald-400',
    standalone: 'bg-gray-600',
    error:      'bg-red-500',
  };

  const ping = status.state === 'connected';

  return (
    <div
      title={
        status.state === 'connected'
          ? 'Nuro hub is reachable and receiving heartbeats'
          : status.state === 'standalone'
            ? 'Running in standalone mode — NURO_HUB_URL not configured'
            : status.state === 'error'
              ? 'Cannot reach Nuro hub — check NURO_HUB_URL'
              : 'Checking Nuro status…'
      }
      className={`mx-3 mt-1 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-default select-none transition-colors ${colors[status.state]}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {ping && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dot[status.state]}`} />
      </span>
      <span className="truncate">
        {status.state === 'connected' ? '⬡ Nuro' : status.label}
      </span>
    </div>
  );
}
