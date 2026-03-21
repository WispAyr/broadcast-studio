import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';

// ─── Color themes ───────────────────────────────────────────────────────────
const THEMES = {
  neon:    ['#00ffff', '#ff00ff', '#8b5cf6', '#06b6d4', '#d946ef'],
  fire:    ['#ff4500', '#ff6a00', '#ff9500', '#ffcc00', '#ffe066'],
  ocean:   ['#0077b6', '#00b4d8', '#48cae4', '#90e0ef', '#00f5d4'],
  mono:    null, // uses monoColor
  rainbow: null, // uses HSL cycle
};

function getThemeColor(theme, monoColor, index, total, time) {
  if (theme === 'rainbow') {
    return `hsl(${(index / total) * 360 + time * 0.05}, 100%, 60%)`;
  }
  if (theme === 'mono') return monoColor || '#00ffff';
  const palette = THEMES[theme] || THEMES.neon;
  return palette[index % palette.length];
}

function getThemeGradient(theme, monoColor, t) {
  if (theme === 'rainbow') {
    return [`hsl(${t % 360}, 100%, 60%)`, `hsl(${(t + 120) % 360}, 100%, 60%)`, `hsl(${(t + 240) % 360}, 100%, 60%)`];
  }
  if (theme === 'mono') {
    const c = monoColor || '#00ffff';
    return [c, c, c];
  }
  const palette = THEMES[theme] || THEMES.neon;
  const i = Math.floor(t / 60) % palette.length;
  return [palette[i], palette[(i + 1) % palette.length], palette[(i + 2) % palette.length]];
}

// ─── Beat detection ─────────────────────────────────────────────────────────
function createBeatDetector() {
  let prevEnergy = 0;
  let beatDecay = 0;
  return {
    update(freqData) {
      let bassEnergy = 0;
      const bassEnd = Math.min(8, freqData.length);
      for (let i = 0; i < bassEnd; i++) bassEnergy += freqData[i];
      bassEnergy /= bassEnd;
      const isBeat = bassEnergy > prevEnergy * 1.4 && bassEnergy > 140;
      if (isBeat) beatDecay = 1.0;
      else beatDecay *= 0.92;
      prevEnergy = bassEnergy * 0.7 + prevEnergy * 0.3;
      return { isBeat, beatDecay, bassEnergy };
    }
  };
}

// ─── Smooth data ────────────────────────────────────────────────────────────
function smoothData(current, previous, factor = 0.3) {
  if (!previous || previous.length !== current.length) return [...current];
  return current.map((v, i) => previous[i] + (v - previous[i]) * factor);
}

// ─── Idle animation data ────────────────────────────────────────────────────
function generateIdleData(size, time) {
  const data = new Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = 40 + Math.sin(time * 0.001 + i * 0.3) * 20 + Math.sin(time * 0.0007 + i * 0.15) * 15;
  }
  return data;
}

// ─── Renderers ──────────────────────────────────────────────────────────────

