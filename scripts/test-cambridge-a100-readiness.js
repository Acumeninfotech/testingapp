#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (Array.isArray(overrides) || overrides === null || typeof overrides !== 'object') {
    return clone(overrides);
  }

  const result = clone(base);
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

function failures(result) {
  return [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
}

function includesFailure(result, expected) {
  return failures(result).includes(expected);
}

function includesFailurePrefix(result, expectedPrefix) {
  return failures(result).some((failure) => String(failure).startsWith(expectedPrefix));
}

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function makeResultCard(course, config, applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
      eligibilityStatus: classification.eligibility.status,
      guidancePoolId: classification.guidance_pool_id ?? null
    }),
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility || null,
      historical_admissions: course.historical_admissions || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      warnings: classification.warnings || []
    }
  });
}

const course = readJson('data/universities/cambridge-a100.json');
const research = readJson('data/research/cambridge-a100-research.json');
const config = readJson('data/interview-band-configs/cambridge-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/cambridge-a100.json');
const card = readJson('data/examples/cambridge-a100-result-card.example.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'cambridge-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_year, 2027);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'holistic_review');
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, false);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, []);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(hasNestedKey(course, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'approx_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Cambridge A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.interview_band_config_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.prediction_confidence, 'medium');
assert.strictEqual(indexEntry.manual_review_policy, 'conditional');
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

const gcseModifier = config.score_model.components.find((component) =>
  component.component_id === 'gcse_profile_modifier'
);
assert.ok(gcseModifier, 'Cambridge must configure a GCSE profile modifier.');
assert.strictEqual(gcseModifier.type, 'gcse_profile_modifier');
assert.strictEqual(config.score_model.presentation.hide_score_breakdown, true);
assert.strictEqual(config.score_model.presentation.hide_selection_score_details, true);
assert.ok(
  research.metadata.research_engine_json_discrepancies.some((entry) =>
    entry.field.includes('manual_review_required')
  ),
  'The pre-implementation manual-review discrepancy must be recorded.'
);
assert.ok(
  research.metadata.research_engine_json_discrepancies.some((entry) =>
    entry.field.includes('approx_probability')
  ),
  'The probability-display discrepancy must be recorded.'
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  if (Object.hasOwn(expected, 'guidance_pool_id')) {
    assert.strictEqual(
      result.guidance_pool_id ?? null,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: guidance pool`
    );
  }
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  if (Number.isFinite(expected.score)) {
    assert.strictEqual(result.ranking?.value, expected.score, `${scenario.scenario_id}: hidden score`);
  }
  if (expected.gcse_profile_class) {
    assert.strictEqual(
      result.ranking?.components?.gcse_profile_modifier?.profile_class,
      expected.gcse_profile_class,
      `${scenario.scenario_id}: GCSE profile class`
    );
  }
  if (Object.hasOwn(expected, 'manual_review_required')) {
    assert.strictEqual(
      result.manual_review_required === true,
      expected.manual_review_required,
      `${scenario.scenario_id}: manual review`
    );
  }
  if (expected.manual_review_reason) {
    assert.ok(
      includesFailure(result, expected.manual_review_reason),
      `${scenario.scenario_id}: manual review reason`
    );
  }
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  if (expected.failure_prefix) {
    assert.ok(
      includesFailurePrefix(result, expected.failure_prefix),
      `${scenario.scenario_id}: failure prefix ${expected.failure_prefix}`
    );
  }
}

const baseClassification = classifyInterviewBand(course, config, fixture.base_applicant);
const baseCard = makeResultCard(course, config, fixture.base_applicant, baseClassification);
const studentFacingText = JSON.stringify(baseCard);
assert.doesNotMatch(studentFacingText, /\b(2350|2250|2150|2050|2400|2300|2200)\b/);
assert.doesNotMatch(studentFacingText, /\d+(?:\.\d+)?\s*%/);
assert.doesNotMatch(studentFacingText, /\boffer[- ]?(prediction|probability|likelihood|chance)\b/i);
assert.doesNotMatch(studentFacingText, /\bapprox_probability\b/i);
assert.match(
  JSON.stringify(baseCard.decision_transparency),
  /holistically by college|holistic interview guidance/i
);

console.log('Cambridge A100 readiness regression passed.');
