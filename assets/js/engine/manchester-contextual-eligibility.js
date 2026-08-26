const {
  evaluateAgeBandAgainstMaximumExclusive
} = require('./applicant-profile-normaliser');

const MANCHESTER_CONTEXTUAL_EVALUATOR_ID = 'manchester_contextual_medicine_a100';
const MANCHESTER_CONTEXTUAL_AAB_GROUP_ID = 'manchester_contextual_aab';
const MANCHESTER_REFUGEE_CARE_ABB_GROUP_ID = 'manchester_refugee_care_abb';
const MANCHESTER_WP_VERIFIED_GROUP_ID = 'manchester_wp_verified';

const VERIFIED_ASSESSMENT_STATUSES = new Set([
  'verified',
  'confirmed',
  'official_verified',
  'officially_verified',
  'valid'
]);
const MANCHESTER_TOOL_ASSESSMENT_IDS = new Set([
  'contextual_admissions_eligibility_tool',
  'contextual_eligibility_tool',
  'manchester_contextual_admissions_eligibility_tool',
  'manchester_contextual_eligibility_tool'
]);
const ACCEPTED_UKRAINIAN_VISA_SCHEMES = new Set([
  'homes_for_ukraine',
  'ukraine_family_scheme',
  'ukraine_extension_scheme'
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
  return ['no', 'false', 'none', 'not_applicable'].includes(normaliseId(value));
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

function addMatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  const entry = check(criterionId, label, evidencePath, 'matched', actual, details);
  results.qualifying_criteria.push(entry);
  results.checks[bucket].push(entry);
}

function addUnmatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  results.checks[bucket].push(check(criterionId, label, evidencePath, 'not_matched', actual, details));
}

function addMissing(results, bucket, criterionId, label, evidencePath, reason) {
  const entry = missing(criterionId, label, evidencePath, reason);
  results.missing_information.push(entry);
  results.checks[bucket].push(entry);
}

function externalAssessments(applicant) {
  return asArray(applicant?.contextual_evidence?.external_assessments);
}

function isVerifiedManchesterToolAssessment(record, normaliseId) {
  const provider = normaliseId(
    record.provider_university_id ||
    record.provider ||
    record.university_id ||
    record.university
  );
  const assessmentId = normaliseId(
    record.assessment_id ||
    record.assessment_identifier ||
    record.identifier ||
    record.tool_id
  );
  const verificationStatus = normaliseId(record.verification_status || record.status);

  const providerMatches = [
    'manchester_a100',
    'manchester',
    'university_of_manchester'
  ].includes(provider);
  const assessmentMatches =
    MANCHESTER_TOOL_ASSESSMENT_IDS.has(assessmentId) ||
    (assessmentId.includes('manchester') &&
      assessmentId.includes('contextual') &&
      assessmentId.includes('eligibility'));
  const statusMatches =
    record.verified === true ||
    VERIFIED_ASSESSMENT_STATUSES.has(verificationStatus);

  return providerMatches && assessmentMatches && statusMatches;
}

function firstVerifiedManchesterToolAssessment(applicant, normaliseId) {
  return externalAssessments(applicant).find((record) => {
    return isVerifiedManchesterToolAssessment(asObject(record), normaliseId);
  }) || null;
}

function assessmentCriterionValue(assessment, keys = [], normaliseId) {
  const containers = [
    asObject(assessment?.criteria),
    asObject(assessment?.result_details),
    asObject(assessment?.result),
    asObject(assessment?.outcome),
    asObject(assessment?.metadata)
  ];
  for (const key of keys) {
    const normalisedKey = normaliseId(key);
    for (const container of containers) {
      for (const [entryKey, value] of Object.entries(container)) {
        if (normaliseId(entryKey) === normalisedKey) {
          return value;
        }
      }
    }
  }
  return undefined;
}

function resolveWpBand(assessment, normaliseId) {
  const band = assessmentCriterionValue(
    assessment,
    ['wp_band', 'wp_status', 'contextual_band', 'band'],
    normaliseId
  );
  const normalised = normaliseId(band);
  if (['wp_plus', 'wp_plusplus', 'wp_plus_plus'].includes(normalised)) {
    return normalised === 'wp_plusplus' ? 'wp_plus_plus' : normalised;
  }
  const resultValue = normaliseId(
    typeof assessment?.result === 'string' ? assessment.result : ''
  );
  if (['wp_plus', 'wp_plusplus', 'wp_plus_plus'].includes(resultValue)) {
    return resultValue === 'wp_plusplus' ? 'wp_plus_plus' : resultValue;
  }
  return null;
}

