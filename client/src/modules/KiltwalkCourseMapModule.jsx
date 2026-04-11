import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Kiltwalk Course Map — two modes:
 *   overview:  Full route with walker bubbles (original)
 *   flyover:   Cinematic auto-pan along the route, zooming into checkpoints
 */

const ROUTES = {
  mighty: {
    name: 'Mighty Stride', distance: '23 miles', color: '#e63b2b',
    start: 'Glasgow Green', startTime: '08:00', avgPaceMinPerMile: 20,
    points: [
      [55.8492, -4.2368],[55.8558, -4.2720],[55.8603, -4.2985],[55.8649, -4.3195],
      [55.8694, -4.3552],[55.8755, -4.3890],[55.8801, -4.4120],[55.8950, -4.4350],
      [55.9110, -4.4720],[55.9230, -4.4950],[55.9350, -4.4980],[55.9430, -4.5250],
      [55.9480, -4.5560],[55.9510, -4.5780],[55.9590, -4.5920],[55.9650, -4.5830],
      [55.9870, -4.5830],[55.9920, -4.5780],
    ],
  },
  big: {
    name: 'Big Stroll', distance: '14.5 miles', color: '#008bc7',
    start: 'Clydebank', startTime: '09:00', avgPaceMinPerMile: 22,
    points: [
      [55.8950, -4.4350],[55.9110, -4.4720],[55.9230, -4.4950],[55.9350, -4.4980],
      [55.9430, -4.5250],[55.9480, -4.5560],[55.9510, -4.5780],[55.9590, -4.5920],
      [55.9650, -4.5830],[55.9870, -4.5830],[55.9920, -4.5780],
    ],
  },
  wee: {
    name: 'Wee Wander', distance: '3 miles', color: '#006a47',
    start: 'Loch Lomond Shores', startTime: '10:00', avgPaceMinPerMile: 25,
    points: [
      [55.9870, -4.5830],[55.9890, -4.5810],[55.9900, -4.5790],[55.9910, -4.5780],[55.9920, -4.5780],
    ],
  },
};

const CHECKPOINTS = [
  { name: 'Glasgow Green', sub: 'Mighty Stride Start', lat: 55.8492, lng: -4.2368, icon: '🏁', zoomDwell: 3 },
  { name: 'The Hydro', sub: 'Water Station', lat: 55.8649, lng: -4.3195, icon: '💧', zoomDwell: 2 },
  { name: 'Clydebank', sub: 'Big Stroll Start', lat: 55.8950, lng: -4.4350, icon: '🏁', zoomDwell: 3 },
  { name: 'Bowling Basin', sub: 'Forth & Clyde Canal', lat: 55.9350, lng: -4.4980, icon: '💧', zoomDwell: 2 },
  { name: 'Dumbarton', sub: 'Castle View', lat: 55.9510, lng: -4.5780, icon: '🏰', zoomDwell: 2 },
  { name: 'Loch Lomond Shores', sub: 'Wee Wander Start', lat: 55.9870, lng: -4.5830, icon: '🏁', zoomDwell: 3 },
  { name: 'Moss O\'Balloch', sub: 'FINISH LINE', lat: 55.9920, lng: -4.5780, icon: '🏆', zoomDwell: 4 },
];

// Build a single continuous path for the flyover camera to follow (mighty route)
const FLYOVER_PATH = ROUTES.mighty.points;
const FLYOVER_DURATION = 60; // seconds for one full pass

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function getPointAlongPath(points, progress) {
  const idx = progress * (points.length - 1);
  const i = Math.floor(idx);
  const t = idx - i;
  if (i >= points.length - 1) return { lat: points[points.length - 1][0], lng: points[points.length - 1][1] };
  return {
    lat: lerp(points[i][0], points[i + 1][0], t),
    lng: lerp(points[i][1], points[i + 1][1], t),
  };
}

