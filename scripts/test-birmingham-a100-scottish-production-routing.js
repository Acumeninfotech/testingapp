#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');

const readJson = (relativePath) =>
  JSON.parse(
    fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  );

const course = readJson('data/universities/birmingham-a100.json');
const config = readJson('data/interview-band-configs/birmingham-a100.json');

function validApplicant(domicile = 'england') {
  return {
    applicant_identity: {
      domicile,
      fee_status: 'home',
      applicant_type: 'school_leaver',
      resit: {
        has_resits: false
      }
    },

    qualification_route: 'scottish',

    scottish_profile: {
      higher_subjects: [
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' },
        { subject_id: 'english_language', achieved_grade: 'A' },
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'physics', achieved_grade: 'A' }
      ],

      advanced_higher_subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' }
      ]
    },

    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        total_score: 2200,
        score_scale: 2700,
        sjt_band: 2
      }
    },

    graduate_profile: {
      is_graduate: false
    }
  };
}

function academicStatus(applicant) {
  return evaluateCourseEligibility(course, applicant);
}

function removeHigher(applicant, subjectId) {
  applicant.scottish_profile.higher_subjects =
    applicant.scottish_profile.higher_subjects.filter(
      (subject) => subject.subject_id !== subjectId
    );
}

function removeAdvancedHigher(applicant, subjectId) {
  applicant.scottish_profile.advanced_higher_subjects =
    applicant.scottish_profile.advanced_higher_subjects.filter(
      (subject) => subject.subject_id !== subjectId
    );
}

function expectEligible(name, applicant) {
  const eligibility = academicStatus(applicant);
  const classification = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(
    eligibility.status,
    'eligible',
    `${name}: expected academic eligibility`
  );

  assert.strictEqual(
    eligibility.qualification_route,
    'scottish',
    `${name}: expected Scottish qualification route`
  );

  assert.strictEqual(
    eligibility.academic_pathway_id,
    'birmingham_scottish_highers_and_advanced_highers',
    `${name}: unexpected academic pathway`
  );

  assert.strictEqual(
    classification.eligibility?.status,
    'eligible',
    `${name}: classifier must preserve academic eligibility`
  );

  assert.strictEqual(
    classification.guidance_pool_id,
    'home_standard',
    `${name}: expected Birmingham Home standard pool`
  );

  assert.strictEqual(
    classification.ranking?.status,
    'unavailable',
    `${name}: Scottish-only profile must not receive invented GCSE score`
  );

  assert.strictEqual(
    classification.canonical_interview_band,
    'insufficient_evidence',
    `${name}: expected insufficient evidence for GCSE-based ranking`
  );

  console.log(`PASS ${name}`);
}

function expectNotEligible(name, mutate) {
  const applicant = validApplicant('england');

  mutate(applicant);

  const eligibility = academicStatus(applicant);

  assert.strictEqual(
    eligibility.status,
    'not_eligible',
    `${name}: expected not eligible`
  );

  console.log(`PASS ${name}`);
}

console.log(
  'Birmingham A100 Scottish production-path routing regression'
);

expectEligible(
  'england_domicile_valid_scottish_qualifications',
  validApplicant('england')
);

expectEligible(
  'scotland_domicile_valid_scottish_qualifications',
  validApplicant('scotland')
);

expectNotEligible(
  'fewer_than_five_highers',
  (applicant) => removeHigher(applicant, 'physics')
);

expectNotEligible(
  'missing_higher_chemistry',
  (applicant) => removeHigher(applicant, 'chemistry')
);

expectNotEligible(
  'missing_higher_mathematics',
  (applicant) => removeHigher(applicant, 'mathematics')
);

expectNotEligible(
  'missing_higher_english_language',
  (applicant) => removeHigher(applicant, 'english_language')
);

expectNotEligible(
  'missing_higher_biology_and_physics',
  (applicant) => {
    removeHigher(applicant, 'biology');
    removeHigher(applicant, 'physics');

    applicant.scottish_profile.higher_subjects.push(
      { subject_id: 'history', achieved_grade: 'A' },
      { subject_id: 'geography', achieved_grade: 'A' }
    );
  }
);

expectNotEligible(
  'fewer_than_two_advanced_highers',
  (applicant) => removeAdvancedHigher(applicant, 'biology')
);

expectNotEligible(
  'missing_advanced_higher_chemistry',
  (applicant) => {
    removeAdvancedHigher(applicant, 'chemistry');

    applicant.scottish_profile.advanced_higher_subjects.push(
      { subject_id: 'physics', predicted_grade: 'A' }
    );
  }
);

expectNotEligible(
  'higher_grade_below_aaaaa',
  (applicant) => {
    applicant.scottish_profile.higher_subjects[4].achieved_grade = 'B';
  }
);

expectNotEligible(
  'advanced_higher_grade_below_aa',
  (applicant) => {
    applicant.scottish_profile.advanced_higher_subjects[1].predicted_grade = 'B';
  }
);

console.log(
  '\nPASS Birmingham A100 Scottish production-path regression'
);
