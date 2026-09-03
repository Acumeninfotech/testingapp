function requireEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return String(value).trim();
}

function parsePositiveInteger(name, value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer environment variable ${name}: ${value}`);
  }

  return parsed;
}

function getAuthConfig() {
  const otpPepper = requireEnv('OTP_PEPPER');

  if (otpPepper.length < 32) {
    throw new Error('OTP_PEPPER must be at least 32 characters long');
  }

  return {
    otpPepper,

    otpExpiryMinutes: parsePositiveInteger(
      'OTP_EXPIRY_MINUTES',
      process.env.OTP_EXPIRY_MINUTES,
      10
    ),

    otpMaxAttempts: parsePositiveInteger(
      'OTP_MAX_ATTEMPTS',
      process.env.OTP_MAX_ATTEMPTS,
      5
    ),

    otpResendCooldownSeconds: parsePositiveInteger(
      'OTP_RESEND_COOLDOWN_SECONDS',
      process.env.OTP_RESEND_COOLDOWN_SECONDS,
      60
    ),

    otpDelivery: process.env.OTP_DELIVERY || 'disabled',

    sessionExpiryDays: parsePositiveInteger(
      'SESSION_EXPIRY_DAYS',
      process.env.SESSION_EXPIRY_DAYS,
      30
    ),

    sessionCookieName:
      process.env.SESSION_COOKIE_NAME || 'applysmart_session'
  };
}

module.exports = {
  getAuthConfig,
};
