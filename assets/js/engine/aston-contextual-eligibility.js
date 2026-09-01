const ASTON_READY_EVALUATOR_ID = 'aston_ready_medicine_a100';

const ASTON_PATHWAYS_PROGRAMME_IDS = new Set([
  'aston_pathways',
  'aston_pathways_programme',
  'aston_pathways_medicine',
  'aston_pathways_to_healthcare',
  'aston_pathways_year_12_13'
]);

const ASTON_STEM_TRUST_SCHOOLS = new Set([
  'aston_university_engineering_academy',
  'aston_university_maths_school',
  'aston_university_goldsmiths_institute',
  'aston_university_goldsmith_s_institute',
  'aston_university_goldsmith_institute'
]);

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'not_applicable', 'none'].includes(normaliseId(value));
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
}

function check(criterionId, label, evidencePath, status, actual = undefined, details = {}) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual,
    ...details
  };
}

function missing(criterionId, label, evidencePath, reason) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    reason
  };
}

function addPositiveCriterion(results, criterionId, label, evidencePath, actual, details = {}) {
  results.qualifying_criteria.push(check(criterionId, label, evidencePath, 'matched', actual, details));
  results.checks.qualifying_criteria.push(check(criterionId, label, evidencePath, 'matched', actual, details));
}

function addUnmatchedCriterion(results, criterionId, label, evidencePath, actual = undefined, details = {}) {
  results.checks.qualifying_criteria.push(check(criterionId, label, evidencePath, 'not_matched', actual, details));
}

function addMissing(results, criterionId, label, evidencePath, reason) {
  const entry = missing(criterionId, label, evidencePath, reason);
  results.missing_information.push(entry);
  results.checks.missing_information.push(entry);
}

function addExclusion(results, criterionId, label, evidencePath, actual, reason) {
  const entry = check(criterionId, label, evidencePath, 'excluded', actual, { reason });
  results.exclusions.push(entry);
  results.failed_exclusions.push(entry);
  results.checks.exclusions.push(entry);
}

function evaluateHomeFeeRequirement(applicant, results, normaliseId) {
  const feeStatus = applicant.applicant_identity?.fee_status;
  const fee = normaliseId(feeStatus);
  if (!fee) {
    addMissing(
      results,
      'home_fee_status',
      'Home-fee status',
      'applicant_identity.fee_status',
      'fee_status_required_for_aston_ready'
    );
    return;
  }

  const homeFee = fee === 'home' || fee === 'home_fee' || fee.includes('home');
  const internationalFee = fee === 'international' || fee === 'international_fee' || fee.includes('international');
  results.checks.base_requirements.push(check(
    'home_fee_status',
    'Home-fee status',
    'applicant_identity.fee_status',
    homeFee && !internationalFee ? 'passed' : 'not_met',
    feeStatus
  ));
  if (!homeFee || internationalFee) {
    addExclusion(
      results,
      'not_home_fee',
      'Aston Ready is only available to home-fee applicants',
      'applicant_identity.fee_status',
      feeStatus,
      'aston_ready_home_fee_required'
    );
  }
}

function evaluateIndependentSchoolExclusion(evidence, results, normaliseId) {
  const school = asObject(evidence.school_education);
  const independentValues = [
    ['school_education.independent_school', school.independent_school],
    ['school_education.attended_independent_school', school.attended_independent_school],
    ['school_education.fee_paying_school', school.fee_paying_school]
  ];
  const independentYes = independentValues.find(([, value]) => answerIsYes(value, normaliseId));
  if (independentYes) {
    addExclusion(
      results,
      'independent_school_attendance',
      'Independent-school attendance',
      independentYes[0],
      independentYes[1],
      'aston_ready_excludes_independent_school_attendance'
    );
    return;
  }

  const stateOrGrammarValues = [
    ['school_education.state_non_fee_paying_school', school.state_non_fee_paying_school],
    ['school_education.state_grammar_school', school.state_grammar_school],
    ['school_education.grammar_school', school.grammar_school]
  ];
  const nonIndependentEvidence = [
    ...independentValues.filter(([, value]) => answerIsNo(value, normaliseId)),
    ...stateOrGrammarValues.filter(([, value]) => answerIsYes(value, normaliseId))
  ];
  if (nonIndependentEvidence.length > 0) {
    results.checks.base_requirements.push(check(
      'not_independent_school',
      'No independent-school attendance',
      nonIndependentEvidence[0][0],
      'passed',
      nonIndependentEvidence[0][1]
    ));
    return;
  }

  const unknown = [...independentValues, ...stateOrGrammarValues]
    .find(([, value]) => isMissing(value) && value !== undefined);
  if (!unknown) {
    results.unsupported_policy_conditions.push({
      condition_id: 'independent_school_attendance',
      label: 'Independent-school attendance',
      evidence_path: 'school_education.independent_school',
      reason: 'exact_independent_school_attendance_not_captured_in_current_profile'
    });
    results.checks.base_requirements.push(check(
      'independent_school_attendance',
      'Independent-school attendance',
      'school_education.independent_school',
      'unsupported',
      undefined,
      { reason: 'exact_independent_school_attendance_not_captured_in_current_profile' }
    ));
    return;
  }
  addMissing(
    results,
    'independent_school_attendance',
    'Independent-school attendance',
    unknown?.[0] || 'school_education.independent_school',
    'independent_school_attendance_required_for_aston_ready'
  );
}

