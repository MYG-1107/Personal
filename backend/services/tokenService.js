const crypto = require('node:crypto');

const activeTokens = new Map();

function createToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, { username, createdAt: Date.now() });
  return token;
}

function getTokenRecord(token) {
  return activeTokens.get(token) || null;
}

function revokeToken(token) {
  activeTokens.delete(token);
}

module.exports = {
  createToken,
  getTokenRecord,
  revokeToken,
};
