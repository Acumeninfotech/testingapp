const LINCOLN_CONTEXTUAL_EVALUATOR_ID = 'lincoln_contextual_medicine_a100';

const MISSING = new Set(['', 'unknown', 'not_sure', 'prefer_not_to_say', null, undefined]);
const ACTIVE_PROGRAMME_STATUSES = new Set(['offered', 'participating', 'completed']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function yes(value, normaliseId) {
  return value === true || ['yes', 'true', 'confirmed', 'eligible'].includes(normaliseId(value));
}

function no(value, normaliseId) {
  return value === false || ['no', 'false', 'none', 'not_applicable'].includes(normaliseId(value));
}

function missing(value, normaliseId) {
  return MISSING.has(value) || MISSING.has(normaliseId(value));
}

function quintile(value, expected, normaliseId) {
  const id = normaliseId(value);
  return id === `q${expected}` || id === `quintile_${expected}` || id === String(expected);
}

function entry(criterionId, label, evidencePath, actual, normaliseId, matched = null) {
  const status = matched === true || (matched === null && yes(actual, normaliseId))
    ? 'matched'
    : missing(actual, normaliseId)
      ? 'missing'
      : 'not_matched';
  return { criterion_id: criterionId, label, evidence_path: evidencePath, status, actual };
}

function programmeEntry(evidence, normaliseId) {
  const programmes = asArray(asObject(evidence.access_programmes).other_programmes);
  const programme = programmes.find((candidate) => {
    return normaliseId(candidate?.programme_id) === 'lincoln_lms_wp_summer_school';
  });
  const status = normaliseId(programme?.status || programme?.participation_status);
  return {
    criterion_id: 'lincoln_lms_wp_summer_school',
    label: 'Lincoln Medical School widening-participation summer school',
    evidence_path: 'access_programmes.other_programmes',
    status: programme && ACTIVE_PROGRAMME_STATUSES.has(status) ? 'matched' : programme ? 'not_matched' : 'missing',
    actual: programme || null
  };
}

function evaluateLincolnContextualEligibility({ applicant, evidence, helpers }) {
  const financial = asObject(evidence.financial_support);
  const school = asObject(evidence.school_education);
  const personal = asObject(evidence.personal_circumstances);
  const postcode = asObject(evidence.postcode_measures);
  const home = asObject(evidence.home_area_region);
  const identity = asObject(applicant.applicant_identity);
  const normaliseId = helpers.normaliseId;

  const excludedDegreeApplicant = ['graduate', 'undergraduate'].includes(normaliseId(identity.applicant_type)) ||
    ['graduate', 'undergraduate'].includes(normaliseId(applicant.qualification_route));
  if (excludedDegreeApplicant) {
    return {
      status: 'not_contextual', reason: 'lincoln_contextual_not_applied_to_degree_applicant', is_contextual: false,
      qualifying_criteria: [], exclusions: ['degree_applicant'], missing_information: [],
      activated_applicant_group_ids: []
    };
  }

  const lincolnshire = entry('lincolnshire_residence', 'Lincolnshire residence',
    'home_area_region.specific_home_area', home.specific_home_area, normaliseId,
    normaliseId(home.specific_home_area) === 'lincolnshire');
  const offerChecks = [
    entry('free_school_meals', 'Free school meals', 'financial_support.free_school_meals', financial.free_school_meals, normaliseId),
    entry('disability', 'Disability or long-term condition', 'personal_circumstances.disability', personal.disability, normaliseId),
    entry('care_leaver', 'Care leaver', 'personal_circumstances.care_leaver', personal.care_leaver, normaliseId),
    entry('below_average_gcse_school', 'Below-average school performance', 'school_education.below_average_gcse_school', school.below_average_gcse_school, normaliseId),
    entry('below_average_post16_school', 'Below-average post-16 performance', 'school_education.below_average_post16_school', school.below_average_post16_school, normaliseId),
    entry('low_progression_school', 'Low school progression to higher education', 'school_education.low_progression_to_higher_education_school', school.low_progression_to_higher_education_school, normaliseId),
    entry('postcode_disadvantage', 'Low-participation or high-deprivation postcode', 'postcode_measures',
      { polar4_quintile: postcode.polar4_quintile, imd_quintile: postcode.imd_quintile }, normaliseId,
      [postcode.polar4_quintile, postcode.imd_quintile].some((value) => quintile(value, 1, normaliseId) || quintile(value, 2, normaliseId))),
    lincolnshire
  ];
  const offerEligible = offerChecks.some((candidate) => candidate.status === 'matched');

  const mem = postcode.mem_quintile;
  const scoringChecks = [
    entry('lincoln_care_leaver', 'Care leaver', 'personal_circumstances.care_leaver', personal.care_leaver, normaliseId),
    entry('lincoln_refugee', 'Refugee status', 'personal_circumstances.refugee', personal.refugee, normaliseId),
    entry('lincoln_mem2_q1', 'MEM2 quintile 1', 'postcode_measures.mem_quintile', mem, normaliseId, quintile(mem, 1, normaliseId)),
    entry('lincoln_mem2_q2', 'MEM2 quintile 2', 'postcode_measures.mem_quintile', mem, normaliseId, quintile(mem, 2, normaliseId)),
    entry('lincoln_ucat_bursary', 'UCAT bursary', 'financial_support.ucat_bursary_recipient', financial.ucat_bursary_recipient, normaliseId),
    programmeEntry(evidence, normaliseId),
    lincolnshire
  ];
  const matchedScores = scoringChecks.filter((candidate) => candidate.status === 'matched');

  if (!offerEligible) {
    return {
      status: 'not_contextual',
      reason: 'lincoln_contextual_offer_criteria_not_met',
      manual_review_reason: null,
      is_contextual: false, qualifying_criteria: [], exclusions: [], missing_information: [],
      checks: { contextual_offer: offerChecks, scoring: scoringChecks }, activated_applicant_group_ids: []
    };
  }

  const activated = ['contextual', 'widening_participation', ...matchedScores.map((candidate) => candidate.criterion_id)];
  return {
    status: 'contextual', reason: 'lincoln_contextual_offer_eligible', is_contextual: true,
    matched_contextual_pathway: 'lincoln_contextual_a100',
    matched_contextual_pathway_label: 'Lincoln contextual A100',
    academic_contextual_level: 'contextual_aab', standard_offer: 'AAA', contextual_offer: 'AAB',
    qualifying_criteria: [...offerChecks.filter((candidate) => candidate.status === 'matched'), ...matchedScores],
    exclusions: [], missing_information: [], checks: { contextual_offer: offerChecks, scoring: scoringChecks },
    activated_applicant_group_ids: [...new Set(activated)]
  };
}

module.exports = { LINCOLN_CONTEXTUAL_EVALUATOR_ID, evaluateLincolnContextualEligibility };
