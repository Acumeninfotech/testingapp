#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (overrides === null || overrides === undefined) {
    return clone(overrides);
  }
  if (Array.isArray(overrides) || typeof overrides !== 'object') {
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

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.includes(expected);
}

const course = readJson('data/universities/lincoln-a100.json');
const research = readJson('data/research/lincoln-a100-research.json');
const config = readJson('data/interview-band-configs/lincoln-a100.json');
const card = readJson('data/examples/lincoln-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/lincoln-a100.json');
const index = readJson('data/index.json');

function presentLincolnCard(result, applicant) {
  return presentResultCard({
    eligibilityStatus: result.eligibility.status,
    interviewBand: result.canonical_interview_band,
    manualReviewRequired: result.manual_review_required === true,
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id
      },
      applicant_context: applicant,
      applicant_group_ids: result.applicant_group_ids,
      readiness: course.engine_notes,
      eligibility_checks: result.eligibility.checks,
      eligibility_failures: result.eligibility.failures,
      stage_1_eligibility: course.stage_1_eligibility,
      historical_admissions: course.historical_admissions,
      ranking: result.ranking,
      band_metric: result.band_metric,
      guidance_pool: result.guidance_pool,
      score_model: config.score_model
    }
  });
}

assert.strictEqual(course.profile_id, 'lincoln-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.fee_statuses.includes('home'), true);
assert.strictEqual(course.course.fee_statuses.includes('international'), false);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'points_system');
assert.strictEqual(
  course.stage_2_interview_selection.selection_model_label,
  'OFFICIAL_DUAL_MODEL_60_POINT_PRE_INTERVIEW_SCORE'
);
assert.strictEqual(course.contextual_admissions.interview_selection_adjustment.maximum_points, 12);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(course.engine_notes.architecture_change_required, false);
assert.strictEqual(research.metadata.dual_model_implemented_by_configuration, true);
assert.strictEqual(research.metadata.contextual_cap_implemented_by_exact_combination_conditions, true);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Lincoln must be present in data/index.json.');
assert.strictEqual(indexEntry.interview_band_config_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.prediction_confidence, 'low');
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, [4]);
assert.strictEqual(admissionsTests.sjt.band_4_policy, 'automatic_rejection_at_application');

assert.strictEqual(course.historical_admissions.interview_threshold.official_value, null);
assert.strictEqual(course.historical_admissions.interview_numbers.official_value, null);
assert.strictEqual(
  course.historical_admissions.provisional_prediction_bands.runtime_use,
  'provisional_guidance_only'
);
assert.ok(
  config.score_model.official_vs_estimated_policy.runtime_allowed.some((item) =>
    /provisional prediction bands/i.test(item)
  ),
  'Provisional prediction bands must be allowed only as clearly labelled strategic guidance.'
);
assert.strictEqual(
  config.guidance_pools.every((pool) => pool.band_rules.length === 4),
  true,
  'Lincoln must provide provisional band rules for scoreable eligible applicants.'
);

for (const pool of config.guidance_pools) {
  assert.deepStrictEqual(
    pool.band_rules.map((rule) => rule.band),
    ['interview_likely', 'realistic', 'ambitious', 'high_risk'],
    `${pool.pool_id}: provisional band order`
  );
}

