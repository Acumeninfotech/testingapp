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
const {
  loadUcatDecileData
} = require('../assets/js/engine/ucat-decile-service');

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

const course = readJson('data/universities/queen-mary-a100.json');
const research = readJson('data/research/queen-mary-a100-research.json');
const config = readJson('data/interview-band-configs/queen-mary-a100.json');
const card = readJson('data/examples/queen-mary-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/queen-mary-a100.json');
const readinessFixture = readJson('data/fixtures/queen-mary-a100-readiness.json');
const index = readJson('data/index.json');
const ucatDeciles = loadUcatDecileData(path.join(rootDir, 'data/ucat-deciles.json'));

assert.strictEqual(course.profile_id, 'queen-mary-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(readinessFixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.profile_status, 'production_ready_eligibility_and_interview_guidance');
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');

const currentFourthDecile = ucatDeciles.official_decile_thresholds['4'];
assert.strictEqual(currentFourthDecile, 1820);
assert.strictEqual(
  course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score,
  currentFourthDecile
);
assert.match(
  course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score_basis,
  /review annually/i
);

const gcse = course.stage_1_eligibility.gcse;
assert.strictEqual(gcse.minimum_count, 6);
assert.deepStrictEqual(
  gcse.minimum_count_at_or_above_grade.map((rule) => [
    rule.requirement_id,
    rule.count,
    rule.minimum_grade
  ]),
  [
    ['three_gcse_grade_7_minimum', 3, '7/A'],
    ['six_gcse_grade_6_minimum', 6, '6/B']
  ]
);
assert.strictEqual(gcse.selection_role, 'eligibility_only');
assert.strictEqual(gcse.scored_after_eligibility, false);

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.deepStrictEqual(aLevel.standard_offer.grade_profile, ['A*', 'A', 'A']);
assert.strictEqual(aLevel.standard_offer.ucas_tariff, 152);
assert.strictEqual(aLevel.practical_endorsement_required, false);
assert.match(aLevel.notes, /one sitting/i);
assert.match(
  JSON.stringify(aLevel.subject_combination_rule),
  /further_mathematics/
);

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.score_used_for_ranking, true);
assert.deepStrictEqual(admissionsTests.ucat.exemptions, []);
assert.strictEqual(admissionsTests.sjt.used_as_gate, true);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, [4]);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);
assert.strictEqual(
  admissionsTests.sjt.scoring.foi_context_only.use_for_current_scoring,
  false
);

assert.strictEqual(config.score_model.executable, true);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, true);
assert.strictEqual(config.score_model.applysmart_predictive_estimate, true);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => [pool.pool_id, pool.band_rules.length]),
  [
    ['qmul_home_standard_school_leaver_guidance', 4],
    ['qmul_overseas_school_leaver_guidance', 4]
  ]
);
for (const pool of config.guidance_pools) {
  assert.strictEqual(pool.official_candidate_decile_guidance.executable, false);
  assert.match(pool.official_candidate_decile_guidance.reason, /ApplySmart/i);
  assert.match(pool.official_candidate_decile_guidance.reason, /not official QMUL thresholds/i);
}

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant, {
    ucatDecileData: ucatDeciles
  });

  assert.strictEqual(
    result.eligibility.status,
    scenario.expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    scenario.expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    scenario.expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  if (scenario.expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(scenario.expected.failure),
      `${scenario.scenario_id}: expected failure ${scenario.expected.failure}`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

assert.ok(
  fixture.applysmart_modelled_historical_cutoffs.every((entry) => {
    return entry.scale === 3600 && entry.must_not_present_as_official_threshold === true;
  })
);
assert.strictEqual(
  research.readiness.interview_prediction_ready,
  course.engine_notes.interview_prediction_ready
);
assert.strictEqual(research.readiness.interview_prediction_ready, true);
assert.strictEqual(research.readiness.historical_guidance, true);
assert.strictEqual(research.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(
  research.metadata.architecture_change_required,
  false
);
assert.deepStrictEqual(
  research.remaining_evidence_gaps
    .filter((gap) => gap.blocking_for_positive_interview_banding)
    .map((gap) => gap.gap_id),
  []
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.display.recommendation_display_state, 'standard');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(card.decision_transparency, buildDecisionTransparency(card));
assert.match(
  card.display.primary_explanation,
  /ApplySmart predictive estimate, not an official university threshold or guarantee of interview/i
);
assert.match(
  JSON.stringify(card),
  /official_vs_applysmart_modelling/
);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.selection_model, 'academic_plus_ucat_weighting');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/queen-mary-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  result_card_ready: true,
  contextual_logic: false,
  international_prediction: false,
  regression: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `production ${field}`);
  if (field !== 'result_card_ready') {
    assert.strictEqual(indexEntry[field], expected, `index ${field}`);
  }
}

assert.deepStrictEqual(
  readinessFixture.expected_timeline_step_statuses.standard_eligible,
  card.decision_timeline.map((step) => step.status)
);

console.log('Queen Mary A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Standard 11 ApplySmart predictive estimates are labelled and non-official: PASS');
