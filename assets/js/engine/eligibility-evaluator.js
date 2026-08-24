const GCSE_GRADE_RANK = {
  U: 0,
  G: 1,
  F: 2,
  E: 3,
  D: 4,
  C: 5,
  '4': 5,
  '5': 5.5,
  B: 6,
  '6': 6,
  A: 7,
  '7': 7,
  '8': 8,
  'A*': 9,
  '9': 9
};

const A_LEVEL_GRADE_RANK = {
  U: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  'A*': 6
};

const DEGREE_CLASSIFICATION_RANK = {
  third: 1,
  '2_2': 2,
  lower_second: 2,
  '2_1': 3,
  upper_second: 3,
  first: 4,
  first_class: 4
};

const IRISH_LEAVING_CERTIFICATE_GRADE_RANK = {
  H8: 1,
  H7: 2,
  H6: 3,
  H5: 4,
  H4: 5,
  H3: 6,
  H2: 7,
  H1: 8
};

const {
  isUcatCycleValid,
  normaliseApplicantProfile
} = require('./applicant-profile-normaliser');
const {
  assessPracticalEndorsements
} = require('./science-practical-endorsement');
const {
  evaluateGraduateCompensatoryPolicy,
  getGraduateCompensatoryPolicy
} = require('./graduate-compensatory-policy');
const {
  contextualFlagApplicantGroupIds,
  feeStatusApplicantGroupIds
} = require('./applicant-group-normalisation');
const {
  evaluateContextualEligibility: evaluateSharedContextualEligibility
} = require('./contextual-eligibility-framework');
const {
  DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
} = require('./contextual-eligibility-evaluators');
const {
  getRecognisedUkwpmedProgramme,
  isUkwpmedRecognisedByMedicalSchool
} = require('./contextual-profile-registry');

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normaliseGrade(value) {
  return String(value ?? '').trim().toUpperCase();
}

function gradeRank(value, level) {
  const grade = normaliseGrade(value);
  const ranks = level === 'gcse' ? GCSE_GRADE_RANK : A_LEVEL_GRADE_RANK;
  return ranks[grade] ?? null;
}

function minimumGradeRank(value, level) {
  const ranks = String(value ?? '')
    .split('/')
    .map((grade) => gradeRank(grade, level))
    .filter(Number.isFinite);

  return ranks.length ? Math.min(...ranks) : null;
}

function gradeMeets(value, minimum, level) {
  const actualRank = gradeRank(value, level);
  const requiredRank = minimumGradeRank(minimum, level);
  return Number.isFinite(actualRank) &&
    Number.isFinite(requiredRank) &&
    actualRank >= requiredRank;
}

function gradeProfileMeets(actualGrades, requiredGrades, level = 'a_level') {
  const actual = actualGrades
    .map((grade) => gradeRank(grade, level))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const required = requiredGrades
    .map((grade) => gradeRank(grade, level))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  return required.length > 0 &&
    actual.length >= required.length &&
    required.every((rank, index) => actual[index] >= rank);
}

function profileToSubjectMap(profile) {
  const result = {};
  const subjects = profile?.subjects || {};

  if (Array.isArray(subjects)) {
    for (const subject of subjects) {
      const subjectId = normaliseId(subject?.subject_id);
      if (!subjectId) {
        continue;
      }
      result[subjectId] =
        subject.achieved_grade ??
        subject.predicted_grade ??
        subject.grade ??
        subject.higher_level_grade;
    }
  } else {
    for (const [subjectId, grade] of Object.entries(subjects)) {
      result[normaliseId(subjectId)] = grade;
    }
  }

  for (const subject of profile?.additional_subjects || []) {
    const subjectId = normaliseId(subject?.subject_id);
    if (subjectId) {
      result[subjectId] = subject.grade;
    }
  }

  return result;
}

function getALevelSubjectMap(applicant) {
  return profileToSubjectMap(applicant.a_level_profile);
}

function getCountableALevelSubjectMap(subjectGrades, rules) {
  const countable = { ...subjectGrades };

  for (const group of rules?.non_double_count_subject_groups || []) {
    const present = group
      .map(normaliseId)
      .filter((subjectId) => countable[subjectId] !== undefined);
    for (const subjectId of present.slice(1)) {
      delete countable[subjectId];
    }
  }

  return countable;
}

function getIbHigherLevelSubjectMap(applicant) {
  const profile = applicant.ib_profile || {};
  return profileToSubjectMap({
    subjects: profile.higher_level_subjects || profile.hl_subjects || profile.subjects || []
  });
}

function deriveQualificationRoute(applicant) {
  const explicitRoute = normaliseId(
    applicant.qualification_route ||
    applicant.route ||
    applicant.course_target?.qualification_route
  );

  if (explicitRoute) {
    return explicitRoute;
  }
  if (applicant.foundation_profile) {
    return 'foundation';
  }
  if (applicant.scottish_profile) {
    return 'scottish';
  }
  if (applicant.t_level_profile && applicant.a_level_profile) {
    return 'mixed_t_level_a_level';
  }
  if (applicant.t_level_profile) {
    return 't_level';
  }
  if (applicant.access_to_he_profile) {
    return 'access_to_he';
  }
  if (applicant.btec_profile) {
    return 'btec';
  }
  if (
    applicant.ib_profile &&
    (
      Number.isFinite(applicant.ib_profile.total_points) ||
      (applicant.ib_profile.higher_level_subjects || applicant.ib_profile.hl_subjects || []).length > 0
    )
  ) {
    return 'international_baccalaureate';
  }
  if (
    applicant.graduate_profile?.is_graduate === true ||
    applicant.applicant_identity?.graduate === true
  ) {
    return 'graduate';
  }
  if (applicant.a_level_profile) {
    return 'a_level';
  }

  return 'unknown';
}

function deriveApplicantGroupIds(applicant) {
  const identity = applicant.applicant_identity || {};
  const route = deriveQualificationRoute(applicant);
  const groups = new Set(applicant.applicant_group_ids || []);
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  const applicantType = normaliseId(identity.applicant_type);

  for (const groupId of feeStatusApplicantGroupIds(feeStatus)) {
    groups.add(groupId);
  }

  const domicileGroups = {
    england: ['england_domiciled', 'rest_of_uk'],
    scotland: ['scotland_domiciled'],
    wales: ['wales_domiciled', 'rest_of_uk'],
    northern_ireland: ['northern_ireland_domiciled', 'rest_of_uk']
  };
  for (const groupId of domicileGroups[domicile] || []) {
    groups.add(groupId);
  }

  for (const groupId of contextualFlagApplicantGroupIds(identity.contextual_flags || {})) {
    groups.add(groupId);
  }

  if (applicantType.includes('mature')) {
    groups.add('mature_applicant');
  }

  const isGraduate =
    route === 'graduate' ||
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true;
  if (isGraduate) {
    groups.add('graduate_applicant');
  } else if (
    !applicantType.includes('mature') &&
    applicantType.includes('school') ||
    applicantType.includes('standard') ||
    applicantType === '' ||
    route !== 'unknown'
  ) {
    groups.add('school_leaver');
  }

  const resit = identity.resit || applicant.resit_profile || {};
  if (resit === true || resit.has_resits === true) {
    groups.add('resit_applicant');
  }
  if (identity.deferred_entry === true || applicant.deferred_entry_profile?.initial_deferred_entry === true) {
    groups.add('deferred_entry');
  }

  return [...groups];
}

function contextualEvaluatorIdForCourse(course = {}) {
  return (
    course.contextual_eligibility?.evaluator_id ||
    course.contextual_admissions?.contextual_eligibility?.evaluator_id ||
    course.contextual_admissions?.evaluator_id ||
    null
  );
}

function evaluateContextualEligibility(course, applicant, options = {}) {
  return evaluateSharedContextualEligibility(course, applicant, {
    ...options,
    evaluators: {
      ...DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS,
      ...(options.evaluators || {})
    }
  });
}

function evaluateCourseContextualEligibility(course, applicant) {
  return contextualEvaluatorIdForCourse(course)
    ? evaluateContextualEligibility(course, applicant)
    : null;
}

const COURSES_WITH_CONTEXTUAL_EVALUATOR_GROUP_CONTROL = [
  'aberdeen-a100',
  'aston-a100',
  'bristol-a100',
  'birmingham-a100',
  'dundee-a100',
  'edinburgh-a100',
  'glasgow-a100',
  'st-andrews-a100',
  'plymouth-a100',
  'southampton-a100',
  'ucl-a100',
  'hull-york-a100',
  'king-s-college-london-a100',
  'newcastle-a100'
];

const ABERDEEN_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'simd20',
  'simd40',
  'polar4_quintile_1',
  'polar_quintile_1'
];

const ASTON_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'ucat_bursary',
  'free_school_meals',
  'care_experienced',
  'care_leaver',
  'refugee',
  'asylum_seeker',
  'refugee_or_asylum_seeker',
  'disability',
  'declared_disability',
  'polar4_quintile_1',
  'polar4_quintile_2',
  'polar_quintile_1',
  'polar_quintile_2'
];

const GLASGOW_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'simd20',
  'simd40',
  'refugee',
  'asylum_seeker',
  'refugee_or_asylum_seeker',
  'unpaid_carer',
  'carer',
  'estranged_from_family'
];

const DUNDEE_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'simd20',
  'simd40',
  'refugee',
  'asylum_seeker',
  'refugee_or_asylum_seeker',
  'unpaid_carer',
  'carer',
  'estranged_from_family',
  'polar4_quintile_1',
  'polar_quintile_1'
];

const EDINBURGH_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'simd20',
  'simd40',
  'plus_flag',
  'flag',
  'ucat_bursary'
];

const ST_ANDREWS_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'simd20',
  'simd40',
  'imd_quintile_1',
  'imd_quintile_2',
  'polar4_quintile_1',
  'polar_quintile_1',
  'young_carer',
  'unpaid_carer',
  'carer',
  'estranged_from_family',
  'refugee',
  'asylum_seeker',
  'refugee_or_asylum_seeker'
];

const UCL_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'access_ucl_confirmed',
  'contextual',
  'widening_participation',
  'free_school_meals',
  'care_experienced',
  'care_leaver',
  'estranged_from_family',
  'imd_quintile_1',
  'tundra_quintile_1',
  'polar4_quintile_1',
  'polar_quintile_1',
  'ucat_bursary'
];

const HYMS_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'refugee',
  'asylum_seeker',
  'refugee_or_asylum_seeker',
  'military_family',
  'gypsy_roma_traveller',
  'ucat_bursary',
  'polar4_quintile_1',
  'polar4_quintile_2',
  'polar_quintile_1',
  'polar_quintile_2',
  'school_below_progress_8',
  'first_generation_higher_education',
  'first_generation_university'
];

const KCL_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'care_experienced',
  'care_leaver',
  'free_school_meals',
  'estranged_from_family',
  'young_carer',
  'young_adult_carer',
  'unpaid_carer',
  'carer',
  'refugee',
  'asylum_seeker',
  'refugee_or_asylum_seeker',
  'polar4_quintile_1',
  'polar4_quintile_2',
  'polar_quintile_1',
  'polar_quintile_2',
  'acorn',
  'school_quintile'
];

const NEWCASTLE_LEGACY_CONTEXTUAL_GROUP_IDS = [
  'contextual',
  'widening_participation',
  'free_school_meals',
  'care_experienced',
  'care_leaver',
  'estranged_from_family',
  'young_carer',
  'young_adult_carer',
  'unpaid_carer',
  'carer',
  'imd_quintile_1',
  'imd_quintile_2',
  'tundra_quintile_1',
  'tundra_quintile_2',
  'polar4_quintile_1',
  'polar4_quintile_2',
  'polar_quintile_1',
  'polar_quintile_2'
];

const COURSES_WITH_ACTIVATED_CONTEXTUAL_GROUPS = [
  'aberdeen-a100',
  'aston-a100',
  'imperial-college-london-a100',
  'manchester-a100',
  'leicester-a100',
  'bristol-a100',
  'birmingham-a100',
  'east-anglia-a100',
  'lancaster-a100',
  'liverpool-a100',
  'plymouth-a100',
  'sheffield-a100',
  'nottingham-a100',
  'dundee-a100',
  'edinburgh-a100',
  'glasgow-a100',
  'st-andrews-a100',
  'southampton-a100',
  'ucl-a100',
  'hull-york-a100',
  'king-s-college-london-a100',
  'newcastle-a100'
];

const SCOTTISH_MEDICAL_SCHOOL_ROUTE_IDS = Object.freeze([
  'scotland_standard',
  'scotland_contextual',
  'ruk_standard',
  'ruk_contextual'
]);

function applicantPoolForScottishMedicalSchoolRoute(groupIds = []) {
  const groups = new Set(groupIds);

  if (!groups.has('home_fee') || groups.has('international_fee')) {
    return null;
  }
  if (groups.has('scotland_domiciled')) {
    return 'scotland';
  }
  if (groups.has('rest_of_uk')) {
    return 'ruk';
  }
  return null;
}

function isContextualAcademicRequirement(requirement = {}) {
  const groups = requirement.applies_to_group_ids || [];
  if (normaliseId(requirement.academic_pathway) === 'contextual') {
    return true;
  }
  if (groups.includes('contextual') || groups.includes('widening_participation')) {
    return true;
  }
  const id = normaliseId(
    requirement.pathway_id ||
      requirement.route_id ||
      requirement.requirement_id
  );
  return id.includes('contextual') || id.includes('widening_access');
}

function supportedScottishMedicalSchoolRouteIds(course = {}) {
  const supported = new Set();
  const post16Rules = course.stage_1_eligibility?.post_16 || {};
  const scottishRules = post16Rules.scottish || {};
  const scottishRequirements = Array.isArray(scottishRules.grade_requirements)
    ? scottishRules.grade_requirements
    : [];

  if (scottishRequirements.some((requirement) => !isContextualAcademicRequirement(requirement))) {
    supported.add('scotland_standard');
  }
  if (
    scottishRules.contextual_route_implemented === true &&
    scottishRequirements.some(isContextualAcademicRequirement)
  ) {
    supported.add('scotland_contextual');
  }
  const scottishSupportedApplicantPools = new Set(
    (scottishRules.supported_applicant_pools || []).map(normaliseId)
  );
  if (scottishSupportedApplicantPools.has('ruk') || scottishSupportedApplicantPools.has('rest_of_uk')) {
    if (scottishRequirements.some((requirement) => !isContextualAcademicRequirement(requirement))) {
      supported.add('ruk_standard');
    }
    if (
      scottishRules.contextual_route_implemented === true &&
      scottishRequirements.some(isContextualAcademicRequirement)
    ) {
      supported.add('ruk_contextual');
    }
  }

  const aLevelRequirements = resolveALevelRequirements(post16Rules.a_level || {});
  const isRukAlevelRequirement = (requirement = {}) => {
    const groups = requirement.applies_to_group_ids || [];
    if (groups.includes('international_fee')) {
      return false;
    }
    return groups.length === 0 ||
      groups.includes('rest_of_uk') ||
      !groups.includes('scotland_domiciled');
  };

  if (aLevelRequirements.some((requirement) => {
    return isRukAlevelRequirement(requirement) &&
      !isContextualAcademicRequirement(requirement);
  })) {
    supported.add('ruk_standard');
  }
  if (aLevelRequirements.some((requirement) => {
    return isRukAlevelRequirement(requirement) &&
      isContextualAcademicRequirement(requirement);
  })) {
    supported.add('ruk_contextual');
  }

  return SCOTTISH_MEDICAL_SCHOOL_ROUTE_IDS.filter((routeId) => supported.has(routeId));
}

function isScottishMedicalSchoolRouteCourse(course = {}) {
  return normaliseId(course.university?.nation) === 'scotland';
}

function resolveScottishMedicalSchoolRoute(course, applicant = {}, options = {}) {
  if (!isScottishMedicalSchoolRouteCourse(course)) {
    return null;
  }

  const groupIds = options.applicant_group_ids || deriveApplicantGroupIds(applicant);
  const applicantPool = applicantPoolForScottishMedicalSchoolRoute(groupIds);
  const supportedRouteIds = supportedScottishMedicalSchoolRouteIds(course);

  if (!applicantPool || supportedRouteIds.length === 0) {
    return null;
  }

  const contextualEligibility = options.contextual_eligibility ||
    options.contextualEligibility ||
    evaluateCourseContextualEligibility(course, applicant);
  const contextualConfirmed =
    options.assume_contextual === true ||
    contextualEligibility?.is_contextual === true;
  const contextualRouteId = `${applicantPool}_contextual`;
  const standardRouteId = `${applicantPool}_standard`;
  const resolvedRouteId =
    contextualConfirmed && supportedRouteIds.includes(contextualRouteId)
      ? contextualRouteId
      : supportedRouteIds.includes(standardRouteId)
        ? standardRouteId
        : null;

  if (!resolvedRouteId) {
    return null;
  }

  return {
    route_id: resolvedRouteId,
    applicant_pool: applicantPool,
    contextual_level: contextualEligibility?.level ||
      contextualEligibility?.contextual_level ||
      contextualEligibility?.academic_contextual_level ||
      null,
    contextual_status: contextualEligibility?.status || null,
    contextual_confirmed: contextualEligibility?.is_contextual === true,
    uses_contextual_academic_route:
      course?.profile_id === 'edinburgh-a100'
        ? (
          contextualEligibility?.academic_contextual_level === 'plus_flag' ||
          contextualEligibility?.level === 'plus_flag' ||
          contextualEligibility?.contextual_level === 'plus_flag'
        )
        : resolvedRouteId.endsWith('_contextual'),
    supported_route_ids: supportedRouteIds,
    contextual_evaluator_id: contextualEligibility?.evaluator_id ||
      contextualEvaluatorIdForCourse(course) ||
      null
  };
}

