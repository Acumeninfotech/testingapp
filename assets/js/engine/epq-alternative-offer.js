const {
  getALevelSubjectMap,
  gradeRank,
  gradeMeets,
  gradeProfileMeets,
  normaliseGrade,
  normaliseId
} = require('./eligibility-evaluator');

const EPQ_STATUSES = new Set(['not_taken', 'planning', 'predicted', 'achieved']);
const EPQ_GRADES = ['A*', 'A', 'B', 'C', 'D', 'E'];

/**
 * @typedef {Object} EpqAlternativeOfferPolicy
 * @property {boolean} enabled
 * @property {string} pathway_id
 * @property {string[]} a_level_grades
 * @property {'A*'|'A'|'B'|'C'|'D'|'E'} epq_minimum_grade
 * @property {Object<string, string>=} subject_grade_requirements
 * @property {Object[]=} required_subject_grade_options
 * @property {Object=} conditions
 */

/**
 * @typedef {Object} EpqAlternativeOfferResult
 * @property {boolean} applicable
 * @property {'met'|'not_met'|'information_needed'|'not_applicable'} status
 * @property {string|null} pathway_id
 * @property {boolean} a_level_requirement_met
 * @property {boolean} epq_requirement_met
 * @property {string[]} failed_conditions
 * @property {string[]} future_conditions
 * @property {string[]} reasons
 */

function defaultResult(policy = null) {
  return {
    applicable: false,
    status: 'not_applicable',
    pathway_id: policy?.pathway_id || null,
    a_level_requirement_met: false,
    epq_requirement_met: false,
    failed_conditions: [],
    future_conditions: [],
    reasons: []
  };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normaliseBooleanEvidence(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalised = normaliseId(value);
  if (['true', 'yes', 'y', 'confirmed', 'same_sitting', 'alongside'].includes(normalised)) {
    return true;
  }
  if ([
    'false',
    'no',
    'n',
    'not_confirmed',
    'not_same_sitting',
    'not_alongside'
  ].includes(normalised)) {
    return false;
  }
  return null;
}

function normaliseEpqGrade(value) {
  const grade = normaliseGrade(value);
  return EPQ_GRADES.includes(grade) ? grade : null;
}

function normaliseEpqStatus(value) {
  const status = normaliseId(value);
  return EPQ_STATUSES.has(status) ? status : 'not_taken';
}

function normaliseEpqQualification(epq) {
  if (!epq || typeof epq !== 'object') {
    return {
      status: 'not_taken',
      grade: null
    };
  }

  const status = normaliseEpqStatus(epq.status);
  const grade = ['predicted', 'achieved'].includes(status)
    ? normaliseEpqGrade(epq.grade)
    : null;

  return {
    ...epq,
    status,
    grade
  };
}

function normaliseSubjectGradeRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object') {
    return {};
  }

  const entries = Array.isArray(requirements)
    ? requirements.map((requirement) => [
        requirement?.subject_id,
        requirement?.minimum_grade
      ])
    : Object.entries(requirements);

  return entries.reduce((result, [subjectId, grade]) => {
    const normalisedSubjectId = normaliseId(subjectId);
    const normalisedGrade = normaliseEpqGrade(grade);
    if (normalisedSubjectId && normalisedGrade) {
      result[normalisedSubjectId] = normalisedGrade;
    }
    return result;
  }, {});
}

function normaliseSubjectGradeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option, index) => {
    const gradeRequirements = normaliseSubjectGradeRequirements(
      option?.grade_requirements
    );
    return {
      ...option,
      option_id: String(option?.option_id || `subject_grade_option_${index + 1}`),
      required_subject_ids: Array.isArray(option?.required_subject_ids)
        ? option.required_subject_ids.map(normaliseId).filter(Boolean)
        : [],
      one_of_subject_groups: Array.isArray(option?.one_of_subject_groups)
        ? option.one_of_subject_groups.map((group, groupIndex) => ({
            ...group,
            group_id: String(group?.group_id || `subject_group_${groupIndex + 1}`),
            minimum_required: Number.isFinite(Number(group?.minimum_required))
              ? Number(group.minimum_required)
              : 1,
            subject_ids: Array.isArray(group?.subject_ids)
              ? group.subject_ids.map(normaliseId).filter(Boolean)
              : []
          }))
        : [],
      grade_requirements: gradeRequirements
    };
  }).filter((option) => {
    return option.required_subject_ids.length > 0 ||
      option.one_of_subject_groups.length > 0 ||
      Object.keys(option.grade_requirements).length > 0;
  });
}