function evaluateGraduateExclusions(applicant, results, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const graduate = asObject(applicant.graduate_profile);
  const route = normaliseId(applicant.qualification_route || applicant.route || applicant.course_target?.qualification_route);
  const degreeStatus = normaliseId(graduate.degree_status || graduate.status);
  const applicantType = normaliseId(identity.applicant_type);
  const isGraduate =
    route === 'graduate' ||
    identity.graduate === true ||
    graduate.is_graduate === true ||
    ['completed', 'graduated', 'degree_awarded'].includes(degreeStatus);
  const finalYearUndergraduate =
    graduate.final_year_undergraduate === true ||
    graduate.is_final_year_undergraduate === true ||
    identity.final_year_undergraduate === true ||
    ['final_year', 'final_year_undergraduate', 'current_final_year', 'predicted_degree'].includes(degreeStatus) ||
    applicantType.includes('final_year_undergraduate');

  if (isGraduate) {
    addExclusion(
      results,
      'graduate_applicant',
      'Applicant already holds a degree',
      'graduate_profile.is_graduate',
      graduate.is_graduate ?? identity.graduate ?? route,
      'aston_ready_excludes_graduates'
    );
  } else {
    results.checks.base_requirements.push(check(
      'not_graduate',
      'Applicant has not already graduated',
      'graduate_profile.is_graduate',
      'passed',
      graduate.is_graduate ?? identity.graduate ?? route
    ));
  }

  if (finalYearUndergraduate) {
    addExclusion(
      results,
      'final_year_undergraduate',
      'Excluded final-year undergraduate category',
      'graduate_profile.degree_status',
      graduate.degree_status || graduate.final_year_undergraduate || identity.final_year_undergraduate,
      'aston_ready_excludes_final_year_undergraduates'
    );
  } else {
    results.checks.base_requirements.push(check(
      'not_final_year_undergraduate',
      'Applicant is not in Aston Ready excluded final-year undergraduate category',
      'graduate_profile.degree_status',
      'passed',
      graduate.degree_status || graduate.final_year_undergraduate || identity.final_year_undergraduate || null
    ));
  }
}

function evaluateUcatBursary(evidence, results, normaliseId) {
  const value = evidence.financial_support?.ucat_bursary_recipient;
  if (answerIsYes(value, normaliseId)) {
    addPositiveCriterion(results, 'ucat_bursary', 'UCAT bursary eligibility', 'financial_support.ucat_bursary_recipient', value);
  } else {
    addUnmatchedCriterion(results, 'ucat_bursary', 'UCAT bursary eligibility', 'financial_support.ucat_bursary_recipient', value);
  }
}

function evaluateFsmTiming(evidence, results, normaliseId) {
  const financial = asObject(evidence.financial_support);
  const timedEvidence = [
    ['financial_support.free_school_meals_end_ks4_last_six_years', financial.free_school_meals_end_ks4_last_six_years],
    ['financial_support.fsm_end_ks4_last_six_years', financial.fsm_end_ks4_last_six_years],
    ['financial_support.free_school_meals_by_end_ks4_previous_six_years', financial.free_school_meals_by_end_ks4_previous_six_years]
  ].find(([, value]) => value !== undefined);

  if (timedEvidence && answerIsYes(timedEvidence[1], normaliseId)) {
    addPositiveCriterion(
      results,
      'free_school_meals_end_ks4_last_six_years',
      'Free School Meals by end of KS4 within previous six years',
      timedEvidence[0],
      timedEvidence[1]
    );
    return;
  }

  if (timedEvidence && !answerIsYes(timedEvidence[1], normaliseId)) {
    addUnmatchedCriterion(
      results,
      'free_school_meals_end_ks4_last_six_years',
      'Free School Meals by end of KS4 within previous six years',
      timedEvidence[0],
      timedEvidence[1]
    );
    return;
  }

  if (answerIsYes(financial.free_school_meals, normaliseId)) {
    addMissing(
      results,
      'free_school_meals_end_ks4_last_six_years',
      'Free School Meals timing',
      'financial_support.free_school_meals',
      'generic_free_school_meals_does_not_confirm_ks4_timing'
    );
    return;
  }

  addUnmatchedCriterion(
    results,
    'free_school_meals_end_ks4_last_six_years',
    'Free School Meals by end of KS4 within previous six years',
    'financial_support.free_school_meals',
    financial.free_school_meals
  );
}

