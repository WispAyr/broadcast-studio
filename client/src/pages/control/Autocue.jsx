import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../lib/api';
import { connectSocket } from '../../lib/socket';
import { useToast } from '../../components/Toast';
import { confirmAsync } from '../../lib/dialog';

export default function Autocue() {
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [content, setContent] = useState('');
  const [studioId, setStudioId] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showSave, setShowSave] = useState(false);

  // Autocue state from server
  const [autocueState, setAutocueState] = useState({
    scrollPos: 0, speed: 60, paused: true, fontSize: 48, documentId: null
  });

  const socketRef = useRef(null);
  const previewRef = useRef(null);

  // Get studio ID
  useEffect(() => {
    api.get('/studios').then(data => {
      const studios = data.studios || data || [];
      if (studios.length > 0) setStudioId(studios[0].id);
    }).catch(() => {});
  }, []);

  // Fetch documents
  useEffect(() => {
    if (!studioId) return;
    api.get(`/autocue/documents/${studioId}`).then(setDocuments).catch(() => {});
  }, [studioId]);

  // Socket connection
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('autocue:state', (data) => {
      setAutocueState(data);
    });

    return () => {
      socket.off('autocue:state');
    };
  }, []);

  // Update preview scroll
  useEffect(() => {
    if (previewRef.current) {
      const maxScroll = previewRef.current.scrollHeight - previewRef.current.clientHeight;
      const ratio = maxScroll > 0 ? autocueState.scrollPos / (autocueState.scrollPos + maxScroll) : 0;
      previewRef.current.scrollTop = ratio * maxScroll;
    }
  }, [autocueState.scrollPos]);

  function sendControl(action, value) {
    if (!studioId || !socketRef.current) return;
    socketRef.current.emit('autocue:control', { studioId, action, value });
  }

  function loadDocument(doc) {
    setSelectedDoc(doc);
    api.get(`/autocue/documents/doc/${doc.id}`).then(d => {
      setContent(d.content || '');
      // Broadcast document to screens
      if (socketRef.current && studioId) {
        socketRef.current.emit('autocue:start', { studioId, documentId: doc.id, maxScroll: 10000 });
        // Send content to screens
        const socket = socketRef.current;
        const io = socket;
        io.emit('autocue:control', { studioId, action: 'reset' });
      }
      // Broadcast document content via a custom approach — emit to studio
      broadcastDocument(d.content || '');
    }).catch(() => {});
  }

  function broadcastDocument(text) {
    // We use the socket to broadcast document content to all screens
    if (socketRef.current && studioId) {
      socketRef.current.emit('autocue:start', { studioId, documentId: selectedDoc?.id });
    }
  }

  async function handleSaveDocument() {
    if (!newTitle.trim() || !studioId) return;
    try {
      const doc = await api.post('/autocue/documents', {
        studio_id: studioId,
        title: newTitle,
        content: content,
        format: 'text'
      });
      setDocuments(prev => [doc, ...prev]);
      setSelectedDoc(doc);
      setNewTitle('');
      setShowSave(false);
      toast?.('Document saved', 'success');
    } catch (err) {
      toast?.(`Save failed: ${err.message}`, 'error');
    }
  }

  async function handleUpdateDocument() {
    if (!selectedDoc) return;
    try {
      await api.put(`/autocue/documents/${selectedDoc.id}`, { content });
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, word_count: content.trim().split(/\s+/).length } : d));
      toast?.('Document updated', 'success');
    } catch (err) {
      toast?.(`Update failed: ${err.message}`, 'error');
    }
  }

  async function handleDeleteDocument(id) {
    const doc = documents.find(d => d.id === id);
    if (!await confirmAsync({
      title: 'Delete document?',
      message: `"${doc?.title || id}" will be removed from the autocue library.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`/autocue/documents/${id}`);
      toast?.('Document deleted', 'success');
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (selectedDoc?.id === id) { setSelectedDoc(null); setContent(''); }
    } catch (err) {
      toast?.(`Delete failed: ${err.message}`, 'error');
    }
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    try {
      const result = await api.post('/autocue/import', { url: importUrl });
      setContent(result.content || '');
      setImportUrl('');
      setShowImport(false);
      toast?.('Imported from URL', 'success');
    } catch (err) {
      toast?.(`Import failed: ${err.message}`, 'error');
    }
  }

  function handleImportText() {
    if (!importText.trim()) return;
    setContent(importText);
    setImportText('');
    setShowImport(false);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent(ev.target.result || '');
      setShowImport(false);
    };
    reader.readAsText(file);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); sendControl('toggle'); break;
        case 'ArrowUp': e.preventDefault(); sendControl('speed_up'); break;
        case 'ArrowDown': e.preventDefault(); sendControl('speed_down'); break;
        case 'ArrowRight': e.preventDefault(); sendControl('font_up'); break;
        case 'ArrowLeft': e.preventDefault(); sendControl('font_down'); break;
        case 'Home': e.preventDefault(); sendControl('reset'); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [studioId]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const estReadTime = Math.ceil(wordCount / 150);
  const { scrollPos, speed, paused, fontSize } = autocueState;

  return (
    <div className="flex h-full">
      {/* Left: Controls */}
      <div className="flex-1 p-6 overflow-y-auto hide-scrollbar">
        <h1 className="text-2xl font-bold text-white mb-6">Autocue Control</h1>

        {/* Document selector */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <select
              value={selectedDoc?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id === e.target.value);
                if (doc) loadDocument(doc);
              }}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select document...</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>{d.title} ({d.word_count}w)</option>
              ))}
            </select>
            <button onClick={() => setShowImport(!showImport)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
              Import
            </button>
            <button onClick={() => setShowSave(!showSave)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
              Save As
            </button>
          </div>

          {/* Save panel */}
          {showSave && (
            <div className="flex gap-2 mb-3">
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Document title" className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              <button onClick={handleSaveDocument} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">Save</button>
            </div>
          )}

          {/* Import panel */}
          {showImport && (
            <div className="border-t border-gray-800 pt-3 space-y-3">
              <div className="flex gap-2">
                <input type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Import from URL..." className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                <button onClick={handleImportUrl} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg">Fetch</button>
              </div>
              <div>
                <input type="file" accept=".txt,.md,.text" onChange={handleFileUpload} className="text-sm text-gray-400" />
              </div>
              <div>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Or paste text here..." rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono" />
                <button onClick={handleImportText} className="mt-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded">Use Pasted Text</button>
              </div>
            </div>
          )}

          {/* Selected doc actions */}
          {selectedDoc && (
            <div className="flex gap-2 mt-2">
              <button onClick={handleUpdateDocument} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded">Update Doc</button>
              <button onClick={() => handleDeleteDocument(selectedDoc.id)} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded">Delete</button>
            </div>
          )}
        </div>

        {/* Transport controls */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={() => sendControl('reset')} className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-lg rounded-lg" title="Reset (Home)">⏮</button>
            <button onClick={() => sendControl('speed_down')} className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-lg rounded-lg" title="Slower (↓)">⏪</button>
            <button onClick={() => sendControl('toggle')} className={`px-6 py-3 text-white text-lg rounded-lg font-bold ${paused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}`} title="Play/Pause (Space)">
              {paused ? '▶' : '⏸'}
            </button>
            <button onClick={() => sendControl('speed_up')} className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-lg rounded-lg" title="Faster (↑)">⏩</button>
            <button onClick={() => sendControl('jump_to', 99999)} className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-lg rounded-lg" title="End">⏭</button>
          </div>

          {/* Speed slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Speed</span>
              <span>{speed} px/s</span>
            </div>
            <input type="range" min="10" max="200" step="5" value={speed} onChange={e => sendControl('set_speed', Number(e.target.value))} className="w-full accent-blue-500" />
          </div>

          {/* Font size */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => sendControl('font_down')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded" title="Smaller (←)">A-</button>
              <span className="text-gray-300 text-sm w-12 text-center">{fontSize}px</span>
              <button onClick={() => sendControl('font_up')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded" title="Larger (→)">A+</button>
            </div>
            <div className="text-xs text-gray-500">
              Space=play · ↑↓=speed · ←→=font · Home=reset
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex items-center gap-4 text-sm">
          <span className="text-gray-400">{wordCount} words</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400">~{estReadTime} min read</span>
          <span className="text-gray-600">·</span>
          <span className={paused ? 'text-yellow-400' : 'text-green-400'}>{paused ? 'Paused' : 'Playing'}</span>
          <div className="flex-1" />
          <span className="text-gray-500">{Math.round(scrollPos)}px</span>
        </div>

        {/* Editable content */}
        <div className="mt-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white text-sm font-mono leading-relaxed focus:outline-none focus:border-blue-500"
            placeholder="Enter or import autocue script..."
          />
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="w-80 border-l border-gray-800 bg-black flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-xs font-semibold text-gray-400 uppercase">Screen Preview</h3>
        </div>
        <div ref={previewRef} className="flex-1 overflow-hidden relative" style={{ fontSize: `${fontSize * 0.4}px` }}>
          {/* Fade edges */}
          <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none" style={{ height: '15%', background: 'linear-gradient(to bottom, #000, transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none" style={{ height: '15%', background: 'linear-gradient(to top, #000, transparent)' }} />
          <div className="p-4 pt-16" style={{ lineHeight: '1.8' }}>
            {content.split('\n').map((line, i) => (
              <p key={i} className="text-center text-white/70 mb-1" style={{ fontFamily: 'sans-serif' }}>
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