function normaliseEpqAlternativeOfferPolicy(policy) {
  if (!policy || typeof policy !== 'object') {
    return null;
  }

  const aLevelGrades = firstDefined(
    policy.a_level_grades,
    policy.grade_profile,
    policy.standard_offer?.grade_profile
  );
  const epqMinimumGrade = firstDefined(
    policy.epq_minimum_grade,
    policy.epq_grade,
    policy.minimum_epq_grade
  );

  return {
    ...policy,
    enabled: policy.enabled === true,
    pathway_id: String(policy.pathway_id || policy.route_id || policy.offer_id || 'epq_alternative_offer'),
    a_level_grades: Array.isArray(aLevelGrades)
      ? aLevelGrades.map(normaliseGrade).filter((grade) => Number.isFinite(gradeRank(grade, 'a_level')))
      : [],
    epq_minimum_grade: normaliseEpqGrade(epqMinimumGrade),
    subject_grade_requirements: normaliseSubjectGradeRequirements(policy.subject_grade_requirements),
    required_subject_grade_options: normaliseSubjectGradeOptions(
      policy.required_subject_grade_options
    ),
    conditions: policy.conditions && typeof policy.conditions === 'object'
      ? { ...policy.conditions }
      : {}
  };
}

function hasRecognisedALevelGrade(value) {
  return Number.isFinite(gradeRank(value, 'a_level'));
}

function evaluateALevelGradeProfile(applicant, requiredGrades) {
  const subjectGrades = getALevelSubjectMap(applicant);
  const actualGrades = Object.values(subjectGrades);
  const recognisedGrades = actualGrades.filter(hasRecognisedALevelGrade);

  if (!Array.isArray(requiredGrades) || requiredGrades.length === 0) {
    return {
      met: false,
      information_needed: true,
      reasons: ['epq_alternative_a_level_profile_missing_from_policy']
    };
  }

  if (recognisedGrades.length < requiredGrades.length) {
    return {
      met: false,
      information_needed: true,
      reasons: ['a_level_grade_evidence_missing']
    };
  }

  const met = gradeProfileMeets(recognisedGrades, requiredGrades, 'a_level');
  return {
    met,
    information_needed: false,
    reasons: met ? [] : ['a_level_grade_profile_not_met']
  };
}

function evaluateSubjectGradeRequirements(applicant, requirements) {
  const subjectGrades = getALevelSubjectMap(applicant);
  const missing = [];
  const failed = [];

  for (const [subjectId, minimumGrade] of Object.entries(requirements || {})) {
    const actualGrade = subjectGrades[normaliseId(subjectId)];
    if (actualGrade === undefined || actualGrade === null || actualGrade === '') {
      missing.push(subjectId);
      continue;
    }
    if (!hasRecognisedALevelGrade(actualGrade)) {
      missing.push(subjectId);
      continue;
    }
    if (!gradeMeets(actualGrade, minimumGrade, 'a_level')) {
      failed.push(subjectId);
    }
  }

  return {
    met: missing.length === 0 && failed.length === 0,
    missing_subject_ids: missing,
    failed_subject_ids: failed,
    reasons: [
      ...missing.map((subjectId) => `subject_grade_evidence_missing:${subjectId}`),
      ...failed.map((subjectId) => `subject_minimum_grade_not_met:${subjectId}`)
    ]
  };
}

