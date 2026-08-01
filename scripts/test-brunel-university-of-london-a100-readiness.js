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
  insufficientEvidenceReasonCodeFromWarnings,
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

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => failure === expected);
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

const course = readJson('data/universities/brunel-university-of-london-a100.json');
const research = readJson('data/research/brunel-university-of-london-a100-research.json');
const config = readJson('data/interview-band-configs/brunel-university-of-london-a100.json');
const card = readJson('data/examples/brunel-university-of-london-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/brunel-university-of-london-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'brunel-university-of-london-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_2_interview_selection.academic_scoring.applies, false);
assert.strictEqual(course.contextual_admissions.interview_selection_adjustment.applies, false);
assert.strictEqual(course.engine_notes.international_prediction, false);
assert.strictEqual(course.engine_notes.contextual_logic, true);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.deepStrictEqual(admissionsTests.ucat.excluded_group_ids, ['international_fee']);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, [4]);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

assert.strictEqual(
  course.stage_1_eligibility.post_16.a_level.science_practical_endorsement_required,
  null
);
assert.strictEqual(
  config.eligibility.a_level.science_practical_endorsement,
  undefined,
  'Brunel must not enforce an unverified science practical endorsement requirement.'
);
assert.strictEqual(course.stage_1_eligibility.gcse.selection_role, 'eligibility_only');
assert.strictEqual(course.stage_1_eligibility.gcse.scored_after_eligibility, false);
assert.deepStrictEqual(
  config.eligibility.qualification_routes.manual_review,
  ['graduate', 'international_qualification']
);
assert.ok(
  config.eligibility.do_not_infer.some((entry) => /contextual UCAT/i.test(entry)),
  'Contextual status must not alter UCAT ranking.'
);

assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.strictEqual(config.score_model.conversion_policy.formula, 'official_score_3600 * 3 / 4');
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.observed_lowest_min_2700,
  1680
);
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.observed_average_max_2700,
  1995
);
assert.deepStrictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'home_a100').band_rules.map((rule) =>
    rule.operator === 'between_inclusive'
      ? [rule.band, rule.operator, rule.min, rule.max]
      : [rule.band, rule.operator, rule.value]
  ),
  [
    ['interview_likely', 'greater_than_or_equal', 1996],
    ['realistic', 'between_inclusive', 1680, 1995],
    ['ambitious', 'between_inclusive', 1530, 1679],
    ['high_risk', 'less_than', 1530]
  ]
);

assert.strictEqual(
  config.guidance_pools.some((pool) => pool.pool_id === 'international_a100'),
  false,
  'International applicants must not receive a Home-style executable UCAT guidance pool.'
);

const historicalRows = course.historical_admissions.cycles;
assert.strictEqual(historicalRows.length, 6);
assert.deepStrictEqual(
  historicalRows
    .filter((row) => row.metric === 'lowest_interviewed')
    .map((row) => row.converted_score_2700),
  [1755, 1717.5, 1680]
);
assert.deepStrictEqual(
  historicalRows
    .filter((row) => row.metric === 'average_interviewed')
    .map((row) => row.converted_score_2700),
  [1957.5, 1980, 1995]
);
assert.ok(
  course.historical_admissions.offer_stage_reference_only.every((row) => {
    return Object.prototype.hasOwnProperty.call(row, 'lowest_offered_2700');
  }),
  'Offer-stage rows may be preserved only as reference-only metadata.'
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
      `${scenario.scenario_id}: ranking value`
    );
  }
  if (expected.failure) {
    assert.ok(
      includesFailure(result, expected.failure),
      `${scenario.scenario_id}: expected failure or review ${expected.failure}`
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

const baseClassification = classifyInterviewBand(course, config, fixture.base_applicant);
const baseResultCard = makeResultCard(course, config, fixture.base_applicant, baseClassification);
assert.strictEqual(baseResultCard.primary_user_facing_recommendation, 'Possible choice for your application');
assert.match(baseResultCard.primary_explanation, /ucat score may be competitive for this applicant group/i);
assert.match(baseResultCard.historical_guidance_caveat, /not a current cut-off/i);
assert.strictEqual(baseResultCard.decision_transparency.score_breakdown ?? null, null);
assert.doesNotMatch(
  JSON.stringify(baseResultCard),
  /offer probability|offer likelihood|waiting list prediction|MMI prediction/i
);

const internationalApplicant = merge(fixture.base_applicant, {
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  admissions_tests: {},
  application_year: 2026
});
const internationalClassification = classifyInterviewBand(course, config, internationalApplicant);
const internationalCard = makeResultCard(course, config, internationalApplicant, internationalClassification);
assert.strictEqual(internationalClassification.guidance_pool_id, null);
assert.strictEqual(internationalClassification.canonical_interview_band, 'insufficient_evidence');
assert.doesNotMatch(JSON.stringify(internationalCard), /Home historical UCAT guidance.*Strong choice/i);

assert.strictEqual(research.metadata.approved_methodology, 'ucat_ranking');
assert.strictEqual(research.metadata.academic_ranking, false);
assert.strictEqual(research.metadata.contextual_ucat_uplift, false);
assert.strictEqual(research.applicant_groups.international.interview_prediction, false);
assert.strictEqual(research.applicant_groups.graduate.interview_prediction, false);
assert.deepStrictEqual(
  research.historical_ucat_thresholds.map((row) => row.converted_current_2700_score),
  [1755, 1957.5, 1717.5, 1980, 1680, 1995]
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.guidance_pool_id, 'home_a100');
assert.strictEqual(card.confidence.level, 'low');
assert.strictEqual(card.readiness.international_prediction, false);
assert.strictEqual(card.readiness.contextual_logic, true);
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(card.decision_transparency, buildDecisionTransparency(card));
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);
assert.doesNotMatch(
  JSON.stringify(card.display),
  /official current cut-off|guaranteed interview|percentage chance|offer likelihood/i
);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Brunel A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/brunel-university-of-london-a100.json');
assert.strictEqual(indexEntry.result_card_example_file, 'examples/brunel-university-of-london-a100-result-card.example.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
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
  assert.deepStrictEqual(course.engine_notes[field], indexEntry[field]);
}

console.log('Brunel University of London A100 readiness regression: PASS');
