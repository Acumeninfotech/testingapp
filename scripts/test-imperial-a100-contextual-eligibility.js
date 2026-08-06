#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
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

const course = readJson('data/universities/imperial-college-london-a100.json');
const config = readJson('data/interview-band-configs/imperial-college-london-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/imperial-college-london-a100.json');

function baseApplicant(overrides = {}) {
  return merge(fixture.base_applicant, overrides);
}

function aaaSubjects(overrides = {}) {
  return {
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', sitting_status: 'first_sitting' }
      ]
    },
    ...overrides
  };
}

function contextualApplicant(contextualProfile, overrides = {}) {
  return baseApplicant(merge(
    {
      contextual_profile: contextualProfile,
      ...aaaSubjects(),
      admissions_tests: {
        ucat: {
          total_score: 2170,
          score_scale: 2700,
          sjt_band: 3,
          test_year: 2026
        }
      }
    },
    overrides
  ));
}

function contextualResult(contextualProfile, overrides = {}) {
  return evaluateContextualEligibility(course, contextualApplicant(contextualProfile, overrides));
}

function classified(contextualProfile, overrides = {}) {
  return classifyInterviewBand(course, config, contextualApplicant(contextualProfile, overrides));
}

function assertContextual(result, criterionId) {
  assert.strictEqual(result.is_contextual, true);
  assert.strictEqual(result.status, 'contextual');
  assert.ok(result.activated_applicant_group_ids.includes('imperial_contextual'));
  assert.ok(result.activated_applicant_group_ids.includes('contextual'));
  assert.ok(result.activated_applicant_group_ids.includes('widening_participation'));
  assert.ok(
    result.qualifying_criteria.some((criterion) => criterion.criterion_id === criterionId),
    `Expected matched criterion ${criterionId}`
  );
}

function assertNotContextual(result) {
  assert.strictEqual(result.is_contextual, false);
  assert.deepStrictEqual(result.activated_applicant_group_ids, []);
}

function assertGuaranteed(result) {
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.interview_outcome, 'guaranteed_interview');
  assert.strictEqual(result.canonical_interview_band, null);
  assert.ok(result.applicant_group_ids.includes('imperial_contextual'));
}

function assertNotGuaranteed(result) {
  assert.notStrictEqual(result.interview_outcome, 'guaranteed_interview');
}

assertContextual(
  contextualResult({ personal_circumstances: { care_experienced: 'yes' } }),
  'care_experienced'
);
assertGuaranteed(classified({ personal_circumstances: { care_experienced: 'yes' } }));

assertContextual(
  contextualResult({ personal_circumstances: { care_leaver: 'yes' } }),
  'care_leaver'
);
assertGuaranteed(classified({ personal_circumstances: { care_leaver: 'yes' } }));

assertNotContextual(contextualResult({
  personal_circumstances: {
    care_experienced: 'no',
    care_leaver: 'no'
  }
}));

assertContextual(
  contextualResult({ home_area_region: { imd_quintile: 'q1' } }),
  'imd_2019_quintile_1'
);
assertGuaranteed(classified({ home_area_region: { imd_quintile: 'q1' } }));
assertNotContextual(contextualResult({ home_area_region: { imd_quintile: 'q2' } }));

assertContextual(
  contextualResult({ financial_support: { free_school_meals: 'yes' } }),
  'free_school_meals'
);
assertGuaranteed(classified({ financial_support: { free_school_meals: 'yes' } }));
assertNotContextual(contextualResult({ financial_support: { ucat_bursary_recipient: 'yes' } }));

assertContextual(
  contextualResult({
    home_area_region: { polar4_quintile: 'q1' },
    personal_circumstances: { first_in_family_at_university: 'yes' }
  }),
  'polar4_q1_q2_plus_indicator'
);
assertContextual(
  contextualResult({
    home_area_region: { polar4_quintile: 'q2' },
    school_education: { below_average_post16_school: 'yes' }
  }),
  'polar4_q1_q2_plus_indicator'
);
assertContextual(
  contextualResult({
    home_area_region: { polar4_quintile: 'q1' },
    school_education: { high_free_school_meals_school: 'yes' }
  }),
  'polar4_q1_q2_plus_indicator'
);
assertGuaranteed(classified({
  home_area_region: { polar4_quintile: 'q1' },
  personal_circumstances: { first_in_family_at_university: 'yes' }
}));

