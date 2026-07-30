#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const { predict } = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (overrides === null || Array.isArray(overrides) || typeof overrides !== 'object') {
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

function publicBandForScore(config, score) {
  return config.score_model.advisory_public_bands.find((band) => {
    return score >= band.min && score <= band.max;
  }) || null;
}

function reasons(result) {
  return [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
}

const course = readJson('data/universities/kent-and-medway-a100.json');
const research = readJson('data/research/kent-and-medway-a100-research.json');
const config = readJson('data/interview-band-configs/kent-and-medway-a100.json');
const card = readJson('data/examples/kent-and-medway-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/kent-and-medway-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'kent-and-medway-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(course.engine_notes.official_2026_threshold_2700, null);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'KMMS must be present in data/index.json');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.interview_band_config_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

assert.strictEqual(config.score_model.official_runtime_threshold.school_leaver.total_2700, null);
assert.strictEqual(config.score_model.official_runtime_threshold.graduate.total_2700, null);
assert.strictEqual(config.eligibility.predicted_grades_policy, 'ignore');
assert.strictEqual(config.eligibility.a_level.predicted_grades_policy, 'ignore');
assert.strictEqual(config.eligibility.a_level.allow_unachieved_with_gcse_gate, true);
assert.ok(
  !config.score_model.advisory_public_bands.some((band) => band.public_label === 'Guaranteed'),
  'No active Guaranteed advisory band is configured'
);
assert.match(config.score_model.disclaimer, /not an official KMMS interview threshold/i);

for (const boundary of fixture.advisory_boundaries) {
  const band = publicBandForScore(config, boundary.score);
  assert.ok(band, `UCAT ${boundary.score} must map to an advisory band`);
  assert.strictEqual(band.public_label, boundary.expected_public_band, `public band for ${boundary.score}`);
  assert.strictEqual(band.canonical_band, boundary.expected_canonical_band, `canonical band for ${boundary.score}`);
}

const implementedBoundaryStarts = config.score_model.advisory_public_bands.map((band) => band.min);
assert.deepStrictEqual(implementedBoundaryStarts, [900, 1845, 1855, 1865]);

const officialOutcomesByAdvisoryBand = new Map();

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides || {});
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;
  const allReasons = reasons(result);

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility status`
  );

  if (expected.canonical_band) {
    assert.strictEqual(
      result.canonical_interview_band,
      expected.canonical_band,
      `${scenario.scenario_id}: canonical advisory band`
    );
  }

  if (expected.public_band) {
    const band = publicBandForScore(config, applicant.admissions_tests.ucat.total_score);
    assert.strictEqual(
      band?.public_label,
      expected.public_band,
      `${scenario.scenario_id}: public advisory band`
    );
  }

  if (expected.failure) {
    assert.ok(
      allReasons.includes(expected.failure),
      `${scenario.scenario_id}: expected reason ${expected.failure}; got ${allReasons.join(',')}`
    );
  }

  if (expected.must_not_include_failure) {
    assert.ok(
      !allReasons.includes(expected.must_not_include_failure),
      `${scenario.scenario_id}: unexpected reason ${expected.must_not_include_failure}`
    );
  }

  if (Object.hasOwn(expected, 'manual_review_required')) {
    assert.strictEqual(
      result.manual_review_required === true,
      expected.manual_review_required,
      `${scenario.scenario_id}: manual review flag`
    );
  }

  if (expected.official_status) {
    assert.strictEqual(
      expected.official_status,
      'prediction_unavailable',
      `${scenario.scenario_id}: fixture official status must stay unavailable while threshold is null`
    );
    assert.strictEqual(
      result.official_prediction?.status,
      'prediction_unavailable',
      `${scenario.scenario_id}: official threshold-null state must be prediction unavailable`
    );
    if (Object.hasOwn(expected, 'manual_review_required')) {
      assert.strictEqual(
        result.manual_review_required === true,
        expected.manual_review_required,
        `${scenario.scenario_id}: prediction unavailable must not be treated as applicant manual review`
      );
    }
    officialOutcomesByAdvisoryBand.set(result.canonical_interview_band, expected.official_status);
  }

  if (expected.predicted_grades_effect === 'none') {
    assert.ok(
      !result.eligibility.checks.some((check) => JSON.stringify(check).includes('predicted_grade')),
      `${scenario.scenario_id}: predicted grades must not appear in eligibility checks`
    );
  }
}

assert.ok(
  officialOutcomesByAdvisoryBand.has('high_risk') &&
    officialOutcomesByAdvisoryBand.has('interview_likely'),
  'Fixture matrix must show different advisory bands sharing the same official outcome'
);
for (const officialStatus of officialOutcomesByAdvisoryBand.values()) {
  assert.strictEqual(officialStatus, 'prediction_unavailable');
}

assert.strictEqual(card.eligibility.official_kmms_assessment.predicted_grades_used, false);
assert.strictEqual(card.prediction.available, false);
assert.strictEqual(card.prediction.prediction_status, 'prediction_unavailable');
assert.strictEqual(card.applysmart_advisory_guidance.available, true);
assert.match(card.applysmart_advisory_guidance.disclaimer, /not an official KMMS interview threshold/i);
assert.strictEqual(card.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.ok(!JSON.stringify(card).includes('offer_prediction_status'));

const completeApplicant = merge(fixture.base_applicant, {
  admissions_tests: {
    ucat: {
      total_score: 2550,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 850,
        decision_making: 850,
        quantitative_reasoning: 850
      }
    }
  }
});
const [completeApiResult] = predict({
  universityIds: ['kent-and-medway-a100'],
  studentProfile: completeApplicant
});
const completeCard = completeApiResult.result_card;
assert.strictEqual(completeCard.recommendation_display_state, 'standard');
assert.strictEqual(completeCard.primary_user_facing_recommendation, 'Strong Choice');
assert.match(
  completeCard.primary_explanation,
  /UCAT score of 2550 is above the ApplySmart advisory UCAT range based on historical admissions evidence of 1855-1864/i
);
assert.match(completeCard.primary_explanation, /competitive applicant profile/i);
assert.match(
  completeCard.primary_explanation,
  /available selection information and admissions evidence/i
);
assert.match(
  completeCard.primary_explanation,
  /not a guarantee of interview/i
);
assert.match(completeCard.trust_statement, /does not alter university requirements/i);
assert.strictEqual(completeCard.prediction.prediction_status, 'prediction_unavailable');
assert.strictEqual(completeCard.prediction.official_prediction.available, false);
assert.strictEqual(completeCard.prediction.applysmart_advisory_guidance.available, true);
assert.match(completeCard.prediction.applysmart_advisory_guidance.trust_statement, /available admissions evidence/i);
assert.strictEqual(completeCard.decision_transparency.manual_review_reason, null);
assert.strictEqual(completeCard.decision_transparency.official_prediction.available, false);
assert.strictEqual(completeCard.fee_information, null);
const eligibilityStage = completeCard.decision_transparency.decision_path.find((stage) => stage.stage === 'Eligibility');
assert.strictEqual(eligibilityStage.status, 'Met');
const advisoryComparison = completeCard.decision_transparency.ucat_comparison;
assert.strictEqual(advisoryComparison.applicant_ucat, 2550);
assert.strictEqual(advisoryComparison.benchmark_min, 1855);
assert.strictEqual(advisoryComparison.benchmark_max, 1864);
assert.strictEqual(advisoryComparison.position, 'above');
assert.ok(
  !JSON.stringify(completeCard).includes('Some required applicant information is missing'),
  'Prediction-unavailable KMMS cards must not claim applicant information is missing.'
);

const manualReviewApplicant = merge(fixture.base_applicant, {
  qualification_route: 'international_qualification',
  applicant_identity: {
    fee_status: 'international',
    domicile: 'international',
    applicant_type: 'school_leaver'
  },
  international_qualification: {
    name: 'Unverified overseas qualification',
    equivalence_status: 'pending',
    verified_by_institution: false,
    requirements_met: null
  },
  english_language_profile: {
    test: 'ielts_academic',
    overall: 7.5,
    reading: 7,
    writing: 7,
    listening: 7,
    speaking: 7
  },
  admissions_tests: {
    ucat: {
      total_score: 2550,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 850,
        decision_making: 850,
        quantitative_reasoning: 850
      }
    }
  }
});
const [manualApiResult] = predict({
  universityIds: ['kent-and-medway-a100'],
  studentProfile: manualReviewApplicant
});
assert.strictEqual(manualApiResult.result_card.recommendation_display_state, 'manual_review');
assert.match(
  manualApiResult.result_card.decision_transparency.manual_review_reason,
  /qualification route needs manual review|equivalence/i
);

console.log('KMMS A100 readiness checks passed.');
