// Audio bus — a tiny window-event coordinator shared by the screen player's
// audio sources (AudioModule beds, `bed`/`sting` overlays). Keeps ducking and
// autoplay-unlock decoupled: a sting doesn't need a handle on the bed, it just
// announces "duck" and every bed listening ramps itself down.
//
// Events (CustomEvent on window):
//   bs:duck   { gain: 0..1, ms }   — beds ramp toward `gain` over `ms`
//   bs:unlock {}                   — a user gesture happened; media may retry play()

const DUCK = 'bs:duck';
const UNLOCK = 'bs:unlock';

let unlocked = false;
let stingDepth = 0; // supports overlapping stings — only un-duck when the last one ends

export function duck(gain = 0.15, ms = 200) {
  stingDepth += 1;
  window.dispatchEvent(new CustomEvent(DUCK, { detail: { gain, ms } }));
}

export function unduck(ms = 500) {
  stingDepth = Math.max(0, stingDepth - 1);
  if (stingDepth === 0) {
    window.dispatchEvent(new CustomEvent(DUCK, { detail: { gain: 1, ms } }));
  }
}

export function onDuck(cb) {
  const h = (e) => cb(e.detail?.gain ?? 1, e.detail?.ms ?? 300);
  window.addEventListener(DUCK, h);
  return () => window.removeEventListener(DUCK, h);
}

// Linearly ramp an HTMLMediaElement's volume to `target` over `ms`.
export function rampVolume(el, target, ms = 300) {
  if (!el) return;
  const from = el.volume;
  const to = Math.max(0, Math.min(1, target));
  // Hidden/minimised page: rAF is throttled to a standstill, so a ramp would
  // never land — jump straight to the target (nobody hears the fade anyway).
  if (ms <= 0 || from === to || document.hidden) { el.volume = to; return; }
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / ms);
    el.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function isUnlocked() {
  return unlocked;
}

export function onUnlock(cb) {
  window.addEventListener(UNLOCK, cb);
  return () => window.removeEventListener(UNLOCK, cb);
}

// Wire a one-time global gesture listener that flips `unlocked` and notifies
// any media waiting to (re)start. Safe to call repeatedly — installs once.
let installed = false;
export function installUnlockListener() {
  if (installed) return;
  installed = true;
  const handler = () => {
    unlocked = true;
    window.dispatchEvent(new CustomEvent(UNLOCK));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, handler, { once: true, passive: true })
  );
}

// Best-effort autoplay: try to play; if the browser blocks it (no gesture /
// no autoplay flag), retry once a gesture unlocks. Returns a cleanup fn.
export function autoPlay(el) {
  if (!el) return () => {};
  let off = () => {};
  const attempt = () => { const p = el.play(); if (p && p.catch) p.catch(() => {}); };
  attempt();
  if (!unlocked) {
    installUnlockListener();
    off = onUnlock(attempt);
  }
  return off;
}
