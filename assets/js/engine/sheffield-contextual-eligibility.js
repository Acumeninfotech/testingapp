const SHEFFIELD_CONTEXTUAL_EVALUATOR_ID = 'sheffield_contextual_medicine_a100';

const SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID = 'sheffield_contextual_offer';
const SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_GROUP_ID =
  'sheffield_access_to_sheffield_medicine';
const SHEFFIELD_BRADFORD_HALLAM_PATHWAY_GROUP_ID =
  'sheffield_bradford_hallam_pathway';
const SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_PROGRAMME_ID =
  'sheffield_access_to_sheffield_medicine';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'participating', 'offered', 'eligible'].includes(
    normaliseId(value)
  );
}

function isHomeFee(applicant, normaliseId) {
  const feeStatus = normaliseId(asObject(applicant.applicant_identity).fee_status);
  return feeStatus.includes('home') || ['ruk', 'rest_of_uk', 'rest_of_uk_roi_fee_rate'].includes(feeStatus);
}

function hasForcedMigrantEvidence(evidence, normaliseId) {
  const personal = evidence.personal_circumstances || {};
  const ukrainianVisaScheme = normaliseId(personal.ukrainian_visa_scheme);
  return answerIsYes(personal.refugee, normaliseId) ||
    answerIsYes(personal.uk_refugee_status_granted, normaliseId) ||
    answerIsYes(personal.seeking_asylum, normaliseId) ||
    (
      ukrainianVisaScheme &&
      !['none', 'no', 'not_sure', 'prefer_not_to_say'].includes(ukrainianVisaScheme)
    );
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

function programmeStatus(programme, normaliseId) {
  return normaliseId(programme.status || programme.programme_status);
}

function programmeMatches(programme, programmeIds, normaliseId) {
  const ids = new Set(programmeIds);
  const programmeId = normaliseId(programme.programme_id);
  return ids.has(programmeId);
}

function recognisedProgrammeStatus(status) {
  return ['offered', 'participating', 'completed'].includes(status);
}

function programmeCompletionConfirmed(status) {
  return status === 'completed';
}

function findOtherProgramme(evidence, programmeIds, normaliseId) {
  return asArray(evidence.access_programmes?.other_programmes)
    .map(asObject)
    .find((programme) => programmeMatches(programme, programmeIds, normaliseId)) || null;
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'sheffield_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      criteria: [],
      programmes: [],
      manual_review: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      matched_criteria: [],
      matched_programmes: []
    },
    source_ids: [
      'sheffield_course_page_2027',
      'sheffield_a100_policy_2027',
      'sheffield_widening_access'
    ]
  };
}

