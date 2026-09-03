const express = require('express');
const { getAuthConfig } = require('./config/auth');
const cors = require('cors');
const { getProductionReadyUniversities } = require('./universities');
const { predict, PredictionInputError } = require('./predict');
const {
  checkDatabaseHealth
} = require('./services/database-health.service');
const {
  AuthInputError,
  requestOtp,
  verifyOtp,
  getAuthenticatedUser,
  revokeSession
} = require('./services/auth.service');
const {
  ContextualPostcodeLookupError,
  lookupContextualPostcode
} = require('./contextual-postcode-lookup');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/database', async (req, res) => {
    try {
      const health = await checkDatabaseHealth();

      res.json({
        status: 'ok',
        database: health.status,
        databaseName: health.databaseName,
        responseTimeMs: health.responseTimeMs
      });
    } catch (error) {
      console.error('Database health check failed:', error.message);

      res.status(503).json({
        status: 'error',
        database: 'unavailable'
      });
    }
  });

  app.post('/api/auth/otp/request', async (req, res) => {
    try {
      await requestOtp(req.body && req.body.email);

      res.json({
        status: 'ok',
        message:
          'If the email can receive a sign-in code, one has been sent.'
      });
    } catch (error) {
      if (error instanceof AuthInputError) {
        res.status(400).json({
          error: error.message
        });
        return;
      }

      console.error('OTP request failed:', error.message);

      res.status(500).json({
        error: 'Unable to request a sign-in code'
      });
    }
  });

  app.post('/api/auth/otp/verify', async (req, res) => {
    try {
      const result = await verifyOtp({
        email: req.body && req.body.email,
        otp: req.body && req.body.otp
      });

      if (!result.verified) {
        res.status(401).json({
          error: 'Invalid or expired verification code'
        });
        return;
      }

      const {
        sessionExpiryDays,
        sessionCookieName
      } = getAuthConfig();

      const maxAge =
        sessionExpiryDays * 24 * 60 * 60 * 1000;

      const secure =
        process.env.NODE_ENV === 'production';

      res.cookie(
        sessionCookieName,
        result.sessionToken,
        {
          httpOnly: true,
          secure,
          sameSite: 'lax',
          maxAge,
          path: '/'
        }
      );

      res.json({
        status: 'ok',
        user: {
          userId: result.userId,
          email: result.email
        }
      });
    } catch (error) {
      if (error instanceof AuthInputError) {
        res.status(400).json({
          error: error.message
        });
        return;
      }

      console.error('OTP verification failed:', error.message);

      res.status(500).json({
        error: 'Unable to verify sign-in code'
      });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const {
        sessionCookieName
      } = getAuthConfig();

      const cookies = {};

      const cookieHeader = req.headers.cookie || '';

      for (const part of cookieHeader.split(';')) {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          continue;
        }

        const name = part
          .slice(0, separatorIndex)
          .trim();

        const value = part
          .slice(separatorIndex + 1)
          .trim();

        if (name) {
          cookies[name] = value;
        }
      }

      const user = await getAuthenticatedUser(
        cookies[sessionCookieName]
      );

      if (!user) {
        res.status(401).json({
          error: 'Not authenticated'
        });
        return;
      }

      res.json({
        status: 'ok',
        user
      });
    } catch (error) {
      console.error(
        'Authenticated user lookup failed:',
        error.message
      );

      res.status(500).json({
        error: 'Unable to load authenticated user'
      });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const {
        sessionCookieName
      } = getAuthConfig();

      const cookies = {};
      const cookieHeader = req.headers.cookie || '';

      for (const part of cookieHeader.split(';')) {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          continue;
        }

        const name = part
          .slice(0, separatorIndex)
          .trim();

        const value = part
          .slice(separatorIndex + 1)
          .trim();

        if (name) {
          cookies[name] = value;
        }
      }

      await revokeSession(
        cookies[sessionCookieName]
      );

      res.clearCookie(
        sessionCookieName,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        }
      );

      res.json({
        status: 'ok'
      });
    } catch (error) {
      console.error(
        'Logout failed:',
        error.message
      );

      res.status(500).json({
        error: 'Unable to sign out'
      });
    }
  });

  // Returns every profile satisfying the full readiness bundle
  // (see READINESS_FLAGS in ./universities.js) — not just production_ready.
  app.get('/api/universities', (req, res) => {
    try {
      const universities = getProductionReadyUniversities();
      res.json({ universities, count: universities.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load universities' });
    }
  });

  app.get('/api/contextual/postcode-lookup', (req, res) => {
    try {
      const postcode = typeof req.query.postcode === 'string' ? req.query.postcode : '';
      const result = lookupContextualPostcode(postcode);
      res.json(result);
    } catch (error) {
      if (error instanceof ContextualPostcodeLookupError && error.statusCode === 400) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to check postcode' });
    }
  });

  // Thin wrapper around the existing eligibility + interview prediction +
  // result-card presenter engine (assets/js/engine/*.js). Rejects any
  // universityId that is not readiness-bundle ready; contains no admissions
  // logic of its own — see server/src/predict.js.
  app.post('/api/predict', (req, res) => {
    try {
      const results = predict(req.body || {});
      res.json({ results });
    } catch (error) {
      if (error instanceof PredictionInputError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to run prediction' });
    }
  });

  return app;
}

module.exports = { createApp };
