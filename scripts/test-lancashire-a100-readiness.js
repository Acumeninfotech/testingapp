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
  assert.ok(!serialised.includes('lancashire_course_page_2026'), 'public card must not expose raw source ids');
}

function assertNoForbiddenBands(value, message) {
  const serialised = JSON.stringify(value);
  assert.doesNotMatch(serialised, /Strong|Realistic|High Risk|Interview Likely/i, message);
}

const course = readJson('data/universities/lancashire-a100.json');
const research = readJson('data/research/lancashire-a100-research.json');
const config = readJson('data/interview-band-configs/lancashire-a100.json');
const example = readJson('data/examples/lancashire-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/lancashire-a100.json');
const index = readJson('data/index.json');
const indexEntry = index.universities.find((entry) => entry.id === 'lancashire-a100');

assert.ok(indexEntry, 'Lancashire index entry must exist.');
assert.strictEqual(course.profile_id, 'lancashire-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(example.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);

assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(indexEntry.course_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.engine_notes.assessment_mode, 'eligibility_only');
assert.strictEqual(course.engine_notes.eligibility_only_ready, true);
assert.strictEqual(course.engine_notes.assessment_available, true);
assert.strictEqual(course.engine_notes.interview_prediction_available, false);
assert.strictEqual(course.engine_notes.interview_prediction_ready, false);
assert.strictEqual(indexEntry.assessment_mode, 'eligibility_only');
assert.strictEqual(indexEntry.eligibility_only_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, false);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(isProductionReady(indexEntry), true);

assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.required, true);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score, null);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.working_historical_guidance_threshold, 1750);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.ucat.excluded_group_ids, ['international_fee']);
assert.strictEqual(config.eligibility.ucat.working_historical_guidance_threshold, 1750);
assert.strictEqual(config.eligibility.ucat.official_cutoff_published, false);

const homeQuota = course.quotas.find((quota) => quota.quota_id === 'home_places_2027_entry');
const internationalQuota = course.quotas.find((quota) => quota.quota_id === 'international_places_2027_entry');
assert.ok(homeQuota, 'Lancashire must store published Home/UK intake places.');
assert.ok(internationalQuota, 'Lancashire must store published International intake places.');
assert.strictEqual(homeQuota.places, 70);
assert.strictEqual(homeQuota.applicant_pool, 'home_a100');
assert.strictEqual(homeQuota.admissions_cycle, '2027 entry');
assert.strictEqual(homeQuota.estimate, false);
assert.strictEqual(internationalQuota.places, 200);
assert.strictEqual(internationalQuota.applicant_pool, 'international_a100');
assert.strictEqual(internationalQuota.admissions_cycle, '2027 entry');
assert.strictEqual(internationalQuota.estimate, false);
assert.ok(
  course.ranking_pools.every((pool) => pool.places_available === null),
  'Published intake figures must remain quota metadata, not ranking-pool capacity inputs.'
);

const joinedCourse = JSON.stringify(course);
assert.match(joinedCourse, /North West residency.*intentionally not evaluated|North West residency\/Foundation Entry restriction is intentionally not modelled/i);
assert.ok(!joinedCourse.includes('residency_region'), 'course must not add regional residency fields');
assert.ok(!joinedCourse.includes('uclan_foundation_entry_verified'), 'course must not add Foundation Entry evidence fields');

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(result.eligibility.status, expected.eligibility_status, `${scenario.scenario_id}: eligibility`);
  assert.strictEqual(result.canonical_interview_band, expected.interview_band, `${scenario.scenario_id}: band`);

  if (expected.guidance_pool_id) {
    assert.strictEqual(result.guidance_pool_id, expected.guidance_pool_id, `${scenario.scenario_id}: guidance pool`);
  }
  if (expected.failure) {
    assert.ok(result.eligibility.failures.includes(expected.failure), `${scenario.scenario_id}: expected failure ${expected.failure}`);
  }

  const card = makePublicCard(applicant, result);
  assert.strictEqual(card.prediction.assessment.available, true);
  assert.strictEqual(card.prediction.interview_prediction.available, false);
  assert.strictEqual(card.prediction.prediction_type, 'eligibility_only');
  assert.strictEqual(card.prediction.result_band, expected.card_result_band);
  assertNoInternalLeak(card);
  assertNoForbiddenBands(card, `${scenario.scenario_id}: no interview-likelihood bands`);
  assert.doesNotMatch(JSON.stringify(card), /North West|residency|Foundation Entry/i, `${scenario.scenario_id}: no residency warning/failure`);

  if (scenario.scenario_id === 'home_a_level_eligible_ucat_guidance_met') {
    assert.strictEqual(card.primary_user_facing_recommendation, 'Entry requirements met');
    assert.match(card.primary_explanation, /confirmed your eligibility against the entry requirements/i);
  }
  if (scenario.scenario_id === 'home_a_level_ucat_guidance_not_met') {
    assert.strictEqual(card.primary_user_facing_recommendation, 'More information is required');
    assert.match(card.primary_explanation, /ApplySmart's working historical guidance threshold/i);
    assert.match(card.primary_explanation, /does not publish an official UCAT cut-off/i);
    assert.doesNotMatch(card.primary_explanation, /published minimum|official minimum|official cut-off of 1750/i);
  }
  if (scenario.scenario_id === 'international_ib_eligible_ucat_not_required') {
    assert.ok(!result.eligibility.failures.some((failure) => String(failure).includes('ucat')));
    assert.strictEqual(result.guidance_pool_id, 'international_a100_eligibility_gate');
  }
}

assert.strictEqual(research.metadata.assessment_mode, 'eligibility_only');
assert.strictEqual(research.metadata.ucat_working_guidance_threshold, 1750);
assert.strictEqual(research.metadata.ucat_working_guidance_official_cutoff, false);
assert.strictEqual(research.metadata.home_places, 70);
assert.strictEqual(research.metadata.international_places, 200);
assert.strictEqual(research.metadata.intake_figures_reference_only, true);
assert.strictEqual(research.metadata.intake_figures_estimated, false);
assert.strictEqual(research.metadata.intake_figures_admissions_cycle, '2027 entry');
assert.strictEqual(research.readiness.interview_prediction_ready, false);
assert.strictEqual(example.prediction.result_band, 'eligible_to_apply');
assert.strictEqual(example.prediction.prediction_type, 'eligibility_only');
assert.strictEqual(example.prediction.assessment.available, true);
assert.strictEqual(example.prediction.interview_prediction.available, false);
assert.match(example.display.primary_explanation, /confirmed your eligibility against the entry requirements/i);
assertNoForbiddenBands(example, 'example must not expose interview-likelihood bands');
assert.doesNotMatch(JSON.stringify(example), /North West|residency|Foundation Entry/i, 'example must not expose residency scope exclusion');

console.log('All Lancashire A100 eligibility-only readiness checks passed.');