function evaluateAccessPlusCriteria(evidence, result, normaliseId) {
  const imd = evidence.postcode_measures?.imd_quintile;
  const imdNormalised = normaliseId(imd);
  if (Number(imd) === 1 || Number(imd) === 2 || ['q1', 'q2', 'quintile_1', 'quintile_2'].includes(imdNormalised)) {
    const entry = check(
      'access_sheffield_imd_quintile_1_or_2',
      'Access Sheffield IMD quintile 1 or 2',
      'contextual_profile.home_area_region.imd_quintile',
      'matched',
      imd
    );
    result.qualifying_criteria.push(entry);
    result.checks.criteria.push(entry);
    result.contextual_evidence.matched_criteria.push(entry.criterion_id);
  } else if (MISSING_VALUES.has(imd)) {
    result.checks.criteria.push(
      check(
        'access_sheffield_imd_quintile_1_or_2',
        'Access Sheffield IMD quintile 1 or 2',
        'contextual_profile.home_area_region.imd_quintile',
        'missing',
        imd
      )
    );
  }

  const personalCriteria = [
    ['access_sheffield_care_experienced', 'Care experienced', 'care_experienced'],
    ['access_sheffield_care_leaver', 'Care leaver', 'care_leaver'],
    ['access_sheffield_carer', 'Young or adult carer', 'young_or_adult_carer'],
    ['access_sheffield_estranged', 'Estranged from family', 'estranged_from_family'],
    ['access_sheffield_parenting', 'Parenting responsibilities', 'parenting_responsibilities'],
    ['access_sheffield_refugee', 'Refugee status', 'refugee'],
    ['access_sheffield_uk_refugee_status', 'UK refugee status granted', 'uk_refugee_status_granted'],
    ['access_sheffield_asylum_seeker', 'Seeking asylum', 'seeking_asylum']
  ];

  for (const [criterionId, label, key] of personalCriteria) {
    const evidencePath = `contextual_profile.personal_circumstances.${key}`;
    const actual = evidence.personal_circumstances?.[key];
    if (answerIsYes(actual, normaliseId)) {
      const entry = check(criterionId, label, evidencePath, 'matched', actual);
      result.qualifying_criteria.push(entry);
      result.checks.criteria.push(entry);
      result.contextual_evidence.matched_criteria.push(criterionId);
    } else if (MISSING_VALUES.has(actual)) {
      result.checks.criteria.push(check(criterionId, label, evidencePath, 'missing', actual));
    }
  }

  const ukrainianVisaScheme = evidence.personal_circumstances?.ukrainian_visa_scheme;
  const ukrainianVisaSchemeId = normaliseId(ukrainianVisaScheme);
  if (
    ukrainianVisaSchemeId &&
    !['none', 'no', 'not_sure', 'prefer_not_to_say'].includes(ukrainianVisaSchemeId)
  ) {
    const entry = check(
      'access_sheffield_ukrainian_visa_scheme',
      'Ukrainian visa scheme',
      'contextual_profile.personal_circumstances.ukrainian_visa_scheme',
      'matched',
      ukrainianVisaScheme
    );
    result.qualifying_criteria.push(entry);
    result.checks.criteria.push(entry);
    result.contextual_evidence.matched_criteria.push(entry.criterion_id);
  } else if (MISSING_VALUES.has(ukrainianVisaScheme)) {
    result.checks.criteria.push(
      check(
        'access_sheffield_ukrainian_visa_scheme',
        'Ukrainian visa scheme',
        'contextual_profile.personal_circumstances.ukrainian_visa_scheme',
        'missing',
        ukrainianVisaScheme
      )
    );
  }

  const fsm = evidence.financial_support?.free_school_meals;
  if (answerIsYes(fsm, normaliseId)) {
    const entry = check(
      'access_sheffield_free_school_meals',
      'Free school meals',
      'contextual_profile.financial_support.free_school_meals',
      'matched',
      fsm
    );
    result.qualifying_criteria.push(entry);
    result.checks.criteria.push(entry);
    result.contextual_evidence.matched_criteria.push(entry.criterion_id);
  }
}

function evaluateNamedProgrammes(evidence, result, normaliseId) {
  const accessMedicine = findOtherProgramme(
    evidence,
    [SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_PROGRAMME_ID],
    normaliseId
  );
  if (accessMedicine) {
    const status = programmeStatus(accessMedicine, normaliseId);
    const entry = check(
      'access_to_sheffield_medicine_programme',
      'Access to Sheffield (Medicine)',
      'contextual_profile.access_programmes.other_programmes',
      programmeCompletionConfirmed(status) ? 'matched' : 'needs_review',
      accessMedicine.programme_id,
      {
        programme_status: status || null,
        required_status: 'completed',
        ...(!programmeCompletionConfirmed(status) ? {
          reason: 'sheffield_access_to_sheffield_medicine_completion_required'
        } : {})
      }
    );
    if (programmeCompletionConfirmed(status)) {
      result.qualifying_criteria.push(entry);
      result.checks.programmes.push(entry);
      result.contextual_evidence.matched_programmes.push(SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_PROGRAMME_ID);
      result.activated_applicant_group_ids.push(SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID);
      result.activated_applicant_group_ids.push(SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_GROUP_ID);
    } else {
      result.missing_information.push(entry);
      result.checks.programmes.push(entry);
      if (recognisedProgrammeStatus(status)) {
        result.provisional_activated_applicant_group_ids.push(SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID);
      }
    }
  }

  const otherSheffieldWp = findOtherProgramme(
    evidence,
    [
      'sheffield_widening_access_programme',
      'sheffield_access_programme'
    ],
    normaliseId
  );
  if (otherSheffieldWp) {
    const status = programmeStatus(otherSheffieldWp, normaliseId);
    const entry = check(
      'other_sheffield_wp_programme',
      'Other qualifying University of Sheffield widening access programme',
      'contextual_profile.access_programmes.other_programmes',
      recognisedProgrammeStatus(status) ? 'matched' : 'needs_review',
      otherSheffieldWp.programme_id,
      { programme_status: status || null }
    );
    if (recognisedProgrammeStatus(status)) {
      result.qualifying_criteria.push(entry);
      result.checks.programmes.push(entry);
      result.contextual_evidence.matched_programmes.push(otherSheffieldWp.programme_id);
      result.activated_applicant_group_ids.push(SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID);
    } else {
      result.missing_information.push(entry);
      result.checks.programmes.push(entry);
    }
  }

  const realisingOpportunities = findOtherProgramme(evidence, ['realising_opportunities'], normaliseId);
  if (realisingOpportunities) {
    const status = programmeStatus(realisingOpportunities, normaliseId);
    const entry = check(
      'realising_opportunities_cohort_completion_unresolved',
      'Realising Opportunities cohort and completion timing require review',
      'contextual_profile.access_programmes.other_programmes',
      recognisedProgrammeStatus(status) ? 'needs_review' : 'missing',
      realisingOpportunities.programme_id,
      {
        programme_status: status || null,
        reason: 'ro_cohort_and_completion_year_not_represented_in_step_6'
      }
    );
    result.missing_information.push(entry);
    result.checks.programmes.push(entry);
    if (recognisedProgrammeStatus(status)) {
      result.provisional_activated_applicant_group_ids.push(SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID);
    }
  }

  const bradfordHallam = findOtherProgramme(
    evidence,
    [
      'sheffield_bradford_hallam_pathway',
      'bradford_clinical_sciences_b990',
      'bradford_foundation_clinical_sciences_b991',
      'sheffield_hallam_biomedical_science_a049',
      'sheffield_hallam_biomedical_sciences_b940'
    ],
    normaliseId
  );
  if (bradfordHallam) {
    const entry = check(
      'bradford_hallam_pathway_evidence_unresolved',
      'Bradford / Sheffield Hallam pathway evidence requires review',
      'contextual_profile.access_programmes.other_programmes',
      'needs_review',
      bradfordHallam.programme_id,
      { reason: 'pathway_marks_and_wp_criteria_not_fully_represented_in_step_6' }
    );
    result.missing_information.push(entry);
    result.checks.programmes.push(entry);
  }
}

function evaluateSheffieldContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();

  if (!isHomeFee(applicant, normaliseId)) {
    const entry = check(
      'home_fee_status',
      'Home fee status',
      'applicant_identity.fee_status',
      MISSING_VALUES.has(asObject(applicant.applicant_identity).fee_status) ? 'missing' : 'excluded',
      asObject(applicant.applicant_identity).fee_status,
      { reason: 'sheffield_contextual_home_fee_required_except_for_separate_forced_migrant_terms' }
    );
    if (entry.status === 'missing') {
      result.missing_information.push(entry);
      result.checks.scope.push(entry);
      return {
        ...result,
        status: 'information_needed',
        reason: 'sheffield_contextual_fee_status_missing',
        manual_review_reason: 'sheffield_contextual_fee_status_missing'
      };
    }
    if (hasForcedMigrantEvidence(evidence, normaliseId)) {
      result.missing_information.push(entry);
      result.checks.scope.push(entry);
      return {
        ...result,
        status: 'information_needed',
        reason: 'sheffield_forced_migrant_fee_terms_need_review',
        manual_review_reason: 'sheffield_forced_migrant_fee_terms_need_review'
      };
    }
    result.exclusions.push(entry);
    result.checks.scope.push(entry);
    return {
      ...result,
      status: 'not_applicable',
      reason: 'sheffield_contextual_home_fee_required'
    };
  }

  result.checks.scope.push(
    check('home_fee_status', 'Home fee status', 'applicant_identity.fee_status', 'matched', 'home')
  );

  evaluateAccessPlusCriteria(evidence, result, normaliseId);
  evaluateNamedProgrammes(evidence, result, normaliseId);

  if (result.qualifying_criteria.length > 0) {
    if (!result.activated_applicant_group_ids.includes(SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID)) {
      result.activated_applicant_group_ids.push(SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID);
    }
    return {
      ...result,
      status: 'contextual',
      reason: 'sheffield_contextual_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: 'access_sheffield_contextual_offer',
      matched_contextual_pathway_label: 'Access Sheffield contextual offer'
    };
  }

  if (result.missing_information.length > 0 || result.provisional_activated_applicant_group_ids.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'sheffield_contextual_evidence_needs_review',
      manual_review_reason: 'sheffield_contextual_evidence_needs_review'
    };
  }

  return result;
}

module.exports = {
  SHEFFIELD_CONTEXTUAL_EVALUATOR_ID,
  SHEFFIELD_CONTEXTUAL_OFFER_GROUP_ID,
  SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_GROUP_ID,
  SHEFFIELD_BRADFORD_HALLAM_PATHWAY_GROUP_ID,
  SHEFFIELD_ACCESS_TO_SHEFFIELD_MEDICINE_PROGRAMME_ID,
  evaluateSheffieldContextualEligibility
};