function renderBars(ctx, w, h, freqData, config, beat, time) {
  const { theme, monoColor, sensitivity, glowIntensity, mirror, showReflection, barCount } = config;
  const count = Math.min(barCount || 64, freqData.length);
  const gap = 2;
  const barW = (w - gap * count) / count;
  const sens = sensitivity || 1.5;

  ctx.clearRect(0, 0, w, h);

  const drawBar = (i, x, barHeight, alpha) => {
    const color = getThemeColor(theme, monoColor, i, count, time);
    const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '40');

    ctx.shadowBlur = (glowIntensity || 15) * (0.5 + beat.beatDecay * 0.5);
    ctx.shadowColor = color;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;

    const radius = Math.min(barW / 2, 4);
    const bx = x, by = h - barHeight, bw = barW, bh = barHeight;
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.lineTo(bx + bw - radius, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.closePath();
    ctx.fill();
  };

  const indices = mirror
    ? Array.from({ length: count }, (_, i) => i < count / 2 ? count / 2 - 1 - i : i - count / 2)
    : Array.from({ length: count }, (_, i) => i);

  for (let i = 0; i < count; i++) {
    const dataIdx = Math.floor((indices[i] / count) * freqData.length);
    const val = (freqData[dataIdx] || 0) / 255;
    const barH = val * h * 0.85 * sens * (1 + beat.beatDecay * 0.2);
    const x = i * (barW + gap);
    drawBar(i, x, Math.max(barH, 2), 1);

    if (showReflection !== false) {
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.translate(0, -h);
      drawBar(i, x, barH * 0.3, 0.15);
      ctx.restore();
    }
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function renderCircular(ctx, w, h, freqData, config, beat, time) {
  const { theme, monoColor, sensitivity, glowIntensity, rotationSpeed, barCount } = config;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) * 0.22;
  const maxBarLen = Math.min(w, h) * 0.28;
  const count = Math.min(barCount || 64, freqData.length);
  const sens = sensitivity || 1.5;
  const rot = (time * (rotationSpeed || 0.5) * 0.001);

  ctx.clearRect(0, 0, w, h);

  // Center glow
  const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const colors = getThemeGradient(theme, monoColor, time * 0.02);
  centerGrad.addColorStop(0, colors[0] + '15');
  centerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = centerGrad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < count; i++) {
    const dataIdx = Math.floor((i / count) * freqData.length);
    const val = (freqData[dataIdx] || 0) / 255;
    const angle = (i / count) * Math.PI * 2 + rot;
    const barLen = val * maxBarLen * sens * (1 + beat.beatDecay * 0.3);

    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(angle) * (radius + barLen);
    const y2 = cy + Math.sin(angle) * (radius + barLen);

    const color = getThemeColor(theme, monoColor, i, count, time);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max((Math.PI * 2 * radius) / count - 1, 1.5);
    ctx.shadowBlur = (glowIntensity || 15) * (0.3 + beat.beatDecay * 0.7);
    ctx.shadowColor = color;
    ctx.globalAlpha = 0.6 + val * 0.4;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Inner circle
  ctx.shadowBlur = (glowIntensity || 15);
  ctx.shadowColor = colors[0];
  ctx.strokeStyle = colors[0] + '60';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function renderWave(ctx, w, h, freqData, config, beat, time) {
  const { theme, monoColor, sensitivity, glowIntensity } = config;
  const sens = sensitivity || 1.5;
  const colors = getThemeGradient(theme, monoColor, time * 0.03);

  ctx.clearRect(0, 0, w, h);

  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    ctx.shadowBlur = (glowIntensity || 15) * (0.3 + beat.beatDecay * 0.5);
    ctx.shadowColor = colors[layer % colors.length];
    ctx.strokeStyle = colors[layer % colors.length];
    ctx.lineWidth = 2.5 - layer * 0.5;
    ctx.globalAlpha = 0.8 - layer * 0.2;

    const offset = layer * 15 + time * 0.03;
    for (let x = 0; x <= w; x += 2) {
      const dataIdx = Math.floor((x / w) * freqData.length);
      const val = ((freqData[dataIdx] || 128) - 128) / 128;
      const y = h / 2 + val * h * 0.35 * sens * (1 + beat.beatDecay * 0.2)
        + Math.sin(x * 0.01 + offset) * 10;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// Particles state
const particleStates = new Map();

function renderParticles(ctx, w, h, freqData, config, beat, time, moduleId) {
  const { theme, monoColor, sensitivity, glowIntensity } = config;
  const sens = sensitivity || 1.5;
  const key = moduleId || 'default';

  if (!particleStates.has(key)) {
    const particles = [];
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: w / 2, y: h / 2,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        life: Math.random(),
        colorIdx: Math.floor(Math.random() * 5),
      });
    }
    particleStates.set(key, particles);
  }

  const particles = particleStates.get(key);
  ctx.clearRect(0, 0, w, h);

  // Compute bass & treble
  let bass = 0, treble = 0;
  const quarter = Math.floor(freqData.length / 4);
  for (let i = 0; i < quarter; i++) bass += freqData[i];
  for (let i = freqData.length - quarter; i < freqData.length; i++) treble += freqData[i];
  bass = (bass / quarter / 255) * sens;
  treble = (treble / quarter / 255) * sens;

  for (const p of particles) {
    // Beat explosion
    if (beat.isBeat) {
      const angle = Math.random() * Math.PI * 2;
      const force = bass * 8;
      p.vx += Math.cos(angle) * force;
      p.vy += Math.sin(angle) * force;
    }

    // Treble jitter
    p.vx += (Math.random() - 0.5) * treble * 2;
    p.vy += (Math.random() - 0.5) * treble * 2;

    // Gravity toward center
    const dx = w / 2 - p.x, dy = h / 2 - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    p.vx += dx / dist * 0.15;
    p.vy += dy / dist * 0.15;

    // Damping
    p.vx *= 0.97;
    p.vy *= 0.97;

    p.x += p.vx;
    p.y += p.vy;

    // Wrap
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;

    const color = getThemeColor(theme, monoColor, p.colorIdx, 5, time);
    const size = p.size * (1 + beat.beatDecay * 1.5);
    ctx.shadowBlur = (glowIntensity || 15) * (0.3 + beat.beatDecay * 0.5);
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5 + bass * 0.3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function renderSpectrum(ctx, w, h, freqData, config, beat, time) {
  const { theme, monoColor, sensitivity, glowIntensity } = config;
  const sens = sensitivity || 1.5;

  ctx.clearRect(0, 0, w, h);

  // Peaks state (stored on ctx to persist)
  if (!ctx._peaks) ctx._peaks = new Array(freqData.length).fill(0);
  if (!ctx._peakVel) ctx._peakVel = new Array(freqData.length).fill(0);

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  const colors = getThemeGradient(theme, monoColor, time * 0.02);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));

  // Main spectrum fill
  ctx.beginPath();
  ctx.moveTo(0, h);

  for (let i = 0; i < freqData.length; i++) {
    const x = (i / freqData.length) * w;
    const val = (freqData[i] / 255) * sens * (1 + beat.beatDecay * 0.15);
    const barH = val * h * 0.9;
    ctx.lineTo(x, h - barH);

    // Update peaks with gravity
    if (h - barH < h - ctx._peaks[i]) {
      ctx._peaks[i] = barH;
      ctx._peakVel[i] = 0;
    } else {
      ctx._peakVel[i] += 0.15; // gravity
      ctx._peaks[i] -= ctx._peakVel[i];
      if (ctx._peaks[i] < 0) ctx._peaks[i] = 0;
    }
  }

  ctx.lineTo(w, h);
  ctx.closePath();

  ctx.shadowBlur = (glowIntensity || 15);
  ctx.shadowColor = colors[0];
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.7;
  ctx.fill();

  // Peak dots
  ctx.shadowBlur = (glowIntensity || 15) * 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < freqData.length; i += 2) {
    const x = (i / freqData.length) * w;
    const peakY = h - ctx._peaks[i];
    ctx.beginPath();
    ctx.arc(x, peakY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ─── WebGL Blob Renderer ────────────────────────────────────────────────────

const BLOB_VERT = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uModelView;
uniform sampler2D uFreqTex;
uniform float uTime;
uniform float uBeatDecay;
uniform float uSensitivity;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;

void main() {
  vec3 pos = aPosition;
  vec3 n = normalize(aNormal);

  // Map vertex position to frequency bin via texture lookup
  float theta = atan(pos.y, pos.x) * 0.5 / 3.14159 + 0.5;
  float phi = acos(clamp(pos.z / length(pos), -1.0, 1.0)) / 3.14159;
  float freqU = mod(theta * 0.75 + phi * 0.25, 1.0);
  float freq = texture2D(uFreqTex, vec2(freqU, 0.5)).r;

  float displacement = freq * uSensitivity * 0.4;

  // Bass bulge from first few bins
  float bassInfluence = 0.0;
  for (int i = 0; i < 8; i++) {
    bassInfluence += texture2D(uFreqTex, vec2(float(i) / 64.0, 0.5)).r;
  }
  bassInfluence /= 8.0;
  displacement += bassInfluence * 0.15 * uSensitivity;

  // Beat pulse
  displacement += uBeatDecay * 0.2;

  // Organic noise displacement
  float noise = sin(pos.x * 3.0 + uTime * 0.7) * cos(pos.y * 4.0 + uTime * 0.5) * sin(pos.z * 2.5 + uTime * 0.9);
  displacement += noise * 0.08;

  pos += n * displacement;
  vDisplacement = displacement;
  vNormal = n;
  vPosition = pos;

  gl_Position = uProjection * uModelView * vec4(pos, 1.0);
}
`;

const BLOB_FRAG = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;
uniform float uTime;
uniform float uBeatDecay;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

void main() {
  vec3 n = normalize(vNormal);
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
  float diff = max(dot(n, lightDir), 0.0);
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);

  // Color based on displacement and position
  float t = clamp(vDisplacement * 2.0, 0.0, 1.0);
  vec3 col = mix(uColor1, uColor2, t);
  col = mix(col, uColor3, rim * 0.7);

  // Lighting
  float ambient = 0.15;
  float specular = pow(max(dot(reflect(-lightDir, n), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
  vec3 finalColor = col * (ambient + diff * 0.7) + vec3(1.0) * specular * 0.5;

  // Beat flash
  finalColor += col * uBeatDecay * 0.4;

  // Glow at edges
  finalColor += col * rim * (0.5 + uBeatDecay * 0.5);

  gl_FragColor = vec4(finalColor, 0.95);
}
`;

// Bloom pass shaders
const BLOOM_BLUR_FRAG = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uResolution;
varying vec2 vUv;
void main() {
  vec4 sum = vec4(0.0);
  float weights[5];
  weights[0] = 0.227027;
  weights[1] = 0.1945946;
  weights[2] = 0.1216216;
  weights[3] = 0.054054;
  weights[4] = 0.016216;
  vec2 texel = uDirection / uResolution;
  sum += texture2D(uTexture, vUv) * weights[0];
  for (int i = 1; i < 5; i++) {
    float w = weights[i];
    sum += texture2D(uTexture, vUv + texel * float(i)) * w;
    sum += texture2D(uTexture, vUv - texel * float(i)) * w;
  }
  gl_FragColor = sum;
}
`;

const BLOOM_COMPOSITE_FRAG = `
precision mediump float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
varying vec2 vUv;
void main() {
  vec4 scene = texture2D(uScene, vUv);
  vec4 bloom = texture2D(uBloom, vUv);
  gl_FragColor = scene + bloom * 1.2;
}
`;

const FULLSCREEN_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function createSphere(rings, segments) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      positions.push(x, y, z);
      normals.push(x, y, z);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function compileShader(gl, src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl, vSrc, fSrc) {
  const v = compileShader(gl, vSrc, gl.VERTEX_SHADER);
  const f = compileShader(gl, fSrc, gl.FRAGMENT_SHADER);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function mat4RotateY(out, a, rad) {
  const s = Math.sin(rad), c = Math.cos(rad);
  const r = mat4Identity();
  r[0] = c; r[2] = s; r[8] = -s; r[10] = c;
  return mat4Multiply(out, a, r);
}

function mat4RotateX(out, a, rad) {
  const s = Math.sin(rad), c = Math.cos(rad);
  const r = mat4Identity();
  r[5] = c; r[6] = s; r[9] = -s; r[10] = c;
  return mat4Multiply(out, a, r);
}

function mat4RotateZ(out, a, rad) {
  const s = Math.sin(rad), c = Math.cos(rad);
  const r = mat4Identity();
  r[0] = c; r[1] = s; r[4] = -s; r[5] = c;
  return mat4Multiply(out, a, r);
}

function mat4Translate(out, a, v) {
  const t = mat4Identity();
  t[12] = v[0]; t[13] = v[1]; t[14] = v[2];
  return mat4Multiply(out, a, t);
}

function mat4Multiply(out, a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      o[i * 4 + j] = a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3];
    }
  }
  if (out) { for (let i = 0; i < 16; i++) out[i] = o[i]; return out; }
  return o;
}

class BlobRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('No WebGL');
    this.gl = gl;
    this.destroyed = false;

    // Main blob program
    this.program = createProgram(gl, BLOB_VERT, BLOB_FRAG);

    // Fullscreen quad for bloom
    this.blurProgram = createProgram(gl, FULLSCREEN_VERT, BLOOM_BLUR_FRAG);
    this.compositeProgram = createProgram(gl, FULLSCREEN_VERT, BLOOM_COMPOSITE_FRAG);

    // Sphere geometry
    const sphere = createSphere(48, 64);
    this.indexCount = sphere.indices.length;

    this.posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);

    this.normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);

    this.idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);

    // Fullscreen quad
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    // Starfield particles
    this.stars = [];
    for (let i = 0; i < 300; i++) {
      this.stars.push({
        x: Math.random(), y: Math.random(),
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.0001 + 0.00005,
        brightness: Math.random() * 0.5 + 0.3,
      });
    }

    // Framebuffers for bloom
    this._setupFramebuffers();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _setupFramebuffers() {
    const gl = this.gl;
    const w = this.canvas.width || 800;
    const h = this.canvas.height || 600;
    this.fbWidth = w;
    this.fbHeight = h;

    // Scene framebuffer
    this.sceneFB = gl.createFramebuffer();
    this.sceneTex = this._createFBTexture(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
    const depthBuf = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuf);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuf);
    this.sceneDepth = depthBuf;

    // Ping-pong blur buffers (half res for performance)
    const bw = Math.floor(w / 2), bh = Math.floor(h / 2);
    this.blurFB1 = gl.createFramebuffer();
    this.blurTex1 = this._createFBTexture(bw, bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFB1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurTex1, 0);

    this.blurFB2 = gl.createFramebuffer();
    this.blurTex2 = this._createFBTexture(bw, bh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFB2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurTex2, 0);

    this.blurW = bw;
    this.blurH = bh;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _createFBTexture(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  render(freqData, config, beat, time) {
    if (this.destroyed) return;
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Resize framebuffers if needed
    if (w !== this.fbWidth || h !== this.fbHeight) {
      this._cleanupFramebuffers();
      this._setupFramebuffers();
    }

    const { theme, monoColor, sensitivity, glowIntensity } = config;
    const sens = sensitivity || 1.5;
    const colors = getThemeGradient(theme, monoColor, time * 0.015);

    const parseColor = (hex) => {
      const c = hex.replace('#', '');
      return [parseInt(c.substr(0,2),16)/255, parseInt(c.substr(2,2),16)/255, parseInt(c.substr(4,2),16)/255];
    };

    const c1 = parseColor(colors[0] || '#00ffff');
    const c2 = parseColor(colors[1] || '#ff00ff');
    const c3 = parseColor(colors[2] || '#8b5cf6');

    // ── Pass 1: Render blob to scene framebuffer ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.02, 0.02, 0.06, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw starfield background (as simple points via the blob program — skip, use 2D overlay later)
    // Actually we draw stars as GL_POINTS with a tiny program... let's just embed in the scene

    gl.useProgram(this.program);

    // Uniforms
    const projection = mat4Perspective(Math.PI / 3.5, w / h, 0.1, 100);
    let modelView = mat4Identity();
    modelView = mat4Translate(modelView, modelView, [0, 0, -3.5]);
    modelView = mat4RotateY(modelView, modelView, time * 0.0004);
    modelView = mat4RotateX(modelView, modelView, time * 0.0003);
    modelView = mat4RotateZ(modelView, modelView, time * 0.00015);

    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uModelView'), false, modelView);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uTime'), time * 0.001);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uBeatDecay'), beat.beatDecay);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uSensitivity'), sens);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uColor1'), c1);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uColor2'), c2);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uColor3'), c3);

    // Upload freq data as texture (much more compatible than 64 uniforms)
    const freqBytes = new Uint8Array(64 * 4);
    for (let i = 0; i < 64; i++) {
      const idx = Math.floor((i / 64) * freqData.length);
      const val = Math.round(((freqData[idx] || 0) / 255) * 255);
      freqBytes[i * 4] = val;     // R
      freqBytes[i * 4 + 1] = val; // G
      freqBytes[i * 4 + 2] = val; // B
      freqBytes[i * 4 + 3] = 255; // A
    }
    if (!this.freqTex) {
      this.freqTex = gl.createTexture();
    }
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.freqTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, freqBytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uFreqTex'), 2);

    // Vertex attributes
    const aPos = gl.getAttribLocation(this.program, 'aPosition');
    const aNorm = gl.getAttribLocation(this.program, 'aNormal');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuf);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    // ── Pass 2: Gaussian blur (horizontal) ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFB1);
    gl.viewport(0, 0, this.blurW, this.blurH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(this.blurProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.uniform1i(gl.getUniformLocation(this.blurProgram, 'uTexture'), 0);
    const blurAmount = 3.0 + (glowIntensity || 15) * 0.3 + beat.beatDecay * 4;
    gl.uniform2fv(gl.getUniformLocation(this.blurProgram, 'uDirection'), [blurAmount, 0]);
    gl.uniform2fv(gl.getUniformLocation(this.blurProgram, 'uResolution'), [this.blurW, this.blurH]);

    const blurAPos = gl.getAttribLocation(this.blurProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(blurAPos);
    gl.vertexAttribPointer(blurAPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ── Pass 3: Gaussian blur (vertical) ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFB2);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTex1);
    gl.uniform2fv(gl.getUniformLocation(this.blurProgram, 'uDirection'), [0, blurAmount]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ── Pass 4: Composite scene + bloom to screen ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.02, 0.02, 0.06, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTex2);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'uBloom'), 1);

    const compAPos = gl.getAttribLocation(this.compositeProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(compAPos);
    gl.vertexAttribPointer(compAPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
  }

  _cleanupFramebuffers() {
    const gl = this.gl;
    if (this.sceneFB) gl.deleteFramebuffer(this.sceneFB);
    if (this.sceneTex) gl.deleteTexture(this.sceneTex);
    if (this.sceneDepth) gl.deleteRenderbuffer(this.sceneDepth);
    if (this.blurFB1) gl.deleteFramebuffer(this.blurFB1);
    if (this.blurFB2) gl.deleteFramebuffer(this.blurFB2);
    if (this.blurTex1) gl.deleteTexture(this.blurTex1);
    if (this.blurTex2) gl.deleteTexture(this.blurTex2);
  }

  destroy() {
    this.destroyed = true;
    this._cleanupFramebuffers();
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.blurProgram) gl.deleteProgram(this.blurProgram);
    if (this.compositeProgram) gl.deleteProgram(this.compositeProgram);
    if (this.posBuf) gl.deleteBuffer(this.posBuf);
    if (this.normBuf) gl.deleteBuffer(this.normBuf);
    if (this.idxBuf) gl.deleteBuffer(this.idxBuf);
    if (this.quadBuf) gl.deleteBuffer(this.quadBuf);
    if (this.freqTex) gl.deleteTexture(this.freqTex);
  }
}

// ─── Starfield overlay (2D canvas on top of WebGL) ──────────────────────────
function renderStarfield(ctx, w, h, stars, time, beat) {
  for (const s of stars) {
    s.y = (s.y + s.speed * 16) % 1;
    const twinkle = 0.5 + Math.sin(time * 0.003 + s.x * 100) * 0.3 + beat.beatDecay * 0.2;
    ctx.fillStyle = `rgba(255,255,255,${s.brightness * twinkle})`;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VisualizerModule({ config = {}, moduleId }) {
  const canvasRef = useRef(null);
  const glCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const beatDetectorRef = useRef(null);
  const smoothedRef = useRef(null);
  const blobRendererRef = useRef(null);
  const networkDataRef = useRef(null);
  const [audioActive, setAudioActive] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);
  const [audioMode, setAudioMode] = useState(null); // 'mic' | 'network'

  const {
    mode = 'bars',
    sensitivity = 1.5,
    smoothing = 0.8,
    barCount = 64,
    backgroundColor,
    backgroundOpacity = 0,
    idleAnimation = true,
    audioSource = 'network',
  } = config;

  const isBlob = mode === 'blob';

  // Setup network audio listener
  useEffect(() => {
    if (audioSource === 'microphone') return;

    const socket = getSocket();
    const handler = (data) => {
      if (data.frequencyData) {
        networkDataRef.current = {
          frequencyData: new Uint8Array(data.frequencyData),
          waveformData: data.waveformData ? new Uint8Array(data.waveformData) : null,
          timestamp: data.timestamp,
        };
        if (!audioActive && audioMode !== 'mic') {
          setAudioActive(true);
          setAudioMode('network');
          setNeedsClick(false);
        }
      }
    };

    socket.on('visualizer_audio_data', handler);
    return () => { socket.off('visualizer_audio_data', handler); };
  }, [audioSource, audioActive, audioMode]);

  // Start mic audio
  const startAudio = useCallback(async () => {
    if (audioSource === 'network') {
      // Network only — don't request mic
      setAudioMode('network');
      setAudioActive(true);
      setNeedsClick(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = smoothing;
      source.connect(analyser);
      analyserRef.current = analyser;
      setAudioActive(true);
      setAudioMode('mic');
      setNeedsClick(false);

      // Broadcast audio data over WebSocket
      const socket = getSocket();
      const broadcastInterval = setInterval(() => {
        if (!analyserRef.current) return;
        const freq = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freq);
        // Downsample to 128 bins
        const binSize = Math.floor(freq.length / 128);
        const downsampled = [];
        for (let i = 0; i < 128; i++) {
          let sum = 0;
          for (let j = 0; j < binSize; j++) sum += freq[i * binSize + j];
          downsampled.push(Math.round(sum / binSize));
        }
        socket.emit('visualizer_audio_data', {
          studioId: socket.studioId || 'default',
          frequencyData: downsampled,
          timestamp: Date.now(),
        });
      }, 50);

      // Store interval for cleanup
      streamRef.current._broadcastInterval = broadcastInterval;
    } catch (err) {
      console.warn('Mic access failed, falling back to network mode:', err.message);
      if (audioSource === 'auto') {
        setAudioMode('network');
        setAudioActive(true);
        setNeedsClick(false);
      } else {
        setNeedsClick(true);
      }
    }
  }, [smoothing, audioSource]);

  // Auto-start or show click overlay
  useEffect(() => {
    if (audioSource === 'network') {
      setAudioMode('network');
      setAudioActive(true);
      return;
    }
    // For mic/auto, we need user gesture
    setNeedsClick(true);
  }, [audioSource]);

  // Cleanup audio
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        if (streamRef.current._broadcastInterval) clearInterval(streamRef.current._broadcastInterval);
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Initialize blob renderer
  useEffect(() => {
    if (!isBlob || !glCanvasRef.current) return;
    try {
      blobRendererRef.current = new BlobRenderer(glCanvasRef.current);
    } catch (e) {
      console.error('WebGL blob init failed:', e);
    }
    return () => {
      if (blobRendererRef.current) {
        blobRendererRef.current.destroy();
        blobRendererRef.current = null;
      }
    };
  }, [isBlob]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const glCanvas = glCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!beatDetectorRef.current) beatDetectorRef.current = createBeatDetector();

    let running = true;
    const startTime = performance.now();

    const render = () => {
      if (!running) return;
      const time = performance.now() - startTime;

      // Resize
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const dpr = 1; // Use 1 for performance on large screens
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';
        }
        if (glCanvas && (glCanvas.width !== rect.width || glCanvas.height !== rect.height)) {
          glCanvas.width = rect.width * dpr;
          glCanvas.height = rect.height * dpr;
          glCanvas.style.width = rect.width + 'px';
          glCanvas.style.height = rect.height + 'px';
        }
      }

      const w = canvas.width;
      const h = canvas.height;

      // Get frequency data
      let freqData;
      let isIdle = false;

      if (audioMode === 'mic' && analyserRef.current) {
        freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        // Check if truly silent
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        if (sum < freqData.length * 2) isIdle = true;
      } else if (audioMode === 'network' && networkDataRef.current) {
        freqData = networkDataRef.current.frequencyData;
        // Check staleness (>500ms old = idle)
        if (Date.now() - networkDataRef.current.timestamp > 500) isIdle = true;
      } else {
        isIdle = true;
      }

      if (isIdle && idleAnimation) {
        freqData = generateIdleData(128, time);
      } else if (!freqData) {
        freqData = new Uint8Array(128);
      }

      // Smooth
      const smoothed = smoothData(Array.from(freqData), smoothedRef.current, 1 - (smoothing || 0.8));
      smoothedRef.current = smoothed;

      const beat = beatDetectorRef.current.update(smoothed);

      // Background
      if (backgroundOpacity > 0 && backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.globalAlpha = backgroundOpacity;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      // Render mode
      if (mode === 'blob') {
        // WebGL blob renders on glCanvas, draw starfield on 2D canvas
        if (blobRendererRef.current) {
          ctx.clearRect(0, 0, w, h);
          // Dark background for stars
          ctx.fillStyle = `rgba(5, 5, 15, ${backgroundOpacity > 0 ? backgroundOpacity : 1})`;
          ctx.fillRect(0, 0, w, h);
          renderStarfield(ctx, w, h, blobRendererRef.current.stars, time, beat);
          blobRendererRef.current.render(smoothed, config, beat, time);
        }
      } else {
        switch (mode) {
          case 'circular':
            renderCircular(ctx, w, h, smoothed, config, beat, time);
            break;
          case 'wave':
            renderWave(ctx, w, h, smoothed, config, beat, time);
            break;
          case 'particles':
            renderParticles(ctx, w, h, smoothed, config, beat, time, moduleId);
            break;
          case 'spectrum':
            renderSpectrum(ctx, w, h, smoothed, config, beat, time);
            break;
          case 'bars':
          default:
            renderBars(ctx, w, h, smoothed, config, beat, time);
            break;
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mode, config, audioActive, audioMode, idleAnimation, smoothing, backgroundOpacity, backgroundColor, moduleId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ background: 'transparent', overflow: 'hidden' }}
    >
      {/* 2D Canvas (always present — used for all modes + starfield in blob mode) */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          zIndex: isBlob ? 1 : 2,
        }}
      />

      {/* WebGL Canvas (blob mode only) */}
      {isBlob && (
        <canvas
          ref={glCanvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            zIndex: 2,
          }}
        />
      )}

      {/* Click-to-start overlay */}
      {needsClick && audioSource !== 'network' && (
        <div
          onClick={startAudio}
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎵</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Click to enable audio visualizer</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.3rem' }}>Microphone access required</div>
          </div>
        </div>
      )}

      {/* Network sync indicator */}
      {audioMode === 'network' && audioActive && (
        <div
          style={{
            position: 'absolute', bottom: 8, right: 8, zIndex: 10,
            background: 'rgba(0,0,0,0.5)', borderRadius: 6,
            padding: '3px 8px', fontSize: '0.7rem', color: '#4ade80',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          🔗 Synced
        </div>
      )}
    </div>
  );
}
