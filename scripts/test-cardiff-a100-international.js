#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  resolveUcatDecile
} = require('../assets/js/engine/ucat-decile-service');

const rootDir = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
);
const clone = (value) => JSON.parse(JSON.stringify(value));

const course = readJson('data/universities/cardiff-a100.json');
const config = readJson('data/interview-band-configs/cardiff-a100.json');
const research = readJson('data/research/cardiff-a100-research.json');
const resultCard = readJson('data/examples/cardiff-a100-result-card.example.json');
const internationalFixture = readJson(
  'data/regression-profiles/12_international_standard_applicant.json'
);
const homeFixture = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

const internationalSelection = course.stage_2_interview_selection.international_selection;
assert.strictEqual(internationalSelection.separate_ranking_pool_from_home, true);
assert.strictEqual(internationalSelection.ranking_basis, 'total_28_point_score_only');
assert.strictEqual(internationalSelection.maximum_shortlist_score, 28);
assert.strictEqual(internationalSelection.score_model.same_as_home_28_point_model, true);
assert.strictEqual(internationalSelection.ucat.score_input, 'cognitive_total_only');
assert.strictEqual(internationalSelection.sjt.considered, false);
assert.strictEqual(internationalSelection.tie_breaker.field, 'ucat.raw_total_score');
assert.strictEqual(
  internationalSelection.interview_shortlisting.personal_statement_used,
  false
);
assert.strictEqual(internationalSelection.interview_shortlisting.reference_used, false);
assert.strictEqual(internationalSelection.interview_shortlisting.work_experience_used, false);

const internationalPool = course.ranking_pools.find((pool) => pool.pool_id === 'overseas');
assert.ok(internationalPool);
assert.strictEqual(internationalPool.separate_from_home_ranking, true);
assert.strictEqual(internationalPool.maximum_shortlist_score, 28);
assert.strictEqual(internationalPool.places_available, 25);
assert.strictEqual(internationalPool.sjt_considered, false);

const internationalEvidence = research.international_selection_evidence;
assert.strictEqual(internationalEvidence.ranking_pool, 'separate_from_home');
assert.strictEqual(internationalEvidence.ranking_basis, 'total_28_point_score_only');
assert.strictEqual(internationalEvidence.maximum_shortlist_score, 28);
assert.strictEqual(internationalEvidence.sjt.considered, false);
assert.strictEqual(internationalEvidence.tie_breaker.field, 'ucat.raw_total_score');

const officialCardiffDecileRows =
  course.stage_2_interview_selection.calculation.ucat_decile_points.points;

assert.deepStrictEqual(
  officialCardiffDecileRows.map((row) => ({
    deciles: row.deciles,
    points: row.points
  })),
  [
    { deciles: [9, 8, 7], points: 3 },
    { deciles: [6, 5, 4], points: 2 },
    { deciles: [3, 2, 1], points: 1 }
  ]
);

const cardiffUcatComponent = config.score_model.components.find(
  (component) => component.component_id === 'ucat_decile_score'
);

assert.ok(cardiffUcatComponent);

const cardiffDecileTranslationCases = [
  [1940, 6, 2],
  [1950, 7, 2],
  [2000, 7, 2],
  [2010, 8, 3]
];

for (const [rawUcat, expectedDerivedGroup, expectedCardiffPoints] of
  cardiffDecileTranslationCases) {
  const lookup = resolveUcatDecile(rawUcat, {
    courseProfileId: course.profile_id
  });

  assert.strictEqual(lookup.available, true, `UCAT ${rawUcat}: lookup`);
  assert.strictEqual(
    lookup.national_decile,
    expectedDerivedGroup,
    `UCAT ${rawUcat}: ApplySmart derived group`
  );
  assert.strictEqual(
    cardiffUcatComponent.points_by_decile[String(lookup.national_decile)],
    expectedCardiffPoints,
    `UCAT ${rawUcat}: Cardiff points`
  );
}

const boundaryCases = [
  [2049, 'high_risk'],
  [2050, 'ambitious'],
  [2079, 'ambitious'],
  [2080, 'realistic'],
  [2100, 'realistic'],
  [2101, 'interview_likely']
];

for (const [ucatTotal, expectedBand] of boundaryCases) {
  const applicant = clone(internationalFixture);
  applicant.admissions_tests.ucat.total_score = ucatTotal;
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.guidance_pool_id, 'international');
  assert.strictEqual(result.canonical_interview_band, expectedBand);
  assert.strictEqual(result.ranking.value, 27);
  assert.strictEqual(result.ranking.max, 28);
  assert.deepStrictEqual(result.band_metric, {
    metric: 'ucat_total',
    value: ucatTotal,
    scale: {
      min: 0,
      max: 2700
    }
  });
}

const internationalBand1 = clone(internationalFixture);
internationalBand1.admissions_tests.ucat.sjt_band = 1;
const internationalBand4 = clone(internationalFixture);
internationalBand4.admissions_tests.ucat.sjt_band = 4;
const band1Result = classifyInterviewBand(course, config, internationalBand1);
const band4Result = classifyInterviewBand(course, config, internationalBand4);
assert.strictEqual(band1Result.eligibility.status, 'eligible');
assert.strictEqual(band4Result.eligibility.status, 'eligible');
assert.strictEqual(band1Result.ranking.value, band4Result.ranking.value);
assert.strictEqual(band1Result.canonical_interview_band, band4Result.canonical_interview_band);

const homeResult = classifyInterviewBand(course, config, homeFixture);
assert.strictEqual(homeResult.guidance_pool_id, 'home_non_contextual');
assert.strictEqual(homeResult.ranking.value, 19);
assert.strictEqual(homeResult.ranking.max, 28);
assert.strictEqual(homeResult.canonical_interview_band, 'high_risk');

assert.deepStrictEqual(
  resultCard.applicant_context.applies_to_group_ids,
  ['international_fee', 'school_leaver']
);
assert.strictEqual(resultCard.prediction.guidance_pool_id, 'international');
assert.strictEqual(resultCard.prediction.recommendation, 'Strong choice');
assert.strictEqual(resultCard.stage_2.sjt.used_in_scoring, false);
assert.strictEqual(resultCard.stage_2.sjt.used_as_gate_or_filter, false);
assert.strictEqual(resultCard.stage_2.sjt.used_as_tie_breaker, false);

console.log(
  `Cardiff A100 international regression: PASS ` +
  `(${boundaryCases.length} historical-guidance boundaries, SJT ignored, ` +
  `28-point ranking and Home invariant)`
);
