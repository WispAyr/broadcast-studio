/**
 * TemplateModule — renders a Broadcast Studio template composition live on screen.
 *
 * Config:
 *   templateId  — ID of the template to play (required)
 *   loop        — loop the animation when it reaches the end (default: true)
 *   autoplay    — start playing immediately (default: true)
 *   background  — CSS background behind the composition (default: transparent)
 *   scale       — override scale factor; defaults to fit-to-container
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ─── Easing (duplicated from TemplateEditor to keep this module self-contained) ───
function easingFn(type, t) {
  switch (type) {
    case 'easeIn': return t * t * t;
    case 'easeOut': return 1 - Math.pow(1 - t, 3);
    case 'easeInOut': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'spring': return 1 - Math.exp(-6 * t) * Math.cos(2 * Math.PI * 1.5 * t);
    case 'bounce': {
      if (t < 1/2.75) return 7.5625*t*t;
      if (t < 2/2.75) return 7.5625*(t-=1.5/2.75)*t+.75;
      if (t < 2.5/2.75) return 7.5625*(t-=2.25/2.75)*t+.9375;
      return 7.5625*(t-=2.625/2.75)*t+.984375;
    }
    default: return t;
  }
}

function interpolateValue(keyframes, frame, prop, easing) {
  const frames = Object.keys(keyframes).map(Number).sort((a, b) => a - b);
  const entries = frames.filter(f => keyframes[f]?.[prop] !== undefined);
  if (entries.length === 0) return undefined;
  if (frame <= entries[0]) return keyframes[entries[0]][prop];
  if (frame >= entries[entries.length - 1]) return keyframes[entries[entries.length - 1]][prop];
  let i = 0;
  while (i < entries.length - 1 && entries[i + 1] <= frame) i++;
  const f0 = entries[i], f1 = entries[i + 1];
  const v0 = keyframes[f0][prop], v1 = keyframes[f1][prop];
  if (typeof v0 !== 'number') return v0;
  const t = (frame - f0) / (f1 - f0);
  return v0 + (v1 - v0) * easingFn(easing?.[prop] || easing?.default || 'linear', t);
}

function getElementAtFrame(el, frame) {
  const props = {};
  for (const prop of ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'scale']) {
    const v = interpolateValue(el.keyframes, frame, prop, el.easing);
    if (v !== undefined) props[prop] = v;
  }
  return props;
}

// ─── Per-element particle renderer (proper component scope for useMemo) ───
function ParticlesRenderer({ el, style }) {
  const pc = el.particleConfig || {};
  const particles = useMemo(
    () => Array.from({ length: Math.min(pc.count || 50, 100) }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: (pc.size || 4) * (0.5 + Math.random()),
      opacity: 0.3 + Math.random() * 0.7,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pc.count, pc.size]
  );
  return (
    <div style={{ ...style, overflow: 'hidden' }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: pc.color || '#ff6600',
          opacity: p.opacity,
        }} />
      ))}
    </div>
  );
}

const ICON_MAP = {
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  play: 'M5 3l14 9-14 9V3z',
  zap: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
};

// ─── Single element renderer (no interactivity — screen display only) ───
function RenderEl({ el, frame, scale }) {
  const props = getElementAtFrame(el, frame);
  if (!el.visible) return null;
  const { x = 0, y = 0, width = 100, height = 100, rotation = 0, opacity = 1, scale: s = 1 } = props;
  const elStyle = el.style || {};

  const base = {
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: width * scale,
    height: height * scale,
    transform: `rotate(${rotation}deg) scale(${s})`,
    opacity,
    pointerEvents: 'none',
  };

  if (el.type === 'text') {
    const tc = el.textConfig || {};
    const vAlign = tc.vertAlign || 'center';
    return (
      <div style={{
        ...base,
        color: elStyle.fill || '#fff',
        fontFamily: tc.fontFamily || 'Inter',
        fontSize: (tc.fontSize || 64) * scale,
        fontWeight: tc.fontWeight || 700,
        textAlign: tc.align || 'center',
        letterSpacing: (tc.letterSpacing || 0) + (tc.kerning || 0),
        lineHeight: tc.lineHeight || 1.2,
        wordSpacing: tc.wordSpacing || 0,
        textTransform: tc.textTransform || 'none',
        display: 'flex',
        alignItems: vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center',
        justifyContent: tc.align === 'left' ? 'flex-start' : tc.align === 'right' ? 'flex-end' : 'center',
        textShadow: elStyle.shadow || 'none',
        filter: elStyle.blur ? `blur(${elStyle.blur}px)` : 'none',
        overflow: 'hidden',
        whiteSpace: tc.whiteSpace || 'nowrap',
        padding: tc.padding ? tc.padding * scale : 0,
      }}>
        {tc.content || ''}
      </div>
    );
  }

  if (el.type === 'shape') {
    const sc = el.shapeConfig || {};
    if (sc.shape === 'circle') return <div style={{ ...base, borderRadius: '50%', background: elStyle.fill || '#3b82f6' }} />;
    if (sc.shape === 'triangle') return (
      <div style={{ ...base, overflow: 'visible' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,0 100,100 0,100" fill={elStyle.fill || '#3b82f6'} />
        </svg>
      </div>
    );
    return <div style={{ ...base, background: elStyle.fill || '#3b82f6', borderRadius: elStyle.borderRadius || 0 }} />;
  }

  if (el.type === 'image') {
    const ic = el.imageConfig || {};
    return (
      <div style={{ ...base, overflow: 'hidden', borderRadius: elStyle.borderRadius || 0 }}>
        {ic.src && <img src={ic.src} style={{ width: '100%', height: '100%', objectFit: ic.fit || 'contain' }} alt="" />}
      </div>
    );
  }

  if (el.type === 'video') {
    const vc = el.videoConfig || {};
    return (
      <div style={{ ...base, overflow: 'hidden', borderRadius: elStyle.borderRadius || 0, background: '#000' }}>
        {vc.src && (
          <video src={vc.src} style={{ width: '100%', height: '100%', objectFit: vc.fit || 'cover' }}
            autoPlay={vc.autoplay !== false} loop={vc.loop !== false} muted playsInline />
        )}
      </div>
    );
  }

  if (el.type === 'icon') {
    const path = ICON_MAP[el.iconConfig?.icon || 'star'] || ICON_MAP.star;
    return (
      <div style={{ ...base }}>
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={elStyle.fill || '#fbbf24'} strokeWidth="2">
          <path d={path} />
        </svg>
      </div>
    );
  }

  if (el.type === 'gradient') {
    const gc = el.gradientConfig || { stops: [{ color: '#1a1a2e', pos: 0 }, { color: '#0f3460', pos: 100 }], angle: 135 };
    const grad = `linear-gradient(${gc.angle || 135}deg, ${gc.stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
    return <div style={{ ...base, background: grad, borderRadius: elStyle.borderRadius || 0 }} />;
  }

  if (el.type === 'particles') {
    return <ParticlesRenderer el={el} style={base} />;
  }

  return null;
}

// ─── Main module ───
export default function TemplateModule({ config = {} }) {
  const {
    templateId = '',
    loop = true,
    autoplay = true,
    background = 'transparent',
  } = config;

  const [template, setTemplate] = useState(null);
  const [elements, setElements] = useState([]);
  const [frame, setFrame] = useState(0);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedRef = useRef(!autoplay);

  const CANVAS_W = 1920;
  const CANVAS_H = 1080;

  // Fetch template from server
  useEffect(() => {
    if (!templateId) return;
    const token = localStorage.getItem('broadcast_token');
    fetch(`/api/templates/${templateId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(t => {
        setTemplate(t);
        const raw = typeof t.elements === 'string' ? JSON.parse(t.elements) : (t.elements || []);
        setElements(raw);
        setError(null);
      })
      .catch(() => setError('Template not found'));
  }, [templateId]);

  // Compute scale to fit container
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / CANVAS_W, height / CANVAS_H));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Animation loop
  const totalFrames = useMemo(
    () => Math.max(1, Math.round((template?.duration || 5) * (template?.fps || 30))),
    [template?.duration, template?.fps]
  );

  useEffect(() => {
    if (!template || !autoplay) return;
    const fps = template.fps || 30;
    const msPerFrame = 1000 / fps;
    let lastTime = performance.now();
    let currentFrame = 0;

    function tick(now) {
      if (now - lastTime >= msPerFrame) {
        lastTime = now;
        currentFrame += 1;
        if (currentFrame >= totalFrames) {
          if (loop) {
            currentFrame = 0;
          } else {
            setFrame(totalFrames - 1);
            return; // stop
          }
        }
        setFrame(currentFrame);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [template, totalFrames, loop, autoplay]);

  // ── Empty / error states ──────────────────────────────────────────────────
  if (!templateId) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background }}>
        <div className="text-center text-gray-500">
          <span className="text-4xl block mb-2">🎨</span>
          <span className="text-sm">Template Module</span>
          <span className="block text-xs mt-1 text-gray-600">Set a Template ID in config</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background }}>
        <div className="text-center text-red-400">
          <span className="text-3xl block mb-2">⚠️</span>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background }}>
        <div className="animate-pulse text-gray-600 text-sm">Loading template…</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden flex items-center justify-center" style={{ background }}>
      {/* Fixed 1920×1080 canvas, scaled to fit */}
      <div style={{
        position: 'relative',
        width: CANVAS_W * scale,
        height: CANVAS_H * scale,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {elements.map(el => (
          <RenderEl key={el.id} el={el} frame={frame} scale={scale} />
        ))}
      </div>
    </div>
  );
}

// ─── Config panel for the layout editor ──────────────────────────────────────
export function TemplateModuleConfig({ config = {}, onChange }) {
  const [templates, setTemplates] = useState([]);
  const update = (key, val) => onChange({ ...config, [key]: val });

  useEffect(() => {
    const token = localStorage.getItem('broadcast_token');
    fetch('/api/templates', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(list => setTemplates(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Template</label>
        <select
          value={config.templateId || ''}
          onChange={e => update('templateId', e.target.value)}
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs"
        >
          <option value="">— Select a template —</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Background</label>
        <input
          type="text"
          value={config.background || 'transparent'}
          onChange={e => update('background', e.target.value)}
          placeholder="transparent or #000"
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs font-mono"
        />
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={config.loop !== false} onChange={e => update('loop', e.target.checked)} className="accent-blue-500" />
          Loop
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={config.autoplay !== false} onChange={e => update('autoplay', e.target.checked)} className="accent-blue-500" />
          Autoplay
        </label>
      </div>
      {config.templateId && (
        <p className="text-xs text-gray-600">
          Plays the template composition live on screen at full resolution,
          scaled to fit the module area.
        </p>
      )}
    </div>
  );
}
