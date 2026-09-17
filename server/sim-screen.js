// A simulated screen node. Speaks exactly the protocol the real PlayoutModule will
// speak, so the engine is proven before a single pixel of UI exists — and before any
// real screen is pointed at it.
const { io } = require('socket.io-client');

const SCREEN_ID = process.argv[2];
const STUDIO_ID = process.argv[3];
const DUAL = process.argv[4] !== 'single';

const socket = io('http://127.0.0.1:3945', { transports: ['websocket'] });
const decks = {};                    // deck -> { itemId, url, durS }
let onAir = null;

const t = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${t()}] SCREEN`, ...a);

socket.on('connect', () => {
  socket.emit('register_screen', {
    screenId: SCREEN_ID,
    studioId: STUDIO_ID,
    caps: { dualDeck: DUAL, maxHeight: 1080 },
  });
  log(`registered (dualDeck=${DUAL})`);
});

socket.on('playout_cue', ({ channel_id, item_id, deck, url, dur_s, title, dual }) => {
  log(`CUE  deck ${deck} ← "${title}" (${dur_s?.toFixed(1)}s) dual=${dual}`);
  decks[deck] = { itemId: item_id, url, durS: dur_s, channelId: channel_id };
  // A real deck reports ready on canplaythrough. Simulate a realistic preload.
  setTimeout(() => {
    log(`READY deck ${deck} (buffered)`);
    socket.emit('playout_ready', { channel_id, item_id });
  }, 800);
});

socket.on('playout_take', ({ channel_id, item_id, deck, segue, overlap_s }) => {
  const d = decks[deck];
  if (!d) return log(`TAKE ${deck} — BUT NOTHING LOADED (this would be a black frame)`);
  log(`TAKE deck ${deck} ▶ "${d.url.split('/').pop().slice(0, 12)}…" segue=${segue}${overlap_s ? ` overlap=${overlap_s}s` : ''}`);
  if (onAir) clearTimeout(onAir.timer);
  onAir = {
    deck, itemId: d.itemId,
    // The real <video> fires `ended`. Here a timer stands in for the file's own clock.
    timer: setTimeout(() => {
      log(`ENDED deck ${deck} (file ran out)`);
      socket.emit('playout_ended', { channel_id, item_id: d.itemId });
    }, d.durS * 1000),
  };
});

socket.on('playout_stop', () => { log('STOP'); if (onAir) clearTimeout(onAir.timer); onAir = null; });
socket.on('set_layout', ({ source }) => log(`SET_LAYOUT (${source || 'control'})`));
socket.on('disconnect', () => log('disconnected'));
