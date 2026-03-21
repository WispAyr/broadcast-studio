import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Extract Canva design ID from various URL formats:
 * - https://www.canva.com/design/DAGiXXXXXX/view
 * - https://www.canva.com/design/DAGiXXXXXX/YYYY/view
 * - https://www.canva.com/design/DAGiXXXXXX/view?embed
 */
function extractDesignId(url) {
  if (!url) return null;
  try {
    const match = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Build the proper Canva embed URL.
 * Canva embeds work via their SDK script which creates the iframe,
 * OR via direct embed URLs in the format:
 * https://www.canva.com/design/{id}/view?embed
 */
function buildEmbedUrl(url) {
  if (!url) return '';
  
  try {
    // Match /design/ID/TOKEN/watch or /design/ID/TOKEN/view patterns
    const match = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(watch|view)/);
    if (match) {
      // Preserve the sharing token — without it Canva returns 403
      return `https://www.canva.com/design/${match[1]}/${match[2]}/view?embed`;
    }
    
    // Match /design/ID/view (no token)
    const shortMatch = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)\/view/);
    if (shortMatch) {
      return `https://www.canva.com/design/${shortMatch[1]}/view?embed`;
    }
  } catch {}
  
  // If it's already a proper embed URL or external URL, use as-is
  return url;
}

const CANVA_PURPLE = '#7d2ae8';

function Placeholder() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a1a', gap: 16,
    }}>
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="26" stroke={CANVA_PURPLE} strokeWidth="2" opacity="0.4" />
        <circle cx="28" cy="28" r="18" stroke={CANVA_PURPLE} strokeWidth="1.5" opacity="0.2" />
        <text x="28" y="34" textAnchor="middle" fill={CANVA_PURPLE} fontSize="18" fontWeight="bold" fontFamily="sans-serif">C</text>
      </svg>
      <span style={{ color: '#888', fontSize: 14, fontWeight: 500 }}>Canva Design</span>
      <span style={{ color: '#555', fontSize: 12, lineHeight: 1.5, textAlign: 'center', maxWidth: '80%' }}>
        In Canva: Share → More → Embed → Copy embed link
      </span>
    </div>
  );
}

