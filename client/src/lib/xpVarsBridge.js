// Crosspoint variable bridge for web_source pages.
//
// A screen gets studio variables over its socket (variable_snapshot / variable_update). Native modules bind them;
// a web_source page (an iframe) could not see them at all. This forwards ONLY Crosspoint-fed variables (ids "xp:*",
// written by the crosspoint bs-vars adapter) to SAME-ORIGIN iframes, as
//   postMessage({ bs: 'vars', v: 1, vars: { 'xp:…': value, … } }, location.origin)
// A full snapshot goes out when the frame loads, then each change. Proxied or cross-origin frames get nothing.
// Other studio variables (counters, scores, operator state) are never forwarded.

export const XP_ID = /^xp:[a-zA-Z0-9:_\-.]{1,80}$/;

export function createXpVarsBridge() {
  const store = {};
  const listeners = new Set();
  return {
    // Merge a {id: value} map (snapshot or a single update); returns the xp:* subset that changed.
    publish(vars) {
      if (!vars || typeof vars !== 'object') return {};
      const changed = {};
      for (const [id, value] of Object.entries(vars)) {
        if (!XP_ID.test(id)) continue;
        store[id] = value; changed[id] = value;
      }
      if (Object.keys(changed).length) for (const fn of listeners) { try { fn(changed); } catch { /* one bad frame never stops the rest */ } }
      return changed;
    },
    snapshot() { return { ...store }; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

// Is this iframe src one we may hand Crosspoint values to? Same origin as the screen, and not via the fetch proxy
// (proxied pages are third-party content served from our origin).
export function bridgeable(src, origin, useProxy) {
  if (!src || useProxy) return false;
  try {
    const u = new URL(src, origin + '/');
    return u.origin === origin && !u.pathname.startsWith('/api/proxy/');
  } catch { return false; }
}

export function postVars(win, vars, origin) {
  if (!win || !vars || !Object.keys(vars).length) return false;
  try { win.postMessage({ bs: 'vars', v: 1, vars }, origin); return true; } catch { return false; }
}

// One bridge per screen window.
export const xpVars = createXpVarsBridge();
