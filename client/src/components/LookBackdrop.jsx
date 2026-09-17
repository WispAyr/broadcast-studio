import React, { useState, useEffect, useRef } from 'react';
import { ShaderView } from './ShaderLayer';
import { PostFXView } from './PostFX';

/**
 * LookBackdrop — renders a saved "look" (shader + palette + controls + finishing)
 * as a live, full-frame backdrop OUTSIDE a Remotion context (screens, previews).
 *
 * ShaderView/PostFXView are the pure, clock-driven halves of the shader and
 * finishing stacks (the Remotion wrappers use the frame clock; here we drive an
 * rAF clock ourselves, exactly like the Shader Studio preview). So a look looks
 * identical on a screen, in the Studio, and in an offline render.
 */

// Lively procedural spectrum so audio-reactive looks (spectrum-bars) animate
// even without an audio source on the screen.
function proceduralSpectrum(tMs) {
  const t = tMs / 1000;
  const s = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    s[i] = Math.max(0, (0.35 + 0.5 * Math.abs(Math.sin(t * 2.2 + i * 0.6) * Math.cos(t * 0.7 + i))) * (1 - i / 22));
  }
  return s;
}

export function LookBackdrop({ look, style }) {
  const [timeMs, setTimeMs] = useState(0);
  const raf = useRef();
  const last = useRef(null);
  const acc = useRef(0);
  const speed = (look && look.params && look.params.speed) || 1;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const tick = (t) => {
      if (last.current != null) acc.current += (t - last.current) * speedRef.current;
      last.current = t;
      setTimeMs(acc.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  if (!look || !look.shader) return null;
  const p = look.params || {};
  const finish = look.finishing || null;

  const shader = (
    <ShaderView
      shader={look.shader}
      colors={look.colors && look.colors.length ? look.colors : undefined}
      background={look.background || '#000000'}
      scale={p.scale ?? 1}
      softness={p.softness ?? 0.6}
      distortion={p.distortion ?? 0.8}
      rotation={p.rotation ?? 0}
      glslParams={look.glslParams || null}
      spectrum={proceduralSpectrum(timeMs)}
      timeMs={timeMs}
      style={{ width: '100%', height: '100%' }}
    />
  );

  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {finish ? <PostFXView timeMs={timeMs} {...finish}>{shader}</PostFXView> : shader}
    </div>
  );
}

export default LookBackdrop;
