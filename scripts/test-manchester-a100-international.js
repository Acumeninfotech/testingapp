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

const course = readJson('data/universities/manchester-a100.json');
const research = readJson('data/research/manchester-a100-research.json');
const config = readJson('data/interview-band-configs/manchester-a100.json');
const card = readJson('data/examples/manchester-a100-result-card.example.json');
const fixture = readJson('data/fixtures/manchester-a100-international.json');
const sourceFixture = readJson(fixture.base_applicant_file);
const homeConfigSnapshot = {
  contextual: clone(config.guidance_pools.find((pool) => {
    return pool.pool_id === 'a106_home_contextual_wp_school_leaver';
  })),
  standard: clone(config.guidance_pools.find((pool) => {
    return pool.pool_id === 'a106_home_standard_school_leaver';
  }))
};

const RECOMMENDATION_BY_BAND = {
  interview_likely: 'Strong choice',
  realistic: 'Good chance – recommend applying',
  ambitious: 'Possible but ambitious',
  high_risk: 'Consider stronger alternatives'
};

function internationalApplicant(ucatTotal, sjtBand = 2) {
  const applicant = clone(sourceFixture[fixture.base_applicant_property]);
  applicant.profile_id = 'manchester_a100_international_fixture';
  applicant.applicant_identity.fee_status = 'International';
  applicant.applicant_identity.domicile = 'International';
  applicant.applicant_identity.applicant_type = 'international_standard_school_leaver';
  applicant.admissions_tests.ucat.total_score = ucatTotal;
  applicant.admissions_tests.ucat.sjt_band = sjtBand;
  return applicant;
}

const selection = course.stage_2_interview_selection.international_selection;
assert.deepStrictEqual(selection.applies_to_group_ids, ['international_fee']);
assert.strictEqual(selection.ranking_pool, 'a106_international');
assert.strictEqual(selection.separate_applicant_cohort, true);
assert.strictEqual(selection.competes_only_with_international_applicants, true);
assert.strictEqual(selection.places_approximate, 28);
assert.strictEqual(selection.threshold.independently_determined_for_international_cohort, true);
assert.strictEqual(selection.threshold.determined_after_ucat_results_are_available_each_cycle, true);
assert.strictEqual(selection.threshold.pre_published_fixed_threshold, false);
assert.strictEqual(selection.threshold.fixed_threshold, null);
assert.strictEqual(selection.ucat.score_input, 'cognitive_total_only');
assert.deepStrictEqual(selection.ucat.accepted_sjt_bands, [1, 2]);
assert.deepStrictEqual(selection.ucat.automatic_rejection_sjt_bands, [3, 4]);

const evidence = research.international_selection_evidence;
assert.strictEqual(evidence.ranking_pool, 'separate_international_cohort');
assert.strictEqual(evidence.competes_only_with_international_applicants, true);
assert.deepStrictEqual(
  evidence.historical_ucat_2700.map((record) => [
    record.entry_year,
    record.lowest_invited,
    record.average_invited,
    record.average_offer_holders
  ]),
  [
    [2022, 2045, 2180, 2225],
    [2023, 2060, 2200, 2240],
    [2024, 2025, 2170, 2215],
    [2025, 2030, 2185, 2230],
    [2026, 2033, 2260, 2320]
  ]
);
assert.deepStrictEqual(evidence.competition, {
  applications_approximate_range: { minimum: 650, maximum: 720 },
  interviews_approximate_range: { minimum: 300, maximum: 330 },
  offers_approximate_range: { minimum: 28, maximum: 32 }
});
assert.strictEqual(evidence.post_interview.academic_and_ucat_weights_reset, true);
assert.strictEqual(evidence.post_interview.offer_ranking_basis, 'mmi_score_only');
assert.strictEqual(evidence.post_interview.final_tie_break, 'higher_cognitive_ucat_total');
assert.strictEqual(evidence.personal_statement.scored, false);
assert.deepStrictEqual(evidence.personal_statement.checks, ['authenticity', 'motivation']);

for (const testCase of fixture.historical_guidance_cases) {
  const result = classifyInterviewBand(
    course,
    config,
    internationalApplicant(testCase.ucat_total)
  );
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.guidance_pool_id, 'a106_international');
  assert.strictEqual(result.canonical_interview_band, testCase.expected_band);
  assert.strictEqual(
    RECOMMENDATION_BY_BAND[result.canonical_interview_band],
    testCase.expected_recommendation
  );
}