function evaluateDisability(evidence, results, normaliseId) {
  const value = evidence.personal_circumstances?.disability;
  if (answerIsYes(value, normaliseId)) {
    addPositiveCriterion(results, 'declared_disability_ucas', 'Declared disability', 'personal_circumstances.disability', value);
  } else {
    addUnmatchedCriterion(results, 'declared_disability_ucas', 'Declared disability', 'personal_circumstances.disability', value);
  }
}

function normaliseSchoolYear(value, normaliseId) {
  const id = normaliseId(value);
  if (['12', 'year_12', 'y12', 'yr12'].includes(id)) return 'year_12';
  if (['13', 'year_13', 'y13', 'yr13'].includes(id)) return 'year_13';
  return id;
}

function evaluateAstonPathways(evidence, results, normaliseId) {
  const programmes = [
    ...asArray(evidence.access_programmes?.other_programmes),
    evidence.access_programmes?.ukwpmed
  ].filter(Boolean);
  const exactProgramme = programmes.find((programme) => {
    const id = normaliseId(programme.programme_id);
    return ASTON_PATHWAYS_PROGRAMME_IDS.has(id);
  });

  if (!exactProgramme) {
    if (evidence.access_programmes?.participation_status === 'yes' || evidence.access_programmes?.other_programme_name) {
      addMissing(
        results,
        'aston_pathways_year_12_13',
        'Aston Pathways completion in Year 12 or Year 13',
        'access_programmes.other_programmes',
        'generic_access_programme_does_not_confirm_aston_pathways'
      );
      return;
    }
    addUnmatchedCriterion(
      results,
      'aston_pathways_year_12_13',
      'Aston Pathways completion in Year 12 or Year 13',
      'access_programmes.other_programmes',
      null
    );
    return;
  }

  const status = normaliseId(exactProgramme.status || exactProgramme.programme_status);
  const schoolYear = normaliseSchoolYear(
    exactProgramme.school_year || exactProgramme.year_group || exactProgramme.completed_during || exactProgramme.participation_year,
    normaliseId
  );
  const completed = ['completed', 'confirmed', 'yes'].includes(status);
  const validYear = ['year_12', 'year_13'].includes(schoolYear);

  if (completed && validYear) {
    addPositiveCriterion(
      results,
      'aston_pathways_year_12_13',
      'Aston Pathways completion in Year 12 or Year 13',
      'access_programmes.other_programmes',
      exactProgramme.programme_id,
      { programme_status: status, school_year: schoolYear }
    );
    return;
  }

  addMissing(
    results,
    'aston_pathways_year_12_13',
    'Aston Pathways completion in Year 12 or Year 13',
    'access_programmes.other_programmes',
    completed
      ? 'aston_pathways_year_12_or_13_required'
      : 'aston_pathways_completion_required'
  );
}

function evaluateStemTrustSchool(evidence, results, normaliseId) {
  const relationships = asArray(evidence.partner_schools?.relationships);
  const exactSchool = relationships.find((relationship) => {
    const schoolId = normaliseId(relationship.school_id);
    const schoolName = normaliseId(relationship.school_name);
    return ASTON_STEM_TRUST_SCHOOLS.has(schoolId) || ASTON_STEM_TRUST_SCHOOLS.has(schoolName);
  });

  if (!exactSchool) {
    if (evidence.partner_schools?.status === 'yes' && relationships.length > 0) {
      addMissing(
        results,
        'aston_stem_education_academy_trust_school',
        'Aston University STEM Education Academy Trust school',
        'partner_schools.relationships',
        'partner_school_does_not_exactly_match_aston_stem_trust_school'
      );
      return;
    }
    addUnmatchedCriterion(
      results,
      'aston_stem_education_academy_trust_school',
      'Aston University STEM Education Academy Trust school',
      'partner_schools.relationships',
      null
    );
    return;
  }

  const relationshipStatus = exactSchool.status ?? evidence.partner_schools?.status;
  if (relationshipStatus !== undefined && !answerIsYes(relationshipStatus, normaliseId)) {
    addMissing(
      results,
      'aston_stem_education_academy_trust_school',
      'Aston University STEM Education Academy Trust school',
      'partner_schools.relationships',
      'partner_school_attendance_or_relationship_status_required'
    );
    return;
  }

  addPositiveCriterion(
    results,
    'aston_stem_education_academy_trust_school',
    'Aston University STEM Education Academy Trust school',
    'partner_schools.relationships',
    exactSchool.school_name || exactSchool.school_id
  );
}

