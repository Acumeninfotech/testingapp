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
const {
  isProductionReady
} = require('../server/src/universities');

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

function makePublicCard(applicant, classification) {
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
      stage_1_eligibility: course.stage_1_eligibility,
      historical_admissions: course.historical_admissions,
      fee_information: course.fee_information,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      warnings: classification.warnings || []
    }
  });
}

function assertNoInternalLeak(card) {
  const serialised = JSON.stringify(card);
  assert.ok(!serialised.includes('prediction_confidence'), 'public card must not leak prediction_confidence');
  assert.ok(!serialised.includes('manual_review_required'), 'public card must not leak manual_review_required');
  assert.ok(!serialised.includes('buckingham_course_page_2027'), 'public card must not expose raw source ids');
}

const course = readJson('data/universities/buckingham-71a8.json');
const research = readJson('data/research/buckingham-71a8-research.json');
const config = readJson('data/interview-band-configs/buckingham-71a8.json');
const example = readJson('data/examples/buckingham-71a8-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/buckingham-71a8.json');
const index = readJson('data/index.json');
const indexEntry = index.universities.find((entry) => entry.id === 'buckingham-71a8');

assert.ok(indexEntry, 'Buckingham index entry must exist.');
assert.strictEqual(course.profile_id, 'buckingham-71a8');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(example.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);

assert.strictEqual(course.course.ucas_code, '71A8');
assert.strictEqual(indexEntry.course_code, '71A8');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.intake_month, 'January');
assert.deepStrictEqual(course.course.application_channels, ['ucas', 'direct']);
assert.deepStrictEqual(course.course.fee_statuses, ['home', 'international']);
assert.strictEqual(course.engine_notes.eligibility_ready, true);
assert.strictEqual(course.engine_notes.interview_prediction_ready, false);
assert.strictEqual(course.engine_notes.assessment_mode, 'eligibility_only');
assert.strictEqual(course.engine_notes.eligibility_only_ready, true);
assert.strictEqual(course.engine_notes.assessment_available, true);
assert.strictEqual(course.engine_notes.interview_prediction_available, false);
assert.strictEqual(indexEntry.interview_prediction_ready, false);
assert.strictEqual(indexEntry.assessment_mode, 'eligibility_only');
assert.strictEqual(indexEntry.eligibility_only_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(isProductionReady(indexEntry), true);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.required, false);

assert.strictEqual(course.fee_information.home.first_year, 41500);
assert.strictEqual(course.fee_information.home.course_total, 186750);
assert.strictEqual(course.fee_information.international.first_year, 47000);
assert.strictEqual(course.fee_information.international.course_total, 211500);
assert.strictEqual(course.fee_information.eligibility_effect, 'informational_only');

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

  if (expected.guidance_pool_id) {
    assert.strictEqual(
      result.guidance_pool_id,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: guidance pool`
    );
  }
  if (expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }
  if (expected.manual_review) {
    assert.ok(
      result.eligibility.manual_review_reasons.includes(expected.manual_review),
      `${scenario.scenario_id}: expected manual review ${expected.manual_review}`
    );
  }

  const card = makePublicCard(applicant, result);
  assert.strictEqual(card.prediction.available, true);
  assert.strictEqual(card.prediction.result_band, expected.interview_band);
  assert.strictEqual(card.prediction.prediction_type, 'eligibility_only');
  assert.strictEqual(card.prediction.assessment.available, true);
  assert.strictEqual(card.prediction.interview_prediction.available, false);
  assert.strictEqual(card.fee_information?.eligibility_effect, 'informational_only');
  assert.strictEqual(card.fee_information?.published_rates?.home?.first_year, 41500);
  assert.strictEqual(card.fee_information?.published_rates?.international?.first_year, 47000);
  if (expected.fee_status) {
    assert.strictEqual(card.fee_information.fee_status, expected.fee_status);
  }
  assertNoInternalLeak(card);
}

for (const check of fixture.ucat_non_usage_checks) {
  const applicant = merge(fixture.base_applicant, {
    admissions_tests: {
      ucat: {
        taken: check.taken,
        total_score: check.ucat_total,
        sjt_band: check.sjt_band
      }
    }
  });
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(result.eligibility.status, 'eligible', `UCAT ${check.ucat_total}: eligibility`);
  assert.strictEqual(result.canonical_interview_band, check.expected_band, `UCAT ${check.ucat_total}: band`);
  assert.ok(!result.eligibility.failures.some((failure) => String(failure).includes('ucat')));
  assert.ok(!result.eligibility.failures.some((failure) => String(failure).includes('sjt')));
}

assert.strictEqual(research.metadata.ucas_code, '71A8');
assert.strictEqual(research.metadata.course_type, 'standard_undergraduate_medicine');
assert.strictEqual(research.metadata.uses_ucat, false);
assert.strictEqual(research.metadata.assessment_mode, 'eligibility_only');
assert.strictEqual(research.fees.eligibility_effect, 'informational_only');
assert.strictEqual(example.course_identity.ucas_code, '71A8');
assert.strictEqual(example.course_identity.intake_month, 'January');
assert.strictEqual(example.prediction.result_band, 'eligible_to_apply');
assert.strictEqual(example.prediction.prediction_type, 'eligibility_only');
assert.strictEqual(example.prediction.interview_prediction.available, false);
assert.strictEqual(example.fee_information.fee_status, 'home');

console.log('All Buckingham 71A8 readiness checks passed.');
