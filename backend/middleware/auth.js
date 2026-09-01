function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    res.status(401).json({ error: 'You are not authorized to access this resource.' });
    return;
  }
  next();
}

module.exports = {
  requireAuth,
};
