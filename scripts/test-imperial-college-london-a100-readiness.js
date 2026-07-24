#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  predict
} = require('../server/src/predict');

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

const course = readJson('data/universities/imperial-college-london-a100.json');
const research = readJson('data/research/imperial-college-london-a100-research.json');
const config = readJson('data/interview-band-configs/imperial-college-london-a100.json');
const card = readJson('data/examples/imperial-college-london-a100-result-card.example.json');
const fixture = readJson(
  'data/fixtures/interview-band-classification/imperial-college-london-a100.json'
);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'imperial-college-london-a100');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(
  course.stage_1_eligibility.academic_requirements.same_sitting.required,
  true
);
assert.deepStrictEqual(
  research.implementation_mapping.universities_opting_in,
  ['imperial-college-london-a100']
);

const ucat = course.stage_1_eligibility.admissions_tests.ucat;
assert.deepStrictEqual(
  ucat.group_minimum_total_scores.map((rule) => rule.minimum_total_score),
  [2170, 2310, 2320]
);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, [4]);
assert.strictEqual(course.stage_1_eligibility.resits.allowed, false);
assert.strictEqual(course.stage_1_eligibility.post_16.a_level.achieved_grades_scored, false);
assert.strictEqual(course.stage_1_eligibility.post_16.a_level.predicted_grades_scored, false);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, false);
assert.strictEqual(config.score_model.single_current_scale_threshold_cycle, true);
assert.strictEqual(config.confidence, 'low');

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
      result.ranking.value,
      expected.ranking_value,
      `${scenario.scenario_id}: ranking`
    );
  }
  if (expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }
  if (expected.failure_prefix) {
    assert.ok(
      result.eligibility.failures.some((failure) => {
        return failure.startsWith(expected.failure_prefix);
      }),
      `${scenario.scenario_id}: expected failure prefix ${expected.failure_prefix}`
    );
  }
  if (expected.manual_review_reason) {
    assert.ok(
      result.eligibility.manual_review_reasons.includes(expected.manual_review_reason),
      `${scenario.scenario_id}: expected manual review ${expected.manual_review_reason}`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function applicantForBoundary(boundary) {
  const international = boundary.pool === 'overseas';
  const contextual = boundary.pool === 'contextual';
  const overrides = {
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international,
      contextual,
      widening_participation: contextual,
      contextual_status_confirmed: contextual,
      contextual_flags: contextual ? { imperial_wp_confirmed: true } : {}
    },
    admissions_tests: {
      ucat: {
        total_score: boundary.ucat_total
      }
    }
  };
  if (contextual) {
    overrides.a_level_profile = {
      completed_in_one_sitting: true,
      subjects: [
        {
          subject_id: 'biology',
          predicted_grade: 'A',
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
        },
        {
          subject_id: 'chemistry',
          predicted_grade: 'A',
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
        },
        {
          subject_id: 'mathematics',
          predicted_grade: 'A*',
          sitting_status: 'first_sitting'
        }
      ]
    };
  }
  return merge(fixture.base_applicant, overrides);
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

const reportedStrongScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'reported_strong_non_contextual_home_ucat_2550';
});
const reportedStrongApplicant = merge(
  fixture.base_applicant,
  reportedStrongScenario.overrides
);
const [reportedStrongCardResult] = predict({
  universityIds: ['imperial-college-london-a100'],
  studentProfile: reportedStrongApplicant
});
const reportedStrongCard = reportedStrongCardResult.result_card;
assert.strictEqual(reportedStrongCard.recommendation_display_state, 'standard');
assert.strictEqual(reportedStrongCard.prediction.result_band, 'interview_likely');
assert.strictEqual(reportedStrongCard.decision_transparency.ucat_comparison.applicant_ucat, 2550);
assert.strictEqual(
  reportedStrongCard.decision_transparency.ucat_comparison.applicant_pool,
  'Home, Rest of UK applicants'
);
assert.strictEqual(
  reportedStrongCard.decision_timeline.find((stage) => {
    return stage.title === 'Eligibility assessed';
  }).status,
  'Eligible'
);
assert.ok(reportedStrongCard.decision_transparency.decision_path.length >= 3);
assert.ok(reportedStrongCard.decision_timeline.length > 0);
assert.ok(reportedStrongCard.evidence_confidence.level);
assert.ok(reportedStrongCard.historical_guidance_caveat);
assert.ok(
  reportedStrongCard.decision_transparency.decision_path.some((stage) => {
    return stage.stage === 'Historical guidance';
  })
);

const missingSameSittingScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'missing_same_sitting_evidence';
});
const [missingSameSittingCardResult] = predict({
  universityIds: ['imperial-college-london-a100'],
  studentProfile: merge(fixture.base_applicant, missingSameSittingScenario.overrides)
});
assert.strictEqual(
  missingSameSittingCardResult.result_card.decision_transparency.manual_review_reason,
  'Please confirm whether your required A-level qualifications were or will be completed in the same examination sitting.'
);

const text = JSON.stringify({ course, research, config, card });
assert.match(text, /2025 UCAT averages.*3600|3600 scale/s);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, false);
assert.strictEqual(card.historical_context.legacy_3600_data.conversion_used_for_execution, false);
assert.doesNotMatch(text, /offer_probability|offer_prediction_status/);
assert.doesNotMatch(text, /"guaranteed_interview"/i);
assert.match(text, /not a guarantee|No interview is guaranteed|not guaranteed/i);
assert.match(text, /subsection.*not.*executed|subsection.*not.*disclosed/i);

assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.strictEqual(card.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Imperial index entry must exist');
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(
  indexEntry.interview_band_config_file,
  'interview-band-configs/imperial-college-london-a100.json'
);

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

console.log('Imperial College London A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log(`Historical guidance boundaries checked: ${fixture.historical_guidance_boundaries.length}`);
console.log('Eligibility gates, UCAT thresholds, SJT, same-sitting and result-card scope: PASS');