function evaluateSubjectGradeOption(option, subjectGrades, profileComplete) {
  const missing = [];
  const failed = [];

  for (const subjectId of option.required_subject_ids || []) {
    if (subjectGrades[normaliseId(subjectId)] === undefined) {
      missing.push(`required_subject:${subjectId}`);
    }
  }

  for (const group of option.one_of_subject_groups || []) {
    const matching = (group.subject_ids || []).filter((subjectId) => {
      return subjectGrades[normaliseId(subjectId)] !== undefined;
    });
    if (matching.length < (group.minimum_required || 1)) {
      missing.push(`subject_group:${group.group_id}`);
    }
  }

  for (const [subjectId, minimumGrade] of Object.entries(option.grade_requirements || {})) {
    const actualGrade = subjectGrades[normaliseId(subjectId)];
    if (actualGrade === undefined || actualGrade === null || actualGrade === '') {
      missing.push(`subject_grade:${subjectId}`);
      continue;
    }
    if (!hasRecognisedALevelGrade(actualGrade)) {
      missing.push(`subject_grade:${subjectId}`);
      continue;
    }
    if (!gradeMeets(actualGrade, minimumGrade, 'a_level')) {
      failed.push(`subject_minimum_grade:${subjectId}`);
    }
  }

  const definitiveMissing = profileComplete ? missing : [];
  const evidenceMissing = profileComplete ? [] : missing;

  return {
    met: definitiveMissing.length === 0 && evidenceMissing.length === 0 && failed.length === 0,
    information_needed: evidenceMissing.length > 0 && failed.length === 0,
    missing,
    failed: [...definitiveMissing, ...failed],
    reasons: [
      ...evidenceMissing.map((reason) => `subject_grade_option_evidence_missing:${option.option_id}:${reason}`),
      ...definitiveMissing.map((reason) => `subject_grade_option_not_met:${option.option_id}:${reason}`),
      ...failed.map((reason) => `subject_grade_option_not_met:${option.option_id}:${reason}`)
    ]
  };
}

function evaluateSubjectGradeOptions(applicant, options, requiredGrades) {
  if (!Array.isArray(options) || options.length === 0) {
    return {
      met: true,
      information_needed: false,
      failed: false,
      reasons: []
    };
  }

  const subjectGrades = getALevelSubjectMap(applicant);
  const recognisedGrades = Object.values(subjectGrades).filter(hasRecognisedALevelGrade);
  const profileComplete = Array.isArray(requiredGrades) &&
    requiredGrades.length > 0 &&
    recognisedGrades.length >= requiredGrades.length;
  const assessments = options.map((option) => {
    return evaluateSubjectGradeOption(option, subjectGrades, profileComplete);
  });

  if (assessments.some((assessment) => assessment.met)) {
    return {
      met: true,
      information_needed: false,
      failed: false,
      reasons: []
    };
  }

  const informationAssessments = assessments.filter((assessment) => {
    return assessment.information_needed;
  });
  if (informationAssessments.length > 0) {
    return {
      met: false,
      information_needed: true,
      failed: false,
      reasons: [...new Set(informationAssessments.flatMap((assessment) => assessment.reasons))]
    };
  }

  return {
    met: false,
    information_needed: false,
    failed: true,
    reasons: [...new Set(assessments.flatMap((assessment) => assessment.reasons))]
  };
}

function aLevelSameSittingEvidence(applicant) {
  const profile = applicant?.a_level_profile || {};
  return normaliseBooleanEvidence(firstDefined(
    profile.completed_in_one_sitting,
    profile.same_sitting_confirmed,
    profile.same_sitting?.confirmed,
    profile.same_sitting?.completed_in_one_sitting,
    applicant?.same_sitting_confirmed,
    applicant?.same_sitting?.confirmed,
    applicant?.same_sitting?.completed_in_one_sitting
  ));
}

function subjectResitStatus(subject) {
  const status = normaliseId(firstDefined(
    subject?.sitting_status,
    subject?.resit_status,
    subject?.exam_sitting_status
  ));
  if (!status) {
    return null;
  }
  if ([
    'resit',
    'repeat',
    'retake',
    'resitting',
    'second_sitting',
    'third_sitting'
  ].includes(status)) {
    return true;
  }
  if ([
    'first',
    'first_sitting',
    'initial',
    'not_resit',
    'not_a_resit',
    'standard_sitting'
  ].includes(status)) {
    return false;
  }
  return null;
}

