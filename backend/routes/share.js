const path = require('node:path');
const fsp = require('node:fs/promises');
const express = require('express');
const { get } = require('../database');
const { isViewableInBrowser } = require('../services/fileService');

const router = express.Router();

router.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    const row = await get('SELECT * FROM files WHERE share_token = ?', [token]);

    if (!row) {
      res.status(404).send('Shared file not found.');
      return;
    }

    const absolutePath = path.join(__dirname, '..', '..', row.file_path);
    await fsp.access(absolutePath);

    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    if (isViewableInBrowser(row.mime_type, row.original_filename)) {
      res.type(row.mime_type || 'application/octet-stream');
      res.sendFile(absolutePath);
      return;
    }

    res.download(absolutePath, row.original_filename);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      res.status(404).send('Shared file not found.');
      return;
    }
    next(error);
  }
});

module.exports = router;
