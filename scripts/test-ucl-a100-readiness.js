#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
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
  for (const [key, value] of Object.entries(overrides || {})) {
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
  return failures.includes(expected);
}

function applicantForBoundary(boundary) {
  const international = boundary.pool === 'overseas';
  const access = boundary.pool === 'access_ucl';
  const overrides = {
    applicant_group_ids: [],
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international,
      contextual: false,
      widening_participation: false,
      contextual_status_confirmed: false,
      contextual_flags: {}
    },
    admissions_tests: {
      ucat: {
        total_score: boundary.ucat_total
      }
    }
  };

  if (access) {
    overrides.contextual_profile = {
      school_education: {
        state_non_fee_paying_school: 'yes',
        current_or_most_recent_uk_school_independent_fee_paying: 'no',
        attended_uk_school_or_college_for_post16_or_equivalent: 'yes'
      },
      home_area_region: {
        imd_quintile: 'q1',
        tundra_quintile: 'q5',
        polar4_quintile: 'q5'
      },
      financial_support: {
        free_school_meals: 'no',
        free_school_meals_at_level3_completion: 'no'
      },
      personal_circumstances: {
        care_experienced: 'no',
        care_over_three_months: 'no',
        estranged_from_family: 'no'
      }
    };
    overrides.a_level_profile = {
      completed_in_one_sitting: true,
      subjects: [
        {
          subject_id: 'biology',
          predicted_grade: 'A',
          sitting_status: 'first_sitting'
        },
        {
          subject_id: 'chemistry',
          predicted_grade: 'A',
          sitting_status: 'first_sitting'
        },
        {
          subject_id: 'mathematics',
          predicted_grade: 'B',
          sitting_status: 'first_sitting'
        }
      ]
    };
  }

  return merge(fixture.base_applicant, overrides);
}

function makeResultCard(course, config, applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id,
        university_name: course.university.name,
        course_name: course.course.name,
        ucas_code: course.course.ucas_code
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility,
      historical_admissions: course.historical_admissions,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      warnings: classification.warnings || []
    }
  });
}

const course = readJson('data/universities/ucl-a100.json');
const research = readJson('data/research/ucl-a100-research.json');
const config = readJson('data/interview-band-configs/ucl-a100.json');
const card = readJson('data/examples/ucl-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/ucl-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'ucl-a100');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);

assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_1_eligibility.post_16.a_level.achieved_grades_scored, false);
assert.strictEqual(course.stage_1_eligibility.post_16.a_level.predicted_grades_scored, false);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score, null);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, false);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, []);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, false);
assert.strictEqual(config.score_model.supplied_band_mapping.thresholds_preserved.access_ucl, 2080);
assert.strictEqual(config.score_model.supplied_band_mapping.thresholds_preserved.home, 2190);
assert.strictEqual(config.score_model.supplied_band_mapping.thresholds_preserved.overseas, 2300);

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
    `${scenario.scenario_id}: band`
  );
  if (expected.guidance_pool_id !== undefined) {
    assert.strictEqual(
      result.guidance_pool_id,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: pool`
    );
  }
  if (expected.ranking_value !== undefined) {
    assert.strictEqual(
      result.ranking?.value,
      expected.ranking_value,
      `${scenario.scenario_id}: ranking`
    );
  }
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: ${expected.failure}`);
  }
  if (expected.manual_review_reason) {
    assert.ok(
      result.eligibility.manual_review_reasons.includes(expected.manual_review_reason),
      `${scenario.scenario_id}: manual review reason`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

for (const boundary of fixture.historical_guidance_boundaries) {
  const result = classifyInterviewBand(course, config, applicantForBoundary(boundary));
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `${boundary.pool} UCAT ${boundary.ucat_total}`
  );
}

const baseResult = classifyInterviewBand(course, config, fixture.base_applicant);
const veryStrong = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'very_strong_academics_no_ranking_bonus';
});
const veryStrongResult = classifyInterviewBand(
  course,
  config,
  merge(fixture.base_applicant, veryStrong.overrides)
);
assert.strictEqual(baseResult.ranking.value, veryStrongResult.ranking.value);
assert.strictEqual(baseResult.canonical_interview_band, veryStrongResult.canonical_interview_band);

for (const sjtBand of [1, 2, 3, 4]) {
  const applicant = merge(fixture.base_applicant, {
    admissions_tests: {
      ucat: {
        total_score: 2300,
        sjt_band: sjtBand
      }
    }
  });
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.canonical_interview_band, 'interview_likely');
  assert.strictEqual(result.ranking.value, 2300);
}

const text = JSON.stringify({ course, research, config, card });
assert.match(text, /academic eligibility.*UCAT/i);
assert.match(text, /SJT.*tiebreaker/i);
assert.match(text, /personal statement.*not scored/i);
assert.match(text, /Only interview scores are used|interview performance alone/i);
assert.match(text, /3600/);
assert.doesNotMatch(text, /conversion_used_for_execution":true/i);
assert.doesNotMatch(text, /legacy_3600_conversion_used":true/i);
assert.doesNotMatch(text, /offer_probability|offer_prediction_status/);
assert.doesNotMatch(text, /"guaranteed_interview"/i);

assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.prediction.guidance_pool_id, 'home_a100');
assert.strictEqual(card.prediction.score, 2300);
assert.strictEqual(card.confidence.level, 'low');
assert.strictEqual(card.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(card.decision_transparency, buildDecisionTransparency(card));

const generatedCard = makeResultCard(course, config, fixture.base_applicant, baseResult);
assert.strictEqual(generatedCard.prediction.result_band, card.prediction.result_band);
assert.strictEqual(generatedCard.decision_transparency.ucat_comparison.comparison_type, 'current_guidance');
assert.strictEqual(generatedCard.decision_transparency.ucat_comparison.benchmark_min, 2190);
assert.strictEqual(generatedCard.decision_transparency.ucat_comparison.sjt_outcome, 'ignored');

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'UCL index entry must exist');
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(indexEntry.json_file, 'universities/ucl-a100.json');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/ucl-a100.json');
assert.strictEqual(indexEntry.result_card_example_file, 'examples/ucl-a100-result-card.example.json');

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  result_card_ready: true,
  contextual_logic: true,
  international_prediction: true,
  activation_ready: true,
  production_ready: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `course ${field}`);
  assert.strictEqual(indexEntry[field], expected, `index ${field}`);
}

console.log('UCL A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log(`Historical guidance boundaries checked: ${fixture.historical_guidance_boundaries.length}`);
console.log('Academic gate, UCAT pool routing, SJT tiebreaker-only policy and result-card scope: PASS');
