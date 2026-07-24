#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');

const rootDir = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
);
const clone = (value) => JSON.parse(JSON.stringify(value));

const course = readJson('data/universities/aberdeen-a100.json');
const config = readJson('data/interview-band-configs/aberdeen-a100.json');
const research = readJson('data/research/aberdeen-a100-research.json');
const resultCard = readJson('data/examples/aberdeen-a100-result-card.example.json');
const internationalFixture = readJson(
  'data/regression-profiles/12_international_standard_applicant.json'
);
const homeFixture = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

const internationalPool = course.ranking_pools.find((pool) => {
  return pool.pool_id === 'international';
});
assert.ok(internationalPool);
assert.deepStrictEqual(internationalPool.applies_to_group_ids, ['international_fee']);
assert.strictEqual(internationalPool.ranking_model, 'academic_plus_ucat_weighting');
assert.strictEqual(internationalPool.maximum_shortlist_score, 50);
assert.strictEqual(internationalPool.places_available, 19);

const internationalSelection = research.international_selection_evidence;
assert.strictEqual(internationalSelection.ranking_pool, 'separate');
assert.strictEqual(internationalSelection.academic_weight_percent, 30);
assert.strictEqual(internationalSelection.ucat_weight_percent, 20);
assert.strictEqual(internationalSelection.maximum_shortlist_score, 50);
assert.strictEqual(internationalSelection.ucat_score_input, 'cognitive_total_only');
assert.deepStrictEqual(internationalSelection.sjt.accepted_bands, [1, 2, 3]);
assert.strictEqual(
  internationalSelection.sjt.band_4_outcome,
  'not_eligible_for_interview'
);

const boundaries = [
  [1799, 'high_risk'],
  [1800, 'ambitious'],
  [1949, 'ambitious'],
  [1950, 'realistic'],
  [2099, 'realistic'],
  [2100, 'interview_likely']
];

for (const [score, expectedBand] of boundaries) {
  const applicant = clone(internationalFixture);
  applicant.admissions_tests.ucat.total_score = score;
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.guidance_pool_id, 'international');
  assert.strictEqual(result.canonical_interview_band, expectedBand);
}

for (const sjtBand of [1, 2, 3]) {
  const applicant = clone(internationalFixture);
  applicant.admissions_tests.ucat.sjt_band = sjtBand;
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.ok(!result.eligibility.failures.includes('disqualifying_sjt_rule'));
}

const internationalBand4 = clone(internationalFixture);
internationalBand4.admissions_tests.ucat.sjt_band = 4;
const internationalBand4Result = classifyInterviewBand(
  course,
  config,
  internationalBand4
);
assert.strictEqual(internationalBand4Result.eligibility.status, 'not_eligible');
assert.strictEqual(internationalBand4Result.canonical_interview_band, 'not_eligible');
assert.ok(
  internationalBand4Result.eligibility.failures.includes('disqualifying_sjt_rule')
);
const internationalBand4Eligibility = evaluateCourseEligibility(
  course,
  internationalBand4
);
assert.strictEqual(internationalBand4Eligibility.status, 'not_eligible');
assert.ok(internationalBand4Eligibility.failures.includes('sjt_band_excluded'));

const homeBand4 = clone(homeFixture);
homeBand4.admissions_tests.ucat.sjt_band = 4;
const homeBand4Result = classifyInterviewBand(course, config, homeBand4);
assert.strictEqual(homeBand4Result.eligibility.status, 'eligible');
assert.ok(!homeBand4Result.eligibility.failures.includes('disqualifying_sjt_rule'));
assert.strictEqual(
  homeBand4Result.guidance_pool_id,
  'home_rest_of_uk_school_leaver'
);

assert.deepStrictEqual(
  resultCard.applicant_context.applies_to_group_ids,
  ['international_fee']
);
assert.strictEqual(resultCard.prediction.guidance_pool_id, 'international');
assert.strictEqual(resultCard.prediction.result_band, 'realistic');
assert.strictEqual(
  resultCard.prediction.recommendation,
  'Good chance – recommend applying'
);

console.log(
  `Aberdeen A100 international regression: PASS ` +
  `(${boundaries.length} UCAT boundaries, SJT Bands 1–4, Home SJT invariant and result card)`
);
