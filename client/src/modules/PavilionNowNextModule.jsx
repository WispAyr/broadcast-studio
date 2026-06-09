import React, { useEffect, useRef, useState } from 'react';
import { subscribePavilionEvent, computeNowNextPerStage, formatStart } from '../lib/pavilionEventCache';

/**
 * Pavilion Festival — Now & Next per stage. Cinematic redesign.
 * Auto-detects orientation. Renders rich stage cards with accent glow,
 * animated "ON NOW" badge, and stage-tinted gradient surfaces.
 *
 * config:
 *   eventTitle     — header line, defaults to event name from API
 *   accentColor    — overall theme accent (defaults to brand orange)
 *   showStaleBadge — bool, default true
 */
export default function PavilionNowNextModule({ config = {} }) {
  const [state, setState] = useState({ data: null, loading: true, error: null, stale: false });
  const [tick, setTick] = useState(0);
  const [orientation, setOrientation] = useState('landscape');
  const containerRef = useRef(null);

  useEffect(() => subscribePavilionEvent(setState), []);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setOrientation(height > width * 1.1 ? 'portrait' : 'landscape');
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const accent = config.accentColor || '#ffb020';
  const eventTitle = config.eventTitle || state.data?.name || 'Pavilion Festival 2026';
  const stages = state.data ? computeNowNextPerStage(state.data) : [];
  const timesKnown = stages.some(s => s.timesKnown);
  const isPortrait = orientation === 'portrait';

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col relative overflow-hidden" style={{
      background: 'linear-gradient(160deg, #050510 0%, #0e0a18 45%, #1a0a14 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    }}>
      <KeyFrames />
      <Backdrop accent={accent} />

      {/* Header */}
      <div className="relative z-10 flex items-end justify-between" style={{
        padding: isPortrait ? '4vh 4vw 2vh' : '3vh 3vw 2vh',
      }}>
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.6vh' }}>
            <PulseDot active={timesKnown} color={accent} />
            <span style={{
              fontSize: isPortrait ? '2vh' : '1.7vh',
              letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 800,
              color: timesKnown ? accent : 'rgba(255,255,255,0.55)',
            }}>
              {timesKnown ? 'Now & Next' : 'Today\'s Lineup'}
            </span>
          </div>
          <div style={{
            fontSize: isPortrait ? '5.5vh' : '4.5vh',
            fontWeight: 900, lineHeight: 0.98, letterSpacing: '-0.02em',
            background: `linear-gradient(180deg, #fff 0%, #fff 60%, ${accent}cc 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            textShadow: `0 0 60px ${accent}33`,
          }}>{eventTitle}</div>
        </div>
        <Clock isPortrait={isPortrait} accent={accent} />
      </div>

      {/* Stages grid */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden" style={{
        padding: isPortrait ? '0 4vw 3vh' : '0 3vw 2.5vh',
      }}>
        <div style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : 'repeat(2, 1fr)',
          gridAutoRows: '1fr',
          gap: isPortrait ? '1.4vh' : '1.6vh',
        }}>
          {state.loading && stages.length === 0 && <Placeholder>Loading lineup…</Placeholder>}
          {!state.loading && stages.length === 0 && <Placeholder>No schedule yet — check back soon.</Placeholder>}
          {stages.map(({ stage, nowSet, nextSet, timesKnown }, i) => (
            <StageCard
              key={stage.id}
              stage={stage}
              nowSet={nowSet}
              nextSet={nextSet}
              timesKnown={timesKnown}
              isPortrait={isPortrait}
              animDelay={i * 70}
            />
          ))}
        </div>
      </div>

      {/* Stage colour bar */}
      <StageColorBar stages={stages.map(s => s.stage)} />

      {/* Stale footer */}
      {(config.showStaleBadge !== false) && state.stale && (
        <div className="absolute bottom-3 left-0 right-0 text-center z-10" style={{
          fontSize: '1.4vh', color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          ⚠ Schedule may be out of date · last update {minutesAgo(state.fetchedAt)}
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, nowSet, nextSet, timesKnown, isPortrait, animDelay }) {
  return (
    <div className="relative overflow-hidden" style={{
      background: `linear-gradient(135deg, ${stage.color}18 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.01) 100%)`,
      border: `1px solid ${stage.color}33`,
      borderRadius: '1vh',
      padding: isPortrait ? '2vh 2.4vh' : '1.8vh 2.2vh',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      animation: `pavStageIn 0.6s ${animDelay}ms cubic-bezier(0.2, 0.9, 0.3, 1) backwards`,
      boxShadow: `inset 1px 0 0 ${stage.color}66, 0 4px 30px rgba(0,0,0,0.4)`,
    }}>
      {/* Inner glow orb */}
      <div className="absolute pointer-events-none" style={{
        top: '-30%', right: '-20%', width: '60%', height: '120%',
        background: `radial-gradient(ellipse, ${stage.color}33 0%, transparent 60%)`,
        filter: 'blur(40px)',
      }} />

      {/* Stage banner */}
      <div className="relative flex items-baseline justify-between" style={{ gap: '1vh' }}>
        <div className="flex items-center gap-2" style={{
          fontSize: isPortrait ? '2.4vh' : '2.1vh',
          fontWeight: 800, color: stage.color,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          textShadow: `0 0 20px ${stage.color}66`,
        }}>
          <span style={{
            display: 'inline-block', width: '0.7vh', height: '0.7vh',
            background: stage.color, borderRadius: '50%',
            boxShadow: `0 0 12px ${stage.color}`,
          }} />
          {stage.name}
        </div>
        {stage.capacity && (
          <div style={{ fontSize: '1.3vh', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
            CAP {stage.capacity.toLocaleString()}
          </div>
        )}
      </div>

      {/* Now */}
      {nowSet ? (
        <div className="relative" style={{ marginTop: '1vh' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '0.5vh' }}>
            <PulseDot active={timesKnown} color={stage.color} />
            <span style={{
              fontSize: '1.4vh', color: timesKnown ? stage.color : 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 700,
            }}>{timesKnown ? 'On Now' : 'Headlining'}</span>
          </div>
          <div style={{
            fontSize: isPortrait ? '3.6vh' : '3vh',
            fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.01em',
            color: '#fff',
            textShadow: `0 2px 20px ${stage.color}44`,
          }}>{nowSet.title}</div>
          <div style={{
            fontSize: isPortrait ? '1.6vh' : '1.5vh',
            color: 'rgba(255,255,255,0.6)', marginTop: '0.4vh', fontWeight: 500,
          }}>
            {nowSet.genre}{timesKnown ? ` · ${formatStart(nowSet)}` : ''}
            {nowSet.headliner && <HeadlinerPill color={stage.color} />}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '1vh', fontSize: '1.6vh', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>No set scheduled</div>
      )}

      {/* Next */}
      {nextSet && (
        <div className="relative" style={{
          marginTop: '1.4vh', paddingTop: '1.2vh',
          borderTop: `1px solid ${stage.color}22`,
        }}>
          <div style={{
            fontSize: '1.2vh', color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 700,
            marginBottom: '0.3vh',
          }}>{timesKnown ? 'Up Next' : 'Also On'}</div>
          <div className="flex items-baseline justify-between" style={{ gap: '1vh' }}>
            <div style={{
              fontSize: isPortrait ? '2.2vh' : '2vh',
              fontWeight: 700, color: 'rgba(255,255,255,0.92)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nextSet.title}</div>
            {timesKnown && (
              <div style={{
                fontVariantNumeric: 'tabular-nums',
                fontSize: '1.7vh', color: stage.color, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}>{formatStart(nextSet)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeadlinerPill({ color }) {
  return (
    <span style={{
      display: 'inline-block', marginLeft: '1vh',
      fontSize: '1.1vh', fontWeight: 800, letterSpacing: '0.2em',
      padding: '0.3vh 0.8vh', borderRadius: '0.4vh',
      color, border: `1px solid ${color}66`, background: `${color}15`,
      verticalAlign: 'middle', textTransform: 'uppercase',
    }}>HEADLINER</span>
  );
}

function PulseDot({ active, color }) {
  return (
    <span style={{
      display: 'inline-block', width: '0.9vh', height: '0.9vh', borderRadius: '50%',
      background: active ? color : 'rgba(255,255,255,0.3)',
      boxShadow: active ? `0 0 8px ${color}, 0 0 16px ${color}66` : 'none',
      animation: active ? 'pavPulse 1.8s ease-in-out infinite' : undefined,
    }} />
  );
}

function Clock({ isPortrait, accent }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  const hh = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div style={{
        fontSize: isPortrait ? '4vh' : '3.2vh', fontWeight: 800,
        letterSpacing: '0.04em', color: '#fff',
        textShadow: `0 0 30px ${accent}44`,
      }}>{hh}</div>
      <div style={{
        fontSize: isPortrait ? '1.4vh' : '1.2vh', color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
}

function Backdrop({ accent }) {
  return (
    <>
      {/* Top-right accent glow */}
      <div className="absolute pointer-events-none" style={{
        top: '-20%', right: '-15%', width: '70%', height: '60%',
        background: `radial-gradient(ellipse, ${accent}22 0%, transparent 60%)`,
        filter: 'blur(60px)',
      }} />
      {/* Bottom-left counter glow */}
      <div className="absolute pointer-events-none" style={{
        bottom: '-25%', left: '-20%', width: '60%', height: '70%',
        background: 'radial-gradient(ellipse, #ff5ac422 0%, transparent 60%)',
        filter: 'blur(70px)',
      }} />
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
        opacity: 0.5,
      }} />
    </>
  );
}

function StageColorBar({ stages }) {
  if (!stages || stages.length === 0) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 flex z-10" style={{ height: '0.5vh' }}>
      {stages.map(s => (
        <div key={s.id} style={{
          flex: 1, background: s.color,
          boxShadow: `0 -4px 20px ${s.color}88`,
        }} />
      ))}
    </div>
  );
}

function Placeholder({ children }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.4)', fontSize: '2vh', fontStyle: 'italic',
    }}>{children}</div>
  );
}

function KeyFrames() {
  return (
    <style>{`
      @keyframes pavPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.3); }
      }
      @keyframes pavStageIn {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  );
}

function minutesAgo(ts) {
  if (!ts) return 'unknown';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}
