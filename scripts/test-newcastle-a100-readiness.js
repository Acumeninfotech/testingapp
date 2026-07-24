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

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => failure === expected);
}

function includesFailurePrefix(result, expectedPrefix) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => String(failure).startsWith(expectedPrefix));
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

const course = readJson('data/universities/newcastle-a100.json');
const research = readJson('data/research/newcastle-a100-research.json');
const config = readJson('data/interview-band-configs/newcastle-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/newcastle-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'newcastle-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_year, 2026);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'academic_plus_ucat_weighting');
assert.strictEqual(config.score_model.pool_specific_output, true);
assert.strictEqual(config.score_model.scale.max, 100);
assert.ok(course.engine_notes.interview_prediction_ready);
assert.ok(course.engine_notes.result_card_ready);
assert.strictEqual(hasNestedKey(course, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'offer_prediction'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Newcastle A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/newcastle-a100.json');

const ucatComponent = config.score_model.components.find((component) => {
  return component.component_id === 'ucat_score';
});
assert.strictEqual(ucatComponent.type, 'ucat_exact_score_table_lookup');
assert.strictEqual(ucatComponent.points_by_score['2240'], 44);
assert.strictEqual(ucatComponent.points_by_score['1900'], 10);
assert.strictEqual(ucatComponent.upper_or_equal.points, 60);
assert.strictEqual(ucatComponent.lower_or_equal.points, 1);
assert.strictEqual(ucatComponent.exact_step_size, 10);

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
  if (expected.interview_band) {
    assert.strictEqual(
      result.canonical_interview_band,
      expected.interview_band,
      `${scenario.scenario_id}: interview band`
    );
  }
  if (Number.isFinite(expected.score)) {
    assert.strictEqual(result.ranking?.value, expected.score, `${scenario.scenario_id}: score`);
  }
  if (Number.isFinite(expected.gcse_score)) {
    assert.strictEqual(
      result.ranking?.components?.gcse_score?.value,
      expected.gcse_score,
      `${scenario.scenario_id}: GCSE score`
    );
  }
  if (Number.isFinite(expected.normalised_gcse_subjects)) {
    assert.strictEqual(
      result.ranking?.components?.gcse_score?.normalised_from_subject_count,
      expected.normalised_gcse_subjects,
      `${scenario.scenario_id}: GCSE normalisation`
    );
  }
  if (Number.isFinite(expected.ucat_points)) {
    assert.strictEqual(
      result.ranking?.components?.ucat_score?.value,
      expected.ucat_points,
      `${scenario.scenario_id}: UCAT points`
    );
  }
  if (Number.isFinite(expected.degree_score)) {
    assert.strictEqual(
      result.ranking?.components?.degree_score?.value,
      expected.degree_score,
      `${scenario.scenario_id}: degree score`
    );
  }
  if (Number.isFinite(expected.ranking_value)) {
    assert.strictEqual(result.ranking?.value, expected.ranking_value, `${scenario.scenario_id}: ranking value`);
  }
  if (Number.isFinite(expected.ranking_max)) {
    assert.strictEqual(result.ranking?.max, expected.ranking_max, `${scenario.scenario_id}: ranking max`);
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
  if (expected.component_reason_prefix) {
    assert.ok(
      String(result.ranking?.components?.ucat_score?.reason || '').startsWith(expected.component_reason_prefix),
      `${scenario.scenario_id}: component reason ${expected.component_reason_prefix}`
    );
  }
  if (expected.home_score_suppressed) {
    assert.deepStrictEqual(result.ranking?.components || {}, {});
    assert.strictEqual(result.band_metric.metric, 'ucat_total');
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

const internationalApplicant = merge(fixture.base_applicant, {
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  admissions_tests: {
    ucat: { total_score: 2390 }
  }
});
const internationalResult = classifyInterviewBand(course, config, internationalApplicant);
const internationalCard = makeResultCard(course, config, internationalApplicant, internationalResult);
assert.strictEqual(internationalResult.guidance_pool_id, 'newcastle_international_ucat_only');
assert.strictEqual(internationalResult.ranking.max, 2700);
assert.deepStrictEqual(internationalResult.ranking.components, {});
assert.strictEqual(internationalCard.prediction.ranking_metric, 'ucat_total');
assert.strictEqual(internationalCard.decision_transparency.score_breakdown, null);
assert.ok(
  !JSON.stringify(internationalCard.decision_transparency).includes('/100'),
  'International result card must not display a Home /100 selection score.'
);
assert.ok(
  internationalCard.decision_transparency.decision_path.some((stage) => {
    return JSON.stringify(stage).includes('2980') && JSON.stringify(stage).includes('3600 scale');
  }),
  'International result card must display legacy International threshold with original scale.'
);

const homeApplicant = merge(fixture.base_applicant, {});
const homeResult = classifyInterviewBand(course, config, homeApplicant);
const homeCard = makeResultCard(course, config, homeApplicant, homeResult);
assert.strictEqual(homeCard.prediction.result_band, homeResult.canonical_interview_band);
assert.ok(
  homeCard.decision_transparency.decision_path.some((stage) => {
    return JSON.stringify(stage).includes('70/100') ||
      JSON.stringify(stage).includes('Selection score threshold');
  }),
  'Home result card must include scored /100 selection evidence.'
);
assert.ok(
  !JSON.stringify(homeCard.decision_transparency.score_breakdown).includes('0 out of 0'),
  'Home result card must not display non-applicable zero-max score components.'
);
assert.ok(
  !JSON.stringify(homeCard.decision_transparency.decision_path).includes('International – International'),
  'Home result card historical guidance must not display International-pool rows.'
);
assert.strictEqual(hasNestedKey(homeCard, 'offer_probability'), false);

console.log('Newcastle A100 readiness regression passed.');
