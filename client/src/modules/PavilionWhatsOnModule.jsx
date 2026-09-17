import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  subscribePavilionWhatsOn, curateEvents, whenLabel, dateLine, shortDate, timeLabel,
} from '../lib/pavilionWhatsOnCache';

/**
 * Ayr Pavilion — What's On.
 * Full-bleed rotating hero cards for the venue's upcoming programme: blurred
 * poster backdrop, contained poster, when/type chips, headline, date · time ·
 * venue, lineup pills, ticket QR, and a "coming up" rail so one glance shows
 * the whole programme. Auto-detects portrait/landscape from its own box.
 *
 * config:
 *   mode           'upcoming' (chronological, default) | 'featured' (featured first)
 *   holdSeconds    seconds per card (default 13)
 *   brand          headline wordmark (default 'AYR PAVILION')
 *   brandSub       small line under wordmark (default 'Ayr Beach · The Piv')
 *   website        footer site (default 'ayrpavilion.com')
 *   comingUp       how many "also coming up" rows to show (default 4, 0 = off)
 *   accent         primary accent (default cyan #19e3ff)
 *   accent2        secondary accent (default pink #ff3d9a)
 */
const FONT_ID = 'pavilion-whatson-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500;600;700;800&display=swap';
const DISPLAY = "'Anton', Impact, 'Arial Narrow Bold', system-ui, sans-serif";
const BODY = "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const BG = '#070b18';
const INK = '#f3f6ff';
const MUTED = '#9fb0d4';
const GOLD = '#ffd24a';
const LINE = 'rgba(255,255,255,0.10)';
const FADE_MS = 1100;

