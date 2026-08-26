#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { classifyInterviewBand } = require('../assets/js/engine/interview-band-classifier');
const { predict } = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const course = readJson('data/universities/manchester-a100.json');
const config = readJson('data/interview-band-configs/manchester-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/manchester-a100.json');

function baseApplicant(domicile = 'England') {
  const applicant = clone(fixture.base_applicant);
  applicant.qualification_route = 'a_level';
  applicant.applicant_identity.domicile = domicile;
  return applicant;
}

function higher(subject_id, grade = 'A', overrides = {}) {
  return {
    subject_id,
    achieved_grade: grade,
    school_year: 's5',
    first_attempt: true,
    sitting_id: 's5_main',
    ...overrides
  };
}

function advancedHigher(subject_id, grade = 'A', overrides = {}) {
  return {
    subject_id,
    predicted_grade: grade,
    school_year: 's6',
    first_attempt: true,
    ...overrides
  };
}

function scottishApplicant(domicile = 'Scotland', overrides = {}) {
  const applicant = baseApplicant(domicile);
  applicant.qualification_route = 'scottish';
  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  applicant.scottish_profile = {
    same_sitting_confirmed: true,
    national_5_subjects: [
      { subject_id: 'english_language', grade: 'B' },
      { subject_id: 'mathematics', grade: 'B' },
      { subject_id: 'chemistry', grade: 'B' },
      { subject_id: 'biology', grade: 'B' }
    ],
    higher_subjects: [
      higher('english'),
      higher('mathematics'),
      higher('history'),
      higher('physics')
    ],
    advanced_higher_subjects: [
      advancedHigher('chemistry'),
      advancedHigher('biology'),
      advancedHigher('history')
    ]
  };
  Object.assign(applicant.scottish_profile, overrides);
  return applicant;
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function resultCard(applicant) {
  return predict({
    universityIds: ['manchester-a100'],
    studentProfile: applicant
  })[0].result_card;
}

function assertHomeEligible(applicant, qualificationRoute, pathwayId) {
  const result = classify(applicant);
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.eligibility.qualification_route, qualificationRoute);
  assert.strictEqual(result.guidance_pool_id, 'a106_home_standard_school_leaver');
  assert.ok(result.applicant_group_ids.includes('home_fee'));
  assert.strictEqual(result.eligibility.academic_pathway_id, pathwayId);

  const card = resultCard(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.strictEqual(card.academic_pathway_id, pathwayId);
  if (qualificationRoute === 'scottish') {
    assert.ok(card.academic_requirement_checks.some((check) => {
      return check.requirement_type === 'scottish_post_16_requirements' &&
        check.status === 'met';
    }));
    assert.match(JSON.stringify(card.academic_requirement_checks), /Scottish|National 5/);
  }
  return result;
}

function assertScottishFailure(applicant, failure) {
  const result = classify(applicant);
  assert.strictEqual(result.eligibility.status, 'not_eligible');
  assert.ok(result.eligibility.failures.includes(failure));
  assert.strictEqual(result.canonical_interview_band, 'not_eligible');
}

const englandALevel = assertHomeEligible(
  baseApplicant('England'),
  'a_level',
  'manchester_standard_offer'
);
const scotlandALevel = assertHomeEligible(
  baseApplicant('Scotland'),
  'a_level',
  'manchester_standard_offer'
);
const englandScottish = assertHomeEligible(
  scottishApplicant('England'),
  'scottish',
  'manchester_scottish_ah_aaa'
);
const scotlandScottish = assertHomeEligible(
  scottishApplicant('Scotland'),
  'scottish',
  'manchester_scottish_ah_aaa'
);

assert.strictEqual(englandALevel.guidance_pool_id, scotlandALevel.guidance_pool_id);
assert.strictEqual(englandScottish.guidance_pool_id, scotlandScottish.guidance_pool_id);

const alternative = scottishApplicant('Scotland');
alternative.scottish_profile.advanced_higher_subjects = [
  advancedHigher('chemistry'),
  advancedHigher('mathematics')
];
alternative.scottish_profile.higher_subjects.push(
  higher('modern_studies', 'A', { school_year: 's6', sitting_id: 's6_main' })
);
assertHomeEligible(
  alternative,
  'scottish',
  'manchester_scottish_ah_aa_plus_new_higher_a'
);

const resitHigher = scottishApplicant();
resitHigher.scottish_profile.higher_subjects[0].first_attempt = false;
assertScottishFailure(resitHigher, 'scottish_post_16_requirements_not_met');

const splitSitting = scottishApplicant();
splitSitting.scottish_profile.same_sitting_confirmed = false;
assertScottishFailure(splitSitting, 'scottish_post_16_requirements_not_met');

const missingSecondScience = scottishApplicant();
missingSecondScience.scottish_profile.advanced_higher_subjects = [
  advancedHigher('chemistry'),
  advancedHigher('history'),
  advancedHigher('english')
];
assertScottishFailure(missingSecondScience, 'scottish_post_16_requirements_not_met');

const weakNational5 = scottishApplicant();
weakNational5.scottish_profile.higher_subjects = weakNational5.scottish_profile
  .higher_subjects.map((subject) => {
    return subject.subject_id === 'english' ? { ...subject, subject_id: 'geography' } : subject;
  });
weakNational5.scottish_profile.national_5_subjects = weakNational5.scottish_profile
  .national_5_subjects.map((subject) => {
    return subject.subject_id === 'english_language' ? { ...subject, grade: 'C' } : subject;
  });
assertScottishFailure(weakNational5, 'national_5_requirements_not_met');

console.log('Manchester A100/A106 Scottish production routing: PASS');
console.log('PASS four domicile/qualification combinations and Home pool independence');
console.log('PASS AAA Advanced Higher and AA plus new Higher A routes');
console.log('PASS first-attempt, same-sitting, subject-combination and National 5 gates');
