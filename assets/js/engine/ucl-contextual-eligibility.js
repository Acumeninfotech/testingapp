const UCL_CONTEXTUAL_EVALUATOR_ID = 'ucl_contextual_medicine_a100';
const UCL_ACCESS_GROUP_ID = 'access_ucl_confirmed';

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
    reason: 'ucl_access_ucl_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'criteria_not_met',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      school: [],
      postcode: [],
      financial_support: [],
      care: [],
      estrangement: [],
      ignored_legacy: []
    },
    contextual_evidence: {
      matched_criteria: [],
      possible_pathways: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    source_ids: ['ucl_access_ucl_2026', 'ucl_research_doc']
  };
}

function addMatched(result, bucket, entry) {
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.matched_criteria.push(entry.criterion_id);
}

function addMissing(result, bucket, entry, pathwayId = null) {
  result.missing_information.push(entry);
  result.checks[bucket].push(entry);
  if (pathwayId) {
    result.contextual_evidence.possible_pathways.push(pathwayId);
  }
}

function isHomeFeeApplicant(applicant, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const groups = new Set((applicant.applicant_group_ids || []).map(normaliseId));
  const feeStatus = normaliseId(identity.fee_status);
  return feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk' ||
    feeStatus === 'rest_of_uk_roi_fee_rate' ||
    feeStatus.includes('home') ||
    groups.has('home_fee');
}

function schoolStatus(evidence, normaliseId) {
  const school = asObject(evidence.school_education);
  const stateEvidence = [
    ['school_education.state_non_fee_paying_school', school.state_non_fee_paying_school],
    ['school_education.state_school', school.state_school],
    ['school_education.non_fee_paying_school', school.non_fee_paying_school],
    ['school_education.state_grammar_school', school.state_grammar_school],
    ['school_education.grammar_school', school.grammar_school]
  ];
  const independentEvidence = [
    ['school_education.current_or_most_recent_uk_school_independent_fee_paying', school.current_or_most_recent_uk_school_independent_fee_paying],
    ['school_education.independent_school', school.independent_school],
    ['school_education.attended_independent_school', school.attended_independent_school],
    ['school_education.fee_paying_school', school.fee_paying_school]
  ];

  const stateYes = stateEvidence.find(([, value]) => answerIsYes(value, normaliseId));
  if (stateYes) {
    return {
      status: 'state_school',
      entry: check('ucl_uk_state_school', 'UK state school or college', stateYes[0], 'matched', stateYes[1])
    };
  }

  const independentYes = independentEvidence.find(([, value]) => answerIsYes(value, normaliseId));
  if (independentYes) {
    return {
      status: 'independent_school',
      entry: check('ucl_independent_school', 'UK independent school', independentYes[0], 'matched', independentYes[1])
    };
  }

  const nonIndependent = independentEvidence.find(([, value]) => answerIsNo(value, normaliseId));
  if (nonIndependent) {
    return {
      status: 'state_school',
      entry: check('ucl_uk_state_school', 'UK state school or college', nonIndependent[0], 'matched', nonIndependent[1])
    };
  }

  const explicitNoState = stateEvidence.find(([, value]) => answerIsNo(value, normaliseId));
  if (explicitNoState) {
    return {
      status: 'not_state_school',
      entry: check('ucl_uk_state_school', 'UK state school or college', explicitNoState[0], 'not_matched', explicitNoState[1])
    };
  }

  const unknown = [...stateEvidence, ...independentEvidence].find(([, value]) => isMissing(value));
  return {
    status: 'unknown',
    entry: check(
      'ucl_uk_school_status',
      'UK school type',
      unknown?.[0] || 'school_education.state_non_fee_paying_school',
      'missing',
      unknown?.[1],
      { reason: 'ucl_access_ucl_school_type_required' }
    )
  };
}

