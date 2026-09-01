const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../database');
const requireAuth = require('../middleware/auth');

// Configure Multer Disk Storage
const uploadDir = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique internal filename to avoid collisions and path traversal
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper: Determine category from MIME type
function getCategory(mimeType, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdfs';
  if (
    mimeType.startsWith('text/') ||
    ['.doc', '.docx', '.xls', '.xlsx', '.txt', '.md'].includes(ext)
  ) {
    return 'documents';
  }
  return 'others';
}

// GET /api/files - List files with search & filtering
router.get('/', (req, res) => {
  const { search, category } = req.query;
  let query = 'SELECT id, original_filename, mime_type, file_size, category, uploaded_at, share_token FROM files WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND original_filename LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY uploaded_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database query failed' });
    res.json(rows);
  });
});

// POST /api/files/upload - Upload file (Protected)
router.post('/upload', requireAuth, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded' });
  }

  const stmt = db.prepare(`
    INSERT INTO files (id, original_filename, stored_filename, file_path, mime_type, file_size, category, share_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const uploadedRecords = [];

  req.files.forEach(file => {
    const fileId = crypto.randomUUID();
    const shareToken = 'tok_' + crypto.randomBytes(8).toString('hex');
    const category = getCategory(file.mimetype, file.originalname);

    stmt.run([
      fileId,
      file.originalname,
      file.filename,
      file.path,
      file.mimetype,
      file.size,
      category,
      shareToken
    ]);

    uploadedRecords.push({ id: fileId, original_filename: file.originalname });
  });

  stmt.finalize();
  res.json({ success: true, message: 'Files uploaded successfully', files: uploadedRecords });
});

// GET /api/files/:id/download - Stream file download
router.get('/:id/download', (req, res) => {
  db.get('SELECT * FROM files WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'File not found' });

    if (!fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Physical file missing from server disk' });
    }

    res.download(row.file_path, row.original_filename);
  });
});

// GET /api/files/:id/view - Serve file for inline browser viewing
router.get('/:id/view', (req, res) => {
  db.get('SELECT * FROM files WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'File not found' });

    if (!fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Physical file missing from disk' });
    }

    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${row.original_filename}"`);
    fs.createReadStream(row.file_path).pipe(res);
  });
});

// DELETE /api/files/:id - Remove file from filesystem and SQLite (Protected)
router.delete('/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM files WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'File not found' });

    // Delete physical file
    if (fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }

    // Delete metadata row
    db.run('DELETE FROM files WHERE id = ?', [req.params.id], (dbErr) => {
      if (dbErr) return res.status(500).json({ error: 'Failed to delete file record' });
      res.json({ success: true, message: 'File deleted successfully' });
    });
  });
});

module.exports = router;