function getWalkerPosition(route, elapsedMinutes) {
  const totalMiles = parseFloat(route.distance);
  const progress = Math.min(elapsedMinutes / route.avgPaceMinPerMile / totalMiles, 1);
  return getPointAlongPath(route.points, progress);
}

// ── FLYOVER VIEW ──────────────────────────────────────────────────────

function FlyoverView({ config }) {
  const [progress, setProgress] = useState(0);
  const [nearCheckpoint, setNearCheckpoint] = useState(null);
  const duration = config.flyoverDuration || FLYOVER_DURATION;
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const startRef = useRef(null);

  // Animation loop
  useEffect(() => {
    startRef.current = performance.now();
    function tick(now) {
      const elapsed = (now - startRef.current) / 1000;
      const raw = (elapsed % (duration + 4)) / duration; // +4s pause at finish
      const p = Math.min(raw, 1);
      setProgress(p);

      // Check nearby checkpoint
      const cam = getPointAlongPath(FLYOVER_PATH, easeInOut(p));
      let closest = null;
      let closestDist = Infinity;
      for (const cp of CHECKPOINTS) {
        const d = Math.sqrt((cam.lat - cp.lat) ** 2 + (cam.lng - cp.lng) ** 2);
        if (d < 0.008 && d < closestDist) { closest = cp; closestDist = d; }
      }
      setNearCheckpoint(closest);
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [duration]);

  // Camera position with easing
  const cam = getPointAlongPath(FLYOVER_PATH, easeInOut(progress));

  // Viewport: zoom in more when near checkpoints
  const baseZoom = nearCheckpoint ? 0.015 : 0.035;
  const viewLat = cam.lat;
  const viewLng = cam.lng;

  // Project function for current viewport
  const W = 1200, H = 600;
  const project = (lat, lng) => {
    const x = ((lng - (viewLng - baseZoom * 2)) / (baseZoom * 4)) * W;
    const y = H - ((lat - (viewLat - baseZoom)) / (baseZoom * 2)) * H;
    return [x, y];
  };

  // Which route segments are visible
  const visibleRoutes = Object.entries(ROUTES).map(([key, route]) => {
    const d = route.points.map((p, i) => {
      const [x, y] = project(p[0], p[1]);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    return { key, route, d };
  });

  // Visible checkpoints
  const visibleCheckpoints = CHECKPOINTS.filter(cp => {
    const dlat = Math.abs(cp.lat - viewLat);
    const dlng = Math.abs(cp.lng - viewLng);
    return dlat < baseZoom * 1.5 && dlng < baseZoom * 3;
  });

  // Camera lookahead for direction indicator
  const ahead = getPointAlongPath(FLYOVER_PATH, Math.min(easeInOut(progress) + 0.05, 1));
  const bearing = Math.atan2(ahead.lng - cam.lng, ahead.lat - cam.lat) * 180 / Math.PI;

  return (
    <div className="w-full h-full relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0e1a 0%, #0f1729 50%, #1a1a2e 100%)' }}>
      <style>{`
        @keyframes cpLabelIn { from { opacity:0; transform:translateY(8px) scale(0.9); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes camPulse { 0%,100% { r:6; opacity:1; } 50% { r:10; opacity:0.6; } }
        @keyframes routeGlow { 0%,100% { stroke-opacity:0.15; } 50% { stroke-opacity:0.3; } }
        @keyframes scanline { 0% { transform:translateY(-100%); } 100% { transform:translateY(100%); } }
      `}</style>

      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div className="w-full h-1/2" style={{
          background: 'linear-gradient(transparent, rgba(128,206,244,0.3), transparent)',
          animation: 'scanline 4s linear infinite',
        }} />
      </div>

      {/* Header */}
      <div className="absolute top-3 left-4 z-20 flex items-center gap-3">
        <img src="/assets/kiltwalk/logo.svg" alt="" className="h-6 opacity-80" />
        <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/50">Course Flyover</span>
      </div>

      {/* Checkpoint label overlay */}
      {nearCheckpoint && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 text-center"
          style={{ animation: 'cpLabelIn 0.4s ease-out' }}>
          <div className="px-6 py-3 rounded-2xl backdrop-blur-md"
            style={{ background: 'rgba(10,14,26,0.85)', border: '1px solid rgba(248,175,53,0.3)' }}>
            <span className="text-3xl mr-3">{nearCheckpoint.icon}</span>
            <span className="text-2xl font-black text-white">{nearCheckpoint.name}</span>
            <span className="block text-sm text-white/50 mt-0.5">{nearCheckpoint.sub}</span>
          </div>
        </div>
      )}

      {/* SVG Map */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid overlay */}
        <defs>
          <pattern id="flyGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(128,206,244,0.05)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#flyGrid)" />

        {/* Route glow */}
        {visibleRoutes.map(({ key, route, d }) => (
          <path key={`glow-${key}`} d={d} fill="none" stroke={route.color} strokeWidth="20"
            strokeOpacity="0.1" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-opacity" values="0.08;0.18;0.08" dur="3s" repeatCount="indefinite" />
          </path>
        ))}

        {/* Route lines */}
        {visibleRoutes.map(({ key, route, d }) => (
          <path key={key} d={d} fill="none" stroke={route.color} strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.85" />
        ))}

        {/* Checkpoints */}
        {visibleCheckpoints.map((cp, i) => {
          const [x, y] = project(cp.lat, cp.lng);
          const isNear = nearCheckpoint?.name === cp.name;
          return (
            <g key={i}>
              {isNear && (
                <circle cx={x} cy={y} r="30" fill="none" stroke="#f8af35" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4">
                  <animate attributeName="r" values="25;40;25" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.15;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={x} cy={y} r={isNear ? 8 : 5} fill="#0a0e1a" stroke="#f8af35"
                strokeWidth={isNear ? 2.5 : 1.5} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={isNear ? '14' : '10'}>{cp.icon}</text>
              {!isNear && (
                <text x={x} y={y - 14} textAnchor="middle" fill="#ffffff" fontSize="10"
                  fontWeight="bold" opacity="0.5">{cp.name}</text>
              )}
            </g>
          );
        })}

        {/* Camera position indicator */}
        {(() => {
          const [cx, cy] = project(cam.lat, cam.lng);
          return (
            <g>
              <circle cx={cx} cy={cy} r="20" fill="rgba(248,175,53,0.08)">
                <animate attributeName="r" values="15;25;15" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={cx} cy={cy} r="4" fill="#f8af35" stroke="#fff" strokeWidth="2">
                <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
              </circle>
              {/* Direction arrow */}
              <line x1={cx} y1={cy}
                x2={cx + Math.sin(bearing * Math.PI / 180) * 20}
                y2={cy - Math.cos(bearing * Math.PI / 180) * 20}
                stroke="#f8af35" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
            </g>
          );
        })()}
      </svg>

      {/* Progress bar */}
      <div className="absolute bottom-12 left-8 right-8 z-10">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #e63b2b, #008bc7, #006a47)',
          }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] font-bold text-white/30">
          <span>Glasgow Green</span>
          <span>Clydebank</span>
          <span>Dumbarton</span>
          <span>Balloch</span>
        </div>
      </div>

      {/* Route legend */}
      <div className="absolute bottom-3 right-4 z-10 flex gap-3">
        {Object.entries(ROUTES).map(([key, route]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-1 rounded-full" style={{ background: route.color }} />
            <span className="text-[9px] font-bold text-white/40">{route.name}</span>
          </div>
        ))}
      </div>

      {/* Accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex">
        <div className="flex-1" style={{ background: '#e63b2b' }} />
        <div className="flex-1" style={{ background: '#008bc7' }} />
        <div className="flex-1" style={{ background: '#006a47' }} />
      </div>
    </div>
  );
}

// ── OVERVIEW VIEW (original) ──────────────────────────────────────────

function OverviewView({ config }) {
  const [now, setNow] = useState(new Date());
  const eventDate = config.eventDate || '2026-04-25';

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const allPts = Object.values(ROUTES).flatMap(r => r.points);
  const minLat = Math.min(...allPts.map(p => p[0])) - 0.005;
  const maxLat = Math.max(...allPts.map(p => p[0])) + 0.005;
  const minLng = Math.min(...allPts.map(p => p[1])) - 0.02;
  const maxLng = Math.max(...allPts.map(p => p[1])) + 0.02;

  const W = 1000, H = 500;
  const project = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * W;
    const y = H - ((lat - minLat) / (maxLat - minLat)) * H;
    return [x, y];
  };

  const routePaths = Object.entries(ROUTES).map(([key, route]) => {
    const d = route.points.map((p, i) => {
      const [x, y] = project(p[0], p[1]);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    return { key, route, d };
  });

  const eventStart = new Date(`${eventDate}T08:00:00`);
  const isEventDay = now.toISOString().slice(0, 10) === eventDate;
  const demoElapsed = isEventDay ? (now - eventStart) / 60000 : ((now.getHours() * 60 + now.getMinutes()) % 480);

  const walkerPositions = Object.entries(ROUTES).map(([key, route]) => {
    const startHour = parseInt(route.startTime.split(':')[0]);
    const routeElapsed = demoElapsed - (startHour - 8) * 60;
    if (routeElapsed < 0) return { key, route, pos: null };
    const pos = getWalkerPosition(route, routeElapsed);
    const progress = Math.min(routeElapsed / route.avgPaceMinPerMile / parseFloat(route.distance), 1);
    return { key, route, pos, progress, finished: progress >= 1 };
  });

  return (
    <div className="w-full h-full relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0e1a 0%, #0f1729 50%, #1a1a2e 100%)' }}>
      <div className="absolute top-3 left-4 z-10 flex items-center gap-3">
        <img src="/assets/kiltwalk/logo.svg" alt="" className="h-6 opacity-80" />
        <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/50">Course Map</span>
      </div>
      <div className="absolute top-3 right-4 z-10 flex gap-4">
        {Object.entries(ROUTES).map(([key, route]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-1 rounded-full" style={{ background: route.color }} />
            <span className="text-[10px] font-bold text-white/60">{route.name}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {routePaths.map(({ key, route, d }) => (
          <React.Fragment key={key}>
            <path d={d} fill="none" stroke={route.color} strokeWidth="12" strokeOpacity="0.12" strokeLinecap="round" />
            <path d={d} fill="none" stroke={route.color} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" />
          </React.Fragment>
        ))}
        {CHECKPOINTS.map((cp, i) => {
          const [x, y] = project(cp.lat, cp.lng);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="#0a0e1a" stroke="#f8af35" strokeWidth="1.5" />
              <text x={x} y={y - 10} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" opacity="0.6">{cp.name}</text>
            </g>
          );
        })}
        {walkerPositions.map(({ key, route, pos, progress, finished }) => {
          if (!pos) return null;
          const [x, y] = project(pos.lat, pos.lng);
          return (
            <g key={`w-${key}`}>
              <circle cx={x} cy={y} r="16" fill={route.color} opacity="0.12">
                <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="7" fill={route.color} stroke="#fff" strokeWidth="2" />
              <rect x={x + 12} y={y - 9} width="48" height="18" rx="4" fill={route.color} opacity="0.9" />
              <text x={x + 36} y={y + 3} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
                {finished ? '🏆' : `${Math.round(progress * 100)}%`}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 h-1 flex">
        <div className="flex-1" style={{ background: '#e63b2b' }} />
        <div className="flex-1" style={{ background: '#008bc7' }} />
        <div className="flex-1" style={{ background: '#006a47' }} />
      </div>
    </div>
  );
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────

export default function KiltwalkCourseMapModule({ config = {} }) {
  const mode = config.mode || 'flyover'; // 'overview' | 'flyover'
  if (mode === 'flyover') return <FlyoverView config={config} />;
  return <OverviewView config={config} />;
}
