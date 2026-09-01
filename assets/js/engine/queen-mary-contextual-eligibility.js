const QUEEN_MARY_CONTEXTUAL_EVALUATOR_ID = 'queen_mary_contextual_medicine_a100';

const QUEEN_MARY_CONTEXTUAL_AAA_GROUP_ID = 'queen_mary_contextual_aaa';
const QUEEN_MARY_CARE_LEAVER_AAB_GROUP_ID = 'queen_mary_care_leaver_aab';
const QUEEN_MARY_ACCESS_PROGRAMME_GROUP_ID =
  'queen_mary_access_programme_guaranteed_interview';

const RECOGNISED_ACCESS_PROGRAMME_IDS = new Set([
  'access_to_queen_mary',
  'realising_opportunities',
  'bridge_the_gap'
]);

const COMPLETED_STATUSES = new Set(['completed']);
const INTERMEDIATE_STATUSES = new Set([
  'offered',
  'accepted',
  'participating',
  'enrolled',
  'current',
  'in_progress'
]);
const VERIFIED_STATUSES = new Set([
  'verified',
  'confirmed',
  'official_verified',
  'officially_verified',
  'valid'
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
    reason: 'queen_mary_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'criteria_not_met',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      ordinary_contextual: [],
      care_leaver: [],
      access_programmes: [],
      ignored_legacy: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      matched_criteria: [],
      matched_programmes: []
    },
    source_ids: [
      'qmul_contextual_admissions',
      'qmul_a100_entry_requirements',
      'qmul_a100_selection_criteria'
    ]
  };
}

function applicantInContextualScope(applicant, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const graduate =
    identity.graduate === true ||
    normaliseId(identity.applicant_type).includes('graduate') ||
    applicant.graduate_profile?.is_graduate === true;
  const international =
    feeStatus.includes('international') ||
    feeStatus.includes('overseas');

  if (graduate) {
    return { status: 'not_applicable', reason: 'queen_mary_contextual_excludes_graduates' };
  }
  if (international) {
    return { status: 'not_applicable', reason: 'queen_mary_contextual_excludes_international_fee' };
  }
  return { status: 'confirmed' };
}

function externalAssessments(applicant) {
  return asArray(applicant?.contextual_evidence?.external_assessments);
}

function verifiedQueenMaryAssessment(applicant, normaliseId) {
  return externalAssessments(applicant).find((record) => {
    const entry = asObject(record);
    const provider = normaliseId(
      entry.provider_university_id ||
      entry.provider ||
      entry.university_id ||
      entry.university
    );
    const assessmentId = normaliseId(
      entry.assessment_id ||
      entry.assessment_identifier ||
      entry.identifier ||
      entry.tool_id
    );
    const status = normaliseId(entry.verification_status || entry.status);
    const result = normaliseId(entry.result || entry.outcome || entry.decision);

    const providerMatches = [
      'queen_mary_a100',
      'queen_mary',
      'qmul',
      'queen_mary_university_of_london'
    ].includes(provider);
    const assessmentMatches =
      assessmentId.includes('queen_mary') ||
      assessmentId.includes('qmul');
    const statusMatches = entry.verified === true || VERIFIED_STATUSES.has(status);
    const resultMatches = ['contextual', 'eligible', 'contextual_eligible'].includes(result);

    return providerMatches && assessmentMatches && statusMatches && resultMatches;
  }) || null;
}

function rawContextualProfile(applicant) {
  return asObject(applicant.contextual_profile);
}

function evaluateCareLeaver(applicant, evidence, result, normaliseId) {
  const rawPersonal = asObject(rawContextualProfile(applicant).personal_circumstances);
  const personal = asObject(evidence.personal_circumstances);
  const careLeaver =
    rawPersonal.care_leaver ??
    rawPersonal.local_authority_care_leaver ??
    rawPersonal.looked_after_child_care_leaver ??
    personal.care_leaver ??
    personal.local_authority_care_leaver ??
    personal.looked_after_child_care_leaver;
  const matched = answerIsYes(careLeaver, normaliseId);
  const entry = check(
    'queen_mary_care_leaver_confirmed',
    'Queen Mary care-leaver status confirmed',
    'contextual_profile.personal_circumstances.care_leaver',
    matched ? 'matched' : 'not_matched',
    careLeaver
  );
  result.checks.care_leaver.push(entry);
  if (matched) {
    result.qualifying_criteria.push(entry);
    result.contextual_evidence.matched_criteria.push(entry.criterion_id);
  }
  return matched;
}

