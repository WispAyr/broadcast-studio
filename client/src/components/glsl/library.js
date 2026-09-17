/**
 * Broadcast-grade GLSL shader library.
 *
 * Each entry is an ORIGINAL fragment-shader body in Shadertoy idiom — it defines
 *   void mainImage(out vec4 fragColor, in vec2 fragCoord)
 * and may read the uniforms in GLSLShader.jsx (iTime, iResolution, palette()/
 * uColors, uBg, uScale, uSoftness, uDistortion, uRotation, uIntensity, uAudio,
 * uParam, uSpectrum[16]). Colours come from the composition's brand palette.
 *
 * Per-shader controls: an optional `controls` array declares dedicated sliders
 * whose values map, in order, to uParam.x/y/z/w — so shader-specific knobs
 * (segments, glow, scanlines…) get real controls instead of overloading the
 * five generic knobs. No third-party shader code is embedded.
 *
 * `id`s here are merged into the SHADERS list, so they appear automatically in
 * the Shader Studio and in every composition's `shaderBg` backdrop selector.
 */

const UV = `vec2 uv = (fragCoord - 0.5*iResolution.xy) / iResolution.y;`;

export const GLSL_LIBRARY = {
  aurora: {
    label: 'aurora ✦',
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv;
  float t = iTime * 0.15;
  vec2 p = uv * (1.6 / uScale);
  vec3 col = uBg;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float y = p.y + 0.18*fi - 0.2;
    float n = fbm(vec2(p.x*1.4 + t*(1.0+0.15*fi) + fi*11.0, t*0.4 + fi));
    float w = 0.35 + 0.55*uDistortion;
    float band = smoothstep(0.55, 0.0, abs(y + (n-0.5)*1.3*w));
    band *= 1.0 + uAudio*0.8;
    float hue = fract(0.16*fi + n*0.55 + t*0.5);
    col += palette(hue) * band * (0.55 + 0.2*uSoftness);
  }
  col = mix(col, uBg, smoothstep(0.45, 1.15, abs(uv.y)));
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  'plasma-flow': {
    label: 'plasma-flow ✦',
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  vec2 uv = fragCoord/iResolution.xy;
  vec2 p = (uv - 0.5); p.x *= iResolution.x/iResolution.y;
  p = rot(uRotation) * p / uScale;
  float t = iTime * 0.10;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + (1.5+1.5*uDistortion)*q + vec2(1.7,9.2) + t*1.2),
                fbm(p + (1.5+1.5*uDistortion)*q + vec2(8.3,2.8) - t*0.8));
  float f = fbm(p + (2.0+2.0*uDistortion)*r);
  float shade = clamp(f*f*2.2 + 0.35*r.x + 0.15*sin(t*2.0), 0.0, 1.0);
  vec3 col = palette(shade);
  col = mix(uBg, col, smoothstep(-0.1, 0.55, f + 0.25));
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  nebula: {
    label: 'nebula ✦',
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv;
  vec2 p = uv * (1.4 / uScale);
  float t = iTime * 0.08;
  vec3 col = uBg;
  for(int i=0;i<5;i++){
    float fi = float(i);
    float n = fbm(p*(1.0+0.35*fi) + vec2(t*(0.5+0.12*fi), -t*0.3) + fi*7.0);
    n = pow(n, 1.6 + uDistortion);
    col += palette(fract(0.12*fi + n + 0.2*t)) * n * (0.30 + 0.1*uSoftness);
  }
  col += palette(0.92) * pow(max(0.0, 1.0 - length(uv)*0.75), 3.0) * 0.35;
  float star = step(0.995, hash21(floor(fragCoord*0.5)));
  col += vec3(star) * (0.6 + 0.4*sin(iTime*3.0 + fragCoord.x));
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  kaleidoscope: {
    label: 'kaleidoscope ✦',
    controls: [
      { key: 'segments', label: 'Segments', min: 3, max: 16, step: 1, default: 6 },
      { key: 'twist', label: 'Twist', min: 0, max: 2, step: 0.05, default: 0.5 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float seg = max(3.0, uParam.x);
  a = mod(a, TAU/seg);
  a = abs(a - TAU/(seg*2.0));
  vec2 p = vec2(cos(a), sin(a)) * r;
  p = rot(iTime*0.10 + uRotation + r*uParam.y*2.0) * p / uScale;
  float t = iTime * 0.2;
  float f = fbm(p*3.0 + t) + 0.5*sin(r*10.0 - t*2.0 + uDistortion*6.0);
  vec3 col = palette(fract(f*0.7 + 0.1*t));
  col = mix(col, uBg, smoothstep(0.9, 1.4, r));
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  'warp-tunnel': {
    label: 'warp-tunnel ✦',
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float depth = 1.0/(r*uScale + 0.05) + iTime*0.6*(1.0 + uAudio);
  float u = a/TAU;
  float n = fbm(vec2(u*8.0, depth));
  float stripes = smoothstep(0.35, 0.65, fract(depth + n));
  vec3 col = palette(fract(depth*0.18 + n*0.35));
  col *= 0.55 + 0.75*stripes;
  col *= smoothstep(0.0, 0.32, r);
  col = mix(uBg, col, smoothstep(0.0, 0.25, r));
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  caustics: {
    label: 'caustics ✦',
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  vec2 uv = (fragCoord/iResolution.xy) * vec2(iResolution.x/iResolution.y, 1.0) * (3.0/uScale);
  uv = rot(uRotation) * uv;
  float t = iTime * 0.4;
  vec2 p = uv;
  float c = 0.0;
  for(int i=0;i<3;i++){
    vec2 q = p + vec2(fbm(p + t), fbm(p - t));
    float d = abs(sin(q.x*2.0) + cos(q.y*2.0));
    c += 1.0 / (d + 0.3 - 0.15*uDistortion);
    p = q * 1.35;
  }
  c *= 0.17;
  vec3 col = mix(uBg, palette(clamp(c, 0.0, 1.0)), clamp(c, 0.0, 1.0));
  col += palette(0.85) * pow(clamp(c - 0.6, 0.0, 1.0), 3.0) * 1.5;
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  'voronoi-glow': {
    label: 'voronoi-glow ✦',
    controls: [
      { key: 'glow', label: 'Edge Glow', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'contrast', label: 'Cell Contrast', min: 0, max: 1, step: 0.01, default: 0.6 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv * (3.0/uScale);
  float t = iTime * 0.5;
  vec2 g = floor(uv), f = fract(uv);
  float md = 8.0; vec2 mp = vec2(0.0);
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 o = vec2(float(x), float(y));
      vec2 rnd = 0.5 + 0.5*sin(t + TAU*hash21(g+o)*vec2(1.0,1.3));
      vec2 rr = o + rnd - f;
      float d = dot(rr, rr);
      if(d < md){ md = d; mp = g + o; }
    }
  }
  float edge = sqrt(md);
  vec3 col = palette(fract(hash21(mp)));
  col *= mix(1.0, 0.35 + 0.65*smoothstep(0.0, 0.55, edge), uParam.y);
  col += palette(0.9) * smoothstep(0.03 + 0.22*uParam.x, 0.0, edge) * (1.0 + uAudio);
  col = mix(uBg, col, 0.9);
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  'liquid-mesh': {
    label: 'liquid-mesh ✦',
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  vec2 uv = fragCoord/iResolution.xy;
  vec2 p = (uv - 0.5); p.x *= iResolution.x/iResolution.y;
  p = rot(uRotation) * p / uScale + 0.5;
  float t = iTime * 0.06;
  p += 0.28*uDistortion * vec2(fbm(p*2.0 + t), fbm(p*2.0 - t + 5.0));
  float m = fbm(p*1.2 + vec2(t, -t))*0.6 + 0.4*fbm(p*2.6 - t);
  vec3 col = palette(smoothstep(0.15, 0.85, m));
  col = mix(col, palette(fract(m + 0.3)), 0.5 + 0.5*sin(t + m*6.2831));
  col = mix(uBg, col, 0.92 + 0.08*uSoftness);
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  // ── New shaders demonstrating the per-shader control system ────────────────

  'hex-grid': {
    label: 'hex-grid ✦',
    controls: [
      { key: 'density', label: 'Density', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'edge', label: 'Edge', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'pulse', label: 'Pulse Speed', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv;
  float dens = mix(3.0, 16.0, clamp(uParam.x, 0.0, 1.0));
  uv *= dens / uScale;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  vec2 id = uv - gv;
  vec2 pp = abs(gv);
  float ed = max(dot(pp, normalize(vec2(1.0, 1.7320508))), pp.x);
  float cell = hash21(id);
  float pulse = 0.5 + 0.5*sin(iTime*(0.5 + 2.0*uParam.z) - length(id)*0.35 + cell*TAU);
  vec3 col = palette(fract(cell*0.7 + iTime*0.03)) * (0.22 + 0.78*pulse);
  float edge = smoothstep(0.5, 0.5 - 0.04 - 0.12*uParam.y, ed);
  col += palette(0.85) * edge * (0.4 + 0.8*uParam.y) * (1.0 + uAudio);
  col = mix(uBg, col, 0.9);
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  'ridged-fractal': {
    label: 'ridged-fractal ✦',
    controls: [
      { key: 'sharpness', label: 'Sharpness', min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: 'warp', label: 'Warp', min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv / uScale;
  float t = iTime * 0.06;
  vec2 p = uv * 1.6 + vec2(t, -t*0.5);
  p += (0.2 + 1.2*uParam.y) * vec2(fbm(p + t), fbm(p + 3.7 - t));
  float rr = 0.0, amp = 0.55, freq = 1.0;
  for(int i=0;i<6;i++){
    float n = 1.0 - abs(2.0*vnoise(p*freq) - 1.0);
    n = pow(n, 1.0 + 3.0*uParam.x);
    rr += amp*n;
    freq *= 2.0; amp *= 0.5;
  }
  vec3 col = palette(clamp(rr, 0.0, 1.0));
  col = mix(uBg, col, smoothstep(0.08, 0.7, rr));
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  starfield: {
    label: 'starfield ✦',
    controls: [
      { key: 'density', label: 'Density', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'speed', label: 'Speed', min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: 'streak', label: 'Streak', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  ${UV}
  uv = rot(uRotation) * uv;
  vec3 col = uBg;
  float speed = 0.15 + 1.4*uParam.y;
  float dens = mix(0.8, 2.2, uParam.x);
  for(int i=0;i<90;i++){
    float fi = float(i);
    float seed = hash21(vec2(fi, 7.0));
    float ang = seed * TAU + fi;
    vec2 dir = vec2(cos(ang), sin(ang));
    float z = fract(seed + iTime*speed*(0.6 + seed));
    vec2 pos = dir * z * 1.7 * dens;
    vec2 rel = uv - pos;
    float along = dot(rel, dir);
    float perp = dot(rel, vec2(-dir.y, dir.x));
    float stretch = 1.0 + 8.0*uParam.z*z;
    float d = length(vec2(along, perp*stretch));
    col += palette(fract(seed*0.6)) * (0.016 * z * z / (d + 0.012));
  }
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  crt: {
    label: 'crt ✦',
    controls: [
      { key: 'scanlines', label: 'Scanlines', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'curvature', label: 'Curvature', min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: 'aberration', label: 'Aberration', min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  vec2 uv = fragCoord/iResolution.xy;
  vec2 cc = uv*2.0 - 1.0;
  float cur = 0.05 + 0.5*uParam.y;
  cc *= 1.0 + cur * dot(cc,cc) * 0.35;
  vec2 s = cc*0.5 + 0.5;
  float t = iTime * 0.1;
  float ab = 0.002 + 0.03*uParam.z;
  vec3 col;
  col.r = palette(fract(fbm((s + vec2(ab, 0.0))*2.0/uScale + vec2(t, -t)))).r;
  col.g = palette(fract(fbm( s               *2.0/uScale + vec2(t, -t)))).g;
  col.b = palette(fract(fbm((s - vec2(ab, 0.0))*2.0/uScale + vec2(t, -t)))).b;
  float lines = mix(120.0, 800.0, uParam.x);
  float scan = 0.5 + 0.5*sin(s.y * lines * PI);
  col *= 0.75 + 0.25*scan;
  col *= smoothstep(1.3, 0.25, dot(cc,cc));
  if(s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) col = uBg;
  O = vec4(col * uIntensity, 1.0);
}`,
  },

  'spectrum-bars': {
    label: 'spectrum-bars ✦',
    controls: [
      { key: 'bars', label: 'Bars', min: 0, max: 1, step: 0.01, default: 1.0 },
      { key: 'height', label: 'Height', min: 0, max: 1, step: 0.01, default: 0.6 },
    ],
    frag: `
void mainImage(out vec4 O, in vec2 fragCoord){
  vec2 uv = fragCoord/iResolution.xy;
  float barsF = mix(8.0, 16.0, clamp(uParam.x, 0.0, 1.0));
  int bars = int(barsF);
  float fx = uv.x * float(bars);
  int bi = clamp(int(floor(fx)), 0, 15);
  float real = uSpectrum[bi];
  float synth = (0.12 + 0.55 * pow(0.5 + 0.5*sin(iTime*2.5 + float(bi)*0.8), 2.0))
              * (0.6 + 0.4*vnoise(vec2(float(bi), iTime*0.7)));
  float amp = real > 0.001 ? max(real, synth*0.25) : synth;
  amp = clamp(amp * (0.4 + 0.6*uParam.y), 0.0, 1.0);
  float e = fract(fx);
  float inbar = smoothstep(0.0, 0.08, e) * (1.0 - smoothstep(0.92, 1.0, e));
  float bar = step(1.0 - amp, uv.y);
  vec3 barCol = palette(uv.x);
  vec3 col = barCol * bar * inbar;
  col += barCol * smoothstep(0.0, 0.12, uv.y) * amp * 0.25 * inbar;
  col = mix(uBg, col, max(bar*inbar, 0.15));
  O = vec4(col * uIntensity, 1.0);
}`,
  },
};

// Ordered list of GLSL shader ids, in the order they should appear.
export const GLSL_SHADERS = Object.keys(GLSL_LIBRARY);

export const isGLSLShader = (id) => Object.prototype.hasOwnProperty.call(GLSL_LIBRARY, id);

/** The per-shader control descriptors (empty array if the shader has none). */
export const glslControls = (id) => (GLSL_LIBRARY[id] && GLSL_LIBRARY[id].controls) || [];

/** Default values for a shader's controls as a plain object keyed by control key. */
export function glslDefaults(id) {
  const out = {};
  glslControls(id).forEach((c) => { out[c.key] = c.default; });
  return out;
}

/** Resolve a control-values object to the [x,y,z,w] vector uploaded as uParam. */
export function glslParamVec(id, values) {
  const out = [0, 0, 0, 0];
  glslControls(id).forEach((c, i) => {
    if (i > 3) return;
    const v = values && values[c.key] != null ? values[c.key] : c.default;
    out[i] = Number(v);
  });
  return out;
}
