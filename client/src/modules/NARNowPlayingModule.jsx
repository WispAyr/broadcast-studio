import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

// ──────────────────────────────────────────────────────────────────────────
// nar_nowplaying — live now-playing for Now Ayrshire Radio.
// Polls /api/nowplaying/<stationId> (broadcast.radio, station 7719) and also
// accepts instant pushes via socket `update_module_config` { nowPlaying }.
// Spinning-vinyl aesthetic echoing the NARNowPlaying Remotion composition.
// Variants: 'vinyl' (default, big), 'card' (compact), 'bar' (lower-third strip).
// ──────────────────────────────────────────────────────────────────────────

function fmtElapsed(startedAt) {
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function NARNowPlayingModule({ config = {} }) {
  const {
    stationId = 7719, moduleId = 'now-playing',
    accent = '#F7941D', accent2 = '#E2392D', background = '#1E2A35',
    variant = 'vinyl', refreshMs = 12000, showHistory = true, showShow = true,
  } = config;

  const [np, setNp] = useState(null);
  const [, tick] = useState(0);
  const [artOk, setArtOk] = useState(true);
  const mounted = useRef(true);

  // Poll the feed
  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/nowplaying/${stationId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (mounted.current) { setNp(d); setArtOk(true); }
      } catch {}
    };
    load();
    const t = setInterval(load, refreshMs);
    return () => { mounted.current = false; clearInterval(t); };
  }, [stationId, refreshMs]);

  // Instant pushes from the console "Now / Next" button
  useEffect(() => {
    let s;
    try {
      s = getSocket();
      const onCfg = (msg) => {
        if (msg?.moduleId === moduleId && msg?.config?.nowPlaying) { setNp(msg.config.nowPlaying); setArtOk(true); }
      };
      s.on('update_module_config', onCfg);
      return () => s.off('update_module_config', onCfg);
    } catch {}
  }, [moduleId]);

  // 1s repaint for the elapsed clock
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const elapsed = fmtElapsed(np?.startedAt);
  const hasArt = artOk && np?.artwork;
  const showLine = showShow && np?.onAir;
  const isIdent = np && (np.offAir || (!np.isMusic && !np.title));

  const eqBars = Array.from({ length: 5 });

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center"
      style={{ background: `radial-gradient(120% 120% at 25% 20%, ${accent}18, ${background} 55%)`, color: '#fff', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>
      <style>{`
        @keyframes narVinylSpin { to { transform: rotate(360deg); } }
        @keyframes narEq { 0%,100%{ transform: scaleY(0.4);} 50%{ transform: scaleY(1);} }
        @keyframes narGlow { 0%,100%{ opacity:.5;} 50%{ opacity:.85;} }
      `}</style>

      {/* Ambient art glow */}
      {hasArt && <img src={np.artwork} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(60px) saturate(1.4)', opacity: 0.35, transform: 'scale(1.2)' }} />}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.55))' }} />

      <div className={`relative z-10 flex items-center w-full ${variant === 'bar' ? 'gap-4 px-5' : 'gap-6 p-6'}`}>
        {/* Vinyl / artwork */}
        {variant !== 'bar' && (
          <div className="relative flex-shrink-0" style={{ width: variant === 'card' ? 120 : 200, height: variant === 'card' ? 120 : 200 }}>
            <div className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle at 50% 50%, #1a1a1a 0 28%, #0a0a0a 29% 31%, #181818 32%, #0a0a0a 100%)',
                boxShadow: `0 10px 40px rgba(0,0,0,.6), inset 0 0 60px rgba(0,0,0,.5)`,
                animation: isIdent ? 'none' : 'narVinylSpin 4s linear infinite' }}>
              {/* grooves */}
              {[0.92, 0.82, 0.72, 0.62, 0.52].map((r, i) => (
                <div key={i} className="absolute rounded-full" style={{ inset: `${(1 - r) * 50}%`, border: '1px solid rgba(255,255,255,0.05)' }} />
              ))}
              {/* center label = artwork */}
              <div className="absolute rounded-full overflow-hidden" style={{ inset: '34%', boxShadow: `0 0 20px ${accent}55` }}>
                {hasArt
                  ? <img src={np.artwork} alt="" className="w-full h-full object-cover" onError={() => setArtOk(false)} />
                  : <div className="w-full h-full flex items-center justify-center" style={{ background: `radial-gradient(circle, ${accent}, ${accent2} 80%)` }}>
                      <img src="/brands/nar/now-logo.png" alt="" className="w-2/3" onError={e => { e.target.style.display = 'none'; }} />
                    </div>}
              </div>
              {/* spindle */}
              <div className="absolute rounded-full bg-white" style={{ inset: '48.5%', boxShadow: '0 0 4px rgba(255,255,255,.6)' }} />
            </div>
          </div>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.3em]"
              style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {isIdent ? 'ON AIR' : 'NOW PLAYING'}
            </span>
            {!isIdent && elapsed && <span className="text-[11px] font-mono opacity-40" style={{ fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>}
            {!isIdent && (
              <span className="flex items-end gap-0.5 h-3 ml-1">
                {eqBars.map((_, i) => <span key={i} className="w-0.5 rounded-full" style={{ height: '100%', background: accent, animation: `narEq ${0.7 + i * 0.18}s ease-in-out infinite`, transformOrigin: 'bottom' }} />)}
              </span>
            )}
          </div>

          {isIdent ? (
            <h1 className={`font-black leading-tight truncate ${variant === 'bar' ? 'text-2xl' : 'text-4xl'}`}>{np?.onAir?.title || 'Now Ayrshire Radio'}</h1>
          ) : (
            <>
              <h1 className={`font-black leading-tight truncate ${variant === 'bar' ? 'text-xl' : variant === 'card' ? 'text-2xl' : 'text-4xl'}`}
                style={{ textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>{np?.title || '—'}</h1>
              <p className={`opacity-65 truncate ${variant === 'bar' ? 'text-sm' : 'text-xl'} mt-0.5`}>{np?.artist}</p>
            </>
          )}

          {showLine && variant !== 'bar' && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: `${accent}22`, color: accent }}>
                {np.onAir.title}{np.onAir.presenter ? ` · ${np.onAir.presenter}` : ''}
              </span>
              {np.next?.title && <span className="opacity-35">Next: {np.next.title}</span>}
            </div>
          )}

          {showHistory && variant === 'vinyl' && np?.history?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-30 mb-1.5 font-bold">Just Played</p>
              <div className="space-y-0.5">
                {np.history.slice(0, 3).map((h, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm opacity-50 truncate">
                    <span className="font-semibold truncate">{h.title}</span>
                    <span className="opacity-60 truncate">{h.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logo */}
      {variant !== 'bar' && <img src="/brands/nar/now-logo.png" alt="" className="absolute bottom-4 right-5 h-7 opacity-40 z-10" onError={e => { e.target.style.display = 'none'; }} />}
    </div>
  );
}
