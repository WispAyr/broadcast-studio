import React, { useState, useEffect, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// nar_sideliners — compact football strip for studio screens. Pulls the
// intranet SideLiners v2 feed (intranet.wispayr.online/api/public/sideliners,
// CORS-open): the producer's featured match + the followed live grid.
// Variants: 'featured' (single match score strip, default), 'grid' (live scores).
// ──────────────────────────────────────────────────────────────────────────

const FEED = 'https://intranet.wispayr.online/api/public/sideliners';
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const initials = s => String(s || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 3).join('').toUpperCase();

export default function NARSidelinersModule({ config = {} }) {
  const { variant = 'featured', refreshMs = 8000, showWire = true } = config;
  const [d, setD] = useState(null);
  const [rot, setRot] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const load = async () => { try { const r = await fetch(FEED, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (mounted.current) setD(j); } } catch {} };
    load(); const t = setInterval(load, refreshMs);
    return () => { mounted.current = false; clearInterval(t); };
  }, [refreshMs]);
  useEffect(() => { const t = setInterval(() => setRot(n => n + 1), 8000); return () => clearInterval(t); }, []);

  const G = '#37d67a', R = '#ff5b5b', INK = '#f4f6ff', MUT = '#9aa3c7';
  const MONO = "'IBM Plex Mono','SF Mono',ui-monospace,Menlo,monospace";
  const COND = "'Oswald','Bebas Neue','Arial Narrow',sans-serif";
  const bg = { background: 'radial-gradient(130% 130% at 18% 0%, #12271d 0%, #0a1020 55%, #05081a 100%)', color: INK };

  const Badge = ({ t, size }) => (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: 9, overflow: 'hidden', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {t && t.logo ? <img src={t.logo} alt="" style={{ width: '82%', height: '82%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
        : <span style={{ fontFamily: MONO, fontWeight: 900, fontSize: size * 0.32, color: G }}>{initials(t && t.name)}</span>}
    </div>
  );
  const phase = m => {
    const s = m.status || {};
    return m.live ? (s.elapsed ? s.elapsed + "'" : (s.short || 'LIVE')) : m.finished ? 'FT' : (s.short === 'NS' ? 'KO' : (s.short || ''));
  };
  const Phase = ({ m }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontWeight: 900, fontSize: 12, letterSpacing: '.1em', padding: '3px 8px', borderRadius: 999, background: m.live ? R : m.finished ? 'rgba(255,255,255,.08)' : 'rgba(55,214,122,.16)', color: m.live ? '#fff' : m.finished ? MUT : G }}>
      {m.live && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}{phase(m)}</span>
  );

  if (!d) return <div className="w-full h-full flex items-center justify-center" style={{ ...bg, fontFamily: MONO }}><span style={{ letterSpacing: '.3em', color: MUT, fontSize: 13 }}>⚽ SIDELINERS · STANDING BY</span></div>;

  const grid = d.grid || [];
  const featured = d.featured;

  // ── GRID variant ────────────────────────────────────────────────────────────
  if (variant === 'grid') {
    if (!grid.length) return <div className="w-full h-full flex items-center justify-center" style={{ ...bg, fontFamily: MONO }}><span style={{ letterSpacing: '.3em', color: MUT, fontSize: 13 }}>NO MATCHES FOLLOWED</span></div>;
    const row = m => (
      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <Badge t={m.home} size={26} />
        <span style={{ flex: 1, minWidth: 0, fontFamily: COND, fontWeight: 700, fontSize: 20, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip(m.home.name, 16)}</span>
        <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 22 }}>{m.home.goals ?? '-'}<span style={{ color: MUT }}> – </span>{m.away.goals ?? '-'}</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: COND, fontWeight: 700, fontSize: 20, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip(m.away.name, 16)}</span>
        <Badge t={m.away} size={26} /><Phase m={m} />
      </div>
    );
    return (
      <div className="w-full h-full flex flex-col" style={{ ...bg, fontFamily: "'Inter',Arial,sans-serif", padding: '3% 4%', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: COND, fontWeight: 700, fontSize: 22 }}>SIDE<span style={{ color: G }}>LINERS</span></span><span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', color: MUT }}>LIVE SCORES</span></div>
        <div style={{ flex: 1, overflow: 'hidden' }}>{grid.slice(0, 8).map(row)}</div>
      </div>
    );
  }

  // ── FEATURED variant — single match score strip ──────────────────────────────
  const m = featured;
  if (!m) return <div className="w-full h-full flex items-center justify-center" style={{ ...bg, fontFamily: MONO }}><span style={{ letterSpacing: '.3em', color: MUT, fontSize: 13 }}>⚽ SIDELINERS · NO MATCH FEATURED</span></div>;
  const wire = showWire && (d.news || []).length ? (d.news[rot % d.news.length] || {}).title : null;
  const Team = ({ t, align }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: align === 'right' ? 'row-reverse' : 'row', flex: 1, minWidth: 0 }}>
      <Badge t={t} size={54} />
      <div style={{ minWidth: 0, textAlign: align === 'right' ? 'right' : 'left' }}>
        <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 'clamp(20px,2.6vw,32px)', textTransform: 'uppercase', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip(t.name, 20)}</div>
        {t.local && <div style={{ fontFamily: MONO, fontSize: 11, color: '#5fe39a', letterSpacing: '.08em' }}>{t.local}</div>}
      </div>
    </div>
  );
  const show = m.status && m.status.short !== 'NS';
  return (
    <div className="w-full h-full flex flex-col justify-center" style={{ ...bg, fontFamily: "'Inter',Arial,sans-serif", padding: '0 2.4%', borderTop: `3px solid ${G}`, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 20, flex: 'none' }}>SIDE<span style={{ color: G }}>LINERS</span></span>
        <Team t={m.home} align="left" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 'none' }}>
          {show ? <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 'clamp(30px,4.5vw,56px)', lineHeight: .9 }}>{m.home.goals ?? 0} <span style={{ color: MUT }}>–</span> {m.away.goals ?? 0}</span>
            : <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 'clamp(24px,3vw,40px)', color: MUT, letterSpacing: '.08em' }}>VS</span>}
          <Phase m={m} />
        </div>
        <Team t={m.away} align="right" />
      </div>
      {wire && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ flex: 'none', fontFamily: MONO, fontWeight: 900, fontSize: 10, letterSpacing: '.14em', padding: '3px 8px', borderRadius: 5, background: G, color: '#08160c' }}>WIRE</span>
          <span style={{ fontSize: 14, color: '#dfe4fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{wire}</span>
        </div>
      )}
    </div>
  );
}
