const CURRENT_MEDICINE_ENTRY_YEAR = 2027;
const CURRENT_UCAT_TEST_YEAR = 2026;
const {
  normaliseALevelPracticalEndorsements
} = require('./science-practical-endorsement');

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normaliseBooleanEvidence(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalised = normaliseId(value);
  if (['true', 'yes', 'y', 'confirmed', 'same_sitting'].includes(normalised)) {
    return true;
  }
  if (['false', 'no', 'n', 'not_confirmed', 'not_same_sitting'].includes(normalised)) {
    return false;
  }
  return null;
}

function normaliseAgeAtCourseStartBand(value) {
  const normalised = normaliseId(value);
  if (['under_17', 'under17', 'under_seventeen'].includes(normalised)) {
    return 'under_17';
  }
  if (['age_17', '17', 'seventeen'].includes(normalised)) {
    return 'age_17';
  }
  if ([
    'age_18_or_over',
    '18_or_over',
    '18_plus',
    'over_18',
    'eighteen_or_over',
    'age_18_plus'
  ].includes(normalised)) {
    return 'age_18_or_over';
  }
  return null;
}

function evaluateAgeBandAgainstMinimum(ageBand, minimumAge) {
  const band = normaliseAgeAtCourseStartBand(ageBand);
  if (!band || !Number.isFinite(minimumAge)) {
    return null;
  }

  if (band === 'under_17') {
    return {
      status: 'fail',
      age: 16
    };
  }
  if (band === 'age_17') {
    if (minimumAge <= 17) {
      return {
        status: 'pass',
        age: 17
      };
    }
    return {
      status: 'manual_review',
      age: null,
      reason: 'minimum_age_requires_confirmation'
    };
  }
  if (minimumAge <= 18) {
    return {
      status: 'pass',
      age: 18
    };
  }
  return {
    status: 'manual_review',
    age: null,
    reason: 'minimum_age_requires_confirmation'
  };
}

function normaliseALevelSameSittingEvidence(aLevelProfile, applicant) {
  if (!aLevelProfile || typeof aLevelProfile !== 'object') {
    return aLevelProfile;
  }

  const explicit = normaliseBooleanEvidence(aLevelProfile.completed_in_one_sitting);
  const aliases = [
    aLevelProfile.same_sitting_confirmed,
    aLevelProfile.same_sitting?.confirmed,
    aLevelProfile.same_sitting?.completed_in_one_sitting,
    applicant?.same_sitting_confirmed,
    applicant?.same_sitting?.confirmed,
    applicant?.same_sitting?.completed_in_one_sitting
  ];
  const aliasValue = aliases
    .map(normaliseBooleanEvidence)
    .find((value) => typeof value === 'boolean');

  return {
    ...aLevelProfile,
    completed_in_one_sitting:
      typeof explicit === 'boolean'
        ? explicit
        : aliasValue ?? aLevelProfile.completed_in_one_sitting
  };
}

function isStandardUndergraduateMedicine(applicant, course) {
  const identity = applicant?.applicant_identity || {};
  const target = applicant?.course_target || {};
  const courseCode = String(
    target.ucas_code ||
    course?.course?.ucas_code ||
    ''
  ).toUpperCase();
  const discipline = normaliseId(target.discipline || course?.course?.discipline || 'medicine');
  const route = normaliseId(
    applicant?.qualification_route ||
    target.course_route ||
    target.entry_route
  );
  const isGraduate =
    applicant?.graduate_profile?.is_graduate === true ||
    identity.graduate === true ||
    route === 'graduate';

  return (
    discipline === 'medicine' &&
    ['A100', 'A106'].includes(courseCode) &&
    !isGraduate
  );
}

function normaliseApplicantProfile(applicant, options = {}) {
  if (!applicant || typeof applicant !== 'object') {
    throw new TypeError('An applicant profile is required.');
  }

  const profile = applicant.a_level_profile
    ? {
        ...applicant,
        a_level_profile: normaliseALevelPracticalEndorsements(
          normaliseALevelSameSittingEvidence(
            applicant.a_level_profile,
            applicant
          )
        )
      }
    : applicant;

  if (!isStandardUndergraduateMedicine(profile, options.course)) {
    return profile;
  }

  const admissionsTests = profile.admissions_tests || {};
  const ucat = admissionsTests.ucat || {};
  const identity = profile.applicant_identity || {};
  const ageBand = normaliseAgeAtCourseStartBand(identity.age_at_course_start_band);
  const ageOnReferenceDates = ageBand === 'age_18_or_over'
    ? {
        age_on_1_september: 18,
        age_on_1_october: 18
      }
    : ageBand === 'under_17'
      ? {
          age_on_1_september: 16,
          age_on_1_october: 16
        }
      : {};

  return {
    ...profile,
    applicant_identity: {
      ...identity,
      ...(ageBand ? { age_at_course_start_band: ageBand } : {}),
      ...ageOnReferenceDates
    },
    application_year:
      profile.application_year ?? CURRENT_MEDICINE_ENTRY_YEAR,
    admissions_tests: {
      ...admissionsTests,
      ucat: {
        ...ucat,
        test_year: ucat.test_year ?? CURRENT_UCAT_TEST_YEAR
      }
    }
  };
}

