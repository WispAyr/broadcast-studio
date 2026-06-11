import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../../lib/socket';
import ModuleRenderer from '../../components/ModuleRenderer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ProjectionMapper } from '../../lib/webgl-projection';
import { getLayers, getChromaStyles } from '../../lib/layers';
import ChromaFilter from '../../components/ChromaFilter';
import PlayerProfileCard from '../../components/PlayerProfileCard';
import NowPlayingL3 from '../../components/NowPlayingL3';
import GoalGraphic, { GoalAudio } from '../../components/GoalGraphic';
import { duck, unduck, onDuck, rampVolume, autoPlay, installUnlockListener } from '../../lib/audioBus';

// A one-shot video/audio sting played over the screen. Ducks the bed on play,
// restores + removes itself when the media ends. `audioOutput` gates sound:
// on a muted video wall a video sting still shows its visual (muted), an
// audio-only sting is silent there. On the PA-feed screen it carries audio.
function StingOverlay({ overlay, audioOutput, onEnd }) {
  const ref = useRef(null);
  const audioOnly = overlay.audioOnly || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(overlay.url || '');
  const wantsAudio = audioOutput && !overlay.silent;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (wantsAudio) duck(overlay.duckTo ?? 0.12, overlay.duckMs ?? 180);
    const off = autoPlay(el);
    // Fallback removal in case `ended` never fires (e.g. element can't load).
    const ms = (overlay.maxDuration || 30) * 1000;
    const t = setTimeout(() => onEnd?.(), ms);
    return () => { off(); clearTimeout(t); if (wantsAudio) unduck(overlay.duckMs ?? 400); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = () => onEnd?.();
  const fit = overlay.fit || 'cover';
  const corner = overlay.position === 'corner';
  const wrap = corner
    ? { position: 'absolute', bottom: '4%', right: '3%', width: '22vw', height: 'auto' }
    : { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  if (audioOnly) {
    return <audio ref={ref} src={overlay.url} muted={!wantsAudio} onEnded={done} preload="auto" playsInline />;
  }
  return (
    <div style={wrap}>
      <video ref={ref} src={overlay.url} muted={!wantsAudio} onEnded={done} preload="auto" playsInline
        style={{ width: '100%', height: corner ? 'auto' : '100%', objectFit: fit, background: corner ? 'transparent' : '#000' }} />
    </div>
  );
}

// A persistent looping music bed driven from the soundboard (distinct from the
// layout-placed AudioModule). Audible only on the PA-feed screen; ducks under
// stings. Removed via remove_overlay / a new bed with no url.
function BedOverlay({ overlay, audioOutput }) {
  const ref = useRef(null);
  const baseVol = useRef(overlay.volume ?? 0.8);
  const duckGain = useRef(1);
  const apply = (ms) => rampVolume(ref.current, baseVol.current * duckGain.current, ms);

  useEffect(() => {
    const el = ref.current;
    if (!el || !audioOutput) return;
    el.volume = 0;
    const off = autoPlay(el);
    rampVolume(el, baseVol.current, 800);
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.url]);

  useEffect(() => { baseVol.current = overlay.volume ?? 0.8; apply(250); }, [overlay.volume]);
  useEffect(() => onDuck((gain, ms) => { duckGain.current = gain; apply(ms); }), []);

  if (!overlay.url) return null;
  return <audio ref={ref} src={overlay.url} loop muted={!audioOutput} preload="auto" playsInline />;
}

// ── SideLiner's branded overlays ──────────────────────────────────────────
// Transient sports-show graphics matching the SideLiner's logo lockup:
// skewed parallelogram panels, purple→navy, gold accent, italic Oswald.
// Pushed with `duration` (seconds) so they auto-dismiss.
const SL_NAVY = '#241a40', SL_PURPLE = '#7a2f9e', SL_PURPLE_HI = '#a44ad0', SL_GOLD = '#ffd24a';
const SL_HEAD = "'Oswald','Rajdhani',sans-serif";
function SidelinersOverlay({ overlay }) {
  const t = overlay.type;
  const skew = { display: 'inline-block', transform: 'skewX(-12deg)' };
  const unskew = { display: 'inline-block', transform: 'skewX(12deg)' };
  const inAnim = 'overlaySlideUp 0.5s cubic-bezier(.2,.8,.2,1)';

  // Animated logo / wordmark sting — full-frame, auto-dismiss via duration.
  if (t === 'sl_sting') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${SL_NAVY}, #171026)`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'overlayIn 0.35s ease-out' }}>
        <style>{`@keyframes slStingShine{0%{transform:translateX(-150%) skewX(-20deg);}100%{transform:translateX(350%) skewX(-20deg);}}@keyframes slStingPop{0%{opacity:0;transform:scale(0.6) skewX(-12deg);}60%{transform:scale(1.07) skewX(-12deg);}100%{opacity:1;transform:scale(1) skewX(-12deg);}}`}</style>
        {overlay.url
          ? <img src={overlay.url} alt="SideLiner's" style={{ height: '34vh', animation: 'slStingPop 0.7s cubic-bezier(.2,.9,.2,1) both' }} />
          : <div style={{ position: 'relative', fontFamily: SL_HEAD, fontStyle: 'italic', fontWeight: 700, fontSize: '17vh', color: '#fff', animation: 'slStingPop 0.7s cubic-bezier(.2,.9,.2,1) both', transform: 'skewX(-12deg)' }}>
              <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>Side<span style={{ color: SL_GOLD }}>Liner's</span></span>
              <span style={{ position: 'absolute', top: 0, left: 0, width: '12vw', height: '100%', background: 'rgba(255,255,255,0.4)', animation: 'slStingShine 0.9s ease-in 0.5s both' }} />
            </div>}
      </div>
    );
  }

  // Panel walk-on — full-frame "please welcome" moment for the FanZone stage.
  // Fire with { name, title, kicker?, duration } from a console button.
  if (t === 'sl_walkon') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${SL_NAVY} 0%, #171026 55%, #2b1052 100%)`, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: SL_HEAD, animation: 'overlayIn 0.3s ease-out' }}>
        <style>{`
          @keyframes slWalkKick{0%{opacity:0;transform:translateY(-4vh) skewX(-12deg);}100%{opacity:1;transform:translateY(0) skewX(-12deg);}}
          @keyframes slWalkName{0%{opacity:0;transform:translateX(-60vw) skewX(-12deg);}70%{transform:translateX(1.5vw) skewX(-12deg);}100%{opacity:1;transform:translateX(0) skewX(-12deg);}}
          @keyframes slWalkRole{0%{opacity:0;transform:translateY(3vh);}100%{opacity:1;transform:translateY(0);}}
          @keyframes slWalkShine{0%{transform:translateX(-150%) skewX(-20deg);}100%{transform:translateX(450%) skewX(-20deg);}}
          @keyframes slWalkRays{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}
        `}</style>
        <div style={{ position: 'absolute', inset: '-60%', background: `repeating-conic-gradient(rgba(164,74,208,0.12) 0deg 9deg, transparent 9deg 18deg)`, animation: 'slWalkRays 36s linear infinite' }} />
        <div style={{ ...skew, background: SL_GOLD, padding: '0.7vh 2.6vw', animation: 'slWalkKick 0.45s cubic-bezier(.2,.8,.2,1) 0.1s both' }}>
          <span style={{ ...unskew, color: SL_NAVY, fontWeight: 800, fontSize: '3.2vh', letterSpacing: '0.3em', textTransform: 'uppercase' }}>{overlay.kicker || 'Please welcome'}</span>
        </div>
        <div style={{ position: 'relative', background: `linear-gradient(120deg, ${SL_PURPLE}, ${SL_NAVY})`, padding: '2.4vh 5vw', marginTop: '2.4vh', boxShadow: '0 2vh 6vh rgba(0,0,0,0.55)', transform: 'skewX(-12deg)', animation: 'slWalkName 0.6s cubic-bezier(.2,.85,.25,1) 0.35s both', overflow: 'hidden' }}>
          <div style={{ display: 'inline-block', transform: 'skewX(12deg)', color: '#fff', fontWeight: 700, fontStyle: 'italic', fontSize: '11vh', lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{overlay.name || ''}</div>
          <span style={{ position: 'absolute', top: 0, left: 0, width: '10vw', height: '100%', background: 'rgba(255,255,255,0.35)', animation: 'slWalkShine 1s ease-in 1s both' }} />
        </div>
        {overlay.title && (
          <div style={{ marginTop: '2.2vh', color: SL_GOLD, fontWeight: 600, fontSize: '3.6vh', letterSpacing: '0.14em', textTransform: 'uppercase', animation: 'slWalkRole 0.5s ease-out 0.85s both' }}>{overlay.title}</div>
        )}
        <div style={{ position: 'absolute', bottom: '4vh', fontStyle: 'italic', fontWeight: 700, fontSize: '3.4vh', color: 'rgba(255,255,255,0.55)', transform: 'skewX(-12deg)' }}>
          <span style={{ display: 'inline-block', transform: 'skewX(12deg)' }}>Side<span style={{ color: SL_GOLD }}>Liner's</span> FanZone</span>
        </div>
      </div>
    );
  }

  // Lower third — presenter / guest / caller.
  if (t === 'sl_lower_third') {
    return (
      <div style={{ position: 'absolute', bottom: '9vh', left: '5vw', fontFamily: SL_HEAD, animation: inAnim }}>
        <div style={{ ...skew, background: SL_GOLD, padding: '0.4vh 1.4vw', marginLeft: '0.5vw' }}>
          <span style={{ ...unskew, color: SL_NAVY, fontWeight: 700, fontSize: '2vh', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{overlay.kicker || 'On air'}</span>
        </div>
        <div style={{ ...skew, background: `linear-gradient(120deg, ${SL_PURPLE}, ${SL_NAVY})`, padding: '1.4vh 2.6vw', marginTop: '0.6vh', boxShadow: '0 1vh 3vh rgba(0,0,0,0.45)' }}>
          <div style={unskew}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '4.4vh', lineHeight: 1 }}>{overlay.name || ''}</div>
            {overlay.title && <div style={{ color: SL_PURPLE_HI, fontWeight: 500, fontSize: '2.4vh', marginTop: '0.4vh', letterSpacing: '0.04em' }}>{overlay.title}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Breaking sports news — bottom strip.
  if (t === 'sl_breaking') {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'stretch', fontFamily: SL_HEAD, animation: 'overlaySlideUp 0.45s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ background: SL_GOLD, display: 'flex', alignItems: 'center', padding: '0 2.4vw' }}>
          <span style={{ color: SL_NAVY, fontWeight: 800, fontSize: '3.2vh', letterSpacing: '0.12em', animation: 'slBreakPulse 1.4s ease-in-out infinite' }}>BREAKING</span>
        </div>
        <div style={{ flex: 1, background: `linear-gradient(120deg, ${SL_PURPLE}, ${SL_NAVY})`, display: 'flex', alignItems: 'center', padding: '1.6vh 2.4vw' }}>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '3.4vh' }}>{overlay.text || ''}</span>
        </div>
        <style>{`@keyframes slBreakPulse{0%,100%{opacity:1;}50%{opacity:0.5;}}`}</style>
      </div>
    );
  }

  // "Your Shout" — listener text-in / caller comment.
  if (t === 'sl_text') {
    return (
      <div style={{ position: 'absolute', bottom: '8vh', left: '6vw', right: '6vw', fontFamily: SL_HEAD, animation: inAnim }}>
        <div style={{ ...skew, background: SL_PURPLE, padding: '0.4vh 1.4vw' }}>
          <span style={{ ...unskew, color: '#fff', fontWeight: 700, fontSize: '2vh', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{overlay.kicker || 'Your shout'}</span>
        </div>
        <div style={{ background: 'rgba(23,16,38,0.92)', borderLeft: `0.5vw solid ${SL_GOLD}`, padding: '1.8vh 2.6vw', marginTop: '0.6vh' }}>
          <div style={{ color: '#fff', fontSize: '3.4vh', fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2 }}>“{overlay.text || ''}”</div>
          {overlay.name && <div style={{ color: SL_PURPLE_HI, fontSize: '2.4vh', marginTop: '0.8vh' }}>— {overlay.name}</div>}
        </div>
      </div>
    );
  }

  // Compact corner score bug — persists until removed.
  if (t === 'sl_score') {
    return (
      <div style={{ position: 'absolute', top: '4vh', left: '4vw', fontFamily: SL_HEAD, animation: inAnim, display: 'flex', boxShadow: '0 1vh 3vh rgba(0,0,0,0.5)' }}>
        <div style={{ background: SL_NAVY, display: 'flex', alignItems: 'center', gap: '1.2vw', padding: '1vh 1.6vw' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '3vh' }}>{overlay.home || 'KIL'}</span>
          <span style={{ background: SL_GOLD, color: SL_NAVY, fontWeight: 800, fontSize: '3vh', padding: '0.3vh 1vw' }}>{overlay.score || '0-0'}</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '3vh' }}>{overlay.away || 'OPP'}</span>
        </div>
        {overlay.minute && <div style={{ background: SL_PURPLE, color: '#fff', display: 'flex', alignItems: 'center', padding: '0 1.2vw', fontWeight: 700, fontSize: '2.6vh' }}>{overlay.minute}</div>}
      </div>
    );
  }
  return null;
}

