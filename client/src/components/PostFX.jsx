import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * PostFX — a broadcast finishing-pass layer that composites over ANY content
 * (shaders, video, titles). This is what turns a raw backdrop into something
 * that reads "broadcast" rather than "web gradient": film grain, vignette,
 * chromatic aberration, bloom, light-leak drift, scanlines, letterbox bars and
 * a slow camera breathe.
 *
 * DOM/SVG based on purpose — it rasterises whatever is underneath, so it needs
 * no WebGL context and captures in the offline renderer without the gl:angle
 * flag the GLSL layer requires.
 *
 * Determinism: like ShaderView/ShaderLayer, there are two entry points.
 *   - PostFXView({ timeMs })  — pure, drives all motion from a caller clock.
 *     Used by the Studio preview (its rAF clock) and anywhere outside Remotion.
 *   - PostFX({ ... })         — reads the Remotion frame and feeds PostFXView,
 *     so a finish renders identically live and in export.
 */

export const POSTFX_PRESETS = {
  none:      { grain: 0, vignette: 0, aberration: 0, bloom: 0, leak: 0, scanlines: 0, letterbox: 0, breathe: 0 },
  clean:     { grain: 0.03, vignette: 0.22, aberration: 0, bloom: 0.15, leak: 0, scanlines: 0, letterbox: 0, breathe: 0.15 },
  broadcast: { grain: 0.06, vignette: 0.30, aberration: 0.18, bloom: 0.35, leak: 0.15, scanlines: 0, letterbox: 0, breathe: 0.35 },
  film:      { grain: 0.16, vignette: 0.38, aberration: 0.28, bloom: 0.22, leak: 0.28, scanlines: 0, letterbox: 0.11, breathe: 0.45 },
  dreamy:    { grain: 0.05, vignette: 0.26, aberration: 0.12, bloom: 0.60, leak: 0.42, scanlines: 0, letterbox: 0, breathe: 0.7 },
  retro:     { grain: 0.20, vignette: 0.46, aberration: 0.50, bloom: 0.24, leak: 0.10, scanlines: 0.55, letterbox: 0, breathe: 0 },
};

export const POSTFX_KNOBS = [
  { key: 'grain', label: 'Grain' },
  { key: 'vignette', label: 'Vignette' },
  { key: 'aberration', label: 'Aberration' },
  { key: 'bloom', label: 'Bloom' },
  { key: 'leak', label: 'Light Leak' },
  { key: 'scanlines', label: 'Scanlines' },
  { key: 'letterbox', label: 'Letterbox' },
  { key: 'breathe', label: 'Camera Breathe' },
];

export const POSTFX_DEFAULT = { ...POSTFX_PRESETS.broadcast, leakColor: '#ffd9a0' };

// Animated film grain as a tiled feTurbulence data-URI — cheap and offline-safe.
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E\")";

