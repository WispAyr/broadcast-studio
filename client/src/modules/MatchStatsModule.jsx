import React from 'react';
import PlayerProfileCard from '../components/PlayerProfileCard';
import { SCOTLAND, HAITI, ALL_PLAYERS } from '../data/squads';

// Match stats / info screens — SideLiner's FanZone.
// One module, many views (config.view): header | form | players | group | road | facts.
// The Scotland v Haiti (World Cup 26, Group C) dataset is baked in as the default
// so it works offline at the venue; override via config.data if needed.

const DATA = {
  competition: 'FIFA WORLD CUP 26 · GROUP C · MATCHDAY 1',
  kickoff: 'SAT 13 JUNE · KICK-OFF 2:00 AM BST (SUN)',
  venue: 'Gillette Stadium, Foxborough · Boston',
  tv: 'Live on BBC One / iPlayer · STV in Scotland',
  home: { name: 'SCOTLAND', code: 'SCO', rank: '42nd', nick: 'The Tartan Army', mgr: 'Steve Clarke', capt: 'Andy Robertson',
    confed: 'UEFA', flag: 'saltire',
    qualified: 'Won UEFA Group C — 13 pts (W4 D1 L1), beat Denmark 4-2 at Hampden to seal it',
    form: [['Bolivia','4-0','W'],['Curaçao','4-1','W'],['Denmark','4-2','W'],['Greece','3-2','W'],['Belarus','2-1','W']],
    players: [['Andy Robertson','Liverpool · captain'],['Scott McTominay','Napoli'],['Billy Gilmour','Napoli'],['John McGinn','Aston Villa'],['Kieran Tierney','Celtic'],['Che Adams','Torino'],['Lawrence Shankland','Hearts']] },
  away: { name: 'HAITI', code: 'HAI', rank: '83rd', nick: 'Les Grenadiers', mgr: 'Sébastien Migné', capt: 'Johny Placide',
    confed: 'CONCACAF', flag: 'haiti',
    qualified: 'Won CONCACAF final group — 11 pts, ahead of Costa Rica & Honduras',
    form: [['New Zealand','4-0','W'],['Peru','1-2','L'],['Iceland','1-1','D'],['Tunisia','0-1','L'],['Suriname','2-0','W']],
    players: [['Wilson Isidor','Sunderland'],['Jean-Ricner Bellegarde','Wolves'],['Frantzdy Pierrot','forward'],['Duckens Nazon','top scorer'],['Johny Placide','GK · captain'],['Danley Jean-Jacques','midfield']] },
  group: [['Brazil','6th'],['Morocco','7th'],['Scotland','42nd'],['Haiti','83rd']],
  fixtures: [['Sun 14 Jun · 02:00','Haiti v Scotland','Foxborough'],['Fri 19 Jun · 23:00','Scotland v Morocco','Foxborough'],['Wed 24 Jun · 23:00','Scotland v Brazil','Miami']],
  facts: [
    "Scotland's first World Cup since 1998 — a 28-year wait, ended by a 4-2 win over Denmark at Hampden.",
    "Haiti's first since 1974 — only their 2nd ever, and the only Caribbean nation to reach a men's World Cup.",
    'First-ever meeting — Scotland have never faced Haiti at any level.',
    'Both outsiders in a group with Brazil & Morocco — widely seen as must-win for a knockout shot.',
    "Sunderland's Wilson Isidor switched allegiance from France to Haiti in March 2026.",
  ],
};

const PURPLE = '#7a2f9e', PURPLE_HI = '#a44ad0', NAVY = '#241a40', NAVY_DEEP = '#15102b', GOLD = '#ffd24a';
const HEAD = "'Oswald','Rajdhani',sans-serif";
const wrap = { width: '100%', height: '100%', color: '#fff', fontFamily: HEAD, padding: '3vh 3vw', boxSizing: 'border-box',
  background: `radial-gradient(120% 120% at 25% 0%, ${PURPLE} 0%, ${NAVY} 50%, ${NAVY_DEEP} 100%)`, overflow: 'hidden', display: 'flex', flexDirection: 'column' };

