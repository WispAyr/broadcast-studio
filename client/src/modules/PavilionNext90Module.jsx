import React, { useEffect, useRef, useState } from 'react';
import { subscribePavilionEvent, getActiveDay, parseScheduleTime } from '../lib/pavilionEventCache';

/**
 * Pavilion Festival — Next 90 minutes feed (chronological, all stages). Cinematic redesign.
 * Big stage colour bands, headliner glow, time-until pills, animated entrance.
 * Falls back to "today's headliners" when all schedule entries are TBA.
 *
 * config:
 *   windowMinutes  — default 90
 *   accentColor
 */
export default function PavilionNext90Module({ config = {} }) {
  const [state, setState] = useState({ data: null });
  const [orientation, setOrientation] = useState('landscape');
  const [tick, setTick] = useState(0);
  const ref = useRef(null);
  useEffect(() => subscribePavilionEvent(setState), []);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 30_000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width, h = e.contentRect.height;
      setOrientation(h > w * 1.1 ? 'portrait' : 'landscape');
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const accent = config.accentColor || '#ffb020';
  const win = (config.windowMinutes || 90) * 60_000;
  const data = state.data;
  const day = getActiveDay(data);
  const now = Date.now();
  const isPortrait = orientation === 'portrait';

  const allWithTimes = [];
  const allTBAheadliners = [];
  for (const stage of (data?.stages || [])) {
    for (const set of (stage.schedule || [])) {
      if (set.day !== day) continue;
      const t = parseScheduleTime(set);
      if (t) allWithTimes.push({ set, stage, t });
      else if (set.headliner) allTBAheadliners.push({ set, stage });
    }
  }
  const upcoming = allWithTimes
    .filter(x => x.t.getTime() >= now - 30 * 60_000 && x.t.getTime() <= now + win)
    .sort((a, b) => a.t - b.t);
  const fallback = upcoming.length === 0;
  const items = fallback ? allTBAheadliners : upcoming;

  return (
    <div ref={ref} className="w-full h-full flex flex-col relative overflow-hidden" style={{
      background: 'linear-gradient(165deg, #050510 0%, #0e0a18 50%, #1a0a14 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    }}>
      <KeyFrames />

      <div className="absolute pointer-events-none" style={{
        top: '-15%', left: '-10%', width: '60%', height: '60%',
        background: `radial-gradient(ellipse, ${accent}22 0%, transparent 60%)`, filter: 'blur(70px)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
        backgroundSize: '40px 40px', opacity: 0.5,
      }} />

      {/* Header */}
      <div className="relative z-10 flex items-end justify-between" style={{
        padding: isPortrait ? '4vh 4vw 2vh' : '3vh 3vw 2vh',
      }}>
        <div>
          <div style={{
            fontSize: isPortrait ? '2vh' : '1.7vh',
            letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 800,
            color: accent, marginBottom: '0.6vh',
          }}>{fallback ? '✦ Today\'s Headliners' : `✦ Next ${Math.round(win / 60_000)} Minutes`}</div>
          <div style={{
            fontSize: isPortrait ? '5vh' : '4.2vh',
            fontWeight: 900, lineHeight: 0.98, letterSpacing: '-0.02em',
            background: `linear-gradient(180deg, #fff 0%, #fff 60%, ${accent} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            textShadow: `0 0 60px ${accent}33`,
          }}>What's coming up</div>
        </div>
      </div>

      {/* Items */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden" style={{
        padding: `0 ${isPortrait ? '4vw' : '3vw'} 2vh`,
        display: 'flex', flexDirection: 'column', gap: isPortrait ? '1.2vh' : '1.4vh',
      }}>
        {items.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)', fontSize: '2vh', fontStyle: 'italic',
          }}>Nothing scheduled in the next {Math.round(win / 60_000)} minutes</div>
        )}
        {items.slice(0, isPortrait ? 7 : 6).map(({ set, stage, t }, i) => (
          <FeedRow
            key={`${stage.id}-${set.id}`}
            set={set}
            stage={stage}
            t={t}
            now={now}
            isPortrait={isPortrait}
            animDelay={i * 60}
            timesKnown={!fallback}
          />
        ))}
      </div>

      {/* Stage colour ribbon */}
      <div className="absolute bottom-0 left-0 right-0 flex z-10" style={{ height: '0.5vh' }}>
        {(data?.stages || []).map(s => (
          <div key={s.id} style={{ flex: 1, background: s.color, boxShadow: `0 -4px 20px ${s.color}88` }} />
        ))}
      </div>
    </div>
  );
}

function FeedRow({ set, stage, t, now, isPortrait, animDelay, timesKnown }) {
  const minutesUntil = t ? Math.round((t.getTime() - now) / 60_000) : null;
  const onNow = minutesUntil != null && minutesUntil <= 5 && minutesUntil >= -90;
  const inFuture = minutesUntil != null && minutesUntil > 5;

  const untilLabel = onNow ? 'ON NOW'
    : inFuture && minutesUntil < 60 ? `IN ${minutesUntil}m`
    : inFuture ? `IN ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
    : timesKnown ? '' : 'TBA';

  return (
    <div className="relative overflow-hidden" style={{
      display: 'grid',
      gridTemplateColumns: isPortrait ? 'auto 1fr auto' : 'auto 1fr auto auto',
      gap: isPortrait ? '1.6vh' : '2vh',
      alignItems: 'center',
      padding: isPortrait ? '1.6vh 2vh' : '1.5vh 2.2vh',
      background: `linear-gradient(90deg, ${stage.color}22 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.01) 100%)`,
      borderLeft: `4px solid ${stage.color}`,
      borderRadius: '0.6vh',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      animation: `pavRowIn 0.5s ${animDelay}ms ease-out backwards`,
      boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 1px 0 0 ${stage.color}`,
    }}>
      {/* Glow */}
      <div className="absolute pointer-events-none" style={{
        top: '-50%', left: '-5%', width: '40%', height: '200%',
        background: `radial-gradient(ellipse, ${stage.color}33 0%, transparent 60%)`, filter: 'blur(30px)',
      }} />

      {/* Time */}
      <div className="relative" style={{
        fontVariantNumeric: 'tabular-nums',
        fontSize: isPortrait ? '3.2vh' : '2.8vh',
        fontWeight: 900, color: stage.color, minWidth: '7ch',
        textShadow: `0 0 16px ${stage.color}66`,
      }}>{t ? t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'TBA'}</div>

      {/* Title + genre */}
      <div className="relative" style={{ minWidth: 0 }}>
        <div style={{
          fontSize: isPortrait ? '2.7vh' : '2.4vh',
          fontWeight: 800, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: set.headliner ? `0 0 16px ${stage.color}66` : 'none',
        }}>
          {set.title}
          {set.headliner && (
            <span style={{
              display: 'inline-block', marginLeft: '1vh',
              fontSize: '1.3vh', fontWeight: 800, letterSpacing: '0.2em',
              padding: '0.3vh 0.7vh', borderRadius: '0.3vh',
              color: stage.color, border: `1px solid ${stage.color}88`,
              background: `${stage.color}1f`, verticalAlign: 'middle', textTransform: 'uppercase',
            }}>HEADLINER</span>
          )}
        </div>
        {set.genre && (
          <div style={{ fontSize: '1.4vh', color: 'rgba(255,255,255,0.5)', marginTop: '0.2vh', letterSpacing: '0.04em' }}>
            {set.genre}
          </div>
        )}
      </div>

      {/* Until pill (landscape only) */}
      {!isPortrait && untilLabel && (
        <div style={{
          fontSize: '1.3vh', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
          padding: '0.6vh 1vh', borderRadius: '99px',
          color: onNow ? '#fff' : 'rgba(255,255,255,0.85)',
          background: onNow ? stage.color : `${stage.color}1f`,
          border: `1px solid ${stage.color}66`,
          boxShadow: onNow ? `0 0 20px ${stage.color}88` : 'none',
          animation: onNow ? 'pavRowGlow 1.5s ease-in-out infinite' : undefined,
          whiteSpace: 'nowrap',
        }}>{untilLabel}</div>
      )}

      {/* Stage label */}
      <div style={{
        textAlign: 'right', fontSize: '1.4vh', color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700,
      }}>{stage.name}</div>
    </div>
  );
}

function KeyFrames() {
  return (
    <style>{`
      @keyframes pavRowIn {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes pavRowGlow {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.04); }
      }
    `}</style>
  );
}
