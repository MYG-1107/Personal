const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { detectCategory, isViewableInBrowser } = require('../services/fileService');
const { all, get, run } = require('../database');

const router = express.Router();

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json', '.xml',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.rtf',
  '.zip', '.rar', '.7z', '.tar', '.gz',
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const category = detectCategory(file.originalname, file.mimetype);
    const categoryDir = path.join(uploadsRoot, category);
    fs.mkdirSync(categoryDir, { recursive: true });
    cb(null, categoryDir);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname.toLowerCase());
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 20 * 1024 * 1024),
    files: 20,
  },
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname.toLowerCase());
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      cb(new Error('Unsupported file type.'));
      return;
    }
    cb(null, true);
  },
});

function mapFileRow(req, row) {
  return {
    id: row.id,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    file_size: row.file_size,
    category: row.category,
    uploaded_at: row.uploaded_at,
    can_view_in_browser: isViewableInBrowser(row.mime_type, row.original_filename),
    share_url: row.share_token ? `${req.protocol}://${req.get('host')}/share/${row.share_token}` : null,
  };
}

router.post('/upload', requireAuth, upload.array('files', 20), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400).json({ error: 'No files were uploaded.' });
      return;
    }

    const inserted = [];

    for (const file of req.files) {
      const category = detectCategory(file.originalname, file.mimetype);
      const relativePath = path.relative(path.join(__dirname, '..', '..'), file.path);

      const result = await run(
        `INSERT INTO files (
          original_filename, stored_filename, file_path, mime_type, file_size, category
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [file.originalname, file.filename, relativePath, file.mimetype, file.size, category],
      );

      const insertedRow = await get('SELECT * FROM files WHERE id = ?', [result.lastID]);
      inserted.push(mapFileRow(req, insertedRow));
    }

    res.status(201).json({ message: 'File uploaded successfully.', files: inserted });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const category = (req.query.category || 'all').trim().toLowerCase();

    const where = [];
    const params = [];

    if (search) {
      where.push('LOWER(original_filename) LIKE ?');
      params.push(`%${search.toLowerCase()}%`);
    }

    if (category && category !== 'all') {
      where.push('category = ?');
      params.push(category);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await all(
      `SELECT * FROM files ${whereClause} ORDER BY datetime(uploaded_at) DESC`,
      params,
    );

    res.json({ files: rows.map((row) => mapFileRow(req, row)) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    res.json({ file: mapFileRow(req, row) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', requireAuth, async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    const absolutePath = path.join(__dirname, '..', '..', row.file_path);

    await fsp.access(absolutePath);
    res.download(absolutePath, row.original_filename);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    next(error);
  }
});

router.get('/:id/view', requireAuth, async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    const absolutePath = path.join(__dirname, '..', '..', row.file_path);

    if (!isViewableInBrowser(row.mime_type, row.original_filename)) {
      res.status(400).json({ error: 'This file type cannot be previewed in browser. Please download it.' });
      return;
    }

    await fsp.access(absolutePath);
    res.type(row.mime_type || 'application/octet-stream');
    res.sendFile(absolutePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    const absolutePath = path.join(__dirname, '..', '..', row.file_path);
    await run('DELETE FROM files WHERE id = ?', [req.params.id]);

    try {
      await fsp.unlink(absolutePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/share', requireAuth, async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    await run('UPDATE files SET share_token = ? WHERE id = ?', [token, req.params.id]);

    res.json({
      message: 'Share link generated.',
      share_url: `${req.protocol}://${req.get('host')}/share/${token}`,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/share/revoke', requireAuth, async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    await run('UPDATE files SET share_token = NULL WHERE id = ?', [req.params.id]);
    res.json({ message: 'Share link revoked.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
