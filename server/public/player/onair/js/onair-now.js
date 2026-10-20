/* Who is really on air, from Broadcast Studio's own same-origin now-playing feed (GET /api/nowplaying/<station>,
   the broadcast.radio poller: {onAir: {title, presenter, start, end}, offAir}). Never from the analytics sample.
   match() maps the live show to a presenter that HAS analytics; anything else (automated shows such as Non-Stop Nights,
   unknown shows, an expired slot, off air) returns null, and the presenter page then makes no on-air claim. */
(function (root) {
  var norm = function (s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’‘`]/g, '')
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var AUTOMATED = /\b(non ?stop|nonstop|automated|overnight|playlist|best of|replay|repeat)\b/;
  // np: the feed value; names: presenter names that have analytics; now: epoch ms
  function match(np, names, now) {
    if (!np || np.offAir === true || !np.onAir || !np.onAir.title) return null;
    var oa = np.onAir, t = now == null ? Date.now() : now;
    if (typeof oa.end === 'number' && t > oa.end + 120000) return null;           // slot over: the feed is stale
    if (typeof oa.start === 'number' && t < oa.start - 120000) return null;
    var title = norm(oa.title), who = norm(oa.presenter);
    if (AUTOMATED.test(title)) return null;
    var best = null;
    (names || []).forEach(function (n) {
      var k = norm(n); if (!k || k.length < 3) return;
      var hit = (who && (who === k || (' ' + who + ' ').indexOf(' ' + k + ' ') >= 0)) || (' ' + title + ' ').indexOf(' ' + k + ' ') >= 0;
      if (hit && (!best || k.length > norm(best).length)) best = n;              // longest name wins ("Billy and Bex" over "Bex")
    });
    return best ? { presenter: best, show: String(oa.title).slice(0, 80) } : null;
  }
  var api = { match: match, norm: norm };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.OANow = api;
})(this);
