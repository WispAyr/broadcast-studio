import React, { useEffect, useRef, useState } from 'react';

/**
 * Pavilion Festival — Safety announcement screen. Cinematic redesign.
 * Renders one of a fixed set of pre-approved templates. Designed to be
 * triggered on demand via a live-mode override or dedicated Safety show.
 *
 * config:
 *   preset       — 'general-evac' | 'severe-weather' | 'lost-child' | 'found-child'
 *                  | 'medical-aid' | 'welfare' | 'temporary-hold' (default 'general-evac')
 *   assemblyPoint, childName, firstAidLocation, welfareLocation, welfareHours
 *   message      — override body text
 *   accentColor  — defaults per preset
 */
const PRESETS = {
  'general-evac': {
    headline: 'EVACUATE',
    subhead: 'Please leave the venue calmly',
    body: ({ assemblyPoint }) => [
      'Walk — do not run — to your nearest emergency exit.',
      `Assembly point: ${assemblyPoint || 'Low Green car park'}.`,
      'Follow stewards in hi-vis. Do not return for belongings.',
    ],
    icon: 'siren',
    bg: 'linear-gradient(165deg, #6b0000 0%, #c1121f 50%, #6b0000 100%)',
    accent: '#ffe066',
    pulse: true,
    severity: 'critical',
  },
  'severe-weather': {
    headline: 'WEATHER HOLD',
    subhead: 'Performances temporarily paused',
    body: ({ message }) => [
      message || 'Stages are on a precautionary hold due to severe weather.',
      'Please move to covered areas — bars, food court, sheltered tents.',
      'We will resume as soon as conditions allow. Stay safe.',
    ],
    icon: 'storm',
    bg: 'linear-gradient(165deg, #1e3a8a 0%, #1e40af 50%, #312e81 100%)',
    accent: '#fde68a',
    pulse: false,
    severity: 'warning',
  },
  'lost-child': {
    headline: 'LOST CHILD',
    subhead: 'If you have seen this child please bring them to a steward',
    body: ({ childName }) => [
      childName ? `Name: ${childName}` : 'Please listen for further details.',
      'Stewards will reunite the child with their family at the welfare tent.',
      'Do not approach unless you are a parent or guardian.',
    ],
    icon: 'child',
    bg: 'linear-gradient(165deg, #78350f 0%, #b45309 50%, #78350f 100%)',
    accent: '#fef3c7',
    pulse: true,
    severity: 'urgent',
  },
  'found-child': {
    headline: 'FOUND SAFE',
    subhead: 'A child has been found and is safe',
    body: ({ childName, welfareLocation }) => [
      childName ? `${childName} is at the welfare tent.` : 'A child is in the care of stewards.',
      `Parents/guardians please come to ${welfareLocation || 'the welfare tent (north-east of main stage)'} immediately.`,
      'Bring photo ID and be ready to confirm details.',
    ],
    icon: 'check',
    bg: 'linear-gradient(165deg, #065f46 0%, #15803d 50%, #064e3b 100%)',
    accent: '#dcfce7',
    pulse: false,
    severity: 'good',
  },
  'medical-aid': {
    headline: 'MEDICAL AID',
    subhead: 'How to find help on site',
    body: ({ firstAidLocation }) => [
      `First aid is at ${firstAidLocation || 'the welfare tent (north-east of main stage)'}.`,
      'Tell any steward — they will radio medics directly to you.',
      'In an emergency, dial 999 and quote "Pavilion Festival, Low Green Ayr".',
    ],
    icon: 'medical',
    bg: 'linear-gradient(165deg, #881337 0%, #be123c 50%, #881337 100%)',
    accent: '#fee2e2',
    pulse: false,
    severity: 'info',
  },
  'welfare': {
    headline: 'WELFARE & SUPPORT',
    subhead: 'You are not alone',
    body: ({ welfareLocation, welfareHours }) => [
      `Welfare tent is at ${welfareLocation || 'the north-east of main stage'}.`,
      `Open: ${welfareHours || '12:00 – late, both days'}.`,
      'Quiet space, free water, charging, and trained staff. Just walk in.',
    ],
    icon: 'heart',
    bg: 'linear-gradient(165deg, #064e3b 0%, #047857 50%, #064e3b 100%)',
    accent: '#a7f3d0',
    pulse: false,
    severity: 'info',
  },
  'temporary-hold': {
    headline: 'BRIEF DELAY',
    subhead: 'Stage on a short technical hold',
    body: ({ message }) => [
      message || 'A scheduled set is paused for a brief technical hold.',
      "We'll be back with you in a few minutes. Thanks for your patience.",
      'Stewards are happy to help if you need anything.',
    ],
    icon: 'pause',
    bg: 'linear-gradient(165deg, #312e81 0%, #4338ca 50%, #312e81 100%)',
    accent: '#ddd6fe',
    pulse: false,
    severity: 'info',
  },
};

