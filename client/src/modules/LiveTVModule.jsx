import React, { useEffect, useRef, useState } from 'react';
import { onDuck, rampVolume } from '../lib/audioBus';

// ─── Live TV — off-air channel as a first-class source ──────────────────────
// Plays a channel from the venue HDHomeRun → go2rtc relay (docs/TUNER.md).
// The module references a channel by `key`; the stream name + go2rtc host are
// resolved from /api/livetv, so retuning never touches layouts.
//
// config:
//   channel   — registry key, e.g. 'bbc-one' | 'stv' (required)
//   audio     — 'auto' (default: sound only on PA/audio-output screens)
//               | 'on' (always) | 'off' (never)
//   mode      — '' (registry default) | 'mse' | 'webrtc' | 'mp4'
//   host      — override go2rtc base URL for this instance only
//   fit       — 'cover' (default) | 'contain'
//   showLabel — channel chip bottom-left (default true)
//
// Audio joins the duck bus like a bed: stings/voiceovers duck the match sound.

const RETRY_MS = [1000, 2000, 4000, 8000, 15000];

export default function LiveTVModule({ config = {} }) {
  const [registry, setRegistry] = useState(null);
  const [regErr, setRegErr] = useState('');
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  const videoRef = useRef(null);
  const attemptRef = useRef(0);

  const channelKey = config.channel || config.stream || '';
  const fit = config.fit === 'contain' ? 'contain' : 'cover';
  const showLabel = config.showLabel !== false;

  // PA gating: ScreenDisplay mirrors its audioOutput flag onto window so
  // modules can behave like beds/stings without prop plumbing. In the editor
  // preview the flag is undefined → muted, which is what you want.
  const audioMode = config.audio || 'auto';
  const wantsAudio = audioMode === 'on' || (audioMode === 'auto' && typeof window !== 'undefined' && window.__bsAudioOutput === true);

  useEffect(() => {
    let dead = false;
    fetch('/api/livetv')
      .then((r) => { if (!r.ok) throw new Error(`livetv ${r.status}`); return r.json(); })
      .then((j) => { if (!dead) setRegistry(j); })
      .catch((e) => { if (!dead) setRegErr(String(e.message || e)); });
    return () => { dead = true; };
  }, []);

  const channel = registry?.channels?.find((c) => c.key === channelKey) || null;
  const host = (config.host || registry?.host || '').replace(/\/+$/, '');
  const mode = (config.mode || registry?.mode || 'mse').toLowerCase();
  const stream = channel?.stream || '';

  // Fader volume (mixer-settable via soft update_module_config) × duck gain,
  // same base×duck model as AudioModule beds.
  const baseVol = Math.max(0, Math.min(1, typeof config.volume === 'number' ? config.volume : 1));
  const duckRef = useRef(1);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wantsAudio) return undefined;
    video.muted = false;
    rampVolume(video, baseVol * duckRef.current, 150);
    return onDuck((gain, ms) => { duckRef.current = gain; rampVolume(video, baseVol * gain, ms); });
  }, [wantsAudio, status, baseVol]);

  useEffect(() => {
    if (!stream || !host) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let pc, ws, ms, retryTimer, abort = false;
    setErr('');
    setStatus('connecting');

    const retry = (why) => {
      if (abort) return;
      clearTimeout(retryTimer); // onerror + onclose can both land — keep one timer
      setErr(String(why?.message || why || 'error'));
      setStatus('error');
      const wait = RETRY_MS[Math.min(attemptRef.current, RETRY_MS.length - 1)];
      attemptRef.current += 1;
      retryTimer = setTimeout(() => { if (!abort) start(); }, wait);
    };

    const live = () => { attemptRef.current = 0; setStatus('live'); };

    function startMSE() {
      try {
        if (!('MediaSource' in window)) return retry('MSE unsupported');
        ms = new MediaSource();
        video.src = URL.createObjectURL(ms);
        const wsProto = host.startsWith('https') ? 'wss' : 'ws';
        const wsHost = host.replace(/^https?:\/\//, '');
        ws = new WebSocket(`${wsProto}://${wsHost}/api/ws?src=${encodeURIComponent(stream)}`);
        ws.binaryType = 'arraybuffer';
        let sb = null; const queue = [];
        const drain = () => {
          if (!sb || sb.updating || !queue.length) return;
          try { sb.appendBuffer(queue.shift()); } catch (e) { retry(e); }
        };
        ms.addEventListener('sourceopen', () => {
          const sendReq = () => ws.send(JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.640033,mp4a.40.2"' }));
          if (ws.readyState === WebSocket.OPEN) sendReq();
          else ws.addEventListener('open', sendReq, { once: true });
        });
        ws.onmessage = (ev) => {
          if (typeof ev.data === 'string') {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'mse') {
              sb = ms.addSourceBuffer(msg.value);
              sb.mode = 'segments';
              sb.addEventListener('updateend', drain);
              live();
              video.play().catch(() => {});
            }
            return;
          }
          queue.push(ev.data);
          drain();
        };
        ws.onerror = () => retry('ws error');
        ws.onclose = () => { if (!abort && status !== 'error') retry('ws closed'); };
      } catch (e) { retry(e); }
    }

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
          live();
        };
        pc.onconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) retry(`webrtc ${pc.connectionState}`);
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
      } catch (e) { retry(e); }
    }

    function startMP4() {
      try {
        video.src = `${host}/api/stream.mp4?src=${encodeURIComponent(stream)}`;
        video.play().then(live).catch((e) => retry(e));
      } catch (e) { retry(e); }
    }

    function start() {
      try { pc && pc.close(); } catch {}
      try { ws && ws.close(); } catch {}
      if (mode === 'webrtc') startWebRTC();
      else if (mode === 'mp4') startMP4();
      else startMSE();
    }

    start();

    return () => {
      abort = true;
      clearTimeout(retryTimer);
      try { pc && pc.close(); } catch {}
      try { ws && ws.close(); } catch {}
      try { if (ms && ms.readyState === 'open') ms.endOfStream(); } catch {}
      try { video.pause(); video.removeAttribute('src'); video.srcObject = null; video.load(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, stream, mode]);

  const chipColor = channel?.color || '#dc2626';
  const chipText = channel?.short || channel?.label || channelKey;

  if (!channelKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black">
        <span className="text-4xl mb-2 opacity-30">📺</span>
        <span className="text-gray-500 text-sm">No channel configured</span>
      </div>
    );
  }
  if (regErr || (registry && !channel)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black">
        <span className="text-4xl mb-2 opacity-30">📺</span>
        <span className="text-red-400 text-sm">{regErr ? 'Live TV registry unavailable' : `Unknown channel "${channelKey}"`}</span>
        {regErr && <span className="text-gray-600 text-xs mt-1">{regErr}</span>}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black">
      <video
        ref={videoRef}
        muted={!wantsAudio}
        autoPlay
        playsInline
        className="w-full h-full"
        style={{ objectFit: fit }}
      />
      {showLabel && (
        <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2.5 py-1 rounded bg-black/70">
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: status === 'live' ? '#ef4444' : '#6b7280' }} />
          <span className="text-white text-xs font-bold tracking-wide">{chipText}</span>
          {wantsAudio && <span className="text-[10px] text-emerald-400">🔊</span>}
        </div>
      )}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <span className="text-gray-300 text-sm animate-pulse">Tuning {channel?.label || channelKey}…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 pointer-events-none">
          <span className="text-2xl mb-1 opacity-40">📡</span>
          <span className="text-red-400 text-sm font-medium">{channel?.label || channelKey} — no signal</span>
          <span className="text-gray-500 text-[10px] mt-1 max-w-[90%] truncate">{err} · retrying</span>
        </div>
      )}
    </div>
  );
}
