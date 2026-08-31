const NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID = 'nottingham_contextual_medicine_a100';

const NOTTINGHAM_STANDARD_CONTEXTUAL_GROUP_ID = 'nottingham_standard_contextual';
const NOTTINGHAM_ENHANCED_CONTEXTUAL_GROUP_ID = 'nottingham_enhanced_contextual';

const STANDARD_SUTTON_TRUST_PROGRAMME_IDS = new Set([
  'sutton_trust_online',
  'sutton_trust_post16_non_nottingham'
]);

const ENHANCED_PROGRAMME_IDS = new Set([
  'nottingham_sutton_trust_summer_school',
  'nottingham_sutton_trust_pathways_to_medicine',
  'nottingham_ambition_16_18_tier_1',
  'nottingham_ambition_16_18_tier_1_plus'
]);

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

const ENHANCED_SCHOOL_GATED_MISSING_CRITERION_IDS = new Set([
  'nottingham_enhanced_access_programme_completed',
  'enhanced_care_route_requires_verified_local_authority_or_court_ordered_care',
  'enhanced_fsm_route_requires_ucas_verified_census_day_ks4_window'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'eligible'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'not_eligible'].includes(normaliseId(value));
}

function programmeStatus(programme, normaliseId) {
  return normaliseId(programme.status || programme.programme_status);
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

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'nottingham_contextual_criteria_not_met',
    is_contextual: false,
    contextual_level: null,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      standard: [],
      enhanced: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    source_ids: [
      'nottingham_admissions_policy_2026_v1_3',
      'nottingham_contextual_admissions_policy_2026',
      'nottingham_course_page_2027'
    ]
  };
}

function pushMatched(result, bucket, entry) {
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
}

function pushMissing(result, bucket, entry) {
  result.missing_information.push(entry);
  result.checks[bucket].push(entry);
}

function isHomeFee(applicant, normaliseId) {
  const feeStatus = normaliseId(asObject(applicant.applicant_identity).fee_status);
  return feeStatus === 'home' || feeStatus === 'home_fee' || feeStatus.includes('home');
}

function evaluateHomeFee(applicant, result, normaliseId) {
  const actual = asObject(applicant.applicant_identity).fee_status;
  if (isHomeFee(applicant, normaliseId)) {
    result.checks.scope.push(check(
      'home_fee_status',
      'Home-UK fee status',
      'applicant_identity.fee_status',
      'matched',
      actual
    ));
    return 'matched';
  }

  const status = MISSING_VALUES.has(actual) ? 'missing' : 'excluded';
  const entry = check(
    status === 'missing' ? 'home_fee_status' : 'not_home_fee',
    'Home-UK fee status',
    'applicant_identity.fee_status',
    status,
    actual,
    { reason: 'nottingham_contextual_home_fee_required' }
  );
  result.checks.scope.push(entry);
  if (status === 'missing') {
    result.missing_information.push(entry);
  } else {
    result.exclusions.push(entry);
  }
  return status;
}

function evaluateSchoolRequirement(evidence, result, bucket, normaliseId, options = {}) {
  const recordMissing = options.recordMissing !== false;
  const actual =
    evidence.school_education?.current_or_most_recent_uk_school_independent_fee_paying;
  const evidencePath =
    'contextual_profile.school_education.current_or_most_recent_uk_school_independent_fee_paying';

  if (answerIsNo(actual, normaliseId)) {
    const entry = check(
      'current_or_most_recent_school_not_independent_fee_paying',
      'Current/most-recent UK school or college is not independent fee-paying',
      evidencePath,
      'matched',
      actual
    );
    result.checks[bucket].push(entry);
    return 'matched';
  }

  if (answerIsYes(actual, normaliseId)) {
    const entry = check(
      'current_or_most_recent_school_independent_fee_paying',
      'Current/most-recent UK school or college is independent fee-paying',
      evidencePath,
      'excluded',
      actual,
      { reason: 'nottingham_contextual_school_must_not_be_independent_fee_paying' }
    );
    result.checks[bucket].push(entry);
    return 'excluded';
  }

  const entry = check(
    'current_or_most_recent_school_independent_fee_paying_status',
    'Current/most-recent UK school or college independent fee-paying status',
    evidencePath,
    'missing',
    actual,
    { reason: 'nottingham_current_or_most_recent_school_status_required' }
  );
  if (recordMissing) {
    pushMissing(result, bucket, entry);
  } else {
    result.checks[bucket].push(entry);
  }
  return 'missing';
}

function completedProgrammeMatches(programme, programmeIds, normaliseId) {
  const programmeId = normaliseId(programme.programme_id);
  return programmeIds.has(programmeId) && programmeStatus(programme, normaliseId) === 'completed';
}

function findProgramme(evidence, programmeIds, normaliseId) {
  return asArray(evidence.access_programmes?.other_programmes)
    .map(asObject)
    .find((programme) => programmeIds.has(normaliseId(programme.programme_id))) || null;
}

