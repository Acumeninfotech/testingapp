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

const course = readJson('data/universities/leicester-a100.json');
const research = readJson('data/research/leicester-a100-research.json');
const config = readJson('data/interview-band-configs/leicester-a100.json');
const card = readJson('data/examples/leicester-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/leicester-a100.json');
const readinessFixture = readJson('data/fixtures/leicester-a100-readiness.json');
const index = readJson('data/index.json');
const ucatDeciles = loadUcatDecileData(path.join(rootDir, 'data/ucat-deciles.json'));

// --- Identity and cross-file consistency ---
assert.strictEqual(course.profile_id, 'leicester-a100');
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

// --- UCAT bottom-two-decile approximation ---
const thirdDecile = ucatDeciles.official_decile_thresholds['3'];
assert.strictEqual(thirdDecile, 1760);
assert.strictEqual(
  course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score,
  thirdDecile
);
assert.match(
  course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score_basis,
  /review.*annually/i
);
assert.strictEqual(config.eligibility.ucat.minimum_total_score, thirdDecile);

// --- SJT Band 4 hard gate ---
const sjt = course.stage_1_eligibility.admissions_tests.sjt;
assert.strictEqual(sjt.used_as_gate, true);
assert.deepStrictEqual(sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(sjt.excluded_bands, [4]);
assert.strictEqual(sjt.scoring.used_in_score, false);
assert.deepStrictEqual(config.eligibility.sjt.rejected_bands, [4]);

// --- GCSE scoring formula (48-point, official worked example) ---
const gcseScoring = course.stage_1_eligibility.gcse.scoring_model;
assert.strictEqual(gcseScoring.count_exactly, 8);
assert.strictEqual(gcseScoring.maximum_score, 48);
assert.strictEqual(gcseScoring.worked_example.expected_total, 36);
assert.strictEqual(gcseScoring.worked_example.expected_max, 48);
assert.deepStrictEqual(
  gcseScoring.grade_points.map((band) => [band.grade, band.points]),
  [['9', 6], ['8', 5], ['7', 4], ['6', 3], ['below 6', 0]]
);

// --- Graduate scoring formula (48-point, official worked examples) ---
const graduateScoring = course.stage_2_interview_selection.calculation.graduate_total_score;
assert.strictEqual(graduateScoring.scale.maximum, 48);
const finalYearExample = graduateScoring.worked_examples.find(
  (example) => example.label === 'final_year_student_predicted_2_1'
);
assert.strictEqual(finalYearExample.expected_total, 30);
const achievedExample = graduateScoring.worked_examples.find(
  (example) => example.label === 'achieved_graduate_first_class'
);
assert.strictEqual(achievedExample.expected_total, 40);

// Arithmetic check of graduate worked examples against the official points tables
const aLevelPoints = { A_star: 12, A: 10, B: 8, C: 4 };
const degreePoints = {
  first_class_obtained: 12,
  first_class_predicted: 6,
  second_class_upper_obtained: 8,
  second_class_upper_predicted: 4
};
const finalYearCheck = readinessFixture.official_worked_examples_arithmetic_check.graduate_final_year_predicted;
const finalYearTotal =
  aLevelPoints.A + aLevelPoints.B + aLevelPoints.B + degreePoints.second_class_upper_predicted;
assert.strictEqual(finalYearTotal, finalYearCheck.expected_total);
assert.strictEqual(finalYearTotal, 30);

const achievedCheck = readinessFixture.official_worked_examples_arithmetic_check.graduate_achieved;
const achievedTotal =
  aLevelPoints.A_star + aLevelPoints.B + aLevelPoints.B + degreePoints.first_class_obtained;
assert.strictEqual(achievedTotal, achievedCheck.expected_total);
assert.strictEqual(achievedTotal, 40);

// --- Access to Medicine 76-point formula documentation ---
const accessScoring = course.stage_1_eligibility.post_16.access_to_medicine;
assert.match(accessScoring.execution_status_manual_review_note, /manual-review/i);

// --- Contextual/WP routes: shared evaluator + guaranteed-interview overrides ---
assert.strictEqual(course.contextual_admissions.guaranteed_interview_rules.length, 4);
assert.ok(
  course.contextual_admissions.guaranteed_interview_rules.some(
    (rule) => rule.route_id === 'ukwpmed_restricted_guaranteed_interview_2027'
  )
);
assert.strictEqual(course.contextual_admissions.evaluator_id, 'leicester_contextual_medicine_a100');
assert.strictEqual(course.contextual_admissions.qualitative_flag_only, false);
assert.match(course.contextual_admissions.engine_execution_status, /partially_automatic/i);
assert.strictEqual(course.engine_notes.contextual_logic, true);
assert.strictEqual(config.eligibility.map_override.apply_ucat_guidance_band, false);

// --- Achieved-route auto-interview: documented, non-executable in Engine v1 ---
assert.match(
  course.stage_2_interview_selection.achieved_route_auto_interview.engine_execution_status,
  /not_executable/i
);

// --- Score model wiring (component_sum, GCSE + UCAT) ---
assert.strictEqual(config.score_model.type, 'component_sum');
assert.strictEqual(config.score_model.scale.max, 96);
const gcseComponent = config.score_model.components.find((c) => c.component_id === 'gcse_score');
assert.strictEqual(gcseComponent.type, 'gcse_mandatory_then_best');
assert.strictEqual(gcseComponent.max, 48);
const ucatComponent = config.score_model.components.find((c) => c.component_id === 'ucat_score');
assert.strictEqual(ucatComponent.type, 'ucat_range_lookup');
assert.strictEqual(ucatComponent.max, 48);

// --- Guidance pools (Home + Overseas predicted A-level, current-cycle 2026 thresholds) ---
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => pool.pool_id),
  [
    'leicester_home_predicted_a_level_or_equivalent',
    'leicester_overseas_predicted_a_level_or_equivalent'
  ]
);
for (const pool of config.guidance_pools) {
  assert.strictEqual(pool.official_candidate_decile_guidance.executable, false);
  assert.strictEqual(pool.official_candidate_decile_guidance.cycle, '2026_entry');
  assert.match(pool.official_candidate_decile_guidance.reason, /2026/);
}
const homePool = config.guidance_pools.find((p) => p.pool_id === 'leicester_home_predicted_a_level_or_equivalent');
assert.strictEqual(homePool.official_candidate_decile_guidance.min, 79);
const overseasPool = config.guidance_pools.find((p) => p.pool_id === 'leicester_overseas_predicted_a_level_or_equivalent');
assert.strictEqual(overseasPool.official_candidate_decile_guidance.min, 88);

