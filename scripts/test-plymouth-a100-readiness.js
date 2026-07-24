#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
} = require('../assets/js/engine/result-card-presenter');
const { predict } = require('../server/src/predict');

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

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => failure === expected);
}

function makeResultCard(course, config, applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
      eligibilityStatus: classification.eligibility.status,
      guidancePoolId: classification.guidance_pool_id ?? null
    }),
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility || null,
      historical_admissions: course.historical_admissions || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      warnings: classification.warnings || []
    }
  });
}

const course = readJson('data/universities/plymouth-a100.json');
const research = readJson('data/research/plymouth-a100-research.json');
const config = readJson('data/interview-band-configs/plymouth-a100.json');
const card = readJson('data/examples/plymouth-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/plymouth-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'plymouth-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_2_interview_selection.calculation.score_components.length, 0);
assert.strictEqual(config.score_model.metric, 'ucat_total');
assert.strictEqual(config.score_model.scale.max, 2700);
assert.strictEqual(config.score_model.executable_band_rules_created, true);
assert.strictEqual(config.score_model.legacy_3600_values_display_only, true);
assert.strictEqual(config.score_model.converted_2700_values_display_only, false);
assert.strictEqual(config.score_model.normalised_2700_values_derived_for_prediction, true);
assert.strictEqual(config.score_model.applysmart_predictive_estimate, true);
assert.strictEqual(config.score_model.conversion_policy.formula, 'official_score_3600 * 3 / 4');
assert.strictEqual(
  config.score_model.calibration_policy.method,
  'median_of_three_pool_specific_normalised_historical_thresholds'
);
assert.strictEqual(config.score_model.calibration_policy.margin_points, 150);
assert.deepStrictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.sorted_normalised_scores_2700,
  [1657.5, 1950, 2010]
);
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.median_reference_2700,
  1950
);
assert.deepStrictEqual(
  config.score_model.calibration_policy.pool_references.international_a100.sorted_normalised_scores_2700,
  [1830, 1950, 2002.5]
);
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.international_a100.median_reference_2700,
  1950
);
assert.deepStrictEqual(
  config.score_model.calibration_policy.pool_references.ukwpmed_widening_access_a100.sorted_normalised_scores_2700,
  [1657.5, 1747.5, 1905]
);
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.ukwpmed_widening_access_a100.median_reference_2700,
  1747.5
);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Plymouth A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/plymouth-a100.json');
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.interview_prediction_ready, true);
assert.strictEqual(research.readiness.interview_prediction_ready, true);
assert.strictEqual(research.readiness.production_ready_candidate, true);

const historicalRows = course.historical_admissions.cycles.filter((row) => {
  return Number.isInteger(row.original_scale) && row.original_scale === 3600;
});
assert.strictEqual(historicalRows.length, 9);
for (const row of historicalRows) {
  assert.strictEqual(row.display_only, true);
  assert.strictEqual(row.display_original_scale, true);
  assert.strictEqual(row.display_converted_scale, true);
  assert.strictEqual(row.converted_scale, 2700);
  assert.strictEqual(row.converted_value_evidence_classification, 'derived_for_prediction');
  assert.strictEqual(row.applysmart_derived_equivalent_official, false);
  assert.strictEqual(row.usable_for_guidance_band_calibration, true);
  assert.ok(row.official_source.startsWith('FOI-'));
}

const expectedRows = [
  [2023, 'Home', 2680, 2010],
  [2023, 'International', 2440, 1830],
  [2023, 'UKWPMED/Widening Access', 2330, 1747.5],
  [2024, 'Home', 2210, 1657.5],
  [2024, 'International', 2600, 1950],
  [2024, 'UKWPMED/Widening Access', 2210, 1657.5],
  [2025, 'Home', 2600, 1950],
  [2025, 'International', 2670, 2002.5],
  [2025, 'UKWPMED/Widening Access', 2540, 1905]
];
for (const [entryYear, pool, original, converted] of expectedRows) {
  const row = historicalRows.find((candidate) => {
    return candidate.entry_year === entryYear && candidate.application_pool === pool;
  });
  assert.ok(row, `${entryYear} ${pool} historical row must exist.`);
  assert.strictEqual(row.original_score, original);
  assert.strictEqual(row.converted_score_2700, converted);
}
const plymouth2025International = historicalRows.find((row) => {
  return row.entry_year === 2025 && row.application_pool === 'International';
});
assert.strictEqual(plymouth2025International.original_score, 2670);
assert.strictEqual(plymouth2025International.original_scale, 3600);
assert.strictEqual(plymouth2025International.converted_score_2700, 2002.5);
assert.strictEqual(plymouth2025International.applysmart_derived_equivalent_official, false);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(plymouth2025International, 'arithmetic_inconsistency'),
  false
);

