#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { predict } = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const args = process.argv.slice(2);
const profileId = args.find((arg) => !arg.startsWith('--'));
const write = args.includes('--write');

if (!profileId) {
  fail(
    'Usage: node scripts/generate-result-card-example.js <profile-id> [--write]'
  );
}

const fixturePath = path.join(
  rootDir,
  'data',
  'fixtures',
  'interview-band-classification',
  `${profileId}.json`
);

const examplePath = path.join(
  rootDir,
  'data',
  'examples',
  `${profileId}-result-card.example.json`
);

if (!fs.existsSync(fixturePath)) {
  fail(`No interview-band fixture found: ${fixturePath}`);
}

if (!fs.existsSync(examplePath)) {
  fail(`No result-card example found: ${examplePath}`);
}

const fixture = readJson(fixturePath);

if (!fixture.base_applicant) {
  fail(
    `${profileId} fixture does not expose canonical base_applicant; ` +
    'automatic snapshot generation is not supported for this profile yet.'
  );
}

const existing = readJson(examplePath);

const results = predict({
  studentProfile: fixture.base_applicant,
  universityIds: [profileId]
});

if (!Array.isArray(results) || results.length !== 1) {
  fail(`Expected exactly one prediction result for ${profileId}.`);
}

const generated = results[0].result_card;

/*
 * Result-card examples contain both:
 *
 * 1. preserved documentation / evidence metadata
 * 2. fields derived by the production prediction/presenter pipeline
 *
 * This script deliberately owns only the derived runtime fields.
 * It must not replace the complete example JSON.
 */
function managedProjection(card) {
  return {
    prediction: {
      result_band: card.prediction?.result_band ?? null,
      ranking_metric: card.prediction?.ranking_metric ?? null,
      guidance_pool_id: card.prediction?.guidance_pool_id ?? null,
      score: card.prediction?.score ?? null,
      score_scale: card.prediction?.score_scale ?? null
    },

    display: card.display && typeof card.display === 'object'
      ? {
        primary_user_facing_recommendation:
          card.display.primary_user_facing_recommendation ?? null,
        recommendation_display_state:
          card.display.recommendation_display_state ?? null,
        primary_explanation:
          card.display.primary_explanation ?? null,
        historical_guidance_caveat:
          card.display.historical_guidance_caveat ?? null,
        headline:
          card.display.headline ?? null
      }
      : null,

    primary_user_facing_recommendation:
      card.primary_user_facing_recommendation ?? null,

    primary_explanation:
      card.primary_explanation ?? null,

    recommendation_display_state:
      card.recommendation_display_state ?? null,

    trust_statement:
      card.trust_statement ?? null,

    historical_guidance_caveat:
      card.historical_guidance_caveat ?? null,

    evidence_confidence:
      card.evidence_confidence ?? null,

    decision_timeline:
      card.decision_timeline ?? null,

    decision_transparency:
      card.decision_transparency ?? null
  };
}

function refreshManagedFields(existingCard, generatedCard) {
  const refreshed = clone(existingCard);

  refreshed.prediction = {
    ...(refreshed.prediction || {}),
    result_band: generatedCard.prediction?.result_band ?? null,
    ranking_metric: generatedCard.prediction?.ranking_metric ?? null,
    guidance_pool_id: generatedCard.prediction?.guidance_pool_id ?? null,
    score: generatedCard.prediction?.score ?? null,
    score_scale:
      refreshed.prediction?.score_scale ??
      generatedCard.prediction?.score_scale ??
      null
  };

  for (const field of [
    'primary_user_facing_recommendation',
    'primary_explanation',
    'recommendation_display_state',
    'trust_statement',
    'historical_guidance_caveat',
    'evidence_confidence',
    'decision_timeline',
    'decision_transparency'
  ]) {
    if (Object.prototype.hasOwnProperty.call(generatedCard, field)) {
      refreshed[field] = clone(generatedCard[field]);
    }
  }

  /*
   * Some historical examples retain a nested display mirror.
   * Keep it synchronised with the canonical presenter output while
   * preserving display-only documentation fields such as headline.
   */
  if (refreshed.display && typeof refreshed.display === 'object') {
    refreshed.display = {
      ...refreshed.display,
      primary_user_facing_recommendation:
        generatedCard.primary_user_facing_recommendation ?? null,
      recommendation_display_state:
        generatedCard.recommendation_display_state ?? null,
      primary_explanation:
        generatedCard.primary_explanation ?? null,
      historical_guidance_caveat:
        generatedCard.historical_guidance_caveat ?? null,
      headline:
        generatedCard.primary_user_facing_recommendation ?? null
    };
  }

  return refreshed;
}

const refreshed = refreshManagedFields(existing, generated);

const existingManaged = managedProjection(existing);
const refreshedManaged = managedProjection(refreshed);

const existingManagedJson =
  JSON.stringify(existingManaged, null, 2);

const refreshedManagedJson =
  JSON.stringify(refreshedManaged, null, 2);

console.log('===== RESULT CARD MANAGED SNAPSHOT =====');
console.log(`Profile: ${profileId}`);
console.log(`Fixture: ${path.relative(rootDir, fixturePath)}`);
console.log(`Example: ${path.relative(rootDir, examplePath)}`);
console.log('Source: production predict()');
console.log();

console.log('Existing:');
console.log({
  result_band: existing.prediction?.result_band,
  guidance_pool_id: existing.prediction?.guidance_pool_id,
  score: existing.prediction?.score,
  recommendation:
    existing.primary_user_facing_recommendation ?? null
});

console.log();

console.log('Production:');
console.log({
  result_band: generated.prediction?.result_band,
  guidance_pool_id: generated.prediction?.guidance_pool_id,
  score: generated.prediction?.score,
  recommendation:
    generated.primary_user_facing_recommendation ?? null
});

console.log();

if (existingManagedJson === refreshedManagedJson) {
  console.log('Managed snapshot status: MATCH');
  process.exit(0);
}

console.log('Managed snapshot status: DRIFT');

if (!write) {
  console.log();
  console.log(
    'No files were modified. Re-run with --write to refresh only production-managed fields.'
  );
  process.exit(0);
}

fs.writeFileSync(
  examplePath,
  JSON.stringify(refreshed, null, 2) + '\n'
);

console.log();
console.log('Updated production-managed fields only.');
console.log('Preserved evidence, provenance and documentation metadata.');