export default function PavilionSafetyModule({ config = {} }) {
  const preset = PRESETS[config.preset] || PRESETS['general-evac'];
  const [orientation, setOrientation] = useState('landscape');
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width, h = e.contentRect.height;
      setOrientation(h > w * 1.1 ? 'portrait' : 'landscape');
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const isPortrait = orientation === 'portrait';
  const accent = config.accentColor || preset.accent;
  const lines = preset.body(config);

  return (
    <div ref={ref} className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden" style={{
      background: preset.bg, color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
      textAlign: 'center', padding: isPortrait ? '6vh 6vw' : '6vh 8vw',
    }}>
      <KeyFrames />

      {/* Decorative backdrop */}
      <div className="absolute pointer-events-none" style={{
        top: '-20%', left: '-10%', width: '70%', height: '70%',
        background: `radial-gradient(ellipse, ${accent}33 0%, transparent 60%)`,
        filter: 'blur(80px)',
      }} />
      <div className="absolute pointer-events-none" style={{
        bottom: '-25%', right: '-15%', width: '70%', height: '70%',
        background: `radial-gradient(ellipse, ${accent}22 0%, transparent 60%)`,
        filter: 'blur(80px)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Severity bar — top */}
      <SeverityBar severity={preset.severity} accent={accent} pulse={preset.pulse} />

      {/* Icon */}
      <div className="relative z-10" style={{
        marginBottom: isPortrait ? '4vh' : '3vh',
        animation: preset.pulse ? 'pavSafetyIconPulse 1.6s ease-in-out infinite' : 'pavSafetyIn 0.6s ease-out',
      }}>
        <div style={{
          width: isPortrait ? '24vh' : '20vh', height: isPortrait ? '24vh' : '20vh',
          borderRadius: '50%', background: `${accent}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 80px ${accent}66, inset 0 0 60px ${accent}22`,
          border: `2px solid ${accent}55`,
        }}>
          <SafetyIcon name={preset.icon} color={accent} size={isPortrait ? '14vh' : '11vh'} />
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10" style={{
        fontSize: isPortrait ? '10vh' : '11vh',
        fontWeight: 900, lineHeight: 1, letterSpacing: '0.05em', textTransform: 'uppercase',
        color: accent, marginBottom: '2vh',
        textShadow: `0 0 60px ${accent}88, 0 4px 30px rgba(0,0,0,0.4)`,
        animation: 'pavSafetyIn 0.7s 0.1s ease-out backwards',
      }}>{preset.headline}</div>

      {/* Subhead */}
      <div className="relative z-10" style={{
        fontSize: isPortrait ? '3vh' : '3.4vh',
        fontWeight: 600, marginBottom: isPortrait ? '5vh' : '4vh',
        color: 'rgba(255,255,255,0.92)', letterSpacing: '0.02em',
        animation: 'pavSafetyIn 0.7s 0.2s ease-out backwards',
      }}>{preset.subhead}</div>

      {/* Body lines */}
      <div className="relative z-10" style={{
        maxWidth: isPortrait ? '95%' : '75%',
        display: 'flex', flexDirection: 'column', gap: '1.8vh',
        fontSize: isPortrait ? '2.7vh' : '2.9vh',
        fontWeight: 500, lineHeight: 1.4, color: 'rgba(255,255,255,0.95)',
        animation: 'pavSafetyIn 0.7s 0.3s ease-out backwards',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{
            padding: '1.5vh 2.5vh',
            background: 'rgba(0,0,0,0.18)',
            border: `1px solid ${accent}33`,
            borderRadius: '0.8vh',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          }}>{l}</div>
        ))}
      </div>

      {/* Footer banner */}
      <div className="absolute bottom-0 left-0 right-0 z-10" style={{
        padding: '1.5vh 2vw',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `2px solid ${accent}55`,
        textAlign: 'center', fontSize: isPortrait ? '1.6vh' : '1.5vh',
        color: 'rgba(255,255,255,0.85)', fontWeight: 700,
        letterSpacing: '0.3em', textTransform: 'uppercase',
      }}>
        Pavilion Festival 2026 · Stewards in Hi-Vis · Dial 999 in Emergency
      </div>
    </div>
  );
}

function SeverityBar({ severity, accent, pulse }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex" style={{ height: '0.7vh' }}>
      <div style={{
        flex: 1, background: accent,
        boxShadow: `0 4px 30px ${accent}aa`,
        animation: pulse ? 'pavSafetyBarPulse 1.6s ease-in-out infinite' : undefined,
      }} />
    </div>
  );
}

function SafetyIcon({ name, color, size }) {
  const props = { width: size, height: size, fill: 'currentColor', viewBox: '0 0 24 24', style: { color, filter: `drop-shadow(0 4px 12px ${color}66)` } };
  switch (name) {
    case 'siren':
      return (
        <svg {...props}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17h8v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zM7.66 17l-.92 4h2.05l.84-3.66c-.66-.06-1.32-.18-1.97-.34zm6.68 0c-.65.16-1.31.28-1.97.34L13.21 21h2.05l-.92-4z"/>
          <circle cx="12" cy="9" r="2" fill={color}/>
        </svg>
      );
    case 'storm':
      return (
        <svg {...props}>
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM13 14v3h-2v-3H8.5l3.5-5 3.5 5H13z"/>
        </svg>
      );
    case 'child':
      return (
        <svg {...props}>
          <circle cx="12" cy="4" r="2"/>
          <path d="M15 7H9c-1.1 0-2 .9-2 2v4h2v9h6v-9h2V9c0-1.1-.9-2-2-2z"/>
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      );
    case 'medical':
      return (
        <svg {...props}>
          <path d="M19 8h-2V3H7v5H5c-1.66 0-3 1.34-3 3v6c0 1.66 1.34 3 3 3h14c1.66 0 3-1.34 3-3v-6c0-1.66-1.34-3-3-3zM9 5h6v3H9V5zm6 11h-2v2h-2v-2H9v-2h2v-2h2v2h2v2z"/>
        </svg>
      );
    case 'heart':
      return (
        <svg {...props}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      );
    case 'pause':
      return (
        <svg {...props}>
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      );
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

function KeyFrames() {
  return (
    <style>{`
      @keyframes pavSafetyIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pavSafetyIconPulse {
        0%, 100% { transform: scale(1); filter: brightness(1); }
        50% { transform: scale(1.06); filter: brightness(1.15); }
      }
      @keyframes pavSafetyBarPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  );
}
