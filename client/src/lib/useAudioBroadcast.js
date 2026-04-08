import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from './socket';

/**
 * Shared hook for capturing system/mic audio and broadcasting
 * frequency data via Socket.IO to visualizer modules on screens.
 */
export function useAudioBroadcast(studioId) {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);

  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const broadcastRef = useRef(null);
  const levelRef = useRef(null);

  const stop = useCallback(() => {
    if (broadcastRef.current) clearInterval(broadcastRef.current);
    if (levelRef.current) clearInterval(levelRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (ctxRef.current) ctxRef.current.close();
    streamRef.current = null;
    ctxRef.current = null;
    analyserRef.current = null;
    broadcastRef.current = null;
    levelRef.current = null;
    setActive(false);
    setLevel(0);
  }, []);

  const toggle = useCallback(async () => {
    if (active) {
      stop();
      return;
    }

    try {
      let stream;
      try {
        // Try display media (system audio) first
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        stream.getVideoTracks().forEach(t => t.stop());
        if (stream.getAudioTracks().length === 0) throw new Error('No audio');
      } catch {
        // Fall back to microphone
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const socket = getSocket();

      // Broadcast frequency data at 20Hz
      broadcastRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const freq = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freq);
        const binSize = Math.floor(freq.length / 128);
        const downsampled = [];
        for (let i = 0; i < 128; i++) {
          let sum = 0;
          for (let j = 0; j < binSize; j++) sum += freq[i * binSize + j];
          downsampled.push(Math.round(sum / binSize));
        }
        socket.emit('visualizer_audio_data', {
          studioId,
          frequencyData: downsampled,
          timestamp: Date.now(),
        });
      }, 50);

      // Update local level meter at 10Hz
      levelRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const freq = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freq);
        let sum = 0;
        for (let i = 0; i < freq.length; i++) sum += freq[i];
        setLevel(Math.min(1, (sum / freq.length / 255) * 3));
      }, 100);

      setActive(true);
      stream.getAudioTracks()[0]?.addEventListener('ended', stop);
    } catch (err) {
      alert('Failed to capture audio: ' + err.message);
    }
  }, [active, studioId, stop]);

  // Cleanup on unmount
  useEffect(() => stop, [stop]);

  return { active, level, toggle };
}
