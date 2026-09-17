import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PlayoutModule — the deck that actually plays out.
//
// It is a MODULE, not a fullscreen takeover, and that is the whole point: it sits
// in a layout slot, so lower-thirds, tickers, clocks and station branding compose
// over it with the layout system that already exists. A video player shows a video.
// Playout puts a video to air underneath the furniture.
//
// Two decks, A and B. The engine cues the free one, waits for it to say `ready`,
// and only then takes it. Nothing plays that hasn't loaded — that's the rule that
// makes a running order safe to leave alone.
//
// On a machine that can only decode one stream (a phone, a weak panel), dual-deck
// is not attempted: the screen never advertises the capability, the engine cuts
// instead of crossfading, and everything still works.
// ─────────────────────────────────────────────────────────────────────────────
export default function PlayoutModule({ config = {}, socket }) {
  const channelId = config.channel_id || config.channelId || '';
  const [active, setActive] = useState(null);        // 'A' | 'B' — which deck is on air
  const [fading, setFading] = useState(false);
  const [status, setStatus] = useState('waiting');   // waiting | cued | on-air
  const [label, setLabel] = useState('');

  const refs = { A: useRef(null), B: useRef(null) };
  // Which item each deck currently holds. A ref, not state: the socket handlers below
  // must see the current value, and a stale closure here means reporting `ended` for
  // an item that finished thirty seconds ago.
  const held = useRef({ A: null, B: null });
  const fadeTimer = useRef(null);

  const say = useCallback((event, payload) => {
    try { socket?.emit(event, { channel_id: channelId, ...payload }); } catch { /* preview, no socket */ }
  }, [socket, channelId]);

  // ── CUE: load the file, seek to its in-point, and only report ready when the
  //    browser says it can play it through. `canplaythrough` is the honest signal;
  //    `loadeddata` would let us take a deck that then stalls three frames in.
  useEffect(() => {
    if (!socket || !channelId) return;

    const onCue = ({ channel_id, item_id, deck, url, in_s, out_s, title }) => {
      if (channel_id !== channelId) return;
      const el = refs[deck]?.current;
      if (!el) return;

      held.current[deck] = { itemId: item_id, outS: out_s, title };
      setStatus('cued');

      const ready = () => {
        el.removeEventListener('canplaythrough', ready);
        say('playout_ready', { item_id });
      };
      const failed = () => {
        el.removeEventListener('error', failed);
        // Tell the engine rather than dying quietly. It will skip the item and log
        // the reason — a silent failure here is how you get a black frame nobody
        // can explain afterwards.
        say('playout_error', { item_id, message: el.error?.message || 'media load failed' });
      };

      el.addEventListener('canplaythrough', ready, { once: true });
      el.addEventListener('error', failed, { once: true });

      el.src = url;
      el.load();
      if (in_s) {
        // Seek once metadata exists — before that, currentTime is a no-op.
        el.addEventListener('loadedmetadata', () => { el.currentTime = in_s; }, { once: true });
      }
    };

    // ── TAKE: this deck is now on air.
    const onTake = ({ channel_id, deck, segue, overlap_s }) => {
      if (channel_id !== channelId) return;
      const el = refs[deck]?.current;
      if (!el) return;

      el.play().catch(err => {
        // Autoplay policy. A screen node runs muted precisely so this can't happen,
        // but if it ever does the engine must hear about it rather than sit there
        // believing it's on air.
        say('playout_error', { item_id: held.current[deck]?.itemId, message: `play() rejected: ${err.message}` });
      });

      const prev = active;
      setActive(deck);
      setStatus('on-air');
      setLabel(held.current[deck]?.title || '');

      if (segue === 'xfade' && overlap_s > 0 && prev && prev !== deck) {
        setFading(true);
        clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => {
          setFading(false);
          const old = refs[prev]?.current;
          if (old) { old.pause(); old.removeAttribute('src'); old.load(); }  // free the decoder
        }, overlap_s * 1000);
      } else if (prev && prev !== deck) {
        const old = refs[prev]?.current;
        if (old) { old.pause(); old.removeAttribute('src'); old.load(); }
      }
    };

    const onStop = ({ channel_id }) => {
      if (channel_id !== channelId) return;
      for (const d of ['A', 'B']) {
        const el = refs[d]?.current;
        if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
      }
      setActive(null); setStatus('waiting'); setLabel('');
    };

    socket.on('playout_cue', onCue);
    socket.on('playout_take', onTake);
    socket.on('playout_stop', onStop);
    return () => {
      socket.off('playout_cue', onCue);
      socket.off('playout_take', onTake);
      socket.off('playout_stop', onStop);
      clearTimeout(fadeTimer.current);
    };
  }, [socket, channelId, active, say]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The file is the authority on its own length. Our server-side clock is an
  // estimate; `ended` is the fact, and the engine trusts it over its own maths.
  const onEnded = (deck) => () => {
    const h = held.current[deck];
    if (h) say('playout_ended', { item_id: h.itemId });
  };

  // Honour the out-point. A trimmed item must stop where the operator said it stops,
  // not where the file happens to end.
  const onTime = (deck) => (e) => {
    const h = held.current[deck];
    if (!h?.outS) return;
    if (e.target.currentTime >= h.outS) {
      e.target.pause();
      held.current[deck] = { ...h, outS: null };   // fire once
      say('playout_ended', { item_id: h.itemId });
    }
  };

  const deckStyle = (deck) => ({
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: config.fit || 'cover',
    opacity: active === deck ? 1 : 0,
    transition: fading ? 'opacity 600ms linear' : 'none',
    zIndex: active === deck ? 2 : 1,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: config.background || '#000', overflow: 'hidden' }}>
      {['A', 'B'].map(deck => (
        <video
          key={deck}
          ref={refs[deck]}
          style={deckStyle(deck)}
          muted={config.muted !== false}
          playsInline
          preload="auto"
          onEnded={onEnded(deck)}
          onTimeUpdate={onTime(deck)}
        />
      ))}

      {/* Slate. Never a black rectangle with no explanation — if a screen is dark,
          whoever is looking at it should be able to see why. */}
      {status !== 'on-air' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          background: '#0a0a0c', color: '#3f3f46',
          font: '500 14px/1.4 "JetBrains Mono", ui-monospace, monospace', letterSpacing: '0.08em',
        }}>
          <div>{status === 'cued' ? '◉ CUED' : '○ STANDBY'}</div>
          {!channelId && <div style={{ marginTop: 8, color: '#f43f5e' }}>NO CHANNEL SET</div>}
        </div>
      )}

      {config.showLabel && label && status === 'on-air' && (
        <div style={{
          position: 'absolute', left: 16, bottom: 16, zIndex: 4,
          padding: '4px 10px', background: 'rgba(10,10,12,0.75)', color: '#e4e4e7',
          font: '500 12px/1 "JetBrains Mono", ui-monospace, monospace', letterSpacing: '0.06em',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
