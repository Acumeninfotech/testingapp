const ABERDEEN_CONTEXTUAL_EVALUATOR_ID = 'aberdeen_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  return normaliseId(value) === 'yes';
}

function hasSubstantiveAccessValue(value, normaliseId) {
  const normalised = normaliseId(value);
  return Boolean(normalised) &&
    ![
      'no',
      'none',
      'not_sure',
      'unsure',
      'unknown',
      'false',
      'not_applicable',
      'na',
      'n_a'
    ].includes(normalised);
}

function check(criterionId, label, evidencePath, status, actual = undefined) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual
  };
}

function isHomeFeeStatus(feeStatus, normaliseId) {
  const value = normaliseId(feeStatus);
  return (
    value === 'home' ||
    value === 'home_fee' ||
    value === 'ruk' ||
    value === 'rest_of_uk' ||
    value === 'rest_of_uk_roi_fee_rate' ||
    value.includes('home')
  );
}

function isRestOfUkApplicant(identity, normaliseId) {
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  return (
    ['ruk', 'rest_of_uk', 'rest_of_uk_roi_fee_rate'].includes(feeStatus) ||
    ['england', 'wales', 'northern_ireland', 'rest_of_uk'].includes(domicile)
  );
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'aberdeen_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      qualifying_criteria: [],
      manual_review_criteria: []
    },
    contextual_criteria: [],
    ucat_uplift_percent: null,
    activated_applicant_group_ids: []
  };
}

function contextualOutcome(result, matchedCheck, extra = {}) {
  const contextualCriteria = [
    matchedCheck.criterion_id,
    ...(extra.contextual_criteria || [])
  ];
  return {
    ...result,
    status: 'contextual',
    reason: 'aberdeen_contextual_criterion_met',
    is_contextual: true,
    matched_contextual_pathway: matchedCheck.criterion_id,
    matched_contextual_pathway_label: matchedCheck.label,
    qualifying_criteria: [
      ...result.qualifying_criteria,
      matchedCheck
    ],
    contextual_criteria: [...new Set(contextualCriteria)],
    ucat_uplift_percent: extra.ucat_uplift_percent ?? null,
    activated_applicant_group_ids: [
      'contextual',
      'widening_participation',
      ...(extra.activated_applicant_group_ids || [])
    ]
  };
}

function unresolvedAccessProgrammeSignal(accessProgrammes, normaliseId) {
  const otherProgrammes = asArray(accessProgrammes.other_programmes);
  const reachSignals = [
    accessProgrammes.reach_program_scotland,
    accessProgrammes.reach_participation,
    accessProgrammes.other_programme_name,
    ...otherProgrammes.flatMap((programme) => {
      const record = asObject(programme);
      return [
        record.programme_id,
        record.programme_name,
        record.name,
        record.label
      ];
    })
  ];
  return reachSignals.some((value) => {
    const normalised = normaliseId(value);
    return hasSubstantiveAccessValue(value, normaliseId) &&
      (
        normalised === 'reach' ||
        normalised === 'reach_program_scotland' ||
        normalised === 'scotland_reach_program' ||
        normalised === 'reach_scotland' ||
        normalised.includes('reach_program') ||
        normalised.includes('reach_scotland')
      );
  });
}

function evaluateAberdeenContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = asObject(applicant.applicant_identity);
  const personal = asObject(evidence.personal_circumstances);
  const accessProgrammes = asObject(evidence.access_programmes);
  const postcode = asObject(evidence.postcode_measures);
  const result = defaultResult();

  const homeFee = isHomeFeeStatus(identity.fee_status, normaliseId);
  const restOfUk = isRestOfUkApplicant(identity, normaliseId);
  const scopePassed = homeFee && restOfUk;
  result.checks.scope.push(check(
    'home_ruk_scope',
    'Home fee status and Rest of UK route',
    'applicant_identity.fee_status/applicant_identity.domicile',
    scopePassed ? 'matched' : 'not_applicable',
    {
      fee_status: identity.fee_status,
      domicile: identity.domicile
    }
  ));

  if (!scopePassed) {
    return {
      ...result,
      reason: 'aberdeen_contextual_not_applicable',
      policy_decision: 'outside_home_ruk_contextual_scope'
    };
  }

  const polar4Check = check(
    'polar4_quintile_1',
    'POLAR4 Quintile 1',
    'home_area_region.polar4_quintile',
    postcode.polar4_quintile === 'q1' ? 'matched' : 'not_matched',
    postcode.polar4_quintile
  );
  result.checks.qualifying_criteria.push(polar4Check);
  if (polar4Check.status === 'matched') {
    return contextualOutcome(result, polar4Check);
  }

  const careCheck = check(
    'care_experienced',
    'Care experienced',
    'personal_circumstances.care_experienced',
    answerIsYes(personal.care_experienced, normaliseId) ? 'matched' : 'not_matched',
    personal.care_experienced
  );
  result.checks.qualifying_criteria.push(careCheck);
  if (careCheck.status === 'matched') {
    return contextualOutcome(result, careCheck, {
      activated_applicant_group_ids: ['care_experienced'],
      contextual_criteria: ['care_experienced'],
      ucat_uplift_percent: 10
    });
  }

  const youngCarerCheck = check(
    'young_or_adult_carer',
    'Young or adult carer',
    'personal_circumstances.young_or_adult_carer',
    answerIsYes(personal.young_or_adult_carer, normaliseId)
      ? 'information_needed'
      : 'not_matched',
    personal.young_or_adult_carer
  );
  result.checks.manual_review_criteria.push(youngCarerCheck);

  const reachCheck = check(
    'reach_program_scotland',
    'Reach Program Scotland participation',
    'access_programmes',
    unresolvedAccessProgrammeSignal(accessProgrammes, normaliseId)
      ? 'information_needed'
      : 'not_matched'
  );
  result.checks.manual_review_criteria.push(reachCheck);

  const missingInformation = [youngCarerCheck, reachCheck]
    .filter((entry) => entry.status === 'information_needed')
    .map((entry) => ({
      criterion_id: entry.criterion_id,
      label: entry.label,
      evidence_path: entry.evidence_path,
      reason: 'aberdeen_contextual_evidence_needs_review'
    }));

  if (missingInformation.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'aberdeen_contextual_information_needed',
      manual_review_reason: 'aberdeen_contextual_information_needed',
      missing_information: missingInformation,
      policy_decision: 'manual_review_required_for_unresolved_contextual_evidence'
    };
  }

  return result;
}

module.exports = {
  ABERDEEN_CONTEXTUAL_EVALUATOR_ID,
  evaluateAberdeenContextualEligibility
};
