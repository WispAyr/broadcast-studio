const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /documents/:studioId — list documents for a studio
router.get('/documents/:studioId', authenticate, (req, res) => {
  try {
    const docs = db.prepare('SELECT id, studio_id, title, format, word_count, created_at, updated_at FROM autocue_documents WHERE studio_id = ? ORDER BY updated_at DESC').all(req.params.studioId);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /documents — create document
router.post('/documents', authenticate, (req, res) => {
  try {
    const { studio_id, title, content, format } = req.body;
    if (!studio_id || !title) return res.status(400).json({ error: 'studio_id and title required' });
    const id = uuidv4();
    const text = content || '';
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    db.prepare('INSERT INTO autocue_documents (id, studio_id, title, content, format, word_count) VALUES (?, ?, ?, ?, ?, ?)').run(id, studio_id, title, text, format || 'text', wordCount);
    res.status(201).json(db.prepare('SELECT * FROM autocue_documents WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /documents/doc/:id — get single document
router.get('/documents/doc/:id', authenticate, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM autocue_documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /documents/:id — update document
router.put('/documents/:id', authenticate, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM autocue_documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const { title, content, format } = req.body;
    const text = content !== undefined ? content : doc.content;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    db.prepare("UPDATE autocue_documents SET title = COALESCE(?, title), content = ?, format = COALESCE(?, format), word_count = ?, updated_at = datetime('now') WHERE id = ?")
      .run(title || null, text, format || null, wordCount, req.params.id);
    res.json(db.prepare('SELECT * FROM autocue_documents WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /documents/:id
router.delete('/documents/:id', authenticate, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM autocue_documents WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import — import text from URL, paste, or file content
router.post('/import', authenticate, async (req, res) => {
  try {
    const { url, text, filename } = req.body;
    let content = '';

    if (url) {
      // Fetch URL and extract text
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BroadcastStudio/1.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) return res.status(502).json({ error: `URL returned ${response.status}` });
      const html = await response.text();
      // Strip HTML tags, decode entities
      content = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else if (text) {
      content = text;
    } else {
      return res.status(400).json({ error: 'Provide url or text' });
    }

    // Handle markdown: strip common markdown syntax
    if (filename && (filename.endsWith('.md') || filename.endsWith('.markdown')) || (url && url.endsWith('.md'))) {
      content = content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[-*+]\s+/gm, '• ')
        .trim();
    }

    res.json({ content, wordCount: content.trim() ? content.trim().split(/\s+/).length : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
