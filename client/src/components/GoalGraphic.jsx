import React, { useEffect, useRef } from 'react';
import { autoPlay, duck, unduck } from '../lib/audioBus';

// Full-screen goal celebration + the goal audio overlay, in the SideLiners
// visual language (skewed gold slabs, purple/navy, shine sweeps, FanZone
// wordmark) to match the rest of the package.
//  - GoalGraphic: team-colour shard, gold rays, Anton "GOAL!", spark burst,
//    skewed player lockup.
//  - GoalAudio: plays the goal sound on the PA-feed screen (ducks the bed),
//    silent on muted video walls. Used by the `goal` overlay (full or lower).

const TEAM = {
  SCO: { name: 'SCOTLAND', shardA: '#1e6fd0', shardB: '#0a2a66', badge: '#0a2a66', spark: '#1e6fd0' },
  HAI: { name: 'HAITI', shardA: '#d21034', shardB: '#101a5c', badge: '#b00d2c', spark: '#d21034' },
};
const GOLD = '#ffd24a';
const NAVY = '#241a40';
const PURPLE = '#7a2f9e';
const HEAD = "'Oswald','Rajdhani',sans-serif";
const IMPACT = "'Anton','Oswald',sans-serif";
const ini = (n = '') => n.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();

export function GoalAudio({ sound, audioOutput }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!audioOutput || !sound) return;
    duck(0.06, 150);
    const el = ref.current; let off = () => {};
    if (el) { el.volume = 1; off = autoPlay(el); }
    return () => { off(); unduck(700); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!audioOutput || !sound) return null;
  return <audio ref={ref} src={sound} preload="auto" playsInline />;
}

