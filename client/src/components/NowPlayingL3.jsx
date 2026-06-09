import React, { useEffect, useState } from 'react';

// Now-playing lower-third — self-fetching band for the radio track on air.
// Polls /api/nowplaying/<stationId> (broadcast.radio, NAR default 7719) and
// shows artwork + title/artist, or the on-air show when it's speech. Stays up
// (auto-updates) until cleared. Used by the `now_playing_l3` overlay.

const PURPLE = '#7a2f9e', PURPLE_HI = '#a44ad0', NAVY = '#241a40';
const HEAD = "'MuseoModerno','Oswald',sans-serif";

export default function NowPlayingL3({ stationId = 7719, refreshMs = 15000 }) {
  const [np, setNp] = useState(null);
  const [artOk, setArtOk] = useState(true);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try { const r = await fetch(`/api/nowplaying/${stationId}`); if (r.ok && !stop) { setNp(await r.json()); setArtOk(true); } } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, refreshMs);
    return () => { stop = true; clearInterval(t); };
  }, [stationId, refreshMs]);

  const isIdent = np && (np.offAir || (!np.isMusic && !np.title));
  const line1 = isIdent ? (np?.onAir?.title || 'Now Ayrshire Radio') : (np?.title || '—');
  const line2 = isIdent ? (np?.onAir?.presenter || 'Live') : (np?.artist || '');
  const label = isIdent ? 'ON AIR' : 'NOW PLAYING';

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '4vh', display: 'flex', pointerEvents: 'none' }}>
      <style>{`@keyframes npin { from { opacity:0; transform: translateX(-60px);} to {opacity:1; transform:none;} } @keyframes npspin { to { transform: rotate(360deg);} }`}</style>
      <div style={{ display: 'flex', alignItems: 'stretch', height: '14vh', minWidth: '52vw', maxWidth: '82vw',
        animation: 'npin 0.45s cubic-bezier(.2,.8,.2,1) both', fontFamily: HEAD, color: '#fff',
        background: `linear-gradient(90deg, ${PURPLE} 0%, ${NAVY} 100%)`, borderLeft: '1vh solid #ffffff',
        boxShadow: '0 10px 40px rgba(0,0,0,.5)', overflow: 'hidden' }}>
        {/* artwork / vinyl */}
        <div style={{ width: '14vh', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1330', position: 'relative' }}>
          {np?.artwork && artOk
            ? <img src={np.artwork} alt="" onError={() => setArtOk(false)} style={{ width: '10vh', height: '10vh', borderRadius: '50%', objectFit: 'cover', animation: 'npspin 8s linear infinite', boxShadow: '0 0 0 0.6vh #0a0a14' }} />
            : <div style={{ width: '10vh', height: '10vh', borderRadius: '50%', background: `radial-gradient(circle, ${PURPLE_HI} 0 18%, #0a0a14 19% 100%)`, animation: 'npspin 8s linear infinite' }} />}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 3vw', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw', marginBottom: '0.4vh' }}>
            <span style={{ width: '1.4vh', height: '1.4vh', borderRadius: '50%', background: '#ff3b3b', boxShadow: '0 0 10px #ff3b3b' }} />
            <span style={{ fontSize: '2.2vh', letterSpacing: '0.22em', color: PURPLE_HI, fontWeight: 600 }}>{label} · NOW AYRSHIRE RADIO</span>
          </div>
          <div style={{ fontSize: '5.2vh', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 3px 14px rgba(0,0,0,.5)' }}>{line1}</div>
          {line2 ? <div style={{ fontSize: '3vh', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line2}</div> : null}
        </div>
      </div>
    </div>
  );
}
