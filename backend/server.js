require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'vault-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Ensure Upload Directory
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Public Share Endpoint GET /share/:token
app.get('/share/:token', (req, res) => {
  db.get('SELECT * FROM files WHERE share_token = ?', [req.params.token], (err, row) => {
    if (err || !row) return res.status(404).send('Invalid or expired share link.');
    if (!fs.existsSync(row.file_path)) return res.status(404).send('File no longer exists on server.');

    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${row.original_filename}"`);
    fs.createReadStream(row.file_path).pipe(res);
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const cors = require('cors');

app.use(cors({
  origin: 'https://myg-1107.github.io',
  credentials: true
}));