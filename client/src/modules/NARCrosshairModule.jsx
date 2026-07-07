import React, { useState, useEffect, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// nar_crosshair — compact studio-screen module for Crosshair track intelligence.
// Pulls the intranet's public feed (intranet.wispayr.online/api/public/crosshair,
// CORS-open) — the same cache that powers the full Crosshair evidence board —
// and squeezes it into a row (lower-third strip) or column (sidebar rail).
// Variants: 'row' (default, horizontal band), 'col' (vertical rail), 'panel'.
// ──────────────────────────────────────────────────────────────────────────

const FEED = 'https://intranet.wispayr.online/api/public/crosshair';
const LOGO = '/brands/nar/now-logo.png';

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// Compact fact chips, hottest first — mirrors the board's EVIDENCE cluster.
function chipsFor(d) {
  const tr = d.track || {}, ar = d.artist || {}, now = d.now || {}, st = d.stats || {};
  const out = [];
  if (ar.local) out.push({ icon: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', label: ar.local, local: true });
  const pk = (tr.charts || [])[0];
  if (pk) out.push({ icon: '📈', label: '#' + pk.rank, hot: true });
  if ((tr.awards || [])[0]) out.push({ icon: '🏆', label: clip(tr.awards[0], 16), hot: true });
  if (tr.year) out.push({ icon: '📅', label: tr.year });
  if (tr.bpm) out.push({ icon: '🥁', label: tr.bpm + ' BPM' });
  if (tr.key) out.push({ icon: '🎹', label: clip(String(tr.key).toUpperCase(), 10) });
  if (st.plays) out.push({ icon: '📻', label: '×' + st.plays });
  if ((tr.part_of || [])[0]) out.push({ icon: '🎬', label: clip(tr.part_of[0], 16) });
  const g = (tr.genres || [])[0] || (ar.genres || [])[0];
  if (g) out.push({ icon: '🎵', label: clip(g, 14) });
  if (tr.album) out.push({ icon: '💿', label: clip(tr.album, 18) });
  return out;
}

// Exact calendar-day anniversary → highlighted sub-line (rare, so a delight).
function onThisDay(d) {
  const tr = d.track || {}, ar = d.artist || {}, now = new Date();
  const md = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const isToday = f => /^\d{4}-\d{2}-\d{2}$/.test(f || '') && f.slice(5) === md;
  const ago = f => now.getFullYear() - +String(f).slice(0, 4);
  const name = ar._name || (d.now || {}).artist || 'the artist';
  if (isToday(tr.release_date) && ago(tr.release_date) > 0) return `💿 "${(d.now || {}).title}" was released ${ago(tr.release_date)} years ago today.`;
  if (isToday(ar.dob)) return ar.dod ? `🕯 ${name} — born on this day in ${String(ar.dob).slice(0, 4)}.` : `🎂 Happy birthday to ${name} — ${ago(ar.dob)} today.`;
  if (isToday(ar.formed_date) && !ar.dod) return `🎸 ${name} formed ${ago(ar.formed_date)} years ago today.`;
  if (isToday(ar.dod)) return `🕯 Remembering ${name}, who passed on this day in ${String(ar.dod).slice(0, 4)}.`;
  return null;
}

export default function NARCrosshairModule({ config = {} }) {
  const {
    variant = 'row', refreshMs = 15000,
    accent = '#FAA61A', accent2 = '#f4572e', background = '#0b1026',
    showArt = true, showWire = true, title = 'CROSSHAIR',
  } = config;

  const [d, setD] = useState(null);
  const [artOk, setArtOk] = useState(true);
  const [rot, setRot] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      try {
        const r = await fetch(FEED, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (mounted.current) { setD(j); setArtOk(true); }
      } catch {}
    };
    load();
    const t = setInterval(load, refreshMs);
    return () => { mounted.current = false; clearInterval(t); };
  }, [refreshMs]);

  useEffect(() => { const t = setInterval(() => setRot(n => n + 1), 8000); return () => clearInterval(t); }, []);

  const mono = "'IBM Plex Mono','SF Mono',ui-monospace,Menlo,monospace";
  const sans = "'Inter','Helvetica Neue',Arial,sans-serif";

  if (!d || !d.now || !d.now.title) {
    return (
      <div className="w-full h-full flex items-center justify-center"
        style={{ background: `radial-gradient(120% 130% at 20% 0%, #141b45, ${background} 60%)`, color: '#9aa3c7', fontFamily: mono }}>
        <span style={{ letterSpacing: '.3em', fontSize: 13 }}>◎ CROSSHAIR · STANDING BY</span>
      </div>
    );
  }

  const now = d.now || {}, tr = d.track || {}, ar = d.artist || {};
  const chips = chipsFor(d);
  const otd = onThisDay(d);
  const wire = (d.news || []).map(n => n.title).filter(Boolean);
  const subLine = otd || (showWire && wire.length ? wire[rot % wire.length] : null);
  const art = showArt && artOk ? (tr.art_url || ar.image) : null;

  const Reticle = ({ s = 22 }) => (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none" stroke={accent} strokeWidth="2.6" style={{ flex: 'none' }}>
      <circle cx="20" cy="20" r="12" /><line x1="20" y1="1" x2="20" y2="11" /><line x1="20" y1="29" x2="20" y2="39" />
      <line x1="1" y1="20" x2="11" y2="20" /><line x1="29" y1="20" x2="39" y2="20" /><circle cx="20" cy="20" r="1.8" fill={accent} />
    </svg>
  );

  const Chip = ({ c }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
      fontFamily: mono, fontWeight: 800, fontSize: variant === 'col' ? 14 : 15,
      padding: '4px 10px', borderRadius: 999,
      border: `1px solid ${c.local ? 'rgba(55,214,122,.5)' : c.hot ? 'rgba(250,166,26,.5)' : 'rgba(255,255,255,.16)'}`,
      background: c.local ? 'rgba(55,214,122,.16)' : c.hot ? 'rgba(250,166,26,.14)' : 'rgba(255,255,255,.05)',
      color: c.local ? '#5fe39a' : c.hot ? accent : '#e8ecff',
    }}>{c.icon} {c.label}</span>
  );

  const Art = ({ size }) => (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: 12, overflow: 'hidden', position: 'relative',
      background: `linear-gradient(135deg, ${accent}, ${accent2})`, boxShadow: '0 8px 30px rgba(0,0,0,.45)' }}>
      <img src={LOGO} alt="" style={{ position: 'absolute', inset: '18%', width: '64%', height: '64%', objectFit: 'contain' }}
        onError={e => { e.target.style.display = 'none'; }} />
      {art && <img src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setArtOk(false)} />}
    </div>
  );

  const bg = { background: `radial-gradient(130% 130% at 18% 0%, #141b45 0%, ${background} 55%, #05081a 100%)`, color: '#f4f6ff' };
  const scan = { content: "''", position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0 1px,transparent 1px 4px)' };

  // ── COLUMN — vertical rail ────────────────────────────────────────────────
  if (variant === 'col') {
    return (
      <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ ...bg, fontFamily: sans, padding: '5% 6%', gap: '3%' }}>
        <div style={scan} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <Reticle s={20} /><span style={{ fontFamily: mono, fontWeight: 900, letterSpacing: '.32em', fontSize: 15 }}>
            CROSS<span style={{ color: accent }}>HAIR</span></span>
        </div>
        {art !== null || showArt ? <Art size="100%" /> : null}
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.24em', color: accent, fontWeight: 800 }}>ON AIR NOW</div>
          <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.08, margin: '4px 0 2px' }}>{clip(now.title, 40)}</div>
          <div style={{ fontSize: 17, color: '#9aa3c7', fontWeight: 700 }}>{clip(now.artist, 34)}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, position: 'relative' }}>
          {chips.slice(0, 6).map((c, i) => <Chip key={i} c={c} />)}
        </div>
        {subLine && (
          <div style={{ marginTop: 'auto', position: 'relative', fontSize: 13, lineHeight: 1.4, color: '#dfe4fa',
            borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 10 }}>
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.2em', color: otd ? '#5fe39a' : accent, display: 'block', marginBottom: 4 }}>
              {otd ? 'ON THIS DAY' : 'WIRE'}</span>
            {clip(subLine, 120)}
          </div>
        )}
      </div>
    );
  }

  // ── PANEL — compact card ──────────────────────────────────────────────────
  if (variant === 'panel') {
    return (
      <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ ...bg, fontFamily: sans, padding: '3.5% 4%', gap: 14 }}>
        <div style={scan} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          {showArt && <Art size="clamp(70px,22%,140px)" />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Reticle s={18} />
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.24em', color: accent, fontWeight: 800 }}>CROSSHAIR · ON AIR</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 30, lineHeight: 1.06, margin: '6px 0 2px' }}>{clip(now.title, 42)}</div>
            <div style={{ fontSize: 19, color: '#9aa3c7', fontWeight: 700 }}>{clip(now.artist, 40)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, position: 'relative' }}>
          {chips.slice(0, 8).map((c, i) => <Chip key={i} c={c} />)}
        </div>
        {subLine && (
          <div style={{ marginTop: 'auto', position: 'relative', fontSize: 15, color: '#dfe4fa', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ flex: 'none', fontFamily: mono, fontWeight: 900, fontSize: 10, letterSpacing: '.14em', padding: '4px 9px', borderRadius: 6,
              background: otd ? '#37d67a' : accent, color: '#161006' }}>{otd ? 'ON THIS DAY' : 'WIRE'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subLine}</span>
          </div>
        )}
      </div>
    );
  }

  // ── ROW — lower-third strip (default) ─────────────────────────────────────
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-center"
      style={{ ...bg, fontFamily: sans, padding: '0 2.2%', borderTop: `2px solid ${accent}` }}>
      <div style={scan} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', minWidth: 0 }}>
        {showArt && <Art size="clamp(48px,66%,88px)" />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Reticle s={16} />
            <span style={{ fontFamily: mono, fontWeight: 900, letterSpacing: '.28em', fontSize: 13 }}>
              CROSS<span style={{ color: accent }}>HAIR</span></span>
          </div>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.22em', color: accent, fontWeight: 800 }}>ON AIR NOW</span>
        </div>
        <div style={{ minWidth: 0, maxWidth: '32%' }}>
          <div style={{ fontWeight: 900, fontSize: 'clamp(18px,2.4vw,30px)', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{now.title}</div>
          <div style={{ fontSize: 'clamp(13px,1.5vw,18px)', color: '#9aa3c7', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{now.artist}</div>
        </div>
        <div style={{ display: 'flex', gap: 7, flex: 1, flexWrap: 'wrap', overflow: 'hidden', maxHeight: 68, alignContent: 'center' }}>
          {chips.slice(0, 7).map((c, i) => <Chip key={i} c={c} />)}
        </div>
      </div>
      {subLine && (
        <div style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ flex: 'none', fontFamily: mono, fontWeight: 900, fontSize: 10, letterSpacing: '.14em', padding: '3px 8px', borderRadius: 5,
            background: otd ? '#37d67a' : accent, color: '#161006' }}>{otd ? 'ON THIS DAY' : 'WIRE'}</span>
          <span style={{ fontSize: 15, color: '#dfe4fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{subLine}</span>
        </div>
      )}
    </div>
  );
}