function evaluateCare(evidence, results, normaliseId) {
  const circumstances = asObject(evidence.personal_circumstances);
  if (answerIsYes(circumstances.care_experienced, normaliseId) || answerIsYes(circumstances.care_leaver, normaliseId)) {
    addPositiveCriterion(
      results,
      'care_experienced_or_care_leaver',
      'Care experience or care-leaver status',
      'personal_circumstances.care_experienced',
      circumstances.care_experienced ?? circumstances.care_leaver
    );
    return;
  }
  addUnmatchedCriterion(
    results,
    'care_experienced_or_care_leaver',
    'Care experience or care-leaver status',
    'personal_circumstances.care_experienced',
    circumstances.care_experienced ?? circumstances.care_leaver
  );
}

function evaluateRefugee(evidence, results, normaliseId) {
  const circumstances = asObject(evidence.personal_circumstances);
  const value = circumstances.refugee_status_home_office ?? circumstances.refugee;
  if (answerIsYes(value, normaliseId)) {
    addPositiveCriterion(
      results,
      'refugee_status_home_office',
      'Refugee status granted by the Home Office',
      circumstances.refugee_status_home_office === undefined
        ? 'personal_circumstances.refugee'
        : 'personal_circumstances.refugee_status_home_office',
      value
    );
    return;
  }
  addUnmatchedCriterion(
    results,
    'refugee_status_home_office',
    'Refugee status granted by the Home Office',
    'personal_circumstances.refugee',
    value
  );
}

function evaluatePolar4(evidence, results, normaliseId) {
  const value = evidence.postcode_measures?.polar4_quintile;
  const polar4 = normaliseId(value);
  if (polar4 === 'q1' || polar4 === 'q2' || polar4 === '1' || polar4 === '2') {
    addPositiveCriterion(results, 'polar4_quintile_1_2', 'POLAR4 Quintile 1 or 2', 'postcode_measures.polar4_quintile', value);
    return;
  }
  addUnmatchedCriterion(results, 'polar4_quintile_1_2', 'POLAR4 Quintile 1 or 2', 'postcode_measures.polar4_quintile', value);
}

function routeActivation() {
  return {
    applicant_group_ids: ['contextual'],
    academic_route_id: 'contextual_school_leaver_a_level',
    academic_pathway: 'contextual',
    contextual_offer: {
      grade_profile: ['A', 'A', 'B'],
      required_subject_grade_requirements: [
        { subject_id: 'chemistry', minimum_grade: 'A' },
        { subject_id: 'biology', minimum_grade: 'A' }
      ]
    }
  };
}

function astonReadyMedicineEvaluator({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const results = {
    qualifying_criteria: [],
    exclusions: [],
    failed_exclusions: [],
    missing_information: [],
    unsupported_policy_conditions: [],
    checks: {
      base_requirements: [],
      exclusions: [],
      qualifying_criteria: [],
      missing_information: []
    },
    route_activation: routeActivation(),
    activated_applicant_group_ids: []
  };

  evaluateHomeFeeRequirement(applicant, results, normaliseId);
  evaluateIndependentSchoolExclusion(evidence, results, normaliseId);
  evaluateGraduateExclusions(applicant, results, normaliseId);

  evaluateUcatBursary(evidence, results, normaliseId);
  evaluateFsmTiming(evidence, results, normaliseId);
  evaluateDisability(evidence, results, normaliseId);
  evaluateAstonPathways(evidence, results, normaliseId);
  evaluateStemTrustSchool(evidence, results, normaliseId);
  evaluateCare(evidence, results, normaliseId);
  evaluateRefugee(evidence, results, normaliseId);
  evaluatePolar4(evidence, results, normaliseId);

  if (results.exclusions.length > 0) {
    return {
      ...results,
      status: 'not_contextual',
      reason: 'aston_ready_exclusion_applies',
      is_contextual: false
    };
  }

  const missingBaseRequirement = results.missing_information.some((entry) => [
    'home_fee_status',
    'independent_school_attendance'
  ].includes(entry.criterion_id));
  if (missingBaseRequirement) {
    return {
      ...results,
      status: 'information_needed',
      reason: 'aston_ready_base_information_missing',
      is_contextual: false
    };
  }

  if (results.qualifying_criteria.length > 0) {
    return {
      ...results,
      status: 'contextual',
      reason: 'aston_ready_eligible',
      is_contextual: true,
      activated_applicant_group_ids: ['contextual']
    };
  }

  if (results.missing_information.length > 0) {
    return {
      ...results,
      status: 'information_needed',
      reason: 'aston_ready_criterion_information_missing',
      is_contextual: false
    };
  }

  return {
    ...results,
    status: 'not_contextual',
    reason: 'no_aston_ready_criterion_matched',
    is_contextual: false
  };
}

module.exports = {
  ASTON_READY_EVALUATOR_ID,
  astonReadyMedicineEvaluator
};
