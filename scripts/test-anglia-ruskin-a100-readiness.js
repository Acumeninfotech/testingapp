#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const { predict } = require('../server/src/predict');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  buildDecisionTimeline,
  buildEvidenceConfidence
} = require('../assets/js/engine/result-card-presenter');

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

const course = readJson('data/universities/anglia-ruskin-a100.json');
const research = readJson('data/research/anglia-ruskin-a100-research.json');
const config = readJson('data/interview-band-configs/anglia-ruskin-a100.json');
const card = readJson('data/examples/anglia-ruskin-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/anglia-ruskin-a100.json');
const index = readJson('data/index.json');
const classifierSource = fs.readFileSync(
  path.join(rootDir, 'assets/js/engine/interview-band-classifier.js'),
  'utf8'
);
const presenterSource = fs.readFileSync(
  path.join(rootDir, 'assets/js/engine/result-card-presenter.js'),
  'utf8'
);

assert.strictEqual(course.profile_id, 'anglia-ruskin-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.profile_status, 'production_ready_eligibility_and_interview_guidance');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.deepStrictEqual(course.course.fee_statuses, ['home']);
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');

assert.strictEqual(course.stage_1_eligibility.gcse.minimum_count, 4);
assert.strictEqual(course.stage_1_eligibility.gcse.selection_role, 'eligibility_only');
assert.strictEqual(course.stage_1_eligibility.gcse.scored_after_eligibility, false);
assert.deepStrictEqual(
  course.stage_1_eligibility.admissions_tests.sjt.excluded_bands,
  [4]
);
assert.strictEqual(
  course.stage_1_eligibility.admissions_tests.sjt.scoring.used_in_score,
  false
);
assert.strictEqual(
  course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score,
  null
);

const upliftComponent = config.score_model.components.find(
  (component) => component.component_id === 'adjusted_ucat_total'
);
assert.ok(upliftComponent);
assert.strictEqual(upliftComponent.type, 'ucat_total_with_percentage_uplifts');
assert.deepStrictEqual(
  upliftComponent.uplifts.map((uplift) => [uplift.uplift_id, uplift.percent]),
  [
    ['wams_5_percent', 5]
  ]
);
assert.deepStrictEqual(
  upliftComponent.exclusive_uplift_groups.map((group) => [
    group.group_id,
    group.selection_strategy,
    group.uplifts.map((uplift) => [uplift.uplift_id, uplift.percent])
  ]),
  [
    [
      'regional_uplift',
      'first_match',
      [
        ['essex_5_percent', 5],
        ['east_of_england_2_5_percent', 2.5]
      ]
    ]
  ]
);
assert.strictEqual(hasNestedKey(config, 'points'), false);
assert.strictEqual(hasNestedKey(config, 'regional_points'), false);
for (const forbiddenSharedCodeLiteral of [
  'anglia-ruskin',
  'Anglia Ruskin',
  'aru_',
  'WAMS',
  'wams',
  'East of England',
  'east_of_england',
  'Essex',
  'essex'
]) {
  assert.strictEqual(
    classifierSource.includes(forbiddenSharedCodeLiteral),
    false,
    `shared classifier must not contain ARU-specific literal ${forbiddenSharedCodeLiteral}`
  );
}
assert.match(classifierSource, /exclusive_uplift_groups/);
assert.match(classifierSource, /selection_strategy === 'highest_percent'/);
assert.match(
  classifierSource,
  /if \(resolvedEligibility\.status === 'not_eligible'\)[\s\S]*if \(resolvedEligibility\.status !== 'eligible'\)[\s\S]*const guaranteedOverride = resolveGuaranteedInterviewOverride/,
  'guaranteed-interview override must occur only after hard-filter eligibility is confirmed'
);
assert.strictEqual(
  /ucat_total_with_percentage_uplifts|exclusive_uplift_groups|selection_strategy === 'highest_percent'/.test(
    presenterSource
  ),
  false,
  'result-card presenter must not duplicate percentage-uplift selection or calculation logic'
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(
    result.eligibility.status,
    scenario.expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  if (scenario.expected.interview_outcome) {
    assert.strictEqual(
      result.interview_outcome,
      scenario.expected.interview_outcome,
      `${scenario.scenario_id}: interview outcome`
    );
    assert.strictEqual(result.canonical_interview_band, null);
  } else {
    assert.strictEqual(
      result.canonical_interview_band,
      scenario.expected.interview_band,
      `${scenario.scenario_id}: interview band`
    );
  }
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    scenario.expected.guidance_pool_id ?? null,
    `${scenario.scenario_id}: guidance pool`
  );
  if (Number.isFinite(scenario.expected.ranking_value)) {
    const adjustedUcat = result.ranking.components.adjusted_ucat_total;
    assert.strictEqual(
      adjustedUcat.value,
      scenario.expected.ranking_value,
      `${scenario.scenario_id}: adjusted UCAT value`
    );
    assert.strictEqual(
      adjustedUcat.total_uplift_percent,
      scenario.expected.applied_uplift_percent,
      `${scenario.scenario_id}: uplift percentage`
    );
    if (scenario.expected.applied_uplift_ids) {
      assert.deepStrictEqual(
        adjustedUcat.applied_uplifts.map((uplift) => uplift.uplift_id),
        scenario.expected.applied_uplift_ids,
        `${scenario.scenario_id}: applied uplift IDs`
      );
    }
    if (scenario.expected.suppressed_uplift_ids) {
      assert.deepStrictEqual(
        adjustedUcat.suppressed_uplifts.map((uplift) => uplift.uplift_id),
        scenario.expected.suppressed_uplift_ids,
        `${scenario.scenario_id}: suppressed uplift IDs`
      );
    }
    assert.ok(
      !(
        adjustedUcat.applied_uplifts.some((uplift) => uplift.uplift_id === 'east_of_england_2_5_percent') &&
        adjustedUcat.applied_uplifts.some((uplift) => uplift.uplift_id === 'essex_5_percent')
      ),
      `${scenario.scenario_id}: East of England and Essex regional uplifts must not both apply`
    );
  }
  if (scenario.expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(scenario.expected.failure),
      `${scenario.scenario_id}: expected failure ${scenario.expected.failure}`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

assert.strictEqual(
  course.stage_2_interview_selection.selection_adjustments
    .filter((modifier) => /WAMS.*UCAT uplift/.test(modifier.notes))
    .every((modifier) => modifier.stacks === true),
  true
);
assert.strictEqual(
  course.stage_2_interview_selection.selection_adjustments
    .filter((modifier) => /East of England|Essex/.test(modifier.notes))
    .every((modifier) => modifier.stacks_with_wams === true && modifier.stacks_with_other_regional_uplifts === false),
  true
);
assert.match(
  course.course.notes,
  /Graduate applicants apply through the same A100 admissions process/i
);
assert.match(
  course.offer_selection.applysmart_policy,
  /must not predict offers/i
);
assert.strictEqual(
  research.readiness.interview_prediction_ready,
  course.engine_notes.interview_prediction_ready
);
assert.strictEqual(research.readiness.contextual_logic, true);
assert.strictEqual(research.readiness.international_prediction, false);
assert.strictEqual(research.metadata.architecture_change_required, false);
assert.deepStrictEqual(
  research.remaining_evidence_gaps
    .filter((gap) => gap.blocking_for_positive_interview_banding)
    .map((gap) => gap.gap_id),
  []
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.confidence.level, 'medium');
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));

const productionCard = predict({
  studentProfile: fixture.base_applicant,
  universityIds: [course.profile_id]
})[0]?.result_card;

assert.ok(
  productionCard,
  'Anglia Ruskin A100 production Result Card must be generated.'
);
assert.deepStrictEqual(
  card.decision_transparency,
  productionCard.decision_transparency
);
assert.match(
  JSON.stringify(card),
  /percentage UCAT uplifts/i
);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking_with_percentage_uplifts');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/anglia-ruskin-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.international_prediction, false);
assert.strictEqual(indexEntry.contextual_logic, true);
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  result_card_ready: true,
  contextual_logic: true,
  international_prediction: false,
  regression: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `production ${field}`);
  if (field !== 'result_card_ready') {
    assert.strictEqual(indexEntry[field], expected, `index ${field}`);
  }
}

console.log('Anglia Ruskin A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Regional precedence and percentage UCAT uplifts, no flat regional points: PASS');
console.log('Guaranteed interview and offer-prediction boundaries: PASS');
