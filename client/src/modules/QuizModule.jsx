import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// QuizCast integration — https://quiz.wispayr.online
//
// First-class module for the live audience quiz. Two modes:
//   • screen (default) — embeds QuizCast's server-authoritative big-screen view
//     (`/screen?code=XXXXX`). That view drives itself through lobby → question →
//     reveal → leaderboard → podium and already shows the join QR + code during
//     the lobby. Drop this on a venue screen and it just follows the host.
//   • join — a self-contained "scan to join" card (offline QR via qrcode.react,
//     no external API) the operator can cut to as a standby/lobby holding screen
//     before the host opens the game.
//
// The join `code` is the 5-char session code minted by QuizCast when the host
// starts a session. It can be set in the layout or pushed live from the Live
// Mode "Quiz" panel (update_module_config → ModuleRenderer merges it in).

const DEFAULT_BASE = 'https://quiz.wispayr.online';

function normaliseBase(base) {
  const b = (base || DEFAULT_BASE).trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(b) ? b : `https://${b}`;
}

export default function QuizModule({ config = {} }) {
  const code = String(config.code || '').toUpperCase().trim();
  const base = normaliseBase(config.base || config.url);
  const mode = config.mode === 'join' ? 'join' : 'screen';

  if (!code) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-2 text-center px-6">
        <span className="text-4xl">🎯</span>
        <span className="text-gray-300 text-base font-semibold">QuizCast</span>
        <span className="text-gray-600 text-sm">No join code set — start a session in QuizCast and enter its code.</span>
      </div>
    );
  }

  // ── Big-screen game view ──
  if (mode === 'screen') {
    return (
      <div className="w-full h-full bg-black">
        <iframe
          src={`${base}/screen?code=${encodeURIComponent(code)}`}
          className="w-full h-full border-0"
          title={`QuizCast ${code}`}
          // Cross-origin first-party app: keep its own origin so Socket.IO,
          // localStorage and fonts work. allow-fullscreen for podium moments.
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  // ── Standalone "scan to join" card ──
  const accent = config.accent || '#5b8cff';
  const bg = config.background || '#0b1020';
  const joinUrl = `${base}/play/?code=${encodeURIComponent(code)}`;
  const hostLabel = base.replace(/^https?:\/\//, '');
  const heading = config.label || 'Join the Quiz';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-8 p-8 text-center"
      style={{ background: `radial-gradient(1200px 800px at 50% -10%, ${shade(bg, 18)}, ${bg})`, color: '#fff' }}
    >
      <div className="text-5xl font-black tracking-tight" style={{ color: accent }}>{heading}</div>

      <div className="bg-white rounded-2xl p-6 shadow-2xl">
        <QRCodeSVG value={joinUrl} size={Math.min(config.qrSize || 340, 480)} fgColor="#0b1020" level="M" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-2xl opacity-80">
          Go to <span className="font-bold">{hostLabel}/play</span>
        </div>
        <div className="text-xl opacity-60">and enter code</div>
        <div className="text-6xl font-black tracking-[0.3em] mt-1" style={{ color: accent }}>{code}</div>
      </div>
    </div>
  );
}

// Lighten a hex colour toward white (mirrors QuizCast's own Screen styling).
function shade(hex, amt) {
  const m = /^#?([\da-f]{6})$/i.exec(hex || '');
  if (!m) return '#1a2350';
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * (amt / 100));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}
