import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ─── Icon library (inline SVG, lucide-style) ───
function Icon({ name, className = 'w-5 h-5' }) {
  const p = {
    monitors: (
      <>
        <rect x="3" y="4" width="13" height="9" rx="1.5" />
        <rect x="10" y="10" width="11" height="8" rx="1.5" />
        <path d="M9 17h4" />
      </>
    ),
    zap: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
    mixer: (
      <>
        <rect x="3" y="3" width="18" height="14" rx="1.5" />
        <path d="M3 13h18" />
        <path d="M8 17v4" />
        <path d="M16 17v4" />
        <circle cx="7" cy="8" r="1.2" />
        <circle cx="12" cy="8" r="1.2" />
        <circle cx="17" cy="8" r="1.2" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    blocks: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
      </>
    ),
    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
        <path d="M10 21v-3h4v3" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
        <path d="m3 18 9 5 9-5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    tv: (
      <>
        <rect x="2" y="5" width="20" height="13" rx="1.5" />
        <path d="M7 21h10" />
        <path d="M12 18v3" />
      </>
    ),
    clapper: (
      <>
        <path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
        <path d="m3 9 2-5 4 1-2 4" />
        <path d="m9 5 4 1-2 4" />
        <path d="m13 6 4 1-2 4" />
      </>
    ),
    waveform: (
      <>
        <path d="M2 12h2" />
        <path d="M6 8v8" />
        <path d="M10 5v14" />
        <path d="M14 8v8" />
        <path d="M18 10v4" />
        <path d="M22 12h-2" />
      </>
    ),
    server: (
      <>
        <rect x="3" y="4" width="18" height="7" rx="1.5" />
        <rect x="3" y="13" width="18" height="7" rx="1.5" />
        <circle cx="7" cy="7.5" r="0.8" fill="currentColor" />
        <circle cx="7" cy="16.5" r="0.8" fill="currentColor" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </>
    ),
    speaker: (
      <>
        <path d="M3 9v6h4l5 4V5L7 9H3Z" />
        <path d="M16 8a5 5 0 0 1 0 8" />
        <path d="M19 5a9 9 0 0 1 0 14" />
      </>
    ),
    trophy: (
      <>
        <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
        <path d="M6 6H3v2a3 3 0 0 0 3 3" />
        <path d="M18 6h3v2a3 3 0 0 1-3 3" />
        <path d="M10 14v3h4v-3" />
        <path d="M8 21h8" />
      </>
    ),
    building2: (
      <>
        <rect x="3" y="7" width="8" height="14" rx="1" />
        <rect x="11" y="3" width="10" height="18" rx="1" />
        <path d="M14 7h1M18 7h1M14 11h1M18 11h1M14 15h1M18 15h1" />
        <path d="M6 11h1M6 15h1" />
      </>
    ),
    radio: (
      <>
        <path d="M4 10a10 10 0 0 1 16 0" />
        <path d="M7 13a6 6 0 0 1 10 0" />
        <circle cx="12" cy="18" r="2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h10" />
        <path d="M18 6h2" />
        <circle cx="16" cy="6" r="2" />
        <path d="M4 12h2" />
        <path d="M10 12h10" />
        <circle cx="8" cy="12" r="2" />
        <path d="M4 18h14" />
        <path d="M20 18h0" />
        <circle cx="20" cy="18" r="1.5" />
      </>
    ),
    palette: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18c1 0 1.8-.8 1.8-1.8 0-.6-.3-1.1-.7-1.5-.4-.4-.7-.9-.7-1.5 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.8-4-6.4-9-6.4Z" />
        <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" />
        <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
        <circle cx="16.5" cy="10.5" r="1.1" fill="currentColor" />
      </>
    ),
    cpu: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {p[name]}
    </svg>
  );
}

// ─── Animated grid background ───
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
    </div>
  );
}

