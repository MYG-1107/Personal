const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAdminPassword } = require('../services/authService');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';

  if (!process.env.ADMIN_PASSWORD_HASH) {
    res.status(500).json({ error: 'Server setup incomplete. Missing admin password hash.' });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const usernameMatches = username === expectedUsername;
  const passwordMatches = await verifyAdminPassword(password);

  if (!usernameMatches || !passwordMatches) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  req.session.userId = 'owner';
  req.session.username = expectedUsername;

  res.json({ message: 'Login successful.', username: expectedUsername });
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    res.json({ message: 'Logged out.' });
    return;
  }

  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true, username: req.session.username });
    return;
  }

  res.json({ authenticated: false });
});

module.exports = router;
