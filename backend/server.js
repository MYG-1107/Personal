const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const dotenv = require('dotenv');
const { initDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const shareRoutes = require('./routes/share');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const uploadCategories = ['images', 'pdfs', 'documents', 'text', 'others'];
for (const category of uploadCategories) {
  fs.mkdirSync(path.join(__dirname, '..', 'uploads', category), { recursive: true });
}

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: 'personal_file_vault_session',
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/share', shareRoutes);

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendDir, 'login.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((error, req, res, next) => {
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'File is too large.' });
    return;
  }

  if (error && error.message === 'Unsupported file type.') {
    res.status(400).json({ error: 'Unsupported file type.' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Unable to process request right now.' });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Personal File Vault running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, start };
