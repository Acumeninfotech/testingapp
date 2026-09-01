const SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID = 'southampton_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
const SOUTHAMPTON_ACCESS_PROGRAMME_ID = 'southampton_access_southampton';

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
    if (
      !current ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return false;
    }
    current = current[key];
  }
  return true;
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'participating', 'eligible'].includes(
    normaliseId(value)
  );
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return [
    'no',
    'false',
    'none',
    'not_applicable',
    'not_started',
    'not_participating',
    'not_completed'
  ].includes(normaliseId(value));
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
}

function explicitlyMissing(rawProfile, path, normalisedValue) {
  if (!hasOwnPath(rawProfile, path)) {
    return false;
  }

  // Step 6 projects unanswered/default fields as unknown/not_sure.
  // Those defaults must not make Southampton's contextual AAB route
  // unresolved. Only an explicitly withheld answer is treated as
  // information that still requires confirmation.
  return normalisedValue === 'prefer_not_to_say';
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
    reason: 'southampton_contextual_threshold_not_met',
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
    contextual_evidence: {
      confirmed_flag_count: 0,
      possible_unresolved_flag_count: 0,
      required_flag_count: 2,
      matched_criteria: []
    },
    activated_applicant_group_ids: [],
    source_ids: ['southampton_research_doc']
  };
}

function evaluateScope(applicant, results, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const applicantType = normaliseId(identity.applicant_type);
  const groups = new Set(asArray(applicant.applicant_group_ids).map(normaliseId));
  const route = normaliseId(
    applicant.qualification_route ||
    applicant.route ||
    applicant.course_target?.qualification_route ||
    applicant.course_target?.entry_route
  );

  const internationalFee =
    feeStatus.includes('international') ||
    feeStatus.includes('overseas') ||
    groups.has('international_fee');
  const homeFee =
    feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk' ||
    feeStatus.includes('home') ||
    groups.has('home_fee');
  const graduate =
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true ||
    route === 'graduate' ||
    applicantType.includes('graduate') ||
    groups.has('graduate_applicant');
  const mature =
    applicantType.includes('mature') ||
    groups.has('mature_applicant');
  const schoolLeaver =
    groups.has('school_leaver') ||
    applicantType.includes('school') ||
    applicantType.includes('standard') ||
    (!applicantType && !graduate && !mature);

  if (!feeStatus && !groups.has('home_fee') && !groups.has('international_fee')) {
    results.missing_information.push(check(
      'home_fee_status',
      'Home fee status',
      'applicant_identity.fee_status',
      'missing',
      identity.fee_status,
      { reason: 'southampton_contextual_fee_status_not_resolved' }
    ));
    return 'information_needed';
  }

  results.checks.scope.push(check(
    'southampton_contextual_scope',
    'Southampton contextual scope',
    'applicant_identity',
    homeFee && schoolLeaver && !internationalFee && !graduate && !mature ? 'matched' : 'not_matched',
    {
      fee_status: identity.fee_status,
      applicant_type: identity.applicant_type,
      route
    },
    { home_fee: homeFee, school_leaver: schoolLeaver, graduate, mature, international_fee: internationalFee }
  ));

  if (!homeFee || internationalFee || graduate || mature || !schoolLeaver) {
    results.exclusions.push(check(
      'outside_southampton_contextual_scope',
      'Southampton BM5 contextual route is for Home-fee school-leaver applicants',
      'applicant_identity',
      'excluded',
      {
        fee_status: identity.fee_status,
        applicant_type: identity.applicant_type,
        route
      },
      { home_fee: homeFee, school_leaver: schoolLeaver, graduate, mature, international_fee: internationalFee }
    ));
    return 'not_applicable';
  }

  return 'confirmed';
}

function addCriterion(results, {
  criterionId,
  label,
  evidencePath,
  actual,
  matched,
  unresolved,
  details = {}
}) {
  const status = matched ? 'matched' : unresolved ? 'missing' : 'not_matched';
  const entry = check(criterionId, label, evidencePath, status, actual, details);
  results.checks.criteria.push(entry);

  if (matched) {
    results.qualifying_criteria.push(entry);
    results.contextual_evidence.matched_criteria.push(criterionId);
    results.contextual_evidence.confirmed_flag_count += 1;
  } else if (unresolved) {
    results.missing_information.push(entry);
    results.contextual_evidence.possible_unresolved_flag_count += 1;
  }
}

function programmeStatus(programme, normaliseId) {
  return normaliseId(programme.status || programme.programme_status);
}

function accessSouthamptonProgramme(evidence, normaliseId) {
  return asArray(evidence.access_programmes?.other_programmes)
    .map(asObject)
    .find((programme) => {
      return normaliseId(programme.programme_id) === SOUTHAMPTON_ACCESS_PROGRAMME_ID;
    }) || null;
}

