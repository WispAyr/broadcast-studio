import React from 'react';
import PlayerProfileCard from '../components/PlayerProfileCard';
import { SCOTLAND, HAITI, ALL_PLAYERS } from '../data/squads';
import { FACTS } from '../data/matchInfo';

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
const HEAD = "'MuseoModerno','Oswald',sans-serif";
const wrap = { width: '100%', height: '100%', color: '#fff', fontFamily: HEAD, padding: '3vh 3vw', boxSizing: 'border-box',
  background: `radial-gradient(120% 120% at 25% 0%, ${PURPLE} 0%, ${NAVY} 50%, ${NAVY_DEEP} 100%)`, overflow: 'hidden', display: 'flex', flexDirection: 'column' };

// Player prominence (stars first) — shared by Key Players + the profile rotator.
const prominence = (p) => (p.role ? 1000 : 0) + (p.intlGoals || 0) * 3 + (p.caps || 0) / 5 + (p.photo ? 8 : 0);

// Build a rotation roster: team='SCO'|'HAI'|'both'; keyOnly limits to role-tagged;
// 'both' interleaves the two squads (alternating) so it feels like a match line-up.
function roster(team = 'both', keyOnly = false) {
  const ord = (a) => [...a].sort((x, y) => prominence(y) - prominence(x));
  let list;
  if (team === 'SCO') list = ord(SCOTLAND);
  else if (team === 'HAI') list = ord(HAITI);
  else {
    const s = ord(SCOTLAND), h = ord(HAITI); list = [];
    for (let i = 0; i < Math.max(s.length, h.length); i++) { if (s[i]) list.push(s[i]); if (h[i]) list.push(h[i]); }
  }
  return keyOnly ? list.filter((p) => p.role) : list;
}

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

const KEYS = `@keyframes msTitle{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
@keyframes msCard{from{opacity:0;transform:translateY(45px) scale(.97)}to{opacity:1;transform:none}}
@keyframes msPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes msRise{from{opacity:0;transform:translateY(25px)}to{opacity:1;transform:none}}`;
const Keys = () => <style>{KEYS}</style>;

// Flag framed as a crest badge (white-ringed shield).
const Crest = ({ kind, s = '6vh', delay = 0 }) => (
  <div style={{ padding: '0.5vh', background: '#fff', borderRadius: '1vh', boxShadow: '0 5px 18px rgba(0,0,0,.45)', display: 'inline-flex', animation: `msPop .5s cubic-bezier(.2,1.2,.4,1) ${delay}s both` }}>
    <Flag kind={kind} s={s} />
  </div>
);

const Title = ({ children }) => (<>
  <Keys />
  <div style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, fontSize: '4.2vh', color: GOLD,
    borderLeft: `0.6vw solid ${PURPLE_HI}`, paddingLeft: '1vw', marginBottom: '2.5vh', flexShrink: 0, animation: 'msTitle .5s ease-out both' }}>{children}</div>
