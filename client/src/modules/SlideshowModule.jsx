import React, { useState, useEffect, useRef } from 'react';

export default function SlideshowModule({ config = {} }) {
  const images = (config.images || '').split('\n').map(s => s.trim()).filter(Boolean);
  const interval = config.interval || 5000;
  const transition = config.transition || 'fade';
  const transitionDuration = config.transitionDuration || 1000;
  const fit = config.fit || 'cover';
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | transitioning
  const timerRef = useRef(null);
  const kenBurnsRef = useRef(0);

  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => {
        setPrev(c);
        setPhase('transitioning');
        const next = (c + 1) % images.length;
        kenBurnsRef.current = next;
        return next;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [images.length, interval]);

  useEffect(() => {
    if (phase === 'transitioning') {
      const t = setTimeout(() => { setPhase('idle'); setPrev(null); }, transitionDuration);
      return () => clearTimeout(t);
    }
  }, [phase, transitionDuration]);

  if (images.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-gray-600 text-sm">No images configured</p>
      </div>
    );
  }

  const getTransitionStyle = (isEntering) => {
    if (phase !== 'transitioning') return {};
    const dur = `${transitionDuration}ms`;
    if (transition === 'fade') {
      return {
        transition: `opacity ${dur} ease-in-out`,
        opacity: isEntering ? 1 : 0,
      };
    }
    if (transition === 'slide') {
      return {
        transition: `transform ${dur} ease-in-out`,
        transform: isEntering ? 'translateX(0)' : 'translateX(-100%)',
      };
    }
    if (transition === 'zoom') {
      return {
        transition: `opacity ${dur} ease-in-out, transform ${dur} ease-in-out`,
        opacity: isEntering ? 1 : 0,
        transform: isEntering ? 'scale(1)' : 'scale(1.15)',
      };
    }
    return {};
  };

  const kenBurns = config.kenBurns !== false;
  const kbStyle = kenBurns ? {
    animation: `kenburns ${interval + transitionDuration}ms ease-in-out infinite alternate`,
  } : {};

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1%, -1%); }
        }
      `}</style>

      {/* Previous image (fading out) */}
      {prev !== null && images[prev] && (
        <div className="absolute inset-0" style={{ zIndex: 1, ...getTransitionStyle(false) }}>
          <img src={images[prev]} alt="" className="w-full h-full" style={{ objectFit: fit }} />
        </div>
      )}

      {/* Current image */}
      <div className="absolute inset-0" style={{
        zIndex: 2,
        opacity: phase === 'transitioning' && transition === 'fade' ? 1 : undefined,
        ...(phase === 'transitioning' && transition === 'slide' ? {
          transition: `transform ${transitionDuration}ms ease-in-out`,
          transform: 'translateX(0)',
        } : {}),
      }}>
        <img
          src={images[current]}
          alt=""
          className="w-full h-full"
          style={{ objectFit: fit, ...(kenBurns ? kbStyle : {}) }}
        />
      </div>
    </div>
  );
}
