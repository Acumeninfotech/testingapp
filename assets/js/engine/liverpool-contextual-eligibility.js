const LIVERPOOL_CONTEXTUAL_EVALUATOR_ID = 'liverpool_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function canonicalContextualValue(applicant, path) {
  const contextualProfile = asObject(applicant.contextual_profile);
  return hasOwnPath(contextualProfile, path)
    ? valueAtPath(contextualProfile, path)
    : undefined;
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function imdQuintileIsOne(value, normaliseId) {
  if (Number(value) === 1) return true;
  const normalised = normaliseId(value);
  return ['1', 'q1', 'quintile_1', 'imd_quintile_1'].includes(normalised);
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

function defaultLiverpoolResult() {
  return {
    status: 'not_contextual',
    reason: 'liverpool_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'criteria_not_met',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      criteria: []
    },
    activated_applicant_group_ids: [],
    contextual_evidence: {
      imd_decile_mapping: 'Liverpool IMD Deciles 1-2 are represented in ApplySmart by canonical IMD Quintile 1.',
      matched_criteria: []
    },
    source_ids: ['liverpool_contextual_data_2027']
  };
}

function evaluateScope(applicant, results, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const applicantType = normaliseId(identity.applicant_type);
  const route = normaliseId(
    applicant.qualification_route ||
    applicant.route ||
    applicant.course_target?.qualification_route ||
    applicant.course_target?.entry_route
  );
  const applicantGroups = new Set(Array.isArray(applicant.applicant_group_ids) ? applicant.applicant_group_ids : []);
  const homeFee =
    ['home', 'home_fee', 'ruk', 'rest_of_uk', 'rest_of_uk_roi_fee_rate'].includes(feeStatus) ||
    feeStatus.includes('home');
  const internationalFee =
    ['international', 'international_fee', 'overseas'].includes(feeStatus) ||
    feeStatus.includes('international') ||
    feeStatus.includes('overseas');
  const graduate =
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true ||
    route === 'graduate' ||
    applicantType.includes('graduate') ||
    applicantGroups.has('graduate_applicant');

  if (homeFee && !internationalFee) {
    results.checks.scope.push(
      check('home_fee_status', 'Home fee status', 'applicant_identity.fee_status', 'matched', identity.fee_status)
    );
  } else if (MISSING_VALUES.has(identity.fee_status)) {
    results.missing_information.push(
      check('home_fee_status', 'Home fee status', 'applicant_identity.fee_status', 'missing', identity.fee_status)
    );
    return { status: 'information_needed' };
  } else {
    const entry = check(
      'non_home_fee',
      'Liverpool Medicine contextual consideration requires Home fee status',
      'applicant_identity.fee_status',
      'excluded',
      identity.fee_status,
      { reason: 'liverpool_contextual_home_fee_required' }
    );
    results.exclusions.push(entry);
    results.checks.scope.push(entry);
    return { status: 'not_applicable' };
  }

  if (graduate) {
    const entry = check(
      'graduate_applicant',
      'Graduate applicant',
      'graduate_profile.is_graduate',
      'excluded',
      applicant.graduate_profile?.is_graduate ?? identity.graduate ?? route,
      { reason: 'liverpool_contextual_excludes_graduates' }
    );
    results.exclusions.push(entry);
    results.checks.scope.push(entry);
    return { status: 'not_applicable' };
  }

  results.checks.scope.push(
    check('non_graduate_applicant', 'Non-graduate applicant', 'graduate_profile.is_graduate', 'matched', false)
  );
  return { status: 'confirmed' };
}

function evaluateImdCriterion(applicant, evidence, results, normaliseId) {
  const evidencePath = 'home_area_region.imd_quintile';
  const actual = canonicalContextualValue(applicant, evidencePath);
  const collected = evidence.postcode_measures?.imd_quintile;
  const matched = actual !== undefined && imdQuintileIsOne(collected, normaliseId);
  const details = {
    collected_value: collected,
    decile_mapping: 'Liverpool IMD Deciles 1-2 = canonical IMD Quintile 1'
  };

  if (matched) {
    const entry = check(
      'imd_decile_1_or_2',
      'IMD Decile 1 or 2',
      evidencePath,
      'matched',
      actual,
      details
    );
    results.qualifying_criteria.push(entry);
    results.checks.criteria.push(entry);
    results.contextual_evidence.matched_criteria.push('imd_decile_1_or_2');
    return true;
  }

  results.checks.criteria.push(
    check('imd_decile_1_or_2', 'IMD Decile 1 or 2', evidencePath, 'not_matched', actual, details)
  );
  return false;
}

function evaluateCareCriterion(applicant, evidence, results, normaliseId) {
  const evidencePath = 'personal_circumstances.care_experienced';
  const actual = canonicalContextualValue(applicant, evidencePath);
  const collected = evidence.personal_circumstances?.care_experienced;

  if (actual !== undefined && answerIsYes(collected, normaliseId)) {
    const entry = check(
      'care_experienced',
      'Care experienced',
      evidencePath,
      'matched',
      actual,
      { collected_value: collected }
    );
    results.qualifying_criteria.push(entry);
    results.checks.criteria.push(entry);
    results.contextual_evidence.matched_criteria.push('care_experienced');
    return true;
  }

  results.checks.criteria.push(
    check(
      'care_experienced',
      'Care experienced',
      evidencePath,
      'not_matched',
      actual,
      { collected_value: collected }
    )
  );
  return false;
}

function evaluateLiverpoolContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const results = defaultLiverpoolResult();
  const scope = evaluateScope(applicant, results, normaliseId);

  if (scope.status === 'information_needed') {
    return {
      ...results,
      status: 'information_needed',
      reason: 'liverpool_contextual_scope_information_needed',
      manual_review_reason: 'liverpool_contextual_scope_information_needed',
      policy_decision: 'scope_information_needed'
    };
  }

  if (scope.status === 'not_applicable') {
    return {
      ...results,
      status: 'not_contextual',
      reason: 'liverpool_contextual_not_applicable',
      policy_decision: 'outside_contextual_policy_scope'
    };
  }

  const imdMatched = evaluateImdCriterion(applicant, evidence, results, normaliseId);
  const careMatched = evaluateCareCriterion(applicant, evidence, results, normaliseId);

  if (imdMatched || careMatched) {
    return {
      ...results,
      status: 'contextual',
      reason: 'liverpool_contextual_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: careMatched
        ? 'liverpool_care_experienced_contextual'
        : 'liverpool_imd_q1_contextual',
      matched_contextual_pathway_label: 'Liverpool contextual consideration',
      policy_decision: 'contextual_consideration_confirmed',
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation',
        ...(careMatched ? ['care_experienced'] : [])
      ]
    };
  }

  return results;
}

module.exports = {
  LIVERPOOL_CONTEXTUAL_EVALUATOR_ID,
  evaluateLiverpoolContextualEligibility
};
