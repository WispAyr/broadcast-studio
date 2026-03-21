import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

export default function LiveTextModule({ config = {}, moduleId }) {
  const [text, setText] = useState(config.text || '');
  const [subtitle, setSubtitle] = useState(config.subtitle || '');
  const [visible, setVisible] = useState(false);
  const style = config.style || 'lower-third';
  const align = config.align || 'left';
  const color = config.color || '#ffffff';
  const background = config.background || 'rgba(0,0,0,0.7)';
  const accentColor = config.accentColor || '#3b82f6';

  useEffect(() => {
    setText(config.text || '');
    setSubtitle(config.subtitle || '');
  }, [config.text, config.subtitle]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for live text updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (data) => {
      if (data.moduleId === moduleId || data.moduleId === config._id) {
        if (data.text !== undefined) setText(data.text);
        if (data.subtitle !== undefined) setSubtitle(data.subtitle);
      }
    };

    socket.on('update_module_text', handler);
    return () => socket.off('update_module_text', handler);
  }, [moduleId, config._id]);

  if (style === 'fullscreen') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: background || '#000', color }}>
        <div className="absolute inset-0 opacity-20" style={{
          background: `radial-gradient(ellipse at center, ${accentColor}, transparent 70%)`
        }} />
        <div className="relative z-10 text-center px-8" style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h1 className="font-black leading-tight" style={{
            fontSize: 'clamp(2rem, 8vw, 6rem)',
            textShadow: `0 0 40px ${accentColor}44, 0 4px 20px rgba(0,0,0,0.5)`,
          }}>{text}</h1>
          {subtitle && (
            <p className="mt-4 text-lg opacity-70 font-medium tracking-wide uppercase"
              style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>{subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  if (style === 'banner') {
    return (
      <div className="w-full h-full flex items-center relative overflow-hidden"
        style={{ background: background || '#000', color }}>
        <style>{`
          @keyframes bannerScroll {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accentColor }} />
        <div className="whitespace-nowrap font-bold text-2xl" style={{
          animation: 'bannerScroll 20s linear infinite',
        }}>
          {text} &nbsp;&nbsp;&nbsp;●&nbsp;&nbsp;&nbsp; {text} &nbsp;&nbsp;&nbsp;●&nbsp;&nbsp;&nbsp; {text}
        </div>
      </div>
    );
  }

  // Lower-third (default)
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: 'transparent' }}>
      <div className="absolute bottom-0 left-0 right-0" style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Accent line */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88, transparent)` }} />

        {/* Glass panel */}
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '16px 24px',
          textAlign: align,
        }}>
          <h2 className="font-bold text-xl leading-tight" style={{ color }}>{text}</h2>
          {subtitle && (
            <p className="mt-1 text-sm opacity-60 font-medium" style={{ color }}>{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
