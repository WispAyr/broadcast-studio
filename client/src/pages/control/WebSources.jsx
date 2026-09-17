import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';
import { confirmAsync } from '../../lib/dialog';

// ─── Web Sources ────────────────────────────────────────────────────────────
// Paste a page URL, see what is actually behind its player, save it as a named
// source. The extractor drives a headless Chrome; everything here is the
// operator's view of that.
//
// Colour law (DESIGN.md): nothing on this page is ever on air, so NOTHING here
// is persistently red. Green = working, amber = needs attention, blue = action.
// Red appears only on the delete control, which is momentary danger.
// Every status also carries a WORD, never colour alone — dim rooms, and
// colour-blind operators.

const POLL_MS = 10_000;

function relative(ts) {
  if (!ts) return 'never';
  const d = Math.max(0, Date.now() - new Date(ts).getTime());
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

// Derive a sane key from a URL so the operator does not have to invent one.
function keyFrom(url) {
  try {
    const u = new URL(url);
    const alias = u.searchParams.get('alias');
    const base = alias || u.pathname.split('/').filter(Boolean).pop() || u.hostname.split('.')[0];
    return base.replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'source';
  } catch {
    return '';
  }
}

const CHIP = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase';

function Chip({ tone = 'idle', children, title }) {
  const tones = {
    ok: 'bg-bs-ok/15 text-bs-ok border border-bs-ok/30',
    warn: 'bg-bs-warn/15 text-bs-warn border border-bs-warn/30',
    idle: 'bg-bs-subpanel text-gray-400 border border-bs-border-strong',
    info: 'bg-bs-accent/15 text-bs-accent border border-bs-accent/30',
  };
  return <span className={`${CHIP} ${tones[tone]}`} title={title}>{children}</span>;
}

function statusOf(src, health) {
  const h = health?.sources?.find((x) => x.key === src.key);
  if (!src.resolvedAt && src.status !== 'failed') return { tone: 'idle', label: 'Not resolved', detail: 'Never extracted' };
  if (src.status === 'failed') return { tone: 'warn', label: 'Failed', detail: src.lastError || 'Last attempt failed' };
  if (h && !h.registeredInRelay) return { tone: 'warn', label: 'Drifted', detail: 'Resolved, but the relay has no such stream — it probably restarted' };
  if (src.stale) return { tone: 'warn', label: 'Stale', detail: 'Past its refresh window — the manifest token may have expired' };
  return { tone: 'ok', label: 'Ready', detail: 'Resolved and registered with the relay' };
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

const INPUT = 'w-full bg-bs-bg border border-bs-border-strong rounded px-2.5 py-1.5 text-sm text-bs-text placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-bs-accent focus:border-bs-accent';
const BTN = 'px-3 py-1.5 rounded text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bs-bg disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_PRIMARY = `${BTN} bg-bs-accent hover:bg-bs-accent-strong text-white focus-visible:ring-bs-accent`;
const BTN_QUIET = `${BTN} bg-bs-subpanel hover:bg-bs-border-strong text-bs-text focus-visible:ring-bs-accent`;

export default function WebSources() {
  const toast = useToast();
  const [cfg, setCfg] = useState({ host: '', sources: [] });
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);

  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [consent, setConsent] = useState('off');
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState(null);
  const keyTouched = useRef(false);

  const load = useCallback(async () => {
    try {
      const [full, h] = await Promise.all([
        api.get('/web-sources/full'),
        api.get('/web-sources/health').catch(() => null),
      ]);
      setCfg(full);
      setHealth(h);
    } catch (e) {
      toast?.(`Could not load web sources: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Key follows the URL until the operator types their own.
  useEffect(() => {
    if (!keyTouched.current) setKey(keyFrom(url));
  }, [url]);

  const runProbe = async (targetUrl = url) => {
    if (!targetUrl) return;
    setProbing(true);
    setProbe(null);
    try {
      const r = await api.post('/web-sources/probe', { pageUrl: targetUrl, consent });
      setProbe(r);
      if (!r.ok) toast?.(`No stream found: ${r.reason}`, 'error');
    } catch (e) {
      toast?.(`Probe failed: ${e.message}`, 'error');
    } finally {
      setProbing(false);
    }
  };

  // The extractor hands back embedded players when it cannot find a stream on
  // the page itself. One click to retarget at the embed is the single most
  // useful thing on this page — it is what actually works for most sites.
  const useEmbed = (embedUrl) => {
    setUrl(embedUrl);
    keyTouched.current = false;
    setKey(keyFrom(embedUrl));
    runProbe(embedUrl);
  };

  const addSource = async () => {
    if (!url || !key) return;
    try {
      await api.post('/web-sources', { key, label: label || key, pageUrl: url, consent });
      toast?.(`Added ${key} — resolving…`, 'success');
      setBusyKey(key);
      const r = await api.post(`/web-sources/${encodeURIComponent(key)}/resolve`).catch((e) => ({ ok: false, message: e.message }));
      if (r.ok) toast?.(`${key} is ready (${r.delivery}, ${r.confidence} confidence)`, 'success');
      else toast?.(`${key} added but did not resolve: ${r.message || r.reason}`, 'error');
      setUrl(''); setKey(''); setLabel(''); setProbe(null); keyTouched.current = false;
      await load();
    } catch (e) {
      toast?.(`Could not add: ${e.message}`, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const resolveOne = async (k) => {
    setBusyKey(k);
    try {
      const r = await api.post(`/web-sources/${encodeURIComponent(k)}/resolve`);
      toast?.(`${k}: ${r.kind}${r.live ? ' live' : ''} via ${r.delivery} (${r.elapsedMs}ms)`, 'success');
    } catch (e) {
      // Loud failure, never silent — a source that did not resolve is a wall
      // that will not light.
      toast?.(`${k} failed: ${e.message}`, 'error');
    } finally {
      setBusyKey(null);
      load();
    }
  };

  const toggleAuto = async (src) => {
    try {
      await api.patch(`/web-sources/${encodeURIComponent(src.key)}`, { autoRefresh: src.autoRefresh === false });
      load();
    } catch (e) {
      toast?.(e.message, 'error');
    }
  };

  const removeOne = async (src) => {
    const ok = await confirmAsync({
      title: `Delete ${src.label || src.key}?`,
      message: 'This removes the source and deregisters its stream from the relay. Any layout using it will go dark.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/web-sources/${encodeURIComponent(src.key)}`);
      toast?.(`Deleted ${src.key}`, 'success');
      load();
    } catch (e) {
      toast?.(e.message, 'error');
    }
  };

  const refreshAll = async () => {
    try {
      const r = await api.post('/web-sources/refresh', {});
      toast?.(`Refresh pass: ${r.refreshed || 0} refreshed, ${r.checked || 0} checked`, 'success');
      load();
    } catch (e) {
      toast?.(e.message, 'error');
    }
  };

  const relayUp = health?.relay?.up;
  const extractor = health?.extractor;

  return (
    <div className="p-6 max-w-6xl mx-auto text-bs-text">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Web Sources</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Pull the real video stream out of a web page and register it with the relay, so any
            screen can play it as a normal source. Resolving never happens on the air path.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={relayUp ? 'ok' : 'warn'} title={relayUp ? `go2rtc ${health.relay.version} at ${cfg.host}` : health?.relay?.error || 'unknown'}>
            Relay {relayUp ? 'up' : 'down'}
          </Chip>
          <Chip tone={extractor?.mode === 'remote' ? (extractor.up ? 'ok' : 'warn') : 'info'}
            title={extractor?.mode === 'remote' ? `${extractor.url}${extractor.up ? '' : ` — ${extractor.error}`}` : 'Running in this process'}>
            {extractor?.mode === 'remote' ? `Shared extractor ${extractor.up ? 'up' : 'down'}` : 'Extractor in-process'}
          </Chip>
          {health?.queueDepth > 0 && <Chip tone="info">Busy ×{health.queueDepth}</Chip>}
          <button className={BTN_QUIET} onClick={refreshAll}>Run refresh pass</button>
        </div>
      </header>

      {/* ── Add / probe ─────────────────────────────────────────────────── */}
      <section className="bg-bs-panel border border-bs-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">New source</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_200px] gap-3 items-start">
          <Field label="Page URL" hint="The page the video is on. If it fails, the probe will name any embedded players it found.">
            <input
              className={INPUT}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && url) runProbe(); }}
              placeholder="https://…"
              spellCheck={false}
            />
          </Field>
          <Field label="Key" hint="Stream name, layouts reference this">
            <input
              className={INPUT}
              value={key}
              onChange={(e) => { keyTouched.current = true; setKey(e.target.value); }}
              placeholder="troon-marina"
              spellCheck={false}
            />
          </Field>
          <Field label="Label">
            <input className={INPUT} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={key || 'Troon Marina'} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="accent-bs-accent w-4 h-4"
              checked={consent === 'reject'}
              onChange={(e) => setConsent(e.target.checked ? 'reject' : 'off')}
            />
            Decline cookie banners
          </label>
          <span className="text-xs text-gray-500">Presses only the decline control, never “accept all”.</span>
          <div className="flex-1" />
          <button className={BTN_QUIET} onClick={() => runProbe()} disabled={!url || probing}>
            {probing ? 'Probing…' : 'Probe'}
          </button>
          <button className={BTN_PRIMARY} onClick={addSource} disabled={!url || !key || probing || busyKey === key}>
            {busyKey === key ? 'Resolving…' : 'Add & resolve'}
          </button>
        </div>

        {probing && (
          <p className="mt-3 text-sm text-gray-400" role="status">
            Driving a headless browser — autoplay, then clicks, then any embedded player. Up to a minute.
          </p>
        )}

        {probe && !probing && (
          <div className="mt-4 border-t border-bs-border pt-4">
            {probe.ok ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="ok">Stream found</Chip>
                  <Chip tone="idle">{probe.stream.kind}</Chip>
                  {probe.stream.live && <Chip tone="info">Live</Chip>}
                  <Chip tone={probe.confidence === 'high' ? 'ok' : 'warn'}>{probe.confidence} confidence</Chip>
                  <Chip tone={probe.replay === 'direct' ? 'ok' : 'warn'}
                    title={probe.replay === 'direct' ? 'Playable straight from the origin' : 'Needs Referer/Origin — will be relayed through this server'}>
                    {probe.replay === 'direct' ? 'Direct' : 'Relay needed'}
                  </Chip>
                </div>
                <p className="text-xs text-gray-500 break-all font-mono">{probe.stream.url}</p>
                {!probe.stream.live && (
                  <p className="text-sm text-bs-warn">
                    This is not a live stream — it looks like a recorded file. It will loop, not track real time.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="warn">{probe.reason}</Chip>
                  {probe.consentWall && <Chip tone="idle">Consent wall seen</Chip>}
                </div>
                <p className="text-sm text-gray-300">{probe.message}</p>

                {probe.reason === 'drm' && probe.drmEvidence?.length > 0 && (
                  <ul className="text-xs text-gray-500 font-mono space-y-0.5">
                    {probe.drmEvidence.map((e) => <li key={e} className="break-all">{e}</li>)}
                  </ul>
                )}

                {probe.embeds?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      Embedded players on this page — try one directly
                    </p>
                    <ul className="space-y-1.5">
                      {probe.embeds.map((e) => (
                        <li key={e.url} className="flex items-center gap-2">
                          <button className={BTN_QUIET} onClick={() => useEmbed(e.url)}>Probe this</button>
                          <span className="text-xs text-gray-500 font-mono break-all">{e.url}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Sources ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Sources <span className="text-gray-500 font-normal">({cfg.sources.length})</span>
        </h2>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : cfg.sources.length === 0 ? (
          <p className="text-sm text-gray-400">
            No web sources yet. Paste a page URL above and probe it.
          </p>
        ) : (
          <ul className="space-y-2">
            {cfg.sources.map((src) => {
              const st = statusOf(src, health);
              const h = health?.sources?.find((x) => x.key === src.key);
              const busy = busyKey === src.key;
              return (
                <li key={src.key} className="bg-bs-panel border border-bs-border rounded-lg p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{src.label || src.key}</span>
                        <code className="text-xs text-gray-400 bg-bs-subpanel px-1.5 py-0.5 rounded">{src.stream}</code>
                        <Chip tone={st.tone} title={st.detail}>{st.label}</Chip>
                        {src.delivery && (
                          <Chip tone="idle" title={src.delivery === 'relay'
                            ? 'Needs headers, so it is piped through this server'
                            : 'Pulled straight from the origin'}>
                            {src.delivery}
                          </Chip>
                        )}
                        {src.live === false && <Chip tone="warn" title="Recorded file, not a live stream">Not live</Chip>}
                        {h?.viewers > 0 && <Chip tone="info" title="Something is pulling this stream now">{h.viewers} watching</Chip>}
                        {src.autoRefresh === false && <Chip tone="idle" title="Excluded from the background refresher">Manual</Chip>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 break-all">{src.pageUrl}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Resolved {relative(src.resolvedAt)}
                        {h?.nextRefresh && <> · refresher: {h.nextRefresh.why}</>}
                      </p>
                      {src.lastError && <p className="text-xs text-bs-warn mt-1">{src.lastError}</p>}
                      {src.relayWarning && (
                        <p className="text-xs text-bs-warn mt-1" title="The stream is live but will not survive a relay restart">
                          Not persisted by the relay: {src.relayWarning}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button className={BTN_QUIET} onClick={() => resolveOne(src.key)} disabled={busy}>
                        {busy ? 'Resolving…' : 'Resolve'}
                      </button>
                      <button
                        className={BTN_QUIET}
                        onClick={() => toggleAuto(src)}
                        title={src.autoRefresh === false ? 'Include in the background refresher' : 'Exclude from the background refresher'}
                      >
                        {src.autoRefresh === false ? 'Auto off' : 'Auto on'}
                      </button>
                      <button
                        className={`${BTN} bg-transparent border border-bs-border-strong text-gray-400 hover:text-white hover:border-bs-danger hover:bg-bs-danger/10 focus-visible:ring-bs-danger`}
                        onClick={() => removeOne(src)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
