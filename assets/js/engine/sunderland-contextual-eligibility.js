const SUNDERLAND_CONTEXTUAL_EVALUATOR_ID = 'sunderland_contextual_medicine_a100';

const AAB_PATHWAY_ID = 'sunderland_contextual_aab';
const ABB_PATHWAY_ID = 'sunderland_local_contextual_abb';
const LOCAL_REGION = 'north_east_england_or_cumbria';
const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'none', 'not_applicable', 'not_eligible'].includes(normaliseId(value));
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
}

function quintileIs(value, expected, normaliseId) {
  const normalised = normaliseId(value);
  return normalised === `q${expected}` ||
    normalised === `quintile_${expected}` ||
    normalised === String(expected);
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
    reason: 'sunderland_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'criteria_not_met',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      aab: [],
      local_status: [],
      local_wp: []
    },
    contextual_evidence: {
      local_status: null,
      matched_criteria: [],
      possible_pathways: [],
      insurance_fallback_offer: null,
      future_conditions: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    source_ids: ['sunderland_course_page_2027']
  };
}

function addMatched(result, bucket, entry) {
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.matched_criteria.push(entry.criterion_id);
}

function addMissing(result, bucket, entry, pathwayId) {
  result.missing_information.push(entry);
  result.checks[bucket].push(entry);
  if (pathwayId) {
    result.contextual_evidence.possible_pathways.push(pathwayId);
  }
}

function explicitAnswer(applicant, path, helpers) {
  const contextualProfile = asObject(applicant.contextual_profile);
  const value = helpers.valueAtPath(contextualProfile, path);
  return value === undefined ? undefined : value;
}

function fsmSixYearsEntry(applicant, helpers) {
  const value = explicitAnswer(
    applicant,
    'financial_support.free_school_meals',
    helpers
  );
  return check(
    'free_school_meals',
    'Free school meals currently or within previous six years',
    'financial_support.free_school_meals',
    answerIsYes(value, helpers.normaliseId)
      ? 'matched'
      : isMissing(value)
        ? 'missing'
        : 'not_matched',
    value
  );
}

function ucatBursaryEntry(applicant, helpers) {
  const value = explicitAnswer(applicant, 'financial_support.ucat_bursary_recipient', helpers);
  return check(
    'ucat_bursary',
    'UCAT bursary',
    'financial_support.ucat_bursary_recipient',
    answerIsYes(value, helpers.normaliseId)
      ? 'matched'
      : isMissing(value)
        ? 'missing'
        : 'not_matched',
    value
  );
}

function polar4Entry(evidence, helpers) {
  const value = evidence.postcode_measures?.polar4_quintile;
  return check(
    'polar4_quintile_1_or_2',
    'POLAR4 quintile 1 or 2',
    'home_area_region.polar4_quintile',
    quintileIs(value, 1, helpers.normaliseId) || quintileIs(value, 2, helpers.normaliseId)
      ? 'matched'
      : isMissing(value)
        ? 'missing'
        : 'not_matched',
    value
  );
}

function refugeeEntry(applicant, helpers) {
  const refugee = explicitAnswer(applicant, 'personal_circumstances.refugee', helpers);
  const ukRefugee = explicitAnswer(applicant, 'personal_circumstances.uk_refugee_status_granted', helpers);
  const matched = answerIsYes(refugee, helpers.normaliseId) ||
    answerIsYes(ukRefugee, helpers.normaliseId);
  const missing = isMissing(refugee) || isMissing(ukRefugee);
  return check(
    'refugee_status',
    'Refugee status',
    'personal_circumstances.refugee/personal_circumstances.uk_refugee_status_granted',
    matched ? 'matched' : missing ? 'missing' : 'not_matched',
    {
      refugee,
      uk_refugee_status_granted: ukRefugee
    }
  );
}

function armedForcesFamilyEntry(applicant, helpers) {
  const value = explicitAnswer(
    applicant,
    'personal_circumstances.military_family',
    helpers
  );
  return check(
    'military_family',
    'Student from a UK Armed Forces family',
    'personal_circumstances.military_family',
    answerIsYes(value, helpers.normaliseId)
      ? 'matched'
      : isMissing(value)
        ? 'missing'
        : 'not_matched',
    value
  );
}

function localStatusEntry(evidence, helpers) {
  const value = evidence.home_area_region?.home_region;
  return check(
    'north_east_england_or_cumbria_home_address',
    'Home address in North East England or Cumbria',
    'home_area_region.home_region',
    helpers.normaliseId(value) === LOCAL_REGION
      ? 'matched'
      : isMissing(value)
        ? 'missing'
        : 'not_matched',
    value
  );
}

