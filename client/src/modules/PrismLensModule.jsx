import React, { useEffect, useMemo, useState } from 'react';

/**
 * PrismLensModule — generic consumer of any Prism lens or raw Siphon
 * pass-through exposed via prism.
 *
 * Broadcast Studio is a pure consumer: it does no data enrichment, no joins,
 * no freshness logic. It fetches a pre-computed lens payload and renders it.
 *
 * Config (all optional except `endpoint` OR `lens`):
 *   endpoint:      absolute path under /api/prism-proxy/ — e.g. "traffic-network",
 *                  "events-admin/3", "traffic/cameras" (raw passthrough),
 *                  or "traffic-cameras-enriched".
 *   lens:          alias for endpoint (use the lens consumer path).
 *   eventId:       if set, the module first resolves the event and uses its
 *                  lens whitelist to sanity-check the requested lens.
 *   display:       'bignum' | 'list' | 'sparkline' | 'image' | 'observations' | 'json'
 *   title:         header label
 *   fields:        for 'bignum'/'list' — which top-level keys to pluck from data
 *   fieldLabels:   {field: label} overrides
 *   unit:          appended to a 'bignum' value (e.g. "incidents")
 *   color:         accent colour
 *   refreshSecs:   poll interval (default 60)
 *   cameraId:      for 'image' display — picks cameras[].id from traffic-cameras
 *   imageUrlBase:  URL template for camera images — e.g.
 *                  "/api/prism-proxy/traffic/cameras/image/{image_name}" when
 *                  the upstream image proxy is mounted (otherwise omit and the
 *                  image block will show a filename placeholder).
 */

const DEFAULTS = {
  display: 'json',
  title: 'PRISM LENS',
  refreshSecs: 60,
  color: '#80cef4',
};

function formatNumber(v) {
  if (v == null) return '--';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1000) return v.toLocaleString();
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }
  return String(v);
}

