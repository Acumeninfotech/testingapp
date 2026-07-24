#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

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

const course = readJson('data/universities/manchester-a100.json');
const research = readJson('data/research/manchester-a100-research.json');
const config = readJson('data/interview-band-configs/manchester-a100.json');
const card = readJson('data/examples/manchester-a100-result-card.example.json');
const fixture = readJson(
  'data/fixtures/interview-band-classification/manchester-a100.json'
);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'manchester-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(research.course_identity.ucas_code, 'A106');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);

const researchALevelRule = research.academic_requirements.a_level.required_subject_rule;
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(researchALevelRule, 'primary_requirement'),
  false,
  'Research must not flatten the first required science condition.'
);
assert.deepStrictEqual(
  researchALevelRule.first_required_science_condition.options,
  [
    {
      option: 'Biology/Human Biology',
      operator: 'one_of',
      subjects: ['Biology', 'Human Biology']
    },
    {
      option: 'Chemistry',
      operator: 'required_subject',
      subject: 'Chemistry'
    }
  ]
);
assert.deepStrictEqual(
  researchALevelRule.second_subject_one_of,
  ['Chemistry', 'Biology', 'Human Biology', 'Physics', 'Psychology', 'Mathematics', 'Further Mathematics']
);
assert.strictEqual(researchALevelRule.offer_basis.full_a_levels_counted, 3);
assert.strictEqual(researchALevelRule.offer_basis.extra_a_levels_included_in_offer, false);
assert.strictEqual(researchALevelRule.offer_basis.three_sciences_acceptable, true);

const productionALevelRule =
  course.stage_1_eligibility.post_16.a_level.subject_combination_rule;
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(productionALevelRule, 'primary_subject_group'),
  false,
  'Production must use the structured first required science condition.'
);
assert.deepStrictEqual(
  productionALevelRule.primary_subject_condition.options.map((option) => option.subject_ids),
  [['biology', 'human_biology'], ['chemistry']]
);
assert.deepStrictEqual(
  productionALevelRule.second_subject_group.subject_ids,
  ['chemistry', 'biology', 'human_biology', 'physics', 'psychology', 'mathematics', 'further_mathematics']
);
assert.deepStrictEqual(
  productionALevelRule.disallowed_overlaps,
  [['biology', 'human_biology'], ['mathematics', 'further_mathematics']]
);
assert.strictEqual(productionALevelRule.offer_subject_count, 3);
assert.strictEqual(productionALevelRule.extra_a_levels_included_in_offer, false);
assert.strictEqual(productionALevelRule.third_subject_preference, 'none');
assert.strictEqual(productionALevelRule.three_sciences_acceptable, true);

const historicalSeries = [
  {
    groupId: 'home_standard',
    researchValues: research.historical_ucat_data.a106_home_standard
  },
  {
    groupId: 'home_contextual_wp',
    researchValues: research.historical_ucat_data.a106_home_contextual_wp
  }
];

for (const { groupId, researchValues } of historicalSeries) {
  const expectedValues = researchValues
    .slice()
    .sort((left, right) => left.entry_year - right.entry_year)
    .map((record) => record.minimum_invited.converted_score_2700);
  const configValues = config.score_model.historical_series.find(
    (series) => series.group_id === groupId
  ).minimum_invited_values_2700;
  const cardValues = card.historical_context[groupId].minimum_invited_values_2700;
  assert.deepStrictEqual(configValues, expectedValues, `${groupId}: research/config history`);
  assert.deepStrictEqual(cardValues, expectedValues, `${groupId}: research/card history`);
}

