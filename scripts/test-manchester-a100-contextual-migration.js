#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility
} = require('../assets/js/engine/contextual-eligibility-framework');
const {
  DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
} = require('../assets/js/engine/contextual-eligibility-evaluators');

const course = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../data/universities/manchester-a100.json'),
  'utf8'
));

function evaluate(overrides = {}) {
  const applicant = {
    applicant_identity: {
      age_at_course_start_band: 'age_19',
      current_uk_residence: 'yes',
      ...(overrides.applicant_identity || {})
    },
    contextual_profile: overrides.contextual_profile || {}
  };
  return evaluateContextualEligibility(course, applicant, {
    evaluators: DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
  });
}

function ordinaryContextual(homeArea) {
  return evaluate({
    contextual_profile: {
      home_area_region: homeArea,
      school_education: {
        attended_uk_school_or_college_for_gcse_or_equivalent: 'yes',
        below_average_gcse_school: 'yes'
      }
    }
  });
}

for (const homeArea of [
  { imd_quintile: 'q1', tundra_quintile: 'q4', polar4_quintile: 'q4' },
  { imd_quintile: 'q3', tundra_quintile: 'q1', polar4_quintile: 'q4' }
]) {
  const result = ordinaryContextual(homeArea);
  assert.strictEqual(result.status, 'contextual');
  assert.strictEqual(result.matched_contextual_pathway, 'manchester_contextual_aab');
}

for (const homeArea of [
  { imd_quintile: 'q3', tundra_quintile: 'q4', polar4_quintile: 'q1' },
  { imd_quintile: 'q3', tundra_quintile: 'q2', polar4_quintile: 'q4' }
]) {
  const result = ordinaryContextual(homeArea);
  assert.strictEqual(result.is_contextual, false);
  assert.deepStrictEqual(result.activated_applicant_group_ids, []);
}

const care = evaluate({
  contextual_profile: { personal_circumstances: { care_over_three_months: 'yes' } }
});
assert.strictEqual(care.matched_contextual_pathway, 'manchester_refugee_care_abb');

const refugee = evaluate({
  contextual_profile: { personal_circumstances: { uk_refugee_status_granted: 'yes' } }
});
assert.strictEqual(refugee.matched_contextual_pathway, 'manchester_refugee_care_abb');

for (const contextualFlags of [
  { care_experienced: true },
  { refugee: true, refugee_or_asylum_seeker: true },
  { free_school_meals: true }
]) {
  const result = evaluate({
    applicant_identity: {
      contextual: true,
      widening_participation: true,
      contextual_flags: contextualFlags
    }
  });
  assert.strictEqual(result.is_contextual, false);
  assert.deepStrictEqual(result.activated_applicant_group_ids, []);
}

console.log('Manchester A100/A106 contextual migration: PASS');
console.log('PASS 2027 IMD/TUNDRA mapping and POLAR4/TUNDRA Q2 retirement');
console.log('PASS structured refugee/care evidence and legacy contextual isolation');
