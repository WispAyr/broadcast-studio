import React, { useState, useEffect, useRef } from 'react';

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
const VIDEO_EXTS = /\.(mp4|webm|mov|avi)$/i;

function getFileType(filename) {
  if (IMAGE_EXTS.test(filename)) return 'image';
  if (VIDEO_EXTS.test(filename)) return 'video';
  return 'other';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function MediaPicker({ open, onClose, onSelect, multiple = false }) {
  const [files, setFiles] = useState([]);
  const [tab, setTab] = useState('library');
  const [selected, setSelected] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('broadcast_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (open) {
      setSelected([]);
      fetch('/api/uploads', { headers })
        .then(r => r.json())
        .then(data => setFiles(data.map(f => ({ ...f, type: getFileType(f.filename) }))))
        .catch(console.error);
    }
  }, [open]);

  const uploadFiles = async (fileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const form = new FormData();
      form.append('file', file);
      try {
        await fetch('/api/uploads', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      } catch (e) { console.error(e); }
    }
    const res = await fetch('/api/uploads', { headers });
    const data = await res.json();
    setFiles(data.map(f => ({ ...f, type: getFileType(f.filename) })));
    setUploading(false);
    setTab('library');
  };

  const handleSelect = (file) => {
    if (multiple) {
      setSelected(prev =>
        prev.includes(file.url) ? prev.filter(u => u !== file.url) : [...prev, file.url]
      );
    } else {
      onSelect(file.url);
      onClose();
    }
  };

  const confirmMultiple = () => {
    onSelect(selected);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Media Library</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('library')}
              className={`px-3 py-1 rounded-lg text-sm ${tab === 'library' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >Browse</button>
            <button
              onClick={() => setTab('upload')}
              className={`px-3 py-1 rounded-lg text-sm ${tab === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >Upload</button>
            <button onClick={onClose} className="ml-2 text-gray-400 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'upload' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
              {uploading ? (
                <p className="text-gray-300">Uploading...</p>
              ) : (
                <>
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-gray-300">Drop files here or click to browse</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {files.map(file => (
                <div
                  key={file.filename}
                  onClick={() => handleSelect(file)}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:border-blue-400 ${
                    (multiple && selected.includes(file.url)) ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent'
                  }`}
                >
                  {file.type === 'image' ? (
                    <img src={file.url} alt={file.filename} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-3xl">▶️</div>
                  )}
                  {multiple && selected.includes(file.url) && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1">
                    <p className="text-xs text-gray-300 truncate">{file.filename}</p>
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">No media uploaded yet</div>
              )}
            </div>
          )}
        </div>

        {/* Footer for multiple selection */}
        {multiple && selected.length > 0 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-400">{selected.length} selected</span>
            <button onClick={confirmMultiple} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Add Selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
