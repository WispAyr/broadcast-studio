/* SideLiner's graphics package — shared runtime.
   Plain script (no modules) so every page also works from file:// in OBS.

   Hosts: Broadcast Studio (gfx_html overlay or web_source module) and OBS browser
   sources run the same URL unchanged — the stage scales to fit its frame.

   Trigger model, in priority order:
   - OBS: the page plays IN when the source becomes visible (obsSourceVisibleChanged)
     and resets when hidden. Give the scene item a Hide Transition (Fade, 300ms) in OBS.
   - ?out=8      auto-play OUT after 8 seconds.
   - ?hold=1     load parked; wait for a trigger (Space/Enter, or postMessage {sl:'in'}).
   - ?static=1   render the finished frame with no motion (stills, thumbnails).
   - Space/Enter toggles in/out when previewing in a normal browser.

   Format: landscape 1920x1080 by default. PORTRAIT (1080x1920 stage, 9:16 socials) when
   ?format=portrait, or when the frame is taller than wide (aspect < 1) and no format is given.
   ?format=landscape forces landscape. Portrait adds body.portrait; pages lay themselves out
   natively inside the socials safe box (x 60-950, y 270-1440). ?guides=1 draws that box (debug). */
(function () {
  var Q = new URLSearchParams(location.search);
  var FMT = (Q.get('format') || '').toLowerCase();
  function wantPortrait() {
    if (FMT === 'portrait') return true;
    if (FMT === 'landscape') return false;
    return innerWidth > 0 && innerHeight > 0 && innerWidth / innerHeight < 1;
  }
  var PORTRAIT = wantPortrait();
  if (PORTRAIT && document.body) document.body.classList.add('portrait');

  // Senior + West of Scotland League clubs in Ayrshire. Matched loosely: "Ayr Utd" = "Ayr United".
  var AYRSHIRE = [
    'kilmarnock', 'ayr united', 'ayr utd', 'ayr',
    'auchinleck talbot', 'cumnock juniors', 'cumnock', 'glenafton athletic', 'glenafton',
    'hurlford united', 'hurlford', 'irvine meadow', 'irvine victoria', 'kilwinning rangers',
    'troon', 'largs thistle', 'beith juniors', 'beith', 'kello rovers', 'darvel',
    'kilbirnie ladeside', 'ardrossan winton rovers', 'saltcoats victoria', 'girvan', 'maybole',
    'annbank united', 'craigmark burntonians', 'dalry thistle', 'lugar boswell thistle',
    'muirkirk', 'whitletts victoria', 'ardeer thistle', 'kilmarnock women', 'ayr united women'
  ];

  function norm(s) {
    return String(s || '').toLowerCase().replace(/\bf\.?c\.?\b/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  var SL = window.SL = {
    q: Q,
    portrait: PORTRAIT,
    W: PORTRAIT ? 1080 : 1920, H: PORTRAIT ? 1920 : 1080,
    // Socials safe box on the portrait stage (keep text/logos inside it)
    SAFE: { l: 60, t: 270, r: 950, b: 1440 },
    p: function (k, d) { var v = Q.get(k); return v == null || v === '' ? (d == null ? '' : d) : v; },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    list: function (k) {
      return SL.p(k).split(/\s*[,\n]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    },
    isAyr: function (name) { return AYRSHIRE.indexOf(norm(name)) !== -1; },
    initials: function (name) {
      var w = norm(name).split(' ').filter(function (x) { return x && ['the', 'of', 'and'].indexOf(x) === -1; });
      if (!w.length) return '?';
      return (w.length === 1 ? w[0].slice(0, 3) : w.slice(0, 2).map(function (x) { return x[0]; }).join('')).toUpperCase();
    },
    // The show mark is the official artwork from nowayrshireradio.co.uk — never re-typeset.
    wordmark: function (h) {
      return '<img class="slbar" src="logo/sideliners-bar.png" alt="SideLiner\'s"' + (h ? ' style="--h:' + h + 'px"' : '') + '>';
    },
    lockup: function (h) {
      return '<img class="sllock" src="logo/sideliners-lockup.png" alt="Now Ayrshire Radio — SideLiner\'s"' + (h ? ' style="height:' + h + 'px"' : '') + '>';
    },
    // Crest: an image URL if given, otherwise a monogram disc. Never a guessed logo.
    crest: function (url, name, colour) {
      if (url) return '<div class="crest"><img src="' + SL.esc(url) + '" alt=""></div>';
      return '<div class="crest mono" style="' + (colour ? '--c:' + SL.esc(colour) : '') + '"><span>' + SL.esc(SL.initials(name)) + '</span></div>';
    },

    // ---- Time: London wall clock, synced to the host server ----
    // Studio PCs drift and may not be on London time. SL.now() adds an offset measured
    // against GET /api/time ({now: ms}); offsets over 30 s are rejected as nonsense (a
    // broken time source once dragged a studio clock 5 min slow), falling back to the PC.
    _off: 0, synced: false,
    now: function () { return Date.now() + SL._off; },
    syncTime: function () {
      if (SL._syncing || location.protocol === 'file:') return; SL._syncing = true;
      var t0 = Date.now();
      fetch(SL.p('time', '/api/time'), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        var off = j.now + (Date.now() - t0) / 2 - Date.now();
        if (typeof j.now === 'number' && Math.abs(off) <= 30000) { SL._off = off; SL.synced = true; }
      }).catch(function () {}).then(function () { SL._syncing = false; });
    },
    // {y,mo,d,h,mi,s,wd} of an instant, in London
    london: function (ms) {
      var o = {};
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }).formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
        return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
      } catch (e) { var d = new Date(ms); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), wd: d.getDay() }; }
    },
    hhmm: function (ms) { var w = SL.london(ms == null ? SL.now() : ms); return String(w.h).padStart(2, '0') + ':' + String(w.mi).padStart(2, '0'); },
    // epoch ms of HH:MM today, London time (correct across BST/GMT whatever the PC's zone)
    londonToday: function (h, mi) {
      var n = SL.now(), w = SL.london(n);
      var guess = Date.UTC(w.y, w.mo - 1, w.d, h, mi);
      var g = SL.london(guess), drift = Date.UTC(g.y, g.mo - 1, g.d, g.h, g.mi) - guess;   // London offset at that moment
      return guess - drift;
    },

    on: false, _t: 0,
    play: function () {
      clearTimeout(SL._t);
      var b = document.body;
      b.classList.add('reset'); b.classList.remove('in', 'out');
      void b.offsetWidth;
      b.classList.remove('reset');
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        b.classList.add('in'); SL.on = true;
        document.dispatchEvent(new Event('sl:in'));
        var o = +SL.p('out', 0);
        if (o > 0) SL._t = setTimeout(SL.stop, o * 1000);
      }); });
    },
    stop: function () {
      clearTimeout(SL._t);
      document.body.classList.remove('in'); document.body.classList.add('out'); SL.on = false;
      document.dispatchEvent(new Event('sl:out'));
    },
    toggle: function () { SL.on ? SL.stop() : SL.play(); },

    // Shrink a single-line element's font until it fits its box (long names/headlines).
    shrink: function (el, min) {
      if (!el) return;
      var fs = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && fs > (min || 30)) { fs -= 2; el.style.fontSize = fs + 'px'; }
    },
    // Portrait: let text wrap to at most `lines` lines, shrinking until no word overflows and it fits.
    fitLines: function (el, lines, min) {
      if (!el) return;
      var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) / fs || 1.1;
      var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      while (fs > (min || 30) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight - pad > fs * lh * lines + 2)) {
        fs -= 2; el.style.fontSize = fs + 'px';
      }
    },

    // Pages are authored on a fixed 1920x1080 stage. Scale it to whatever frame hosts us:
    // a BS overlay iframe (full screen), a BS web_source cell (any size) or OBS (1:1).
    // Portrait uses a 1080x1920 stage, scaled the same way.
    fit: function () {
      var W = SL.W, H = SL.H;
      var w = innerWidth, h = innerHeight, s = Math.min(w / W, h / H);
      var b = document.body.style;
      if (Math.abs(s - 1) < .001) { b.transform = ''; return; }
      b.transformOrigin = '0 0';
      b.transform = 'translate(' + ((w - W * s) / 2) + 'px,' + ((h - H * s) / 2) + 'px) scale(' + s + ')';
    },
    // Aspect crossed 1:1 with no explicit format: the layout is built at load, so rebuild.
    refit: function () {
      if (!FMT && wantPortrait() !== PORTRAIT) { location.reload(); return; }
      SL.fit();
    },

    boot: function () {
      SL.syncTime(); setInterval(SL.syncTime, 600000);
      document.documentElement.style.cssText += ';width:100%;height:100%;overflow:hidden;background:transparent';
      SL.fit(); addEventListener('resize', SL.refit);
      var bg = SL.p('bg');
      if (bg) document.body.classList.add('bg-' + bg);
      if (PORTRAIT && SL.p('guides') === '1') {
        var g = document.createElement('div'); g.className = 'sl-guides'; document.body.appendChild(g);
      }
      addEventListener('keydown', function (e) {
        if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); SL.toggle(); }
      });
      addEventListener('message', function (e) {
        var m = e.data && e.data.sl;
        if (m === 'in') SL.play(); else if (m === 'out') SL.stop(); else if (m === 'toggle') SL.toggle();
      });
      addEventListener('obsSourceVisibleChanged', function (e) { e.detail.visible ? SL.play() : SL.stop(); });

      if (SL.p('static') === '1') {
        document.body.classList.add('static', 'in'); SL.on = true;
        document.dispatchEvent(new Event('sl:in'));
        return;
      }
      if (SL.p('hold') === '1') return;
      var go = function () { setTimeout(SL.play, +SL.p('delay', 250)); };
      (document.fonts && document.fonts.ready) ? document.fonts.ready.then(go) : go();
    }
  };
})();
