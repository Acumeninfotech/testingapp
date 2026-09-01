const {
  resolveUcatDecile
} = require('./ucat-decile-service');
const {
  evaluateCourseEligibility
} = require('./eligibility-evaluator');
const {
  evaluateEpqAlternativeOffer,
  manualReviewReasonForEpqAlternative
} = require('./epq-alternative-offer');
const {
  evaluateExplicitMinimumAge,
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
  resolveBandRuleForComparison
} = require('./ucat-conversion-service');
const {
  contextualFlagApplicantGroupIds,
  feeStatusApplicantGroupIds
} = require('./applicant-group-normalisation');

const CANONICAL_BANDS = new Set([
  'not_eligible',
  'very_strong_interview_potential',
  'interview_likely',
  'realistic',
  'ambitious',
  'high_risk',
  'eligible_to_apply',
  'insufficient_evidence'
]);

const CONTEXTUAL_ROUTE_CONTROL_GROUP_IDS = new Set([
  'contextual',
  'widening_participation',
  'access_to_leeds',
  'access_to_leeds_confirmed',
  'exeter_contextual_confirmed',
  'wp2',
  'fair_access'
]);

function applicantGroupIdsForResult(groupIds = [], applicant = {}) {
  const groups = new Set(groupIds);
  for (const groupId of contextualFlagApplicantGroupIds(applicant.applicant_identity?.contextual_flags || {})) {
    if (!CONTEXTUAL_ROUTE_CONTROL_GROUP_IDS.has(groupId)) {
      groups.add(groupId);
    }
  }
  return [...groups];
}

const CONTEXTUAL_ADJUSTED_SELECTION_UCAT_SOURCE = 'contextual_adjusted_selection_ucat_total';
const CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC = 'contextual_adjusted_selection_ucat_total';

const GCSE_GRADE_RANK = {
  U: 0,
  G: 1,
  F: 2,
  E: 3,
  D: 4,
  C: 5,
  B: 6,
  A: 7,
  'A*': 8
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

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normaliseGrade(value) {
  const text = String(value ?? '').trim().toUpperCase();
  const firstGrade = text.split('/')[0];
  const numeric = Number(firstGrade);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return firstGrade;
}

function splitGradeProfile(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('/')
    .map((grade) => {
      const numeric = Number(grade);
      return Number.isFinite(numeric) ? numeric : grade;
    })
    .filter((grade) => grade !== '');
}

function gradeRank(value, level) {
  const grade = normaliseGrade(value);

  if (typeof grade === 'number') {
    return grade;
  }

  return (level === 'a_level' ? A_LEVEL_GRADE_RANK : GCSE_GRADE_RANK)[grade] ?? -1;
}

function gradeMeets(value, minimum, level) {
  return gradeRank(value, level) >= gradeRank(minimum, level);
}

function gradeProfileMeets(actualGrades, requiredGrades) {
  const actual = [...actualGrades]
    .map((grade) => gradeRank(grade, 'a_level'))
    .sort((a, b) => b - a);
  const required = [...requiredGrades]
    .map((grade) => gradeRank(grade, 'a_level'))
    .sort((a, b) => b - a);

  return required.length > 0 &&
    actual.length >= required.length &&
    required.every((minimum, index) => actual[index] >= minimum);
}

function getGcseGrades(applicant) {
  const grades = {};
  const profile = applicant.gcse_profile || {};

  for (const [subjectId, grade] of Object.entries(profile.subjects || {})) {
    if (grade !== null && grade !== undefined && grade !== '') {
      grades[subjectId] = grade;
    }
  }

  for (const subject of profile.additional_subjects || []) {
    if (subject?.subject_id && subject.grade !== null && subject.grade !== undefined) {
      grades[subject.subject_id] = subject.grade;
    }
  }

  return grades;
}

function getALevelGrades(applicant, options = {}) {
  const ignorePredicted = options.ignorePredicted === true;
  return Object.fromEntries(
    (applicant.a_level_profile?.subjects || [])
      .filter((subject) => subject?.subject_id)
      .filter((subject) => {
        if (!ignorePredicted) {
          return true;
        }
        return subject.achieved_grade !== null &&
          subject.achieved_grade !== undefined &&
          subject.achieved_grade !== '';
      })
      .map((subject) => [
        subject.subject_id,
        ignorePredicted
          ? subject.achieved_grade
          : subject.predicted_grade ?? subject.achieved_grade
      ])
  );
}

function getALevelSubjectIds(applicant) {
  return (applicant.a_level_profile?.subjects || [])
    .filter((subject) => subject?.subject_id)
    .map((subject) => normaliseId(subject.subject_id));
}

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function contextualEvaluatorIdForCourse(course = {}) {
  return (
    course.contextual_eligibility?.evaluator_id ||
    course.contextual_admissions?.contextual_eligibility?.evaluator_id ||
    course.contextual_admissions?.evaluator_id ||
    null
  );
}

function graduateGcseRequired(graduateRules = {}) {
  if (graduateRules.gcse_required === true) {
    return true;
  }
  if (graduateRules.gcse_required === false) {
    return false;
  }
  return graduateRules.waive_a_level_requirements === true;
}

function getSubjectGrades(profile, fields = ['subjects']) {
  for (const field of fields) {
    const value = profile?.[field];
    if (Array.isArray(value)) {
      return Object.fromEntries(
        value
          .filter((subject) => subject?.subject_id)
          .map((subject) => [
            normaliseId(subject.subject_id),
            subject.predicted_grade ??
              subject.achieved_grade ??
              subject.grade ??
              subject.higher_level_grade
          ])
      );
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([subjectId, grade]) => [normaliseId(subjectId), grade])
      );
    }
  }
  return {};
}

