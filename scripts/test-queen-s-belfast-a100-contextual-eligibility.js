#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  loadUcatDecileData
} = require('../assets/js/engine/ucat-decile-service');

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

const course = readJson('data/universities/queen-s-belfast-a100.json');
const config = readJson('data/interview-band-configs/queen-s-belfast-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/queen-s-belfast-a100.json');
const ucatDecileData = loadUcatDecileData(path.join(rootDir, 'data/ucat-deciles.json'));

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant, { ucatDecileData });
}

assert.strictEqual(
  course.contextual_admissions.contextual_eligibility.evaluator_id,
  'queen_s_belfast_contextual_medicine_a100'
);
assert.strictEqual(course.contextual_admissions.contextual_eligibility.controls_group_routing, false);
assert.strictEqual(config.eligibility.contextual_evaluator_controls_group_routing, false);

const standard = fixture.base_applicant;
assert.strictEqual(evaluateContextualEligibility(course, standard).status, 'not_contextual');
assert.strictEqual(classify(standard).guidance_pool_id, 'qub_home_standard_gcse_ucat_45_scale');

const niBtScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'ni_bt_postcode_contextual_route_suppresses_standard_prediction';
});
const niBtApplicant = merge(fixture.base_applicant, niBtScenario.overrides);
const niBtContextual = evaluateContextualEligibility(course, niBtApplicant);
assert.strictEqual(niBtContextual.status, 'contextual');
assert.strictEqual(niBtContextual.matched_contextual_pathway, 'qub_ni_bt_postcode_contextual_route');
assert.deepStrictEqual(niBtContextual.activated_applicant_group_ids, [
  'qub_ni_bt_postcode_contextual_route',
  'contextual',
  'widening_participation'
]);
const niBtClassification = classify(niBtApplicant);
assert.strictEqual(niBtClassification.guidance_pool_id ?? null, null);
assert.strictEqual(niBtClassification.canonical_interview_band, 'insufficient_evidence');

const popScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'verified_mdbs_pop_guaranteed_interview';
});
const popApplicant = merge(fixture.base_applicant, popScenario.overrides);
const popContextual = evaluateContextualEligibility(course, popApplicant);
assert.strictEqual(popContextual.status, 'contextual');
assert.strictEqual(popContextual.interview_outcome, 'guaranteed_interview');
assert.strictEqual(popContextual.matched_contextual_pathway, 'qub_mdbs_pop_guaranteed_interview');
const popClassification = classify(popApplicant);
assert.strictEqual(popClassification.interview_outcome, 'guaranteed_interview');
assert.strictEqual(popClassification.canonical_interview_band, null);

const genericScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'generic_contextual_flag_does_not_trigger_pop_override';
});
const genericApplicant = merge(fixture.base_applicant, genericScenario.overrides);
const genericContextual = evaluateContextualEligibility(course, genericApplicant);
assert.strictEqual(genericContextual.status, 'not_contextual');
assert.strictEqual(genericContextual.is_contextual, false);
assert.strictEqual(classify(genericApplicant).guidance_pool_id, 'qub_home_standard_gcse_ucat_45_scale');

const incompletePop = merge(fixture.base_applicant, {
  widening_participation: {
    qub_pathway_opportunity_programme: {
      programme: 'mdbs_pop',
      programme_completed: true,
      programme_completion_verified: false,
      academic_eligibility_confirmed: true
    }
  }
});
const incompletePopContextual = evaluateContextualEligibility(course, incompletePop);
assert.strictEqual(incompletePopContextual.status, 'information_needed');
assert.strictEqual(
  incompletePopContextual.manual_review_reason,
  'queen_s_belfast_pop_completion_confirmation_required'
);

const internationalScenario = fixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'international_route_prediction_suppressed';
});
const internationalApplicant = merge(fixture.base_applicant, internationalScenario.overrides);
const internationalContextual = evaluateContextualEligibility(course, internationalApplicant);
assert.strictEqual(internationalContextual.status, 'not_contextual');
assert.strictEqual(
  internationalContextual.reason,
  'queen_s_belfast_contextual_not_applicable_to_international_pathway'
);
assert.strictEqual(classify(internationalApplicant).canonical_interview_band, 'insufficient_evidence');

console.log("Queen's Belfast A100 contextual eligibility regression: PASS");
