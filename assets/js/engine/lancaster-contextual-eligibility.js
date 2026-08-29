const LANCASTER_CONTEXTUAL_EVALUATOR_ID = 'lancaster_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

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

function valueAtPath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      return current[key];
    }, source);
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible', 'granted'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'none', 'not_applicable'].includes(normaliseId(value));
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

function missing(criterionId, label, evidencePath, reason, actual = undefined, details = {}) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    reason,
    actual,
    ...details
  };
}

function addMatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  const entry = check(criterionId, label, evidencePath, 'matched', actual, details);
  results.qualifying_criteria.push(entry);
  results.checks[bucket].push(entry);
  return entry;
}

function addUnmatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  results.checks[bucket].push(check(criterionId, label, evidencePath, 'not_matched', actual, details));
}

function addMissing(results, bucket, criterionId, label, evidencePath, reason, actual = undefined, details = {}) {
  const entry = missing(criterionId, label, evidencePath, reason, actual, details);
  results.missing_information.push(entry);
  results.checks[bucket].push(entry);
  return entry;
}

function defaultLancasterResult() {
  return {
    status: 'not_contextual',
    reason: 'lancaster_contextual_subset_not_confirmed',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'published_subset_not_confirmed',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      baseline: [],
      automatic_routes: [],
      wp_categories: [],
      additional_review: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      confirmed_wp_categories: [],
      unresolved_wp_categories: []
    },
    source_ids: ['lancaster_admissions_policy_2026']
  };
}

function evaluateBaseline(applicant, results, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const applicantType = normaliseId(identity.applicant_type);
  const graduate =
    identity.graduate === true ||
    ['graduate', 'graduate_applicant'].includes(applicantType);

  const homeFee = ['home', 'home_fee', 'ruk'].includes(feeStatus) || feeStatus.includes('home');
  const internationalFee =
    ['international', 'international_fee', 'overseas'].includes(feeStatus) ||
    feeStatus.includes('international') ||
    feeStatus.includes('overseas');

  if (!feeStatus) {
    addMissing(
      results,
      'baseline',
      'home_fee_status',
      'Home fee status',
      'applicant_identity.fee_status',
      'fee_status_not_resolved'
    );
    return { status: 'information_needed' };
  }

  results.checks.baseline.push(
    check(
      'lancaster_contextual_scope',
      'Lancaster contextual scope',
      'applicant_identity.fee_status',
      'matched',
      identity.fee_status,
      { graduate, international_fee: internationalFee }
    )
  );

  if (graduate) {
    results.exclusions.push({
      criterion_id: 'graduate_applicant',
      label: 'Graduate applicant',
      reason: 'lancaster_contextual_excludes_graduates'
    });
    return { status: 'not_applicable' };
  }

  if (internationalFee || !homeFee) {
    results.exclusions.push({
      criterion_id: 'non_home_fee',
      label: 'Non-home fee status',
      reason: 'lancaster_contextual_excludes_international_and_non_home_applicants'
    });
    return { status: 'not_applicable' };
  }

  return { status: 'confirmed' };
}

function categorySignalRecord(id, label, entry) {
  return { category_id: id, label, ...entry };
}

function explicitField(applicant, path) {
  return hasOwnPath(asObject(applicant).contextual_profile, path)
    ? valueAtPath(asObject(applicant).contextual_profile, path)
    : undefined;
}

