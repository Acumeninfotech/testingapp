const QUEEN_S_BELFAST_CONTEXTUAL_EVALUATOR_ID = 'queen_s_belfast_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function answerIsYes(value, normaliseId) {
  return ['yes', 'true', 'confirmed', 'completed', 'verified', 'eligible'].includes(
    normaliseId(value)
  );
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

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'queen_s_belfast_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'standard_home_gcse_ucat_prediction_applicable',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      contextual_route: [],
      guaranteed_interview: [],
      ignored_legacy: []
    },
    activated_applicant_group_ids: []
  };
}

function isInternationalApplicant(identity, normaliseId) {
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  return feeStatus === 'international' ||
    feeStatus === 'international_fee' ||
    feeStatus === 'overseas' ||
    domicile === 'international' ||
    feeStatus.includes('international') ||
    feeStatus.includes('overseas');
}

function qubProfile(applicant, evidence) {
  const profile = asObject(applicant.contextual_profile);
  const universitySpecific = asObject(profile.university_specific);
  return asObject(
    profile.queen_s_belfast ||
      profile.qub ||
      profile['queen-s-belfast-a100'] ||
      universitySpecific.queen_s_belfast ||
      universitySpecific.qub ||
      universitySpecific['queen-s-belfast-a100'] ||
      evidence.profile?.queen_s_belfast ||
      evidence.profile?.qub ||
      evidence.profile?.university_specific?.queen_s_belfast ||
      evidence.profile?.university_specific?.qub
  );
}

function popEvidence(applicant, evidence) {
  const direct = asObject(applicant.widening_participation)
    .qub_pathway_opportunity_programme;
  const profile = qubProfile(applicant, evidence);
  return asObject(
    direct ||
      profile.qub_pathway_opportunity_programme ||
      profile.pathway_opportunity_programme
  );
}

function normaliseProgramme(value, normaliseId) {
  const programme = normaliseId(value);
  if (['mdbs_pop', 'mdbs_pathway_opportunity_programme', 'medicine_pop'].includes(programme)) {
    return 'mdbs_pop';
  }
  if (['other_qub_pop', 'qub_pop', 'pathway_opportunity_programme'].includes(programme)) {
    return 'other_qub_pop';
  }
  return programme;
}

function contextualOutcome(result, pathwayId, label, matchedChecks, extra = {}) {
  return {
    ...result,
    status: 'contextual',
    reason: extra.reason || 'queen_s_belfast_contextual_route_confirmed',
    is_contextual: true,
    matched_contextual_pathway: pathwayId,
    matched_contextual_pathway_label: label,
    policy_decision: extra.policy_decision || 'contextual_route_confirmed',
    qualifying_criteria: matchedChecks,
    activated_applicant_group_ids: extra.activated_applicant_group_ids || ['contextual'],
    interview_outcome: extra.interview_outcome || null
  };
}

function evaluatePop(programme, normaliseId) {
  const programmeId = normaliseProgramme(programme.programme, normaliseId);
  const recognised = ['mdbs_pop', 'other_qub_pop'].includes(programmeId);
  const completed = programme.programme_completed === true ||
    answerIsYes(programme.programme_completed, normaliseId);
  const verified = programme.programme_completion_verified === true ||
    answerIsYes(programme.programme_completion_verified, normaliseId);
  const academic = programme.academic_eligibility_confirmed === true ||
    answerIsYes(programme.academic_eligibility_confirmed, normaliseId);

  if (!recognised && Object.keys(programme).length === 0) {
    return check(
      'qub_pathway_opportunity_programme',
      'QUB Pathway Opportunity Programme',
      'widening_participation.qub_pathway_opportunity_programme',
      'not_matched'
    );
  }

  if (recognised && completed && verified && academic) {
    return check(
      `qub_${programmeId}_guaranteed_interview`,
      programmeId === 'mdbs_pop'
        ? 'QUB MDBS Pathway Opportunity Programme'
        : 'QUB Pathway Opportunity Programme',
      'widening_participation.qub_pathway_opportunity_programme',
      'matched',
      {
        programme: programmeId,
        programme_completed: completed,
        programme_completion_verified: verified,
        academic_eligibility_confirmed: academic
      }
    );
  }

  return check(
    'qub_pathway_opportunity_programme',
    'QUB Pathway Opportunity Programme',
    'widening_participation.qub_pathway_opportunity_programme',
    'information_needed',
    {
      programme: programme.programme ?? null,
      programme_completed: programme.programme_completed ?? null,
      programme_completion_verified: programme.programme_completion_verified ?? null,
      academic_eligibility_confirmed: programme.academic_eligibility_confirmed ?? null
    }
  );
}

function evaluateQueenSBelfastContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const identity = asObject(applicant.applicant_identity);

  const international = isInternationalApplicant(identity, normaliseId);
  result.checks.scope.push(check(
    'home_applicant_contextual_scope',
    'Home applicant contextual scope',
    'applicant_identity.fee_status/applicant_identity.domicile',
    international ? 'not_applicable' : 'matched',
    {
      fee_status: identity.fee_status,
      domicile: identity.domicile
    }
  ));
  if (international) {
    return {
      ...result,
      reason: 'queen_s_belfast_contextual_not_applicable_to_international_pathway',
      policy_decision: 'international_pathway_prediction_suppressed_by_config'
    };
  }

  const popCheck = evaluatePop(popEvidence(applicant, evidence), normaliseId);
  result.checks.guaranteed_interview.push(popCheck);
  if (popCheck.status === 'matched') {
    return contextualOutcome(
      result,
      popCheck.criterion_id,
      popCheck.label,
      [popCheck],
      {
        reason: 'queen_s_belfast_pop_guaranteed_interview_confirmed',
        policy_decision: 'guaranteed_interview_when_academic_eligibility_confirmed',
        activated_applicant_group_ids: ['contextual', 'widening_participation'],
        interview_outcome: 'guaranteed_interview'
      }
    );
  }
  if (popCheck.status === 'information_needed') {
    return {
      ...result,
      status: 'information_needed',
      reason: 'queen_s_belfast_pop_completion_confirmation_required',
      manual_review_reason: 'queen_s_belfast_pop_completion_confirmation_required',
      policy_decision: 'pop_completion_or_academic_eligibility_information_needed',
      missing_information: [popCheck],
      provisional_activated_applicant_group_ids: ['contextual', 'widening_participation']
    };
  }

  const profile = qubProfile(applicant, evidence);
  const niBtPostcode = applicant.contextual_profile?.qub_ni_bt_postcode_school_to_year_12 === true ||
    profile.ni_bt_postcode_school_to_year_12 === true ||
    profile.qub_ni_bt_postcode_school_to_year_12 === true ||
    answerIsYes(profile.ni_bt_postcode_school_to_year_12, normaliseId) ||
    answerIsYes(profile.qub_ni_bt_postcode_school_to_year_12, normaliseId);
  const niBtCheck = check(
    'qub_ni_bt_postcode_contextual_route',
    'QUB NI BT-postcode contextual route',
    'contextual_profile.qub_ni_bt_postcode_school_to_year_12',
    niBtPostcode ? 'matched' : 'not_matched',
    applicant.contextual_profile?.qub_ni_bt_postcode_school_to_year_12 ??
      profile.ni_bt_postcode_school_to_year_12 ??
      profile.qub_ni_bt_postcode_school_to_year_12 ??
      null
  );
  result.checks.contextual_route.push(niBtCheck);
  if (niBtCheck.status === 'matched') {
    return contextualOutcome(
      result,
      'qub_ni_bt_postcode_contextual_route',
      'QUB NI BT-postcode contextual route',
      [niBtCheck],
      {
        reason: 'queen_s_belfast_ni_bt_contextual_route_confirmed',
        policy_decision: 'standard_gcse_ucat_prediction_suppressed',
        activated_applicant_group_ids: [
          'qub_ni_bt_postcode_contextual_route',
          'contextual',
          'widening_participation'
        ]
      }
    );
  }

  result.checks.ignored_legacy.push(check(
    'queen_s_belfast_generic_contextual_flags_ignored',
    'Generic contextual declarations do not trigger QUB POP or NI BT route',
    'applicant_identity.contextual/applicant_identity.contextual_flags',
    'ignored',
    evidence.legacy_declarations
  ));

  return result;
}

module.exports = {
  QUEEN_S_BELFAST_CONTEXTUAL_EVALUATOR_ID,
  evaluateQueenSBelfastContextualEligibility
};
