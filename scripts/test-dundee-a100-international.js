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

const course = readJson('data/universities/dundee-a100.json');
const config = readJson('data/interview-band-configs/dundee-a100.json');
const research = readJson('data/research/dundee-a100-research.json');
const resultCard = readJson('data/examples/dundee-a100-result-card.example.json');
const fixture = readJson('data/fixtures/dundee-a100-international.json');
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

const internationalSelection = course.stage_2_interview_selection.international_selection;
assert.deepStrictEqual(internationalSelection.applies_to_group_ids, ['international_fee']);
assert.strictEqual(internationalSelection.separate_ranking_pool_from_home, true);
assert.strictEqual(internationalSelection.pre_interview_score.academic_weight_percent, 60);
assert.strictEqual(internationalSelection.pre_interview_score.ucat_weight_percent, 40);
assert.strictEqual(internationalSelection.ucat.ranking_basis, 'national_decile_rank');
assert.strictEqual(internationalSelection.ucat.score_input, 'cognitive_total_only');
assert.strictEqual(internationalSelection.ucat.has_fixed_cutoff, false);
assert.strictEqual(internationalSelection.ucat.fixed_cutoff, null);
assert.strictEqual(
  internationalSelection.personal_statement.used_for_shortlisting,
  false
);
assert.strictEqual(
  internationalSelection.personal_statement.may_be_referenced_during_interview,
  true
);

const internationalPool = course.ranking_pools.find((pool) => {
  return pool.pool_id === 'international';
});
assert.ok(internationalPool);
assert.strictEqual(internationalPool.separate_from_home_ranking, true);
assert.strictEqual(internationalPool.ranking_model, 'academic_plus_ucat_weighting');
assert.strictEqual(internationalPool.places_available, 31);
assert.strictEqual(internationalPool.fixed_ucat_cutoff, null);

const internationalEvidence = research.international_selection_evidence;
assert.strictEqual(internationalEvidence.ranking_pool, 'separate_from_home');
assert.strictEqual(internationalEvidence.pre_interview_score.academic_weight_percent, 60);
assert.strictEqual(internationalEvidence.pre_interview_score.ucat_weight_percent, 40);
assert.strictEqual(internationalEvidence.ucat.conversion_method, 'national_decile_rank');
assert.strictEqual(internationalEvidence.ucat.score_input, 'cognitive_total_only');
assert.strictEqual(internationalEvidence.ucat.has_fixed_cutoff, false);
assert.deepStrictEqual(internationalEvidence.competitiveness_benchmarks, {
  minimum_competitive: 1950,
  strong: 2100,
  very_strong: 2200,
  historical_average: 2018,
  highest_recorded: 2310
});
assert.deepStrictEqual(
  internationalEvidence.historical_ucat_2700.map((cycle) => [
    cycle.entry_year,
    cycle.lowest_invited,
    cycle.average_invited,
    cycle.average_offer_holders
  ]),
  [
    ['2023/24', 1950, 2020, 2050],
    ['2024/25', 1950, 2025, 2055],
    ['2025/26', 2000, 2050, 2080]
  ]
);
assert.strictEqual(internationalEvidence.interview_format.group_discussion.applicants, 6);
assert.strictEqual(
  internationalEvidence.interview_format.group_discussion.duration_minutes,
  30
);
assert.strictEqual(
  internationalEvidence.post_interview_offer_rule.pre_interview_scores_reset,
  true
);
assert.strictEqual(
  internationalEvidence.post_interview_offer_rule.interview_score_weight_percent,
  100
);
assert.strictEqual(
  internationalEvidence.post_interview_offer_rule.international_places,
  31
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

const homeResult = classifyInterviewBand(course, config, homeApplicant);
assert.strictEqual(homeResult.eligibility.status, 'eligible');
assert.strictEqual(homeResult.guidance_pool_id, 'home_rest_of_uk_school_leaver');
assert.strictEqual(homeResult.canonical_interview_band, 'realistic');
assert.strictEqual(homeResult.ranking.value, 76);
assert.strictEqual(homeResult.ranking.max, 100);

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
assert.match(resultCard.prediction.band_basis, /historical/i);
assert.match(resultCard.prediction.band_basis, /not a fixed Dundee cut-off/i);
assert.match(
  resultCard.historical_context.international_historical_guidance_2700.disclaimer,
  /not a fixed international UCAT threshold/i
);
const cardApplicant = clone(internationalApplicant);
cardApplicant.admissions_tests.ucat.total_score = 2080;
const cardResult = classifyInterviewBand(course, config, cardApplicant);
assert.strictEqual(cardResult.ranking.value, resultCard.prediction.score);
assert.strictEqual(cardResult.ranking.max, resultCard.prediction.score_scale.max);
assert.strictEqual(cardResult.canonical_interview_band, resultCard.prediction.result_band);

console.log(
  `Dundee A100 international regression: PASS ` +
  `(${fixture.cases.length} historical-guidance boundaries, verified selection, ` +
  `interview/offer evidence, Home invariant and result card)`
);
