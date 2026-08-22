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

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function hasPublicInternalLeak(value) {
  return /manual_review_required|prediction_confidence|compensatory_admissions_test_policy|compensable_deficiencies|maximum_compensable_deficiencies|ucat_remains_required|sjt_remains_required/.test(JSON.stringify(value));
}

const course = readJson('data/universities/sunderland-a100.json');
const research = readJson('data/research/sunderland-a100-research.json');
const config = readJson('data/interview-band-configs/sunderland-a100.json');
const card = readJson('data/examples/sunderland-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/sunderland-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'sunderland-a100');
assert.strictEqual(course.profile_status, 'production_ready_eligibility_and_interview_guidance');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);

assert.strictEqual(course.course.ucas_code, 'A100');
assert.deepStrictEqual(course.course.fee_statuses, ['home']);
assert.strictEqual(course.course.is_graduate_entry, false);
assert.match(course.course.notes, /Graduates apply through the same A100 code/);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'holistic_review');
assert.strictEqual(course.stage_2_interview_selection.academic_scoring.applies, false);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score, 1680);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.score_used_for_ranking, false);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, [4]);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => [pool.pool_id, pool.metric]),
  [['home_a100_eligibility_gate', 'eligibility_gate']]
);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.deepStrictEqual(
  config.score_model.historical_ucat_guidance.map((row) => row.adjusted_minimum_ucat_2700),
  [1690, 1670, 1650, 1680, 1670]
);
assert.ok(
  config.score_model.historical_ucat_guidance.every((row) => row.display_only === true),
  'Sunderland historical UCAT rows must be display-only.'
);

const graduatePolicy =
  course.stage_1_eligibility.post_16.graduate.compensatory_admissions_test_policy;
assert.strictEqual(graduatePolicy.enabled, true);
assert.strictEqual(graduatePolicy.standard_route_evaluated_first, true);
assert.strictEqual(graduatePolicy.ugat_remains_required, undefined);
assert.strictEqual(graduatePolicy.ucat_remains_required, true);
assert.strictEqual(graduatePolicy.sjt_remains_required, true);
assert.deepStrictEqual(
  graduatePolicy.compensable_deficiencies,
  ['a_level_requirements_not_met', 'gcse_science_alternative_not_met']
);
assert.strictEqual(graduatePolicy.maximum_compensable_deficiencies, 1);

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
    result.guidance_pool_id ?? null,
    expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.manual_review_required === true,
    expected.manual_review_required,
    `${scenario.scenario_id}: manual review`
  );
  if (expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}; got ${result.eligibility.failures.join(',')}`
    );
  }
  if (expected.absent_failure) {
    assert.ok(
      !result.eligibility.failures.includes(expected.absent_failure),
      `${scenario.scenario_id}: unexpected failure ${expected.absent_failure}`
    );
  }
  assert.strictEqual(hasNestedKey(result, 'offer_prediction'), false);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

const standardResult = classifyInterviewBand(course, config, fixture.base_applicant);
assert.strictEqual(standardResult.eligibility.status, 'eligible');
assert.strictEqual(standardResult.canonical_interview_band, 'realistic');
assert.strictEqual(standardResult.manual_review_required, undefined);
assert.strictEqual(standardResult.guidance_pool_id, 'home_a100_eligibility_gate');

const publicCard = presentResultCard({
  eligibilityStatus: standardResult.eligibility.status,
  interviewBand: standardResult.canonical_interview_band,
  manualReviewRequired: standardResult.manual_review_required === true,
  manualReviewReason: humanManualReviewReason(standardResult.eligibility.manual_review_reasons),
  insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(standardResult.warnings, {
    eligibilityStatus: standardResult.eligibility.status,
    guidancePoolId: standardResult.guidance_pool_id ?? null
  }),
  transparencyContext: {
    course_identity: {
      profile_id: course.profile_id
    },
    applicant_context: fixture.base_applicant,
    applicant_group_ids: standardResult.applicant_group_ids,
    readiness: course.engine_notes,
    eligibility_checks: standardResult.eligibility.checks,
    eligibility_failures: standardResult.eligibility.failures,
    stage_1_eligibility: course.stage_1_eligibility,
    historical_admissions: course.historical_admissions,
    ranking: standardResult.ranking,
    band_metric: standardResult.band_metric,
    guidance_pool: standardResult.guidance_pool,
    guidance_pool_id: standardResult.guidance_pool_id ?? null,
    score_model: config.score_model,
    warnings: standardResult.warnings || []
  }
});

const publicText = JSON.stringify(publicCard);
assert.strictEqual(publicCard.primary_user_facing_recommendation, 'Possible choice for your application');
assert.strictEqual(publicCard.prediction.result_band, 'realistic');
assert.strictEqual(publicCard.prediction.available, true);
assert.match(publicCard.primary_explanation, /selection score may be competitive for this applicant group/i);
assert.match(publicText, /Interview Selection Tool/);
assert.match(publicText, /Interview Selection Tool shortlisting/i);
assert.doesNotMatch(publicText, /Interview Likely|Strong Choice|guaranteed interview|will receive an interview|offer chance|offer probability|IST score is/i);
assert.strictEqual(hasNestedKey(publicCard, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(publicCard, 'offer_probability'), false);
assert.strictEqual(hasPublicInternalLeak(publicCard), false);

assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.display.primary_user_facing_recommendation, 'Possible choice for your application');
assert.match(JSON.stringify(card), /Interview Selection Tool/);
assert.match(
  JSON.stringify(card),
  /Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview/i
);
assert.doesNotMatch(JSON.stringify(card), /Interview Likely|Strong Choice|Guaranteed interview|You will receive an interview|Your IST score is|offer chance|offer probability/i);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);
assert.strictEqual(card.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(card.engine_notes.offer_prediction_scope, 'out_of_scope');

assert.strictEqual(research.implementation_mapping.sunderland_specific_engine_branch, false);
assert.strictEqual(research.implementation_mapping.offer_prediction_implemented, false);
assert.strictEqual(research.implementation_mapping.ist_score_implemented, false);
assert.strictEqual(research.implementation_mapping.historical_ucat_used_as_current_cutoff, false);
assert.strictEqual(research.readiness.activation_ready, true);
assert.strictEqual(research.readiness.production_ready, true);
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.production_ready, true);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Sunderland A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.selection_model, 'hybrid_eligibility_ucat_sjt_ist_shortlisting');
assert.strictEqual(indexEntry.has_graduate_entry, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/sunderland-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.international_prediction, false);
assert.strictEqual(indexEntry.contextual_logic, true);

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

console.log('Sunderland A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Home-only gate, contextual AAB, UCAT/SJT gates, IST limitation, graduate GAMSAT policy and no-offer safeguards: PASS');
