import React, { useEffect, useState } from 'react';
import {
  useNowPlaying, useWeatherLive, useNewsLive,
  fmtHour, secondsUntil, NAR_STATION_ID,
} from '../lib/useLiveData';

/**
 * NAR presenter studio dashboard — a glanceable, always-on live screen for the
 * studio. Pure live React (not a Remotion composition): it polls the same feeds
 * the broadcast cards use and lays them out in four zones — on-air clock/timing,
 * now-playing/next, travel·weather·news, and socials/talkback.
 *
 * Surfaced two ways (same component): a Control-section page (/control/studio)
 * and a droppable screen module (`nar_studio`). Pass `embed` to drop padding
 * for iframe embedding (e.g. the NAR intranet).
 *
 * Honesty: there is no real listener-talkback feed, so the socials zone shows an
 * optional social RSS if `socialUrl` is set, otherwise a plain empty state — it
 * never invents messages.
 */

const NAVY = '#1E2A35';
const ORANGE = '#F7941D';
const RED = '#E2392D';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Poll the trains feed (via the fetch proxy) → { northbound, southbound }.
function useTrains(live = true) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!live) return undefined;
    let alive = true;
    const url = '/api/proxy/fetch?url=' + encodeURIComponent('https://trains.wispayr.online/api/all');
    const load = async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setData(j);
      } catch { /* keep last-good */ }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [live]);
  return data;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtCountdown(secs) {
  if (secs == null) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

// ── Zone shell ───────────────────────────────────────────────────────────────
function Zone({ title, accent = ORANGE, children, style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
      background: 'rgba(255,255,255,0.04)', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', ...style,
    }}>
      <div style={{
        padding: '10px 18px', fontSize: 13, fontWeight: 800, letterSpacing: 3,
        color: accent, borderBottom: '1px solid rgba(255,255,255,0.06)',
        textTransform: 'uppercase', flexShrink: 0,
      }}>{title}</div>
      <div style={{ padding: 18, flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ── Timing header ────────────────────────────────────────────────────────────
function TimingHeader({ now, np }) {
  const onAir = np?.onAir;
  const nowMs = now.getTime();
  let elapsedPct = null, remainMin = null;
  if (onAir?.start && onAir?.end && onAir.end > onAir.start) {
    elapsedPct = Math.min(100, Math.max(0, ((nowMs - onAir.start) / (onAir.end - onAir.start)) * 100));
    remainMin = Math.max(0, Math.round((onAir.end - nowMs) / 60000));
  }
  const secsToNext = np?.next?.start ? secondsUntil(np.next.start) : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 28, padding: '18px 28px',
      background: 'rgba(0,0,0,0.25)', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
    }}>
      {/* Clock */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <div style={{
          fontSize: 68, fontWeight: 900, letterSpacing: 2,
          fontVariantNumeric: 'tabular-nums', color: '#fff',
        }}>
          {pad2(now.getHours())}:{pad2(now.getMinutes())}
          <span style={{ fontSize: 34, color: ORANGE }}>:{pad2(now.getSeconds())}</span>
        </div>
        <div style={{ fontSize: 15, opacity: 0.6, marginTop: 6, letterSpacing: 1 }}>
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* On-air show + progress */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `linear-gradient(135deg, ${ORANGE}, ${RED})`,
            padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800, letterSpacing: 2,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />ON AIR
          </span>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {onAir?.title || '—'}
          </span>
          {onAir?.presenter && <span style={{ fontSize: 17, opacity: 0.6 }}>with {onAir.presenter}</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${elapsedPct ?? 0}%`, height: '100%', background: `linear-gradient(90deg, ${ORANGE}, ${RED})` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.55, marginTop: 6 }}>
          <span>{onAir?.start ? fmtHour(onAir.start) : ''}{onAir?.end ? ` – ${fmtHour(onAir.end)}` : ''}</span>
          <span>{remainMin != null ? `${remainMin} min left` : ''}</span>
        </div>
      </div>

      {/* Next junction */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.5, fontWeight: 700 }}>NEXT IN</div>
        <div style={{ fontSize: 40, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: secsToNext != null && secsToNext < 300 ? RED : '#fff' }}>
          {fmtCountdown(secsToNext)}
        </div>
        <div style={{ fontSize: 15, opacity: 0.65, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {np?.next?.title || ''}
        </div>
      </div>
    </div>
  );
}

// ── Now playing + history + next ─────────────────────────────────────────────
function NowPlayingZone({ np }) {
  const onAirMusic = np && np.isMusic && (np.title || np.artist);
  const history = Array.isArray(np?.history) ? np.history : [];
  return (
    <Zone title="Now Playing" accent={ORANGE} style={{ gridArea: 'np' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {np?.artwork
            ? <img src={np.artwork} alt="" style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 96, height: 96, borderRadius: 12, background: `linear-gradient(135deg, ${ORANGE}, ${RED})`, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {onAirMusic ? np.title : (np?.onAir?.title || '—')}
            </div>
            <div style={{ fontSize: 20, opacity: 0.65, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {onAirMusic ? np.artist : 'On air'}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.45, fontWeight: 700, marginBottom: 8 }}>RECENTLY PLAYED</div>
          {history.length ? history.slice(0, 5).map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 15, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: 0.85 }}>
              <span style={{ fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span style={{ opacity: 0.5, flexShrink: 0 }}>· {t.artist}</span>
            </div>
          )) : <div style={{ opacity: 0.4, fontSize: 14 }}>No recent tracks</div>}
        </div>
      </div>
    </Zone>
  );
}

// ── Weather + trains ─────────────────────────────────────────────────────────
function TravelZone({ wx, trains }) {
  const north = trains?.northbound?.departures || trains?.northbound || [];
  const south = trains?.southbound?.departures || trains?.southbound || [];
  const board = (title, list) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.45, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {(Array.isArray(list) ? list : []).slice(0, 3).map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: 14, padding: '3px 0', alignItems: 'baseline' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: s.cancelled ? RED : ORANGE, fontWeight: 700, flexShrink: 0 }}>
            {s.cancelled ? 'CANC' : (s.expected || s.scheduled || '')}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.destination}</span>
        </div>
      ))}
      {!(Array.isArray(list) && list.length) && <div style={{ opacity: 0.35, fontSize: 13 }}>No departures</div>}
    </div>
  );
  return (
    <Zone title="Travel & Weather" accent="#06b6d4" style={{ gridArea: 'travel' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 44 }}>{wx?.current?.icon || '·'}</div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              {wx?.current?.temperature != null ? `${Math.round(wx.current.temperature)}°` : '—'}
            </div>
            <div style={{ fontSize: 15, opacity: 0.6 }}>{wx?.current?.condition || ''} · Ayr</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {board('Kilmarnock ↑', north)}
          {board('Ayr / Stranraer ↓', south)}
        </div>
      </div>
    </Zone>
  );
}

// ── News ─────────────────────────────────────────────────────────────────────
function NewsZone({ news }) {
  const items = (Array.isArray(news) ? news : news?.items) || [];
  return (
    <Zone title="News" accent="#8b5cf6" style={{ gridArea: 'news' }}>
      {items.length ? items.slice(0, 6).map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 15, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#8b5cf6', fontWeight: 800, flexShrink: 0 }}>›</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
        </div>
      )) : <div style={{ opacity: 0.4, fontSize: 14 }}>Loading headlines…</div>}
    </Zone>
  );
}

// ── Socials / talkback ───────────────────────────────────────────────────────
function SocialZone({ social, socialUrl }) {
  const items = (Array.isArray(social) ? social : social?.items) || [];
  return (
    <Zone title="Socials & Talkback" accent={RED} style={{ gridArea: 'social' }}>
      {items.length ? items.slice(0, 5).map((it, i) => (
        <div key={i} style={{ fontSize: 15, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>{it.title}</span>
        </div>
      )) : (
        <div style={{ opacity: 0.4, fontSize: 14, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {socialUrl ? 'No messages yet' : 'No talkback feed connected'}
        </div>
      )}
    </Zone>
  );
}

export default function NARStudioDashboard({
  stationId = NAR_STATION_ID,
  newsUrl = 'https://feeds.bbci.co.uk/news/rss.xml',
  socialUrl = '',
  live = true,
  embed = false,
}) {
  const now = useClock();
  const np = useNowPlaying({ stationId, live });
  const wx = useWeatherLive({ live });
  const news = useNewsLive({ url: newsUrl, live });
  const social = useNewsLive({ url: socialUrl, live });
  const trains = useTrains(live);

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: embed ? '100%' : '100vh',
      background: `radial-gradient(ellipse 120% 90% at 50% 0%, #26343f 0%, ${NAVY} 60%)`,
      color: '#fff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      display: 'flex', flexDirection: 'column', gap: 16, padding: embed ? 16 : 24, boxSizing: 'border-box',
    }}>
      <TimingHeader now={now} np={np} />
      <div style={{
        flex: 1, minHeight: 0, display: 'grid', gap: 16,
        gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
        gridTemplateAreas: '"np travel" "news social"',
      }}>
        <NowPlayingZone np={np} />
        <TravelZone wx={wx} trains={trains} />
        <NewsZone news={news} />
        <SocialZone social={social} socialUrl={socialUrl} />
      </div>
    </div>
  );
}