// ─── Control panel mockup ───
function ControlPanelMockup() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(iv);
  }, []);

  const screens = [
    { name: 'Presenter · Studio A', layout: 'News — Hero' },
    { name: 'Guest Monitor',        layout: 'Lower third' },
    { name: 'Foyer LED',            layout: 'Now playing' },
  ];
  const active = tick % screens.length;

  const layoutCells = [
    // Presenter: hero + ticker
    [{ c: 3, r: 2, t: 'HERO'   }, { c: 3, r: 1, t: 'TICKER' }],
    // Guest: split
    [{ c: 1, r: 3, t: 'CLOCK'  }, { c: 2, r: 2, t: 'LT'     }, { c: 2, r: 1, t: 'CUE' }],
    // LED: full
    [{ c: 3, r: 3, t: 'NOW'    }],
  ];

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="bg-gray-900/70 border border-gray-800/70 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/5 backdrop-blur-sm">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/70">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-gray-500 text-xs ml-2 font-mono">
            broadcast.studio.wispayr.online / dashboard
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-[11px] font-mono tracking-wide">ON AIR</span>
          </div>
        </div>

        {/* Screens grid */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {screens.map((s, i) => (
              <div
                key={s.name}
                className={`rounded-lg border transition-all duration-500 ${
                  i === active
                    ? 'border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'border-gray-800/80'
                }`}
              >
                <div className="aspect-video bg-gray-950 rounded-t-lg overflow-hidden relative">
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-px p-1">
                    {layoutCells[i].map((cell, j) => (
                      <div
                        key={j}
                        className={`rounded-[2px] flex items-center justify-center font-mono text-[7px] tracking-wider transition-colors duration-500 ${
                          i === active
                            ? 'bg-blue-900/30 text-blue-300'
                            : 'bg-gray-800/60 text-gray-600'
                        }`}
                        style={{
                          gridColumn: `span ${cell.c}`,
                          gridRow: `span ${cell.r}`,
                        }}
                      >
                        {cell.t}
                      </div>
                    ))}
                  </div>
                  {i === active && (
                    <div className="absolute top-1 right-1">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-medium truncate">
                    {s.name}
                  </span>
                  <span className="text-[9px] text-gray-600 font-mono truncate">
                    {s.layout}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline / hotbar */}
          <div className="mt-3 flex items-center gap-1.5 px-1">
            <span className="text-[9px] text-gray-600 font-mono tracking-wider pr-2">
              CUES
            </span>
            {['News — Hero', 'Lower third', 'Now playing', 'Sponsor', '⬛ Blackout'].map(
              (name, i) => (
                <div
                  key={name}
                  className={`flex-1 py-1.5 rounded text-center text-[10px] font-medium border transition-all ${
                    i === active
                      ? 'bg-green-900/30 border-green-500/40 text-green-300'
                      : name === '⬛ Blackout'
                      ? 'bg-gray-950 border-red-900/40 text-red-500/80'
                      : 'bg-gray-800/40 border-gray-700/40 text-gray-500'
                  }`}
                >
                  {name}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cards ───
function FeatureCard({ icon, title, description }) {
  return (
    <div className="group bg-gray-900/40 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700 hover:bg-gray-900/60 transition-all duration-300">
      <div className="w-10 h-10 rounded-lg bg-gray-800/60 border border-gray-700/50 flex items-center justify-center text-gray-300 group-hover:text-blue-400 group-hover:border-blue-500/40 transition-colors mb-4">
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <h3 className="text-white font-semibold text-[15px] mb-1.5">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function UseCaseCard({ icon, title, description }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-900/40 transition-colors">
      <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-900/80 border border-gray-800 flex items-center justify-center text-gray-400">
        <Icon name={icon} className="w-4.5 h-4.5" />
      </div>
      <div>
        <h4 className="text-white font-semibold text-[15px] mb-1">{title}</h4>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StatCounter({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-white font-mono">{value}</div>
      <div className="text-gray-500 text-xs md:text-sm mt-1 tracking-wide">{label}</div>
    </div>
  );
}

function CapabilityCard({ icon, title, features }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 hover:border-gray-700 transition-all">
      <div className="w-10 h-10 rounded-lg bg-gray-800/60 border border-gray-700/50 flex items-center justify-center text-blue-400 mb-4">
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
            <svg
              className="w-4 h-4 text-green-400 mt-0.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 5 5 9-11" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Landing() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* ═══ Navigation ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">
              Broadcast Studio
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white text-sm transition-colors">
              Features
            </a>
            <a href="#use-cases" className="text-gray-400 hover:text-white text-sm transition-colors">
              Use cases
            </a>
            <a href="#stack" className="text-gray-400 hover:text-white text-sm transition-colors">
              Stack
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 bg-white text-gray-950 hover:bg-gray-100 text-sm font-semibold rounded-lg transition-all"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24">
        <GridBackground />
        <div className="relative max-w-7xl mx-auto px-6">
          {/* Live badge */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-900/60 border border-gray-800 rounded-full px-4 py-1.5 flex items-center gap-3 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-300 text-xs font-mono">
                {time.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="text-gray-700 text-xs">·</span>
              <span className="text-gray-400 text-xs tracking-wide">Live system</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-center mb-6 tracking-tight leading-[0.98]">
            Screen control,
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              built for live.
            </span>
          </h1>

          <p className="text-base md:text-lg text-gray-400 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            One dashboard, many screens. Push layouts, run timelines, cut between cues —
            over WebSocket, in real time.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link
              to="/login"
              className="px-7 py-3.5 bg-white text-gray-950 hover:bg-gray-100 font-semibold rounded-xl transition-all text-[15px] text-center"
            >
              Open dashboard
            </Link>
            <a
              href="#features"
              className="px-7 py-3.5 bg-gray-900/60 hover:bg-gray-900 text-white font-semibold rounded-xl border border-gray-800 transition-all text-[15px] text-center backdrop-blur-sm"
            >
              See what it does
            </a>
          </div>

          <ControlPanelMockup />
        </div>
      </section>

      {/* ═══ Stats bar (verified figures only) ═══ */}
      <section className="border-y border-gray-800/60 bg-gray-900/20 py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value="44" label="Module types" />
          <StatCounter value="6" label="Transition modes" />
          <StatCounter value="4" label="Access roles" />
          <StatCounter value="WS" label="Real-time push" />
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Everything a live show needs on screen
            </h2>
            <p className="text-gray-500 text-[15px] max-w-2xl mx-auto">
              From a single monitor to a venue-wide LED wall — one control surface, one source of truth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon="monitors"
              title="Multi-screen control"
              description="Every screen, one dashboard. Push a layout to one or all, see online status live."
            />
            <FeatureCard
              icon="zap"
              title="WebSocket push"
              description="Layout changes hit connected screens instantly. No polling, no refreshes, no delay."
            />
            <FeatureCard
              icon="mixer"
              title="God View mixer"
              description="PVW / PGM, TAKE / CUT, overlay panel, keyboard shortcuts, audio meter — a proper broadcast console."
            />
            <FeatureCard
              icon="grid"
              title="Grid-based layouts"
              description="Drag, resize, and snap modules onto a grid. Save, re-order, share between studios."
            />
            <FeatureCard
              icon="blocks"
              title="44 module types"
              description="Clocks, tickers, weather, autocue, cameras, Remotion compositions, Prism lenses, iframes — pick and place."
            />
            <FeatureCard
              icon="building"
              title="Multi-tenant studios"
              description="Isolated tenants with their own screens, layouts, users and media. Super admin oversees everything."
            />
            <FeatureCard
              icon="layers"
              title="Live overlays"
              description="Lower thirds, tickers, announcements — drop them in and pull them out without changing the underlying layout."
            />
            <FeatureCard
              icon="shield"
              title="Role-based access"
              description="Super admin, admin, producer, viewer. JWT auth, rate-limited login, SSRF-guarded proxies."
            />
            <FeatureCard
              icon="tv"
              title="LED wall friendly"
              description="Custom resolutions, projection mapping, graceful disconnect. If a screen drops, it goes dark — not red."
            />
            <FeatureCard
              icon="clapper"
              title="Remotion compositions"
              description="Render React-based motion graphics in real time. Stingers, lower thirds, bumpers, opener packages."
            />
            <FeatureCard
              icon="waveform"
              title="Audio visualiser"
              description="Capture system audio or mic and broadcast FFT data to screen modules for reactive visuals."
            />
            <FeatureCard
              icon="server"
              title="Self-hosted"
              description="Node + SQLite. One directory, one process. Deploy on your own box, own your data."
            />
          </div>
        </div>
      </section>

      {/* ═══ Use cases ═══ */}
      <section id="use-cases" className="py-20 bg-gray-900/20 border-y border-gray-800/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Built for the room it&apos;s in
            </h2>
            <p className="text-gray-500 text-[15px]">
              From a tablet-run worship service to a stadium-scale ops wall.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <UseCaseCard
              icon="mic"
              title="Live events & conferences"
              description="Pre-programmed timelines, on-the-fly layout cuts, sponsor rotations. Run a show from one laptop."
            />
            <UseCaseCard
              icon="speaker"
              title="Church & worship services"
              description="Lyrics, announcements, camera feeds, countdowns. Everything a volunteer team needs to run a service."
            />
            <UseCaseCard
              icon="trophy"
              title="Sports venues & stadiums"
              description="Scoreboards, replays, sponsor loops, emergency messaging. Unified control across a venue."
            />
            <UseCaseCard
              icon="building2"
              title="Corporate digital signage"
              description="Lobby, meeting rooms, cafeteria boards. Update everywhere from one place, remotely."
            />
            <UseCaseCard
              icon="radio"
              title="Broadcast studios"
              description="Presenter monitors, guest displays, autocue, clocks, tally states. Full studio control surface."
            />
            <UseCaseCard
              icon="eye"
              title="Ops & control rooms"
              description="Multi-feed monitoring walls, alert tickers, dashboards. Purpose-built for 24/7 operations."
            />
          </div>
        </div>
      </section>

      {/* ═══ Stack / capabilities ═══ */}
      <section id="stack" className="py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Transparent by design
            </h2>
            <p className="text-gray-500 text-[15px]">
              No black boxes. Here&apos;s what&apos;s actually inside.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <CapabilityCard
              icon="sliders"
              title="Control surface"
              features={[
                'Multi-screen dashboard',
                'God View broadcast mixer',
                'Timeline sequencer',
                'Autocue controller',
                'Keyboard shortcuts',
              ]}
            />
            <CapabilityCard
              icon="palette"
              title="Content"
              features={[
                '44 module types, 6 categories',
                '6 transition modes',
                'Live overlay panel',
                'Audio visualiser',
                'Remotion compositions',
              ]}
            />
            <CapabilityCard
              icon="cpu"
              title="Infrastructure"
              features={[
                'Node.js + Express + Socket.IO',
                'SQLite (better-sqlite3)',
                'JWT auth + role guards',
                'SSRF-guarded proxy layer',
                'Self-hosted, one process',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section className="py-20 border-t border-gray-800/40">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
            Ready to take control?
          </h2>
          <p className="text-gray-400 text-[15px] mb-8">
            Sign in and open the dashboard — or host your own instance.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3.5 bg-white text-gray-950 hover:bg-gray-100 font-semibold rounded-xl transition-all text-[15px]"
          >
            Open dashboard
          </Link>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-gray-800/60 py-10 bg-gray-900/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">B</span>
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Broadcast Studio</div>
                <div className="text-gray-500 text-xs">
                  broadcast.studio.wispayr.online
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <a href="#features" className="text-gray-500 hover:text-gray-300 transition-colors">
                Features
              </a>
              <a href="#use-cases" className="text-gray-500 hover:text-gray-300 transition-colors">
                Use cases
              </a>
              <a href="#stack" className="text-gray-500 hover:text-gray-300 transition-colors">
                Stack
              </a>
              <Link to="/login" className="text-gray-500 hover:text-gray-300 transition-colors">
                Sign in
              </Link>
            </div>
          </div>

          <div className="border-t border-gray-800/60 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-gray-600 text-xs">
              © {new Date().getFullYear()} Broadcast Studio ·{' '}
              <a href="https://wispayr.online" className="hover:text-gray-400 transition-colors">
                wispayr.online
              </a>
            </p>
            <p className="text-gray-700 text-xs font-mono">v1.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