</>);
const TeamCols = ({ d, render }) => (
  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2vw', minHeight: 0 }}>
    {[d.home, d.away].map((t, idx) => (
      <div key={t.code} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1vh', padding: '2.5vh 2vw', display: 'flex', flexDirection: 'column', minHeight: 0, animation: `msCard .55s ease-out ${idx * 0.12}s both` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw', marginBottom: '2vh' }}>
          <Crest kind={t.flag} s="6vh" delay={idx * 0.12 + 0.1} />
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
        <Keys />
        <div style={{ color: GOLD, letterSpacing: '0.2em', fontSize: '2.8vh', fontWeight: 600, animation: 'msRise .5s ease-out both' }}>{d.competition}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3vw', margin: '3vh 0' }}>
          <div style={{ textAlign: 'center', animation: 'msCard .6s ease-out .1s both' }}><Crest kind={d.home.flag} s="9vh" delay={0.25} /><div style={{ fontWeight: 700, fontSize: '8.5vh', lineHeight: 1, marginTop: '1vh' }}>{d.home.name}</div><div style={{ color: PURPLE_HI, fontSize: '3vh' }}>FIFA {d.home.rank}</div></div>
          <div style={{ width: '11vh', height: '11vh', borderRadius: '50%', background: `linear-gradient(135deg, ${PURPLE_HI}, ${PURPLE})`, border: '0.4vh solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6vh', fontWeight: 700, flexShrink: 0, animation: 'msPop .6s cubic-bezier(.2,1.3,.4,1) .35s both' }}>V</div>
          <div style={{ textAlign: 'center', animation: 'msCard .6s ease-out .2s both' }}><Crest kind={d.away.flag} s="9vh" delay={0.35} /><div style={{ fontWeight: 700, fontSize: '8.5vh', lineHeight: 1, marginTop: '1vh' }}>{d.away.name}</div><div style={{ color: PURPLE_HI, fontSize: '3vh' }}>FIFA {d.away.rank}</div></div>
        </div>
        <div style={{ fontSize: '3.6vh', fontWeight: 600, animation: 'msRise .5s ease-out .45s both' }}>{d.kickoff}</div>
        <div style={{ fontSize: '2.6vh', opacity: 0.85, marginTop: '0.6vh', animation: 'msRise .5s ease-out .55s both' }}>{d.venue}</div>
        <div style={{ marginTop: '2vh', background: PURPLE, padding: '1vh 2.5vw', borderRadius: '5vh', fontSize: '2.6vh', fontWeight: 600, letterSpacing: '0.1em', transform: 'skewX(-10deg)', animation: 'msRise .5s ease-out .65s both' }}><span style={{ display: 'inline-block', transform: 'skewX(10deg)' }}>FIRST-EVER MEETING · {d.tv}</span></div>
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
    // Lead with the marquee names, not squad order (which is GKs first).
    const top = (players) => [...players].sort((a, b) => prominence(b) - prominence(a)).slice(0, 7);
    const col = (players, team, mgr, tint) => (
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1vh', padding: '2vh 1.6vw', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw', marginBottom: '1vh', paddingBottom: '1vh', borderBottom: `2px solid ${tint}` }}>
          <span style={{ fontWeight: 700, fontSize: '4vh' }}>{team}</span>
          <span style={{ marginLeft: 'auto', fontSize: '2.2vh', color: PURPLE_HI }}>Mgr: {mgr}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>
          {top(players).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1vw', flex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: '7vh', height: '7vh', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: `linear-gradient(150deg, ${tint}, ${tint}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '2.6vh' }}>
                {p.photo ? <img src={p.photo} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} /> : (p.number ?? ini(p.name))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '3vh', lineHeight: 1.05 }}>{p.name}{p.role ? <span style={{ color: GOLD, fontSize: '2vh' }}>  · {p.role}</span> : null}</div>
                <div style={{ fontSize: '2.1vh', opacity: 0.7 }}>{p.pos} · {p.club}</div>
              </div>
            </div>
          ))}
        </div>
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

  if (view === 'profiles' || view === 'profile_rotation') {
    return <ProfileRotator team={config.team || 'both'} secs={config.secs || 9} keyOnly={!!config.keyOnly} />;
  }

  if (view === 'loop') {
    return <MatchLoop views={config.views} secs={config.secs || 14} config={config} />;
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

  // facts — interactive auto-cycling "Did You Know"
  return <FactsCycler facts={config.facts || FACTS} interval={config.factSecs || 7} />;
}

