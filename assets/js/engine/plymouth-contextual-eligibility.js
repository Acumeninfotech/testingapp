const PLYMOUTH_CONTEXTUAL_EVALUATOR_ID = 'plymouth_contextual_medicine_a100';

const MISSING_VALUES = new Set([
  '',
  null,
  undefined,
  'unknown',
  'not_sure',
  'prefer_not_to_say'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed'].includes(normaliseId(value));
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
}

function check(criterionId, label, evidencePath, status, points, actual, details = {}) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    points,
    actual,
    ...details
  };
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'plymouth_contextual_threshold_not_met',
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
    contextual_points: {
      confirmed: 0,
      possible_from_unresolved: 0,
      threshold: 5
    },
    activated_applicant_group_ids: [],
    source_ids: ['plymouth_research_doc']
  };
}

function addCriterion(results, {
  criterionId,
  label,
  evidencePath,
  actual,
  points,
  matched,
  unresolved,
  details = {}
}) {
  const status = matched
    ? 'matched'
    : unresolved
      ? 'missing'
      : 'not_matched';

  const entry = check(
    criterionId,
    label,
    evidencePath,
    status,
    points,
    actual,
    details
  );

  results.checks.criteria.push(entry);

  if (matched) {
    results.qualifying_criteria.push(entry);
    results.contextual_points.confirmed += points;
  }

  if (unresolved) {
    results.missing_information.push(entry);
    results.contextual_points.possible_from_unresolved += points;
  }
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

  const international =
    feeStatus.includes('international') ||
    feeStatus.includes('overseas');

  const home =
    feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus.includes('home') ||
    feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk';

  const graduate =
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true ||
    route === 'graduate' ||
    applicantType.includes('graduate');

  if (!feeStatus) {
    results.missing_information.push(
      check(
        'home_fee_status',
        'Home fee status',
        'applicant_identity.fee_status',
        'missing',
        0,
        identity.fee_status
      )
    );
    return 'information_needed';
  }

  if (!home || international) {
    results.exclusions.push(
      check(
        'non_home_fee',
        'Plymouth A100 widening-access contextual route requires Home fee status',
        'applicant_identity.fee_status',
        'excluded',
        0,
        identity.fee_status
      )
    );
    return 'not_applicable';
  }

  if (graduate) {
    results.exclusions.push(
      check(
        'graduate_applicant',
        'Graduate applicant',
        'graduate_profile.is_graduate',
        'excluded',
        0,
        applicant.graduate_profile?.is_graduate ?? identity.graduate
      )
    );
    return 'not_applicable';
  }

  return 'confirmed';
}

function evaluateUkwpmed(evidence, results, normaliseId) {
  const ukwpmed = asObject(evidence.access_programmes?.ukwpmed);
  const status = normaliseId(ukwpmed.status);
  const programmeStatus = normaliseId(ukwpmed.programme_status);
  const programmeId = normaliseId(ukwpmed.programme_id);

  if (status !== 'yes') {
    return {
      matched: false,
      unresolved: null
    };
  }

  const confirmedParticipation =
    Boolean(programmeId) &&
    ['participating', 'completed'].includes(programmeStatus);

  if (!confirmedParticipation) {
    return {
      matched: false,
      unresolved: check(
        'ukwpmed_participation',
        'Verified UKWPMED participation',
        'access_programmes.ukwpmed',
        'missing',
        0,
        ukwpmed,
        { reason: 'ukwpmed_participation_not_yet_confirmed' }
      )
    };
  }

  results.qualifying_criteria.push(
    check(
      'ukwpmed_participation',
      'Verified UKWPMED participation',
      'access_programmes.ukwpmed',
      'matched',
      0,
      ukwpmed.programme_id
    )
  );

  return {
    matched: true,
    unresolved: null
  };
}

function evaluatePlymouthContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const results = defaultResult();

  const scope = evaluateScope(applicant, results, normaliseId);

  if (scope === 'information_needed') {
    return {
      ...results,
      status: 'information_needed',
      reason: 'plymouth_contextual_scope_information_needed',
      policy_decision: 'scope_information_needed'
    };
  }

  if (scope === 'not_applicable') {
    return {
      ...results,
      status: 'not_contextual',
      reason: 'plymouth_contextual_not_applicable',
      policy_decision: 'outside_contextual_policy_scope'
    };
  }

  // UKWPMED is a separate Plymouth A100 access pathway.
  const ukwpmed = evaluateUkwpmed(evidence, results, normaliseId);

  if (ukwpmed.matched) {
    return {
      ...results,
      status: 'contextual',
      reason: 'plymouth_ukwpmed_confirmed',
      is_contextual: true,
      matched_contextual_pathway: 'plymouth_ukwpmed_abb',
      matched_contextual_pathway_label: 'Plymouth UKWPMED',
      policy_decision: 'ukwpmed_confirmed',
      missing_information: [],
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation',
        'plymouth_ukwpmed'
      ]
    };
  }

  const financial = asObject(evidence.financial_support);
  const school = asObject(evidence.school_education);
  const personal = asObject(evidence.personal_circumstances);
  const home = asObject(evidence.home_area_region);
  const postcode = asObject(evidence.postcode_measures);
  const ukwpmedEvidence = asObject(evidence.access_programmes?.ukwpmed);

  const criteria = [
    {
      criterionId: 'care_experienced',
      label: 'Care or care-experienced',
      evidencePath: 'personal_circumstances.care_experienced',
      actual: personal.care_experienced,
      points: 2,
      matched: answerIsYes(personal.care_experienced, normaliseId),
      unresolved: isMissing(personal.care_experienced)
    },
    {
      criterionId: 'fsm_at_level3_completion',
      label: 'Free School Meals while completing Level 3 qualifications',
      evidencePath: 'financial_support.free_school_meals_at_level3_completion',
      actual: financial.free_school_meals_at_level3_completion,
      points: 2,
      matched: answerIsYes(financial.free_school_meals_at_level3_completion, normaliseId),
      unresolved: isMissing(financial.free_school_meals_at_level3_completion)
    },
    {
      criterionId: 'refugee_or_asylum_seeker',
      label: 'Refugee or asylum-seeker status',
      evidencePath: 'personal_circumstances.refugee / seeking_asylum',
      actual: {
        refugee: personal.refugee,
        seeking_asylum: personal.seeking_asylum
      },
      points: 2,
      matched:
        answerIsYes(personal.refugee, normaliseId) ||
        answerIsYes(personal.seeking_asylum, normaliseId),
      unresolved:
        !answerIsYes(personal.refugee, normaliseId) &&
        !answerIsYes(personal.seeking_asylum, normaliseId) &&
        (isMissing(personal.refugee) || isMissing(personal.seeking_asylum))
    },
    {
      criterionId: 'low_performing_post16_school',
      label: 'Low-performing school or college at 16–18',
      evidencePath: 'school_education.below_average_post16_school',
      actual: school.below_average_post16_school,
      points: 2,
      matched: answerIsYes(school.below_average_post16_school, normaliseId),
      unresolved: isMissing(school.below_average_post16_school)
    },
    {
      criterionId: 'ema_or_16_19_bursary',
      label: 'EMA or 16–19 bursary',
      evidencePath: 'financial_support.ema_or_16_19_bursary',
      actual: financial.ema_or_16_19_bursary,
      points: 2,
      matched: answerIsYes(financial.ema_or_16_19_bursary, normaliseId),
      unresolved: isMissing(financial.ema_or_16_19_bursary)
    },
    {
      criterionId: 'ucat_bursary',
      label: 'UCAT bursary',
      evidencePath: 'financial_support.ucat_bursary_recipient',
      actual: financial.ucat_bursary_recipient,
      points: 2,
      matched: answerIsYes(financial.ucat_bursary_recipient, normaliseId),
      unresolved: isMissing(financial.ucat_bursary_recipient)
    },
    {
      criterionId: 'imd_1_to_4',
      label: 'IMD 1–4 or local equivalent',
      evidencePath: 'home_area_region.imd_quintile',
      actual: postcode.imd_quintile,
      points: 1,
      matched: ['q1', 'q2'].includes(normaliseId(postcode.imd_quintile)),
      unresolved: isMissing(postcode.imd_quintile),
      details: {
        applysmart_mapping:
          'Plymouth IMD 1-4 is represented by canonical IMD Quintile 1 or 2.'
      }
    },
    {
      criterionId: 'peninsula_pathways_significant_engagement',
      label: 'Significant Peninsula Pathways engagement',
      evidencePath: 'access_programmes.ukwpmed.significant_engagement',
      actual: ukwpmedEvidence.significant_engagement,
      points: 1,
      matched:
        normaliseId(ukwpmedEvidence.programme_id) === 'plymouth_peninsula_pathways' &&
        answerIsYes(ukwpmedEvidence.significant_engagement, normaliseId),
      unresolved:
        normaliseId(ukwpmedEvidence.programme_id) === 'plymouth_peninsula_pathways' &&
        isMissing(ukwpmedEvidence.significant_engagement)
    },
    {
      criterionId: 'polar4_q1',
      label: 'POLAR4 Quintile 1',
      evidencePath: 'home_area_region.polar4_quintile',
      actual: postcode.polar4_quintile,
      points: 1,
      matched: normaliseId(postcode.polar4_quintile) === 'q1',
      unresolved: isMissing(postcode.polar4_quintile)
    },
    {
      criterionId: 'south_west_resident',
      label: 'Cornwall, Devon, Dorset or Somerset resident',
      evidencePath: 'home_area_region.specific_home_area',
      actual: home.specific_home_area,
      points: 1,
      matched: normaliseId(home.specific_home_area) === 'plymouth_widening_access_region',
      unresolved: isMissing(home.specific_home_area)
    },
    {
      criterionId: 'service_pupil_premium',
      label: 'Service Pupil Premium',
      evidencePath: 'financial_support.service_pupil_premium',
      actual: financial.service_pupil_premium,
      points: 1,
      matched: answerIsYes(financial.service_pupil_premium, normaliseId),
      unresolved: isMissing(financial.service_pupil_premium)
    }
  ];

  for (const criterion of criteria) {
    addCriterion(results, criterion);
  }

  if (results.contextual_points.confirmed >= 5) {
    return {
      ...results,
      status: 'contextual',
      reason: 'plymouth_widening_access_threshold_met',
      is_contextual: true,
      matched_contextual_pathway: 'plymouth_contextual_home_aab',
      matched_contextual_pathway_label: 'Plymouth Widening Access',
      policy_decision: 'contextual_threshold_met',
      missing_information: [],
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation'
      ]
    };
  }

  if (ukwpmed.unresolved) {
    results.missing_information.push(ukwpmed.unresolved);
  }

  const maximumPossible =
    results.contextual_points.confirmed +
    results.contextual_points.possible_from_unresolved;

  if (maximumPossible >= 5 || ukwpmed.unresolved) {
    return {
      ...results,
      status: 'information_needed',
      reason: ukwpmed.unresolved
        ? 'plymouth_contextual_or_ukwpmed_pathway_depends_on_missing_information'
        : 'plymouth_contextual_threshold_depends_on_missing_information',
      policy_decision: ukwpmed.unresolved
        ? 'pathway_unresolved'
        : 'threshold_unresolved'
    };
  }

  return results;
}

module.exports = {
  PLYMOUTH_CONTEXTUAL_EVALUATOR_ID,
  evaluatePlymouthContextualEligibility
};
