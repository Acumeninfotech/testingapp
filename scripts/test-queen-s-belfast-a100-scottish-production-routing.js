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

function qubScenario(id) {
  const scenario = fixture.scenarios.find((item) => item.scenario_id === id);
  assert.ok(scenario, `Missing QUB fixture scenario: ${id}`);
  return merge(fixture.base_applicant, scenario.overrides);
}

function noGcseProfile() {
  return {
    subjects: {
      english_language: null,
      mathematics: null,
      physics: null,
      biology: null,
      chemistry: null
    },
    additional_subjects: [],
    total_gcse_count: 0,
    top_9_gcse_grades: []
  };
}

function subjectList(grades, subjects = ['chemistry', 'biology', 'mathematics', 'physics', 'english_language']) {
  return grades.map((grade, index) => ({
    subject_id: subjects[index] || `additional_${index + 1}`,
    grade
  }));
}

function scottishApplicant({
  domicile = 'Scotland',
  feeStatus = 'Home',
  applicantType = 'standard_school_leaver',
  higherGrades = ['A', 'A', 'A', 'A', 'A'],
  advancedHigherGrades = ['A', 'A'],
  ucat = 2220,
  sjtBand = 2,
  national5Grades = ['A', 'A', 'A', 'A', 'A']
} = {}) {
  return merge(fixture.base_applicant, {
    qualification_route: 'scottish',
    applicant_identity: {
      applicant_type: applicantType,
      fee_status: feeStatus,
      domicile
    },
    gcse_profile: noGcseProfile(),
    a_level_profile: {
      subjects: []
    },
    scottish_profile: {
      national_5_subjects: subjectList(national5Grades),
      higher_subjects: subjectList(higherGrades),
      advanced_higher_subjects: subjectList(advancedHigherGrades, ['chemistry', 'biology'])
    },
    admissions_tests: {
      ucat: {
        total_score: ucat,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 700,
          decision_making: 700,
          quantitative_reasoning: 700
        },
        sjt_band: sjtBand
      }
    }
  });
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant, {
    ucatDecileData
  });
}

function assertNoGcseInformationNeeded(result) {
  const serialised = JSON.stringify(result);
  assert.doesNotMatch(serialised, /best nine GCSEs/i);
  assert.doesNotMatch(serialised, /Only zero GCSEs are available/i);
  assert.doesNotMatch(serialised, /insufficient_gcse_results/i);
  assert.strictEqual(result.missing_information ?? null, null);
  assert.notStrictEqual(result.canonical_interview_band, 'insufficient_evidence');
}

function assertScottishScoring(result, academicPoints, ucatPoints) {
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.guidance_pool_id, 'qub_home_standard_scottish_higher_ucat_45_scale');
  assert.strictEqual(result.ranking.status, 'calculated');
  assert.strictEqual(result.ranking.components.gcse_points.applicable, false);
  assert.strictEqual(result.ranking.components.scottish_higher_academic_points.value, academicPoints);
  assert.strictEqual(result.ranking.components.ucat_decile_points.value, ucatPoints);
  assert.strictEqual(result.ranking.value, academicPoints + ucatPoints);
  assert.strictEqual(result.ranking.max, 45);
  assertNoGcseInformationNeeded(result);
}

const course = readJson('data/universities/queen-s-belfast-a100.json');
const config = readJson('data/interview-band-configs/queen-s-belfast-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/queen-s-belfast-a100.json');
const ucatDecileData = loadUcatDecileData(path.join(rootDir, 'data/ucat-deciles.json'));

const fixedUcat = 2220;
const fixedUcatPoints = 9;
const higherTariffCases = [
  { profile: ['A', 'B', 'B', 'B', 'B'], points: 28 },
  { profile: ['A', 'A', 'B', 'B', 'B'], points: 30 },
  { profile: ['A', 'A', 'A', 'B', 'B'], points: 32 },
  { profile: ['A', 'A', 'A', 'A', 'B'], points: 34 },
  { profile: ['A', 'A', 'A', 'A', 'A'], points: 36 }
];

for (const { profile, points } of higherTariffCases) {
  const result = classify(scottishApplicant({
    higherGrades: profile,
    ucat: fixedUcat
  }));
  assertScottishScoring(result, points, fixedUcatPoints);
}

const browserEquivalent = classify(scottishApplicant({
  higherGrades: ['A', 'A', 'A', 'A', 'A'],
  advancedHigherGrades: ['A', 'A'],
  ucat: 2300,
  sjtBand: 2,
  national5Grades: ['A', 'A', 'A', 'A', 'A', 'A']
}));
assertScottishScoring(browserEquivalent, 36, 9);
assert.strictEqual(browserEquivalent.ranking.value, 45);
assert.ok(browserEquivalent.eligibility.checks.find((check) => {
  return check.check === 'national_5_route' && check.passed === true;
}));
assert.ok(browserEquivalent.eligibility.checks.find((check) => {
  return check.check === 'scottish_post_16_route' && check.passed === true;
}));

