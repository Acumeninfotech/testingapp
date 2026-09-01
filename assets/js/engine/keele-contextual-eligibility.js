const KEELE_CONTEXTUAL_EVALUATOR_ID = 'keele_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible', 'granted'].includes(normaliseId(value));
}

function valueIsLowQuintile(value, normaliseId) {
  const normalised = normaliseId(value);
  return Number(value) === 1 ||
    Number(value) === 2 ||
    ['q1', 'q2', 'quintile_1', 'quintile_2'].includes(normalised);
}

function isHomeFee(applicant, normaliseId) {
  const feeStatus = normaliseId(asObject(applicant.applicant_identity).fee_status);
  return feeStatus.includes('home') || ['ruk', 'rest_of_uk'].includes(feeStatus);
}

function hasStateSchoolEvidence(school = {}, normaliseId) {
  const independent = school.current_or_most_recent_uk_school_independent_fee_paying;
  if (answerIsYes(independent, normaliseId)) {
    return false;
  }
  const stateSchool = normaliseId(
    school.current_or_most_recent_school_type ||
      school.post16_school_type ||
      school.school_type
  );
  return independent === false ||
    normaliseId(independent) === 'no' ||
    ['state_school', 'state', 'academy', 'college', 'state_college'].includes(stateSchool);
}

function programmeMatches(programme, ids, normaliseId) {
  return ids.includes(normaliseId(programme.programme_id || programme.id || programme.name));
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'keele_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      criteria: [],
      separate_schemes: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      matched_criteria: [],
      separate_scheme_matches: []
    },
    source_ids: ['keele_contextual_and_alternative_offers_2027']
  };
}

function addMatch(result, bucket, criterionId, label, evidencePath, actual, extra = {}) {
  const entry = {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status: 'matched',
    actual,
    ...extra
  };
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.matched_criteria.push(criterionId);
}

function addMissing(result, bucket, criterionId, label, evidencePath, actual) {
  const entry = {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status: 'missing',
    actual
  };
  result.missing_information.push(entry);
  result.checks[bucket].push(entry);
}

function evaluateKeeleContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const school = evidence.school_education || {};
  const personal = evidence.personal_circumstances || {};
  const financial = evidence.financial_support || {};
  const home = evidence.postcode_measures || {};

  if (!isHomeFee(applicant, normaliseId)) {
    result.status = 'not_contextual';
    result.reason = 'keele_contextual_home_applicants_only';
    result.exclusions.push({ criterion_id: 'non_home_fee', reason: result.reason });
    return result;
  }

  const stateSchool = hasStateSchoolEvidence(school, normaliseId);
  if (stateSchool && valueIsLowQuintile(home.polar4_quintile, normaliseId)) {
    addMatch(result, 'criteria', 'keele_state_school_polar4_q1_2', 'State school and POLAR4 quintile 1 or 2', 'contextual_profile.home_area_region.polar4_quintile', home.polar4_quintile);
  }
  if (stateSchool && valueIsLowQuintile(home.imd_quintile, normaliseId)) {
    addMatch(result, 'criteria', 'keele_state_school_imd_q1_2', 'State school and IMD quintile 1 or 2', 'contextual_profile.home_area_region.imd_quintile', home.imd_quintile);
  }

  const personalCriteria = [
    ['keele_care_leaver', 'Care leaver or care experienced', ['care_leaver', 'care_experienced', 'care_over_three_months']],
    ['keele_refugee_asylum_humanitarian', 'Refugee, asylum seeker or humanitarian protection', ['refugee', 'uk_refugee_status_granted', 'seeking_asylum', 'humanitarian_protection']],
    ['keele_young_carer', 'Young carer', ['young_carer', 'young_or_adult_carer']],
    ['keele_first_generation_he', 'First generation to higher education', ['first_in_family_at_university', 'first_generation_higher_education']],
    ['keele_armed_forces', 'Applicant or parent Armed Forces criterion', ['service_child', 'armed_forces_family', 'military_family', 'service_leaver', 'armed_forces_service']]
  ];
  for (const [criterionId, label, keys] of personalCriteria) {
    const matchedKey = keys.find((key) => answerIsYes(personal[key], normaliseId));
    if (matchedKey) {
      addMatch(result, 'criteria', criterionId, label, `contextual_profile.personal_circumstances.${matchedKey}`, personal[matchedKey]);
    }
  }

  if (answerIsYes(financial.free_school_meals, normaliseId)) {
    addMatch(result, 'criteria', 'keele_free_school_meals', 'Free School Meals', 'contextual_profile.financial_support.free_school_meals', financial.free_school_meals);
  }

  if (result.qualifying_criteria.length > 0) {
    result.status = 'contextual';
    result.reason = 'keele_one_contextual_indicator_confirmed';
    result.is_contextual = true;
    result.matched_contextual_pathway = 'keele_ordinary_contextual';
    result.matched_contextual_pathway_label = 'Keele ordinary contextual offer';
    result.academic_contextual_level = 'one_grade_reduction';
    result.contextual_offer = 'one full grade reduction';
    result.selection_adjustments = [
      {
        adjustment_id: 'keele_contextual_shortlisting_point',
        type: 'shortlisting_point',
        value: 1
      }
    ];
    result.activated_applicant_group_ids.push('contextual', 'widening_participation');
  }

  const access = evidence.access_programmes || {};
  const ukwpmedStatus = normaliseId(access.ukwpmed?.programme_status || access.ukwpmed?.status);
  if (
    programmeMatches(access.ukwpmed || {}, ['steps2medicine', 'keele_steps2medicine'], normaliseId) ||
    ukwpmedStatus === 'completed'
  ) {
    result.checks.separate_schemes.push({
      criterion_id: 'keele_steps2medicine_or_ukwpmed',
      label: 'Steps2Medicine / UKWPMED',
      status: ukwpmedStatus === 'completed' ? 'matched' : 'needs_review',
      evidence_path: 'contextual_profile.access_programmes.ukwpmed',
      programme_status: ukwpmedStatus || null
    });
    result.contextual_evidence.separate_scheme_matches.push('keele_steps2medicine_or_ukwpmed');
  }

  const regionalFlags = asObject(evidence.home_area_region?.regional_flags);
  if (
    evidence.home_area_region?.school_area === 'keele_region_school' ||
    answerIsYes(regionalFlags.keele_region_school, normaliseId)
  ) {
    result.checks.separate_schemes.push({
      criterion_id: 'keele_region',
      label: 'Keele Region',
      status: 'matched',
      evidence_path: 'contextual_profile.home_area_region.school_area',
      adjustment: '+1 UCAT-grade shortlisting point'
    });
    result.contextual_evidence.separate_scheme_matches.push('keele_region');
  }
  if (answerIsYes(financial.ucat_bursary_recipient, normaliseId)) {
    result.checks.separate_schemes.push({
      criterion_id: 'keele_ucat_bursary',
      label: 'UCAT bursary',
      status: 'matched',
      evidence_path: 'contextual_profile.financial_support.ucat_bursary_recipient',
      adjustment: '+1 UCAT-grade shortlisting point'
    });
    result.contextual_evidence.separate_scheme_matches.push('keele_ucat_bursary');
  }

  if (
    !result.is_contextual &&
    (valueIsLowQuintile(home.polar4_quintile, normaliseId) || valueIsLowQuintile(home.imd_quintile, normaliseId)) &&
    !stateSchool &&
    MISSING_VALUES.has(school.current_or_most_recent_uk_school_independent_fee_paying)
  ) {
    addMissing(result, 'criteria', 'keele_state_school_low_area_unresolved', 'State-school plus low-area evidence', 'contextual_profile.school_education.current_or_most_recent_uk_school_independent_fee_paying');
    result.status = 'information_needed';
    result.reason = 'keele_contextual_information_needed';
    result.manual_review_reason = 'keele_contextual_information_needed';
  }

  return result;
}

module.exports = {
  KEELE_CONTEXTUAL_EVALUATOR_ID,
  evaluateKeeleContextualEligibility
};