function evaluateAutomaticCareRoute(applicant, evidence, results, normaliseId) {
  const paths = [
    ['care_experienced', 'Care experienced', 'personal_circumstances.care_experienced'],
    ['care_leaver', 'Care leaver', 'personal_circumstances.care_leaver'],
    ['care_over_three_months', 'Local-authority care for 3 months or more', 'personal_circumstances.care_over_three_months']
  ];
  const personal = asObject(evidence.personal_circumstances);

  for (const [criterionId, label, evidencePath] of paths) {
    const explicitValue = explicitField(applicant, evidencePath);
    const actual = explicitValue !== undefined ? explicitValue : personal[criterionId];
    const explicit = explicitValue !== undefined;

    if (explicit && answerIsYes(actual, normaliseId)) {
      addMatched(results, 'automatic_routes', criterionId, label, evidencePath, actual);
      return {
        status: 'confirmed',
        matched_criterion_id: criterionId
      };
    }
    if (explicit && answerIsNo(actual, normaliseId)) {
      addUnmatched(results, 'automatic_routes', criterionId, label, evidencePath, actual);
    }
  }

  return { status: 'not_met' };
}

function refugeeSignals(applicant, evidence, normaliseId) {
  const rawPersonal = asObject(asObject(applicant).contextual_profile).personal_circumstances;
  const personal = asObject(evidence.personal_circumstances);

  const explicitRefugee = rawPersonal ? rawPersonal.refugee : undefined;
  const explicitGranted = rawPersonal ? rawPersonal.uk_refugee_status_granted : undefined;
  const explicitAsylum = rawPersonal ? rawPersonal.seeking_asylum : undefined;

  return {
    confirmed: (
      (explicitRefugee !== undefined && answerIsYes(explicitRefugee, normaliseId)) ||
      (explicitGranted !== undefined && answerIsYes(explicitGranted, normaliseId))
    ),
    explicitRefugee,
    explicitGranted,
    explicitAsylum,

    // Lancaster admissions decisions are now driven by canonical
    // contextual_profile evidence only. These compatibility properties
    // intentionally remain false so the existing downstream decision
    // block cannot be activated by applicant_identity.contextual_flags.
    rawRefugeeFlag: false,
    rawAsylumFlag: false,
    rawRefugeeOrAsylumFlag: false,

    normalisedRefugee: personal.refugee,
    normalisedGranted: personal.uk_refugee_status_granted,
    normalisedAsylum: personal.seeking_asylum
  };
}

function evaluateAutomaticRefugeeRoute(applicant, evidence, results, normaliseId) {
  const signals = refugeeSignals(applicant, evidence, normaliseId);
  const refugeePath = 'personal_circumstances.refugee';
  const grantedPath = 'personal_circumstances.uk_refugee_status_granted';

  if (signals.confirmed) {
    const actual = signals.explicitRefugee !== undefined
      ? signals.explicitRefugee
      : signals.explicitGranted;
    const matchedPath = signals.explicitRefugee !== undefined ? refugeePath : grantedPath;
    addMatched(
      results,
      'automatic_routes',
      'confirmed_refugee_status',
      'Confirmed refugee status',
      matchedPath,
      actual
    );
    return { status: 'confirmed' };
  }

  if (
    (signals.explicitRefugee !== undefined && answerIsNo(signals.explicitRefugee, normaliseId)) ||
    (signals.explicitGranted !== undefined && answerIsNo(signals.explicitGranted, normaliseId))
  ) {
    addUnmatched(
      results,
      'automatic_routes',
      'confirmed_refugee_status',
      'Confirmed refugee status',
      signals.explicitGranted !== undefined ? grantedPath : refugeePath,
      signals.explicitGranted !== undefined ? signals.explicitGranted : signals.explicitRefugee
    );
  }

  const unresolved =
    (signals.explicitAsylum !== undefined && answerIsYes(signals.explicitAsylum, normaliseId)) ||
    signals.rawAsylumFlag ||
    signals.rawRefugeeOrAsylumFlag ||
    (signals.rawRefugeeFlag &&
      signals.explicitRefugee === undefined &&
      signals.explicitGranted === undefined);

  if (unresolved) {
    addMissing(
      results,
      'automatic_routes',
      'confirmed_refugee_status',
      'Confirmed refugee status',
      'personal_circumstances.uk_refugee_status_granted',
      'lancaster_refugee_status_confirmation_required',
      signals.explicitAsylum ?? signals.normalisedAsylum ?? signals.rawRefugeeOrAsylumFlag,
      {
        awaiting_confirmation: true
      }
    );
    return { status: 'information_needed' };
  }

  return { status: 'not_met' };
}

