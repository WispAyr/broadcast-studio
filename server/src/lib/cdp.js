// ─── Minimal Chrome DevTools Protocol client ────────────────────────────────
// Launches a headless Chrome and drives it over CDP with NO npm dependencies:
// Node 22+ ships a native WebSocket, so we speak the protocol directly rather
// than pulling in Playwright/Puppeteer (each of which bundles its own ~300 MB
// browser — a bad trade for a server tree that is hand-deployed).
//
// Scope is deliberately tiny: launch, one page target, send(), on(), close().
// Everything clever lives in web-source-extract.js.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

// Chrome/Chromium binaries in the order we prefer them. CHROME_PATH wins.
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
].filter(Boolean);

function findChrome() {
  for (const p of CANDIDATES) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ }
  }
  throw new Error('no Chrome/Chromium found — set CHROME_PATH');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll /json/version until DevTools answers, or give up.
async function waitForDevTools(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return await r.json();
    } catch (e) { lastErr = e; }
    await sleep(100);
  }
  throw new Error(`DevTools did not come up on :${port} — ${lastErr?.message || 'timeout'}`);
}

class CDPSession {
  constructor(ws, proc, userDataDir) {
    this.ws = ws;
    this.proc = proc;
    this.userDataDir = userDataDir;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.closed = false;

    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
        return;
      }
      const hs = this.handlers.get(msg.method);
      if (hs) for (const h of hs) { try { h(msg.params); } catch { /* a bad handler must not kill the session */ } }
    });

    ws.addEventListener('close', () => {
      this.closed = true;
      for (const [, p] of this.pending) p.reject(new Error('CDP session closed'));
      this.pending.clear();
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  send(method, params = {}, timeoutMs = 20000) {
    if (this.closed) return Promise.reject(new Error('CDP session closed'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Best-effort teardown. Never throws — callers are usually already in a
  // finally block and a leaked Chrome is worse than a swallowed error.
  async close() {
    this.closed = true;
    try { this.ws.close(); } catch { /* ignore */ }
    try {
      this.proc.kill('SIGTERM');
      // SIGKILL anything still alive after a grace period.
      const killer = setTimeout(() => { try { this.proc.kill('SIGKILL'); } catch { /* ignore */ } }, 3000);
      killer.unref?.();
    } catch { /* ignore */ }
    try { fs.rmSync(this.userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Launch headless Chrome and attach to its first page target.
 * @returns {Promise<CDPSession>}
 */
async function launch({ headless = true, timeoutMs = 20000, userAgent } = {}) {
  const bin = findChrome();
  const port = await freePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-extract-'));

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-translate',
    '--disable-popup-blocking',
    '--no-sandbox',
    '--mute-audio',
    // The whole point: let video start without a user gesture. Without this the
    // page sits on a poster frame and no manifest is ever requested.
    '--autoplay-policy=no-user-gesture-required',
    // Some players sniff for automation and refuse to start.
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,720',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new', '--disable-gpu');
  if (userAgent) args.unshift(`--user-agent=${userAgent}`);

  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.resume(); // drain, or Chrome blocks on a full pipe
  proc.on('error', () => { /* surfaced by waitForDevTools below */ });

  let wsUrl;
  try {
    await waitForDevTools(port, timeoutMs);
    // Attach to the page target, not the browser target — Network/Page/Input
    // domains only exist on a page.
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) throw new Error('no page target to attach to');
    wsUrl = page.webSocketDebuggerUrl;
  } catch (e) {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw e;
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP websocket connect timed out')), timeoutMs);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP websocket error')); }, { once: true });
  }).catch((e) => {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw e;
  });

  return new CDPSession(ws, proc, userDataDir);
}

/**
 * Run a CDP-driven operation under a HARD deadline.
 *
 * Every step inside an extraction has its own timeout, but that is not enough:
 * any single await that wedges (a navigation that never settles, a renderer
 * that dies mid-call) hangs forever, jams whatever queue is feeding it, and
 * leaves a headless Chrome behind. This is the backstop — it force-closes the
 * session so the operation cannot outlive it.
 *
 * `runner(publish)` must call `publish(session)` as soon as it has one.
 */
async function withHardDeadline(runner, hardMs) {
  let session = null;
  let timer = null;

  const inner = runner((s) => { session = s; });
  inner.catch(() => {}); // a late rejection after we lose the race is expected

  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (session) session.close().catch(() => {});
      reject(new Error(`operation exceeded hard deadline of ${hardMs}ms`));
    }, hardMs);
  });

  try {
    return await Promise.race([inner, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    if (session) await session.close().catch(() => {});
  }
}

module.exports = { launch, findChrome, sleep, withHardDeadline };
