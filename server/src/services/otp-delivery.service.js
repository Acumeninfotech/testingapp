const { getAuthConfig } = require('../config/auth');

async function deliverOtp({ email, otp, purpose }) {
  const { otpDelivery } = getAuthConfig();

  if (otpDelivery === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Console OTP delivery cannot be used in production');
    }

    console.log(
      `[DEV OTP] ${email} | purpose=${purpose} | code=${otp}`
    );

    return;
  }

  if (otpDelivery === 'disabled') {
    throw new Error('OTP delivery is not configured');
  }

  throw new Error(`Unsupported OTP delivery mode: ${otpDelivery}`);
}

module.exports = {
  deliverOtp,
};