function evaluateSunderlandContextualEligibility({ applicant, evidence, helpers }) {
  const result = defaultResult();

  const fsm = fsmSixYearsEntry(applicant, helpers);
  const ucatBursary = ucatBursaryEntry(applicant, helpers);
  const aabMatches = [fsm, ucatBursary].filter((entry) => entry.status === 'matched');
  for (const entry of aabMatches) {
    addMatched(result, 'aab', entry);
  }
  for (const entry of [fsm, ucatBursary].filter((candidate) => candidate.status !== 'matched')) {
    result.checks.aab.push(entry);
  }

  const localStatus = localStatusEntry(evidence, helpers);
  result.contextual_evidence.local_status = {
    evidence_path: localStatus.evidence_path,
    status: localStatus.status,
    actual: localStatus.actual
  };
  if (localStatus.status === 'matched') {
    result.checks.local_status.push(localStatus);
  } else if (localStatus.status === 'missing') {
    addMissing(result, 'local_status', localStatus, ABB_PATHWAY_ID);
  } else {
    result.checks.local_status.push(localStatus);
  }

  const localWpCriteria = [
    polar4Entry(evidence, helpers),
    refugeeEntry(applicant, helpers),
    fsm,
    ucatBursary,
    armedForcesFamilyEntry(applicant, helpers)
  ];
  const localWpMatches = localWpCriteria.filter((entry) => entry.status === 'matched');
  for (const entry of localWpMatches) {
    addMatched(result, 'local_wp', entry);
  }
  for (const entry of localWpCriteria.filter((entry) => entry.status !== 'matched')) {
    result.checks.local_wp.push(entry);
  }

  const aabConfirmed = aabMatches.length > 0;
  const abbConfirmed = localStatus.status === 'matched' && localWpMatches.length > 0;

  if (abbConfirmed) {
    return {
      ...result,
      status: 'contextual',
      reason: 'sunderland_local_contextual_abb_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: ABB_PATHWAY_ID,
      matched_contextual_pathway_label: 'Sunderland local contextual offer',
      academic_contextual_level: 'local_contextual_abb',
      policy_decision: 'local_contextual_abb_confirmed',
      offer: 'ABB',
      contextual_offer: 'ABB',
      standard_offer: 'AAA',
      insurance_fallback_offer: 'AAB',
      future_conditions: ['sunderland_local_contextual_abb_firm_choice_required'],
      contextual_evidence: {
        ...result.contextual_evidence,
        insurance_fallback_offer: 'AAB',
        future_conditions: ['sunderland_local_contextual_abb_firm_choice_required']
      },
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation',
        'sunderland_local_contextual_abb'
      ]
    };
  }

  if (aabConfirmed) {
    return {
      ...result,
      status: 'contextual',
      reason: 'sunderland_contextual_aab_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: AAB_PATHWAY_ID,
      matched_contextual_pathway_label: 'Sunderland contextual offer',
      academic_contextual_level: 'contextual_aab',
      policy_decision: 'contextual_aab_confirmed',
      offer: 'AAB',
      contextual_offer: 'AAB',
      standard_offer: 'AAA',
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation',
        'sunderland_contextual_aab'
      ]
    };
  }

  const aabPossiblyRelevant = [fsm, ucatBursary].some((entry) => entry.status === 'missing');
  if (aabPossiblyRelevant) {
    for (const entry of [fsm, ucatBursary].filter((candidate) => candidate.status === 'missing')) {
      if (!result.missing_information.some((existing) => existing.criterion_id === entry.criterion_id)) {
        addMissing(result, 'aab', entry, AAB_PATHWAY_ID);
      }
    }
  }

  const explicitNoLocalStatus = localStatus.status === 'not_matched' && answerIsNo(localStatus.actual, helpers.normaliseId);
  const localWpPossiblyRelevant = localWpCriteria.some((entry) => entry.status === 'missing');
  if (
    localStatus.status !== 'not_matched' &&
    !explicitNoLocalStatus &&
    localWpPossiblyRelevant
  ) {
    for (const entry of localWpCriteria.filter((candidate) => candidate.status === 'missing')) {
      if (!result.missing_information.some((existing) => existing.criterion_id === entry.criterion_id)) {
        addMissing(result, 'local_wp', entry, ABB_PATHWAY_ID);
      }
    }
  }

  if (result.missing_information.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'sunderland_contextual_information_needed',
      manual_review_reason: 'sunderland_contextual_information_needed',
      policy_decision: 'contextual_evidence_information_needed'
    };
  }

  return result;
}

module.exports = {
  SUNDERLAND_CONTEXTUAL_EVALUATOR_ID,
  evaluateSunderlandContextualEligibility
};
