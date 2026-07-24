const express = require('express');
const cors = require('cors');
const { getProductionReadyUniversities } = require('./universities');
const { predict, PredictionInputError } = require('./predict');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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
