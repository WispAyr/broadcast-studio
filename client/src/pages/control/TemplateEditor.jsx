import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import MediaPicker from '../../components/MediaPicker';

// ─── Constants ───
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const GRID_SIZE = 20;
const EASING_OPTIONS = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring', 'bounce'];

const FONT_LIST = [
  { name: '1994 Stencil', family: "'Black Ops One'", google: 'Black+Ops+One' },
  { name: 'Inter', family: 'Inter', google: 'Inter' },
  { name: 'Roboto', family: 'Roboto', google: 'Roboto' },
  { name: 'Montserrat', family: 'Montserrat', google: 'Montserrat' },
  { name: 'Oswald', family: 'Oswald', google: 'Oswald' },
  { name: 'Poppins', family: 'Poppins', google: 'Poppins' },
  { name: 'Bebas Neue', family: "'Bebas Neue'", google: 'Bebas+Neue' },
  { name: 'Raleway', family: 'Raleway', google: 'Raleway' },
  { name: 'Playfair Display', family: "'Playfair Display'", google: 'Playfair+Display' },
  { name: 'Anton', family: 'Anton', google: 'Anton' },
  { name: 'Bangers', family: 'Bangers', google: 'Bangers' },
  { name: 'Russo One', family: "'Russo One'", google: 'Russo+One' },
  { name: 'Orbitron', family: 'Orbitron', google: 'Orbitron' },
  { name: 'Rajdhani', family: 'Rajdhani', google: 'Rajdhani' },
  { name: 'Teko', family: 'Teko', google: 'Teko' },
  { name: 'Permanent Marker', family: "'Permanent Marker'", google: 'Permanent+Marker' },
  { name: 'Press Start 2P', family: "'Press Start 2P'", google: 'Press+Start+2P' },
  { name: 'Audiowide', family: 'Audiowide', google: 'Audiowide' },
  { name: 'Righteous', family: 'Righteous', google: 'Righteous' },
];

const TEXT_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'fadeOut', label: 'Fade Out' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'slideLeft', label: 'Slide Left' },
  { value: 'slideRight', label: 'Slide Right' },
  { value: 'scaleIn', label: 'Scale In' },
  { value: 'scaleOut', label: 'Scale Out' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'charReveal', label: 'Char Reveal' },
  { value: 'wordReveal', label: 'Word Reveal' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'blur', label: 'Blur In' },
  { value: 'splitLines', label: 'Split Lines' },
];

const VERT_ALIGN_OPTIONS = ['top', 'center', 'bottom'];
const TEXT_TRANSFORM_OPTIONS = ['none', 'uppercase', 'lowercase', 'capitalize'];
const SHAPE_TYPES = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'line'];
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

// ─── Easing functions ───
function easingFn(type, t) {
  switch (type) {
    case 'easeIn': return t * t * t;
    case 'easeOut': return 1 - Math.pow(1 - t, 3);
    case 'easeInOut': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'spring': {
      const w = 2 * Math.PI * 1.5;
      return 1 - Math.exp(-6 * t) * Math.cos(w * t);
    }
    case 'bounce': {
      if (t < 1/2.75) return 7.5625*t*t;
      if (t < 2/2.75) return 7.5625*(t-=1.5/2.75)*t+.75;
      if (t < 2.5/2.75) return 7.5625*(t-=2.25/2.75)*t+.9375;
      return 7.5625*(t-=2.625/2.75)*t+.984375;
    }
    default: return t; // linear
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
  const easingType = easing?.[prop] || easing?.default || 'linear';
  return v0 + (v1 - v0) * easingFn(easingType, t);
}

function getElementAtFrame(el, frame) {
  const props = {};
  for (const prop of ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'scale']) {
    const v = interpolateValue(el.keyframes, frame, prop, el.easing);
    if (v !== undefined) props[prop] = v;
  }
  return { ...props };
}

function generateId() {
  return 'el_' + Math.random().toString(36).substr(2, 9);
}

function defaultElement(type) {
  const base = {
    id: generateId(),
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    locked: false,
    visible: true,
    keyframes: { '0': { x: 100, y: 100, width: 400, height: 200, rotation: 0, opacity: 1, scale: 1 } },
    easing: { default: 'easeInOut' },
    style: { fill: '#ffffff', stroke: '', strokeWidth: 0, borderRadius: 0, shadow: '', blur: 0 },
    textConfig: { content: 'Hello World', fontFamily: 'Inter', fontSize: 64, fontWeight: 700, align: 'center', vertAlign: 'center', letterSpacing: 0, lineHeight: 1.2, kerning: 0, textTransform: 'none', wordSpacing: 0, animIn: 'none', animOut: 'none', animDuration: 0.5, animDelay: 0, animStagger: 0.05, padding: 0, whiteSpace: 'nowrap' },
    shapeConfig: { shape: 'rectangle' },
    imageConfig: { src: '', fit: 'contain' },
    videoConfig: { src: '', fit: 'cover', loop: true, autoplay: true, muted: true },
    particleConfig: { count: 50, color: '#ff6600', speed: 2, size: 4, spread: 360 },
    iconConfig: { icon: 'star' },
    gradientConfig: { stops: [{ color: '#1a1a2e', pos: 0 }, { color: '#16213e', pos: 50 }, { color: '#0f3460', pos: 100 }], angle: 135 },
  };
  if (type === 'video') {    base.keyframes['0'] = { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, rotation: 0, opacity: 1, scale: 1 };    base.name = 'VJ Loop';  }
  if (type === 'gradient') {
    base.keyframes['0'] = { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, rotation: 0, opacity: 1, scale: 1 };
    base.name = 'Gradient BG';
  }
  if (type === 'shape') {
    base.style.fill = '#3b82f6';
    base.keyframes['0'].width = 200;
    base.keyframes['0'].height = 200;
  }
  if (type === 'icon') {
    base.keyframes['0'].width = 80;
    base.keyframes['0'].height = 80;
    base.style.fill = '#fbbf24';
  }
  if (type === 'particles') {
    base.keyframes['0'].width = 400;
    base.keyframes['0'].height = 400;
    base.name = 'Particles';
  }
  return base;
}