function aLevelResitEvidence(applicant) {
  const profile = applicant?.a_level_profile || {};
  const explicit = normaliseBooleanEvidence(firstDefined(
    profile.has_resits,
    profile.has_a_level_resits,
    profile.resits?.has_resits,
    applicant?.resit_profile?.a_level_resits,
    applicant?.resits?.a_level_resits
  ));

  if (typeof explicit === 'boolean') {
    return explicit;
  }

  const subjects = Array.isArray(profile.subjects) ? profile.subjects : [];
  if (subjects.length === 0) {
    return null;
  }

  const statuses = subjects.map(subjectResitStatus);
  if (statuses.includes(true)) {
    return true;
  }
  return statuses.every((status) => status === false) ? false : null;
}

function epqTakenAlongsideEvidence(epq, applicant) {
  return normaliseBooleanEvidence(firstDefined(
    epq?.taken_alongside_a_levels,
    epq?.taken_with_a_levels,
    epq?.completed_alongside_a_levels,
    applicant?.a_level_profile?.epq_taken_alongside_a_levels
  ));
}

function evaluateMandatoryConditions(applicant, epq, conditions = {}) {
  const failed = [];
  const future = [];
  const information = [];

  if (conditions.all_a_levels_same_sitting === true) {
    const evidence = aLevelSameSittingEvidence(applicant);
    if (evidence === null) {
      information.push('same_sitting_evidence_missing');
    } else if (evidence === false) {
      failed.push('all_a_levels_same_sitting');
    }
  }

  if (conditions.a_level_resits_allowed === false) {
    const hasResits = aLevelResitEvidence(applicant);
    if (hasResits === null) {
      information.push('a_level_resit_evidence_missing');
    } else if (hasResits === true) {
      failed.push('a_level_resits_not_allowed');
    }
  }

  if (conditions.must_be_taken_alongside_a_levels === true) {
    const evidence = epqTakenAlongsideEvidence(epq, applicant);
    if (evidence === null) {
      information.push('epq_alongside_a_levels_evidence_missing');
    } else if (evidence === false) {
      failed.push('epq_must_be_taken_alongside_a_levels');
    }
  }

  if (conditions.firm_choice_only === true) {
    future.push('firm_choice_required');
  }

  return {
    failed,
    future,
    information
  };
}