function OverlayRenderer({ overlay, audioOutput, onStingEnd }) {
  const baseStyle = { position: 'absolute', animation: 'overlayIn 0.5s ease-out' };

  if (typeof overlay.type === 'string' && overlay.type.startsWith('sl_')) {
    return <SidelinersOverlay overlay={overlay} />;
  }

  switch (overlay.type) {
    case 'sting':
      return <StingOverlay overlay={overlay} audioOutput={audioOutput} onEnd={() => onStingEnd?.(overlay)} />;
    case 'bed':
      return <BedOverlay overlay={overlay} audioOutput={audioOutput} />;
    case 'player_profile':
      return (
        <div style={{ position: 'absolute', inset: 0, animation: 'overlayIn 0.4s ease-out' }}>
          <PlayerProfileCard player={overlay.player} mode="profile" minute={overlay.minute} layout={overlay.layout || 'full'} />
        </div>
      );
    case 'goal': {
      // lower → subtle band over the match; full → big celebration graphic.
      // Either way the goal audio fires on the PA-feed screen.
      const lower = overlay.layout === 'lower';
      return (
        <div style={{ position: 'absolute', inset: 0, animation: 'overlayIn 0.4s ease-out' }}>
          {lower
            ? <PlayerProfileCard player={overlay.player} mode="goal" minute={overlay.minute} layout="lower" />
            : <GoalGraphic player={overlay.player} minute={overlay.minute} />}
          <GoalAudio sound={overlay.sound} audioOutput={audioOutput} />
        </div>
      );
    }
    case 'now_playing_l3':
      return <NowPlayingL3 stationId={overlay.stationId || 7719} />;
    case 'fact':
      return (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '4vh', display: 'flex', animation: 'overlayIn 0.45s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', minWidth: '60vw', maxWidth: '90vw', height: '14vh',
            fontFamily: "'MuseoModerno','Oswald',sans-serif", color: '#fff', borderLeft: '1vh solid #ffd24a',
            background: 'linear-gradient(90deg, #7a2f9e 0%, #241a40 100%)', boxShadow: '0 10px 40px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 2.5vw', background: 'rgba(0,0,0,0.2)' }}>
              <span style={{ fontWeight: 700, fontSize: '2.6vh', letterSpacing: '0.18em', color: '#ffd24a' }}>{overlay.label || 'DID YOU KNOW'}</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 3vw', fontSize: '3.4vh', fontWeight: 500, lineHeight: 1.2 }}>
              {overlay.text || ''}
            </div>
          </div>
        </div>
      );
    case 'lower_third':
      return (
        <div style={{ ...baseStyle, bottom: '10%', left: '5%', right: '30%' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(0,100,255,0.9), rgba(0,60,180,0.9))', padding: '16px 24px', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
            <div style={{ color: 'white', fontSize: '2.5vw', fontWeight: 'bold' }}>{overlay.name || ''}</div>
            {overlay.title && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.5vw', marginTop: '4px' }}>{overlay.title}</div>}
          </div>
        </div>
      );
    case 'logo_bug':
      return (
        <div style={{ ...baseStyle, top: '3%', right: '3%' }}>
          {overlay.url ? <img src={overlay.url} alt="Logo" style={{ height: '6vh', opacity: 0.8 }} /> : <div style={{ width: '6vh', height: '6vh', background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />}
        </div>
      );
    case 'countdown': {
      const target = overlay.targetTime ? new Date(overlay.targetTime).getTime() : 0;
      return <CountdownOverlay targetTime={target} />;
    }
    case 'ticker':
      return (
        <div style={{ ...baseStyle, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', padding: '8px 0', overflow: 'hidden' }}>
          <div style={{ color: 'white', fontSize: '2vw', whiteSpace: 'nowrap', animation: 'ticker 20s linear infinite' }}>
            {overlay.text || ''}
          </div>
          <style>{`@keyframes ticker { from { transform: translateX(100vw); } to { transform: translateX(-100%); } }`}</style>
        </div>
      );
    case 'coming_up':
      return (
        <div style={{ ...baseStyle, bottom: '15%', right: '5%', background: 'rgba(0,0,0,0.85)', padding: '16px 24px', borderRadius: '8px', borderLeft: '4px solid #facc15' }}>
          <div style={{ color: '#facc15', fontSize: '1.2vw', fontWeight: 'bold', textTransform: 'uppercase' }}>Coming Up Next</div>
          <div style={{ color: 'white', fontSize: '2vw', marginTop: '4px' }}>{overlay.text || ''}</div>
        </div>
      );
    case 'now_playing':
      return (
        <div style={{ ...baseStyle, bottom: '8%', left: '5%', background: 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(109,40,217,0.9))', padding: '12px 20px', borderRadius: '8px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1vw', textTransform: 'uppercase', letterSpacing: '2px' }}>Now Playing</div>
          <div style={{ color: 'white', fontSize: '2vw', fontWeight: 'bold' }}>{overlay.artist || ''}</div>
          {overlay.song && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.5vw' }}>{overlay.song}</div>}
        </div>
      );
    case 'announcement':
      return (
        <div style={{ ...baseStyle, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
          <div style={{ color: 'white', fontSize: '5vw', fontWeight: 'bold', textAlign: 'center', padding: '5%' }}>{overlay.text || ''}</div>
        </div>
      );
    case 'cg_text':
      return (
        <div style={{ ...baseStyle, bottom: '5%', left: '5%', right: '5%', textAlign: 'center' }}>
          <div style={{ color: 'white', fontSize: '3vw', fontWeight: 'bold', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{overlay.text || ''}</div>
        </div>
      );
    default:
      return null;
  }
}

// Layouts may store modules as a JSON string, a flat array, or a {layers:[{modules:[...]}]} object.
// Always return a flat module array.
function flattenLayoutModules(rawInput) {
  let raw = rawInput;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.layers)) return raw.layers.flatMap(l => Array.isArray(l?.modules) ? l.modules : []);
  if (Array.isArray(raw.modules)) return raw.modules;
  return [];
}

function CountdownOverlay({ targetTime }) {
  const [remaining, setRemaining] = React.useState('');
  React.useEffect(() => {
    const iv = setInterval(() => {
      const diff = targetTime - Date.now();
      if (diff <= 0) { setRemaining('00:00'); return; }
      const m = String(Math.floor(diff / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setRemaining(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [targetTime]);
  return (
    <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '16px 32px', borderRadius: '12px' }}>
      <div style={{ color: 'white', fontSize: '6vw', fontWeight: 'bold', fontFamily: 'monospace' }}>{remaining}</div>
    </div>
  );
}

export default function ScreenDisplay() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const setupMode = searchParams.get('setup') === 'true';
  // Whether this screen is a PA / audio-output feed. `?audio=1` forces it on
  // (handy for a laptop playout); otherwise read from the screen's config.
  const [audioOutput, setAudioOutput] = useState(searchParams.get('audio') === '1');
  // Mirror onto window so layout modules with their own sound (live_tv) can
  // gate audio the same way sting/bed overlays do, without prop plumbing.
  useEffect(() => { window.__bsAudioOutput = audioOutput; }, [audioOutput]);
  // Fit-to-screen: render the layout at its design resolution and scale it to
  // fill the display, so fixed-px module fonts/content scale up proportionally
  // on larger/higher-res screens instead of looking small. Opt-in per screen
  // (config.fitToScreen) or via ?fit=1; default off = no change to a screen.
  const [fitToScreen, setFitToScreen] = useState(searchParams.get('fit') === '1');
  const [fitScale, setFitScale] = useState(1);

  const [layout, setLayout] = useState(null);
  const [modules, setModules] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState('crossfade');
  const [prevModules, setPrevModules] = useState([]);
  const [prevLayout, setPrevLayout] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [overlays, setOverlays] = useState([]);
  const [identifyFlash, setIdentifyFlash] = useState(false);
  const [displayProfile, setDisplayProfile] = useState(null);
  const [transitionDurationMs, setTransitionDurationMs] = useState(600);
  const [disconnectBehavior, setDisconnectBehavior] = useState('message'); // 'message' | 'black' | 'freeze'
  const [screenDimensions, setScreenDimensions] = useState(null); // {width, height}

  // Allow audio to start after the first user gesture on browsers/kiosks that
  // block autoplay-with-sound. Locked-down kiosks should also launch Chromium
  // with --autoplay-policy=no-user-gesture-required (see docs).
  useEffect(() => { installUnlockListener(); }, []);

  // Compute the fit-to-screen scale factor (design resolution → viewport).
  useEffect(() => {
    if (!fitToScreen) { setFitScale(1); return; }
    const resW = layout?.resolution_w || 1920;
    const resH = layout?.resolution_h || 1080;
    const calc = () => setFitScale(Math.min(window.innerWidth / resW, window.innerHeight / resH));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [fitToScreen, layout]);

  const heartbeatRef = useRef(null);
  const socketRef = useRef(null);
  const gridRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const projectionRef = useRef(null);
  // Latest known variable values, indexed by variable_id. Survives layout swaps so
  // a snapshot that arrives before the layout finishes loading isn't lost.
  const variablesRef = useRef({});

  const injectModule = useCallback((m) => {
    if (!m || !m.config || !m.config.variable_id) return m;
    const v = variablesRef.current[m.config.variable_id];
    if (v === undefined) return m;
    const field = m.config.variable_field || 'count';
    return { ...m, config: { ...m.config, [field]: v } };
  }, []);

  const injectVariables = useCallback((mods) => {
    if (!Array.isArray(mods)) return mods;
    return mods.map(injectModule);
  }, [injectModule]);

  // Apply variable values into a full layout (preserves layered structure that
  // the render path reads from layout.modules). Returns a new layout object.
  const injectLayoutVariables = useCallback((lay) => {
    if (!lay || typeof lay !== 'object') return lay;
    const next = { ...lay };
    const data = typeof lay.modules === 'string' ? (() => { try { return JSON.parse(lay.modules); } catch { return null; } })() : lay.modules;
    if (data && Array.isArray(data.layers)) {
      const layers = data.layers.map((l) => ({
        ...l,
        modules: Array.isArray(l.modules) ? l.modules.map(injectModule) : l.modules,
      }));
      const flat = Array.isArray(data.modules) ? data.modules.map(injectModule) : layers.flatMap(l => l.modules || []);
      next.modules = { ...data, layers, modules: flat };
    } else if (Array.isArray(data)) {
      next.modules = data.map(injectModule);
    } else if (data && Array.isArray(data.modules)) {
      next.modules = { ...data, modules: data.modules.map(injectModule) };
    }
    return next;
  }, [injectModule]);

  // Load cached layout from localStorage immediately (before WS connects)
  // so screen is never blank on browser restart / power cycle
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`bs_layout_${id}`);
      if (cached) {
        const l = JSON.parse(cached);
        setLayout(injectLayoutVariables(l));
        setModules(injectVariables(flattenLayoutModules(l.modules)));
      }
    } catch { /* corrupted cache — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Click-to-fullscreen: first tap/click anywhere requests browser fullscreen
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, []);

  // Smooth layout transition with effects
  const applyLayout = useCallback((newLayout, transition, duration) => {
    if (!newLayout) return;
    const effect = transition || newLayout.transition || 'crossfade';
    const dur = duration ? duration * 1000 : 600;
    setTransitionDurationMs(dur);
    setTransitionType(effect);
    setPrevLayout(layout);
    setPrevModules(modules);
    setTransitioning(true);
    setTimeout(() => {
      setLayout(injectLayoutVariables(newLayout));
      setModules(injectVariables(flattenLayoutModules(newLayout.modules)));
      // Persist to localStorage so cold-start has something to show
      try {
        localStorage.setItem(`bs_layout_${id}`, JSON.stringify(newLayout));
      } catch { /* storage full or unavailable */ }
      setTimeout(() => {
        setTransitioning(false);
        setPrevLayout(null);
        setPrevModules([]);
      }, effect === 'cut' ? 0 : dur);
    }, effect === 'cut' ? 0 : 50);
  }, [layout, modules, id]);

  // Fetch screen data (public, no auth required)
  const fetchScreenData = useCallback(async () => {
    try {
      const res = await fetch(`/api/screens/${id}`);
      if (!res.ok) throw new Error('Failed to fetch screen');
      const data = await res.json();
      const screen = data.screen || data;

      if (screen.current_layout) {
        const l = screen.current_layout;
        setLayout(injectLayoutVariables(l));
        setModules(injectVariables(flattenLayoutModules(l.modules)));
      } else if (screen.current_layout_id) {
        try {
          const layoutRes = await fetch(`/api/layouts/${screen.current_layout_id}`);
          if (layoutRes.ok) {
            const layoutData = await layoutRes.json();
            const l = layoutData.layout || layoutData;
            setLayout(injectLayoutVariables(l));
            setModules(injectVariables(flattenLayoutModules(l.modules)));
          }
        } catch {
          // Layout fetch failed
        }
      }
      // Load display profile + disconnect behavior + dimensions
      if (screen.config) {
        const cfg = typeof screen.config === 'string' ? JSON.parse(screen.config || '{}') : screen.config;
        if (cfg.displayProfile) {
          const gp = screen.group_profile ? (typeof screen.group_profile === 'string' ? JSON.parse(screen.group_profile) : screen.group_profile) : {};
          setDisplayProfile({ ...gp, ...cfg.displayProfile });
        }
        if (cfg.disconnectBehavior) setDisconnectBehavior(cfg.disconnectBehavior);
        if (cfg.audioOutput) setAudioOutput(true);
        if (cfg.fitToScreen) setFitToScreen(true);
        if (cfg.screenType === 'led' || cfg.screenType === 'video_wall') setDisconnectBehavior(prev => prev === 'message' ? 'black' : prev);
      }
      // Store configured dimensions
      if (screen.width && screen.height) {
        setScreenDimensions({ width: screen.width, height: screen.height });
      }
      setError(null);
    } catch (err) {
      setError(err.message);
      // Try with auth token as fallback
      try {
        const token = localStorage.getItem('broadcast_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/screens/${id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const screen = data.screen || data;
          if (screen.current_layout) {
            setLayout(injectLayoutVariables(screen.current_layout));
            setModules(injectVariables(flattenLayoutModules(screen.current_layout.modules)));
            setError(null);
          }
        }
      } catch {
        // Both attempts failed
      }
    }
  }, [id]);

  useEffect(() => {
    fetchScreenData();
  }, [fetchScreenData]);

  // Keep stable refs for socket handlers
  const applyLayoutRef = useRef(applyLayout);
  applyLayoutRef.current = applyLayout;
  const fetchScreenDataRef = useRef(fetchScreenData);
  fetchScreenDataRef.current = fetchScreenData;

  // Socket connection with auto-reconnect
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnectCount(0);
      socket.emit('register_screen', { screenId: id });
      // Re-fetch layout + display profile on reconnect
      fetchScreenDataRef.current();
      // Re-fetch any counter modules so their values are fresh after a server
      // restart (counters are now persisted in DB, so this is authoritative)
      fetch(`/api/counter/all`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (Array.isArray(data)) {
            data.forEach(({ id: moduleId, count }) => {
              setModules(prev =>
                prev.map(m =>
                  m.id === moduleId ? { ...m, config: { ...m.config, count } } : m
                )
              );
            });
          }
        })
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setReconnectCount((prev) => prev + 1);
    });

    socket.on('set_layout', (data) => {
      if (data.layout) applyLayoutRef.current(data.layout);
    });

    socket.on('update_module', (data) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === data.moduleId ? { ...m, config: { ...m.config, ...data.config } } : m
        )
      );
    });

    socket.on('variable_update', (data) => {
      if (data && data.id) variablesRef.current[data.id] = data.value;
      setModules((prev) =>
        prev.map((m) => {
          if (!m.config || m.config.variable_id !== data.id) return m;
          const field = m.config.variable_field || 'count';
          return { ...m, config: { ...m.config, [field]: data.value } };
        })
      );
      setLayout((prev) => prev ? injectLayoutVariables(prev) : prev);
    });

    socket.on('variable_snapshot', (data) => {
      const vars = data && data.variables;
      if (!vars || typeof vars !== 'object') return;
      variablesRef.current = { ...variablesRef.current, ...vars };
      setModules((prev) =>
        prev.map((m) => {
          if (!m.config || !m.config.variable_id) return m;
          const v = vars[m.config.variable_id];
          if (v === undefined) return m;
          const field = m.config.variable_field || 'count';
          return { ...m, config: { ...m.config, [field]: v } };
        })
      );
      setLayout((prev) => prev ? injectLayoutVariables(prev) : prev);
    });

    socket.on('sync_all', (data) => {
      if (data.layout) applyLayoutRef.current(data.layout);
    });

    socket.on('emergency_layout', (data) => {
      if (data.layout) applyLayoutRef.current(data.layout);
    });

    // Transition-aware layout push
    socket.on('push_layout_transition', (data) => {
      if (data.layoutId) {
        // Fetch the layout data and apply with transition
        fetch(`/api/layouts/${data.layoutId}`)
          .then(r => r.ok ? r.json() : null)
          .then(layoutData => {
            if (layoutData) {
              const l = layoutData.layout || layoutData;
              applyLayoutRef.current(l, data.transition, data.duration);
            }
          })
          .catch(() => {});
      }
    });

    // Overlay system
    socket.on('push_overlay', (data) => {
      if (data.overlay) {
        setOverlays(prev => {
          // Replace existing overlay of same type, or add new
          const filtered = prev.filter(o => o.type !== data.overlay.type);
          return [...filtered, { ...data.overlay, _addedAt: Date.now() }];
        });
        // Auto-remove any overlay that carries a duration (announcements,
        // goalscorer/player-profile graphics, etc.) after `duration` seconds.
        if (data.overlay.duration) {
          const t = data.overlay.type;
          setTimeout(() => {
            setOverlays(prev => prev.filter(o => o.type !== t));
          }, data.overlay.duration * 1000);
        }
      }
    });

    socket.on('remove_overlay', (data) => {
      setOverlays(prev => prev.filter(o => o.type !== data.overlayType));
    });

    socket.on('clear_overlays', () => {
      setOverlays([]);
    });

    socket.on('identify_screen', () => {
      setIdentifyFlash(true);
      setTimeout(() => setIdentifyFlash(false), 2000);
    });

    socket.on('reload_screen', () => {
      window.location.reload();
    });

    socket.on('update_display_profile', (data) => {
      if (data.config?.displayProfile) {
        setDisplayProfile(prev => ({ ...(prev || {}), ...data.config.displayProfile }));
      }
      if (data.groupProfile) {
        setDisplayProfile(prev => ({ ...(data.groupProfile || {}), ...(prev || {}) }));
      }
    });

    socket.on('update_module_text', (data) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === data.moduleId
            ? { ...m, config: { ...m.config, text: data.text !== undefined ? data.text : m.config?.text, subtitle: data.subtitle !== undefined ? data.subtitle : m.config?.subtitle } }
            : m
        )
      );
    });

    // Heartbeat every 10 seconds (was 30s) — matches tighter server pingInterval
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('screen_heartbeat', { screenId: id });
      }
    }, 10000);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('set_layout');
      socket.off('update_module');
      socket.off('sync_all');
      socket.off('emergency_layout');
      socket.off('update_module_text');
      socket.off('push_layout_transition');
      socket.off('push_overlay');
      socket.off('remove_overlay');
      socket.off('clear_overlays');
      socket.off('identify_screen');
      socket.off('reload_screen');
      socket.off('update_display_profile');
      clearInterval(heartbeatRef.current);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Initialize WebGL projection mapping
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (!sourceCanvasRef.current) {
      sourceCanvasRef.current = document.createElement('canvas');
    }
    sourceCanvasRef.current.width = canvas.width;
    sourceCanvasRef.current.height = canvas.height;

    let mapper;
    try {
      mapper = new ProjectionMapper(canvas, id);
      projectionRef.current = mapper;

      const cal = mapper.getCalibration();
      const hasWarp = cal.corners.some((c, i) => {
        const defaults = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
        return Math.abs(c.x - defaults[i].x) > 0.001 || Math.abs(c.y - defaults[i].y) > 0.001;
      });
      const hasTransform = hasWarp ||
        Math.abs(cal.scale.x - 1) > 0.001 || Math.abs(cal.scale.y - 1) > 0.001 ||
        Math.abs(cal.position.x) > 0.001 || Math.abs(cal.position.y) > 0.001;

      setProjectionActive(hasTransform || setupMode);

      if (setupMode) {
        mapper.enableSetup();
      }
    } catch {
      setProjectionActive(false);
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (sourceCanvasRef.current) {
        sourceCanvasRef.current.width = canvas.width;
        sourceCanvasRef.current.height = canvas.height;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapper) mapper.destroy();
      projectionRef.current = null;
    };
  }, [id, setupMode]);

  // Capture DOM content to source canvas and render via WebGL
  useEffect(() => {
    if (!projectionActive || !projectionRef.current || !gridRef.current) return;

    const mapper = projectionRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    let running = true;
    let frameId = null;

    const captureAndRender = () => {
      if (!running) return;

      const grid = gridRef.current;
      if (grid && sourceCanvas) {
        const ctx = sourceCanvas.getContext('2d');
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const clone = grid.cloneNode(true);
        clone.style.width = width + 'px';
        clone.style.height = height + 'px';
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '0';

        const data = new XMLSerializer().serializeToString(clone);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${data}</div>
          </foreignObject>
        </svg>`;

        const img = new Image();
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          mapper.setSourceTexture(sourceCanvas);
          mapper.render();
          if (running) frameId = requestAnimationFrame(captureAndRender);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          const bg = getComputedStyle(grid).backgroundColor || '#000';
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, width, height);
          mapper.setSourceTexture(sourceCanvas);
          mapper.render();
          if (running) frameId = requestAnimationFrame(captureAndRender);
        };

        img.src = url;
      } else {
        frameId = requestAnimationFrame(captureAndRender);
      }
    };

    frameId = requestAnimationFrame(captureAndRender);

    return () => {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [projectionActive, layout, modules]);

  const gridRows = layout?.grid_rows || 3;
  const gridColumns = layout?.grid_cols || layout?.grid_columns || 4;
  const background = layout?.background || '#000000';
  const fitResW = layout?.resolution_w || 1920;
  const fitResH = layout?.resolution_h || 1080;

  return (
    <div className="screen-display" style={{ background, position: fitToScreen ? 'fixed' : 'relative', cursor: 'none',
      ...(screenDimensions ? { width: screenDimensions.width, height: screenDimensions.height, overflow: 'hidden' } : {}),
      ...(displayProfile ? {
        filter: [
          displayProfile.brightness !== undefined && displayProfile.brightness !== 100 ? `brightness(${displayProfile.brightness}%)` : '',
          displayProfile.contrast !== undefined && displayProfile.contrast !== 100 ? `contrast(${displayProfile.contrast}%)` : '',
          displayProfile.saturation !== undefined && displayProfile.saturation !== 100 ? `saturate(${displayProfile.saturation}%)` : '',
          displayProfile.colorTemp === 'warm' ? 'sepia(15%)' : displayProfile.colorTemp === 'cool' ? 'hue-rotate(10deg)' : '',
        ].filter(Boolean).join(' ') || undefined,
        transform: [
          displayProfile.rotation ? `rotate(${displayProfile.rotation}deg)` : '',
          displayProfile.flipH ? 'scaleX(-1)' : '',
          displayProfile.flipV ? 'scaleY(-1)' : '',
          displayProfile.contentScale && displayProfile.contentScale !== 100 ? `scale(${displayProfile.contentScale / 100})` : '',
          displayProfile.offsetX || displayProfile.offsetY ? `translate(${displayProfile.offsetX || 0}px, ${displayProfile.offsetY || 0}px)` : '',
        ].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
      } : {}),
      // Fit-to-screen override: pin a design-resolution box centred in the
      // viewport and scale it to fit. Wins over displayProfile transform.
      ...(fitToScreen ? {
        left: '50%', top: '50%', width: fitResW, height: fitResH, overflow: 'hidden',
        transform: `translate(-50%, -50%) scale(${fitScale})${displayProfile?.rotation ? ` rotate(${displayProfile.rotation}deg)` : ''}`,
        transformOrigin: 'center center',
      } : {}),
    }}>
      <style>{`
        @keyframes slideInLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes slideInRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes dissolveIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        @keyframes dissolveOut { from { opacity: 1; filter: blur(0); } to { opacity: 0; filter: blur(10px); } }
        @keyframes wipeIn { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        @keyframes overlayIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes overlaySlideUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Previous layout (transitioning out) */}
      {transitioning && prevLayout && prevModules.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateRows: `repeat(${prevLayout.grid_rows || 3}, 1fr)`,
          gridTemplateColumns: `repeat(${prevLayout.grid_cols || prevLayout.grid_columns || 4}, 1fr)`,
          width: fitToScreen ? '100%' : '100vw', height: fitToScreen ? '100%' : '100vh',
          background: prevLayout.background || '#000',
          gap: '2px',
          position: 'absolute', top: 0, left: 0, zIndex: 2,
          animation: transitionType === 'slide-left' ? 'slideOutLeft 0.6s ease-in-out forwards'
            : transitionType === 'slide-right' ? 'slideOutRight 0.6s ease-in-out forwards'
            : transitionType === 'zoom-in' ? undefined
            : transitionType === 'dissolve' ? 'dissolveOut 0.6s ease-in-out forwards'
            : undefined,
          opacity: transitionType === 'crossfade' || transitionType === 'zoom-in' ? 0 : undefined,
          transition: transitionType === 'crossfade' ? 'opacity 0.6s ease-in-out' : undefined,
        }}>
          {prevModules.map((mod, i) => (
            <div key={mod.id || `prev-${i}`} style={{
              gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
              gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
              overflow: 'hidden'
            }}>
              <ErrorBoundary silent name={mod.type || 'module'}>
              <ModuleRenderer socket={socketRef.current} type={mod.type || mod.module || mod.module_type} config={mod.config || {}} />
            </ErrorBoundary>

            </div>
          ))}
        </div>
      )}

      {/* Composition Layers */}
      <div
        ref={gridRef}
        style={{
          position: 'relative',
          width: fitToScreen ? '100%' : '100vw',
          height: fitToScreen ? '100%' : '100vh',
          opacity: projectionActive ? 0 : undefined,
          pointerEvents: projectionActive ? 'none' : 'auto',
          animation: transitioning ? (
            transitionType === 'slide-left' ? 'slideInLeft 0.6s ease-in-out'
            : transitionType === 'slide-right' ? 'slideInRight 0.6s ease-in-out'
            : transitionType === 'zoom-in' ? 'zoomIn 0.6s ease-in-out'
            : transitionType === 'dissolve' ? 'dissolveIn 0.6s ease-in-out'
            : undefined
          ) : undefined,
          transition: transitioning && transitionType === 'crossfade' ? 'opacity 0.6s ease-in-out' : undefined,
        }}
      >
        {getLayers(layout?.modules ?? modules).sort((a, b) => a.order - b.order).map((layer) => {
          if (!layer.visible) return null;
          const fullscreenMods = (layer.modules || []).filter(m => m.fullscreen);
          const gridMods = (layer.modules || []).filter(m => !m.fullscreen);
          const chromaStyles = getChromaStyles(layer);
          return (
            <React.Fragment key={layer.id}>
              <ChromaFilter layer={layer} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: layer.opacity ?? 1,
                mixBlendMode: chromaStyles.mixBlendMode || layer.blendMode || 'normal',
                filter: chromaStyles.filter || undefined,
                zIndex: layer.order,
                pointerEvents: 'none',
              }}
            >
              {/* Fullscreen modules in this layer */}
              {fullscreenMods.map((mod, i) => (
                <div
                  key={mod.id || `fs-${i}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    zIndex: mod.layer || 0,
                  }}
                >
                  <ErrorBoundary silent name={mod.type || 'module'}>
                  <ModuleRenderer socket={socketRef.current} type={mod.type || mod.module || mod.module_type} config={mod.config || {}} moduleId={mod.id} />
                  </ErrorBoundary>

                </div>
              ))}
              {/* Grid modules in this layer */}
              {gridMods.length > 0 && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: '2px',
                }}>
                  {gridMods.map((mod, i) => (
                    <div
                      key={mod.id || `mod-${i}`}
                      style={{
                        gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
                        gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`,
                        overflow: 'hidden',
                      }}
                    >
                    <ErrorBoundary silent name={mod.type || 'module'}>
                      <ModuleRenderer socket={socketRef.current} type={mod.type || mod.module || mod.module_type} config={mod.config || {}} moduleId={mod.id} />
                    </ErrorBoundary>

                    </div>
                  ))}
                </div>
              )}
            </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* WebGL Projection Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: projectionActive ? 10 : -1,
          opacity: projectionActive ? 1 : 0,
          pointerEvents: setupMode ? 'auto' : 'none',
        }}
      />

      {/* Overlay Layer */}
      {overlays.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }}>
          {overlays.map(ov => (
            <OverlayRenderer key={ov.type} overlay={ov} audioOutput={audioOutput}
              onStingEnd={() => setOverlays(prev => prev.filter(o => o.type !== 'sting'))} />
          ))}
        </div>
      )}

      {/* Identify Flash */}
      {identifyFlash && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'white', animation: 'identifyPulse 2s ease-out forwards', pointerEvents: 'none' }}>
          <style>{`@keyframes identifyPulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 0; } }`}</style>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
            <p style={{ fontSize: '4rem', fontWeight: 900, color: '#000' }}>SCREEN {id?.slice(0,8)}</p>
          </div>
        </div>
      )}

      {/* No layout message */}
      {!layout && !error && connected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black" style={{ zIndex: 20 }}>
          <div className="text-center">
            <p className="text-gray-500 text-lg">Waiting for layout...</p>
            <p className="text-gray-700 text-sm mt-2">Screen ID: {id}</p>
          </div>
        </div>
      )}

      {/* Disconnection handling — behavior-dependent */}
      {!connected && disconnectBehavior === 'black' && (
        <div className="fixed inset-0 bg-black z-50">
          {/* Subtle reconnect indicator — tiny dot in corner */}
          <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse opacity-30" />
        </div>
      )}
      {!connected && disconnectBehavior === 'freeze' && (
        /* freeze = keep last frame visible, just show subtle indicator */
        <div className="fixed bottom-2 right-2 z-50 w-2 h-2 rounded-full bg-amber-500 animate-pulse opacity-40" />
      )}
      {!connected && disconnectBehavior === 'message' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <p className="text-red-500 text-3xl font-bold mb-2">DISCONNECTED</p>
            <p className="text-gray-400 mb-1">Attempting to reconnect...</p>
            {reconnectCount > 0 && (
              <p className="text-gray-600 text-sm">Retry attempt {reconnectCount}</p>
            )}
            <div className="mt-4 flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