function expectedUcatTestYear(applicationYear) {
  if (applicationYear === CURRENT_MEDICINE_ENTRY_YEAR) {
    return CURRENT_UCAT_TEST_YEAR;
  }

  // Historic fixtures used application_year to mean the UCAT/application
  // calendar year. Preserve that convention outside the active 2027 cycle.
  return applicationYear;
}

function isUcatCycleValid(applicationYear, testYear) {
  return (
    Number.isInteger(applicationYear) &&
    Number.isInteger(testYear) &&
    testYear === expectedUcatTestYear(applicationYear)
  );
}

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function referenceDateForAge(rule, entryYear) {
  const label =
    rule.age_reference_date ||
    rule.minimum_age_date ||
    rule.minimum_age_policy ||
    rule.course_start_reference ||
    rule.age_date ||
    '1 September';
  const match = String(label).match(/(\d{1,2})\s+([A-Za-z]+)/);
  const day = match ? Number(match[1]) : 1;
  const month = match ? MONTH_INDEX[match[2].toLowerCase()] : MONTH_INDEX.september;

  return new Date(Date.UTC(
    entryYear,
    Number.isInteger(month) ? month : MONTH_INDEX.september,
    day
  ));
}

function ageAtDate(dateOfBirth, referenceDate) {
  if (!dateOfBirth || !(referenceDate instanceof Date)) {
    return null;
  }

  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth > referenceDate) {
    return null;
  }

  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  if (
    referenceDate.getUTCMonth() < birth.getUTCMonth() ||
    (
      referenceDate.getUTCMonth() === birth.getUTCMonth() &&
      referenceDate.getUTCDate() < birth.getUTCDate()
    )
  ) {
    age -= 1;
  }
  return age;
}

function evaluateExplicitMinimumAge(course, applicant) {
  const rule =
    course?.stage_1_eligibility?.age_or_professional_checks ||
    course?.stage_1_eligibility?.age_or_degree ||
    {};
  const minimumAge = Number.isFinite(rule.minimum_age)
    ? rule.minimum_age
    : rule.minimum_age_by_course_start;
  const hasOfficialRequirement =
    Number.isFinite(minimumAge) &&
    Array.isArray(rule.source_ids) &&
    rule.source_ids.length > 0;

  if (!hasOfficialRequirement) {
    return {
      status: 'not_applicable',
      minimum_age: null,
      age: null,
      blocks_prediction: false
    };
  }

  const identity = applicant?.applicant_identity || {};
  const bandAssessment = evaluateAgeBandAgainstMinimum(
    identity.age_at_course_start_band,
    minimumAge
  );
  if (bandAssessment) {
    if (bandAssessment.status === 'manual_review') {
      return {
        status: 'manual_review',
        minimum_age: minimumAge,
        age: null,
        blocks_prediction: false,
        manual_review_reason: bandAssessment.reason
      };
    }
    return {
      status: bandAssessment.status,
      minimum_age: minimumAge,
      age: bandAssessment.age,
      blocks_prediction: bandAssessment.status === 'fail'
    };
  }

  const suppliedAge = identity.age_on_1_september;
  const entryYear =
    applicant?.entry_year ??
    applicant?.application_year ??
    course?.course?.entry_year ??
    CURRENT_MEDICINE_ENTRY_YEAR;
  const calculatedAge = Number.isFinite(suppliedAge)
    ? suppliedAge
    : ageAtDate(
        applicant?.applicant_identity?.date_of_birth,
        referenceDateForAge(rule, entryYear)
      );

  if (!Number.isFinite(calculatedAge)) {
    return {
      status: 'not_assessed',
      minimum_age: minimumAge,
      age: null,
      blocks_prediction: false
    };
  }

  const passed = calculatedAge >= minimumAge;
  return {
    status: passed ? 'pass' : 'fail',
    minimum_age: minimumAge,
    age: calculatedAge,
    blocks_prediction: !passed
  };
}

module.exports = {
  CURRENT_MEDICINE_ENTRY_YEAR,
  CURRENT_UCAT_TEST_YEAR,
  ageAtDate,
  evaluateExplicitMinimumAge,
  evaluateAgeBandAgainstMinimum,
  expectedUcatTestYear,
  isStandardUndergraduateMedicine,
  isUcatCycleValid,
  normaliseAgeAtCourseStartBand,
  normaliseApplicantProfile
};
