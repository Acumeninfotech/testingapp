const KCL_CONTEXTUAL_EVALUATOR_ID = 'kcl_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
const COMPLETED_PROGRAMME_STATUSES = new Set(['completed', 'confirmed', 'successful', 'successfully_completed']);
const UNRESOLVED_PROGRAMME_STATUSES = new Set([
  'participating',
  'current',
  'enrolled',
  'accepted',
  'offered'
]);

const KCL_PROGRAMME_IDS = new Set([
  'kcl_k_plus',
  'k_plus',
  'kcl_wp_programme',
  'kcl_widening_participation_programme',
  'kings_widening_participation_programme',
  'intouniversity'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasOwnPath(source, path) {
  const parts = String(path || '').split('.').filter(Boolean);
  let current = source;
  for (const key of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) {
      return false;
    }
    current = current[key];
  }
  return true;
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function answerIsMissing(value) {
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
    reason: 'kcl_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'criteria_not_met',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      criteria: [],
      programmes: [],
      legacy_sources: []
    },
    contextual_evidence: {
      matched_criteria: [],
      matched_programmes: [],
      legacy_sources_ignored_as_current_authority: []
    },
    activated_applicant_group_ids: [],
    source_ids: ['kcl_step2_official_validation_2026', 'kcl_step3_reconciliation']
  };
}

function addMatched(result, entry, collection = 'criteria') {
  result.qualifying_criteria.push(entry);
  result.checks[collection].push(entry);
  if (collection === 'programmes') {
    result.contextual_evidence.matched_programmes.push(entry.programme_id || entry.actual);
  } else {
    result.contextual_evidence.matched_criteria.push(entry.criterion_id);
  }
}

function addUnresolved(result, entry, collection = 'criteria') {
  result.missing_information.push(entry);
  result.checks[collection].push(entry);
}

function programmeStatus(programme, normaliseId) {
  return normaliseId(programme.status || programme.programme_status);
}

function programmeId(programme, normaliseId) {
  return normaliseId(programme.programme_id || programme.id || programme.programme_name || programme.name);
}

function programmeSpecificQualificationConfirmed(programme, normaliseId) {
  return [
    programme.qualifying_condition_met,
    programme.qualifying_conditions_met,
    programme.programme_specific_conditions_met,
    programme.qualification_confirmed,
    programme.verified_qualifying_course,
    programme.eligible_for_kcl_contextual,
    programme.eligible_for_kcl_additional_consideration,
    programme.eligible_for_additional_consideration
  ].some((value) => answerIsYes(value, normaliseId));
}

function programmeStatusIsRecognised(programme, status, normaliseId) {
  return COMPLETED_PROGRAMME_STATUSES.has(status) ||
    (UNRESOLVED_PROGRAMME_STATUSES.has(status) && programmeSpecificQualificationConfirmed(programme, normaliseId));
}

function programmeLooksLikeKclProgramme(programme, normaliseId) {
  const id = programmeId(programme, normaliseId);
  const provider = normaliseId(programme.provider_university_id || programme.provider || programme.university_id);
  return KCL_PROGRAMME_IDS.has(id) ||
    provider === 'king_s_college_london_a100' ||
    provider === 'king_s_college_london' ||
    provider === 'kcl';
}

function evaluateProgrammes(evidence, result, normaliseId) {
  const access = asObject(evidence.access_programmes);
  const programmes = asArray(access.other_programmes).map(asObject);
  const kclProgramme = programmes.find((programme) =>
    programmeLooksLikeKclProgramme(programme, normaliseId)
  );

  if (kclProgramme) {
    const status = programmeStatus(kclProgramme, normaliseId);
    const id = programmeId(kclProgramme, normaliseId);
    const entry = check(
      id === 'intouniversity' ? 'intouniversity' : 'kcl_wp_programme',
      id === 'intouniversity' ? 'IntoUniversity' : "King's widening-participation programme",
      'contextual_profile.access_programmes.other_programmes',
      programmeStatusIsRecognised(kclProgramme, status, normaliseId) ? 'matched' : 'needs_review',
      kclProgramme.programme_id || kclProgramme.programme_name || null,
      {
        programme_id: id || null,
        programme_status: status || null,
        programme_specific_qualification_confirmed: programmeSpecificQualificationConfirmed(kclProgramme, normaliseId)
      }
    );
    if (programmeStatusIsRecognised(kclProgramme, status, normaliseId)) {
      addMatched(result, entry, 'programmes');
    } else if (!['no', 'not_completed', 'not_participating'].includes(status)) {
      addUnresolved(result, entry, 'programmes');
    } else {
      result.checks.programmes.push(entry);
    }
  }

  const ukwpmed = asObject(access.ukwpmed);
  if (programmeId(ukwpmed, normaliseId) && programmeLooksLikeKclProgramme(ukwpmed, normaliseId)) {
    const status = normaliseId(ukwpmed.programme_status || ukwpmed.status);
    const entry = check(
      'kcl_wp_programme',
      "King's widening-participation programme",
      'contextual_profile.access_programmes.ukwpmed',
      COMPLETED_PROGRAMME_STATUSES.has(status) ? 'matched' : 'needs_review',
      ukwpmed.programme_id,
      {
        programme_id: programmeId(ukwpmed, normaliseId),
        programme_status: status || null
      }
    );
    if (COMPLETED_PROGRAMME_STATUSES.has(status)) {
      addMatched(result, entry, 'programmes');
    } else if (!['no', 'not_completed', 'not_participating'].includes(status)) {
      addUnresolved(result, entry, 'programmes');
    } else {
      result.checks.programmes.push(entry);
    }
  }

  if (
    answerIsYes(access.participation_status, normaliseId) &&
    programmes.length === 0 &&
    !programmeId(ukwpmed, normaliseId)
  ) {
    addUnresolved(
      result,
      check(
        'kcl_wp_programme_identifier_required',
        'King’s widening-participation programme identifier',
        'contextual_profile.access_programmes',
        'needs_review',
        access.participation_status,
        { reason: 'bare_programme_participation_does_not_confirm_kcl_criteria' }
      ),
      'programmes'
    );
  }
}

