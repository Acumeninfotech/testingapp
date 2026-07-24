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
const { predict } = require('../server/src/predict');

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

const course = readJson('data/universities/southampton-a100.json');
const research = readJson('data/research/southampton-a100-research.json');
const config = readJson('data/interview-band-configs/southampton-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/southampton-a100.json');
const card = readJson('data/examples/southampton-a100-result-card.example.json');
const index = readJson('data/index.json');
const schema = readJson('data/schemas/interview-band-classification.schema.json');
const bristolCourse = readJson('data/universities/bristol-a100.json');
const bristolConfig = readJson('data/interview-band-configs/bristol-a100.json');

assert.strictEqual(course.profile_id, 'southampton-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_2_interview_selection.ranking_factors[0].weight_percent, 100);
assert.deepStrictEqual(course.stage_2_interview_selection.modifiers, [
  'home_international_separate_ranking'
]);

const gcse = course.stage_1_eligibility.gcse;
assert.strictEqual(gcse.minimum_count, 7);
assert.strictEqual(gcse.scored_after_eligibility, false);
assert.strictEqual(gcse.minimum_count_at_or_above_grade.count, 7);
assert.strictEqual(gcse.minimum_count_at_or_above_grade.minimum_grade, '6/B');

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.deepStrictEqual(aLevel.standard_offer.grade_profile, ['A', 'A', 'A']);
assert.deepStrictEqual(aLevel.contextual_offer.grade_profile, ['A', 'A', 'B']);
assert.strictEqual(aLevel.science_practical_endorsement_required, true);
assert.strictEqual(aLevel.achieved_grades_scored, false);
assert.strictEqual(aLevel.predicted_grades_scored, false);

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.strictEqual(admissionsTests.ucat.weight_percent, 100);
assert.strictEqual(admissionsTests.sjt.used_as_gate, false);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3, 4]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, []);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

assert.strictEqual(config.score_model.type, 'ranking_metric');
assert.strictEqual(config.score_model.metric, 'ucat_total');
assert.strictEqual(config.score_model.scale.max, 2700);
assert.strictEqual(config.score_model.legacy_3600_values_display_only, true);
assert.strictEqual(config.score_model.current_scale_guidance.home.value, 2100);
assert.strictEqual(config.score_model.current_scale_guidance.home.score_scale, 2700);
assert.strictEqual(config.score_model.current_scale_guidance.home.confidence, 'low');
assert.strictEqual(config.score_model.current_scale_guidance.international.available, false);
assert.strictEqual(config.score_model.applysmart_modelling_boundaries.home_a100.high_risk_below, 1900);
assert.strictEqual(config.score_model.applysmart_modelling_boundaries.home_a100.realistic_min, 1900);
assert.strictEqual(config.score_model.applysmart_modelling_boundaries.home_a100.realistic_max, 2199);
assert.strictEqual(config.score_model.applysmart_modelling_boundaries.home_a100.interview_likely_min, 2200);
assert.strictEqual(config.score_model.applysmart_modelling_boundaries.home_a100.current_format_home_guidance, 2100);
assert.strictEqual(
  config.score_model.applysmart_modelling_boundaries.home_a100.highest_available_converted_historical_threshold,
  2107.5
);
assert.strictEqual(config.eligibility.graduate.gcse_required, true);
assert.strictEqual(config.eligibility.graduate.waive_a_level_requirements, true);
assert.strictEqual(config.eligibility.graduate.minimum_classification, '2_1');
assert.strictEqual(config.eligibility.graduate.postgraduate_compensation_allowed, false);
assert.strictEqual(
  schema.properties.eligibility.properties.graduate.properties.gcse_required.type,
  'boolean'
);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => pool.pool_id),
  [
    'international_a100',
    'home_a100'
  ]
);
assert.deepStrictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'international_a100').band_rules,
  []
);
assert.strictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'home_a100').comparison_guidance.comparison_type,
  'current_guidance'
);
assert.deepStrictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'home_a100').band_rules,
  [
    { band: 'interview_likely', operator: 'greater_than_or_equal', value: 2200 },
    { band: 'realistic', operator: 'between_inclusive', min: 1900, max: 2199 },
    { band: 'high_risk', operator: 'less_than', value: 1900 }
  ]
);
assert.ok(
  JSON.stringify(config).includes('not an official Southampton cut-off') ||
    JSON.stringify(config).includes('not official Southampton cut-offs'),
  'Southampton modelling boundaries must be labelled as non-official cut-offs.'
);
assert.ok(
  JSON.stringify(research).includes('not an official Southampton cut-off') ||
    JSON.stringify(research).includes('not official Southampton current cut-offs'),
  'Southampton research must not present modelled boundaries as official cut-offs.'
);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Southampton A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/southampton-a100.json');
assert.strictEqual(hasNestedKey(course, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'offer_prediction'), false);

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
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function applicantForBoundary(boundary) {
  const international = boundary.pool === 'international';
  const ucatTotal = boundary.ucat_total;
  const first = Math.floor(ucatTotal / 3);
  const second = Math.floor((ucatTotal - first) / 2);
  const third = ucatTotal - first - second;
  return merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international
    },
    admissions_tests: {
      ucat: {
        total_score: ucatTotal,
        subtests: {
          verbal_reasoning: first,
          decision_making: second,
          quantitative_reasoning: third
        }
      }
    }
  });
}

