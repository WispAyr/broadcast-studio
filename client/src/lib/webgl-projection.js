/**
 * WebGL-based projection mapping with corner-pin warping.
 *
 * Provides 4-point perspective transform, edge blending, mask opacity,
 * calibration persistence via localStorage, and an interactive setup UI
 * with draggable corner handles and a controls panel.
 *
 * Usage:
 *   const mapper = new ProjectionMapper(canvas, 'screen-1');
 *   mapper.setSourceTexture(offscreenCanvas);
 *   mapper.enableSetup();
 *   function loop() { mapper.render(); requestAnimationFrame(loop); }
 *   loop();
 */

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_maskOpacity;
uniform float u_edgeBlend;
void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  float edgeX = smoothstep(0.0, u_edgeBlend, v_texCoord.x) *
                smoothstep(0.0, u_edgeBlend, 1.0 - v_texCoord.x);
  float edgeY = smoothstep(0.0, u_edgeBlend, v_texCoord.y) *
                smoothstep(0.0, u_edgeBlend, 1.0 - v_texCoord.y);
  float edge = (u_edgeBlend > 0.0) ? edgeX * edgeY : 1.0;
  gl_FragColor = vec4(color.rgb, color.a * u_maskOpacity * edge);
}
`;

const GRID_SUBDIVISIONS = 20;

const DEFAULT_CORNERS = () => ({
  topLeft:     { x: 0, y: 0 },
  topRight:    { x: 1, y: 0 },
  bottomLeft:  { x: 0, y: 1 },
  bottomRight: { x: 1, y: 1 },
});

const DEFAULT_CALIBRATION = () => ({
  corners: DEFAULT_CORNERS(),
  scale: { x: 1, y: 1 },
  position: { x: 0, y: 0 },
  edgeBlend: 0,
  maskOpacity: 1,
});

const HANDLE_RADIUS = 20;
const HANDLE_COLORS = {
  topLeft:     '#ff4444',
  topRight:    '#44ff44',
  bottomLeft:  '#4488ff',
  bottomRight: '#ffaa00',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  // Shaders can be detached after linking
  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

/**
 * Bilinear interpolation of 4 corner positions for a grid vertex at (u, v)
 * where u, v are in [0, 1].
 */
function bilinearInterp(corners, u, v) {
  const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = corners;
  const x = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x +
            (1 - u) * v * bl.x       + u * v * br.x;
  const y = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y +
            (1 - u) * v * bl.y       + u * v * br.y;
  return { x, y };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// ProjectionMapper
// ---------------------------------------------------------------------------

export class ProjectionMapper {
  /**
   * @param {HTMLCanvasElement} canvas - The destination canvas for warped output.
   * @param {string} screenId - Unique identifier for this screen (used for localStorage key).
   */
  constructor(canvas, screenId) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('ProjectionMapper requires a valid HTMLCanvasElement');
    }
    this._canvas = canvas;
    this._screenId = screenId;
    this._storageKey = `broadcast_projection_${screenId}`;
    this._calibration = DEFAULT_CALIBRATION();
    this._setupActive = false;
    this._destroyed = false;

    // DOM references for setup UI
    this._handles = {};       // keyed by corner name
    this._labels = {};        // coordinate readouts
    this._controlsPanel = null;
    this._gridOverlay = null;
    this._sliders = {};

    // Source
    this._sourceCanvas = null;

    // WebGL init
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this._gl = gl;

    this._program = createProgram(gl, VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC);

    // Attribute / uniform locations
    this._aPosition = gl.getAttribLocation(this._program, 'a_position');
    this._aTexCoord = gl.getAttribLocation(this._program, 'a_texCoord');
    this._uTexture = gl.getUniformLocation(this._program, 'u_texture');
    this._uMaskOpacity = gl.getUniformLocation(this._program, 'u_maskOpacity');
    this._uEdgeBlend = gl.getUniformLocation(this._program, 'u_edgeBlend');

    // Buffers
    this._posBuffer = gl.createBuffer();
    this._texBuffer = gl.createBuffer();
    this._indexBuffer = gl.createBuffer();

    // Texture
    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Generate static index buffer and tex-coord buffer (grid topology never changes)
    this._indexCount = 0;
    this._buildStaticBuffers();
    this._buildPositionBuffer();

    // Attempt to load saved calibration
    this.loadCalibration();
  }

  // -----------------------------------------------------------------------
  // Core rendering
  // -----------------------------------------------------------------------

  /**
   * Set the source HTML canvas whose content will be texture-mapped and warped.
   * @param {HTMLCanvasElement} sourceCanvas
   */
  setSourceTexture(sourceCanvas) {
    this._sourceCanvas = sourceCanvas;
  }

  /** Render the warped output to the destination canvas. */
  render() {
    if (this._destroyed) return;
    const gl = this._gl;
    const canvas = this._canvas;

    // Resize viewport if needed
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!this._sourceCanvas) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Upload source texture
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._sourceCanvas);

    gl.useProgram(this._program);

    // Uniforms
    gl.uniform1i(this._uTexture, 0);
    gl.uniform1f(this._uMaskOpacity, this._calibration.maskOpacity);
    gl.uniform1f(this._uEdgeBlend, this._calibration.edgeBlend);

    // Position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuffer);
    gl.enableVertexAttribArray(this._aPosition);
    gl.vertexAttribPointer(this._aPosition, 2, gl.FLOAT, false, 0, 0);

    // TexCoord attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
    gl.enableVertexAttribArray(this._aTexCoord);
    gl.vertexAttribPointer(this._aTexCoord, 2, gl.FLOAT, false, 0, 0);

    // Index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.drawElements(gl.TRIANGLES, this._indexCount, gl.UNSIGNED_SHORT, 0);

    gl.disableVertexAttribArray(this._aPosition);
    gl.disableVertexAttribArray(this._aTexCoord);
  }

  // -----------------------------------------------------------------------
  // Calibration
  // -----------------------------------------------------------------------

  /** Load calibration from localStorage. Returns true if found. */
  loadCalibration() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw) {
        const cal = JSON.parse(raw);
        this.setCalibration(cal);
        return true;
      }
    } catch (e) {
      console.warn(`ProjectionMapper: failed to load calibration for "${this._screenId}"`, e);
    }
    return false;
  }

  /** Save current calibration to localStorage. */
  saveCalibration() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this._calibration));
    } catch (e) {
      console.warn(`ProjectionMapper: failed to save calibration for "${this._screenId}"`, e);
    }
  }

  /** Reset calibration to defaults (no warp). */
  resetCalibration() {
    this._calibration = DEFAULT_CALIBRATION();
    this._buildPositionBuffer();
    this._syncSetupUI();
  }

  /**
   * Get a copy of the current calibration.
   * @returns {{ corners, scale, position, edgeBlend, maskOpacity }}
   */
  getCalibration() {
    return JSON.parse(JSON.stringify(this._calibration));
  }

  /**
   * Set calibration programmatically.
   * @param {object} cal - Partial or full calibration object.
   */
  setCalibration(cal) {
    if (!cal) return;
    const c = this._calibration;
    if (cal.corners) {
      for (const key of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
        if (cal.corners[key]) {
          c.corners[key] = { x: cal.corners[key].x, y: cal.corners[key].y };
        }
      }
    }
    if (cal.scale) {
      c.scale.x = cal.scale.x ?? c.scale.x;
      c.scale.y = cal.scale.y ?? c.scale.y;
    }
    if (cal.position) {
      c.position.x = cal.position.x ?? c.position.x;
      c.position.y = cal.position.y ?? c.position.y;
    }
    if (cal.edgeBlend !== undefined) c.edgeBlend = cal.edgeBlend;
    if (cal.maskOpacity !== undefined) c.maskOpacity = cal.maskOpacity;
    this._buildPositionBuffer();
    this._syncSetupUI();
  }

  // -----------------------------------------------------------------------
  // Setup mode
  // -----------------------------------------------------------------------

  /** Show interactive setup UI: corner handles, grid overlay, controls panel. */
  enableSetup() {
    if (this._setupActive) return;
    this._setupActive = true;
    this._createSetupUI();
    this._syncSetupUI();
  }

  /** Hide setup UI. */
  disableSetup() {
    if (!this._setupActive) return;
    this._setupActive = false;
    this._removeSetupUI();
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /** Release all WebGL resources and remove setup UI. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.disableSetup();

    const gl = this._gl;
    if (gl) {
      gl.deleteBuffer(this._posBuffer);
      gl.deleteBuffer(this._texBuffer);
      gl.deleteBuffer(this._indexBuffer);
      gl.deleteTexture(this._texture);
      gl.deleteProgram(this._program);
    }

    this._gl = null;
    this._canvas = null;
    this._sourceCanvas = null;
  }

  // -----------------------------------------------------------------------
  // Internal: mesh / buffer generation
  // -----------------------------------------------------------------------

  /** Build the static tex-coord buffer and index buffer for the subdivision grid. */
  _buildStaticBuffers() {
    const gl = this._gl;
    const n = GRID_SUBDIVISIONS;
    const texCoords = new Float32Array((n + 1) * (n + 1) * 2);
    let ti = 0;
    for (let row = 0; row <= n; row++) {
      for (let col = 0; col <= n; col++) {
        texCoords[ti++] = col / n;
        texCoords[ti++] = row / n;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // Index buffer (two triangles per cell)
    const indices = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const i = row * (n + 1) + col;
        indices.push(i, i + 1, i + (n + 1));
        indices.push(i + 1, i + (n + 1) + 1, i + (n + 1));
      }
    }
    this._indexCount = indices.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  /**
   * Rebuild the position buffer from current calibration (corners + scale + position).
   * Each grid vertex is bilinearly interpolated from the 4 corners, then scale/position
   * are applied.
   */
  _buildPositionBuffer() {
    if (this._destroyed) return;
    const gl = this._gl;
    const n = GRID_SUBDIVISIONS;
    const { corners, scale, position } = this._calibration;
    const positions = new Float32Array((n + 1) * (n + 1) * 2);
    let pi = 0;
    for (let row = 0; row <= n; row++) {
      for (let col = 0; col <= n; col++) {
        const u = col / n;
        const v = row / n;
        const p = bilinearInterp(corners, u, v);
        // Apply scale around center (0.5, 0.5) then offset
        positions[pi++] = (p.x - 0.5) * scale.x + 0.5 + position.x;
        positions[pi++] = (p.y - 0.5) * scale.y + 0.5 + position.y;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  }

  // -----------------------------------------------------------------------
  // Internal: Setup UI creation / management
  // -----------------------------------------------------------------------

  _createSetupUI() {
    const parent = this._canvas.parentElement || document.body;
    // Ensure parent is position-relative so absolute children align
    const parentPos = getComputedStyle(parent).position;
    if (parentPos === 'static') {
      parent.style.position = 'relative';
    }

    // Grid overlay canvas
    this._gridOverlay = document.createElement('canvas');
    Object.assign(this._gridOverlay.style, {
      position: 'absolute',
      top: this._canvas.offsetTop + 'px',
      left: this._canvas.offsetLeft + 'px',
      width: this._canvas.clientWidth + 'px',
      height: this._canvas.clientHeight + 'px',
      pointerEvents: 'none',
      zIndex: '1000',
    });
    this._gridOverlay.width = this._canvas.clientWidth;
    this._gridOverlay.height = this._canvas.clientHeight;
    parent.appendChild(this._gridOverlay);

    // Corner handles
    const cornerNames = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    for (const name of cornerNames) {
      // Handle element
      const handle = document.createElement('div');
      handle.dataset.corner = name;
      Object.assign(handle.style, {
        position: 'absolute',
        width: HANDLE_RADIUS * 2 + 'px',
        height: HANDLE_RADIUS * 2 + 'px',
        borderRadius: '50%',
        background: HANDLE_COLORS[name],
        opacity: '0.85',
        cursor: 'grab',
        zIndex: '1002',
        border: '2px solid #fff',
        boxSizing: 'border-box',
        transform: 'translate(-50%, -50%)',
        userSelect: 'none',
        touchAction: 'none',
      });
      parent.appendChild(handle);
      this._handles[name] = handle;

      // Coordinate label
      const label = document.createElement('span');
      Object.assign(label.style, {
        position: 'absolute',
        color: HANDLE_COLORS[name],
        fontSize: '11px',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.7)',
        padding: '1px 4px',
        borderRadius: '3px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: '1003',
        transform: 'translate(-50%, 0)',
      });
      parent.appendChild(label);
      this._labels[name] = label;

      // Drag handling
      this._attachDrag(handle, name);
    }

    // Controls panel
    this._createControlsPanel(parent);
  }

  _removeSetupUI() {
    for (const el of Object.values(this._handles)) el.remove();
    for (const el of Object.values(this._labels)) el.remove();
    if (this._gridOverlay) this._gridOverlay.remove();
    if (this._controlsPanel) this._controlsPanel.remove();
    this._handles = {};
    this._labels = {};
    this._gridOverlay = null;
    this._controlsPanel = null;
    this._sliders = {};
  }

  /** Synchronize the UI elements with the current calibration state. */
  _syncSetupUI() {
    if (!this._setupActive) return;
    this._positionHandles();
    this._drawGrid();
    this._syncSliders();
  }

  _positionHandles() {
    const rect = this._canvas.getBoundingClientRect();
    const parentRect = (this._canvas.parentElement || document.body).getBoundingClientRect();
    const offsetX = rect.left - parentRect.left;
    const offsetY = rect.top - parentRect.top;
    const w = rect.width;
    const h = rect.height;

    for (const [name, handle] of Object.entries(this._handles)) {
      const c = this._calibration.corners[name];
      const px = offsetX + c.x * w;
      const py = offsetY + c.y * h;
      handle.style.left = px + 'px';
      handle.style.top = py + 'px';

      const label = this._labels[name];
      if (label) {
        label.textContent = `${c.x.toFixed(3)}, ${c.y.toFixed(3)}`;
        label.style.left = px + 'px';
        label.style.top = (py + HANDLE_RADIUS + 4) + 'px';
      }
    }
  }

  _drawGrid() {
    const overlay = this._gridOverlay;
    if (!overlay) return;
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (overlay.width !== w) overlay.width = w;
    if (overlay.height !== h) overlay.height = h;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;

    const { corners } = this._calibration;
    const n = GRID_SUBDIVISIONS;

    // Draw horizontal lines
    for (let row = 0; row <= n; row++) {
      ctx.beginPath();
      for (let col = 0; col <= n; col++) {
        const p = bilinearInterp(corners, col / n, row / n);
        const px = p.x * w;
        const py = p.y * h;
        if (col === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Draw vertical lines
    for (let col = 0; col <= n; col++) {
      ctx.beginPath();
      for (let row = 0; row <= n; row++) {
        const p = bilinearInterp(corners, col / n, row / n);
        const px = p.x * w;
        const py = p.y * h;
        if (row === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  _attachDrag(handle, cornerName) {
    let dragging = false;

    const onPointerDown = (e) => {
      e.preventDefault();
      dragging = true;
      handle.style.cursor = 'grabbing';
      handle.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const rect = this._canvas.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      this._calibration.corners[cornerName] = { x, y };
      this._buildPositionBuffer();
      this._positionHandles();
      this._drawGrid();
    };

    const onPointerUp = () => {
      dragging = false;
      handle.style.cursor = 'grab';
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);

    // Store references for potential cleanup
    handle._cleanupDrag = () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
    };
  }

  // -----------------------------------------------------------------------
  // Controls panel
  // -----------------------------------------------------------------------

  _createControlsPanel(parent) {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'absolute',
      top: (this._canvas.offsetTop + 8) + 'px',
      right: '8px',
      width: '220px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#eee',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      padding: '12px',
      borderRadius: '8px',
      zIndex: '1004',
      userSelect: 'none',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    });

    const title = document.createElement('div');
    title.textContent = `Projection: ${this._screenId}`;
    Object.assign(title.style, {
      fontWeight: 'bold',
      fontSize: '13px',
      marginBottom: '10px',
      borderBottom: '1px solid rgba(255,255,255,0.2)',
      paddingBottom: '6px',
    });
    panel.appendChild(title);

    // Slider definitions
    const sliderDefs = [
      { key: 'scaleX',      label: 'Scale X',     min: 0.5, max: 2.0, step: 0.01, initial: this._calibration.scale.x },
      { key: 'scaleY',      label: 'Scale Y',     min: 0.5, max: 2.0, step: 0.01, initial: this._calibration.scale.y },
      { key: 'positionX',   label: 'Position X',  min: -0.5, max: 0.5, step: 0.005, initial: this._calibration.position.x },
      { key: 'positionY',   label: 'Position Y',  min: -0.5, max: 0.5, step: 0.005, initial: this._calibration.position.y },
      { key: 'edgeBlend',   label: 'Edge Blend',  min: 0, max: 0.2, step: 0.005, initial: this._calibration.edgeBlend },
      { key: 'maskOpacity', label: 'Mask Opacity', min: 0, max: 1, step: 0.01, initial: this._calibration.maskOpacity },
    ];

    for (const def of sliderDefs) {
      const row = document.createElement('div');
      row.style.marginBottom = '6px';

      const labelRow = document.createElement('div');
      labelRow.style.display = 'flex';
      labelRow.style.justifyContent = 'space-between';
      labelRow.style.marginBottom = '2px';

      const lbl = document.createElement('span');
      lbl.textContent = def.label;

      const valSpan = document.createElement('span');
      valSpan.style.fontFamily = 'monospace';
      valSpan.textContent = def.initial.toFixed(3);

      labelRow.appendChild(lbl);
      labelRow.appendChild(valSpan);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = def.min;
      input.max = def.max;
      input.step = def.step;
      input.value = def.initial;
      Object.assign(input.style, {
        width: '100%',
        accentColor: '#4488ff',
      });

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        valSpan.textContent = v.toFixed(3);
        this._applySlider(def.key, v);
      });

      row.appendChild(labelRow);
      row.appendChild(input);
      panel.appendChild(row);

      this._sliders[def.key] = { input, valSpan };
    }

    // Button row
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '6px',
      marginTop: '10px',
    });

    const makeBtn = (text, onClick) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      Object.assign(btn.style, {
        flex: '1',
        padding: '6px 0',
        border: '1px solid rgba(255,255,255,0.3)',
        background: 'rgba(255,255,255,0.1)',
        color: '#eee',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'inherit',
      });
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.2)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
      btn.addEventListener('click', onClick);
      return btn;
    };

    btnRow.appendChild(makeBtn('Reset', () => {
      this.resetCalibration();
    }));
    btnRow.appendChild(makeBtn('Save', () => {
      this.saveCalibration();
    }));

    panel.appendChild(btnRow);
    parent.appendChild(panel);
    this._controlsPanel = panel;
  }

  _applySlider(key, value) {
    const cal = this._calibration;
    switch (key) {
      case 'scaleX':      cal.scale.x = value; break;
      case 'scaleY':      cal.scale.y = value; break;
      case 'positionX':   cal.position.x = value; break;
      case 'positionY':   cal.position.y = value; break;
      case 'edgeBlend':   cal.edgeBlend = value; break;
      case 'maskOpacity': cal.maskOpacity = value; break;
    }
    this._buildPositionBuffer();
  }

  _syncSliders() {
    if (!this._controlsPanel) return;
    const cal = this._calibration;
    const mapping = {
      scaleX: cal.scale.x,
      scaleY: cal.scale.y,
      positionX: cal.position.x,
      positionY: cal.position.y,
      edgeBlend: cal.edgeBlend,
      maskOpacity: cal.maskOpacity,
    };
    for (const [key, val] of Object.entries(mapping)) {
      const s = this._sliders[key];
      if (s) {
        s.input.value = val;
        s.valSpan.textContent = val.toFixed(3);
      }
    }
  }
}

export default ProjectionMapper;