function deriveQualificationRoute(applicant) {
  const explicit = normaliseId(
    applicant.qualification_route ||
    applicant.route ||
    applicant.course_target?.qualification_route
  );
  if (explicit) {
    return explicit;
  }
  if (applicant.graduate_profile?.is_graduate === true || applicant.applicant_identity?.graduate === true) {
    return 'graduate';
  }
  if (applicant.access_to_medicine_profile || applicant.access_to_he_profile) {
    return 'access_to_medicine';
  }
  if (applicant.scottish_profile) {
    return 'scottish';
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
  if (applicant.international_qualification) {
    return 'international_qualification';
  }
  if (applicant.a_level_profile) {
    return 'a_level';
  }
  return 'unknown';
}

function deriveApplicantGroupIds(applicant) {
  const identity = applicant.applicant_identity || {};
  const groups = new Set(applicant.applicant_group_ids || []);
  const domicile = String(identity.domicile || '').toLowerCase();
  const applicantType = String(identity.applicant_type || '').toLowerCase();

  const domicileGroups = {
    england: ['england_domiciled', 'rest_of_uk'],
    scotland: ['scotland_domiciled'],
    wales: ['wales_domiciled', 'rest_of_uk'],
    northern_ireland: ['northern_ireland_domiciled', 'rest_of_uk']
  };

  for (const groupId of domicileGroups[domicile] || []) {
    groups.add(groupId);
  }

  for (const groupId of feeStatusApplicantGroupIds(identity.fee_status)) {
    groups.add(groupId);
  }

  const contextualFlags = identity.contextual_flags || {};
  for (const groupId of contextualFlagApplicantGroupIds(contextualFlags)) {
    groups.add(groupId);
  }

  if (applicantType.includes('mature')) {
    groups.add('mature_applicant');
  }

  if (identity.graduate === true || applicant.graduate_profile?.is_graduate === true) {
    groups.add('graduate_applicant');
  } else if (
    !applicantType.includes('mature') &&
    (applicantType.includes('school') || applicantType.includes('standard') || applicantType === 'ruk')
  ) {
    groups.add('school_leaver');
  }

  const qualificationRoute = deriveQualificationRoute(applicant);
  if (qualificationRoute === 'access_to_medicine') {
    groups.add('access_to_medicine');
  }
  if (qualificationRoute === 'international_qualification') {
    groups.add('international_qualification');
  }

  if (identity.resit?.has_resits === true || identity.resit === true) {
    groups.add('resit_applicant');
  }

  return [...groups];
}

function deriveConfiguredApplicantGroupIds(applicant, config, initialGroupIds = null) {
  const groups = new Set(initialGroupIds || deriveApplicantGroupIds(applicant));
  const rules = config?.eligibility?.derived_applicant_groups || [];

  for (const rule of rules) {
    const groupIds = [
      ...(Array.isArray(rule?.group_ids) ? rule.group_ids : []),
      ...(rule?.group_id ? [rule.group_id] : [])
    ];
    if (groupIds.length === 0) {
      continue;
    }
    if (
      groupRuleApplies(rule.match || rule, [...groups]) &&
      overrideEvidenceMatches(rule, applicant)
    ) {
      for (const groupId of groupIds) {
        groups.add(groupId);
      }
    }
  }

  return [...groups];
}

function groupRuleApplies(rule, groupIds) {
  const groups = new Set(groupIds);
  const all = rule?.all_group_ids || rule?.applies_to_group_ids || [];
  const any = rule?.any_group_ids || [];
  const excluded = rule?.excluded_group_ids || [];

  return all.every((groupId) => groups.has(groupId)) &&
    (any.length === 0 || any.some((groupId) => groups.has(groupId))) &&
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

function matchQualificationStatus(rule, applicant) {
  const qualificationRoute = deriveQualificationRoute(applicant);
  const allowedRoutes = rule?.qualification_routes || rule?.qualification_route;
  if (allowedRoutes) {
    const routes = Array.isArray(allowedRoutes) ? allowedRoutes : [allowedRoutes];
    if (!routes.map(normaliseId).includes(qualificationRoute)) {
      return false;
    }
  }

  const excludedRoutes = rule?.excluded_qualification_routes;
  if (excludedRoutes) {
    const routes = Array.isArray(excludedRoutes) ? excludedRoutes : [excludedRoutes];
    if (routes.map(normaliseId).includes(qualificationRoute)) {
      return false;
    }
  }

  const allowed = rule?.qualification_status;
  if (!allowed) {
    const excluded = rule?.excluded_qualification_status;
    if (!excluded) {
      return true;
    }
    const excludedStatuses = Array.isArray(excluded) ? excluded : [excluded];
    return !excludedStatuses.map(normaliseId).includes(deriveQualificationStatus(applicant));
  }

  const statuses = Array.isArray(allowed) ? allowed : [allowed];
  const matched = statuses.map(normaliseId).includes(deriveQualificationStatus(applicant));
  if (!matched) {
    return false;
  }
  const excluded = rule?.excluded_qualification_status;
  if (!excluded) {
    return true;
  }
  const excludedStatuses = Array.isArray(excluded) ? excluded : [excluded];
  return !excludedStatuses.map(normaliseId).includes(deriveQualificationStatus(applicant));
}

function profileArray(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

function firstProfileArray(...values) {
  return values.map(profileArray).find(Boolean) || null;
}

function aLevelGradeProfileForQualificationStatus(route = {}, applicant = {}) {
  const qualificationStatus = deriveQualificationStatus(applicant);
  const predictedProfile = profileArray(route.predicted_minimum_profile);
  const achievedProfile = firstProfileArray(
    route.achieved_grade_profile,
    route.offer_grade_profile,
    route.final_grade_profile
  );
  const legacyProfile = firstProfileArray(route.grade_profile, route.standard_offer);

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

function sameSittingRequirement(course, config) {
  return config?.eligibility?.same_sitting ||
    config?.eligibility?.academic_requirements?.same_sitting ||
    course?.stage_1_eligibility?.academic_requirements?.same_sitting ||
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

function evaluateSameSittingRequirement(course, config, applicant, qualificationRoute) {
  const requirement = sameSittingRequirement(course, config);
  if (requirement?.required !== true) {
    return null;
  }

  const routes = (requirement.qualification_routes || ['a_level'])
    .map(normaliseId);
  if (!routes.includes(normaliseId(qualificationRoute))) {
    return null;
  }

  const evidence = resolveSameSittingEvidence(applicant, normaliseId(qualificationRoute));
  if (!evidence.supported) {
    return {
      status: 'manual_review',
      reason: `same_sitting_evidence_not_supported_for_route:${qualificationRoute}`,
      check: {
        check: 'same_sitting_requirement',
        passed: false,
        evidence_known: false,
        qualification_route: qualificationRoute
      }
    };
  }
  if (!evidence.known) {
    return {
      status: 'manual_review',
      reason: `same_sitting_evidence_missing:${evidence.evidence_path}`,
      check: {
        check: 'same_sitting_requirement',
        passed: false,
        evidence_known: false,
        qualification_route: qualificationRoute,
        evidence_path: evidence.evidence_path
      }
    };
  }
  if (!evidence.passed) {
    return {
      status: 'not_eligible',
      reason: 'same_sitting_requirement_not_met',
      check: {
        check: 'same_sitting_requirement',
        passed: false,
        evidence_known: true,
        qualification_route: qualificationRoute,
        evidence_path: evidence.evidence_path
      }
    };
  }

  return {
    status: 'eligible',
    reason: null,
    check: {
      check: 'same_sitting_requirement',
      passed: true,
      evidence_known: true,
      qualification_route: qualificationRoute,
      evidence_path: evidence.evidence_path
    }
  };
}

function checkSubjectGroups(subjectGrades, groups) {
  return (groups || []).every((group) => {
    const matching = (group.subject_ids || []).filter((subjectId) => subjectGrades[subjectId] !== undefined);
    return matching.length >= (group.minimum_required || 1);
  });
}

function evaluateALevelRoute(route, subjectGrades, applicant = null) {
  const excludedSubjectIds = new Set(route.excluded_subject_ids || []);
  const countedSubjectGrades = route.excluded_subject_policy === 'do_not_count'
    ? Object.fromEntries(
      Object.entries(subjectGrades).filter(([subjectId]) => !excludedSubjectIds.has(subjectId))
    )
    : subjectGrades;
  const grades = Object.values(countedSubjectGrades).filter((grade) => grade !== null && grade !== undefined);
  const gradeProfile = aLevelGradeProfileForQualificationStatus(route, applicant || {});
  const requiredSubjects = route.required_subject_ids || [];
  const subjectsPresent = requiredSubjects.every((subjectId) => countedSubjectGrades[subjectId] !== undefined);
  const groupsPass = checkSubjectGroups(countedSubjectGrades, route.one_of_subject_groups);
  const subjectGradesPass = (route.subject_grade_requirements || []).every((requirement) => {
    return countedSubjectGrades[requirement.subject_id] !== undefined &&
      gradeMeets(countedSubjectGrades[requirement.subject_id], requirement.minimum_grade, 'a_level');
  });
  const gradeOptions = route.required_subject_grade_options || [];
  const gradeOptionsPass = gradeOptions.length === 0 || gradeOptions.some((option) => {
    return (option.grade_requirements || []).every((requirement) => {
      return countedSubjectGrades[requirement.subject_id] !== undefined &&
        gradeMeets(countedSubjectGrades[requirement.subject_id], requirement.minimum_grade, 'a_level');
    });
  });
  const excludedSubjectsPass = route.excluded_subject_policy === 'do_not_count' ||
    (route.excluded_subject_ids || []).every((subjectId) => subjectGrades[subjectId] === undefined);
  const epqRequirementPass = aLevelRouteEpqRequirementApplies(route, applicant);

  return gradeProfileMeets(grades, gradeProfile) &&
    subjectsPresent &&
    groupsPass &&
    subjectGradesPass &&
    gradeOptionsPass &&
    excludedSubjectsPass &&
    epqRequirementPass;
}

function aLevelRouteEpqRequirementApplies(route = {}, applicant = {}) {
  if (route?.requires_epq !== true && !route?.epq_minimum_grade) {
    return true;
  }

  const epq = applicant?.a_level_profile?.epq || applicant?.epq || {};
  const status = normaliseId(epq.status);
  if (!['predicted', 'achieved'].includes(status)) {
    return false;
  }
  return gradeMeets(epq.grade, route.epq_minimum_grade || 'B', 'a_level');
}

function hasRoutedEpqAlternative(aLevelData = {}, aLevelConfig = {}) {
  const routes = [
    ...(Array.isArray(aLevelConfig.routes) ? aLevelConfig.routes : []),
    ...(Array.isArray(aLevelData.grade_requirements) ? aLevelData.grade_requirements : []),
    ...(Array.isArray(aLevelData.routes) ? aLevelData.routes : [])
  ];
  return routes.some((route) => route?.requires_epq === true || route?.epq_minimum_grade);
}

function getEpqAlternativeOfferPolicy(aLevelData = {}) {
  return aLevelData.epq_alternative_offer || aLevelData.epq_alternative || null;
}

function hasDeclaredEpqProfile(applicant) {
  const aLevelEpq = applicant?.a_level_profile?.epq;
  const rootEpq = applicant?.epq;
  return Boolean(
    (aLevelEpq && typeof aLevelEpq === 'object') ||
    (rootEpq && typeof rootEpq === 'object')
  );
}

function standardALevelRouteFromData(aLevelData = {}) {
  const standardOffer = aLevelData.standard_offer || {};
  const gradeProfile = Array.isArray(standardOffer)
    ? standardOffer
    : standardOffer.grade_profile;

  if (!Array.isArray(gradeProfile) || gradeProfile.length === 0) {
    return null;
  }

  return {
    route_id: 'standard_offer',
    grade_profile: gradeProfile,
    required_subject_ids: standardOffer.required_subject_ids || aLevelData.required_subject_ids || [],
    one_of_subject_groups: standardOffer.one_of_subject_groups || aLevelData.one_of_subject_groups || [],
    subject_grade_requirements: standardOffer.subject_grade_requirements ||
      aLevelData.subject_grade_requirements ||
      [],
    required_subject_grade_options: standardOffer.required_subject_grade_options ||
      aLevelData.required_subject_grade_options ||
      [],
    excluded_subject_ids: standardOffer.excluded_subject_ids || aLevelData.excluded_subject_ids || []
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

function standardOfferRoutePassed(routes, aLevelGrades, aLevelData = {}) {
  const standardProfile = aLevelData.standard_offer?.grade_profile || aLevelData.grade_profile || [];
  if (!Array.isArray(standardProfile) || standardProfile.length === 0) {
    return null;
  }

  const matchingRoutes = routes.filter((route) => {
    return gradeProfilesEquivalent(route.grade_profile || route.standard_offer || [], standardProfile);
  });
  if (matchingRoutes.length === 0) {
    return null;
  }

  return matchingRoutes.some((route) => {
    return evaluateALevelRoute(route, aLevelGrades);
  });
}

function formatGradeProfile(grades = []) {
  if (!Array.isArray(grades) || grades.length === 0) {
    return null;
  }
  const normalised = grades
    .map((grade) => String(grade ?? '').trim().toUpperCase())
    .filter(Boolean);
  return normalised.length === grades.length ? normalised.join('') : null;
}

function academicPathwayForALevelRoute(route = {}) {
  const candidate = route || {};
  if (candidate.academic_pathway) {
    return candidate.academic_pathway;
  }
  const id = normaliseId(candidate.pathway_id || candidate.route_id || candidate.requirement_id);
  if (id.includes('contextual')) {
    return 'contextual';
  }
  if (id.includes('standard')) {
    return 'standard';
  }
  return null;
}

function academicPathwayIdForALevelRoute(route = {}) {
  const candidate = route || {};
  return candidate.pathway_id || candidate.route_id || candidate.requirement_id || null;
}

function publicALevelRouteCheckId(route = {}) {
  const candidate = route || {};
  const routeId = candidate.route_id || candidate.requirement_id || '';
  return normaliseId(routeId).startsWith('a_level_') ? routeId : 'a_level_route';
}

function evaluateALevelEpqAlternativePathway(
  applicant,
  aLevelData,
  aLevelGrades,
  standardAlreadyMet = null
) {
  const policy = getEpqAlternativeOfferPolicy(aLevelData);
  if (!policy?.enabled) {
    return null;
  }

  const standardRoute = standardALevelRouteFromData(aLevelData);
  if (!standardRoute) {
    return null;
  }

  const standardPassed = typeof standardAlreadyMet === 'boolean'
    ? standardAlreadyMet
    : evaluateALevelRoute(standardRoute, aLevelGrades);
  const checks = [
    {
      check: 'a_level_standard_offer',
      passed: standardPassed,
      academic_pathway: 'standard'
    }
  ];

  if (standardPassed) {
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

  const epqAlternative = evaluateEpqAlternativeOffer(applicant, policy);
  checks.push({
    check: 'epq_alternative_offer',
    status: epqAlternative.status,
    passed: epqAlternative.status === 'met',
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

function gradeProfileMeetsMinimum(actualValue, minimumProfile) {
  const actual = splitGradeProfile(actualValue);
  return actual.length >= minimumProfile.length &&
    minimumProfile.every((minimum, index) => gradeMeets(actual[index], minimum, 'gcse'));
}

function scienceOptionMeets(option, gcseGrades) {
  if (Array.isArray(option.accepted_subject_ids)) {
    const matchingSubjects = option.accepted_subject_ids.filter((subjectId) => {
      return gcseGrades[subjectId] !== undefined &&
        gradeMeets(gcseGrades[subjectId], option.minimum_grade, 'gcse');
    });
    return matchingSubjects.length >= (option.minimum_subjects_required || 1);
  }

  if (option.subject_id) {
    const actual = gcseGrades[option.subject_id];
    if (actual === undefined) {
      return false;
    }

    const acceptedProfiles = [
      option.minimum_grade_profile,
      option.accepted_equivalent_profile
    ].filter(Array.isArray);

    if (acceptedProfiles.length > 0) {
      return acceptedProfiles.some((profile) => gradeProfileMeetsMinimum(actual, profile));
    }

    return gradeMeets(actual, option.minimum_grade, 'gcse');
  }

  return (option.grade_requirements || []).every((requirement) => {
    const actual = gcseGrades[requirement.subject_id];
    if (actual === undefined) {
      return false;
    }
    if (Array.isArray(requirement.minimum_grade_profile)) {
      const acceptedProfiles = [
        requirement.minimum_grade_profile,
        requirement.accepted_equivalent_profile
      ].filter(Array.isArray);
      return acceptedProfiles.some((profile) => gradeProfileMeetsMinimum(actual, profile));
    }
    return gradeMeets(actual, requirement.minimum_grade, 'gcse');
  });
}

function findSatisfiedScienceOption(gcseRules, gcseGrades, groupIds = []) {
  return (gcseRules.science_requirement?.accepted_options || [])
    .filter((option) => groupRuleApplies(option, groupIds))
    .find((option) => scienceOptionMeets(option, gcseGrades)) || null;
}

function countGradesAtOrAbove(gcseGrades, minimumGrade) {
  return Object.values(gcseGrades).reduce((count, value) => {
    const gradeProfile = splitGradeProfile(value);
    return count + gradeProfile.filter((grade) => {
      return gradeMeets(grade, minimumGrade, 'gcse');
    }).length;
  }, 0);
}

function expandedGcseGrades(applicant) {
  const grades = Object.values(getGcseGrades(applicant))
    .flatMap((grade) => splitGradeProfile(grade));
  if (grades.length > 0) {
    return grades;
  }
  return (applicant.gcse_profile?.top_9_gcse_grades || [])
    .flatMap((grade) => splitGradeProfile(grade));
}

function combinations(values, size) {
  if (size === 0) {
    return [[]];
  }
  if (values.length < size) {
    return [];
  }

  return values.flatMap((value, index) => {
    return combinations(values.slice(index + 1), size - 1)
      .map((rest) => [value, ...rest]);
  });
}

function primaryConditionSubjects(rule, subjectGrades) {
  const options = rule.primary_subject_condition?.options || [];
  if (options.length > 0) {
    return [...new Set(options.flatMap((option) => {
      const matching = (option.subject_ids || [])
        .filter((subjectId) => subjectGrades[subjectId] !== undefined);
      return matching.length >= (option.minimum_required || 1) ? matching : [];
    }))];
  }

  return (rule.primary_subject_group?.subject_ids || [])
    .filter((subjectId) => subjectGrades[subjectId] !== undefined);
}

function subjectCombinationMeets(rule, subjectGrades, gradeProfile = []) {
  if (!rule) {
    return true;
  }

  const subjectIds = Object.keys(subjectGrades);
  const offerSubjectCount = rule.offer_subject_count;
  const candidateSets = Number.isInteger(offerSubjectCount)
    ? combinations(subjectIds, offerSubjectCount)
    : [subjectIds];
  const disallowedPairs = (rule.disallowed_overlaps || []).map((pair) => new Set(pair));

  return candidateSets.some((candidateSubjectIds) => {
    const candidateGrades = Object.fromEntries(
      candidateSubjectIds.map((subjectId) => [subjectId, subjectGrades[subjectId]])
    );
    if (gradeProfile.length > 0 && !gradeProfileMeets(Object.values(candidateGrades), gradeProfile)) {
      return false;
    }

    const hasDisallowedPair = disallowedPairs.some((pair) => {
      return [...pair].every((subjectId) => candidateSubjectIds.includes(subjectId));
    });
    if (hasDisallowedPair) {
      return false;
    }

    const primarySubjects = primaryConditionSubjects(rule, candidateGrades);
    const secondSubjects = (rule.second_subject_group?.subject_ids || [])
      .filter((subjectId) => candidateGrades[subjectId] !== undefined);
    const validPairs = primarySubjects.flatMap((primarySubject) => {
      return secondSubjects.map((secondSubject) => [primarySubject, secondSubject]);
    }).filter(([primarySubject, secondSubject]) => {
      return rule.subjects_must_be_distinct !== true || primarySubject !== secondSubject;
    });
    const primaryMinimum = rule.primary_subject_condition
      ? 1
      : (rule.primary_subject_group?.minimum_required || 1);

    return primarySubjects.length >= primaryMinimum &&
      secondSubjects.length >= (rule.second_subject_group?.minimum_required || 1) &&
      validPairs.length >= (rule.minimum_subjects ? 1 : 0);
  });
}

function countGcseSubjects(gcseRules, gcseGrades, groupIds = []) {
  const exactCount = Object.keys(gcseGrades).length;
  const scienceOption = findSatisfiedScienceOption(gcseRules, gcseGrades, groupIds);
  const creditedCount = scienceOption?.counts_as_gcse_subjects;
  const listedCount = scienceOption?.grade_requirements?.length;

  return Number.isInteger(creditedCount) && Number.isInteger(listedCount)
    ? exactCount + Math.max(0, creditedCount - listedCount)
    : exactCount;
}

function evaluateAcademicEligibility(course, config, applicant, groupIds) {
  const failures = [];
  const manualReviewReasons = [];
  const checks = [];
  let academicPathway = null;
  let academicPathwayId = null;
  let epqAlternativeResult = null;
  let futureConditions = [];
  const stage1 = course.stage_1_eligibility || {};
  const gcseRules = stage1.gcse || {};
  const configEligibility = config.eligibility || {};
  const gcseConfig = configEligibility.gcse || {};
  const qualificationRoute = deriveQualificationRoute(applicant);
  const supportedRoutes = configEligibility.qualification_routes?.supported || [];
  const explicitlyBlockedRoutes = configEligibility.qualification_routes?.explicitly_blocked || [];
  const explicitlyBlockedGroups = configEligibility.explicitly_blocked_applicant_groups || [];
  const manualReviewGroups = configEligibility.manual_review_applicant_groups || [];
  const academicRoute = supportedRoutes.length > 0 ? qualificationRoute : 'a_level';
  const gcseGrades = getGcseGrades(applicant);
  const exactGcseCount = Object.keys(gcseGrades).length;
  const creditedGcseCount = countGcseSubjects(gcseRules, gcseGrades, groupIds);
  const reportedGcseCount = applicant.gcse_profile?.total_gcse_count;
  const missingAcademicEvidenceOutcome =
    configEligibility.academic_evidence?.missing_outcome ||
    configEligibility.missing_academic_evidence_outcome;
  const missingAcademicEvidenceReason =
    configEligibility.academic_evidence?.manual_review_reason ||
    'missing_academic_evidence_requires_manual_review';
  const gcseCount = gcseConfig.use_exact_subject_list === true
    ? creditedGcseCount
    : (reportedGcseCount ?? creditedGcseCount);
  const addFailure = (reason) => {
    if (!failures.includes(reason)) {
      failures.push(reason);
    }
  };
  const addManualReview = (reason) => {
    if (!manualReviewReasons.includes(reason)) {
      manualReviewReasons.push(reason);
    }
  };
  const handleMissingAcademicEvidence = (fallbackFailure) => {
    if (missingAcademicEvidenceOutcome === 'manual_review') {
      addManualReview(missingAcademicEvidenceReason);
    } else {
      addFailure(fallbackFailure);
    }
  };
  if (explicitlyBlockedRoutes.includes(qualificationRoute)) {
    addFailure(`qualification_route_explicitly_blocked:${qualificationRoute}`);
  } else if ((configEligibility.qualification_routes?.manual_review || []).includes(qualificationRoute)) {
    addManualReview(`qualification_route_requires_manual_review:${qualificationRoute}`);
  } else if (supportedRoutes.length > 0 && !supportedRoutes.includes(qualificationRoute)) {
    addFailure(`qualification_route_not_implemented:${qualificationRoute}`);
  }
  for (const groupId of manualReviewGroups) {
    if (groupIds.includes(groupId)) {
      addManualReview(`applicant_group_requires_manual_review:${groupId}`);
    }
  }
  for (const groupId of explicitlyBlockedGroups) {
    if (groupIds.includes(groupId)) {
      addFailure(`applicant_group_explicitly_blocked:${groupId}`);
    }
  }
  if (failures.length === 0 && manualReviewReasons.length > 0) {
    return {
      status: 'manual_review',
      failures,
      manual_review_reasons: manualReviewReasons,
      checks,
      exact_gcse_count: exactGcseCount,
      qualification_route: qualificationRoute
    };
  }

  const graduateRules = configEligibility.graduate || {};
  if (academicRoute === 'graduate') {
    const compensatoryPolicy = evaluateGraduateCompensatoryPolicy(course, applicant);
    if (compensatoryPolicy) {
      return {
        status: compensatoryPolicy.failures.length ? 'not_eligible' : 'eligible',
        failures: [...failures, ...compensatoryPolicy.failures],
        manual_review_reasons: manualReviewReasons,
        checks: [...checks, ...compensatoryPolicy.checks],
        exact_gcse_count: exactGcseCount,
        qualification_route: qualificationRoute
      };
    }
  }

  const usesConventionalGcse =
    ['a_level', 'international_baccalaureate'].includes(academicRoute) ||
    (
      academicRoute === 'graduate' &&
      graduateGcseRequired(graduateRules)
    );
  if (usesConventionalGcse) {
    const minimumCount = gcseConfig.minimum_count ?? gcseRules.minimum_count;
    if (Number.isFinite(minimumCount)) {
      const passed = gcseCount >= minimumCount;
      checks.push({ check: 'gcse_minimum_count', passed, actual: gcseCount, required: minimumCount });
      if (!passed) {
        addFailure('minimum_gcse_count_not_met');
      }
    }

    const countAtGradeRules = Array.isArray(gcseRules.minimum_count_at_or_above_grade)
      ? gcseRules.minimum_count_at_or_above_grade
      : gcseRules.minimum_count_at_or_above_grade
        ? [gcseRules.minimum_count_at_or_above_grade]
        : [];
    for (const requirement of countAtGradeRules) {
      if (!groupRuleApplies(requirement, groupIds)) {
        continue;
      }
      const actual = countGradesAtOrAbove(gcseGrades, requirement.minimum_grade);
      const passed = actual >= requirement.count;
      checks.push({
        check: 'gcse_minimum_count_at_or_above_grade',
        requirement_id: requirement.requirement_id,
        passed,
        actual,
        required: requirement.count,
        minimum_grade: requirement.minimum_grade
      });
      if (!passed) {
        addFailure(`minimum_gcse_count_at_grade_not_met:${requirement.requirement_id}`);
      }
    }

    const requiredSubjects = gcseConfig.required_subjects ||
      (gcseRules.grade_requirements || [])
        .filter((rule) => rule.subject_id && String(rule.qualification_level || '') !== 'national_5')
        .filter((rule) => groupRuleApplies(rule, groupIds))
        .map((rule) => ({
          subject_id: rule.subject_id,
          minimum_grade: rule.minimum_grade
        }));
    const scienceOption = gcseRules.science_requirement?.requirement_type === 'any_of'
      ? findSatisfiedScienceOption(gcseRules, gcseGrades, groupIds)
      : null;
    const scienceAlternativeSubjects = new Set(['biology', 'chemistry']);
    const mandatorySubjectIds = new Set([
      ...(gcseRules.mandatory_subject_ids || []),
      ...requiredSubjects.map((rule) => rule.subject_id)
    ]);

    for (const subjectId of mandatorySubjectIds) {
      if (subjectId === 'science' && scienceOption) {
        continue;
      }
      if (scienceOption && scienceAlternativeSubjects.has(subjectId)) {
        continue;
      }
      if (gcseGrades[subjectId] === undefined) {
        handleMissingAcademicEvidence(`required_gcse_subject_missing:${subjectId}`);
      }
    }
    for (const rule of requiredSubjects) {
      if (scienceOption && scienceAlternativeSubjects.has(rule.subject_id)) {
        continue;
      }
      if (
        gcseGrades[rule.subject_id] !== undefined &&
        rule.minimum_grade &&
        !gradeMeets(gcseGrades[rule.subject_id], rule.minimum_grade, 'gcse')
      ) {
        addFailure(`minimum_gcse_grade_not_met:${rule.subject_id}`);
      }
    }
    if (gcseRules.science_requirement?.requirement_type === 'any_of') {
      const passed = Boolean(scienceOption);
      checks.push({
        check: 'gcse_science_alternative',
        passed,
        option_id: scienceOption?.option_id || null
      });
      if (!passed) {
        addFailure('gcse_science_alternative_not_met');
      }
    }

    if (gcseConfig.points) {
      let expandedGrades = Object.entries(gcseGrades).flatMap(([subjectId, grade]) => {
        if (['combined_science', 'double_science'].includes(subjectId)) {
          return splitGradeProfile(grade).slice(0, 2);
        }
        return [grade];
      });
      if (
        expandedGrades.length < gcseConfig.points.subject_count &&
        Array.isArray(applicant.gcse_profile?.top_9_gcse_grades) &&
        applicant.gcse_profile.top_9_gcse_grades.length >= gcseConfig.points.subject_count
      ) {
        expandedGrades = applicant.gcse_profile.top_9_gcse_grades;
      }
      const pointGrades = expandedGrades
        .map((grade) => ({
          grade,
          points: (gcseConfig.points.bands || []).find((band) => {
            return gradeMeets(grade, band.minimum_grade, 'gcse');
          })?.points || 0
        }))
        .sort((a, b) => b.points - a.points || gradeRank(b.grade, 'gcse') - gradeRank(a.grade, 'gcse'))
        .slice(0, gcseConfig.points.subject_count);
      const points = pointGrades.reduce((total, item) => total + item.points, 0);
      const contextual = groupIds.includes('contextual') || groupIds.includes('widening_participation');
      const minimumPoints = contextual
        ? (gcseConfig.contextual_minimum_points ?? gcseConfig.points.minimum_points)
        : gcseConfig.points.minimum_points;
      const passed = pointGrades.length >= gcseConfig.points.subject_count && points >= minimumPoints;
      checks.push({
        check: 'gcse_points',
        passed,
        actual: points,
        required: minimumPoints,
        subjects_counted: pointGrades.length
      });
      if (!passed) {
        addFailure('minimum_gcse_points_not_met');
      }
    }
  }

  if (academicRoute === 'a_level') {
    const aLevelConfig = configEligibility.a_level || {};
    const aLevelData = stage1.post_16?.a_level || {};
    const predictedGradesPolicy = normaliseId(
      aLevelConfig.predicted_grades_policy ||
      configEligibility.predicted_grades_policy
    );
    const ignorePredictedGrades = predictedGradesPolicy === 'ignore';
    const qualificationStatus = deriveQualificationStatus(applicant);
    const aLevelGrades = getALevelGrades(applicant, {
      ignorePredicted: ignorePredictedGrades
    });
    const declaredSubjectIds = getALevelSubjectIds(applicant);
    let routes = (aLevelConfig.routes || aLevelData.grade_requirements || [])
      .filter((route) => groupRuleApplies(route, groupIds));
    if (routes.length === 0) {
      const standardOffer = Array.isArray(aLevelData.standard_offer)
        ? aLevelData.standard_offer
        : aLevelData.standard_offer?.grade_profile;
      if (Array.isArray(standardOffer) && standardOffer.length > 0) {
        routes = [{
          grade_profile: standardOffer,
          required_subject_ids: aLevelData.required_subject_ids || [],
          one_of_subject_groups: aLevelData.one_of_subject_groups || [],
          excluded_subject_ids: aLevelData.excluded_subject_ids || []
        }];
      }
    }
    const activeRoutes = routes.filter((route) => {
      return aLevelRouteEpqRequirementApplies(route, applicant);
    });
    const noAchievedALevels = Object.keys(aLevelGrades).length === 0;
    const missingALevelEvidence = noAchievedALevels && declaredSubjectIds.length === 0;
    const allowPreCompletionGcseOnly =
      aLevelConfig.allow_unachieved_with_gcse_gate === true &&
      ignorePredictedGrades &&
      noAchievedALevels &&
      ['predicted', 'unknown'].includes(qualificationStatus);
    if (allowPreCompletionGcseOnly) {
      checks.push({
        check: 'a_level_achieved_grades_not_required_pre_completion',
        passed: true,
        qualification_status: qualificationStatus
      });
      if (declaredSubjectIds.length > 0) {
        const declaredSubjects = Object.fromEntries(
          declaredSubjectIds.map((subjectId) => [subjectId, 'A'])
        );
        const currentSubjectCombinationPassed = routes.some((route) => {
          const requiredSubjectsPassed = (route.required_subject_ids || [])
            .every((subjectId) => declaredSubjects[subjectId] !== undefined);
          const subjectGroupsPassed = checkSubjectGroups(
            declaredSubjects,
            route.one_of_subject_groups
          );
          const combinationRulePassed = subjectCombinationMeets(
            aLevelData.subject_combination_rule,
            declaredSubjects
          );
          return requiredSubjectsPassed &&
            subjectGroupsPassed &&
            combinationRulePassed &&
            aLevelRouteEpqRequirementApplies(route, applicant);
        });
        checks.push({
          check: 'a_level_current_subject_combination',
          passed: currentSubjectCombinationPassed
        });
        if (!currentSubjectCombinationPassed) {
          addFailure('a_level_subject_combination_not_met');
        }
      }
      return {
        status: failures.length ? 'not_eligible' : manualReviewReasons.length ? 'manual_review' : 'eligible',
        failures,
        manual_review_reasons: manualReviewReasons,
        checks,
        exact_gcse_count: exactGcseCount,
        qualification_route: qualificationRoute
      };
    }
    const passedRoute = activeRoutes.find((route) => evaluateALevelRoute(route, aLevelGrades, applicant));
    const activeRoute = passedRoute || activeRoutes[0] || null;
    let routePassed = Boolean(passedRoute);
    const activeRoutePathway = academicPathwayForALevelRoute(activeRoute);
    const manualReviewRoute = routes.find((route) => {
      return route.manual_review_on_pass === true &&
        activeRoutes.includes(route) &&
        evaluateALevelRoute(route, aLevelGrades, applicant);
    });
    let subjectCombinationPassed = activeRoutes.length > 0 &&
      subjectCombinationMeets(aLevelData.subject_combination_rule, aLevelGrades);
    let aLevelGateExceptionApplied = false;
    let epqAlternativeInformationNeeded = false;
    const epqAlternativePathway = routePassed || hasRoutedEpqAlternative(aLevelData, aLevelConfig)
      ? null
      : evaluateALevelEpqAlternativePathway(
          applicant,
          aLevelData,
          aLevelGrades,
          standardOfferRoutePassed(activeRoutes, aLevelGrades, aLevelData)
        );

    if (epqAlternativePathway) {
      checks.push(...epqAlternativePathway.checks);
      academicPathway = epqAlternativePathway.academic_pathway;
      academicPathwayId = epqAlternativePathway.academic_pathway_id;
      epqAlternativeResult = epqAlternativePathway.epq_alternative_result;
      futureConditions = epqAlternativePathway.future_conditions || [];
      if (epqAlternativeResult?.a_level_requirement_met === true) {
        subjectCombinationPassed = true;
      }
      if (epqAlternativePathway.status === 'met') {
        routePassed = true;
      } else if (epqAlternativePathway.status === 'information_needed') {
        routePassed = false;
        epqAlternativeInformationNeeded = true;
      } else if (epqAlternativePathway.status === 'not_met') {
        routePassed = false;
      }
    } else if (routePassed) {
      academicPathway = activeRoutePathway || 'standard';
      academicPathwayId = activeRoutePathway
        ? academicPathwayIdForALevelRoute(activeRoute)
        : null;
    }

    checks.push({
      check: publicALevelRouteCheckId(activeRoute),
      passed: routePassed,
      academic_pathway: academicPathway || activeRoutePathway || null,
      pathway_id: academicPathwayId || academicPathwayIdForALevelRoute(activeRoute) || null,
      required: formatGradeProfile(aLevelGradeProfileForQualificationStatus(activeRoute || {}, applicant)),
      actual: formatGradeProfile(Object.values(aLevelGrades))
    });
    checks.push({ check: 'a_level_subject_combination', passed: subjectCombinationPassed });
    if (!routePassed) {
      const exception = aLevelConfig.contextual_gate_exception;
      const exceptionApplies =
        exception &&
        groupRuleApplies(exception.match || exception, groupIds) &&
        evaluateALevelRoute(exception.route || exception, aLevelGrades, applicant);
      if (exceptionApplies) {
        aLevelGateExceptionApplied = true;
        addManualReview(
          exception.manual_review_reason ||
          'contextual_a_level_gate_exception_requires_manual_review'
        );
      } else if (epqAlternativeInformationNeeded) {
        addManualReview(epqAlternativePathway.manual_review_reason);
      } else if (missingALevelEvidence && missingAcademicEvidenceOutcome === 'manual_review') {
        addManualReview(missingAcademicEvidenceReason);
      } else {
        if (activeRoutePathway) {
          if (!epqAlternativePathway) {
            academicPathway = academicPathway || activeRoutePathway;
            academicPathwayId = academicPathwayId || academicPathwayIdForALevelRoute(activeRoute);
          }
        }
        addFailure('a_level_requirements_not_met');
      }
    }
    if (manualReviewRoute) {
      addManualReview(
        manualReviewRoute.manual_review_reason ||
        `a_level_route_requires_manual_review:${manualReviewRoute.route_id || 'matched_route'}`
      );
    }
    if (!subjectCombinationPassed && !aLevelGateExceptionApplied && !missingALevelEvidence) {
      addFailure('a_level_subject_combination_not_met');
    }

    const practicalAssessment = assessPracticalEndorsements(
      course,
      config,
      applicant
    );
    if (practicalAssessment.required) {
      checks.push({
        check: 'a_level_science_practical_endorsement',
        passed: practicalAssessment.passed,
        applicable_subject_ids: practicalAssessment.applicable_subject_ids,
        missing_subject_ids: practicalAssessment.unconfirmed_subject_ids,
        unknown_subject_ids: practicalAssessment.unknown_subject_ids,
        failed_subject_ids: practicalAssessment.failed_subject_ids,
        requirement_source: practicalAssessment.source
      });
      if (!practicalAssessment.passed) {
        if (practicalAssessment.unknown_subject_ids.length > 0) {
          addManualReview(
            `science_practical_endorsement_evidence_missing:` +
            practicalAssessment.unknown_subject_ids.join(',')
          );
        }
        if (practicalAssessment.failed_subject_ids.length > 0) {
          addFailure(
            `science_practical_endorsement_not_confirmed:` +
            practicalAssessment.failed_subject_ids.join(',')
          );
        }
      }
    }
  } else if (['international_baccalaureate', 'ib'].includes(academicRoute)) {
    const courseIbRules =
      course.stage_1_eligibility?.post_16?.ib ||
      course.stage_1_eligibility?.post_16?.international_baccalaureate ||
      {};
    const courseIbRequirements = (courseIbRules.grade_requirements || []).filter((requirement) => {
      return groupRuleApplies(requirement, groupIds);
    });
    if (Array.isArray(courseIbRules.grade_requirements) && courseIbRules.grade_requirements.length > 0 && courseIbRequirements.length === 0) {
      addFailure('ib_route_not_supported_for_applicant_groups');
    }
    const rules = configEligibility.international_baccalaureate || {};
    const profile = applicant.ib_profile || {};
    const hlGrades = getSubjectGrades(profile, ['higher_level_subjects', 'hl_subjects', 'subjects']);
    const routes = (rules.routes || []).filter((route) => groupRuleApplies(route, groupIds));
    const routeAssessments = routes.map((route) => {
      const totalPoints = Number(profile.total_points);
      const hlValues = Object.values(hlGrades)
        .map((grade) => Number(normaliseGrade(grade)))
        .filter((grade) => Number.isFinite(grade));
      const suppliedHlTotal = Number(
        profile.higher_level_total_points ??
        profile.hl_total_points ??
        profile.total_hl_points
      );
      const hlTotal = Number.isFinite(suppliedHlTotal)
        ? suppliedHlTotal
        : (hlValues.length > 0 ? hlValues.reduce((total, grade) => total + grade, 0) : null);
      const totalPointsKnown = Number.isFinite(totalPoints);
      const hlPointsKnown = !Number.isFinite(route.minimum_hl_points) || Number.isFinite(hlTotal);
      const gradeOptions = route.required_hl_subject_grade_options || [];
      const subjectGradesKnown = (route.required_hl_subject_ids || [])
        .every((subjectId) => hlGrades[subjectId] !== undefined) &&
        (gradeOptions.length === 0 || gradeOptions.some((option) => {
          return (option.grade_requirements || []).every((requirement) => {
            return hlGrades[requirement.subject_id] !== undefined;
          });
        }));
      const hlGradeProfileKnown =
        (route.hl_grade_profile || []).length === 0 ||
        Object.values(hlGrades).length >= route.hl_grade_profile.length;
      const inconclusive = !totalPointsKnown ||
        !hlPointsKnown ||
        !subjectGradesKnown ||
        !hlGradeProfileKnown;

      if (inconclusive) {
        return { route_id: route.route_id, passed: false, inconclusive: true };
      }

      const passed = totalPoints >= route.total_points &&
        gradeProfileMeets(Object.values(hlGrades), route.hl_grade_profile || []) &&
        (!Number.isFinite(route.minimum_hl_points) || hlTotal >= route.minimum_hl_points) &&
        (route.required_hl_subject_ids || []).every((subjectId) => hlGrades[subjectId] !== undefined) &&
        (gradeOptions.length === 0 || gradeOptions.some((option) => {
          return (option.grade_requirements || []).every((requirement) => {
            return gradeMeets(hlGrades[requirement.subject_id], requirement.minimum_grade, 'gcse');
          });
        }));

      return { route_id: route.route_id, passed, inconclusive: false };
    });
    const passed = routeAssessments.some((assessment) => assessment.passed);
    const inconclusive = !passed && routeAssessments.some((assessment) => assessment.inconclusive);
    checks.push({ check: 'international_baccalaureate_route', passed });
    if (!passed && inconclusive) {
      addManualReview('international_baccalaureate_route_requires_manual_review');
    } else if (!passed) {
      addFailure('international_baccalaureate_requirements_not_met');
    }
  } else if (academicRoute === 'scottish') {
    const rules = configEligibility.scottish || {};
    const national5 = getSubjectGrades(applicant.scottish_profile, ['national_5_subjects']);
    const advancedHighers = getSubjectGrades(applicant.scottish_profile, ['advanced_higher_subjects']);
    const highers = getSubjectGrades(applicant.scottish_profile, ['higher_subjects']);
    const post16 = { ...highers, ...advancedHighers };
    const requiredNational5 = rules.national_5?.required_subject_ids || [];
    const national5Passed =
      Object.keys(national5).length >= (rules.national_5?.minimum_count || 0) &&
      requiredNational5.every((subjectId) => national5[subjectId] !== undefined);
    const post16Passed = (rules.post_16_routes || []).some((route) => {
      const routeLevel = normaliseId(route.qualification_level);
      const higherProfile = route.higher_grade_profile || [];
      if (higherProfile.length > 0) {
        const advancedPassed = gradeProfileMeets(Object.values(advancedHighers), route.grade_profile || []) &&
          (route.required_subject_ids || []).every((subjectId) => advancedHighers[subjectId] !== undefined) &&
          checkSubjectGroups(advancedHighers, route.one_of_subject_groups);
        const highersPassed = gradeProfileMeets(Object.values(highers), higherProfile);
        return advancedPassed && highersPassed && checkSubjectGroups(post16, route.any_post16_subject_groups);
      }

      const grades = [
        'advanced_higher',
        'advanced_highers',
        'scottish_advanced_highers'
      ].includes(routeLevel)
        ? advancedHighers
        : post16;
      return gradeProfileMeets(Object.values(grades), route.grade_profile || []) &&
        (route.required_subject_ids || []).every((subjectId) => grades[subjectId] !== undefined) &&
        checkSubjectGroups(grades, route.one_of_subject_groups) &&
        checkSubjectGroups(post16, route.any_post16_subject_groups);
    });
    checks.push({ check: 'national_5_route', passed: national5Passed });
    checks.push({ check: 'scottish_post_16_route', passed: post16Passed });
    if (!national5Passed) {
      addFailure('national_5_requirements_not_met');
    }
    if (!post16Passed) {
      addFailure('scottish_post_16_requirements_not_met');
    }
  } else if (academicRoute === 'access_to_medicine') {
    const profile = applicant.access_to_medicine_profile || applicant.access_to_he_profile || {};
    const passed =
      profile.provider_approved_by_institution === true &&
      profile.requirements_met === true;
    checks.push({ check: 'access_to_medicine_verified_pathway', passed });
    if (!passed) {
      addFailure('access_to_medicine_pathway_not_verified');
    }
  } else if (academicRoute === 'international_qualification') {
    const profile = applicant.international_qualification || {};
    const passed =
      profile.equivalence_status === 'verified' &&
      profile.verified_by_institution === true &&
      profile.requirements_met === true;
    checks.push({ check: 'international_qualification_verified_equivalence', passed });
    if (!passed) {
      if (configEligibility.international_qualification?.unverified_outcome === 'manual_review') {
        addManualReview(
          configEligibility.international_qualification.manual_review_reason ||
          'international_qualification_requires_manual_review'
        );
      } else {
        addFailure('international_qualification_not_verified');
      }
    }
  } else if (academicRoute === 'graduate') {
    const profile = applicant.graduate_profile || {};
    const classification = normaliseId(profile.degree_classification || profile.classification);
    const postgraduate = normaliseId(profile.postgraduate_qualification);
    const minimumClassification = normaliseId(graduateRules.minimum_classification || '2_1');
    const minimumClassificationRank = DEGREE_CLASSIFICATION_RANK[minimumClassification] ?? 3;
    const classificationRank = DEGREE_CLASSIFICATION_RANK[classification] || 0;
    const postgraduateCompensationAllowed = graduateRules.postgraduate_compensation_allowed !== false;
    const passed =
      classificationRank >= minimumClassificationRank ||
      (postgraduateCompensationAllowed &&
        classificationRank >= 2 &&
        ['masters', 'master_s', 'phd', 'doctorate'].includes(postgraduate) &&
        profile.postgraduate_achieved_or_predicted === true);
    checks.push({ check: 'graduate_degree_route', passed });
    if (!passed) {
      addFailure('graduate_degree_requirements_not_met');
    }
    const maxYearsWithoutRecentHigherEducation =
      graduateRules.maximum_years_without_recent_higher_education;
    if (Number.isFinite(maxYearsWithoutRecentHigherEducation)) {
      const yearsSinceDegree = Number(
        profile.years_since_degree_award ??
        profile.years_since_degree ??
        profile.years_without_recent_higher_education
      );
      const recentHigherEducation =
        profile.recent_higher_education === true ||
        profile.recent_higher_education_evidence === true ||
        profile.postgraduate_qualification_verified === true;
      if (
        Number.isFinite(yearsSinceDegree) &&
        yearsSinceDegree > maxYearsWithoutRecentHigherEducation &&
        !recentHigherEducation
      ) {
        if (graduateRules.recency_fail_action === 'manual_review') {
          addManualReview('graduate_recency_requires_manual_review');
        } else {
          addFailure('graduate_recent_higher_education_not_confirmed');
        }
      }
    }
  }

  const sameSitting = evaluateSameSittingRequirement(
    course,
    config,
    applicant,
    qualificationRoute
  );

  if (sameSitting) {
    checks.push(sameSitting.check);
    if (sameSitting.status === 'not_eligible') {
      addFailure(sameSitting.reason);
    } else if (sameSitting.status === 'manual_review') {
      addManualReview(sameSitting.reason);
    }
  }

  const resit = applicant.applicant_identity?.resit || applicant.resit_profile || {};
  const hasResits = resit === true || resit.has_resits === true;
  if (hasResits) {
    const configuredResitPolicy = configEligibility.resits || {};
    let passed = stage1.resits?.allowed !== false &&
      configuredResitPolicy.resits_accepted !== false &&
      configuredResitPolicy.allowed !== false &&
      (configuredResitPolicy.applicant_form_required === false || resit.applicant_form_submitted === true);

    if (
      configuredResitPolicy.extenuating_circumstances_required === true &&
      resit.extenuating_circumstances_accepted !== true
    ) {
      passed = false;
    }

    const allowedAttempts = configuredResitPolicy.allowed_resit_attempts ?? stage1.resits?.maximum_resits;
    if (Number.isFinite(allowedAttempts) && Number(resit.attempt_count ?? 1) > allowedAttempts) {
      passed = false;
    }

    const routeRules = (configuredResitPolicy.routes || [])
      .filter((rule) => groupRuleApplies(rule, groupIds));
    if (academicRoute === 'a_level' && routeRules.length > 0) {
      const aLevelGrades = Object.values(getALevelGrades(applicant));
      passed = passed && routeRules.some((rule) => {
        const requiredProfile = rule.grade_profile || rule.resit_requirement || [];
        return requiredProfile.length > 0 && gradeProfileMeets(aLevelGrades, requiredProfile);
      });
    } else if (academicRoute === 'a_level') {
      passed = passed && gradeProfileMeets(resit.first_sitting_grade_profile || [], ['A', 'B', 'B']);
    } else if (['international_baccalaureate', 'ib'].includes(academicRoute)) {
      passed = passed && Number(resit.first_sitting_total_points) >= 34;
    } else if (academicRoute === 'scottish') {
      passed = passed && gradeProfileMeets(
        resit.first_sitting_advanced_higher_grade_profile || [],
        ['B', 'B']
      );
    } else if (resit.gcse_resits === true) {
      const contextual = groupIds.includes('contextual') || groupIds.includes('widening_participation');
      const requiredPoints = contextual
        ? (gcseConfig.contextual_minimum_points ?? 12)
        : (gcseConfig.points?.minimum_points ?? 15);
      passed = passed && Number(resit.remaining_gcse_points_at_end_year_11) >= requiredPoints;
    }
    checks.push({ check: 'resit_pathway', passed });
    if (!passed) {
      addFailure('resit_policy_not_met');
    }
  }

  return {
    status: failures.length ? 'not_eligible' : manualReviewReasons.length ? 'manual_review' : 'eligible',
    failures,
    manual_review_reasons: manualReviewReasons,
    checks,
    exact_gcse_count: exactGcseCount,
    qualification_route: qualificationRoute,
    ...(academicPathway ? {
      academic_pathway: academicPathway,
      academic_pathway_id: academicPathwayId
    } : {}),
    ...(futureConditions.length > 0 ? { future_conditions: futureConditions } : {}),
    ...(epqAlternativeResult ? { epq_alternative_result: epqAlternativeResult } : {})
  };
}

// Explicit, narrow course-code equivalence mapping for universities whose real
// UCAS code differs from the shared workflow code applicants select under.
// Keyed by profile_id so the equivalence is scoped to that specific university
// only — it must never weaken course-target matching for anyone else, and it
// must never rewrite the university's actual ucas_code in its own data.
const COURSE_TARGET_EQUIVALENCE = {
  'buckingham-71a8': ['A100'],
};

function isEquivalentCourseTarget(profileId, targetCourseCode) {
  const allowed = COURSE_TARGET_EQUIVALENCE[profileId];
  return Array.isArray(allowed) && allowed.includes(targetCourseCode);
}

function applyClassificationEligibilityGuards(eligibility, config, qualificationRoute, groupIds = [], applicant = null) {
  const configEligibility = config?.eligibility || {};
  const configuredRoutes = configEligibility.qualification_routes || {};
  const normalisedRoute = normaliseId(qualificationRoute);
  const normalisedGroupIds = groupIds.map(normaliseId);
  const failures = [...(eligibility.failures || [])];
  const manualReviewReasons = [...(eligibility.manual_review_reasons || [])];
  const addFailure = (reason) => {
    if (!failures.includes(reason)) {
      failures.push(reason);
    }
  };
  const addManualReview = (reason) => {
    if (!manualReviewReasons.includes(reason)) {
      manualReviewReasons.push(reason);
    }
  };

  if ((configuredRoutes.explicitly_blocked || []).map(normaliseId).includes(normalisedRoute)) {
    addFailure(`qualification_route_explicitly_blocked:${normalisedRoute}`);
  }
  if ((configuredRoutes.manual_review || []).map(normaliseId).includes(normalisedRoute)) {
    addManualReview(`qualification_route_requires_manual_review:${normalisedRoute}`);
    const routeNotVerifiedFailure = `${normalisedRoute}_route_not_verified`;
    const failureIndex = failures.indexOf(routeNotVerifiedFailure);
    if (failureIndex !== -1) {
      failures.splice(failureIndex, 1);
    }
  }

  if (
    normalisedRoute === 'a_level' &&
    applicant?.a_level_profile == null &&
    normaliseId(configEligibility.academic_evidence?.missing_outcome) === 'manual_review'
  ) {
    const failureIndex = failures.indexOf('a_level_requirements_not_met');
    if (failureIndex !== -1) {
      failures.splice(failureIndex, 1);
      addManualReview(
        configEligibility.academic_evidence?.manual_review_reason ||
        'missing_academic_evidence_requires_manual_review'
      );
    }
  }

  if (normaliseId(configEligibility.academic_evidence?.missing_outcome) === 'manual_review') {
    const gcseGrades = getGcseGrades(applicant || {});
    const missingGcseFailureChecks = (eligibility.checks || [])
      .filter((check) => {
        if (check?.status !== 'fail' || !Array.isArray(check.subject_ids)) {
          return false;
        }
        return check.subject_ids.every((subjectId) => {
          return gcseGrades[subjectId] === undefined;
        });
      });
    let removedMissingGcseFailure = false;
    for (const check of missingGcseFailureChecks) {
      const subjectId = normaliseId(check.subject_id);
      for (const reason of [
        `gcse_requirement_not_met:${subjectId}`,
        `required_gcse_subject_missing:${subjectId}`
      ]) {
        const failureIndex = failures.indexOf(reason);
        if (failureIndex !== -1) {
          failures.splice(failureIndex, 1);
          removedMissingGcseFailure = true;
        }
      }
    }
    if (removedMissingGcseFailure) {
      addManualReview(
        configEligibility.academic_evidence?.manual_review_reason ||
        'missing_academic_evidence_requires_manual_review'
      );
    }
  }

  for (const groupId of configEligibility.explicitly_blocked_applicant_groups || []) {
    const normalisedGroupId = normaliseId(groupId);
    if (normalisedGroupIds.includes(normalisedGroupId)) {
      addFailure(`applicant_group_explicitly_blocked:${normalisedGroupId}`);
    }
  }
  for (const groupId of configEligibility.manual_review_applicant_groups || []) {
    const normalisedGroupId = normaliseId(groupId);
    if (normalisedGroupIds.includes(normalisedGroupId)) {
      addManualReview(`applicant_group_requires_manual_review:${normalisedGroupId}`);
    }
  }

  const graduateRules = configEligibility.graduate || {};
  if (normalisedRoute === 'graduate' || normalisedGroupIds.includes('graduate_applicant')) {
    const maxYearsWithoutRecentHigherEducation =
      graduateRules.maximum_years_without_recent_higher_education;
    if (Number.isFinite(maxYearsWithoutRecentHigherEducation)) {
      const profile = applicant?.graduate_profile || {};
      const yearsSinceDegree = Number(
        profile.years_since_degree_award ??
        profile.years_since_degree ??
        profile.years_without_recent_higher_education
      );
      const recentHigherEducation =
        profile.recent_higher_education === true ||
        profile.recent_higher_education_evidence === true ||
        profile.postgraduate_qualification_verified === true;
      if (
        Number.isFinite(yearsSinceDegree) &&
        yearsSinceDegree > maxYearsWithoutRecentHigherEducation &&
        !recentHigherEducation
      ) {
        if (graduateRules.recency_fail_action === 'manual_review') {
          addManualReview('graduate_recency_requires_manual_review');
        } else {
          addFailure('graduate_recent_higher_education_not_confirmed');
        }
      }
    }
  }

  const status = failures.length
    ? 'not_eligible'
    : manualReviewReasons.length
      ? 'manual_review'
      : eligibility.status;

  return {
    ...eligibility,
    status,
    failures,
    manual_review_reasons: manualReviewReasons
  };
}

function evaluateHardFilters(course, config, applicant, groupIds, resolvedEligibility = null) {
  const academic = evaluateAcademicEligibility(course, config, applicant, groupIds);
  const failures = [...academic.failures];
  const tests = course.stage_1_eligibility?.admissions_tests || {};
  const ucat = tests.ucat || {};
  const sjt = tests.sjt || {};
  const ucatTotal = applicant.admissions_tests?.ucat?.total_score;
  const sjtBand = applicant.admissions_tests?.ucat?.sjt_band;
  const gamsat = applicant.admissions_tests?.gamsat || {};
  const ucatTestYear = applicant.admissions_tests?.ucat?.test_year;
  const requiredUcatTestYear = config.eligibility?.ucat?.required_test_year;
  const isGraduate = groupIds.includes('graduate_applicant');
  const isInternational = groupIds.includes('international_fee');
  const gamsatRule = (tests.other_tests || []).find((test) => {
    return normaliseId(test.test_id || test.name) === 'gamsat' && test.required === true;
  });
  const graduateCompensatoryPolicy = getGraduateCompensatoryPolicy(course);
  const usesGamsat = isGraduate && Boolean(gamsatRule) && !graduateCompensatoryPolicy?.ucat_remains_required;
  const targetCourseCode = String(applicant.course_target?.ucas_code || '').toUpperCase();
  const courseCode = String(course.course?.ucas_code || '').toUpperCase();
  const academicManualReview = Boolean(academic.manual_review_reasons?.length);
  const ageAssessment = evaluateExplicitMinimumAge(course, applicant);
  const manualReviewRules = config.eligibility?.manual_review_if || [];
  const addManualReviewReason = (reason) => {
    if (!academic.manual_review_reasons.includes(reason)) {
      academic.manual_review_reasons.push(reason);
    }
  };

  if (
    targetCourseCode &&
    courseCode &&
    targetCourseCode !== courseCode &&
    !isEquivalentCourseTarget(course.profile_id, targetCourseCode)
  ) {
    failures.push(`course_target_mismatch:${targetCourseCode}:${courseCode}`);
  }
  if (ageAssessment.blocks_prediction === true) {
    failures.push('minimum_age_requirement_not_met');
  } else if (ageAssessment.status === 'manual_review') {
    addManualReviewReason(
      ageAssessment.manual_review_reason ||
      'minimum_age_requires_confirmation'
    );
  }

  const ucatApplies = !usesGamsat &&
    (!Array.isArray(ucat.excluded_group_ids) ||
      !ucat.excluded_group_ids.some((groupId) => groupIds.includes(groupId)));
  const missingUcatAllowedByOverride = Boolean(
    !Number.isFinite(ucatTotal) &&
    resolveGuaranteedInterviewOverride(config, applicant, groupIds, resolvedEligibility)
  );
  if (
    ucat.required === true &&
    ucatApplies &&
    !Number.isFinite(ucatTotal) &&
    !missingUcatAllowedByOverride
  ) {
    if (config.eligibility?.ucat?.missing_outcome === 'manual_review') {
      addManualReviewReason('required_admissions_test_missing:ucat');
    } else {
      failures.push('required_admissions_test_missing:ucat');
    }
  }
  const rawUcatTotal =
    applicant.admissions_tests?.ucat?.total_score;

  const supportedUcatMin =
    config.eligibility?.ucat?.score_min ?? 0;

  const supportedUcatMax =
    config.eligibility?.ucat?.score_max ??
    ucat.score_scale ??
    applicant.admissions_tests?.ucat?.score_scale ??
    2700;

  if (
    ucatApplies &&
    Number.isFinite(rawUcatTotal) &&
    (
      rawUcatTotal < supportedUcatMin ||
      rawUcatTotal > supportedUcatMax
    )
  ) {
    addManualReviewReason('ucat_total_outside_supported_range');
  }

  const minimumUcatTotalScore = resolveUcatMinimumTotalScore(ucat, groupIds);
  if (
    ucatApplies &&
    Number.isFinite(minimumUcatTotalScore) &&
    (!Number.isFinite(ucatTotal) || ucatTotal < minimumUcatTotalScore)
  ) {
    failures.push('minimum_ucat_total_not_met');
  }
  const ucatSubsectionMinimums = evaluateUcatSubsectionMinimums(
    ucat,
    applicant.admissions_tests?.ucat || {}
  );
  if (
    ucatApplies &&
    ucatSubsectionMinimums.checks.length > 0 &&
    !ucatSubsectionMinimums.passed
  ) {
    failures.push('ucat_section_minimum_not_met');
  }

  if (
    ucatApplies &&
    Number.isInteger(requiredUcatTestYear) &&
    ucatTestYear !== requiredUcatTestYear
  ) {
    failures.push(`ucat_test_year_not_valid:${ucatTestYear ?? 'missing'}:${requiredUcatTestYear}`);
  }
  if (
    ucatApplies &&
    Number.isInteger(applicant.application_year) &&
    Number.isInteger(ucatTestYear) &&
    !isUcatCycleValid(applicant.application_year, ucatTestYear)
  ) {
    failures.push(
      `ucat_cycle_not_valid:${applicant.application_year}:${ucatTestYear}`
    );
  }

  const groupSjtPolicy = (sjt.group_policies || [])
    .find((policy) => groupRuleApplies(policy, groupIds));
  const internationalSjtPolicy = isInternational
    ? course.stage_2_interview_selection?.international_selection?.sjt
    : null;
  const sjtUsedAsGate = groupSjtPolicy?.used_as_gate ?? sjt.used_as_gate;
  const excludedBands = groupSjtPolicy?.excluded_bands ?? sjt.excluded_bands ?? [];
  const sjtApplies = !isGraduate ||
    graduateCompensatoryPolicy?.sjt_remains_required === true ||
    sjt.graduate_sjt_remains_required === true ||
    config.eligibility?.sjt?.graduate_sjt_remains_required === true;
  if (sjtApplies && sjtUsedAsGate === true && !Number.isFinite(sjtBand)) {
    if (config.eligibility?.sjt?.missing_outcome === 'manual_review') {
      addManualReviewReason('required_admissions_test_component_missing:sjt');
    } else {
      failures.push('required_admissions_test_component_missing:sjt');
    }
  } else if (
    sjtApplies &&
    (
      !isInternational ||
      Boolean(groupSjtPolicy) ||
      sjtUsedAsGate === true ||
      internationalSjtPolicy?.band_4_automatic_rejection === true
    ) &&
    excludedBands.includes(sjtBand)
  ) {
    failures.push('disqualifying_sjt_rule');
  }

  for (const rule of manualReviewRules) {
    if (!groupRuleApplies(rule.match || rule, groupIds)) {
      continue;
    }
    if (rule.when === 'fee_status_unresolved') {
      const hasFeeStatus = groupIds.includes('home_fee') || groupIds.includes('international_fee');
      if (!hasFeeStatus) {
        addManualReviewReason(rule.reason || 'fee_status_requires_manual_review');
      }
    }
    if (rule.when === 'missing_or_unknown_evidence') {
      const value = getValueAtPath(applicant, rule.applicant_evidence_path);
      if (value === undefined || value === null || value === '' || value === 'unknown') {
        addManualReviewReason(rule.reason || 'applicant_evidence_requires_manual_review');
      }
    }
    if (rule.when === 'unknown_evidence') {
      const value = getValueAtPath(applicant, rule.applicant_evidence_path);
      if (value === 'unknown') {
        addManualReviewReason(rule.reason || 'applicant_evidence_requires_manual_review');
      }
    }
  }

  if (usesGamsat && !academicManualReview) {
    const sectionScores = Array.isArray(gamsat.section_scores)
      ? gamsat.section_scores
      : Object.values(gamsat.section_scores || {});
    if (!Number.isFinite(gamsat.overall_score)) {
      failures.push('required_admissions_test_missing:gamsat');
    }
    if (sectionScores.length < 3 || sectionScores.some((score) => !Number.isFinite(score) || score < 50)) {
      failures.push('minimum_gamsat_component_not_met');
    }
  }

  if (
    isInternational &&
    config.eligibility?.international_english_language_required === true &&
    applicant.applicant_identity?.english_language_exempt !== true
  ) {
    const english = applicant.english_language_profile || {};
    const testName = normaliseId(english.test || english.test_name);
    const scores = english.scores || english;
    const ieltsRule = (course.stage_1_eligibility?.english_language?.accepted_tests || [])
      .find((test) => ['ielts', 'ielts_academic'].includes(normaliseId(test.test || test.name)));
    const overallMinimum = Number(
      ieltsRule?.overall_minimum ??
      ieltsRule?.minimum_overall ??
      ieltsRule?.overall ??
      7
    );
    const defaultComponentMinimum = Number(
      ieltsRule?.minimum_each_component ??
      ieltsRule?.component_minimum ??
      ieltsRule?.reading_minimum ??
      ieltsRule?.overall ??
      7
    );
    const passed =
      ['ielts', 'ielts_academic'].includes(testName) &&
      Number(scores.overall ?? english.overall) >= overallMinimum &&
      Number(scores.reading) >= Number(ieltsRule?.reading_minimum ?? defaultComponentMinimum) &&
      Number(scores.writing) >= Number(ieltsRule?.writing_minimum ?? defaultComponentMinimum) &&
      Number(scores.listening) >= Number(ieltsRule?.listening_minimum ?? defaultComponentMinimum) &&
      Number(scores.speaking) >= Number(ieltsRule?.speaking_minimum ?? defaultComponentMinimum);
    if (!passed) {
      failures.push('international_english_language_requirement_not_met');
    }
  }

  return {
    ...academic,
    status: failures.length ? 'not_eligible' : academic.manual_review_reasons?.length ? 'manual_review' : 'eligible',
    failures,
    manual_review_reasons: academic.manual_review_reasons || []
  };
}

function getValueAtPath(value, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

function overrideEvidenceMatches(condition, applicant) {
  if (Array.isArray(condition?.all_evidence)) {
    return condition.all_evidence.every((evidenceCondition) =>
      overrideEvidenceMatches(evidenceCondition, applicant)
    );
  }
  if (Array.isArray(condition?.any_evidence)) {
    return condition.any_evidence.some((evidenceCondition) =>
      overrideEvidenceMatches(evidenceCondition, applicant)
    );
  }
  if (Array.isArray(condition?.minimum_evidence) && Number.isFinite(Number(condition?.minimum_evidence_matches))) {
    const requiredMatches = Number(condition.minimum_evidence_matches);
    const matched = condition.minimum_evidence.filter((evidenceCondition) =>
      overrideEvidenceMatches(evidenceCondition, applicant)
    ).length;
    return matched >= requiredMatches;
  }
  if (!condition?.applicant_evidence_path) {
    return true;
  }

  const evidence = getValueAtPath(applicant, condition.applicant_evidence_path);
  const requiredEvidence = condition.required_evidence || {};
  const isArrayEvidence = Array.isArray(evidence);

  if (isArrayEvidence) {
    return evidence.some((entry) => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      return Object.entries(requiredEvidence).every(([key, expected]) => entry[key] === expected);
    });
  }

  return Boolean(
    evidence &&
    Object.entries(requiredEvidence).every(([key, expected]) => evidence[key] === expected)
  );
}

function guaranteedInterviewOverrideApplies(config, applicant, groupIds = [], resolvedEligibility = null) {
  return Boolean(resolveGuaranteedInterviewOverride(config, applicant, groupIds, resolvedEligibility));
}

function resolveGuaranteedInterviewOverride(config, applicant, groupIds = [], resolvedEligibility = null) {
  const override = config.eligibility?.map_override;
  if (!override || override.apply_ucat_guidance_band !== false) {
    return null;
  }

  if (
    override.requires_eligibility_status === 'eligible' &&
    resolvedEligibility?.status !== 'eligible'
  ) {
    return null;
  }

  if (Array.isArray(override.any_conditions) && override.any_conditions.length > 0) {
    const matchedCondition = override.any_conditions.find((condition) => {
      const resolvedCondition = {
        ...override,
        ...condition
      };
      return groupRuleApplies(condition.match || condition, groupIds) &&
        overrideEvidenceMatches(condition, applicant) &&
        guaranteedInterviewRequirementsApply(resolvedCondition, applicant, resolvedEligibility);
    });
    return matchedCondition
      ? {
        ...override,
        ...matchedCondition,
        applicant_facing_explanation:
          matchedCondition.applicant_facing_explanation ||
          override.applicant_facing_explanation
      }
      : null;
  }

  return groupRuleApplies(override.match || override, groupIds) &&
    overrideEvidenceMatches(override, applicant) &&
    guaranteedInterviewRequirementsApply(override, applicant, resolvedEligibility)
    ? override
    : null;
}

function valuesInclude(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function guaranteedInterviewRequirementsApply(rule, applicant, resolvedEligibility = null) {
  if (
    rule.requires_eligibility_status &&
    resolvedEligibility?.status !== rule.requires_eligibility_status
  ) {
    return false;
  }

  if (
    rule.requires_confirmed_contextual_eligibility === true &&
    !valuesInclude(
      rule.confirmed_contextual_statuses || ['contextual', 'confirmed'],
      resolvedEligibility?.contextual_eligibility?.status
    )
  ) {
    return false;
  }

  if (
    Array.isArray(rule.contextual_levels) &&
    !rule.contextual_levels.includes(
      resolvedEligibility?.contextual_eligibility?.contextual_level
    )
  ) {
    return false;
  }

  const sjtBand = applicant.admissions_tests?.ucat?.sjt_band;
  if (Array.isArray(rule.sjt_bands) && !rule.sjt_bands.includes(sjtBand)) {
    return false;
  }
  if (Array.isArray(rule.excluded_sjt_bands) && rule.excluded_sjt_bands.includes(sjtBand)) {
    return false;
  }

  return true;
}

function getNationalDecile(applicant, context) {
  if (context.nationalDecile) {
    return context.nationalDecile;
  }

  const score = applicant.admissions_tests?.ucat?.total_score;
  if (!Number.isFinite(score)) {
    return null;
  }

  const result = resolveUcatDecile(score, {
    courseProfileId: context.courseProfileId,
    decileData: context.ucatDecileData,
    universityDecileData: context.universityDecileData
  });
  context.nationalDecile = result.available ? result : null;
  return context.nationalDecile;
}

function calculateALevelGradePoints(component, applicant) {
  const grades = Object.values(getALevelGrades(applicant))
    .map((grade) => normaliseGrade(grade))
    .sort((a, b) => gradeRank(b, 'a_level') - gradeRank(a, 'a_level'))
    .slice(0, component.subject_count || 3);
  const raw = grades.reduce((total, grade) => total + (component.points_by_grade?.[grade] ?? 0), 0);
  const unboundedValue = component.raw_max
    ? (raw / component.raw_max) * component.output_max
    : raw;
  const value = Number.isFinite(component.hard_cap)
    ? Math.min(unboundedValue, component.hard_cap)
    : unboundedValue;

  return { value: round(value), raw_value: raw, max: component.output_max ?? component.max };
}

function calculateNationalDecileLookup(component, applicant, context) {
  const decile = getNationalDecile(applicant, context);
  if (!decile) {
    return { value: null, max: component.output_max ?? component.max, reason: 'national_ucat_decile_unavailable' };
  }

  const raw = component.points_by_decile?.[decile.national_decile];
  if (!Number.isFinite(raw)) {
    return { value: null, max: component.output_max ?? component.max, reason: 'decile_points_unavailable' };
  }

  const value = component.raw_max
    ? (raw / component.raw_max) * component.output_max
    : raw;

  return {
    value: round(value),
    raw_value: raw,
    max: component.output_max ?? component.max
  };
}

function scoreGcseGrade(grade, bands) {
  return (bands || []).find((band) => gradeMeets(grade, band.minimum_grade, 'gcse'))?.points || 0;
}

function expandMandatoryOption(option, grades) {
  const selected = [];
  const credits = option.subject_credits || {};

  for (const subjectId of option.subject_ids || []) {
    if (grades[subjectId] === undefined) {
      return null;
    }

    const creditCount = credits[subjectId] || 1;
    const gradeProfile = splitGradeProfile(grades[subjectId]);
    if (gradeProfile.length < creditCount) {
      return null;
    }

    for (let index = 0; index < creditCount; index += 1) {
      selected.push({
        subject_id: subjectId,
        grade: gradeProfile[index],
        credit_index: creditCount > 1 ? index + 1 : undefined
      });
    }
  }

  return selected;
}

function calculateGcseMandatoryThenBest(component, applicant) {
  const grades = getGcseGrades(applicant);
  const mandatory = component.mandatory_subject_ids || [];
  const selected = [];
  const usedSubjectIds = new Set();

  for (const subjectId of mandatory) {
    if (grades[subjectId] === undefined) {
      return { value: null, max: component.max, reason: `mandatory_scored_subject_missing:${subjectId}` };
    }
    selected.push({ subject_id: subjectId, grade: grades[subjectId] });
    usedSubjectIds.add(subjectId);
  }

  for (const alternative of component.mandatory_subject_alternatives || []) {
    let matched = null;
    for (const option of alternative.options || []) {
      matched = expandMandatoryOption(option, grades);
      if (matched) {
        break;
      }
    }
    if (!matched) {
      return {
        value: null,
        max: component.max,
        reason: `mandatory_scored_alternative_missing:${alternative.alternative_id}`
      };
    }
    selected.push(...matched);
    matched.forEach((subject) => usedSubjectIds.add(subject.subject_id));
  }

  const remaining = Object.entries(grades)
    .filter(([subjectId]) => !usedSubjectIds.has(subjectId))
    .map(([subjectId, grade]) => ({ subject_id: subjectId, grade }))
    .sort((a, b) => {
      return scoreGcseGrade(b.grade, component.bands) - scoreGcseGrade(a.grade, component.bands) ||
        gradeRank(b.grade, 'gcse') - gradeRank(a.grade, 'gcse');
    });

  selected.push(...remaining.slice(0, Math.max(0, component.subject_count - selected.length)));

  if (selected.length < component.subject_count) {
    if (component.normalise_when_fewer_subjects === true && selected.length > 0) {
      const minimumSubjects = component.minimum_subjects_for_normalisation || 1;
      if (selected.length < minimumSubjects) {
        return { value: null, max: component.max, reason: 'insufficient_gcse_subjects_for_normalised_score' };
      }
      const rawPoints = selected.reduce(
        (total, subject) => total + scoreGcseGrade(subject.grade, component.bands),
        0
      );
      const value = Math.min(
        Number.isFinite(component.max) ? component.max : Infinity,
        (rawPoints / selected.length) * component.subject_count
      );
      return {
        value: round(value),
        raw_value: rawPoints,
        max: component.max,
        selected_subjects: selected,
        normalised_from_subject_count: selected.length,
        normalisation_formula: component.normalisation_formula ||
          '(sum_of_gcse_points / number_of_gcse_subjects_taken) * subject_count'
      };
    }
    return {
      value: null,
      max: component.max,
      reason: 'insufficient_gcse_results',
      missing_information: {
        qualification_type: 'gcse',
        provided_count: selected.length,
        required_count: component.subject_count,
        component_label: component.public_component_label || 'GCSE scoring component'
      }
    };
  }

  const ambiguousGrades = new Set(
    (component.ambiguous_grade_values || []).map((grade) => String(grade).trim().toUpperCase())
  );
  const ambiguous = selected.find((subject) => {
    return ambiguousGrades.has(String(subject.grade).trim().toUpperCase());
  });
  if (ambiguous) {
    return {
      value: null,
      max: component.max,
      reason: `ambiguous_gcse_grade_points:${ambiguous.subject_id}:${ambiguous.grade}`,
      selected_subjects: selected
    };
  }

  return {
    value: selected.reduce((total, subject) => total + scoreGcseGrade(subject.grade, component.bands), 0),
    max: component.max,
    selected_subjects: selected
  };
}

function scoreAstonScottishGrade(grade, pointsByGrade = {}) {
  const normalised = String(grade ?? '').trim().toUpperCase();
  return Number(pointsByGrade[normalised]) || 0;
}

function selectAstonScottishNational5Subjects(applicant, pointsByGrade = {}) {
  const grades = getSubjectGrades(
    applicant.scottish_profile,
    ['national_5_subjects']
  );

  const selected = [];
  const used = new Set();

  const requireSubject = (subjectId) => {
    if (grades[subjectId] === undefined) {
      return false;
    }

    selected.push({
      subject_id: subjectId,
      grade: grades[subjectId]
    });
    used.add(subjectId);
    return true;
  };

  if (!requireSubject('english_language') && !requireSubject('english')) {
    return {
      selected: [],
      reason: 'aston_scottish_national5_mandatory_missing:english_language'
    };
  }

  if (!requireSubject('mathematics')) {
    return {
      selected: [],
      reason: 'aston_scottish_national5_mandatory_missing:mathematics'
    };
  }

  if (grades.chemistry !== undefined && grades.biology !== undefined) {
    requireSubject('chemistry');
    requireSubject('biology');
  } else {
    const doubleScienceId = ['combined_science', 'double_science']
      .find((subjectId) => grades[subjectId] !== undefined);

    if (!doubleScienceId) {
      return {
        selected: [],
        reason: 'aston_scottish_national5_science_route_missing'
      };
    }

    const profile = splitGradeProfile(grades[doubleScienceId]);

    if (profile.length < 2) {
      return {
        selected: [],
        reason: `aston_scottish_national5_double_science_profile_incomplete:${doubleScienceId}`
      };
    }

    selected.push(
      {
        subject_id: doubleScienceId,
        grade: profile[0],
        credit_index: 1
      },
      {
        subject_id: doubleScienceId,
        grade: profile[1],
        credit_index: 2
      }
    );
    used.add(doubleScienceId);
  }

  const remaining = Object.entries(grades)
    .filter(([subjectId]) => !used.has(subjectId))
    .map(([subjectId, grade]) => ({
      subject_id: subjectId,
      grade
    }))
    .sort((a, b) =>
      scoreAstonScottishGrade(b.grade, pointsByGrade) -
        scoreAstonScottishGrade(a.grade, pointsByGrade) ||
      gradeRank(b.grade, 'gcse') - gradeRank(a.grade, 'gcse')
    );

  selected.push(...remaining.slice(0, Math.max(0, 6 - selected.length)));

  if (selected.length < 6) {
    return {
      selected,
      reason: 'insufficient_aston_scottish_national5_results'
    };
  }

  return {
    selected: selected.slice(0, 6),
    reason: null
  };
}

function calculateAstonScottishAcademicScore(component, applicant) {
  const qualificationStatus = deriveQualificationStatus(applicant);

  if (!['predicted', 'achieved'].includes(qualificationStatus)) {
    return {
      value: null,
      max: component.max,
      reason: 'aston_scottish_qualification_status_unknown',
      qualification_status: qualificationStatus
    };
  }

  const national5PointsByGrade =
    qualificationStatus === 'achieved'
      ? (component.achieved?.national_5?.points_by_grade || {})
      : (component.predicted?.national_5?.points_by_grade || {});

  const national5Selection = selectAstonScottishNational5Subjects(
    applicant,
    national5PointsByGrade
  );

  if (national5Selection.reason) {
    return {
      value: null,
      max: component.max,
      reason: national5Selection.reason,
      qualification_status: qualificationStatus,
      selected_national_5_subjects: national5Selection.selected
    };
  }

  const national5Score = national5Selection.selected.reduce(
    (total, subject) =>
      total + scoreAstonScottishGrade(subject.grade, national5PointsByGrade),
    0
  );

  if (qualificationStatus === 'predicted') {
    return {
      value: Math.min(
        national5Score,
        component.predicted?.national_5?.max ?? component.max
      ),
      max: component.max,
      qualification_status: qualificationStatus,
      scoring_route: 'national_5_only',
      national_5_score: national5Score,
      national_5_max: component.predicted?.national_5?.max ?? 24,
      selected_national_5_subjects: national5Selection.selected
    };
  }

  const advancedHighers = getSubjectGrades(
    applicant.scottish_profile,
    ['advanced_higher_subjects']
  );

  const requiredAdvancedHigherIds =
    component.achieved?.advanced_higher?.required_subject_ids ||
    ['chemistry', 'biology'];

  const selectedAdvancedHighers = [];
  const usedAdvancedHighers = new Set();

  for (const subjectId of requiredAdvancedHigherIds) {
    if (advancedHighers[subjectId] === undefined) {
      return {
        value: null,
        max: component.max,
        reason: `aston_scottish_advanced_higher_required_subject_missing:${subjectId}`,
        qualification_status: qualificationStatus
      };
    }

    selectedAdvancedHighers.push({
      subject_id: subjectId,
      grade: advancedHighers[subjectId]
    });
    usedAdvancedHighers.add(subjectId);
  }

  const advancedHigherPointsByGrade =
    component.achieved?.advanced_higher?.points_by_grade || {};

  const remainingAdvancedHighers = Object.entries(advancedHighers)
    .filter(([subjectId]) => !usedAdvancedHighers.has(subjectId))
    .map(([subjectId, grade]) => ({
      subject_id: subjectId,
      grade
    }))
    .sort((a, b) =>
      scoreAstonScottishGrade(b.grade, advancedHigherPointsByGrade) -
        scoreAstonScottishGrade(a.grade, advancedHigherPointsByGrade) ||
      gradeRank(b.grade, 'a_level') - gradeRank(a.grade, 'a_level')
    );

  selectedAdvancedHighers.push(
    ...remainingAdvancedHighers.slice(
      0,
      Math.max(
        0,
        (component.achieved?.advanced_higher?.subject_count || 3) -
          selectedAdvancedHighers.length
      )
    )
  );

  if (
    selectedAdvancedHighers.length <
    (component.achieved?.advanced_higher?.subject_count || 3)
  ) {
    return {
      value: null,
      max: component.max,
      reason: 'insufficient_aston_scottish_advanced_higher_results',
      qualification_status: qualificationStatus
    };
  }

  const advancedHigherScore = selectedAdvancedHighers.reduce(
    (total, subject) =>
      total +
      scoreAstonScottishGrade(
        subject.grade,
        advancedHigherPointsByGrade
      ),
    0
  );

  const advancedHigherMax =
    component.achieved?.advanced_higher?.max ?? 12;
  const national5Max =
    component.achieved?.national_5?.max ?? 12;

  return {
    value:
      Math.min(advancedHigherScore, advancedHigherMax) +
      Math.min(national5Score, national5Max),
    max: component.max,
    qualification_status: qualificationStatus,
    scoring_route: 'advanced_higher_plus_national_5',
    advanced_higher_score: advancedHigherScore,
    advanced_higher_max: advancedHigherMax,
    national_5_score: national5Score,
    national_5_max: national5Max,
    selected_advanced_higher_subjects: selectedAdvancedHighers,
    selected_national_5_subjects: national5Selection.selected
  };
}

function calculateQualificationPresence(component, applicant) {
  const count = applicant.a_level_profile?.subjects?.length || 0;
  return {
    value: count >= (component.minimum_subject_count || 1) ? component.points : 0,
    max: component.max
  };
}

function clampAcademicScore(score, maxPoints = 20) {
  if (!Number.isFinite(score)) {
    return score;
  }

  return Math.min(score, maxPoints);
}

function calculateAcademicProfileGcseBand(component, applicant) {
  const gcseGrades = Object.values(getGcseGrades(applicant))
    .sort((a, b) => gradeRank(b, 'gcse') - gradeRank(a, 'gcse'))
    .slice(0, component.gcse.subject_count);

  for (const band of component.gcse.bands) {
    const allMinimum = gcseGrades.length >= component.gcse.subject_count &&
      gcseGrades.every((grade) => gradeMeets(grade, band.all_minimum_grade, 'gcse'));
    const countMinimum = !band.minimum_count_at_or_above ||
      gcseGrades.filter((grade) => gradeMeets(
        grade,
        band.minimum_count_at_or_above.grade,
        'gcse'
      )).length >= band.minimum_count_at_or_above.count;

    if (allMinimum && countMinimum) {
      return { value: band.points, band: band.band_id, grades: gcseGrades };
    }
  }

  return {
    value: null,
    band: null,
    grades: gcseGrades,
    reason:
      gcseGrades.length === 5 &&
      component.gcse.subject_count === 8
        ? component.gcse.insufficient_five_subject_evidence_reason_code ||
          'academic_matrix_band_unavailable'
        : 'academic_matrix_band_unavailable'
  };
}

function calculateAcademicProfileALevelBand(component, applicant) {
  const aLevelGrades = getALevelGrades(applicant);
  const values = Object.values(aLevelGrades);
  const astarCount = values.filter((grade) => normaliseGrade(grade) === 'A*').length;

  for (const band of component.a_level.bands) {
    const profilePass = gradeProfileMeets(values, band.minimum_profile);
    const astarPass = astarCount >= (band.minimum_astar_count || 0);
    const subjectPass = !band.subject_minimum_grade ||
      gradeMeets(
        aLevelGrades[band.subject_minimum_grade.subject_id],
        band.subject_minimum_grade.grade,
        'a_level'
      );

    if (profilePass && astarPass && subjectPass) {
      return { value: band.points, band: band.band_id };
    }
  }

  return { value: null, band: null, reason: 'academic_matrix_band_unavailable' };
}

function lowestConfiguredALevelBand(component) {
  return (component.a_level?.bands || [])
    .filter((band) => Number.isFinite(band.points))
    .sort((a, b) => a.points - b.points)[0] || null;
}

function buildAcademicProfileMatrixResult(component, gcse, aLevel) {
  const unboundedValue = gcse.value + aLevel.value;
  const hardCap = Number.isFinite(component.hard_cap) ? component.hard_cap : Infinity;

  return {
    value: clampAcademicScore(unboundedValue, hardCap),
    max: component.max,
    hard_cap_applied: unboundedValue > hardCap,
    components: {
      gcse: { value: gcse.value, band: gcse.band },
      a_level: {
        value: aLevel.value,
        band: aLevel.band,
        reference_band: aLevel.reference_band || null,
        route: aLevel.route || null
      }
    }
  };
}

function subjectMinimumMatches(subjectGrades, rule = {}, level = 'a_level') {
  if (Array.isArray(rule.any_subject_ids)) {
    return rule.any_subject_ids.some((subjectId) => {
      return gradeMeets(subjectGrades[normaliseId(subjectId)], rule.grade, level);
    });
  }

  if (Array.isArray(rule.excluded_subject_ids)) {
    const excluded = new Set(rule.excluded_subject_ids.map(normaliseId));
    return Object.entries(subjectGrades).some(([subjectId, grade]) => {
      return !excluded.has(normaliseId(subjectId)) && gradeMeets(grade, rule.grade, level);
    });
  }

  return gradeMeets(subjectGrades[normaliseId(rule.subject_id)], rule.grade, level);
}

function academicBandMinimumsMatch(grades, band = {}, level = 'a_level') {
  if (band.all_minimum_grade) {
    const countedGrades = grades.slice(0, band.subject_count || grades.length);
    if (
      countedGrades.length < (band.subject_count || 1) ||
      !countedGrades.every((grade) => gradeMeets(grade, band.all_minimum_grade, level))
    ) {
      return false;
    }
  }

  if (band.minimum_count_at_or_above) {
    const minimum = band.minimum_count_at_or_above;
    const matchingCount = grades.filter((grade) => gradeMeets(grade, minimum.grade, level)).length;
    if (matchingCount < minimum.count) {
      return false;
    }
  }

  return true;
}

function calculateScottishNational5Band(component, applicant) {
  const config = component.sqa?.national_5 || component.scottish?.national_5;
  if (!config) {
    return { value: null, band: null, reason: 'academic_matrix_band_unavailable' };
  }

  const grades = getSubjectGrades(applicant.scottish_profile, ['national_5_subjects']);
  const sortedGrades = Object.values(grades)
    .filter((grade) => grade !== null && grade !== undefined && grade !== '')
    .sort((a, b) => gradeRank(b, 'gcse') - gradeRank(a, 'gcse'));
  const subjectCount = config.subject_count || sortedGrades.length;

  for (const band of config.bands || []) {
    const countedGrades = sortedGrades.slice(0, band.subject_count || subjectCount);
    const minimumsPass = academicBandMinimumsMatch(
      countedGrades,
      { ...band, subject_count: band.subject_count || subjectCount },
      'gcse'
    );
    const subjectMinimums = band.subject_minimums || [];
    const subjectsPass = subjectMinimums.every((rule) => {
      return subjectMinimumMatches(grades, rule, 'gcse');
    });

    if (minimumsPass && subjectsPass) {
      return { value: band.points, band: band.band_id, grades: countedGrades };
    }
  }

  return {
    value: null,
    band: null,
    grades: sortedGrades.slice(0, subjectCount),
    reason: 'academic_matrix_band_unavailable'
  };
}

function higherProfileMatches(subjectGrades, profile) {
  return gradeProfileMeets(Object.values(subjectGrades), profile);
}

function calculateScottishHigherAdvancedHigherBand(component, applicant) {
  const config =
    component.sqa?.higher_advanced_higher ||
    component.scottish?.higher_advanced_higher;
  if (!config) {
    return { value: null, band: null, reason: 'academic_matrix_band_unavailable' };
  }

  const profile = applicant.scottish_profile || {};
  const highers = getSubjectGrades(profile, ['higher_subjects']);
  const advancedHighers = getSubjectGrades(profile, ['advanced_higher_subjects']);
  const advancedHigherCount = Object.values(advancedHighers)
    .filter((grade) => grade !== null && grade !== undefined && grade !== '')
    .length;

  for (const band of config.bands || []) {
    const higherProfiles = band.any_higher_profiles || (
      band.higher_profile ? [band.higher_profile] : []
    );
    const higherPass = higherProfiles.length === 0 ||
      higherProfiles.some((profileGrades) => higherProfileMatches(highers, profileGrades));
    const advancedHigherPass = !band.advanced_higher_profile ||
      higherProfileMatches(advancedHighers, band.advanced_higher_profile);
    const maximumAdvancedHigherPass =
      !Number.isFinite(band.maximum_advanced_higher_count) ||
      advancedHigherCount <= band.maximum_advanced_higher_count;
    const subjectMinimums = band.subject_minimums || [];
    const subjectsPass = subjectMinimums.every((rule) => {
      const subjectGrades = rule.field === 'higher_subjects' ? highers : advancedHighers;
      return subjectMinimumMatches(subjectGrades, rule, 'a_level');
    });

    if (higherPass && advancedHigherPass && maximumAdvancedHigherPass && subjectsPass) {
      return { value: band.points, band: band.band_id };
    }
  }

  return { value: null, band: null, reason: 'academic_matrix_band_unavailable' };
}

function lowestConfiguredScottishHigherAdvancedHigherBand(component) {
  const bands =
    component.sqa?.higher_advanced_higher?.bands ||
    component.scottish?.higher_advanced_higher?.bands ||
    [];

  return bands
    .filter((band) => Number.isFinite(band.points))
    .sort((a, b) => a.points - b.points)[0] || null;
}

function academicFallbackRuleMatches(rule = {}, context = {}) {
  const eligibility = context.resolvedEligibility || {};
  if (
    rule.requires_eligibility_status &&
    eligibility.status !== rule.requires_eligibility_status
  ) {
    return false;
  }
  if (
    rule.academic_pathway &&
    eligibility.academic_pathway !== rule.academic_pathway
  ) {
    return false;
  }
  if (
    Array.isArray(rule.academic_pathway_ids) &&
    !rule.academic_pathway_ids.includes(eligibility.academic_pathway_id)
  ) {
    return false;
  }
  if (
    Array.isArray(rule.academic_pathway_id_fragments) &&
    !rule.academic_pathway_id_fragments.some((fragment) =>
      String(eligibility.academic_pathway_id || '').includes(fragment)
    )
  ) {
    return false;
  }
  if (
    Array.isArray(rule.contextual_statuses) &&
    !rule.contextual_statuses.includes(eligibility.contextual_eligibility?.status)
  ) {
    return false;
  }
  if (
    Array.isArray(rule.contextual_levels) &&
    !rule.contextual_levels.includes(eligibility.contextual_eligibility?.contextual_level)
  ) {
    return false;
  }
  if (
    Array.isArray(rule.scottish_medical_school_route_ids) &&
    !rule.scottish_medical_school_route_ids.includes(
      eligibility.scottish_medical_school_route?.route_id
    )
  ) {
    return false;
  }
  if (rule.match && !groupRuleApplies(rule.match, context.groupIds || [])) {
    return false;
  }

  return true;
}

function configuredFallbackBandFromRule(rule = {}, floorBand = null) {
  if (!floorBand) {
    return null;
  }

  return {
    value: floorBand.points,
    band: rule.band_id || floorBand.band_id,
    reference_band: floorBand.band_id,
    route: rule.route_id || rule.band_id || null
  };
}

function calculateConfiguredAcademicFallbackBand(rules = [], floorBand = null, context = {}) {
  const matchedRule = (rules || []).find((rule) => academicFallbackRuleMatches(rule, context));
  return matchedRule ? configuredFallbackBandFromRule(matchedRule, floorBand) : null;
}

function calculateScottishAcademicProfileMatrix(component, applicant, context = {}) {
  const national5 = calculateScottishNational5Band(component, applicant);
  const standardHigherAdvancedHigher = calculateScottishHigherAdvancedHigherBand(component, applicant);
  const higherAdvancedHigherConfig =
    component.sqa?.higher_advanced_higher ||
    component.scottish?.higher_advanced_higher ||
    {};
  const higherAdvancedHigher = Number.isFinite(standardHigherAdvancedHigher.value)
    ? standardHigherAdvancedHigher
    : calculateConfiguredAcademicFallbackBand(
      higherAdvancedHigherConfig.fallback_band_rules,
      lowestConfiguredScottishHigherAdvancedHigherBand(component),
      context
    ) ||
      standardHigherAdvancedHigher;

  if (!Number.isFinite(national5.value) || !Number.isFinite(higherAdvancedHigher.value)) {
    return {
      value: null,
      max: component.max,
      reason:
        national5.reason ||
        higherAdvancedHigher.reason ||
        'academic_matrix_band_unavailable'
    };
  }

  const unboundedValue = national5.value + higherAdvancedHigher.value;
  const hardCap = Number.isFinite(component.hard_cap) ? component.hard_cap : Infinity;

  return {
    value: clampAcademicScore(unboundedValue, hardCap),
    max: component.max,
    hard_cap_applied: unboundedValue > hardCap,
    components: {
      national_5: { value: national5.value, band: national5.band },
      higher_advanced_higher: {
        value: higherAdvancedHigher.value,
        band: higherAdvancedHigher.band,
        reference_band: higherAdvancedHigher.reference_band || null,
        route: higherAdvancedHigher.route || null
      }
    }
  };
}

function calculateAcademicProfileMatrix(component, applicant, context = {}) {
  if (deriveQualificationRoute(applicant) === 'scottish' && (component.sqa || component.scottish)) {
    return calculateScottishAcademicProfileMatrix(component, applicant, context);
  }

  const gcse = calculateAcademicProfileGcseBand(component, applicant);
  const standardALevel = calculateAcademicProfileALevelBand(component, applicant);
  const aLevel = Number.isFinite(standardALevel.value)
    ? standardALevel
    : calculateConfiguredAcademicFallbackBand(
      component.a_level?.fallback_band_rules,
      lowestConfiguredALevelBand(component),
      context
    ) || standardALevel;

  if (!Number.isFinite(gcse.value) || !Number.isFinite(aLevel.value)) {
    return {
      value: null,
      max: component.max,
      reason: gcse.reason || aLevel.reason || 'academic_matrix_band_unavailable'
    };
  }

  return buildAcademicProfileMatrixResult(component, gcse, aLevel);
}

function schoolLeaverScottishProfile(applicant = {}) {
  const profile = applicant.scottish_profile || {};
  const legacy = applicant.scottish_qualifications || {};
  return {
    national_5_subjects: profile.national_5_subjects || legacy.national_5s || [],
    higher_subjects: profile.higher_subjects || legacy.highers || [],
    advanced_higher_subjects: profile.advanced_higher_subjects || legacy.advanced_highers || []
  };
}

function qualificationSubjectMap(subjects = []) {
  return Object.fromEntries(
    (subjects || [])
      .filter((subject) => subject?.subject_id)
      .map((subject) => [
        normaliseId(subject.subject_id),
        subject.grade ?? subject.predicted_grade ?? subject.achieved_grade
      ])
  );
}

function schoolLeaverScottishNational5Estimate(profile, component, eligibility) {
  const grades = qualificationSubjectMap(profile.national_5_subjects);
  const values = Object.values(grades).filter((grade) => grade !== null && grade !== undefined && grade !== '');
  const minimumCount = component.scottish_academic?.national_5_minimum_count ?? 5;
  const scienceIds = component.scottish_academic?.national_5_science_subject_ids || ['biology', 'chemistry'];
  const scienceStrong = scienceIds.every((subjectId) => {
    return gradeMeets(grades[normaliseId(subjectId)], 'A', 'gcse');
  });
  const allA = values.length >= minimumCount &&
    values.every((grade) => gradeMeets(grade, 'A', 'gcse'));
  const majorityA = values.length >= minimumCount &&
    values.filter((grade) => gradeMeets(grade, 'A', 'gcse')).length >= Math.ceil(values.length / 2) &&
    values.every((grade) => gradeMeets(grade, 'B', 'gcse'));

  if (allA && scienceStrong) {
    return { value: 30, band: 'all_presented_national_5s_grade_a' };
  }
  if (majorityA && scienceStrong) {
    return { value: 20, band: 'majority_grade_a_with_minor_b_profile' };
  }
  if (eligibility?.status === 'eligible') {
    return { value: 20, band: 'eligible_national_5_profile_estimate' };
  }
  return { value: 0, band: 'national_5_strength_unavailable_or_below_predictor_floor' };
}

function schoolLeaverRouteMatchApplies(rule = {}, eligibility = {}) {
  const pathway = String(eligibility?.academic_pathway || '');
  const pathwayId = String(eligibility?.academic_pathway_id || '');
  if (
    rule.requires_eligibility_status &&
    eligibility?.status !== rule.requires_eligibility_status
  ) {
    return false;
  }
  if (
    Array.isArray(rule.academic_pathways) &&
    !rule.academic_pathways.includes(pathway)
  ) {
    return false;
  }
  if (
    Array.isArray(rule.academic_pathway_ids) &&
    !rule.academic_pathway_ids.includes(pathwayId)
  ) {
    return false;
  }
  if (
    Array.isArray(rule.academic_pathway_id_fragments) &&
    !rule.academic_pathway_id_fragments.some((fragment) => pathwayId.includes(fragment))
  ) {
    return false;
  }
  if (
    Array.isArray(rule.contextual_levels) &&
    !rule.contextual_levels.includes(eligibility?.contextual_eligibility?.contextual_level)
  ) {
    return false;
  }

  return true;
}

function schoolLeaverScottishHigherEstimate(profile, component, eligibility) {
  const routeMatch = component.scottish_academic?.confirmed_higher_route_match || {
    requires_eligibility_status: 'eligible',
    academic_pathways: ['standard', 'contextual']
  };
  const contextualRouteMatch =
    component.scottish_academic?.contextual_higher_route_match || {
      academic_pathways: ['contextual']
    };
  if (
    schoolLeaverRouteMatchApplies(routeMatch, eligibility)
  ) {
    return {
      value: 30,
      band: schoolLeaverRouteMatchApplies(contextualRouteMatch, eligibility)
        ? 'confirmed_contextual_route'
        : 'confirmed_standard_route'
    };
  }

  const grades = Object.values(qualificationSubjectMap(profile.higher_subjects));
  const standardProfiles = component.scottish_academic?.standard_higher_profiles || [['A', 'A', 'A', 'A', 'B']];
  const contextualProfiles = component.scottish_academic?.contextual_higher_profiles || [['A', 'A', 'A', 'B', 'B']];
  const profilePassed = [...standardProfiles, ...contextualProfiles].some((gradeProfile) => {
    return gradeProfileMeets(grades, gradeProfile);
  });

  return profilePassed
    ? { value: 30, band: 'higher_profile_strength_estimate' }
    : { value: 0, band: 'higher_strength_unavailable_or_below_predictor_floor' };
}

function confirmedConfiguredContextualALevelRoute(component, eligibility) {
  const rule = component.ruk_academic_profile_matrix?.contextual_route_match || {
    requires_eligibility_status: 'eligible',
    academic_pathways: ['contextual']
  };
  return schoolLeaverRouteMatchApplies(rule, eligibility);
}

function schoolLeaverALevelAcademicProfileEstimate(component, applicant, eligibility) {
  const matrix = calculateAcademicProfileMatrix(component.ruk_academic_profile_matrix, applicant);
  if (Number.isFinite(matrix.value)) {
    return {
      ...matrix,
      route: 'ruk_applysmart_academic_strength_estimate'
    };
  }

  if (!confirmedConfiguredContextualALevelRoute(component, eligibility)) {
    return {
      ...matrix,
      route: 'ruk_applysmart_academic_strength_estimate'
    };
  }

  const matrixConfig = component.ruk_academic_profile_matrix;
  const gcse = calculateAcademicProfileGcseBand(matrixConfig, applicant);
  if (!Number.isFinite(gcse.value)) {
    return {
      ...matrix,
      reason: gcse.reason || matrix.reason || 'academic_matrix_band_unavailable',
      route: 'ruk_applysmart_academic_strength_estimate'
    };
  }

  const confirmedRoutePoints = Math.max(
    ...matrixConfig.a_level.bands
      .map((band) => Number(band.points))
      .filter(Number.isFinite),
    30
  );
  const contextualAlevel = {
    value: confirmedRoutePoints,
    band: 'confirmed_contextual_route'
  };

  return {
    ...buildAcademicProfileMatrixResult(matrixConfig, gcse, contextualAlevel),
    route: 'ruk_contextual_applysmart_academic_strength_estimate',
    official: false,
    evidence_label: component.evidence_label || 'applysmart_derived_guidance',
    assumption_note: matrixConfig.contextual_route_assumption_note || null
  };
}

function configuredUcatBenchmarkKey(component, groupIds = [], eligibility = {}) {
  for (const route of component.ucat_competitiveness_proxy?.benchmark_routing || []) {
    if (!groupRuleApplies(route.match || route, groupIds)) {
      continue;
    }
    if (
      Array.isArray(route.contextual_categories) &&
      !route.contextual_categories.includes(
        eligibility.contextual_eligibility?.contextual_category
      )
    ) {
      continue;
    }
    if (
      Array.isArray(route.contextual_levels) &&
      !route.contextual_levels.includes(
        eligibility.contextual_eligibility?.contextual_level
      )
    ) {
      continue;
    }
    return route.benchmark_key;
  }

  return null;
}

function schoolLeaverUcatCompetitivenessEstimate(component, applicant, context) {
  const score = applicant.admissions_tests?.ucat?.total_score;
  if (!Number.isFinite(score)) {
    return { value: null, max: 40, reason: 'ucat_total_unavailable' };
  }

  const benchmarkKey = configuredUcatBenchmarkKey(
    component,
    context.groupIds || [],
    context.resolvedEligibility || {}
  );
  const benchmarks = component.ucat_competitiveness_proxy?.benchmarks || {};
  const benchmark = benchmarks[benchmarkKey] || null;
  if (!benchmark) {
    return {
      value: null,
      max: 40,
      reason: component.ucat_competitiveness_proxy?.unavailable_reason_code ||
        'ucat_proxy_unavailable'
    };
  }

  const veryStrong = benchmark.very_strong;
  const strong = benchmark.strong;
  const minimum = benchmark.minimum_competitive;
  const nearMinimum = Number.isFinite(minimum)
    ? minimum - (component.ucat_competitiveness_proxy?.near_minimum_margin || 150)
    : null;
  let value = 12;
  let band = 'below_proxy_range';
  if (Number.isFinite(veryStrong) && score >= veryStrong) {
    value = 40;
    band = 'very_strong_proxy';
  } else if (Number.isFinite(strong) && score >= strong) {
    value = 34;
    band = 'strong_proxy';
  } else if (Number.isFinite(minimum) && score >= minimum) {
    value = 28;
    band = 'minimum_competitive_proxy';
  } else if (Number.isFinite(nearMinimum) && score >= nearMinimum) {
    value = 20;
    band = 'near_minimum_proxy';
  }

  return {
    value,
    max: 40,
    raw_value: score,
    benchmark_key: benchmarkKey,
    proxy_band: band,
    source: benchmark.source || component.ucat_competitiveness_proxy?.source || null
  };
}

function calculateSchoolLeaverAcademicUcatGuidanceIndex(component, applicant, context) {
  const groups = new Set(context.groupIds || []);
  if (!groups.has('home_fee') || !groups.has('school_leaver') || groups.has('international_fee')) {
    return {
      value: 0,
      max: 0,
      applicable: false,
      reason: 'component_not_applicable_for_applicant_group'
    };
  }

  const route = deriveQualificationRoute(applicant);
  const isScottishAcademicRoute = route === 'scottish';
  const isAlevelAcademicRoute = route === 'a_level' || route === 'alevel';
  let academicComponent;

  if (isScottishAcademicRoute) {
    const profile = schoolLeaverScottishProfile(applicant);
    const national5 = schoolLeaverScottishNational5Estimate(profile, component, context.resolvedEligibility);
    const higher = schoolLeaverScottishHigherEstimate(profile, component, context.resolvedEligibility);
    academicComponent = {
      value: national5.value + higher.value,
      max: 60,
      route: 'scottish_applysmart_academic_strength_estimate',
      components: {
        national_5: national5,
        higher: higher
      }
    };
  } else if (isAlevelAcademicRoute) {
    academicComponent = schoolLeaverALevelAcademicProfileEstimate(
      component,
      applicant,
      context.resolvedEligibility
    );
  } else {
    return {
      value: null,
      max: component.max ?? 100,
      reason: component.unsupported_route_reason_code || 'school_leaver_pool_unavailable'
    };
  }

  const ucatComponent = schoolLeaverUcatCompetitivenessEstimate(component, applicant, context);
  if (!Number.isFinite(academicComponent.value) || !Number.isFinite(ucatComponent.value)) {
    return {
      value: null,
      max: component.max ?? 100,
      reason: academicComponent.reason ||
        ucatComponent.reason ||
        component.inputs_unavailable_reason_code ||
        'school_leaver_guidance_inputs_unavailable',
      components: {
        academic: academicComponent,
        ucat: ucatComponent
      }
    };
  }

  return {
    value: round(academicComponent.value + ucatComponent.value),
    max: component.max ?? 100,
    route: isScottishAcademicRoute
      ? 'scottish_school_leaver_applysmart_guidance'
      : 'a_level_school_leaver_applysmart_guidance',
    official: false,
    components: {
      academic: academicComponent,
      ucat: ucatComponent
    }
  };
}

function rangeDistance(value, range) {
  if (value < range.min) {
    return range.min - value;
  }
  if (value > range.max) {
    return value - range.max;
  }
  return 0;
}

function componentUcatScore(component, applicant, context = {}) {
  if (
    component.score_source === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_SOURCE ||
    component.input_metric === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_SOURCE
  ) {
    const adjustedScore = Number(
      context.resolvedEligibility?.contextual_eligibility?.adjusted_selection_ucat?.adjusted_ucat
    );
    if (Number.isFinite(adjustedScore)) {
      return adjustedScore;
    }
  }
  return applicant.admissions_tests?.ucat?.total_score;
}

function calculateRangeLookup(component, applicant, context = {}) {
  const score = componentUcatScore(component, applicant, context);
  if (!Number.isFinite(score)) {
    return { value: null, max: component.max, reason: 'ucat_total_unavailable' };
  }

  let selected = (component.ranges || []).find((range) => score >= range.min && score <= range.max);
  let estimatedFromGap = false;

  if (!selected && component.gap_policy === 'nearest_range') {
    selected = [...component.ranges].sort((a, b) => rangeDistance(score, a) - rangeDistance(score, b))[0];
    estimatedFromGap = Boolean(selected);
  }

  const value = selected ? component.points_by_band?.[selected.band] : null;
  return {
    value: Number.isFinite(value) ? value : null,
    max: component.max,
    band: selected?.band ?? null,
    estimated_from_gap: estimatedFromGap,
    reason: Number.isFinite(value) ? null : 'range_lookup_unavailable'
  };
}

function calculateSjtLookup(component, applicant) {
  const band = applicant.admissions_tests?.ucat?.sjt_band;
  const value = component.points_by_band?.[band];
  return {
    value: Number.isFinite(value) ? value : null,
    max: component.max,
    band,
    reason: Number.isFinite(value) ? null : 'sjt_points_unavailable'
  };
}

function calculateUcatExactScoreTableLookup(component, applicant) {
  const score = applicant.admissions_tests?.ucat?.total_score;
  if (!Number.isFinite(score)) {
    return { value: null, max: component.max, reason: 'ucat_total_unavailable' };
  }

  const stepSize = component.exact_step_size;
  if (
    Number.isFinite(stepSize) &&
    stepSize > 0 &&
    score % stepSize !== 0
  ) {
    return {
      value: null,
      max: component.max,
      reason: `ucat_score_not_on_exact_table_step:${score}:${stepSize}`
    };
  }

  const directValue = component.points_by_score?.[String(score)];
  if (Number.isFinite(directValue)) {
    return { value: directValue, max: component.max, table_score: score };
  }

  const upper = component.upper_or_equal;
  if (upper && Number.isFinite(upper.score) && score >= upper.score) {
    return { value: upper.points, max: component.max, table_score: upper.score };
  }

  const lower = component.lower_or_equal;
  if (lower && Number.isFinite(lower.score) && score <= lower.score) {
    return { value: lower.points, max: component.max, table_score: lower.score };
  }

  return {
    value: null,
    max: component.max,
    reason: `ucat_exact_table_score_not_found:${score}`
  };
}

function calculateDegreeClassificationPoints(component, applicant) {
  const profile = applicant.graduate_profile || {};
  const classification = normaliseId(profile.degree_classification || profile.classification);
  const value = component.points_by_classification?.[classification];
  return {
    value: Number.isFinite(value) ? value : null,
    max: component.max,
    classification,
    reason: Number.isFinite(value) ? null : 'degree_classification_points_unavailable'
  };
}

function calculateUcatTotalWithPercentageUplifts(component, applicant, context) {
  const rawScore = applicant.admissions_tests?.ucat?.total_score;
  if (!Number.isFinite(rawScore)) {
    return {
      value: null,
      max: component.max ?? component.output_max ?? 2700,
      reason: 'ucat_total_unavailable'
    };
  }

  const matchedStackableUplifts = (component.uplifts || [])
    .filter((uplift) => conditionalRuleApplies(uplift, applicant, context))
    .map((uplift) => ({
      uplift_id: uplift.uplift_id,
      label: uplift.label,
      percent: Number(uplift.percent) || 0,
      stacking: 'stackable'
    }));
  const suppressedUplifts = [];
  const exclusiveUplifts = [];

  for (const group of component.exclusive_uplift_groups || []) {
    const matched = (group.uplifts || [])
      .filter((uplift) => conditionalRuleApplies(uplift, applicant, context));
    if (matched.length === 0) {
      continue;
    }

    const ordered = group.selection_strategy === 'highest_percent'
      ? [...matched].sort((a, b) => (Number(b.percent) || 0) - (Number(a.percent) || 0))
      : matched;
    const selected = ordered[0];
    exclusiveUplifts.push({
      uplift_id: selected.uplift_id,
      label: selected.label,
      percent: Number(selected.percent) || 0,
      stacking: 'exclusive_group',
      exclusive_group_id: group.group_id
    });

    for (const uplift of matched) {
      if (uplift === selected) {
        continue;
      }
      suppressedUplifts.push({
        uplift_id: uplift.uplift_id,
        label: uplift.label,
        percent: Number(uplift.percent) || 0,
        exclusive_group_id: group.group_id,
        suppressed_by_uplift_id: selected.uplift_id
      });
    }
  }

  const appliedUplifts = [...matchedStackableUplifts, ...exclusiveUplifts];
  const totalPercent = appliedUplifts.reduce((total, uplift) => total + uplift.percent, 0);

  return {
    value: round(rawScore * (1 + totalPercent / 100)),
    raw_value: rawScore,
    max: component.max ?? component.output_max ?? 2700,
    applied_uplifts: appliedUplifts,
    suppressed_uplifts: suppressedUplifts,
    total_uplift_percent: round(totalPercent, 3)
  };
}


function resolveContextualAdjustedSelectionUcat(applicant, context = {}) {
  const rawScore = applicant.admissions_tests?.ucat?.total_score;
  const max = applicant.admissions_tests?.ucat?.score_scale ?? 2700;
  if (!Number.isFinite(rawScore)) {
    return {
      value: null,
      raw_value: null,
      max,
      reason: 'ucat_total_unavailable'
    };
  }

  const contextual = context.resolvedEligibility?.contextual_eligibility || {};
  const adjusted = contextual.adjusted_selection_ucat;
  const adjustedScore = Number(adjusted?.adjusted_ucat);
  const upliftPercent = Number(adjusted?.uplift_percent ?? contextual.ucat_uplift_percent);
  if (Number.isFinite(adjustedScore) && Number.isFinite(upliftPercent) && upliftPercent > 0) {
    return {
      value: adjustedScore,
      raw_value: Number.isFinite(Number(adjusted.raw_ucat)) ? Number(adjusted.raw_ucat) : rawScore,
      max,
      total_uplift_percent: upliftPercent,
      applied_uplift: {
        reason: adjusted.reason || contextual.ucat_uplift_reason || null,
        reason_label: adjusted.reason_label || null,
        percent: upliftPercent
      }
    };
  }

  if (Number.isFinite(upliftPercent) && upliftPercent > 0) {
    return {
      value: Math.round(rawScore * (1 + upliftPercent / 100)),
      raw_value: rawScore,
      max,
      total_uplift_percent: upliftPercent,
      applied_uplift: {
        reason: contextual.ucat_uplift_reason || null,
        reason_label: null,
        percent: upliftPercent
      }
    };
  }

  return {
    value: rawScore,
    raw_value: rawScore,
    max,
    total_uplift_percent: 0,
    applied_uplift: null
  };
}

function gradeIsInExamYear(subject, examYears = []) {
  const year = Number(subject.exam_year ?? subject.year ?? subject.sitting_year);
  return Number.isInteger(year) && examYears.includes(year);
}

function expandedGcseGradeEntries(applicant) {
  const entries = [];
  const profile = applicant.gcse_profile || {};

  for (const [subjectId, grade] of Object.entries(profile.subjects || {})) {
    if (grade === null || grade === undefined || grade === '') {
      continue;
    }
    const examYear = profile.subject_exam_years?.[subjectId] ??
      profile.exam_years_by_subject?.[subjectId] ??
      profile.exam_year;
    for (const expandedGrade of splitGradeProfile(grade)) {
      entries.push({ subject_id: subjectId, grade: expandedGrade, exam_year: examYear });
    }
  }

  for (const subject of profile.additional_subjects || []) {
    if (!subject?.subject_id || subject.grade === null || subject.grade === undefined) {
      continue;
    }
    for (const expandedGrade of splitGradeProfile(subject.grade)) {
      entries.push({
        subject_id: subject.subject_id,
        grade: expandedGrade,
        exam_year: subject.exam_year ?? subject.year ?? subject.sitting_year
      });
    }
  }

  if (entries.length === 0) {
    return (profile.top_9_gcse_grades || [])
      .flatMap((grade) => splitGradeProfile(grade))
      .map((grade) => ({ subject_id: null, grade, exam_year: profile.exam_year }));
  }

  return entries;
}

function shouldUseUcatOnlyGcseException(component, applicant, gcseEntries) {
  const profile = applicant.gcse_profile || {};
  const policy = component.gcse_exception_policy || {};
  const covidYears = policy.covid_exam_years || [];
  const rawReportedCount = profile.total_gcse_count;
  const reportedCount = rawReportedCount === null || rawReportedCount === undefined || rawReportedCount === ''
    ? NaN
    : Number(rawReportedCount);
  const usableCount = gcseEntries.length;
  const countForPolicy = Number.isFinite(reportedCount) ? reportedCount : usableCount;
  const majorityCovidFlag =
    profile.majority_completed_between_summer_2020_and_summer_2021 === true ||
    profile.majority_covid_teacher_assessed === true ||
    profile.covid_gcse_cohort === true;
  const covidCount = gcseEntries.filter((entry) => gradeIsInExamYear(entry, covidYears)).length;
  const majorityCovidByEntries = usableCount > 0 && covidCount / usableCount > 0.5;

  return (
    Number.isFinite(policy.minimum_gcse_count_for_systematic_gcse_use) &&
    countForPolicy <= policy.minimum_gcse_count_for_systematic_gcse_use
  ) || majorityCovidFlag || majorityCovidByEntries;
}

function calculateGcseUcatWeightedComposite(component, applicant) {
  const rawUcat = applicant.admissions_tests?.ucat?.total_score;
  if (!Number.isFinite(rawUcat)) {
    return { value: null, max: component.max, reason: 'ucat_total_unavailable' };
  }

  const ucat = component.ucat || {};
  const ucatInputMax = ucat.input_max ?? 2700;
  const ucatOutputMax = ucat.output_max ?? 50;
  const ucatScore = (rawUcat / ucatInputMax) * ucatOutputMax;
  const gcse = component.gcse || {};
  const allGcseEntries = expandedGcseGradeEntries(applicant);
  const excludedYears = new Set(gcse.exclude_exam_years || []);
  const countedGcseEntries = allGcseEntries.filter((entry) => {
    const year = Number(entry.exam_year);
    return !Number.isInteger(year) || !excludedYears.has(year);
  });
  const useUcatOnly = shouldUseUcatOnlyGcseException(component, applicant, allGcseEntries);

  if (useUcatOnly) {
    return {
      value: round((rawUcat / ucatInputMax) * (component.max ?? 100)),
      max: component.max ?? 100,
      route: 'ucat_double_weighted',
      components: {
        ucat: {
          value: round((rawUcat / ucatInputMax) * (component.max ?? 100)),
          raw_value: rawUcat,
          max: component.max ?? 100,
          input_max: ucatInputMax
        },
        gcse: {
          value: 0,
          raw_value: null,
          max: 0,
          route: 'not_used_official_exception'
        }
      },
      confidence_override: component.gcse_exception_policy?.confidence || 'medium'
    };
  }

  if (countedGcseEntries.length === 0) {
    return { value: null, max: component.max ?? 100, reason: 'usable_gcse_profile_unavailable' };
  }

  const topGradeMinimum = gcse.top_grade_minimum || '8';
  const topGradeCount = countedGcseEntries.filter((entry) => {
    return gradeMeets(entry.grade, topGradeMinimum, 'gcse');
  }).length;
  const topGradeProportion = topGradeCount / countedGcseEntries.length;
  const countReference = gcse.count_reference ?? countedGcseEntries.length;
  const countScore = Math.min(1, topGradeCount / countReference) * 100;
  const proportionScore = topGradeProportion * 100;
  const rawGcseScore = (
    (gcse.count_weight_percent ?? 50) * countScore +
    (gcse.proportion_weight_percent ?? 50) * proportionScore
  ) / 100;

  const schoolContext = applicant.school_context || applicant.applicant_identity?.school_context || {};
  const hasSchoolContext = schoolContext.attainment_8_available === true ||
    Number.isFinite(Number(schoolContext.attainment_8_score));
  const contextual = component.contextual_adjustment || {};
  const attainment8 = Number(schoolContext.attainment_8_score);
  const baseline = contextual.national_attainment_8_baseline;
  const pointPerUnit = contextual.points_per_attainment8_point_below_baseline ?? 0;
  const adjustmentCap = contextual.max_adjustment_points ?? 0;
  const rawContextualAdjustment =
    hasSchoolContext && Number.isFinite(attainment8) && Number.isFinite(baseline)
      ? (baseline - attainment8) * pointPerUnit
      : 0;
  const contextualAdjustment = Math.max(
    -adjustmentCap,
    Math.min(adjustmentCap, rawContextualAdjustment)
  );
  const fallbackPenalty = hasSchoolContext ? 0 : (gcse.missing_school_context_penalty_points ?? 0);
  const adjustedGcseScore = Math.max(0, Math.min(100, rawGcseScore + contextualAdjustment - fallbackPenalty));
  const gcseOutputMax = gcse.output_max ?? 50;
  const gcseScore = (adjustedGcseScore / 100) * gcseOutputMax;
  const value = ucatScore + gcseScore;

  return {
    value: round(value, component.rounding_places ?? 2),
    max: component.max ?? 100,
    route: hasSchoolContext ? 'contextualised_gcse_plus_ucat' : 'raw_gcse_fallback_plus_ucat',
    components: {
      ucat: {
        value: round(ucatScore, component.rounding_places ?? 2),
        raw_value: rawUcat,
        max: ucatOutputMax,
        input_max: ucatInputMax
      },
      gcse: {
        value: round(gcseScore, component.rounding_places ?? 2),
        raw_value: round(adjustedGcseScore, component.rounding_places ?? 2),
        max: gcseOutputMax,
        top_grade_count: topGradeCount,
        top_grade_proportion: round(topGradeProportion, 4),
        grades_counted: countedGcseEntries.length,
        raw_score: round(rawGcseScore, component.rounding_places ?? 2),
        contextual_adjustment: round(contextualAdjustment, component.rounding_places ?? 2),
        missing_school_context_penalty: fallbackPenalty,
        school_context_available: hasSchoolContext
      }
    }
  };
}

function conditionalRuleApplies(rule, applicant, context) {
  return groupRuleApplies(rule.match || rule, context.groupIds || []) &&
    matchQualificationStatus(rule.match || rule, applicant);
}

function calculateConditionalPoints(component, applicant, context) {
  const matched = (component.conditions || [])
    .filter((rule) => conditionalRuleApplies(rule, applicant, context));
  const value = matched.reduce((total, rule) => total + (Number(rule.points) || 0), 0);
  const max = Number.isFinite(component.max)
    ? component.max
    : Math.max(0, ...(component.conditions || []).map((rule) => Number(rule.points) || 0));

  return {
    value,
    max,
    applied_conditions: matched.map((rule) => rule.condition_id).filter(Boolean),
    qualification_status: deriveQualificationStatus(applicant)
  };
}

function classifyLeedsAcademicBand(score, bands = []) {
  return (bands || []).find((band) => {
    const min = Number.isFinite(band.min) ? band.min : -Infinity;
    const max = Number.isFinite(band.max) ? band.max : Infinity;
    return Number.isFinite(score) && score >= min && score <= max;
  })?.band_id || null;
}

function classifyLeedsUcatPosition(score, positions = []) {
  return (positions || []).find((position) => {
    if (position.operator === 'less_than') {
      return score < position.value;
    }
    if (position.operator === 'greater_than_or_equal') {
      return score >= position.value;
    }
    if (position.operator === 'between_inclusive') {
      return score >= position.min && score <= position.max;
    }
    return false;
  })?.position_id || null;
}

function calculateGcseProfileModifier(component, applicant) {
  const grades = expandedGcseGrades(applicant);
  if (grades.length === 0) {
    return {
      value: null,
      max: component.max ?? 0,
      reason: 'gcse_profile_unavailable'
    };
  }

  const topGradeMinimum = component.top_grade_minimum || '8';
  const strongMinimumCount = component.strong?.minimum_top_grade_count ?? 8;
  const strongNoBelow = component.strong?.no_grade_below || '7';
  const moderateMinimumTopCount = component.moderate?.minimum_top_grade_count ?? 5;
  const moderateMaximumTopCount = component.moderate?.maximum_top_grade_count ?? 7;
  const moderateSingleLowGrade = component.moderate?.single_low_grade || '6';
  const moderateNoBelow = component.moderate?.no_grade_below || '6';
  const weakAnyAtOrBelow = component.weak?.any_grade_at_or_below || '5';
  const weakLowGradeAtOrBelow = component.weak?.low_grade_at_or_below || '6';
  const weakLowGradeCount = component.weak?.low_grade_count ?? 2;

  const topGradeCount = grades.filter((grade) => gradeMeets(grade, topGradeMinimum, 'gcse')).length;
  const belowStrongCount = grades.filter((grade) => !gradeMeets(grade, strongNoBelow, 'gcse')).length;
  const belowModerateCount = grades.filter((grade) => !gradeMeets(grade, moderateNoBelow, 'gcse')).length;
  const exactModerateLowGradeCount = grades.filter((grade) => {
    return gradeRank(grade, 'gcse') === gradeRank(moderateSingleLowGrade, 'gcse');
  }).length;
  const weakLowGradeCountActual = grades.filter((grade) => {
    return gradeRank(grade, 'gcse') <= gradeRank(weakLowGradeAtOrBelow, 'gcse');
  }).length;
  const anyWeakGrade = grades.some((grade) => {
    return gradeRank(grade, 'gcse') <= gradeRank(weakAnyAtOrBelow, 'gcse');
  });

  let profileClass = 'weak';
  let value = component.weak?.points ?? component.weak?.adjustment ?? -2;
  if (topGradeCount >= strongMinimumCount && belowStrongCount === 0) {
    profileClass = 'strong';
    value = component.strong?.points ?? component.strong?.adjustment ?? 0;
  } else if (
    belowModerateCount === 0 &&
    (
      (topGradeCount >= moderateMinimumTopCount && topGradeCount <= moderateMaximumTopCount) ||
      exactModerateLowGradeCount === 1
    ) &&
    !anyWeakGrade &&
    weakLowGradeCountActual < weakLowGradeCount
  ) {
    profileClass = 'moderate';
    value = component.moderate?.points ?? component.moderate?.adjustment ?? -1;
  }

  return {
    value,
    max: component.max ?? 0,
    profile_class: profileClass,
    top_grade_count: topGradeCount,
    grades_counted: grades.length
  };
}

function calculateAcademicUcatCompensationMatrix(component, applicant) {
  const gcseComponent = calculateGcseMandatoryThenBest(component.gcse, applicant);
  const aLevelGrades = Object.values(getALevelGrades(applicant));
  const aLevelPassed = gradeProfileMeets(aLevelGrades, component.a_level?.minimum_profile || []);
  const aLevelPoints = aLevelPassed ? component.a_level?.points : null;
  const ucatScore = applicant.admissions_tests?.ucat?.total_score;

  if (!Number.isFinite(gcseComponent.value) || !Number.isFinite(aLevelPoints)) {
    return {
      value: null,
      max: component.max,
      reason: gcseComponent.reason || 'academic_compensation_inputs_unavailable',
      missing_information: gcseComponent.missing_information || null,
      component_reasons: {
        gcse: gcseComponent.reason || null,
        a_level: Number.isFinite(aLevelPoints) ? null : 'a_level_compensation_input_unavailable'
      }
    };
  }
  if (!Number.isFinite(ucatScore)) {
    return {
      value: null,
      max: component.max,
      reason: 'ucat_total_unavailable'
    };
  }

  const academicScore = gcseComponent.value + aLevelPoints;
  const academicBand = classifyLeedsAcademicBand(
    academicScore,
    component.academic_bands
  );
  const ucatPosition = classifyLeedsUcatPosition(
    ucatScore,
    component.ucat_positions
  );
  const matrixKey = `${academicBand}:${ucatPosition}`;
  const result = component.matrix?.[matrixKey] || component.default_result;

  return {
    value: Number.isFinite(result?.points) ? result.points : null,
    max: component.max,
    public_band: result?.band || null,
    internal: {
      academic_score: academicScore,
      academic_band: academicBand,
      ucat_position: ucatPosition,
      gcse_score: gcseComponent.value,
      a_level_score: aLevelPoints
    },
    reason: Number.isFinite(result?.points) ? null : 'academic_ucat_matrix_result_unavailable'
  };
}

function calculateComponent(component, applicant, context) {
  if (component.match && !conditionalRuleApplies(component, applicant, context)) {
    return {
      value: 0,
      max: 0,
      applicable: false,
      reason: 'component_not_applicable_for_applicant_group'
    };
  }

  const calculators = {
    a_level_grade_points_scaled: calculateALevelGradePoints,
    ucat_national_decile_lookup: calculateNationalDecileLookup,
    gcse_mandatory_then_best: calculateGcseMandatoryThenBest,
    scottish_academic_score: calculateAstonScottishAcademicScore,
    qualification_presence: calculateQualificationPresence,
    academic_profile_matrix: calculateAcademicProfileMatrix,
    ucat_range_lookup: calculateRangeLookup,
    ucat_exact_score_table_lookup: calculateUcatExactScoreTableLookup,
    sjt_band_lookup: calculateSjtLookup,
    degree_classification_points: calculateDegreeClassificationPoints,
    conditional_points: calculateConditionalPoints,
    gcse_profile_modifier: calculateGcseProfileModifier,
    academic_ucat_compensation_matrix: calculateAcademicUcatCompensationMatrix,
    ucat_total_with_percentage_uplifts: calculateUcatTotalWithPercentageUplifts,
    gcse_ucat_weighted_composite: calculateGcseUcatWeightedComposite,
    school_leaver_academic_ucat_guidance_index: calculateSchoolLeaverAcademicUcatGuidanceIndex
  };
  const calculator = calculators[component.type];

  return calculator
    ? calculator(component, applicant, context)
    : { value: null, max: component.max, reason: `unsupported_component_type:${component.type}` };
}

function configuredComponentMax(component, calculatedComponent) {
  return calculatedComponent?.max ?? component.output_max ?? component.max ?? 0;
}

function calculateApplicableMaxScore(model, components, applicant, context) {
  if (
    model?.applicable_max_score?.strategy !== 'base_plus_applicable_conditional_components'
  ) {
    return null;
  }

  return round((model.components || []).reduce((total, component) => {
    const calculated = components[component.component_id];
    if (component.type !== 'conditional_points') {
      return total + (Number(configuredComponentMax(component, calculated)) || 0);
    }

    const applicableConditions = (component.conditions || [])
      .filter((rule) => conditionalRuleApplies(rule, applicant, context));
    return total + applicableConditions.reduce(
      (subtotal, rule) => subtotal + (Number(rule.points) || 0),
      0
    );
  }, 0));
}

function calculateScore(config, applicant, context) {
  const model = config.score_model;
  if (!model) {
    return null;
  }
  if (
    (
      Array.isArray(model.applies_to_group_ids) ||
      Array.isArray(model.all_group_ids) ||
      Array.isArray(model.any_group_ids) ||
      Array.isArray(model.excluded_group_ids)
    ) &&
    !groupRuleApplies(model, context?.groupIds || [])
  ) {
    return null;
  }

  if (model.type === 'ranking_metric') {
    let value = null;
    if (model.metric === 'ucat_total') {
      value = applicant.admissions_tests?.ucat?.total_score;
    } else if (model.metric === 'ucat_national_percentile') {
      value = resolveUcatNationalPercentile(applicant, model.percentile_estimator);
    }
    return {
      status: Number.isFinite(value) ? 'calculated' : 'unavailable',
      basis: model.basis,
      value: Number.isFinite(value) ? value : null,
      max: model.scale?.max ?? null,
      components: {}
    };
  }

  if (model.type !== 'component_sum') {
    return null;
  }

  const components = {};
  for (const component of model.components || []) {
    components[component.component_id] = calculateComponent(component, applicant, context);
  }

  const values = Object.values(components).map((component) => component.value);
  const available = values.length > 0 && values.every(Number.isFinite);
  const applicableMaxScore = calculateApplicableMaxScore(model, components, applicant, context);
  const max = Number.isFinite(applicableMaxScore)
    ? applicableMaxScore
    : model.scale?.max ?? null;
  const rawValue = available ? round(values.reduce((total, value) => total + value, 0)) : null;
  const selectionScoreCap = Number(model.selection_score_cap);
  const cappedValue = available && Number.isFinite(selectionScoreCap)
    ? Math.min(rawValue, selectionScoreCap)
    : rawValue;

  const ranking = {
    status: available ? 'calculated' : 'unavailable',
    basis: model.basis,
    value: cappedValue,
    max,
    components
  };

  if (available && Number.isFinite(selectionScoreCap)) {
    ranking.uncapped_value = rawValue;
    ranking.selection_score_cap = selectionScoreCap;
    ranking.cap_applied = rawValue > selectionScoreCap;
  }

  if (Number.isFinite(applicableMaxScore)) {
    ranking.applicable_max_score = applicableMaxScore;
    ranking.selection_score_max = applicableMaxScore;
    ranking.global_max = model.scale?.max ?? null;
  }

  return ranking;
}

function calculatePoolRanking(config, pool, applicant, context) {
  if (
    ![
      'ucat_total',
      'gamsat_total',
      CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC
    ].includes(pool?.metric) ||
    (
      config.score_model?.pool_specific_output !== true ||
      pool?.pool_specific_output === false
    )
  ) {
    return calculateScore(config, applicant, context);
  }

  const isGamsat = pool.metric === 'gamsat_total';
  const adjustedUcat =
    pool.metric === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC
      ? resolveContextualAdjustedSelectionUcat(applicant, context)
      : null;
  const value = isGamsat
    ? applicant.admissions_tests?.gamsat?.overall_score
    : adjustedUcat?.value ?? applicant.admissions_tests?.ucat?.total_score;
  const max = isGamsat
    ? (applicant.admissions_tests?.gamsat?.score_scale ?? null)
    : (adjustedUcat?.max ?? applicant.admissions_tests?.ucat?.score_scale ??
      (config.score_model?.metric === 'ucat_total' ? config.score_model?.scale?.max : null) ??
      2700);

  const ranking = {
    status: Number.isFinite(value) ? 'calculated' : 'unavailable',
    basis: isGamsat
      ? 'Overall GAMSAT ranking after the section minimum'
      : pool.metric === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC
      ? 'Contextual adjusted UCAT ranking'
      : config.score_model?.metric === 'ucat_total'
      ? config.score_model.basis
      : 'UCAT total ranking',
    value: Number.isFinite(value) ? value : null,
    max,
    components: {}
  };

  if (adjustedUcat) {
    ranking.raw_value = adjustedUcat.raw_value;
    ranking.total_uplift_percent = adjustedUcat.total_uplift_percent;
    ranking.applied_uplift = adjustedUcat.applied_uplift;
  }

  return ranking;
}

function unavailableRankingReason(ranking) {
  if (!ranking || ranking.status !== 'unavailable') {
    return null;
  }
  if (ranking.reason) {
    return ranking.reason;
  }
  return Object.values(ranking.components || {})
    .find((component) => component?.reason)?.reason || null;
}

function unavailableRankingMissingInformation(ranking) {
  if (!ranking || ranking.status !== 'unavailable') {
    return null;
  }
  if (ranking.missing_information) {
    return ranking.missing_information;
  }
  return Object.values(ranking.components || {})
    .find((component) => component?.missing_information)
    ?.missing_information || null;
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || null;
}

function predictionCalibrationWithheldExplicitly(config, pool) {
  const presentation = pool?.presentation || config?.presentation || {};
  const evidenceSummary = config?.evidence?.summary || null;
  const reviewNotes = config?.review_notes || config?.notes || null;
  const explicitText = firstNonEmptyString(
    presentation.insufficient_evidence_explanation,
    presentation.insufficient_evidence_reason,
    pool?.insufficient_evidence_explanation,
    pool?.selection_relevance,
    pool?.notes,
    evidenceSummary,
    reviewNotes,
    pool?.insufficient_evidence_explanation,
    config?.insufficient_evidence_explanation
  );

  return Boolean(
    explicitText && /calibration|withheld|withholding|public prediction is withheld|prediction is withheld/i.test(explicitText)
  );
}

function insufficientEvidenceReasonCodeForBand({ band, ranking, pool, config }) {
  if (band !== 'insufficient_evidence') {
    return null;
  }
  if (ranking?.status === 'unavailable') {
    return unavailableRankingReason(ranking) || (predictionCalibrationWithheldExplicitly(config, pool) ? 'prediction_calibration_unavailable' : null);
  }
  if (predictionCalibrationWithheldExplicitly(config, pool)) {
    return 'prediction_calibration_unavailable';
  }
  return null;
}

function resolveGcseCompetitivenessCompletenessRule(config) {
  const scoreModel = config?.score_model || {};
  const directMinimum = Number(
    scoreModel.gcse_profile_completeness?.minimum_results_for_competitiveness_assessment
  );
  if (Number.isInteger(directMinimum) && directMinimum > 0) {
    return directMinimum;
  }

  const componentMinimum = Number(
    (scoreModel.components || [])
      .find((component) => component?.component_id === 'gcse_profile_modifier')
      ?.minimum_results_for_competitiveness_assessment
  );
  if (Number.isInteger(componentMinimum) && componentMinimum > 0) {
    return componentMinimum;
  }

  return null;
}

function providedGcseResultCountForCompetitiveness(applicant) {
  const expanded = expandedGcseGrades(applicant).filter((grade) => {
    return grade !== null && grade !== undefined && String(grade).trim() !== '';
  });

  if (expanded.length > 0) {
    return expanded.length;
  }

  const reported = Number(applicant?.gcse_profile?.total_gcse_count);
  return Number.isFinite(reported) ? reported : 0;
}

function resolveMissingGcseCompetitivenessInformation(config, applicant, eligibility) {
  if (eligibility?.status !== 'eligible') {
    return null;
  }

  const requiredCount = resolveGcseCompetitivenessCompletenessRule(config);
  if (!Number.isInteger(requiredCount) || requiredCount <= 0) {
    return null;
  }

  const providedCount = providedGcseResultCountForCompetitiveness(applicant);
  if (providedCount >= requiredCount) {
    return null;
  }

  return {
    qualification_type: 'gcse',
    provided_count: providedCount,
    required_count: requiredCount
  };
}

function resolveQualificationRouteMethodologyGap(config, qualificationRoute) {
  const gaps = config?.score_model?.qualification_route_methodology_gaps || [];
  const normalisedRoute = normaliseId(qualificationRoute);

  return gaps.find((gap) => {
    return normaliseId(gap?.qualification_route) === normalisedRoute;
  }) || null;
}

function getMetricValue(metric, score, applicant) {
  if (metric === 'selection_score') {
    return score?.value;
  }
  if (metric === 'ucat_national_percentile') {
    return score?.value;
  }
  if (
    metric === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC
  ) {
    return score?.value;
  }
  if (metric === 'ucat_total') {
    return applicant.admissions_tests?.ucat?.total_score;
  }
  if (metric === 'gamsat_total') {
    return applicant.admissions_tests?.gamsat?.overall_score;
  }
  if (metric === 'eligibility_gate') {
    return 1;
  }
  return null;
}

function getMetricScale(metric, score, applicant, config) {
  if (metric === 'selection_score') {
    return {
      min: config.score_model?.scale?.min ?? 0,
      max: score?.max ?? config.score_model?.scale?.max ?? null
    };
  }
  if (metric === 'ucat_national_percentile') {
    return { min: 0, max: 100 };
  }
  if (metric === 'ucat_total') {
    return {
      min: 0,
      max: applicant.admissions_tests?.ucat?.score_scale ??
        config.score_model?.scale?.max ??
        2700
    };
  }
  if (
    metric === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC
  ) {
    return {
      min: 0,
      max: score?.max ??
        applicant.admissions_tests?.ucat?.score_scale ??
        config.score_model?.scale?.max ??
        2700
    };
  }
  if (metric === 'gamsat_total') {
    return {
      min: 0,
      max: applicant.admissions_tests?.gamsat?.score_scale ?? null
    };
  }
  if (metric === 'eligibility_gate') {
    return { min: 0, max: 1 };
  }
  return { min: null, max: null };
}

function getMetricLabel(metric) {
  if (metric === 'selection_score') {
    return 'selection score';
  }
  if (metric === 'ucat_total') {
    return 'UCAT total';
  }  if (metric === CONTEXTUAL_ADJUSTED_SELECTION_UCAT_METRIC) {
    return 'contextual adjusted UCAT';
  }
  if (metric === 'gamsat_total') {
    return 'GAMSAT total';
  }
  if (metric === 'eligibility_gate') {
    return 'eligibility-gate result';
  }
  return metric;
}

function ruleMatches(value, rule) {
  if (!Number.isFinite(value)) {
    return false;
  }

  if (rule.operator === 'greater_than') {
    return value > rule.value;
  }
  if (rule.operator === 'greater_than_or_equal') {
    return value >= rule.value;
  }
  if (rule.operator === 'less_than') {
    return value < rule.value;
  }
  if (rule.operator === 'less_than_or_equal') {
    return value <= rule.value;
  }
  if (rule.operator === 'between_inclusive') {
    return value >= rule.min && value <= rule.max;
  }
  return false;
}

function interpolatePercentile(score, anchors = []) {
  if (!Number.isFinite(score) || !Array.isArray(anchors) || anchors.length === 0) {
    return null;
  }

  const sorted = [...anchors]
    .filter((anchor) => Number.isFinite(anchor.score) && Number.isFinite(anchor.percentile))
    .sort((a, b) => a.score - b.score);
  if (sorted.length === 0) {
    return null;
  }

  if (score <= sorted[0].score) {
    return sorted[0].percentile;
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const lower = sorted[index - 1];
    const upper = sorted[index];
    if (score <= upper.score) {
      if (upper.score === lower.score) {
        return upper.percentile;
      }
      const position = (score - lower.score) / (upper.score - lower.score);
      return lower.percentile + position * (upper.percentile - lower.percentile);
    }
  }

  return sorted[sorted.length - 1].percentile;
}

function resolveUcatNationalPercentile(applicant, estimator = {}) {
  const ucat = applicant.admissions_tests?.ucat || {};
  if (Number.isFinite(ucat.national_percentile)) {
    return round(ucat.national_percentile, estimator.rounding_places ?? 2);
  }

  const score = ucat.total_score;
  if (!Number.isFinite(score)) {
    return null;
  }

  const scoreScale = ucat.score_scale ?? estimator.score_scale ?? 2700;
  const anchors = scoreScale === 3600
    ? estimator.historical_3600_anchors
    : estimator.current_2700_anchors;
  const percentile = interpolatePercentile(score, anchors);
  return Number.isFinite(percentile)
    ? round(percentile, estimator.rounding_places ?? 2)
    : null;
}

function bandRuleConditionMatches(rule, applicant, groupIds = []) {
  if (!rule || typeof rule !== 'object') {
    return false;
  }

  if (rule.match && !groupRuleApplies(rule.match, groupIds)) {
    return false;
  }

  const sjtBand = applicant?.admissions_tests?.ucat?.sjt_band;
  if (Array.isArray(rule.sjt_bands) && !rule.sjt_bands.includes(sjtBand)) {
    return false;
  }

  if (Array.isArray(rule.excluded_sjt_bands) && rule.excluded_sjt_bands.includes(sjtBand)) {
    return false;
  }

  return true;
}

function findMatchingBandRule(value, rules = [], applicant = null, groupIds = []) {
  for (const rule of rules || []) {
    if (applicant && !bandRuleConditionMatches(rule, applicant, groupIds)) {
      continue;
    }
    const resolved = resolveBandRuleForComparison(rule);
    if (ruleMatches(value, resolved.comparison_rule)) {
      return resolved;
    }
  }

  return null;
}

const BAND_ORDER = {
  very_strong_interview_potential: 5,
  interview_likely: 4,
  realistic: 3,
  ambitious: 2,
  high_risk: 1,
  insufficient_evidence: 0,
  not_eligible: -1
};

function selectGuidancePool(config, groupIds, applicant = null) {
  return [...(config.guidance_pools || [])]
    .filter((pool) => {
      const match = pool.applicant_match || {};
      return groupRuleApplies(match, groupIds) &&
        (!applicant || matchQualificationStatus(match, applicant));
    })
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
}

function resolveSelectionRouteId({ course, groupIds, resolvedEligibility, guaranteedOverride, guidancePool }) {
  if (guaranteedOverride?.selection_route_id) {
    return guaranteedOverride.selection_route_id;
  }

  if (resolvedEligibility?.scottish_medical_school_route?.route_id) {
    return resolvedEligibility.scottish_medical_school_route.route_id;
  }

  if (course?.profile_id !== 'keele-a100') {
    return null;
  }

  if (guaranteedOverride) {
    return 'keele_steps2medicine_ukwpmed_guaranteed_interview';
  }

  if (guidancePool?.pool_id === 'international_ucat_ranked_guidance') {
    return 'keele_international_ucat_ranked';
  }

  if (resolvedEligibility?.status !== 'eligible') {
    return null;
  }

  const groups = new Set(groupIds || []);
  if (!groups.has('home_fee')) {
    return null;
  }

  if (groups.has('contextual') || groups.has('widening_participation')) {
    return 'keele_home_contextual_shortlisting_score';
  }

  return 'keele_home_a100_shortlisting_score';
}

function shouldContinueAfterManualReview(config, eligibility) {
  const allowedReasons = config.eligibility?.allow_guidance_with_manual_review_reasons || [];
  const reasons = eligibility.manual_review_reasons || [];
  return reasons.length > 0 &&
    reasons.every((reason) => allowedReasons.includes(reason));
}

function bandMeetsMinimum(band, minimumBand) {
  return (BAND_ORDER[band] ?? -Infinity) >= (BAND_ORDER[minimumBand] ?? Infinity);
}

function conditionalManualReviewRequired(config, applicant, groupIds, eligibility, band) {
  if (eligibility.status === 'manual_review') {
    return true;
  }

  return (config.eligibility?.conditional_manual_review || []).some((rule) => {
    if (!groupRuleApplies(rule.match || rule, groupIds)) {
      return false;
    }
    if (!matchQualificationStatus(rule.match || rule, applicant)) {
      return false;
    }
    if (Array.isArray(rule.band_ids) && !rule.band_ids.includes(band)) {
      return false;
    }
    if (rule.minimum_band && !bandMeetsMinimum(band, rule.minimum_band)) {
      return false;
    }
    if (Array.isArray(rule.eligibility_manual_review_reasons)) {
      const reasons = eligibility.manual_review_reasons || [];
      return rule.eligibility_manual_review_reasons.some((reason) => reasons.includes(reason));
    }
    return true;
  });
}

function officialPredictionLimitation(config) {
  const limitation =
    config.score_model?.official_prediction ||
    config.score_model?.official_prediction_availability ||
    config.score_model?.prediction_availability ||
    null;

  if (!limitation || typeof limitation !== 'object') {
    return null;
  }

  const status = limitation.status || limitation.prediction_status;
  if (!['prediction_unavailable', 'official_prediction_unavailable'].includes(status)) {
    return null;
  }

  return {
    available: false,
    status: 'prediction_unavailable',
    reason_code: limitation.reason_code || 'official_prediction_unavailable',
    explanation: limitation.explanation || limitation.summary || null,
    source_ids: limitation.source_ids || []
  };
}

function scoreModelWarnings(config, applicant) {
  const warnings = [...(config.score_model?.guidance_policy?.labels || [])];
  const baselineYear = Number(config.score_model?.baseline_cycle_year);
  const applicationYear = Number(applicant.application_year);
  if (
    Number.isInteger(baselineYear) &&
    Number.isInteger(applicationYear) &&
    applicationYear > baselineYear &&
    config.score_model?.future_cycle_policy?.drift_warning
  ) {
    warnings.push(config.score_model.future_cycle_policy.drift_warning);
  }
  return [...new Set(warnings)];
}

function applyManualReviewBandCaps(config, eligibility, band) {
  const reasons = eligibility.manual_review_reasons || [];
  const matchedCap = (config.eligibility?.manual_review_band_caps || [])
    .find((rule) => {
      return Array.isArray(rule.manual_review_reasons) &&
        rule.manual_review_reasons.some((reason) => reasons.includes(reason)) &&
        rule.cap_to_band &&
        CANONICAL_BANDS.has(rule.cap_to_band);
    });

  if (!matchedCap) {
    return band;
  }
  return bandMeetsMinimum(band, matchedCap.cap_to_band)
    ? matchedCap.cap_to_band
    : band;
}

function makeExplanation(band, bandMetric, config, eligibility) {
  if (band === 'not_eligible') {
    return 'Based on the information entered, one or more published entry requirements are not met.';
  }
  if (band === 'insufficient_evidence') {
    return 'The applicant appears to meet the entry requirements ApplySmart can check, but verified historical data is not available for this applicant group.';
  }
  if (band === 'eligible_to_apply') {
    return 'The applicant meets the supported academic entry requirements. No interview-likelihood prediction is produced for this eligibility-only profile.';
  }

  const scoreText = Number.isFinite(bandMetric?.value)
    ? `${bandMetric.value}${Number.isFinite(bandMetric.scale?.max) ? `/${bandMetric.scale.max}` : ''} ${getMetricLabel(bandMetric.metric)}`
    : 'The available score';
  const comparison = {
    very_strong_interview_potential: 'well above',
    interview_likely: 'above',
    realistic: 'within',
    ambitious: 'slightly below',
    high_risk: 'below'
  }[band];
  return `${scoreText} is ${comparison} the historical interview range available to ApplySmart. This is guidance, not a current cut-off or an interview guarantee.`;
}

function isBirminghamProfile(course) {
  return course?.profile_id === 'birmingham-a100';
}

function getGuidancePoolById(config, poolId) {
  return (config.guidance_pools || []).find((pool) => pool.pool_id === poolId) || null;
}

function selectBirminghamGuidancePool(config, eligibility) {
  const groups = new Set(eligibility.applicant_group_ids || []);

  if (eligibility.selection_route_id === 'pathways_to_birmingham') {
    return getGuidancePoolById(config, 'pathways_to_birmingham');
  }
  if (eligibility.selection_route_id === 'ukwpmed_guaranteed_interview') {
    return getGuidancePoolById(config, 'ukwpmed_guaranteed_interview');
  }
  if (groups.has('international_fee')) {
    return getGuidancePoolById(config, 'international');
  }
  if (groups.has('graduate_applicant') || eligibility.qualification_route === 'graduate') {
    return getGuidancePoolById(config, 'graduate_a100');
  }
  if (groups.has('contextual')) {
    return getGuidancePoolById(config, 'home_contextual_scored');
  }
  if (groups.has('home_fee')) {
    return getGuidancePoolById(config, 'home_standard');
  }

  return null;
}

function getBirminghamComponent(course, componentId) {
  return (course.stage_2_interview_selection?.calculation?.score_components || [])
    .find((component) => component.component_id === componentId);
}

function normaliseBirminghamPolar4Quintile(value) {
  const normalised = normaliseId(value);
  if (['q1', 'quintile_1', 'quintile1', '1'].includes(normalised)) return 'Q1';
  if (['q2', 'quintile_2', 'quintile2', '2'].includes(normalised)) return 'Q2';
  if (['q3', 'quintile_3', 'quintile3', '3'].includes(normalised)) return 'Q3';
  if (['q4', 'quintile_4', 'quintile4', '4'].includes(normalised)) return 'Q4';
  if (['q5', 'quintile_5', 'quintile5', '5'].includes(normalised)) return 'Q5';
  return null;
}

function resolveBirminghamPolar4Quintile(applicant = {}) {
  return normaliseBirminghamPolar4Quintile(
    applicant.contextual_profile?.home_area_region?.polar4_quintile
  ) || normaliseBirminghamPolar4Quintile(
    applicant.applicant_identity?.polar4_quintile
  );
}

function getBirminghamNamedGcsePoints(scoringModel, grade) {
  if (gradeMeets(grade, '8', 'gcse')) {
    return scoringModel.named_subject_points?.['8_or_9'] ?? 0;
  }
  if (gradeMeets(grade, '7', 'gcse')) {
    return scoringModel.named_subject_points?.['7'] ?? 0;
  }
  if (gradeMeets(grade, '6', 'gcse')) {
    return scoringModel.named_subject_points?.['6'] ?? 0;
  }
  return 0;
}

function missingBirminghamScoringInput(reasonCode, label) {
  return {
    status: 'unavailable',
    basis: 'Birmingham Home application score',
    value: null,
    max: 10,
    components: {},
    reason: reasonCode,
    missing_scoring_inputs: [label]
  };
}

function birminghamScottishScoringUnavailable() {
  return {
    status: 'unavailable',
    basis: 'Birmingham Home application score',
    value: null,
    max: 10,
    components: {},
    reason: 'birmingham_scottish_gcse_scoring_conversion_unavailable'
  };
}

function calculateBirminghamHomeRanking(course, applicant, contextual, context = {}) {
  if (deriveQualificationRoute(applicant) === 'scottish') {
    return birminghamScottishScoringUnavailable();
  }

  const scoringModel = course.stage_1_eligibility?.gcse?.scoring_model || {};
  const gcseGrades = getGcseGrades(applicant);
  const dualAwardGrades = splitGradeProfile(gcseGrades.combined_science);
  const namedGrades = {
    english_language: gcseGrades.english_language,
    english_literature: gcseGrades.english_literature,
    mathematics: gcseGrades.mathematics,
    biology: gcseGrades.biology ?? dualAwardGrades[0],
    chemistry: gcseGrades.chemistry ?? dualAwardGrades[1]
  };

  const namedInputChecks = [
    ['english_language', 'missing_birmingham_english_language_grade', 'English Language'],
    ['english_literature', 'missing_birmingham_english_literature_grade', 'English Literature'],
    ['mathematics', 'missing_birmingham_mathematics_grade', 'Mathematics'],
    ['biology', 'missing_birmingham_biology_grade', 'Biology or Dual Award Science'],
    ['chemistry', 'missing_birmingham_chemistry_grade', 'Chemistry or Dual Award Science']
  ];
  for (const [subjectId, reasonCode, label] of namedInputChecks) {
    const grade = namedGrades[subjectId];
    if (grade === undefined || grade === null || grade === '') {
      return missingBirminghamScoringInput(reasonCode, label);
    }
  }

  const namedRawPoints = Object.values(namedGrades).reduce((total, grade) => {
    return total + getBirminghamNamedGcsePoints(scoringModel, grade);
  }, 0);
  const excludedFreeChoiceSubjects = new Set([
    'english_language',
    'english_literature',
    'mathematics',
    'biology',
    'chemistry',
    'combined_science'
  ]);
  const freeChoicePoints = Object.entries(gcseGrades)
    .filter(([subjectId, grade]) => {
      return !excludedFreeChoiceSubjects.has(subjectId) &&
        grade !== undefined &&
        grade !== null;
    })
    .map(([, grade]) => {
      return gradeMeets(grade, '8', 'gcse')
        ? (scoringModel.free_choice_subject_points?.['8_or_9'] ?? 0)
        : (scoringModel.free_choice_subject_points?.below_8 ?? 0);
    })
    .sort((a, b) => b - a)
    .slice(0, scoringModel.free_choice_subject_count || 0);
  if (freeChoicePoints.length < (scoringModel.free_choice_subject_count || 0)) {
    return missingBirminghamScoringInput(
      'missing_birmingham_additional_gcse_scoring_grades',
      'Two additional GCSE subjects'
    );
  }
  const freeChoiceRawPoints = freeChoicePoints.reduce((total, points) => total + points, 0);
  const gcseRawPoints = namedRawPoints + freeChoiceRawPoints;
  const gcseValue = gcseRawPoints * scoringModel.scale_multiplier;

  const decileResult = resolveUcatDecile(
    applicant.admissions_tests?.ucat?.total_score,
    {
      courseProfileId: course.profile_id,
      decileData: context.ucatDecileData,
      universityDecileData: context.universityDecileData
    }
  );
  const derivedDecile = decileResult.available
    ? decileResult.national_decile
    : null;
  const ucatComponent = getBirminghamComponent(course, 'ucat_component');
  const ucatValue = ucatComponent?.decile_points?.[String(derivedDecile)];
  if (!Number.isFinite(ucatValue)) {
    return {
      status: 'unavailable',
      basis: 'Birmingham Home application score',
      value: null,
      max: 10,
      components: {
        gcse_component: {
          value: round(gcseValue, 12),
          raw_value: gcseRawPoints,
          max: scoringModel.scaled_maximum
        },
        ucat_component: {
          value: null,
          max: ucatComponent?.scale?.maximum ?? 4,
          reason: 'ucat_decile_lookup_unavailable'
        }
      },
      reason: 'ucat_decile_lookup_unavailable'
    };
  }

  const contextualComponent = getBirminghamComponent(course, 'contextual_component');
  const polar4Quintile = resolveBirminghamPolar4Quintile(applicant);
  const contextualValue = contextual
    ? contextualComponent?.points_by_quintile?.[polar4Quintile]
    : 0;
  if (!Number.isFinite(contextualValue)) {
    return {
      status: 'unavailable',
      basis: 'Birmingham Home application score',
      value: null,
      max: 10,
      components: {
        gcse_component: {
          value: round(gcseValue, 12),
          raw_value: gcseRawPoints,
          max: scoringModel.scaled_maximum
        },
        ucat_component: {
          value: ucatValue,
          max: ucatComponent?.scale?.maximum ?? 4
        },
        contextual_component: {
          value: null,
          max: contextualComponent?.scale?.maximum ?? 1.5,
          reason: 'verified_polar4_quintile_required'
        }
      },
      reason: 'verified_polar4_quintile_required'
    };
  }

  const value = gcseValue + ucatValue + contextualValue;
  return {
    status: 'calculated',
    basis: 'Official Birmingham Home application score',
    value: round(value, 12),
    max: 10,
    components: {
      gcse_component: {
        value: round(gcseValue, 12),
        raw_value: gcseRawPoints,
        max: scoringModel.scaled_maximum,
        raw_max: scoringModel.raw_maximum
      },
      ucat_component: {
        value: ucatValue,
        max: ucatComponent?.scale?.maximum ?? 4
      },
      contextual_component: {
        value: contextualValue,
        max: contextualComponent?.scale?.maximum ?? 1.5,
        polar4_quintile: contextual ? polar4Quintile : null
      }
    }
  };
}

function classifyBirminghamInterviewBand(course, config, applicant, eligibility, base, context = {}) {
  const guidanceWarnings = [
    ...(config.score_model?.guidance_policy?.labels || [])
  ];

  if (eligibility.status === 'not_eligible') {
    return {
      ...base,
      ranking: null,
      guidance_pool_id: null,
      canonical_interview_band: 'not_eligible',
      warnings: guidanceWarnings,
      explanation: makeExplanation('not_eligible', null, config, eligibility)
    };
  }
  if (eligibility.status !== 'eligible') {
    return {
      ...base,
      ranking: null,
      guidance_pool_id: null,
      canonical_interview_band: 'insufficient_evidence',
      warnings: [
        ...guidanceWarnings,
        'eligibility_or_route_requires_manual_review'
      ],
      explanation: 'Interview guidance is unavailable until the Birmingham eligibility or route review is resolved.'
    };
  }

  const pool = selectBirminghamGuidancePool(config, eligibility);
  if (eligibility.selection_route_id === 'pathways_to_birmingham') {
    return {
      ...base,
      ranking: null,
      guidance_pool_id: pool?.pool_id || 'pathways_to_birmingham',
      guidance_pool: pool || null,
      selection_route_id: 'pathways_to_birmingham',
      band_metric: null,
      canonical_interview_band: null,
      interview_outcome: 'guaranteed_interview',
      guaranteed_interview_explanation:
        'Eligible completed Pathways to Birmingham Medicine participant: the guaranteed interview applies because programme completion, Pathways academic criteria and UCAT-taking are verified.',
      guaranteed_interview_notice:
        'You meet the published requirements for the Pathways to Birmingham Medicine guaranteed-interview route.',
      guaranteed_interview_pool_label: 'Pathways to Birmingham',
      guaranteed_interview_badge_label: 'Guaranteed interview',
      warnings: [],
      explanation:
        'Eligible completed Pathways to Birmingham Medicine participant: guaranteed interview applies after all implemented minimum criteria pass. Ordinary Birmingham numerical ranking was not applied.'
    };
  }
  if (eligibility.selection_route_id === 'ukwpmed_guaranteed_interview') {
    if (eligibility.guaranteed_interview === true) {
      return {
        ...base,
        ranking: null,
        guidance_pool_id: pool?.pool_id || 'ukwpmed_guaranteed_interview',
        guidance_pool: pool || null,
        selection_route_id: 'ukwpmed_guaranteed_interview',
        band_metric: null,
        canonical_interview_band: null,
        interview_outcome: 'guaranteed_interview',
        warnings: guidanceWarnings,
        explanation: 'Eligible verified UKWPMED completer: the guaranteed interview applies because Step 6 programme completion and every Birmingham Appendix 1 threshold are met.'
      };
    }
    return {
      ...base,
      ranking: null,
      guidance_pool_id: pool?.pool_id || 'ukwpmed_guaranteed_interview',
      band_metric: null,
      canonical_interview_band: 'insufficient_evidence',
      warnings: [
        ...guidanceWarnings,
        'ukwpmed_guarantee_conditions_not_verified'
      ],
      explanation: 'UKWPMED interview guidance is unavailable because every guaranteed-interview condition has not been verified.'
    };
  }

  const isContextual = pool?.pool_id === 'home_contextual_scored';
  const ranking = ['home_standard', 'home_contextual_scored'].includes(pool?.pool_id)
    ? calculateBirminghamHomeRanking(course, applicant, isContextual, context)
    : calculatePoolRanking(config, pool, applicant, {});
  const metricValue = pool ? getMetricValue(pool.metric, ranking, applicant) : null;
  const metricScale = pool
    ? getMetricScale(pool.metric, ranking, applicant, config)
    : null;
  const bandMetric = pool
    ? { metric: pool.metric, value: metricValue, scale: metricScale }
    : null;
  const matchedRuleResult = findMatchingBandRule(
    metricValue,
    pool?.band_rules || [],
    applicant,
    eligibility.applicant_group_ids || []
  );
  const matchedRule = matchedRuleResult?.rule;
  const band = matchedRule?.band || 'insufficient_evidence';
  const isInternational = pool?.pool_id === 'international';
  const isGraduate = pool?.pool_id === 'graduate_a100';
  const routeWarnings = [
    ...(isInternational ? ['international_non_academic_review_not_executable'] : []),
    ...(isGraduate ? ['graduate_numerical_guidance_boundary_not_published'] : [])
  ];

  return {
    ...base,
    ranking,
    guidance_pool_id: pool?.pool_id || null,
    guidance_pool: pool || null,
    band_metric: matchedRuleResult?.conversion
      ? {
          ...bandMetric,
          historical_conversion: {
            applicant_score: {
              value: metricValue,
              scale: metricScale?.max ?? null,
              scale_id: pool?.metric === 'ucat_total' ? 'current_2700' : null
            },
            ...matchedRuleResult.conversion
          }
        }
      : bandMetric,
    canonical_interview_band: band,
    insufficient_evidence_reason_code: insufficientEvidenceReasonCodeForBand({
      band,
      ranking,
      pool,
      config
    }),
    warnings: [...guidanceWarnings, ...routeWarnings],
    manual_review_required: isInternational,
    non_executable_checks: isInternational
      ? ['international_personal_statement_and_non_academic_review']
      : [],
    explanation: makeExplanation(band, bandMetric, config, eligibility)
  };
}

function classifyInterviewBand(course, config, applicantInput, options = {}) {
  if (!course || !applicantInput) {
    throw new TypeError('course and applicant are required.');
  }
  const applicant = normaliseApplicantProfile(applicantInput, { course });

  const classificationConfig = config || course.interview_band_classification || {
    course_profile_id: course.profile_id,
    confidence: 'low',
    evidence: {
      classification: 'banding_metadata_missing',
      summary: 'No score, threshold, ranking guidance or banding metadata is configured.',
      source_ids: []
    },
    eligibility: {},
    score_model: null,
    guidance_pools: []
  };

  if (classificationConfig.course_profile_id !== course.profile_id) {
    throw new Error(`Classification config ${classificationConfig.course_profile_id} does not match course ${course.profile_id}.`);
  }

  const birmingham = isBirminghamProfile(course);
  const qualificationRoute = deriveQualificationRoute(applicant);
  const courseEligibilityQualificationRoutes =
    classificationConfig.eligibility?.use_course_eligibility_for_qualification_routes || [];
  const routeUsesCourseEligibility = courseEligibilityQualificationRoutes
    .map(normaliseId)
    .includes(normaliseId(qualificationRoute));
  const courseEligibility = (contextualEvaluatorIdForCourse(course) || routeUsesCourseEligibility)
    ? evaluateCourseEligibility(course, applicantInput)
    : null;
  const contextualStatus = courseEligibility?.contextual_eligibility?.status;
  const preliminaryGroupIds = deriveConfiguredApplicantGroupIds(applicant, classificationConfig);
  const contextualRoutingPolicy = course.contextual_admissions?.contextual_eligibility || {};
  const contextualEvaluatorControlsGroupRouting =
    (
      classificationConfig.eligibility?.contextual_evaluator_controls_group_routing === true ||
      contextualRoutingPolicy.controls_group_routing === true
    ) &&
    groupRuleApplies(contextualRoutingPolicy, preliminaryGroupIds);
  const useCourseEligibility = birmingham ||
    course.profile_id === 'bristol-a100' ||
    routeUsesCourseEligibility ||
    contextualEvaluatorControlsGroupRouting ||
    courseEligibility?.contextual_eligibility?.is_contextual === true ||
    contextualStatus === 'information_needed';
  const eligibility = birmingham
    ? evaluateCourseEligibility(course, applicantInput)
    : courseEligibility;
  const groupIds = useCourseEligibility
    ? eligibility.applicant_group_ids
    : preliminaryGroupIds;
  const preserveClassifierHardFilters =
    contextualEvaluatorControlsGroupRouting &&
    contextualRoutingPolicy.preserve_classifier_hard_filters === true &&
    !routeUsesCourseEligibility;
  const resolvedEligibility = preserveClassifierHardFilters
    ? {
      ...evaluateHardFilters(
        course,
        classificationConfig,
        applicant,
        groupIds,
        courseEligibility
      ),
      contextual_eligibility: courseEligibility?.contextual_eligibility || null
    }
    : useCourseEligibility
    ? applyClassificationEligibilityGuards(
      eligibility,
      classificationConfig,
      qualificationRoute,
      groupIds,
      applicant
    )
    : evaluateHardFilters(course, classificationConfig, applicant, groupIds);
  const base = {
    course_profile_id: course.profile_id,
    applicant_profile_id: applicant.profile_id || null,
    applicant_group_ids: applicantGroupIdsForResult(groupIds, applicant),
    eligibility: resolvedEligibility,
    evidence_basis: classificationConfig.evidence || null,
    confidence: classificationConfig.confidence
  };

  const qualificationRouteMethodologyGap = resolveQualificationRouteMethodologyGap(
    classificationConfig,
    qualificationRoute
  );

  if (resolvedEligibility.status === 'eligible' && qualificationRouteMethodologyGap) {
    const pool = selectGuidancePool(classificationConfig, groupIds, applicant);
    const reasonCode =
      qualificationRouteMethodologyGap.reason_code || 'university_methodology_gap';

    return {
      ...base,
      ranking: null,
      guidance_pool_id: pool?.pool_id || null,
      guidance_pool: pool || null,
      band_metric: null,
      canonical_interview_band: 'insufficient_evidence',
      insufficient_evidence_reason_code: reasonCode,
      missing_information: null,
      warnings: [
        ...(scoreModelWarnings(classificationConfig, applicant) || []),
        qualificationRouteMethodologyGap.warning_code || reasonCode
      ],
      manual_review_required: false,
      explanation:
        qualificationRouteMethodologyGap.applicant_facing_explanation ||
        'Interview guidance is unavailable for this qualification route because the configured methodology cannot assess it reliably. This is not a rejection.'
    };
  }

  const missingGcseCompetitivenessInformation = resolveMissingGcseCompetitivenessInformation(
    classificationConfig,
    applicant,
    resolvedEligibility
  );

  if (missingGcseCompetitivenessInformation) {
    return {
      ...base,
      ranking: null,
      guidance_pool_id: null,
      guidance_pool: null,
      band_metric: null,
      canonical_interview_band: 'insufficient_evidence',
      insufficient_evidence_reason_code: 'insufficient_gcse_results',
      missing_information: missingGcseCompetitivenessInformation,
      warnings: scoreModelWarnings(classificationConfig, applicant),
      explanation:
        'A more complete GCSE profile is needed before interview competitiveness can be assessed. This is not a rejection.'
    };
  }

  if (birmingham) {
    return classifyBirminghamInterviewBand(
      course,
      classificationConfig,
      applicant,
      resolvedEligibility,
      base,
      {
        courseProfileId: course.profile_id,
        ucatDecileData: options.ucatDecileData,
        universityDecileData: options.universityDecileData
      }
    );
  }

  if (resolvedEligibility.status === 'not_eligible') {
    return {
      ...base,
      ranking: null,
      canonical_interview_band: 'not_eligible',
      explanation: makeExplanation('not_eligible', null, classificationConfig, resolvedEligibility)
    };
  }

  const continueAfterManualReview = shouldContinueAfterManualReview(
    classificationConfig,
    resolvedEligibility
  );

  if (resolvedEligibility.status !== 'eligible') {
    if (!continueAfterManualReview) {
      return {
        ...base,
        ranking: null,
        guidance_pool_id: null,
        band_metric: null,
        canonical_interview_band: 'insufficient_evidence',
        manual_review_required: true,
        missing_information:
          resolvedEligibility.contextual_eligibility?.missing_information || null,
        explanation:
          'We need more information to confirm eligibility before showing interview guidance.'
      };
    }
  }

  const guaranteedOverride = resolveGuaranteedInterviewOverride(
    classificationConfig,
    applicant,
    groupIds,
    resolvedEligibility
  );
  if (guaranteedOverride) {
    const selectionRouteId = resolveSelectionRouteId({
      course,
      groupIds,
      resolvedEligibility,
      guaranteedOverride,
      guidancePool: null
    });
    return {
      ...base,
      ranking: null,
      guidance_pool_id: null,
      selection_route_id: selectionRouteId,
      band_metric: null,
      canonical_interview_band: null,
      source_interview_band_id:
        guaranteedOverride.source_band_id || guaranteedOverride.band_id || null,
      result_card_id: guaranteedOverride.result_card_id || null,
      interview_outcome:
        guaranteedOverride.interview_outcome || guaranteedOverride.outcome || 'guaranteed_interview',
      guaranteed_interview_explanation:
        guaranteedOverride.applicant_facing_explanation || null,
      guaranteed_interview_notice:
        guaranteedOverride.confirmation_notice || null,
      guaranteed_interview_pool_label:
        guaranteedOverride.applicant_pool_label || null,
      guaranteed_interview_badge_label:
        guaranteedOverride.recommendation_badge_label || null,
      explanation: 'Eligible verified programme completer: guaranteed interview applies after all implemented minimum criteria pass. Ordinary UCAT guidance banding was not applied.'
    };
  }

  const context = {
    courseProfileId: course.profile_id,
    ucatDecileData: options.ucatDecileData,
    universityDecileData: options.universityDecileData,
    groupIds,
    resolvedEligibility
  };
  const pool = selectGuidancePool(classificationConfig, groupIds, applicant);
  const selectionRouteId = resolveSelectionRouteId({
    course,
    groupIds,
    resolvedEligibility,
    guaranteedOverride: null,
    guidancePool: pool
  });
  const ranking = calculatePoolRanking(classificationConfig, pool, applicant, context);
  const metricValue = pool ? getMetricValue(pool.metric, ranking, applicant) : null;
  const metricScale = pool
    ? getMetricScale(pool.metric, ranking, applicant, classificationConfig)
    : null;
  const bandMetric = pool
    ? { metric: pool.metric, value: metricValue, scale: metricScale }
    : null;
  const matchedRuleResult = findMatchingBandRule(
    metricValue,
    pool?.band_rules || [],
    applicant,
    groupIds
  );
  const matchedRule = matchedRuleResult?.rule;
  const uncappedBand = matchedRule?.band || 'insufficient_evidence';
  const band = applyManualReviewBandCaps(
    classificationConfig,
    resolvedEligibility,
    uncappedBand
  );

  if (!CANONICAL_BANDS.has(band)) {
    throw new Error(`Config produced non-canonical interview band "${band}".`);
  }
  const manualReviewRequired = conditionalManualReviewRequired(
    classificationConfig,
    applicant,
    groupIds,
    resolvedEligibility,
    band
  );

  return {
    ...base,
    ranking,
    guidance_pool_id: pool?.pool_id || null,
    guidance_pool: pool || null,
    selection_route_id: selectionRouteId,
    band_metric: matchedRuleResult?.conversion
      ? {
          ...bandMetric,
          historical_conversion: {
            applicant_score: {
              value: metricValue,
              scale: metricScale?.max ?? null,
              scale_id: pool?.metric === 'ucat_total' ? 'current_2700' : null
            },
            ...matchedRuleResult.conversion
          }
        }
      : bandMetric,
    canonical_interview_band: band,
    source_interview_band_id: matchedRule?.source_band_id || matchedRule?.band_id || null,
    result_card_id: matchedRule?.result_card_id || null,
    matched_band_rule: matchedRule
      ? {
          band: matchedRule.band || null,
          operator: matchedRule.operator || null,
          value: Number.isFinite(matchedRule.value) ? matchedRule.value : null,
          min: Number.isFinite(matchedRule.min) ? matchedRule.min : null,
          max: Number.isFinite(matchedRule.max) ? matchedRule.max : null,
          evidence_status: matchedRule.evidence_status || null,
          evidence_classification: matchedRule.evidence_classification || null
        }
      : null,
    insufficient_evidence_reason_code: insufficientEvidenceReasonCodeForBand({
      band,
      ranking,
      pool,
      config: classificationConfig
    }),
    missing_information: unavailableRankingMissingInformation(ranking),
    official_prediction: officialPredictionLimitation(classificationConfig),
    warnings: scoreModelWarnings(classificationConfig, applicant),
    ...(manualReviewRequired ? { manual_review_required: true } : {}),
    explanation: makeExplanation(band, bandMetric, classificationConfig, resolvedEligibility)
  };
}

module.exports = {
  CANONICAL_BANDS,
  clampAcademicScore,
  classifyInterviewBand,
  deriveApplicantGroupIds,
  deriveQualificationStatus,
  evaluateHardFilters,
  getGcseGrades,
  resolveUcatMinimumTotalScore
};
