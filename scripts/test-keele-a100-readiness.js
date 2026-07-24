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

const course = readJson('data/universities/keele-a100.json');
const research = readJson('data/research/keele-a100-research.json');
const config = readJson('data/interview-band-configs/keele-a100.json');
const card = readJson('data/examples/keele-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/keele-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'keele-a100');
assert.strictEqual(course.profile_status, 'production_ready_eligibility_and_interview_guidance');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.is_gateway_or_foundation, false);
assert.strictEqual(course.course.is_graduate_entry, false);
assert.ok(course.course.notes.includes('A104'));
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);

assert.strictEqual(course.stage_1_eligibility.gcse.scored_after_eligibility, false);
assert.strictEqual(course.stage_1_eligibility.gcse.minimum_count_at_or_above_grade.count, 5);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score, 1700);
assert.deepStrictEqual(
  course.stage_1_eligibility.admissions_tests.ucat.group_minimum_total_scores.map((rule) => [
    rule.applies_to_group_ids[0],
    rule.minimum_total_score,
    rule.execution_status
  ]),
  [
    ['home_fee', 1700, 'executable_group_specific_minimum'],
    ['international_fee', 1950, 'executable_group_specific_minimum']
  ]
);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, true);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, [4]);
assert.strictEqual(course.contextual_admissions.notes, 'No lower UCAT threshold is applied for contextual applicants.');
assert.match(
  course.stage_2_interview_selection.calculation.total_score.notes,
  /15\/25/
);
assert.match(
  course.stage_2_interview_selection.tie_breakers[0].notes,
  /Verbal Reasoning/
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(
    result.eligibility.status,
    scenario.expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    scenario.expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  assert.strictEqual(
    result.canonical_interview_band ?? null,
    scenario.expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.interview_outcome ?? null,
    scenario.expected.interview_outcome ?? null,
    `${scenario.scenario_id}: interview outcome`
  );
  if (scenario.expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(scenario.expected.failure),
      `${scenario.scenario_id}: expected failure ${scenario.expected.failure}; got ${result.eligibility.failures.join(',')}`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

assert.deepStrictEqual(
  research.evidence_gaps.map((gap) => gap.gap_id),
  [
    'multi_year_ucat_interview_data',
    'offer_holder_ucat_statistics',
    'interview_to_offer_conversion_data',
    'multi_year_application_statistics',
    'international_interviewed_offered_ucat_ranges'
  ]
);
assert.strictEqual(research.implementation_mapping.a104_separation_preserved, true);
assert.strictEqual(research.implementation_mapping.offer_prediction_implemented, false);
assert.strictEqual(research.implementation_mapping.architecture_change_required, false);
assert.strictEqual(research.readiness.production_activation_should_remain_blocked, false);
assert.strictEqual(research.readiness.blocked_by_engine_limitation, false);
assert.strictEqual(research.readiness.activation_block_reason, null);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(card.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(course.engine_notes.blocked_by_engine_limitation, false);
assert.strictEqual(course.engine_notes.interview_prediction_ready, true);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/keele-a100.json');

console.log('Keele A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('A104 separation, SJT rejection, Home/International UCAT boundary and offer-scope safeguards: PASS');
