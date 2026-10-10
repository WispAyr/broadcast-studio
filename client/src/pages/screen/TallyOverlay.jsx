/**
 * TallyOverlay — ON AIR / MIC LIVE on a studio screen (server: routes/tally.js).
 *
 * Two pieces, deliberately on two different transports:
 *
 *   <TallyOverlay>      banner + TALLY LOST chip. Driven by `tally_state` pushes to
 *                       this screen's room (on change + every 5 s). Not a claim:
 *                       it never replaces content, so it does not compete in the
 *                       claim stack.
 *   <TallyTakeoverCard> the full-screen card. Arrives as overlay `claim_tally` from
 *                       the claim stack (layer 400), so priority against cutaway,
 *                       blackout and emergency is the resolver's job, not ours, and
 *                       it carries the claim's `duration` dead-man.
 *
 * What this component will NOT do:
 *   - show anything for unknown (null) state — unknown is not live;
 *   - keep asserting ON AIR from a state it has not had refreshed: after `validMs`
 *     without a push, or while the socket is down, a banner becomes TALLY LOST;
 *   - show anything under a blackout/emergency. The server says so on every push;
 *     between pushes, a `set_layout` from `claim:blackout|emergency` hides us at
 *     once (the next push is computed after that claim, so it agrees).
 */
import React, { useEffect, useState } from 'react';
import { getSocket } from '../../lib/socket';

// NAR brand v2 tokens.
const RADIO_RED = '#ED1B2F';
const EMBER = 'linear-gradient(135deg,#F15A22,#ED1B2F)';
const NAVY = '#151435';
const AMBER = '#FAA61A';
const DISPLAY = "'MuseoModerno','Montserrat','Inter',sans-serif";
const BODY = "'Darker Grotesque','Inter',sans-serif";

const KEYFRAMES = `
@keyframes tallyMicPulse { 0%,100% { opacity: 1; } 50% { opacity: .72; } }
@keyframes tallyDot { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.55); } 70% { box-shadow: 0 0 0 .9vh rgba(255,255,255,0); } }
@keyframes tallyIn { from { transform: translateY(-100%); } to { transform: translateY(0); } }
@keyframes tallyCardIn { from { opacity: 0; } to { opacity: 1; } }
`;

function Segment({ label, mic }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1.4vh',
      padding: '0 3.2vh', height: '100%',
      background: mic ? EMBER : RADIO_RED,
      animation: mic ? 'tallyMicPulse 1.6s ease-in-out infinite' : undefined,
    }}>
      <span style={{
        width: '1.9vh', height: '1.9vh', minWidth: 12, minHeight: 12, borderRadius: '50%',
        background: '#fff', animation: 'tallyDot 1.6s ease-out infinite',
      }} />
      <span style={{
        fontFamily: DISPLAY, fontWeight: 900, fontStyle: 'italic', color: '#fff',
        fontSize: 'clamp(26px, 5.6vh, 110px)', letterSpacing: '.06em', lineHeight: 1,
        textShadow: '0 2px 8px rgba(0,0,0,.25)', whiteSpace: 'nowrap',
      }}>{label}</span>
    </div>
  );
}

export function TallyBanner({ onAir, micLive, studioName }) {
  return (
    <div data-tally="banner" style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 'clamp(48px, 9vh, 160px)', display: 'flex', alignItems: 'stretch',
      background: NAVY, boxShadow: '0 6px 28px rgba(0,0,0,.45)',
      borderBottom: `0.5vh solid ${RADIO_RED}`, animation: 'tallyIn .35s ease-out',
    }}>
      {onAir && <Segment label="ON AIR" />}
      {micLive && <Segment label="MIC LIVE" mic />}
      <div style={{ flex: 1 }} />
      {studioName && (
        <div style={{
          display: 'flex', alignItems: 'center', padding: '0 3vh',
          fontFamily: BODY, fontWeight: 700, color: 'rgba(255,255,255,.85)',
          fontSize: 'clamp(16px, 3.2vh, 60px)', letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>{studioName}</div>
      )}
    </div>
  );
}

