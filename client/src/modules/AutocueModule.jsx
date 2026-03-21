import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';

export default function AutocueModule({ config = {} }) {
  const [scriptText, setScriptText] = useState(config.text || config.script || 'Welcome to the show.\n\nThis is your autocue script. Edit the module config to set your script text.\n\nThe text will scroll automatically at the configured speed.\n\nYou can pause and resume scrolling by clicking.');
  const [currentSpeed, setCurrentSpeed] = useState(config.speed || 40);
  const [currentFontSize, setCurrentFontSize] = useState(config.fontSize || '2rem');
  const [currentColor, setCurrentColor] = useState(config.color || '#ffffff');
  const [currentBg, setCurrentBg] = useState(config.background || '#000000');
  const [currentLineHeight, setCurrentLineHeight] = useState(config.lineHeight || '1.8');
  const [currentMirror, setCurrentMirror] = useState(config.mirror || false);

  const [paused, setPaused] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const animRef = useRef(null);
  const lastTimeRef = useRef(null);
  const scrollPosRef = useRef(0);

  // Keep scrollPosRef in sync
  useEffect(() => { scrollPosRef.current = scrollPos; }, [scrollPos]);

  // Update from config changes
  useEffect(() => {
    if (config.text || config.script) setScriptText(config.text || config.script);
  }, [config.text, config.script]);
  useEffect(() => { if (config.speed) setCurrentSpeed(config.speed); }, [config.speed]);
  useEffect(() => { if (config.fontSize) setCurrentFontSize(config.fontSize); }, [config.fontSize]);
  useEffect(() => { if (config.color) setCurrentColor(config.color); }, [config.color]);
  useEffect(() => { if (config.background) setCurrentBg(config.background); }, [config.background]);
  useEffect(() => { if (config.lineHeight) setCurrentLineHeight(config.lineHeight); }, [config.lineHeight]);
  useEffect(() => { if (config.mirror !== undefined) setCurrentMirror(config.mirror); }, [config.mirror]);

  // Reset scroll on script change
  useEffect(() => { setScrollPos(0); lastTimeRef.current = null; }, [scriptText]);

  // Listen for autocue_control socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = ({ command, value }) => {
      switch (command) {
        case 'play': setPaused(false); break;
        case 'pause': setPaused(true); break;
        case 'toggle': setPaused(p => !p); break;
        case 'setSpeed': setCurrentSpeed(value); break;
        case 'setPosition': setScrollPos(value); lastTimeRef.current = null; break;
        case 'setScript': setScriptText(value); break;
        case 'setConfig':
          if (value.fontSize) setCurrentFontSize(value.fontSize);
          if (value.color) setCurrentColor(value.color);
          if (value.background) setCurrentBg(value.background);
          if (value.lineHeight) setCurrentLineHeight(value.lineHeight);
          if (value.mirror !== undefined) setCurrentMirror(value.mirror);
          if (value.speed) setCurrentSpeed(value.speed);
          break;
        case 'rewind': setScrollPos(0); lastTimeRef.current = null; break;
        case 'skipForward':
          setScrollPos(prev => {
            if (!containerRef.current) return prev;
            return prev + containerRef.current.clientHeight * 0.8;
          });
          lastTimeRef.current = null;
          break;
      }
    };

    socket.on('autocue_control', handler);
    return () => socket.off('autocue_control', handler);
  }, []);

  // Emit position every 500ms
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const lines = scriptText.split('\n');
    const iv = setInterval(() => {
      const maxScroll = contentRef.current && containerRef.current
        ? contentRef.current.scrollHeight - containerRef.current.clientHeight
        : 1;
      socket.emit('autocue_position', {
        scrollPos: scrollPosRef.current,
        currentLine,
        totalLines: lines.length,
        maxScroll,
        paused,
      });
    }, 500);
    return () => clearInterval(iv);
  }, [currentLine, paused, scriptText]);

  // Animation loop
  useEffect(() => {
    const animate = (timestamp) => {
      if (!paused && contentRef.current && containerRef.current) {
        if (lastTimeRef.current !== null) {
          const delta = (timestamp - lastTimeRef.current) / 1000;
          setScrollPos(prev => {
            const maxScroll = contentRef.current.scrollHeight - containerRef.current.clientHeight;
            const next = prev + currentSpeed * delta;
            return next >= maxScroll ? maxScroll : next;
          });
        }
        lastTimeRef.current = timestamp;
      } else { lastTimeRef.current = null; }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused, currentSpeed]);

  // Estimate current line
  useEffect(() => {
    const lineHeightPx = parseFloat(currentFontSize) * parseFloat(currentLineHeight) * 1.5;
    const paddingTop = containerRef.current ? containerRef.current.clientHeight * 0.4 : 200;
    const effectiveScroll = scrollPos - paddingTop;
    const line = Math.max(0, Math.floor(effectiveScroll / lineHeightPx));
    setCurrentLine(line);
  }, [scrollPos, currentFontSize, currentLineHeight]);

  const lines = scriptText.split('\n');

  return (
    <div ref={containerRef} onClick={() => setPaused(p => !p)}
      className="w-full h-full overflow-hidden cursor-pointer relative"
      style={{ background: currentBg, transform: currentMirror ? 'scaleX(-1)' : 'none' }}>
      <style>{`
        @keyframes autocueFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .autocue-highlight {
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.08), transparent);
          border-left: 2px solid rgba(59,130,246,0.4);
        }
      `}</style>

      <div className="absolute top-0 left-0 right-0 h-24 z-10 pointer-events-none"
        style={{ background: `linear-gradient(180deg, ${currentBg}, transparent)` }} />
      <div className="absolute bottom-0 left-0 right-0 h-24 z-10 pointer-events-none"
        style={{ background: `linear-gradient(0deg, ${currentBg}, transparent)` }} />
      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: '38%', height: '3px' }}>
        <div className="h-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)' }} />
      </div>

      <div ref={contentRef}
        style={{ transform: `translateY(-${scrollPos}px)`, padding: '2rem 3rem', paddingTop: '40%' }}>
        {lines.map((line, i) => {
          const isCurrent = i === currentLine;
          const isNear = Math.abs(i - currentLine) <= 1;
          const isPast = i < currentLine;
          // Handle pause markers
          if (line.trim() === '---') {
            return <hr key={i} style={{ border: 'none', borderTop: '2px dashed rgba(255,255,255,0.2)', margin: '1em 2em' }} />;
          }
          // Handle speed markers
          let displayLine = line;
          let extraStyle = {};
          if (line.includes('[SLOW]')) { displayLine = line.replace('[SLOW]', ''); extraStyle.color = '#fbbf24'; }
          if (line.includes('[FAST]')) { displayLine = line.replace('[FAST]', ''); extraStyle.color = '#34d399'; }
          // Handle bold
          displayLine = displayLine.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

          return (
            <p key={i}
              className={`transition-all duration-300 ${isCurrent ? 'autocue-highlight' : ''}`}
              style={{
                color: isCurrent ? currentColor : isPast ? `${currentColor}33` : isNear ? `${currentColor}aa` : `${currentColor}55`,
                fontSize: currentFontSize,
                lineHeight: currentLineHeight,
                margin: '0.5em 0',
                textAlign: 'center',
                fontFamily: 'sans-serif',
                fontWeight: isCurrent ? 600 : 400,
                padding: '0.25em 1em',
                transform: isCurrent ? 'scale(1.02)' : 'scale(1)',
                letterSpacing: isCurrent ? '0.01em' : 'normal',
                ...extraStyle,
              }}
              dangerouslySetInnerHTML={{ __html: displayLine || '\u00A0' }}
            />
          );
        })}
      </div>

      {paused && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.9)', backdropFilter: 'blur(10px)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <span className="text-white text-xs font-bold uppercase tracking-wider">Paused</span>
        </div>
      )}

      <div className="absolute bottom-2 left-4 right-4 z-20">
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${contentRef.current ? Math.min(100, (scrollPos / (contentRef.current.scrollHeight - (containerRef.current?.clientHeight || 0))) * 100) : 0}%`,
              background: 'linear-gradient(90deg, rgba(59,130,246,0.4), rgba(59,130,246,0.6))',
            }} />
        </div>
      </div>
    </div>
  );
}