function Sparkline({ series, accessor, color }) {
  const points = useMemo(() => {
    if (!series?.length) return null;
    const values = series.map((s) => accessor(s) ?? 0);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = 100;
    const h = 30;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [series, accessor]);
  if (!points) return null;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export default function PrismLensModule({ config = {} }) {
  const merged = { ...DEFAULTS, ...config };
  const rawEndpoint = merged.endpoint || merged.lens;
  // Event-scoped endpoints: when an eventId is set, prefix "events/:id/" so the
  // upstream lens resolves against that event's context (bbox, hub, config).
  // If the endpoint already starts with "events/" or "events-admin/", leave it
  // alone — it's already event-addressed.
  const endpoint = (() => {
    if (!rawEndpoint) return rawEndpoint;
    const id = merged.eventId;
    if (!id) return rawEndpoint;
    if (/^events(-admin)?\//.test(rawEndpoint)) return rawEndpoint;
    return `events/${id}/${rawEndpoint}`;
  })();
  const refreshMs = (merged.refreshSecs || 60) * 1000;

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [computedAt, setComputedAt] = useState(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!endpoint) return undefined;
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch(`/api/prism-proxy/${endpoint}`);
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(j?.error || `HTTP ${r.status}`);
          setPayload(null);
        } else {
          // Prism consumer wraps in {data, stale, computed_at}; raw passthroughs don't.
          if (j && typeof j === 'object' && 'data' in j && ('stale' in j || 'computed_at' in j)) {
            setPayload(j.data);
            setStale(Boolean(j.stale));
            setComputedAt(j.computed_at || null);
          } else {
            setPayload(j);
            setStale(false);
            setComputedAt(null);
          }
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [endpoint, refreshMs]);

  const display = merged.display;
  const color = merged.color;

  let body = null;

  if (error) {
    body = <div className="text-red-400 text-sm p-2">Lens error: {error}</div>;
  } else if (!payload && loading) {
    body = <div className="text-white/30 text-sm">Loading…</div>;
  } else if (!payload) {
    body = <div className="text-white/30 text-sm">No data</div>;
  } else if (display === 'bignum') {
    const field = merged.fields?.[0];
    const value = field ? payload[field] : payload.label;
    body = (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-[9px] uppercase tracking-[0.3em] text-white/40 mb-2">
          {merged.fieldLabels?.[field] || field || merged.title}
        </div>
        <div className="text-6xl font-black tabular-nums" style={{ color }}>
          {formatNumber(value)}
        </div>
        {merged.unit && (
          <div className="text-xs uppercase tracking-widest text-white/40 mt-2">{merged.unit}</div>
        )}
        {payload.label && !field && (
          <div className="text-[10px] text-white/30 mt-3">{payload.label}</div>
        )}
      </div>
    );
  } else if (display === 'list') {
    const fields = merged.fields || Object.keys(payload).slice(0, 6);
    body = (
      <div className="flex-1 flex flex-col justify-center gap-2">
        {fields.map((f) => (
          <div
            key={f}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg"
            style={{ background: `${color}08` }}
          >
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              {merged.fieldLabels?.[f] || f.replace(/_/g, ' ')}
            </span>
            <span className="font-black text-base tabular-nums" style={{ color }}>
              {formatNumber(payload[f])}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (display === 'sparkline') {
    const series = payload.series || [];
    const accessorKey = merged.fields?.[0] || 'incidents';
    const latest = series.length ? series[series.length - 1][accessorKey] : null;
    body = (
      <div className="flex flex-col h-full">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40">
            {merged.fieldLabels?.[accessorKey] || accessorKey} · {series.length} samples
          </span>
          <span className="text-3xl font-black tabular-nums" style={{ color }}>
            {formatNumber(latest)}
          </span>
        </div>
        <div className="flex-1">
          <Sparkline series={series} accessor={(s) => s[accessorKey]} color={color} />
        </div>
      </div>
    );
  } else if (display === 'observations') {
    const list = payload.observations || payload.cameras || [];
    body = (
      <div className="flex-1 overflow-hidden flex flex-col gap-1.5">
        {list.slice(0, 8).map((o, i) => (
          <div
            key={`${o.title || o.name || i}-${i}`}
            className="flex items-start gap-2 px-2 py-1.5 rounded"
            style={{ background: `${color}10` }}
          >
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: o.kind === 'incident' ? '#ef4444' : '#f8af35', color: '#000' }}
            >
              {o.kind || (o.observation_count > 0 ? 'ALERT' : 'CLEAR')}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{o.title || o.name}</div>
              <div className="text-[10px] text-white/50 truncate">
                {o.camera_name || o.description}
                {o.distance_km != null ? ` · ${o.distance_km} km` : ''}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-center text-white/30 text-xs py-4">No observations</div>
        )}
      </div>
    );
  } else if (display === 'image') {
    const cam = payload.by_id?.[merged.cameraId]
      || (payload.cameras || []).find((c) => c.id === merged.cameraId);
    const url = cam?.image_name && merged.imageUrlBase
      ? merged.imageUrlBase.replace('{image_name}', cam.image_name)
      : null;
    body = (
      <div className="flex flex-col h-full">
        {url ? (
          <img
            src={`${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}`}
            alt={cam?.name || merged.cameraId}
            style={{ width: '100%', flex: 1, objectFit: 'cover', borderRadius: 6 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/30 text-xs">
            {cam ? `No URL for ${cam.image_name}` : `Camera ${merged.cameraId} not found`}
          </div>
        )}
        {cam && (
          <div className="mt-2">
            <div className="text-xs font-bold text-white truncate">{cam.name}</div>
            <div className="text-[10px] text-white/50">
              {cam.observation_count > 0
                ? `${cam.incidents_nearby?.length || 0} incidents · ${cam.roadworks_nearby?.length || 0} roadworks within 5km`
                : 'No nearby observations'}
            </div>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <pre className="text-[10px] text-white/60 overflow-auto flex-1">
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col p-4 relative overflow-hidden"
      style={{ background: merged.background || 'linear-gradient(145deg, #0a0e1a 0%, #1a1a2e 100%)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/50">
            {merged.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: error ? '#ef4444' : stale ? '#f8af35' : '#22c55e' }}
          />
          <span className="text-[9px] text-white/30 uppercase">
            {error ? 'ERR' : stale ? 'STALE' : 'LIVE'}
          </span>
        </div>
      </div>
      {body}
      <div className="absolute bottom-1 left-0 right-0 text-center">
        <span className="text-[8px] uppercase tracking-wider text-white/20">
          {endpoint}
          {computedAt ? ` · ${new Date(computedAt).toLocaleTimeString()}` : ''}
        </span>
      </div>
    </div>
  );
}
