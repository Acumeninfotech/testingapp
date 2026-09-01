const EXETER_CONTEXTUAL_EVALUATOR_ID = 'exeter_contextual_medicine_a100';

const EXETER_CONTEXTUAL_GROUP_ID = 'exeter_contextual_confirmed';
const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible', 'granted'].includes(normaliseId(value));
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

function lowQuintile(value, normaliseId) {
  return quintileIs(value, 1, normaliseId) || quintileIs(value, 2, normaliseId);
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
    reason: 'exeter_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      postcode: [],
      school: [],
      financial_support: [],
      personal_circumstances: [],
      access_programmes: [],
      ignored_legacy: []
    },
    contextual_evidence: {
      matched_criteria: [],
      possible_pathways: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    source_ids: ['exeter_contextual_offers']
  };
}

function addMatched(result, bucket, entry) {
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.matched_criteria.push(entry.criterion_id);
}

function addMissing(result, bucket, entry, pathwayId = 'exeter_contextual_a_level_aab') {
  result.missing_information.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.possible_pathways.push(pathwayId);
}

function explicitAnswer(applicant, path, helpers) {
  const contextualProfile = asObject(applicant.contextual_profile);
  const value = helpers.valueAtPath(contextualProfile, path);
  return value === undefined ? undefined : value;
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

function schoolStatus(evidence, helpers) {
  const school = asObject(evidence.school_education);
  const stateValues = [
    ['school_education.state_non_fee_paying_school', school.state_non_fee_paying_school],
    ['school_education.state_school', school.state_school],
    ['school_education.non_fee_paying_school', school.non_fee_paying_school]
  ];
  const independentValues = [
    [
      'school_education.current_or_most_recent_uk_school_independent_fee_paying',
      school.current_or_most_recent_uk_school_independent_fee_paying
    ],
    ['school_education.independent_school', school.independent_school],
    ['school_education.fee_paying_school', school.fee_paying_school]
  ];

  const state = stateValues.find(([, value]) => answerIsYes(value, helpers.normaliseId));
  if (state) {
    return {
      status: 'state_school',
      entry: check('exeter_state_school', 'State or non-fee-paying school evidence', state[0], 'matched', state[1])
    };
  }

  const notIndependent = independentValues.find(([, value]) => answerIsNo(value, helpers.normaliseId));
  if (notIndependent) {
    return {
      status: 'state_school',
      entry: check('exeter_state_school', 'State or non-fee-paying school evidence', notIndependent[0], 'matched', notIndependent[1])
    };
  }

  const independent = independentValues.find(([, value]) => answerIsYes(value, helpers.normaliseId));
  if (independent) {
    return {
      status: 'independent_school',
      entry: check('exeter_independent_school', 'Independent fee-paying school evidence', independent[0], 'not_matched', independent[1])
    };
  }

  return {
    status: 'unknown',
    entry: check(
      'exeter_school_type_required_for_postcode_route',
      'School type evidence for postcode route',
      'school_education.state_non_fee_paying_school',
      'missing',
      undefined,
      { reason: 'exeter_state_school_dependency_requires_confirmation' }
    )
  };
}

function evaluatePostcode(evidence, result, helpers) {
  const postcode = asObject(evidence.postcode_measures);
  const school = schoolStatus(evidence, helpers);
  const entries = [
    ['exeter_polar4_low_participation', 'POLAR4 low-participation area', 'home_area_region.polar4_quintile', postcode.polar4_quintile],
    ['exeter_tundra_low_participation', 'TUNDRA low-participation area', 'home_area_region.tundra_quintile', postcode.tundra_quintile],
    ['exeter_imd_deprivation', 'IMD deprivation area', 'home_area_region.imd_quintile', postcode.imd_quintile]
  ];
  const lowEntry = entries.find(([, , , value]) => lowQuintile(value, helpers.normaliseId));

  if (lowEntry && school.status === 'state_school') {
    result.checks.school.push(school.entry);
    addMatched(result, 'postcode', check(lowEntry[0], lowEntry[1], lowEntry[2], 'matched', lowEntry[3]));
    return;
  }

  if (lowEntry && school.status === 'unknown') {
    addMissing(result, 'school', school.entry);
  } else if (lowEntry) {
    result.checks.school.push(school.entry);
    result.checks.postcode.push(check(lowEntry[0], lowEntry[1], lowEntry[2], 'blocked_by_school_status', lowEntry[3]));
  }

  for (const [criterionId, label, path, value] of entries) {
    if (lowEntry && criterionId === lowEntry[0]) continue;
    if (!isMissing(value)) {
      result.checks.postcode.push(check(criterionId, label, path, 'not_matched', value));
    }
  }
}

function evaluateSimpleCriteria(applicant, evidence, result, helpers) {
  const fields = [
    ['financial_support', 'exeter_free_school_meals', 'Free school meals', 'financial_support.free_school_meals'],
    ['personal_circumstances', 'exeter_care_experienced', 'Care experienced', 'personal_circumstances.care_experienced'],
    ['personal_circumstances', 'exeter_care_leaver', 'Care leaver', 'personal_circumstances.care_leaver'],
    ['personal_circumstances', 'exeter_refugee_status', 'Refugee status', 'personal_circumstances.uk_refugee_status_granted'],
    ['personal_circumstances', 'exeter_asylum_or_humanitarian_status', 'Asylum or humanitarian protection status', 'personal_circumstances.seeking_asylum'],
    ['personal_circumstances', 'exeter_humanitarian_protection', 'Humanitarian protection status', 'personal_circumstances.humanitarian_protection'],
    ['personal_circumstances', 'exeter_estranged', 'Estranged from family', 'personal_circumstances.estranged_from_family'],
    ['personal_circumstances', 'exeter_caring_responsibility', 'Caring responsibility', 'personal_circumstances.young_carer'],
    ['personal_circumstances', 'exeter_adult_carer', 'Adult caring responsibility', 'personal_circumstances.young_adult_carer'],
    ['personal_circumstances', 'exeter_parental_responsibility', 'Parental responsibility', 'personal_circumstances.parental_responsibility']
  ];

  for (const [bucket, criterionId, label, path] of fields) {
    const explicit = explicitAnswer(applicant, path, helpers);
    const actual = explicit !== undefined ? explicit : helpers.valueAtPath(evidence.profile, path);
    if (answerIsYes(actual, helpers.normaliseId)) {
      addMatched(result, bucket, check(criterionId, label, path, 'matched', actual));
    } else if (explicit !== undefined && isMissing(explicit)) {
      addMissing(result, bucket, check(criterionId, label, path, 'missing', actual, {
        reason: `${criterionId}_requires_confirmation`
      }));
    } else if (explicit !== undefined || answerIsNo(actual, helpers.normaliseId)) {
      result.checks[bucket].push(check(criterionId, label, path, 'not_matched', actual));
    }
  }
}

function evaluateProgrammes(evidence, result, helpers) {
  const programmes = [
    ...asArray(evidence.access_programmes?.other_programmes),
    asObject(evidence.access_programmes?.exeter)
  ].filter((programme) => Object.keys(asObject(programme)).length > 0);

  for (const programme of programmes.map(asObject)) {
    const programmeId = helpers.normaliseId(programme.programme_id || programme.id || programme.programme_name);
    const status = helpers.normaliseId(programme.status || programme.programme_status);
    const recognised = programmeId.includes('exeter') ||
      programmeId.includes('widening_participation') ||
      programmeId.includes('progression');
    if (!recognised) continue;

    const entry = check(
      'exeter_recognised_widening_participation_programme',
      'Recognised Exeter / widening-participation programme',
      'access_programmes.other_programmes',
      ['completed', 'confirmed', 'eligible'].includes(status) ? 'matched' : 'needs_review',
      programmeId,
      { programme_status: status || null }
    );
    if (entry.status === 'matched') {
      addMatched(result, 'access_programmes', entry);
    } else {
      addMissing(result, 'access_programmes', entry);
    }
  }
}

function evaluateExeterContextualEligibility({ course, applicant, evidence, helpers }) {
  const result = defaultResult();

  if (course?.profile_id !== 'exeter-a100') {
    return result;
  }

  if (!isHomeFee(applicant, helpers.normaliseId)) {
    result.checks.scope.push(check(
      'exeter_contextual_home_fee_scope',
      'Home fee contextual scope',
      'applicant_identity.fee_status',
      'not_matched',
      asObject(applicant.applicant_identity).fee_status
    ));
    return {
      ...result,
      reason: 'exeter_contextual_home_fee_required',
      policy_decision: 'outside_contextual_scope'
    };
  }

  result.checks.scope.push(check(
    'exeter_contextual_home_fee_scope',
    'Home fee contextual scope',
    'applicant_identity.fee_status',
    'matched',
    asObject(applicant.applicant_identity).fee_status
  ));

  const legacy = evidence.legacy_declarations || {};
  if (legacy.contextual || legacy.widening_participation || legacy.confirmed_flag_ids?.length) {
    result.checks.ignored_legacy.push(check(
      'exeter_legacy_contextual_declaration_ignored',
      'Legacy contextual declaration',
      'applicant_identity.contextual_flags',
      'ignored',
      legacy
    ));
  }

  evaluatePostcode(evidence, result, helpers);
  evaluateSimpleCriteria(applicant, evidence, result, helpers);
  evaluateProgrammes(evidence, result, helpers);

  if (result.qualifying_criteria.length > 0) {
    return {
      ...result,
      status: 'contextual',
      reason: 'exeter_contextual_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: EXETER_CONTEXTUAL_GROUP_ID,
      matched_contextual_pathway_label: 'Exeter contextual offer - assessed against AAB',
      policy_decision: 'exeter_contextual_a_level_aab_confirmed',
      activated_applicant_group_ids: ['contextual', 'widening_participation', EXETER_CONTEXTUAL_GROUP_ID]
    };
  }

  if (result.missing_information.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'exeter_contextual_evidence_needs_review',
      is_contextual: false,
      manual_review_reason: 'exeter_contextual_evidence_needs_review',
      policy_decision: 'exeter_contextual_information_needed',
      provisional_activated_applicant_group_ids: []
    };
  }

  return {
    ...result,
    policy_decision: 'exeter_contextual_criteria_not_met'
  };
}

module.exports = {
  EXETER_CONTEXTUAL_EVALUATOR_ID,
  EXETER_CONTEXTUAL_GROUP_ID,
  evaluateExeterContextualEligibility
};
