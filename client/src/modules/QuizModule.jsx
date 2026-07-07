import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// QuizCast integration — https://quiz.wispayr.online
//
// First-class module for the live audience quiz. Two modes:
//   • screen (default) — embeds QuizCast's server-authoritative big-screen view
//     (`/screen?code=XXXXX`), which drives itself lobby → question → reveal →
//     leaderboard → podium and shows the join QR + code during the lobby.
//   • join — a self-contained "scan to join" card (offline QR, no external API).
//
// Code resolution: set `code` to pin a fixed session, OR set `quizId` and the
// module auto-fetches that quiz's live session code from /api/host/.../active
// (polled), so the screen/join follow whatever session the host has open.

const DEFAULT_BASE = 'https://quiz.wispayr.online';

function normaliseBase(base) {
  const b = (base || DEFAULT_BASE).trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(b) ? b : `https://${b}`;
}

export default function QuizModule({ config = {} }) {
  const base = normaliseBase(config.base || config.url);
  const explicitCode = String(config.code || '').toUpperCase().trim();
  const quizId = config.quizId || '';
  const [liveCode, setLiveCode] = useState('');
  const [liveSession, setLiveSession] = useState('');

  // Auto-resolve the active session (code + id) when a quizId is set.
  useEffect(() => {
    if (!quizId) return undefined;
    let abort = false;
    const poll = () => {
      fetch(`${base}/api/host/quiz/${encodeURIComponent(quizId)}/active`)
        .then((r) => r.json())
        .then((d) => { if (!abort) { setLiveCode(String(d.code || '').toUpperCase()); setLiveSession(String(d.sessionId || '')); } })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => { abort = true; clearInterval(t); };
  }, [base, quizId]);

  const code = explicitCode || liveCode;
  const mode = ['join', 'host'].includes(config.mode) ? config.mode : 'screen';

  // ── Host control panel (embeds QuizCast's host page for the live session) ──
  if (mode === 'host') {
    const sid = config.sessionId || liveSession;
    if (!sid) {
      return (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-2 text-center px-6">
          <span className="text-4xl">🎛️</span>
          <span className="text-gray-300 text-base font-semibold">Quiz Host</span>
          <span className="text-gray-600 text-sm">No live session — press “Quiz: Lobby” to open one. (Sign in to QuizCast once if prompted.)</span>
        </div>
      );
    }
    return (
      <div className="w-full h-full bg-black">
        <iframe
          src={`${base}/host/${encodeURIComponent(sid)}`}
          className="w-full h-full border-0"
          title={`QuizCast Host ${sid}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  if (!code) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-2 text-center px-6">
        <span className="text-4xl">🎯</span>
        <span className="text-gray-300 text-base font-semibold">QuizCast</span>
        <span className="text-gray-600 text-sm">
          {quizId ? 'Waiting for a live session — press “Quiz: Lobby” on the console.' : 'No join code set — start a session in QuizCast and enter its code.'}
        </span>
      </div>
    );
  }

  if (mode === 'screen') {
    return (
      <div className="w-full h-full bg-black">
        <iframe
          src={`${base}/screen?code=${encodeURIComponent(code)}`}
          className="w-full h-full border-0"
          title={`QuizCast ${code}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  // ── Standalone "scan to join" card (SideLiners palette by default) ──
  const accent = config.accent || '#ffd24a';
  const bg = config.background || '#171026';
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
        <QRCodeSVG value={joinUrl} size={Math.min(config.qrSize || 340, 480)} fgColor="#171026" level="M" />
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

function shade(hex, amt) {
  const m = /^#?([\da-f]{6})$/i.exec(hex || '');
  if (!m) return '#241a40';
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * (amt / 100));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}