function evaluateStandardProgrammeRoute(evidence, result, normaliseId) {
  const programme = findProgramme(evidence, STANDARD_SUTTON_TRUST_PROGRAMME_IDS, normaliseId);
  if (!programme) return false;

  const status = programmeStatus(programme, normaliseId);
  const entry = check(
    'sutton_trust_post16_non_nottingham_completed',
    'Completed Sutton Trust post-16 programme not hosted by Nottingham',
    'contextual_profile.access_programmes.other_programmes',
    status === 'completed' ? 'matched' : 'needs_review',
    programme.programme_id,
    { programme_status: status || null }
  );
  if (completedProgrammeMatches(programme, STANDARD_SUTTON_TRUST_PROGRAMME_IDS, normaliseId)) {
    pushMatched(result, 'standard', entry);
    return true;
  }
  pushMissing(result, 'standard', entry);
  return false;
}

function evaluateEnhancedProgrammeRoute(evidence, result, normaliseId) {
  const programme = findProgramme(evidence, ENHANCED_PROGRAMME_IDS, normaliseId);
  if (!programme) return false;

  const status = programmeStatus(programme, normaliseId);
  const entry = check(
    'nottingham_enhanced_access_programme_completed',
    'Completed Nottingham enhanced contextual access programme',
    'contextual_profile.access_programmes.other_programmes',
    status === 'completed' ? 'matched' : 'needs_review',
    programme.programme_id,
    { programme_status: status || null }
  );
  if (completedProgrammeMatches(programme, ENHANCED_PROGRAMME_IDS, normaliseId)) {
    pushMatched(result, 'enhanced', entry);
    return true;
  }
  pushMissing(result, 'enhanced', entry);
  return false;
}

function evaluateStandardPostcodeRoute(evidence, result, normaliseId) {
  const actual = evidence.profile?.home_area_region?.nottingham_contextual_postcode_eligible ??
    evidence.postcode_measures?.lookup?.values?.nottingham_contextual?.eligible;
  const evidencePath = 'contextual_profile.home_area_region.nottingham_contextual_postcode_eligible';

  if (answerIsYes(actual, normaliseId)) {
    pushMatched(result, 'standard', check(
      'nottingham_qualifying_postcode',
      'Nottingham qualifying postcode/deprivation route',
      evidencePath,
      'matched',
      actual
    ));
    return true;
  }
  if (answerIsNo(actual, normaliseId)) {
    result.checks.standard.push(check(
      'nottingham_qualifying_postcode',
      'Nottingham qualifying postcode/deprivation route',
      evidencePath,
      'not_matched',
      actual
    ));
    return false;
  }

  const hasPostcodeEvidence =
    Boolean(String(evidence.profile?.home_area_region?.postcode || '').trim()) ||
    ['polar4_quintile', 'imd_quintile', 'tundra_quintile'].some((key) => {
      return !MISSING_VALUES.has(evidence.postcode_measures?.[key]);
    });
  if (hasPostcodeEvidence) {
    pushMissing(result, 'standard', check(
      'nottingham_qualifying_postcode_unresolved',
      'Nottingham qualifying postcode/deprivation route requires Nottingham tool result',
      evidencePath,
      'needs_review',
      actual,
      { reason: 'nottingham_postcode_tool_result_required_do_not_infer_from_imd_polar_tundra' }
    ));
  }
  return false;
}

function evaluateRefugeeRoute(evidence, result, bucket, normaliseId) {
  const actual = evidence.personal_circumstances?.uk_refugee_status_granted;
  if (answerIsYes(actual, normaliseId)) {
    pushMatched(result, bucket, check(
      'uk_home_office_refugee_status',
      'Home Office refugee status',
      'contextual_profile.personal_circumstances.uk_refugee_status_granted',
      'matched',
      actual
    ));
    return true;
  }
  return false;
}

function evaluateStandardCareRoute(evidence, result, normaliseId) {
  const actual = evidence.personal_circumstances?.care_over_three_months;
  if (answerIsYes(actual, normaliseId)) {
    pushMatched(result, 'standard', check(
      'care_over_three_months',
      'More than three months in care',
      'contextual_profile.personal_circumstances.care_over_three_months',
      'matched',
      actual
    ));
    return true;
  }
  return false;
}

function evaluateEnhancedCareRoute(evidence, result, normaliseId) {
  const actual = evidence.personal_circumstances?.care_over_three_months;
  if (answerIsYes(actual, normaliseId)) {
    pushMissing(result, 'enhanced', check(
      'enhanced_care_route_requires_verified_local_authority_or_court_ordered_care',
      'Enhanced care route verification',
      'contextual_profile.personal_circumstances.care_over_three_months',
      'needs_review',
      actual,
      { reason: 'nottingham_enhanced_care_local_authority_or_court_ordered_and_evidence_verification_required' }
    ));
    return false;
  }
  return false;
}

