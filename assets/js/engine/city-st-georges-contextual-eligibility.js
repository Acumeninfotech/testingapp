const CITY_ST_GEORGES_CONTEXTUAL_EVALUATOR_ID = 'city_st_georges_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'eligible'].includes(normaliseId(value));
}

function lowPolar(value, normaliseId) {
  const normalised = normaliseId(value);
  return Number(value) === 1 ||
    Number(value) === 2 ||
    ['q1', 'q2', 'quintile_1', 'quintile_2'].includes(normalised);
}

function lowImdDecile(value, normaliseId) {
  const normalised = normaliseId(value);
  return Number(value) === 1 ||
    Number(value) === 2 ||
    ['d1', 'd2', 'decile_1', 'decile_2'].includes(normalised);
}

function addCheck(result, bucket, criterionId, label, status, evidencePath, actual) {
  const entry = { criterion_id: criterionId, label, status, evidence_path: evidencePath, actual };
  result.checks[bucket].push(entry);
  if (status === 'matched') {
    result.qualifying_criteria.push(entry);
  }
  return entry;
}

function evaluateCityStGeorgesContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = applicant.applicant_identity || {};
  const personal = evidence.personal_circumstances || {};
  const school = evidence.school_education || {};
  const financial = evidence.financial_support || {};
  const profileHome = evidence.profile?.home_area_region || {};
  const result = {
    status: 'not_contextual',
    reason: 'city_st_georges_contextual_offer_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      group_1: [],
      group_2: [],
      group_3: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      group_1_count: 0,
      group_2_count: 0,
      group_3_count: 0
    },
    source_ids: ['city_st_georges_contextual_admissions_policy']
  };

  const feeStatus = normaliseId(identity.fee_status);
  const applicantType = normaliseId(identity.applicant_type);
  const graduate = identity.graduate === true || applicantType.includes('graduate');
  if (!(feeStatus.includes('home') || feeStatus === 'ruk' || feeStatus === 'rest_of_uk')) {
    result.exclusions.push({ criterion_id: 'non_uk_or_non_home_scope', reason: 'city_st_georges_contextual_uk_undergraduate_scope' });
    return result;
  }
  if (graduate) {
    result.exclusions.push({ criterion_id: 'graduate_applicant', reason: 'city_st_georges_contextual_excludes_existing_graduates' });
    return result;
  }
  result.checks.scope.push({ criterion_id: 'uk_undergraduate_scope', status: 'matched' });

  const group1 = [
    ['care_experienced_or_leaver', 'Care experienced / care leaver', ['care_experienced', 'care_leaver', 'care_over_three_months']],
    ['young_carer', 'Young carer', ['young_carer', 'young_or_adult_carer']],
    ['refugee_or_asylum', 'Refugee or asylum seeker', ['refugee', 'uk_refugee_status_granted', 'seeking_asylum']],
    ['estranged_student', 'Estranged student', ['estranged_from_family']]
  ];
  for (const [id, label, keys] of group1) {
    const matchedKey = keys.find((key) => answerIsYes(personal[key], normaliseId));
    if (matchedKey) {
      addCheck(result, 'group_1', `city_group_1_${id}`, label, 'matched', `contextual_profile.personal_circumstances.${matchedKey}`, personal[matchedKey]);
    }
  }

  const group2Checks = [
    ['english_school_average_c_minus_or_below', 'English school average A-level grade C- or below', school.average_a_level_grade_c_minus_or_below],
    ['english_school_bottom_40_he_progression', 'English school bottom 40% HE progression', school.bottom_40_percent_he_progression],
    ['polar4_q1_2', 'POLAR4 quintile 1 or 2', lowPolar(evidence.postcode_measures?.polar4_quintile, normaliseId)],
    ['imd_decile_1_2', 'IMD decile 1 or 2', lowImdDecile(profileHome.imd_decile ?? profileHome.imd_decile_2019, normaliseId)],
    ['free_school_meals', 'Free School Meals', financial.free_school_meals]
  ];
  for (const [id, label, value] of group2Checks) {
    const matched = typeof value === 'boolean' ? value : answerIsYes(value, normaliseId);
    if (matched) {
      addCheck(result, 'group_2', `city_group_2_${id}`, label, 'matched', 'contextual_profile', value);
    } else if (MISSING_VALUES.has(value)) {
      result.checks.group_2.push({ criterion_id: `city_group_2_${id}`, label, status: 'missing', actual: value });
    }
  }

  const group3 = [
    ['service_child', 'Service child', personal.service_child || personal.military_family],
    ['grt_community', 'Gypsy, Roma or Traveller community', personal.gypsy_roma_traveller || personal.gtrsb],
    ['mature_non_graduate', 'Mature non-graduate applicant aged 21+', identity.age_at_course_start_band === 'age_21_or_over' || applicantType.includes('mature')]
  ];
  for (const [id, label, value] of group3) {
    if (typeof value === 'boolean' ? value : answerIsYes(value, normaliseId)) {
      addCheck(result, 'group_3', `city_group_3_${id}`, label, 'matched', 'contextual_profile.personal_circumstances', value);
    }
  }

  result.contextual_evidence.group_1_count = result.checks.group_1.filter((entry) => entry.status === 'matched').length;
  result.contextual_evidence.group_2_count = result.checks.group_2.filter((entry) => entry.status === 'matched').length;
  result.contextual_evidence.group_3_count = result.checks.group_3.filter((entry) => entry.status === 'matched').length;

  if (result.contextual_evidence.group_1_count >= 1 || result.contextual_evidence.group_2_count >= 2) {
    result.status = 'contextual';
    result.reason = result.contextual_evidence.group_1_count >= 1
      ? 'city_st_georges_group_1_contextual_offer_confirmed'
      : 'city_st_georges_group_2_contextual_offer_confirmed';
    result.is_contextual = true;
    result.matched_contextual_pathway = result.contextual_evidence.group_1_count >= 1
      ? 'city_st_georges_group_1_contextual_offer'
      : 'city_st_georges_group_2_contextual_offer';
    result.matched_contextual_pathway_label = 'City St George\'s contextual offer';
    result.academic_contextual_level = 'two_grade_reduction';
    result.contextual_offer = 'up to two grades below the standard offer';
    result.activated_applicant_group_ids.push('contextual', 'widening_participation');
  } else if (result.contextual_evidence.group_3_count >= 1) {
    result.reason = 'city_st_georges_group_3_support_only';
    result.matched_contextual_pathway = 'city_st_georges_group_3_support_only';
    result.matched_contextual_pathway_label = 'City St George\'s support-only group';
    result.contextual_support_only = true;
  }

  return result;
}

module.exports = {
  CITY_ST_GEORGES_CONTEXTUAL_EVALUATOR_ID,
  evaluateCityStGeorgesContextualEligibility
};
