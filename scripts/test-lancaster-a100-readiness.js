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

const course = readJson('data/universities/lancaster-a100.json');
const research = readJson('data/research/lancaster-a100-research.json');
const config = readJson('data/interview-band-configs/lancaster-a100.json');
const card = readJson('data/examples/lancaster-a100-result-card.example.json');
const fixture = readJson(
  'data/fixtures/interview-band-classification/lancaster-a100.json'
);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'lancaster-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');

const gcse = course.stage_1_eligibility.gcse;
assert.strictEqual(gcse.minimum_count, 8);
assert.strictEqual(gcse.points_scoring.best_subject_count, 8);
assert.strictEqual(gcse.points_scoring.minimum_points, 13);
assert.strictEqual(gcse.grade_requirements[0].minimum_grade, '6/B');
assert.strictEqual(gcse.grade_requirements[1].minimum_grade, '6/B');
assert.deepStrictEqual(
  gcse.conditional_grade_requirements.map((rule) => [
    rule.subject_id,
    rule.minimum_grade,
    rule.execution_status
  ]),
  [
    [
      'biology',
      '7/A',
      'metadata_only_current_engine_cannot_apply_cross_qualification_condition'
    ],
    [
      'chemistry',
      '7/A',
      'metadata_only_current_engine_cannot_apply_cross_qualification_condition'
    ]
  ]
);

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.deepStrictEqual(aLevel.stage_1_predicted_minimum.grade_profile, ['A', 'A', 'B']);
assert.deepStrictEqual(aLevel.standard_offer.grade_profile, ['A', 'A', 'A']);
assert.deepStrictEqual(aLevel.epq_alternative_offer, {
  enabled: true,
  pathway_id: 'lancaster_epq_alternative',
  a_level_grades: ['A', 'A', 'B'],
  epq_minimum_grade: 'B'
});
assert.deepStrictEqual(aLevel.contextual_offer.grade_profile, ['A', 'B', 'B']);
assert.strictEqual(aLevel.science_practical_endorsement_required, null);
assert.deepStrictEqual(
  aLevel.one_of_subject_groups[0].subject_ids,
  ['biology', 'chemistry', 'psychology']
);
assert.strictEqual(aLevel.one_of_subject_groups[0].minimum_required, 2);

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, [4]);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, false);
assert.strictEqual(
  config.guidance_pools
    .find((pool) => pool.pool_id === 'home_standard_school_leaver')
    .band_rules.some((rule) => rule.band === 'interview_likely'),
  true,
  'Lancaster home standard pool must use the approved ApplySmart interview_likely band (30-99 points above the published threshold).'
);
assert.strictEqual(
  config.guidance_pools
    .find((pool) => pool.pool_id === 'home_standard_school_leaver')
    .band_rules.some((rule) => rule.band === 'very_strong_interview_potential'),
  true,
  'Lancaster home standard pool must use the approved ApplySmart very_strong_interview_potential band (100+ points above the published threshold).'
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);

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

function applicantForBoundary(boundary) {
  const contextual = boundary.pool === 'home_contextual';
  const international = boundary.pool === 'international';
  return merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international,
      contextual,
      widening_participation: contextual,
      contextual_flags: {
        free_school_meals: contextual
      }
    },
    admissions_tests: {
      ucat: {
        total_score: boundary.ucat_total
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

const graduateApplicant = merge(fixture.base_applicant, {
  applicant_identity: {
    applicant_type: 'graduate',
    graduate: true
  },
  graduate_profile: {
    is_graduate: true,
    degree_classification: '2_1'
  }
});
const graduateResult = classifyInterviewBand(course, config, graduateApplicant);
assert.strictEqual(graduateResult.guidance_pool_id, null);
assert.strictEqual(graduateResult.canonical_interview_band, 'insufficient_evidence');
assert.strictEqual(
  course.stage_1_eligibility.post_16.degree.execution_status,
  'manual_review_required_for_transcript_average_degree_subject_and_a_level_branch'
);

assert.strictEqual(
  research.ucat_and_sjt.scale_policy.conversion_used_for_prediction,
  false
);
assert.deepStrictEqual(
  research.evidence_gaps.map((gap) => gap.gap_id),
  [
    'current_2027_ucat_thresholds',
    'final_2026_ucat_statistics',
    'ib_total_points',
    'international_fact_sheet_details',
    'practical_endorsement',
    'mmi_operational_detail'
  ]
);
assert.strictEqual(
  research.implementation_mapping.architecture_change_required,
  false
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.prediction.guidance_pool_id, 'home_standard_school_leaver');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(
  card.decision_transparency,
  buildDecisionTransparency(card)
);
assert.match(
  card.decision_timeline[2].summary,
  /academic requirements.*SJT filter.*UCAT ranking/i
);
assert.match(
  JSON.stringify(card.decision_transparency),
  /sole ranking score.*2026-entry Home historical threshold/s
);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/lancaster-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  result_card_ready: true,
  contextual_logic: true,
  international_prediction: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `production ${field}`);
  assert.strictEqual(indexEntry[field], expected, `index ${field}`);
}

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

console.log('Lancaster A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log(`Historical guidance boundaries checked: ${fixture.historical_guidance_boundaries.length}`);
console.log('Evidence gaps, scale isolation, transparency and activation metadata: PASS');
