const express = require('express');
const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'Yaswanth';
  const adminPass = process.env.ADMIN_PASSWORD || 'Yavi';

  if (username === adminUser && password === adminPass) {
    req.session.isLoggedIn = true;
    req.session.username = username;
    return res.json({ success: true, message: 'Logged in successfully', username });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// GET /api/auth/check - Verify session on page load
router.get('/check', (req, res) => {
  if (req.session && req.session.isLoggedIn) {
    return res.json({ isLoggedIn: true, username: req.session.username });
  }
  res.json({ isLoggedIn: false });
});

module.exports = router;