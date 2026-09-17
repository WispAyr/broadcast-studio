import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { subscribePavilionWhatsOn, curateEvents, parseDate, timeLabel } from '../lib/pavilionWhatsOnCache';
import { useFonts, useBox, useClock, gradientText, DISPLAY, BODY, BG, INK, MUTED, GOLD, LINE } from '../lib/pavilionUi';

/**
 * Ayr Pavilion — Calendar Timeline.
 * A luminous timeline rail (vertical in portrait, horizontal in landscape)
 * with every upcoming event pinned to it as a big date block + card. A camera
 * glides from event to event; the focused card blooms open (poster, lineup,
 * ticket QR) while a live mini month-calendar in the header tracks the date.
 * Month markers and "N weeks later" gaps are drawn on the rail so the shape
 * of the season is readable at a glance.
 *
 * config:
 *   holdSeconds   seconds per event (default 8)
 *   mode          'upcoming' (chronological, default) | 'featured'
 *   brand / brandSub / website / accent / accent2   as PavilionWhatsOnModule
 *   maxEvents     cap on events pinned to the rail (default 24)
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CAMERA_MS = 950;
const BLOOM_MS = 650;

export default function PavilionCalendarTimelineModule({ config = {} }) {
  useFonts();
  const [ref, box] = useBox();
  const now = useClock();
  const [state, setState] = useState({ events: null, stale: false, error: null });
  useEffect(() => subscribePavilionWhatsOn(setState), []);

  const hold = Math.max(4, Number(config.holdSeconds) || 8) * 1000;
  const mode = config.mode === 'featured' ? 'featured' : 'upcoming';
  const accent = config.accent || '#19e3ff';
  const accent2 = config.accent2 || '#ff3d9a';
  const brand = config.brand || 'AYR PAVILION';
  const brandSub = config.brandSub || 'Ayr Beach · The Piv';
  const website = config.website || 'ayrpavilion.com';
  const maxEvents = Math.max(3, Number(config.maxEvents) || 24);

  const dayKey = now.toDateString();
  const events = useMemo(
    () => curateEvents(state.events || [], { mode, now: new Date(dayKey) }).slice(0, maxEvents),
    [state.events, mode, dayKey, maxEvents],
  );

  // ── focus cycling ────────────────────────────────────────────────────────
  const [focus, setFocus] = useState(0);
  const focusRef = useRef(0);
  useEffect(() => { focusRef.current = focus; }, [focus]);
  useEffect(() => { if (focus >= events.length) { setFocus(0); focusRef.current = 0; } }, [events.length, focus]);
  useEffect(() => {
    if (events.length < 2) return undefined;
    const t = setInterval(() => setFocus((focusRef.current + 1) % events.length), hold);
    return () => clearInterval(t);
  }, [events.length, hold]);

  const isPortrait = box.h > box.w * 1.1;
  const vw = box.w / 100, vh = box.h / 100;
  const u = isPortrait ? vw : vh * 0.62;
  const theme = { accent, accent2, brand, brandSub, website, isPortrait, vw, vh, u, now };
  const current = events[focus];

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: BG, color: INK, fontFamily: BODY }}>
      <style>{`
        @keyframes pct-drift { from { transform: scale(1.12) translate(0,0); } to { transform: scale(1.22) translate(0,-2.2%); } }
        @keyframes pct-in { from { opacity: 0; transform: translate3d(0, 28px, 0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes pct-in-x { from { opacity: 0; transform: translate3d(28px, 0, 0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes pct-pulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.35); opacity: .45; } }
        @keyframes pct-ring { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes pct-comet-y { 0% { top: -12%; } 100% { top: 108%; } }
        @keyframes pct-comet-x { 0% { left: -12%; } 100% { left: 108%; } }
        @keyframes pct-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes pct-spin { to { transform: rotate(360deg); } }
        @keyframes pct-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
      `}</style>

      <Backdrop poster={current?.poster_image} accent={accent} />

      {!events.length ? (
        <Empty theme={theme} hasData={Array.isArray(state.events)} error={state.error} />
      ) : (
        <>
          <Header theme={theme} events={events} current={current} />
          <Timeline theme={theme} events={events} focus={focus} />
          <Footer theme={theme} events={events} focus={focus} />
        </>
      )}
    </div>
  );
}

// ── Backdrop: crossfading blurred poster of the focused event ──────────────
function Backdrop({ poster, accent }) {
  const [layers, setLayers] = useState(() => [{ id: 0, poster }]);
  const idRef = useRef(1);
  useEffect(() => {
    setLayers(prev => {
      if (prev[prev.length - 1]?.poster === poster) return prev;
      const next = [...prev.slice(-1), { id: idRef.current++, poster }];
      return next;
    });
  }, [poster]);
  return (
    <>
      {layers.map((l, i) => (
        <FadeLayer key={l.id} poster={l.poster} last={i === layers.length - 1} />
      ))}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: `radial-gradient(120% 70% at 50% 8%, rgba(7,11,24,0) 0%, rgba(7,11,24,.45) 55%, rgba(7,11,24,.94) 100%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: `radial-gradient(60% 40% at 15% 50%, ${accent}12, transparent 70%)` }} />
    </>
  );
}

function FadeLayer({ poster, last }) {
  const [on, setOn] = useState(!last);
  useEffect(() => { const t = setTimeout(() => setOn(true), 30); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: 'absolute', inset: '-6%', zIndex: 0, opacity: on ? 1 : 0, transition: 'opacity 1200ms ease',
      backgroundImage: poster ? `url("${poster}")` : 'linear-gradient(150deg, #10204a, #2a0f3d)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      filter: 'blur(38px) brightness(.36) saturate(1.3)',
      animation: 'pct-drift 20s ease-in-out infinite alternate',
    }} />
  );
}

// ── Header: wordmark + live mini month calendar ────────────────────────────
function Header({ theme, events, current }) {
  const { accent, accent2, brand, brandSub, isPortrait, vw, vh, u } = theme;
  const pad = isPortrait ? 5 * vw : 3.2 * vw;
  return (
    <div style={{
      position: 'relative', zIndex: 5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 * vw,
      padding: `${(isPortrait ? 4.2 : 2.6) * vh}px ${pad}px 0`,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.92 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 6.2 * u, letterSpacing: '0.04em', ...gradientText(accent, accent2) }}>{brand}</span>
        <span style={{ fontSize: 1.9 * u, fontWeight: 700, letterSpacing: '0.42em', color: MUTED, marginTop: 0.7 * vh, textTransform: 'uppercase' }}>{brandSub}</span>
        <span style={{
          marginTop: 2.2 * vh, alignSelf: 'flex-start', fontSize: 1.7 * u, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
          padding: `${1.1 * vh}px ${2.2 * u}px`, border: `1px solid ${LINE}`, borderRadius: 999, background: 'rgba(255,255,255,.05)', color: accent,
        }}>Coming up · {events.length} events</span>
      </div>
      <MiniCalendar theme={theme} events={events} current={current} />
    </div>
  );
}

function MiniCalendar({ theme, events, current }) {
  const { accent, accent2, u, vh, isPortrait, now } = theme;
  const d = parseDate(current?.event_date) || now;
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const eventDays = new Set(events.filter(e => { const x = parseDate(e.event_date); return x && x.getFullYear() === y && x.getMonth() === m; }).map(e => parseDate(e.event_date).getDate()));
  const today = now.getFullYear() === y && now.getMonth() === m ? now.getDate() : -1;
  const focusDay = d.getDate();
  const cell = isPortrait ? 4.6 * u : 3.4 * u;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let i = 1; i <= daysIn; i++) cells.push(i);

  return (
    <div key={`${y}-${m}`} style={{
      flex: '0 0 auto', width: cell * 7 + 2 * u * 2, padding: `${1.4 * vh}px ${2 * u}px ${1.6 * vh}px`, borderRadius: 1.8 * u,
      background: 'rgba(10,16,34,.55)', border: `1px solid ${LINE}`, backdropFilter: 'blur(12px)',
      boxShadow: '0 18px 50px rgba(0,0,0,.45)', animation: 'pct-fade-up .6s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 0.9 * vh }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 3.1 * u, letterSpacing: '0.06em', ...gradientText(accent, accent2) }}>{MONTHS[m].toUpperCase()}</span>
        <span style={{ fontSize: 1.5 * u, fontWeight: 800, color: MUTED, letterSpacing: '0.2em' }}>{y}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cell}px)` }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 1.25 * u, fontWeight: 800, color: 'rgba(159,176,212,.7)', letterSpacing: '0.1em', paddingBottom: 0.5 * vh }}>{w}</div>
        ))}
        {cells.map((day, i) => {
          const has = day && eventDays.has(day);
          const isFocus = day === focusDay;
          const isToday = day === today;
          return (
            <div key={i} style={{ position: 'relative', height: cell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {day && (
                <>
                  {isFocus && <span style={{ position: 'absolute', width: cell * .78, height: cell * .78, borderRadius: '50%', border: `2px solid ${accent}`, animation: 'pct-ring 1.6s ease-out infinite' }} />}
                  <span style={{
                    width: cell * .78, height: cell * .78, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 1.55 * u, fontWeight: isFocus || has ? 800 : 600,
                    color: isFocus ? '#04121a' : has ? INK : 'rgba(243,246,255,.45)',
                    background: isFocus ? `linear-gradient(135deg, ${accent}, #5ad0ff)` : 'transparent',
                    boxShadow: isFocus ? `0 0 ${1.6 * u}px ${accent}99` : 'none',
                    outline: isToday && !isFocus ? `1px solid rgba(255,255,255,.35)` : 'none',
                    transition: 'all .5s ease',
                  }}>{day}</span>
                  {has && !isFocus && <span style={{ position: 'absolute', bottom: cell * .06, width: cell * .14, height: cell * .14, borderRadius: '50%', background: accent2, boxShadow: `0 0 ${0.8 * u}px ${accent2}` }} />}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Timeline rail + cards ──────────────────────────────────────────────────
function Timeline({ theme, events, focus }) {
  const { accent, accent2, isPortrait, vw, vh, u } = theme;
  const viewRef = useRef(null);
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const [shift, setShift] = useState(0);

  const railX = isPortrait ? 12 * vw : 0;        // portrait: rail at x; landscape: rail at y centre
  const lead = isPortrait ? 4 * vh : 6 * vw;     // where the focused card sits inside the viewport

  const bloomRefs = useRef([]);
  const measure = () => {
    const el = cardRefs.current[focus];
    if (!el) return;
    let off = isPortrait ? el.offsetTop : el.offsetLeft;
    // Cards ABOVE the focus may still be mid-collapse (their bloom is
    // animating to 0). Subtract their current bloom size so the camera aims
    // at the settled position instead of overshooting and creeping back.
    if (isPortrait) {
      for (let j = 0; j < focus; j++) {
        const b = bloomRefs.current[j];
        if (b) off -= b.getBoundingClientRect().height;
      }
    }
    setShift(-(off - lead));
  };
  useLayoutEffect(measure, [focus, events, isPortrait, vw, vh]);
  useEffect(() => { const t = setTimeout(measure, BLOOM_MS + 60); return () => clearTimeout(t); }, [focus, events.length]);

  // items with month markers + gap labels interleaved
  const items = useMemo(() => {
    const out = [];
    let lastMonth = -1, lastDate = null;
    events.forEach((ev, i) => {
      const d = parseDate(ev.event_date);
      const mk = d ? d.getFullYear() * 12 + d.getMonth() : -1;
      if (d && lastDate) {
        const gap = Math.round((d - lastDate) / 86400000);
        if (gap >= 10) out.push({ kind: 'gap', key: `gap-${i}`, days: gap });
      }
      if (mk !== lastMonth && d) { out.push({ kind: 'month', key: `m-${mk}`, label: MONTHS[d.getMonth()], year: d.getFullYear() }); lastMonth = mk; }
      out.push({ kind: 'event', key: `e-${ev.id}-${ev.event_date}`, ev, i });
      lastDate = d || lastDate;
    });
    return out;
  }, [events]);

  const viewStyle = isPortrait
    ? { position: 'absolute', left: 0, right: 0, top: 30 * vh, bottom: 9 * vh }
    : { position: 'absolute', left: 0, right: 0, top: 26 * vh, bottom: 9 * vh };

  return (
    <div ref={viewRef} style={{ ...viewStyle, zIndex: 4, overflow: 'hidden' }}>
      {/* rail */}
      {isPortrait ? (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: railX, width: 3, background: `linear-gradient(180deg, ${accent}00, ${accent}aa 12%, ${accent2}aa 88%, ${accent2}00)`, boxShadow: `0 0 ${1.6 * u}px ${accent}66` }}>
          <div style={{ position: 'absolute', left: -1.4 * u + 1.5, width: 2.8 * u, height: 14 * vh, borderRadius: 999, background: `linear-gradient(180deg, transparent, ${accent}cc, transparent)`, filter: 'blur(6px)', animation: 'pct-comet-y 5.5s linear infinite' }} />
        </div>
      ) : (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 3, marginTop: -1.5, background: `linear-gradient(90deg, ${accent}00, ${accent}aa 8%, ${accent2}aa 92%, ${accent2}00)`, boxShadow: `0 0 ${1.6 * u}px ${accent}66` }}>
          <div style={{ position: 'absolute', top: -1.4 * u + 1.5, height: 2.8 * u, width: 14 * vw, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)`, filter: 'blur(6px)', animation: 'pct-comet-x 6s linear infinite' }} />
        </div>
      )}
      {/* edge fades */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, background: isPortrait
        ? `linear-gradient(180deg, ${BG} 0%, transparent 6%, transparent 82%, ${BG} 100%)`
        : `linear-gradient(90deg, ${BG} 0%, transparent 5%, transparent 95%, ${BG} 100%)` }} />

      <div ref={trackRef} data-tl-track="1" style={{
        position: 'relative', display: 'flex', flexDirection: isPortrait ? 'column' : 'row', alignItems: isPortrait ? 'stretch' : 'center',
        height: isPortrait ? 'auto' : '100%',
        gap: isPortrait ? 1.6 * vh : 2.2 * vw,
        transform: isPortrait ? `translate3d(0, ${shift}px, 0)` : `translate3d(${shift}px, 0, 0)`,
        transition: `transform ${CAMERA_MS}ms cubic-bezier(.22,.8,.2,1)`, willChange: 'transform',
      }}>
        {items.map((it, k) => {
          if (it.kind === 'month') return <MonthMarker key={it.key} theme={theme} label={it.label} year={it.year} railX={railX} delay={k * 50} />;
          if (it.kind === 'gap') return <GapMarker key={it.key} theme={theme} days={it.days} railX={railX} />;
          return (
            <EventCard key={it.key} ref={el => { cardRefs.current[it.i] = el; }} bloomRef={el => { bloomRefs.current[it.i] = el; }} theme={theme} ev={it.ev} index={it.i}
              focused={it.i === focus} past={it.i < focus} railX={railX} delay={k * 50} alt={it.i % 2 === 1} />
          );
        })}
        {/* tail spacer so the last card can reach the lead position */}
        <div style={{ flex: '0 0 auto', width: isPortrait ? 1 : 70 * vw, height: isPortrait ? 70 * vh : 1 }} />
      </div>
    </div>
  );
}

function MonthMarker({ theme, label, year, railX, delay }) {
  const { accent, accent2, isPortrait, u, vh, vw } = theme;
  if (!isPortrait) {
    return (
      <div style={{ flex: '0 0 auto', width: 12 * vw, height: '100%', position: 'relative', animation: `pct-in-x .6s ease both`, animationDelay: `${delay}ms` }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: `linear-gradient(180deg, transparent, ${accent}66, transparent)` }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) rotate(-90deg)', whiteSpace: 'nowrap', fontFamily: DISPLAY, fontSize: 4.2 * u, letterSpacing: '0.12em', ...gradientText(accent, accent2), opacity: .85 }}>{label.toUpperCase()}</div>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', paddingLeft: railX + 4 * u, paddingTop: 1.2 * vh, paddingBottom: 0.4 * vh, animation: `pct-in .6s ease both`, animationDelay: `${delay}ms` }}>
      <div style={{ position: 'absolute', left: railX - 0.9 * u + 1.5, top: '50%', width: 1.8 * u, height: 1.8 * u, marginTop: -0.9 * u, borderRadius: '50%', background: BG, border: `2px solid ${accent2}`, boxShadow: `0 0 ${1.2 * u}px ${accent2}88` }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1.6 * u }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 4.6 * u, letterSpacing: '0.1em', lineHeight: 1, ...gradientText(accent, accent2) }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 1.6 * u, fontWeight: 800, color: MUTED, letterSpacing: '0.25em' }}>{year}</span>
      </div>
    </div>
  );
}

function GapMarker({ theme, days, railX }) {
  const { isPortrait, u, vh, vw } = theme;
  const label = days >= 21 ? `${Math.round(days / 7)} weeks later` : days >= 10 ? `${Math.round(days / 7)} weeks later` : '';
  if (!label) return null;
  if (!isPortrait) {
    return <div style={{ flex: '0 0 auto', width: 9 * vw, textAlign: 'center', fontSize: 1.4 * u, fontWeight: 700, color: 'rgba(159,176,212,.7)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{label}</div>;
  }
  return (
    <div style={{ position: 'relative', paddingLeft: railX + 4 * u, height: 4.5 * vh, display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: railX + 1.5 - 1, top: 0, bottom: 0, width: 2, backgroundImage: `repeating-linear-gradient(180deg, ${BG} 0 6px, transparent 6px 12px)` }} />
      <span style={{ fontSize: 1.45 * u, fontWeight: 700, color: 'rgba(159,176,212,.75)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>· · · {label}</span>
    </div>
  );
}

const EventCard = React.forwardRef(function EventCard({ theme, ev, focused, past, railX, delay, alt, bloomRef, index }, ref) {
  const { accent, accent2, isPortrait, u, vh, vw } = theme;
  const d = parseDate(ev.event_date);
  const times = (ev.times && ev.times.length ? ev.times : [ev.event_time]).filter(Boolean).map(timeLabel);
  const acts = (ev.lineup || []).filter(a => a.toLowerCase() !== String(ev.title || '').toLowerCase()).slice(0, 5);
  const tickets = ev.ticket_url || ev.external_url || '';
  const [imgOk, setImgOk] = useState(!!ev.poster_image);
  const poster = imgOk ? ev.poster_image : '';

  const dateBlock = (
    <div style={{ flex: '0 0 auto', width: isPortrait ? 14 * u : 9 * u, textAlign: 'center', lineHeight: 0.9 }}>
      <div style={{ fontSize: 1.55 * u, fontWeight: 800, letterSpacing: '0.28em', color: focused ? accent : MUTED, transition: 'color .5s' }}>{d ? DAY3[d.getDay()] : ''}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: (isPortrait ? 7.2 : 5.6) * u, marginTop: 0.4 * vh, ...(focused ? gradientText(accent, accent2) : { color: past ? 'rgba(243,246,255,.5)' : INK }), transition: 'all .5s' }}>{d ? d.getDate() : ''}</div>
      <div style={{ fontSize: 1.55 * u, fontWeight: 800, letterSpacing: '0.28em', color: focused ? accent2 : MUTED, marginTop: 0.4 * vh, transition: 'color .5s' }}>{d ? MON3[d.getMonth()] : ''}</div>
    </div>
  );

  const node = (
    <div style={{
      position: 'absolute', zIndex: 2,
      ...(isPortrait ? { left: railX - 1.1 * u + 1.5, top: 5.2 * vh } : { left: '50%', marginLeft: -1.1 * u, ...(alt ? { top: -1.1 * u - 1 } : { bottom: -1.1 * u - 1 }) }),
      width: 2.2 * u, height: 2.2 * u, borderRadius: '50%',
      background: focused ? `radial-gradient(circle, #fff, ${accent})` : past ? 'rgba(159,176,212,.5)' : BG,
      border: `2px solid ${focused ? accent : past ? 'transparent' : accent}`,
      boxShadow: focused ? `0 0 ${2.4 * u}px ${accent}` : 'none', transition: 'all .5s',
    }}>
      {focused && <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: `2px solid ${accent}`, animation: 'pct-ring 1.4s ease-out infinite' }} />}
    </div>
  );

  const body = (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 1.8 * u, overflow: 'hidden', position: 'relative',
      background: focused ? 'linear-gradient(160deg, rgba(20,30,64,.78), rgba(10,16,34,.9))' : 'rgba(10,16,34,.5)',
      border: `1px solid ${focused ? accent + '66' : LINE}`,
      boxShadow: focused ? `0 ${2 * vh}px ${6 * vh}px rgba(0,0,0,.55), 0 0 0 1px ${accent}22, 0 0 ${4 * u}px ${accent}22` : 'none',
      backdropFilter: 'blur(10px)', transition: 'background .5s, border-color .5s, box-shadow .5s',
    }}>
      {focused && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, ${accent2}, ${accent})`, backgroundSize: '200% 100%', animation: 'pct-shimmer 3s linear infinite' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 * u, padding: `${1.6 * vh}px ${2.4 * u}px` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 1 * u, flexWrap: 'wrap', marginBottom: 0.6 * vh }}>
            {ev.featured && <Tag theme={theme} bg={`linear-gradient(92deg, ${GOLD}, #ffb13d)`} fg="#1c1400">★ Featured</Tag>}
            {ev.sessions > 1 && <Tag theme={theme} fg={accent}>{ev.sessions} sessions</Tag>}
            {ev.event_type && <Tag theme={theme}>{ev.event_type}</Tag>}
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: (focused ? 4.2 : 3.2) * u, lineHeight: 1, letterSpacing: '0.01em', transition: 'font-size .5s', overflowWrap: 'anywhere', color: past && !focused ? 'rgba(243,246,255,.6)' : INK }}>{ev.title}</div>
          <div style={{ marginTop: 0.8 * vh, fontSize: 1.9 * u, fontWeight: 700, color: focused ? '#e7eeff' : MUTED, display: 'flex', gap: 1.4 * u, alignItems: 'center', flexWrap: 'wrap' }}>
            {times.length > 0 && <span>{times.join(' · ')}</span>}
            {times.length > 0 && <span style={{ width: 0.6 * u, height: 0.6 * u, borderRadius: '50%', background: accent2 }} />}
            <span style={{ fontWeight: 600 }}>{ev.venue || 'Ayr Pavilion'}</span>
          </div>
        </div>
        {!focused && poster && (
          <img src={poster} alt="" onError={() => setImgOk(false)} style={{ width: 10 * u, height: 10 * u, objectFit: 'cover', borderRadius: 1.2 * u, flex: '0 0 auto', opacity: past ? .6 : 1, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }} />
        )}
      </div>

      {/* bloom */}
      <div style={{ display: 'grid', gridTemplateRows: focused ? '1fr' : '0fr', transition: `grid-template-rows ${BLOOM_MS}ms cubic-bezier(.22,.8,.2,1)` }}>
        <div ref={bloomRef} data-tl-bloom={index} style={{ minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 2.2 * u, padding: `0 ${2.4 * u}px ${2 * vh}px`, alignItems: 'stretch' }}>
            {poster ? (
              <img src={poster} alt="" onError={() => setImgOk(false)} style={{ flex: '0 0 auto', width: isPortrait ? 30 * u : 22 * u, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 1.4 * u, boxShadow: '0 14px 40px rgba(0,0,0,.55)', animation: 'pct-fade-up .7s ease both' }} />
            ) : (
              <div style={{ flex: '0 0 auto', width: isPortrait ? 30 * u : 22 * u, aspectRatio: '3 / 4', borderRadius: 1.4 * u, background: 'linear-gradient(150deg, #10204a, #2a0f3d)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8%', textAlign: 'center' }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 3.2 * u, lineHeight: 1, ...gradientText(accent, accent2) }}>{ev.title}</span>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1.2 * vh }}>
              {acts.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${0.8 * u}px ${1 * u}px`, alignContent: 'flex-start' }}>
                  {acts.map((a, i) => (
                    <span key={i} style={{ fontSize: 1.6 * u, fontWeight: 600, color: '#d7e1ff', padding: `${0.6 * vh}px ${1.4 * u}px`, borderRadius: 0.8 * u, background: 'rgba(255,255,255,.06)', border: `1px solid ${LINE}`, animation: 'pct-fade-up .6s ease both', animationDelay: `${120 + i * 70}ms` }}>{a}</span>
                  ))}
                  {(ev.lineup || []).length > 5 && <span style={{ fontSize: 1.6 * u, fontWeight: 700, color: accent, padding: `${0.6 * vh}px ${0.6 * u}px` }}>+{(ev.lineup || []).length - 5} more</span>}
                </div>
              ) : (
                <div style={{ fontSize: 1.7 * u, fontWeight: 600, color: MUTED, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', animation: 'pct-fade-up .6s ease both' }}>{ev.description}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 1.6 * u, animation: 'pct-fade-up .6s ease both', animationDelay: '250ms' }}>
                {tickets ? (
                  <>
                    <div style={{ width: 9.5 * u, height: 9.5 * u, background: '#fff', borderRadius: 1.1 * u, padding: 0.7 * u, flex: '0 0 auto', boxShadow: '0 10px 28px rgba(0,0,0,.5)' }}>
                      <QRCodeSVG value={tickets} size={192} level="M" bgColor="#ffffff" fgColor={BG} includeMargin={false} style={{ width: '100%', height: '100%', display: 'block' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 1.9 * u, fontWeight: 800 }}>Scan for tickets</div>
                      <div style={{ fontSize: 1.5 * u, fontWeight: 600, color: MUTED, marginTop: 0.4 * vh }}>{ev.external_provider ? `via ${ev.external_provider}` : theme.website}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 1.6 * u, fontWeight: 700, color: MUTED }}>Tickets &amp; info · {theme.website}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isPortrait) {
    // landscape: fixed-width column, card above (alt) or below the rail
    return (
      <div ref={ref} data-tl-card={index} style={{ flex: '0 0 auto', width: (focused ? 36 : 22) * vw, height: '100%', position: 'relative', transition: `width ${BLOOM_MS}ms cubic-bezier(.22,.8,.2,1)`, animation: `pct-in-x .6s ease both`, animationDelay: `${delay}ms` }}>
        {node}
        <div style={{ position: 'absolute', left: 0, right: 0, ...(alt ? { bottom: 'calc(50% + 2.6vh)' } : { top: 'calc(50% + 2.6vh)' }), display: 'flex', alignItems: 'flex-start', gap: 1.6 * u, opacity: past && !focused ? .55 : 1, transition: 'opacity .5s' }}>
          {dateBlock}{body}
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} data-tl-card={index} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 2 * u, paddingLeft: railX + 4 * u, paddingRight: 5 * vw, opacity: past && !focused ? .55 : 1, transition: 'opacity .5s', animation: `pct-in .6s ease both`, animationDelay: `${delay}ms` }}>
      {node}
      {dateBlock}
      {body}
    </div>
  );
});

function Tag({ theme, children, bg, fg }) {
  const { u, vh } = theme;
  return (
    <span style={{ fontSize: 1.35 * u, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: `${0.5 * vh}px ${1.3 * u}px`, borderRadius: 999, background: bg || 'rgba(255,255,255,.08)', color: fg || INK, border: bg ? 'none' : `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{children}</span>
  );
}