export function PostFXView({
  timeMs = 0,
  grain = 0,
  vignette = 0,
  aberration = 0,
  bloom = 0,
  leak = 0,
  leakColor = '#ffd9a0',
  scanlines = 0,
  letterbox = 0,
  breathe = 0,
  style,
  children,
}) {
  const rawId = React.useId();
  const uid = 'pfx' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const t = timeMs / 1000;

  // Slow, seamless camera breathe + drift (sinusoidal so it loops cleanly).
  const bScale = 1 + breathe * 0.03 * (0.5 + 0.5 * Math.sin(t * 0.35));
  const bx = breathe * 12 * Math.sin(t * 0.13);
  const by = breathe * 8 * Math.cos(t * 0.10);

  // Light-leak drifts diagonally across the frame.
  const leakX = 50 + 35 * Math.sin(t * 0.09);
  const leakY = 50 + 30 * Math.cos(t * 0.07);

  // Animated grain: jitter the tile so noise is different every frame.
  const gx = Math.round((Math.sin(t * 53.3) * 0.5 + 0.5) * 140);
  const gy = Math.round((Math.cos(t * 47.1) * 0.5 + 0.5) * 140);
  const gFlick = 1 + 0.25 * Math.sin(t * 20.0);

  const ab = aberration * 4; // px offset per channel
  const bl = bloom * 9;      // blur stddev

  const filters = [];
  if (aberration > 0) filters.push(`url(#${uid}-ab)`);
  if (bloom > 0) filters.push(`url(#${uid}-bloom)`);
  const filterCss = filters.length ? filters.join(' ') : 'none';

  const overlay = { position: 'absolute', inset: 0, pointerEvents: 'none' };
  const barH = `${Math.max(0, Math.min(0.25, letterbox)) * 100}%`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000', ...style }}>
      {/* SVG filter defs (zero-size) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={`${uid}-ab`} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={ab} dy="0" result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feOffset in="b" dx={-ab} dy="0" result="bo" />
            <feBlend in="ro" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="bo" mode="screen" />
          </filter>
          <filter id={`${uid}-bloom`} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
            <feComponentTransfer in="SourceGraphic" result="bright">
              <feFuncR type="linear" slope="2.2" intercept="-0.9" />
              <feFuncG type="linear" slope="2.2" intercept="-0.9" />
              <feFuncB type="linear" slope="2.2" intercept="-0.9" />
            </feComponentTransfer>
            <feGaussianBlur in="bright" stdDeviation={bl} result="blur" />
            <feBlend in="SourceGraphic" in2="blur" mode="screen" />
          </filter>
        </defs>
      </svg>

      {/* Content — aberration + bloom filters + camera breathe */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: filterCss,
          transform: `scale(${bScale}) translate(${bx}px, ${by}px)`,
          transformOrigin: 'center',
          willChange: 'transform, filter',
        }}
      >
        {children}
      </div>

      {/* Bloom done in-filter; overlays below are additive/multiplicative passes */}
      {leak > 0 && (
        <div
          style={{
            ...overlay,
            background: `radial-gradient(ellipse 55% 45% at ${leakX}% ${leakY}%, ${leakColor} 0%, transparent 60%)`,
            mixBlendMode: 'screen',
            opacity: leak * 0.7,
            filter: 'blur(18px)',
          }}
        />
      )}

      {scanlines > 0 && (
        <div
          style={{
            ...overlay,
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 3px)',
            mixBlendMode: 'multiply',
            opacity: scanlines,
          }}
        />
      )}

      {grain > 0 && (
        <div
          style={{
            ...overlay,
            backgroundImage: GRAIN_URI,
            backgroundRepeat: 'repeat',
            backgroundPosition: `${gx}px ${gy}px`,
            mixBlendMode: 'overlay',
            opacity: Math.min(1, grain * gFlick),
          }}
        />
      )}

      {vignette > 0 && (
        <div
          style={{
            ...overlay,
            background: `radial-gradient(ellipse 75% 75% at 50% 50%, transparent 45%, rgba(0,0,0,${Math.min(1, vignette)}) 100%)`,
          }}
        />
      )}

      {letterbox > 0 && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: barH, background: '#000', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barH, background: '#000', pointerEvents: 'none' }} />
        </>
      )}
    </div>
  );
}

/** Remotion-context wrapper: drives PostFXView from the current frame. */
export function PostFX({ speed = 1, ...props }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000 * speed;
  return <PostFXView timeMs={timeMs} {...props} />;
}

/** Resolve a finishing config (preset name or object) to a full params object. */
export function resolveFinishing(finishing) {
  if (!finishing) return null;
  if (typeof finishing === 'string') return { ...POSTFX_PRESETS[finishing] || POSTFX_PRESETS.none, leakColor: '#ffd9a0' };
  return { ...POSTFX_PRESETS.none, leakColor: '#ffd9a0', ...finishing };
}

export default PostFX;
