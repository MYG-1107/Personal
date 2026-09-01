const { getTokenRecord } = require('../services/tokenService');

function getBearerToken(req) {
  const customToken = req.headers['x-auth-token'];
  if (typeof customToken === 'string' && customToken.trim()) {
    return customToken.trim();
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const tokenRecord = token ? getTokenRecord(token) : null;

  if (!tokenRecord) {
    res.status(401).json({ error: 'You are not authorized to access this resource.' });
    return;
  }

  req.auth = {
    token,
    username: tokenRecord.username,
  };

  next();
}

module.exports = {
  requireAuth,
  getBearerToken,
};
