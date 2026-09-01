const LEEDS_CONTEXTUAL_EVALUATOR_ID = 'leeds_contextual_medicine_a100';

const LEEDS_ACCESS_TO_LEEDS_GROUP_ID = 'access_to_leeds_confirmed';
const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
const ACCESS_TO_LEEDS_PROGRAMME_IDS = new Set([
  'access_to_leeds',
  'leeds_access_to_leeds',
  'access_to_leeds_scheme'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible', 'verified'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'none', 'not_applicable', 'not_eligible'].includes(normaliseId(value));
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

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'leeds_access_to_leeds_not_confirmed',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      access_to_leeds: [],
      ignored_legacy: []
    },
    contextual_evidence: {
      matched_criteria: [],
      possible_pathways: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    source_ids: ['leeds_course_page_2027', 'leeds_access_to_leeds_eligibility']
  };
}

function addMatched(result, entry) {
  result.qualifying_criteria.push(entry);
  result.checks.access_to_leeds.push(entry);
  result.contextual_evidence.matched_criteria.push(entry.criterion_id);
}

function addMissing(result, entry) {
  result.missing_information.push(entry);
  result.checks.access_to_leeds.push(entry);
  result.contextual_evidence.possible_pathways.push('access_to_leeds');
}

function isHomeFee(applicant, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const groups = new Set((applicant.applicant_group_ids || []).map(normaliseId));
  return feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus.includes('home') ||
    groups.has('home_fee');
}

function structuredAccessToLeedsEvidence(applicant, evidence, helpers) {
  const profileAccess = asObject(asObject(applicant.contextual_profile).access_programmes);
  const evidenceAccess = asObject(evidence.access_programmes);
  const direct = [
    asObject(profileAccess.access_to_leeds),
    asObject(evidenceAccess.access_to_leeds)
  ];
  const programmes = [
    ...direct,
    ...asArray(evidenceAccess.other_programmes).map(asObject),
    ...asArray(profileAccess.other_programmes).map(asObject)
  ];

  return programmes.find((programme) => {
    const programmeId = helpers.normaliseId(
      programme.programme_id ||
        programme.id ||
        programme.programme_name ||
        programme.name
    );
    return ACCESS_TO_LEEDS_PROGRAMME_IDS.has(programmeId);
  }) || null;
}

function accessToLeedsStatus(programme, helpers) {
  return helpers.normaliseId(
    programme.status ||
      programme.programme_status ||
      programme.eligibility_status ||
      programme.verified
  );
}

function evaluateLeedsContextualEligibility({ course, applicant, evidence, helpers }) {
  const result = defaultResult();

  if (course?.profile_id !== 'leeds-a100') {
    return result;
  }

  if (!isHomeFee(applicant, helpers.normaliseId)) {
    result.checks.scope.push(check(
      'leeds_access_to_leeds_home_fee_scope',
      'Home fee Access to Leeds scope',
      'applicant_identity.fee_status',
      'not_matched',
      asObject(applicant.applicant_identity).fee_status
    ));
    return {
      ...result,
      reason: 'leeds_access_to_leeds_home_fee_required',
      policy_decision: 'outside_contextual_scope'
    };
  }

  result.checks.scope.push(check(
    'leeds_access_to_leeds_home_fee_scope',
    'Home fee Access to Leeds scope',
    'applicant_identity.fee_status',
    'matched',
    asObject(applicant.applicant_identity).fee_status
  ));

  const legacy = evidence.legacy_declarations || {};
  const legacyAccessFlag = asObject(asObject(applicant.applicant_identity).contextual_flags).access_to_leeds;
  const oldDirectEvidence = asObject(asObject(applicant.contextual_evidence).access_to_leeds);
  if (
    legacy.contextual ||
    legacy.widening_participation ||
    legacyAccessFlag === true ||
    oldDirectEvidence.verified === true ||
    legacy.confirmed_flag_ids?.length
  ) {
    result.checks.ignored_legacy.push(check(
      'leeds_legacy_access_to_leeds_declaration_ignored',
      'Legacy contextual / Access to Leeds declaration',
      'applicant_identity.contextual_flags.access_to_leeds',
      'ignored',
      {
        contextual: legacy.contextual,
        widening_participation: legacy.widening_participation,
        access_to_leeds_flag: legacyAccessFlag,
        legacy_verified: oldDirectEvidence.verified
      }
    ));
  }

  const programme = structuredAccessToLeedsEvidence(applicant, evidence, helpers);
  if (!programme) {
    return {
      ...result,
      policy_decision: 'access_to_leeds_not_confirmed'
    };
  }

  const status = accessToLeedsStatus(programme, helpers);
  const entry = check(
    'access_to_leeds',
    'Confirmed Access to Leeds eligibility',
    'contextual_profile.access_programmes',
    ['completed', 'confirmed', 'eligible', 'verified'].includes(status) ? 'matched' :
      ['offered', 'participating', 'started', 'applied', 'pending', 'not_sure'].includes(status) || isMissing(status)
        ? 'needs_review'
        : 'not_matched',
    programme.programme_id || programme.programme_name || null,
    { programme_status: status || null }
  );

  if (entry.status === 'matched') {
    addMatched(result, entry);
    return {
      ...result,
      status: 'contextual',
      reason: 'leeds_access_to_leeds_confirmed',
      is_contextual: true,
      matched_contextual_pathway: LEEDS_ACCESS_TO_LEEDS_GROUP_ID,
      matched_contextual_pathway_label: 'Access to Leeds',
      policy_decision: 'access_to_leeds_confirmed',
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation',
        LEEDS_ACCESS_TO_LEEDS_GROUP_ID
      ]
    };
  }

  if (entry.status === 'needs_review') {
    addMissing(result, entry);
    return {
      ...result,
      status: 'information_needed',
      reason: 'leeds_access_to_leeds_evidence_needs_review',
      is_contextual: false,
      manual_review_reason: 'leeds_access_to_leeds_evidence_needs_review',
      policy_decision: 'access_to_leeds_information_needed',
      provisional_activated_applicant_group_ids: []
    };
  }

  result.checks.access_to_leeds.push(entry);
  return {
    ...result,
    policy_decision: 'access_to_leeds_not_confirmed'
  };
}

module.exports = {
  LEEDS_ACCESS_TO_LEEDS_GROUP_ID,
  LEEDS_CONTEXTUAL_EVALUATOR_ID,
  evaluateLeedsContextualEligibility
};