function Saltire({ s = '5vh' }) {
  return <div style={{ width: `calc(${s} * 1.5)`, height: s, background: '#0065bf', position: 'relative', overflow: 'hidden', borderRadius: 3, display: 'inline-block' }}>
    <div style={{ position: 'absolute', top: '50%', left: '-10%', width: '120%', height: '18%', background: '#fff', transform: 'translateY(-50%) rotate(31deg)' }} />
    <div style={{ position: 'absolute', top: '50%', left: '-10%', width: '120%', height: '18%', background: '#fff', transform: 'translateY(-50%) rotate(-31deg)' }} />
  </div>;
}
function HaitiFlag({ s = '5vh' }) {
  return <div style={{ width: `calc(${s} * 1.5)`, height: s, borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
    <div style={{ height: '50%', background: '#00209f' }} /><div style={{ height: '50%', background: '#d21034' }} /></div>;
}
const Flag = ({ kind, s }) => (kind === 'saltire' ? <Saltire s={s} /> : <HaitiFlag s={s} />);

const Title = ({ children }) => (
  <div style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, fontSize: '4.2vh', color: GOLD,
    borderLeft: `0.6vw solid ${PURPLE_HI}`, paddingLeft: '1vw', marginBottom: '2.5vh', flexShrink: 0 }}>{children}</div>
);
const TeamCols = ({ d, render }) => (
  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2vw', minHeight: 0 }}>
    {[d.home, d.away].map((t) => (
      <div key={t.code} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1vh', padding: '2.5vh 2vw', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw', marginBottom: '2vh' }}>
          <Flag kind={t.flag} s="6vh" />
          <div style={{ fontWeight: 700, fontSize: '5vh', lineHeight: 1 }}>{t.name}</div>
          <div style={{ marginLeft: 'auto', color: PURPLE_HI, fontSize: '2.6vh', fontWeight: 600 }}>FIFA {t.rank}</div>
        </div>
        {render(t)}
      </div>
    ))}
  </div>
);

