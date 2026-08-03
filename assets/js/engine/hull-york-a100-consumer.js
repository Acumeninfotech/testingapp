const {
  deriveApplicantGroupIds,
  deriveQualificationRoute
} = require('./eligibility-evaluator');
const {
  ageAtDate,
  evaluateAgeBandAgainstMinimum,
  isUcatCycleValid,
  normaliseApplicantProfile
} = require('./applicant-profile-normaliser');
const {
  resolveUcatDecile
} = require('./ucat-decile-service');
const {
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence,
  buildAcademicRequirementChecks,
  buildAlternativeAcademicOffer,
  futureConditionAdvisories,
  CANONICAL_BAND_LABELS
} = require('./result-card-presenter');
const {
  evaluateEpqAlternativeOffer,
  manualReviewReasonForEpqAlternative
} = require('./epq-alternative-offer');

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

const APPLYSMART_HYMS_SCORE_LABEL = 'Estimated HYMS selection score';
const APPLYSMART_HYMS_ANALYSIS_DISCLOSURE =
  "ApplySmart uses published HYMS admissions information and historical evidence to guide interview competitiveness alongside HYMS's published admissions policy. This is not a guarantee of interview.";
const APPLYSMART_HYMS_SELECTION_SUMMARY =
  'ApplySmart combines HYMS published admissions information with historical admissions evidence to assess interview competitiveness for this applicant group.';

const A_LEVEL_GRADE_RANK = {
  U: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  'A*': 6
};

const DEGREE_RANK = {
  third: 1,
  '2_2': 2,
  lower_second: 2,
  '2_1': 3,
  upper_second: 3,
  first: 4,
  first_class: 4
};

const EXCLUDED_A_LEVEL_SUBJECTS = new Set([
  'applied_science',
  'citizenship',
  'citizenship_studies',
  'critical_thinking',
  'general_studies'
]);

// Mirrors the shared CANONICAL_BAND_LABELS from result-card-presenter.js so
// this consumer's estimate-band recommendation never drifts from the public
// wording used everywhere else. very_strong_interview_potential is never
// reachable from home_recommendation_bands/international_guidance config
// here, but is included so an unrecognised band never silently falls
// through to undefined.
const RECOMMENDATION_BY_BAND = {
  very_strong_interview_potential: CANONICAL_BAND_LABELS.very_strong_interview_potential,
  interview_likely: CANONICAL_BAND_LABELS.interview_likely,
  realistic: CANONICAL_BAND_LABELS.realistic,
  ambitious: CANONICAL_BAND_LABELS.ambitious,
  high_risk: CANONICAL_BAND_LABELS.high_risk,
  insufficient_evidence: null,
  not_eligible: null
};

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

