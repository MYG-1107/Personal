const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyAdminPassword } = require('../services/authService');
const { createToken, revokeToken } = require('../services/tokenService');
const { requireAuth } = require('../middleware/auth');

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

  const token = createToken(expectedUsername);

  res.json({
    message: 'Login successful.',
    username: expectedUsername,
    token,
    token_type: 'Bearer',
  });
});

router.post('/logout', requireAuth, (req, res) => {
  revokeToken(req.auth.token);
  res.json({ message: 'Logged out.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ authenticated: true, username: req.auth.username });
});

module.exports = router;