function evaluateLowIncomeCategory(applicant, evidence, results, normaliseId) {
  const supportedFields = [
    {
      criterion_id: 'means_tested_benefits',
      label: 'Means-tested benefits',
      evidence_path: 'financial_support.means_tested_benefits'
    },
    {
      criterion_id: 'ema_or_16_19_bursary',
      label: '16-19 bursary / EMA or equivalent',
      evidence_path: 'financial_support.ema_or_16_19_bursary'
    },
    {
      criterion_id: 'free_school_meals',
      label: 'Free School Meals',
      evidence_path: 'financial_support.free_school_meals'
    }
  ];

  const matchedEvidence = [];
  let explicitUnknown = false;
  let anyExplicit = false;

  for (const field of supportedFields) {
    const explicitValue = explicitField(applicant, field.evidence_path);
    if (explicitValue === undefined) continue;
    anyExplicit = true;
    if (answerIsYes(explicitValue, normaliseId)) {
      matchedEvidence.push(field);
      continue;
    }
    if (isMissing(explicitValue)) {
      explicitUnknown = true;
    }
  }

  if (matchedEvidence.length > 0) {
    addMatched(
      results,
      'wp_categories',
      'low_income_household',
      'Low-income household',
      'financial_support',
      matchedEvidence.map((entry) => entry.label).join('; '),
      {
        category: 'low_income_household',
        supporting_evidence: matchedEvidence.map((entry) => entry.evidence_path)
      }
    );
    return categorySignalRecord('low_income_household', 'Low-income household', {
      status: 'confirmed'
    });
  }

  if (explicitUnknown) {
    addMissing(
      results,
      'wp_categories',
      'low_income_household',
      'Low-income household',
      'financial_support',
      'lancaster_low_income_confirmation_required'
    );
    return categorySignalRecord('low_income_household', 'Low-income household', {
      status: 'information_needed'
    });
  }

  if (anyExplicit) {
    addUnmatched(
      results,
      'wp_categories',
      'low_income_household',
      'Low-income household',
      'financial_support',
      null
    );
  }

  return categorySignalRecord('low_income_household', 'Low-income household', {
    status: 'not_met'
  });
}

function evaluateSchoolDisadvantageCategory(applicant, evidence, results, normaliseId) {
  const supportedFields = [
    {
      criterion_id: 'low_progression_to_higher_education_school',
      label: 'School with lower-than-average progression to higher education',
      evidence_path: 'school_education.low_progression_to_higher_education_school'
    },
    {
      criterion_id: 'lower_attainment_school',
      label: 'School with lower-than-average attainment',
      evidence_path: 'school_education.lower_attainment_school'
    },
    {
      criterion_id: 'low_attainment_school',
      label: 'School with lower-than-average attainment',
      evidence_path: 'school_education.low_attainment_school'
    }
  ];

  const matchedEvidence = [];
  let explicitUnknown = false;
  let anyExplicit = false;

  for (const field of supportedFields) {
    const explicitValue = explicitField(applicant, field.evidence_path);
    if (explicitValue === undefined) continue;
    anyExplicit = true;
    if (answerIsYes(explicitValue, normaliseId)) {
      matchedEvidence.push(field);
      continue;
    }
    if (isMissing(explicitValue)) {
      explicitUnknown = true;
    }
  }

  if (matchedEvidence.length > 0) {
    addMatched(
      results,
      'wp_categories',
      'school_disadvantage',
      'School disadvantage',
      'school_education',
      matchedEvidence.map((entry) => entry.label).join('; '),
      {
        category: 'school_disadvantage',
        supporting_evidence: matchedEvidence.map((entry) => entry.evidence_path)
      }
    );
    return categorySignalRecord('school_disadvantage', 'School disadvantage', {
      status: 'confirmed'
    });
  }

  if (explicitUnknown) {
    addMissing(
      results,
      'wp_categories',
      'school_disadvantage',
      'School disadvantage',
      'school_education',
      'lancaster_school_disadvantage_confirmation_required'
    );
    return categorySignalRecord('school_disadvantage', 'School disadvantage', {
      status: 'information_needed'
    });
  }

  if (anyExplicit) {
    addUnmatched(
      results,
      'wp_categories',
      'school_disadvantage',
      'School disadvantage',
      'school_education',
      null
    );
  }

  return categorySignalRecord('school_disadvantage', 'School disadvantage', {
    status: 'not_met'
  });
}