function normaliseQuintile(value, normaliseId) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 1 && value <= 5 ? `q${value}` : 'unknown';
  }
  const normalised = normaliseId(value);
  if (['q1', 'q2', 'q3', 'q4', 'q5'].includes(normalised)) return normalised;
  if (['1', 'quintile_1', 'quintile1'].includes(normalised)) return 'q1';
  if (['2', 'quintile_2', 'quintile2'].includes(normalised)) return 'q2';
  if (['3', 'quintile_3', 'quintile3'].includes(normalised)) return 'q3';
  if (['4', 'quintile_4', 'quintile4'].includes(normalised)) return 'q4';
  if (['5', 'quintile_5', 'quintile5'].includes(normalised)) return 'q5';
  return 'unknown';
}

function resolveAreaCriterion(evidence, normaliseId) {
  const postcode = asObject(evidence.postcode_measures);
  const measures = [
    {
      measure: 'IMD 2019',
      criterion_id: 'imd2019_q1',
      label: 'IMD 2019 quintile 1',
      path: 'contextual_profile.home_area_region.imd_quintile',
      actual: postcode.imd_quintile,
      quintile: normaliseQuintile(postcode.imd_quintile, normaliseId),
      qualifying: new Set(['q1'])
    },
    {
      measure: 'TUNDRA',
      criterion_id: 'tundra_q1',
      label: 'TUNDRA quintile 1',
      path: 'contextual_profile.home_area_region.tundra_quintile',
      actual: postcode.tundra_quintile,
      quintile: normaliseQuintile(postcode.tundra_quintile, normaliseId),
      qualifying: new Set(['q1'])
    }
  ];

  const matched = measures.filter((entry) => entry.qualifying.has(entry.quintile));
  const unknown = measures.filter((entry) => entry.quintile === 'unknown');
  const summary = measures
    .map((entry) => `${entry.measure}: ${entry.actual || 'unknown'}`)
    .join('; ');

  if (matched.length > 0) {
    return {
      status: 'confirmed',
      actual: summary,
      matched_criteria: matched.map((entry) => entry.label),
      evidence_path: 'contextual_profile.home_area_region'
    };
  }
  if (unknown.length > 0) {
    return {
      status: 'unknown',
      actual: summary,
      evidence_path: 'contextual_profile.home_area_region'
    };
  }
  return {
    status: 'not_met',
    actual: summary,
    evidence_path: 'contextual_profile.home_area_region'
  };
}

function resolveSchoolCriterion(school, normaliseId) {
  const stages = [
    {
      criterionId: 'gcse_school_below_average',
      label: 'UK GCSE school or college below national average',
      belowAveragePath: 'school_education.below_average_gcse_school',
      belowAverage: school.below_average_gcse_school,
      attendancePath: 'school_education.attended_uk_school_or_college_for_gcse_or_equivalent',
      attendance: school.attended_uk_school_or_college_for_gcse_or_equivalent
    },
    {
      criterionId: 'post16_school_below_average',
      label: 'UK post-16 school or college below national average',
      belowAveragePath: 'school_education.below_average_post16_school',
      belowAverage: school.below_average_post16_school,
      attendancePath: 'school_education.attended_uk_school_or_college_for_post16_or_equivalent',
      attendance: school.attended_uk_school_or_college_for_post16_or_equivalent
    }
  ];

  let hasMissing = false;
  const checks = [];
  for (const stage of stages) {
    const attendanceYes = answerIsYes(stage.attendance, normaliseId);
    const attendanceNo = answerIsNo(stage.attendance, normaliseId);
    const belowAverageYes = answerIsYes(stage.belowAverage, normaliseId);
    const belowAverageNo = answerIsNo(stage.belowAverage, normaliseId);

    if (attendanceYes && belowAverageYes) {
      checks.push(check(stage.criterionId, stage.label, stage.belowAveragePath, 'matched', stage.belowAverage, {
        attendance_path: stage.attendancePath,
        attendance: stage.attendance
      }));
      return {
        status: 'confirmed',
        actual: stage.criterionId,
        checks,
        evidence_path: stage.belowAveragePath
      };
    }

    if (isMissing(stage.attendance) || isMissing(stage.belowAverage)) {
      hasMissing = true;
      checks.push(missing(stage.criterionId, stage.label, stage.belowAveragePath, 'school_stage_evidence_missing'));
    } else if (attendanceNo || belowAverageNo) {
      checks.push(check(stage.criterionId, stage.label, stage.belowAveragePath, 'not_matched', stage.belowAverage, {
        attendance_path: stage.attendancePath,
        attendance: stage.attendance
      }));
    }
  }

  return {
    status: hasMissing ? 'unknown' : 'not_met',
    actual: null,
    checks,
    evidence_path: 'school_education'
  };
}

function evaluateManchesterContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = asObject(applicant.applicant_identity);
  const school = asObject(evidence.school_education);
  // Manchester consumes redesigned Step 6 personal evidence only. The shared
  // normaliser intentionally exposes legacy compatibility values for older
  // consumers, so reading its personal bucket here would re-enable retired
  // applicant_identity.contextual_flags.
  const personal = asObject(asObject(applicant.contextual_profile).personal_circumstances);
  const assessment = firstVerifiedManchesterToolAssessment(applicant, normaliseId);
  const areaCriterion = resolveAreaCriterion(evidence, normaliseId);
  const schoolCriterion = resolveSchoolCriterion(school, normaliseId);
  const ageAssessment = evaluateAgeBandAgainstMaximumExclusive(
    identity.age_at_course_start_band,
    21
  );
  const currentUkResidence = identity.current_uk_residence;
  const wpBand = resolveWpBand(assessment, normaliseId);

  const results = {
    status: 'not_contextual',
    reason: 'manchester_no_contextual_route_matched',
    is_contextual: false,
    matched_contextual_pathway: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      contextual_aab: [],
      refugee_care_abb: [],
      external_assessment: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      manchester_external_assessment_verified: Boolean(assessment),
      manchester_external_assessment_date_checked: assessment?.date_checked || null,
      manchester_external_assessment_source: assessment?.source || null,
      area_criterion_status: areaCriterion.status,
      school_criterion_status: schoolCriterion.status,
      wp_band: wpBand
    }
  };

  if (assessment) {
    addMatched(
      results,
      'external_assessment',
      'verified_manchester_contextual_tool',
      'Verified Manchester contextual eligibility tool result',
      'contextual_evidence.external_assessments',
      assessment.assessment_id || assessment.assessment_identifier || 'contextual_eligibility_tool',
      {
        provider_university_id: assessment.provider_university_id || null,
        verification_status: assessment.verification_status || assessment.status || null
      }
    );
  } else {
    addUnmatched(
      results,
      'external_assessment',
      'verified_manchester_contextual_tool',
      'Verified Manchester contextual eligibility tool result',
      'contextual_evidence.external_assessments',
      null
    );
  }

  const residenceYes = answerIsYes(currentUkResidence, normaliseId);
  const residenceNo = answerIsNo(currentUkResidence, normaliseId);
  if (residenceYes) {
    addMatched(
      results,
      'contextual_aab',
      'current_uk_residence',
      'Currently lives in the UK',
      'applicant_identity.current_uk_residence',
      currentUkResidence
    );
  } else if (residenceNo) {
    addUnmatched(
      results,
      'contextual_aab',
      'current_uk_residence',
      'Currently lives in the UK',
      'applicant_identity.current_uk_residence',
      currentUkResidence
    );
  } else {
    addMissing(
      results,
      'contextual_aab',
      'current_uk_residence',
      'Currently lives in the UK',
      'applicant_identity.current_uk_residence',
      'current_uk_residence_required'
    );
  }

  if (ageAssessment?.status === 'pass') {
    addMatched(
      results,
      'contextual_aab',
      'under_21_on_1_september',
      'Under 21 on 1 September of the course-start year',
      'applicant_identity.age_at_course_start_band',
      identity.age_at_course_start_band,
      { age: ageAssessment.age }
    );
  } else if (ageAssessment?.status === 'fail') {
    addUnmatched(
      results,
      'contextual_aab',
      'under_21_on_1_september',
      'Under 21 on 1 September of the course-start year',
      'applicant_identity.age_at_course_start_band',
      identity.age_at_course_start_band,
      { age: ageAssessment.age }
    );
  } else {
    addMissing(
      results,
      'contextual_aab',
      'under_21_on_1_september',
      'Under 21 on 1 September of the course-start year',
      'applicant_identity.age_at_course_start_band',
      'precise_age_confirmation_required'
    );
  }

  if (areaCriterion.status === 'confirmed') {
    addMatched(
      results,
      'contextual_aab',
      'area_criterion',
      'Manchester qualifying area or low-progression criterion',
      areaCriterion.evidence_path,
      areaCriterion.actual,
      {
        matched_criteria: areaCriterion.matched_criteria
      }
    );
  } else if (areaCriterion.status === 'not_met') {
    addUnmatched(
      results,
      'contextual_aab',
      'area_criterion',
      'Manchester qualifying area or low-progression criterion',
      areaCriterion.evidence_path,
      areaCriterion.actual
    );
  } else {
    addMissing(
      results,
      'contextual_aab',
      'area_criterion',
      'Manchester qualifying area or low-progression criterion',
      areaCriterion.evidence_path,
      'postcode_area_quintile_confirmation_required'
    );
  }

  for (const entry of schoolCriterion.checks) {
    results.checks.contextual_aab.push(entry);
    if (entry.status === 'matched') {
      results.qualifying_criteria.push(entry);
    } else if (!entry.status) {
      results.missing_information.push(entry);
    }
  }

  const careOverThreeMonths = personal.care_over_three_months;
  const explicitCareExperienced = personal.care_experienced;
  const ukRefugeeStatusGranted = personal.uk_refugee_status_granted;
  const explicitRefugeeStatus = personal.refugee;
  const ukrainianVisaScheme = personal.ukrainian_visa_scheme;
  const ukrainianVisaMatch = ACCEPTED_UKRAINIAN_VISA_SCHEMES.has(normaliseId(ukrainianVisaScheme));

  if (answerIsYes(careOverThreeMonths, normaliseId)) {
    addMatched(
      results,
      'refugee_care_abb',
      'care_over_three_months',
      'Care experience for more than three months',
      'personal_circumstances.care_over_three_months',
      careOverThreeMonths
    );
  } else if (answerIsNo(careOverThreeMonths, normaliseId)) {
    addUnmatched(
      results,
      'refugee_care_abb',
      'care_over_three_months',
      'Care experience for more than three months',
      'personal_circumstances.care_over_three_months',
      careOverThreeMonths
    );
  } else if (answerIsYes(explicitCareExperienced, normaliseId)) {
    addMissing(
      results,
      'refugee_care_abb',
      'care_over_three_months',
      'Care experience for more than three months',
      'personal_circumstances.care_over_three_months',
      'care_duration_confirmation_required'
    );
  }

  if (answerIsYes(ukRefugeeStatusGranted, normaliseId)) {
    addMatched(
      results,
      'refugee_care_abb',
      'uk_refugee_status_granted',
      'Refugee status granted by the UK government',
      'personal_circumstances.uk_refugee_status_granted',
      ukRefugeeStatusGranted
    );
  } else if (answerIsNo(ukRefugeeStatusGranted, normaliseId)) {
    addUnmatched(
      results,
      'refugee_care_abb',
      'uk_refugee_status_granted',
      'Refugee status granted by the UK government',
      'personal_circumstances.uk_refugee_status_granted',
      ukRefugeeStatusGranted
    );
  } else if (answerIsYes(explicitRefugeeStatus, normaliseId)) {
    addMissing(
      results,
      'refugee_care_abb',
      'uk_refugee_status_granted',
      'Refugee status granted by the UK government',
      'personal_circumstances.uk_refugee_status_granted',
      'uk_refugee_grant_confirmation_required'
    );
  }

  if (ukrainianVisaMatch) {
    addMatched(
      results,
      'refugee_care_abb',
      'ukrainian_visa_scheme',
      'Qualifying Ukrainian visa scheme',
      'personal_circumstances.ukrainian_visa_scheme',
      ukrainianVisaScheme
    );
  } else if (answerIsNo(ukrainianVisaScheme, normaliseId) || normaliseId(ukrainianVisaScheme) === 'none') {
    addUnmatched(
      results,
      'refugee_care_abb',
      'ukrainian_visa_scheme',
      'Qualifying Ukrainian visa scheme',
      'personal_circumstances.ukrainian_visa_scheme',
      ukrainianVisaScheme
    );
  }

  const contextualAabConfirmed =
    residenceYes &&
    ageAssessment?.status === 'pass' &&
    areaCriterion.status === 'confirmed' &&
    schoolCriterion.status === 'confirmed';
  const refugeeCareAbbConfirmed =
    answerIsYes(careOverThreeMonths, normaliseId) ||
    answerIsYes(ukRefugeeStatusGranted, normaliseId) ||
    ukrainianVisaMatch;

  if (refugeeCareAbbConfirmed) {
    results.status = 'contextual';
    results.reason = 'manchester_refugee_care_abb_route_eligible';
    results.is_contextual = true;
    results.matched_contextual_pathway = 'manchester_refugee_care_abb';
    results.activated_applicant_group_ids = [
      MANCHESTER_REFUGEE_CARE_ABB_GROUP_ID,
      'contextual',
      'widening_participation',
      ...(wpBand ? [MANCHESTER_WP_VERIFIED_GROUP_ID] : [])
    ];
    return results;
  }

  if (contextualAabConfirmed) {
    results.status = 'contextual';
    results.reason = 'manchester_contextual_aab_route_eligible';
    results.is_contextual = true;
    results.matched_contextual_pathway = 'manchester_contextual_aab';
    results.activated_applicant_group_ids = [
      MANCHESTER_CONTEXTUAL_AAB_GROUP_ID,
      'contextual',
      'widening_participation',
      ...(wpBand ? [MANCHESTER_WP_VERIFIED_GROUP_ID] : [])
    ];
    return results;
  }

  const contextualAabCouldStillApply =
    residenceNo !== true &&
    ageAssessment?.status !== 'fail' &&
    (areaCriterion.status === 'confirmed' || schoolCriterion.status === 'confirmed') &&
    (
      !residenceYes ||
      ageAssessment?.status !== 'pass' ||
      areaCriterion.status === 'unknown' ||
      schoolCriterion.status === 'unknown'
    );
  const refugeeCareAbbCouldStillApply =
    (answerIsYes(explicitCareExperienced, normaliseId) && isMissing(careOverThreeMonths)) ||
    (answerIsYes(explicitRefugeeStatus, normaliseId) && isMissing(ukRefugeeStatusGranted));

  if (contextualAabCouldStillApply || refugeeCareAbbCouldStillApply) {
    results.status = 'information_needed';
    results.reason =
      contextualAabCouldStillApply && refugeeCareAbbCouldStillApply
        ? 'manchester_contextual_or_refugee_care_information_needed'
        : contextualAabCouldStillApply
          ? 'manchester_contextual_information_needed'
          : 'manchester_refugee_or_care_information_needed';
    results.manual_review_reason = results.reason;
    results.provisional_activated_applicant_group_ids = [
      ...(refugeeCareAbbCouldStillApply ? [MANCHESTER_REFUGEE_CARE_ABB_GROUP_ID] : []),
      ...(contextualAabCouldStillApply ? [MANCHESTER_CONTEXTUAL_AAB_GROUP_ID] : []),
      'contextual',
      'widening_participation'
    ];
    if (wpBand) {
      results.provisional_activated_applicant_group_ids.push(MANCHESTER_WP_VERIFIED_GROUP_ID);
    }
  }

  return results;
}

module.exports = {
  MANCHESTER_CONTEXTUAL_EVALUATOR_ID,
  MANCHESTER_CONTEXTUAL_AAB_GROUP_ID,
  MANCHESTER_REFUGEE_CARE_ABB_GROUP_ID,
  MANCHESTER_WP_VERIFIED_GROUP_ID,
  evaluateManchesterContextualEligibility
};
