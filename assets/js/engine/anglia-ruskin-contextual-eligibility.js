const ANGLIA_RUSKIN_CONTEXTUAL_EVALUATOR_ID = 'anglia_ruskin_contextual_medicine_a100';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function isLowArea(value, normaliseId) {
  const normalised = normaliseId(value);
  return Number(value) === 1 ||
    Number(value) === 2 ||
    ['q1', 'q2', 'quintile_1', 'quintile_2', 'bottom_20', 'bottom_20_percent'].includes(normalised);
}

function programmeCompleted(evidence, ids, normaliseId) {
  return asArray(evidence.access_programmes?.other_programmes).some((programme) => {
    const programmeId = normaliseId(programme.programme_id || programme.id || programme.name);
    const status = normaliseId(programme.status || programme.programme_status);
    return ids.includes(programmeId) && status === 'completed';
  });
}

function baselineMet(applicant, evidence, normaliseId) {
  const identity = applicant.applicant_identity || {};
  const personal = evidence.personal_circumstances || {};
  const applicantType = normaliseId(identity.applicant_type);
  const graduate = identity.graduate === true || applicantType.includes('graduate');
  const priorDegree = answerIsYes(personal.prior_degree_started, normaliseId) ||
    answerIsYes(personal.has_started_degree, normaliseId);
  const ukResidence = answerIsYes(personal.uk_indefinite_leave_or_settled_status, normaliseId) ||
    answerIsYes(personal.permanent_right_to_remain_in_uk, normaliseId) ||
    answerIsYes(personal.ordinarily_resident_uk_three_years, normaliseId) ||
    ['home', 'home_fee'].includes(normaliseId(identity.fee_status));
  return ukResidence && !graduate && !priorDegree;
}

function addCriterion(result, bucket, criterionId, label, evidencePath, actual) {
  const entry = { criterion_id: criterionId, label, status: 'matched', evidence_path: evidencePath, actual };
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.matched_criteria.push(criterionId);
}

function evaluateAngliaRuskinContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const personal = evidence.personal_circumstances || {};
  const school = evidence.school_education || {};
  const financial = evidence.financial_support || {};
  const home = evidence.home_area_region || {};
  const regionalFlags = home.regional_flags || {};
  const result = {
    status: 'not_contextual',
    reason: 'aru_wams_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      baseline: [],
      direct_wams: [],
      conditional_wams: [],
      regional: [],
      guaranteed_interview: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      matched_criteria: [],
      wams_baseline_met: false,
      guaranteed_interview_candidate: false,
      regional_uplift: null
    },
    source_ids: ['aru_medicine_2027', 'aru_medicine_how_to_apply']
  };

  const baseline = baselineMet(applicant, evidence, normaliseId);
  result.contextual_evidence.wams_baseline_met = baseline;
  result.checks.baseline.push({
    criterion_id: 'aru_wams_baseline',
    status: baseline ? 'matched' : 'not_matched',
    label: 'WAMS baseline'
  });
  if (!baseline) {
    result.exclusions.push({ criterion_id: 'aru_wams_baseline', reason: 'wams_baseline_not_met' });
  }

  const directCriteria = [
    ['aru_care_leaver_or_experienced', 'Care leaver / care experienced', answerIsYes(personal.care_leaver, normaliseId) || answerIsYes(personal.care_experienced, normaliseId) || answerIsYes(personal.care_over_three_months, normaliseId), 'contextual_profile.personal_circumstances.care_experienced'],
    ['aru_gcse_school_attainment_8_below_average', 'GCSE school Attainment 8 below national average', answerIsYes(school.gcse_school_attainment_8_below_national_average, normaliseId), 'contextual_profile.school_education.gcse_school_attainment_8_below_national_average'],
    ['aru_fsm_last_five_years', 'Free School Meals in the last five years', answerIsYes(financial.free_school_meals_last_five_years || financial.free_school_meals, normaliseId), 'contextual_profile.financial_support.free_school_meals_last_five_years']
  ];
  const directMatched = directCriteria.filter(([, , matched]) => matched);
  for (const [id, label, matched, path] of directCriteria) {
    if (matched) addCriterion(result, 'direct_wams', id, label, path, true);
  }

  const nonSelectiveStateSchool = answerIsYes(
    school.gcse_non_selective_state_school ||
      school.non_selective_state_school_for_gcse ||
      school.attended_non_selective_state_school_for_gcse,
    normaliseId
  );
  const conditionalCriteria = [
    ['aru_imd_bottom_20', 'IMD bottom 20% area', isLowArea(evidence.postcode_measures?.imd_quintile, normaliseId), 'contextual_profile.home_area_region.imd_quintile'],
    ['aru_pupil_premium_or_hardship', 'Pupil Premium or hardship payments', answerIsYes(financial.pupil_premium || financial.discretionary_hardship_payments, normaliseId), 'contextual_profile.financial_support.pupil_premium'],
    ['aru_means_tested_benefits', 'Means-tested benefits', answerIsYes(financial.means_tested_benefits, normaliseId), 'contextual_profile.financial_support.means_tested_benefits'],
    ['aru_carer', 'Young or sole unpaid carer', answerIsYes(personal.young_carer || personal.young_or_adult_carer || personal.sole_unpaid_carer, normaliseId), 'contextual_profile.personal_circumstances.young_carer'],
    ['aru_ucat_bursary', 'UCAT bursary', answerIsYes(financial.ucat_bursary_recipient, normaliseId), 'contextual_profile.financial_support.ucat_bursary_recipient'],
    ['aru_refugee', 'Refugee status', answerIsYes(personal.refugee || personal.uk_refugee_status_granted, normaliseId), 'contextual_profile.personal_circumstances.refugee'],
    ['aru_estranged', 'Estranged from family', answerIsYes(personal.estranged_from_family, normaliseId), 'contextual_profile.personal_circumstances.estranged_from_family'],
    ['aru_gtrsb', 'GTRSB community', answerIsYes(personal.gypsy_roma_traveller || personal.gtrsb, normaliseId), 'contextual_profile.personal_circumstances.gypsy_roma_traveller'],
    ['aru_service_child', 'Service child', answerIsYes(personal.service_child || personal.military_family, normaliseId), 'contextual_profile.personal_circumstances.service_child']
  ];
  const conditionalMatched = conditionalCriteria.filter(([, , matched]) => matched);
  if (nonSelectiveStateSchool) {
    for (const [id, label, matched, path] of conditionalCriteria) {
      if (matched) addCriterion(result, 'conditional_wams', id, label, path, true);
    }
  }

  const wamsConfirmed = baseline && (directMatched.length > 0 || (nonSelectiveStateSchool && conditionalMatched.length > 0));
  if (wamsConfirmed) {
    result.status = 'contextual';
    result.reason = 'aru_wams_confirmed';
    result.is_contextual = true;
    result.matched_contextual_pathway = 'aru_wams';
    result.matched_contextual_pathway_label = 'ARU WAMS';
    result.academic_contextual_level = 'wams_abb_a_level';
    result.contextual_offer = 'ABB for the A-level WAMS route';
    result.selection_adjustments = [
      {
        adjustment_id: 'aru_wams_ucat_uplift',
        type: 'ucat_percentage_uplift',
        value_percent: 5
      }
    ];
    result.activated_applicant_group_ids.push('contextual', 'widening_participation');
  }

  const essex = home.specific_home_area === 'essex' || answerIsYes(regionalFlags.essex_resident, normaliseId);
  const east = home.home_region === 'east_of_england' || answerIsYes(regionalFlags.east_of_england_resident, normaliseId);
  if (essex || east) {
    result.contextual_evidence.regional_uplift = essex ? 'essex_5_percent' : 'east_of_england_2_5_percent';
    result.checks.regional.push({
      criterion_id: essex ? 'aru_essex_regional_uplift' : 'aru_east_of_england_regional_uplift',
      status: 'matched',
      value_percent: essex ? 5 : 2.5
    });
  }

  const guaranteedByProgramme = programmeCompleted(
    evidence,
    ['aru_amplify_your_summer_medicine', 'amplify_your_summer_medicine', 'nextmedic'],
    normaliseId
  );
  const guaranteedByMarker =
    answerIsYes(financial.free_school_meals_last_five_years || financial.free_school_meals, normaliseId) ||
    answerIsYes(personal.care_leaver, normaliseId) ||
    answerIsYes(personal.care_experienced, normaliseId) ||
    guaranteedByProgramme;
  if (guaranteedByMarker) {
    result.contextual_evidence.guaranteed_interview_candidate = true;
    result.checks.guaranteed_interview.push({
      criterion_id: 'aru_guaranteed_interview_marker',
      status: 'matched',
      requires_academic_eligibility: true,
      requires_sjt_band_1_to_3: true
    });
  }

  return result;
}

module.exports = {
  ANGLIA_RUSKIN_CONTEXTUAL_EVALUATOR_ID,
  evaluateAngliaRuskinContextualEligibility
};