for (const boundary of fixture.historical_guidance_boundaries) {
  const result = classifyInterviewBand(
    course,
    config,
    applicantForBoundary(boundary)
  );
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `${boundary.pool} UCAT ${boundary.ucat_total}`
  );
}

const graduateApplicantScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'graduate_applicant';
});
const graduateApplicant = merge(fixture.base_applicant, graduateApplicantScenario.overrides);
const graduateResult = classifyInterviewBand(course, config, graduateApplicant);
assert.strictEqual(graduateResult.eligibility.status, 'eligible');
assert.strictEqual(graduateResult.guidance_pool_id, 'home_a100');
assert.strictEqual(graduateResult.canonical_interview_band, 'interview_likely');
assert.ok(graduateResult.applicant_group_ids.includes('graduate_applicant'));

const failedGraduateScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'graduate_2_1_insufficient_gcse_not_eligible';
});
const failedGraduate = merge(fixture.base_applicant, failedGraduateScenario.overrides);
const failedGraduateResult = classifyInterviewBand(course, config, failedGraduate);
assert.strictEqual(failedGraduateResult.eligibility.status, 'not_eligible');
assert.strictEqual(failedGraduateResult.canonical_interview_band, 'not_eligible');

const missingGraduateGcseConfig = clone(config);
delete missingGraduateGcseConfig.eligibility.graduate.gcse_required;
const missingGcseConfigResult = classifyInterviewBand(course, missingGraduateGcseConfig, failedGraduate);
assert.strictEqual(
  missingGcseConfigResult.eligibility.status,
  'not_eligible',
  'A graduate route that waives A-levels must fail closed and still enforce GCSEs when gcse_required is omitted.'
);

const belowDegreeScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'graduate_below_minimum_degree_not_eligible';
});
const belowDegreeApplicant = merge(fixture.base_applicant, belowDegreeScenario.overrides);
const belowDegreeResult = classifyInterviewBand(course, config, belowDegreeApplicant);
assert.strictEqual(belowDegreeResult.eligibility.status, 'not_eligible');
assert.ok(includesFailure(belowDegreeResult, 'graduate_degree_requirements_not_met'));

const noALevelSchoolLeaverScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'school_leaver_no_a_levels_not_eligible';
});
const noALevelSchoolLeaver = merge(fixture.base_applicant, noALevelSchoolLeaverScenario.overrides);
const noALevelSchoolLeaverResult = classifyInterviewBand(course, config, noALevelSchoolLeaver);
assert.strictEqual(noALevelSchoolLeaverResult.eligibility.status, 'not_eligible');
assert.ok(!noALevelSchoolLeaverResult.applicant_group_ids.includes('graduate_applicant'));

const bristolGraduate = merge(fixture.base_applicant, {
  qualification_route: 'graduate',
  applicant_identity: {
    applicant_type: 'graduate',
    graduate: true
  },
  graduate_profile: {
    is_graduate: true,
    degree_classification: '2_1'
  },
  a_level_profile: null
});
const bristolGraduateResult = classifyInterviewBand(bristolCourse, bristolConfig, bristolGraduate);
assert.notStrictEqual(
  bristolGraduateResult.eligibility.status,
  'eligible',
  'A graduate at an existing university with graduate manual review must not inherit the Southampton waiver.'
);

const baseResult = classifyInterviewBand(course, config, fixture.base_applicant);
const resultCard = makeResultCard(course, config, fixture.base_applicant, baseResult);
assert.strictEqual(resultCard.prediction.ranking_metric, 'ucat_total');
assert.strictEqual(resultCard.decision_transparency.score_breakdown, null);
assert.ok(
  resultCard.decision_transparency.decision_path.some((stage) => {
    const text = JSON.stringify(stage).toLowerCase();
    return text.includes('ucat') && text.includes('ranking');
  }),
  'Result card must explain UCAT ranking rather than a scoring breakdown.'
);
assert.ok(
  resultCard.decision_transparency.decision_path.some((stage) => {
    return JSON.stringify(stage).includes('2100/2700') &&
      JSON.stringify(stage).includes('current-format Home competitive guidance');
  }),
  'Result card must display current-format Home UCAT guidance.'
);
assert.ok(
  resultCard.decision_transparency.decision_path.some((stage) => {
    return JSON.stringify(stage).includes('2610') &&
      JSON.stringify(stage).includes('3600');
  }),
  'Result card must display historical UCAT values in their original 3600 scale.'
);
assert.ok(
  resultCard.confidence === undefined &&
    resultCard.decision_transparency?.confidence === undefined,
  'Result card must not expose raw internal confidence fields.'
);

const predicted = predict({
  universityIds: ['southampton-a100'],
  studentProfile: fixture.base_applicant
});
assert.strictEqual(predicted.length, 1);
assert.strictEqual(predicted[0].universityId, 'southampton-a100');
assert.strictEqual(predicted[0].result_card.prediction.result_band, 'interview_likely');
assert.match(
  predicted[0].result_card.primary_explanation,
  /materially above Southampton's available Home competitive guidance/i
);
assert.strictEqual(predicted[0].result_card.decision_transparency.score_breakdown, null);

console.log('Southampton A100 readiness checks passed.');