function evaluatePostcodeRoute(evidence, result, school, normaliseId) {
  const imdQ1 = quintileIs(evidence.postcode_measures?.imd_quintile, 1, normaliseId);
  const tundraQ1 = quintileIs(evidence.postcode_measures?.tundra_quintile, 1, normaliseId);

  if (school.status === 'state_school' && (imdQ1 || tundraQ1)) {
    result.checks.school.push(school.entry);
    addMatched(result, 'postcode', check(
      imdQ1 ? 'ucl_imd_quintile_1' : 'ucl_tundra_lsoa_quintile_1',
      imdQ1 ? 'IMD quintile 1' : 'TUNDRA LSOA quintile 1',
      imdQ1 ? 'postcode_measures.imd_quintile' : 'postcode_measures.tundra_quintile',
      'matched',
      imdQ1 ? evidence.postcode_measures?.imd_quintile : evidence.postcode_measures?.tundra_quintile
    ));
    return true;
  }

  result.checks.postcode.push(check(
    'ucl_postcode_deprivation_route',
    'IMD quintile 1 or TUNDRA LSOA quintile 1',
    'postcode_measures.imd_quintile/postcode_measures.tundra_quintile',
    imdQ1 || tundraQ1 ? 'blocked_by_school_status' : 'not_matched',
    {
      imd_quintile: evidence.postcode_measures?.imd_quintile,
      tundra_quintile: evidence.postcode_measures?.tundra_quintile
    }
  ));

  if ((imdQ1 || tundraQ1) && school.status === 'unknown') {
    addMissing(result, 'school', school.entry, 'ucl_postcode_deprivation_route');
  } else if (
    school.status === 'state_school' &&
    (isMissing(evidence.postcode_measures?.imd_quintile) || isMissing(evidence.postcode_measures?.tundra_quintile))
  ) {
    addMissing(result, 'postcode', check(
      'ucl_postcode_deprivation_status',
      'IMD/TUNDRA postcode status',
      'postcode_measures.imd_quintile/postcode_measures.tundra_quintile',
      'missing',
      {
        imd_quintile: evidence.postcode_measures?.imd_quintile,
        tundra_quintile: evidence.postcode_measures?.tundra_quintile
      },
      { reason: 'ucl_access_ucl_postcode_deprivation_required' }
    ), 'ucl_postcode_deprivation_route');
  }
  return false;
}

function evaluateFsmRoute(evidence, result, school, normaliseId) {
  const financial = asObject(evidence.financial_support);
  const fsmAtLevel3 = financial.free_school_meals_at_level3_completion;
  const governmentFundedFsm = financial.government_funded_free_school_meals;
  const registeredDuringLevel3 = financial.registered_for_free_school_meals_during_level3;
  const fsm = financial.free_school_meals;
  const fsmConfirmed =
    answerIsYes(fsmAtLevel3, normaliseId) ||
    answerIsYes(governmentFundedFsm, normaliseId) ||
    answerIsYes(registeredDuringLevel3, normaliseId);
  const genericFsmOnly = answerIsYes(fsm, normaliseId) && !fsmConfirmed;
  const fsmExplicitNo = answerIsNo(fsmAtLevel3, normaliseId) || answerIsNo(fsm, normaliseId);

  if (school.status === 'state_school' && fsmConfirmed) {
    result.checks.school.push(school.entry);
    addMatched(result, 'financial_support', check(
      answerIsYes(fsmAtLevel3, normaliseId)
        ? 'ucl_fsm_at_level3_completion'
        : answerIsYes(governmentFundedFsm, normaliseId)
          ? 'ucl_government_funded_free_school_meals'
          : 'ucl_registered_for_free_school_meals_during_level3',
      'Free School Meals',
      answerIsYes(fsmAtLevel3, normaliseId)
        ? 'financial_support.free_school_meals_at_level3_completion'
        : answerIsYes(governmentFundedFsm, normaliseId)
          ? 'financial_support.government_funded_free_school_meals'
          : 'financial_support.registered_for_free_school_meals_during_level3',
      'matched',
      answerIsYes(fsmAtLevel3, normaliseId)
        ? fsmAtLevel3
        : answerIsYes(governmentFundedFsm, normaliseId)
          ? governmentFundedFsm
          : registeredDuringLevel3
    ));
    return true;
  }

  result.checks.financial_support.push(check(
    'ucl_free_school_meals_route',
    'Free School Meals',
    'financial_support.free_school_meals_at_level3_completion/financial_support.free_school_meals',
    fsmConfirmed ? 'blocked_by_school_status' : 'not_matched',
    { free_school_meals_at_level3_completion: fsmAtLevel3, free_school_meals: fsm }
  ));

  if (fsmConfirmed && school.status === 'unknown') {
    addMissing(result, 'school', school.entry, 'ucl_fsm_route');
  } else if (
    school.status === 'state_school' &&
    (
      genericFsmOnly ||
      (!fsmExplicitNo && (isMissing(fsmAtLevel3) || isMissing(fsm)))
    )
  ) {
    addMissing(result, 'financial_support', check(
      'ucl_free_school_meals_status',
      'Free School Meals status',
      'financial_support.free_school_meals_at_level3_completion/financial_support.free_school_meals',
      genericFsmOnly ? 'needs_review' : 'missing',
      {
        free_school_meals_at_level3_completion: fsmAtLevel3,
        government_funded_free_school_meals: governmentFundedFsm,
        registered_for_free_school_meals_during_level3: registeredDuringLevel3,
        free_school_meals: fsm
      },
      { reason: 'ucl_access_ucl_fsm_status_required' }
    ), 'ucl_fsm_route');
  }
  return false;
}