export default function MatchStatsModule({ config = {} }) {
  const d = config.data || DATA;
  const view = config.view || 'header';

  if (view === 'header') {
    return (
      <div style={{ ...wrap, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ color: GOLD, letterSpacing: '0.2em', fontSize: '2.8vh', fontWeight: 600 }}>{d.competition}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3vw', margin: '3vh 0' }}>
          <div style={{ textAlign: 'center' }}><Flag kind={d.home.flag} s="9vh" /><div style={{ fontWeight: 700, fontSize: '8.5vh', lineHeight: 1 }}>{d.home.name}</div><div style={{ color: PURPLE_HI, fontSize: '3vh' }}>FIFA {d.home.rank}</div></div>
          <div style={{ width: '11vh', height: '11vh', borderRadius: '50%', background: `linear-gradient(135deg, ${PURPLE_HI}, ${PURPLE})`, border: '0.4vh solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6vh', fontWeight: 700, flexShrink: 0 }}>V</div>
          <div style={{ textAlign: 'center' }}><Flag kind={d.away.flag} s="9vh" /><div style={{ fontWeight: 700, fontSize: '8.5vh', lineHeight: 1 }}>{d.away.name}</div><div style={{ color: PURPLE_HI, fontSize: '3vh' }}>FIFA {d.away.rank}</div></div>
        </div>
        <div style={{ fontSize: '3.6vh', fontWeight: 600 }}>{d.kickoff}</div>
        <div style={{ fontSize: '2.6vh', opacity: 0.85, marginTop: '0.6vh' }}>{d.venue}</div>
        <div style={{ marginTop: '2vh', background: PURPLE, padding: '1vh 2.5vw', borderRadius: '5vh', fontSize: '2.6vh', fontWeight: 600, letterSpacing: '0.1em', transform: 'skewX(-10deg)' }}><span style={{ display: 'inline-block', transform: 'skewX(10deg)' }}>FIRST-EVER MEETING · {d.tv}</span></div>
      </div>
    );
  }

  if (view === 'form') {
    return (<div style={wrap}><Title>Recent Form</Title>
      <TeamCols d={d} render={(t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2vh' }}>
          {t.form.map(([opp, sc, r], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1vw', fontSize: '3vh' }}>
              <span style={{ width: '4.5vh', height: '4.5vh', borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '2.4vh', background: r === 'W' ? '#2e9e5b' : r === 'D' ? '#9e8b2e' : '#9e2e3e' }}>{r}</span>
              <span style={{ flex: 1 }}>{opp}</span><span style={{ fontWeight: 700, color: GOLD }}>{sc}</span>
            </div>
          ))}
        </div>
      )} /></div>);
  }

  if (view === 'players') {
    const ini = (n) => n.split(' ').map((w) => w[0]).slice(-2).join('');
    const col = (players, team, mgr, tint) => (
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1vh', padding: '2vh 1.6vw', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw', marginBottom: '1.4vh' }}>
          <span style={{ fontWeight: 700, fontSize: '4vh' }}>{team}</span>
          <span style={{ marginLeft: 'auto', fontSize: '2.2vh', color: PURPLE_HI }}>Mgr: {mgr}</span>
        </div>
        {players.slice(0, 6).map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1vw', padding: '0.7vh 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '6vh', height: '6vh', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: `linear-gradient(150deg, ${tint}, ${tint}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '2.4vh' }}>
              {p.photo ? <img src={p.photo} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} /> : (p.number ?? ini(p.name))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '2.9vh', lineHeight: 1.05 }}>{p.name}{p.role ? <span style={{ color: GOLD, fontSize: '2vh' }}>  · {p.role}</span> : null}</div>
              <div style={{ fontSize: '2.1vh', opacity: 0.7 }}>{p.pos} · {p.club}</div>
            </div>
          </div>
        ))}
      </div>
    );
    return (<div style={wrap}><Title>Key Players</Title>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2vw', minHeight: 0 }}>
        {col(SCOTLAND, 'SCOTLAND', d.home.mgr, '#0a2a66')}
        {col(HAITI, 'HAITI', d.away.mgr, '#101a5c')}
      </div></div>);
  }

  if (view === 'profile') {
    const p = config.player || ALL_PLAYERS.find((x) => x.name === config.playerName) || SCOTLAND[2];
    return <div style={{ width: '100%', height: '100%' }}><PlayerProfileCard player={p} mode={config.goal ? 'goal' : 'profile'} minute={config.minute} /></div>;
  }

  if (view === 'group') {
    return (<div style={wrap}><Title>Group C</Title>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '2vw', minHeight: 0 }}>
        <div>
          {d.group.map(([t, r], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1vw', fontSize: '3.6vh', padding: '1.4vh 1vw', background: (t === 'Scotland' || t === 'Haiti') ? `${PURPLE}66` : 'rgba(255,255,255,0.04)', borderRadius: '0.8vh', marginBottom: '1vh' }}>
              <span style={{ color: PURPLE_HI, fontWeight: 700, width: '2vw' }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{t}</span><span style={{ opacity: 0.7, fontSize: '2.6vh' }}>FIFA {r}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ color: GOLD, fontSize: '2.6vh', marginBottom: '1vh', letterSpacing: '0.1em' }}>SCOTLAND'S FIXTURES</div>
          {d.fixtures.map(([when, m, where], i) => (
            <div key={i} style={{ padding: '1.2vh 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '3vh', fontWeight: 600 }}>{m}</div>
              <div style={{ fontSize: '2.3vh', opacity: 0.75 }}>{when} · {where}</div>
            </div>
          ))}
        </div>
      </div></div>);
  }

  if (view === 'road') {
    return (<div style={wrap}><Title>Road to the World Cup</Title>
      <TeamCols d={d} render={(t) => (
        <div>
          <div style={{ fontSize: '2.6vh', color: PURPLE_HI, marginBottom: '1vh' }}>{t.confed} · {t.nick}</div>
          <div style={{ fontSize: '3.2vh', lineHeight: 1.45 }}>{t.qualified}</div>
        </div>
      )} /></div>);
  }

  // facts
  return (<div style={wrap}><Title>Did You Know</Title>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2.2vh' }}>
      {d.facts.map((fct, i) => (
        <div key={i} style={{ display: 'flex', gap: '1.2vw', fontSize: '3.4vh', lineHeight: 1.3 }}>
          <span style={{ color: GOLD, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span><span>{fct}</span>
        </div>
      ))}
    </div></div>);
}
