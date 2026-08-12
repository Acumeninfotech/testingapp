const {
  deriveApplicantGroupIds,
  deriveQualificationRoute,
  evaluateContextualEligibility
} = require('./eligibility-evaluator');
const {
  classifyNottinghamA100InterviewGuidance
} = require('./nottingham-a100-interview-guidance');
const {
  evaluateExplicitMinimumAge,
  isUcatCycleValid,
  normaliseApplicantProfile
} = require('./applicant-profile-normaliser');
const {
  assessPracticalEndorsements
} = require('./science-practical-endorsement');

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
  'citizenship_studies',
  'critical_thinking',
  'general_studies',
  'global_perspectives'
]);

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

function parseDoubleGrade(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 2);
  }

  const text = normaliseGrade(value);
  if (/^[1-9][1-9]$/.test(text) || /^[A-G][A-G]$/.test(text)) {
    return text.split('');
  }

  return text.split(/[\/, +]+/).filter(Boolean).slice(0, 2);
}

function gradeMeets(actual, minimum, ranks) {
  return (ranks[normaliseGrade(actual)] ?? -1) >= (ranks[normaliseGrade(minimum)] ?? Infinity);
}

function sortedGradeProfileMeets(actualGrades, requiredGrades, ranks) {
  const actual = actualGrades
    .map((grade) => ranks[normaliseGrade(grade)])
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const required = requiredGrades
    .map((grade) => ranks[normaliseGrade(grade)])
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  return actual.length >= required.length &&
    required.every((value, index) => actual[index] >= value);
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

function countGcseGrades(subjectGrades) {
  return Object.entries(subjectGrades).flatMap(([subjectId, grade]) => {
    return ['combined_science', 'double_science'].includes(subjectId)
      ? parseDoubleGrade(grade)
      : [grade];
  });
}

function countScoreableGcseGrades(subjectGrades) {
  return countGcseGrades(subjectGrades)
    .filter((grade) => gcsePointValue(grade) !== null)
    .length;
}

function evaluateGcseEligibility(applicant, state) {
  if (applicant.has_gcse_or_equivalent_results === false) {
    if (countGcseGrades(profileToSubjectMap(applicant.gcse_profile)).length > 0) {
      addManualReview(state, 'no_gcse_route_conflicts_with_supplied_gcse_results');
    }
    addCheck(state, 'gcse_or_equivalent_results', true, {
      outcome: 'official_no_gcse_scoring_route'
    });
    return;
  }

  const subjects = profileToSubjectMap(applicant.gcse_profile);
  const grades = countGcseGrades(subjects);
  if (grades.length === 0) {
    addManualReview(state, 'gcse_or_equivalent_evidence_missing');
    return;
  }

  const sixAtSeven = grades.filter((grade) => {
    return gradeMeets(grade, '7', GCSE_GRADE_RANK);
  }).length >= 6;
  addCheck(state, 'six_gcses_at_grade_7_or_A', sixAtSeven);
  if (!sixAtSeven) {
    addFailure(state, 'minimum_six_gcses_at_grade_7_or_A_not_met');
  }

  const doubleScience = parseDoubleGrade(
    subjects.combined_science ?? subjects.double_science
  );
  const separateSciencesPassed =
    gradeMeets(subjects.biology ?? subjects.human_biology, '7', GCSE_GRADE_RANK) &&
    gradeMeets(subjects.chemistry, '7', GCSE_GRADE_RANK);
  const doubleSciencePassed =
    doubleScience.length === 2 &&
    doubleScience.every((grade) => gradeMeets(grade, '7', GCSE_GRADE_RANK));
  const sciencePassed = separateSciencesPassed || doubleSciencePassed;
  addCheck(state, 'gcse_biology_and_chemistry_or_double_science', sciencePassed);
  if (!sciencePassed) {
    addFailure(state, 'gcse_science_requirement_not_met');
  }

  for (const [subjectId, minimum] of [
    ['mathematics', '6'],
    ['english_language', '6']
  ]) {
    const passed = gradeMeets(subjects[subjectId], minimum, GCSE_GRADE_RANK);
    const officialAlternativeDeclared =
      subjectId === 'english_language' &&
      Boolean(
        applicant.english_language_profile?.test ||
        applicant.english_language_profile?.test_name
      );
    addCheck(
      state,
      `gcse_${subjectId}_minimum`,
      passed || officialAlternativeDeclared,
      {
        official_alternative_declared: officialAlternativeDeclared
      }
    );
    if (!passed && !officialAlternativeDeclared) {
      addFailure(state, `gcse_requirement_not_met:${subjectId}`);
    }
  }
}

function evaluateALevelRoute(course, applicant, state) {
  const subjects = profileToSubjectMap(applicant.a_level_profile);
  const countableGrades = Object.entries(subjects)
    .filter(([subjectId]) => !EXCLUDED_A_LEVEL_SUBJECTS.has(subjectId))
    .map(([, grade]) => grade);
  const activeRoute = activeALevelRequirementForContextualState(state.contextual_eligibility);
  const profilePassed = sortedGradeProfileMeets(
    countableGrades,
    activeRoute.gradeProfile,
    A_LEVEL_GRADE_RANK
  );
  const biologyGrade = subjects.biology ?? subjects.human_biology;
  const biologyPassed = gradeMeets(biologyGrade, activeRoute.minimumScienceGrade, A_LEVEL_GRADE_RANK);
  const chemistryPassed = gradeMeets(subjects.chemistry, activeRoute.minimumScienceGrade, A_LEVEL_GRADE_RANK);
  const biologyOrChemistryA =
    gradeMeets(biologyGrade, 'A', A_LEVEL_GRADE_RANK) ||
    gradeMeets(subjects.chemistry, 'A', A_LEVEL_GRADE_RANK);
  const sciencesPassed =
    biologyPassed &&
    chemistryPassed &&
    (
      activeRoute.requiresBothSciencesAtA ||
      biologyOrChemistryA
    );
  const practicalAssessment = assessPracticalEndorsements(course, null, applicant);
  const practicalsPassed = practicalAssessment.passed;
  const sittingPassed =
    applicant.a_level_profile?.completed_in_one_sitting !== false &&
    (
      !Number.isFinite(applicant.a_level_profile?.study_period_years) ||
      applicant.a_level_profile.study_period_years <= 2
    );
  const passed = profilePassed && sciencesPassed && practicalsPassed && sittingPassed;

  addCheck(state, 'a_level_AAA_biology_chemistry', passed, {
    check_id: activeRoute.checkId,
    academic_pathway: activeRoute.academicPathway,
    pathway_id: activeRoute.pathwayId,
    required: activeRoute.gradeProfile.join(''),
    actual: countableGrades.map(normaliseGrade).join(''),
    grade_profile_met: profilePassed,
    required_sciences_met: sciencesPassed,
    biology_or_human_biology_minimum_met: biologyPassed,
    chemistry_minimum_met: chemistryPassed,
    biology_or_chemistry_A_met: biologyOrChemistryA,
    practical_endorsements_met: practicalsPassed,
    practical_endorsement_subject_ids:
      practicalAssessment.applicable_subject_ids,
    unconfirmed_practical_endorsement_subject_ids:
      practicalAssessment.unconfirmed_subject_ids,
    sitting_policy_met: sittingPassed
  });
  if (passed) {
    state.academic_pathway = activeRoute.academicPathway;
    state.academic_pathway_id = activeRoute.pathwayId;
  } else {
    state.academic_pathway = state.academic_pathway || activeRoute.academicPathway;
    state.academic_pathway_id = state.academic_pathway_id || activeRoute.pathwayId;
  }
  if (!passed) {
    addFailure(state, 'a_level_requirements_not_met');
  }
}

function activeALevelRequirementForContextualState(contextualEligibility = null) {
  if (contextualEligibility?.matched_contextual_pathway === 'nottingham_enhanced_contextual') {
    return {
      checkId: 'a_level_nottingham_enhanced_contextual_ABB_biology_chemistry_one_A',
      academicPathway: 'contextual',
      pathwayId: 'nottingham_enhanced_contextual_abb_offer',
      gradeProfile: ['A', 'B', 'B'],
      minimumScienceGrade: 'B',
      requiresBothSciencesAtA: false
    };
  }

  if (contextualEligibility?.matched_contextual_pathway === 'nottingham_standard_contextual') {
    return {
      checkId: 'a_level_nottingham_standard_contextual_AAB_biology_chemistry_one_A',
      academicPathway: 'contextual',
      pathwayId: 'nottingham_standard_contextual_aab_offer',
      gradeProfile: ['A', 'A', 'B'],
      minimumScienceGrade: 'B',
      requiresBothSciencesAtA: false
    };
  }

  return {
    checkId: 'a_level_AAA_biology_chemistry',
    academicPathway: 'standard',
    pathwayId: 'nottingham_standard_aaa_offer',
    gradeProfile: ['A', 'A', 'A'],
    minimumScienceGrade: 'A',
    requiresBothSciencesAtA: true
  };
}

function evaluateIbRoute(applicant, state) {
  const profile = applicant.ib_profile || {};
  const hl = profileToSubjectMap({
    subjects: profile.higher_level_subjects || profile.hl_subjects || profile.subjects || []
  });
  const requiredSubjectsPassed =
    Number(hl.biology) >= 6 &&
    Number(hl.chemistry) >= 6;
  const fullDiplomaPassed =
    Number(profile.total_points) >= 34 &&
    requiredSubjectsPassed;
  const certificatesPassed =
    profile.three_higher_level_certificates === true &&
    sortedGradeProfileMeets(Object.values(hl), [6, 6, 6], GCSE_GRADE_RANK) &&
    requiredSubjectsPassed;
  const passed = fullDiplomaPassed || certificatesPassed;

  addCheck(state, 'ib_34_with_HL_6_biology_chemistry_or_666_certificates', passed);
  if (!passed) {
    addFailure(state, 'ib_requirements_not_met');
  }
}

function evaluateGraduateRoute(applicant, state) {
  const graduate = applicant.graduate_profile || {};
  const degreeRank = DEGREE_RANK[normaliseId(
    graduate.degree_classification ?? graduate.classification
  )] || 0;
  const mastersMerit = ['merit', 'distinction'].includes(
    normaliseId(graduate.taught_masters_classification)
  );
  const degreePassed = degreeRank >= DEGREE_RANK['2_1'] ||
    (degreeRank >= DEGREE_RANK['2_2'] && mastersMerit);
  const mathematicsPassed =
    gradeMeets(
      profileToSubjectMap(applicant.gcse_profile).mathematics,
      '6',
      GCSE_GRADE_RANK
    ) ||
    graduate.mathematics_equivalence_verified === true;

  let biologyPassed = true;
  if (graduate.sufficient_biology_content === false) {
    biologyPassed = gradeMeets(
      profileToSubjectMap(applicant.a_level_profile).biology,
      'B',
      A_LEVEL_GRADE_RANK
    );
  } else if (graduate.sufficient_biology_content !== true) {
    addManualReview(state, 'graduate_degree_biology_content_requires_confirmation');
  }

  const naturalLengthPassed = graduate.completed_in_natural_length !== false;
  const applicationRestrictionPassed = graduate.applied_to_a101_same_cycle !== true;
  const passed =
    degreePassed &&
    mathematicsPassed &&
    biologyPassed &&
    naturalLengthPassed &&
    applicationRestrictionPassed;
  addCheck(state, 'graduate_A100_requirements', passed, {
    degree_profile_met: degreePassed,
    mathematics_met: mathematicsPassed,
    biology_content_or_A_level_met: biologyPassed,
    natural_length_met: naturalLengthPassed,
    A100_or_A101_same_cycle_rule_met: applicationRestrictionPassed
  });
  if (!passed) {
    addFailure(state, 'graduate_A100_requirements_not_met');
  }
}

function evaluateInternationalRoute(applicant, state) {
  const evidence = applicant.international_qualification || {};
  if (
    evidence.verified_by_institution !== true ||
    evidence.equivalence_status !== 'verified'
  ) {
    addManualReview(state, 'international_qualification_requires_nottingham_review');
    return;
  }

  const transcriptSubjects = new Set(
    (evidence.transcript_subject_ids || []).map(normaliseId)
  );
  const transcriptPassed =
    evidence.requirements_met === true &&
    (evidence.transcript_subject_count ?? 0) >= 6 &&
    ['biology', 'chemistry', 'mathematics', 'english_language'].every((subjectId) => {
      return transcriptSubjects.has(subjectId);
    });
  addCheck(state, 'international_transcript_equivalence', transcriptPassed);
  if (!transcriptPassed) {
    addFailure(state, 'international_transcript_requirements_not_met');
  }
}

function evaluateQualificationRoute(course, applicant, state) {
  if (state.qualification_route === 'a_level') {
    evaluateALevelRoute(course, applicant, state);
  } else if (['international_baccalaureate', 'ib'].includes(state.qualification_route)) {
    evaluateIbRoute(applicant, state);
  } else if (state.qualification_route === 'graduate') {
    evaluateGraduateRoute(applicant, state);
  } else if (state.qualification_route === 'international_qualification') {
    evaluateInternationalRoute(applicant, state);
  } else if (['btec', 'access_to_he', 'access'].includes(state.qualification_route)) {
    addFailure(state, `qualification_route_not_accepted:${state.qualification_route}`);
  } else if (
    ['scottish', 'scottish_advanced_highers', 'welsh', 'irish', 'irish_leaving_certificate']
      .includes(state.qualification_route)
  ) {
    addManualReview(state, 'qualification_route_is_confirmed_research_gap');
  } else {
    addManualReview(state, `unsupported_or_unlisted_qualification_route:${state.qualification_route}`);
  }
}

function evaluateAge(course, applicant, state) {
  const result = evaluateExplicitMinimumAge(course, applicant);
  if (result.status === 'not_applicable') {
    return;
  }
  if (result.status === 'not_assessed') {
    state.checks.push({
      check_id: 'minimum_age_requirement',
      status: 'not_assessed_non_blocking',
      age: null,
      minimum: result.minimum_age
    });
    return;
  }

  const passed = result.status === 'pass';
  addCheck(state, 'minimum_age_requirement', passed, {
    age: result.age,
    minimum: result.minimum_age
  });
  if (!passed) {
    addFailure(state, 'minimum_age_requirement_not_met');
  }
}

function evaluateResits(applicant, state) {
  const resit = applicant.resit_profile || applicant.applicant_identity?.resit || {};
  if (resit !== true && resit.has_resits !== true) {
    return;
  }

  const resitLevel = normaliseId(
    resit.qualification_level ||
    resit.level ||
    (state.qualification_route === 'a_level' ? 'a_level' : 'gcse')
  );
  if (resitLevel === 'a_level') {
    const firstSitting = resit.first_sitting_grade_profile || [];
    const firstSubjects = profileToSubjectMap({
      subjects: resit.first_sitting_subjects || []
    });
    const biologyOrChemistryA =
      gradeMeets(firstSubjects.biology ?? firstSubjects.human_biology, 'A', A_LEVEL_GRADE_RANK) ||
      gradeMeets(firstSubjects.chemistry, 'A', A_LEVEL_GRADE_RANK);
    const passed =
      (resit.subjects_resat || []).length <= 2 &&
      resit.completed_within_last_12_months === true &&
      sortedGradeProfileMeets(firstSitting, ['A', 'B', 'B'], A_LEVEL_GRADE_RANK) &&
      biologyOrChemistryA;
    addCheck(state, 'a_level_resit_policy', passed);
    if (!passed) {
      addFailure(state, 'a_level_resit_policy_not_met');
    }
    return;
  }

  if (resitLevel !== 'gcse') {
    addManualReview(state, 'unlisted_resit_qualification_level');
    return;
  }

  const permittedSubjects = new Set([
    'mathematics',
    'english_language',
    'biology',
    'human_biology',
    'chemistry',
    'double_science',
    'combined_science'
  ]);
  const subjectsResat = (resit.subjects_resat || []).map(normaliseId);
  const passed =
    subjectsResat.length === 1 &&
    subjectsResat.every((subjectId) => permittedSubjects.has(subjectId));
  addCheck(state, 'gcse_resit_policy', passed);
  if (!passed) {
    addFailure(state, 'gcse_resit_policy_not_met');
  }
}

function evaluateEnglishLanguage(applicant, state) {
  if (applicant.english_language_equivalence_verified === true) {
    addCheck(state, 'english_language_requirement', true, {
      route: 'Nottingham_verified_equivalence'
    });
    return;
  }

  const gcseEnglish = profileToSubjectMap(applicant.gcse_profile).english_language;
  if (gradeMeets(gcseEnglish, '6', GCSE_GRADE_RANK)) {
    addCheck(state, 'english_language_requirement', true, {
      route: 'gcse_english_language'
    });
    return;
  }

  const evidence = applicant.english_language_profile || {};
  const test = normaliseId(evidence.test ?? evidence.test_name);
  const scores = evidence.scores || evidence.components || {};
  const componentValues = [
    scores.reading,
    scores.writing,
    scores.listening,
    scores.speaking
  ].filter(Number.isFinite);
  const testRules = {
    ielts: [7.5, 7],
    ielts_academic: [7.5, 7],
    pte_academic: [79, 76],
    cambridge_proficiency: [191, 185],
    cambridge_advanced: [191, 185]
  };
  const rule = testRules[test];
  const ibEnglishRules = {
    ib_english_a: 5,
    ib_english_b_standard_level: 6,
    ib_english_b_higher_level: 5
  };
  if (ibEnglishRules[test]) {
    const passed = Number(evidence.grade) >= ibEnglishRules[test];
    addCheck(state, 'english_language_requirement', passed, {
      route: test
    });
    if (!passed) {
      addFailure(state, 'english_language_requirement_not_met');
    }
    return;
  }
  if (!rule) {
    addManualReview(state, 'english_language_alternative_requires_review');
    return;
  }

  const passed =
    Number(evidence.overall ?? scores.overall) >= rule[0] &&
    componentValues.length === 4 &&
    componentValues.every((value) => value >= rule[1]) &&
    evidence.valid_at_course_start !== false;
  addCheck(state, 'english_language_requirement', passed, {
    route: test
  });
  if (!passed) {
    addFailure(state, 'english_language_requirement_not_met');
  }
}

function evaluateAdmissionsTest(applicant, state) {
  const ucat = applicant.admissions_tests?.ucat || {};
  if (ucat.taken === false) {
    addFailure(state, 'required_admissions_test_missing:ucat');
    return;
  }
  const raw = ucat.subtests || ucat.cognitive_subtests || {};
  const cognitiveScores = [
    raw.verbal_reasoning ?? ucat.verbal_reasoning,
    raw.quantitative_reasoning ?? ucat.quantitative_reasoning,
    raw.decision_making ?? ucat.decision_making
  ];
  if (ucat.taken !== true && !cognitiveScores.every(Number.isFinite)) {
    addManualReview(state, 'ucat_evidence_missing');
  }
  if (
    Number.isInteger(applicant.application_year) &&
    Number.isInteger(ucat.test_year) &&
    !isUcatCycleValid(applicant.application_year, ucat.test_year)
  ) {
    addFailure(state, 'ucat_not_taken_in_application_year');
  } else if (!Number.isInteger(ucat.test_year) || !Number.isInteger(applicant.application_year)) {
    addManualReview(state, 'ucat_application_cycle_requires_confirmation');
  }

  if (![1, 2, 3, 4].includes(ucat.sjt_band)) {
    addManualReview(state, 'sjt_band_missing_or_invalid');
  } else if (ucat.sjt_band === 4) {
    addFailure(state, 'sjt_band_4_excludes_interview');
  } else {
    addCheck(state, 'sjt_band_1_to_3', true, {
      band: ucat.sjt_band
    });
  }
}

function applicantGroupIdsWithContextualEligibility(applicant, contextualEligibility = null) {
  const groups = new Set(deriveApplicantGroupIds(applicant));
  if (contextualEligibility?.is_contextual === true) {
    for (const groupId of contextualEligibility.activated_applicant_group_ids || []) {
      groups.add(groupId);
    }
  }
  return [...groups];
}

function evaluateEligibility(course, applicant, contextualEligibility = null) {
  const state = {
    status: null,
    qualification_route: deriveQualificationRoute(applicant),
    applicant_group_ids: applicantGroupIdsWithContextualEligibility(applicant, contextualEligibility),
    contextual_eligibility: contextualEligibility,
    checks: [],
    failures: [],
    manual_review_reasons: []
  };

  evaluateGcseEligibility(applicant, state);
  evaluateQualificationRoute(course, applicant, state);
  evaluateAge(course, applicant, state);
  evaluateResits(applicant, state);
  evaluateEnglishLanguage(applicant, state);
  evaluateAdmissionsTest(applicant, state);

  state.status = state.failures.length
    ? 'not_eligible'
    : state.manual_review_reasons.length
      ? 'manual_review'
      : 'eligible';
  state.message = {
    eligible: 'The applicant meets every supported Nottingham eligibility rule represented by the supplied evidence.',
    not_eligible: 'The applicant does not meet one or more supported Nottingham eligibility rules.',
    manual_review: 'Eligibility cannot be determined safely from the supported routes and supplied applicant evidence.'
  }[state.status];
  state.source_ids = [...(course.stage_1_eligibility?.source_ids || [])];
  return state;
}

function gcsePointValue(grade) {
  const rank = GCSE_GRADE_RANK[normaliseGrade(grade)];
  if (!Number.isFinite(rank)) {
    return null;
  }
  if (rank >= 9) return 4;
  if (rank >= 8) return 3;
  if (rank >= 7) return 2;
  if (rank >= 6) return 1;
  return 0;
}

function buildGcseScoringComponents(applicant) {
  if (applicant.has_gcse_or_equivalent_results === false) {
    return {
      status: 'not_applicable_official_no_gcse_route',
      value: null,
      max: 32,
      counted_subjects: [],
      warning: 'The applicant is scored on the official UCAT-plus-SJT /50 route; no GCSE points are added.'
    };
  }

  const subjects = profileToSubjectMap(applicant.gcse_profile);
  const providedCount = countScoreableGcseGrades(subjects);
  const doubleScience = parseDoubleGrade(
    subjects.combined_science ?? subjects.double_science
  );
  const biologyOptions = [
    ['biology', subjects.biology],
    ['human_biology', subjects.human_biology]
  ].filter(([, grade]) => grade !== undefined);
  biologyOptions.sort((a, b) => {
    return (gcsePointValue(b[1]) ?? -1) - (gcsePointValue(a[1]) ?? -1);
  });

  let mandatory;
  const usedIds = new Set();
  if (doubleScience.length === 2 && (!biologyOptions.length || subjects.chemistry === undefined)) {
    mandatory = [
      ['double_science_component_1', doubleScience[0]],
      ['double_science_component_2', doubleScience[1]],
      ['mathematics', subjects.mathematics],
      ['english_language', subjects.english_language]
    ];
    usedIds.add(subjects.combined_science !== undefined ? 'combined_science' : 'double_science');
  } else {
    mandatory = [
      biologyOptions[0],
      ['chemistry', subjects.chemistry],
      ['mathematics', subjects.mathematics],
      ['english_language', subjects.english_language]
    ];
    if (biologyOptions[0]) usedIds.add(biologyOptions[0][0]);
    usedIds.add('chemistry');
  }
  usedIds.add('mathematics');
  usedIds.add('english_language');

  if (
    mandatory.some((entry) => !entry || entry[1] === undefined || gcsePointValue(entry[1]) === null)
  ) {
    return {
      status: 'insufficient_input',
      value: null,
      max: 32,
      counted_subjects: [],
      reason: 'nottingham_mandatory_gcse_scoring_inputs_unavailable',
      missing_information: {
        qualification_type: 'gcse',
        provided_count: providedCount,
        required_count: 8,
        component_label: 'published GCSE component'
      },
      warning: 'The four mandatory GCSE scoring components are incomplete.'
    };
  }

  const other = [];
  for (const [subjectId, grade] of Object.entries(subjects)) {
    if (usedIds.has(subjectId)) {
      continue;
    }
    if (['combined_science', 'double_science'].includes(subjectId)) {
      for (const [index, componentGrade] of parseDoubleGrade(grade).entries()) {
        other.push([`${subjectId}_component_${index + 1}`, componentGrade]);
      }
    } else {
      other.push([subjectId, grade]);
    }
  }
  other.sort((a, b) => {
    return (gcsePointValue(b[1]) ?? -1) - (gcsePointValue(a[1]) ?? -1);
  });
  if (other.length < 4 || other.slice(0, 4).some(([, grade]) => gcsePointValue(grade) === null)) {
    return {
      status: 'insufficient_input',
      value: null,
      max: 32,
      counted_subjects: [],
      reason: 'insufficient_gcse_results',
      missing_information: {
        qualification_type: 'gcse',
        provided_count: providedCount,
        required_count: 8,
        component_label: 'published GCSE component'
      },
      warning: 'Four additional GCSE results are required to calculate the official eight-GCSE score.'
    };
  }

  const counted = [...mandatory, ...other.slice(0, 4)].map(([subjectId, grade]) => ({
    subject_id: subjectId,
    grade: normaliseGrade(grade),
    points: gcsePointValue(grade)
  }));
  return {
    status: 'calculated',
    value: counted.reduce((total, subject) => total + subject.points, 0),
    max: 32,
    counted_subjects: counted,
    method: 'Biology/Human Biology or Double Science, Chemistry, Mathematics and English Language plus the four highest-scoring other subjects.'
  };
}

function ucatBandPoints(rawScore) {
  if (!Number.isFinite(rawScore)) return null;
  if (rawScore >= 801 && rawScore <= 900) return 10;
  if (rawScore >= 701 && rawScore <= 800) return 8;
  if (rawScore >= 601 && rawScore <= 700) return 6;
  if (rawScore >= 501 && rawScore <= 600) return 4;
  if (rawScore >= 401 && rawScore <= 500) return 2;
  if (rawScore >= 300 && rawScore < 400) return 0;
  return null;
}

function buildUcatScoringComponents(applicant) {
  const ucat = applicant.admissions_tests?.ucat || {};
  const raw = ucat.subtests || ucat.cognitive_subtests || {};
  const scores = {
    verbal_reasoning: raw.verbal_reasoning ?? ucat.verbal_reasoning,
    quantitative_reasoning: raw.quantitative_reasoning ?? ucat.quantitative_reasoning,
    decision_making: raw.decision_making ?? ucat.decision_making
  };
  const points = Object.fromEntries(
    Object.entries(scores).map(([name, value]) => [name, ucatBandPoints(value)])
  );
  if (Object.values(points).some((value) => value === null)) {
    return {
      status: 'insufficient_input',
      value: null,
      max: 40,
      subtests: [],
      warning: 'Raw Verbal Reasoning, Quantitative Reasoning and Decision Making scores are required.'
    };
  }

  const subtests = [
    {
      subtest: 'Verbal Reasoning',
      raw_score: scores.verbal_reasoning,
      band_points: points.verbal_reasoning,
      multiplier: 2,
      weighted_points: points.verbal_reasoning * 2
    },
    {
      subtest: 'Quantitative Reasoning',
      raw_score: scores.quantitative_reasoning,
      band_points: points.quantitative_reasoning,
      multiplier: 1,
      weighted_points: points.quantitative_reasoning
    },
    {
      subtest: 'Decision Making',
      raw_score: scores.decision_making,
      band_points: points.decision_making,
      multiplier: 1,
      weighted_points: points.decision_making
    }
  ];
  return {
    status: 'calculated',
    value: subtests.reduce((total, subtest) => total + subtest.weighted_points, 0),
    max: 40,
    subtests,
    excluded_subtests: ['Abstract Reasoning'],
    method: 'Verbal Reasoning band points ×2, plus Quantitative Reasoning and Decision Making band points.'
  };
}

function buildSjtScoringComponent(applicant) {
  const band = applicant.admissions_tests?.ucat?.sjt_band;
  const pointsByBand = {
    1: 10,
    2: 6,
    3: 2,
    4: 0
  };
  if (!Object.prototype.hasOwnProperty.call(pointsByBand, band)) {
    return {
      status: 'insufficient_input',
      band: band ?? null,
      value: null,
      max: 10,
      excludes_from_interview: null,
      message: 'A valid SJT band is required.'
    };
  }

  const excluded = band === 4;
  return {
    status: excluded ? 'excluded_from_interview' : 'calculated',
    band,
    value: pointsByBand[band],
    max: 10,
    excludes_from_interview: excluded,
    message: excluded
      ? 'SJT Band 4 scores 0 points and excludes the applicant from Nottingham interview consideration.'
      : `SJT Band ${band} contributes ${pointsByBand[band]} points.`
  };
}

function buildOfficialScore(applicant, course = null) {
  const gcse = buildGcseScoringComponents(applicant);
  const ucat = buildUcatScoringComponents(applicant);
  const sjt = buildSjtScoringComponent(applicant);
  const noGcseRoute = applicant.has_gcse_or_equivalent_results === false;
  const componentsAvailable =
    ucat.status === 'calculated' &&
    Number.isFinite(sjt.value) &&
    (noGcseRoute || gcse.status === 'calculated');
  const max = noGcseRoute ? 50 : 82;
  const value = componentsAvailable
    ? (noGcseRoute ? 0 : gcse.value) + ucat.value + sjt.value
    : null;

  return {
    status: sjt.excludes_from_interview
      ? 'calculated_but_excluded_before_ranking'
      : componentsAvailable
        ? 'calculated'
        : 'insufficient_input',
    value,
    max,
    scale: noGcseRoute ? 'UCAT cognitive plus SJT /50' : 'GCSE plus UCAT cognitive plus SJT /82',
    components: {
      gcse,
      ucat_cognitive: ucat,
      sjt
    },
    explanation: noGcseRoute
      ? 'Official Nottingham score: UCAT cognitive points /40 plus SJT points /10. No GCSE score is added.'
      : 'Official Nottingham score: GCSE points /32 plus UCAT cognitive points /40 plus SJT points /10.',
    ranking_warning: 'Nottingham does not publish a fixed interview threshold. The competitive threshold changes with each applicant pool.',
    source_ids: [...(course?.stage_2_interview_selection?.calculation?.source_ids || [])]
  };
}

function insufficientEvidenceReasonCodeFromOfficialScore(officialScore) {
  if (officialScore?.status !== 'insufficient_input') {
    return null;
  }
  return Object.values(officialScore.components || {})
    .find((component) => component?.reason)?.reason || null;
}

function missingInformationFromOfficialScore(officialScore) {
  if (officialScore?.status !== 'insufficient_input') {
    return null;
  }
  return Object.values(officialScore.components || {})
    .find((component) => component?.missing_information)
    ?.missing_information || null;
}

function contextualMessage(course, applicant, applicantGroupIds) {
  const evaluated = applicant.contextual_eligibility;
  if (evaluated?.evaluator_id === 'nottingham_contextual_medicine_a100') {
    return {
      applicable: evaluated.status === 'contextual',
      status: evaluated.status === 'contextual'
        ? evaluated.matched_contextual_pathway
        : evaluated.status,
      matched_contextual_pathway: evaluated.matched_contextual_pathway || null,
      matched_contextual_pathway_label: evaluated.matched_contextual_pathway_label || null,
      ranking_bonus_points: 0,
      effect_stage: 'offer_stage_only',
      message: evaluated.status === 'contextual'
        ? `${evaluated.matched_contextual_pathway_label}. Contextual status adds no Nottingham shortlisting points and does not bypass UCAT, SJT, GCSE or interview requirements.`
        : evaluated.status === 'information_needed'
          ? 'More information is needed to confirm whether a Nottingham contextual offer route applies. No shortlisting bonus is added.'
          : 'The supplied evidence does not confirm Nottingham contextual eligibility. No shortlisting bonus is added.',
      offers: course.contextual_admissions?.adjustments || [],
      source_ids: [...(course.contextual_admissions?.source_ids || [])]
    };
  }

  const contextualClaimed =
    applicantGroupIds.includes('contextual') ||
    applicantGroupIds.includes('widening_participation');
  const confirmed = applicant.applicant_identity?.contextual_status_confirmed === true;
  const contextual = contextualClaimed && confirmed;
  const policy = course.contextual_admissions;

  return {
    applicable: contextual,
    status: contextual
      ? 'verified_contextual_offer_stage_policy'
      : contextualClaimed
        ? 'contextual_status_requires_confirmation'
        : 'not_applicable',
    ranking_bonus_points: 0,
    effect_stage: 'offer_stage_only',
    message: contextual
      ? 'Verified contextual status adds no shortlisting points. If the applicant succeeds at interview, the stored offer-stage routes are AAB, enhanced contextual ABB, or Elite Athlete AAB, subject to the published Biology/Chemistry condition.'
      : contextualClaimed
        ? 'Contextual status must be verified before offer-stage messaging is applied. No shortlisting bonus is added.'
      : 'Contextual policy does not change the Nottingham shortlisting formula; verified contextual benefits apply only at offer stage.',
    offers: policy.adjustments,
    source_ids: [...(policy.source_ids || [])]
  };
}

function historicalGuidance(course) {
  const record = (course.historical_admissions?.cycles || []).find((cycle) => {
    return cycle.source_type === 'FOI';
  });

  return {
    status: record ? 'guidance_only_non_executable' : 'unavailable',
    source_type: record?.source_type ?? null,
    values: record?.values ?? [],
    typical_ranges: record?.cross_cycle_typical_range_shown_in_evidence ?? null,
    suitable_for_interview_band_guidance_only:
      record?.suitable_for_interview_band_guidance_only === true,
    source_ids: [...(record?.source_ids || [])],
    messages: [
      'These ranges are historical FOI guidance only.',
      'Nottingham does not publish a fixed interview threshold.',
      'The ranges are not current cut-offs, guarantees, eligibility rules or automatic rejection rules.',
      'Prediction is non-deterministic and must not be presented as a yes/no interview outcome.',
      'The /82 FOI ranges must not be applied to applicants using the official no-GCSE /50 scale.'
    ]
  };
}

function evaluateNottinghamA100(course, applicantInput, options = {}) {
  if (course?.profile_id !== 'nottingham-a100') {
    throw new TypeError('The Nottingham A100 consumer requires the nottingham-a100 profile.');
  }
  if (!applicantInput) {
    throw new TypeError('An applicant profile is required.');
  }
  const applicant = normaliseApplicantProfile(applicantInput, { course });
  const contextualEligibility = evaluateContextualEligibility(course, applicant);
  applicant.contextual_eligibility = contextualEligibility;

  const eligibility = evaluateEligibility(course, applicant, contextualEligibility);
  const officialScore = buildOfficialScore(applicant, course);
  const historical = historicalGuidance(course);
  const contextualPolicy = contextualMessage(
    course,
    applicant,
    eligibility.applicant_group_ids
  );
  const interviewBandGuidance = options.interviewBandConfig
    ? classifyNottinghamA100InterviewGuidance(options.interviewBandConfig, {
      eligibility,
      official_score: officialScore,
      contextual_policy: contextualPolicy
    })
    : {
      status: 'configuration_required',
      guidance_label: null,
      message: 'Load the Nottingham guidance-only interview-band configuration to produce historical score positioning.'
    };

  return {
    course_profile_id: course.profile_id,
    mode: options.interviewBandConfig
      ? 'eligibility_official_score_and_guidance_only_historical_positioning'
      : 'eligibility_and_official_score_explanation_only',
    eligibility,
    official_score: officialScore,
    insufficient_evidence_reason_code: insufficientEvidenceReasonCodeFromOfficialScore(officialScore),
    missing_information: missingInformationFromOfficialScore(officialScore),
    contextual_policy: contextualPolicy,
    interview_guidance: historical,
    interview_band_guidance: interviewBandGuidance,
    interview_prediction: {
      status: 'disabled_guidance_only_output_is_separate',
      deterministic: false,
      message: 'Historical FOI score positioning does not state an interview outcome.'
    },
    safeguards: {
      fixed_interview_threshold_published: false,
      historical_guidance_executable: false,
      deterministic_prediction_enabled: false,
      offer_prediction_scope: 'out_of_scope',
      metadata_activation_enabled: false,
      result_card_ready: false,
      interview_band_configuration_present:
        course.engine_notes?.interview_band_configuration_present === true,
      do_not_infer: [...(course.engine_notes?.do_not_infer || [])]
    }
  };
}

module.exports = {
  buildOfficialScore,
  evaluateNottinghamA100,
  gcsePointValue,
  ucatBandPoints
};
