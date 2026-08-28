#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { predict } = require('../server/src/predict');
const {
  buildDecisionTransparency
} = require('../assets/js/engine/result-card-presenter');

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

function merge(base, overrides) {
  if (
    overrides === null ||
    typeof overrides !== 'object' ||
    Array.isArray(overrides)
  ) {
    return overrides === undefined ? clone(base) : clone(overrides);
  }

  const result =
    base && typeof base === 'object' && !Array.isArray(base)
      ? clone(base)
      : {};

  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }

  return result;
}

function normalizeFeeCohort(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'home' || normalized === 'uk') {
    return 'home';
  }

  if (normalized === 'international' || normalized === 'overseas') {
    return 'international';
  }

  return null;
}

function exampleFeeCohort(card) {
  const directCohort = normalizeFeeCohort(card.applicant_context?.fee_cohort);

  if (directCohort) {
    return directCohort;
  }

  const groupIds = card.applicant_context?.applies_to_group_ids;

  if (!Array.isArray(groupIds)) {
    return null;
  }

  if (groupIds.includes('international_fee')) {
    return 'international';
  }

  if (groupIds.includes('home_fee')) {
    return 'home';
  }

  return null;
}

function assertApplicantContextMatchesExample(profileId, fixture, example) {
  const fixtureCohort = normalizeFeeCohort(
    fixture.base_applicant?.applicant_identity?.fee_status
  );
  const exampleCohort = exampleFeeCohort(example);

  if (fixtureCohort && exampleCohort && fixtureCohort !== exampleCohort) {
    fail(
      `${profileId} base_applicant fee cohort (${fixtureCohort}) does not ` +
      `match the result-card example fee cohort (${exampleCohort}); ` +
      'automatic snapshot generation is not supported for this profile yet.'
    );
  }
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object, field);
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

let snapshotApplicant = fixture.base_applicant;

if (fixture.result_card_example_overrides) {
  snapshotApplicant = merge(
    fixture.base_applicant,
    fixture.result_card_example_overrides
  );
} else if (fixture.result_card_example_scenario_id) {
  const matchingScenarios = (fixture.scenarios || []).filter(
    (scenario) =>
      scenario.scenario_id === fixture.result_card_example_scenario_id
  );

  if (matchingScenarios.length !== 1) {
    fail(
      `${profileId} result_card_example_scenario_id ` +
      `(${fixture.result_card_example_scenario_id}) must match exactly one scenario.`
    );
  }

  snapshotApplicant = merge(
    fixture.base_applicant,
    matchingScenarios[0].overrides || {}
  );
}

assertApplicantContextMatchesExample(
  profileId,
  { base_applicant: snapshotApplicant },
  existing
);

let results;

try {
  results = predict({
    studentProfile: snapshotApplicant,
    universityIds: [profileId]
  });
} catch (error) {
  fail(`Production predict() failed for ${profileId}: ${error.message}`);
}

if (!Array.isArray(results) || results.length !== 1) {
  fail(`Expected exactly one prediction result for ${profileId}.`);
}

const generated = results[0].result_card;

if (!generated || typeof generated !== 'object') {
  fail(`Production predict() did not return a Result Card for ${profileId}.`);
}

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
  const decisionTransparency = card.decision_transparency &&
    typeof card.decision_transparency === 'object'
      ? clone(card.decision_transparency)
      : null;

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

    decision_transparency: decisionTransparency
  };
}

function refreshManagedFields(existingCard, generatedCard) {
  const refreshed = clone(existingCard);
  const existingPrediction = refreshed.prediction || {};
  const generatedPrediction = generatedCard.prediction || {};

  refreshed.prediction = {
    ...existingPrediction
  };

  for (const field of [
    'result_band',
    'ranking_metric',
    'guidance_pool_id',
    'score'
  ]) {
    const generatedValue = generatedPrediction[field];

    if (generatedValue !== undefined && generatedValue !== null) {
      refreshed.prediction[field] = clone(generatedValue);
    } else if (hasOwn(existingPrediction, field)) {
      refreshed.prediction[field] = null;
    }
  }

  if (existingPrediction.score_scale !== undefined &&
      existingPrediction.score_scale !== null) {
    refreshed.prediction.score_scale = clone(existingPrediction.score_scale);
  } else if (generatedPrediction.score_scale !== undefined &&
      generatedPrediction.score_scale !== null) {
    refreshed.prediction.score_scale = clone(generatedPrediction.score_scale);
  } else if (hasOwn(existingPrediction, 'score_scale')) {
    refreshed.prediction.score_scale = null;
  }

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
    if (hasOwn(generatedCard, field)) {
      refreshed[field] = clone(
        field === 'decision_transparency'
          ? buildDecisionTransparency(generatedCard)
          : generatedCard[field]
      );
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

function managedValuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffManagedFields(existingValue, refreshedValue, prefix = '') {
  if (managedValuesMatch(existingValue, refreshedValue)) {
    return [];
  }

  if (
    existingValue &&
    refreshedValue &&
    typeof existingValue === 'object' &&
    typeof refreshedValue === 'object' &&
    !Array.isArray(existingValue) &&
    !Array.isArray(refreshedValue)
  ) {
    const fields = new Set([
      ...Object.keys(existingValue),
      ...Object.keys(refreshedValue)
    ]);

    return [...fields].sort().flatMap((field) => (
      diffManagedFields(
        existingValue[field],
        refreshedValue[field],
        prefix ? `${prefix}.${field}` : field
      )
    ));
  }

  return [prefix];
}

const refreshed = refreshManagedFields(existing, generated);

const existingManaged = managedProjection(existing);
const refreshedManaged = managedProjection(refreshed);
const managedDiffs = diffManagedFields(existingManaged, refreshedManaged);

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

if (managedDiffs.length === 0) {
  console.log('Managed snapshot status: MATCH');
  process.exit(0);
}

console.log('Managed snapshot status: DRIFT');
console.log('Managed field drift:');

for (const field of managedDiffs) {
  console.log(`- ${field}`);
}

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