// ─── Canvas Element Renderer ───
// Video element with proper cleanup to prevent ghost framesfunction VideoElement({ src, fit, autoplay, loop, muted, style: outerStyle }) {  const videoRef = useRef(null);  useEffect(() => {    return () => {      if (videoRef.current) {        videoRef.current.pause();        videoRef.current.removeAttribute("src");        videoRef.current.load();      }    };  }, []);  useEffect(() => {    if (videoRef.current && src) {      videoRef.current.src = src;      if (autoplay !== false) videoRef.current.play().catch(() => {});    }  }, [src]);  return <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: fit || "cover" }}    autoPlay={autoplay !== false} loop={loop !== false} muted={muted !== false} playsInline />;}
function RenderElement({ el, frame, selected, onSelect, onDragStart, scale }) {
  const props = getElementAtFrame(el, frame);
  if (!el.visible) return null;
  const { x = 0, y = 0, width = 100, height = 100, rotation = 0, opacity = 1, scale: s = 1 } = props;

  const style = {
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: width * scale,
    height: height * scale,
    transform: `rotate(${rotation}deg) scale(${s})`,
    opacity,
    cursor: el.locked ? 'default' : 'move',
    outline: selected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
    pointerEvents: el.locked ? 'none' : 'auto',
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    onSelect(el.id);
    if (!el.locked) onDragStart(e, el.id);
  };

  let content = null;
  const elStyle = el.style || {};

  if (el.type === 'text') {
    const tc = el.textConfig || {};
    const fontDef = FONT_LIST.find(f => f.name === tc.fontFamily || f.family === tc.fontFamily);
    const fontFam = fontDef ? fontDef.family : (tc.fontFamily || 'Inter');
    const vAlign = tc.vertAlign || 'center';
    content = (
      <div style={{
        ...style,
        color: elStyle.fill || '#fff',
        fontFamily: fontFam,
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
      }} onMouseDown={handleMouseDown}>
        {tc.content || 'Text'}
      </div>
    );
  } else if (el.type === 'shape') {
    const sc = el.shapeConfig || {};
    if (sc.shape === 'circle') {
      content = (
        <div style={{ ...style, borderRadius: '50%', background: elStyle.fill || '#3b82f6', border: elStyle.stroke ? `${elStyle.strokeWidth || 2}px solid ${elStyle.stroke}` : 'none' }} onMouseDown={handleMouseDown} />
      );
    } else if (sc.shape === 'triangle') {
      content = (
        <div style={{ ...style, background: 'transparent', overflow: 'visible' }} onMouseDown={handleMouseDown}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="50,0 100,100 0,100" fill={elStyle.fill || '#3b82f6'} stroke={elStyle.stroke || 'none'} strokeWidth={elStyle.strokeWidth || 0} />
          </svg>
        </div>
      );
    } else if (sc.shape === 'star') {
      content = (
        <div style={{ ...style, overflow: 'visible' }} onMouseDown={handleMouseDown}>
          <svg width="100%" height="100%" viewBox="0 0 24 24">
            <path d={ICON_MAP.star} fill={elStyle.fill || '#3b82f6'} stroke={elStyle.stroke || 'none'} strokeWidth={elStyle.strokeWidth || 0} />
          </svg>
        </div>
      );
    } else {
      content = (
        <div style={{ ...style, background: elStyle.fill || '#3b82f6', borderRadius: elStyle.borderRadius || 0, border: elStyle.stroke ? `${elStyle.strokeWidth || 2}px solid ${elStyle.stroke}` : 'none' }} onMouseDown={handleMouseDown} />
      );
    }
  } else if (el.type === 'image') {
    const ic = el.imageConfig || {};
    content = (
      <div style={{ ...style, overflow: 'hidden', borderRadius: elStyle.borderRadius || 0, background: '#111' }} onMouseDown={handleMouseDown}>
        {ic.src ? <img src={ic.src} style={{ width: '100%', height: '100%', objectFit: ic.fit || 'contain' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 * scale }}>No image</div>}
      </div>
    );
  } else if (el.type === 'video') {    const vc = el.videoConfig || {};    content = (      <div style={{ ...style, overflow: 'hidden', borderRadius: elStyle.borderRadius || 0, background: '#000' }} onMouseDown={handleMouseDown}>        {vc.src ? (          <video src={vc.src} style={{ width: '100%', height: '100%', objectFit: vc.fit || 'cover' }}            autoPlay={vc.autoplay !== false} loop={vc.loop !== false} muted playsInline />        ) : (          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 * scale, flexDirection: 'column', gap: 4 }}>            <span style={{ fontSize: 24 * scale }}>🎬</span>            <span>No video</span>          </div>        )}      </div>    );
  } else if (el.type === 'icon') {
    const iconName = el.iconConfig?.icon || 'star';
    const path = ICON_MAP[iconName] || ICON_MAP.star;
    content = (
      <div style={{ ...style, overflow: 'visible' }} onMouseDown={handleMouseDown}>
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={elStyle.fill || '#fbbf24'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={path} />
        </svg>
      </div>
    );
  } else if (el.type === 'gradient') {
    const gc = el.gradientConfig || { stops: [{ color: '#1a1a2e', pos: 0 }, { color: '#0f3460', pos: 100 }], angle: 135 };
    const grad = `linear-gradient(${gc.angle || 135}deg, ${gc.stops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
    content = (
      <div style={{ ...style, background: grad, borderRadius: elStyle.borderRadius || 0 }} onMouseDown={handleMouseDown} />
    );
  } else if (el.type === 'particles') {
    const pc = el.particleConfig || {};
    // Static particle preview (actual animation would be in Remotion)
    const particles = useMemo(() => Array.from({ length: Math.min(pc.count || 50, 100) }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: (pc.size || 4) * (0.5 + Math.random()),
    })), [pc.count, pc.size]);
    content = (
      <div style={{ ...style, overflow: 'hidden' }} onMouseDown={handleMouseDown}>
        {particles.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size * scale,
            height: p.size * scale,
            borderRadius: '50%',
            background: pc.color || '#ff6600',
            opacity: 0.3 + Math.random() * 0.7,
          }} />
        ))}
      </div>
    );
  }

  return content;
}

// ─── Timeline Track ───
function TimelineTrack({ el, totalFrames, currentFrame, selected, onSelect, onAddKeyframe, onSelectKeyframe, selectedKeyframe }) {
  const frames = Object.keys(el.keyframes).map(Number).sort((a, b) => a - b);

  return (
    <div
      className={`flex items-center border-b border-gray-800 h-8 cursor-pointer ${selected ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'}`}
      onClick={() => onSelect(el.id)}
    >
      <div className="w-36 flex-shrink-0 px-2 flex items-center gap-1.5 truncate border-r border-gray-800">
        <span className="text-xs text-gray-500">{el.visible ? '👁' : '🚫'}</span>
        <span className="text-xs text-gray-300 truncate">{el.name}</span>
      </div>
      <div className="flex-1 relative h-full" onClick={e => e.stopPropagation()}>
        {/* Track background bar */}
        <div className="absolute top-3 left-0 right-0 h-2 bg-gray-800 rounded-full" />
        {/* Active range */}
        {frames.length > 0 && (
          <div
            className="absolute top-3 h-2 bg-blue-900/50 rounded-full"
            style={{
              left: `${(frames[0] / totalFrames) * 100}%`,
              width: `${((frames[frames.length - 1] - frames[0]) / totalFrames) * 100}%`
            }}
          />
        )}
        {/* Keyframe diamonds */}
        {frames.map(f => (
          <div
            key={f}
            className={`absolute top-1.5 w-3 h-3 transform rotate-45 cursor-pointer transition-colors ${
              selectedKeyframe === f && selected ? 'bg-yellow-400 ring-2 ring-yellow-300' : 'bg-blue-400 hover:bg-blue-300'
            }`}
            style={{ left: `calc(${(f / totalFrames) * 100}% - 6px)` }}
            onClick={(e) => { e.stopPropagation(); onSelect(el.id); onSelectKeyframe(f); }}
            title={`Frame ${f}`}
          />
        ))}
        {/* Add keyframe at current frame */}
        {selected && !frames.includes(currentFrame) && (
          <div
            className="absolute top-1.5 w-3 h-3 transform rotate-45 border-2 border-dashed border-gray-500 cursor-pointer hover:border-blue-400 opacity-50 hover:opacity-100"
            style={{ left: `calc(${(currentFrame / totalFrames) * 100}% - 6px)` }}
            onClick={(e) => { e.stopPropagation(); onAddKeyframe(el.id, currentFrame); }}
            title="Add keyframe"
          />
        )}
      </div>
    </div>
  );
}

// ─── Property Input ───
function PropInput({ label, value, onChange, type = 'number', step, min, max, options }) {
  if (type === 'select') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
        <select value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (type === 'color') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
        <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value)} className="w-8 h-6 bg-transparent border-0 cursor-pointer" />
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500" />
      </div>
    );
  }
  if (type === 'text' || type === 'textarea') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
        {type === 'textarea' ? (
          <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 resize-none" rows={2} />
        ) : (
          <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
      <input type="number" value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value) || 0)} step={step || 1} min={min} max={max} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
    </div>
  );
}

