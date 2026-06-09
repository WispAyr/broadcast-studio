import React, { useState, useEffect } from 'react';

// ──────────────────────────────────────────────────────────────────────────
// nar_warnings — Met Office NSWWS weather warnings for Ayrshire.
// Feed: live.wispayr.online/api/wx/warnings → GeoJSON FeatureCollection
//   { features:[{properties:{warningLevel|severity, weather|type, headline|title}}],
//     count, count_by_severity:{red,amber,yellow} }
// Renders an "all clear" green strip when none, or coloured warning cards.
// variant: 'strip' (thin lower-third) | 'panel' (stacked cards).
// ──────────────────────────────────────────────────────────────────────────

const FEED = 'https://live.wispayr.online/api/wx/warnings';

const LEVELS = {
  red: { bg: '#dc2626', label: 'RED' },
  amber: { bg: '#f97316', label: 'AMBER' },
  yellow: { bg: '#eab308', label: 'YELLOW' },
};

function levelOf(p) {
  const v = String(p?.warningLevel || p?.severity || p?.level || p?.colour || '').toLowerCase();
  if (v.includes('red')) return 'red';
  if (v.includes('amber') || v.includes('orange')) return 'amber';
  return 'yellow';
}
const weatherOf = (p) => p?.weather || p?.type || p?.hazard || 'Weather';
const headlineOf = (p) => p?.headline || p?.title || p?.text || p?.name || '';

export default function NARWarningsModule({ config = {} }) {
  const { refreshInterval = 300000, variant = 'strip', background = '#0a0e1a',
    title = 'MET OFFICE WARNINGS' } = config;
  const [fc, setFc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/proxy/fetch?url=${encodeURIComponent(FEED)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const d = JSON.parse(await res.text());
        if (on) { setFc(d); setError(null); }
      } catch (e) { if (on) setError(e.message); }
    };
    load();
    const t = setInterval(load, refreshInterval);
    return () => { on = false; clearInterval(t); };
  }, [refreshInterval]);

  const features = fc?.features || [];
  const count = fc?.count ?? features.length;
  const worst = (fc?.count_by_severity?.red) ? 'red' : (fc?.count_by_severity?.amber) ? 'amber'
    : features.length ? levelOf(features[0].properties) : null;

  // ── All clear ──
  if (fc && count === 0) {
    if (variant === 'strip') {
      return (
        <div className="w-full h-full flex items-center gap-3 px-4" style={{ background: 'linear-gradient(90deg, #14532d, #0a0e1a)', color: '#fff' }}>
          <span className="text-lg">✅</span>
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#4ade80' }}>No weather warnings</span>
          <span className="text-sm opacity-50">Ayrshire — all clear</span>
        </div>
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background, color: '#fff' }}>
        <span className="text-4xl">✅</span>
        <span className="text-base font-bold" style={{ color: '#4ade80' }}>No weather warnings</span>
        <span className="text-xs opacity-40">Met Office NSWWS · Ayrshire</span>
      </div>
    );
  }

  if (error && !fc) return <div className="w-full h-full flex items-center px-4 text-sm" style={{ background, color: '#888' }}>Warnings unavailable</div>;
  if (!fc) return <div className="w-full h-full" style={{ background }} />;

  // ── Strip (marquee if several) ──
  if (variant === 'strip') {
    const lv = LEVELS[worst] || LEVELS.yellow;
    return (
      <div className="w-full h-full flex items-center overflow-hidden" style={{ background: lv.bg, color: '#fff' }}>
        <div className="flex items-center gap-2 px-3 h-full shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <span className="text-lg">⚠️</span>
          <span className="text-[11px] font-black uppercase tracking-widest">{lv.label} · {count}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="whitespace-nowrap flex gap-8 px-4" style={{ animation: features.length > 1 ? 'narWarnMarquee 30s linear infinite' : 'none' }}>
            {features.map((f, i) => (
              <span key={i} className="text-sm font-semibold">
                <b className="uppercase">{weatherOf(f.properties)}</b> — {headlineOf(f.properties)}
                <span className="opacity-50 mx-3">●</span>
              </span>
            ))}
          </div>
        </div>
        <style>{`@keyframes narWarnMarquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
      </div>
    );
  }

  // ── Panel ──
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background, color: '#fff' }}>
      <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: '2px solid rgba(234,179,8,0.3)' }}>
        <span>⚠️</span>
        <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: '#eab308' }}>{title}</span>
        <span className="ml-auto text-[10px] opacity-30">Met Office NSWWS</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {features.map((f, i) => {
          const lv = LEVELS[levelOf(f.properties)] || LEVELS.yellow;
          return (
            <div key={i} className="rounded-lg p-3 flex items-start gap-3" style={{ background: `${lv.bg}22`, borderLeft: `4px solid ${lv.bg}` }}>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase" style={{ background: lv.bg }}>{lv.label}</span>
              <div className="min-w-0">
                <div className="font-bold text-sm">{weatherOf(f.properties)}</div>
                <div className="text-xs opacity-70 leading-snug">{headlineOf(f.properties)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