function evaluateCriteria(applicant, evidence, results, normaliseId) {
  const rawProfile = asObject(applicant.contextual_profile);
  const personal = asObject(evidence.personal_circumstances);
  const postcode = asObject(evidence.postcode_measures);
  const financial = asObject(evidence.financial_support);

  addCriterion(results, {
    criterionId: 'care_experience_three_months',
    label: 'Care experience for three months or more',
    evidencePath: 'contextual_profile.personal_circumstances.care_over_three_months',
    actual: personal.care_over_three_months,
    matched: answerIsYes(personal.care_over_three_months, normaliseId),
    unresolved:
      explicitlyMissing(
        rawProfile,
        'personal_circumstances.care_over_three_months',
        personal.care_over_three_months
      ) ||
      (
        answerIsYes(personal.care_experienced, normaliseId) &&
        !answerIsNo(personal.care_over_three_months, normaliseId)
      )
  });

  const polar4Q1 = quintileIs(postcode.polar4_quintile, 1, normaliseId);
  const tundraQ1 = quintileIs(postcode.tundra_quintile, 1, normaliseId);
  addCriterion(results, {
    criterionId: 'low_participation_postcode',
    label: 'POLAR4 quintile 1 or TUNDRA quintile 1',
    evidencePath: 'contextual_profile.home_area_region',
    actual: {
      polar4_quintile: postcode.polar4_quintile,
      tundra_quintile: postcode.tundra_quintile
    },
    matched: polar4Q1 || tundraQ1,
    unresolved:
      explicitlyMissing(rawProfile, 'home_area_region.polar4_quintile', postcode.polar4_quintile) ||
      explicitlyMissing(rawProfile, 'home_area_region.tundra_quintile', postcode.tundra_quintile)
  });

  const accessProgramme = accessSouthamptonProgramme(evidence, normaliseId);
  const accessStatus = accessProgramme ? programmeStatus(accessProgramme, normaliseId) : '';
  addCriterion(results, {
    criterionId: 'access_southampton_participation',
    label: 'Access Southampton participation',
    evidencePath: 'contextual_profile.access_programmes.other_programmes',
    actual: accessProgramme?.programme_id || null,
    matched: accessProgramme && ['participating', 'completed'].includes(accessStatus),
    unresolved: accessProgramme &&
      !['participating', 'completed'].includes(accessStatus) &&
      !answerIsNo(accessStatus, normaliseId),
    details: accessProgramme ? { programme_status: accessStatus || null } : {}
  });

  addCriterion(results, {
    criterionId: 'english_imd_decile_1_or_2',
    label: 'English IMD decile 1 or 2',
    evidencePath: 'contextual_profile.home_area_region.imd_quintile',
    actual: postcode.imd_quintile,
    matched: quintileIs(postcode.imd_quintile, 1, normaliseId),
    unresolved: explicitlyMissing(rawProfile, 'home_area_region.imd_quintile', postcode.imd_quintile),
    details: { represented_by_step_6_field: 'imd_quintile_q1', simd_not_mapped: true }
  });

  addCriterion(results, {
    criterionId: 'free_school_meals_after_14',
    label: 'Free school meals after age 14',
    evidencePath: 'contextual_profile.financial_support.free_school_meals_at_level3_completion',
    actual: financial.free_school_meals_at_level3_completion,
    matched: answerIsYes(financial.free_school_meals_at_level3_completion, normaliseId),
    unresolved:
      explicitlyMissing(
        rawProfile,
        'financial_support.free_school_meals_at_level3_completion',
        financial.free_school_meals_at_level3_completion
      ) ||
      (
        answerIsYes(financial.free_school_meals, normaliseId) &&
        !answerIsNo(financial.free_school_meals_at_level3_completion, normaliseId)
      )
  });

  addCriterion(results, {
    criterionId: 'estranged_student',
    label: 'Estranged student',
    evidencePath: 'contextual_profile.personal_circumstances.estranged_from_family',
    actual: personal.estranged_from_family,
    matched: answerIsYes(personal.estranged_from_family, normaliseId),
    unresolved: explicitlyMissing(
      rawProfile,
      'personal_circumstances.estranged_from_family',
      personal.estranged_from_family
    )
  });

  addCriterion(results, {
    criterionId: 'ucat_bursary',
    label: 'UCAT bursary recipient',
    evidencePath: 'contextual_profile.financial_support.ucat_bursary_recipient',
    actual: financial.ucat_bursary_recipient,
    matched: answerIsYes(financial.ucat_bursary_recipient, normaliseId),
    unresolved: explicitlyMissing(
      rawProfile,
      'financial_support.ucat_bursary_recipient',
      financial.ucat_bursary_recipient
    )
  });
}

function evaluateSouthamptonContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const results = defaultResult();
  const scope = evaluateScope(applicant, results, normaliseId);

  if (scope === 'information_needed') {
    return {
      ...results,
      status: 'information_needed',
      reason: 'southampton_contextual_scope_information_needed',
      policy_decision: 'scope_information_needed',
      manual_review_reason: 'southampton_contextual_information_needed'
    };
  }

  if (scope === 'not_applicable') {
    return {
      ...results,
      status: 'not_contextual',
      reason: 'southampton_contextual_not_applicable',
      policy_decision: 'outside_contextual_policy_scope'
    };
  }

  evaluateCriteria(applicant, evidence, results, normaliseId);

  if (results.contextual_evidence.confirmed_flag_count >= 2) {
    return {
      ...results,
      status: 'contextual',
      reason: 'southampton_two_contextual_flags_confirmed',
      is_contextual: true,
      matched_contextual_pathway: 'southampton_contextual_aab',
      matched_contextual_pathway_label: 'Southampton BM5 contextual offer',
      policy_decision: 'contextual_offer_confirmed',
      activated_applicant_group_ids: ['contextual', 'widening_participation']
    };
  }

  if (
    results.contextual_evidence.confirmed_flag_count +
      results.contextual_evidence.possible_unresolved_flag_count >= 2
  ) {
    return {
      ...results,
      status: 'information_needed',
      reason: 'southampton_contextual_evidence_incomplete',
      policy_decision: 'criteria_information_needed',
      manual_review_reason: 'southampton_contextual_information_needed'
    };
  }

  return results;
}

module.exports = {
  SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID,
  SOUTHAMPTON_ACCESS_PROGRAMME_ID,
  evaluateSouthamptonContextualEligibility
};
