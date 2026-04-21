import React, { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket } from '../../lib/socket';
import api from '../../lib/api';
import { confirmAsync } from '../../lib/dialog';

export default function AutocueController() {
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptName, setScriptName] = useState('Untitled Script');
  const [speed, setSpeed] = useState(40);
  const [fontSize, setFontSize] = useState('2rem');
  const [color, setColor] = useState('#ffffff');
  const [background, setBackground] = useState('#000000');
  const [lineHeight, setLineHeight] = useState('1.8');
  const [mirror, setMirror] = useState(false);
  const [paused, setPaused] = useState(true);
  const [currentLine, setCurrentLine] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);
  const [maxScroll, setMaxScroll] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [screens, setScreens] = useState([]);
  const [selectedScreen, setSelectedScreen] = useState('');
  const [studioId, setStudioId] = useState('');
  const [dirty, setDirty] = useState(false);

  const editorRef = useRef(null);
  const socketRef = useRef(null);

  // Load studio info
  useEffect(() => {
    api.get('/auth/me').then(data => {
      const sid = data.user?.studio_id || data.studio?.id || '';
      setStudioId(sid);
      if (sid) {
        api.get(`/screens?studio_id=${sid}`).then(s => setScreens(Array.isArray(s) ? s : s.screens || [])).catch(() => {});
        loadScripts(sid);
      }
    }).catch(() => {});
  }, []);

  // Socket setup
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;
    if (studioId) socket.emit('join_studio', { studioId });

    socket.on('autocue_position', (data) => {
      setCurrentLine(data.currentLine || 0);
      setScrollPos(data.scrollPos || 0);
      setMaxScroll(data.maxScroll || 1);
      setTotalLines(data.totalLines || 0);
      setPaused(data.paused ?? true);
    });

    return () => { socket.off('autocue_position'); };
  }, [studioId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Don't capture when typing in textarea
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          sendCommand(paused ? 'play' : 'pause');
          break;
        case 'Home':
          e.preventDefault();
          sendCommand('rewind');
          break;
        case 'PageDown':
          e.preventDefault();
          sendCommand('skipForward');
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSpeed(s => { const ns = Math.min(100, s + 5); sendCommand('setSpeed', ns); return ns; });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSpeed(s => { const ns = Math.max(10, s - 5); sendCommand('setSpeed', ns); return ns; });
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paused, selectedScreen, studioId]);

  function sendCommand(command, value) {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('autocue_control', {
      screenId: selectedScreen || undefined,
      studioId: studioId,
      command,
      value,
    });
  }

  async function loadScripts(sid) {
    try {
      const list = await api.get(`/autocue-scripts?studio_id=${sid}`);
      setScripts(Array.isArray(list) ? list : []);
    } catch { setScripts([]); }
  }

  async function loadScript(id) {
    try {
      const s = await api.get(`/autocue-scripts/${id}`);
      setActiveScript(s);
      setScriptContent(s.content || '');
      setScriptName(s.name || 'Untitled');
      setSpeed(s.speed || 40);
      setFontSize(s.font_size || '2rem');
      setDirty(false);
    } catch {}
  }

  async function saveScript() {
    try {
      if (activeScript) {
        await api.put(`/autocue-scripts/${activeScript.id}`, {
          name: scriptName,
          content: scriptContent,
          speed,
          font_size: fontSize,
        });
      } else {
        const s = await api.post('/autocue-scripts', {
          studio_id: studioId,
          name: scriptName,
          content: scriptContent,
          speed,
          font_size: fontSize,
        });
        setActiveScript(s);
      }
      setDirty(false);
      loadScripts(studioId);
    } catch {}
  }

  async function newScript() {
    setActiveScript(null);
    setScriptContent('');
    setScriptName('Untitled Script');
    setDirty(false);
  }

  async function deleteScript(id) {
    if (!await confirmAsync({
      title: 'Delete script?',
      message: 'The script will be removed from the controller library.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`/autocue-scripts/${id}`);
      if (activeScript?.id === id) newScript();
      loadScripts(studioId);
    } catch {}
  }

  function pushScript() {
    sendCommand('setScript', scriptContent);
    sendCommand('setSpeed', speed);
    sendCommand('setConfig', { fontSize, color, background, lineHeight, mirror });
    sendCommand('rewind');
  }

  function handleFileDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScriptContent(ev.target.result);
      setScriptName(file.name.replace(/\.[^.]+$/, ''));
      setDirty(true);
    };
    reader.readAsText(file);
  }

  const lines = scriptContent.split('\n');
  const wordCount = scriptContent.trim() ? scriptContent.trim().split(/\s+/).length : 0;
  const etaSeconds = speed > 0 ? Math.round((maxScroll - scrollPos) / speed) : 0;
  const etaMin = Math.floor(etaSeconds / 60);
  const etaSec = etaSeconds % 60;
  const progress = maxScroll > 0 ? Math.min(100, (scrollPos / maxScroll) * 100) : 0;
  const readTimeMin = Math.ceil(wordCount / 150); // ~150 wpm teleprompter speed

  function handleLineClick(lineIndex) {
    // Estimate scroll position for that line
    const lineHeightPx = parseFloat(fontSize) * parseFloat(lineHeight) * 1.5;
    const targetPos = lineIndex * lineHeightPx;
    sendCommand('setPosition', targetPos);
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white" onDrop={handleFileDrop} onDragOver={e => e.preventDefault()}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📜</span>
          <h1 className="text-lg font-bold">Autocue Controller</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${paused ? 'bg-yellow-600' : 'bg-green-600'}`}>
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedScreen} onChange={e => setSelectedScreen(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
            <option value="">All Screens</option>
            {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={pushScript}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-bold transition-colors">
            📺 Push to Screen
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Script Editor */}
        <div className="flex-[6] flex flex-col border-r border-gray-800 min-w-0">
          {/* Script selector */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/30">
            <select value={activeScript?.id || ''}
              onChange={e => e.target.value ? loadScript(e.target.value) : newScript()}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm flex-1">
              <option value="">New Script...</option>
              {scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input value={scriptName} onChange={e => { setScriptName(e.target.value); setDirty(true); }}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm w-48"
              placeholder="Script name" />
            <button onClick={saveScript} className={`px-3 py-1 rounded text-sm font-bold transition-colors ${dirty ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 text-gray-400'}`}>
              💾 Save
            </button>
            <button onClick={newScript} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm">+ New</button>
            {activeScript && (
              <button onClick={() => deleteScript(activeScript.id)} className="bg-red-900/50 hover:bg-red-700 px-3 py-1 rounded text-sm">🗑</button>
            )}
            <label className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm cursor-pointer">
              📂 Import
              <input type="file" accept=".txt,.md,.text" className="hidden" onChange={handleFileDrop} />
            </label>
          </div>

          {/* Editor with line numbers */}
          <div className="flex flex-1 overflow-auto" ref={editorRef}>
            <div className="flex-shrink-0 pt-3 pb-3 px-2 text-right select-none bg-gray-900/50 border-r border-gray-800" style={{ minWidth: '3rem' }}>
              {lines.map((_, i) => (
                <div key={i} onClick={() => handleLineClick(i)}
                  className={`text-xs leading-6 cursor-pointer px-1 rounded transition-colors ${
                    i === currentLine ? 'text-blue-400 bg-blue-900/30 font-bold' : 'text-gray-600 hover:text-gray-400'
                  }`}>
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={scriptContent}
              onChange={e => { setScriptContent(e.target.value); setDirty(true); }}
              className="flex-1 bg-transparent text-gray-200 p-3 resize-none outline-none leading-6"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem', lineHeight: '1.5rem' }}
              placeholder="Enter your teleprompter script here...&#10;&#10;Use **bold** for emphasis&#10;Use --- for pause markers&#10;Use [SLOW] or [FAST] for speed cues"
              spellCheck={false}
            />
          </div>

          {/* Script stats */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-800 text-xs text-gray-500 bg-gray-900/30">
            <span>{wordCount} words</span>
            <span>{lines.length} lines</span>
            <span>~{readTimeMin} min read time</span>
            {dirty && <span className="text-yellow-500">● Unsaved</span>}
          </div>
        </div>

        {/* Right: Live Controls */}
        <div className="flex-[4] flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Speed Control */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Speed</h3>
            <div className="text-center mb-3">
              <span className="text-4xl font-bold text-blue-400 font-mono">{speed}</span>
              <span className="text-sm text-gray-500 ml-1">px/sec</span>
            </div>
            <input type="range" min="10" max="100" value={speed}
              onChange={e => { const v = Number(e.target.value); setSpeed(v); sendCommand('setSpeed', v); }}
              className="w-full accent-blue-500" />
            <div className="flex gap-2 mt-2">
              {[['Slow', 20], ['Normal', 40], ['Fast', 65]].map(([label, val]) => (
                <button key={label} onClick={() => { setSpeed(val); sendCommand('setSpeed', val); }}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${speed === val ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Font Size</h3>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="6" step="0.25"
                value={parseFloat(fontSize)}
                onChange={e => {
                  const v = e.target.value + 'rem';
                  setFontSize(v);
                  sendCommand('setConfig', { fontSize: v });
                }}
                className="flex-1 accent-blue-500" />
              <span className="text-sm font-mono text-gray-400 w-16 text-right">{fontSize}</span>
            </div>
          </div>

          {/* Mirror */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Mirror</h3>
              <button onClick={() => { const v = !mirror; setMirror(v); sendCommand('setConfig', { mirror: v }); }}
                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${mirror ? 'bg-blue-600' : 'bg-gray-800'}`}>
                {mirror ? '🔄 ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Colors */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Colours</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                Text
                <input type="color" value={color}
                  onChange={e => { setColor(e.target.value); sendCommand('setConfig', { color: e.target.value }); }}
                  className="w-8 h-8 rounded border-0 cursor-pointer" />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                BG
                <input type="color" value={background}
                  onChange={e => { setBackground(e.target.value); sendCommand('setConfig', { background: e.target.value }); }}
                  className="w-8 h-8 rounded border-0 cursor-pointer" />
              </label>
            </div>
          </div>

          {/* Line Height */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Line Height</h3>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="3" step="0.1"
                value={parseFloat(lineHeight)}
                onChange={e => {
                  const v = e.target.value;
                  setLineHeight(v);
                  sendCommand('setConfig', { lineHeight: v });
                }}
                className="flex-1 accent-blue-500" />
              <span className="text-sm font-mono text-gray-400 w-12 text-right">{lineHeight}</span>
            </div>
          </div>

          {/* Mini Preview */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider p-3 pb-0">Preview</h3>
            <div className="h-32 mx-3 mb-3 mt-2 rounded overflow-hidden relative" style={{ background, transform: mirror ? 'scaleX(-1)' : 'none' }}>
              <div className="absolute inset-0 overflow-hidden" style={{ fontSize: '0.35rem' }}>
                <div style={{ transform: `translateY(-${scrollPos * 0.1}px)`, padding: '0.5rem', paddingTop: '40%' }}>
                  {lines.slice(Math.max(0, currentLine - 3), currentLine + 8).map((line, i) => {
                    const absLine = Math.max(0, currentLine - 3) + i;
                    const isCurrent = absLine === currentLine;
                    return (
                      <p key={i} style={{
                        color: isCurrent ? color : `${color}55`,
                        textAlign: 'center',
                        fontWeight: isCurrent ? 700 : 400,
                        lineHeight: '1.4',
                        margin: '0.15em 0',
                        fontSize: isCurrent ? '0.4rem' : '0.3rem',
                      }}>
                        {line || '\u00A0'}
                      </p>
                    );
                  })}
                </div>
              </div>
              {/* Reading line */}
              <div className="absolute left-0 right-0" style={{ top: '38%', height: '1px', background: 'rgba(59,130,246,0.4)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-3 px-6 py-3 border-t border-gray-800 bg-gray-900">
        <button onClick={() => sendCommand('rewind')}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-lg text-lg transition-colors" title="Rewind (Home)">
          ⏪
        </button>
        <button onClick={() => sendCommand(paused ? 'play' : 'pause')}
          className={`px-8 py-3 rounded-lg text-lg font-bold transition-colors ${paused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}
          title="Play/Pause (Space)">
          {paused ? '▶️ Play' : '⏸ Pause'}
        </button>
        <button onClick={() => sendCommand('skipForward')}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-lg text-lg transition-colors" title="Skip Forward (PgDn)">
          ⏩
        </button>

        {/* Progress bar */}
        <div className="flex-1 mx-4">
          <div className="h-2 bg-gray-800 rounded-full cursor-pointer overflow-hidden"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              sendCommand('setPosition', pct * maxScroll);
            }}>
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* ETA */}
        <div className="text-sm text-gray-400 font-mono min-w-[4rem] text-right">
          {etaMin}:{String(etaSec).padStart(2, '0')}
        </div>

        {/* Speed display */}
        <div className="text-sm font-bold text-blue-400 font-mono min-w-[5rem] text-right">
          {speed} px/s
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center gap-4 px-6 py-1.5 border-t border-gray-800/50 text-[10px] text-gray-600 bg-gray-950">
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">Home</kbd> Rewind</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">PgDn</kbd> Skip</span>
        <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">↑↓</kbd> Speed ±5</span>
      </div>
    </div>
  );
}
