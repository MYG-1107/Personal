function requireAuth(req, res, next) {
  if (req.session && req.session.isLoggedIn) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Owner login required.' });
}

module.exports = requireAuth;