const crypto = require('crypto');
const { getAuthConfig } = require('../config/auth');

function generateOtp() {
  return crypto
    .randomInt(0, 1000000)
    .toString()
    .padStart(6, '0');
}

function hashOtp({ userId, purpose, otp }) {
  const { otpPepper } = getAuthConfig();

  return crypto
    .createHmac('sha256', otpPepper)
    .update(`${userId}:${purpose}:${otp}`)
    .digest('hex');
}

module.exports = {
  generateOtp,
  hashOtp,
};