// --- Fixture scenarios exercised through the real classifier ---
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

// --- Official GCSE worked example reproduced exactly via the live classifier ---
const worked = classifyInterviewBand(
  course,
  config,
  merge(fixture.base_applicant, {}),
  { ucatDecileData: ucatDeciles }
);
assert.strictEqual(worked.ranking.components.gcse_score.value, 36);
assert.strictEqual(worked.ranking.components.gcse_score.max, 48);

// --- Research/production consistency ---
assert.strictEqual(
  research.readiness.interview_prediction_ready,
  course.engine_notes.interview_prediction_ready
);
assert.strictEqual(research.readiness.interview_prediction_ready, true);
assert.strictEqual(research.readiness.historical_guidance, true);
assert.strictEqual(research.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(research.metadata.architecture_change_required, false);
assert.deepStrictEqual(
  research.remaining_evidence_gaps
    .filter((gap) => gap.blocking_for_positive_interview_banding)
    .map((gap) => gap.gap_id),
  []
);

// --- Result card ---
assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.score, 80);
assert.strictEqual(card.display.recommendation_display_state, 'standard');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.strictEqual(
  card.decision_transparency.selection_metric.type,
  'selection_score'
);
assert.strictEqual(
  card.decision_transparency.selection_metric.applicant_value,
  80
);
assert.strictEqual(
  card.decision_transparency.score_breakdown.value,
  80
);
assert.strictEqual(
  card.decision_transparency.score_breakdown.max,
  96
);
assert.strictEqual(
  card.decision_transparency.score_breakdown.checks[0].label,
  'GCSE score'
);
assert.strictEqual(
  card.decision_transparency.score_breakdown.checks[1].label,
  'UCAT score'
);
assert.match(
  card.stage_2_selection.summary,
  /Leicester's own published formula, not an ApplySmart estimate/i
);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

// --- Index activation ---
const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/leicester-a100.json');
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
  contextual_logic: true,
  international_prediction: true,
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

console.log('Leicester A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Official GCSE worked example (36/48) reproduced via live classifier: PASS');
console.log('Official graduate worked examples (30/48, 40/48) arithmetically verified: PASS');
console.log('Graduate and Access scoring boundaries remain manual-review; Leicester contextual guaranteed-interview routes are executable: PASS');
