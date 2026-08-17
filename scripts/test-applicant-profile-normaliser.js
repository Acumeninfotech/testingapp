#!/usr/bin/env node

const assert = require('assert');
const {
  CURRENT_MEDICINE_ENTRY_YEAR,
  CURRENT_UCAT_TEST_YEAR,
  evaluateExplicitMinimumAge,
  evaluateAgeBandAgainstMaximumExclusive,
  isUcatCycleValid,
  normaliseAgeAtCourseStartBand,
  normaliseContextualProfile,
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
    age_at_course_start_band: 'age_18'
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

const legacyBroadAgeBand = {
  ...normalised,
  applicant_identity: {
    ...normalised.applicant_identity,
    age_at_course_start_band: 'age_18_or_over'
  }
};
assert.strictEqual(
  normaliseAgeAtCourseStartBand('age_18_or_over'),
  'age_18_or_over_legacy'
);
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(course, legacyBroadAgeBand),
  {
    status: 'pass',
    minimum_age: 17,
    age: null,
    blocks_prediction: false
  }
);
assert.deepStrictEqual(
  evaluateExplicitMinimumAge(age18Course, legacyBroadAgeBand),
  {
    status: 'pass',
    minimum_age: 18,
    age: null,
    blocks_prediction: false
  }
);
assert.deepStrictEqual(
  evaluateAgeBandAgainstMaximumExclusive('age_18_or_over', 21),
  {
    status: 'manual_review',
    age: null,
    reason: 'maximum_age_requires_confirmation'
  }
);
assert.deepStrictEqual(
  evaluateAgeBandAgainstMaximumExclusive('age_18', 21),
  {
    status: 'pass',
    age: 18
  }
);
assert.deepStrictEqual(
  evaluateAgeBandAgainstMaximumExclusive('age_19', 21),
  {
    status: 'pass',
    age: 19
  }
);
assert.deepStrictEqual(
  evaluateAgeBandAgainstMaximumExclusive('age_20', 21),
  {
    status: 'pass',
    age: 20
  }
);
assert.deepStrictEqual(
  evaluateAgeBandAgainstMaximumExclusive('age_21_or_over', 21),
  {
    status: 'fail',
    age: 21
  }
);

const emptyContextualProfile = normaliseContextualProfile({});
assert.strictEqual(emptyContextualProfile.home_area_region.polar4_quintile, 'unknown');
assert.strictEqual(emptyContextualProfile.home_area_region.simd_quintile, '');
assert.strictEqual(emptyContextualProfile.access_programmes.ukwpmed.status, 'no');
assert.deepStrictEqual(emptyContextualProfile.access_programmes.other_programmes, []);
assert.strictEqual(emptyContextualProfile.school_education.current_or_most_recent_uk_school_independent_fee_paying, undefined);
assert.strictEqual(emptyContextualProfile.school_education.attended_uk_school_or_college_for_gcse_or_equivalent, 'not_sure');
assert.strictEqual(emptyContextualProfile.personal_circumstances.ukrainian_visa_scheme, 'not_sure');

const legacyExplicitUncertaintyProfile = normaliseContextualProfile({
  contextual_profile: {
    home_area_region: {
      simd_quintile: 'unknown'
    },
    school_education: {
      current_or_most_recent_uk_school_independent_fee_paying: 'not_sure'
    }
  }
});
assert.strictEqual(legacyExplicitUncertaintyProfile.home_area_region.simd_quintile, 'unknown');
assert.strictEqual(
  legacyExplicitUncertaintyProfile.school_education.current_or_most_recent_uk_school_independent_fee_paying,
  'not_sure'
);

const normalisedSharedFacts = normaliseApplicantProfile({
  ...applicant,
  applicant_identity: {
    graduate: false,
    age_at_course_start_band: 'age_20',
    current_uk_residence: true
  },
  contextual_profile: {
    school_education: {
      attended_uk_school_or_college_for_gcse_or_equivalent: 'yes',
      attended_uk_school_or_college_for_post16_or_equivalent: false
    },
    personal_circumstances: {
      care_over_three_months: true,
      uk_refugee_status_granted: 'no',
      ukrainian_visa_scheme: 'ukraine_family_scheme'
    }
  }
}, { course });
assert.strictEqual(normalisedSharedFacts.applicant_identity.current_uk_residence, 'yes');
assert.strictEqual(normalisedSharedFacts.applicant_identity.age_at_course_start_band, 'age_20');
assert.strictEqual(normalisedSharedFacts.applicant_identity.age_on_1_september, 20);
assert.strictEqual(normalisedSharedFacts.contextual_profile.school_education.attended_uk_school_or_college_for_gcse_or_equivalent, 'yes');
assert.strictEqual(normalisedSharedFacts.contextual_profile.school_education.attended_uk_school_or_college_for_post16_or_equivalent, 'no');
assert.strictEqual(normalisedSharedFacts.contextual_profile.personal_circumstances.care_over_three_months, 'yes');
assert.strictEqual(normalisedSharedFacts.contextual_profile.personal_circumstances.uk_refugee_status_granted, 'no');
assert.strictEqual(normalisedSharedFacts.contextual_profile.personal_circumstances.ukrainian_visa_scheme, 'ukraine_family_scheme');

const normalisedLegacyBroadAge = normaliseApplicantProfile({
  ...applicant,
  applicant_identity: {
    graduate: false,
    age_at_course_start_band: 'age_18_or_over'
  }
}, { course: age18Course });
assert.strictEqual(normalisedLegacyBroadAge.applicant_identity.age_at_course_start_band, 'age_18_or_over_legacy');
assert.strictEqual('age_on_1_september' in normalisedLegacyBroadAge.applicant_identity, false);
assert.strictEqual('age_on_1_october' in normalisedLegacyBroadAge.applicant_identity, false);

const legacySteps2Medicine = normaliseApplicantProfile({
  ...applicant,
  access_programmes: [
    {
      programme_id: 'keele_steps2medicine',
      status: 'completed'
    },
    {
      programme_id: 'unknown_legacy_access_scheme',
      status: 'participating'
    }
  ]
}, { course });
assert.deepStrictEqual(
  legacySteps2Medicine.contextual_profile.access_programmes.ukwpmed,
  {
    status: 'yes',
    programme_id: 'keele_steps2medicine',
    programme_status: 'completed',
    provider_university_id: 'keele-a100',
    completion_year: '',
    not_sure_programme: false
  }
);
assert.deepStrictEqual(
  legacySteps2Medicine.contextual_profile.access_programmes.other_programmes,
  [
    {
      programme_id: 'unknown_legacy_access_scheme',
      status: 'participating'
    }
  ]
);

const once = normaliseApplicantProfile(legacySteps2Medicine, { course });
const twice = normaliseApplicantProfile(once, { course });
assert.deepStrictEqual(twice.contextual_profile, once.contextual_profile);
assert.strictEqual(
  legacySteps2Medicine.applicant_identity.contextual_flags?.free_school_meals,
  undefined
);

console.log('Applicant profile normaliser: PASS');
