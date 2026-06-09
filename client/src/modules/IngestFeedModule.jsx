import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * IngestFeedModule — plays a named ingest slot from the Ingest Centre.
 *
 * Config:
 *   slot_id      — ingest-centre slot UUID
 *   slot_name    — display label (optional, overrides fetched name)
 *   go2rtc_host  — go2rtc API base (default: /go2rtc proxied by nginx)
 *   mode         — webrtc | mse | iframe (default: webrtc)
 *   show_label   — show slot name overlay (default: true)
 *   show_waiting — show "Waiting for stream" when idle (default: true)
 *   ingest_api   — ingest centre API base (default: /api/ingest)
 *   background   — background color (default: #000)
 */
export default function IngestFeedModule({ config = {} }) {
  const {
    slot_id,
    slot_name: configLabel,
    go2rtc_host = '/go2rtc',
    mode = 'webrtc',
    show_label = true,
    show_waiting = true,
    ingest_api = '/api/ingest',
    background = '#000000',
    iframe_url: configIframeUrl,
  } = config;

  const [slotInfo, setSlotInfo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | live | error | waiting
  const [err, setErr] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef(null);
  const abortRef = useRef(null);
  const retryTimer = useRef(null);

  const label = configLabel || slotInfo?.name || slot_id || '';
  const go2rtcName = slotInfo?.go2rtc_name;
  const isIframe = slotInfo?.type === 'iframe' || mode === 'iframe';
  const iframeUrl = configIframeUrl || slotInfo?.iframe_url;
  const isLive = slotInfo?.live;

  // ── Fetch slot info ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slot_id && !configIframeUrl) return;
    if (!slot_id) { setSlotInfo({ type: 'iframe', iframe_url: configIframeUrl, live: true }); return; }

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${ingest_api}/slots/${slot_id}`);
        if (!res.ok) throw new Error(`slot fetch ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSlotInfo(data);
      } catch {}
      if (!cancelled) retryTimer.current = setTimeout(poll, 10000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(retryTimer.current); };
  }, [slot_id, ingest_api, configIframeUrl]);

  // ── WebRTC connection ───────────────────────────────────────────────────
  const startWebRTC = useCallback(async (host, streamName) => {
    const abort = new AbortController();
    abortRef.current = abort;

    const video = videoRef.current;
    if (!video) return;

    setErr('');
    setStatus('connecting');

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        bundlePolicy: 'max-bundle',
      });
      abort.signal.addEventListener('abort', () => { try { pc.close(); } catch {} });

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
        video.srcObject = remoteStream;
        video.play().catch(() => {});
        setStatus('live');
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (['failed', 'disconnected', 'closed'].includes(s) && !abort.signal.aborted) {
          setStatus('error');
          setErr(`WebRTC ${s}`);
          // Auto-retry after 5s
          setTimeout(() => setRetryCount(c => c + 1), 5000);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE
      await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') return resolve();
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') resolve();
        });
        setTimeout(resolve, 3000);
      });

      if (abort.signal.aborted) return;

      const res = await fetch(`${host}/api/webrtc?src=${encodeURIComponent(streamName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: pc.localDescription.type, sdp: pc.localDescription.sdp }),
        signal: abort.signal,
      });

      if (!res.ok) throw new Error(`go2rtc offer ${res.status}`);
      const answer = await res.json();
      if (abort.signal.aborted) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      if (abort.signal.aborted) return;
      setErr(String(e?.message || e));
      setStatus('error');
      setTimeout(() => setRetryCount(c => c + 1), 8000);
    }
  }, []);

  // ── MSE connection ──────────────────────────────────────────────────────
  const startMSE = useCallback((host, streamName) => {
    const video = videoRef.current;
    if (!video) return;
    setStatus('connecting');

    const wsProto = host.startsWith('https') ? 'wss' : 'ws';
    const wsHost = host.replace(/^https?:\/\//, '');
    const ws = new WebSocket(`${wsProto}://${wsHost}/api/ws?src=${encodeURIComponent(streamName)}`);
    ws.binaryType = 'arraybuffer';

    const abort = new AbortController();
    abortRef.current = abort;
    abort.signal.addEventListener('abort', () => ws.close());

    const ms = new MediaSource();
    video.src = URL.createObjectURL(ms);
    let sb = null;
    const queue = [];
    const drain = () => {
      if (!sb || sb.updating || !queue.length) return;
      try { sb.appendBuffer(queue.shift()); } catch {}
    };

    ms.addEventListener('sourceopen', () => {
      ws.send(JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.64001E,mp4a.40.2"' }));
    });

    ws.onmessage = ev => {
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
    ws.onerror = () => { setStatus('error'); setErr('WS error'); setTimeout(() => setRetryCount(c => c + 1), 5000); };
    ws.onclose = () => { if (!abort.signal.aborted) { setStatus('error'); setErr('WS closed'); } };
  }, []);

  // ── Connect when slot info arrives / retry ──────────────────────────────
  useEffect(() => {
    if (isIframe) return;
    if (!go2rtcName) return;
    if (!isLive && show_waiting) { setStatus('waiting'); return; }

    // Abort any existing connection
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    const video = videoRef.current;
    if (video) { video.pause(); video.srcObject = null; video.src = ''; }

    if (mode === 'mse') {
      startMSE(go2rtc_host, go2rtcName);
    } else {
      startWebRTC(go2rtc_host, go2rtcName);
    }

    return () => {
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    };
  }, [go2rtcName, isLive, mode, go2rtc_host, isIframe, retryCount, startWebRTC, startMSE, show_waiting]);

  // ── No slot configured ──────────────────────────────────────────────────
  if (!slot_id && !configIframeUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background }}>
        <span className="text-4xl mb-2 opacity-30">📡</span>
        <span className="text-gray-500 text-sm">No ingest slot configured</span>
        <span className="text-gray-600 text-xs mt-1">Set slot_id in module config</span>
      </div>
    );
  }

  // ── IFrame mode (YouTube, Twitch, etc.) ─────────────────────────────────
  if (isIframe && iframeUrl) {
    return (
      <div className="w-full h-full relative" style={{ background }}>
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={label}
        />
        {show_label && label && (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {label}
          </div>
        )}
      </div>
    );
  }

  // ── Waiting for stream ──────────────────────────────────────────────────
  if (status === 'waiting' || (!isLive && show_waiting)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background }}>
        <div className="w-10 h-10 rounded-full border-2 border-gray-700 flex items-center justify-center">
          <span className="text-gray-600 text-xl">📡</span>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-sm font-semibold">{label || 'Ingest Slot'}</p>
          <p className="text-gray-600 text-xs mt-0.5">Waiting for stream…</p>
        </div>
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Video stream ────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative" style={{ background }}>
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {show_label && label && status === 'live' && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-white text-sm font-semibold truncate">{label}</span>
          <span className="ml-auto text-[10px] text-gray-400 uppercase tracking-wide font-mono">LIVE</span>
        </div>
      )}

      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-white/70 text-sm">Connecting…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
          <span className="text-red-400 text-sm font-semibold">Stream unavailable</span>
          <span className="text-gray-500 text-xs truncate max-w-[90%]">{label}</span>
          {err && <span className="text-gray-600 text-[10px]">{err}</span>}
          <span className="text-gray-700 text-[10px] mt-1">Retrying…</span>
        </div>
      )}
    </div>
  );
}
