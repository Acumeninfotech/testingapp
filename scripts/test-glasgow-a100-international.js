#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
);
const clone = (value) => JSON.parse(JSON.stringify(value));

const course = readJson('data/universities/glasgow-a100.json');
const config = readJson('data/interview-band-configs/glasgow-a100.json');
const research = readJson('data/research/glasgow-a100-research.json');
const resultCard = readJson('data/examples/glasgow-a100-result-card.example.json');
const fixture = readJson('data/fixtures/glasgow-a100-international.json');
const internationalApplicant = readJson(fixture.base_applicant_file);
const homeApplicant = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

const RECOMMENDATION_BY_BAND = {
  interview_likely: 'Strong choice',
  realistic: 'Good chance – recommend applying',
  ambitious: 'Possible but ambitious',
  high_risk: 'Consider stronger alternatives'
};

const selection = course.stage_2_interview_selection.international_selection;
assert.deepStrictEqual(selection.applies_to_group_ids, ['international_fee']);
assert.strictEqual(selection.ranking_pool, 'international_ucat_ranking_pool');
assert.strictEqual(selection.separate_from_home_scottish_and_rest_of_uk, true);
assert.strictEqual(selection.competes_only_with_international_applicants, true);
assert.deepStrictEqual(selection.official_ranking_groups, [
  'scottish',
  'rest_of_uk',
  'international'
]);
assert.strictEqual(selection.each_group_has_own_threshold_and_interview_quota, true);
assert.strictEqual(selection.contextual_uplift_applies, false);
assert.strictEqual(selection.ucat.score_input, 'cognitive_total_only');
assert.deepStrictEqual(selection.ucat.counted_sections, [
  'verbal_reasoning',
  'decision_making',
  'quantitative_reasoning'
]);
assert.strictEqual(selection.ucat.sjt_used, false);
assert.strictEqual(selection.ucat.pre_published_fixed_threshold, false);
assert.strictEqual(selection.ucat.fixed_threshold, null);
assert.strictEqual(
  selection.ucat.threshold_setting,
  'set_after_all_ucat_scores_are_received_each_cycle'
);

const internationalPool = course.ranking_pools.find((pool) => {
  return pool.pool_id === 'international_ucat_ranking_pool';
});
assert.ok(internationalPool);
assert.strictEqual(internationalPool.separate_from_home_scottish_and_rest_of_uk, true);
assert.strictEqual(internationalPool.competes_only_with_international_applicants, true);
assert.strictEqual(internationalPool.contextual_uplift_applies, false);
assert.strictEqual(internationalPool.sjt_used, false);
assert.strictEqual(internationalPool.fixed_ucat_cutoff, null);
assert.deepStrictEqual(internationalPool.historical_annual_places, {
  approximate_min: 20,
  approximate_max: 25
});
assert.deepStrictEqual(internationalPool.historical_annual_applications, {
  approximate_min: 950,
  approximate_max: 1000
});

const evidence = research.international_selection_evidence;
assert.strictEqual(evidence.ranking_pool, 'separate_international_pool');
assert.strictEqual(evidence.competes_only_with_international_applicants, true);
assert.strictEqual(evidence.contextual_uplift_applies, false);
assert.strictEqual(evidence.ucat_policy.score_input, 'cognitive_total_only');
assert.strictEqual(evidence.ucat_policy.sjt_used, false);
assert.strictEqual(evidence.ucat_policy.pre_published_fixed_threshold, false);
assert.strictEqual(evidence.ucat_policy.fixed_threshold, null);
assert.deepStrictEqual(
  evidence.historical_lowest_invited_by_cycle_2700.map((cycle) => [
    cycle.cycle,
    cycle.legacy_score_3600,
    cycle.converted_score_2700
  ]),
  [
    ['2021/22', 2700, 2025],
    ['2022/23', 2900, 2175],
    ['2023/24', 2700, 2025],
    ['2024/25', 2800, 2100]
  ]
);
assert.deepStrictEqual(
  evidence.full_historical_invited_scores_2700.map((cycle) => [
    cycle.year,
    cycle.lowest_invited,
    cycle.average_invited_approximate
  ]),
  [
    [2021, 2025, 2120],
    [2022, 2175, 2220],
    [2023, 2025, 2150],
    [2024, 2100, 2180],
    [2025, 2050, 2160]
  ]
);
assert.deepStrictEqual(evidence.estimate_2026_27, {
  min: 2050,
  max: 2100,
  guidance_only: true
});
assert.deepStrictEqual(
  course.historical_admissions.cycles
    .filter((cycle) => cycle.applicant_group_id === 'international_and_eu')
    .map((cycle) => [
      cycle.entry_year,
      cycle.historical_interview_threshold,
      cycle.converted_historical_interview_threshold_2700
    ]),
  [
    [2025, 2800, 2100],
    [2024, 2700, 2025],
    [2023, 2900, 2175],
    [2022, 2700, 2025]
  ]
);
assert.deepStrictEqual(
  research.historical_ucat_data
    .filter((cycle) => cycle.applicant_group_id === 'international_eu')
    .map((cycle) => [
      cycle.entry_year,
      cycle.historical_interview_threshold,
      cycle.converted_historical_interview_threshold_2700
    ]),
  [
    [2025, 2800, 2100],
    [2024, 2700, 2025],
    [2023, 2900, 2175],
    [2022, 2700, 2025]
  ]
);