function useFonts() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(FONT_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_ID; link.rel = 'stylesheet'; link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

function useBox() {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 1080, h: 1920 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export default function PavilionWhatsOnModule({ config = {} }) {
  useFonts();
  const [ref, box] = useBox();
  const now = useClock();
  const [state, setState] = useState({ events: null, stale: false, error: null });
  useEffect(() => subscribePavilionWhatsOn(setState), []);

  const mode = config.mode === 'featured' ? 'featured' : 'upcoming';
  const hold = Math.max(5, Number(config.holdSeconds) || 13) * 1000;
  const accent = config.accent || '#19e3ff';
  const accent2 = config.accent2 || '#ff3d9a';
  const brand = config.brand || 'AYR PAVILION';
  const brandSub = config.brandSub || 'Ayr Beach · The Piv';
  const website = config.website || 'ayrpavilion.com';
  const comingUpN = config.comingUp == null ? 4 : Math.max(0, Number(config.comingUp) || 0);

  // Recompute the curated list once per day-rollover / data refresh, not every clock tick.
  const dayKey = now.toDateString();
  const events = useMemo(
    () => curateEvents(state.events || [], { mode, now: new Date(dayKey) }),
    [state.events, mode, dayKey],
  );
  const chrono = useMemo(
    () => curateEvents(state.events || [], { mode: 'upcoming', now: new Date(dayKey) }),
    [state.events, dayKey],
  );

  // ── rotation ─────────────────────────────────────────────────────────────
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(null); // outgoing card index during crossfade
  const idxRef = useRef(0);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => {
    if (idx >= events.length) { setIdx(0); idxRef.current = 0; }
  }, [events.length, idx]);
  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => {
      const cur = idxRef.current;
      setPrev(cur);
      setIdx((cur + 1) % events.length);
      setTimeout(() => setPrev(p => (p === cur ? null : p)), FADE_MS + 100);
    }, hold);
    return () => clearInterval(t);
  }, [events.length, hold]);

  const isPortrait = box.h > box.w * 1.1;
  const vw = box.w / 100;
  const vh = box.h / 100;
  // one "unit" that scales sensibly in either orientation
  const u = isPortrait ? vw : vh * 0.62;

  const theme = { accent, accent2, brand, brandSub, website, mode, isPortrait, vw, vh, u, now, comingUpN };
  const current = events[idx];

  return (
    <div ref={ref} style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: BG, color: INK, fontFamily: BODY,
    }}>
      <style>{`
        @keyframes pwo-drift { from { transform: scale(1.12) translate(0,0); } to { transform: scale(1.22) translate(0,-2.2%); } }
        @keyframes pwo-spin { to { transform: rotate(360deg); } }
        @keyframes pwo-pulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
      `}</style>

      {!events.length ? (
        <EmptyState theme={theme} error={state.error} hasData={Array.isArray(state.events)} />
      ) : (
        <>
          {prev != null && prev !== idx && events[prev] && (
            <Card key={`prev-${prev}-${events[prev].id}`} ev={events[prev]} theme={theme} chrono={chrono} visible={false} />
          )}
          {current && (
            <Card key={`cur-${idx}-${current.id}`} ev={current} theme={theme} chrono={chrono} visible />
          )}
          <Footer theme={theme} count={events.length} idx={idx} />
        </>
      )}
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
function Card({ ev, theme, chrono, visible }) {
  const { isPortrait, vw, vh, u } = theme;
  // Incoming card fades in OVER the outgoing one (which stays at full opacity
  // underneath until it unmounts) so the crossfade never dips to black.
  const [shown, setShown] = useState(!visible);
  const [imgOk, setImgOk] = useState(!!ev.poster_image);
  useEffect(() => {
    if (!visible) return undefined;
    // setTimeout, NOT requestAnimationFrame — rAF is throttled on hidden tabs
    // and kiosk previews, which left the old page blank.
    const t = setTimeout(() => setShown(true), 40);
    return () => clearTimeout(t);
  }, [visible]);

  const when = whenLabel(ev.event_date, theme.now);
  const times = (ev.times && ev.times.length ? ev.times : [ev.event_time]).filter(Boolean).map(timeLabel);
  const acts = (ev.lineup || []).filter(a => a.toLowerCase() !== String(ev.title || '').toLowerCase());
  const shownActs = acts.slice(0, isPortrait ? 6 : 8);
  const extra = acts.length - shownActs.length;
  const tickets = ev.ticket_url || ev.external_url || '';
  const poster = ev.poster_image;

  const pad = isPortrait ? 5 * vw : 3.2 * vw;

  return (
    <div style={{
      position: 'absolute', inset: 0, opacity: shown ? 1 : 0,
      transition: visible ? `opacity ${FADE_MS}ms ease` : 'none', willChange: 'opacity',
    }}>
      {/* blurred poster backdrop */}
      <div style={{
        position: 'absolute', inset: '-6%',
        backgroundImage: poster && imgOk ? `url("${poster}")` : `linear-gradient(150deg, #10204a, #2a0f3d)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(34px) brightness(.42) saturate(1.25)',
        animation: 'pwo-drift 18s ease-in-out infinite alternate',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 70% at 50% 12%, rgba(7,11,24,0) 0%, rgba(7,11,24,.35) 55%, rgba(7,11,24,.92) 100%)',
      }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <Header theme={theme} pad={pad} />

        {isPortrait ? (
          <>
            <PosterBlock ev={ev} poster={poster} imgOk={imgOk} setImgOk={setImgOk} theme={theme}
              style={{ flex: 1, padding: `${2 * vh}px ${4 * vw}px ${1.4 * vh}px`, minHeight: 0 }} />
            <InfoPanel ev={ev} when={when} times={times} shownActs={shownActs} extra={extra} tickets={tickets} theme={theme} chrono={chrono}
              style={{ padding: `${3.4 * vh}px ${pad}px ${9.5 * vh}px` }} />
          </>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', alignItems: 'stretch', padding: `${1.5 * vh}px ${pad}px ${8 * vh}px`, gap: 3 * vw }}>
            <PosterBlock ev={ev} poster={poster} imgOk={imgOk} setImgOk={setImgOk} theme={theme}
              style={{ flex: '0 0 38%', minHeight: 0, alignItems: 'center' }} />
            <InfoPanel ev={ev} when={when} times={times} shownActs={shownActs} extra={extra} tickets={tickets} theme={theme} chrono={chrono}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'none' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ theme, pad }) {
  const { accent, accent2, brand, brandSub, mode, isPortrait, vw, vh, u } = theme;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 * vw,
      padding: `${(isPortrait ? 4.4 : 3) * vh}px ${pad}px 0`, zIndex: 5, position: 'relative',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.92 }}>
        <span style={{
          fontFamily: DISPLAY, fontSize: 6.2 * u, letterSpacing: '0.04em',
          background: `linear-gradient(92deg, ${accent}, ${accent2})`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
        }}>{brand}</span>
        <span style={{ fontSize: 1.9 * u, fontWeight: 700, letterSpacing: '0.42em', color: MUTED, marginTop: 0.7 * vh, textTransform: 'uppercase' }}>{brandSub}</span>
      </div>
      <div style={{
        fontSize: 1.85 * u, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
        padding: `${1.3 * vh}px ${2.4 * u}px`, border: `1px solid ${LINE}`, borderRadius: 999,
        background: 'rgba(255,255,255,.05)', color: accent, whiteSpace: 'nowrap',
      }}>{mode === 'featured' ? '★ Featured' : "What's On"}</div>
    </div>
  );
}

function PosterBlock({ ev, poster, imgOk, setImgOk, theme, style }) {
  const { accent, accent2, u, vh, isPortrait } = theme;
  const showImg = poster && imgOk;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', ...style }}>
      {showImg ? (
        <img src={poster} alt="" onError={() => setImgOk(false)} style={{
          maxWidth: '100%', maxHeight: '100%', borderRadius: 2.4 * u, objectFit: 'contain',
          boxShadow: `0 ${2.4 * vh}px ${6 * vh}px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.07)`,
          background: '#0a1126', display: 'block',
        }} />
      ) : (
        <div style={{
          width: isPortrait ? '78%' : '100%', aspectRatio: '3 / 4', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(150deg, #10204a, #2a0f3d)', borderRadius: 2.4 * u, textAlign: 'center', padding: '6%',
          boxShadow: `0 ${2.4 * vh}px ${6 * vh}px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.07)`,
        }}>
          <div style={{
            fontFamily: DISPLAY, fontSize: 7 * u, lineHeight: 1,
            background: `linear-gradient(92deg, ${accent}, ${accent2})`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
          }}>{ev.title || 'Live at the Piv'}</div>
        </div>
      )}
    </div>
  );
}

function Chip({ children, kind, theme }) {
  const { accent, u, vh } = theme;
  const styles = {
    when: { background: `linear-gradient(92deg, ${accent}, #5ad0ff)`, color: '#04121a' },
    type: { background: 'rgba(255,255,255,.08)', color: INK, border: `1px solid ${LINE}` },
    feat: { background: `linear-gradient(92deg, ${GOLD}, #ffb13d)`, color: '#1c1400' },
    sess: { background: 'rgba(255,255,255,.08)', color: accent, border: `1px solid ${LINE}` },
  }[kind] || {};
  return (
    <span style={{
      fontSize: 1.8 * u, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: `${1 * vh}px ${2 * u}px`, borderRadius: 999, whiteSpace: 'nowrap', ...styles,
    }}>{children}</span>
  );
}

function InfoPanel({ ev, when, times, shownActs, extra, tickets, theme, chrono, style }) {
  const { accent, accent2, u, vh, vw, isPortrait, comingUpN } = theme;
  const dot = <span style={{ width: 0.8 * u, height: 0.8 * u, borderRadius: '50%', background: accent2, flex: '0 0 auto' }} />;

  const upNext = comingUpN > 0
    ? chrono.filter(e => e.id !== ev.id).filter(e => (e.event_date + e.title) !== (ev.event_date + ev.title)).slice(0, comingUpN)
    : [];

  return (
    <div style={{
      position: 'relative', zIndex: 5,
      background: isPortrait ? 'linear-gradient(0deg, rgba(7,11,24,.98), rgba(7,11,24,.82) 60%, rgba(7,11,24,0))' : 'none',
      ...style,
    }}>
      <div style={{ display: 'flex', gap: 1.4 * u, flexWrap: 'wrap', alignItems: 'center', marginBottom: 1.8 * vh }}>
        {when && <Chip kind="when" theme={theme}>{when}</Chip>}
        {ev.featured && <Chip kind="feat" theme={theme}>★ Featured</Chip>}
        {ev.sessions > 1 && <Chip kind="sess" theme={theme}>{ev.sessions} sessions</Chip>}
        {ev.event_type && <Chip kind="type" theme={theme}>{ev.event_type}</Chip>}
      </div>

      <div style={{
        fontFamily: DISPLAY, fontSize: (isPortrait ? 6.6 : 6.4) * u, lineHeight: 0.98, letterSpacing: '0.005em',
        textShadow: `0 ${0.6 * vh}px ${3 * vh}px rgba(0,0,0,.55)`, overflowWrap: 'anywhere',
      }}>{ev.title}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2.4 * u, marginTop: 2 * vh, fontSize: 2.5 * u, fontWeight: 700, color: '#e7eeff', flexWrap: 'wrap' }}>
        <span>{dateLine(ev.event_date)}</span>
        {times.length > 0 && <>{dot}<span>{times.join(' · ')}</span></>}
        {dot}<span style={{ color: MUTED, fontWeight: 600 }}>{ev.venue || 'Ayr Pavilion'}</span>
      </div>

      {shownActs.length > 0 && (
        <div style={{ marginTop: 2.4 * vh, display: 'flex', flexWrap: 'wrap', gap: `${1.2 * u}px ${1.6 * u}px`, maxHeight: 13 * vh, overflow: 'hidden' }}>
          {shownActs.map((a, i) => (
            <span key={i} style={{
              fontSize: 1.95 * u, fontWeight: 600, color: '#d7e1ff', padding: `${0.9 * vh}px ${1.8 * u}px`, borderRadius: 0.9 * u,
              background: 'rgba(255,255,255,.055)', border: `1px solid ${LINE}`,
            }}>{a}</span>
          ))}
          {extra > 0 && <span style={{ fontSize: 1.95 * u, fontWeight: 600, color: accent, padding: `${0.9 * vh}px ${1.8 * u}px` }}>+{extra} more</span>}
        </div>
      )}

      <div style={{ marginTop: 3 * vh, display: 'flex', alignItems: 'center', gap: 2.6 * u }}>
        {tickets ? (
          <>
            <div style={{
              width: 15 * u, height: 15 * u, background: '#fff', borderRadius: 1.6 * u, padding: 1 * u, flex: '0 0 auto',
              boxShadow: `0 ${1.6 * vh}px ${4 * vh}px rgba(0,0,0,.5)`,
            }}>
              <QRCodeSVG value={tickets} size={256} level="M" bgColor="#ffffff" fgColor={BG} includeMargin={false}
                style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
            <div>
              <div style={{ fontSize: 2.4 * u, fontWeight: 800, color: '#fff' }}>Scan for tickets</div>
              <div style={{ fontSize: 1.9 * u, fontWeight: 600, color: MUTED, marginTop: 0.6 * vh }}>Or book at {theme.website}</div>
              {ev.external_provider && (
                <span style={{ display: 'inline-block', marginTop: 1.2 * vh, fontSize: 1.7 * u, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent }}>
                  via {ev.external_provider}
                </span>
              )}
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 2.4 * u, fontWeight: 800, color: '#fff' }}>Tickets &amp; info</div>
            <div style={{ fontSize: 1.9 * u, fontWeight: 600, color: MUTED, marginTop: 0.6 * vh }}>{theme.website} · tickets.ayrpavilion.com</div>
          </div>
        )}
      </div>

      {upNext.length > 0 && (
        <div style={{ marginTop: 3.2 * vh, paddingTop: 2 * vh, borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 1.6 * u, fontWeight: 800, letterSpacing: '0.32em', textTransform: 'uppercase', color: MUTED, marginBottom: 1.2 * vh }}>Also coming up</div>
          <div style={{ display: 'grid', gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr', gap: `${0.8 * vh}px ${3 * u}px` }}>
            {upNext.map(e => (
              <div key={e.id + e.event_date} style={{ display: 'flex', alignItems: 'baseline', gap: 1.6 * u, minWidth: 0 }}>
                <span style={{ fontSize: 1.75 * u, fontWeight: 800, color: accent, letterSpacing: '0.04em', textTransform: 'uppercase', flex: '0 0 auto', minWidth: 11 * u }}>{shortDate(e.event_date)}</span>
                <span style={{ fontSize: 2.05 * u, fontWeight: 700, color: '#e7eeff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{e.title}</span>
                {e.event_time && <span style={{ fontSize: 1.7 * u, fontWeight: 600, color: MUTED, flex: '0 0 auto' }}>{timeLabel(e.times?.[0] || e.event_time)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Footer({ theme, count, idx }) {
  const { accent, accent2, website, now, u, vh, vw, isPortrait } = theme;
  const pad = isPortrait ? 5 * vw : 3.2 * vw;
  const dots = Math.min(count, 18);
  const on = count <= 18 ? idx : Math.round((idx / Math.max(1, count - 1)) * (dots - 1));
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${2.4 * vh}px ${pad}px`, fontWeight: 700,
      background: 'linear-gradient(0deg, rgba(7,11,24,.9), transparent)',
    }}>
      <div style={{ display: 'flex', gap: 1.1 * u }}>
        {Array.from({ length: dots }).map((_, i) => (
          <i key={i} style={{
            display: 'block', height: 1.5 * u, width: i === on ? 4.4 * u : 1.5 * u, borderRadius: 999,
            background: i === on ? accent : 'rgba(255,255,255,.22)', transition: 'all .4s',
          }} />
        ))}
      </div>
      <div style={{ fontSize: 2.1 * u, letterSpacing: '0.06em', color: '#dbe6ff' }}>
        <b style={{
          background: `linear-gradient(92deg, ${accent}, ${accent2})`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
        }}>{website}</b> · Ayr Beach
      </div>
      <div style={{ fontSize: 2.1 * u, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
        {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

function EmptyState({ theme, error, hasData }) {
  const { accent, accent2, brand, website, u, vh } = theme;
  const msg = hasData ? `What's On at Ayr Pavilion — see ${website}` : (error ? `What's On at Ayr Pavilion — see ${website}` : "Loading What's On…");
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      gap: 3 * vh, background: BG, textAlign: 'center', padding: 10 * u,
    }}>
      <div style={{
        fontFamily: DISPLAY, fontSize: 9 * u,
        background: `linear-gradient(92deg, ${accent}, ${accent2})`,
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
      }}>{brand}</div>
      {!hasData && !error && (
        <div style={{ width: 9 * u, height: 9 * u, borderRadius: '50%', border: `${0.8 * u}px solid rgba(255,255,255,.12)`, borderTopColor: accent, animation: 'pwo-spin 1s linear infinite' }} />
      )}
      <div style={{ fontSize: 2.6 * u, color: MUTED, fontWeight: 600 }}>{msg}</div>
    </div>
  );
}
