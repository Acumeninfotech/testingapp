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

const course = readJson('data/universities/st-andrews-a100.json');
const research = readJson('data/research/st-andrews-a100-research.json');
const config = readJson('data/interview-band-configs/st-andrews-a100.json');
const card = readJson('data/examples/st-andrews-a100-result-card.example.json');
const fixture = readJson('data/fixtures/st-andrews-a100-international-contextual.json');
const sourceFixture = readJson(fixture.base_applicant_file);
const baseApplicant = sourceFixture[fixture.base_applicant_property];

const RECOMMENDATION_BY_BAND = {
  interview_likely: 'Strong choice',
  realistic: 'Good chance – recommend applying',
  ambitious: 'Possible but ambitious',
  high_risk: 'Consider stronger alternatives'
};

function internationalApplicant(ucatTotal) {
  const applicant = clone(baseApplicant);
  applicant.profile_id = 'st_andrews_a100_international_fixture';
  applicant.applicant_identity.fee_status = 'International';
  applicant.applicant_identity.domicile = 'International';
  applicant.applicant_identity.applicant_type = 'international_standard_school_leaver';
  applicant.admissions_tests.ucat.total_score = ucatTotal;
  return applicant;
}

function contextualApplicant(ucatTotal) {
  const applicant = clone(baseApplicant);
  applicant.profile_id = 'st_andrews_a100_contextual_fixture';
  applicant.applicant_identity.domicile = 'Scotland';
  applicant.applicant_identity.contextual = false;
  applicant.applicant_identity.widening_participation = false;
  applicant.applicant_identity.contextual_flags = {};
  applicant.contextual_profile = {
    home_area_region: {
      simd_quintile: 'q2',
      imd_quintile: 'q5'
    },
    school_education: {
      low_progression_to_higher_education_school: 'no'
    },
    personal_circumstances: {
      care_experienced: 'no',
      care_over_three_months: 'no',
      looked_after: 'no',
      young_or_adult_carer: 'no',
      young_carer: 'no',
      carer: 'no',
      unpaid_carer: 'no',
      estranged_from_family: 'no',
      estranged: 'no',
      refugee: 'no',
      uk_refugee_status_granted: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      other_programmes: []
    }
  };
  applicant.admissions_tests.ucat.total_score = ucatTotal;
  return applicant;
}

const selection = course.stage_2_interview_selection.international_selection;
assert.deepStrictEqual(selection.applies_to_group_ids, ['international_fee']);
assert.strictEqual(selection.model, 'hurdle_then_rank');
assert.deepStrictEqual(selection.mandatory_hurdles, [
  'academic_requirements',
  'reference_requirements',
  'required_work_experience'
]);
assert.strictEqual(selection.hurdles_are_pass_fail_only, true);
assert.strictEqual(selection.ranking_metric, 'ucat_global_score');
assert.strictEqual(selection.weighted_formula_used, false);
assert.strictEqual(selection.fixed_published_ucat_cutoff, null);
assert.strictEqual(selection.fee_status_management.separate_international_ranking_pool_explicitly_published, false);

const internationalEvidence = research.verified_international_and_contextual_evidence.international;
assert.deepStrictEqual(
  internationalEvidence.historical_lowest_invited_2700.map((record) => [
    record.entry_cycle,
    record.score
  ]),
  [
    ['2021/22', 1913],
    ['2022/23', 1920],
    ['2023/24', 1958],
    ['2024/25', 1665],
    ['2025/26', 1995]
  ]
);
assert.strictEqual(internationalEvidence.ucat_policy.fixed_published_cutoff, null);
assert.strictEqual(internationalEvidence.interview.station_count, 4);
assert.strictEqual(internationalEvidence.interview.minutes_per_station_approximate, 6);
assert.strictEqual(internationalEvidence.interview.published_score_threshold, null);
assert.strictEqual(internationalEvidence.post_interview.offer_ranking_basis, 'mmi_score_only');
assert.strictEqual(internationalEvidence.post_interview.tie_break, 'higher_ucat_global_score');

