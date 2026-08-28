const CAMBRIDGE_CONTEXTUAL_EVALUATOR_ID = 'cambridge_contextual_medicine_a100';

const UNKNOWN_VALUES = new Set([
  'unknown',
  'not_sure',
  'prefer_not_to_say'
]);

function normalise(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isYes(value) {
  return value === true || ['yes', 'true', 'confirmed'].includes(normalise(value));
}

function isUnknown(value) {
  return UNKNOWN_VALUES.has(normalise(value));
}

function bottom40Indicator(value) {
  const normalised = normalise(value);
  if (['q1', 'q2'].includes(normalised)) return true;
  if (UNKNOWN_VALUES.has(normalised)) return normalised;
  return false;
}

function feeStatus(applicant = {}) {
  return normalise(
    applicant.applicant_identity?.fee_status ||
    applicant.fee_status ||
    applicant.applicant_context?.fee_status
  );
}

function explicitContextualValue(applicant = {}, path = []) {
  return path.reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, applicant.contextual_profile);
}

function evaluateCambridgeContextualEligibility({ applicant, evidence }) {
  if (![
    'home',
    'home_fee',
    'rest_of_uk',
    'rest_of_uk_roi_fee_rate',
    'uk',
    'united_kingdom'
  ].includes(feeStatus(applicant))) {
    return {
      status: 'not_contextual',
      reason: 'cambridge_contextual_consideration_home_applicants_only',
      is_contextual: false,
      qualifying_criteria: [],
      missing_information: [],
      activated_applicant_group_ids: []
    };
  }

  const financial = evidence.financial_support || {};
  const school = evidence.school_education || {};
  const personal = evidence.personal_circumstances || {};
  const postcode = evidence.postcode_measures || {};

  const criteria = [
    ['free_school_meals', financial.free_school_meals,
      explicitContextualValue(applicant, ['financial_support', 'free_school_meals'])],
    ['care_experience', personal.care_experienced,
      explicitContextualValue(applicant, ['personal_circumstances', 'care_experienced'])],
    ['young_or_adult_carer', personal.young_or_adult_carer,
      explicitContextualValue(applicant, ['personal_circumstances', 'young_or_adult_carer'])],
    ['first_in_family_at_university', personal.first_in_family_at_university,
      explicitContextualValue(applicant, ['personal_circumstances', 'first_in_family_at_university'])],
    ['below_average_gcse_school', school.below_average_gcse_school,
      explicitContextualValue(applicant, ['school_education', 'below_average_gcse_school'])],
    ['below_average_post16_school', school.below_average_post16_school,
      explicitContextualValue(applicant, ['school_education', 'below_average_post16_school'])],
    ['polar4_bottom_40_percent', bottom40Indicator(postcode.polar4_quintile)],
    ['tundra_bottom_40_percent', bottom40Indicator(postcode.tundra_quintile)],
    ['imd_bottom_40_percent', bottom40Indicator(postcode.imd_quintile)]
  ];

  const qualifyingCriteria = criteria
    .filter(([, value]) => isYes(value))
    .map(([criterionId]) => criterionId);

  if (qualifyingCriteria.length > 0) {
    return {
      status: 'contextual',
      reason: 'cambridge_contextual_information_confirmed',
      is_contextual: true,
      qualifying_criteria: qualifyingCriteria,
      missing_information: [],
      activated_applicant_group_ids: ['contextual']
    };
  }

  const missingInformation = criteria
    .filter(([, , explicitValue]) => isUnknown(explicitValue))
    .map(([criterionId]) => criterionId);

  if (missingInformation.length > 0) {
    return {
      status: 'information_needed',
      reason: 'cambridge_contextual_information_incomplete',
      is_contextual: false,
      qualifying_criteria: [],
      missing_information: missingInformation,
      activated_applicant_group_ids: []
    };
  }

  return {
    status: 'not_contextual',
    reason: 'cambridge_contextual_information_not_confirmed',
    is_contextual: false,
    qualifying_criteria: [],
    missing_information: [],
    activated_applicant_group_ids: []
  };
}

module.exports = {
  CAMBRIDGE_CONTEXTUAL_EVALUATOR_ID,
  evaluateCambridgeContextualEligibility
};
