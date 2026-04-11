import React, { useState, useEffect, useRef } from 'react';

/**
 * Kiltwalk Finisher Counter — smart display modes for live events.
 *
 * Modes:
 *   exact     — raw count, only ever goes up
 *   milestone — "Over 500" / "Over 1,000" with celebration splashes
 *   pace      — "120 finishers/hour" rolling rate display
 *   combined  — milestone counter + pace underneath
 */

const MILESTONES = [100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];

function getMilestone(count) {
  let best = 0;
  for (const m of MILESTONES) {
    if (count >= m) best = m;
  }
  return best;
}

function getNextMilestone(count) {
  for (const m of MILESTONES) {
    if (count < m) return m;
  }
  return MILESTONES[MILESTONES.length - 1] + 5000;
}

export default function KiltwalkerCounterModule({ config = {} }) {
  const mode = config.mode || 'combined'; // exact | milestone | pace | combined
  const [rawCount, setRawCount] = useState(0);
  const [highWater, setHighWater] = useState(0); // never decrements
  const [displayCount, setDisplayCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [milestoneFlash, setMilestoneFlash] = useState(null);
  const [paceHistory, setPaceHistory] = useState([]);
  const prevMilestone = useRef(0);
  const prevCount = useRef(0);
  const paceRef = useRef([]);

  const title = config.title || 'FINISHERS';
  const fontSize = config.fontSize || '180px';
  const color = config.color || '#ffffff';
  const accentColor = config.accentColor || '#e63b2b';
  const showConfetti = config.showConfetti !== false;
  const logo = config.logo || '/assets/kiltwalk/logo.svg';
  const bg = config.background || 'linear-gradient(135deg, #1a1a2e 0%, #3f3437 100%)';
  const smoothBuffer = config.smoothBuffer || 10; // min delta before display updates

  // High-water mark: only ever goes up
  useEffect(() => {
    const incoming = config.count ?? 0;
    setRawCount(incoming);
    // Allow reset: if incoming is explicitly lower AND it's a manual set (not sensor noise)
    // High-water only prevents decrements of < 10% — a reset to 0 or a big jump down is intentional
    setHighWater(prev => {
      if (incoming === 0) return 0; // explicit reset
      if (incoming < prev * 0.5) return incoming; // big drop = intentional manual set
      return Math.max(prev, incoming); // normal: only go up
    });

    // Track pace: store timestamped counts
    const now = Date.now();
    paceRef.current = [...paceRef.current.filter(p => now - p.t < 3600000), { t: now, c: incoming }];
    setPaceHistory([...paceRef.current]);
  }, [config.count]);

  // Smoothed display count (only updates when delta > buffer)
  useEffect(() => {
    const target = highWater;
    if (mode === 'exact') {
      // Smooth rolling animation
      if (displayCount === target) return;
      const step = Math.max(1, Math.ceil(Math.abs(target - displayCount) / 30));
      const timer = setTimeout(() => {
        setDisplayCount(prev => Math.min(prev + step, target));
      }, 20);
      return () => clearTimeout(timer);
    } else {
      // For milestone mode: update when buffer threshold crossed
      if (target - displayCount >= smoothBuffer || displayCount === 0) {
        const step = Math.max(1, Math.ceil(Math.abs(target - displayCount) / 30));
        const timer = setTimeout(() => {
          setDisplayCount(prev => Math.min(prev + step, target));
        }, 20);
        return () => clearTimeout(timer);
      }
    }
  }, [highWater, displayCount, mode, smoothBuffer]);

  // Milestone celebration detection
  useEffect(() => {
    const current = getMilestone(displayCount);
    if (current > prevMilestone.current && prevMilestone.current > 0) {
      setMilestoneFlash(current);
      setCelebrating(true);
      setTimeout(() => { setCelebrating(false); setMilestoneFlash(null); }, 6000);
    }
    prevMilestone.current = current;
  }, [displayCount]);

  // Calculate pace (finishers per hour)
  const pace = (() => {
    if (paceHistory.length < 2) return 0;
    const recent = paceHistory.filter(p => Date.now() - p.t < 1800000); // last 30min
    if (recent.length < 2) return 0;
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const deltaCount = newest.c - oldest.c;
    const deltaHours = (newest.t - oldest.t) / 3600000;
    if (deltaHours < 0.01) return 0;
    return Math.round(Math.max(0, deltaCount / deltaHours));
  })();

  // Display values
  const milestone = getMilestone(displayCount);
  const nextMilestone = getNextMilestone(displayCount);
  const milestoneProgress = milestone > 0 ? ((displayCount - milestone) / (nextMilestone - milestone)) * 100 : 0;
  const milestoneText = milestone >= 1000 ? `${(milestone / 1000).toFixed(milestone % 1000 === 0 ? 0 : 1)}K` : String(milestone);

  const renderCounter = () => {
    if (mode === 'pace') {
      return (
        <>
          <span className="font-black kilt-counter-num" style={{
            fontSize: `clamp(3rem, 12vw, ${fontSize})`,
            color, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {pace}
          </span>
          <span className="relative z-10 text-lg font-bold mt-1" style={{ color: `${color}66` }}>
            finishers / hour
          </span>
        </>
      );
    }
    if (mode === 'milestone') {
      return (
        <>
          <span className="relative z-10 text-lg font-bold mb-1" style={{ color: accentColor }}>OVER</span>
          <span className="font-black kilt-counter-num" style={{
            fontSize: `clamp(3rem, 15vw, ${fontSize})`,
            color, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {milestone > 0 ? milestone.toLocaleString() : '—'}
          </span>
          {/* Progress to next milestone */}
          <div className="relative z-10 w-2/3 mt-4">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{
                width: `${milestoneProgress}%`,
                background: `linear-gradient(90deg, ${accentColor}, #f8af35)`,
              }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-bold" style={{ color: `${color}44` }}>{milestone.toLocaleString()}</span>
              <span className="text-[10px] font-bold" style={{ color: `${color}44` }}>{nextMilestone.toLocaleString()}</span>
            </div>
          </div>
        </>
      );
    }
    if (mode === 'combined') {
      return (
        <>
          <span className="relative z-10 text-lg font-bold mb-1" style={{ color: accentColor }}>OVER</span>
          <span className="font-black kilt-counter-num" style={{
            fontSize: `clamp(3rem, 15vw, ${fontSize})`,
            color, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {milestone > 0 ? milestone.toLocaleString() : '—'}
          </span>
          {/* Pace underneath */}
          {pace > 0 && (
            <div className="relative z-10 mt-3 px-4 py-1.5 rounded-full" style={{
              background: `${accentColor}15`, border: `1px solid ${accentColor}22`,
            }}>
              <span className="text-sm font-bold" style={{ color: accentColor }}>
                ⏱ {pace} per hour
              </span>
            </div>
          )}
          {/* Progress bar */}
          <div className="relative z-10 w-2/3 mt-3">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{
                width: `${milestoneProgress}%`,
                background: `linear-gradient(90deg, ${accentColor}, #f8af35)`,
              }} />
            </div>
            <span className="text-[9px] font-bold block text-center mt-1" style={{ color: `${color}33` }}>
              Next: {nextMilestone.toLocaleString()}
            </span>
          </div>
        </>
      );
    }
    // exact mode
    return (
      <span className="font-black kilt-counter-num" style={{
        fontSize: `clamp(3rem, 15vw, ${fontSize})`,
        color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {displayCount.toLocaleString()}
      </span>
    );
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: bg }}>
      <style>{`
        @keyframes kiltConfetti {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes kiltPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes kiltGlow {
          0%, 100% { text-shadow: 0 0 20px ${accentColor}66, 0 0 60px ${accentColor}22; }
          50% { text-shadow: 0 0 40px ${accentColor}88, 0 0 100px ${accentColor}44; }
        }
        @keyframes kiltSlideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes milestoneSplash {
          0% { transform: scale(0.3) rotate(-3deg); opacity: 0; }
          15% { transform: scale(1.12) rotate(1deg); opacity: 1; }
          25% { transform: scale(0.97); opacity: 1; }
          35% { transform: scale(1.03); opacity: 1; }
          75% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        .kilt-counter-num {
          animation: kiltGlow 3s ease-in-out infinite;
        }
      `}</style>

      {/* Tartan background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(0deg, ${accentColor} 0px, transparent 1px, transparent 40px, ${accentColor} 41px),
                          repeating-linear-gradient(90deg, ${accentColor} 0px, transparent 1px, transparent 40px, ${accentColor} 41px)`,
      }} />

      {/* Accent glow */}
      <div className="absolute rounded-full" style={{
        width: '500px', height: '500px',
        background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      }} />

      {/* Milestone celebration splash */}
      {milestoneFlash && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ animation: 'milestoneSplash 4s ease-out forwards' }}>
          <div className="text-center">
            <span className="text-8xl">🎉</span>
            <div className="text-5xl font-black mt-2" style={{ color: '#f8af35', textShadow: '0 0 40px rgba(248,175,53,0.5)' }}>
              {milestoneFlash.toLocaleString()} FINISHERS!
            </div>
          </div>
        </div>
      )}

      {/* Confetti */}
      {showConfetti && celebrating && Array.from({ length: 60 }).map((_, i) => (
        <div key={i} className="absolute z-40" style={{
          left: `${Math.random() * 100}%`, top: '-20px',
          width: `${8 + Math.random() * 12}px`, height: `${8 + Math.random() * 12}px`,
          borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
          background: ['#e63b2b', '#008bc7', '#f8af35', '#006a47', '#80cef4', '#ffffff', '#ff69b4', '#ffd700'][i % 8],
          animation: `kiltConfetti ${2 + Math.random() * 3}s ease-out ${Math.random() * 1.5}s forwards`,
        }} />
      ))}

      {/* Logo */}
      <img src={logo} alt="Kiltwalk" className="relative z-10 h-10 mb-4 opacity-80"
        style={{ filter: 'brightness(1.2)' }} />

      {/* Title */}
      <span className="relative z-10 uppercase tracking-[0.4em] font-bold mb-2" style={{
        fontSize: 'clamp(0.8rem, 2vw, 1.2rem)', color: `${color}88`,
        animation: 'kiltSlideUp 0.6s ease-out',
      }}>{title}</span>

      {/* The counter — mode-dependent */}
      <div className="relative z-10 flex flex-col items-center" style={{
        animation: celebrating ? 'kiltPulse 0.3s ease-in-out 3' : undefined,
      }}>
        {renderCounter()}
      </div>

      {/* Route accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1" style={{ background: '#e63b2b' }} />
        <div className="flex-1" style={{ background: '#008bc7' }} />
        <div className="flex-1" style={{ background: '#006a47' }} />
      </div>

      <div className="absolute top-0 right-0 w-24 h-24" style={{
        background: `linear-gradient(135deg, transparent 50%, ${accentColor}15 50%)`,
      }} />
    </div>
  );
}