for (const testCase of fixture.international_guidance_cases) {
  const result = classifyInterviewBand(
    course,
    config,
    internationalApplicant(testCase.ucat_total)
  );
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.guidance_pool_id, 'international_historical_guidance');
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

const tieCase = fixture.post_interview_tie_break_case;
const rankedTie = [...tieCase.candidates].sort((left, right) => {
  return right.ucat_total - left.ucat_total;
});
assert.strictEqual(rankedTie[0].candidate_id, tieCase.expected_first);
assert.strictEqual(course.offer_selection.international_offer_model.primary_basis, 'mmi_score_only');
assert.strictEqual(
  course.offer_selection.international_offer_model.tie_breaker,
  'higher_ucat_global_score'
);

const contextualPolicy = research
  .verified_international_and_contextual_evidence
  .contextual_widening_participation;
const contextualCase = fixture.contextual_ranking_case;
const contextual = contextualApplicant(contextualCase.raw_ucat_total);
const officialUcatBeforeAdjustment = contextual.admissions_tests.ucat.total_score;
const adjustedRankingScore = officialUcatBeforeAdjustment * contextualPolicy.multiplier;
assert.strictEqual(contextualPolicy.ucat_adjustment_percent, 10);
assert.strictEqual(contextualPolicy.applied_to, 'interview_ranking_score_only');
assert.strictEqual(adjustedRankingScore, contextualCase.expected_adjusted_ranking_score);
assert.strictEqual(contextual.admissions_tests.ucat.total_score, officialUcatBeforeAdjustment);
assert.deepStrictEqual(contextualPolicy.not_applied_to, [
  'academic_eligibility',
  'official_ucat_result',
  'interview_score',
  'offer_ranking'
]);

const contextualResult = classifyInterviewBand(course, config, contextual);
assert.strictEqual(contextualResult.guidance_pool_id, contextualCase.expected_guidance_pool_id);
assert.strictEqual(contextualResult.canonical_interview_band, contextualCase.expected_band);
assert.strictEqual(contextualResult.ranking.raw_value, contextualCase.raw_ucat_total);
assert.strictEqual(contextualResult.ranking.value, contextualCase.expected_adjusted_ranking_score);
assert.strictEqual(contextualResult.ranking.total_uplift_percent, contextualPolicy.ucat_adjustment_percent);
assert.deepStrictEqual(course.ranking_pools, []);
assert.strictEqual(course.contextual_admissions.ranking_pool.separately_published_contextual_pool, false);
assert.strictEqual(
  course.contextual_admissions.ranking_pool.implementation,
  'apply_adjusted_ucat_within_existing_ranking_process'
);
assert.strictEqual(
  course.contextual_admissions.interview_threshold.separate_contextual_threshold_published,
  false
);
assert.strictEqual(course.contextual_admissions.interview_threshold.value, null);
assert.deepStrictEqual(course.contextual_admissions.verified_missing_evidence, [
  'contextual_interview_ucat_threshold',
  'contextual_interview_stage_historical_data',
  'officially_published_contextual_ranking_pool'
]);

assert.deepStrictEqual(
  card.applicant_context.applies_to_group_ids,
  ['international_fee', 'school_leaver']
);
assert.strictEqual(card.prediction.guidance_pool_id, 'international_historical_guidance');
assert.match(card.prediction.band_basis, /historical international competitiveness/i);
assert.match(card.prediction.band_basis, /not (?:an )?official .*cut-?off/i);
assert.strictEqual(card.contextual_applicant_example.adjusted_ucat_for_interview_ranking, 2090);
assert.strictEqual(
  contextualResult.guidance_pool_id,
  card.contextual_applicant_example.guidance_pool_id
);
assert.strictEqual(
  contextualResult.canonical_interview_band,
  card.contextual_applicant_example.interview_band
);

console.log(
  `St Andrews A100 international/contextual regression: PASS ` +
  `(${fixture.international_guidance_cases.length} international guidance boundaries, ` +
  `MMI tie-break, 10% contextual ranking-only uplift, UCAT-ranking contextual guidance, ` +
  `verified evidence gaps and result-card examples)`
);