const scottishDomicileALevel = classify(merge(fixture.base_applicant, {
  applicant_identity: {
    domicile: 'Scotland'
  },
  qualification_route: 'a_level',
  scottish_profile: null
}));
assert.strictEqual(scottishDomicileALevel.eligibility.status, 'eligible');
assert.strictEqual(scottishDomicileALevel.eligibility.qualification_route, 'a_level');
assert.strictEqual(scottishDomicileALevel.guidance_pool_id, 'qub_home_standard_gcse_ucat_45_scale');
assert.strictEqual(scottishDomicileALevel.ranking.components.gcse_points.value, 32);
assert.strictEqual(scottishDomicileALevel.ranking.components.scottish_higher_academic_points.applicable, false);
assert.strictEqual(scottishDomicileALevel.ranking.value, 40);
assert.ok(scottishDomicileALevel.applicant_group_ids.includes('scotland_domiciled'));

const englandDomicileScottish = classify(scottishApplicant({
  domicile: 'England',
  higherGrades: ['A', 'A', 'A', 'A', 'A'],
  ucat: fixedUcat
}));
assert.ok(englandDomicileScottish.applicant_group_ids.includes('england_domiciled'));
assertScottishScoring(englandDomicileScottish, 36, fixedUcatPoints);

const scotlandDomicileScottish = classify(scottishApplicant({
  domicile: 'Scotland',
  higherGrades: ['A', 'A', 'A', 'A', 'A'],
  ucat: fixedUcat
}));
assert.ok(scotlandDomicileScottish.applicant_group_ids.includes('scotland_domiciled'));
assertScottishScoring(scotlandDomicileScottish, 36, fixedUcatPoints);

const failedScottishEligibility = classify(scottishApplicant({
  higherGrades: ['A', 'A', 'A', 'A', 'A'],
  advancedHigherGrades: ['A', 'B'],
  ucat: fixedUcat
}));
assert.strictEqual(failedScottishEligibility.eligibility.status, 'not_eligible');
assert.ok(failedScottishEligibility.eligibility.failures.includes('scottish_post_16_requirements_not_met'));
assert.strictEqual(failedScottishEligibility.ranking, null);
assert.strictEqual(failedScottishEligibility.canonical_interview_band, 'not_eligible');

const internationalScottish = classify(scottishApplicant({
  feeStatus: 'International',
  domicile: 'International',
  applicantType: 'international_standard_school_leaver',
  higherGrades: ['A', 'A', 'A', 'A', 'A'],
  ucat: fixedUcat
}));
assert.strictEqual(internationalScottish.eligibility.status, 'eligible');
assert.strictEqual(internationalScottish.guidance_pool_id, null);
assert.strictEqual(internationalScottish.canonical_interview_band, 'insufficient_evidence');
assert.ok(internationalScottish.applicant_group_ids.includes('international_fee'));
assert.ok(!internationalScottish.applicant_group_ids.includes('home_fee'));

const contextual = evaluateContextualEligibility(course, scotlandDomicileScottish);
assert.strictEqual(contextual.status, 'not_contextual');
assert.strictEqual(contextual.is_contextual, false);
assert.ok(!scotlandDomicileScottish.applicant_group_ids.includes('qub_ni_bt_postcode_contextual_route'));

const scottishGenericContextual = scottishApplicant({
  domicile: 'Scotland',
  higherGrades: ['A', 'A', 'A', 'A', 'A'],
  ucat: fixedUcat
});
scottishGenericContextual.applicant_identity.contextual = true;
scottishGenericContextual.applicant_identity.widening_participation = true;
scottishGenericContextual.applicant_identity.contextual_flags = {
  school_contextual_indicator: true
};
const genericContextual = evaluateContextualEligibility(course, scottishGenericContextual);
assert.strictEqual(genericContextual.status, 'not_contextual');
assert.strictEqual(genericContextual.is_contextual, false);
assertScottishScoring(classify(scottishGenericContextual), 36, fixedUcatPoints);

const popClassification = classify(qubScenario('verified_mdbs_pop_guaranteed_interview'));
assert.strictEqual(popClassification.interview_outcome, 'guaranteed_interview');
assert.strictEqual(popClassification.ranking, null);
assert.strictEqual(popClassification.guidance_pool_id, null);

const niBtContextualClassification = classify(qubScenario('ni_bt_postcode_contextual_route_suppresses_standard_prediction'));
assert.strictEqual(niBtContextualClassification.eligibility.status, 'eligible');
assert.strictEqual(niBtContextualClassification.guidance_pool_id, null);
assert.strictEqual(niBtContextualClassification.canonical_interview_band, 'insufficient_evidence');

const standardHome = classify(qubScenario('qub_home_standard_32_gcse_8_ucat_strong'));
assert.strictEqual(standardHome.eligibility.status, 'eligible');
assert.strictEqual(standardHome.guidance_pool_id, 'qub_home_standard_gcse_ucat_45_scale');
assert.strictEqual(standardHome.ranking.components.gcse_points.value, 32);
assert.strictEqual(standardHome.ranking.components.scottish_higher_academic_points.applicable, false);
assert.strictEqual(standardHome.ranking.components.ucat_decile_points.value, 8);
assert.strictEqual(standardHome.ranking.value, 40);
assert.strictEqual(standardHome.canonical_interview_band, 'realistic');

console.log("Queen's Belfast A100 Scottish production routing regression: PASS");
