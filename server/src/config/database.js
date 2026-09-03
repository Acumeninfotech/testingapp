function requireEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return String(value).trim();
}

function parseBoolean(name, value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`Invalid boolean environment variable ${name}: ${value}`);
}

function parseInteger(name, value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer environment variable ${name}: ${value}`);
  }

  return parsed;
}

function getDatabaseConfig() {
  return {
    server: requireEnv('DB_SERVER'),
    port: parseInteger('DB_PORT', process.env.DB_PORT, 1433),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),

    options: {
      encrypt: parseBoolean(
        'DB_ENCRYPT',
        process.env.DB_ENCRYPT,
        true
      ),
      trustServerCertificate: parseBoolean(
        'DB_TRUST_SERVER_CERTIFICATE',
        process.env.DB_TRUST_SERVER_CERTIFICATE,
        false
      ),
    },

    connectionTimeout: parseInteger(
      'DB_CONNECTION_TIMEOUT_MS',
      process.env.DB_CONNECTION_TIMEOUT_MS,
      15000
    ),

    requestTimeout: parseInteger(
      'DB_REQUEST_TIMEOUT_MS',
      process.env.DB_REQUEST_TIMEOUT_MS,
      15000
    ),

    pool: {
      max: parseInteger(
        'DB_POOL_MAX',
        process.env.DB_POOL_MAX,
        10
      ),
      min: parseInteger(
        'DB_POOL_MIN',
        process.env.DB_POOL_MIN,
        0
      ),
      idleTimeoutMillis: parseInteger(
        'DB_POOL_IDLE_TIMEOUT_MS',
        process.env.DB_POOL_IDLE_TIMEOUT_MS,
        30000
      ),
    },
  };
}

module.exports = {
  getDatabaseConfig,
};