function evaluateBooleanCriterion(result, applicant, evidence, normaliseId, definition) {
  const source = asObject(evidence[definition.source]);
  const actual = source[definition.key];
  const explicitlySupplied = hasOwnPath(
    asObject(applicant.contextual_profile),
    definition.evidence_path.replace(/^contextual_profile\./, '')
  );
  if (answerIsYes(actual, normaliseId)) {
    addMatched(result, check(
      definition.criterion_id,
      definition.label,
      definition.evidence_path,
      'matched',
      actual
    ));
  } else if (answerIsMissing(actual) && definition.materialWhenUnresolved && explicitlySupplied) {
    addUnresolved(result, check(
      definition.criterion_id,
      definition.label,
      definition.evidence_path,
      'missing',
      actual
    ));
  } else {
    result.checks.criteria.push(check(
      definition.criterion_id,
      definition.label,
      definition.evidence_path,
      'not_matched',
      actual
    ));
  }
}

function evaluateForcedDisplacement(result, evidence, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const ukrainianVisaScheme = normaliseId(personal.ukrainian_visa_scheme);
  const matched =
    answerIsYes(personal.refugee, normaliseId) ||
    answerIsYes(personal.uk_refugee_status_granted, normaliseId) ||
    answerIsYes(personal.seeking_asylum, normaliseId) ||
    (
      ukrainianVisaScheme &&
      !['none', 'no', 'not_sure', 'prefer_not_to_say'].includes(ukrainianVisaScheme)
    );
  const actual = {
    refugee: personal.refugee,
    uk_refugee_status_granted: personal.uk_refugee_status_granted,
    seeking_asylum: personal.seeking_asylum,
    ukrainian_visa_scheme: personal.ukrainian_visa_scheme
  };

  if (matched) {
    addMatched(result, check(
      'forced_displacement',
      'Forced displacement',
      'contextual_profile.personal_circumstances',
      'matched',
      actual
    ));
  } else {
    result.checks.criteria.push(check(
      'forced_displacement',
      'Forced displacement',
      'contextual_profile.personal_circumstances',
      'not_matched',
      actual
    ));
  }
}

function recordIgnoredLegacySources(evidence, result) {
  const legacy = asObject(evidence.legacy_declarations);
  const ignored = [];
  if (legacy.contextual === true) ignored.push('applicant_identity.contextual');
  if (legacy.widening_participation === true) ignored.push('applicant_identity.widening_participation');
  for (const flagId of legacy.confirmed_flag_ids || []) {
    ignored.push(`applicant_identity.contextual_flags.${flagId}`);
  }

  for (const source of ignored) {
    result.checks.legacy_sources.push(check(
      'legacy_contextual_source_ignored',
      'Legacy contextual source ignored as current KCL authority',
      source,
      'ignored',
      true
    ));
  }
  result.contextual_evidence.legacy_sources_ignored_as_current_authority = ignored;
}

function evaluateKclContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();

  evaluateProgrammes(evidence, result, normaliseId);

  for (const definition of [
    {
      criterion_id: 'free_school_meals',
      label: 'Free School Meals',
      source: 'financial_support',
      key: 'free_school_meals',
      evidence_path: 'contextual_profile.financial_support.free_school_meals'
    },
    {
      criterion_id: 'care_experienced',
      label: 'Care experience / care leaver',
      source: 'personal_circumstances',
      key: 'care_experienced',
      evidence_path: 'contextual_profile.personal_circumstances.care_experienced'
    },
    {
      criterion_id: 'care_leaver',
      label: 'Care leaver',
      source: 'personal_circumstances',
      key: 'care_leaver',
      evidence_path: 'contextual_profile.personal_circumstances.care_leaver'
    },
    {
      criterion_id: 'estranged',
      label: 'Estranged from family',
      source: 'personal_circumstances',
      key: 'estranged_from_family',
      evidence_path: 'contextual_profile.personal_circumstances.estranged_from_family',
      materialWhenUnresolved: true
    },
    {
      criterion_id: 'young_adult_carer',
      label: 'Young Adult Carer',
      source: 'personal_circumstances',
      key: 'young_or_adult_carer',
      evidence_path: 'contextual_profile.personal_circumstances.young_or_adult_carer',
      materialWhenUnresolved: true
    }
  ]) {
    evaluateBooleanCriterion(result, applicant, evidence, normaliseId, definition);
  }

  evaluateForcedDisplacement(result, evidence, normaliseId);
  recordIgnoredLegacySources(evidence, result);

  if (result.qualifying_criteria.length > 0) {
    return {
      ...result,
      status: 'contextual',
      reason: 'kcl_contextual_evidence_recognised',
      is_contextual: true,
      matched_contextual_pathway: result.qualifying_criteria[0].criterion_id,
      matched_contextual_pathway_label: 'KCL contextual/additional consideration',
      policy_decision: 'contextual_additional_consideration_recognised',
      activated_applicant_group_ids: ['kcl_contextual_additional_consideration']
    };
  }

  if (result.missing_information.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'kcl_contextual_evidence_requires_review',
      manual_review_reason: 'kcl_contextual_evidence_requires_review',
      policy_decision: 'contextual_evidence_information_needed'
    };
  }

  return result;
}

module.exports = {
  KCL_CONTEXTUAL_EVALUATOR_ID,
  evaluateKclContextualEligibility
};
