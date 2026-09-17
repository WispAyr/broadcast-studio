// ─────────────────────────────────────────────────────────────────────────────
// Playout target: SCREEN.
//
// Drives a browser screen node over the socket it already holds. The player on the
// far end is a MODULE inside a layout, not a fullscreen takeover — so lower-thirds,
// tickers, clocks and station branding compose over the video using the layout
// system that already exists. That is the difference between "a video player" and
// "playout".
//
// Capability gating (grok's finding, and he was right): the screens on this estate
// are iMacs, Studio Displays and the NAR Main Wall — which will happily decode two
// 1080p streams and crossfade them — but also phones at 1280x720, which will not.
// So dual-deck is a capability the screen ADVERTISES, never an assumption we make.
// A screen that doesn't claim it gets a single decoder and a hard cut, which always
// works.
// ─────────────────────────────────────────────────────────────────────────────
const { getIO } = require('../../ws');
const { db } = require('../../db');

function screensFor(ch) {
  if (ch.target_type === 'screen') return ch.target_ref ? [ch.target_ref] : [];
  if (ch.target_type === 'screen_group') {
    return db.prepare('SELECT id FROM screens WHERE group_id = ?').all(ch.target_ref).map(r => r.id);
  }
  return [];
}

// What the far end told us it can do. Absence means "can't" — never "probably".
function canDualDeck(screenId) {
  const row = db.prepare('SELECT config FROM screens WHERE id = ?').get(screenId);
  try { return !!JSON.parse(row?.config || '{}').caps?.dualDeck; } catch { return false; }
}

function emit(ch, event, payload) {
  const io = getIO();
  for (const screenId of screensFor(ch)) {
    io.to(`screen:${screenId}`).emit(event, { ...payload, channel_id: ch.id, dual: canDualDeck(screenId) });
  }
}

module.exports = {
  // Preload. The screen loads the file into the free deck, seeks to in_s, and only
  // reports ready when it has enough buffered to play through. It is that report —
  // not a timer — that unlocks the take.
  cue(ch, { deck, item, url, poster, in_s, out_s, dur_s, title }) {
    emit(ch, 'playout_cue', {
      item_id: item.id, deck, url, poster,
      in_s: in_s || 0, out_s: out_s ?? null, dur_s, title,
    });
  },

  take(ch, { deck, item_id, segue, overlap_s }) {
    emit(ch, 'playout_take', { item_id, deck, segue, overlap_s: overlap_s || 0 });
  },

  stop(ch) { emit(ch, 'playout_stop', {}); },

  // Last resort when there is nothing to play and no filler: put the screen on a
  // known-good layout. A standby card is a bad outcome; black is an unacceptable one.
  standby(ch, layoutId) {
    const io = getIO();
    const layout = db.prepare('SELECT * FROM layouts WHERE id = ?').get(layoutId);
    if (!layout) return;
    try { layout.modules = JSON.parse(layout.modules || '[]'); } catch { layout.modules = []; }
    for (const screenId of screensFor(ch)) {
      io.to(`screen:${screenId}`).emit('set_layout', { layoutId, layout, source: 'playout_standby' });
    }
  },
};