function round(value, places = 2) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function profileToSubjectMap(profile) {
  const result = {};
  const subjects = profile?.subjects || {};

  if (Array.isArray(subjects)) {
    for (const subject of subjects) {
      const subjectId = normaliseId(subject?.subject_id);
      if (subjectId) {
        result[subjectId] =
          subject.achieved_grade ??
          subject.predicted_grade ??
          subject.grade ??
          subject.higher_level_grade;
      }
    }
  } else {
    for (const [subjectId, grade] of Object.entries(subjects)) {
      if (grade !== null && grade !== undefined) {
        result[normaliseId(subjectId)] = grade;
      }
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

function parseDoubleGrade(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 2);
  }
  const grade = normaliseGrade(value);
  if (/^[1-9][1-9]$/.test(grade) || /^[A-G][A-G]$/.test(grade)) {
    return grade.split('');
  }
  return grade.split(/[\/, +]+/).filter(Boolean).slice(0, 2);
}

function expandedGcseGrades(applicant) {
  return Object.entries(profileToSubjectMap(applicant.gcse_profile)).flatMap(
    ([subjectId, grade]) => {
      return ['combined_science', 'double_science'].includes(subjectId)
        ? parseDoubleGrade(grade)
        : [grade];
    }
  );
}

function gradeMeets(actual, minimum, ranks) {
  return (ranks[normaliseGrade(actual)] ?? -1) >=
    (ranks[normaliseGrade(minimum)] ?? Infinity);
}

function gradeProfileMeets(actualGrades, requiredGrades, ranks) {
  const actual = actualGrades
    .map((grade) => ranks[normaliseGrade(grade)])
    .filter(Number.isFinite)
    .sort((left, right) => right - left);
  const required = requiredGrades
    .map((grade) => ranks[normaliseGrade(grade)])
    .filter(Number.isFinite)
    .sort((left, right) => right - left);

  return actual.length >= required.length &&
    required.every((grade, index) => actual[index] >= grade);
}

function addCheck(state, checkId, passed, details = {}) {
  state.checks.push({
    check_id: checkId,
    status: passed ? 'pass' : 'fail',
    ...details
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

function feeStatusFlags(applicant) {
  const value = normaliseId(applicant.applicant_identity?.fee_status);
  return {
    home:
      value === 'home' ||
      value === 'home_fee' ||
      value === 'ruk' ||
      value.includes('rest_of_uk'),
    international:
      value === 'international' ||
      value === 'international_fee' ||
      value === 'overseas' ||
      value.includes('international')
  };
}

function routeFlags(applicant, groupIds) {
  const identity = applicant.applicant_identity || {};
  const applicantType = normaliseId(identity.applicant_type);
  const fee = feeStatusFlags(applicant);
  const graduate =
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true ||
    groupIds.includes('graduate_applicant');
  const priorUniversity =
    identity.prior_university_study === true ||
    identity.previously_started_or_completed_university_course === true ||
    applicant.prior_university_profile?.has_prior_study === true;
  const schoolLeaver =
    !graduate &&
    (
      groupIds.includes('school_leaver') ||
      applicantType.includes('school') ||
      applicantType.includes('standard') ||
      applicantType === 'ruk'
    );

  return {
    ...fee,
    graduate,
    prior_university: priorUniversity,
    school_leaver: schoolLeaver
  };
}

function evaluateGcse(applicant, state) {
  const subjects = profileToSubjectMap(applicant.gcse_profile);
  const grades = expandedGcseGrades(applicant);

  if (grades.length === 0) {
    addManualReview(state, 'gcse_or_equivalent_evidence_missing');
    return;
  }

  const sixAtFour = grades.filter((grade) => {
    return gradeMeets(grade, '4', GCSE_GRADE_RANK);
  }).length >= 6;
  const englishPassed = gradeMeets(
    subjects.english_language,
    '6',
    GCSE_GRADE_RANK
  );
  const mathematicsPassed = gradeMeets(
    subjects.mathematics,
    '6',
    GCSE_GRADE_RANK
  );

  addCheck(state, 'gcse_six_at_grade_4_or_above', sixAtFour);
  addCheck(state, 'gcse_english_language_grade_6', englishPassed);
  addCheck(state, 'gcse_mathematics_grade_6', mathematicsPassed);

  if (!sixAtFour) {
    addFailure(state, 'minimum_six_gcses_at_grade_4_not_met');
  }
  if (!englishPassed) {
    addFailure(state, 'gcse_english_language_minimum_not_met');
  }
  if (!mathematicsPassed) {
    addFailure(state, 'gcse_mathematics_minimum_not_met');
  }
}

function aLevelSubjectEvidence(applicant) {
  const subjects = profileToSubjectMap(applicant.a_level_profile);
  const excludedPresent = Object.keys(subjects)
    .filter((subjectId) => EXCLUDED_A_LEVEL_SUBJECTS.has(subjectId));
  const countable = Object.entries(subjects)
    .filter(([subjectId]) => !EXCLUDED_A_LEVEL_SUBJECTS.has(subjectId));
  const oneSitting =
    applicant.a_level_profile?.completed_in_one_sitting !== false &&
    (applicant.a_level_profile?.subjects || []).every((subject) => {
      return !['resit', 'repeat'].includes(normaliseId(subject.sitting_status));
    });

  return {
    subjects,
    excluded_present: excludedPresent,
    grades: countable.map(([, grade]) => grade),
    one_sitting: oneSitting
  };
}

function evaluateALevel(course, applicant, state) {
  const policy = course.stage_1_eligibility?.post_16?.a_level?.epq_alternative_offer;
  const evidence = aLevelSubjectEvidence(applicant);
  const gradeProfilePassed = gradeProfileMeets(
    evidence.grades,
    ['A', 'A', 'A'],
    A_LEVEL_GRADE_RANK
  );
  const biologyPassed = gradeMeets(
    evidence.subjects.biology ?? evidence.subjects.human_biology,
    'A',
    A_LEVEL_GRADE_RANK
  );
  const chemistryPassed = gradeMeets(
    evidence.subjects.chemistry,
    'A',
    A_LEVEL_GRADE_RANK
  );
  const excludedPassed = evidence.excluded_present.length === 0;
  const passed =
    gradeProfilePassed &&
    biologyPassed &&
    chemistryPassed &&
    excludedPassed &&
    evidence.one_sitting;

  addCheck(state, 'a_level_standard_offer', passed, {
    academic_pathway: 'standard',
    grade_profile_met: gradeProfilePassed,
    biology_met: biologyPassed,
    chemistry_met: chemistryPassed,
    one_sitting_met: evidence.one_sitting,
    excluded_subjects_present: evidence.excluded_present
  });

  if (passed) {
    state.academic_pathway = 'standard';
    state.academic_pathway_id = null;
    return;
  }

  if (policy?.enabled === true) {
    const epqAlternative = evaluateEpqAlternativeOffer(applicant, policy);
    addCheck(state, 'epq_alternative_offer', epqAlternative.status === 'met', {
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
    state.academic_pathway = epqAlternative.status === 'met' ||
      epqAlternative.status === 'information_needed'
      ? 'epq_alternative'
      : null;
    state.academic_pathway_id = epqAlternative.status === 'met' ||
      epqAlternative.status === 'information_needed'
      ? epqAlternative.pathway_id
      : null;
    state.epq_alternative_result = epqAlternative;
    state.future_conditions = epqAlternative.status === 'met'
      ? epqAlternative.future_conditions
      : [];

    if (epqAlternative.status === 'met') {
      return;
    }
    if (epqAlternative.status === 'information_needed') {
      addManualReview(state, manualReviewReasonForEpqAlternative(epqAlternative));
      return;
    }
  }

  if (!passed) {
    addFailure(state, 'a_level_requirements_not_met');
  }
}

function evaluateGraduate(applicant, state) {
  const graduate = applicant.graduate_profile || {};
  const degreePassed =
    (DEGREE_RANK[normaliseId(
      graduate.degree_classification ?? graduate.classification
    )] || 0) >= DEGREE_RANK['2_1'];
  const aLevels = aLevelSubjectEvidence(applicant);
  const aLevelPassed =
    gradeProfileMeets(aLevels.grades, ['B', 'B', 'B'], A_LEVEL_GRADE_RANK) &&
    aLevels.one_sitting &&
    aLevels.excluded_present.length === 0;

  addCheck(state, 'graduate_degree_2_1', degreePassed);
  addCheck(state, 'graduate_three_a_levels_BBB_first_sitting', aLevelPassed);
  if (!degreePassed || !aLevelPassed) {
    addFailure(state, 'graduate_A100_requirements_not_met');
  }
}

function evaluateIb(applicant, state) {
  const profile = applicant.ib_profile || {};
  const higherLevel = profileToSubjectMap({
    subjects:
      profile.higher_level_subjects ||
      profile.hl_subjects ||
      profile.subjects ||
      []
  });
  const higherLevelPassed =
    gradeProfileMeets(Object.values(higherLevel), [6, 6, 5], GCSE_GRADE_RANK) &&
    Number(higherLevel.biology) >= 6 &&
    Number(higherLevel.chemistry) >= 6;
  const totalPassed = Number(profile.total_points) >= 36;
  const hasGcseEquivalent = expandedGcseGrades(applicant).length >= 6;
  const standardLevel = profileToSubjectMap({
    subjects: profile.standard_level_subjects || profile.sl_subjects || []
  });
  const standardLevelPassed =
    hasGcseEquivalent ||
    (
      Number(standardLevel.english_language ?? standardLevel.english) >= 5 &&
      Number(standardLevel.mathematics) >= 5
    );
  const passed = totalPassed && higherLevelPassed && standardLevelPassed;

  addCheck(state, 'ib_36_HL_665_biology_chemistry_6', passed, {
    total_points_met: totalPassed,
    higher_level_profile_met: higherLevelPassed,
    standard_level_english_mathematics_met_or_gcse_equivalent:
      standardLevelPassed
  });
  if (!passed) {
    addFailure(state, 'international_baccalaureate_requirements_not_met');
  }
}

function evaluateScottish(applicant, state) {
  const profile = applicant.scottish_profile || {};
  const highers = profileToSubjectMap({
    subjects: profile.higher_subjects || []
  });
  const advancedHighers = profileToSubjectMap({
    subjects: profile.advanced_higher_subjects || []
  });
  const biology = advancedHighers.biology ?? advancedHighers.human_biology;
  const sciencesPresent = biology !== undefined && advancedHighers.chemistry !== undefined;
  const threeAdvancedHigherRoute =
    gradeProfileMeets(Object.values(highers), ['A', 'A', 'A', 'A', 'B'], A_LEVEL_GRADE_RANK) &&
    gradeProfileMeets(Object.values(advancedHighers), ['B', 'B', 'B'], A_LEVEL_GRADE_RANK) &&
    sciencesPresent;
  const twoAdvancedHigherRoute =
    gradeProfileMeets(Object.values(highers), ['A', 'A', 'A', 'A', 'A'], A_LEVEL_GRADE_RANK) &&
    gradeMeets(biology, 'A', A_LEVEL_GRADE_RANK) &&
    gradeMeets(advancedHighers.chemistry, 'A', A_LEVEL_GRADE_RANK);
  const passed = threeAdvancedHigherRoute || twoAdvancedHigherRoute;

  addCheck(state, 'scottish_higher_and_advanced_higher_route', passed);
  if (!passed) {
    addFailure(state, 'scottish_requirements_not_met');
  }
}

function evaluateResits(applicant, state, qualificationRoute) {
  const resit =
    applicant.applicant_identity?.resit ||
    applicant.resit_profile ||
    {};
  const hasResits = resit === true || resit.has_resits === true;
  if (!hasResits) {
    return;
  }

  const subjectsResat = (resit.subjects_resat || []).map(normaliseId);
  const post16Resit = subjectsResat.some((subjectId) => {
    return ['biology', 'chemistry'].includes(subjectId);
  }) || resit.repeated_year_13 === true;

  if (!post16Resit && qualificationRoute === 'a_level') {
    addCheck(state, 'gcse_resits_permitted', true);
    return;
  }

  if (qualificationRoute === 'a_level') {
    const firstSitting = resit.first_sitting_grade_profile || [];
    const minimumPassed = gradeProfileMeets(
      firstSitting,
      ['B', 'B', 'B'],
      A_LEVEL_GRADE_RANK
    );
    const topUpPassed =
      resit.adding_biology_or_chemistry !== true ||
      (
        gradeProfileMeets(firstSitting, ['A', 'A', 'A'], A_LEVEL_GRADE_RANK) &&
        resit.completed_within_one_year === true
      );
    const passed = minimumPassed && topUpPassed;
    addCheck(state, 'a_level_resit_policy', passed);
    if (!passed) {
      addFailure(state, 'a_level_resit_policy_not_met');
    }
  } else if (qualificationRoute === 'international_baccalaureate') {
    const passed =
      Number(resit.first_sitting_total_points) >= 31 &&
      gradeProfileMeets(
        resit.first_sitting_hl_grade_profile || [],
        [5, 5, 5],
        GCSE_GRADE_RANK
      );
    addCheck(state, 'ib_resit_policy', passed);
    if (!passed) {
      addFailure(state, 'ib_resit_policy_not_met');
    }
  } else if (qualificationRoute === 'scottish') {
    const first = profileToSubjectMap({
      subjects: resit.first_sitting_advanced_higher_subjects || []
    });
    const passed =
      gradeMeets(first.biology ?? first.human_biology, 'B', A_LEVEL_GRADE_RANK) &&
      gradeMeets(first.chemistry, 'C', A_LEVEL_GRADE_RANK);
    addCheck(state, 'scottish_resit_policy', passed);
    if (!passed) {
      addFailure(state, 'scottish_resit_policy_not_met');
    }
  }
}

function evaluateInternationalEnglish(applicant, state, flags) {
  if (!flags.international || applicant.applicant_identity?.english_language_exempt === true) {
    return;
  }

  const english = applicant.english_language_profile || {};
  const testName = normaliseId(english.test ?? english.test_name);
  const scores = english.scores || english;
  const ieltsPassed =
    ['ielts', 'ielts_academic'].includes(testName) &&
    Number(scores.overall) >= 7.5 &&
    ['reading', 'writing', 'listening', 'speaking'].every((component) => {
      return Number(scores[component]) >= 7;
    });
  const listedEquivalentVerified =
    english.hyms_listed_equivalent_verified === true;
  const passed = ieltsPassed || listedEquivalentVerified;

  addCheck(state, 'international_english_language', passed, {
    ielts_7_5_overall_and_7_each_met: ieltsPassed,
    listed_equivalent_verified: listedEquivalentVerified
  });
  if (!passed) {
    addFailure(state, 'international_english_language_requirement_not_met');
  }
}

function evaluateAdmissionsTests(applicant, state) {
  const ucat = applicant.admissions_tests?.ucat || {};
  const totalAvailable = Number.isFinite(ucat.total_score);
  const sjtPassed = [1, 2, 3].includes(ucat.sjt_band);
  const cyclePassed =
    !Number.isInteger(applicant.application_year) ||
    !Number.isInteger(ucat.test_year) ||
    isUcatCycleValid(applicant.application_year, ucat.test_year);

  addCheck(state, 'ucat_required', totalAvailable);
  addCheck(state, 'ucat_current_application_cycle', cyclePassed);
  addCheck(state, 'sjt_band_1_to_3', sjtPassed);
  if (!totalAvailable) {
    addFailure(state, 'required_admissions_test_missing:ucat');
  }
  if (!cyclePassed) {
    addFailure(state, 'ucat_cycle_not_valid');
  }
  if (!sjtPassed) {
    addFailure(state, 'disqualifying_sjt_rule');
  }
}

function evaluateAgeAndTransfer(course, applicant, state) {
  const entryYear =
    applicant.entry_year ??
    course.course?.entry_year ??
    2027;
  const identity = applicant.applicant_identity || {};
  const bandAssessment = evaluateAgeBandAgainstMinimum(
    identity.age_at_course_start_band,
    18
  );
  const suppliedAge = identity.age_on_1_october;
  const age = bandAssessment && bandAssessment.status !== 'manual_review'
    ? bandAssessment.age
    : Number.isFinite(suppliedAge)
      ? suppliedAge
      : ageAtDate(
        identity.date_of_birth,
        new Date(Date.UTC(entryYear, 9, 1))
      );

  if (bandAssessment?.status === 'manual_review') {
    addManualReview(state, 'age_on_1_october_requires_confirmation');
  } else if (Number.isFinite(age)) {
    const passed = age >= 18;
    addCheck(state, 'minimum_age_18_on_1_october', passed, { age });
    if (!passed) {
      addFailure(state, 'minimum_age_not_met');
    }
  } else {
    addManualReview(state, 'age_on_1_october_requires_confirmation');
  }

  const transfer =
    applicant.applicant_identity?.medical_student_transfer === true ||
    applicant.transfer_profile?.medical_course_transfer === true;
  addCheck(state, 'medical_student_transfer_not_requested', !transfer);
  if (transfer) {
    addFailure(state, 'medical_student_transfers_not_accepted');
  }
}

function evaluateOfficialEligibility(course, applicantInput) {
  const applicant = normaliseApplicantProfile(applicantInput, { course });
  const applicantGroupIds = deriveApplicantGroupIds(applicant);
  const flags = routeFlags(applicant, applicantGroupIds);
  let qualificationRoute = flags.graduate
    ? 'graduate'
    : deriveQualificationRoute(applicant);
  if (
    qualificationRoute === 'unknown' &&
    applicant.international_qualification
  ) {
    qualificationRoute = 'international_qualification';
  }
  const state = {
    applicant_group_ids: applicantGroupIds,
    qualification_route: qualificationRoute,
    route_flags: flags,
    checks: [],
    failures: [],
    manual_review_reasons: [],
    future_conditions: []
  };

  if (!flags.graduate) {
    evaluateGcse(applicant, state);
  }

  if (qualificationRoute === 'a_level') {
    evaluateALevel(course, applicant, state);
  } else if (qualificationRoute === 'graduate') {
    evaluateGraduate(applicant, state);
  } else if (qualificationRoute === 'international_baccalaureate') {
    evaluateIb(applicant, state);
  } else if (qualificationRoute === 'scottish') {
    evaluateScottish(applicant, state);
  } else if (qualificationRoute === 'international_qualification') {
    const qualification = applicant.international_qualification || {};
    if (
      qualification.verified_by_institution === true &&
      qualification.equivalence_status === 'verified' &&
      qualification.requirements_met === true
    ) {
      addCheck(state, 'international_qualification_equivalence', true);
    } else {
      addManualReview(state, 'international_qualification_requires_hyms_review');
    }
  } else {
    addManualReview(state, `qualification_route_not_automated:${qualificationRoute}`);
  }

  evaluateResits(applicant, state, qualificationRoute);
  evaluateInternationalEnglish(applicant, state, flags);
  evaluateAdmissionsTests(applicant, state);
  evaluateAgeAndTransfer(course, applicant, state);

  const status = state.failures.length > 0
    ? 'not_eligible'
    : state.manual_review_reasons.length > 0
      ? 'manual_review'
      : 'eligible';

  return {
    ...state,
    status,
    message:
      status === 'eligible'
        ? 'The applicant meets every supported official HYMS eligibility rule represented by the supplied evidence.'
        : status === 'not_eligible'
          ? 'One or more published HYMS entry requirements are not met.'
          : 'HYMS eligibility needs manual review because required route evidence is missing or needs verification.'
  };
}

function contextualCriteria(applicant) {
  const flags = applicant.applicant_identity?.contextual_flags || {};
  const criteria = new Set();
  const directFlags = [
    'care_experienced',
    'refugee',
    'military_family',
    'gypsy_roma_traveller',
    'ucat_bursary',
    'recognised_wp_programme',
    'school_below_progress_8',
    'first_generation_higher_education'
  ];
  for (const flag of directFlags) {
    if (flags[flag] === true) {
      criteria.add(flag);
    }
  }
  if (flags.wp_programme_completed === true) {
    criteria.add('recognised_wp_programme');
  }
  if (flags.school_contextual_indicator === true) {
    criteria.add('school_below_progress_8');
  }
  if (flags.first_generation_university === true) {
    criteria.add('first_generation_higher_education');
  }
  const polar = Number(flags.polar4_quintile ?? flags.polar_quintile);
  if (polar === 1) {
    criteria.add('polar4_quintile_1');
  } else if (polar === 2) {
    criteria.add('polar4_quintile_2');
  }
  return [...criteria];
}

function contextualEstimate(config, applicant, eligibility) {
  const model = config.score_model?.estimate_mode?.contextual;
  if (!model) {
    throw new Error('HYMS contextual estimate configuration is missing.');
  }

  const flags = eligibility.route_flags;
  const applicable =
    flags.home &&
    flags.school_leaver &&
    !flags.international &&
    !flags.graduate &&
    !flags.prior_university;
  const criteria = contextualCriteria(applicant);
  const officialMinimumCriteria =
    model.official_contextual_minimum_criteria ?? 2;
  const officialEligibilityMet =
    applicable && criteria.length >= officialMinimumCriteria;
  const rawPoints = applicable
    ? criteria.reduce((total, criterion) => {
      return total + Number(model.points_by_flag?.[criterion] || 0);
    }, 0)
    : 0;
  const cap = Number(model.cap ?? 15);
  const points = Math.min(rawPoints, cap);

  return {
    applicable,
    points,
    raw_points_before_cap: rawPoints,
    cap,
    cap_applied: rawPoints > cap,
    criteria,
    official_contextual_eligibility: {
      minimum_criteria: officialMinimumCriteria,
      criteria_count: criteria.length,
      met_from_supplied_flags: officialEligibilityMet,
      university_verification_required: true
    },
    excluded_reason:
      applicable
        ? null
        : flags.international
          ? 'international_applicant'
          : flags.graduate
            ? 'graduate_applicant'
            : flags.prior_university
              ? 'prior_university_applicant'
              : !flags.home
                ? 'not_home_fee_status'
                : 'not_school_leaver',
    evidence_classification: 'unofficial_third_party_estimate',
    disclosure: APPLYSMART_HYMS_ANALYSIS_DISCLOSURE
  };
}

function scoreGcse(config, applicant) {
  const model = config.score_model?.estimate_mode?.components?.gcse;
  const points = model?.points_by_grade || {};
  const grades = expandedGcseGrades(applicant)
    .map(normaliseGrade)
    .sort((left, right) => {
      return (GCSE_GRADE_RANK[right] ?? -1) - (GCSE_GRADE_RANK[left] ?? -1);
    })
    .slice(0, model?.subject_count ?? 6);
  if (grades.length < (model?.subject_count ?? 6)) {
    return {
      value: null,
      max: model?.max ?? 35,
      reason: 'insufficient_gcse_results_for_estimate'
    };
  }
  const values = grades.map((grade) => points[grade]);
  if (!values.every(Number.isFinite)) {
    return {
      value: null,
      max: model?.max ?? 35,
      reason: 'unsupported_gcse_grade_for_estimate',
      grades
    };
  }
  return {
    value: Math.min(round(values.reduce((total, value) => total + value, 0)), model.max),
    max: model.max,
    grades,
    evidence_classification: 'unofficial_third_party_estimate'
  };
}

function scoreUcat(config, applicant, options) {
  const model = config.score_model?.estimate_mode?.components?.ucat;
  const result = resolveUcatDecile(
    applicant.admissions_tests?.ucat?.total_score,
    {
      courseProfileId: 'hull-york-a100',
      decileData: options.ucatDecileData,
      universityDecileData: null
    }
  );
  const value = model?.points_by_national_decile?.[result.national_decile];
  return {
    value: Number.isFinite(value) ? value : null,
    max: model?.max ?? 35,
    national_decile: result.national_decile,
    lookup_source: result.lookup_source,
    reason: Number.isFinite(value) ? null : 'ucat_decile_estimate_unavailable',
    evidence_classification: 'unofficial_third_party_estimate'
  };
}

function scoreSjt(config, applicant) {
  const model = config.score_model?.estimate_mode?.components?.sjt;
  const band = applicant.admissions_tests?.ucat?.sjt_band;
  const value = model?.points_by_band?.[band];
  return {
    value: Number.isFinite(value) ? value : null,
    max: model?.max ?? 15,
    band,
    reason: Number.isFinite(value) ? null : 'sjt_estimate_unavailable',
    evidence_classification: 'unofficial_third_party_estimate'
  };
}

function recommendationBand(config, applicant, eligibility, score) {
  if (eligibility.status === 'not_eligible') {
    return 'not_eligible';
  }
  if (eligibility.status !== 'eligible' || score.status !== 'calculated') {
    return 'insufficient_evidence';
  }

  if (
    eligibility.route_flags.graduate ||
    eligibility.route_flags.prior_university
  ) {
    return 'insufficient_evidence';
  }

  if (eligibility.route_flags.international) {
    const threshold =
      config.score_model?.estimate_mode?.international_guidance
        ?.possible_ucat_total_minimum;
    return Number(applicant.admissions_tests?.ucat?.total_score) >= threshold
      ? 'ambitious'
      : 'high_risk';
  }

  const value = score.value;
  const rules = config.score_model?.estimate_mode?.home_recommendation_bands || [];
  return rules.find((rule) => {
    return value >= (rule.min ?? -Infinity) && value <= (rule.max ?? Infinity);
  })?.band || 'insufficient_evidence';
}

function estimateSelectionScore(course, config, applicant, eligibility, options = {}) {
  const contextual = contextualEstimate(config, applicant, eligibility);
  if (eligibility.status !== 'eligible') {
    return {
      label: APPLYSMART_HYMS_SCORE_LABEL,
      status: 'not_applied',
      value: null,
      max: contextual.applicable ? 100 : 85,
      components: {},
      contextual,
      evidence_classification: 'unofficial_third_party_estimate',
      official: false,
      deterministic: false,
      disclosure: APPLYSMART_HYMS_ANALYSIS_DISCLOSURE
    };
  }

  const components = {
    gcse: scoreGcse(config, applicant),
    ucat: scoreUcat(config, applicant, options),
    sjt: scoreSjt(config, applicant),
    contextual: {
      value: contextual.points,
      max: contextual.cap,
      applicable: contextual.applicable,
      excluded_reason: contextual.excluded_reason,
      evidence_classification: contextual.evidence_classification
    }
  };
  const componentValues = Object.values(components).map((component) => component.value);
  const available = componentValues.every(Number.isFinite);
  const max = contextual.applicable ? 100 : 85;

  return {
    label: APPLYSMART_HYMS_SCORE_LABEL,
    status: available ? 'calculated' : 'unavailable',
    value: available
      ? round(componentValues.reduce((total, value) => total + value, 0))
      : null,
    max,
    components,
    contextual,
    evidence_classification: 'unofficial_third_party_estimate',
    official: false,
    deterministic: false,
    disclosure: APPLYSMART_HYMS_ANALYSIS_DISCLOSURE
  };
}

function evaluateHullYorkA100(course, config, applicantInput, options = {}) {
  if (course?.profile_id !== 'hull-york-a100') {
    throw new TypeError('The HYMS A100 consumer requires the hull-york-a100 profile.');
  }
  if (config?.course_profile_id !== 'hull-york-a100') {
    throw new TypeError('The HYMS A100 consumer requires the hull-york-a100 estimate configuration.');
  }
  if (!applicantInput) {
    throw new TypeError('An applicant profile is required.');
  }

  const applicant = normaliseApplicantProfile(applicantInput, { course });
  const eligibility = evaluateOfficialEligibility(course, applicant);
  const estimatedSelectionScore = estimateSelectionScore(
    course,
    config,
    applicant,
    eligibility,
    options
  );
  const canonicalInterviewBand = recommendationBand(
    config,
    applicant,
    eligibility,
    estimatedSelectionScore
  );
  const recommendation = RECOMMENDATION_BY_BAND[canonicalInterviewBand];
  const explanation =
    canonicalInterviewBand === 'not_eligible'
      ? 'One or more published HYMS entry requirements are not met, so ApplySmart does not calculate an interview-competitiveness score for this applicant.'
      : canonicalInterviewBand === 'insufficient_evidence'
        ? 'ApplySmart cannot provide a confident interview-competitiveness analysis for this applicant route because the available admissions evidence is not sufficient for this profile.'
        : `${estimatedSelectionScore.label} ${estimatedSelectionScore.value}/${estimatedSelectionScore.max} supports the "${recommendation}" band. ${estimatedSelectionScore.disclosure}`;

  return {
    course_profile_id: course.profile_id,
    applicant_profile_id: applicant.profile_id || null,
    mode: 'official_eligibility_with_hyms_specific_unofficial_estimate',
    eligibility,
    official_selection_framework: {
      ranking_method: 'numerical_ranking',
      components: {
        gcse_best_six: 35,
        ucat_decile: 35,
        sjt: 15,
        contextual_maximum: 15
      },
      total_maximum: 100,
      exact_tariffs_published: false,
      fixed_interview_cutoff_published: false
    },
    estimated_selection_score: estimatedSelectionScore,
    canonical_interview_band: canonicalInterviewBand,
    recommendation,
    confidence: 'low',
    evidence_basis: config.evidence,
    explanation,
    warnings: [
      'HYMS exact points tariffs are unpublished.',
      'The estimate uses unofficial third-party assumptions.',
      'Historical cut-offs are incomplete and must not be treated as current thresholds.'
    ],
    safeguards: {
      generic_classifier_used: false,
      official_eligibility_separate_from_estimate: true,
      contextual_points_home_school_leavers_only: true,
      international_contextual_points_disabled: true,
      graduate_contextual_points_disabled: true,
      prior_university_contextual_points_disabled: true,
      offer_prediction_scope: 'out_of_scope'
    }
  };
}

function buildHullYorkA100ResultCard(course, config, applicant, options = {}) {
  const evaluation = evaluateHullYorkA100(course, config, applicant, options);
  const band = evaluation.canonical_interview_band;
  const score = evaluation.estimated_selection_score;
  const route = evaluation.eligibility.route_flags;
  const displayState =
    band === 'not_eligible'
      ? 'not_eligible'
      : band === 'insufficient_evidence'
        ? 'insufficient_evidence'
        : 'standard';
  const primaryRecommendation =
    band === 'not_eligible'
      ? 'You do not currently meet the published entry requirements'
      : band === 'insufficient_evidence'
        ? 'Evidence not yet available'
        : {
          interview_likely: `${CANONICAL_BAND_LABELS.interview_likely} based on ApplySmart analysis`,
          realistic: `${CANONICAL_BAND_LABELS.realistic} based on ApplySmart analysis`,
          ambitious: `${CANONICAL_BAND_LABELS.ambitious} based on ApplySmart analysis`,
          high_risk: `${CANONICAL_BAND_LABELS.high_risk} based on ApplySmart analysis`
        }[band];
  const pool = route.international
    ? 'International applicants'
    : route.graduate
      ? 'Graduate applicants to A100'
      : route.prior_university
        ? 'Home applicants with prior university study'
        : score.contextual.applicable
          ? 'Home UK school-leavers'
          : 'Supported HYMS A100 applicants';
  const futureConditions = Array.isArray(evaluation.eligibility.future_conditions)
    ? evaluation.eligibility.future_conditions
    : [];
  const futureAdvisories = futureConditionAdvisories(futureConditions, {
    universityName: course.university?.name
  });
  const academicRequirementChecks = buildAcademicRequirementChecks(
    evaluation.eligibility.checks,
    evaluation.eligibility.status,
    {
      academic_pathway: evaluation.eligibility.academic_pathway || null,
      academic_pathway_id: evaluation.eligibility.academic_pathway_id ?? null,
      has_epq_alternative_offer:
        course.stage_1_eligibility?.post_16?.a_level?.epq_alternative_offer?.enabled === true
    }
  );
  const card = {
    schema_version: '1.0.0',
    template_version: '0.1.0',
    result_id: `hyms-${applicant.profile_id || 'applicant'}-estimate`,
    generated_at: null,
    result_mode: 'official_eligibility_with_hyms_specific_unofficial_estimate',
    course_identity: {
      profile_id: course.profile_id,
      university_name: course.university.name,
      course_name: course.course.name,
      ucas_code: course.course.ucas_code
    },
    applicant_context: {
      profile_id: applicant.profile_id || null,
      applies_to_group_ids: evaluation.eligibility.applicant_group_ids,
      qualification_route: evaluation.eligibility.qualification_route,
      fee_cohort: route.international ? 'international' : route.home ? 'home' : 'unknown',
      contextual: score.contextual.criteria.length > 0,
      graduate: route.graduate,
      prior_university: route.prior_university,
      applicant_summary: `Applicant assessed in the ${pool} route.`
    },
    readiness: {
      ...course.engine_notes
    },
    eligibility: {
      status: evaluation.eligibility.status,
      summary: evaluation.eligibility.message,
      stage_1_checks: evaluation.eligibility.checks,
      blocking_reasons: evaluation.eligibility.failures,
      manual_review_reasons: evaluation.eligibility.manual_review_reasons,
      academic_pathway: evaluation.eligibility.academic_pathway || null,
      academic_pathway_id: evaluation.eligibility.academic_pathway_id ?? null,
      future_conditions: futureConditions
    },
    academic_pathway: evaluation.eligibility.academic_pathway || null,
    academic_pathway_id: evaluation.eligibility.academic_pathway_id ?? null,
    alternative_academic_offer: buildAlternativeAcademicOffer(course.stage_1_eligibility),
    future_conditions: futureConditions,
    future_condition_advisories: futureAdvisories,
    academic_requirement_checks: academicRequirementChecks,
    trust_statement: futureAdvisories[0] || null,
    stage_2_selection: {
      summary: APPLYSMART_HYMS_SELECTION_SUMMARY
    },
    prediction: {
      available: !['not_eligible', 'insufficient_evidence'].includes(band),
      capability: 'interview',
      prediction_type: 'unofficial_third_party_estimate',
      result_band: band,
      score: score.value,
      score_label: score.label,
      score_scale: {
        min: 0,
        max: score.max
      },
      confidence_level: 'low',
      deterministic: false,
      fixed_current_cutoff: false,
      cannot_predict_explanation:
        band === 'insufficient_evidence' ? evaluation.explanation : null
    },
    estimated_selection_score: score,
    mandatory_unofficial_estimate_disclosure: score.disclosure,
    confidence: {
      level: 'low',
      summary: 'ApplySmart separates published eligibility checks from its evidence-based interview-competitiveness analysis for HYMS.',
      stage_confidence: {
        eligibility: 'high_for_supported_routes',
        official_selection_framework: 'high',
        estimate_tariffs: 'low',
        recommendation_bands: 'low'
      },
      source_ids: config.evidence.source_ids
    },
    display: {
      headline: score.label,
      score_label: score.label,
      primary_user_facing_recommendation: primaryRecommendation,
      recommendation_display_state: displayState,
      primary_explanation: evaluation.explanation,
      historical_guidance_caveat:
        displayState === 'standard'
          ? "This analysis guides interview competitiveness and should be read alongside HYMS's published admissions policy; it is not a guarantee of interview."
          : null,
      mandatory_disclosure: score.disclosure
    },
    engine_notes: {
      generated_from_profile_id: course.profile_id,
      dedicated_adapter: 'hull_york_a100_consumer',
      generic_classifier_used: false,
      offer_prediction_scope: 'out_of_scope'
    }
  };
  card.evidence_confidence = buildEvidenceConfidence(card);
  card.decision_timeline = buildDecisionTimeline(card);
  card.decision_transparency = buildDecisionTransparency(card);
  return card;
}

module.exports = {
  buildHullYorkA100ResultCard,
  contextualCriteria,
  evaluateHullYorkA100,
  evaluateOfficialEligibility,
  estimateSelectionScore
};