function Footer({ theme, events, focus }) {
  const { accent, accent2, website, now, u, vh, vw, isPortrait } = theme;
  const pad = isPortrait ? 5 * vw : 3.2 * vw;
  const cur = events[focus];
  const d = parseDate(cur?.event_date);
  const days = d ? Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000) : null;
  const countdown = days == null ? '' : days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${2.2 * vh}px ${pad}px`, fontWeight: 700, background: `linear-gradient(0deg, ${BG}, rgba(7,11,24,.85) 60%, transparent)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1.4 * u }}>
        <span style={{ width: 1.2 * u, height: 1.2 * u, borderRadius: '50%', background: accent, boxShadow: `0 0 ${1.2 * u}px ${accent}`, animation: 'pct-pulse 1.6s ease-in-out infinite' }} />
        <span style={{ fontSize: 2 * u, color: '#dbe6ff', letterSpacing: '0.04em' }}>{countdown}</span>
        <span style={{ fontSize: 1.6 * u, color: MUTED, fontWeight: 600 }}>· {focus + 1} of {events.length}</span>
      </div>
      <div style={{ fontSize: 2.1 * u, letterSpacing: '0.06em', color: '#dbe6ff' }}><b style={gradientText(accent, accent2)}>{website}</b> · Ayr Beach</div>
      <div style={{ fontSize: 2.1 * u, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}

function Empty({ theme, hasData, error }) {
  const { accent, accent2, brand, website, u, vh } = theme;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 3 * vh, textAlign: 'center', padding: 10 * u }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 9 * u, ...gradientText(accent, accent2) }}>{brand}</div>
      {!hasData && !error && <div style={{ width: 9 * u, height: 9 * u, borderRadius: '50%', border: `${0.8 * u}px solid rgba(255,255,255,.12)`, borderTopColor: accent, animation: 'pct-spin 1s linear infinite' }} />}
      <div style={{ fontSize: 2.6 * u, color: MUTED, fontWeight: 600 }}>{hasData || error ? `What's On at Ayr Pavilion — see ${website}` : 'Loading What\'s On…'}</div>
    </div>
  );
}
