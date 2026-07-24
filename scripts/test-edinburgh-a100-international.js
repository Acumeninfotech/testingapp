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

const course = readJson('data/universities/edinburgh-a100.json');
const config = readJson('data/interview-band-configs/edinburgh-a100.json');
const research = readJson('data/research/edinburgh-a100-research.json');
const resultCard = readJson('data/examples/edinburgh-a100-result-card.example.json');
const fixture = readJson('data/fixtures/edinburgh-a100-international.json');
const internationalApplicant = readJson(fixture.base_applicant_file);
const homeApplicant = readJson(
  'data/regression-profiles/02_average_competitive_applicant.json'
);

const RECOMMENDATION_BY_BAND = {
  not_eligible: 'Not eligible / automatic rejection due to minimum UCAT threshold',
  interview_likely: 'Strong choice',
  realistic: 'Good chance – recommend applying',
  ambitious: 'Possible but ambitious',
  high_risk: 'Consider stronger alternatives'
};

function historicalGuidance(ucatTotal, sjtBand = 2) {
  const model = course.stage_2_interview_selection.international_selection;

  if (sjtBand === 4 && model.sjt.band_4_automatic_rejection) {
    return {
      band: 'not_eligible',
      reason: 'sjt_band_4_automatic_rejection'
    };
  }

  if (ucatTotal < model.ucat.minimum_total_2026) {
    return {
      band: 'not_eligible',
      reason: 'international_ucat_2026_minimum_not_met'
    };
  }

  const pool = config.guidance_pools.find((entry) => entry.pool_id === 'international');
  const rule = pool.band_rules.find((entry) => {
    if (entry.operator === 'greater_than_or_equal') return ucatTotal >= entry.value;
    if (entry.operator === 'between_inclusive') {
      return ucatTotal >= entry.min && ucatTotal <= entry.max;
    }
    return false;
  });

  return {
    band: rule?.band || 'insufficient_evidence',
    reason: null
  };
}

