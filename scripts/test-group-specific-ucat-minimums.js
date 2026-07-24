#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand,
  resolveUcatMinimumTotalScore
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  run: runRegressionProfiles
} = require('./run-regression-profiles');

const rootDir = path.resolve(__dirname, '..');
const matrixPath = path.join(rootDir, 'data', 'regression-results', 'regression-matrix.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadProfile(profileId) {
  return {
    course: readJson(path.join(rootDir, 'data', 'universities', `${profileId}.json`)),
    config: readJson(path.join(rootDir, 'data', 'interview-band-configs', `${profileId}.json`))
  };
}

function classifyWithUcatRule(ucatRule, applicantChanges = {}) {
  const { course, config } = loadProfile('cardiff-a100');
  const fixture = readJson(
    path.join(rootDir, 'data', 'fixtures', 'interview-band-classification', 'shared-standard-school-leaver.json')
  );
  const applicant = clone(fixture.applicant);

  Object.assign(applicant.applicant_identity, applicantChanges.identity || {});
  Object.assign(applicant.admissions_tests.ucat, applicantChanges.ucat || {});
  course.stage_1_eligibility.admissions_tests.ucat = {
    ...course.stage_1_eligibility.admissions_tests.ucat,
    ...ucatRule
  };

  return {
    applicant,
    course,
    config,
    result: classifyInterviewBand(course, config, applicant)
  };
}

function assertRejected(result, message) {
  assert.strictEqual(result.eligibility.status, 'not_eligible', message);
  assert.ok(
    result.eligibility.failures.includes('minimum_ucat_total_not_met'),
    `${message}: expected minimum_ucat_total_not_met`
  );
  assert.strictEqual(result.canonical_interview_band, 'not_eligible');
}

function assertProceeds(result, message) {
  assert.strictEqual(result.eligibility.status, 'eligible', message);
  assert.ok(
    !result.eligibility.failures.includes('minimum_ucat_total_not_met'),
    `${message}: did not expect minimum_ucat_total_not_met`
  );
  assert.notStrictEqual(result.canonical_interview_band, 'not_eligible');
}

const sharedBelow = classifyWithUcatRule(
  {
    minimum_total_score: 1800,
    group_minimum_total_scores: []
  },
  { ucat: { total_score: 1799 } }
);
assertRejected(sharedBelow.result, 'Shared UCAT minimum must reject scores below the shared floor.');

const sharedAtFloor = classifyWithUcatRule(
  {
    minimum_total_score: 1800,
    group_minimum_total_scores: []
  },
  { ucat: { total_score: 1800 } }
);
assertProceeds(sharedAtFloor.result, 'Shared UCAT minimum must allow scores at the shared floor.');

const noFixedMinimum = classifyWithUcatRule(
  {
    minimum_total_score: null,
    group_minimum_total_scores: []
  },
  { ucat: { total_score: 1200 } }
);
assertProceeds(noFixedMinimum.result, 'Null/no fixed UCAT minimum must not create a hard UCAT floor.');

const groupedRule = {
  minimum_total_score: null,
  group_minimum_total_scores: [
    {
      applies_to_group_ids: ['home_fee'],
      minimum_total_score: 1700
    },
    {
      all_group_ids: ['international_fee'],
      any_group_ids: ['school_leaver'],
      excluded_group_ids: ['graduate_applicant'],
      minimum_total_score: 1950
    }
  ]
};

const homeBelow = classifyWithUcatRule(groupedRule, { ucat: { total_score: 1699 } });
assertRejected(homeBelow.result, 'Home-specific UCAT minimum must reject Home applicants below their floor.');
assert.strictEqual(
  resolveUcatMinimumTotalScore(groupedRule, homeBelow.result.applicant_group_ids),
  1700
);

const homeAtFloor = classifyWithUcatRule(groupedRule, { ucat: { total_score: 1700 } });
assertProceeds(homeAtFloor.result, 'Home-specific UCAT minimum must allow Home applicants at their floor.');

const internationalBelow = classifyWithUcatRule(groupedRule, {
  identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International'
  },
  ucat: { total_score: 1949 }
});
assertRejected(
  internationalBelow.result,
  'International-specific UCAT minimum must reject International applicants below their floor.'
);
assert.strictEqual(
  resolveUcatMinimumTotalScore(groupedRule, internationalBelow.result.applicant_group_ids),
  1950
);

const internationalAtFloor = classifyWithUcatRule(groupedRule, {
  identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International'
  },
  ucat: { total_score: 1950 }
});
assertProceeds(
  internationalAtFloor.result,
  'International-specific UCAT minimum must allow International applicants at their floor.'
);

const lowerLevelEligibility = evaluateCourseEligibility(
  internationalBelow.course,
  internationalBelow.applicant
);
assert.strictEqual(lowerLevelEligibility.status, 'not_eligible');
assert.ok(lowerLevelEligibility.failures.includes('minimum_ucat_total_not_met'));

const baselineMatrix = readJson(matrixPath);
const regression = runRegressionProfiles();

const fields = [
  'profile_id',
  'university',
  'eligibility',
  'interview_recommendation',
  'reason',
  'historical_assessment'
];

assert.strictEqual(
  regression.matrix.length,
  baselineMatrix.length,
  'Production regression matrix row count must not drift.'
);

for (let index = 0; index < baselineMatrix.length; index += 1) {
  const before = baselineMatrix[index];
  const after = regression.matrix[index];

  for (const field of fields) {
    assert.strictEqual(
      after[field],
      before[field],
      `Production drift in ${field} for row ${index}: ${before.profile_id} / ${before.university}`
    );
  }

  assert.strictEqual(
    after.result_card.recommendation_display_state,
    before.result_card.recommendation_display_state,
    `Production drift in result card display state for row ${index}: ${before.profile_id} / ${before.university}`
  );
  assert.strictEqual(
    after.result_card.primary_user_facing_recommendation,
    before.result_card.primary_user_facing_recommendation,
    `Production drift in result card recommendation for row ${index}: ${before.profile_id} / ${before.university}`
  );
}

console.log('Applicant-group-specific UCAT hard minimum regression: PASS');
console.log('Shared, null, Home and International UCAT hard minima: PASS');
console.log(`Production behavioural drift: 0/${baselineMatrix.length} matrix rows changed`);