// ─── Main Editor ───
export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [template, setTemplate] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKeyframe, setSelectedKeyframe] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(0.45);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playRef = useRef(null);
  const dragRef = useRef(null);

  const selectedEl = elements.find(e => e.id === selectedId);
  const totalFrames = useMemo(() => Math.round((template?.duration || 5) * (template?.fps || 30)), [template?.duration, template?.fps]);

  // Load template
  useEffect(() => {
    api.get(`/templates/${id}`).then(t => {
      setTemplate(t);
      setElements(t.elements || []);
      pushHistory(t.elements || []);
    }).catch(() => navigate('/control/templates'));
  }, [id]);

  // Load video library for mini palette
  useEffect(() => {
    const token = localStorage.getItem('broadcast_token');
    fetch('/api/uploads', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(files => setVideoLibrary(files.filter(f => /\.(mp4|webm|mov|avi)$/i.test(f.filename))))
      .catch(() => {});
  }, []);

  // Play animation
  useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return; }
    const fps = template?.fps || 30;
    playRef.current = setInterval(() => {
      setCurrentFrame(f => {
        const next = f + 1;
        return next >= totalFrames ? 0 : next;
      });
    }, 1000 / fps);
    return () => clearInterval(playRef.current);
  }, [playing, totalFrames, template?.fps]);

  function pushHistory(els) {
    setHistory(h => [...h.slice(0, historyIdx + 1), JSON.parse(JSON.stringify(els))].slice(-50));
    setHistoryIdx(i => i + 1);
  }

  function updateElements(els) {
    setElements(els);
    setDirty(true);
    pushHistory(els);
  }

  function undo() {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setElements(JSON.parse(JSON.stringify(history[newIdx])));
    setDirty(true);
  }

  function redo() {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setElements(JSON.parse(JSON.stringify(history[newIdx])));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/templates/${id}`, { ...template, elements });
      setDirty(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  function addElement(type) {
    const el = defaultElement(type);
    updateElements([...elements, el]);
    setSelectedId(el.id);
    setSelectedKeyframe(0);
  }

  function updateSelectedElement(updater) {
    const newEls = elements.map(e => e.id === selectedId ? updater({ ...e }) : e);
    updateElements(newEls);
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateElements(elements.filter(e => e.id !== selectedId));
    setSelectedId(null);
  }

  function addKeyframe(elId, frame) {
    const newEls = elements.map(e => {
      if (e.id !== elId) return e;
      const props = getElementAtFrame(e, frame);
      return { ...e, keyframes: { ...e.keyframes, [frame]: { x: props.x, y: props.y, width: props.width, height: props.height, rotation: props.rotation, opacity: props.opacity, scale: props.scale } } };
    });
    updateElements(newEls);
    setSelectedKeyframe(frame);
  }

  function deleteKeyframe(elId, frame) {
    if (frame === 0) return; // Don't delete first keyframe
    const newEls = elements.map(e => {
      if (e.id !== elId) return e;
      const kf = { ...e.keyframes };
      delete kf[frame];
      return { ...e, keyframes: kf };
    });
    updateElements(newEls);
    setSelectedKeyframe(0);
  }

  // Drag handling
  function handleDragStart(e, elId) {
    const el = elements.find(x => x.id === elId);
    if (!el || el.locked) return;
    const props = getElementAtFrame(el, currentFrame);
    dragRef.current = {
      elId,
      startX: e.clientX,
      startY: e.clientY,
      origX: props.x || 0,
      origY: props.y || 0,
    };

    const handleMove = (ev) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / zoom;
      const dy = (ev.clientY - dragRef.current.startY) / zoom;
      let nx = Math.round((dragRef.current.origX + dx) / GRID_SIZE) * GRID_SIZE;
      let ny = Math.round((dragRef.current.origY + dy) / GRID_SIZE) * GRID_SIZE;

      setElements(prev => prev.map(e => {
        if (e.id !== dragRef.current.elId) return e;
        const kf = { ...e.keyframes };
        const frameKey = String(currentFrame);
        kf[frameKey] = { ...(kf[frameKey] || getElementAtFrame(e, currentFrame)), x: nx, y: ny };
        return { ...e, keyframes: kf };
      }));
    };

    const handleUp = () => {
      if (dragRef.current) {
        setDirty(true);
        pushHistory(elements);
        dragRef.current = null;
      }
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); e.preventDefault(); }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) { redo(); e.preventDefault(); }
      else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) { undo(); e.preventDefault(); }
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) { save(); e.preventDefault(); }
      if (e.key === ' ') { setPlaying(p => !p); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, elements, historyIdx]);

  if (!template) return <div className="flex h-full items-center justify-center text-gray-500 animate-pulse">Loading...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* ─── Toolbar ─── */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-2 flex-shrink-0">
        <button onClick={() => navigate('/control/templates')} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Back">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="h-6 w-px bg-gray-700 mx-1" />
        <span className="text-sm font-medium truncate max-w-[200px]">{template.name}</span>
        {dirty && <span className="text-xs text-yellow-500">●</span>}
        <div className="h-6 w-px bg-gray-700 mx-1" />

        {/* Play/Pause */}
        <button onClick={() => setPlaying(p => !p)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        <span className="text-xs text-gray-500 font-mono w-24 text-center">
          {currentFrame}/{totalFrames} · {(currentFrame / (template.fps || 30)).toFixed(1)}s
        </span>

        <div className="h-6 w-px bg-gray-700 mx-1" />

        {/* Add elements */}
        {[
          { type: 'text', label: 'T', title: 'Add Text' },
          { type: 'shape', label: '■', title: 'Add Shape' },
          { type: 'image', label: '🖼', title: 'Add Image' },
          { type: 'icon', label: '★', title: 'Add Icon' },
          { type: 'particles', label: '✨', title: 'Add Particles' },
          { type: 'video', label: '🎬', title: 'Add Video / VJ Loop' },
          { type: 'gradient', label: '🌈', title: 'Add Gradient' },
        ].map(({ type, label, title }) => (
          <button key={type} onClick={() => addElement(type)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white text-sm" title={title}>{label}</button>
        ))}

        <div className="flex-1" />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={historyIdx <= 0} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white disabled:opacity-30" title="Undo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5" /></svg>
        </button>
        <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white disabled:opacity-30" title="Redo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5" /></svg>
        </button>

        <div className="h-6 w-px bg-gray-700 mx-1" />

        <button onClick={() => setSettingsOpen(true)} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Settings">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>

        <button onClick={save} disabled={saving || !dirty} className={`px-3 py-1 rounded text-sm font-medium transition-colors ${dirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Element Library (left) ─── */}
        <div className="w-48 bg-gray-900 border-r border-gray-800 flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Elements</h3>
            {elements.length === 0 ? (
              <p className="text-xs text-gray-600 italic">Add elements from toolbar</p>
            ) : (
              <div className="space-y-0.5">
                {[...elements].reverse().map(el => (
                  <div
                    key={el.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs ${selectedId === el.id ? 'bg-blue-600/20 text-blue-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'}`}
                    onClick={() => { setSelectedId(el.id); setSelectedKeyframe(Object.keys(el.keyframes).map(Number).sort((a,b)=>a-b)[0] || 0); }}
                  >
                    <span className="opacity-60">{el.type === 'text' ? 'T' : el.type === 'shape' ? '■' : el.type === 'image' ? '🖼' : el.type === 'icon' ? '★' : el.type === 'video' ? '🎬' : el.type === 'particles' ? '✨' : '🌈'}</span>
                    <span className="truncate flex-1">{el.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); updateElements(elements.map(x => x.id === el.id ? { ...x, visible: !x.visible } : x)); }}
                      className="opacity-40 hover:opacity-100"
                    >
                      {el.visible ? '👁' : '🚫'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Canvas ─── */}
        <div className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center" onClick={() => setSelectedId(null)}>
          <div className="relative" style={{ margin: 40 }}>
            {/* Zoom controls */}
            <div className="absolute -top-8 right-0 flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.05))} className="text-xs text-gray-500 hover:text-white">−</button>
              <span className="text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(1, z + 0.05))} className="text-xs text-gray-500 hover:text-white">+</button>
            </div>
            {/* Canvas area */}
            <div
              ref={canvasRef}
              className="relative bg-black overflow-hidden"
              style={{
                width: CANVAS_W * zoom,
                height: CANVAS_H * zoom,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Grid */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
                <defs>
                  <pattern id="grid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
                    <path d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`} fill="none" stroke="#444" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              {/* Center guides */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-500/10 pointer-events-none" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-500/10 pointer-events-none" />
              {/* Elements */}
              {elements.map(el => (
                <RenderElement
                  key={el.id}
                  el={el}
                  frame={currentFrame}
                  selected={selectedId === el.id}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  scale={zoom}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Properties Panel (right) ─── */}
        <div className="w-64 bg-gray-900 border-l border-gray-800 flex-shrink-0 overflow-y-auto">
          {selectedEl ? (
            <div className="p-3 space-y-4">
              {/* Name */}
              <div>
                <PropInput label="Name" value={selectedEl.name} type="text" onChange={v => updateSelectedElement(e => ({ ...e, name: v }))} />
              </div>

              {/* Transform */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Transform</h4>
                <div className="space-y-1.5">
                  {['x', 'y', 'width', 'height', 'rotation', 'opacity', 'scale'].map(prop => {
                    const kf = selectedEl.keyframes[selectedKeyframe] || {};
                    const current = kf[prop] ?? getElementAtFrame(selectedEl, selectedKeyframe)[prop];
                    return (
                      <PropInput
                        key={prop}
                        label={prop}
                        value={current}
                        step={prop === 'opacity' ? 0.1 : prop === 'scale' ? 0.1 : prop === 'rotation' ? 5 : 1}
                        min={prop === 'opacity' ? 0 : prop === 'scale' ? 0 : undefined}
                        max={prop === 'opacity' ? 1 : undefined}
                        onChange={v => {
                          updateSelectedElement(e => {
                            const kf = { ...e.keyframes };
                            kf[selectedKeyframe] = { ...(kf[selectedKeyframe] || {}), [prop]: v };
                            return { ...e, keyframes: kf };
                          });
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Style */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Style</h4>
                <div className="space-y-1.5">
                  <PropInput label="Fill" value={selectedEl.style?.fill} type="color" onChange={v => updateSelectedElement(e => ({ ...e, style: { ...e.style, fill: v } }))} />
                  <PropInput label="Stroke" value={selectedEl.style?.stroke} type="color" onChange={v => updateSelectedElement(e => ({ ...e, style: { ...e.style, stroke: v } }))} />
                  <PropInput label="Stroke W" value={selectedEl.style?.strokeWidth} onChange={v => updateSelectedElement(e => ({ ...e, style: { ...e.style, strokeWidth: v } }))} min={0} />
                  <PropInput label="Radius" value={selectedEl.style?.borderRadius} onChange={v => updateSelectedElement(e => ({ ...e, style: { ...e.style, borderRadius: v } }))} min={0} />
                  <PropInput label="Shadow" value={selectedEl.style?.shadow} type="text" onChange={v => updateSelectedElement(e => ({ ...e, style: { ...e.style, shadow: v } }))} />
                  <PropInput label="Blur" value={selectedEl.style?.blur} onChange={v => updateSelectedElement(e => ({ ...e, style: { ...e.style, blur: v } }))} min={0} />
                </div>
              </div>

              {/* Type-specific */}
              {selectedEl.type === 'text' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Text</h4>
                  <div className="space-y-1.5">
                    <PropInput label="Content" value={selectedEl.textConfig?.content} type="textarea" onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, content: v } }))} />

                    {/* Font selector with preview */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                      <select
                        value={selectedEl.textConfig?.fontFamily || 'Inter'}
                        onChange={e => {
                          const font = FONT_LIST.find(f => f.name === e.target.value);
                          if (font && font.google) {
                            const link = document.createElement('link');
                            link.href = 'https://fonts.googleapis.com/css2?family=' + font.google + ':wght@100;200;300;400;500;600;700;800;900&display=swap';
                            link.rel = 'stylesheet';
                            if (!document.querySelector('link[href*="' + font.google + '"]')) document.head.appendChild(link);
                          }
                          updateSelectedElement(el => ({ ...el, textConfig: { ...el.textConfig, fontFamily: e.target.value } }));
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        {FONT_LIST.map(f => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                        <option value="custom">Custom...</option>
                      </select>
                      {selectedEl.textConfig?.fontFamily === 'custom' && (
                        <input type="text" placeholder="Font family name..." className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                          onChange={e => updateSelectedElement(el => ({ ...el, textConfig: { ...el.textConfig, fontFamily: e.target.value } }))} />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <PropInput label="Size" value={selectedEl.textConfig?.fontSize} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, fontSize: v } }))} min={1} />
                      <PropInput label="Weight" value={selectedEl.textConfig?.fontWeight} type="select" options={[100, 200, 300, 400, 500, 600, 700, 800, 900]} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, fontWeight: parseInt(v) } }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <PropInput label="H Align" value={selectedEl.textConfig?.align} type="select" options={['left', 'center', 'right']} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, align: v } }))} />
                      <PropInput label="V Align" value={selectedEl.textConfig?.vertAlign || 'center'} type="select" options={VERT_ALIGN_OPTIONS} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, vertAlign: v } }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <PropInput label="Letter Spacing" value={selectedEl.textConfig?.letterSpacing} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, letterSpacing: v } }))} step={0.5} />
                      <PropInput label="Kerning" value={selectedEl.textConfig?.kerning || 0} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, kerning: v } }))} step={0.1} />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <PropInput label="Line Height" value={selectedEl.textConfig?.lineHeight || 1.2} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, lineHeight: v } }))} step={0.1} min={0.5} max={4} />
                      <PropInput label="Word Spacing" value={selectedEl.textConfig?.wordSpacing || 0} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, wordSpacing: v } }))} step={1} />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <PropInput label="Transform" value={selectedEl.textConfig?.textTransform || 'none'} type="select" options={TEXT_TRANSFORM_OPTIONS} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, textTransform: v } }))} />
                      <PropInput label="Padding" value={selectedEl.textConfig?.padding || 0} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, padding: v } }))} min={0} />
                    </div>

                    <div className="mb-1">
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={(selectedEl.textConfig?.whiteSpace || 'nowrap') === 'normal'}
                          onChange={e => updateSelectedElement(el => ({ ...el, textConfig: { ...el.textConfig, whiteSpace: e.target.checked ? 'normal' : 'nowrap' } }))}
                          className="accent-blue-500" /> Word Wrap
                      </label>
                    </div>
                  </div>

                  {/* Text Animations */}
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-2">Text Animation</h4>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Animate In</label>
                        <select value={selectedEl.textConfig?.animIn || 'none'}
                          onChange={e => updateSelectedElement(el => ({ ...el, textConfig: { ...el.textConfig, animIn: e.target.value } }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                          {TEXT_ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Animate Out</label>
                        <select value={selectedEl.textConfig?.animOut || 'none'}
                          onChange={e => updateSelectedElement(el => ({ ...el, textConfig: { ...el.textConfig, animOut: e.target.value } }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                          {TEXT_ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <PropInput label="Duration" value={selectedEl.textConfig?.animDuration || 0.5} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, animDuration: v } }))} step={0.1} min={0.1} max={5} />
                      <PropInput label="Delay" value={selectedEl.textConfig?.animDelay || 0} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, animDelay: v } }))} step={0.1} min={0} max={10} />
                      <PropInput label="Stagger" value={selectedEl.textConfig?.animStagger || 0.05} onChange={v => updateSelectedElement(e => ({ ...e, textConfig: { ...e.textConfig, animStagger: v } }))} step={0.01} min={0} max={1} />
                    </div>

                    {(selectedEl.textConfig?.animIn !== 'none' || selectedEl.textConfig?.animOut !== 'none') && (
                      <p className="text-xs text-blue-400/60 mt-1">Animation previews in Remotion render. Canvas shows static preview.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedEl.type === 'shape' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Shape</h4>
                  <PropInput label="Shape" value={selectedEl.shapeConfig?.shape} type="select" options={SHAPE_TYPES} onChange={v => updateSelectedElement(e => ({ ...e, shapeConfig: { ...e.shapeConfig, shape: v } }))} />
                </div>
              )}

              {selectedEl.type === 'image' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Image</h4>
                  <div className="space-y-1.5">
                    <PropInput label="URL" value={selectedEl.imageConfig?.src} type="text" onChange={v => updateSelectedElement(e => ({ ...e, imageConfig: { ...e.imageConfig, src: v } }))} />
                    <PropInput label="Fit" value={selectedEl.imageConfig?.fit} type="select" options={['contain', 'cover', 'fill']} onChange={v => updateSelectedElement(e => ({ ...e, imageConfig: { ...e.imageConfig, fit: v } }))} />
                  </div>
                </div>
              )}

              {selectedEl.type === 'video' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Video / VJ Loop</h4>
                  <div className="space-y-1.5">
                    {/* Mini video palette */}
                    {videoLibrary.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1.5">Quick Select</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                          {videoLibrary.slice(0, 12).map(f => (
                            <button
                              key={f.filename}
                              onClick={() => updateSelectedElement(e => ({ ...e, videoConfig: { ...e.videoConfig, src: f.url } }))}
                              className={'flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all hover:border-blue-400 ' + (selectedEl.videoConfig?.src === f.url ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-700')}
                              title={f.filename}
                            >
                              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <span className="text-xs">🎬</span>
                              </div>
                            </button>
                          ))}
                          <button
                            onClick={() => setMediaPickerOpen(true)}
                            className="flex-shrink-0 w-16 h-10 rounded border-2 border-dashed border-gray-700 hover:border-gray-500 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
                            title="Browse media library"
                          >
                            <span className="text-xs">+</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1">
                        <PropInput label="URL" value={selectedEl.videoConfig?.src} type="text" onChange={v => updateSelectedElement(e => ({ ...e, videoConfig: { ...e.videoConfig, src: v } }))} />
                      </div>
                      <button onClick={() => setMediaPickerOpen(true)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-700 mb-px" title="Browse">📂</button>
                    </div>
                    <MediaPicker open={mediaPickerOpen} onClose={() => setMediaPickerOpen(false)} onSelect={(url) => { updateSelectedElement(e => ({ ...e, videoConfig: { ...e.videoConfig, src: url } })); setMediaPickerOpen(false); }} />
                    <PropInput label="Fit" value={selectedEl.videoConfig?.fit} type="select" options={['contain', 'cover', 'fill']} onChange={v => updateSelectedElement(e => ({ ...e, videoConfig: { ...e.videoConfig, fit: v } }))} />
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={selectedEl.videoConfig?.loop !== false} onChange={e => updateSelectedElement(el => ({ ...el, videoConfig: { ...el.videoConfig, loop: e.target.checked } }))} className="accent-blue-500" /> Loop
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={selectedEl.videoConfig?.autoplay !== false} onChange={e => updateSelectedElement(el => ({ ...el, videoConfig: { ...el.videoConfig, autoplay: e.target.checked } }))} className="accent-blue-500" /> Autoplay
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={selectedEl.videoConfig?.muted !== false} onChange={e => updateSelectedElement(el => ({ ...el, videoConfig: { ...el.videoConfig, muted: e.target.checked } }))} className="accent-blue-500" /> Muted
                      </label>
                    </div>
                    <button
                      className="w-full mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => {
                        const src = selectedEl.videoConfig?.src;
                        if (!src) return alert('Set a video URL first');
                        const vid = document.createElement('video');
                        vid.crossOrigin = 'anonymous';
                        vid.preload = 'metadata';
                        vid.onloadedmetadata = function() {
                          const dur = Math.round(vid.duration * 10) / 10;
                          if (dur && dur > 0 && isFinite(dur)) {
                            if (confirm('Match composition duration to video length (' + dur + 's)?')) {
                              setTemplate(t => ({ ...t, duration: dur }));
                              setDirty(true);
                            }
                          } else { alert('Could not detect video duration'); }
                          vid.src = '';
                        };
                        vid.onerror = function() { alert('Failed to load video. Check the URL.'); };
                        vid.src = src;
                      }}
                    >
                      🎬 Match Duration to Video
                    </button>
                  </div>
                </div>
              )}

              {selectedEl.type === 'icon' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Icon</h4>
                  <PropInput label="Icon" value={selectedEl.iconConfig?.icon} type="select" options={Object.keys(ICON_MAP)} onChange={v => updateSelectedElement(e => ({ ...e, iconConfig: { ...e.iconConfig, icon: v } }))} />
                </div>
              )}

              {selectedEl.type === 'particles' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Particles</h4>
                  <div className="space-y-1.5">
                    <PropInput label="Count" value={selectedEl.particleConfig?.count} onChange={v => updateSelectedElement(e => ({ ...e, particleConfig: { ...e.particleConfig, count: v } }))} min={1} max={500} />
                    <PropInput label="Color" value={selectedEl.particleConfig?.color} type="color" onChange={v => updateSelectedElement(e => ({ ...e, particleConfig: { ...e.particleConfig, color: v } }))} />
                    <PropInput label="Speed" value={selectedEl.particleConfig?.speed} step={0.5} onChange={v => updateSelectedElement(e => ({ ...e, particleConfig: { ...e.particleConfig, speed: v } }))} min={0} />
                    <PropInput label="Size" value={selectedEl.particleConfig?.size} onChange={v => updateSelectedElement(e => ({ ...e, particleConfig: { ...e.particleConfig, size: v } }))} min={1} />
                    <PropInput label="Spread" value={selectedEl.particleConfig?.spread} onChange={v => updateSelectedElement(e => ({ ...e, particleConfig: { ...e.particleConfig, spread: v } }))} min={0} max={360} />
                  </div>
                </div>
              )}

              {selectedEl.type === 'gradient' && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Gradient</h4>
                  <div className="space-y-1.5">
                    <PropInput label="Angle" value={selectedEl.gradientConfig?.angle} onChange={v => updateSelectedElement(e => ({ ...e, gradientConfig: { ...e.gradientConfig, angle: v } }))} min={0} max={360} />
                    {(selectedEl.gradientConfig?.stops || []).map((stop, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input type="color" value={stop.color} onChange={ev => {
                          updateSelectedElement(e => {
                            const stops = [...(e.gradientConfig?.stops || [])];
                            stops[i] = { ...stops[i], color: ev.target.value };
                            return { ...e, gradientConfig: { ...e.gradientConfig, stops } };
                          });
                        }} className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
                        <input type="number" value={stop.pos} min={0} max={100} onChange={ev => {
                          updateSelectedElement(e => {
                            const stops = [...(e.gradientConfig?.stops || [])];
                            stops[i] = { ...stops[i], pos: parseInt(ev.target.value) || 0 };
                            return { ...e, gradientConfig: { ...e.gradientConfig, stops } };
                          });
                        }} className="w-12 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-white" />
                        <span className="text-xs text-gray-600">%</span>
                      </div>
                    ))}
                    <button
                      onClick={() => updateSelectedElement(e => {
                        const stops = [...(e.gradientConfig?.stops || [])];
                        stops.push({ color: '#ffffff', pos: 100 });
                        return { ...e, gradientConfig: { ...e.gradientConfig, stops } };
                      })}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >+ Add Stop</button>
                  </div>
                </div>
              )}

              {/* Easing */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Easing</h4>
                <PropInput label="Default" value={selectedEl.easing?.default} type="select" options={EASING_OPTIONS} onChange={v => updateSelectedElement(e => ({ ...e, easing: { ...e.easing, default: v } }))} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-800">
                <button onClick={() => updateSelectedElement(e => ({ ...e, locked: !e.locked }))} className={`flex-1 text-xs py-1.5 rounded ${selectedEl.locked ? 'bg-yellow-600/20 text-yellow-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {selectedEl.locked ? '🔒 Locked' : '🔓 Lock'}
                </button>
                <button onClick={deleteSelected} className="flex-1 text-xs py-1.5 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40">Delete</button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-600 text-sm">
              <p>Select an element to edit properties</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Timeline ─── */}
      <div className="h-48 bg-gray-900 border-t border-gray-800 flex-shrink-0 flex flex-col">
        {/* Timeline header */}
        <div className="flex items-center gap-3 px-3 h-8 border-b border-gray-800 flex-shrink-0">
          <span className="text-xs text-gray-500 font-semibold uppercase">Timeline</span>
          <div className="flex-1" />
          <label className="text-xs text-gray-500">Duration</label>
          <input type="number" value={template.duration} min={0.5} max={60} step={0.5}
            onChange={e => setTemplate(t => ({ ...t, duration: parseFloat(e.target.value) || 5 }))}
            className="w-14 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          />
          <span className="text-xs text-gray-600">s</span>
          <label className="text-xs text-gray-500 ml-2">FPS</label>
          <select value={template.fps} onChange={e => setTemplate(t => ({ ...t, fps: parseInt(e.target.value) }))}
            className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>

        {/* Scrub bar */}
        <div className="px-3 py-1 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-36 flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={e => { setCurrentFrame(parseInt(e.target.value)); setPlaying(false); }}
              className="flex-1 h-1 accent-blue-500"
            />
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto">
          {elements.map(el => (
            <TimelineTrack
              key={el.id}
              el={el}
              totalFrames={totalFrames}
              currentFrame={currentFrame}
              selected={selectedId === el.id}
              onSelect={id => { setSelectedId(id); }}
              onAddKeyframe={addKeyframe}
              onSelectKeyframe={f => setSelectedKeyframe(f)}
              selectedKeyframe={selectedId === el.id ? selectedKeyframe : null}
            />
          ))}
          {elements.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-600 text-xs">No elements — add some from the toolbar</div>
          )}
        </div>
      </div>

      {/* ─── Settings Modal ─── */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSettingsOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Template Settings</h2>
            <PropInput label="Name" value={template.name} type="text" onChange={v => { setTemplate(t => ({ ...t, name: v })); setDirty(true); }} />
            <PropInput label="Description" value={template.description} type="textarea" onChange={v => { setTemplate(t => ({ ...t, description: v })); setDirty(true); }} />
            <PropInput label="Category" value={template.category} type="select" options={['custom', 'lower-third', 'full-screen', 'overlay', 'transition', 'stinger']} onChange={v => { setTemplate(t => ({ ...t, category: v })); setDirty(true); }} />
            <div className="flex justify-end">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
