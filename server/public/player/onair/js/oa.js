/* On-air analytics studio screens — shared runtime. Sibling of the studio clock (sideliners/clock.html + js/sl.js):
   same 1920x1080 stage that scales to its frame, same body.in motion, same tokens (css/sl.css).
   Data: Crosspoint channel onair.analytics (onair.analytics@1, aggregates only) read over REST
     ?xp=<crosspointd base URL>&ch=<node>/onair.analytics   (default ch: intel/onair.analytics, same-origin /api/data/…)
   ?demo=1 uses sample/onair.analytics.json (shaped from the real stats) and shows the "Sample data" badge, as the clock does.
   ?static=1 renders the rested frame (no motion). Nothing here writes anywhere. */
(function () {
  var Q = new URLSearchParams(location.search);
  var OA = window.OA = {
    W: 1920, H: 1080, p: function (k, d) { var v = Q.get(k); return v == null || v === '' ? (d == null ? '' : d) : v; },
    el: function (id) { return document.getElementById(id); },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); },
    n: function (x) { return Math.round(x).toLocaleString('en-GB'); },
    DEMO: Q.get('demo') === '1', data: null, gotAt: 0, liveness: null,
    // The clock's lockup tile: the official stacked white logo on the slanted purple panel (never re-typeset)
    lockup: function (h) { return '<span class="lock pg"><img class="nar" src="logo/nar-stacked-white-tight.svg" alt="Now Ayrshire Radio" style="--h:' + (h || 132) + 'px"></span>'; },
    fit: function () {
      var w = innerWidth, h = innerHeight, s = Math.min(w / OA.W, h / OA.H), b = document.body.style;
      if (Math.abs(s - 1) < .001) { b.transform = ''; return; }
      b.transformOrigin = '0 0'; b.transform = 'translate(' + ((w - OA.W * s) / 2) + 'px,' + ((h - OA.H * s) / 2) + 'px) scale(' + s + ')';
    },
    url: function () {
      if (OA.DEMO) return 'sample/onair.analytics.json';
      return OA.p('xp', '') .replace(/\/$/, '') + '/api/data/' + encodeURIComponent(OA.p('ch', 'intel/onair.analytics'));
    },
    poll: function (cb) {
      fetch(OA.url(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
        var v = OA.DEMO ? d : d && d.value && d.value.value;
        OA.liveness = OA.DEMO ? 'sample' : d && d.liveness;
        if (v && v.aggregatesOnly) { OA.data = v; OA.gotAt = Date.now(); cb(v); }
      }).catch(function () { /* keep the last copy */ }).then(function () { setTimeout(function () { OA.poll(cb); }, 30000); });
    },
    // Freshness badge, same component as the clock's SYNCED/LOCAL: LIVE only when Crosspoint says the channel is live
    badge: function () {
      var b = OA.el('src'); if (!b) return;
      var live = OA.liveness === 'live' && !(OA.data && OA.data.stale);
      b.className = 'src' + (live || OA.DEMO ? ' sync' : '') + (OA.DEMO ? ' demo' : '');
      b.lastChild.textContent = OA.DEMO ? 'Sample data' : live ? 'Live data' : 'Last known';
    },
    asOf: function (v) {
      var f = function (t) { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }); };
      return v.period && v.period.from ? f(v.period.from) + ' – ' + f(v.period.to) : '';
    },
    play: function () { document.body.classList.add('in'); document.dispatchEvent(new Event('oa:in')); },
    boot: function (render) {
      OA.fit(); addEventListener('resize', OA.fit);
      var go = function () { render(OA.data); OA.badge(); if (Q.get('static') === '1') document.body.classList.add('static'); setTimeout(OA.play, +OA.p('delay', 250)); };
      OA.poll(function (v) { if (!OA.booted) { OA.booted = true; (document.fonts ? document.fonts.ready : Promise.resolve()).then(go); } else { render(v, true); OA.badge(); } });
    }
  };
})();
// The clock's crawl: the band crawls only when it doesn't fit, at a steady px/s on rAF (same loop as clock.html)
OA.band = function (label, items, cls) {
  var lab = OA.el('tlab'), trk = OA.el('trk'), view = OA.el('tview'); if (!trk) return;
  lab.className = 'tlab pg ' + (cls || ''); lab.innerHTML = label;
  var html = items.map(function (it) { return '<span class="ti"><b class="n">' + OA.esc(it[0]) + '</b><span class="s">' + OA.esc(it[1]) + '</span></span>'; }).join('');
  trk.innerHTML = html; var W = trk.scrollWidth, V = view.clientWidth, x = 0, last = 0;
  var crawl = W > V && OA.p('static') !== '1'; if (crawl) trk.innerHTML = html + html;
  cancelAnimationFrame(OA._crawl);
  (function f(ts) { var dt = last ? Math.min(100, ts - last) : 0; last = ts;
    if (crawl) { x -= 90 * dt / 1000; if (x <= -W) x += W; trk.style.transform = 'translateX(' + x.toFixed(2) + 'px)'; }
    OA._crawl = requestAnimationFrame(f); })(0);
};
OA.rows = function (list, max) {
  var top = list[0] ? list[0].n : 1;
  return list.slice(0, max).map(function (r, i) {
    return '<div class="row' + (i === 0 ? ' lead' : '') + '"><span class="nm">' + OA.esc(r.w) + '</span><span class="ct">' + OA.n(r.n) +
      '</span><span class="bar"><i style="--f:' + (r.n / top).toFixed(4) + ';--d:' + (.7 + i * .08).toFixed(2) + 's"></i></span></div>';
  }).join('');
};
// Words that never go on a studio screen: the bare station initials, and anything frequency-like
OA.ok = function (w) { w = String(w || '').trim(); return !!w && !/^nar$/i.test(w) && !/^fm$/i.test(w) && !/\d/.test(w); };
OA.REGIONS = ['Ayrshire', 'Carrick', 'Kyle', 'Cunninghame'];