export default function GoalGraphic({ player, minute }) {
  if (!player) return null;
  const t = TEAM[player.team] || TEAM.SCO;
  const min = minute ? String(minute).replace(/'+$/, '') : '';

  // Spark burst — fired once from the strike point. Each ember flies outward.
  const sparkCols = [GOLD, '#ffffff', t.spark];
  const sparks = Array.from({ length: 42 }).map((_, i) => {
    const a = (i / 42) * Math.PI * 2 + (i % 3) * 0.18;
    const rvw = 11 + (i % 7) * 1.7 + (i % 3) * 2.2;
    const rvh = 16 + (i % 5) * 3.4 + (i % 4) * 2.6;
    const sz = 0.5 + (i % 4) * 0.45; // vh
    const col = sparkCols[i % 3];
    return (
      <span key={i} style={{
        position: 'absolute', left: '50%', top: '40%', width: `${sz}vh`, height: `${sz}vh`,
        borderRadius: '50%', background: col, boxShadow: `0 0 ${sz * 1.8}vh ${col}`,
        // eslint-disable-next-line
        ['--dx']: `${Math.cos(a) * rvw}vw`, ['--dy']: `${Math.sin(a) * rvh}vh`,
        animation: `ggSpark ${1.1 + (i % 5) * 0.18}s cubic-bezier(.15,.7,.3,1) ${0.15 + (i % 6) * 0.03}s both`,
      }} />
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: HEAD, color: '#fff',
      background: `linear-gradient(135deg, ${NAVY} 0%, #171026 55%, #2b1052 100%)` }}>
      <style>{`
        @keyframes ggRays { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes ggFlash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
        @keyframes ggShardIn { 0% { opacity: 0; transform: skewX(-12deg) translateX(-14vw); } 100% { opacity: var(--o); transform: skewX(-12deg) translateX(0); } }
        @keyframes ggKick { 0% { opacity: 0; transform: skewX(-12deg) translateY(-5vh); } 100% { opacity: 1; transform: skewX(-12deg) translateY(0); } }
        @keyframes ggGoal { 0% { transform: skewX(-11deg) scale(0.3) rotate(-5deg); opacity: 0; } 55% { transform: skewX(-11deg) scale(1.1) rotate(1.5deg); opacity: 1; } 100% { transform: skewX(-11deg) scale(1) rotate(0); opacity: 1; } }
        @keyframes ggShine { 0% { transform: translateX(-160%) skewX(-20deg); } 70% { opacity: 0.55; } 100% { transform: translateX(520%) skewX(-20deg); opacity: 0; } }
        @keyframes ggSlab { 0% { opacity: 0; transform: skewX(-12deg) translateX(-60vw); } 70% { transform: skewX(-12deg) translateX(1.5vw); } 100% { opacity: 1; transform: skewX(-12deg) translateX(0); } }
        @keyframes ggSpark { 0% { transform: translate(-50%,-50%) scale(0); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); opacity: 0; } }
      `}</style>

      {/* team-colour shard + counter shard */}
      <div style={{ position: 'absolute', top: '-20%', left: '-12%', width: '62%', height: '140%', filter: 'blur(2px)',
        background: `linear-gradient(120deg, ${t.shardA} 0%, ${t.shardB} 70%)`, ['--o']: 0.32,
        animation: 'ggShardIn 0.6s cubic-bezier(.2,.8,.2,1) both' }} />
      <div style={{ position: 'absolute', top: '-20%', right: '-14%', width: '46%', height: '140%', opacity: 0.26,
        background: `linear-gradient(120deg, ${PURPLE} 0%, ${NAVY} 70%)`, transform: 'skewX(-12deg)' }} />
      {/* gold rays */}
      <div style={{ position: 'absolute', top: '42%', left: '50%', width: '230vh', height: '230vh',
        background: `repeating-conic-gradient(from 0deg, rgba(255,210,74,0.10) 0deg 5deg, transparent 5deg 13deg)`,
        opacity: 0.65, animation: 'ggRays 30s linear infinite' }} />
      {/* vignette + entry flash */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'ggFlash 0.45s ease-out forwards', pointerEvents: 'none' }} />

      {/* spark burst */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{sparks}</div>

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2.6vh' }}>
        {/* kicker slab */}
        <div style={{ background: GOLD, padding: '1.2vh 2.4vw', transform: 'skewX(-12deg)', boxShadow: '0 1.4vh 4vh rgba(0,0,0,0.45)', animation: 'ggKick 0.45s cubic-bezier(.2,.8,.2,1) 0.1s both' }}>
          <span style={{ display: 'inline-block', transform: 'skewX(12deg)', color: NAVY, fontWeight: 700, fontSize: '3.4vh', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            {t.name}{min ? ` · ${min}'` : ''}
          </span>
        </div>

        {/* GOAL! */}
        <div style={{ position: 'relative', display: 'inline-block', transform: 'skewX(-11deg)', animation: 'ggGoal 0.7s cubic-bezier(.2,1.35,.4,1) 0.15s both' }}>
          <span style={{ display: 'inline-block', transform: 'skewX(11deg)', fontFamily: IMPACT, fontSize: '28vh', lineHeight: 0.8, color: GOLD, letterSpacing: '0.01em', textShadow: `0 0 6vh ${GOLD}88, 0 1.4vh 3vh rgba(0,0,0,0.6)` }}>GOAL!</span>
          <span style={{ position: 'absolute', top: 0, left: 0, width: '5vw', height: '100%', background: 'rgba(255,255,255,0.5)', mixBlendMode: 'overlay', animation: 'ggShine 1s ease-in 0.6s both', pointerEvents: 'none' }} />
        </div>

        {/* player lockup */}
        <div style={{ display: 'flex', alignItems: 'center', transform: 'skewX(-12deg)', background: `linear-gradient(120deg, ${PURPLE}, ${NAVY})`, padding: '2.2vh 2.9vw 2.2vh 1.5vw', boxShadow: '0 2.2vh 6vh rgba(0,0,0,0.55)', animation: 'ggSlab 0.6s cubic-bezier(.2,.85,.25,1) 0.4s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.8vw', transform: 'skewX(12deg)' }}>
            <div style={{ width: '13.5vh', height: '13.5vh', borderRadius: '50%', border: `0.5vh solid ${GOLD}`, background: t.badge, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0.8vh 3vh rgba(0,0,0,0.5)', flex: 'none' }}>
              {player.photo ? <img src={player.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                : <span style={{ fontWeight: 700, fontSize: '6vh' }}>{player.number ?? ini(player.name)}</span>}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '3.1vh', color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: '9.2vh', lineHeight: 0.95, textTransform: 'uppercase', textShadow: '0 0.4vh 2vh rgba(0,0,0,0.5)' }}>{player.name}</div>
              <div style={{ fontSize: '3vh', color: '#cdbff0', marginTop: '0.4vh' }}>{player.club}{player.intlGoals != null ? ` · ${player.intlGoals} international goals` : (player.pos ? ` · ${player.pos}` : '')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* FanZone wordmark */}
      <div style={{ position: 'absolute', bottom: '4.2vh', right: '3.3vw', fontStyle: 'italic', fontWeight: 700, fontSize: '3.8vh', color: 'rgba(255,255,255,0.6)', transform: 'skewX(-12deg)' }}>
        <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>Side<span style={{ color: GOLD }}>Liner's</span> FanZone</span>
      </div>
    </div>
  );
}
