const NEWCASTLE_CONTEXTUAL_EVALUATOR_ID = 'newcastle_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function answerIsYes(value, normaliseId) {
  return normaliseId(value) === 'yes';
}

function quintileIs(value, allowed, normaliseId) {
  const normalised = normaliseId(value);
  return allowed.some((entry) => normalised === `q${entry}` || normalised === String(entry));
}

function check(criterionId, label, evidencePath, matched, actual = undefined) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status: matched ? 'matched' : 'not_matched',
    actual
  };
}

function evaluateNewcastleContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const groupIds = new Set((applicant.applicant_group_ids || []).map(normaliseId));
  const identity = asObject(applicant.applicant_identity);
  const applicantType = normaliseId(identity.applicant_type);
  const feeStatus = normaliseId(identity.fee_status);
  const isHome = groupIds.has('home_fee') ||
    feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus.includes('home');
  const isInternational = groupIds.has('international_fee') || feeStatus.includes('international');
  const isGraduate = groupIds.has('graduate_applicant') ||
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true ||
    applicantType.includes('graduate');

  const result = {
    status: 'not_contextual',
    reason: 'newcastle_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      qualifying_criteria: [],
      exclusions: []
    },
    activated_applicant_group_ids: []
  };

  if (!isHome || isInternational) {
    result.reason = 'newcastle_contextual_home_fee_required';
    result.exclusions.push('international_or_non_home_fee');
    result.checks.exclusions.push(check(
      'home_fee_required',
      'Home fee status required',
      'applicant_identity.fee_status',
      true,
      identity.fee_status
    ));
    return result;
  }

  if (isGraduate) {
    result.reason = 'newcastle_contextual_excludes_graduates';
    result.exclusions.push('graduate_applicant');
    result.checks.exclusions.push(check(
      'graduate_applicant_excluded',
      'Graduate applicants are not routed through ordinary contextual offers',
      'applicant_identity.graduate',
      true,
      identity.graduate
    ));
    return result;
  }

  const postcode = asObject(evidence.postcode_measures);
  const homeArea = asObject(evidence.home_area_region);
  const financial = asObject(evidence.financial_support);
  const school = asObject(evidence.school_education);
  const personal = asObject(evidence.personal_circumstances);

  const criteria = [
    check(
      'tundra_quintile_1_or_2',
      'TUNDRA quintile 1 or 2',
      'home_area_region.tundra_quintile',
      quintileIs(postcode.tundra_quintile, [1, 2], normaliseId),
      postcode.tundra_quintile
    ),
    check(
      'care_experienced',
      'Care experience',
      'personal_circumstances.care_experienced',
      answerIsYes(personal.care_experienced ?? personal.care_over_three_months ?? personal.care_leaver, normaliseId),
      personal.care_experienced ?? personal.care_over_three_months ?? personal.care_leaver
    ),
    check(
      'estranged',
      'Estranged student',
      'personal_circumstances.estranged_from_family',
      answerIsYes(personal.estranged_from_family ?? personal.estranged, normaliseId),
      personal.estranged_from_family ?? personal.estranged
    ),
    check(
      'free_school_meals',
      'Free school meals',
      'financial_support.free_school_meals',
      answerIsYes(financial.free_school_meals, normaliseId),
      financial.free_school_meals
    ),
    check(
      'recognised_carer',
      'Recognised caring responsibilities',
      'personal_circumstances.young_or_adult_carer',
      answerIsYes(personal.young_or_adult_carer ?? personal.unpaid_carer ?? personal.carer, normaliseId),
      personal.young_or_adult_carer ?? personal.unpaid_carer ?? personal.carer
    ),
    check(
      'north_east_state_school',
      'State school in North East England',
      'school_education.state_school_in_north_east_england',
      answerIsYes(school.state_school_in_north_east_england, normaliseId),
      school.state_school_in_north_east_england
    ),
    check(
      'regional_contextual_state_school',
      '2027 Regional Contextual state-school evidence',
      'school_education.newcastle_regional_contextual_state_school',
      answerIsYes(school.newcastle_regional_contextual_state_school, normaliseId) ||
        (
          answerIsYes(school.state_school, normaliseId) &&
          ['north_east_england_or_cumbria', 'north_east_england'].includes(normaliseId(homeArea.home_region))
        ),
      school.newcastle_regional_contextual_state_school ?? school.state_school
    )
  ];

  result.checks.qualifying_criteria.push(...criteria);
  result.qualifying_criteria = criteria.filter((entry) => entry.status === 'matched');

  const matched = result.qualifying_criteria[0] || null;
  if (matched) {
    result.status = 'contextual';
    result.reason = 'newcastle_contextual_criterion_met';
    result.is_contextual = true;
    result.matched_contextual_pathway = matched.criterion_id;
    result.matched_contextual_pathway_label = matched.label;
    result.activated_applicant_group_ids = ['contextual', 'widening_participation'];
  }

  return result;
}

module.exports = {
  NEWCASTLE_CONTEXTUAL_EVALUATOR_ID,
  evaluateNewcastleContextualEligibility
};