assertNotContextual(contextualResult({ home_area_region: { polar4_quintile: 'q2' } }));
assertNotContextual(contextualResult({
  home_area_region: { polar4_quintile: 'q3' },
  personal_circumstances: { first_in_family_at_university: 'yes' }
}));
assertNotContextual(contextualResult({ personal_circumstances: { first_in_family_at_university: 'yes' } }));
assertNotContextual(contextualResult({ school_education: { below_average_post16_school: 'yes' } }));
assertNotContextual(contextualResult({ school_education: { high_free_school_meals_school: 'yes' } }));

assertNotGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  aaaSubjects({
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'B', sitting_status: 'first_sitting' }
      ]
    }
  })
));
assertNotGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  aaaSubjects({
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', sitting_status: 'first_sitting' },
        { subject_id: 'physics', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' }
      ]
    }
  })
));
assertNotGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  aaaSubjects({
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', sitting_status: 'first_sitting' },
        { subject_id: 'physics', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' }
      ]
    }
  })
));
assertGuaranteed(classified({ personal_circumstances: { care_experienced: 'yes' } }));
assert.strictEqual(
  evaluateCourseEligibility(course, contextualApplicant({ personal_circumstances: { care_experienced: 'yes' } }))
    .academic_pathway_id,
  'imperial_contextual_a_level_aaa_biology_chemistry'
);

assertNotGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  { admissions_tests: { ucat: { total_score: 2169 } } }
));
assertGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  { admissions_tests: { ucat: { total_score: 2170 } } }
));
assertGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  { admissions_tests: { ucat: { total_score: 2171 } } }
));

for (const band of [1, 2, 3]) {
  assertGuaranteed(classified(
    { personal_circumstances: { care_experienced: 'yes' } },
    { admissions_tests: { ucat: { sjt_band: band } } }
  ));
}
assertNotGuaranteed(classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  { admissions_tests: { ucat: { sjt_band: 4, total_score: 2700 } } }
));

assertNotContextual(evaluateContextualEligibility(course, baseApplicant({
  contextual_eligible: true,
  applicant_identity: {
    contextual: true,
    contextual_status_confirmed: true,
    contextual_flags: {}
  }
})));
const legacyGenericClassification = classifyInterviewBand(course, config, baseApplicant({
  contextual_eligible: true,
  applicant_identity: {
    contextual: true,
    contextual_status_confirmed: true,
    contextual_flags: {}
  }
}));
assert.ok(!legacyGenericClassification.applicant_group_ids.includes('imperial_contextual'));
assertNotGuaranteed(legacyGenericClassification);
assertNotContextual(contextualResult({ personal_circumstances: { disability: 'yes' } }));
assertNotContextual(contextualResult({ personal_circumstances: { young_or_adult_carer: 'yes' } }));
assertNotContextual(contextualResult({
  access_programmes: {
    participation_status: 'yes',
    other_programmes: [
      { programme_id: 'imperial_outreach_pathways', status: 'completed' }
    ]
  }
}));
assertNotContextual(contextualResult({
  partner_schools: {
    status: 'yes',
    relationships: [
      {
        university_id: 'imperial-college-london-a100',
        school_name: 'Example Partner School',
        status: 'yes'
      }
    ]
  }
}));

const standardResult = classifyInterviewBand(course, config, baseApplicant());
assert.strictEqual(standardResult.eligibility.status, 'eligible');
assert.strictEqual(standardResult.guidance_pool_id, 'home_a100');
assertNotGuaranteed(standardResult);

const contextualGuaranteed = classified({
  home_area_region: { polar4_quintile: 'q1' },
  personal_circumstances: { first_in_family_at_university: 'yes' }
});
assertGuaranteed(contextualGuaranteed);
assert.strictEqual(contextualGuaranteed.guidance_pool_id, null);

const contextualBelowUcat = classified(
  { personal_circumstances: { care_experienced: 'yes' } },
  {
    a_level_profile: fixture.base_applicant.a_level_profile,
    admissions_tests: { ucat: { total_score: 2169 } }
  }
);
assert.strictEqual(contextualBelowUcat.eligibility.status, 'not_eligible');
assert.ok(contextualBelowUcat.eligibility.failures.includes('minimum_ucat_total_not_met'));
assertNotGuaranteed(contextualBelowUcat);

console.log('Imperial A100 contextual eligibility regression: PASS');
console.log('Structured contextual evidence derivation, guaranteed interview routing, UCAT/SJT boundaries and legacy negatives: PASS');