function careEvidence(personal, normaliseId) {
  return {
    care: personal.care_experienced,
    careOverThreeMonths: personal.care_over_three_months,
    careLeaver: personal.care_leaver,
    lookedAfter: personal.looked_after,
    formalCare: personal.formal_local_authority_care ?? personal.local_authority_care,
    careDuration84Days: personal.care_duration_84_days ?? personal.care_three_months_total
  };
}

function evaluateCareRoute(evidence, result, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const facts = careEvidence(personal, normaliseId);
  const carePositive = [
    facts.care,
    facts.careLeaver,
    facts.lookedAfter,
    facts.careOverThreeMonths
  ].some((value) => answerIsYes(value, normaliseId));

  if (!carePositive) {
    result.checks.care.push(check(
      'ucl_care_experienced_route',
      'Qualifying care experience',
      'personal_circumstances.care_experienced',
      'not_matched',
      facts.care
    ));
    return false;
  }

  const durationConfirmed =
    answerIsYes(facts.careOverThreeMonths, normaliseId) ||
    answerIsYes(facts.careDuration84Days, normaliseId);
  const formalityConfirmed =
    answerIsYes(facts.formalCare, normaliseId) ||
    answerIsYes(facts.lookedAfter, normaliseId) ||
    answerIsYes(facts.careLeaver, normaliseId);

  if (durationConfirmed && formalityConfirmed) {
    addMatched(result, 'care', check(
      'ucl_qualifying_care_experience',
      'Qualifying care experience of at least 84 days',
      'personal_circumstances.care_over_three_months',
      'matched',
      {
        care_experienced: facts.care,
        care_over_three_months: facts.careOverThreeMonths,
        formal_local_authority_care: facts.formalCare,
        care_leaver: facts.careLeaver,
        looked_after: facts.lookedAfter
      }
    ));
    return true;
  }

  addMissing(result, 'care', check(
    'ucl_care_route_verification',
    'Qualifying care duration and formal care status',
    'personal_circumstances.care_over_three_months/personal_circumstances.formal_local_authority_care',
    'needs_review',
    {
      care_experienced: facts.care,
      care_over_three_months: facts.careOverThreeMonths,
      formal_local_authority_care: facts.formalCare,
      care_leaver: facts.careLeaver,
      looked_after: facts.lookedAfter
    },
    { reason: 'ucl_access_ucl_care_duration_or_formality_required' }
  ), 'ucl_care_experienced_route');
  return false;
}

