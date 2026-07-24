#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');

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

function withSameSittingOptIn(course, qualificationRoutes = ['a_level']) {
  const optedIn = clone(course);
  optedIn.stage_1_eligibility.academic_requirements = {
    ...(optedIn.stage_1_eligibility.academic_requirements || {}),
    same_sitting: {
      required: true,
      qualification_routes: qualificationRoutes
    }
  };
  return optedIn;
}

const course = readJson('data/universities/bristol-a100.json');
const config = readJson('data/interview-band-configs/bristol-a100.json');
const fixture = readJson(
  'data/fixtures/interview-band-classification/bristol-a100.json'
);

const noOptInFalse = merge(fixture.base_applicant, {
  a_level_profile: {
    completed_in_one_sitting: false
  }
});
const noOptInEligibility = evaluateCourseEligibility(course, noOptInFalse);
const noOptInClassification = classifyInterviewBand(course, config, noOptInFalse);
assert.strictEqual(noOptInClassification.eligibility.status, 'eligible');
assert.strictEqual(noOptInClassification.canonical_interview_band, 'realistic');
assert.ok(!noOptInEligibility.failures.includes('same_sitting_requirement_not_met'));
assert.ok(
  !noOptInEligibility.manual_review_reasons.includes(
    'same_sitting_evidence_missing:a_level_profile.completed_in_one_sitting'
  )
);
assert.ok(
  !noOptInClassification.eligibility.failures.includes(
    'same_sitting_requirement_not_met'
  )
);

const optedInCourse = withSameSittingOptIn(course);
const explicitFalse = classifyInterviewBand(
  optedInCourse,
  config,
  noOptInFalse
);
assert.strictEqual(explicitFalse.eligibility.status, 'not_eligible');
assert.strictEqual(explicitFalse.canonical_interview_band, 'not_eligible');
assert.ok(
  explicitFalse.eligibility.failures.includes('same_sitting_requirement_not_met')
);
assert.strictEqual(
  evaluateCourseEligibility(optedInCourse, noOptInFalse).status,
  'not_eligible'
);

const explicitTrueApplicant = merge(fixture.base_applicant, {
  a_level_profile: {
    completed_in_one_sitting: true
  }
});
const explicitTrue = classifyInterviewBand(
  optedInCourse,
  config,
  explicitTrueApplicant
);
assert.strictEqual(explicitTrue.eligibility.status, 'eligible');
assert.strictEqual(explicitTrue.canonical_interview_band, 'realistic');
assert.ok(
  !evaluateCourseEligibility(optedInCourse, explicitTrueApplicant)
    .failures.includes('same_sitting_requirement_not_met')
);

const missingEvidence = classifyInterviewBand(
  optedInCourse,
  config,
  fixture.base_applicant
);
assert.strictEqual(missingEvidence.eligibility.status, 'manual_review');
assert.strictEqual(missingEvidence.canonical_interview_band, 'insufficient_evidence');
assert.ok(
  missingEvidence.eligibility.manual_review_reasons.includes(
    'same_sitting_evidence_missing:a_level_profile.completed_in_one_sitting'
  )
);

const ibOptInCourse = withSameSittingOptIn(course, ['international_baccalaureate']);
const ibApplicant = merge(fixture.base_applicant, {
  qualification_route: 'international_baccalaureate',
  a_level_profile: null,
  ib_profile: {
    total_points: 38,
    higher_level_subjects: [
      { subject_id: 'chemistry', grade: '6' },
      { subject_id: 'biology', grade: '6' },
      { subject_id: 'mathematics', grade: '6' }
    ]
  }
});
const ibResult = classifyInterviewBand(ibOptInCourse, config, ibApplicant);
assert.strictEqual(ibResult.eligibility.status, 'manual_review');
assert.strictEqual(ibResult.canonical_interview_band, 'insufficient_evidence');
assert.ok(
  ibResult.eligibility.manual_review_reasons.includes(
    'same_sitting_evidence_not_supported_for_route:international_baccalaureate'
  )
);

const plymouthCourse = readJson('data/universities/plymouth-a100.json');
const plymouthConfig = readJson('data/interview-band-configs/plymouth-a100.json');
const scottishOptInCourse = withSameSittingOptIn(plymouthCourse, ['scottish']);
const scottishApplicant = merge(fixture.base_applicant, {
  qualification_route: 'scottish',
  a_level_profile: null,
  applicant_identity: {
    contextual: false,
    widening_participation: false
  },
  gcse_profile: {
    subjects: {
      english_language: '6',
      mathematics: '6',
      biology: '6',
      chemistry: '6',
      physics: '6',
      history: '6',
      geography: '6'
    },
    total_gcse_count: 7
  },
  scottish_profile: {
    national_5_subjects: [
      { subject_id: 'english_language', grade: 'A' },
      { subject_id: 'mathematics', grade: 'A' }
    ],
    higher_subjects: [],
    advanced_higher_subjects: [
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'mathematics', grade: 'A' }
    ]
  }
});
const scottishResult = classifyInterviewBand(
  scottishOptInCourse,
  plymouthConfig,
  scottishApplicant
);
assert.strictEqual(scottishResult.eligibility.status, 'manual_review');
assert.strictEqual(scottishResult.canonical_interview_band, 'insufficient_evidence');
assert.ok(
  scottishResult.eligibility.manual_review_reasons.includes(
    'same_sitting_evidence_not_supported_for_route:scottish'
  )
);

console.log('Generic same-sitting opt-in regression: PASS');
console.log('Backward compatibility without opt-in: PASS');
console.log('A-level explicit true/false and missing evidence: PASS');
console.log('IB and Scottish unsupported evidence routes use manual review: PASS');
