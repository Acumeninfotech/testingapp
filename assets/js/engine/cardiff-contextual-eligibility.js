const CARDIFF_CONTEXTUAL_EVALUATOR_ID = 'cardiff_contextual_medicine_a100';

const CARDIFF_NAMED_WP_PROGRAMMES = new Map([
  ['step_up_to_university', 'Cardiff University Step-Up to University'],
  ['cardiff_step_up_to_university', 'Cardiff University Step-Up to University'],
  ['sutton_trust_cardiff_summer_school', 'Sutton Trust Cardiff Summer School'],
  ['cardiff_sutton_trust_summer_school', 'Sutton Trust Cardiff Summer School'],
  ['doctoriaid_yfory', 'Doctoriaid Yfory'],
  ['coleg_cymraeg_doctoriaid_yfory', 'Doctoriaid Yfory'],
  ['agored_cymru_access_to_he_medicine', 'Agored Cymru Access to HE Medicine'],
  ['agored_cymru_medicine', 'Agored Cymru Access to HE Medicine']
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
    reason: 'cardiff_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'standard_selection_score_guidance',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      qualifying_criteria: [],
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

function isWelshDomiciled(identity, normaliseId) {
  return ['wales', 'welsh', 'wales_domiciled', 'welsh_domiciled'].includes(
    normaliseId(identity.domicile)
  );
}

function cardiffSpecificProfile(applicant, evidence) {
  const profile = asObject(applicant.contextual_profile);
  const universitySpecific = asObject(profile.university_specific);
  return asObject(
    profile.cardiff ||
      profile['cardiff-a100'] ||
      universitySpecific.cardiff ||
      universitySpecific['cardiff-a100'] ||
      evidence.profile?.cardiff ||
      evidence.profile?.university_specific?.cardiff
  );
}

function confirmedStructuredFlag(record, fields, normaliseId) {
  return fields.some((field) => answerIsYes(record[field], normaliseId)) &&
    (
      record.confirmed === true ||
      record.verified === true ||
      answerIsYes(record.status, normaliseId) ||
      answerIsYes(record.confirmation_status, normaliseId) ||
      answerIsYes(record.evidence_status, normaliseId)
    );
}

function personalCircumstanceChecks(personal, normaliseId) {
  return [
    check(
      'care_experienced',
      'Care-experienced applicant',
      'personal_circumstances.care_experienced',
      answerIsYes(personal.care_experienced, normaliseId) ? 'matched' : 'not_matched',
      personal.care_experienced
    ),
    check(
      'care_leaver',
      'Care leaver',
      'personal_circumstances.care_leaver',
      answerIsYes(personal.care_leaver, normaliseId) ? 'matched' : 'not_matched',
      personal.care_leaver
    ),
    check(
      'refugee_or_asylum_status',
      'Refugee, asylum or relevant confirmed status',
      'personal_circumstances.refugee / uk_refugee_status_granted / seeking_asylum',
      (
        answerIsYes(personal.refugee, normaliseId) ||
        answerIsYes(personal.uk_refugee_status_granted, normaliseId) ||
        answerIsYes(personal.seeking_asylum, normaliseId)
      ) ? 'matched' : 'not_matched',
      {
        refugee: personal.refugee,
        uk_refugee_status_granted: personal.uk_refugee_status_granted,
        seeking_asylum: personal.seeking_asylum
      }
    )
  ];
}

function programmeStatusConfirmed(programme, accessProgrammes, normaliseId) {
  const status = normaliseId(
    programme.status ??
      programme.programme_status ??
      programme.completion_status ??
      accessProgrammes.participation_status
  );
  return ['completed', 'complete', 'confirmed', 'verified'].includes(status);
}

function programmeLooksLikeCardiffWp(programme, normaliseId) {
  const record = asObject(programme);
  const values = [
    record.programme_id,
    record.programme_name,
    record.name,
    record.label
  ].map(normaliseId);

  for (const value of values) {
    if (CARDIFF_NAMED_WP_PROGRAMMES.has(value)) {
      return CARDIFF_NAMED_WP_PROGRAMMES.get(value);
    }
    if (value.includes('step_up') && value.includes('cardiff')) {
      return 'Cardiff University Step-Up to University';
    }
    if (value.includes('sutton_trust') && value.includes('cardiff')) {
      return 'Sutton Trust Cardiff Summer School';
    }
    if (value.includes('doctoriaid_yfory')) {
      return 'Doctoriaid Yfory';
    }
    if (value.includes('agored_cymru') && value.includes('medicine')) {
      return 'Agored Cymru Access to HE Medicine';
    }
  }
  return null;
}

function cardiffWpProgrammeCheck(accessProgrammes, normaliseId) {
  const programme = asArray(accessProgrammes.other_programmes)
    .map(asObject)
    .find((entry) => programmeLooksLikeCardiffWp(entry, normaliseId));
  const fallbackName = normaliseId(accessProgrammes.other_programme_name);
  const fallbackProgramme = fallbackName
    ? {
        programme_id: fallbackName,
        status: accessProgrammes.participation_status
      }
    : null;
  const matchedProgramme = programme || (
    fallbackProgramme && programmeLooksLikeCardiffWp(fallbackProgramme, normaliseId)
      ? fallbackProgramme
      : null
  );

  if (!matchedProgramme) {
    return check(
      'cardiff_named_wp_programme',
      'Cardiff named widening-participation programme',
      'access_programmes',
      'not_matched'
    );
  }

  const label = programmeLooksLikeCardiffWp(matchedProgramme, normaliseId);
  const confirmed = programmeStatusConfirmed(matchedProgramme, accessProgrammes, normaliseId);
  return check(
    'cardiff_named_wp_programme',
    'Cardiff named widening-participation programme',
    programme ? 'access_programmes.other_programmes' : 'access_programmes.other_programme_name',
    confirmed ? 'matched' : 'information_needed',
    {
      programme_id: matchedProgramme.programme_id || null,
      programme_name: label,
      status: matchedProgramme.status || matchedProgramme.programme_status || accessProgrammes.participation_status || null
    }
  );
}

function contextualOutcome(result, pathwayId, label, matchedChecks, extra = {}) {
  return {
    ...result,
    status: 'contextual',
    reason: extra.reason || 'cardiff_contextual_additional_consideration_confirmed',
    is_contextual: true,
    matched_contextual_pathway: pathwayId,
    matched_contextual_pathway_label: label,
    policy_decision: extra.policy_decision || 'additional_consideration_confirmed',
    qualifying_criteria: matchedChecks,
    activated_applicant_group_ids: extra.activated_applicant_group_ids || ['contextual'],
    interview_outcome: extra.interview_outcome || null,
    guaranteed_interview_notice: extra.guaranteed_interview_notice || null
  };
}

function evaluateCardiffContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const identity = asObject(applicant.applicant_identity);
  const accessProgrammes = asObject(evidence.access_programmes);
  const personal = asObject(evidence.personal_circumstances);
  const specific = cardiffSpecificProfile(applicant, evidence);

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
      reason: 'cardiff_contextual_not_applicable_to_international_pool',
      policy_decision: 'international_pool_uses_separate_28_point_ranking'
    };
  }

  const programmeCheck = cardiffWpProgrammeCheck(accessProgrammes, normaliseId);
  result.checks.guaranteed_interview.push(programmeCheck);
  if (programmeCheck.status === 'matched') {
    return contextualOutcome(
      result,
      'cardiff_named_wp_programme_guaranteed_interview',
      'Cardiff named widening-participation programme',
      [programmeCheck],
      {
        reason: 'cardiff_named_wp_programme_confirmed',
        policy_decision: 'guaranteed_interview_when_minimum_requirements_met',
        activated_applicant_group_ids: ['contextual', 'widening_participation'],
        interview_outcome: 'guaranteed_interview',
        guaranteed_interview_notice:
          'Named Cardiff widening-participation programme evidence is confirmed; the guaranteed interview still depends on minimum entry requirements being met.'
      }
    );
  }
  if (programmeCheck.status === 'information_needed') {
    return {
      ...result,
      status: 'information_needed',
      reason: 'cardiff_named_wp_programme_confirmation_required',
      manual_review_reason: 'cardiff_named_wp_programme_confirmation_required',
      missing_information: [programmeCheck],
      provisional_activated_applicant_group_ids: ['contextual', 'widening_participation']
    };
  }

  const welshCheck = check(
    'welsh_domiciled',
    'Welsh-domiciled applicant',
    'applicant_identity.domicile',
    isWelshDomiciled(identity, normaliseId) ? 'matched' : 'not_matched',
    identity.domicile
  );
  result.checks.qualifying_criteria.push(welshCheck);
  if (welshCheck.status === 'matched') {
    return contextualOutcome(
      result,
      'welsh_domiciled',
      'Welsh-domiciled applicant',
      [welshCheck],
      {
        reason: 'cardiff_welsh_domicile_confirmed',
        activated_applicant_group_ids: ['wales_domiciled']
      }
    );
  }

  const directPersonalCircumstanceChecks = personalCircumstanceChecks(personal, normaliseId);
  result.checks.qualifying_criteria.push(...directPersonalCircumstanceChecks);
  const matchedPersonalCircumstanceCheck =
    directPersonalCircumstanceChecks.find((entry) => entry.status === 'matched');
  if (matchedPersonalCircumstanceCheck) {
    return contextualOutcome(
      result,
      matchedPersonalCircumstanceCheck.criterion_id,
      matchedPersonalCircumstanceCheck.label,
      [matchedPersonalCircumstanceCheck],
      { activated_applicant_group_ids: ['contextual'] }
    );
  }

  const sportsCheck = check(
    'high_performance_sports',
    'Cardiff high-performance sports programme',
    'contextual_profile.cardiff.high_performance_sports',
    confirmedStructuredFlag(
      specific,
      ['high_performance_sports', 'sports_programme'],
      normaliseId
    ) ? 'matched' : 'not_matched',
    {
      high_performance_sports: specific.high_performance_sports ?? null,
      status: specific.status ?? specific.confirmation_status ?? null
    }
  );
  result.checks.qualifying_criteria.push(sportsCheck);
  if (sportsCheck.status === 'matched') {
    return contextualOutcome(
      result,
      'high_performance_sports',
      'Cardiff high-performance sports programme',
      [sportsCheck],
      { activated_applicant_group_ids: ['contextual'] }
    );
  }

  result.checks.ignored_legacy.push(check(
    'cardiff_legacy_contextual_flags_ignored_unless_confirmed',
    'Legacy contextual declarations require Cardiff confirmation',
    'applicant_identity.contextual/applicant_identity.contextual_flags',
    'ignored',
    evidence.legacy_declarations
  ));

  return result;
}

module.exports = {
  CARDIFF_CONTEXTUAL_EVALUATOR_ID,
  evaluateCardiffContextualEligibility
};
