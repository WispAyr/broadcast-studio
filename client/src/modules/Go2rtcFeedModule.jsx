import React, { useEffect, useRef, useState } from 'react';

// Renders a go2rtc stream. Default host is http://localhost:1984 so when the
// screen/display is loaded in a browser on the machine running go2rtc (e.g. bravo),
// no extra configuration is needed — just set `stream` to the go2rtc source name.
//
// Modes:
//   webrtc (default) — lowest latency, uses /api/webrtc offer/answer
//   mse              — fMP4 over WebSocket /api/ws?src=<name> into MediaSource
//   mp4              — HTTP fMP4 fallback at /api/stream.mp4?src=<name>
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
      {showLabel && label && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-xs font-medium truncate">{label}</span>
          <span className="ml-auto text-[10px] text-gray-400 uppercase tracking-wide">{mode}</span>
        </div>
      )}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <span className="text-gray-300 text-sm animate-pulse">Connecting to {host}…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 pointer-events-none">
          <span className="text-red-400 text-sm font-medium">go2rtc feed unavailable</span>
          <span className="text-gray-500 text-xs mt-1 max-w-[90%] truncate">{label || stream}</span>
          {err && <span className="text-gray-600 text-[10px] mt-1 max-w-[90%] truncate">{err}</span>}
        </div>
      )}
    </div>
  );
}
