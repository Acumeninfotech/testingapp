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
  const ranks = level === 'a_level' ? A_LEVEL_GRADE_RANK : GCSE_GRADE_RANK;
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

function splitGradeProfile(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split(/[\/, +]+/)
    .filter(Boolean);
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
      if (grade !== null && grade !== undefined && grade !== '') {
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

function getGraduateCompensatoryPolicy(course) {
  const post16 = course?.stage_1_eligibility?.post_16 || {};
  const graduateRules = post16.graduate || post16.degree || {};
  const policy = graduateRules.compensatory_admissions_test_policy;
  return policy?.enabled === true ? policy : null;
}

function getALevelSubjectMap(applicant) {
  return profileToSubjectMap(applicant.a_level_profile);
}

function getGcseSubjectMap(applicant) {
  return profileToSubjectMap(applicant.gcse_profile);
}

function groupSubjectRequirementMeets(subjectGrades, groups = []) {
  return groups.every((group) => {
    const matching = (group.subject_ids || []).filter((subjectId) => {
      return subjectGrades[normaliseId(subjectId)] !== undefined;
    });
    return matching.length >= (group.minimum_required || 1);
  });
}

function subjectGradeOptionsMeet(subjectGrades, options = [], level) {
  if (!Array.isArray(options) || options.length === 0) {
    return true;
  }

  return options.some((option) => {
    return (option.grade_requirements || []).every((requirement) => {
      return gradeMeets(
        subjectGrades[normaliseId(requirement.subject_id)],
        requirement.minimum_grade,
        level
      );
    });
  });
}

function evaluateGraduateDegree(course, applicant, policy) {
  const post16 = course.stage_1_eligibility?.post_16 || {};
  const graduateRules = post16.graduate || post16.degree || {};
  const degreeRule =
    policy.standard_route?.degree_requirement ||
    graduateRules.degree_requirement ||
    graduateRules;
  const graduate = applicant.graduate_profile || {};
  const actualClassification = normaliseId(
    graduate.degree_classification || graduate.classification
  );
  const minimumClassification = normaliseId(
    degreeRule.minimum_classification ||
    graduateRules.minimum_classification ||
    '2_1'
  );
  const classificationPassed =
    (DEGREE_CLASSIFICATION_RANK[actualClassification] || 0) >=
    (DEGREE_CLASSIFICATION_RANK[minimumClassification] || Number.POSITIVE_INFINITY);
  const recognisedInstitutionPassed =
    degreeRule.recognised_institution_required !== true ||
    graduate.recognised_institution === true;
  const statusPassed =
    !Array.isArray(degreeRule.accepted_degree_statuses) ||
    degreeRule.accepted_degree_statuses.map(normaliseId)
      .includes(normaliseId(graduate.degree_status));
  const maximumAge = degreeRule.maximum_age_at_course_start_years;
  const age = Number(
    graduate.degree_age_at_course_start_years ??
    graduate.years_since_degree_award ??
    graduate.years_since_degree
  );
  const agePassed =
    !Number.isFinite(maximumAge) ||
    (Number.isFinite(age) && age <= maximumAge);

  return {
    passed:
      classificationPassed &&
      recognisedInstitutionPassed &&
      statusPassed &&
      agePassed,
    detail: {
      degree_classification_met: classificationPassed,
      recognised_institution_met: recognisedInstitutionPassed,
      degree_status_met: statusPassed,
      degree_age_met: agePassed
    }
  };
}

function evaluateGraduateALevel(course, applicant, policy) {
  const post16 = course.stage_1_eligibility?.post_16 || {};
  const graduateRules = post16.graduate || post16.degree || {};
  const requirement =
    policy.standard_route?.a_level_requirement ||
    graduateRules.a_level_requirement ||
    {};
  const subjectGrades = getALevelSubjectMap(applicant);
  const actualGrades = Object.values(subjectGrades);
  const profile =
    requirement.grade_profile ||
    requirement.normal_grade_profile ||
    graduateRules.school_qualification_grade_profile ||
    [];
  const requiredSubjects =
    requirement.required_subject_ids ||
    graduateRules.required_a_level_subject_ids ||
    [];
  const groups =
    requirement.one_of_subject_groups ||
    graduateRules.one_of_a_level_subject_groups ||
    [];
  const gradeOptions =
    requirement.required_subject_grade_options ||
    graduateRules.required_a_level_subject_grade_options ||
    [];

  const gradeProfilePassed = profile.length === 0 || gradeProfileMeets(actualGrades, profile);
  const requiredSubjectsPassed = requiredSubjects.every((subjectId) => {
    return subjectGrades[normaliseId(subjectId)] !== undefined;
  });
  const groupsPassed = groupSubjectRequirementMeets(subjectGrades, groups);
  const gradeOptionsPassed = subjectGradeOptionsMeet(subjectGrades, gradeOptions, 'a_level');

  return {
    passed:
      gradeProfilePassed &&
      requiredSubjectsPassed &&
      groupsPassed &&
      gradeOptionsPassed,
    detail: {
      grade_profile_met: gradeProfilePassed,
      required_subjects_met: requiredSubjectsPassed,
      subject_groups_met: groupsPassed,
      subject_grade_rule_met: gradeOptionsPassed
    }
  };
}

function gradeProfileValueMeets(value, minimumProfile) {
  const actual = splitGradeProfile(value);
  return actual.length >= minimumProfile.length &&
    minimumProfile.every((minimum, index) => gradeMeets(actual[index], minimum, 'gcse'));
}

function scienceOptionMeets(option, gcseGrades) {
  if (option.subject_id) {
    const actual = gcseGrades[normaliseId(option.subject_id)];
    if (actual === undefined) {
      return false;
    }
    const profiles = [
      option.minimum_grade_profile,
      option.accepted_equivalent_profile
    ].filter(Array.isArray);
    if (profiles.length) {
      return profiles.some((profile) => gradeProfileValueMeets(actual, profile));
    }
    return gradeMeets(actual, option.minimum_grade, 'gcse');
  }

  return (option.grade_requirements || []).every((requirement) => {
    const actual = gcseGrades[normaliseId(requirement.subject_id)];
    if (actual === undefined) {
      return false;
    }
    const profiles = [
      requirement.minimum_grade_profile,
      requirement.accepted_equivalent_profile
    ].filter(Array.isArray);
    if (profiles.length) {
      return profiles.some((profile) => gradeProfileValueMeets(actual, profile));
    }
    return gradeMeets(actual, requirement.minimum_grade, 'gcse');
  });
}

function evaluateGraduateGcse(course, applicant, policy) {
  const rules =
    policy.standard_route?.gcse_requirement ||
    course.stage_1_eligibility?.gcse ||
    {};
  const gcseGrades = getGcseSubjectMap(applicant);
  const failures = [];
  const countableGrades = Object.entries(gcseGrades).flatMap(([subjectId, grade]) => {
    return ['combined_science', 'double_science'].includes(subjectId)
      ? splitGradeProfile(grade).slice(0, 2)
      : [grade];
  });

  if (Number.isInteger(rules.minimum_count) && countableGrades.length < rules.minimum_count) {
    failures.push('minimum_gcse_count_not_met');
  }

  for (const rule of rules.grade_requirements || []) {
    const subjectId = normaliseId(rule.subject_id);
    if (!subjectId || subjectId === 'science') {
      continue;
    }
    const passed = gradeMeets(gcseGrades[subjectId], rule.minimum_grade, 'gcse');
    if (!passed) {
      failures.push(`gcse_requirement_not_met:${subjectId}`);
    }
  }

  const scienceRule = rules.science_requirement;
  if (scienceRule?.requirement_type === 'any_of') {
    const sciencePassed = (scienceRule.accepted_options || [])
      .some((option) => scienceOptionMeets(option, gcseGrades));
    if (!sciencePassed) {
      failures.push('gcse_science_alternative_not_met');
    }
  }

  return {
    passed: failures.length === 0,
    failures
  };
}

function getSectionScores(gamsat) {
  return Array.isArray(gamsat?.section_scores)
    ? gamsat.section_scores
    : Object.values(gamsat?.section_scores || {});
}

function gamsatThresholdMet(gamsat, policy) {
  const testPolicy = policy.compensatory_test || {};
  const sections = getSectionScores(gamsat);
  const rawOverall = gamsat?.overall_score;
  const overall = rawOverall === null || rawOverall === undefined || rawOverall === ''
    ? null
    : Number(rawOverall);
  const sectionMinimum = Number(testPolicy.minimum_section_score ?? 50);
  const sectionMinimumPassed =
    sections.length >= (testPolicy.section_count || 3) &&
    sections.every((score) => Number.isFinite(Number(score)) && Number(score) >= sectionMinimum);
  const thresholdPassed = (testPolicy.accepted_thresholds || []).some((threshold) => {
    const overallMinimum = Number(
      threshold.overall_minimum ??
      threshold.overall_score_min ??
      threshold.minimum_overall
    );
    const overallPassed = Number.isFinite(overallMinimum) && overall >= overallMinimum;
    const sectionMinimums = threshold.section_minimums || [];
    const sectionsPassed = sectionMinimums.every((requirement) => {
      const index = Number(requirement.section ?? requirement.section_number);
      const score = Number(sections[index - 1]);
      return Number.isFinite(index) &&
        Number.isFinite(score) &&
        score >= Number(requirement.minimum);
    });
    return overallPassed && sectionsPassed;
  });

  return {
    present: Number.isFinite(overall),
    passed: Number.isFinite(overall) && sectionMinimumPassed && thresholdPassed,
    section_minimum_met: sectionMinimumPassed,
    accepted_threshold_met: thresholdPassed
  };
}

function evaluateGraduateCompensatoryPolicy(course, applicant) {
  const policy = getGraduateCompensatoryPolicy(course);
  if (!policy) {
    return null;
  }

  const compensable = new Set(policy.compensable_deficiencies || []);
  const maxDeficiencies = Number.isInteger(policy.maximum_compensable_deficiencies)
    ? policy.maximum_compensable_deficiencies
    : 1;
  const checks = [];
  const failures = [];
  const degree = evaluateGraduateDegree(course, applicant, policy);
  const aLevel = evaluateGraduateALevel(course, applicant, policy);
  const gcse = evaluateGraduateGcse(course, applicant, policy);
  const deficiencies = [];
  const nonCompensableFailures = [];

  checks.push({
    check: 'graduate_degree_requirement',
    passed: degree.passed,
    ...degree.detail
  });
  checks.push({
    check: 'graduate_a_level_requirement',
    passed: aLevel.passed,
    ...aLevel.detail
  });
  checks.push({
    check: 'graduate_gcse_requirement',
    passed: gcse.passed,
    failures: gcse.failures
  });

  if (!degree.passed) {
    nonCompensableFailures.push('graduate_degree_requirements_not_met');
  }
  if (!aLevel.passed) {
    deficiencies.push('a_level_requirements_not_met');
  }
  for (const failure of gcse.failures) {
    if (failure === 'gcse_science_alternative_not_met') {
      deficiencies.push(failure);
    } else {
      nonCompensableFailures.push(failure);
    }
  }

  if (nonCompensableFailures.length > 0) {
    failures.push('graduate_standard_route_not_met', ...nonCompensableFailures);
    return {
      policy_applied: true,
      standard_route_passed: false,
      compensated: false,
      failures: [...new Set(failures)],
      checks
    };
  }

  if (deficiencies.length === 0) {
    checks.push({
      check: 'graduate_standard_route',
      passed: true,
      gamsat_required: false
    });
    return {
      policy_applied: true,
      standard_route_passed: true,
      compensated: false,
      failures: [],
      checks
    };
  }

  const uncompensableDeficiencies = deficiencies.filter((deficiency) => !compensable.has(deficiency));
  if (uncompensableDeficiencies.length > 0 || deficiencies.length > maxDeficiencies) {
    failures.push(
      'graduate_standard_route_not_met',
      'graduate_compensatory_test_multiple_deficiencies',
      ...deficiencies
    );
    return {
      policy_applied: true,
      standard_route_passed: false,
      compensated: false,
      deficiencies,
      failures: [...new Set(failures)],
      checks
    };
  }

  const testId = normaliseId(policy.compensatory_test?.test_id || 'gamsat');
  const testProfile = applicant.admissions_tests?.[testId] || {};
  const test = gamsatThresholdMet(testProfile, policy);
  checks.push({
    check: `${testId}_compensatory_threshold`,
    passed: test.passed,
    deficiency_compensated: deficiencies[0],
    section_minimum_met: test.section_minimum_met,
    accepted_threshold_met: test.accepted_threshold_met
  });

  if (!test.present) {
    failures.push('graduate_compensatory_test_required');
  } else if (!test.passed) {
    failures.push('graduate_compensatory_test_threshold_not_met');
  }

  return {
    policy_applied: true,
    standard_route_passed: false,
    compensated: test.passed,
    deficiencies,
    failures,
    checks
  };
}

module.exports = {
  evaluateGraduateCompensatoryPolicy,
  getGraduateCompensatoryPolicy,
  gradeMeets,
  gradeProfileMeets
};