function evaluateFsmRoute(evidence, result, normaliseId) {
  const actual = evidence.financial_support?.free_school_meals;
  if (answerIsYes(actual, normaliseId)) {
    pushMissing(result, 'enhanced', check(
      'enhanced_fsm_route_requires_ucas_verified_census_day_ks4_window',
      'Free School Meals route verification',
      'contextual_profile.financial_support.free_school_meals',
      'needs_review',
      actual,
      { reason: 'nottingham_fsm_census_day_ks4_window_year13_and_ucas_verification_required' }
    ));
    return false;
  }
  return false;
}

function removeEnhancedSchoolGatedMissingInformation(result) {
  result.missing_information = result.missing_information.filter((entry) => {
    return !ENHANCED_SCHOOL_GATED_MISSING_CRITERION_IDS.has(entry.criterion_id);
  });
}

function confirmedResult(level) {
  const enhanced = level === 'enhanced';
  return {
    status: 'contextual',
    reason: enhanced
      ? 'nottingham_enhanced_contextual_criteria_met'
      : 'nottingham_standard_contextual_criteria_met',
    is_contextual: true,
    contextual_level: level,
    matched_contextual_pathway: enhanced
      ? NOTTINGHAM_ENHANCED_CONTEXTUAL_GROUP_ID
      : NOTTINGHAM_STANDARD_CONTEXTUAL_GROUP_ID,
    matched_contextual_pathway_label: enhanced
      ? 'Enhanced contextual offer - assessed against ABB'
      : 'Standard contextual offer - assessed against AAB',
    activated_applicant_group_ids: [
      'contextual',
      enhanced
        ? NOTTINGHAM_ENHANCED_CONTEXTUAL_GROUP_ID
        : NOTTINGHAM_STANDARD_CONTEXTUAL_GROUP_ID
    ]
  };
}

function evaluateNottinghamContextualEligibility({ course, applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();

  if (course?.profile_id !== 'nottingham-a100') {
    return {
      ...result,
      reason: 'nottingham_contextual_evaluator_scoped_to_a100_only'
    };
  }

  const homeFeeStatus = evaluateHomeFee(applicant, result, normaliseId);
  if (homeFeeStatus === 'excluded') {
    return {
      ...result,
      status: 'not_contextual',
      reason: 'nottingham_contextual_home_fee_required'
    };
  }

  const enhancedMissingStart = result.missing_information.length;
  const enhancedMatches = [
    evaluateRefugeeRoute(evidence, result, 'enhanced', normaliseId),
    evaluateEnhancedProgrammeRoute(evidence, result, normaliseId)
  ];
  evaluateEnhancedCareRoute(evidence, result, normaliseId);
  evaluateFsmRoute(evidence, result, normaliseId);
  const enhancedSignalPresent =
    enhancedMatches.some(Boolean) ||
    result.missing_information.length > enhancedMissingStart;
  const enhancedSchoolStatus = evaluateSchoolRequirement(
    evidence,
    result,
    'enhanced',
    normaliseId,
    { recordMissing: enhancedSignalPresent }
  );
  if (enhancedSchoolStatus === 'excluded') {
    removeEnhancedSchoolGatedMissingInformation(result);
  }

  if (homeFeeStatus === 'matched' && enhancedSchoolStatus === 'matched' && enhancedMatches.some(Boolean)) {
    return {
      ...result,
      ...confirmedResult('enhanced')
    };
  }

  const standardMissingStart = result.missing_information.length;
  const standardRefugee = evaluateRefugeeRoute(evidence, result, 'standard', normaliseId);
  const standardCare = evaluateStandardCareRoute(evidence, result, normaliseId);
  const standardSchoolException = standardRefugee || standardCare;
  const standardMatches = [
    standardRefugee,
    standardCare,
    evaluateStandardProgrammeRoute(evidence, result, normaliseId),
    evaluateStandardPostcodeRoute(evidence, result, normaliseId)
  ];
  const standardSignalPresent =
    standardMatches.some(Boolean) ||
    result.missing_information.length > standardMissingStart;
  const standardSchoolStatus = evaluateSchoolRequirement(
    evidence,
    result,
    'standard',
    normaliseId,
    { recordMissing: standardSignalPresent }
  );

  const standardSchoolSatisfied =
    standardSchoolStatus === 'matched' ||
    (standardSchoolStatus === 'excluded' && standardSchoolException);
  if (homeFeeStatus === 'matched' && standardSchoolSatisfied && standardMatches.some(Boolean)) {
    return {
      ...result,
      ...confirmedResult('standard')
    };
  }

  if (result.missing_information.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'nottingham_contextual_information_needed',
      manual_review_reason: 'nottingham_contextual_information_needed'
    };
  }

  return result;
}

module.exports = {
  NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID,
  NOTTINGHAM_ENHANCED_CONTEXTUAL_GROUP_ID,
  NOTTINGHAM_STANDARD_CONTEXTUAL_GROUP_ID,
  evaluateNottinghamContextualEligibility
};
