#!/usr/bin/env node

const assert = require('assert');
const {
  CURRENT_MEDICINE_ENTRY_YEAR,
  CURRENT_UCAT_TEST_YEAR,
  evaluateExplicitMinimumAge,
  isUcatCycleValid,
  normaliseApplicantProfile
} = require('../assets/js/engine/applicant-profile-normaliser');

const course = {
  course: {
    ucas_code: 'A100',
    entry_year: 2027
  },
  stage_1_eligibility: {
    age_or_professional_checks: {
      minimum_age: 17,
      age_reference_date: '1 September in the year of entry',
      source_ids: ['official_course_page']
    }
  }
};

const applicant = {
  applicant_identity: {
    graduate: false
  },
  course_target: {
    discipline: 'medicine',
    ucas_code: 'A100',
    course_route: 'standard'
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'Chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      {
        subject_id: 'mathematics',
        predicted_grade: 'A',
        practical_endorsement: null
      }
    ],
    practical_passes: {
      chemistry: true,
      biology: false,
      mathematics: true
    }
  },
  admissions_tests: {
    ucat: {
      total_score: 2350
    }
  }
};

const normalised = normaliseApplicantProfile(applicant, { course });
assert.notStrictEqual(normalised, applicant);
assert.strictEqual(normalised.application_year, CURRENT_MEDICINE_ENTRY_YEAR);
assert.strictEqual(
  normalised.admissions_tests.ucat.test_year,
  CURRENT_UCAT_TEST_YEAR
);
assert.strictEqual(applicant.application_year, undefined);
assert.strictEqual(applicant.admissions_tests.ucat.test_year, undefined);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    normalised.a_level_profile,
    'practical_passes'
  ),
  false
);
assert.deepStrictEqual(
  normalised.a_level_profile.subjects.map((subject) => {
    return [subject.subject_id, subject.practical_endorsement];
  }),
  [
    ['Chemistry', 'pass'],
    ['biology', 'fail'],
    ['mathematics', null]
  ]
);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    applicant.a_level_profile,
    'practical_passes'
  ),
  true
);
assert.strictEqual(
  isUcatCycleValid(
    normalised.application_year,
    normalised.admissions_tests.ucat.test_year
  ),
  true
);

const explicitWrongCycle = normaliseApplicantProfile({
  ...applicant,
  admissions_tests: {
    ucat: {
      total_score: 2350,
      test_year: 2025
    }
  }
}, { course });
assert.strictEqual(explicitWrongCycle.admissions_tests.ucat.test_year, 2025);
assert.strictEqual(
  isUcatCycleValid(
    explicitWrongCycle.application_year,
    explicitWrongCycle.admissions_tests.ucat.test_year
  ),
  false
);

assert.deepStrictEqual(
  evaluateExplicitMinimumAge(course, normalised),
  {
    status: 'not_assessed',
    minimum_age: 17,
    age: null,
    blocks_prediction: false
  }
);

const canonicalValues = normaliseApplicantProfile({
  ...applicant,
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', practical_endorsement: 'passed' },
      { subject_id: 'biology', practical_endorsement: 'failed' },
      { subject_id: 'mathematics' }
    ]
  }
}, { course });
assert.deepStrictEqual(
  canonicalValues.a_level_profile.subjects.map((subject) => {
    return subject.practical_endorsement;
  }),
  ['pass', 'fail', null]
);

const sharedSciencePractical = normaliseApplicantProfile({
  ...applicant,
  a_level_profile: {
    subjects: [
      {
        subject_id: 'chemistry',
        predicted_grade: 'A',
        practical_endorsement: null
      },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'A' }
    ],
    science_practical_endorsement: 'Pass'
  }
}, { course });
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    sharedSciencePractical.a_level_profile,
    'science_practical_endorsement'
  ),
  false
);
assert.deepStrictEqual(
  sharedSciencePractical.a_level_profile.subjects.map((subject) => {
    return [subject.subject_id, subject.practical_endorsement];
  }),
  [
    ['chemistry', 'pass'],
    ['biology', 'pass'],
    ['mathematics', null]
  ]
);

const underAge = {
  ...normalised,
  applicant_identity: {
    ...normalised.applicant_identity,
    date_of_birth: '2011-09-02'
  }
};
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(course, underAge),
  {
    status: 'fail',
    minimum_age: 17,
    age: 15,
    blocks_prediction: true
  }
);

const age17Band = {
  ...normalised,
  applicant_identity: {
    ...normalised.applicant_identity,
    age_at_course_start_band: 'age_17'
  }
};
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(course, age17Band),
  {
    status: 'pass',
    minimum_age: 17,
    age: 17,
    blocks_prediction: false
  }
);

const under17Band = {
  ...normalised,
  applicant_identity: {
    ...normalised.applicant_identity,
    age_at_course_start_band: 'under_17',
    date_of_birth: '2000-01-01'
  }
};
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(course, under17Band),
  {
    status: 'fail',
    minimum_age: 17,
    age: 16,
    blocks_prediction: true
  }
);

const age18Band = {
  ...normalised,
  applicant_identity: {
    ...normalised.applicant_identity,
    age_at_course_start_band: 'age_18_or_over'
  }
};
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(course, age18Band),
  {
    status: 'pass',
    minimum_age: 17,
    age: 18,
    blocks_prediction: false
  }
);

const age18Course = {
  ...course,
  stage_1_eligibility: {
    age_or_professional_checks: {
      minimum_age: 18,
      age_reference_date: '1 September in the year of entry',
      source_ids: ['official_course_page']
    }
  }
};
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(age18Course, age17Band),
  {
    status: 'manual_review',
    minimum_age: 18,
    age: null,
    blocks_prediction: false,
    manual_review_reason: 'minimum_age_requires_confirmation'
  }
);

console.log('Applicant profile normaliser: PASS');
