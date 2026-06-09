import React, { useEffect, useRef, useState } from 'react';
import { subscribePavilionEvent } from '../lib/pavilionEventCache';

/**
 * Pavilion Festival — Welcome / Wayfinding card. Cinematic redesign.
 * Hero "WELCOME" treatment with stage colour ribbon, animated entrance,
 * and grouped wayfinding cards pulled from event API key_locations.
 *
 * config:
 *   greeting     — defaults to "Welcome to"
 *   showStages   — bool, default true
 *   accentColor
 *   subline      — optional sub-headline (e.g. "VIP Entrance")
 */
export default function PavilionWelcomeModule({ config = {} }) {
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
  const eventName = data?.name || 'Pavilion Festival 2026';
  const stages = (data?.stages || []).filter(s => (s.schedule || []).length > 0);
  const isPortrait = orientation === 'portrait';

  // Build wayfinding groups from key_locations.
  const locs = data?.key_locations || [];
  const groups = [
    { label: 'First Aid · Welfare', icon: <IconMedical />, items: locs.filter(l => l.type === 'medical') },
    { label: 'Toilets', icon: <IconToilet />, items: locs.filter(l => l.type === 'transport' && /toilet/i.test(l.name)) },
    { label: 'Food · Drink', icon: <IconFood />, items: locs.filter(l => l.type === 'food' || l.type === 'bar') },
    { label: 'Tokens · Merch', icon: <IconTicket />, items: locs.filter(l => l.type === 'ticket_office' || l.type === 'merchandise') },
    { label: 'Entrances · Exits', icon: <IconExit />, items: locs.filter(l => ['entrance', 'exit', 'vip'].includes(l.type)) },
    { label: 'Travel · Parking', icon: <IconTransport />, items: locs.filter(l => l.type === 'transport' && !/toilet/i.test(l.name) || l.type === 'parking') },
  ].filter(g => g.items.length > 0);

  return (
    <div ref={ref} className="w-full h-full flex flex-col relative overflow-hidden" style={{
      background: 'linear-gradient(165deg, #050510 0%, #1a0a14 60%, #2a0d1d 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    }}>
      <KeyFrames />

      {/* Backdrop */}
      <div className="absolute pointer-events-none" style={{
        top: '-10%', left: '-15%', width: '70%', height: '70%',
        background: `radial-gradient(ellipse, ${accent}22 0%, transparent 60%)`,
        filter: 'blur(70px)',
      }} />
      <div className="absolute pointer-events-none" style={{
        bottom: '-20%', right: '-10%', width: '65%', height: '65%',
        background: 'radial-gradient(ellipse, #9d50dd22 0%, transparent 60%)',
        filter: 'blur(80px)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
        backgroundSize: '40px 40px', opacity: 0.5,
      }} />

      {/* Header */}
      <div className="relative z-10" style={{ padding: isPortrait ? '5vh 5vw 3vh' : '4vh 4vw 3vh' }}>
        <div style={{
          fontSize: isPortrait ? '2.2vh' : '1.9vh',
          letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 800,
          color: accent, marginBottom: '1vh',
          animation: 'pavWelcomeIn 0.6s ease-out backwards',
        }}>
          ✦ {config.greeting || 'Welcome to'} ✦
        </div>
        <div style={{
          fontSize: isPortrait ? '7.5vh' : '6vh',
          fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.02em',
          background: `linear-gradient(180deg, #fff 0%, #fff 50%, ${accent} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          textShadow: `0 0 80px ${accent}55`,
          animation: 'pavWelcomeIn 0.7s 0.1s ease-out backwards',
        }}>{eventName}</div>
        {config.subline && (
          <div style={{
            fontSize: isPortrait ? '3vh' : '2.6vh', fontWeight: 700,
            color: accent, marginTop: '1.5vh', letterSpacing: '0.05em',
          }}>{config.subline}</div>
        )}
        {data?.location?.address && (
          <div style={{
            fontSize: isPortrait ? '2.2vh' : '1.9vh',
            color: 'rgba(255,255,255,0.55)', marginTop: '1.5vh',
            letterSpacing: '0.05em', fontWeight: 500,
          }}>📍 {data.location.address}</div>
        )}
      </div>

      {/* Stage ribbon */}
      {config.showStages !== false && stages.length > 0 && (
        <div className="relative z-10" style={{ padding: `0 ${isPortrait ? '5vw' : '4vw'} 3vh` }}>
          <div style={{
            fontSize: '1.4vh', color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '1.2vh', fontWeight: 700,
          }}>The Stages</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isPortrait ? 'repeat(2, 1fr)' : `repeat(${Math.min(stages.length, 4)}, 1fr)`,
            gap: '1vh',
          }}>
            {stages.map((s, i) => (
              <div key={s.id} style={{
                position: 'relative', overflow: 'hidden',
                padding: '1.4vh 1.6vh',
                background: `linear-gradient(135deg, ${s.color}22 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${s.color}44`, borderRadius: '0.8vh',
                animation: `pavWelcomeStage 0.5s ${0.3 + i * 0.06}s ease-out backwards`,
                boxShadow: `inset 1px 0 0 ${s.color}88`,
              }}>
                <div style={{
                  position: 'absolute', top: '-50%', right: '-20%', width: '80%', height: '200%',
                  background: `radial-gradient(ellipse, ${s.color}33 0%, transparent 60%)`, filter: 'blur(20px)',
                }} />
                <div className="relative" style={{
                  fontSize: isPortrait ? '2vh' : '1.8vh',
                  fontWeight: 800, color: s.color, textTransform: 'uppercase',
                  letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  textShadow: `0 0 20px ${s.color}66`,
                }}>{s.name}</div>
                {s.capacity && (
                  <div className="relative" style={{
                    fontSize: '1.2vh', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginTop: '0.2vh',
                  }}>cap {s.capacity.toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wayfinding cards */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden" style={{
        padding: `0 ${isPortrait ? '5vw' : '4vw'} 4vh`,
      }}>
        <div style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr 1fr' : 'repeat(3, 1fr)',
          gridAutoRows: 'minmax(0, 1fr)',
          gap: '1vh',
        }}>
          {groups.slice(0, isPortrait ? 6 : 6).map((g, i) => (
            <div key={g.label} style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.8vh',
              padding: '1.4vh 1.6vh',
              minHeight: 0, overflow: 'hidden',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              animation: `pavWelcomeCard 0.5s ${0.5 + i * 0.06}s ease-out backwards`,
            }}>
              <div className="flex items-center" style={{ gap: '1vh', marginBottom: '0.6vh' }}>
                <div style={{
                  width: '3vh', height: '3vh', borderRadius: '0.4vh',
                  background: `${accent}22`, color: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{g.icon}</div>
                <div style={{
                  fontSize: isPortrait ? '1.9vh' : '1.7vh',
                  fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
                }}>{g.label}</div>
              </div>
              <div style={{
                fontSize: isPortrait ? '1.5vh' : '1.4vh',
                color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, fontWeight: 500,
              }}>{g.items.slice(0, 4).map(i => i.name).join(' · ')}</div>
            </div>
          ))}
          {groups.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.4)', fontSize: '2vh', fontStyle: 'italic',
            }}>Site map data unavailable</div>
          )}
        </div>
      </div>

      {/* Bottom stage colour ribbon */}
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

function KeyFrames() {
  return (
    <style>{`
      @keyframes pavWelcomeIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pavWelcomeStage {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes pavWelcomeCard {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}

const ICON_PATHS = {
  medical: 'M11 2v8H3v4h8v8h2v-8h8v-4h-8V2z',
  food:    'M11 9V2H9v7H7V2H5v7c0 2.21 1.79 4 4 4v9h2v-9c2.21 0 4-1.79 4-4V2h-2v7h-2zm5-3v8h2.5v8h2V2c-2.5 0-4.5 2-4.5 4z',
  ticket:  'M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-1.99-3.46L4 6h16v2.54zM11 15h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2z',
  exit:    'M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  toilet:  'M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63A2.01 2.01 0 0 0 16.56 7h-.12a2.01 2.01 0 0 0-1.9 1.37L12 16h3v6h3zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z',
  transport: 'M12 2C8 2 4 2.5 4 6v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm5.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-7h-5V6h5v4z',
};
function makeIcon(d) {
  return () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d={d} /></svg>
  );
}
const IconMedical   = makeIcon(ICON_PATHS.medical);
const IconFood      = makeIcon(ICON_PATHS.food);
const IconTicket    = makeIcon(ICON_PATHS.ticket);
const IconExit      = makeIcon(ICON_PATHS.exit);
const IconToilet    = makeIcon(ICON_PATHS.toilet);
const IconTransport = makeIcon(ICON_PATHS.transport);
