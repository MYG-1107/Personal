const bcrypt = require('bcryptjs');

async function verifyAdminPassword(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return false;
  }

  return bcrypt.compare(password, hash);
}

module.exports = {
  verifyAdminPassword,
};