for (const testCase of fixture.cases) {
  const applicant = clone(internationalApplicant);
  applicant.admissions_tests.ucat.total_score = testCase.ucat_total;
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.guidance_pool_id, 'international');
  assert.strictEqual(result.canonical_interview_band, testCase.expected_band);
  assert.strictEqual(
    RECOMMENDATION_BY_BAND[result.canonical_interview_band],
    testCase.expected_recommendation
  );
  assert.deepStrictEqual(result.band_metric, {
    metric: 'ucat_total',
    value: testCase.ucat_total,
    scale: {
      min: 0,
      max: 2700
    }
  });
}

const sjtApplicant = clone(internationalApplicant);
sjtApplicant.admissions_tests.ucat.total_score = fixture.sjt_ignored_case.ucat_total;
sjtApplicant.admissions_tests.ucat.sjt_band = fixture.sjt_ignored_case.sjt_band;
const sjtResult = classifyInterviewBand(course, config, sjtApplicant);
assert.strictEqual(sjtResult.eligibility.status, 'eligible');
assert.strictEqual(
  sjtResult.canonical_interview_band,
  fixture.sjt_ignored_case.expected_band
);

const homePool = config.guidance_pools.find((pool) => {
  return pool.pool_id === 'home_rest_of_uk_school_leaver';
});
assert.deepStrictEqual(homePool, {
  pool_id: 'home_rest_of_uk_school_leaver',
  priority: 10,
  applicant_match: {
    all_group_ids: ['home_fee', 'rest_of_uk', 'school_leaver']
  },
  metric: 'ucat_total',
  band_rules: [
    {
      band: 'interview_likely',
      operator: 'greater_than_or_equal',
      value: 2100
    },
    {
      band: 'realistic',
      operator: 'between_inclusive',
      min: 1950,
      max: 2099
    },
    {
      band: 'ambitious',
      operator: 'between_inclusive',
      min: 1800,
      max: 1949
    },
    {
      band: 'high_risk',
      operator: 'less_than',
      value: 1800
    }
  ]
});
const homeResult = classifyInterviewBand(course, config, homeApplicant);
assert.strictEqual(homeResult.guidance_pool_id, 'home_rest_of_uk_school_leaver');
assert.strictEqual(homeResult.canonical_interview_band, 'realistic');

assert.deepStrictEqual(
  resultCard.applicant_context.applies_to_group_ids,
  ['international_fee', 'school_leaver']
);
assert.strictEqual(resultCard.prediction.guidance_pool_id, 'international');
assert.strictEqual(resultCard.prediction.result_band, 'realistic');
assert.strictEqual(
  resultCard.prediction.recommendation,
  'Good chance – recommend applying'
);
assert.match(resultCard.prediction.band_basis, /ranks international applicants separately/i);
assert.match(resultCard.prediction.band_basis, /historical international invited scores/i);
assert.match(resultCard.prediction.band_basis, /not a fixed Glasgow UCAT cut-off/i);
assert.match(
  resultCard.historical_context.international_historical_guidance_2700.disclaimer,
  /not a fixed UCAT cut-off/i
);

const cardApplicant = clone(internationalApplicant);
cardApplicant.admissions_tests.ucat.total_score = 2075;
cardApplicant.admissions_tests.ucat.sjt_band = 4;
const cardResult = classifyInterviewBand(course, config, cardApplicant);
assert.strictEqual(cardResult.ranking.value, resultCard.prediction.score);
assert.strictEqual(cardResult.ranking.max, resultCard.prediction.score_scale.max);
assert.strictEqual(cardResult.canonical_interview_band, resultCard.prediction.result_band);

console.log(
  `Glasgow A100 international regression: PASS ` +
  `(${fixture.cases.length} historical-guidance boundaries, separate international ` +
  `ranking, cognitive-only UCAT, SJT ignored, no contextual uplift, Home invariant ` +
  `and result card)`
);