function hasAreaEvidence(applicant, evidence) {
  const rawHome = asObject(asObject(asObject(applicant).contextual_profile).home_area_region);
  const postcode = typeof rawHome.postcode === 'string' ? rawHome.postcode.trim() : '';
  const postcodeMeasures = asObject(evidence.postcode_measures);
  const lookup = asObject(postcodeMeasures.lookup);
  const lookupStatus = lookup.status;
  const lookupAttempted = !isMissing(lookupStatus) && lookupStatus !== 'not_checked';
  const hasSubstantiveHomeMeasure = (value) => !isMissing(value);

  return Boolean(
    postcode ||
    hasSubstantiveHomeMeasure(rawHome.imd_quintile) ||
    hasSubstantiveHomeMeasure(rawHome.simd_quintile) ||
    hasSubstantiveHomeMeasure(rawHome.polar4_quintile) ||
    hasSubstantiveHomeMeasure(rawHome.tundra_quintile) ||
    lookupAttempted ||
    hasSubstantiveHomeMeasure(postcodeMeasures.imd_quintile) ||
    hasSubstantiveHomeMeasure(postcodeMeasures.simd_quintile) ||
    hasSubstantiveHomeMeasure(postcodeMeasures.polar4_quintile) ||
    hasSubstantiveHomeMeasure(postcodeMeasures.tundra_quintile)
  );
}

function evaluatePost16SchoolPerformanceCategory(
  applicant,
  evidence,
  results,
  normaliseId
) {
  const evidencePath =
    'school_education.low_progression_to_higher_education_school';
  const explicitValue = explicitField(applicant, evidencePath);

  if (explicitValue === undefined) {
    return categorySignalRecord(
      'post16_school_disadvantage',
      'Post-16 school or college performance',
      { status: 'not_met' }
    );
  }

  if (answerIsYes(explicitValue, normaliseId)) {
    addMissing(
      results,
      'wp_categories',
      'post16_school_disadvantage',
      'Post-16 school or college performance',
      evidencePath,
      'lancaster_post16_school_performance_confirmation_required',
      explicitValue,
      {
        note:
          'The shared low-progression field does not by itself prove Lancaster\'s published below-national-average post-16 attainment criterion.'
      }
    );

    return categorySignalRecord(
      'post16_school_disadvantage',
      'Post-16 school or college performance',
      { status: 'information_needed' }
    );
  }

  return categorySignalRecord(
    'post16_school_disadvantage',
    'Post-16 school or college performance',
    { status: 'not_met' }
  );
}

function evaluateFirstGenerationCategory(
  applicant,
  evidence,
  results,
  normaliseId
) {
  const evidencePath =
    'personal_circumstances.first_in_family_at_university';
  const explicitValue = explicitField(applicant, evidencePath);

  if (explicitValue === undefined) {
    return categorySignalRecord(
      'first_generation_higher_education',
      'Parent or guardian higher-education history',
      { status: 'not_met' }
    );
  }

  if (answerIsYes(explicitValue, normaliseId)) {
    addMissing(
      results,
      'wp_categories',
      'first_generation_higher_education',
      'Parent or guardian higher-education history',
      evidencePath,
      'lancaster_parental_he_history_confirmation_required',
      explicitValue,
      {
        note:
          'Lancaster applies additional exceptions concerning mature-study history and parents or guardians who graduated as doctors or dentists.'
      }
    );

    return categorySignalRecord(
      'first_generation_higher_education',
      'Parent or guardian higher-education history',
      { status: 'information_needed' }
    );
  }

  return categorySignalRecord(
    'first_generation_higher_education',
    'Parent or guardian higher-education history',
    { status: 'not_met' }
  );
}

