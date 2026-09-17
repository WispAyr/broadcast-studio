import React, { useRef, useLayoutEffect } from 'react';

/**
 * GLSLShader — a Shadertoy-idiom fragment-shader runtime built for Remotion.
 *
 * Why raw WebGL2 (no three/regl): the offline renderer screenshots each frame
 * after React commits and the browser paints. We compile once, then draw
 * SYNCHRONOUSLY inside a layout effect keyed on every uniform — so the pixels
 * for frame N are on the canvas before Remotion captures frame N. No rAF, no
 * async loaders, no scene-graph timing to desync. `iTime` comes from the caller
 * (derived from useCurrentFrame), so a shader renders identically live and in
 * export, and seeking is exact.
 *
 * Authoring contract — each library shader supplies a body that defines
 *   void mainImage(out vec4 fragColor, in vec2 fragCoord)
 * exactly like Shadertoy, plus these extra uniforms it may read:
 *   uColors[8]/uColorCount + palette(t)  — the composition's brand palette
 *   uBg          background colour
 *   uScale, uSoftness, uDistortion, uRotation, uIntensity  — the studio knobs
 *   uAudio       0..1 audio amplitude (frame-deterministic, for reactivity)
 */

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Prepended to every library body. Provides the Shadertoy uniforms, our brand
// palette uniforms, the knobs, and a smooth palette() sampler.
const PREAMBLE = `#version 300 es
precision highp float;
uniform vec3  iResolution;
uniform float iTime;
uniform vec4  iMouse;
uniform vec3  uColors[8];
uniform int   uColorCount;
uniform vec3  uBg;
uniform float uScale;
uniform float uSoftness;
uniform float uDistortion;
uniform float uRotation;
uniform float uIntensity;
uniform float uAudio;
uniform vec4  uParam;         // up to 4 per-shader controls (x/y/z/w)
uniform float uSpectrum[16];  // audio spectrum, 16 bands 0..1 (0 = no audio)
out vec4 fragColor;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

// Smooth gradient across the brand palette, t in [0,1].
vec3 palette(float t){
  int n = uColorCount;
  if(n <= 0) return vec3(t);
  if(n == 1) return uColors[0];
  t = clamp(t, 0.0, 1.0) * float(n - 1);
  float f = floor(t);
  int i = int(f);
  int j = min(i + 1, n - 1);
  return mix(uColors[i], uColors[j], t - f);
}

// Hash / value-noise / fbm — the standard building blocks, authored here so the
// library shaders stay original and self-contained.
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash21(i);
  float b = hash21(i+vec2(1.0,0.0));
  float c = hash21(i+vec2(0.0,1.0));
  float d = hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<6;i++){ v += a*vnoise(p); p = rot(0.5)*p*2.0 + 3.1; a *= 0.5; }
  return v;
}
`;

const EPILOGUE = `
void main(){ mainImage(fragColor, gl_FragCoord.xy); }`;

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s || '000000', 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log || 'shader compile failed');
  }
  return sh;
}

const EMPTY4 = [0, 0, 0, 0];
const EMPTY16 = new Float32Array(16);

export function GLSLShader({
  frag,
  colors = ['#ffffff'],
  background = '#000000',
  scale = 1,
  softness = 0.6,
  distortion = 0.8,
  rotation = 0,
  intensity = 1,
  audio = 0,
  params = null,     // [x,y,z,w] per-shader controls → uParam
  spectrum = null,   // Float32Array(16) audio bands → uSpectrum
  timeMs = 0,
  style,
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);    // { gl, quad } — created ONCE for the canvas
  const progRef = useRef(null);  // { program, u } — rebuilt when `frag` changes

  // Acquire the WebGL2 context exactly once. Recreating a context after
  // WEBGL_lose_context permanently breaks the canvas, so context lifetime is
  // tied to mount, not to the shader body.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) {
      // eslint-disable-next-line no-console
      console.error('[GLSLShader] WebGL2 unavailable');
      return undefined;
    }
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    glRef.current = { gl, quad };
    return () => {
      gl.deleteBuffer(quad);
      glRef.current = null;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, []);

  // (Re)compile the program whenever the shader body changes — reusing the
  // existing context. Runs after the context effect on first mount.
  useLayoutEffect(() => {
    const ctx = glRef.current;
    if (!ctx) return undefined;
    const { gl, quad } = ctx;

    let program;
    try {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, PREAMBLE + '\n' + frag + '\n' + EPILOGUE);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'link failed');
      }
    } catch (e) {
      // Surface compile errors once; leave the canvas transparent rather than crash.
      // eslint-disable-next-line no-console
      console.error('[GLSLShader] compile error:', e.message);
      progRef.current = null;
      return undefined;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(program, n);
    progRef.current = {
      program,
      u: {
        iResolution: U('iResolution'),
        iTime: U('iTime'),
        iMouse: U('iMouse'),
        uColors: U('uColors'),
        uColorCount: U('uColorCount'),
        uBg: U('uBg'),
        uScale: U('uScale'),
        uSoftness: U('uSoftness'),
        uDistortion: U('uDistortion'),
        uRotation: U('uRotation'),
        uIntensity: U('uIntensity'),
        uAudio: U('uAudio'),
        uParam: U('uParam'),
        uSpectrum: U('uSpectrum'),
      },
    };

    return () => {
      gl.deleteProgram(program);
      progRef.current = null;
    };
  }, [frag]);

  // Draw synchronously on every prop/time change.
  useLayoutEffect(() => {
    const ctx = glRef.current;
    const prog = progRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !prog || !canvas) return;
    const { gl } = ctx;
    const { program, u } = prog;

    // Match the drawing buffer to the displayed pixels (dpr-aware).
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const w = Math.max(1, Math.round((canvas.clientWidth || 1280) * dpr));
    const h = Math.max(1, Math.round((canvas.clientHeight || 720) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);

    const pal = new Float32Array(24);
    const list = (colors && colors.length ? colors : ['#ffffff']).slice(0, 8);
    list.forEach((c, i) => {
      const [r, g, b] = hexToRgb(c);
      pal[i * 3] = r; pal[i * 3 + 1] = g; pal[i * 3 + 2] = b;
    });

    gl.uniform3f(u.iResolution, w, h, 1);
    gl.uniform1f(u.iTime, timeMs / 1000);
    gl.uniform4f(u.iMouse, 0, 0, 0, 0);
    gl.uniform3fv(u.uColors, pal);
    gl.uniform1i(u.uColorCount, list.length);
    const [br, bg, bb] = hexToRgb(background);
    gl.uniform3f(u.uBg, br, bg, bb);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uSoftness, softness);
    gl.uniform1f(u.uDistortion, distortion);
    gl.uniform1f(u.uRotation, (rotation * Math.PI) / 180);
    gl.uniform1f(u.uIntensity, intensity);
    gl.uniform1f(u.uAudio, audio);
    const p = params || EMPTY4;
    gl.uniform4f(u.uParam, p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0);
    gl.uniform1fv(u.uSpectrum, spectrum && spectrum.length === 16 ? spectrum : EMPTY16);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });

  return (
    <canvas
      ref={canvasRef}
      style={style || { width: '100%', height: '100%', display: 'block' }}
    />
  );
}

export default GLSLShader;