function FactsCycler({ facts, interval }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % facts.length), interval * 1000);
    return () => clearInterval(t);
  }, [facts.length, interval]);
  return (
    <div style={wrap}>
      <style>{`@keyframes dykIn { from { opacity:0; transform: translateY(40px) scale(.98);} to {opacity:1; transform:none;} } @keyframes dykBar { from { width:0; } to { width:100%; } }`}</style>
      <Title>Did You Know</Title>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', right: '1vw', top: '-1vh', fontFamily: HEAD, fontWeight: 700, fontSize: '30vh', color: '#fff', opacity: 0.05, lineHeight: 1 }}>?</div>
        <div key={i} style={{ animation: 'dykIn 0.6s cubic-bezier(.2,.8,.2,1) both', maxWidth: '85%' }}>
          <div style={{ fontSize: '2.6vh', letterSpacing: '0.2em', color: GOLD, marginBottom: '2vh' }}>FACT {i + 1} / {facts.length}</div>
          <div style={{ fontSize: '6vh', fontWeight: 600, lineHeight: 1.18 }}>{facts[i]}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1vw', marginTop: '2vh' }}>
        {facts.map((_, n) => (
          <div key={n} style={{ flex: 1, height: '0.7vh', borderRadius: 4, background: n === i ? PURPLE_HI : 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
            {n === i && <div style={{ position: 'absolute', inset: 0, background: GOLD, animation: `dykBar ${interval}s linear` }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Full-page player profiles, auto-rotating through the squad (stars first).
// Crossfade: the previous card stays mounted underneath (always fully visible)
// while the new one fades in on top — so a throttled/backgrounded tab can never
// leave a dark frame. Both cards use noAnim (no opacity-from-0 entrance).
function ProfileRotator({ team, secs, keyOnly }) {
  const list = React.useMemo(() => roster(team, keyOnly), [team, keyOnly]);
  const period = Math.max(3, Number(secs) || 9);
  const [s, setS] = React.useState({ cur: 0, prev: 0, n: 0 });
  React.useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => setS((p) => ({ cur: (p.cur + 1) % list.length, prev: p.cur, n: p.n + 1 })), period * 1000);
    return () => clearInterval(t);
  }, [list.length, period]);
  const cur = list[s.cur % list.length];
  const prev = list[s.prev % list.length];
  if (!cur) return null;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: NAVY_DEEP }}>
      <style>{`@keyframes prWipe { from { transform: translateX(102%); } to { transform: translateX(0); } } @keyframes prBar { from { width: 0; } to { width: 100%; } }`}</style>
      {/* Previous card sits underneath; the new one slides in fully OPAQUE (a
          clean push wipe) so the two never blend into a washed-out ghost. */}
      <div style={{ position: 'absolute', inset: 0 }}><PlayerProfileCard player={prev} mode="profile" layout="full" noAnim /></div>
      <div key={s.n} style={{ position: 'absolute', inset: 0, animation: 'prWipe 0.55s cubic-bezier(.4,0,.15,1) both', boxShadow: '-2vw 0 5vw rgba(0,0,0,0.5)' }}>
        <PlayerProfileCard player={cur} mode="profile" layout="full" noAnim />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '0.6vh', background: 'rgba(255,255,255,0.15)', zIndex: 5 }}>
        <div key={s.n} style={{ height: '100%', background: GOLD, animation: `prBar ${period}s linear` }} />
      </div>
      <div style={{ position: 'absolute', top: '2.5vh', right: '3vw', fontFamily: HEAD, fontSize: '2vh', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.15em', zIndex: 5 }}>
        {(s.cur % list.length) + 1} / {list.length}
      </div>
    </div>
  );
}

// Match Centre loop — hands-free carousel of the info screens.
const LOOP_VIEWS = ['header', 'form', 'players', 'group', 'road', 'facts'];
function MatchLoop({ views, secs, config }) {
  const vs = (Array.isArray(views) && views.length) ? views : LOOP_VIEWS;
  const period = Math.max(5, Number(secs) || 14);
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % vs.length), period * 1000);
    return () => clearInterval(t);
  }, [vs.length, period]);
  return (
    <div key={i} style={{ width: '100%', height: '100%', animation: 'prFade 0.6s ease-out both' }}>
      <style>{`@keyframes prFade { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <MatchStatsModule config={{ ...config, view: vs[i % vs.length] }} />
    </div>
  );
}
