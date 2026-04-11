import React, { useState, useEffect, useRef } from 'react';

// ── QR code via free API (no login needed, no JS dependency) ──────────────────
function QRCode({ url, size = 150 }) {
  const encoded = encodeURIComponent(url);
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=111827&color=FFFFFF&margin=2`}
      alt="QR Code"
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', borderRadius: 8 }}
    />
  );
}

// ── Copy URL button ────────────────────────────────────────────────────────────
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy URL"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        copied
          ? 'bg-green-500/20 text-green-400 border-green-500/30'
          : 'bg-gray-800/80 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy URL
        </>
      )}
    </button>
  );
}

// ── Individual screen card ─────────────────────────────────────────────────────
function ScreenCard({ screen, baseUrl }) {
  const [showQR, setShowQR] = useState(false);
  const playerUrl = `${baseUrl}/screen/${screen.id}`;
  const isOnline = screen.is_online === 1 || screen.is_online === true;

  function handleLaunch() {
    window.open(playerUrl, '_blank', 'noopener,noreferrer');
  }

  function handleKiosk() {
    const w = window.open(
      playerUrl,
      `screen_${screen.id}`,
      'toolbar=no,scrollbars=no,location=no,status=no,menubar=no,resizable=yes'
    );
    if (w) {
      setTimeout(() => {
        try { w.document.documentElement.requestFullscreen?.(); } catch {}
      }, 1500);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-200 flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0 mt-px">
            {isOnline ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
              </>
            ) : (
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-gray-700" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{screen.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">Screen #{screen.screen_number}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
          isOnline ? 'bg-green-500/15 text-green-400' : 'bg-gray-800 text-gray-500'
        }`}>
          {isOnline ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-3 flex-1">
        {/* Layout */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
          </svg>
          {screen.layout_name
            ? <span className="text-gray-300 truncate">{screen.layout_name}</span>
            : <span className="text-gray-600 italic">No layout assigned</span>
          }
        </div>

        {/* Last seen */}
        {screen.last_seen && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last seen {new Date(screen.last_seen).toLocaleTimeString()}
          </div>
        )}

        {/* URL row */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-950 border border-gray-800">
          <span className="text-gray-600 text-xs truncate flex-1 font-mono select-all">{playerUrl}</span>
          <CopyButton value={playerUrl} />
        </div>

        {/* QR Code */}
        {showQR && (
          <div className="flex justify-center py-1">
            <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-center">
              <QRCode url={playerUrl} size={140} />
              <p className="text-gray-600 text-[10px] mt-2">Scan to open on any device</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex items-center gap-2">
        {/* Primary: launch */}
        <button
          id={`deploy-launch-${screen.id}`}
          onClick={handleLaunch}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Launch Player
        </button>

        {/* Fullscreen kiosk */}
        <button
          id={`deploy-kiosk-${screen.id}`}
          onClick={handleKiosk}
          title="Open frameless kiosk window"
          className="p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        {/* QR */}
        <button
          id={`deploy-qr-${screen.id}`}
          onClick={() => setShowQR(q => !q)}
          title="Show QR code"
          className={`p-2.5 rounded-xl border transition-all ${
            showQR
              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main Deploy page ───────────────────────────────────────────────────────────
export default function Deploy() {
  const [screens, setScreens] = useState([]);
  const [studios, setStudios] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  async function loadScreens() {
    try {
      // Public endpoint — no auth token needed
      const res = await fetch('/api/screens/deploy');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const list = await res.json();
      setScreens(list);
      const grouped = {};
      for (const s of list) {
        const key = s.studio_name || 'Studio';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      }
      setStudios(grouped);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScreens();
    intervalRef.current = setInterval(loadScreens, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const totalOnline = screens.filter(s => s.is_online === 1 || s.is_online === true).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
              B
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Broadcast Studio</h1>
              <p className="text-[11px] text-gray-500">Venue Deploy</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Online count */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-800 border border-gray-700">
              <span className="relative flex h-2 w-2">
                {totalOnline > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${totalOnline > 0 ? 'bg-green-400' : 'bg-gray-600'}`} />
              </span>
              <span className="text-xs font-medium text-gray-300">
                {loading ? '—' : `${totalOnline} / ${screens.length}`} online
              </span>
            </div>

            {/* Refresh */}
            <button
              onClick={loadScreens}
              title="Refresh"
              className="p-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-500 hover:text-white hover:border-gray-600 transition-all"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Link back to control panel */}
            <a
              href="/control"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-all text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Control Panel
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Intro */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white">Screen Players</h2>
          <p className="text-gray-500 text-sm mt-1">
            Open a player on any screen — tap <strong className="text-gray-300">Launch Player</strong> from that machine, or scan the QR code.
          </p>
        </div>

        {/* Venue tip */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/20 mb-8">
          <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-blue-300 text-xs leading-relaxed">
            <strong>Venue setup:</strong> On the screen machine, open this page and click <strong>Launch Player</strong>, then press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-blue-900/50 font-mono text-blue-200">F11</kbd> for fullscreen.
            Use the <strong>⛶</strong> button for a borderless kiosk window, or the <strong>QR code</strong> to launch from a phone or tablet.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            Could not load screens: {error}
          </div>
        )}

        {/* Loading */}
        {loading && screens.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-500 text-sm">Loading screens…</span>
            </div>
          </div>
        )}

        {/* Studios + screen grids */}
        {Object.entries(studios).map(([studioName, studioScreens]) => (
          <div key={studioName} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">{studioName}</h3>
              <span className="text-xs text-gray-600">{studioScreens.length} screen{studioScreens.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {studioScreens
                .sort((a, b) => (a.screen_number || 0) - (b.screen_number || 0))
                .map(screen => (
                  <ScreenCard key={screen.id} screen={screen} baseUrl={baseUrl} />
                ))}
            </div>
          </div>
        ))}

        {/* Empty */}
        {!loading && screens.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No screens configured yet</p>
            <a href="/control/screens" className="text-blue-400 text-sm mt-2 hover:text-blue-300 transition-colors">
              Add screens in the Control Panel →
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