const scenarioResults = fixture.scenarios.map((scenario) => {
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
  assert.strictEqual(
    result.ranking?.value ?? null,
    expected.ranking_value,
    `${scenario.scenario_id}: ranking`
  );

  if (Object.prototype.hasOwnProperty.call(expected, 'guidance_pool_id')) {
    assert.strictEqual(
      result.guidance_pool_id ?? null,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: pool`
    );
  }
  if (expected.interview_outcome) {
    assert.strictEqual(
      result.interview_outcome,
      expected.interview_outcome,
      `${scenario.scenario_id}: MAP outcome`
    );
  }
  if (expected.failure) {
    const eligibilityReasons = [
      ...result.eligibility.failures,
      ...(result.eligibility.manual_review_reasons || [])
    ];
    assert.ok(
      eligibilityReasons.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }

  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
  return { scenario_id: scenario.scenario_id, result };
});

const explicitFailedPracticalApplicant = merge(
  fixture.base_applicant,
  {
    a_level_profile: {
      subjects: fixture.base_applicant.a_level_profile.subjects.map((subject) => ({
        ...subject,
        practical_endorsement:
          subject.subject_id === 'chemistry'
            ? 'fail'
            : subject.practical_endorsement
      }))
    }
  }
);
const explicitFailedPractical = classifyInterviewBand(
  course,
  config,
  explicitFailedPracticalApplicant
);
assert.strictEqual(
  explicitFailedPractical.eligibility.status,
  'not_eligible',
  'Manchester must reject an explicit failed science practical endorsement.'
);
assert.ok(
  explicitFailedPractical.eligibility.failures.includes(
    'science_practical_endorsement_not_confirmed:chemistry'
  )
);

const contextualOverrides = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'eligible_home_contextual_wp';
}).overrides;

for (const boundary of fixture.historical_guidance_boundaries) {
  const poolOverrides = boundary.pool === 'contextual_wp' ? contextualOverrides : {};
  const applicant = merge(
    merge(fixture.base_applicant, poolOverrides),
    { admissions_tests: { ucat: { total_score: boundary.ucat } } }
  );
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(result.eligibility.status, 'eligible', `${boundary.scenario_id}: eligibility`);
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `${boundary.scenario_id}: historical guidance boundary`
  );
}

const mapResult = scenarioResults.find((entry) => {
  return entry.scenario_id === 'map_guaranteed_interview_override';
}).result;
assert.strictEqual(mapResult.ranking, null);
assert.strictEqual(mapResult.guidance_pool_id, null);
assert.match(mapResult.explanation, /guaranteed interview/i);
assert.match(mapResult.explanation, /banding was not applied/i);

for (const scenarioId of [
  'sjt_band_3_rejected_before_banding',
  'sjt_band_4_rejected_before_banding',
  'a101_target_isolated_from_a106'
]) {
  const result = scenarioResults.find((entry) => entry.scenario_id === scenarioId).result;
  assert.strictEqual(result.ranking, null);
  assert.strictEqual(result.guidance_pool_id, undefined);
}

for (const scenarioId of [
  'unsupported_a106_prior_degree_applicant_guidance'
]) {
  const result = scenarioResults.find((entry) => entry.scenario_id === scenarioId).result;
  assert.strictEqual(result.guidance_pool_id, null);
  assert.strictEqual(result.canonical_interview_band, 'insufficient_evidence');
}

const internationalResult = scenarioResults.find((entry) => {
  return entry.scenario_id === 'eligible_international_guidance';
}).result;
assert.strictEqual(internationalResult.guidance_pool_id, 'a106_international');
assert.strictEqual(internationalResult.canonical_interview_band, 'interview_likely');

const a101Reference = course.historical_admissions.reference_only_related_course_data;
assert.strictEqual(a101Reference.course_code, 'A101');
assert.strictEqual(a101Reference.executable_for_a106, false);
assert.strictEqual(
  config.eligibility.reference_only_exclusions[0].executable_for_a106,
  false
);
assert.strictEqual(
  config.guidance_pools.some((pool) => /a101/i.test(JSON.stringify(pool))),
  false
);
assert.strictEqual(
  JSON.stringify(card.prediction).includes('2080'),
  false,
  'A101 historical score must not enter Manchester standard-course prediction output.'
);
assert.strictEqual(card.a101_isolation.executable_for_a106, false);
assert.strictEqual(card.offer_selection, undefined);
assert.strictEqual(card.prediction.offer_prediction_status, undefined);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const researchA101 = JSON.stringify(research).match(/A101/g) || [];
assert.ok(researchA101.length > 0, 'Research must retain A101 reference context.');
assert.strictEqual(card.readiness.result_card_ready, true);
assert.strictEqual(card.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(card.readiness.interview_band_config_ready, true);
assert.strictEqual(card.readiness.metadata_activation_ready, true);

const indexCourse = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexCourse, 'Manchester A100 must be present in data/index.json.');
assert.strictEqual(indexCourse.course_code, 'A100');
assert.strictEqual(indexCourse.json_file, 'universities/manchester-a100.json');
assert.strictEqual(
  indexCourse.interview_band_config_file,
  'interview-band-configs/manchester-a100.json'
);
assert.strictEqual(index.total_courses, index.universities.length);
assert.strictEqual(indexCourse.selection_model, 'ucat_ranking');
assert.strictEqual(indexCourse.entry_route, 'Standard Entry');
assert.strictEqual(indexCourse.has_graduate_entry, false);
for (const [flag, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  result_card_ready: true,
  metadata_activation_ready: true
})) {
  assert.strictEqual(course.engine_notes[flag], expected, `production ${flag}`);
  assert.strictEqual(indexCourse[flag], expected, `index ${flag}`);
}
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(indexCourse.offer_prediction_scope, 'out_of_scope');

const terminologyAudit = JSON.stringify({ research, course, config, card, fixture });
assert.doesNotMatch(
  terminologyAudit,
  /\bgraduate[- _]?a106\b|\bgraduate applicants to a106\b/i,
  'Manchester artifacts must not use the incorrect course/category terminology.'
);

console.log('Manchester A100 result-card and consumer regression');
console.log('PASS research, production, config, result-card and activation consistency');
console.log(`PASS ${fixture.scenarios.length} scenario fixtures`);
console.log(`PASS ${fixture.historical_guidance_boundaries.length} historical guidance boundaries`);
console.log('PASS MAP override, SJT gate, unsupported groups, A101 isolation and offer safeguard');
