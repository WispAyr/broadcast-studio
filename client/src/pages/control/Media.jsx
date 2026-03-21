import React, { useState, useEffect, useCallback, useRef } from 'react';

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

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Media() {
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState([]);
  const [preview, setPreview] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('broadcast_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/uploads', { headers });
      const data = await res.json();
      setFiles(data.map(f => ({ ...f, type: getFileType(f.filename) })));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFiles = async (fileList) => {
    const newUploads = Array.from(fileList).map((f, i) => ({ id: Date.now() + i, name: f.name, progress: 0 }));
    setUploading(prev => [...prev, ...newUploads]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const uploadId = newUploads[i].id;
      const form = new FormData();
      form.append('file', file);

      try {
        const xhr = new XMLHttpRequest();
        await new Promise((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploading(prev => prev.map(u => u.id === uploadId ? { ...u, progress: (e.loaded / e.total) * 100 } : u));
            }
          };
          xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(); };
          xhr.onerror = reject;
          xhr.open('POST', '/api/uploads');
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(form);
        });
      } catch (e) { console.error(e); }
      setUploading(prev => prev.filter(u => u.id !== uploadId));
    }
    fetchFiles();
  };

  const handleDelete = async (filename) => {
    await fetch(`/api/uploads/${filename}`, { method: 'DELETE', headers });
    setDeleteConfirm(null);
    fetchFiles();
  };

  const copyUrl = (url) => {
    const fullUrl = window.location.origin + url;
    navigator.clipboard.writeText(fullUrl);
  };

  const filtered = files.filter(f => {
    if (filter === 'images' && f.type !== 'image') return false;
    if (filter === 'videos' && f.type !== 'video') return false;
    if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Media Library</h2>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-6 ${
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-300 font-medium">Drop files here or click to browse</p>
        <p className="text-gray-500 text-sm mt-1">Images, videos, audio — up to 100MB each</p>
      </div>

      {/* Upload Progress */}
      {uploading.map(u => (
        <div key={u.id} className="mb-2 bg-gray-900 rounded-lg p-3 border border-gray-800">
          <div className="flex justify-between text-sm text-gray-300 mb-1">
            <span>{u.name}</span>
            <span>{Math.round(u.progress)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
          </div>
        </div>
      ))}

      {/* Filter & Search */}
      <div className="flex items-center gap-3 mb-4">
        {['all', 'images', 'videos'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'images' ? '🖼 Images' : '🎬 Videos'}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 w-64"
        />
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map(file => (
          <div key={file.filename} className="group relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all">
            <div className="aspect-square relative cursor-pointer" onClick={() => setPreview(file)}>
              {file.type === 'image' ? (
                <img src={file.url} alt={file.filename} className="w-full h-full object-cover" loading="lazy" />
              ) : file.type === 'video' ? (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <div className="text-5xl">▶️</div>
                </div>
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <div className="text-4xl">📄</div>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); copyUrl(file.url); }}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
                  title="Copy URL"
                >📋 Copy</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.filename); }}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg"
                  title="Delete"
                >🗑 Delete</button>
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs text-gray-300 truncate" title={file.filename}>{file.filename}</p>
              <p className="text-xs text-gray-500">{formatSize(file.size)} · {formatDate(file.modified)}</p>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-3">📂</div>
          <p>No media files found</p>
        </div>
      )}

      {/* Preview Lightbox */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setPreview(null)}>
          <div className="max-w-4xl max-h-full relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">✕</button>
            {preview.type === 'image' ? (
              <img src={preview.url} alt={preview.filename} className="max-w-full max-h-[80vh] rounded-lg" />
            ) : preview.type === 'video' ? (
              <video src={preview.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg" />
            ) : null}
            <p className="text-center text-gray-400 text-sm mt-3">{preview.filename} · {formatSize(preview.size)}</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-2">Delete file?</h3>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
