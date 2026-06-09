import React from 'react';

// PlayerProfileCard — broadcast player graphic. Used by:
//   • MatchStatsModule `profile` view (full-screen)
//   • the goalscorer overlay (mode="goal", fired over the match)
//
// Renders a photo when player.photo is set, else a branded number/initials avatar.
// Team colours come from the player's team (SCO/HAI). Pure CSS animations.

const TEAM = {
  SCO: { name: 'SCOTLAND', primary: '#0a2a66', accent: '#1e6fd0', flag: 'saltire' },
  HAI: { name: 'HAITI', primary: '#101a5c', accent: '#d21034', flag: 'haiti' },
};
const PURPLE = '#7a2f9e', PURPLE_HI = '#a44ad0', GOLD = '#ffd24a';
const HEAD = "'MuseoModerno','Oswald',sans-serif";

function Flag({ kind, h = '4vh' }) {
  if (kind === 'saltire') return (
    <div style={{ width: `calc(${h} * 1.6)`, height: h, background: '#0065bf', position: 'relative', overflow: 'hidden', borderRadius: 3, display: 'inline-block' }}>
      <div style={{ position: 'absolute', top: '50%', left: '-10%', width: '120%', height: '20%', background: '#fff', transform: 'translateY(-50%) rotate(29deg)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '-10%', width: '120%', height: '20%', background: '#fff', transform: 'translateY(-50%) rotate(-29deg)' }} />
    </div>
  );
  return (
    <div style={{ width: `calc(${h} * 1.6)`, height: h, borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
      <div style={{ height: '50%', background: '#00209f' }} /><div style={{ height: '50%', background: '#d21034' }} />
    </div>
  );
}

const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();

function Avatar({ player, t }) {
  if (player.photo) {
    return <img src={player.photo} alt={player.name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />;
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(160deg, ${t.primary}, ${t.accent}88)`, color: '#ffffff' }}>
      <div style={{ fontFamily: HEAD, fontWeight: 700, fontSize: '22vh', lineHeight: 0.8, opacity: 0.9 }}>{player.number ?? ''}</div>
      <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: '5vh', letterSpacing: '0.15em', marginTop: '1vh', opacity: 0.85 }}>{initials(player.name)}</div>
    </div>
  );
}

function StatBlock({ label, value }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '14vh' }}>
      <div style={{ fontFamily: HEAD, fontWeight: 700, fontSize: '7vh', lineHeight: 1, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: '2.2vh', letterSpacing: '0.18em', color: PURPLE_HI, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export default function PlayerProfileCard({ player, mode = 'profile', minute, layout = 'full', noAnim = false }) {
  // noAnim: skip the opacity-from-0 entrance (used by the rotator's crossfade so
  // a backgrounded/throttled tab can never freeze the card on a dark frame).
  const photoAnim = noAnim ? undefined : 'ppcPhoto 0.5s ease-out both';
  const detailAnim = noAnim ? undefined : 'ppcIn 0.5s ease-out both';
  if (!player) return null;
  const t = TEAM[player.team] || TEAM.SCO;
  const isGoal = mode === 'goal';
  const [first, ...rest] = (player.name || '').split(' ');
  const surname = rest.join(' ') || first;

  // ── Lower-third band (overlay the match feed without covering it) ──
  if (layout === 'lower') {
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '4vh', display: 'flex', justifyContent: 'flex-start', pointerEvents: 'none' }}>
        <style>{`@keyframes l3in { from { opacity:0; transform: translateX(-60px);} to {opacity:1; transform:translateX(0);} } @keyframes l3pulse {0%,100%{opacity:1}50%{opacity:.85}}`}</style>
        <div style={{ display: 'flex', alignItems: 'stretch', height: '17vh', minWidth: '62vw', maxWidth: '88vw',
          animation: 'l3in 0.45s cubic-bezier(.2,.8,.2,1) both', fontFamily: HEAD, color: '#fff',
          background: `linear-gradient(90deg, ${t.primary} 0%, ${PURPLE} 55%, #241a40 100%)`,
          borderLeft: `1vh solid ${isGoal ? GOLD : t.accent}`, boxShadow: '0 10px 40px rgba(0,0,0,.5)', overflow: 'hidden' }}>
          {/* thumb */}
          <div style={{ width: '17vh', flexShrink: 0, position: 'relative', overflow: 'hidden', background: t.primary }}>
            {player.photo
              ? <img src={player.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '8vh', opacity: 0.9 }}>{player.number ?? ''}</div>}
          </div>
          <div style={{ flex: 1, padding: '0 3vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            {isGoal
              ? <div style={{ fontSize: '3vh', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', animation: 'l3pulse 0.9s infinite' }}>⚽ GOAL{minute ? ` · ${minute}'` : ''}</div>
              : <div style={{ fontSize: '2.4vh', fontWeight: 600, color: '#d9c7f0', letterSpacing: '0.12em' }}>{t.name}{player.role ? ` · ${player.role}` : ''}</div>}
            <div style={{ fontSize: '7vh', fontWeight: 700, lineHeight: 0.95, textShadow: '0 3px 14px rgba(0,0,0,.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {player.number ? <span style={{ color: t.accent, marginRight: '1vw' }}>{player.number}</span> : null}{player.name}
            </div>
            <div style={{ fontSize: '2.6vh', opacity: 0.85 }}>{player.pos} · {player.club}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5vw', padding: '0 3vw', borderLeft: '1px solid rgba(255,255,255,.15)' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '5vh', fontWeight: 700, lineHeight: 1 }}>{player.caps ?? '—'}</div><div style={{ fontSize: '1.8vh', color: PURPLE_HI, letterSpacing: '0.12em' }}>CAPS</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '5vh', fontWeight: 700, lineHeight: 1 }}>{player.intlGoals ?? '—'}</div><div style={{ fontSize: '1.8vh', color: PURPLE_HI, letterSpacing: '0.12em' }}>GOALS</div></div>
            <div style={{ alignSelf: 'center' }}><Flag kind={t.flag} h="5vh" /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden', color: '#fff', fontFamily: HEAD,
      background: `radial-gradient(120% 120% at 18% 0%, ${PURPLE} 0%, #241a40 48%, #15102b 100%)`,
      display: 'flex', alignItems: 'stretch',
    }}>
      <style>{`
        @keyframes ppcIn { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes ppcPhoto { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: scale(1); } }
        @keyframes goalPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes goalSweep { from { background-position: -200% 0; } to { background-position: 200% 0; } }
      `}</style>

      {/* Big shirt-number watermark */}
      <div style={{ position: 'absolute', right: '-2%', top: '-8%', fontFamily: HEAD, fontWeight: 700, fontSize: '70vh',
        color: '#ffffff', opacity: 0.05, lineHeight: 1, pointerEvents: 'none' }}>{player.number ?? ''}</div>

      {/* Photo panel (left), skewed brand edge */}
      <div style={{ width: '38%', position: 'relative', flexShrink: 0, overflow: 'hidden', animation: photoAnim,
        borderRight: `0.5vh solid ${t.accent}` }}>
        <Avatar player={player} t={t} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 60%, #241a4099)` }} />
        {/* number badge */}
        <div style={{ position: 'absolute', bottom: '3vh', left: '2vh', background: t.accent, color: '#fff', fontWeight: 700,
          fontSize: '5vh', padding: '0.4vh 2vh', borderRadius: '1vh', transform: 'skewX(-8deg)' }}>
          <span style={{ display: 'inline-block', transform: 'skewX(8deg)' }}>{player.number ?? '—'}</span>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, padding: '5vh 4vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', animation: detailAnim }}>
        {isGoal ? (
          <div style={{ marginBottom: '2vh', display: 'flex', alignItems: 'center', gap: '1.5vw', animation: 'goalPulse 0.9s ease-in-out infinite', transformOrigin: 'left center' }}>
            <span style={{ fontSize: '9vh', lineHeight: 1 }}>⚽</span>
            <span style={{ fontWeight: 700, fontSize: '9vh', letterSpacing: '0.08em', color: GOLD, textShadow: `0 0 30px ${GOLD}aa, 0 4px 10px rgba(0,0,0,.6)` }}>
              GOAL!{minute ? ` ${minute}'` : ''}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vw', marginBottom: '2vh' }}>
            <Flag kind={t.flag} h="5vh" />
            <span style={{ fontWeight: 600, fontSize: '3vh', letterSpacing: '0.2em', color: PURPLE_HI }}>{t.name}</span>
            {player.role ? <span style={{ marginLeft: '0.5vw', background: PURPLE, padding: '0.4vh 1.4vh', borderRadius: '4vh', fontSize: '2.4vh', fontWeight: 600 }}>{player.role}</span> : null}
          </div>
        )}

        <div style={{ fontWeight: 400, fontSize: '5vh', lineHeight: 0.95, color: '#cdbfe6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{first}</div>
        <div style={{ fontWeight: 700, fontSize: '12vh', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.01em', textShadow: '0 6px 30px rgba(0,0,0,.5)' }}>{surname}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw', margin: '2.5vh 0 3vh', fontSize: '3.2vh', color: '#e9def7' }}>
          <span style={{ background: t.primary, padding: '0.4vh 1.6vh', borderRadius: '0.8vh', fontWeight: 700 }}>{player.pos}</span>
          <span>{player.club}</span>
        </div>

        <div style={{ display: 'flex', gap: '3vw', borderTop: `2px solid ${PURPLE}66`, paddingTop: '3vh' }}>
          <StatBlock label="Caps" value={player.caps ?? '—'} />
          <StatBlock label="Intl Goals" value={player.intlGoals ?? '—'} />
          {isGoal && player.role ? <StatBlock label="" value={player.role} /> : null}
        </div>
      </div>
    </div>
  );
}
