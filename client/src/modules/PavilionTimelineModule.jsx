import React, { useEffect, useRef, useState } from 'react';
import { subscribePavilionEvent, getActiveDay, parseScheduleTime, formatStart } from '../lib/pavilionEventCache';

/**
 * Pavilion Festival — full day timeline by stage. Cinematic redesign.
 * Stages render as glass columns with stage-tinted gradient header,
 * headliner highlight pills, animated entrance, and a stage colour ribbon footer.
 *
 * config:
 *   day            — '2026-05-02' | '2026-05-03' | 'auto' (default)
 *   accentColor    — header colour
 */
export default function PavilionTimelineModule({ config = {} }) {
  const [state, setState] = useState({ data: null });
  const [orientation, setOrientation] = useState('landscape');
  const ref = useRef(null);
  useEffect(() => subscribePavilionEvent(setState), []);
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
  const data = state.data;
  const day = config.day === 'auto' || !config.day ? getActiveDay(data) : config.day;
  const dayMeta = data?.dates?.days?.find(d => d.date === day);
  const stages = (data?.stages || []).filter(s => (s.schedule || []).some(e => e.day === day));
  const isPortrait = orientation === 'portrait';

  return (
    <div ref={ref} className="w-full h-full flex flex-col relative overflow-hidden" style={{
      background: 'linear-gradient(165deg, #050510 0%, #0e0a1a 50%, #1a0a14 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    }}>
      <KeyFrames />

      <div className="absolute pointer-events-none" style={{
        top: '-15%', right: '-10%', width: '60%', height: '60%',
        background: `radial-gradient(ellipse, ${accent}22 0%, transparent 60%)`, filter: 'blur(70px)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
        backgroundSize: '40px 40px', opacity: 0.5,
      }} />

      {/* Header */}
      <div className="relative z-10" style={{ padding: isPortrait ? '4vh 4vw 2vh' : '3vh 3vw 2vh' }}>
        <div style={{
          fontSize: isPortrait ? '2vh' : '1.7vh',
          letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 800,
          color: accent, marginBottom: '0.6vh',
        }}>✦ Day Lineup ✦</div>
        <div style={{
          fontSize: isPortrait ? '5vh' : '4.2vh',
          fontWeight: 900, lineHeight: 0.98, letterSpacing: '-0.02em',
          background: `linear-gradient(180deg, #fff 0%, #fff 60%, ${accent} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          textShadow: `0 0 60px ${accent}33`,
        }}>{dayMeta?.label || (day ? new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Lineup')}</div>
      </div>

      {/* Stage columns */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden" style={{
        padding: `0 ${isPortrait ? '4vw' : '3vw'} 2vh`,
      }}>
        <div style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : `repeat(${Math.min(stages.length, 3)}, 1fr)`,
          gridAutoRows: 'minmax(0, 1fr)',
          gap: '1.4vh',
        }}>
          {stages.slice(0, isPortrait ? 4 : 6).map((stage, i) => (
            <StageColumn key={stage.id} stage={stage} day={day} isPortrait={isPortrait} animDelay={i * 80} />
          ))}
          {stages.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.4)', fontSize: '2vh', fontStyle: 'italic',
            }}>Lineup unavailable</div>
          )}
        </div>
      </div>

      {/* Stage colour ribbon */}
      {stages.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 flex z-10" style={{ height: '0.5vh' }}>
          {stages.map(s => (
            <div key={s.id} style={{ flex: 1, background: s.color, boxShadow: `0 -4px 20px ${s.color}88` }} />
          ))}
        </div>
      )}
    </div>
  );
}

function StageColumn({ stage, day, isPortrait, animDelay }) {
  const sets = (stage.schedule || []).filter(s => s.day === day);
  const sorted = [...sets].sort((a, b) => {
    const ta = parseScheduleTime(a)?.getTime();
    const tb = parseScheduleTime(b)?.getTime();
    if (ta == null && tb == null) {
      const w = (s) => s.headliner ? 0 : (s.category === 'support' ? 1 : 2);
      return w(a) - w(b);
    }
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  const maxItems = isPortrait ? 6 : 8;
  return (
    <div className="relative overflow-hidden" style={{
      background: `linear-gradient(180deg, ${stage.color}1c 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.01) 100%)`,
      border: `1px solid ${stage.color}33`,
      borderRadius: '1vh',
      padding: '1.4vh 1.6vh',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      animation: `pavTimelineIn 0.5s ${animDelay}ms ease-out backwards`,
      boxShadow: `inset 0 1px 0 ${stage.color}66, 0 4px 30px rgba(0,0,0,0.4)`,
    }}>
      {/* Glow */}
      <div className="absolute pointer-events-none" style={{
        top: '-30%', left: '-20%', width: '80%', height: '60%',
        background: `radial-gradient(ellipse, ${stage.color}33 0%, transparent 60%)`, filter: 'blur(30px)',
      }} />

      {/* Header */}
      <div className="relative flex items-baseline justify-between" style={{ marginBottom: '1.2vh', gap: '1vh' }}>
        <div style={{
          fontSize: isPortrait ? '2.2vh' : '1.9vh',
          fontWeight: 900, color: stage.color, textTransform: 'uppercase',
          letterSpacing: '0.08em', textShadow: `0 0 16px ${stage.color}66`,
        }}>{stage.name}</div>
        <div style={{
          fontSize: '1.1vh', color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>{sorted.length} sets</div>
      </div>

      {/* Sets */}
      <div className="relative" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.7vh' }}>
        {sorted.slice(0, maxItems).map((set, i) => (
          <div key={set.id} style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr',
            gap: '1vh', alignItems: 'baseline',
            padding: '0.7vh 0',
            borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}>
            <div style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: isPortrait ? '1.7vh' : '1.5vh',
              color: stage.color, fontWeight: 700,
              minWidth: '5ch', textAlign: 'right',
            }}>{formatStart(set)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: isPortrait ? '2vh' : '1.8vh',
                fontWeight: set.headliner ? 800 : 600,
                color: set.headliner ? '#fff' : 'rgba(255,255,255,0.85)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                textShadow: set.headliner ? `0 0 16px ${stage.color}55` : 'none',
              }}>
                {set.title}
                {set.headliner && (
                  <span style={{
                    display: 'inline-block', marginLeft: '0.6vh',
                    fontSize: '0.95vh', fontWeight: 800, letterSpacing: '0.2em',
                    padding: '0.2vh 0.6vh', borderRadius: '0.3vh',
                    color: stage.color, border: `1px solid ${stage.color}66`, background: `${stage.color}15`,
                    verticalAlign: 'middle', textTransform: 'uppercase',
                  }}>HEADLINER</span>
                )}
              </div>
              {set.genre && (
                <div style={{ fontSize: '1.2vh', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                  {set.genre}
                </div>
              )}
            </div>
          </div>
        ))}
        {sorted.length > maxItems && (
          <div style={{
            fontSize: '1.3vh', color: 'rgba(255,255,255,0.45)', marginTop: '0.5vh',
            textAlign: 'center', fontStyle: 'italic',
          }}>+ {sorted.length - maxItems} more</div>
        )}
      </div>
    </div>
  );
}

function KeyFrames() {
  return (
    <style>{`
      @keyframes pavTimelineIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