function Shimmer() {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2,
      background: 'linear-gradient(90deg, #0a0a1a 25%, #1a1a3e 50%, #0a0a1a 75%)',
      backgroundSize: '200% 100%',
      animation: 'canvaShimmer 1.5s ease-in-out infinite',
    }}>
      <style>{`@keyframes canvaShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

function ErrorState({ url, error }) {
  const designId = extractDesignId(url);
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a1a', gap: 10, padding: 24, textAlign: 'center',
    }}>
      <span style={{ fontSize: 36 }}>⚠️</span>
      <span style={{ color: '#f87171', fontSize: 14, fontWeight: 600 }}>Can't load Canva design</span>
      <div style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.6, maxWidth: '85%' }}>
        <p style={{ marginBottom: 8 }}>Make sure the design is shared for embedding:</p>
        <div style={{ textAlign: 'left', color: '#6b7280' }}>
          <div>1. Open your design in Canva</div>
          <div>2. Click <strong style={{ color: '#9ca3af' }}>Share</strong> → <strong style={{ color: '#9ca3af' }}>More</strong></div>
          <div>3. Click <strong style={{ color: '#9ca3af' }}>Embed</strong></div>
          <div>4. Copy the <strong style={{ color: '#9ca3af' }}>embed link</strong> (not the design link)</div>
        </div>
      </div>
      {designId && (
        <span style={{ color: '#444', fontSize: 10, marginTop: 4 }}>Design ID: {designId}</span>
      )}
    </div>
  );
}

export default function CanvaModule({ config = {} }) {
  const {
    embedUrl = '',
    mode = 'embed',
    fit = 'cover',
    background = '#000000',
    refreshInterval = 0,
    loopDuration = 0,
    interactable = false,
  } = config;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Loop: which iframe is on top (0 = A on top, 1 = B on top)
  const [activeFrame, setActiveFrame] = useState(0);
  const [frameKeyA, setFrameKeyA] = useState(0);
  const [frameKeyB, setFrameKeyB] = useState(1);
  const [frameReadyA, setFrameReadyA] = useState(false);
  const [frameReadyB, setFrameReadyB] = useState(false);
  const containerRef = useRef(null);
  const embedScriptLoaded = useRef(false);

  // Auto-refresh (for non-animated content updates)
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0 || !embedUrl) return;
    const id = setInterval(() => setRefreshKey(k => k + 1), refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, embedUrl]);

  // Seamless loop: two iframes take turns
  // At t=0: A plays, B is hidden
  // At t=loopDuration: crossfade to B, then reload A behind B
  // At t=loopDuration*2: crossfade to A, then reload B behind A
  useEffect(() => {
    if (!loopDuration || loopDuration <= 0 || !embedUrl) return;
    const ms = loopDuration * 1000;

    const id = setInterval(() => {
      setActiveFrame(prev => {
        const next = prev === 0 ? 1 : 0;
        // After crossfade completes, reload the now-hidden iframe
        setTimeout(() => {
          if (next === 1) {
            // A is now hidden, reload it
            setFrameKeyA(k => k + 2);
            setFrameReadyA(false);
          } else {
            // B is now hidden, reload it
            setFrameKeyB(k => k + 2);
            setFrameReadyB(false);
          }
        }, 1000); // wait for crossfade to finish before reloading
        return next;
      });
    }, ms);
    return () => clearInterval(id);
  }, [loopDuration, embedUrl]);

  // Reset states on URL change
  useEffect(() => {
    if (embedUrl) {
      setLoading(true);
      setError(false);
    }
  }, [embedUrl, refreshKey, mode]);

  // Load Canva embed SDK script
  useEffect(() => {
    if (embedScriptLoaded.current) return;
    if (document.querySelector('script[src*="sdk.canva.com/v1/embed"]')) {
      embedScriptLoaded.current = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.canva.com/v1/embed.js';
    script.async = true;
    script.onload = () => { embedScriptLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  const handleLoad = useCallback(() => setLoading(false), []);
  const handleError = useCallback(() => { setLoading(false); setError(true); }, []);

  if (!embedUrl) return <Placeholder />;

  const containerStyle = {
    width: '100%', height: '100%',
    background, position: 'relative', overflow: 'hidden',
  };

  // Image mode — direct image URL
  if (mode === 'image') {
    return (
      <div style={containerStyle}>
        {loading && <Shimmer />}
        <img
          src={embedUrl}
          alt="Canva design"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%', height: '100%',
            objectFit: fit === 'stretch' ? 'fill' : fit,
            display: loading ? 'none' : 'block',
          }}
        />
        {error && <ErrorState url={embedUrl} />}
      </div>
    );
  }

  // Video mode — direct video URL
  if (mode === 'video') {
    return (
      <div style={containerStyle}>
        {loading && <Shimmer />}
        <video
          src={embedUrl}
          autoPlay muted loop playsInline
          onLoadedData={handleLoad}
          onError={handleError}
          style={{
            width: '100%', height: '100%',
            objectFit: fit === 'stretch' ? 'fill' : fit,
            display: loading ? 'none' : 'block',
          }}
        />
        {error && <ErrorState url={embedUrl} />}
      </div>
    );
  }

  // Embed mode — use Canva's embed format
  // Try the SDK-style embed div first, fall back to iframe
  const designId = extractDesignId(embedUrl);
  const finalUrl = buildEmbedUrl(embedUrl);

  // Embed with seamless loop — two stacked iframes that alternate
  if (loopDuration > 0) {
    const bustA = finalUrl + (finalUrl.includes('?') ? '&' : '?') + '_r=' + frameKeyA;
    const bustB = finalUrl + (finalUrl.includes('?') ? '&' : '?') + '_r=' + frameKeyB;
    return (
      <div style={containerStyle} ref={containerRef}>
        {loading && !frameReadyA && !frameReadyB && <Shimmer />}
        {/* Iframe A */}
        <iframe
          key={'a-' + frameKeyA}
          src={bustA}
          title="Canva Design A"
          onLoad={() => { setFrameReadyA(true); setLoading(false); }}
          onError={handleError}
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            border: 'none',
            pointerEvents: interactable ? 'auto' : 'none',
            zIndex: activeFrame === 0 ? 2 : 1,
            opacity: activeFrame === 0 ? 1 : 0,
            transition: 'opacity 0.8s ease-in-out',
          }}
        />
        {/* Iframe B */}
        <iframe
          key={'b-' + frameKeyB}
          src={bustB}
          title="Canva Design B"
          onLoad={() => { setFrameReadyB(true); setLoading(false); }}
          onError={handleError}
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            border: 'none',
            pointerEvents: interactable ? 'auto' : 'none',
            zIndex: activeFrame === 1 ? 2 : 1,
            opacity: activeFrame === 1 ? 1 : 0,
            transition: 'opacity 0.8s ease-in-out',
          }}
        />
        {error && <ErrorState url={embedUrl} />}
      </div>
    );
  }

  // Standard embed (no loop)
  return (
    <div style={containerStyle} ref={containerRef}>
      {loading && <Shimmer />}
      <iframe
        key={refreshKey}
        src={finalUrl}
        title="Canva Design"
        onLoad={handleLoad}
        onError={handleError}
        allow="autoplay; fullscreen"
        allowFullScreen
        style={{
          width: '100%', height: '100%',
          border: 'none',
          pointerEvents: interactable ? 'auto' : 'none',
        }}
      />
      {error && <ErrorState url={embedUrl} />}
    </div>
  );
}