export function TallyLostChip() {
  return (
    <div data-tally="lost" style={{
      position: 'absolute', left: '2vh', bottom: '2vh',
      display: 'flex', alignItems: 'center', gap: '1vh',
      padding: '.8vh 1.8vh', borderRadius: 999,
      background: 'rgba(21,20,53,.88)', border: `2px solid ${AMBER}`,
      color: AMBER, fontFamily: "'Inter',sans-serif", fontWeight: 800,
      fontSize: 'clamp(12px, 1.9vh, 30px)', letterSpacing: '.12em',
    }}>
      <span style={{ width: '1.2vh', height: '1.2vh', minWidth: 8, minHeight: 8, borderRadius: '50%', background: AMBER }} />
      TALLY LOST
    </div>
  );
}

/** Full-screen card, rendered by OverlayRenderer for overlay type `claim_tally`. */
export function TallyTakeoverCard({ overlay }) {
  const onAir = !!overlay.onAir;
  const micLive = !!overlay.micLive;
  return (
    <div data-tally="takeover" style={{
      position: 'absolute', inset: 0, zIndex: 45,
      background: `radial-gradient(ellipse at 50% 45%, rgba(237,27,47,.28), transparent 62%), ${NAVY}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5vh',
      animation: 'tallyCardIn .3s ease-out',
    }}>
      <style>{KEYFRAMES}</style>
      {onAir && (
        <div style={{
          background: RADIO_RED, borderRadius: '3vh', padding: '3vh 7vh',
          boxShadow: '0 0 12vh rgba(237,27,47,.55)',
          fontFamily: DISPLAY, fontWeight: 900, fontStyle: 'italic', color: '#fff',
          fontSize: 'min(24vh, 17vw)', lineHeight: 1, letterSpacing: '.04em',
        }}>ON AIR</div>
      )}
      {micLive && (
        <div style={{
          background: EMBER, borderRadius: '2vh', padding: onAir ? '1.6vh 5vh' : '3vh 7vh',
          fontFamily: DISPLAY, fontWeight: 900, fontStyle: 'italic', color: '#fff',
          fontSize: onAir ? 'min(10vh, 8vw)' : 'min(22vh, 15vw)', lineHeight: 1, letterSpacing: '.05em',
          animation: 'tallyMicPulse 1.6s ease-in-out infinite',
        }}>MIC LIVE</div>
      )}
      {overlay.studioName && (
        <div style={{
          fontFamily: BODY, fontWeight: 700, color: 'rgba(255,255,255,.8)',
          fontSize: 'min(5vh, 4vw)', letterSpacing: '.18em', textTransform: 'uppercase',
        }}>{overlay.studioName}</div>
      )}
    </div>
  );
}

/**
 * Banner / TALLY LOST for one screen. Renders nothing unless the server says this
 * screen is in banner/takeover mode for an ARMED studio.
 */
export default function TallyOverlay({ screenId, connected, disabled }) {
  const [payload, setPayload] = useState(null);
  const [localSuppress, setLocalSuppress] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (disabled || !screenId) return undefined;
    let alive = true;
    const accept = (p) => {
      if (!alive || !p || typeof p !== 'object') return;
      setPayload({ ...p, _at: Date.now() });
      setLocalSuppress(false);
    };
    const load = () => fetch(`/api/tally/screen/${encodeURIComponent(screenId)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(accept).catch(() => {});

    const socket = getSocket();
    const onState = (p) => accept(p);
    const onLayout = (d) => {
      const src = d && typeof d.source === 'string' ? d.source : '';
      if (src === 'claim:blackout' || src === 'claim:emergency') setLocalSuppress(true);
    };
    socket.on('tally_state', onState);
    socket.on('set_layout', onLayout);
    socket.on('connect', load);
    load();
    const t = setInterval(() => setTick(n => n + 1), 1000);   // re-check staleness
    return () => {
      alive = false;
      socket.off('tally_state', onState);
      socket.off('set_layout', onLayout);
      socket.off('connect', load);
      clearInterval(t);
    };
  }, [screenId, disabled]);

  if (disabled || !payload || payload.mode === 'off' || !payload.mode) return null;
  if (payload.suppressed || localSuppress) return null;

  const age = Date.now() - payload._at;
  // A socket drop counts as stale after a short grace (not at first paint, when
  // the HTTP snapshot usually lands before the socket has connected).
  const stale = age > (payload.validMs || 15000) || (!connected && age > 3000);
  const lost = payload.lost || stale;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'none' }}>
      <style>{KEYFRAMES}</style>
      {lost ? <TallyLostChip />
        : payload.banner ? <TallyBanner onAir={payload.banner.onAir} micLive={payload.banner.micLive} studioName={payload.studioName} />
        : null}
    </div>
  );
}