const contextualComponent = config.score_model.components.find((component) =>
  component.component_id === 'model_a_contextual_capped'
);
assert.ok(contextualComponent);
assert.strictEqual(contextualComponent.max, 12);
assert.strictEqual(contextualComponent.conditions.length, 127);
assert.ok(
  contextualComponent.conditions.every((condition) => condition.points <= 12),
  'Every contextual exact-combination condition must respect the 12-point cap.'
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
  assert.strictEqual(
    result.ranking?.value ?? null,
    expected.score,
    `${scenario.scenario_id}: official score`
  );
  assert.strictEqual(
    result.ranking?.max ?? null,
    expected.score_max,
    `${scenario.scenario_id}: score max`
  );

  if (expected.contextual_component !== undefined) {
    assert.strictEqual(
      result.ranking.components.model_a_contextual_capped.value,
      expected.contextual_component,
      `${scenario.scenario_id}: contextual cap`
    );
  }
  if (expected.uncapped_score !== undefined) {
    assert.strictEqual(
      result.ranking.uncapped_value,
      expected.uncapped_score,
      `${scenario.scenario_id}: uncapped score`
    );
  }
  if (expected.cap_applied !== undefined) {
    assert.strictEqual(
      result.ranking.cap_applied,
      expected.cap_applied,
      `${scenario.scenario_id}: cap applied`
    );
  }

  if (expected.public_recommendation) {
    const resultCard = presentLincolnCard(result, applicant);
    assert.strictEqual(
      resultCard.primary_user_facing_recommendation,
      expected.public_recommendation,
      `${scenario.scenario_id}: public recommendation`
    );
    assert.strictEqual(
      resultCard.prediction.available,
      true,
      `${scenario.scenario_id}: public prediction available`
    );
    assert.match(
      resultCard.primary_explanation,
      /provisional|first independent admissions cycle/i,
      `${scenario.scenario_id}: provisional warning`
    );
  }

  if (expected.failure) {
    assert.ok(
      includesFailure(result, expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }

  assert.strictEqual(result.offer_prediction_status, undefined);
}

const cappedScenario = fixture.scenarios.find((scenario) =>
  scenario.scenario_id === 'model_a_contextual_cap_12'
);
const cappedApplicant = merge(fixture.base_applicant, cappedScenario.overrides);
const cappedResult = classifyInterviewBand(course, config, cappedApplicant);
const cappedResultCard = presentLincolnCard(cappedResult, cappedApplicant);
assert.strictEqual(cappedResult.ranking.uncapped_value, 66);
assert.strictEqual(cappedResult.ranking.value, 60);
assert.strictEqual(cappedResult.ranking.components.model_a_contextual_capped.value, 12);
assert.strictEqual(cappedResultCard.decision_transparency.score_breakdown.uncapped_value, 66);
assert.strictEqual(cappedResultCard.decision_transparency.score_breakdown.value, 60);
assert.match(
  cappedResultCard.decision_transparency.score_breakdown.explanation,
  /final selection score is capped at 60/i,
  'Capped Lincoln result card must explain that raw total was capped.'
);

const legacyContextualOnlyApplicant = merge(fixture.base_applicant, {
  applicant_group_ids: [
    'contextual',
    'widening_participation',
    'lincoln_care_leaver',
    'lincoln_mem2_q1',
    'lincoln_ucat_bursary',
    'lincolnshire_residence'
  ],
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    contextual_flags: {
      care_leaver: true,
      mem2_q1: true,
      ucat_bursary: true,
      lincolnshire_residence: true
    }
  }
});
const legacyContextualOnlyResult = classifyInterviewBand(
  course,
  config,
  legacyContextualOnlyApplicant
);
assert.strictEqual(
  legacyContextualOnlyResult.ranking.components.model_a_contextual_capped.value,
  0,
  'Legacy Lincoln flags and raw applicant-group IDs must not award contextual points.'
);
for (const groupId of [
  'contextual',
  'widening_participation',
  'lincoln_care_leaver',
  'lincoln_mem2_q1',
  'lincoln_ucat_bursary',
  'lincolnshire_residence'
]) {
  assert.ok(
    !legacyContextualOnlyResult.applicant_group_ids.includes(groupId),
    `Legacy-only applicant must not retain activated Lincoln contextual group ${groupId}`
  );
}

const year13 = classifyInterviewBand(course, config, fixture.base_applicant);
const achieved = classifyInterviewBand(
  course,
  config,
  merge(fixture.base_applicant, {
    qualification_status: 'achieved',
    a_level_profile: {
      qualification_status: 'achieved',
      subjects: [
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' }
      ]
    }
  })
);

assert.strictEqual(year13.ranking.value, 46);
assert.strictEqual(achieved.ranking.value, 44);
assert.strictEqual(year13.canonical_interview_band, 'ambitious');
assert.strictEqual(year13.guidance_pool_id, 'model_a_provisional_official_score_guidance');
assert.strictEqual(achieved.canonical_interview_band, 'high_risk');
assert.strictEqual(achieved.guidance_pool_id, 'model_b_provisional_official_score_guidance');
assert.ok(year13.ranking.components.model_a_gcse_score.applicable !== false);
assert.strictEqual(achieved.ranking.components.model_a_gcse_score.applicable, false);
assert.strictEqual(
  achieved.ranking.components.model_b_ucat_cognitive_doubled_achieved_a_level.value,
  24
);
assert.strictEqual(
  achieved.ranking.components.model_b_sjt_doubled_achieved_a_level.value,
  20
);

const ucatPublishedRanges = [
  [2301, 2700, 15],
  [2170, 2290, 14],
  [2050, 2160, 12],
  [1970, 2040, 11],
  [1910, 1960, 10],
  [1860, 1900, 9],
  [1810, 1850, 7],
  [1750, 1800, 6],
  [1680, 1740, 4],
  [1580, 1670, 2],
  [0, 1579, 0]
];

for (const [min, max, points] of ucatPublishedRanges) {
  for (const totalScore of [min, max]) {
    const boundary = classifyInterviewBand(
      course,
      config,
      merge(fixture.base_applicant, {
        admissions_tests: {
          ucat: {
            total_score: totalScore,
            score_scale: 2700,
            sjt_band: 2,
            test_year: 2026
          }
        }
      })
    );
    assert.strictEqual(
      boundary.ranking.components.model_a_ucat_cognitive.value,
      points,
      `UCAT boundary ${totalScore} should score ${points}`
    );
    assert.notStrictEqual(
      boundary.canonical_interview_band,
      'insufficient_evidence',
      `UCAT boundary ${totalScore} should remain scoreable`
    );
  }
}

const ucatUnresolvedGaps = [
  [2291, 2300],
  [2161, 2169],
  [2041, 2049],
  [1961, 1969],
  [1901, 1909],
  [1851, 1859],
  [1801, 1809],
  [1741, 1749],
  [1671, 1679]
];

for (const [min, max] of ucatUnresolvedGaps) {
  for (let totalScore = min; totalScore <= max; totalScore += 1) {
    const gap = classifyInterviewBand(
      course,
      config,
      merge(fixture.base_applicant, {
        admissions_tests: {
          ucat: {
            total_score: totalScore,
            score_scale: 2700,
            sjt_band: 2,
            test_year: 2026
          }
        }
      })
    );
    assert.strictEqual(
      gap.ranking.status,
      'unavailable',
      `UCAT gap ${totalScore} should make the score unavailable`
    );
    assert.strictEqual(
      gap.ranking.components.model_a_ucat_cognitive.value,
      null,
      `UCAT gap ${totalScore} should not return a neighbouring band score`
    );
    assert.strictEqual(
      gap.ranking.components.model_a_ucat_cognitive.estimated_from_gap,
      false,
      `UCAT gap ${totalScore} should not use nearest-range estimation`
    );
    assert.strictEqual(
      gap.ranking.components.model_a_ucat_cognitive.reason,
      'range_lookup_unavailable',
      `UCAT gap ${totalScore} should expose a controlled component reason`
    );
    assert.strictEqual(
      gap.canonical_interview_band,
      'insufficient_evidence',
      `UCAT gap ${totalScore} should not be rounded into a provisional band`
    );
  }
}

console.log('Lincoln A100 readiness regression passed.');