function evaluateYoungCarerCategory(
  applicant,
  evidence,
  results,
  normaliseId
) {
  const evidencePath = 'personal_circumstances.young_or_adult_carer';
  const explicitValue = explicitField(applicant, evidencePath);

  if (explicitValue === undefined) {
    return categorySignalRecord(
      'young_carer',
      'Young carer to a parent or sibling',
      { status: 'not_met' }
    );
  }

  if (answerIsYes(explicitValue, normaliseId)) {
    addMissing(
      results,
      'wp_categories',
      'young_carer',
      'Young carer to a parent or sibling',
      evidencePath,
      'lancaster_young_carer_relationship_confirmation_required',
      explicitValue,
      {
        note:
          'The shared young-or-adult-carer field is broader than Lancaster\'s published young-carer-to-parent-or-sibling criterion.'
      }
    );

    return categorySignalRecord(
      'young_carer',
      'Young carer to a parent or sibling',
      { status: 'information_needed' }
    );
  }

  return categorySignalRecord(
    'young_carer',
    'Young carer to a parent or sibling',
    { status: 'not_met' }
  );
}

function evaluateAreaDisadvantageCategory(applicant, evidence, results) {
  if (!hasAreaEvidence(applicant, evidence)) {
    return categorySignalRecord('area_disadvantage', 'Area / low-participation disadvantage', {
      status: 'not_met'
    });
  }

  const postcodeMeasures = asObject(evidence.postcode_measures);
  const summary = [
    postcodeMeasures.imd_quintile ? `IMD ${postcodeMeasures.imd_quintile}` : null,
    postcodeMeasures.simd_quintile ? `SIMD ${postcodeMeasures.simd_quintile}` : null,
    postcodeMeasures.polar4_quintile ? `POLAR4 ${postcodeMeasures.polar4_quintile}` : null,
    postcodeMeasures.tundra_quintile ? `TUNDRA ${postcodeMeasures.tundra_quintile}` : null
  ].filter(Boolean).join('; ');

  addMissing(
    results,
    'wp_categories',
    'area_disadvantage',
    'Area / low-participation disadvantage',
    'home_area_region',
    'lancaster_area_disadvantage_requires_manual_review',
    summary || null,
    {
      unpublished_cutoff: true
    }
  );
  return categorySignalRecord('area_disadvantage', 'Area / low-participation disadvantage', {
    status: 'information_needed'
  });
}

function evaluateOtherWpSignals(applicant, evidence, results, normaliseId) {
  const access = asObject(evidence.access_programmes);
  const partnerSchools = asObject(evidence.partner_schools);

  const hasOtherSignal =
    answerIsYes(access.participation_status, normaliseId) ||
    asArray(access.other_programmes).length > 0 ||
    Boolean(access.other_programme_name) ||
    answerIsYes(partnerSchools.status, normaliseId) ||
    asArray(partnerSchools.relationships).length > 0;

  if (!hasOtherSignal) {
    return null;
  }

  addMissing(
    results,
    'additional_review',
    'other_lancaster_wp_circumstances',
    'Other Lancaster widening-participation circumstances',
    'access_programmes',
    'lancaster_other_wp_circumstances_require_manual_review'
  );
  return {
    status: 'information_needed'
  };
}

function hasReviewableSignals(results) {
  return results.missing_information.length > 0;
}

