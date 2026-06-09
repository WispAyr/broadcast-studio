import React, { useEffect, useRef } from 'react';
import { autoPlay, duck, unduck } from '../lib/audioBus';

// Full-screen goal celebration + the goal audio overlay.
//  - GoalGraphic: dramatic team-colour burst, spinning rays, big GOAL!, player.
//  - GoalAudio: plays the goal sound on the PA-feed screen (ducks the bed),
//    silent on muted video walls. Used by the `goal` overlay (full or lower).

const TEAM = {
  SCO: { name: 'SCOTLAND', a: '#0a2a66', b: '#1e6fd0', flag: 'saltire' },
  HAI: { name: 'HAITI', a: '#101a5c', b: '#d21034', flag: 'haiti' },
};
const GOLD = '#ffd24a';
const HEAD = "'MuseoModerno','Oswald',sans-serif";
const ini = (n = '') => n.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();

export function GoalAudio({ sound, audioOutput }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!audioOutput || !sound) return;
    duck(0.08, 150);
    const el = ref.current; let off = () => {};
    if (el) { el.volume = 1; off = autoPlay(el); }
    return () => { off(); unduck(600); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!audioOutput || !sound) return null;
  return <audio ref={ref} src={sound} preload="auto" playsInline />;
}

export default function GoalGraphic({ player, minute }) {
  if (!player) return null;
  const t = TEAM[player.team] || TEAM.SCO;
  const [first, ...rest] = (player.name || '').split(' ');
  const surname = rest.join(' ') || first;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: HEAD, color: '#fff',
      background: `radial-gradient(120% 120% at 50% 38%, ${t.b} 0%, ${t.a} 55%, #0a0a14 100%)` }}>
      <style>{`
        @keyframes ggRays { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ggFlash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
        @keyframes ggGoal { 0% { transform: scale(0.3) rotate(-6deg); opacity: 0; } 55% { transform: scale(1.12) rotate(2deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes ggShine { 0% { transform: translateX(-130%) skewX(-20deg); opacity: 0.55; } 75% { opacity: 0.55; } 100% { transform: translateX(560%) skewX(-20deg); opacity: 0; } }
        @keyframes ggUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        @keyframes ggConf { 0% { transform: translateY(-10vh) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; } }
      `}</style>

      {/* spinning light rays */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: '240vh', height: '240vh', transform: 'translate(-50%,-50%)',
        background: `repeating-conic-gradient(from 0deg, rgba(255,255,255,0.10) 0deg 6deg, transparent 6deg 14deg)`,
        animation: 'ggRays 24s linear infinite', opacity: 0.5 }} />
      {/* entry flash */}
      <div style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'ggFlash 0.5s ease-out forwards', pointerEvents: 'none' }} />
      {/* confetti */}
      {Array.from({ length: 22 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, left: `${(i * 4.6 + 3) % 100}%`, width: '0.9vw', height: '1.6vw',
          background: [GOLD, '#fff', t.b][i % 3], borderRadius: 2,
          animation: `ggConf ${2.4 + (i % 5) * 0.4}s linear ${(i % 7) * 0.12}s infinite` }} />
      ))}

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1vh' }}>
        {/* GOAL! — no overflow clip on the wrapper (it would box-clip the gold
            glow); the shine is clipped by its own inline-block text mask. */}
        <div style={{ position: 'relative', animation: 'ggGoal 0.7s cubic-bezier(.2,1.4,.4,1) both', display: 'inline-block' }}>
          <span style={{ fontWeight: 700, fontSize: '24vh', lineHeight: 0.9, color: GOLD, letterSpacing: '0.02em',
            textShadow: `0 0 50px ${GOLD}cc, 0 8px 30px rgba(0,0,0,.6)` }}>GOAL!</span>
          <span style={{ position: 'absolute', top: 0, left: 0, width: '20%', height: '100%', background: 'rgba(255,255,255,0.5)', mixBlendMode: 'overlay', animation: 'ggShine 1s ease-in 0.5s both', pointerEvents: 'none' }} />
        </div>

        {/* player */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vw', animation: 'ggUp 0.6s ease-out 0.25s both' }}>
          <div style={{ width: '15vh', height: '15vh', borderRadius: '50%', overflow: 'hidden', border: `0.5vh solid ${GOLD}`, boxShadow: '0 6px 30px rgba(0,0,0,.5)', background: t.a, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {player.photo ? <img src={player.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
              : <span style={{ fontWeight: 700, fontSize: '6vh' }}>{player.number ?? ini(player.name)}</span>}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '3vh', color: '#dfe9ff', letterSpacing: '0.1em' }}>{t.name}{minute ? ` · ${minute}'` : ''}</div>
            <div style={{ fontWeight: 700, fontSize: '9vh', lineHeight: 0.95, textShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
              {player.photo && player.number ? <span style={{ color: GOLD }}>{player.number} </span> : null}{player.name}
            </div>
            <div style={{ fontSize: '2.8vh', opacity: 0.85 }}>{player.club} · {player.intlGoals != null ? `${player.intlGoals} international goals` : player.pos}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
