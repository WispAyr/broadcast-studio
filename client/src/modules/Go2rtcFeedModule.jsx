import React, { useEffect, useRef, useState } from 'react';

// Renders a go2rtc stream. Default host is http://localhost:1984 so when the
// screen/display is loaded in a browser on the machine running go2rtc (e.g. bravo),
// no extra configuration is needed — just set `stream` to the go2rtc source name.
//
// Modes:
//   webrtc (default) — lowest latency, uses /api/webrtc offer/answer
//   mse              — fMP4 over WebSocket /api/ws?src=<name> into MediaSource
//   mp4              — HTTP fMP4 fallback at /api/stream.mp4?src=<name>
// No frames for this long and we stop believing the feed is live. Long enough
// to ride out a keyframe gap or a brief network hiccup, short enough that an
// operator is not looking at a black tile labelled ON AIR.
const STALL_MS = 6000;

// Coarse on purpose: an operator needs "is this seconds or hours old", not
// precision. Rounds DOWN so it never overstates how fresh the frame is.
function formatAge(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Go2rtcFeedModule({ config = {} }) {
  const host = (config.host || 'http://localhost:1984').replace(/\/+$/, '');
  const stream = config.stream || config.src || '';
  const mode = (config.mode || 'webrtc').toLowerCase();
  const label = config.label || stream || '';
  const muted = config.muted !== false;
  const background = config.background || '#000000';
  const showLabel = config.showLabel !== false;

  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [err, setErr] = useState('');

  // ─── "Never dark" fallback ────────────────────────────────────────────────
  // When the feed drops, show the last frame captured while it was healthy
  // rather than a black card. Zero config for web sources: a stream named
  // `web-<key>` has its still at /api/web-sources/<key>/snapshot.jpg.
  //
  // 🚨 The still is ALWAYS badged with its age, and the live dot goes amber.
  // A frozen frame that looks live is worse than a black screen, because an
  // operator will believe it.
  const fallbackKey = config.fallbackKey
    || (typeof stream === 'string' && stream.startsWith('web-') ? stream.slice(4) : null);
  const [snapshot, setSnapshot] = useState(null); // { url, ageMs }

  // ─── Stall detection ──────────────────────────────────────────────────────
  // A dead feed does NOT reliably raise an error. Pull the stream out from
  // under a connected WebRTC player and the peer connection sits there quite
  // happily while the picture goes black — status stays 'live' and the tile
  // claims to be on air over a black rectangle. Watching for an error is not
  // enough; the only honest signal is whether frames are still arriving.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let lastTime = -1;
    let lastAdvance = Date.now();
    const id = setInterval(() => {
      const t = video.currentTime;
      if (t !== lastTime) {
        lastTime = t;
        lastAdvance = Date.now();
        setStalled((was) => (was ? false : was));
      } else if (Date.now() - lastAdvance > STALL_MS) {
        setStalled((was) => (was ? was : true));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [host, stream, mode]);

  const down = status === 'error' || status === 'closed' || stalled;

  useEffect(() => {
    if (!down || !fallbackKey || config.fallback === false) { setSnapshot(null); return undefined; }
    let dead = false;
    const path = `/api/web-sources/${encodeURIComponent(fallbackKey)}/snapshot.jpg`;
    const poll = async () => {
      try {
        const r = await fetch(`${path}?_=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const ageMs = Number(r.headers.get('X-Snapshot-Age-Ms') || 0);
        const blob = await r.blob();
        if (dead) return;
        setSnapshot((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { url: URL.createObjectURL(blob), ageMs };
        });
      } catch {
        if (!dead) setSnapshot(null);
      }
    };
    poll();
    // Keep the age honest while we sit in fallback, and pick up a newer still
    // if the source recovers behind our back.
    const t = setInterval(poll, 30_000);
    return () => { dead = true; clearInterval(t); };
  }, [down, fallbackKey, config.fallback]);

  // Release the object URL on unmount so a long-running kiosk does not leak.
  useEffect(() => () => { if (snapshot?.url) URL.revokeObjectURL(snapshot.url); }, [snapshot?.url]);

  useEffect(() => {
    if (!stream) { setStatus('idle'); return; }
    const video = videoRef.current;
    if (!video) return;

    let pc, ws, ms, abort = false;
    setErr('');
    setStatus('connecting');

    const fail = (why) => {
      if (abort) return;
      setErr(String(why?.message || why || 'error'));
      setStatus('error');
    };

    async function startWebRTC() {
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const remoteStream = new MediaStream();
        pc.ontrack = (e) => {
          e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
          video.srcObject = remoteStream;
          video.play().catch(() => {});
          setStatus('live');
        };
        pc.onconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
            fail(`webrtc ${pc.connectionState}`);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
          pc.addEventListener('icegatheringstatechange', check);
          setTimeout(resolve, 1500);
        });

        const res = await fetch(`${host}/api/webrtc?src=${encodeURIComponent(stream)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: pc.localDescription.type, sdp: pc.localDescription.sdp }),
        });
        if (!res.ok) throw new Error(`go2rtc ${res.status}`);
        const answer = await res.json();
        if (abort) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) { fail(e); }
    }

    function startMP4() {
      try {
        const url = `${host}/api/stream.mp4?src=${encodeURIComponent(stream)}`;
        video.src = url;
        video.play().catch(() => {});
        setStatus('live');
      } catch (e) { fail(e); }
    }

    function startMSE() {
      try {
        if (!('MediaSource' in window)) return fail('MSE unsupported');
        ms = new MediaSource();
        video.src = URL.createObjectURL(ms);
        const wsProto = host.startsWith('https') ? 'wss' : 'ws';
        const wsHost = host.replace(/^https?:\/\//, '');
        ws = new WebSocket(`${wsProto}://${wsHost}/api/ws?src=${encodeURIComponent(stream)}`);
        ws.binaryType = 'arraybuffer';
        let sb = null; const queue = [];
        const drain = () => {
          if (!sb || sb.updating || !queue.length) return;
          try { sb.appendBuffer(queue.shift()); } catch (e) { fail(e); }
        };
        ms.addEventListener('sourceopen', () => {
          ws.send(JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.64001E,mp4a.40.2"' }));
        });
        ws.onmessage = (ev) => {
          if (typeof ev.data === 'string') {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'mse') {
              sb = ms.addSourceBuffer(msg.value);
              sb.mode = 'segments';
              sb.addEventListener('updateend', drain);
              setStatus('live');
              video.play().catch(() => {});
            }
            return;
          }
          queue.push(ev.data);
          drain();
        };
        ws.onerror = () => fail('ws error');
        ws.onclose = () => { if (!abort) setStatus('closed'); };
      } catch (e) { fail(e); }
    }

    if (mode === 'mp4') startMP4();
    else if (mode === 'mse') startMSE();
    else startWebRTC();

    return () => {
      abort = true;
      try { pc && pc.close(); } catch {}
      try { ws && ws.close(); } catch {}
      try { if (ms && ms.readyState === 'open') ms.endOfStream(); } catch {}
      try { if (video) { video.pause(); video.removeAttribute('src'); video.srcObject = null; video.load(); } } catch {}
    };
  }, [host, stream, mode]);

  if (!stream) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background }}>
        <span className="text-4xl mb-2 opacity-30">📡</span>
        <span className="text-gray-500 text-sm">No go2rtc stream configured</span>
        <span className="text-gray-600 text-xs mt-1">{host}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ background }}>
      <video
        ref={videoRef}
        muted={muted}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {/* Last-known-good frame, shown only while the feed is down. Sits under
          the label bar so the badge and title stay readable. */}
      {down && snapshot && (
        <img
          src={snapshot.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {showLabel && label && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1 flex items-center gap-2">
          {/* Red means live. While we are showing a still it must NOT be red —
              the dot is the glance-level truth claim for this tile. */}
          <span
            className={`inline-block w-2 h-2 rounded-full ${down ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`}
          />
          <span className="text-white text-xs font-medium truncate">{label}</span>
          {down && (
            <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">
              {snapshot ? `Last frame · ${formatAge(snapshot.ageMs)}` : 'No signal'}
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-400 uppercase tracking-wide">{mode}</span>
        </div>
      )}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <span className="text-gray-300 text-sm animate-pulse">Connecting to {host}…</span>
        </div>
      )}
      {/* Without a still we have nothing to show, so say so plainly. With one,
          the frame speaks and the badge carries the caveat — do not black it
          out with an error card. */}
      {status === 'error' && !(down && snapshot) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 pointer-events-none">
          <span className="text-red-400 text-sm font-medium">go2rtc feed unavailable</span>
          <span className="text-gray-500 text-xs mt-1 max-w-[90%] truncate">{label || stream}</span>
          {err && <span className="text-gray-600 text-[10px] mt-1 max-w-[90%] truncate">{err}</span>}
        </div>
      )}

      {/* The age caveat must survive even when the label bar is off — a bare
          still with no marking is the one thing this feature must never do. */}
      {down && snapshot && !(showLabel && label) && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 flex items-center gap-1.5 pointer-events-none">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wide">
            Last frame · {formatAge(snapshot.ageMs)}
          </span>
        </div>
      )}
    </div>
  );
}