function evaluateEstrangementRoute(evidence, result, school, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const estranged = personal.estranged_from_family ?? personal.estranged;
  const estrangedPositive = answerIsYes(estranged, normaliseId);
  if (!estrangedPositive) {
    result.checks.estrangement.push(check(
      'ucl_estrangement_route',
      'Qualifying estrangement',
      'personal_circumstances.estranged_from_family',
      'not_matched',
      estranged
    ));
    return false;
  }

  const duration = personal.estranged_over_six_months ?? personal.estrangement_duration_181_days;
  const permanent = personal.permanently_estranged ?? personal.permanent_estrangement;
  const noParentalSupport = personal.no_parental_contact_or_support ?? personal.no_parental_support;
  const duringLevel3 = personal.estranged_during_level3_study ?? personal.estranged_during_qualification_period;

  const requiredFactsConfirmed = [
    duration,
    permanent,
    noParentalSupport,
    duringLevel3
  ].every((value) => answerIsYes(value, normaliseId));

  if (school.status === 'state_school' && requiredFactsConfirmed) {
    result.checks.school.push(school.entry);
    addMatched(result, 'estrangement', check(
      'ucl_qualifying_estrangement',
      'Qualifying estrangement',
      'personal_circumstances.estranged_from_family',
      'matched',
      {
        estranged_from_family: estranged,
        estranged_over_six_months: duration,
        permanently_estranged: permanent,
        no_parental_contact_or_support: noParentalSupport,
        estranged_during_level3_study: duringLevel3
      }
    ));
    return true;
  }

  if (school.status === 'unknown') {
    addMissing(result, 'school', school.entry, 'ucl_estrangement_route');
  }
  addMissing(result, 'estrangement', check(
    'ucl_estrangement_route_verification',
    'Qualifying estrangement duration/status evidence',
    'personal_circumstances.estranged_from_family',
    'needs_review',
    {
      estranged_from_family: estranged,
      estranged_over_six_months: duration,
      permanently_estranged: permanent,
      no_parental_contact_or_support: noParentalSupport,
      estranged_during_level3_study: duringLevel3
    },
    { reason: 'ucl_access_ucl_estrangement_duration_status_or_school_required' }
  ), 'ucl_estrangement_route');
  return false;
}

function evaluateUclContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();

  const homeFee = isHomeFeeApplicant(applicant, normaliseId);
  result.checks.scope.push(check(
    'ucl_home_fee_scope',
    'Home fee status',
    'applicant_identity.fee_status',
    homeFee ? 'matched' : 'not_applicable',
    asObject(applicant.applicant_identity).fee_status
  ));
  if (!homeFee) {
    return {
      ...result,
      reason: 'ucl_access_ucl_not_applicable',
      policy_decision: 'outside_home_fee_scope'
    };
  }

  const legacy = asObject(evidence.legacy_declarations);
  if (
    legacy.contextual ||
    legacy.widening_participation ||
    legacy.contextual_status_confirmed ||
    asObject(legacy.contextual_flags).access_ucl_confirmed === true
  ) {
    result.checks.ignored_legacy.push(check(
      'ucl_legacy_contextual_declaration_ignored',
      'Legacy contextual declaration',
      'applicant_identity.contextual_flags',
      'ignored',
      {
        contextual: legacy.contextual,
        widening_participation: legacy.widening_participation,
        contextual_status_confirmed: legacy.contextual_status_confirmed,
        access_ucl_confirmed: asObject(legacy.contextual_flags).access_ucl_confirmed
      },
      { reason: 'ucl_access_ucl_must_be_derived_from_step_6_evidence' }
    ));
  }

  const school = schoolStatus(evidence, normaliseId);
  const matchedPathways = [
    ['ucl_postcode_deprivation_route', evaluatePostcodeRoute(evidence, result, school, normaliseId)],
    ['ucl_fsm_route', evaluateFsmRoute(evidence, result, school, normaliseId)],
    ['ucl_care_experienced_route', evaluateCareRoute(evidence, result, normaliseId)],
    ['ucl_estrangement_route', evaluateEstrangementRoute(evidence, result, school, normaliseId)]
  ].filter(([, matched]) => matched);

  if (matchedPathways.length > 0) {
    const [pathwayId] = matchedPathways[0];
    return {
      ...result,
      status: 'contextual',
      reason: 'ucl_access_ucl_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: pathwayId,
      matched_contextual_pathway_label: 'Access UCL',
      policy_decision: 'access_ucl_confirmed',
      activated_applicant_group_ids: ['contextual', UCL_ACCESS_GROUP_ID]
    };
  }

  if (result.missing_information.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'ucl_access_ucl_information_needed',
      is_contextual: false,
      matched_contextual_pathway: null,
      matched_contextual_pathway_label: 'Access UCL',
      policy_decision: 'access_ucl_requires_more_information',
      manual_review_reason: 'ucl_access_ucl_contextual_evidence_needs_review',
      provisional_activated_applicant_group_ids: []
    };
  }

  return result;
}

module.exports = {
  UCL_ACCESS_GROUP_ID,
  UCL_CONTEXTUAL_EVALUATOR_ID,
  evaluateUclContextualEligibility
};
