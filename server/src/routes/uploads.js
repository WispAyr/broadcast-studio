const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');

// Ensure base uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Resolve which studio folder a request operates on. Everyone is pinned to
// their own studio; a super admin (no studio of their own — they'd otherwise
// only ever see the near-empty 'shared' folder) may browse any studio's
// library by passing ?studio_id=. The id is sanitised to a path basename.
function resolveFolder(user, requestedStudioId) {
  if (requestedStudioId && user?.role === 'super_admin') {
    return path.basename(String(requestedStudioId));
  }
  return user?.studio_id || 'shared';
}

// Get studio-scoped upload directory
function getStudioDir(user, requestedStudioId) {
  const folder = resolveFolder(user, requestedStudioId);
  const dir = path.join(uploadsDir, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getStudioDir(req.user, req.query.studio_id);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = uuidv4() + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|avi|mp3|wav|ogg|m4a|aac|flac)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// POST /api/uploads - upload a file
router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const folder = resolveFolder(req.user, req.query.studio_id);
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    url: `/uploads/${folder}/${req.file.filename}`
  });
});

// GET /api/uploads - list uploaded files (scoped to user's studio;
// super admins may pass ?studio_id= to browse a specific studio's library)
router.get('/', authenticate, (req, res) => {
  try {
    const folder = resolveFolder(req.user, req.query.studio_id);
    const studioDir = path.join(uploadsDir, folder);
    
    if (!fs.existsSync(studioDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(studioDir)
      .filter(f => !f.startsWith('.'))
      // skip subdirectories (e.g. the players/ photo set) — they'd render as
      // broken zero-byte "files" in the Media library
      .filter(f => { try { return fs.statSync(path.join(studioDir, f)).isFile(); } catch { return false; } })
      .map(filename => {
        const stat = fs.statSync(path.join(studioDir, filename));
        const ext = path.extname(filename).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        const type = imageExts.includes(ext) ? 'image' : videoExts.includes(ext) ? 'video' : audioExts.includes(ext) ? 'audio' : 'other';
        return {
          filename,
          url: `/uploads/${folder}/${filename}`,
          size: stat.size,
          modified: stat.mtime,
          type
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/uploads/:filename - delete an uploaded file (scoped to user's studio)
router.delete('/:filename', authenticate, (req, res) => {
  const folder = resolveFolder(req.user, req.query.studio_id);
  const filePath = path.join(uploadsDir, folder, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  fs.unlinkSync(filePath);
  res.json({ message: 'File deleted' });
});

module.exports = router;