function contextualOutcome(results, policyDecision, matchedPathway, label) {
  return {
    ...results,
    status: 'contextual',
    reason: 'lancaster_contextual_criteria_met',
    is_contextual: true,
    matched_contextual_pathway: matchedPathway,
    matched_contextual_pathway_label: label,
    policy_decision: policyDecision,
    activated_applicant_group_ids: ['contextual', 'widening_participation']
  };
}

function evaluateLancasterContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const results = defaultLancasterResult();

  const baseline = evaluateBaseline(applicant, results, normaliseId);
  if (baseline.status === 'information_needed') {
    return {
      ...results,
      status: 'information_needed',
      reason: 'lancaster_contextual_information_needed',
      manual_review_reason: 'lancaster_contextual_information_needed',
      policy_decision: 'baseline_information_needed'
    };
  }
  if (baseline.status === 'not_applicable') {
    return {
      ...results,
      status: 'not_contextual',
      reason: 'lancaster_contextual_not_applicable',
      policy_decision: 'outside_contextual_policy_scope'
    };
  }

  const automaticCare = evaluateAutomaticCareRoute(applicant, evidence, results, normaliseId);
  if (automaticCare.status === 'confirmed') {
    return contextualOutcome(
      results,
      'automatic_care_route_confirmed',
      'lancaster_contextual_care_route',
      'Lancaster contextual status confirmed through the care route'
    );
  }

  const automaticRefugee = evaluateAutomaticRefugeeRoute(applicant, evidence, results, normaliseId);
  if (automaticRefugee.status === 'confirmed') {
    return contextualOutcome(
      results,
      'automatic_refugee_route_confirmed',
      'lancaster_contextual_refugee_route',
      'Lancaster contextual status confirmed through the refugee route'
    );
  }

  const categoryResults = [
    evaluateAreaDisadvantageCategory(applicant, evidence, results, normaliseId),
    evaluateLowIncomeCategory(applicant, evidence, results, normaliseId),
    evaluateSchoolDisadvantageCategory(applicant, evidence, results, normaliseId),
    evaluatePost16SchoolPerformanceCategory(
      applicant,
      evidence,
      results,
      normaliseId
    ),
    evaluateFirstGenerationCategory(
      applicant,
      evidence,
      results,
      normaliseId
    ),
    evaluateYoungCarerCategory(
      applicant,
      evidence,
      results,
      normaliseId
    )
  ];
  evaluateOtherWpSignals(applicant, evidence, results, normaliseId);

  const confirmedCategories = categoryResults
    .filter((entry) => entry.status === 'confirmed')
    .map((entry) => entry.category_id);
  const unresolvedCategories = categoryResults
    .filter((entry) => entry.status === 'information_needed')
    .map((entry) => entry.category_id);

  results.contextual_evidence.confirmed_wp_categories = confirmedCategories;
  results.contextual_evidence.unresolved_wp_categories = unresolvedCategories;

  if (confirmedCategories.length >= 2) {
    return contextualOutcome(
      results,
      'two_distinct_wp_categories_confirmed',
      'lancaster_contextual_two_category_route',
      'Lancaster contextual status confirmed through two distinct widening-participation categories'
    );
  }

  if (
    automaticRefugee.status === 'information_needed' ||
    unresolvedCategories.length > 0 ||
    hasReviewableSignals(results)
  ) {
    return {
      ...results,
      status: 'information_needed',
      reason: 'lancaster_contextual_information_needed',
      manual_review_reason: 'lancaster_contextual_information_needed',
      is_contextual: false,
      policy_decision: 'manual_review_required_for_unresolved_or_unpublished_wp_evidence'
    };
  }

  return {
    ...results,
    status: 'not_contextual',
    reason: 'lancaster_contextual_subset_not_confirmed',
    is_contextual: false,
    policy_decision: 'published_subset_not_confirmed'
  };
}

module.exports = {
  LANCASTER_CONTEXTUAL_EVALUATOR_ID,
  evaluateLancasterContextualEligibility
};
