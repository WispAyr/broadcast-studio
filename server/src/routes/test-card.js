const express = require('express');
const router = express.Router();

const PATTERNS = {
  smpte: 'SMPTE Colour Bars',
  grid: 'Alignment Grid',
  gradient: 'Gradient Ramps',
  focus: 'Focus & Sharpness',
  white: 'Solid White',
  black: 'Solid Black',
  red: 'Solid Red',
  green: 'Solid Green',
  blue: 'Solid Blue',
  bounce: 'Burn-in Test',
};

function baseHTML(title, width, height, name, bodyContent) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>${title} — Local Connect</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; background: #000; font-family: 'Inter', sans-serif; overflow: hidden; }
  .branding { position: absolute; z-index: 100; text-align: center; }
  .branding h1 { font-size: ${Math.max(width, height) * 0.035}px; font-weight: 900; color: #fff; letter-spacing: 0.15em; text-shadow: 0 2px 20px rgba(0,0,0,0.8); }
  .branding p { font-size: ${Math.max(width, height) * 0.014}px; color: #14b8a6; font-weight: 600; letter-spacing: 0.1em; margin-top: 4px; }
  .branding .meta { font-size: ${Math.max(width, height) * 0.012}px; color: rgba(255,255,255,0.5); margin-top: 8px; }
  .clock { position: absolute; bottom: 20px; right: 20px; font-size: ${Math.max(width, height) * 0.018}px; color: #14b8a6; font-weight: 600; font-variant-numeric: tabular-nums; z-index: 100; }
  .screen-info { position: absolute; top: 20px; left: 20px; font-size: ${Math.max(width, height) * 0.012}px; color: rgba(255,255,255,0.4); z-index: 100; }
</style>
</head><body>
<div class="screen-info">${name} &bull; ${width}&times;${height}</div>
<div class="clock" id="clock"></div>
${bodyContent}
<script>
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-GB');
}
updateClock();
setInterval(updateClock, 1000);
</script>
</body></html>`;
}

router.get('/patterns', (req, res) => {
  res.json(PATTERNS);
});

router.get('/:pattern', (req, res) => {
  const { pattern } = req.params;
  const width = parseInt(req.query.width) || 1920;
  const height = parseInt(req.query.height) || 1080;
  const name = req.query.name || 'Screen';

  if (!PATTERNS[pattern]) {
    return res.status(404).json({ error: 'Unknown pattern', available: Object.keys(PATTERNS) });
  }

  let body = '';

  switch (pattern) {
    case 'smpte':
      body = `
<style>
  .bars { display: flex; width: 100%; height: 75%; }
  .bar { flex: 1; }
  .sub-bars { display: flex; width: 100%; height: 25%; }
  .sub-bar { flex: 1; }
  .branding { bottom: 28%; left: 50%; transform: translateX(-50%); }
</style>
<div class="bars">
  <div class="bar" style="background:#c0c0c0"></div>
  <div class="bar" style="background:#c0c000"></div>
  <div class="bar" style="background:#00c0c0"></div>
  <div class="bar" style="background:#00c000"></div>
  <div class="bar" style="background:#c000c0"></div>
  <div class="bar" style="background:#c00000"></div>
  <div class="bar" style="background:#0000c0"></div>
</div>
<div class="sub-bars">
  <div class="sub-bar" style="background:#0000c0"></div>
  <div class="sub-bar" style="background:#131313"></div>
  <div class="sub-bar" style="background:#c000c0"></div>
  <div class="sub-bar" style="background:#131313"></div>
  <div class="sub-bar" style="background:#00c0c0"></div>
  <div class="sub-bar" style="background:#131313"></div>
  <div class="sub-bar" style="background:#c0c0c0"></div>
</div>
<div class="branding">
  <h1>LOCAL CONNECT</h1>
  <p>Broadcast Studio &bull; Screen Calibration</p>
</div>`;
      break;

    case 'grid':
      const gridSpacing = Math.round(Math.min(width, height) / 20);
      body = `
<style>
  canvas { position: absolute; top: 0; left: 0; }
  .branding { top: 50%; left: 50%; transform: translate(-50%, -50%); }
</style>
<canvas id="grid" width="${width}" height="${height}"></canvas>
<div class="branding">
  <h1>LOCAL CONNECT</h1>
  <p>Broadcast Studio &bull; Alignment Grid</p>
  <p class="meta">${width}&times;${height} &bull; Grid: ${gridSpacing}px</p>
</div>
<script>
const c = document.getElementById('grid');
const ctx = c.getContext('2d');
const w = ${width}, h = ${height}, sp = ${gridSpacing};
// Fine grid
ctx.strokeStyle = 'rgba(255,255,255,0.15)';
ctx.lineWidth = 1;
for (let x = 0; x <= w; x += sp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
for (let y = 0; y <= h; y += sp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
// Major grid (every 5)
ctx.strokeStyle = 'rgba(20,184,166,0.4)';
ctx.lineWidth = 2;
for (let x = 0; x <= w; x += sp*5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
for (let y = 0; y <= h; y += sp*5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
// Crosshair
ctx.strokeStyle = '#14b8a6';
ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();
ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
// Center circle
ctx.beginPath(); ctx.arc(w/2, h/2, Math.min(w,h)*0.15, 0, Math.PI*2); ctx.stroke();
// Safe area (90%)
ctx.strokeStyle = 'rgba(255,255,0,0.3)';
ctx.setLineDash([10, 5]);
ctx.strokeRect(w*0.05, h*0.05, w*0.9, h*0.9);
// Corner markers
ctx.setLineDash([]);
ctx.fillStyle = '#14b8a6';
ctx.font = '14px Inter';
ctx.fillText('0,0', 5, 18);
ctx.fillText(w+',0', w-60, 18);
ctx.fillText('0,'+h, 5, h-5);
ctx.fillText(w+','+h, w-80, h-5);
</script>`;
      break;

    case 'gradient':
      body = `
<style>
  .gradient-strip { width: 100%; }
  .branding { top: 5%; left: 50%; transform: translateX(-50%); }
</style>
<div class="branding">
  <h1>LOCAL CONNECT</h1>
  <p>Broadcast Studio &bull; Gradient Ramps</p>
</div>
<div class="gradient-strip" style="height:25%;background:linear-gradient(to right,#000,#fff);margin-top:${height*0.15}px"></div>
<div class="gradient-strip" style="height:25%;background:linear-gradient(to right,#000,#f00,#000)"></div>
<div class="gradient-strip" style="height:25%;background:linear-gradient(to right,#000,#0f0,#000)"></div>
<div class="gradient-strip" style="height:${height*0.1}px;background:linear-gradient(to right,#000,#00f,#000)"></div>`;
      break;

    case 'focus':
      body = `
<style>
  canvas { position: absolute; top: 0; left: 0; }
  .branding { bottom: 8%; left: 50%; transform: translateX(-50%); }
</style>
<canvas id="focus" width="${width}" height="${height}"></canvas>
<div class="branding">
  <h1>LOCAL CONNECT</h1>
  <p>Broadcast Studio &bull; Focus &amp; Sharpness</p>
</div>
<script>
const c = document.getElementById('focus');
const ctx = c.getContext('2d');
const w = ${width}, h = ${height}, cx = w/2, cy = h/2;
ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
// Concentric circles
for (let r = 20; r < Math.max(w,h); r += 30) {
  ctx.strokeStyle = r % 150 === 0 ? '#14b8a6' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = r % 150 === 0 ? 2 : 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
}
// Crosshairs
ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
// Diagonal lines
ctx.strokeStyle = 'rgba(255,255,255,0.15)';
ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.stroke();
ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
// Test text at various sizes
ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
const sizes = [8, 10, 12, 14, 16, 20, 24, 32];
sizes.forEach((s, i) => {
  ctx.font = s + 'px Inter';
  ctx.fillText('LOCAL CONNECT ' + s + 'px', cx, cy - 200 + i * (s + 8));
});
// Corner wedges for sharpness
[{x:100,y:100},{x:w-100,y:100},{x:100,y:h-100},{x:w-100,y:h-100}].forEach(({x,y}) => {
  for (let i = 0; i < 20; i++) {
    ctx.strokeStyle = i%2 === 0 ? '#fff' : '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(i*0.15)*80, y + Math.sin(i*0.15)*80);
    ctx.stroke();
  }
});
</script>`;
      break;

    case 'white': case 'black': case 'red': case 'green': case 'blue':
      const colors = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#00ff00', blue: '#0000ff' };
      const textColor = pattern === 'white' ? '#000' : '#fff';
      body = `
<style>
  body { background: ${colors[pattern]}; }
  .branding { top: 50%; left: 50%; transform: translate(-50%, -50%); }
  .branding h1 { color: ${textColor}; }
  .branding p { color: ${pattern === 'white' ? '#0d9488' : '#14b8a6'}; }
  .branding .meta { color: ${pattern === 'white' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)'}; }
  .clock { color: ${pattern === 'white' ? '#0d9488' : '#14b8a6'}; }
  .screen-info { color: ${pattern === 'white' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'}; }
</style>
<div class="branding">
  <h1>LOCAL CONNECT</h1>
  <p>Broadcast Studio &bull; ${pattern.toUpperCase()} Test</p>
  <p class="meta">Solid ${pattern} — check uniformity &amp; dead pixels</p>
</div>`;
      break;

    case 'bounce':
      body = `
<style>
  canvas { position: absolute; top: 0; left: 0; }
</style>
<canvas id="bounce" width="${width}" height="${height}"></canvas>
<script>
const c = document.getElementById('bounce');
const ctx = c.getContext('2d');
const w = ${width}, h = ${height};
let x = w/4, y = h/4, dx = 3, dy = 2;
const logoW = Math.min(w, h) * 0.3;
const logoH = logoW * 0.4;

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  
  // Moving logo
  ctx.save();
  ctx.translate(x, y);
  
  // Background glow
  ctx.shadowColor = '#14b8a6';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-logoW/2-20, -logoH/2-10, logoW+40, logoH+20);
  ctx.shadowBlur = 0;
  
  // Border
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  ctx.strokeRect(-logoW/2-20, -logoH/2-10, logoW+40, logoH+20);
  
  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + (logoH*0.45) + 'px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOCAL CONNECT', 0, -logoH*0.1);
  
  ctx.fillStyle = '#14b8a6';
  ctx.font = '600 ' + (logoH*0.2) + 'px Inter';
  ctx.fillText('Broadcast Studio • Burn-in Test', 0, logoH*0.3);
  
  ctx.restore();
  
  // Bounce
  x += dx; y += dy;
  if (x + logoW/2 + 20 > w || x - logoW/2 - 20 < 0) dx = -dx;
  if (y + logoH/2 + 10 > h || y - logoH/2 - 10 < 0) dy = -dy;
  
  requestAnimationFrame(draw);
}
draw();
</script>`;
      break;
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(baseHTML(PATTERNS[pattern], width, height, name, body));
});

module.exports = router;