function programmeStatus(programme, normaliseId) {
  return normaliseId(programme.status || programme.programme_status || programme.completion_status);
}

function programmeVerified(programme, normaliseId) {
  const verification = normaliseId(programme.verification_status || programme.evidence_status);
  return programme.verified === true || VERIFIED_STATUSES.has(verification);
}

function recognisedProgrammeId(programme, normaliseId) {
  const programmeId = normaliseId(programme.programme_id || programme.programme_name || programme.name);
  return RECOGNISED_ACCESS_PROGRAMME_IDS.has(programmeId) ? programmeId : null;
}

function accessProgrammes(applicant) {
  return asArray(asObject(rawContextualProfile(applicant).access_programmes).other_programmes);
}

function evaluateAccessProgramme(applicant, result, normaliseId) {
  const programme = accessProgrammes(applicant)
    .map(asObject)
    .find((entry) => recognisedProgrammeId(entry, normaliseId));

  if (!programme) {
    result.checks.access_programmes.push(check(
      'queen_mary_recognised_access_programme',
      'Recognised Queen Mary access programme',
      'contextual_profile.access_programmes.other_programmes',
      'not_matched',
      null
    ));
    return { status: 'not_matched' };
  }

  const programmeId = recognisedProgrammeId(programme, normaliseId);
  const status = programmeStatus(programme, normaliseId);
  const verified = programmeVerified(programme, normaliseId);
  const completed = COMPLETED_STATUSES.has(status) && verified;
  const unresolved = INTERMEDIATE_STATUSES.has(status) || (COMPLETED_STATUSES.has(status) && !verified);
  const entry = check(
    'queen_mary_access_programme_completion',
    'Recognised access programme completion',
    'contextual_profile.access_programmes.other_programmes',
    completed ? 'matched' : unresolved ? 'needs_review' : 'not_matched',
    programmeId,
    {
      programme_status: status || null,
      verification_status: programme.verification_status || null,
      required_status: 'completed',
      required_verification: 'confirmed'
    }
  );

  result.checks.access_programmes.push(entry);
  if (completed) {
    result.qualifying_criteria.push(entry);
    result.contextual_evidence.matched_criteria.push(entry.criterion_id);
    result.contextual_evidence.matched_programmes.push(programmeId);
    return { status: 'completed', programme_id: programmeId };
  }
  if (unresolved) {
    result.missing_information.push({
      ...entry,
      reason: 'queen_mary_access_programme_completion_confirmation_required'
    });
    return { status: 'information_needed', programme_id: programmeId };
  }
  return { status: 'not_matched', programme_id: programmeId };
}

function evaluateOrdinaryContextual(applicant, evidence, result, normaliseId) {
  const assessment = verifiedQueenMaryAssessment(applicant, normaliseId);
  const rawPersonal = asObject(rawContextualProfile(applicant).personal_circumstances);
  const personal = asObject(evidence.personal_circumstances);
  const financial = asObject(evidence.financial_support);
  const ordinaryCriteria = [
    {
      criterion_id: 'queen_mary_verified_contextual_assessment',
      label: 'Verified Queen Mary contextual assessment',
      evidence_path: 'contextual_evidence.external_assessments',
      actual: assessment ? assessment.assessment_id || assessment.assessment_identifier : null,
      matched: Boolean(assessment)
    },
    {
      criterion_id: 'queen_mary_care_experience_contextual',
      label: 'Care experience recognised for ordinary contextual consideration',
      evidence_path: 'contextual_profile.personal_circumstances.care_experienced',
      actual: rawPersonal.care_experienced ?? personal.care_experienced,
      matched: answerIsYes(rawPersonal.care_experienced ?? personal.care_experienced, normaliseId)
    },
    {
      criterion_id: 'queen_mary_free_school_meals_contextual',
      label: 'Free School Meals recognised for ordinary contextual consideration',
      evidence_path: 'contextual_profile.financial_support.free_school_meals',
      actual: financial.free_school_meals,
      matched: answerIsYes(financial.free_school_meals, normaliseId)
    },
    {
      criterion_id: 'queen_mary_ucat_bursary_contextual',
      label: 'UCAT bursary recognised for ordinary contextual consideration',
      evidence_path: 'contextual_profile.financial_support.ucat_bursary_recipient',
      actual: financial.ucat_bursary_recipient,
      matched: answerIsYes(financial.ucat_bursary_recipient, normaliseId)
    }
  ];

  const matched = [];
  for (const criterion of ordinaryCriteria) {
    const entry = check(
      criterion.criterion_id,
      criterion.label,
      criterion.evidence_path,
      criterion.matched ? 'matched' : 'not_matched',
      criterion.actual
    );
    result.checks.ordinary_contextual.push(entry);
    if (criterion.matched) {
      result.qualifying_criteria.push(entry);
      result.contextual_evidence.matched_criteria.push(entry.criterion_id);
      matched.push(entry);
    }
  }

  return matched[0] || null;
}

function evaluateQueenMaryContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const scope = applicantInContextualScope(applicant, normaliseId);
  result.checks.scope.push(check(
    'queen_mary_contextual_scope',
    'Queen Mary contextual admissions scope',
    'applicant_identity.fee_status',
    scope.status === 'confirmed' ? 'matched' : 'not_applicable',
    asObject(applicant.applicant_identity).fee_status,
    { reason: scope.reason || null }
  ));

  if (scope.status !== 'confirmed') {
    return {
      ...result,
      status: 'not_applicable',
      reason: scope.reason,
      policy_decision: 'outside_contextual_policy_scope'
    };
  }

  result.checks.ignored_legacy.push(check(
    'queen_mary_legacy_contextual_fields_ignored',
    'Legacy contextual declarations are diagnostic only',
    'applicant_identity.contextual/applicant_identity.contextual_flags',
    'ignored',
    evidence.legacy_declarations
  ));

  const careLeaverConfirmed = evaluateCareLeaver(applicant, evidence, result, normaliseId);
  if (careLeaverConfirmed) {
    return {
      ...result,
      status: 'contextual',
      reason: 'queen_mary_care_leaver_aab_confirmed',
      is_contextual: true,
      matched_contextual_pathway: 'queen_mary_care_leaver_aab',
      matched_contextual_pathway_label: 'Queen Mary care-leaver enhanced offer',
      policy_decision: 'care_leaver_aab_offer_confirmed',
      activated_applicant_group_ids: [
        QUEEN_MARY_CARE_LEAVER_AAB_GROUP_ID,
        'contextual',
        'widening_participation'
      ]
    };
  }

  const accessProgramme = evaluateAccessProgramme(applicant, result, normaliseId);
  if (accessProgramme.status === 'information_needed') {
    return {
      ...result,
      status: 'information_needed',
      reason: 'queen_mary_access_programme_completion_confirmation_required',
      manual_review_reason: 'queen_mary_access_programme_completion_confirmation_required',
      policy_decision: 'access_programme_completion_information_needed',
      provisional_activated_applicant_group_ids: [QUEEN_MARY_CONTEXTUAL_AAA_GROUP_ID]
    };
  }
  if (accessProgramme.status === 'completed') {
    return {
      ...result,
      status: 'contextual',
      reason: 'queen_mary_access_programme_completion_confirmed',
      is_contextual: true,
      matched_contextual_pathway: 'queen_mary_access_programme_guaranteed_interview',
      matched_contextual_pathway_label: 'Queen Mary recognised access programme',
      policy_decision: 'access_programme_guaranteed_interview_pathway_confirmed',
      activated_applicant_group_ids: [
        QUEEN_MARY_ACCESS_PROGRAMME_GROUP_ID,
        QUEEN_MARY_CONTEXTUAL_AAA_GROUP_ID,
        'contextual',
        'widening_participation'
      ]
    };
  }

  const ordinary = evaluateOrdinaryContextual(applicant, evidence, result, normaliseId);
  if (ordinary) {
    return {
      ...result,
      status: 'contextual',
      reason: 'queen_mary_ordinary_contextual_aaa_confirmed',
      is_contextual: true,
      matched_contextual_pathway: 'queen_mary_contextual_aaa',
      matched_contextual_pathway_label: 'Queen Mary ordinary contextual offer',
      policy_decision: 'ordinary_contextual_aaa_offer_confirmed',
      activated_applicant_group_ids: [
        QUEEN_MARY_CONTEXTUAL_AAA_GROUP_ID,
        'contextual',
        'widening_participation'
      ]
    };
  }

  return result;
}

module.exports = {
  QUEEN_MARY_ACCESS_PROGRAMME_GROUP_ID,
  QUEEN_MARY_CARE_LEAVER_AAB_GROUP_ID,
  QUEEN_MARY_CONTEXTUAL_AAA_GROUP_ID,
  QUEEN_MARY_CONTEXTUAL_EVALUATOR_ID,
  evaluateQueenMaryContextualEligibility
};
