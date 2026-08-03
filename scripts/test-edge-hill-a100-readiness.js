#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence
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

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

const course = readJson('data/universities/edge-hill-a100.json');
const research = readJson('data/research/edge-hill-a100-research.json');
const config = readJson('data/interview-band-configs/edge-hill-a100.json');
const card = readJson('data/examples/edge-hill-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/edge-hill-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'edge-hill-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.deepStrictEqual(course.course.fee_statuses, ['home']);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_2_interview_selection.academic_scoring.applies, false);
assert.strictEqual(course.contextual_admissions.available, false);
assert.strictEqual(course.engine_notes.international_prediction, false);
assert.strictEqual(course.engine_notes.contextual_logic, false);
assert.strictEqual(course.engine_notes.prediction_confidence, 'low');
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, [4]);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.strictEqual(aLevel.science_practical_endorsement_required, null);
assert.strictEqual(
  config.eligibility.a_level.science_practical_endorsement,
  undefined,
  'Edge Hill must not enforce an unstated practical endorsement requirement.'
);
assert.deepStrictEqual(
  config.eligibility.explicitly_blocked_applicant_groups,
  ['international_fee']
);
assert.deepStrictEqual(
  config.eligibility.qualification_routes.manual_review,
  ['graduate']
);

assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.strictEqual(config.score_model.prediction_confidence, 'low');
assert.strictEqual(config.score_model.conversion_policy.formula, 'official_score_3600 * 3 / 4');
assert.deepStrictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.sorted_converted_scores_2700,
  [1830, 1920, 1950, 1950, 1957.5]
);
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.median_reference_2700,
  1950
);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => pool.pool_id),
  ['home_a100']
);
assert.deepStrictEqual(
  config.guidance_pools[0].band_rules.map((rule) =>
    rule.operator === 'between_inclusive'
      ? [rule.band, rule.operator, rule.min, rule.max]
      : [rule.band, rule.operator, rule.value]
  ),
  [
    ['interview_likely', 'greater_than_or_equal', 2100],
    ['realistic', 'between_inclusive', 1950, 2099],
    ['ambitious', 'between_inclusive', 1800, 1949],
    ['high_risk', 'less_than', 1800]
  ]
);

const historicalRows = course.historical_admissions.cycles;
assert.strictEqual(historicalRows.length, 5);
const row2023 = historicalRows.find((row) => row.entry_year === 2023);
assert.ok(row2023, '2023 historical row must exist.');
assert.strictEqual(row2023.original_score, 2610);
assert.strictEqual(row2023.original_scale, 3600);
assert.strictEqual(row2023.converted_score_2700, 1957.5);
assert.strictEqual(row2023.display_original_scale, true);
assert.strictEqual(row2023.display_converted_scale, true);

const row2025 = historicalRows.find((row) => row.entry_year === 2025);
assert.ok(row2025, '2025 historical row must exist.');
assert.strictEqual(row2025.original_scale, 2700);
assert.strictEqual(row2025.original_score, null);
assert.strictEqual(row2025.converted_score_2700, 1920);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  if (Number.isFinite(expected.ranking_value)) {
    assert.strictEqual(
      result.band_metric.value,
      expected.ranking_value,
      `${scenario.scenario_id}: UCAT ranking value`
    );
  }
  if (expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
  assert.strictEqual(result.offer_prediction_status, undefined);
}

for (const boundary of fixture.historical_guidance_boundaries) {
  const applicant = merge(fixture.base_applicant, {
    admissions_tests: {
      ucat: {
        total_score: boundary.ucat_total
      }
    }
  });
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `Home UCAT ${boundary.ucat_total}`
  );
}

assert.strictEqual(research.implementation_mapping.architecture_change_required, false);
assert.strictEqual(research.metadata.academic_model, 'eligibility_gate');
assert.strictEqual(research.metadata.academic_ranking, false);
assert.strictEqual(research.metadata.science_practical_endorsement.enforced, false);
assert.strictEqual(research.applicant_groups.international.accepted, false);
assert.strictEqual(research.readiness.international_prediction, false);
assert.strictEqual(research.readiness.contextual_logic, false);
assert.deepStrictEqual(
  research.historical_ucat_thresholds.map((row) => row.converted_current_2700_score),
  [1920, 1950, 1957.5, 1950, 1830]
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.guidance_pool_id, 'home_a100');
assert.strictEqual(card.confidence.level, 'low');
assert.strictEqual(card.readiness.international_prediction, false);
assert.strictEqual(card.readiness.contextual_logic, false);
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(card.decision_transparency, buildDecisionTransparency(card));
assert.match(
  JSON.stringify(card.decision_transparency),
  /Eligible applicants are ranked by UCAT.*No reliable numerical historical comparison is available/s
);
assert.strictEqual(card.decision_transparency.selection_metric.type, 'ucat');
assert.strictEqual(card.decision_transparency.ucat_comparison.comparison_type, 'ranking_only');
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Edge Hill A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/edge-hill-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.international_prediction, false);
assert.strictEqual(indexEntry.contextual_logic, false);

for (const field of [
  'eligibility',
  'interview_prediction',
  'historical_guidance',
  'international_prediction',
  'contextual_logic',
  'result_card',
  'regression',
  'research_completeness',
  'manual_review_required',
  'eligibility_ready',
  'interview_prediction_ready',
  'prediction_confidence',
  'result_card_ready',
  'offer_prediction_scope'
]) {
  assert.deepStrictEqual(research.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(card.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(indexEntry[field], course.engine_notes[field]);
}

console.log('Edge Hill A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log(`Historical guidance boundaries checked: ${fixture.historical_guidance_boundaries.length}`);
console.log('Home-only pool, SJT Band 4, historical UCAT precision and no-offer scope: PASS');