const selection = course.stage_2_interview_selection.international_selection;
assert.deepStrictEqual(selection.applies_to_group_ids, ['international_fee']);
assert.strictEqual(selection.separate_from_uk_applicant_pools, true);
assert.strictEqual(selection.pre_interview_score.scale.max, 40);
assert.deepStrictEqual(
  selection.pre_interview_score.components.map((component) => [
    component.max_points,
    component.final_weight_percent
  ]),
  [
    [20, 25],
    [14, 17.5],
    [6, 7.5]
  ]
);
assert.strictEqual(selection.ucat.ranking_basis, 'international_cohort_deciles');
assert.strictEqual(selection.ucat.decile_10_points, 14);
assert.strictEqual(selection.ucat.decile_1_points, 1.4);
assert.strictEqual(selection.ucat.minimum_total_2026, 1650);
assert.strictEqual(selection.ucat.minimum_threshold_changes_annually, true);
assert.strictEqual(selection.ucat.fixed_published_interview_cutoff, false);
assert.strictEqual(selection.sjt.band_4_automatic_rejection, true);
assert.deepStrictEqual(selection.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(selection.sjt.points_by_band, {
  1: 6,
  2: 4.5,
  3: 3,
  4: 0
});
assert.strictEqual(selection.sjt.exact_points_evidence_classification, 'foi_verified');
assert.strictEqual(selection.minimum_requirements_guarantee_interview, false);

assert.strictEqual(selection.academic_score.hard_cap, 20);
assert.strictEqual(selection.academic_score.entry_requirements_used_in_scoring, false);
assert.strictEqual(selection.academic_score.ib.overall_ib_performance_component.max, 6);
assert.strictEqual(selection.academic_score.ib.higher_level_subject_combination_component.max, 14);
assert.strictEqual(selection.academic_score.ib.component_total_max, 20);
assert.strictEqual(selection.academic_score.ib.final_score_already_doubled, true);
assert.strictEqual(selection.academic_score.ib.post_total_multiplier, 1);
assert.strictEqual(selection.academic_score.ib.entry_requirements_used_in_scoring, false);
assert.strictEqual(selection.academic_score.a_level.scoring_basis, 'identical_to_uk_applicants');
assert.strictEqual(selection.academic_score.a_level.total_with_gcse_equivalent_max_points, 20);

const internationalPool = course.ranking_pools.find((pool) => {
  return pool.pool_id === 'overseas_international_fee_rate';
});
assert.ok(internationalPool);
assert.strictEqual(internationalPool.separate_from_uk_applicant_pools, true);
assert.strictEqual(internationalPool.pre_interview_score_max, 40);
assert.deepStrictEqual(internationalPool.annual_interview_invites, {
  approximate_min: 80,
  approximate_max: 100
});
assert.deepStrictEqual(internationalPool.annual_places, {
  approximate_min: 20,
  approximate_max: 25
});
assert.strictEqual(internationalPool.fixed_published_interview_cutoff, false);

const internationalOffer = course.offer_selection.international_offer_selection;
assert.strictEqual(internationalOffer.pre_interview_score.scale.max, 40);
assert.strictEqual(internationalOffer.pre_interview_score.final_weight_percent, 50);
assert.strictEqual(internationalOffer.assessment_day_score.scale.max, 40);
assert.strictEqual(internationalOffer.assessment_day_score.final_weight_percent, 50);
assert.strictEqual(internationalOffer.final_total.scale.max, 80);

const evidence = research.international_selection_evidence;
assert.strictEqual(evidence.ranking_pool, 'separate_international_pool');
assert.strictEqual(evidence.pre_interview_score.scale.max, 40);
assert.strictEqual(evidence.assessment_day.scale.max, 40);
assert.strictEqual(evidence.final_total.scale.max, 80);
assert.strictEqual(evidence.ucat_policy.fixed_published_interview_cutoff, false);
assert.strictEqual(evidence.sjt_policy.band_4_automatic_rejection, true);
assert.deepStrictEqual(evidence.sjt_policy.points_by_band, {
  1: 6,
  2: 4.5,
  3: 3,
  4: 0
});
assert.strictEqual(evidence.sjt_policy.exact_points_evidence_classification, 'foi_verified');
assert.strictEqual(evidence.academic_scoring.hard_cap, 20);
assert.strictEqual(evidence.academic_scoring.ib.component_total_max, 20);
assert.strictEqual(evidence.academic_scoring.ib.post_total_multiplier, 1);

for (const testCase of fixture.cases) {
  const guidance = historicalGuidance(testCase.ucat_total);
  assert.strictEqual(guidance.band, testCase.expected_band);
  assert.strictEqual(
    RECOMMENDATION_BY_BAND[guidance.band],
    testCase.expected_recommendation
  );

  if (testCase.ucat_total >= 1950) {
    const applicant = clone(internationalApplicant);
    applicant.admissions_tests.ucat.total_score = testCase.ucat_total;
    const result = classifyInterviewBand(course, config, applicant);
    assert.strictEqual(result.eligibility.status, 'eligible');
    assert.strictEqual(result.guidance_pool_id, 'international');
    assert.strictEqual(result.canonical_interview_band, testCase.expected_band);
  }
}

for (const testCase of fixture.automatic_rejection_cases) {
  const guidance = historicalGuidance(testCase.ucat_total, testCase.sjt_band);
  assert.strictEqual(guidance.band, testCase.expected_band);
  assert.strictEqual(guidance.reason, testCase.expected_reason);

  const applicant = clone(internationalApplicant);
  applicant.admissions_tests.ucat.total_score = testCase.ucat_total;
  applicant.admissions_tests.ucat.sjt_band = testCase.sjt_band;
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(result.eligibility.status, 'not_eligible');
  assert.ok(result.eligibility.failures.includes('disqualifying_sjt_rule'));
  assert.strictEqual(result.canonical_interview_band, 'not_eligible');
}

const homeResult = classifyInterviewBand(course, config, homeApplicant);
assert.strictEqual(homeResult.eligibility.status, 'eligible');
assert.strictEqual(homeResult.guidance_pool_id, 'home_rest_of_uk_school_leaver');
assert.strictEqual(homeResult.canonical_interview_band, 'realistic');
assert.strictEqual(homeResult.ranking.value, 27.1);
assert.strictEqual(homeResult.ranking.max, 40);

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
assert.match(resultCard.prediction.band_basis, /not a fixed Edinburgh interview cut-off/i);
assert.match(resultCard.prediction.band_basis, /total pre-interview score/i);
assert.match(resultCard.prediction.band_basis, /not UCAT alone/i);

console.log(
  `Edinburgh A100 international regression: PASS ` +
  `(${fixture.cases.length} historical-guidance boundaries, SJT Band 4 rejection, ` +
  `verified 40+40 scoring, separate ranking, Home invariant and result card)`
);