function applyCourseSpecificDerivedApplicantGroups(course, applicant, groupIds, contextualEligibility = null) {
  const groups = new Set(groupIds);

  const contextualResult = contextualEligibility || evaluateCourseContextualEligibility(course, applicant);
  if (
    COURSES_WITH_CONTEXTUAL_EVALUATOR_GROUP_CONTROL.includes(course?.profile_id) &&
    contextualResult
  ) {
    groups.delete('contextual');
    groups.delete('widening_participation');
  }
  if (course?.profile_id === 'aberdeen-a100' && contextualResult) {
    for (const groupId of ABERDEEN_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'aston-a100' && contextualResult) {
    for (const groupId of ASTON_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'birmingham-a100' && contextualResult) {
    groups.delete('care_experienced');
  }
  if (course?.profile_id === 'dundee-a100' && contextualResult) {
    for (const groupId of DUNDEE_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'edinburgh-a100' && contextualResult) {
    for (const groupId of EDINBURGH_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'glasgow-a100' && contextualResult) {
    for (const groupId of GLASGOW_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'st-andrews-a100' && contextualResult) {
    for (const groupId of ST_ANDREWS_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'ucl-a100' && contextualResult) {
    for (const groupId of UCL_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'hull-york-a100' && contextualResult) {
    for (const groupId of HYMS_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'king-s-college-london-a100' && contextualResult) {
    for (const groupId of KCL_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (course?.profile_id === 'newcastle-a100' && contextualResult) {
    for (const groupId of NEWCASTLE_LEGACY_CONTEXTUAL_GROUP_IDS) {
      groups.delete(groupId);
    }
  }
  if (COURSES_WITH_ACTIVATED_CONTEXTUAL_GROUPS.includes(course?.profile_id)) {
    const activatedGroups = contextualResult?.is_contextual === true
      ? contextualResult.activated_applicant_group_ids
      : contextualResult?.provisional_activated_applicant_group_ids;
    for (const groupId of activatedGroups || []) {
      groups.add(groupId);
    }
  }

  return [...groups];
}

function deriveCourseApplicantGroupIds(course, applicant) {
  return applyCourseSpecificDerivedApplicantGroups(
    course,
    applicant,
    deriveApplicantGroupIds(applicant),
    evaluateCourseContextualEligibility(course, applicant)
  );
}

function groupRuleApplies(rule, groupIds) {
  const groups = new Set(groupIds);
  const required = rule?.all_group_ids || rule?.applies_to_group_ids || [];
  const alternatives = rule?.any_group_ids || [];
  const excluded = rule?.excluded_group_ids || [];

  return required.every((groupId) => groups.has(groupId)) &&
    (alternatives.length === 0 || alternatives.some((groupId) => groups.has(groupId))) &&
    excluded.every((groupId) => !groups.has(groupId));
}

function qualificationStatusFromSubjects(subjects) {
  const entries = (subjects || []).filter((subject) => subject?.subject_id);
  if (entries.length === 0) {
    return null;
  }
  const achievedCount = entries.filter((subject) =>
    subject.achieved_grade !== null &&
      subject.achieved_grade !== undefined &&
      subject.achieved_grade !== ''
  ).length;
  const predictedCount = entries.filter((subject) =>
    subject.predicted_grade !== null &&
      subject.predicted_grade !== undefined &&
      subject.predicted_grade !== ''
  ).length;

  if (achievedCount === entries.length && predictedCount === 0) {
    return 'achieved';
  }
  if (predictedCount > 0 && achievedCount === 0) {
    return 'predicted';
  }
  return 'mixed_or_unclear';
}

function deriveQualificationStatus(applicant) {
  const explicit = normaliseId(
    applicant.qualification_status ||
      applicant.academic_status ||
      applicant.a_level_profile?.qualification_status ||
      applicant.ib_profile?.qualification_status ||
      applicant.scottish_profile?.qualification_status
  );
  if (['achieved', 'predicted'].includes(explicit)) {
    return explicit;
  }

  const aLevelStatus = qualificationStatusFromSubjects(applicant.a_level_profile?.subjects);
  if (aLevelStatus) {
    return aLevelStatus;
  }

  const ibSubjects =
    applicant.ib_profile?.higher_level_subjects ||
      applicant.ib_profile?.hl_subjects ||
      applicant.ib_profile?.subjects;
  const ibStatus = qualificationStatusFromSubjects(ibSubjects);
  if (ibStatus) {
    return ibStatus;
  }

  const scottishStatus = qualificationStatusFromSubjects(
    applicant.scottish_profile?.advanced_higher_subjects
  );
  if (scottishStatus) {
    return scottishStatus;
  }

  return 'unknown';
}

function profileArray(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

function firstProfileArray(...values) {
  return values.map(profileArray).find(Boolean) || null;
}

function aLevelGradeProfileForQualificationStatus(requirement = {}, applicant = {}) {
  const qualificationStatus = deriveQualificationStatus(applicant);
  const predictedProfile = profileArray(requirement.predicted_minimum_profile);
  const achievedProfile = firstProfileArray(
    requirement.achieved_grade_profile,
    requirement.offer_grade_profile,
    requirement.final_grade_profile
  );
  const legacyProfile = firstProfileArray(requirement.grade_profile, requirement.standard_offer);

  if (qualificationStatus === 'predicted' && predictedProfile) {
    return predictedProfile;
  }
  if (qualificationStatus === 'achieved' && achievedProfile) {
    return achievedProfile;
  }
  return legacyProfile || predictedProfile || achievedProfile || [];
}

function resolveUcatMinimumTotalScore(ucat, groupIds) {
  const groupRule = (ucat?.group_minimum_total_scores || [])
    .find((rule) => {
      return Number.isFinite(rule?.minimum_total_score) &&
        groupRuleApplies(rule, groupIds);
    });

  return groupRule?.minimum_total_score ?? ucat?.minimum_total_score ?? null;
}

function resolveCourseUcatMinimumTotalScore(course, ucat, groupIds, contextualEligibility = null) {
  if (
    course?.profile_id === 'edinburgh-a100' &&
    contextualEligibility?.ucat_contextual_treatment?.minimum_total_score_required === false
  ) {
    return null;
  }
  return resolveUcatMinimumTotalScore(ucat, groupIds);
}

function finiteScore(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function ucatSubtestScore(evidence, subsection) {
  const subtests = evidence?.subtests || evidence?.section_scores || {};
  return finiteScore(evidence?.[subsection] ?? subtests[subsection]);
}

function evaluateUcatSubsectionMinimums(ucat = {}, evidence = {}) {
  const requirements = ucat.minimum_subsection_scores || ucat.section_minimums || [];
  const defaultSections = ucat.cognitive_subtest_ids || [
    'verbal_reasoning',
    'decision_making',
    'quantitative_reasoning'
  ];
  const checks = [];

  for (const requirement of requirements) {
    const subsection = normaliseId(
      requirement.subsection || requirement.section || requirement.subtest
    );
    const minimum = Number(requirement.minimum_score ?? requirement.minimum);
    if (!Number.isFinite(minimum)) {
      continue;
    }

    const sections = ['each_cognitive_section', 'each_cognitive_subtest', 'each_subcomponent']
      .includes(subsection)
      ? defaultSections
      : [subsection];

    for (const section of sections) {
      const score = ucatSubtestScore(evidence, section);
      checks.push({
        section,
        minimum,
        score,
        passed: Number.isFinite(score) && score >= minimum
      });
    }
  }

  return {
    checks,
    passed: checks.every((check) => check.passed),
    failing_sections: checks.filter((check) => !check.passed).map((check) => check.section)
  };
}

function subjectGradeOptionsMeet(subjectGrades, options, level) {
  if (!Array.isArray(options) || options.length === 0) {
    return true;
  }

  return options.some((option) => {
    return subjectGradeRequirementsMeet(subjectGrades, option.grade_requirements, level);
  });
}

function uniqueNormalisedIds(...values) {
  const ids = [];
  for (const value of values.flat()) {
    const id = normaliseId(value);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function subjectIdsForRequirement(requirement = {}) {
  return uniqueNormalisedIds(
    requirement.subject_id,
    requirement.subject_ids || [],
    requirement.required_subject_ids || [],
    requirement.accepted_subject_ids || [],
    requirement.alternative_subject_ids || [],
    requirement.equivalent_subject_ids || []
  );
}

function subjectGradeRequirementMet(subjectGrades, subjectIds, minimumGrade, level) {
  return subjectIds.some((subjectId) => {
    const grade = subjectGrades[normaliseId(subjectId)];
    if (grade === undefined || grade === null || grade === '') {
      return false;
    }
    return minimumGrade ? gradeMeets(grade, minimumGrade, level) : true;
  });
}

function scottishPost16SatisfactionRules(requirement = {}) {
  const rules = [];
  const post16 = requirement.post16_satisfaction || requirement.higher_satisfaction;

  if (post16 && post16.allowed !== false) {
    rules.push({
      qualification_levels: post16.qualification_levels || post16.qualification_level || [
        'higher',
        'advanced_higher'
      ],
      subject_ids: post16.subject_ids,
      minimum_grade: post16.minimum_grade
    });
  }

  const satisfiedBy = Array.isArray(requirement.satisfied_by)
    ? requirement.satisfied_by
    : requirement.satisfied_by
      ? [requirement.satisfied_by]
      : [];
  for (const rule of satisfiedBy) {
    rules.push({
      qualification_levels: rule.qualification_levels || rule.qualification_level,
      subject_ids: rule.subject_ids,
      minimum_grade: rule.minimum_grade
    });
  }

  if (
    requirement.satisfied_by_higher_or_advanced_higher === true ||
    requirement.can_be_satisfied_by_higher_or_advanced_higher === true ||
    requirement.higher_or_advanced_higher_satisfies === true
  ) {
    rules.push({
      qualification_levels: ['higher', 'advanced_higher']
    });
  }

  return rules;
}

function scottishQualificationLevelMatches(candidate, expected) {
  const value = normaliseId(candidate);
  const level = normaliseId(expected);
  if (!value || !level) {
    return false;
  }
  if (['higher', 'highers', 'scottish_higher', 'scottish_highers'].includes(value)) {
    return ['higher', 'highers', 'scottish_higher', 'scottish_highers'].includes(level);
  }
  if (
    ['advanced_higher', 'advanced_highers', 'scottish_advanced_higher', 'scottish_advanced_highers']
      .includes(value)
  ) {
    return ['advanced_higher', 'advanced_highers', 'scottish_advanced_higher', 'scottish_advanced_highers'].includes(level);
  }
  return value === level;
}

function post16ScottishRequirementMet(requirement, defaultSubjectIds, higherGrades, advancedHigherGrades) {
  return scottishPost16SatisfactionRules(requirement).some((rule) => {
    const levels = Array.isArray(rule.qualification_levels)
      ? rule.qualification_levels
      : [rule.qualification_levels];
    const subjectIds = subjectIdsForRequirement({
      subject_ids: rule.subject_ids || defaultSubjectIds
    });
    const minimumGrade = rule.minimum_grade || requirement.minimum_grade;

    return levels.some((level) => {
      if (
        scottishQualificationLevelMatches(level, 'higher') &&
        subjectGradeRequirementMet(higherGrades, subjectIds, minimumGrade, 'a_level')
      ) {
        return true;
      }
      return scottishQualificationLevelMatches(level, 'advanced_higher') &&
        subjectGradeRequirementMet(advancedHigherGrades, subjectIds, minimumGrade, 'a_level');
    });
  });
}

function national5RequirementMet(
  requirement,
  national5Grades,
  higherGrades,
  advancedHigherGrades,
  groupIds = []
) {
  if (requirement.requirement_type === 'any_of') {
    const matchedOptions = (requirement.accepted_options || []).filter((option) => {
      return groupRuleApplies(option, groupIds) &&
        (option.grade_requirements || []).every((gradeRequirement) => {
          return national5GradeRequirementMet(national5Grades, gradeRequirement);
        });
    });
    return matchedOptions.length >= (requirement.minimum_options_required || 1);
  }

  const subjectIds = subjectIdsForRequirement(requirement);
  if (subjectIds.length === 0) {
    return true;
  }

  const national5Met = subjectGradeRequirementMet(
    national5Grades,
    subjectIds,
    requirement.minimum_grade,
    'gcse'
  );

  if (
    requirement.post16_equivalency_allowed === false ||
    requirement.post16_satisfaction_allowed === false
  ) {
    return national5Met;
  }

  return national5Met ||
    post16ScottishRequirementMet(requirement, subjectIds, higherGrades, advancedHigherGrades);
}

function national5GradeRequirementMet(national5Grades, requirement = {}) {
  const subjectIds = subjectIdsForRequirement(requirement);
  if (requirement.minimum_grade_profile) {
    return subjectIds.some((subjectId) => {
      const actualProfile = parseCombinedScienceGrades(national5Grades[normaliseId(subjectId)]);
      return gradeProfileMeets(actualProfile, requirement.minimum_grade_profile, 'gcse') ||
        gradeProfileMeets(actualProfile, requirement.accepted_equivalent_profile || [], 'gcse');
    });
  }

  return subjectGradeRequirementMet(
    national5Grades,
    subjectIds,
    requirement.minimum_grade,
    'gcse'
  );
}

function national5MinimumCountMet(national5Grades, rules = {}) {
  const minimumCount = Number(rules.minimum_count);
  if (!Number.isFinite(minimumCount) || minimumCount <= 0) {
    return true;
  }
  const minimumGrade = rules.minimum_count_grade || rules.minimum_grade;
  const count = getCountableGcseGrades(national5Grades).filter((grade) => {
    if (grade === undefined || grade === null || grade === '') {
      return false;
    }
    return minimumGrade ? gradeMeets(grade, minimumGrade, 'gcse') : true;
  }).length;
  return count >= minimumCount;
}

function national5RequirementsFor(rules = {}, groupIds = []) {
  const asArray = (value) => Array.isArray(value) ? value : [];
  const requirements = [
    ...asArray(rules.grade_requirements),
    ...asArray(rules.required_subjects),
    ...(rules.science_requirement ? [rules.science_requirement] : []),
    ...asArray(rules.conditional_requirements),
    ...asArray(rules.conditional_national_5_requirements)
  ].filter((requirement) => requirement && groupRuleApplies(requirement, groupIds));

  for (const subjectId of [
    ...(rules.confirmed_mandatory_subject_ids || []),
    ...(rules.mandatory_subject_ids || []),
    ...(rules.required_subject_ids || [])
  ]) {
    requirements.push({
      requirement_id: `national_5_${normaliseId(subjectId)}_minimum`,
      subject_id: subjectId,
      minimum_grade: rules.minimum_grade
    });
  }

  return requirements;
}

function national5RulesForCourse(course) {
  const rules = course?.stage_1_eligibility?.national_5 || {};
  const embeddedGradeRequirements = (course?.stage_1_eligibility?.gcse?.grade_requirements || [])
    .filter((requirement) => {
      return normaliseId(requirement?.qualification_level) === 'national_5';
    });

  if (embeddedGradeRequirements.length === 0) {
    return rules;
  }

  const gradeRequirementsById = new Map();
  for (const requirement of [
    ...asArray(rules.grade_requirements),
    ...embeddedGradeRequirements
  ]) {
    const key = requirement.requirement_id ||
      `${normaliseId(requirement.subject_id)}:${normaliseId(requirement.minimum_grade)}`;
    if (!gradeRequirementsById.has(key)) {
      gradeRequirementsById.set(key, requirement);
    }
  }

  return {
    ...rules,
    grade_requirements: [...gradeRequirementsById.values()]
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function scottishProfileSubjects(profile = {}, field) {
  return asArray(profile[field]).filter((subject) => subject?.subject_id);
}

function normaliseScottishSubjectId(subject = {}) {
  const subjectId = normaliseId(subject.subject_id);
  const subjectName = normaliseId(
    subject.subject_name ||
      subject.name ||
      subject.qualification_title ||
      subject.qualification_name
  );
  if (
    subjectId === 'applications_of_mathematics' ||
    subjectId === 'application_of_mathematics' ||
    subjectId === 'higher_applications_of_mathematics' ||
    subjectName.includes('applications_of_mathematics') ||
    subjectName.includes('application_of_mathematics')
  ) {
    return 'applications_of_mathematics';
  }
  return subjectId;
}

function scottishSubjectSchoolYear(subject = {}) {
  const value = normaliseId(
    subject.school_year ||
      subject.year_group ||
      subject.sqa_school_year ||
      subject.study_year ||
      subject.completed_during
  );
  if (['s4', 's5', 's6'].includes(value)) {
    return value;
  }
  const match = value.match(/^year_?([456])$/);
  return match ? `s${match[1]}` : value;
}

function scottishSubjectIsFirstAttempt(subject = {}) {
  const sittingStatus = normaliseId(
    subject.sitting_status ||
      subject.exam_sitting_status ||
      subject.attempt_status
  );
  if (
    subject.first_attempt === false ||
    subject.resit === true ||
    Number(subject.attempt_number) > 1 ||
    [
      'resit',
      'resitting',
      'repeat',
      'second_sitting',
      'third_sitting',
      'not_first_attempt'
    ].includes(sittingStatus)
  ) {
    return false;
  }
  return true;
}

function scottishSubjectGrade(subject = {}) {
  return subject.predicted_grade ??
    subject.achieved_grade ??
    subject.grade ??
    subject.higher_level_grade;
}

function scottishSubjectCanCount(subject, route = {}, level) {
  const schoolYear = scottishSubjectSchoolYear(subject);
  const requiredYear = normaliseId(
    level === 'advanced_higher'
      ? route.advanced_higher_school_year
      : route.higher_school_year
  );
  const excludedYears = (level === 'advanced_higher'
    ? route.excluded_advanced_higher_school_years
    : route.excluded_higher_school_years) || [];

  if (requiredYear && schoolYear !== requiredYear) {
    return false;
  }
  if (excludedYears.map(normaliseId).includes(schoolYear)) {
    return false;
  }
  if (route.first_attempt_required === true && !scottishSubjectIsFirstAttempt(subject)) {
    return false;
  }
  return scottishSubjectGrade(subject) !== undefined &&
    scottishSubjectGrade(subject) !== null &&
    scottishSubjectGrade(subject) !== '';
}

function scottishSubjectMap(subjects, route = {}, level = 'higher') {
  const result = {};
  for (const subject of subjects) {
    if (!scottishSubjectCanCount(subject, route, level)) {
      continue;
    }
    const subjectId = normaliseScottishSubjectId(subject);
    if (subjectId) {
      result[subjectId] = scottishSubjectGrade(subject);
    }
  }
  return result;
}

function scottishPredictedManualReviewRoute(route = {}) {
  const reviewRule =
    route.predicted_grade_manual_review ||
    route.predicted_manual_review ||
    null;
  if (!reviewRule || typeof reviewRule !== 'object') {
    return null;
  }

  return {
    ...route,
    ...reviewRule,
    route_id: route.route_id,
    pathway_id: route.pathway_id,
    requirement_id: route.requirement_id
  };
}

function valueAtPath(source, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      return current[key];
    }, source);
}

function booleanEvidence(value) {
  if (value === true || value === false) {
    return value;
  }
  const normalised = normaliseId(value);
  if (['yes', 'true', 'confirmed', 'verified'].includes(normalised)) {
    return true;
  }
  if (['no', 'false'].includes(normalised)) {
    return false;
  }
  return null;
}

function scottishSameSittingAssessment(profile = {}, subjects = [], route = {}) {
  if (route.same_sitting_required !== true) {
    return { passed: true };
  }
  const schoolYearFilter = normaliseId(route.same_sitting_school_year);
  const eligibleSubjects = schoolYearFilter
    ? subjects.filter((subject) => scottishSubjectSchoolYear(subject) === schoolYearFilter)
    : subjects;
  const explicit =
    profile.completed_in_one_sitting ??
    profile.same_sitting_confirmed ??
    profile.same_sitting?.confirmed ??
    profile.same_sitting?.completed_in_one_sitting;
  let passed = null;
  if (explicit === true || explicit === false) {
    passed = explicit;
  } else {
    const sittingIds = eligibleSubjects
      .map((subject) => {
        return subject.sitting_id ||
          subject.exam_sitting_id ||
          subject.sitting ||
          subject.exam_series;
      })
      .filter(Boolean);
    passed = sittingIds.length === 0 || new Set(sittingIds).size === 1;
  }

  if (passed || route.same_sitting_exception_allowed !== true) {
    return { passed };
  }

  const exceptionPath =
    route.same_sitting_exception_evidence_path ||
    'same_sitting.school_exception_confirmed';
  const exceptionValue =
    valueAtPath(profile, exceptionPath) ??
    profile.same_sitting_school_exception_confirmed ??
    profile.school_could_not_present_five_highers_one_sitting ??
    profile.s5_five_higher_same_sitting_school_exception;
  const exceptionConfirmed = booleanEvidence(exceptionValue);
  if (exceptionConfirmed === true) {
    return {
      passed: true,
      exception_applied: true,
      exception_evidence_path: exceptionPath
    };
  }
  if (exceptionConfirmed === false) {
    return {
      passed: false,
      exception_applied: false,
      exception_evidence_path: exceptionPath
    };
  }

  return {
    passed: true,
    requires_manual_review: true,
    manual_review_reason:
      route.same_sitting_exception_manual_review_reason ||
      'scottish_same_sitting_school_exception_requires_review',
    exception_evidence_path: exceptionPath
  };
}

function scottishSameSittingMet(profile = {}, subjects = [], route = {}) {
  return scottishSameSittingAssessment(profile, subjects, route).passed;
}

function scottishSubjectsForCombinedRule(higherSubjects = [], advancedHigherSubjects = [], rule = {}) {
  const allowedLevels = (rule.qualification_levels || ['higher', 'advanced_higher'])
    .map(normaliseId);
  const schoolYear = normaliseId(rule.school_year || rule.required_school_year);
  const subjects = [];

  if (allowedLevels.some((level) => scottishQualificationLevelMatches(level, 'higher'))) {
    subjects.push(...higherSubjects.map((subject) => ({ ...subject, qualification_level: 'higher' })));
  }
  if (allowedLevels.some((level) => scottishQualificationLevelMatches(level, 'advanced_higher'))) {
    subjects.push(...advancedHigherSubjects.map((subject) => ({
      ...subject,
      qualification_level: 'advanced_higher'
    })));
  }

  return subjects.filter((subject) => {
    if (schoolYear && scottishSubjectSchoolYear(subject) !== schoolYear) {
      return false;
    }
    if (rule.first_attempt_required === true && !scottishSubjectIsFirstAttempt(subject)) {
      return false;
    }
    return scottishSubjectGrade(subject) !== undefined &&
      scottishSubjectGrade(subject) !== null &&
      scottishSubjectGrade(subject) !== '';
  });
}

function combinedScottishGradeRequirementsMeet(higherSubjects, advancedHigherSubjects, rules = []) {
  return (rules || []).every((rule) => {
    const subjects = scottishSubjectsForCombinedRule(higherSubjects, advancedHigherSubjects, rule);
    const acceptedSubjectIds = uniqueNormalisedIds(
      rule.subject_ids || [],
      rule.accepted_subject_ids || []
    );
    const eligibleSubjects = acceptedSubjectIds.length > 0
      ? subjects.filter((subject) => acceptedSubjectIds.includes(normaliseScottishSubjectId(subject)))
      : subjects;
    const subjectGrades = {};
    for (const subject of eligibleSubjects) {
      const subjectId = normaliseScottishSubjectId(subject);
      const grade = scottishSubjectGrade(subject);
      if (!subjectId) {
        continue;
      }
      if (
        subjectGrades[subjectId] === undefined ||
        gradeMeets(grade, subjectGrades[subjectId], 'a_level')
      ) {
        subjectGrades[subjectId] = grade;
      }
    }
    const subjectGroupsMeet = (groups = []) => {
      return (groups || []).every((group) => {
        const matching = (group.subject_ids || []).filter((subjectId) => {
          return subjectGrades[normaliseId(subjectId)] !== undefined;
        });
        return matching.length >= (group.minimum_required || 1);
      });
    };
    const subjectOptionsMeet = (rule.required_subject_grade_options || []).length === 0 ||
      (rule.required_subject_grade_options || []).some((option) => {
        return subjectGradeRequirementsMeet(
          subjectGrades,
          option.grade_requirements || [],
          'a_level'
        ) && subjectGroupsMeet(option.one_of_subject_groups || []);
      });
    const profileRequired =
      (rule.grade_profile || []).length > 0 ||
      (rule.grade_profile_options || []).length > 0;
    const profileMeet = !profileRequired ||
      gradeProfileOptionsMeet(
        eligibleSubjects.map(scottishSubjectGrade),
        rule.grade_profile || [],
        rule.grade_profile_options || []
      );
    return profileMeet &&
      subjectGradeRequirementsMeet(
        subjectGrades,
        rule.subject_grade_requirements || rule.grade_requirements || [],
        'a_level'
      ) &&
      subjectOptionsMeet &&
      subjectGroupsMeet(rule.one_of_subject_groups || []);
  });
}

function scottishSameYearSubjectRuleMet(higherSubjects, advancedHigherSubjects, rule = {}) {
  const allowedYears = (rule.allowed_school_years || ['s5', 's6']).map(normaliseId);
  const subjects = scottishSubjectsForCombinedRule(higherSubjects, advancedHigherSubjects, {
    qualification_levels: rule.qualification_levels || ['higher', 'advanced_higher'],
    first_attempt_required: rule.first_attempt_required
  });
  const requiredSubjectIds = (rule.required_subject_ids || []).map(normaliseId);
  const alternativeSubjectIds = (
    rule.one_of_subject_ids ||
    rule.second_subject_ids ||
    rule.accepted_second_subject_ids ||
    []
  ).map(normaliseId);

  return allowedYears.some((schoolYear) => {
    const grades = {};
    for (const subject of subjects) {
      if (scottishSubjectSchoolYear(subject) !== schoolYear) {
        continue;
      }
      const subjectId = normaliseScottishSubjectId(subject);
      if (subjectId) {
        grades[subjectId] = scottishSubjectGrade(subject);
      }
    }
    const requiredPresent = requiredSubjectIds.every((subjectId) => {
      return grades[subjectId] !== undefined;
    });
    const alternativePresent = alternativeSubjectIds.some((subjectId) => {
      return grades[subjectId] !== undefined;
    });
    return requiredPresent && alternativePresent;
  });
}

function scottishSameYearSubjectRulesMeet(higherSubjects, advancedHigherSubjects, rules = []) {
  return (rules || []).every((rule) => {
    return scottishSameYearSubjectRuleMet(higherSubjects, advancedHigherSubjects, rule);
  });
}

function gradeProfileOptionsMeet(grades, profile, profileOptions = []) {
  const options = Array.isArray(profileOptions) && profileOptions.length > 0
    ? profileOptions
    : [profile || []];
  return options.some((requiredProfile) => {
    return gradeProfileMeets(grades, requiredProfile || []);
  });
}

function subjectGradeRequirementsMeet(subjectGrades, requirements = [], level = 'a_level') {
  if (level && level !== 'a_level') {
    return (requirements || []).every((requirement) => {
      return gradeMeets(
        subjectGrades[normaliseId(requirement.subject_id)],
        requirement.minimum_grade,
        level
      );
    });
  }

  return (requirements || []).every((requirement) => {
    return subjectGradeRequirementMet(
      subjectGrades,
      subjectIdsForRequirement(requirement),
      requirement.minimum_grade,
      'a_level'
    );
  });
}

function parseCombinedScienceGrades(value) {
  if (Array.isArray(value)) {
    return value;
  }

  const text = normaliseGrade(value);
  if (!text) {
    return [];
  }
  if (/^[1-9][1-9]$/.test(text) || /^[A-G][A-G]$/.test(text)) {
    return text.split('');
  }

  return text.split(/[\/, +]+/).filter(Boolean);
}

function getCountableGcseGrades(subjectGrades) {
  const grades = [];

  for (const [subjectId, value] of Object.entries(subjectGrades)) {
    if (subjectId === 'combined_science' || subjectId === 'double_science') {
      grades.push(...parseCombinedScienceGrades(value).slice(0, 2));
    } else if (value !== undefined && value !== null && value !== '') {
      grades.push(value);
    }
  }

  return grades;
}

function addCheck(state, checkId, passed, detail = {}) {
  state.checks.push({
    check_id: checkId,
    status: passed ? 'pass' : 'fail',
    ...detail
  });
}

function addFailure(state, reason) {
  if (!state.failures.includes(reason)) {
    state.failures.push(reason);
  }
}

function addManualReview(state, reason) {
  if (!state.manual_review_reasons.includes(reason)) {
    state.manual_review_reasons.push(reason);
  }
}

function gcseRuleAppliesToQualificationRoute(rule, qualificationRoute) {
  const qualificationLevel = normaliseId(rule?.qualification_level);
  if (!qualificationLevel) {
    return true;
  }

  const route = normaliseId(qualificationRoute);
  if (!route || ['unknown', 'foundation', 'mixed_t_level_a_level'].includes(route)) {
    return true;
  }

  const routeIsScottish = ['scottish', 'scottish_advanced_highers'].includes(route);
  const isNational5OnlyRule = ['national_5', 'national5'].includes(qualificationLevel);
  const includesGcse = qualificationLevel.includes('gcse');
  const includesNational5 = qualificationLevel.includes('national_5');

  if (routeIsScottish) {
    if (includesNational5) {
      return true;
    }
    if (includesGcse) {
      return false;
    }
  }

  if (!routeIsScottish && isNational5OnlyRule) {
    return false;
  }

  return true;
}

function evaluateGcseRules(course, applicant, state) {
  const rules = course.stage_1_eligibility?.gcse || {};
  const subjectGrades = profileToSubjectMap(applicant.gcse_profile);
  const countRules = Array.isArray(rules.minimum_count_at_or_above_grade)
    ? rules.minimum_count_at_or_above_grade
    : rules.minimum_count_at_or_above_grade
      ? [rules.minimum_count_at_or_above_grade]
      : [];
  const countableGrades = getCountableGcseGrades(subjectGrades);
  state.exact_gcse_count = countableGrades.length;
  const combinedScienceGrades = parseCombinedScienceGrades(
    subjectGrades.combined_science || subjectGrades.double_science
  );
  const combinedSciencePassed =
    combinedScienceGrades.length >= 2 &&
    combinedScienceGrades.slice(0, 2).every((grade) => gradeMeets(grade, '6', 'gcse'));

  if (Number.isInteger(rules.minimum_count)) {
    const passed = countableGrades.length >= rules.minimum_count;
    addCheck(state, 'gcse_minimum_count', passed, {
      actual: countableGrades.length,
      required: rules.minimum_count
    });
    if (!passed) {
      addFailure(state, 'minimum_gcse_count_not_met');
    }
  }

  for (const countRule of countRules) {
    if (!groupRuleApplies(countRule, state.applicant_group_ids)) {
      continue;
    }
    if (!gcseRuleAppliesToQualificationRoute(countRule, state.qualification_route)) {
      continue;
    }
    const actualCount = countableGrades.filter((grade) => {
      return gradeMeets(grade, countRule.minimum_grade, 'gcse');
    }).length;
    const passed = actualCount >= countRule.count;
    addCheck(state, countRule.requirement_id || 'gcse_minimum_count_at_grade', passed, {
      actual: actualCount,
      required: countRule.count,
      minimum_grade: countRule.minimum_grade
    });
    if (!passed) {
      addFailure(
        state,
        `minimum_gcse_count_at_grade_not_met:${countRule.requirement_id || 'gcse_minimum_count_at_grade'}`
      );
    }
  }

  for (const rule of rules.grade_requirements || []) {
    if (!groupRuleApplies(rule, state.applicant_group_ids)) {
      continue;
    }
    if (!gcseRuleAppliesToQualificationRoute(rule, state.qualification_route)) {
      continue;
    }
    const subjectId = normaliseId(rule.subject_id);
    if (combinedSciencePassed && ['biology', 'chemistry'].includes(subjectId)) {
      continue;
    }
    const passed = gradeMeets(subjectGrades[subjectId], rule.minimum_grade, 'gcse');
    addCheck(state, rule.requirement_id || `gcse_${subjectId}`, passed, {
      subject_id: subjectId
    });
    if (!passed) {
      const usesIeltsForLowerEnglish =
        subjectId === 'english_language' &&
        state.applicant_group_ids.includes('international_fee') &&
        normaliseId(
          applicant.english_language_profile?.test ||
          applicant.english_language_profile?.test_name
        ) === 'ielts_academic';
      if (usesIeltsForLowerEnglish) {
        addManualReview(state, 'lower_gcse_english_ielts_equivalence_conflict');
      } else {
        addFailure(state, `gcse_requirement_not_met:${subjectId}`);
      }
    }
  }

  const scienceRule = rules.science_requirement;
  if (scienceRule?.requirement_type === 'any_of') {
    const matchedOptions = [];

    for (const option of scienceRule.accepted_options || []) {
      if (!groupRuleApplies(option, state.applicant_group_ids)) {
        continue;
      }
      const passed = (option.grade_requirements || []).every((requirement) => {
        const subjectId = normaliseId(requirement.subject_id);
        if (requirement.minimum_grade_profile) {
          const actualProfile = parseCombinedScienceGrades(subjectGrades[subjectId]);
          return gradeProfileMeets(actualProfile, requirement.minimum_grade_profile, 'gcse') ||
            gradeProfileMeets(actualProfile, requirement.accepted_equivalent_profile || [], 'gcse');
        }
        return gradeMeets(subjectGrades[subjectId], requirement.minimum_grade, 'gcse');
      });

      if (passed) {
        matchedOptions.push(option.option_id);
      }
    }

    const passed = matchedOptions.length >= (scienceRule.minimum_options_required || 1);
    addCheck(state, scienceRule.requirement_id, passed, {
      matched_options: matchedOptions
    });
    if (!passed) {
      addFailure(state, 'gcse_science_alternative_not_met');
    }
  }

  if (rules.points_scoring?.minimum_points) {
    const points = [...countableGrades]
      .map((grade) => gradeMeets(grade, '7', 'gcse') ? 2 : gradeMeets(grade, '6', 'gcse') ? 1 : 0)
      .sort((a, b) => b - a)
      .slice(0, rules.points_scoring.best_subject_count || 9)
      .reduce((total, value) => total + value, 0);
    const contextual =
      state.applicant_group_ids.includes('contextual') ||
      state.applicant_group_ids.includes('widening_participation');
    const required = contextual ? 12 : rules.points_scoring.minimum_points;
    const passed = points >= required;
    addCheck(state, 'gcse_points', passed, { actual: points, required });
    if (!passed) {
      addFailure(state, 'minimum_gcse_points_not_met');
    }
  }
}

function applyScottishNational5EquivalenceReview(course, applicant, state) {
  const route = normaliseId(state.qualification_route);
  if (!['scottish', 'scottish_advanced_highers'].includes(route)) {
    return;
  }

  const equivalenceStatus = normaliseId(
    course.stage_1_eligibility?.post_16?.scottish?.national_5_equivalence?.execution_status
  );
  if (equivalenceStatus !== 'manual_review') {
    return;
  }

  const gcseSubjects = profileToSubjectMap(applicant.gcse_profile);
  const national5Subjects = asArray(applicant.scottish_profile?.national_5_subjects);
  if (Object.keys(gcseSubjects).length > 0 || national5Subjects.length === 0) {
    return;
  }

  const reviewReason = 'national_5_equivalence_requires_manual_review';
  const gcseEquivalentFailures = new Set([
    'minimum_gcse_count_not_met',
    'gcse_science_alternative_not_met',
    'minimum_gcse_points_not_met'
  ]);
  state.failures = state.failures.filter((reason) => {
    return !(
      gcseEquivalentFailures.has(reason) ||
      reason.startsWith('minimum_gcse_count_at_grade_not_met:') ||
      reason.startsWith('gcse_requirement_not_met:')
    );
  });
  for (const check of state.checks) {
    if (
      check.status === 'fail' &&
      (
        check.check_id === 'gcse_minimum_count' ||
        check.check_id === 'gcse_science_minimum' ||
        check.check_id === 'gcse_science_alternative' ||
        check.check_id.startsWith('gcse_') ||
        check.check_id.startsWith('minimum_gcse_')
      )
    ) {
      check.status = 'manual_review';
      check.manual_review_reason = reviewReason;
    }
  }
  addManualReview(state, reviewReason);
}

function evaluateALevelRequirement(requirement, applicant, state, routeRules = {}) {
  const subjectGrades = getALevelSubjectMap(applicant);
  const countableSubjectGrades = getCountableALevelSubjectMap(subjectGrades, routeRules);
  const actualGrades = Object.values(countableSubjectGrades);
  const requiredGradeProfile = aLevelGradeProfileForQualificationStatus(requirement, applicant);
  const profilePassed = gradeProfileMeets(actualGrades, requiredGradeProfile);
  const requiredSubjectsPassed = (requirement.required_subject_ids || []).every((subjectId) => {
    return subjectGrades[normaliseId(subjectId)] !== undefined;
  });
  const directSubjectGradesPassed = subjectGradeRequirementsMeet(
    subjectGrades,
    requirement.subject_grade_requirements,
    'a_level'
  );
  const subjectOptionsPassed = subjectGradeOptionsMeet(
    subjectGrades,
    requirement.required_subject_grade_options,
    'a_level'
  );
  const subjectGroupsPassed = (requirement.one_of_subject_groups || []).every((group) => {
    const matching = (group.subject_ids || []).filter((subjectId) => {
      return subjectGrades[normaliseId(subjectId)] !== undefined;
    });
    return matching.length >= (group.minimum_required || 1);
  });

  const excludedSubjectIds = new Set(
    (requirement.excluded_subject_ids || []).map(normaliseId)
  );
  const excludedSubjectsPassed = Object.keys(subjectGrades).every((subjectId) => {
    return !excludedSubjectIds.has(subjectId);
  });
  const epqRequirementPassed = aLevelRouteEpqRequirementApplies(requirement, applicant);
  const passed = profilePassed &&
    requiredSubjectsPassed &&
    directSubjectGradesPassed &&
    subjectOptionsPassed &&
    subjectGroupsPassed &&
    excludedSubjectsPassed &&
    epqRequirementPassed;

  addCheck(state, requirement.requirement_id || 'a_level_requirement', passed, {
    academic_pathway: requirement.academic_pathway || null,
    pathway_id: requirement.pathway_id || requirement.route_id || requirement.requirement_id || null,
    qualification_status: deriveQualificationStatus(applicant),
    required: formatGradeProfile(requiredGradeProfile),
    actual: formatGradeProfile(actualGrades),
    epq_requirement_met: epqRequirementPassed,
    epq_minimum_grade: requirement.epq_minimum_grade || null,
    grade_profile_met: profilePassed,
    required_subjects_met: requiredSubjectsPassed,
    subject_grade_rule_met: directSubjectGradesPassed && subjectOptionsPassed,
    subject_groups_met: subjectGroupsPassed,
    excluded_subject_rule_met: excludedSubjectsPassed
  });
  if (!passed) {
    addFailure(state, 'a_level_requirements_not_met');
  }

}

function aLevelRouteEpqRequirementApplies(route = {}, applicant = {}) {
  if (route.requires_epq !== true && !route.epq_minimum_grade) {
    return true;
  }

  const epq = applicant?.a_level_profile?.epq || applicant?.epq || {};
  const status = normaliseId(epq.status);
  if (!['predicted', 'achieved'].includes(status)) {
    return false;
  }
  return gradeMeets(epq.grade, route.epq_minimum_grade || 'B', 'a_level');
}

function hasRoutedEpqAlternative(routeRules = {}) {
  const routes = [
    ...(Array.isArray(routeRules.grade_requirements) ? routeRules.grade_requirements : []),
    ...(Array.isArray(routeRules.routes) ? routeRules.routes : [])
  ];
  return routes.some((route) => route?.requires_epq === true || route?.epq_minimum_grade);
}

function formatGradeProfile(grades = []) {
  if (!Array.isArray(grades) || grades.length === 0) {
    return null;
  }
  const normalised = grades
    .map((grade) => normaliseGrade(grade))
    .filter(Boolean);
  return normalised.length === grades.length ? normalised.join('') : null;
}

function academicPathwayForALevelRequirement(requirement = {}) {
  const route = requirement || {};
  if (route.academic_pathway) {
    return route.academic_pathway;
  }
  const id = normaliseId(route.pathway_id || route.route_id || route.requirement_id);
  if (id.includes('contextual')) {
    return 'contextual';
  }
  if (id.includes('standard')) {
    return 'standard';
  }
  return null;
}

function academicPathwayIdForALevelRequirement(requirement = {}) {
  const route = requirement || {};
  return route.pathway_id || route.route_id || route.requirement_id || null;
}

function evaluateStandardALevelRequirement(applicant, standardRequirement, routeRules = {}) {
  const state = {
    checks: [],
    failures: [],
    manual_review_reasons: []
  };

  evaluateALevelRequirement(standardRequirement || {}, applicant, state, routeRules);

  return {
    met: state.failures.length === 0,
    checks: state.checks,
    failures: state.failures,
    manual_review_reasons: state.manual_review_reasons
  };
}

function getEpqAlternativeOfferPolicy(routeRules = {}) {
  return routeRules.epq_alternative_offer || routeRules.epq_alternative || null;
}

function hasDeclaredEpqProfile(applicant) {
  const aLevelEpq = applicant?.a_level_profile?.epq;
  const rootEpq = applicant?.epq;
  return Boolean(
    (aLevelEpq && typeof aLevelEpq === 'object') ||
    (rootEpq && typeof rootEpq === 'object')
  );
}

function standardALevelRequirementFromRouteRules(routeRules = {}) {
  const standardOffer = routeRules.standard_offer || {};
  const gradeProfile = standardOffer.grade_profile || routeRules.grade_profile || [];

  if (!Array.isArray(gradeProfile) || gradeProfile.length === 0) {
    return null;
  }

  return {
    requirement_id: 'a_level_standard_offer',
    grade_profile: gradeProfile,
    required_subject_ids: standardOffer.required_subject_ids || routeRules.required_subject_ids || [],
    one_of_subject_groups: standardOffer.one_of_subject_groups || routeRules.one_of_subject_groups || [],
    subject_grade_requirements: standardOffer.subject_grade_requirements ||
      routeRules.subject_grade_requirements ||
      [],
    required_subject_grade_options: standardOffer.required_subject_grade_options ||
      routeRules.required_subject_grade_options ||
      [],
    excluded_subject_ids: standardOffer.excluded_subject_ids || routeRules.excluded_subject_ids || []
  };
}

function gradeProfilesEquivalent(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  const normalisedLeft = left.map((grade) => normaliseGrade(grade)).sort();
  const normalisedRight = right.map((grade) => normaliseGrade(grade)).sort();
  return normalisedLeft.every((grade, index) => grade === normalisedRight[index]);
}

function standardOfferRoutePassed(applicableRequirements, attempts, routeRules = {}) {
  const standardProfile = routeRules.standard_offer?.grade_profile || routeRules.grade_profile || [];
  if (!Array.isArray(standardProfile) || standardProfile.length === 0) {
    return null;
  }

  const matchingIndexes = applicableRequirements
    .map((requirement, index) => ({ requirement, index }))
    .filter(({ requirement }) => {
      return gradeProfilesEquivalent(requirement.grade_profile || [], standardProfile);
    });
  if (matchingIndexes.length === 0) {
    return null;
  }

  return matchingIndexes.some(({ index }) => {
    return attempts[index]?.failures.length === 0;
  });
}

function evaluateALevelEpqAlternativePathway(applicant, routeRules = {}, standardAlreadyMet = null) {
  const policy = getEpqAlternativeOfferPolicy(routeRules);
  if (!policy?.enabled) {
    return null;
  }

  const standardRequirement = standardALevelRequirementFromRouteRules(routeRules);
  if (!standardRequirement) {
    return null;
  }

  const standard = typeof standardAlreadyMet === 'boolean'
    ? {
        met: standardAlreadyMet,
        checks: [],
        failures: standardAlreadyMet ? [] : ['a_level_requirements_not_met'],
        manual_review_reasons: []
      }
    : evaluateStandardALevelRequirement(
        applicant,
        standardRequirement,
        routeRules
      );
  const checks = [
    {
      check_id: 'a_level_standard_offer',
      status: standard.met ? 'pass' : 'fail',
      academic_pathway: 'standard'
    }
  ];

  if (standard.met) {
    return {
      status: 'met',
      academic_pathway: 'standard',
      academic_pathway_id: null,
      checks,
      epq_alternative_result: null
    };
  }

  if (!hasDeclaredEpqProfile(applicant)) {
    return null;
  }

  const {
    evaluateEpqAlternativeOffer,
    manualReviewReasonForEpqAlternative
  } = require('./epq-alternative-offer');
  const epqAlternative = evaluateEpqAlternativeOffer(applicant, policy);
  checks.push({
    check_id: 'epq_alternative_offer',
    status: epqAlternative.status,
    academic_pathway: 'epq_alternative',
    pathway_id: epqAlternative.pathway_id,
    epq_status: epqAlternative.status,
    a_level_requirement_met: epqAlternative.a_level_requirement_met,
    epq_requirement_met: epqAlternative.epq_requirement_met,
    future_conditions: epqAlternative.status === 'met'
      ? epqAlternative.future_conditions
      : []
  });

  if (epqAlternative.status === 'met') {
    return {
      status: 'met',
      academic_pathway: 'epq_alternative',
      academic_pathway_id: epqAlternative.pathway_id,
      checks,
      future_conditions: epqAlternative.future_conditions,
      epq_alternative_result: epqAlternative
    };
  }

  if (epqAlternative.status === 'information_needed') {
    return {
      status: 'information_needed',
      academic_pathway: 'epq_alternative',
      academic_pathway_id: epqAlternative.pathway_id,
      checks,
      manual_review_reason: manualReviewReasonForEpqAlternative(epqAlternative),
      future_conditions: [],
      epq_alternative_result: epqAlternative
    };
  }

  return {
    status: 'not_met',
    academic_pathway: null,
    academic_pathway_id: null,
    checks,
    future_conditions: [],
    epq_alternative_result: epqAlternative
  };
}

function resolveALevelRequirements(routeRules = {}) {
  if (Array.isArray(routeRules.grade_requirements) && routeRules.grade_requirements.length > 0) {
    return routeRules.grade_requirements;
  }

  if (Array.isArray(routeRules.routes) && routeRules.routes.length > 0) {
    return routeRules.routes.map((route) => ({
      requirement_id: route.route_id || route.requirement_id,
      grade_profile: route.grade_profile || route.standard_offer || [],
      required_subject_ids: route.required_subject_ids || [],
      one_of_subject_groups: route.one_of_subject_groups || [],
      subject_grade_requirements: route.subject_grade_requirements || [],
      required_subject_grade_options: route.required_subject_grade_options || [],
      excluded_subject_ids: route.excluded_subject_ids || [],
      ...route
    }));
  }

  const singleRouteGradeProfile =
    routeRules.standard_offer?.grade_profile ||
    routeRules.grade_profile ||
    [];
  const hasSingleRouteShape =
    singleRouteGradeProfile.length > 0 ||
    (routeRules.required_subject_ids || []).length > 0 ||
    (routeRules.one_of_subject_groups || []).length > 0;

  if (!hasSingleRouteShape) {
    return [];
  }

  return [
    {
      requirement_id: 'a_level_standard_offer',
      grade_profile: singleRouteGradeProfile,
      required_subject_ids: routeRules.required_subject_ids || [],
      one_of_subject_groups: routeRules.one_of_subject_groups || [],
      subject_grade_requirements: routeRules.subject_grade_requirements || [],
      required_subject_grade_options: routeRules.required_subject_grade_options || [],
      excluded_subject_ids: routeRules.excluded_subject_ids || []
    }
  ];
}

function evaluateALevelRoute(course, applicant, state) {
  const routeRules = course.stage_1_eligibility?.post_16?.a_level || {};
  const requirements = resolveALevelRequirements(routeRules);
  const applicable = requirements.filter((requirement) => {
    return groupRuleApplies(requirement, state.applicant_group_ids) &&
      !requirement.applies_to_group_ids?.includes('graduate_applicant');
  });
  const activeApplicable = applicable.filter((requirement) => {
    return aLevelRouteEpqRequirementApplies(requirement, applicant);
  });

  if (activeApplicable.length === 0) {
    addFailure(state, 'a_level_route_not_supported_for_applicant_groups');
    return;
  }

  const attempts = activeApplicable.map((requirement) => {
    const attempt = {
      ...state,
      checks: [],
      failures: [],
      manual_review_reasons: []
    };
    evaluateALevelRequirement(requirement, applicant, attempt, routeRules);
    return attempt;
  });
  const passedIndex = attempts.findIndex((attempt) => attempt.failures.length === 0);
  const passed = passedIndex >= 0 ? attempts[passedIndex] : null;
  const passedRequirement = passedIndex >= 0 ? activeApplicable[passedIndex] : null;
  const passedRequirementPathway = academicPathwayForALevelRequirement(passedRequirement);
  const standardPassed = standardOfferRoutePassed(activeApplicable, attempts, routeRules);
  const epqAlternativePathway = passed || hasRoutedEpqAlternative(routeRules)
    ? null
    : evaluateALevelEpqAlternativePathway(
        applicant,
        routeRules,
        standardPassed
      );
  if (passed) {
    state.checks.push(...passed.checks);
    if (epqAlternativePathway) {
      state.checks.push(...epqAlternativePathway.checks);
      state.academic_pathway = epqAlternativePathway.academic_pathway;
      state.academic_pathway_id = epqAlternativePathway.academic_pathway_id;
      state.epq_alternative_result = epqAlternativePathway.epq_alternative_result;
      state.future_conditions = epqAlternativePathway.future_conditions || [];

      if (epqAlternativePathway.status === 'information_needed') {
        addManualReview(state, epqAlternativePathway.manual_review_reason);
      } else if (epqAlternativePathway.status === 'not_met') {
        addFailure(state, 'a_level_requirements_not_met');
      }
    } else {
      state.academic_pathway = state.academic_pathway || passedRequirementPathway || 'standard';
      state.academic_pathway_id = state.academic_pathway_id ||
        academicPathwayIdForALevelRequirement(passedRequirement);
    }
  } else {
    state.checks.push(...attempts.flatMap((attempt) => attempt.checks));
    if (epqAlternativePathway) {
      state.checks.push(...epqAlternativePathway.checks);
      state.academic_pathway = epqAlternativePathway.academic_pathway;
      state.academic_pathway_id = epqAlternativePathway.academic_pathway_id;
      state.epq_alternative_result = epqAlternativePathway.epq_alternative_result;
      state.future_conditions = epqAlternativePathway.future_conditions || [];

      if (epqAlternativePathway.status === 'information_needed') {
        addManualReview(state, epqAlternativePathway.manual_review_reason);
      } else if (epqAlternativePathway.status === 'not_met') {
        addFailure(state, 'a_level_requirements_not_met');
      }
    } else {
      const activeRequirement = activeApplicable[0];
      const activePathway = academicPathwayForALevelRequirement(activeRequirement);
      if (activePathway) {
        state.academic_pathway = state.academic_pathway || activePathway;
        state.academic_pathway_id = state.academic_pathway_id ||
          academicPathwayIdForALevelRequirement(activeRequirement);
      }
      addFailure(state, 'a_level_requirements_not_met');
    }
  }

  const practicalAssessment = assessPracticalEndorsements(course, null, applicant);
  if (practicalAssessment.required) {
    addCheck(
      state,
      'a_level_science_practical_endorsement',
      practicalAssessment.passed,
      {
        applicable_subject_ids: practicalAssessment.applicable_subject_ids,
        unconfirmed_subject_ids: practicalAssessment.unconfirmed_subject_ids,
        unknown_subject_ids: practicalAssessment.unknown_subject_ids,
        failed_subject_ids: practicalAssessment.failed_subject_ids,
        requirement_source: practicalAssessment.source
      }
    );
    if (!practicalAssessment.passed) {
      if (practicalAssessment.unknown_subject_ids.length > 0) {
        addManualReview(
          state,
          `science_practical_endorsement_evidence_missing:` +
            practicalAssessment.unknown_subject_ids.join(',')
        );
      }
      if (practicalAssessment.failed_subject_ids.length > 0) {
        addFailure(state, 'a_level_practical_requirement_not_met');
      }
    }
  }
}

function evaluateIbRoute(course, applicant, state) {
  const rules =
    course.stage_1_eligibility?.post_16?.ib ||
    course.stage_1_eligibility?.post_16?.international_baccalaureate ||
    {};
  const isWp =
    state.applicant_group_ids.includes('contextual') ||
    state.applicant_group_ids.includes('widening_participation');
  if (isWp && rules.contextual_route_implemented !== true) {
    addManualReview(state, 'wp_ib_overall_score_unknown');
    return;
  }
  const requirements = resolveIbRequirements(rules).filter((requirement) => {
    return groupRuleApplies(requirement, state.applicant_group_ids);
  });
  if (requirements.length === 0) {
    addFailure(state, 'ib_route_not_supported_for_applicant_groups');
    return;
  }

  const subjectGrades = getIbHigherLevelSubjectMap(applicant);
  const standardLevelSubjectGrades = profileToSubjectMap({
    subjects:
      applicant.ib_profile?.standard_level_subjects ||
      applicant.ib_profile?.sl_subjects ||
      []
  });
  const actualGrades = Object.values(subjectGrades);
  const actualHigherLevelPoints = Number.isFinite(Number(applicant.ib_profile?.higher_level_total_points))
    ? Number(applicant.ib_profile.higher_level_total_points)
    : actualGrades.reduce((total, grade) => {
      const numeric = Number(grade);
      return total + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
  const passed = requirements.some((requirement) => {
    const expectedProfile = requirement.hl_grade_profile ||
      String(requirement.hl_points || '').split(',').map((grade) => grade.trim()).filter(Boolean);
    const totalPassed =
      Number.isFinite(applicant.ib_profile?.total_points) &&
      applicant.ib_profile.total_points >= requirement.total_points;
    const hlPointsPassed =
      !Number.isFinite(Number(requirement.hl_points)) ||
      actualHigherLevelPoints >= Number(requirement.hl_points);
    const profilePassed = gradeProfileMeets(actualGrades, expectedProfile, 'gcse');
    const requiredSubjectsPassed = (requirement.required_hl_subject_ids || []).every((subjectId) => {
      return subjectGrades[normaliseId(subjectId)] !== undefined;
    });
    const directSubjectGradesPassed = subjectGradeRequirementsMeet(
      subjectGrades,
      requirement.subject_grade_requirements,
      'gcse'
    );
    const groupsPassed = (requirement.one_of_hl_subject_groups || []).every((group) => {
      return (group.subject_ids || []).filter((subjectId) => {
        return subjectGrades[normaliseId(subjectId)] !== undefined;
      }).length >= (group.minimum_required || 1);
    });
    const subjectOptionsPassed = subjectGradeOptionsMeet(
      subjectGrades,
      requirement.required_hl_subject_grade_options,
      'gcse'
    );
    const conditionalStandardLevelPassed =
      (rules.conditional_standard_level_requirements || []).every((condition) => {
        const subjectId = normaliseId(condition.subject_id);
        return condition.required_if_not_taken_at_hl !== true ||
          subjectGrades[subjectId] !== undefined ||
          standardLevelSubjectGrades[subjectId] !== undefined;
      });
    return totalPassed &&
      hlPointsPassed &&
      profilePassed &&
      requiredSubjectsPassed &&
      directSubjectGradesPassed &&
      groupsPassed &&
      subjectOptionsPassed &&
      conditionalStandardLevelPassed;
  });

  addCheck(state, 'ib_route', passed);
  if (!passed) {
    addFailure(state, 'ib_requirements_not_met');
  }
}

function resolveIbRequirements(rules = {}) {
  if (Array.isArray(rules.grade_requirements) && rules.grade_requirements.length > 0) {
    return rules.grade_requirements;
  }

  if (Array.isArray(rules.routes) && rules.routes.length > 0) {
    return rules.routes.map((route) => ({
      requirement_id: route.route_id || route.requirement_id,
      total_points: route.total_points ?? null,
      hl_grade_profile: route.hl_grade_profile || route.standard_offer || [],
      required_hl_subject_ids: route.required_hl_subject_ids || [],
      required_hl_subject_grade_options: route.required_hl_subject_grade_options || [],
      one_of_hl_subject_groups: route.one_of_hl_subject_groups || [],
      subject_grade_requirements: route.subject_grade_requirements || [],
      ...route
    }));
  }

  const requiredHlSubjects = Array.isArray(rules.required_hl_subjects)
    ? rules.required_hl_subjects
    : [];
  const explicitSubjectGradeRequirements = Array.isArray(rules.subject_grade_requirements)
    ? rules.subject_grade_requirements
    : [];
  const requiredSubjectGradeRequirements = requiredHlSubjects
    .filter((subject) => subject?.subject_id)
    .map((subject) => ({
      subject_id: subject.subject_id,
      minimum_grade: subject.minimum_grade
    }));
  const subjectGradeRequirements = [
    ...explicitSubjectGradeRequirements,
    ...requiredSubjectGradeRequirements
  ];

  const hasSingleRouteShape =
    Number.isFinite(Number(rules.total_points)) ||
    (Array.isArray(rules.hl_grade_profile) && rules.hl_grade_profile.length > 0) ||
    (Array.isArray(rules.required_hl_subject_ids) && rules.required_hl_subject_ids.length > 0) ||
    requiredHlSubjects.length > 0 ||
    (Array.isArray(rules.required_hl_subject_grade_options) && rules.required_hl_subject_grade_options.length > 0) ||
    (Array.isArray(rules.one_of_hl_subject_groups) && rules.one_of_hl_subject_groups.length > 0);

  if (!hasSingleRouteShape) {
    return [];
  }

  return [
    {
      requirement_id: 'ib_standard_offer',
      total_points: Number.isFinite(Number(rules.total_points))
        ? Number(rules.total_points)
        : null,
      hl_grade_profile: Array.isArray(rules.hl_grade_profile)
        ? rules.hl_grade_profile
        : [],
      required_hl_subject_ids: [
        ...(rules.required_hl_subject_ids || []),
        ...requiredHlSubjects.map((subject) => subject.subject_id)
      ],
      subject_grade_requirements: subjectGradeRequirements,
      required_hl_subject_grade_options: rules.required_hl_subject_grade_options || [],
      one_of_hl_subject_groups: rules.one_of_hl_subject_groups || []
    }
  ];
}

function evaluateBtecRoute(course, applicant, state) {
  const rules = course.stage_1_eligibility?.post_16?.btec || {};
  if (rules.status === 'not_accepted_as_level_3_entry_route') {
    addFailure(state, 'btec_route_not_accepted');
    return;
  }
  const combinations = rules.accepted_combinations || [];
  const btec = applicant.btec_profile || {};
  const title = normaliseId(btec.qualification || btec.qualification_title);
  const grade = normaliseGrade(btec.grade);
  const subjectId = normaliseId(btec.subject_id);
  const matching = combinations.find((combination) => {
    const expectedTitle = normaliseId(combination.btec_qualification);
    const titleMatches = title === expectedTitle;
    const subjectMatches =
      !subjectId ||
      subjectId === 'applied_science' ||
      subjectId === 'science';
    return titleMatches &&
      subjectMatches &&
      grade === normaliseGrade(combination.btec_grade);
  });

  if (!matching) {
    addManualReview(state, 'unlisted_btec_combination');
    return;
  }

  const subjectGrades = getALevelSubjectMap(applicant);
  const subjectsPassed = (matching.a_level_subject_ids || []).every((subjectId) => {
    return subjectGrades[normaliseId(subjectId)] !== undefined;
  });
  const profilePassed = gradeProfileMeets(
    Object.values(subjectGrades),
    matching.a_level_grade_profile || []
  );
  const subjectOptionsPassed = subjectGradeOptionsMeet(
    subjectGrades,
    matching.a_level_subject_grade_options,
    'a_level'
  );
  const passed = subjectsPassed && profilePassed && subjectOptionsPassed;

  addCheck(state, matching.combination_id, passed, {
    required_a_level_subjects_met: subjectsPassed,
    a_level_grade_profile_met: profilePassed,
    a_level_subject_grade_rule_met: subjectOptionsPassed
  });
  if (!passed) {
    addFailure(state, 'published_btec_combination_requirements_not_met');
  }
}

function evaluateGraduateRoute(course, applicant, state) {
  const compensatoryPolicy = evaluateGraduateCompensatoryPolicy(course, applicant);
  if (compensatoryPolicy) {
    state.checks.push(...compensatoryPolicy.checks);
    for (const failure of compensatoryPolicy.failures) {
      addFailure(state, failure);
    }
    return;
  }

  const post16 = course.stage_1_eligibility?.post_16 || {};
  const rules = post16.degree || post16.graduate || {};
  const degreeRule = rules.degree_requirement || {};
  const schoolRule = rules.a_level_requirement || {};
  const graduate = applicant.graduate_profile || {};
  if (graduate.waiver_claimed === true) {
    addManualReview(state, 'graduate_degree_content_waiver_requires_review');
    return;
  }
  const actualClassification = normaliseId(
    graduate.degree_classification || graduate.classification
  );
  const acceptedClassifications = (degreeRule.accepted_classifications || [])
    .map(normaliseId);
  const requiredClassification = normaliseId(
    rules.minimum_classification ||
    (acceptedClassifications.includes('2_1') ? '2_1' : acceptedClassifications[0])
  );
  const degreePassed =
    (DEGREE_CLASSIFICATION_RANK[actualClassification] || 0) >=
    (DEGREE_CLASSIFICATION_RANK[requiredClassification] || Number.POSITIVE_INFINITY);
  const institutionPassed =
    degreeRule.achieved_or_predicted !== true ||
    graduate.recognised_institution === true;
  const degreeStatusPassed =
    degreeRule.achieved_or_predicted !== true ||
    ['completed', 'predicted', 'achieved'].includes(normaliseId(graduate.degree_status));
  const degreeAgePassed =
    !Number.isFinite(degreeRule.maximum_age_at_course_start_years) ||
    Number(graduate.degree_age_at_course_start_years) <=
      degreeRule.maximum_age_at_course_start_years;

  const postgraduate = normaliseId(graduate.postgraduate_qualification);
  const alternativePassed =
    (DEGREE_CLASSIFICATION_RANK[actualClassification] || 0) >=
      (DEGREE_CLASSIFICATION_RANK['2_2'] || 0) &&
    ['masters', 'master_s', 'phd', 'doctorate'].includes(postgraduate) &&
    graduate.postgraduate_achieved_or_predicted === true;
  const subjectGrades = getALevelSubjectMap(applicant);
  const schoolProfile =
    rules.school_qualification_grade_profile ||
    schoolRule.normal_grade_profile ||
    [];
  const requiredSchoolSubjects =
    rules.required_a_level_subject_ids ||
    schoolRule.required_subject_ids ||
    [];
  const schoolSubjectOptions = rules.required_a_level_subject_grade_options || [];
  const schoolSubjectGroups = rules.one_of_a_level_subject_groups || (
    schoolRule.second_science_any_of_subject_ids
      ? [{
          minimum_required: 1,
          subject_ids: schoolRule.second_science_any_of_subject_ids
        }]
      : []
  );
  const hasSchoolQualificationRule =
    schoolProfile.length > 0 ||
    requiredSchoolSubjects.length > 0 ||
    schoolSubjectOptions.length > 0;
  const gradeProfilePassed =
    !hasSchoolQualificationRule ||
    gradeProfileMeets(Object.values(subjectGrades), schoolProfile);
  const requiredSubjectsPassed = requiredSchoolSubjects.every((subjectId) => {
    return subjectGrades[normaliseId(subjectId)] !== undefined;
  });
  const subjectOptionsPassed = subjectGradeOptionsMeet(
    subjectGrades,
    schoolSubjectOptions,
    'a_level'
  );
  const subjectGroupsPassed = schoolSubjectGroups.every((group) => {
    return (group.subject_ids || []).filter((subjectId) => {
      return subjectGrades[normaliseId(subjectId)] !== undefined;
    }).length >= (group.minimum_required || 1);
  });
  const passed =
    (degreePassed || alternativePassed) &&
    institutionPassed &&
    degreeStatusPassed &&
    degreeAgePassed &&
    gradeProfilePassed &&
    requiredSubjectsPassed &&
    subjectOptionsPassed &&
    subjectGroupsPassed;

  addCheck(state, 'graduate_degree_and_school_qualifications', passed, {
    degree_classification_met: degreePassed,
    postgraduate_alternative_met: alternativePassed,
    recognised_institution_met: institutionPassed,
    degree_status_met: degreeStatusPassed,
    degree_age_met: degreeAgePassed,
    school_qualification_grade_profile_met: gradeProfilePassed,
    school_required_subjects_met: requiredSubjectsPassed,
    school_subject_grade_rule_met: subjectOptionsPassed,
    school_subject_groups_met: subjectGroupsPassed
  });
  if (!passed) {
    addFailure(state, 'graduate_route_requirements_not_met');
  }
}

function evaluateScottishRoute(course, applicant, state) {
  const post16Rules = course.stage_1_eligibility?.post_16?.scottish || {};
  const national5Rules = national5RulesForCourse(course);
  const profile = applicant.scottish_profile || {};
  const national5 = profileToSubjectMap({ subjects: profile.national_5_subjects || [] });
  const higherSubjects = scottishProfileSubjects(profile, 'higher_subjects');
  const advancedHigherSubjects = scottishProfileSubjects(profile, 'advanced_higher_subjects');
  const allPost16ScottishSubjects = [...higherSubjects, ...advancedHigherSubjects];
  const higherGrades = scottishSubjectMap(higherSubjects);
  const advancedHigherGrades = scottishSubjectMap(advancedHigherSubjects, {}, 'advanced_higher');
  const national5Requirements = national5RequirementsFor(national5Rules, state.applicant_group_ids);
  const failedNational5Requirements = national5Requirements.filter((requirement) => {
    return !national5RequirementMet(
      requirement,
      national5,
      higherGrades,
      advancedHigherGrades,
      state.applicant_group_ids
    );
  });
  const national5MinimumCountPassed = national5MinimumCountMet(national5, national5Rules);
  const national5Passed =
    national5MinimumCountPassed &&
    failedNational5Requirements.length === 0;
  addCheck(state, 'national_5_requirements', national5Passed, {
    minimum_count_met: national5MinimumCountPassed,
    required_subjects_met: failedNational5Requirements.length === 0,
    evaluated_requirement_ids: national5Requirements.map((requirement) => {
      return requirement.requirement_id || requirement.subject_id || null;
    }).filter(Boolean),
    failed_requirement_ids: failedNational5Requirements.map((requirement) => {
      return requirement.requirement_id || requirement.subject_id || null;
    }).filter(Boolean)
  });
  if (!national5Passed) {
    addFailure(state, 'national_5_requirements_not_met');
  }

  const contextualScottishRoutesImplemented = post16Rules.contextual_route_implemented === true;
  const routes = (post16Rules.grade_requirements || []).filter((route) => {
    const routeGroups = route.applies_to_group_ids || [];
    const contextualRoute =
      routeGroups.includes('contextual') ||
      routeGroups.includes('widening_participation');
    return groupRuleApplies(route, state.applicant_group_ids) &&
      (!contextualRoute || contextualScottishRoutesImplemented);
  });
  const subjectGroupsMeet = (grades, groups) => {
    return (groups || []).every((group) => {
      return (group.subject_ids || []).filter((subjectId) => {
        return grades[normaliseId(subjectId)] !== undefined;
      }).length >= (group.minimum_required || 1);
    });
  };
  const subjectsMeet = (grades, subjectIds) => {
    return (subjectIds || []).every((subjectId) => {
      return grades[normaliseId(subjectId)] !== undefined;
    });
  };
  const routeManualReviewReasons = new Map();
  const routeMeets = (route) => {
    const routeHigherGrades = scottishSubjectMap(higherSubjects, route, 'higher');
    const routeAdvancedHigherGrades = scottishSubjectMap(
      advancedHigherSubjects,
      route,
      'advanced_higher'
    );
    const sameSittingLevel = normaliseId(route.same_sitting_qualification_level);
    const routeSittingSubjects = sameSittingLevel === 'higher' ||
      sameSittingLevel === 'scottish_highers'
      ? higherSubjects
        : sameSittingLevel === 'advanced_higher' ||
          sameSittingLevel === 'advanced_highers'
        ? advancedHigherSubjects
        : allPost16ScottishSubjects;
    const routeSittingAssessment = scottishSameSittingAssessment(
      profile,
      routeSittingSubjects,
      route
    );
    const routeSittingPassed = routeSittingAssessment.passed;
    const sameYearSubjectRulesPassed = scottishSameYearSubjectRulesMeet(
      higherSubjects,
      advancedHigherSubjects,
      route.required_subject_same_school_year_rules || []
    );
    const combinedGradeRequirementsPassed = combinedScottishGradeRequirementsMeet(
      higherSubjects,
      advancedHigherSubjects,
      route.combined_grade_requirements || []
    );
    const higherProfileRequired =
      (route.higher_grade_profile || []).length > 0 ||
      (route.higher_grade_profile_options || []).length > 0;
    const advancedHigherProfileRequired =
      (route.advanced_higher_grade_profile || []).length > 0 ||
      (route.advanced_higher_grade_profile_options || []).length > 0;

    if (route.qualification_level === 'scottish_highers_and_advanced_highers') {
      const higherSubjectOptionsPassed = subjectGradeOptionsMeet(
        routeHigherGrades,
        route.higher_required_subject_grade_options || [],
        'higher'
      );
      const advancedHigherSubjectOptionsPassed = subjectGradeOptionsMeet(
        routeAdvancedHigherGrades,
        route.advanced_higher_required_subject_grade_options ||
          route.required_subject_grade_options ||
          [],
        'advanced_higher'
      );
      const passed = routeSittingPassed &&
        (!higherProfileRequired || gradeProfileOptionsMeet(
          Object.values(routeHigherGrades),
          route.higher_grade_profile || [],
          route.higher_grade_profile_options || []
        )) &&
        (!advancedHigherProfileRequired || gradeProfileOptionsMeet(
          Object.values(routeAdvancedHigherGrades),
          route.advanced_higher_grade_profile || [],
          route.advanced_higher_grade_profile_options || []
        )) &&
        combinedGradeRequirementsPassed &&
        subjectsMeet(
          routeHigherGrades,
          route.higher_required_subject_ids || route.required_subject_ids
        ) &&
        subjectGroupsMeet(
          routeHigherGrades,
          route.higher_one_of_subject_groups || route.one_of_subject_groups
        ) &&
        subjectGradeRequirementsMeet(
          routeHigherGrades,
          route.higher_subject_grade_requirements || []
        ) &&
        higherSubjectOptionsPassed &&
        subjectsMeet(
          routeAdvancedHigherGrades,
          route.advanced_higher_required_subject_ids
        ) &&
        subjectGroupsMeet(
          routeAdvancedHigherGrades,
          route.advanced_higher_one_of_subject_groups
        ) &&
        subjectGradeRequirementsMeet(
          routeAdvancedHigherGrades,
          route.advanced_higher_subject_grade_requirements || []
        ) &&
        advancedHigherSubjectOptionsPassed &&
        sameYearSubjectRulesPassed;
      if (passed && routeSittingAssessment.requires_manual_review) {
        routeManualReviewReasons.set(route, routeSittingAssessment.manual_review_reason);
      }
      return passed;
    }

    const grades = route.qualification_level === 'advanced_higher'
      ? routeAdvancedHigherGrades
      : routeHigherGrades;
    const routeLevel = route.qualification_level === 'advanced_higher'
      ? 'advanced_higher'
      : 'higher';
    const directSubjectGradesPassed = subjectGradeRequirementsMeet(
      grades,
      route.subject_grade_requirements || [],
      routeLevel
    );
    const subjectOptionsPassed = subjectGradeOptionsMeet(
      grades,
      route.required_subject_grade_options || [],
      routeLevel
    );
    const passed = routeSittingPassed &&
      gradeProfileOptionsMeet(
        Object.values(grades),
        route.grade_profile || [],
        route.grade_profile_options || []
      ) &&
      subjectsMeet(grades, route.required_subject_ids) &&
      subjectGroupsMeet(grades, route.one_of_subject_groups) &&
      directSubjectGradesPassed &&
      subjectOptionsPassed &&
      sameYearSubjectRulesPassed;
    if (passed && routeSittingAssessment.requires_manual_review) {
      routeManualReviewReasons.set(route, routeSittingAssessment.manual_review_reason);
    }
    return passed;
  };
  const passedRoute = routes.find(routeMeets) || null;
  const predictedManualReviewRoute = !passedRoute && deriveQualificationStatus(applicant) === 'predicted'
    ? routes
      .map((route) => ({
        route,
        reviewRoute: scottishPredictedManualReviewRoute(route)
      }))
      .find((candidate) => candidate.reviewRoute && routeMeets(candidate.reviewRoute)) || null
    : null;
  const post16Passed = Boolean(passedRoute);
  const post16ReviewReason = passedRoute ? routeManualReviewReasons.get(passedRoute) : null;
  const post16ManualReviewReason = predictedManualReviewRoute
    ? (
      predictedManualReviewRoute.reviewRoute.manual_review_reason ||
      'scottish_predicted_grade_confirmation_required'
    )
    : post16ReviewReason;
  const displayRoute = passedRoute || predictedManualReviewRoute?.route || null;
  addCheck(state, 'scottish_post_16_requirements', post16Passed, {
    ...(displayRoute?.qualification_level ? {
      qualification_level: displayRoute.qualification_level
    } : {}),
    ...(post16ManualReviewReason ? {
      status: 'manual_review',
      manual_review_reason: post16ManualReviewReason
    } : {})
  });
  if (post16Passed || predictedManualReviewRoute) {
    const resolvedRoute = passedRoute || predictedManualReviewRoute.route;
    const passedRouteGroups = resolvedRoute.applies_to_group_ids || [];
    const contextualRoute =
      passedRouteGroups.includes('contextual') ||
      passedRouteGroups.includes('widening_participation');
    const passedRoutePathway = resolvedRoute.academic_pathway ||
      (contextualRoute ? 'contextual' : null);
    if (passedRoutePathway) {
      state.academic_pathway = state.academic_pathway || passedRoutePathway;
    }
    state.academic_pathway_id = state.academic_pathway_id ||
      resolvedRoute.pathway_id ||
      resolvedRoute.route_id ||
      resolvedRoute.requirement_id ||
      null;
    if (post16ManualReviewReason) {
      addManualReview(state, post16ManualReviewReason);
    }
  }
  if (!post16Passed && !predictedManualReviewRoute) {
    addFailure(state, 'scottish_post_16_requirements_not_met');
  }
}

function evaluateIrishRoute(course, applicant, state) {
  const rules = course.stage_1_eligibility?.post_16?.irish || {};
  const profile = applicant.irish_profile || {};
  const leavingRule = rules.leaving_certificate || {};
  const juniorRule = rules.junior_cycle_or_gcse_equivalent || {};
  const leavingGrades = profileToSubjectMap({
    subjects: profile.leaving_certificate_subjects || []
  });
  const juniorGrades = profileToSubjectMap({
    subjects: profile.junior_cycle_subjects || []
  });
  const minimumLeavingRank =
    IRISH_LEAVING_CERTIFICATE_GRADE_RANK[normaliseGrade(leavingRule.minimum_grade)] ??
    Number.POSITIVE_INFINITY;
  const leavingPassed =
    Object.keys(leavingGrades).length >= (leavingRule.minimum_subject_count || 0) &&
    Object.values(leavingGrades).every((grade) => {
      return (IRISH_LEAVING_CERTIFICATE_GRADE_RANK[normaliseGrade(grade)] || 0) >=
        minimumLeavingRank;
    }) &&
    (leavingRule.required_subject_ids || []).every((subjectId) => {
      return leavingGrades[normaliseId(subjectId)] !== undefined;
    }) &&
    (
      !leavingRule.second_science_any_of_subject_ids ||
      leavingRule.second_science_any_of_subject_ids.some((subjectId) => {
        return leavingGrades[normaliseId(subjectId)] !== undefined;
      })
    );
  const minimumJuniorGrade = normaliseId(juniorRule.minimum_grade);
  const juniorPassed =
    Object.keys(juniorGrades).length >= (juniorRule.minimum_subject_count || 0) &&
    Object.values(juniorGrades).every((grade) => {
      return normaliseId(grade) === minimumJuniorGrade;
    }) &&
    (juniorRule.required_subject_ids || []).every((subjectId) => {
      return juniorGrades[normaliseId(subjectId)] !== undefined;
    });
  const passed = leavingPassed && juniorPassed;

  addCheck(state, 'irish_leaving_certificate_route', passed, {
    leaving_certificate_met: leavingPassed,
    junior_cycle_or_equivalent_met: juniorPassed
  });
  if (!passed) {
    addFailure(state, 'irish_requirements_not_met');
  }
}

function getBirminghamUkwpmedRule(course = {}) {
  if (course.profile_id !== 'birmingham-a100') {
    return null;
  }
  return (course.contextual_admissions?.guaranteed_interview_rules || [])
    .find((candidate) => normaliseId(candidate.route) === 'ukwpmed_guaranteed_interview') || null;
}

function getBirminghamUkwpmedALevelRoute(course = {}, rule = {}) {
  const aLevel = course.stage_1_eligibility?.post_16?.a_level || {};
  const routeIds = new Set([
    rule.rule_id,
    rule.route,
    'ukwpmed_birmingham_appendix_1',
    'ukwpmed_guaranteed_interview',
    'ukwpmed'
  ].map(normaliseId));

  return [
    ...(aLevel.grade_requirements || []),
    ...(aLevel.routed_offer_routes || []),
    ...(aLevel.presentation_offer_routes || [])
  ].find((route) => {
    return [
      route?.requirement_id,
      route?.route_id,
      route?.pathway_id,
      route?.selection_route_id,
      route?.academic_pathway
    ].some((routeId) => routeIds.has(normaliseId(routeId)));
  }) || {};
}

function birminghamDedicatedRouteForUkwpmedProgramme(course = {}, programmeId = '') {
  const normalisedProgrammeId = normaliseId(programmeId);
  if (!normalisedProgrammeId) {
    return null;
  }

  return (course.contextual_admissions?.guaranteed_interview_rules || [])
    .find((candidate) => {
      return candidate?.separate_from_ukwpmed_route === true &&
        normaliseId(candidate.programme_evidence?.programme_id) === normalisedProgrammeId;
    }) || null;
}

function getBirminghamUkwpmedProgrammeEvidence(applicant = {}, course = {}, rule = {}) {
  const access = applicant.contextual_profile?.access_programmes || {};
  const evidence = access.ukwpmed || {};
  const programme = rule.programme_evidence || {};
  const programmeId = normaliseId(evidence.programme_id);
  const recognisedProgramme = getRecognisedUkwpmedProgramme(programmeId);
  const dedicatedRoute = birminghamDedicatedRouteForUkwpmedProgramme(course, programmeId);
  const status = normaliseId(evidence.programme_status || evidence.status);
  const acceptedStatuses = (programme.accepted_programme_statuses || ['completed'])
    .map(normaliseId);
  const recognisedByBirmingham = isUkwpmedRecognisedByMedicalSchool(
    programme.recognised_by_university_id || course.profile_id,
    recognisedProgramme?.programme_id
  );

  return {
    evidence,
    recognised_programme: recognisedProgramme,
    programme_id: programmeId,
    programme_status: status,
    dedicated_route_id: dedicatedRoute ? normaliseId(dedicatedRoute.route) : null,
    matched_programme: Boolean(recognisedProgramme) &&
      recognisedByBirmingham &&
      !dedicatedRoute,
    completed: Boolean(recognisedProgramme) &&
      recognisedByBirmingham &&
      !dedicatedRoute &&
      acceptedStatuses.includes(status)
  };
}

function evaluateBirminghamUkwpmedRoute(course, applicant, state) {
  const rule = getBirminghamUkwpmedRule(course);
  if (!rule) {
    return false;
  }

  const programme = getBirminghamUkwpmedProgrammeEvidence(applicant, course, rule);
  if (!programme.matched_programme) {
    return false;
  }
  if (!programme.completed) {
    addCheck(state, rule.rule_id || 'ukwpmed_appendix_1', false, {
      selection_route_id: 'ukwpmed_guaranteed_interview',
      evidence_path: rule.programme_evidence?.evidence_path ||
        'contextual_profile.access_programmes.ukwpmed',
      programme_id: programme.programme_id,
      programme_status: programme.programme_status,
      reason: 'ukwpmed_completion_not_verified'
    });
    addFailure(state, 'ukwpmed_completion_not_verified');
    return true;
  }

  const appendix = rule.appendix_1 || {};
  const gcseGrades = profileToSubjectMap(applicant.gcse_profile);
  const countableGcseGrades = getCountableGcseGrades(gcseGrades);
  const combinedScience = parseCombinedScienceGrades(
    gcseGrades.combined_science || gcseGrades.double_science
  );
  const namedGrades = [
    gcseGrades.english_language,
    gcseGrades.mathematics,
    gcseGrades.chemistry ?? combinedScience[1],
    gcseGrades.biology ?? combinedScience[0]
  ];
  const aLevelGrades = getALevelSubjectMap(applicant);
  const aLevelRoute = getBirminghamUkwpmedALevelRoute(course, rule);
  const requiredALevelProfile = aLevelGradeProfileForQualificationStatus(
    {
      ...aLevelRoute,
      predicted_minimum_profile:
        appendix.predicted_a_level_profile || aLevelRoute.predicted_minimum_profile
    },
    applicant
  );
  const requiredNamedProfile =
    appendix.named_subject_grade_profile?.grades_in_any_order ||
    [];
  const gcsePassed =
    countableGcseGrades.length >= (appendix.minimum_gcse_count || 0) &&
    countableGcseGrades.every((grade) => {
      return gradeMeets(grade, appendix.minimum_gcse_grade, 'gcse');
    }) &&
    namedGrades.every((grade) => grade !== undefined) &&
    gradeProfileMeets(namedGrades, requiredNamedProfile, 'gcse');
  const aLevelPassed =
    gradeProfileMeets(
      Object.values(aLevelGrades),
      requiredALevelProfile
    ) &&
    aLevelGrades.chemistry !== undefined &&
    (
      aLevelGrades.biology !== undefined ||
      (
        appendix.human_biology_accepted_in_place_of_biology === true &&
        aLevelGrades.human_biology !== undefined
      )
    );
  const ucatTaken =
    appendix.ucat_must_be_taken !== true ||
    applicant.admissions_tests?.ucat?.taken === true;
  const passed = gcsePassed && aLevelPassed && ucatTaken;

  addCheck(state, rule.rule_id || 'ukwpmed_appendix_1', passed, {
    selection_route_id: 'ukwpmed_guaranteed_interview',
    evidence_path: rule.programme_evidence?.evidence_path ||
      'contextual_profile.access_programmes.ukwpmed',
    programme_id: programme.programme_id,
    provider_university_id: programme.recognised_programme?.provider_university_id || '',
    programme_status: programme.programme_status,
    gcse_thresholds_met: gcsePassed,
    a_level_thresholds_met: aLevelPassed,
    qualification_status: deriveQualificationStatus(applicant),
    required_a_level_profile: formatGradeProfile(requiredALevelProfile),
    ucat_taken: ucatTaken,
    ucat_threshold_required: appendix.ucat_threshold_required === true,
    guaranteed_interview: passed
  });

  if (passed) {
    state.guaranteed_interview = true;
    state.selection_route_id = 'ukwpmed_guaranteed_interview';
    state.academic_pathway = 'ukwpmed';
    state.academic_pathway_id = 'ukwpmed_birmingham_appendix_1';
  } else {
    addFailure(state, 'ukwpmed_appendix_1_thresholds_not_met');
  }

  return true;
}

function getBirminghamPathwaysRule(course = {}) {
  if (course.profile_id !== 'birmingham-a100') {
    return null;
  }
  return (course.contextual_admissions?.guaranteed_interview_rules || [])
    .find((candidate) => normaliseId(candidate.route) === 'pathways_to_birmingham') || null;
}

function getBirminghamPathwaysProgrammeEvidence(applicant = {}, rule = {}) {
  const access = applicant.contextual_profile?.access_programmes || {};
  const evidence = access.ukwpmed || {};
  const programme = rule.programme_evidence || {};
  const programmeId = normaliseId(evidence.programme_id);
  const requiredProgrammeId = normaliseId(programme.programme_id);
  const status = normaliseId(evidence.programme_status || evidence.status);
  const acceptedStatuses = (programme.accepted_programme_statuses || ['completed'])
    .map(normaliseId);

  return {
    evidence,
    programme_id: programmeId,
    programme_status: status,
    matched_programme: Boolean(requiredProgrammeId) && programmeId === requiredProgrammeId,
    completed: Boolean(requiredProgrammeId) &&
      programmeId === requiredProgrammeId &&
      acceptedStatuses.includes(status)
  };
}

function hasCompletedBirminghamGuaranteedProgrammeEvidence(course, applicant) {
  const pathwaysRule = getBirminghamPathwaysRule(course);
  if (
    pathwaysRule &&
    getBirminghamPathwaysProgrammeEvidence(applicant, pathwaysRule).completed
  ) {
    return true;
  }

  const ukwpmedRule = getBirminghamUkwpmedRule(course);
  return Boolean(
    ukwpmedRule &&
    getBirminghamUkwpmedProgrammeEvidence(applicant, course, ukwpmedRule).completed
  );
}

function evaluateBirminghamPathwaysRoute(course, applicant, state) {
  const rule = getBirminghamPathwaysRule(course);
  if (!rule) {
    return false;
  }

  const programme = getBirminghamPathwaysProgrammeEvidence(applicant, rule);
  if (!programme.matched_programme) {
    return false;
  }
  if (!programme.completed) {
    addCheck(state, rule.rule_id || 'pathways_to_birmingham', false, {
      selection_route_id: 'pathways_to_birmingham',
      evidence_path: rule.programme_evidence?.evidence_path ||
        'contextual_profile.access_programmes.ukwpmed',
      programme_id: programme.programme_id,
      programme_status: programme.programme_status,
      reason: 'pathways_to_birmingham_completion_required'
    });
    return false;
  }

  const criteria = rule.pathways_academic_criteria || {};
  const gcseGrades = profileToSubjectMap(applicant.gcse_profile);
  const countableGcseGrades = getCountableGcseGrades(gcseGrades);
  const combinedScience = parseCombinedScienceGrades(
    gcseGrades.combined_science || gcseGrades.double_science
  );
  const namedGcseGrades = [
    gcseGrades.english_language,
    gcseGrades.mathematics,
    gcseGrades.chemistry ?? combinedScience[1],
    gcseGrades.biology ?? combinedScience[0]
  ];
  const gcsePassed =
    countableGcseGrades.length >= (criteria.minimum_gcse_count || 0) &&
    countableGcseGrades.every((grade) => {
      return gradeMeets(grade, criteria.minimum_gcse_grade || '4', 'gcse');
    }) &&
    namedGcseGrades.every((grade) => grade !== undefined && grade !== null && grade !== '') &&
    gradeProfileMeets(
      namedGcseGrades,
      criteria.named_subject_grade_profile?.grades_in_any_order || [],
      'gcse'
    );

  const routeRules = course.stage_1_eligibility?.post_16?.a_level || {};
  const aLevelRoute = (routeRules.grade_requirements || [])
    .find((requirement) => {
      return normaliseId(requirement.requirement_id) === 'pathways_to_birmingham_a_level';
    }) || {};
  const aLevelGrades = getALevelSubjectMap(applicant);
  const countableALevelGrades = getCountableALevelSubjectMap(aLevelGrades, routeRules);
  const requiredGradeProfile = aLevelGradeProfileForQualificationStatus(
    {
      ...aLevelRoute,
      predicted_minimum_profile:
        criteria.predicted_a_level_profile || aLevelRoute.predicted_minimum_profile,
      offer_grade_profile:
        criteria.final_offer_profile || aLevelRoute.offer_grade_profile
    },
    applicant
  );
  const requiredSubjectsPassed = (criteria.required_a_level_subject_ids || [])
    .every((subjectId) => aLevelGrades[normaliseId(subjectId)] !== undefined);
  const secondSciencePassed = (criteria.second_science_any_of_subject_ids || [])
    .some((subjectId) => aLevelGrades[normaliseId(subjectId)] !== undefined);
  const excludedSubjectIds = new Set(
    (aLevelRoute.excluded_subject_ids || routeRules.excluded_subject_ids || [])
      .map(normaliseId)
  );
  const excludedSubjectsPassed = Object.keys(aLevelGrades)
    .every((subjectId) => !excludedSubjectIds.has(subjectId));
  const aLevelPassed =
    gradeProfileMeets(Object.values(countableALevelGrades), requiredGradeProfile) &&
    requiredSubjectsPassed &&
    secondSciencePassed &&
    excludedSubjectsPassed;
  const ucatTaken =
    criteria.ucat_must_be_taken !== true ||
    applicant.admissions_tests?.ucat?.taken === true;
  const passed = gcsePassed && aLevelPassed && ucatTaken;

  addCheck(state, rule.rule_id || 'pathways_to_birmingham', passed, {
    selection_route_id: 'pathways_to_birmingham',
    academic_pathway: 'pathways_to_birmingham',
    pathway_id: 'pathways_to_birmingham_a_level',
    evidence_path: rule.programme_evidence?.evidence_path ||
      'contextual_profile.access_programmes.ukwpmed',
    programme_id: programme.programme_id,
    programme_status: programme.programme_status,
    gcse_thresholds_met: gcsePassed,
    a_level_thresholds_met: aLevelPassed,
    ucat_taken: ucatTaken,
    guaranteed_interview: passed
  });

  if (!passed) {
    return false;
  }

  state.guaranteed_interview = true;
  state.selection_route_id = 'pathways_to_birmingham';
  state.academic_pathway = 'pathways_to_birmingham';
  state.academic_pathway_id = 'pathways_to_birmingham_a_level';
  return true;
}

function evaluateVerifiedRoute(applicant, state, route) {
  const profile = route === 'access'
    ? (applicant.access_to_medicine_profile || applicant.access_to_he_profile || {})
    : (applicant.international_qualification || {});
  const passed = route === 'access'
    ? profile.provider_approved_by_institution === true && profile.requirements_met === true
    : profile.equivalence_status === 'verified' &&
      profile.verified_by_institution === true &&
      profile.requirements_met === true;
  addCheck(state, `${route}_verified_route`, passed);
  if (!passed) {
    addFailure(state, `${route}_route_not_verified`);
  }
}

function evaluateQualificationRoute(course, applicant, state) {
  const route = state.qualification_route;
  const blockedRouteAliases = {
    foundation: 'foundation_programmes'
  };
  const blockedRoute = (course.stage_1_eligibility?.post_16?.blocked_routes || [])
    .find((candidate) => {
      return normaliseId(candidate.route_id) ===
        (blockedRouteAliases[route] || route);
    });

  if (blockedRoute?.status === 'blocked') {
    addFailure(state, `qualification_route_explicitly_blocked:${route}`);
    return;
  }

  if (route === 'a_level') {
    evaluateALevelRoute(course, applicant, state);
  } else if (route === 'international_baccalaureate' || route === 'ib') {
    evaluateIbRoute(course, applicant, state);
  } else if (route === 'btec') {
    evaluateBtecRoute(course, applicant, state);
  } else if (route === 'graduate') {
    evaluateGraduateRoute(course, applicant, state);
  } else if (route === 'irish_leaving_certificate' || route === 'irish') {
    evaluateIrishRoute(course, applicant, state);
  } else if (route === 'ukwpmed') {
    addManualReview(state, 'legacy_ukwpmed_route_retired_use_step_6_programme_evidence');
  } else if (route === 't_level') {
    addFailure(state, 't_level_not_accepted');
  } else if (route === 'access_to_he' || route === 'access' || route === 'access_to_medicine') {
    if (
      course.stage_1_eligibility?.post_16?.access_to_he?.status ===
      'official_source_verified_with_provider_gate'
    ) {
      evaluateVerifiedRoute(applicant, state, 'access');
    } else {
      addFailure(state, 'access_to_he_not_accepted');
    }
  } else if (route === 'mixed_t_level_a_level') {
    addManualReview(state, 'mixed_t_level_a_level_case');
  } else if (route === 'scottish' || route === 'scottish_advanced_highers') {
    if (course.stage_1_eligibility?.post_16?.scottish?.route_implemented === true) {
      evaluateScottishRoute(course, applicant, state);
    } else {
      addManualReview(state, 'scottish_prerequisites_incomplete');
    }
  } else if (route === 'international_qualification') {
    const qualificationName = normaliseId(
      applicant.international_qualification?.name ||
      applicant.international_qualification?.qualification
    );
    const explicitlyUnsupported =
      (course.stage_1_eligibility?.unsupported_international_qualifications || [])
        .some((qualification) => {
          return normaliseId(qualification.qualification) === qualificationName &&
            qualification.status === 'blocked';
        });
    if (explicitlyUnsupported) {
      addFailure(state, 'international_qualification_explicitly_blocked');
    } else if (
      Array.isArray(course.stage_1_eligibility?.unsupported_international_qualifications)
    ) {
      addManualReview(state, 'unlisted_international_qualification');
    } else {
      evaluateVerifiedRoute(applicant, state, 'international_qualification');
    }
  } else if (route === 'foundation') {
    addManualReview(state, 'foundation_applicant');
  } else if (route === 'unknown') {
    addManualReview(state, 'qualification_route_not_resolved');
  } else {
    addFailure(state, `unsupported_qualification_route:${route}`);
  }
}

function evaluateResits(course, applicant, state) {
  const resitPolicy = course.stage_1_eligibility?.resits || {};
  const resit = applicant.applicant_identity?.resit || applicant.resit_profile || {};
  const hasResits = resit === true || resit.has_resits === true;

  if (!hasResits) {
    return;
  }
  const subjectsResat = Array.isArray(resit.subjects_resat) ? resit.subjects_resat : [];
  const resatLevels = subjectsResat
    .map((subject) => normaliseId(subject.qualification_level || subject.level || subject.qualification))
    .filter(Boolean);
  const onlyGcseOrNational5Resits =
    subjectsResat.length > 0 &&
    resatLevels.length === subjectsResat.length &&
    resatLevels.every((level) => {
      return ['gcse', 'igcse', 'national_5', 'national5'].includes(level);
    });
  if (
    course?.profile_id === 'glasgow-a100' &&
    onlyGcseOrNational5Resits &&
    resit.includes_higher_or_advanced_higher_resits !== true
  ) {
    addCheck(state, 'post_16_resit_policy', true, {
      ignored_gcse_or_national_5_resits: true
    });
    return;
  }
  if (resitPolicy.policy === 'not_accepted_unless_official_exception') {
    if (resit.official_exception_approved === true) {
      addCheck(state, 'official_resit_exception', true);
      return;
    }
    if (
      resit.extenuating_circumstances_exception_claimed === true &&
      resit.official_exception_approved !== false
    ) {
      addManualReview(state, 'extenuating_circumstances_exception_unverified');
      return;
    }
    addFailure(state, 'resits_not_accepted');
    return;
  }
  if (resitPolicy.allowed === false) {
    addFailure(state, 'resits_not_accepted');
    return;
  }

  const formSubmitted = resit.applicant_form_submitted === true;
  let routeMinimumPassed = true;
  if (state.qualification_route === 'a_level') {
    routeMinimumPassed = gradeProfileMeets(
      resit.first_sitting_grade_profile || [],
      ['A', 'B', 'B']
    );
  } else if (['international_baccalaureate', 'ib'].includes(state.qualification_route)) {
    routeMinimumPassed = Number(resit.first_sitting_total_points) >= 34;
  } else if (['scottish', 'scottish_advanced_highers'].includes(state.qualification_route)) {
    routeMinimumPassed = gradeProfileMeets(
      resit.first_sitting_advanced_higher_grade_profile || [],
      ['B', 'B']
    );
  }
  if (formSubmitted || resitPolicy.policy === 'allowed_with_route_specific_conditions') {
    const passed = formSubmitted && routeMinimumPassed;
    addCheck(state, 'route_specific_resit_pathway', passed);
    if (!passed) {
      addFailure(state, 'resit_policy_not_met');
    }
    return;
  }

  const cycles =
    resit.resit_year_attempt_cycles ??
    resit.attempt_cycles ??
    resit.resit_years;
  const academicYears = resit.total_academic_years;
  if (
    resit.non_standard_sequence === true ||
    resit.sequence_ambiguous === true ||
    !Number.isInteger(cycles)
  ) {
    addManualReview(state, 'ambiguous_resit_sequence');
    return;
  }

  const cyclesPassed =
    cycles >= 1 &&
    cycles <= resitPolicy.maximum_resit_year_attempt_cycles;
  const timeframePassed =
    !Number.isInteger(academicYears) ||
    academicYears <= resitPolicy.maximum_academic_years;
  const passed = cyclesPassed && timeframePassed;
  addCheck(state, 'resit_year_attempt_cycle', passed, {
    actual_attempt_cycles: cycles,
    maximum_attempt_cycles: resitPolicy.maximum_resit_year_attempt_cycles,
    subjects_resat: Array.isArray(resit.subjects_resat) ? resit.subjects_resat.length : null
  });
  if (!passed) {
    addFailure(state, 'resit_policy_not_met');
  }
}

function sameSittingRequirement(course) {
  return course?.stage_1_eligibility?.academic_requirements?.same_sitting ||
    course?.stage_1_eligibility?.post_16?.same_sitting ||
    null;
}

function resolveSameSittingEvidence(applicant, qualificationRoute) {
  if (qualificationRoute === 'a_level') {
    const value =
      applicant.a_level_profile?.completed_in_one_sitting ??
      applicant.a_level_profile?.same_sitting_confirmed ??
      applicant.same_sitting_confirmed;
    if (typeof value === 'boolean') {
      return {
        supported: true,
        known: true,
        passed: value,
        evidence_path: 'a_level_profile.completed_in_one_sitting'
      };
    }
    return {
      supported: true,
      known: false,
      passed: null,
      evidence_path: 'a_level_profile.completed_in_one_sitting'
    };
  }

  return {
    supported: false,
    known: false,
    passed: null,
    evidence_path: null
  };
}

function evaluateSameSittingRequirement(course, applicant, state) {
  const requirement = sameSittingRequirement(course);
  if (requirement?.required !== true) {
    return;
  }

  const routes = (requirement.qualification_routes || ['a_level'])
    .map(normaliseId);
  if (!routes.includes(normaliseId(state.qualification_route))) {
    return;
  }

  const evidence = resolveSameSittingEvidence(
    applicant,
    normaliseId(state.qualification_route)
  );
  if (!evidence.supported) {
    addCheck(state, 'same_sitting_requirement', false, {
      evidence_known: false,
      qualification_route: state.qualification_route
    });
    addManualReview(
      state,
      `same_sitting_evidence_not_supported_for_route:${state.qualification_route}`
    );
    return;
  }
  if (!evidence.known) {
    addCheck(state, 'same_sitting_requirement', false, {
      evidence_known: false,
      qualification_route: state.qualification_route,
      evidence_path: evidence.evidence_path
    });
    addManualReview(
      state,
      `same_sitting_evidence_missing:${evidence.evidence_path}`
    );
    return;
  }
  addCheck(state, 'same_sitting_requirement', evidence.passed, {
    evidence_known: true,
    qualification_route: state.qualification_route,
    evidence_path: evidence.evidence_path
  });
  if (!evidence.passed) {
    addFailure(state, 'same_sitting_requirement_not_met');
  }
}

function evaluateEnglishLanguage(course, applicant, state) {
  if (!state.applicant_group_ids.includes('international_fee')) {
    return;
  }

  const rules = course.stage_1_eligibility?.english_language || {};
  const evidence = applicant.english_language_profile || {};
  if (applicant.applicant_identity?.english_language_exempt === true) {
    return;
  }
  if (evidence.exemption_claimed === true) {
    addManualReview(state, 'english_language_exemption_requires_review');
    return;
  }

  const testName = normaliseId(evidence.test || evidence.test_name);
  if (!testName) {
    addManualReview(state, 'english_language_evidence_missing_or_exemption_unknown');
    return;
  }

  const ieltsRule = (rules.accepted_tests || []).find((test) => {
    return ['ielts', 'ielts_academic'].includes(normaliseId(test.test));
  });
  if (!['ielts', 'ielts_academic'].includes(testName) || !ieltsRule) {
    addManualReview(state, 'alternative_english_test_requires_review');
    return;
  }

  const scores = evidence.scores || evidence.components || evidence;
  const overallMinimum = Number(
    ieltsRule.overall_minimum ??
    ieltsRule.minimum_overall ??
    ieltsRule.overall
  );
  const componentMinimum = Number(
    ieltsRule.reading_minimum ??
    ieltsRule.minimum_each_component ??
    ieltsRule.components?.reading ??
    ieltsRule.overall
  );
  const passed =
    Number(evidence.overall ?? evidence.scores?.overall) >= overallMinimum &&
    Number(scores.reading) >= Number(ieltsRule.reading_minimum ?? componentMinimum) &&
    Number(scores.writing) >= Number(ieltsRule.writing_minimum ?? componentMinimum) &&
    Number(scores.listening) >= Number(ieltsRule.listening_minimum ?? componentMinimum) &&
    Number(scores.speaking) >= Number(ieltsRule.speaking_minimum ?? componentMinimum) &&
    evidence.valid_at_course_start !== false;
  addCheck(state, 'ielts_academic_minimum', passed);
  if (!passed) {
    addFailure(state, 'ielts_academic_requirements_not_met');
  }
}

function evaluateAdmissionsTests(course, applicant, state) {
  const tests = course.stage_1_eligibility?.admissions_tests || {};
  const ucat = tests.ucat || (
    normaliseId(tests.test) === 'ucat'
      ? {
          ...tests,
          maximum_total_score: tests.cognitive_total?.maximum
        }
      : {}
  );
  const evidence = applicant.admissions_tests?.ucat || {};
  const isGraduate = state.applicant_group_ids.includes('graduate_applicant');
  const isInternational = state.applicant_group_ids.includes('international_fee');
  const gamsatRule = (tests.other_tests || []).find((test) => {
    return normaliseId(test.test_id || test.name) === 'gamsat' && test.required === true;
  });
  const graduateCompensatoryPolicy = getGraduateCompensatoryPolicy(course);
  const usesGamsat = isGraduate && Boolean(gamsatRule) && !graduateCompensatoryPolicy?.ucat_remains_required;
  const ucatApplies = !usesGamsat &&
    !(ucat.excluded_group_ids || []).some((groupId) => {
      return state.applicant_group_ids.includes(groupId);
    });

  if (ucat.required === true && ucatApplies) {
    const present =
      evidence.taken !== false &&
      Number.isFinite(evidence.total_score);
    addCheck(state, 'ucat_required', present, {
      score_scale: evidence.score_scale ?? null
    });
    if (!present) {
      addFailure(state, 'required_admissions_test_missing:ucat');
    }
  }

  if (
    ucatApplies &&
    Number.isFinite(ucat.maximum_total_score) &&
    Number.isFinite(evidence.score_scale) &&
    evidence.score_scale !== ucat.maximum_total_score
  ) {
    addManualReview(state, 'ucat_score_scale_mismatch');
  }
  const minimumUcatTotalScore = resolveCourseUcatMinimumTotalScore(
    course,
    ucat,
    state.applicant_group_ids,
    state.contextual_eligibility
  );
  if (
    ucatApplies &&
    Number.isFinite(minimumUcatTotalScore) &&
    !(
      Number.isFinite(evidence.total_score) &&
      evidence.total_score >= minimumUcatTotalScore
    )
  ) {
    addFailure(state, 'minimum_ucat_total_not_met');
  }
  const ucatSubsectionMinimums = evaluateUcatSubsectionMinimums(ucat, evidence);
  if (ucatApplies && ucatSubsectionMinimums.checks.length > 0) {
    addCheck(state, 'ucat_section_minimums', ucatSubsectionMinimums.passed, {
      sections: ucatSubsectionMinimums.checks,
      failing_sections: ucatSubsectionMinimums.failing_sections
    });
    if (!ucatSubsectionMinimums.passed) {
      addFailure(state, 'ucat_section_minimum_not_met');
    }
  }
  if (
    ucatApplies &&
    Number.isInteger(evidence.test_year) &&
    Number.isInteger(applicant.application_year) &&
    !isUcatCycleValid(applicant.application_year, evidence.test_year)
  ) {
    addFailure(state, 'ucat_not_taken_in_application_year');
  }

  const sjtBand = evidence.sjt_band;
  const groupSjtPolicy = (tests.sjt?.group_policies || []).find((policy) => {
    return groupRuleApplies(policy, state.applicant_group_ids);
  });
  const excludedBands = groupSjtPolicy?.excluded_bands ?? tests.sjt?.excluded_bands ?? [];
  const sjtApplies = !isGraduate || graduateCompensatoryPolicy?.sjt_remains_required === true;
  if (
    sjtApplies &&
    (!isInternational || Boolean(groupSjtPolicy)) &&
    excludedBands.includes(sjtBand)
  ) {
    addFailure(state, 'sjt_band_excluded');
  } else if (sjtBand !== undefined && sjtBand !== null) {
    addCheck(state, 'sjt_policy', true, {
      band: sjtBand,
      used_in_selection: tests.sjt?.used === true
    });
  }

  if (usesGamsat) {
    const gamsat = applicant.admissions_tests?.gamsat || {};
    const sections = Array.isArray(gamsat.section_scores)
      ? gamsat.section_scores
      : Object.values(gamsat.section_scores || {});
    const present = Number.isFinite(gamsat.overall_score);
    const sectionMinimumMet =
      sections.length >= 3 &&
      sections.every((score) => Number.isFinite(score) && score >= 50);
    addCheck(state, 'gamsat_required', present);
    addCheck(state, 'gamsat_section_minimum', sectionMinimumMet);
    if (!present) {
      addFailure(state, 'required_admissions_test_missing:gamsat');
    }
    if (!sectionMinimumMet) {
      addFailure(state, 'minimum_gamsat_component_not_met');
    }
  }
}

function evaluateDeferral(course, applicant, state) {
  const deferral = applicant.deferred_entry_profile || {};
  if (deferral.post_offer_deferral_request === true) {
    addManualReview(state, 'post_offer_deferral_requires_review');
    return;
  }
  if (deferral.initial_deferred_entry === true) {
    const accepted =
      course.stage_1_eligibility?.deferred_entry?.initial_deferred_application?.accepted === true;
    addCheck(state, 'initial_deferred_entry', accepted);
    if (!accepted) {
      addFailure(state, 'initial_deferred_entry_not_accepted');
    }
  }
}

function evaluateManualReviewTriggers(course, applicant, state) {
  const groups = new Set(state.applicant_group_ids);
  const identity = applicant.applicant_identity || {};
  const international = applicant.international_qualification || {};
  const repeat = applicant.repeat_application || {};
  const completedBirminghamGuaranteedProgramme =
    hasCompletedBirminghamGuaranteedProgrammeEvidence(course, applicant);

  if (groups.has('home_fee') && groups.has('international_fee')) {
    addManualReview(state, 'ambiguous_fee_status');
  }
  if (!groups.has('home_fee') && !groups.has('international_fee')) {
    addManualReview(state, 'fee_status_not_resolved');
  }
  if (groups.has('graduate_applicant') && groups.has('school_leaver')) {
    addManualReview(state, 'mutually_exclusive_applicant_groups');
  }
  if (
    groups.has('international_fee') &&
    ['unlisted', 'unknown', 'unverified'].includes(
      normaliseId(international.equivalence_status)
    )
  ) {
    addManualReview(state, 'unlisted_international_equivalence');
  }
  if (
    (groups.has('contextual') || groups.has('widening_participation')) &&
    state.qualification_route !== 'ukwpmed' &&
    !completedBirminghamGuaranteedProgramme &&
    state.contextual_eligibility?.is_contextual !== true &&
    state.contextual_eligibility?.status !== 'information_needed' &&
    identity.contextual_status_confirmed !== true
  ) {
    addManualReview(state, 'contextual_wp_status_requires_confirmation');
  }
  if (
    !['aberdeen-a100', 'dundee-a100', 'st-andrews-a100', 'southampton-a100'].includes(course?.profile_id) &&
    state.contextual_eligibility?.status === 'information_needed' &&
    state.contextual_eligibility?.manual_review_reason
  ) {
    addManualReview(state, state.contextual_eligibility.manual_review_reason);
  }
  if (repeat.is_repeat_applicant === true || repeat.previous_application === true) {
    if (repeat.previous_aston_mmi_red_flag_rejection === true) {
      addFailure(state, 'previous_aston_mmi_red_flag_rejection');
    } else {
      addManualReview(state, 'repeat_application_policy_not_fully_published');
    }
  }
}

function contextualInformationNeededReason(state = {}) {
  return state.contextual_eligibility?.status === 'information_needed' &&
    state.contextual_eligibility?.manual_review_reason
    ? state.contextual_eligibility.manual_review_reason
    : null;
}

function unresolvedContextualEligibilityIsAcademicRouteRelevant(course, applicant, state = {}) {
  if (state.academic_pathway === 'standard' && state.failures.length === 0) {
    return false;
  }
  if (state.academic_pathway === 'contextual') {
    return true;
  }
  if (state.qualification_route !== 'a_level') {
    return state.failures.length > 0;
  }

  const routeRules = course.stage_1_eligibility?.post_16?.a_level || {};
  const contextualRequirements = resolveALevelRequirements(routeRules).filter((requirement) => {
    return academicPathwayForALevelRequirement(requirement) === 'contextual';
  });
  return contextualRequirements.some((requirement) => {
    const attempt = {
      ...state,
      checks: [],
      failures: [],
      manual_review_reasons: []
    };
    evaluateALevelRequirement(requirement, applicant, attempt, routeRules);
    return attempt.failures.length === 0;
  });
}

function contextualScottishAcademicPathways(course = {}) {
  const post16Rules = course.stage_1_eligibility?.post_16?.scottish || {};
  if (post16Rules.contextual_route_implemented !== true) {
    return [];
  }

  return (post16Rules.grade_requirements || [])
    .filter(isContextualAcademicRequirement)
    .map((requirement) => {
      return requirement.pathway_id ||
        requirement.route_id ||
        requirement.requirement_id ||
        null;
    })
    .filter(Boolean);
}

function commonPathwayReviewId(pathwayIds = []) {
  const ids = pathwayIds.filter(Boolean);
  if (ids.length === 0) {
    return null;
  }
  if (ids.length === 1) {
    return ids[0];
  }

  let prefix = ids[0];
  for (const id of ids.slice(1)) {
    while (prefix && !id.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix.replace(/_+$/g, '') || ids[0];
}

function probeUnresolvedScottishContextualAcademicRoute(course, applicant, state = {}) {
  if (state.qualification_route !== 'scottish') {
    return {
      would_pass: false,
      contextual_route_under_review: null
    };
  }

  const routeIdentity = resolveScottishMedicalSchoolRoute(course, applicant, {
    applicant_group_ids: state.applicant_group_ids || [],
    contextual_eligibility: state.contextual_eligibility || null,
    assume_contextual: true
  });
  if (!routeIdentity?.route_id?.endsWith('_contextual')) {
    return {
      would_pass: false,
      contextual_route_under_review: null
    };
  }

  const contextualPathwayIds = contextualScottishAcademicPathways(course);
  if (contextualPathwayIds.length === 0) {
    return {
      would_pass: false,
      contextual_route_under_review: null
    };
  }

  const applicantGroupIds = [
    ...new Set([
      ...(state.applicant_group_ids || []),
      'contextual',
      'widening_participation'
    ])
  ];
  const attempt = {
    ...state,
    applicant_group_ids: applicantGroupIds,
    checks: [],
    failures: [],
    manual_review_reasons: [],
    academic_pathway: null,
    academic_pathway_id: null
  };

  evaluateScottishRoute(course, applicant, attempt);
  const pathwayId = attempt.academic_pathway_id || null;
  const wouldPass =
    !attempt.failures.includes('scottish_post_16_requirements_not_met') &&
    attempt.academic_pathway === 'contextual' &&
    contextualPathwayIds.includes(pathwayId);

  return {
    would_pass: wouldPass,
    contextual_route_under_review: wouldPass
      ? commonPathwayReviewId(contextualPathwayIds)
      : null
  };
}

function applyContextualInformationNeededReview(course, applicant, state) {
  if (!['aberdeen-a100', 'dundee-a100', 'glasgow-a100', 'st-andrews-a100', 'southampton-a100', 'ucl-a100'].includes(course?.profile_id)) {
    return;
  }
  const reason = contextualInformationNeededReason(state);
  if (!reason) {
    return;
  }
  if (
    course?.profile_id === 'st-andrews-a100' &&
    state.qualification_route === 'scottish' &&
    state.contextual_eligibility?.is_contextual !== true
  ) {
    return;
  }
  if (!unresolvedContextualEligibilityIsAcademicRouteRelevant(course, applicant, state)) {
    return;
  }

  addManualReview(state, reason);
  if (
    state.qualification_route === 'a_level' &&
    state.failures.length === 1 &&
    state.failures.includes('a_level_requirements_not_met')
  ) {
    state.failures = [];
  }
  const unresolvedScottishContextualRoute = probeUnresolvedScottishContextualAcademicRoute(
    course,
    applicant,
    state
  );
  if (
    state.qualification_route === 'scottish' &&
    state.failures.length === 1 &&
    state.failures.includes('scottish_post_16_requirements_not_met') &&
    unresolvedScottishContextualRoute.would_pass
  ) {
    state.failures = [];
    for (const check of state.checks || []) {
      if (check?.check_id === 'scottish_post_16_requirements') {
        check.status = 'manual_review';
        check.manual_review_reason = reason;
        check.contextual_route_under_review =
          unresolvedScottishContextualRoute.contextual_route_under_review;
      }
    }
  }
}

function shouldEvaluateGcse(course, route, state) {
  if (state.manual_review_reasons.includes('unlisted_international_equivalence')) {
    return false;
  }

  const rules = course.stage_1_eligibility?.gcse || {};
  if ((rules.excluded_group_ids || []).some((groupId) => {
    return state.applicant_group_ids.includes(groupId);
  })) {
    return false;
  }
  if (
    Array.isArray(rules.applies_to_qualification_routes) &&
    !rules.applies_to_qualification_routes.map(normaliseId).includes(route)
  ) {
    return false;
  }
  if (Array.isArray(rules.applies_to_qualification_routes)) {
    return true;
  }

  return [
    'a_level',
    'international_baccalaureate',
    'ib',
    'btec'
  ].includes(route);
}

function sheffieldBradfordHallamReviewTakesPrecedence(state) {
  return (
    state.course_profile_id === 'sheffield-a100' &&
    state.contextual_eligibility?.status === 'information_needed' &&
    state.contextual_eligibility?.manual_review_reason === 'sheffield_contextual_evidence_needs_review' &&
    (state.contextual_eligibility?.missing_information || []).some((entry) => {
      return entry?.criterion_id === 'bradford_hallam_pathway_evidence_unresolved';
    })
  );
}

function finaliseCourseEligibilityState(course, state) {
  const status = sheffieldBradfordHallamReviewTakesPrecedence(state)
    ? 'manual_review'
    : state.manual_review_reasons.includes('bristol_scholars_tailored_offer_manual_review')
    ? 'manual_review'
    : state.failures.length
    ? 'not_eligible'
    : state.manual_review_reasons.length
      ? 'manual_review'
      : 'eligible';

  return {
    ...state,
    status,
    safeguards: {
      eligibility_only: true,
      interview_prediction_ready: false,
      offer_prediction_scope: 'out_of_scope',
      result_card_ready: false,
      do_not_infer: [...(course.engine_notes?.do_not_infer || [])]
    }
  };
}

function evaluateCourseEligibility(course, applicantInput) {
  if (!course || !applicantInput) {
    throw new TypeError('course and applicant are required.');
  }
  const applicant = normaliseApplicantProfile(applicantInput, { course });
  const contextualEligibility = evaluateCourseContextualEligibility(course, applicantInput);

  const state = {
    mode: 'eligibility_only',
    course_profile_id: course.profile_id,
    applicant_profile_id: applicant.profile_id || null,
    qualification_route: deriveQualificationRoute(applicant),
    applicant_group_ids: applyCourseSpecificDerivedApplicantGroups(
      course,
      applicant,
      deriveApplicantGroupIds(applicant),
      contextualEligibility
    ),
    checks: [],
    failures: [],
    manual_review_reasons: [],
    ...(contextualEligibility ? { contextual_eligibility: contextualEligibility } : {})
  };
  const scottishMedicalSchoolRoute = resolveScottishMedicalSchoolRoute(course, applicant, {
    applicant_group_ids: state.applicant_group_ids,
    contextual_eligibility: contextualEligibility
  });
  if (scottishMedicalSchoolRoute) {
    state.scottish_medical_school_route = scottishMedicalSchoolRoute;
    state.selection_route_id = scottishMedicalSchoolRoute.route_id;
  }

  for (const groupId of course.stage_1_eligibility?.explicitly_blocked_applicant_group_ids || []) {
    if (state.applicant_group_ids.includes(groupId)) {
      addFailure(state, `applicant_group_explicitly_blocked:${groupId}`);
    }
  }

  evaluateManualReviewTriggers(course, applicant, state);

  if (evaluateBirminghamPathwaysRoute(course, applicant, state)) {
    return finaliseCourseEligibilityState(course, state);
  }
  if (evaluateBirminghamUkwpmedRoute(course, applicant, state)) {
    return finaliseCourseEligibilityState(course, state);
  }

  const plymouthGamsatManualReview =
    course.profile_id === 'plymouth-a100' &&
    state.qualification_route === 'graduate';

  const routeRequiresImmediateReview = [
    'foundation',
    'mixed_t_level_a_level',
    'unknown'
  ].includes(state.qualification_route);
  const wpIb =
    ['international_baccalaureate', 'ib'].includes(state.qualification_route) &&
    (
      state.applicant_group_ids.includes('contextual') ||
      state.applicant_group_ids.includes('widening_participation')
    ) &&
    course.stage_1_eligibility?.post_16?.ib?.contextual_route_implemented !== true;
  const unlistedBtec =
    state.qualification_route === 'btec' &&
    course.stage_1_eligibility?.post_16?.btec?.status !== 'not_accepted_as_level_3_entry_route' &&
    !course.stage_1_eligibility?.post_16?.btec?.accepted_combinations?.some((combination) => {
      return normaliseId(combination.btec_qualification) === normaliseId(
        applicant.btec_profile?.qualification || applicant.btec_profile?.qualification_title
      ) &&
        normaliseGrade(combination.btec_grade) === normaliseGrade(applicant.btec_profile?.grade);
    });

  if (plymouthGamsatManualReview) {
    addManualReview(state, 'plymouth_gamsat_route_requires_manual_review');
  } else if (!routeRequiresImmediateReview && !wpIb && !unlistedBtec) {
    if (shouldEvaluateGcse(course, state.qualification_route, state)) {
      evaluateGcseRules(course, applicant, state);
    }
    applyScottishNational5EquivalenceReview(course, applicant, state);
    evaluateQualificationRoute(course, applicant, state);
    applyContextualInformationNeededReview(course, applicant, state);
  } else {
    evaluateQualificationRoute(course, applicant, state);
    applyContextualInformationNeededReview(course, applicant, state);
  }

  evaluateSameSittingRequirement(course, applicant, state);
  evaluateResits(course, applicant, state);
  evaluateEnglishLanguage(course, applicant, state);
  evaluateAdmissionsTests(course, applicant, state);
  evaluateDeferral(course, applicant, state);

  return finaliseCourseEligibilityState(course, state);
}

module.exports = {
  SCOTTISH_MEDICAL_SCHOOL_ROUTE_IDS,
  deriveCourseApplicantGroupIds,
  deriveApplicantGroupIds,
  deriveQualificationRoute,
  evaluateContextualEligibility,
  evaluateCourseEligibility,
  evaluateStandardALevelRequirement,
  getALevelSubjectMap,
  gradeRank,
  gradeMeets,
  gradeProfileMeets,
  groupRuleApplies,
  normaliseGrade,
  normaliseId,
  probeUnresolvedScottishContextualAcademicRoute,
  resolveScottishMedicalSchoolRoute,
  supportedScottishMedicalSchoolRouteIds,
  resolveUcatMinimumTotalScore
};