for (const testCase of fixture.sjt_cases) {
  const result = classifyInterviewBand(
    course,
    config,
    internationalApplicant(2150, testCase.sjt_band)
  );
  assert.strictEqual(result.eligibility.status, testCase.expected_eligibility);
  if (testCase.expected_failure) {
    assert.ok(result.eligibility.failures.includes(testCase.expected_failure));
    assert.strictEqual(result.ranking, null);
  } else {
    assert.strictEqual(result.guidance_pool_id, 'a106_international');
  }
}

const internationalPool = course.ranking_pools.find((pool) => {
  return pool.pool_id === 'a106_international';
});
assert.strictEqual(internationalPool.ranking_model, 'ucat_ranking');
assert.strictEqual(internationalPool.independent_dynamic_threshold, true);
assert.strictEqual(internationalPool.fixed_ucat_cutoff, null);

const offerTieBreakers = course.offer_selection.tie_breakers;
assert.deepStrictEqual(
  offerTieBreakers.map((rule) => [rule.order, rule.metric, rule.direction]),
  [
    [1, 'total_mmi_score', 'higher_preferred'],
    [2, 'ucat_total_score', 'higher_preferred']
  ]
);
const tieCase = fixture.post_interview_tie_break_case;
const rankedTie = [...tieCase.candidates].sort((left, right) => {
  return right.ucat_total - left.ucat_total;
});
assert.strictEqual(rankedTie[0].candidate_id, tieCase.expected_first);

assert.deepStrictEqual(homeConfigSnapshot.contextual, {
  pool_id: 'a106_home_contextual_wp_school_leaver',
  priority: 20,
  applicant_match: {
    all_group_ids: ['home_fee', 'school_leaver'],
    any_group_ids: ['contextual', 'widening_participation'],
    excluded_group_ids: ['international_fee', 'graduate_applicant']
  },
  metric: 'ucat_total',
  band_rules: [
    { band: 'interview_likely', operator: 'greater_than', value: 1965 },
    { band: 'realistic', operator: 'between_inclusive', min: 1860, max: 1965 },
    { band: 'high_risk', operator: 'less_than', value: 1860 }
  ]
});
assert.deepStrictEqual(homeConfigSnapshot.standard, {
  pool_id: 'a106_home_standard_school_leaver',
  priority: 10,
  applicant_match: {
    all_group_ids: ['home_fee', 'school_leaver'],
    excluded_group_ids: [
      'contextual',
      'widening_participation',
      'international_fee',
      'graduate_applicant'
    ]
  },
  metric: 'ucat_total',
  band_rules: [
    { band: 'interview_likely', operator: 'greater_than', value: 2060 },
    { band: 'realistic', operator: 'between_inclusive', min: 2015, max: 2060 },
    { band: 'high_risk', operator: 'less_than', value: 2015 }
  ]
});

assert.deepStrictEqual(
  card.applicant_context.applies_to_group_ids,
  ['international_fee', 'school_leaver']
);
assert.strictEqual(card.prediction.guidance_pool_id, 'a106_international');
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.recommendation, 'Good chance – recommend applying');
assert.match(
  card.prediction.band_basis,
  /historical international interview competitiveness rather than a fixed UCAT cut-off/i
);
assert.match(
  card.historical_context.international.disclaimer,
  /historical international interview competitiveness rather than a fixed UCAT cut-off/i
);

const cardResult = classifyInterviewBand(course, config, internationalApplicant(2100, 2));
assert.strictEqual(cardResult.eligibility.status, 'eligible');
assert.strictEqual(cardResult.guidance_pool_id, card.prediction.guidance_pool_id);
assert.strictEqual(cardResult.canonical_interview_band, card.prediction.result_band);
assert.strictEqual(cardResult.ranking.value, card.prediction.score);

console.log(
  `Manchester A100 international regression: PASS ` +
  `(${fixture.historical_guidance_cases.length} guidance boundaries, ` +
  `${fixture.sjt_cases.length} SJT cases, separate cohort, cognitive UCAT ranking, ` +
  `MMI-only offers, UCAT final tie-break, Home/WP invariants and result card)`
);