const expectedRules = {
  home_a100: [
    ['interview_likely', 'greater_than_or_equal', 2100],
    ['realistic', 'between_inclusive', 1950, 2099],
    ['ambitious', 'between_inclusive', 1800, 1949],
    ['high_risk', 'less_than', 1800]
  ],
  international_a100: [
    ['interview_likely', 'greater_than_or_equal', 2100],
    ['realistic', 'between_inclusive', 1950, 2099],
    ['ambitious', 'between_inclusive', 1800, 1949],
    ['high_risk', 'less_than', 1800]
  ],
  ukwpmed_widening_access_a100: [
    ['interview_likely', 'greater_than_or_equal', 1898],
    ['realistic', 'between_inclusive', 1748, 1897],
    ['ambitious', 'between_inclusive', 1598, 1747],
    ['high_risk', 'less_than', 1598]
  ]
};

for (const pool of config.guidance_pools) {
  assert.deepStrictEqual(
    pool.band_rules.map((rule) =>
      rule.operator === 'between_inclusive'
        ? [rule.band, rule.operator, rule.min, rule.max]
        : [rule.band, rule.operator, rule.value]
    ),
    expectedRules[pool.pool_id],
    `${pool.pool_id} must define the approved fixed guidance bands.`
  );
  assert.strictEqual(pool.official_candidate_decile_guidance.executable, false);
  assert.ok(
    !JSON.stringify(pool.band_rules).includes('2670') &&
      !JSON.stringify(pool.band_rules).includes('2680') &&
      !JSON.stringify(pool.band_rules).includes('2440'),
    `${pool.pool_id} band_rules must not contain raw official Plymouth /3600 historical values.`
  );
}

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
    result.guidance_pool_id ?? null,
    expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.ranking?.value ?? null,
    expected.ranking_value,
    `${scenario.scenario_id}: ranking`
  );
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);

  if (scenario.scenario_id.startsWith('international_')) {
    assert.strictEqual(result.eligibility.status, 'eligible', `${scenario.scenario_id}: International route eligible`);
    assert.strictEqual(result.guidance_pool_id, 'international_a100', `${scenario.scenario_id}: International pool isolation`);
    assert.ok(
      (result.applicant_group_ids || []).includes('international_fee'),
      `${scenario.scenario_id}: International group present`
    );
    assert.ok(
      !(result.applicant_group_ids || []).some((groupId) =>
        ['home_fee', 'contextual', 'widening_participation'].includes(groupId)
      ),
      `${scenario.scenario_id}: Home/contextual groups must not leak into International result`
    );

    const internationalCard = makeResultCard(course, config, applicant, result);
    const internationalCardText = JSON.stringify(internationalCard);
    assert.match(internationalCardText, /ApplySmart/i, `${scenario.scenario_id}: ApplySmart estimate wording`);
    assert.match(
      internationalCardText,
      /guidance only|guidance for university choice/i,
      `${scenario.scenario_id}: non-guaranteed guidance wording`
    );
    assert.match(
      internationalCardText,
      /not a current cut-off|not official Plymouth cutoffs|not an official current Plymouth cutoff/i,
      `${scenario.scenario_id}: non-official cutoff wording`
    );
    assert.doesNotMatch(
      internationalCardText,
      /guaranteed interview/i,
      `${scenario.scenario_id}: no guaranteed-interview wording`
    );
    assert.strictEqual(hasNestedKey(internationalCard, 'offer_probability'), false);
  }
}

const baseResult = classifyInterviewBand(course, config, fixture.base_applicant);
assert.strictEqual(baseResult.eligibility.status, 'eligible');
assert.strictEqual(baseResult.guidance_pool_id, 'home_a100');
assert.strictEqual(baseResult.canonical_interview_band, 'interview_likely');
assert.strictEqual(baseResult.ranking.value, 2200);

const resultCard = makeResultCard(course, config, fixture.base_applicant, baseResult);
assert.strictEqual(resultCard.prediction.result_band, 'interview_likely');
assert.strictEqual(resultCard.decision_transparency.score_breakdown, null);
assert.ok(
  JSON.stringify(card.historical_context).includes('3600') &&
    JSON.stringify(card.historical_context).includes('2700'),
  'Plymouth example card must distinguish original /3600 and approximate /2700 values.'
);

assert.match(card.historical_context.warning, /official historical UCAT thresholds/i);
assert.match(card.historical_context.annual_variation_warning, /does not guarantee a future interview/i);
assert.match(JSON.stringify(card), /ApplySmart historical-normalised/i);
assert.match(JSON.stringify(card), /not an official Plymouth cutoff/i);
assert.doesNotMatch(JSON.stringify(card), /guaranteed interview/i);
assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.readiness.interview_prediction_ready, true);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const served = predict({
    universityIds: ['plymouth-a100'],
    studentProfile: fixture.base_applicant
  });
assert.strictEqual(served[0].result_card.prediction.result_band, 'interview_likely');
assert.strictEqual(served[0].result_card.evidence_confidence.level, 'Medium');

console.log('Plymouth A100 readiness checks passed.');