function evaluateEpqAlternativeOffer(applicant, rawPolicy) {
  const policy = normaliseEpqAlternativeOfferPolicy(rawPolicy);
  const initial = defaultResult(policy);

  if (!policy) {
    return {
      ...initial,
      reasons: ['epq_alternative_policy_missing']
    };
  }
  if (policy.enabled !== true) {
    return {
      ...initial,
      reasons: ['epq_alternative_policy_disabled']
    };
  }

  const rawEpq = applicant?.a_level_profile?.epq || applicant?.epq;
  const epq = normaliseEpqQualification(rawEpq);
  if (epq.status === 'not_taken') {
    return {
      ...initial,
      pathway_id: policy.pathway_id,
      reasons: ['epq_not_taken']
    };
  }

  const result = {
    ...initial,
    applicable: true,
    pathway_id: policy.pathway_id
  };
  const informationNeeded = [];

  if (epq.status === 'planning') {
    informationNeeded.push('epq_grade_evidence_pending');
  }

  if (!policy.epq_minimum_grade) {
    informationNeeded.push('epq_minimum_grade_missing_from_policy');
  } else if (['predicted', 'achieved'].includes(epq.status)) {
    if (!epq.grade) {
      informationNeeded.push(rawEpq?.grade ? 'epq_grade_unrecognised' : 'epq_grade_missing');
    } else {
      result.epq_requirement_met = gradeMeets(epq.grade, policy.epq_minimum_grade, 'a_level');
      if (!result.epq_requirement_met) {
        result.failed_conditions.push('epq_minimum_grade');
        result.reasons.push('epq_minimum_grade_not_met');
      }
    }
  }

  const profileAssessment = evaluateALevelGradeProfile(applicant, policy.a_level_grades);
  const subjectAssessment = evaluateSubjectGradeRequirements(
    applicant,
    policy.subject_grade_requirements
  );
  const subjectOptionAssessment = evaluateSubjectGradeOptions(
    applicant,
    policy.required_subject_grade_options,
    policy.a_level_grades
  );
  result.a_level_requirement_met = profileAssessment.met &&
    subjectAssessment.met &&
    subjectOptionAssessment.met;

  if (profileAssessment.information_needed) {
    informationNeeded.push(...profileAssessment.reasons);
  } else if (!profileAssessment.met) {
    result.failed_conditions.push('a_level_grade_profile');
    result.reasons.push(...profileAssessment.reasons);
  }

  if (subjectAssessment.missing_subject_ids.length > 0) {
    informationNeeded.push(...subjectAssessment.reasons);
  }
  if (subjectAssessment.failed_subject_ids.length > 0) {
    result.failed_conditions.push(
      ...subjectAssessment.failed_subject_ids.map((subjectId) => `subject_grade:${subjectId}`)
    );
    result.reasons.push(...subjectAssessment.reasons);
  }

  if (subjectOptionAssessment.information_needed) {
    informationNeeded.push(...subjectOptionAssessment.reasons);
  } else if (subjectOptionAssessment.failed) {
    result.failed_conditions.push('required_subject_grade_options');
    result.reasons.push(...subjectOptionAssessment.reasons);
  }

  const conditionAssessment = evaluateMandatoryConditions(
    applicant,
    rawEpq && typeof rawEpq === 'object' ? rawEpq : epq,
    policy.conditions
  );
  result.failed_conditions.push(...conditionAssessment.failed);
  result.future_conditions.push(...conditionAssessment.future);
  informationNeeded.push(...conditionAssessment.information);

  result.reasons.push(...informationNeeded);

  if (result.failed_conditions.length > 0) {
    result.status = 'not_met';
  } else if (informationNeeded.length > 0) {
    result.status = 'information_needed';
  } else {
    result.status = result.a_level_requirement_met && result.epq_requirement_met
      ? 'met'
      : 'not_met';
  }

  return {
    ...result,
    failed_conditions: [...new Set(result.failed_conditions)],
    future_conditions: [...new Set(result.future_conditions)],
    reasons: [...new Set(result.reasons)]
  };
}

function manualReviewReasonForEpqAlternative(result) {
  const reasons = Array.isArray(result?.reasons) ? result.reasons : [];
  if (reasons.includes('epq_alongside_a_levels_evidence_missing')) {
    return 'epq_alongside_a_levels_evidence_missing';
  }
  if (reasons.includes('a_level_resit_evidence_missing')) {
    return 'a_level_resit_evidence_missing';
  }
  if (reasons.includes('same_sitting_evidence_missing')) {
    return 'same_sitting_evidence_missing';
  }
  if (reasons.includes('a_level_grade_evidence_missing')) {
    return 'a_level_grade_evidence_missing';
  }
  if (reasons.some((reason) => reason.startsWith('subject_grade_option_evidence_missing:'))) {
    return 'a_level_subject_combination_evidence_missing';
  }
  if (reasons.some((reason) => reason.startsWith('subject_grade_evidence_missing:'))) {
    return 'a_level_subject_combination_evidence_missing';
  }
  return result?.pathway_id
    ? `${result.pathway_id}_epq_grade_required`
    : 'epq_grade_required';
}

module.exports = {
  EPQ_GRADES,
  EPQ_STATUSES: [...EPQ_STATUSES],
  evaluateEpqAlternativeOffer,
  manualReviewReasonForEpqAlternative,
  normaliseEpqAlternativeOfferPolicy,
  normaliseEpqQualification
};
