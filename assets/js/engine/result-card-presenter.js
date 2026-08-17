// The single authoritative canonical band -> public label mapping. Every
// other map in this file (headlines, official-prediction-unavailable
// wording, decision-timeline status text) derives its short label from
// this so the same band always shows the same public wording everywhere.
// Internal canonical band IDs (the object keys) must never be renamed or
// shown to users - only the values here are public-facing.
const CANONICAL_BAND_LABELS = {
  very_strong_interview_potential: 'Very Strong Choice',
  interview_likely: 'Strong Choice',
  realistic: 'Realistic Choice',
  ambitious: 'Ambitious Choice',
  high_risk: 'High Risk'
};

const STANDARD_RECOMMENDATION_HEADLINES = {
  very_strong_interview_potential: 'Very strong choice for your application',
  interview_likely: 'Strong choice for your application',
  realistic: 'Possible choice for your application',
  ambitious: 'More cautious choice for your application',
  high_risk: 'More cautious choice for your application',
  eligible_to_apply: 'Entry requirements met',
  not_eligible: 'Not currently eligible',
  manual_review: 'More information is required',
  insufficient_evidence: 'More information is required',
  guaranteed_interview: 'Interview guaranteed under the published criteria'
};

const LANCASTER_CONTEXTUAL_CONFIRMATION = {
  collapsed_label: 'Contextual eligibility confirmed',
  expanded_heading: 'Contextual eligibility confirmed',
  consideration_label: 'Contextual consideration:',
  expanded_body:
    'Your contextual status may be considered during UCAT interview shortlisting. If successful at interview, you may be considered for a contextual offer of ABB.',
  contextual_offer_grade: 'ABB'
};

const LIVERPOOL_CONTEXTUAL_CONFIRMATION = {
  collapsed_label: 'Contextual eligibility confirmed',
  expanded_heading: 'Contextual eligibility confirmed',
  consideration_label: 'Liverpool contextual consideration:',
  expanded_body:
    'Contextual eligibility means additional consideration for Liverpool Medicine A100. It does not guarantee an interview, offer or reduced A-level offer.'
};

const LANCASTER_ACCESS_TO_MEDICINE_WP_REVIEW_REASON =
  "Lancaster Access to Medicine completion confirmed. More information is needed to verify Lancaster's widening-participation criteria before the guaranteed-interview route can be confirmed.";

const ABERDEEN_REACH_CONTEXTUAL_CONFIRMATION =
  'Contextual/Widening Access confirmed: Reach Program Scotland.';

const ABERDEEN_REACH_CONTEXTUAL_REVIEW_REASON =
  'Further evidence or review is needed to confirm Aberdeen Reach Program Scotland widening-access eligibility.';

const GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON =
  'Successful completion of Reach is required to confirm the Glasgow adjusted/contextual route.';
const GLASGOW_SCOTLAND_HOME_UCAT_PREDICTION_CAVEAT =
  'This prediction band is ApplySmart-derived guidance, not a Glasgow-published current 2027 cutoff; it does not guarantee an interview.';
const GLASGOW_RUK_UCAT_PREDICTION_CAVEAT =
  'This prediction band is ApplySmart-derived guidance informed by Glasgow historical RUK evidence; it is not a Glasgow-published current 2027 cutoff and does not guarantee an interview.';

const {
  isRestOfUkFeeStatus
} = require('./applicant-group-normalisation');

const STANDARD_RECOMMENDATIONS = {
  very_strong_interview_potential: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.very_strong_interview_potential,
    recommendation: CANONICAL_BAND_LABELS.very_strong_interview_potential,
    explanation: "ApplySmart's evidence-based analysis places this selection score well above the historical interview benchmark available for this applicant group."
  },
  interview_likely: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.interview_likely,
    recommendation: CANONICAL_BAND_LABELS.interview_likely,
    explanation: "ApplySmart's evidence-based analysis places this selection score above the historical interview benchmark available for this applicant group."
  },
  realistic: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.realistic,
    recommendation: CANONICAL_BAND_LABELS.realistic,
    explanation: "ApplySmart's evidence-based analysis places this selection score in line with the historical interview benchmark available for this applicant group."
  },
  ambitious: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.ambitious,
    recommendation: CANONICAL_BAND_LABELS.ambitious,
    explanation: "ApplySmart's evidence-based analysis places this selection score slightly below the historical interview benchmark available for this applicant group."
  },
  high_risk: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.high_risk,
    recommendation: CANONICAL_BAND_LABELS.high_risk,
    explanation: "ApplySmart's evidence-based analysis places this selection score below the historical interview benchmark available for this applicant group."
  }
};

const UCAT_RANKING_RECOMMENDATIONS = {
  very_strong_interview_potential: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.very_strong_interview_potential,
    recommendation: CANONICAL_BAND_LABELS.very_strong_interview_potential,
    position: 'above'
  },
  interview_likely: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.interview_likely,
    recommendation: CANONICAL_BAND_LABELS.interview_likely,
    position: 'above'
  },
  realistic: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.realistic,
    recommendation: CANONICAL_BAND_LABELS.realistic,
    position: 'within'
  },
  ambitious: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.ambitious,
    recommendation: CANONICAL_BAND_LABELS.ambitious,
    position: 'slightly below'
  },
  high_risk: {
    headline: STANDARD_RECOMMENDATION_HEADLINES.high_risk,
    recommendation: CANONICAL_BAND_LABELS.high_risk,
    position: 'below'
  }
};

const HISTORICAL_GUIDANCE_CAVEAT =
  'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.';

const ELIGIBILITY_ONLY_SELECTION_SUMMARY =
  'This result confirms eligibility only. It does not include an interview competitiveness prediction.';

const OFFICIAL_UNAVAILABLE_TRUST_STATEMENT =
  'ApplySmart does not alter university requirements or present unofficial information as an official rule. Predictions are generated only after applying the published university criteria and analysing the available admissions evidence.';

const GENERIC_MANUAL_REVIEW_EXPLANATION =
  'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.';

const GENERIC_INSUFFICIENT_EVIDENCE_EXPLANATION =
  'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.';

const EVIDENCE = {
  standard: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data'
  ],
  contextual: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data',
    'Contextual admissions policy'
  ],
  international: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data',
    'International admissions policy'
  ],
  foiInternational: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data',
    'FOI evidence',
    'International admissions policy'
  ],
  eligibilityOnly: [
    'Official admissions policy',
    'University selection process',
    'Fee information',
    'Documented prediction limitation'
  ]
};

function mergePresentations(...presentations) {
  return presentations.reduce((merged, presentation) => {
    if (!presentation || typeof presentation !== 'object') {
      return merged;
    }
    return { ...merged, ...presentation };
  }, {});
}

function configuredPresentation(card = {}, options = {}) {
  return mergePresentations(
    card.stage_2_selection?.presentation,
    card.score_model?.presentation,
    card.guidance_pool?.presentation,
    options.scoreModel?.presentation,
    options.guidancePool?.presentation
  );
}

function hideSelectionScoreDetails(presentation = {}) {
  return presentation.hide_selection_score_details === true ||
    presentation.hide_score_breakdown === true;
}

function reasonScopedPresentationValue(presentation = {}, field, reasonCode) {
  const values = presentation[field];
  if (!reasonCode || !values || typeof values !== 'object') {
    return null;
  }
  return values[reasonCode] || null;
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || null;
}

function smallNumberWord(value) {
  const words = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten'
  };
  return Object.prototype.hasOwnProperty.call(words, value) ? words[value] : String(value);
}

function isApplicantInformationReasonCode(reasonCode) {
  return Boolean(reasonCode) &&
    reasonCode !== 'university_methodology_gap' &&
    reasonCode !== 'prediction_calibration_unavailable' &&
    reasonCode !== 'academic_matrix_band_unavailable' &&
    !/historical_evidence_gap/.test(String(reasonCode));
}

function check(label, status, summary) {
  return { label, status, summary };
}

const ACADEMIC_REQUIREMENT_LABELS = {
  gcse: 'GCSEs',
  a_level: 'A-levels',
  ib: 'IB',
  scottish: 'Scottish Highers',
  graduate: 'Graduate Entry'
};

const ACADEMIC_REQUIREMENT_STATUS_PRIORITY = {
  met: 1,
  information_needed: 2,
  not_met: 3
};

function normaliseCheckId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function academicQualificationTypeForCheck(rawCheck) {
  const checkId = normaliseCheckId(
    rawCheck?.check_id ||
    rawCheck?.check ||
    rawCheck?.requirement_id
  );
  if (!checkId) {
    return null;
  }

  if (
    checkId.startsWith('gcse_') ||
    checkId.startsWith('minimum_gcse_') ||
    checkId.startsWith('required_gcse_') ||
    checkId.includes('_gcse_') ||
    checkId.endsWith('_gcse')
  ) {
    return 'gcse';
  }
  if (
    checkId.startsWith('a_level_') ||
    checkId.includes('_a_level_') ||
    checkId.includes('_a_level') ||
    checkId.includes('a_levels') ||
    checkId.includes('alevel') ||
    checkId.includes('epq_alternative') ||
    checkId === 'same_sitting_requirement'
  ) {
    return 'a_level';
  }
  if (
    checkId.startsWith('ib_') ||
    checkId.includes('_ib_') ||
    checkId.startsWith('international_baccalaureate_') ||
    checkId.includes('_international_baccalaureate_')
  ) {
    return 'ib';
  }
  if (
    checkId.startsWith('scottish_') ||
    checkId.includes('_scottish_') ||
    checkId.startsWith('national_5_') ||
    checkId.includes('_national_5_') ||
    checkId.includes('higher_requirements') ||
    checkId.includes('highers')
  ) {
    return 'scottish';
  }
  if (
    checkId.startsWith('graduate_') ||
    checkId.includes('_graduate_') ||
    checkId.startsWith('degree_') ||
    checkId.includes('_degree_')
  ) {
    return 'graduate';
  }

  return null;
}

function academicRequirementCheckId(rawCheck) {
  return normaliseCheckId(
    rawCheck?.check_id ||
    rawCheck?.check ||
    rawCheck?.requirement_id
  );
}

function isDundeeAlevelAcademicContext(context = {}) {
  const profileId = context.course_profile_id || context.course_identity?.profile_id || null;
  if (profileId !== 'dundee-a100') {
    return false;
  }

  const applicant = context.applicant_context || context.applicantContext || {};
  const qualificationRoute = normaliseCheckId(
    context.qualification_route ||
    applicant.qualification_route ||
    applicant.entry_route ||
    applicant.course_target?.entry_route ||
    ''
  );
  return qualificationRoute.includes('a_level') || qualificationRoute.includes('alevel');
}

function academicPresentationQualificationTypeForCheck(rawCheck, qualificationType, context = {}) {
  const checkId = academicRequirementCheckId(rawCheck);
  if (
    isDundeeAlevelAcademicContext(context) &&
    qualificationType === 'scottish' &&
    (checkId === 'national_5_requirements' || checkId.includes('national_5'))
  ) {
    return 'gcse';
  }
  return qualificationType;
}

function humanSubjectLabel(subjectId) {
  return String(subjectId || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function academicRequirementLabelForCheck(rawCheck, qualificationType, context = {}) {
  const checkId = academicRequirementCheckId(rawCheck);
  const status = normaliseCheckId(context.academic_requirement_status);
  const firstSubject =
    rawCheck?.subject_id ||
    rawCheck?.required_subject_id ||
    rawCheck?.applicable_subject_ids?.[0] ||
    rawCheck?.failed_subject_ids?.[0] ||
    rawCheck?.missing_subject_ids?.[0] ||
    rawCheck?.unknown_subject_ids?.[0];
  const dundeeAlevelContext = isDundeeAlevelAcademicContext(context);

  if (checkId === 'same_sitting_requirement') {
    return 'Same-sitting requirement';
  }
  if (checkId === 'a_level_science_practical_endorsement') {
    return 'Science practical endorsement';
  }
  if (checkId === 'a_level_subject_combination') {
    return 'Required A-level subjects';
  }
  if (checkId === 'epq_alternative_offer') {
    return 'A-levels + EPQ';
  }
  if (checkId === 'a_level_contextual_epq_alternative') {
    return 'Contextual A-levels + EPQ';
  }
  if (checkId === 'a_level_epq_alternative') {
    return 'A-levels + EPQ';
  }
  if (checkId === 'a_level_contextual_offer') {
    return 'Contextual A-level grades';
  }
  const evaluatedRequirementIds = [
    ...(rawCheck?.evaluated_requirement_ids || []),
    ...(rawCheck?.failed_requirement_ids || [])
  ].map(normaliseCheckId);
  if (dundeeAlevelContext && qualificationType === 'a_level' && status === 'met') {
    return 'A-level requirements';
  }
  if (dundeeAlevelContext && qualificationType === 'gcse') {
    if (status === 'met') {
      return 'GCSE requirements';
    }
    if (checkId.includes('english_language') || checkId.includes('english')) {
      return 'GCSE English Language';
    }
    if (checkId.includes('mathematics') || checkId.includes('maths')) {
      return 'GCSE Mathematics';
    }
    if (firstSubject) {
      return `GCSE ${humanSubjectLabel(firstSubject)}`;
    }
    return 'GCSE requirements';
  }
  if (
    checkId === 'national_5_requirements' &&
    evaluatedRequirementIds.includes('national_5_english_minimum')
  ) {
    return 'National 5 English at grade B';
  }
  if (
    context.course_profile_id === 'glasgow-a100' &&
    qualificationType === 'gcse' &&
    checkId === 'gcse_biology_if_not_a_level_biology'
  ) {
    return 'GCSE Biology';
  }
  if (checkId === 'national_5_requirements' || checkId.includes('national_5')) {
    if (context.course_profile_id === 'dundee-a100') {
      return 'Dundee National 5 requirements';
    }
    return 'National 5s';
  }
  if (checkId === 'scottish_post_16_requirements' || checkId.includes('scottish_post_16')) {
    if (context.course_profile_id === 'glasgow-a100') {
      return context.academic_pathway === 'contextual' ||
        context.academic_pathway_id === 'glasgow_scottish_adjusted'
        ? 'Scottish adjusted/contextual route'
        : 'Scottish standard route';
    }
    if (context.course_profile_id === 'dundee-a100') {
      return context.academic_pathway === 'contextual' ||
        String(context.academic_pathway_id || '').includes('widening_access')
        ? 'Dundee Scottish widening-access route'
        : 'Dundee Scottish standard route';
    }
    return 'Scottish Highers';
  }
  if (qualificationType === 'a_level' && (checkId === 'a_level_route' || checkId.includes('a_level'))) {
    return 'A-level grades';
  }
  if (checkId.includes('english_language')) {
    return 'GCSE English Language';
  }
  if (checkId.includes('mathematics') || checkId.includes('maths')) {
    return 'GCSE Mathematics';
  }
  if (firstSubject && qualificationType === 'gcse') {
    return `GCSE ${humanSubjectLabel(firstSubject)}`;
  }

  return ACADEMIC_REQUIREMENT_LABELS[qualificationType];
}

function academicRequirementReasonForCheck(rawCheck, status) {
  const checkId = academicRequirementCheckId(rawCheck);
  if (status === 'met') {
    if (checkId === 'same_sitting_requirement') {
      return 'The same-sitting requirement is met.';
    }
    if (checkId === 'a_level_science_practical_endorsement') {
      return 'The practical endorsement requirement is met.';
    }
    if (checkId === 'epq_alternative_offer') {
      return 'The accepted EPQ alternative academic pathway is met.';
    }
    return 'This requirement is met.';
  }

  if (status === 'information_needed') {
    if (checkId === 'same_sitting_requirement') {
      return 'Required subject same-sitting information is missing.';
    }
    if (checkId === 'a_level_science_practical_endorsement') {
      return 'Required practical endorsement information is missing.';
    }
    if (checkId === 'epq_alternative_offer') {
      return 'A predicted or achieved EPQ grade is required to assess the alternative academic offer.';
    }
    if (
      checkId === 'scottish_post_16_requirements' &&
      rawCheck?.manual_review_reason === 'aberdeen_reach_program_scotland_information_needed'
    ) {
      return ABERDEEN_REACH_CONTEXTUAL_REVIEW_REASON;
    }
    if (
      checkId === 'scottish_post_16_requirements' &&
      rawCheck?.manual_review_reason === 'aberdeen_contextual_information_needed'
    ) {
      return 'Further evidence or review is needed to determine whether Aberdeen widening-access eligibility applies to this Scottish Higher requirement.';
    }
    return 'Required subject information is missing.';
  }

  if (checkId === 'same_sitting_requirement') {
    return 'The same-sitting requirement is not met.';
  }
  if (checkId === 'a_level_science_practical_endorsement') {
    return 'The practical endorsement requirement is not met.';
  }
  if (checkId === 'a_level_subject_combination') {
    return 'Required A-level subject information does not match the published requirement.';
  }
  if (checkId === 'epq_alternative_offer') {
    return 'The EPQ alternative academic pathway is not met.';
  }
  if (checkId === 'a_level_route' || checkId.includes('a_level')) {
    return 'Predicted A-level grades are below the required grades.';
  }
  if (checkId.includes('gcse')) {
    return 'A required GCSE grade does not meet the published minimum.';
  }

  return 'This academic requirement is not met.';
}

function checkHasMissingInformation(rawCheck) {
  return [
    rawCheck?.missing_subject_ids,
    rawCheck?.unknown_subject_ids,
    rawCheck?.unconfirmed_subject_ids,
    rawCheck?.missing_evidence_paths,
    rawCheck?.unknown_evidence_paths
  ].some((value) => Array.isArray(value) && value.length > 0);
}

function academicRequirementStatusForCheck(rawCheck, eligibilityStatus) {
  const rawStatus = normaliseCheckId(rawCheck?.status || rawCheck?.decision_outcome);
  if (
    rawStatus.includes('information') ||
    rawStatus.includes('manual') ||
    rawStatus.includes('review') ||
    rawStatus.includes('pending') ||
    rawStatus.includes('missing') ||
    rawStatus.includes('unknown') ||
    rawStatus.includes('insufficient')
  ) {
    return 'information_needed';
  }
  if (
    rawStatus.includes('fail') ||
    rawStatus.includes('not_met') ||
    rawStatus.includes('not_eligible') ||
    rawStatus.includes('ineligible') ||
    rawStatus.includes('rejected') ||
    rawStatus.includes('blocked')
  ) {
    return 'not_met';
  }
  if (
    rawStatus.includes('pass') ||
    rawStatus.includes('met') ||
    rawStatus.includes('eligible') ||
    rawStatus.includes('accepted') ||
    rawStatus.includes('confirmed') ||
    rawStatus.includes('satisfied')
  ) {
    return 'met';
  }

  if (rawCheck?.passed === true) {
    return 'met';
  }
  if (rawCheck?.passed === false) {
    return checkHasMissingInformation(rawCheck) ||
      ['manual_review', 'insufficient_evidence', 'information_needed'].includes(
        normaliseCheckId(eligibilityStatus)
      )
      ? 'information_needed'
      : 'not_met';
  }

  return null;
}

function publicAcademicRequirementKey(rawCheck, qualificationType, label, status = null) {
  const checkId = academicRequirementCheckId(rawCheck);
  if (
    checkId === 'same_sitting_requirement' ||
    checkId === 'a_level_science_practical_endorsement' ||
    checkId === 'a_level_subject_combination' ||
    checkId === 'epq_alternative_offer'
  ) {
    return `${qualificationType}:${checkId}:${label}`;
  }
  if (!['gcse', 'a_level'].includes(qualificationType)) {
    return `${qualificationType}:${checkId}:${label}`;
  }
  if (status !== 'met') {
    return `${qualificationType}:${checkId}:${label}:${status || ''}`;
  }
  return `${qualificationType}:${label}`;
}

function shouldSuppressPublicAcademicRequirementCheck(rawCheck, status, context = {}) {
  const checkId = academicRequirementCheckId(rawCheck);
  const epqAlternativeStatus = normaliseCheckId(context.epq_alternative_status);
  const epqAlternativePublicStatus = context.epq_alternative_public_status;
  const hasFinalPathwayCheck =
    context.has_epq_alternative_offer === true &&
    Boolean(context.has_standard_offer_check || context.has_epq_alternative_check);
  if (
    context.has_epq_alternative_offer === true &&
    status === 'met' &&
    checkId === 'a_level_subject_combination'
  ) {
    return true;
  }

  if (hasFinalPathwayCheck && checkId === 'a_level_route') {
    return true;
  }

  if (
    context.has_epq_alternative_offer === true &&
    checkId === 'epq_alternative_offer'
  ) {
    return context.academic_pathway === 'standard' ||
      epqAlternativeStatus === 'not_applicable';
  }

  if (
    context.has_epq_alternative_offer === true &&
    ['a_level_standard_offer', 'standard_offer'].includes(checkId)
  ) {
    return context.academic_pathway === 'epq_alternative' ||
      epqAlternativePublicStatus === 'information_needed' ||
      (
        epqAlternativePublicStatus === 'not_met' &&
        epqAlternativeStatus !== 'not_applicable'
      );
  }

  if (
    status !== 'not_met' ||
    context.academic_pathway !== 'epq_alternative' ||
    normaliseCheckId(context.eligibilityStatus) !== 'eligible'
  ) {
    return false;
  }

  return rawCheck?.academic_pathway === 'standard' &&
    ['a_level_standard_offer', 'standard_offer'].includes(checkId);
}

function hasEnabledEpqAlternativeOffer(stage1Eligibility = null) {
  const policy = stage1Eligibility?.post_16?.a_level?.epq_alternative_offer;
  return policy?.enabled === true;
}

function formatAlevelGradeProfile(grades = []) {
  if (!Array.isArray(grades) || grades.length === 0) {
    return null;
  }
  const formatted = grades
    .map((grade) => String(grade || '').trim().toUpperCase())
    .filter(Boolean);
  return formatted.length === grades.length ? formatted.join('') : null;
}

function formatSubjectList(subjectIds = []) {
  const labels = subjectIds
    .map(humanSubjectLabel)
    .filter(Boolean);
  if (labels.length <= 1) {
    return labels.join('');
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function epqAlternativeOfferConditions(policy = {}) {
  const conditions = [];
  const policyConditions = policy.conditions || {};
  const subjectGradeRequirements = policy.subject_grade_requirements;

  if (
    subjectGradeRequirements &&
    typeof subjectGradeRequirements === 'object' &&
    !Array.isArray(subjectGradeRequirements)
  ) {
    const entries = Object.entries(subjectGradeRequirements)
      .filter(([, grade]) => String(grade || '').trim());
    const distinctGrades = [...new Set(entries.map(([, grade]) => String(grade).trim().toUpperCase()))];
    if (entries.length > 0 && distinctGrades.length === 1) {
      const subjects = formatSubjectList(entries.map(([subjectId]) => subjectId));
      conditions.push(`${subjects} must ${entries.length === 1 ? 'be' : 'both be'} grade ${distinctGrades[0]}`);
    }
  }

  if (
    Array.isArray(policy.required_subject_grade_options) &&
    policy.required_subject_grade_options.length > 0 &&
    policy.required_subject_grade_options.every((option) => {
      const gradeRequirements = option?.grade_requirements || [];
      return gradeRequirements.length === 1 &&
        String(gradeRequirements[0]?.minimum_grade || '').trim().toUpperCase() === 'A';
    })
  ) {
    conditions.push('Grade A required in the applicable mandatory science');
  }

  if (policyConditions.must_be_taken_alongside_a_levels === true) {
    conditions.push('EPQ must be taken alongside A-levels');
  }

  if (policyConditions.all_a_levels_same_sitting === true) {
    conditions.push('A-levels must be taken in one sitting');
  }

  if (policyConditions.a_level_resits_allowed === false) {
    conditions.push('EPQ route unavailable for A-level resits');
  }

  if (policyConditions.firm_choice_only === true) {
    conditions.push('Reduced offer applies only when this university is the firm UCAS choice');
  }

  return [...new Set(conditions)];
}

function buildContextualAcademicOffer(stage1Eligibility = null) {
  const aLevel = stage1Eligibility?.post_16?.a_level;
  const standardGrades = aLevel?.standard_offer?.grade_profile || aLevel?.grade_profile || [];
  const contextualGrades = aLevel?.contextual_offer?.grade_profile || [];
  const standardOffer = formatAlevelGradeProfile(standardGrades);
  const contextualOffer = formatAlevelGradeProfile(contextualGrades);

  if (!standardOffer || !contextualOffer) {
    return null;
  }

  return {
    type: 'contextual',
    standard_offer: standardOffer,
    alternative_offer: contextualOffer,
    pathway_id: aLevel.contextual_offer?.pathway_id || 'contextual_offer',
    conditions: []
  };
}

function buildContextualScottishAcademicOffer(stage1Eligibility = null, context = {}) {
  const scottish = stage1Eligibility?.post_16?.scottish || {};
  const routes = scottish.grade_requirements || [];
  const routeIds = [
    context.academic_pathway_id,
    context.selection_route_id
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const matchedRoute = routes.find((route) => {
    const ids = [
      route.pathway_id,
      route.route_id,
      route.requirement_id
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const routeGroups = route.applies_to_group_ids || [];
    const contextualRoute =
      routeGroups.includes('contextual') ||
      routeGroups.includes('widening_participation');
    return contextualRoute && (
      routeIds.length === 0 ||
      ids.some((id) => routeIds.includes(id))
    );
  });
  if (!matchedRoute) {
    return null;
  }

  if (
    matchedRoute.pathway_id === 'glasgow_scottish_adjusted' ||
    matchedRoute.route_id === 'glasgow_scottish_adjusted' ||
    matchedRoute.requirement_id === 'sqa_adjusted_contextual_offer'
  ) {
    return {
      type: 'contextual',
      standard_offer: 'AAAAB Scottish Highers + BB Advanced Highers',
      alternative_offer: 'AAABB or AAAAC Scottish Highers + BC Advanced Highers',
      pathway_id: 'glasgow_scottish_adjusted',
      conditions: [
        'Adjusted Scottish route requires confirmed Glasgow contextual eligibility and successful completion of Reach.',
        'The C grade in the AAAAC Higher option cannot be Chemistry.'
      ]
    };
  }

  const standardGrades =
    scottish.higher_offer?.grade_profile ||
    routes.find((route) => {
      const routeId = normaliseCheckId(route.requirement_id || route.pathway_id || route.route_id);
      return routeId.includes('standard');
    })?.higher_grade_profile ||
    routes.find((route) => {
      const routeId = normaliseCheckId(route.requirement_id || route.pathway_id || route.route_id);
      return routeId.includes('standard');
    })?.grade_profile ||
    [];
  const standardAdvancedGrades =
    scottish.advanced_higher_offer?.grade_profile ||
    routes.find((route) => {
      const routeId = normaliseCheckId(route.requirement_id || route.pathway_id || route.route_id);
      return routeId.includes('standard');
    })?.advanced_higher_grade_profile ||
    [];
  const contextualGrades = matchedRoute.higher_grade_profile || matchedRoute.grade_profile || [];
  const contextualAdvancedGrades = matchedRoute.advanced_higher_grade_profile || [];
  const standardOffer = formatAlevelGradeProfile(standardGrades);
  const contextualOffer = formatAlevelGradeProfile(contextualGrades);
  if (!standardOffer || !contextualOffer) {
    return null;
  }
  const standardAdvancedOffer = formatAlevelGradeProfile(standardAdvancedGrades);
  const contextualAdvancedOffer = formatAlevelGradeProfile(contextualAdvancedGrades);
  const standardOfferText = `${standardOffer} Scottish Highers${standardAdvancedOffer ? ` + ${standardAdvancedOffer} Advanced Highers` : ''}`;
  const contextualOfferText = `${contextualOffer} Scottish Highers${contextualAdvancedOffer ? ` + ${contextualAdvancedOffer} Advanced Highers` : ''}`;

  return {
    type: 'contextual',
    standard_offer: standardOfferText,
    alternative_offer: contextualOfferText,
    pathway_id: matchedRoute.pathway_id || matchedRoute.route_id || matchedRoute.requirement_id || null,
    conditions: matchedRoute.contextual_offer_conditions || matchedRoute.conditions || []
  };
}

function buildContextualEpqAcademicOffer(stage1Eligibility = null) {
  const aLevel = stage1Eligibility?.post_16?.a_level;
  const contextualGrades = aLevel?.contextual_offer?.grade_profile || [];
  const policy = aLevel?.contextual_epq_alternative_offer;
  const contextualOffer = formatAlevelGradeProfile(contextualGrades);
  const alternativeGrades = policy?.a_level_grades || policy?.grade_profile || [];
  const alternativeGradeOffer = formatAlevelGradeProfile(alternativeGrades);
  const epqMinimumGrade = String(policy?.epq_minimum_grade || policy?.epq_grade || '').trim().toUpperCase();
  const pathwayId = String(policy?.pathway_id || '').trim();

  if (!contextualOffer || !alternativeGradeOffer || !epqMinimumGrade || !pathwayId) {
    return null;
  }

  return {
    type: 'contextual_epq',
    standard_offer: contextualOffer,
    alternative_offer: `${alternativeGradeOffer} + EPQ Grade ${epqMinimumGrade}`,
    epq_minimum_grade: epqMinimumGrade,
    pathway_id: pathwayId,
    conditions: []
  };
}

function hasRoutedAcademicOfferPathways(stage1Eligibility = null) {
  const routes = routedAcademicOfferRoutes(stage1Eligibility);
  return routes.some((route) => {
    return route?.pathway_id ||
      route?.academic_pathway ||
      route?.requires_epq === true ||
      route?.epq_minimum_grade;
  });
}

function hasRoutedEpqAlternativePathways(stage1Eligibility = null) {
  return routedAcademicOfferRoutes(stage1Eligibility).some((route) => {
    return route?.requires_epq === true || route?.epq_minimum_grade;
  });
}

function routedAcademicOfferRoutes(stage1Eligibility = null) {
  const aLevel = stage1Eligibility?.post_16?.a_level || {};
  return [
    ...(aLevel.grade_requirements || []),
    ...(aLevel.routed_offer_routes || []),
    ...(aLevel.presentation_offer_routes || [])
  ];
}

function matchedAcademicOfferRoute(stage1Eligibility = null, context = {}) {
  const aLevelRoutes = routedAcademicOfferRoutes(stage1Eligibility);
  const genericAcademicPathways = new Set([
    'standard',
    'contextual',
    'epq_alternative',
    'contextual_epq_alternative'
  ]);
  const academicPathway = String(context.academic_pathway || '').trim();
  const contextRouteIds = [
    context.academic_pathway_id,
    context.selection_route_id,
    academicPathway && !genericAcademicPathways.has(academicPathway)
      ? academicPathway
      : null
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (contextRouteIds.length === 0) {
    return null;
  }

  return aLevelRoutes.find((route) => {
    const routeIds = [
      route?.pathway_id,
      route?.route_id,
      route?.requirement_id,
      route?.selection_route_id,
      route?.academic_pathway
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return routeIds.some((routeId) => contextRouteIds.includes(routeId));
  });
}

function profileArray(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

function firstProfileArray(...values) {
  return values.map(profileArray).find(Boolean) || [];
}

function offerGradeProfileForRoute(route = null) {
  if (!route || typeof route !== 'object') {
    return [];
  }
  return firstProfileArray(
    route.display_offer_grade_profile,
    route.offer_grade_profile,
    route.achieved_grade_profile,
    route.final_grade_profile,
    route.grade_profile,
    route.standard_offer
  );
}

function standardAlevelOfferGrades(stage1Eligibility = null) {
  const aLevel = stage1Eligibility?.post_16?.a_level || {};
  const standardOffer = aLevel.standard_offer;
  if (Array.isArray(standardOffer)) {
    return standardOffer;
  }
  if (Array.isArray(standardOffer?.grade_profile) && standardOffer.grade_profile.length > 0) {
    return standardOffer.grade_profile;
  }

  const standardRoute = (aLevel.grade_requirements || []).find((route) => {
    const routeId = normaliseCheckId(route?.pathway_id || route?.route_id || route?.requirement_id);
    return route?.academic_pathway === 'standard' || routeId.includes('standard');
  });
  return offerGradeProfileForRoute(standardRoute);
}

function buildRoutedAcademicOffer(stage1Eligibility = null, matchedRoute = null) {
  const matchedOfferGrades = offerGradeProfileForRoute(matchedRoute);
  if (matchedRoute && Array.isArray(matchedOfferGrades) && matchedOfferGrades.length > 0) {
    const standardOffer = formatAlevelGradeProfile(
      standardAlevelOfferGrades(stage1Eligibility)
    );
    const matchedOffer = formatAlevelGradeProfile(matchedOfferGrades);
    if (matchedOffer && matchedOffer !== standardOffer) {
      return {
        type: 'routed_offer',
        standard_offer: standardOffer,
        alternative_offer: matchedOffer,
        pathway_id: matchedRoute.pathway_id || matchedRoute.route_id || matchedRoute.requirement_id || null,
        conditions: []
      };
    }
  }
  return null;
}

function buildEpqAcademicOffer(stage1Eligibility = null) {
  const aLevel = stage1Eligibility?.post_16?.a_level;
  const policy = aLevel?.epq_alternative_offer;
  if (policy?.enabled !== true) {
    return null;
  }

  const standardGrades = aLevel?.standard_offer?.grade_profile || aLevel?.grade_profile || [];
  const alternativeGrades = policy.a_level_grades || policy.grade_profile || [];
  const standardOffer = formatAlevelGradeProfile(standardGrades);
  const alternativeGradeOffer = formatAlevelGradeProfile(alternativeGrades);
  const epqMinimumGrade = String(policy.epq_minimum_grade || policy.epq_grade || '').trim().toUpperCase();
  const pathwayId = String(policy.pathway_id || '').trim();

  if (!standardOffer || !alternativeGradeOffer || !epqMinimumGrade || !pathwayId) {
    return null;
  }

  return {
    type: 'epq',
    standard_offer: standardOffer,
    alternative_offer: `${alternativeGradeOffer} + EPQ Grade ${epqMinimumGrade}`,
    epq_minimum_grade: epqMinimumGrade,
    pathway_id: pathwayId,
    conditions: epqAlternativeOfferConditions(policy)
  };
}

function buildAlternativeAcademicOffer(stage1Eligibility = null, context = {}) {
  const matchedRoute = matchedAcademicOfferRoute(stage1Eligibility, context);

  if (context.academic_pathway === 'contextual_epq_alternative') {
    const contextualEpqOffer = buildContextualEpqAcademicOffer(stage1Eligibility);
    if (contextualEpqOffer) {
      return contextualEpqOffer;
    }
  }

  if (context.academic_pathway === 'contextual') {
    const scottishContextualOffer = buildContextualScottishAcademicOffer(stage1Eligibility, context);
    if (scottishContextualOffer) {
      return scottishContextualOffer;
    }
    const routedContextualOffer = buildRoutedAcademicOffer(stage1Eligibility, matchedRoute);
    if (routedContextualOffer) {
      return {
        ...routedContextualOffer,
        type: 'contextual'
      };
    }
    const contextualOffer = buildContextualAcademicOffer(stage1Eligibility);
    if (contextualOffer) {
      return contextualOffer;
    }
  }

  if (context.academic_pathway === 'epq_alternative') {
    const epqOffer = buildEpqAcademicOffer(stage1Eligibility);
    if (epqOffer) {
      return epqOffer;
    }
  }

  if (matchedRoute) {
    const routedOffer = buildRoutedAcademicOffer(stage1Eligibility, matchedRoute);
    if (routedOffer) {
      return routedOffer;
    }
  }

  if (
    context.academic_pathway &&
    context.academic_pathway !== 'standard' &&
    context.academic_pathway !== 'epq_alternative' &&
    hasRoutedAcademicOfferPathways(stage1Eligibility)
  ) {
    return null;
  }

  if (
    context.academic_pathway === 'standard' &&
    hasRoutedEpqAlternativePathways(stage1Eligibility)
  ) {
    return null;
  }

  const epqOffer = buildEpqAcademicOffer(stage1Eligibility);
  if (epqOffer) {
    return epqOffer;
  }

  if (context.academic_pathway === 'standard') {
    return null;
  }

  return null;
}

function epqAlternativeCheck(rawChecks = []) {
  return (rawChecks || []).find((rawCheck) => {
    return academicRequirementCheckId(rawCheck) === 'epq_alternative_offer';
  }) || null;
}

function hasAcademicCheck(rawChecks = [], checkIds = []) {
  const ids = new Set(checkIds);
  return (rawChecks || []).some((rawCheck) => ids.has(academicRequirementCheckId(rawCheck)));
}

function buildAcademicRequirementChecks(rawChecks = [], eligibilityStatus = null, context = {}) {
  const rows = [];
  const seen = new Map();
  const epqCheck = epqAlternativeCheck(rawChecks);
  const buildContext = {
    ...context,
    eligibilityStatus,
    has_standard_offer_check: hasAcademicCheck(rawChecks, [
      'a_level_standard_offer',
      'standard_offer'
    ]),
    has_epq_alternative_check: Boolean(epqCheck),
    epq_alternative_status: epqCheck?.epq_status || epqCheck?.status || null,
    epq_alternative_public_status: epqCheck
      ? academicRequirementStatusForCheck(epqCheck, eligibilityStatus)
      : null
  };

  for (const rawCheck of rawChecks || []) {
    const qualificationType = academicPresentationQualificationTypeForCheck(
      rawCheck,
      academicQualificationTypeForCheck(rawCheck),
      buildContext
    );
    if (!qualificationType) {
      continue;
    }
    const status = academicRequirementStatusForCheck(rawCheck, eligibilityStatus);
    if (!status) {
      continue;
    }
    if (shouldSuppressPublicAcademicRequirementCheck(rawCheck, status, buildContext)) {
      continue;
    }
    const checkId = academicRequirementCheckId(rawCheck) || qualificationType;
    const label = academicRequirementLabelForCheck(rawCheck, qualificationType, {
      ...buildContext,
      academic_requirement_status: status
    });
    const key = publicAcademicRequirementKey(rawCheck, qualificationType, label, status);
    const row = {
      qualification_type: qualificationType,
      requirement_type: checkId,
      label,
      status,
      reason: academicRequirementReasonForCheck(rawCheck, status)
    };
    if (rawCheck.required !== undefined) row.required_value = rawCheck.required;
    if (rawCheck.actual !== undefined) row.applicant_value = rawCheck.actual;
    if (rawCheck.required_grade !== undefined) row.required_value = rawCheck.required_grade;
    if (rawCheck.applicant_grade !== undefined) row.applicant_value = rawCheck.applicant_grade;

    const currentIndex = seen.get(key);
    if (currentIndex !== undefined) {
      const current = rows[currentIndex];
      if (
        ACADEMIC_REQUIREMENT_STATUS_PRIORITY[status] >
        ACADEMIC_REQUIREMENT_STATUS_PRIORITY[current.status]
      ) {
        rows[currentIndex] = { ...current, ...row };
      }
      continue;
    }
    seen.set(key, rows.length);
    rows.push(row);
  }

  if (isDundeeAlevelAcademicContext(buildContext)) {
    const order = { a_level: 0, gcse: 1 };
    return [...rows].sort((a, b) => {
      const aOrder = order[a.qualification_type] ?? 2;
      const bOrder = order[b.qualification_type] ?? 2;
      return aOrder - bOrder;
    });
  }

  return rows;
}

// Generic reason-code -> human label for the machine-readable failure/check
// codes produced by eligibility-evaluator.js's addFailure/addCheck and
// interview-band-classifier.js's evaluateHardFilters (same {checks, failures}
// shape across the generic path and the Nottingham/Hull York consumers).
// Codes may carry a ":subject_id"/":extra" suffix, handled separately below.
// This lets every university show real, specific reasons without
// hand-authoring prose per university.
const FAILURE_REASON_LABELS = {
  minimum_gcse_count_not_met: 'You need more GCSEs at the required grade than are currently on file.',
  gcse_minimum_count_at_grade_not_met: 'You need more GCSEs at the required minimum grade than are currently on file.',
  gcse_requirement_not_met: 'One of your GCSE subject grades does not meet the published minimum.',
  minimum_gcse_grade_not_met: 'One of your GCSE subject grades does not meet the published minimum.',
  gcse_science_alternative_not_met: 'Your GCSE science subjects do not match any of the accepted science combinations.',
  minimum_gcse_points_not_met: 'Your GCSE points score does not meet the published minimum.',
  a_level_requirements_not_met: 'Your A-level grades (predicted or achieved) do not meet the published minimum.',
  lancaster_epq_alternative_epq_grade_required: 'A predicted or achieved EPQ grade is required to assess Lancaster’s alternative A-level offer.',
  keele_epq_alternative_epq_grade_required: 'A predicted or achieved EPQ grade is required to assess Keele’s alternative A-level offer.',
  a_level_subject_combination_not_met: 'Your A-level subjects do not match the published subject requirement.',
  a_level_practical_requirement_not_met: 'A required A-level science practical endorsement is missing or not a pass.',
  science_practical_endorsement_not_confirmed: 'The practical endorsement requirement is not met.',
  science_practical_endorsement_evidence_missing: 'Please confirm the practical endorsement outcome for your required A-level science subject.',
  same_sitting_evidence_missing: 'Please confirm whether your required A-level qualifications were or will be completed in the same examination sitting.',
  same_sitting_evidence_not_supported_for_route: 'This qualification route needs adviser review because same-sitting evidence cannot yet be checked automatically.',
  same_sitting_requirement_not_met: 'Your required qualifications were not completed in the same examination sitting.',
  epq_alongside_a_levels_evidence_missing: 'Please confirm whether your EPQ was taken alongside your A-levels.',
  a_level_resit_evidence_missing: 'Please confirm whether any of your A-levels are resits.',
  a_level_grade_evidence_missing: 'Please complete your A-level grade evidence so the alternative offer can be checked.',
  a_level_subject_combination_evidence_missing: 'Please complete your A-level subject evidence so the published subject requirement can be checked.',
  a_level_route_not_supported_for_applicant_groups: 'ApplySmart does not yet have published A-level requirement data for your applicant group at this university.',
  ib_requirements_not_met: 'Your IB points or subject grades do not meet the published minimum.',
  ib_route_not_supported_for_applicant_groups: 'ApplySmart does not yet have published IB requirement data for your applicant group at this university.',
  btec_route_not_accepted: 'This university does not publish an accepted BTEC route matching your qualification.',
  access_to_he_not_accepted: 'This university does not accept the Access to HE route as entered.',
  international_qualification_requires_manual_review: 'Your international qualification equivalence needs adviser review before eligibility can be confirmed.',
  international_qualification_equivalence_requires_verification: 'Your international qualification equivalence needs adviser review before eligibility can be confirmed.',
  graduate_route_requirements_not_met: 'Your graduate-entry qualifications do not meet the published minimum.',
  ielts_academic_requirements_not_met: 'Your English language test scores do not meet the published minimum.',
  international_english_language_requirement_not_met: 'Your English language test scores do not meet the published minimum.',
  minimum_ucat_total_not_met: 'Your UCAT total score does not meet the published minimum.',
  ucat_section_minimum_not_met: 'One or more UCAT section scores is below the published minimum.',
  required_admissions_test_missing: 'A required admissions test score is missing.',
  minimum_gamsat_component_not_met: 'Your GAMSAT scores do not meet the published minimum.',
  graduate_standard_route_not_met: 'The standard graduate academic route is not fully met.',
  graduate_compensatory_test_required: 'A compensatory admissions test is required for this graduate route because one compensable academic requirement is not met.',
  graduate_compensatory_test_threshold_not_met: 'Your compensatory admissions test scores do not meet the published minimum.',
  graduate_compensatory_test_multiple_deficiencies: 'The compensatory admissions test can only cover one specified academic shortfall for this route.',
  graduate_degree_requirements_not_met: 'The graduate degree requirement is not met.',
  qualification_route_requires_manual_review: 'This applicant route needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet.',
  applicant_group_requires_manual_review: 'This applicant group needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet.',
  sjt_band_excluded: 'Your SJT band is excluded by this university’s published policy.',
  disqualifying_sjt_rule: 'Your SJT band is excluded by this university’s published policy.',
  required_admissions_test_component_missing: 'A required admissions test component is missing.',
  resits_not_accepted: 'This university does not accept resits for your route.',
  resit_policy_not_met: 'Your resit evidence does not meet the published resit policy.',
  ucat_not_taken_in_application_year: 'Your UCAT was not taken in the year required for this application cycle.',
  ucat_test_year_not_valid: 'Your UCAT was not taken in the year required for this application cycle.',
  course_target_mismatch: 'The course you selected does not match this university’s course.',
  applicant_group_explicitly_blocked: 'This university does not accept applications from your applicant group.',
  qualification_route_explicitly_blocked: 'This university does not accept your qualification route.',
  unsupported_qualification_route: 'ApplySmart does not yet support checking this qualification route for this university.',
  initial_deferred_entry_not_accepted: 'This university does not accept deferred entry.',
  t_level_not_accepted: 'This university does not accept T-levels for this route.',
  minimum_age_requires_confirmation: 'Your age needs to be confirmed against this university’s published age requirement.',
  age_on_1_october_requires_confirmation: 'Your age on 1 October of the entry year needs to be confirmed against this university’s published age requirement.',
  leicester_contextual_information_needed: 'ApplySmart needs more Leicester contextual evidence to confirm whether a Leicester contextual route applies.',
  lancaster_contextual_information_needed: 'ApplySmart needs more Lancaster contextual evidence or manual review to confirm whether Lancaster contextual or widening-participation status can be verified.',
  manchester_contextual_information_needed: 'ApplySmart needs Manchester postcode or school-context evidence to check whether the contextual AAB route applies.',
  manchester_refugee_or_care_information_needed: 'ApplySmart needs more care, refugee-status or Ukrainian visa information to check whether Manchester’s ABB route applies.',
  manchester_contextual_or_refugee_care_information_needed: 'ApplySmart needs Manchester postcode/school-context evidence and personal-circumstance confirmation to check whether Manchester’s contextual routes apply.',
  bristol_contextual_baseline_information_needed: 'More information is needed to confirm whether you qualify for Bristol’s contextual offer.',
  bristol_contextual_information_needed: 'More information is needed to confirm whether you qualify for Bristol’s contextual offer.',
  aberdeen_contextual_information_needed: 'Further evidence or review is needed to determine whether Aberdeen widening-access eligibility applies.',
  aberdeen_reach_program_scotland_information_needed: ABERDEEN_REACH_CONTEXTUAL_REVIEW_REASON,
  bristol_contextual_imd_postcode_evidence_required: 'More information is needed to verify Bristol IMD eligibility from postcode-derived evidence.',
  bristol_contextual_fsm_secondary_verification_required: 'More information is needed to verify Free School Meals eligibility during secondary education for Bristol contextual assessment.',
  bristol_aspiring_state_school_identifier_or_name_required: 'More information is needed to verify whether your school or college appears on Bristol’s Aspiring State Schools list.',
  bristol_aspiring_state_school_identifier_unverifiable: 'The school identifier provided cannot be verified against Bristol’s Aspiring State Schools list. Provide an Apply centre code or exact school/college name.',
  bristol_aspiring_state_school_awaiting_confirmation: 'Your school or college appears on Bristol’s Aspiring State Schools file but is still marked as awaiting confirmation.',
  bristol_aspiring_state_school_list_unavailable: 'Bristol Aspiring State Schools list data is currently unavailable for this application cycle and needs individual review.',
  bristol_aspiring_state_school_verification_required: 'Bristol aspiring state-school evidence cannot be verified automatically and needs individual review.',
  bristol_scholars_tailored_offer_manual_review: 'Bristol Scholars may receive a tailored offer. The standard Bristol contextual offer of ABB should not be assumed, so this route requires individual review.'
};

function futureConditionAdvisories(futureConditions = [], options = {}) {
  const universityName = options.universityName || 'this university';
  return [...new Set(futureConditions || [])]
    .map((condition) => {
      if (condition === 'firm_choice_required') {
        return `This reduced EPQ offer applies only if ${universityName} is accepted as your firm UCAS choice.`;
      }
      return null;
    })
    .filter(Boolean);
}

function humanFailureLabel(code) {
  const [base] = String(code || '').split(':');
  if (base.endsWith('_epq_grade_required')) {
    return FAILURE_REASON_LABELS[base] ||
      'A predicted or achieved EPQ grade is required to assess the alternative A-level offer.';
  }
  return FAILURE_REASON_LABELS[base] || null;
}

function firstSpecificFailureLabel(failures) {
  return (failures || [])
    .map(humanFailureLabel)
    .find(Boolean) || null;
}

function notEligiblePrimaryExplanation(failures, context = {}) {
  const profileId = context.course_identity?.profile_id || context.course_profile_id;
  const contextual = context.eligibility?.contextual_eligibility || context.contextual_eligibility;
  if (
    profileId === 'bristol-a100' &&
    contextual?.status === 'contextual' &&
    (context.academic_pathway || context.eligibility?.academic_pathway) === 'contextual' &&
    (failures || []).some((failure) => normaliseCheckId(failure) === 'a_level_requirements_not_met')
  ) {
    return 'You meet Bristol’s contextual eligibility criteria, but your current grades do not meet the published contextual offer of ABB, including A in Chemistry and B in an accepted second science or Mathematics subject.';
  }
  const specificFailure = firstSpecificFailureLabel(failures);
  const generic = 'Based on the information entered, one or more supported entry requirements are not met.';
  return specificFailure ? `${specificFailure} ${generic}` : generic;
}

// Distinguishes, for an insufficient_evidence result, whether the gap is on
// the university's side (its own published methodology has a component
// ApplySmart cannot execute for this applicant's route - e.g. Leicester's
// Graduate /48 route, or Keele's Home /25 score requiring a
// personal-statement score ApplySmart doesn't collect) versus a generic
// evidence gap. classifyInterviewBand already signals this: when an eligible
// applicant matches no guidance_pool at all (guidance_pool_id stays null),
// or when the Birmingham-style classifier emits a warning naming an
// unpublished/non-executable boundary, that is the university's methodology
// - not the applicant's data - falling short. Never invents a reason the
// engine didn't already surface.
const UNIVERSITY_METHODOLOGY_GAP_WARNING_PATTERNS = [
  /_not_published/,
  /_not_executable/,
  /_not_verified/,
  /_boundary_not_published/
];

function insufficientEvidenceReasonCodeFromWarnings(warnings, options = {}) {
  const hasMethodologyGapWarning = (warnings || []).some((code) =>
    UNIVERSITY_METHODOLOGY_GAP_WARNING_PATTERNS.some((pattern) => pattern.test(String(code || '')))
  );
  const noMatchingGuidancePool =
    options.eligibilityStatus === 'eligible' && options.guidancePoolId === null;
  return hasMethodologyGapWarning || noMatchingGuidancePool ? 'university_methodology_gap' : null;
}

function selectedFeeStatusKey(groupIds = []) {
  const groups = new Set(groupIds || []);
  if (groups.has('international_fee')) {
    return 'international';
  }
  if (groups.has('home_fee')) {
    return 'home';
  }
  return null;
}

function publicFeeInformation(feeInformation, groupIds = []) {
  if (!feeInformation || typeof feeInformation !== 'object') {
    return null;
  }

  const feeStatus = selectedFeeStatusKey(groupIds);
  const selected = feeStatus ? feeInformation[feeStatus] : null;
  if (!selected || typeof selected !== 'object') {
    return null;
  }
  const firstYear = selected.first_year ?? null;
  const courseTotal = selected.course_total ?? null;
  const deposit = selected.deposit ?? feeInformation.deposit ?? null;
  const hasPublishedAmount =
    Number.isFinite(firstYear) ||
    Number.isFinite(courseTotal) ||
    Number.isFinite(deposit);

  if (!hasPublishedAmount) {
    return null;
  }

  return {
    fee_status: feeStatus,
    currency: feeInformation.currency || null,
    entry_cycle: feeInformation.entry_cycle || null,
    first_year: firstYear,
    course_total: courseTotal,
    deposit,
    deposit_refundable_if_conditions_not_met:
      selected.deposit_refundable_if_conditions_not_met ??
      feeInformation.deposit_refundable_if_conditions_not_met ??
      null,
    fees_subject_to_change: feeInformation.fees_subject_to_change === true,
    fee_increase_wording: feeInformation.fee_increase_wording || null,
    additional_costs: feeInformation.additional_costs || null,
    eligibility_effect: feeInformation.eligibility_effect || 'informational_only',
    published_rates: Object.fromEntries(
      ['home', 'international']
        .filter((status) => feeInformation[status] && typeof feeInformation[status] === 'object')
        .map((status) => [
          status,
          {
            first_year: feeInformation[status].first_year ?? null,
            course_total: feeInformation[status].course_total ?? null,
            deposit: feeInformation[status].deposit ?? feeInformation.deposit ?? null
          }
        ])
    )
  };
}

// First manual_review_reasons code (same lookup as failure codes) rendered
// as a human label, for use as the specific manual-review reason shown to
// the applicant instead of the generic "some information is missing" text.
function humanManualReviewReason(manualReviewReasons) {
  const [firstReason] = manualReviewReasons || [];
  return humanFailureLabel(firstReason) || null;
}

function titleCaseGroupLabel(groupId) {
  return String(groupId || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Builds the applicant-pool label actually evaluated for this applicant,
// from the engine's own deriveApplicantGroupIds() output
// (classification.applicant_group_ids / eligibility.applicant_group_ids -
// identical vocabulary across the generic, Nottingham and Hull York
// dispatch paths). This replaces the old static per-university pool string,
// which never varied per applicant and could show a Home applicant as
// International (or vice versa). Fee status (home/international) is always
// the headline distinction; domicile, contextual/WP and graduate status are
// appended when present, since they are also real evaluated applicant-group
// facts, not invented text.
function humanApplicantPoolLabel(groupIds, applicantContext = {}) {
  const groups = new Set(groupIds || []);
  if (groups.size === 0) {
    return null;
  }
  const explicitRestOfUkFeeStatus = isRestOfUkFeeStatus(
    applicantContext?.applicant_identity?.fee_status ||
    applicantContext?.fee_status
  );

  const feeLabel = groups.has('international_fee')
    ? 'International'
    : explicitRestOfUkFeeStatus && groups.has('rest_of_uk')
      ? 'Rest of UK / ROI'
      : groups.has('home_fee')
        ? 'Home'
      : null;

  const domicileLabel = explicitRestOfUkFeeStatus && groups.has('rest_of_uk')
    ? null
    : groups.has('scotland_domiciled')
    ? 'Scotland-domiciled'
    : groups.has('rest_of_uk')
      ? 'Rest of UK'
      : null;

  const modifiers = [];
  if (groups.has('graduate_applicant')) modifiers.push('graduate');
  if (groups.has('contextual') || groups.has('widening_participation')) modifiers.push('contextual/widening participation');
  if (groups.has('care_experienced')) modifiers.push('care-experienced');
  if (groups.has('mature_applicant')) modifiers.push('mature');

  const parts = [feeLabel, domicileLabel].filter(Boolean);
  if (parts.length === 0 && modifiers.length === 0) {
    return null;
  }

  const base = parts.length > 0 ? parts.join(', ') : 'Applicant';
  return modifiers.length > 0 ? `${base} applicants (${modifiers.join(', ')})` : `${base} applicants`;
}

function manchesterContextualRouteDetails(card = {}) {
  const profileId = card.course_identity?.profile_id || null;
  if (profileId !== 'manchester-a100') {
    return null;
  }
  const contextual = card.eligibility?.contextual_eligibility || null;
  if (!contextual || contextual.status !== 'contextual') {
    return null;
  }

  const routeId = contextual.matched_contextual_pathway || null;
  const routeLabel = routeId === 'manchester_refugee_care_abb'
    ? 'Care Experienced Route (ABB)'
    : routeId === 'manchester_contextual_aab'
      ? 'Contextual Route (AAB)'
      : null;
  if (!routeLabel) {
    return null;
  }

  const routeCriterionIds = routeId === 'manchester_refugee_care_abb'
    ? ['care_over_three_months', 'uk_refugee_status_granted', 'ukrainian_visa_scheme']
    : ['current_uk_residence', 'under_21_on_1_september', 'area_criterion', 'gcse_school_below_average', 'post16_school_below_average'];
  const criteria = Array.isArray(contextual.qualifying_criteria)
    ? contextual.qualifying_criteria
      .filter((entry) => routeCriterionIds.includes(entry.criterion_id))
    : [];
  const fallbackCriteria = Array.isArray(contextual.qualifying_criteria)
    ? contextual.qualifying_criteria
    : [];
  const selectedCriteria = criteria.length > 0 ? criteria : fallbackCriteria;
  const evidenceSummary = selectedCriteria
    .map((entry) => {
      const label = String(entry.label || '').trim();
      const actual = String(entry.actual || '').trim();
      if (!label) return null;
      if (!actual || ['yes', 'true', 'confirmed'].includes(normaliseCheckId(actual))) {
        return label;
      }
      return `${label}: ${actual}`;
    })
    .filter(Boolean);

  return {
    route_id: routeId,
    route_label: routeLabel,
    evidence_items: evidenceSummary
  };
}

function manchesterContextualSummary(card = {}) {
  const details = manchesterContextualRouteDetails(card);
  if (!details) {
    return null;
  }
  const evidence = details.evidence_items.length > 0
    ? ` Matched evidence: ${details.evidence_items.join('; ')}.`
    : '';
  return `Contextual eligibility confirmed: ${details.route_label}.${evidence}`;
}

function bristolMissingContextualEvidenceList(contextual = {}) {
  const missing = Array.isArray(contextual.missing_information)
    ? contextual.missing_information
    : [];
  return missing
    .map((entry) => String(entry.label || entry.criterion_id || '').trim())
    .filter(Boolean);
}

function missingInformationEntries(...sources) {
  return sources.flatMap((source) => {
    if (Array.isArray(source)) {
      return source;
    }
    return source ? [source] : [];
  });
}

function hasMissingInformationReason(entries, reasonCode) {
  return missingInformationEntries(entries).some((entry) =>
    normaliseCheckId(entry?.reason) === reasonCode ||
    normaliseCheckId(entry?.criterion_id) === reasonCode
  );
}

function isAberdeenProfile(card = {}) {
  return (
    card.course_identity?.profile_id ||
    card.course_profile_id ||
    card.profile_id
  ) === 'aberdeen-a100';
}

function aberdeenReachContextualSummary(card = {}) {
  if (!isAberdeenProfile(card)) {
    return null;
  }
  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  if (
    contextual?.status !== 'contextual' ||
    normaliseCheckId(contextual.matched_contextual_pathway) !== 'reach_program_scotland'
  ) {
    return null;
  }
  return ABERDEEN_REACH_CONTEXTUAL_CONFIRMATION;
}

function hasAberdeenReachContextualReview(card = {}, missingInformation = null) {
  if (!isAberdeenProfile(card)) {
    return false;
  }
  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  if (contextual?.status !== 'information_needed') {
    return false;
  }
  return hasMissingInformationReason(
    missingInformationEntries(
      missingInformation,
      card.missing_information,
      card.decision_transparency?.missing_information,
      contextual.missing_information
    ),
    'reach_program_scotland'
  );
}

function hasCompletedLancasterAccessToMedicine(card = {}) {
  const profile = card.applicant_context?.contextual_profile || card.contextual_profile || {};
  const programmes = profile.access_programmes?.other_programmes;
  if (!Array.isArray(programmes)) {
    return false;
  }
  return programmes.some((programme) =>
    normaliseCheckId(programme?.programme_id) === 'lancaster_access_to_medicine' &&
    normaliseCheckId(programme?.status) === 'completed'
  );
}

function lancasterAccessToMedicineWpReviewReason(card = {}, missingInformation = null) {
  const profileId = card.course_identity?.profile_id || card.course_profile_id;
  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  if (
    profileId !== 'lancaster-a100' ||
    contextual?.status !== 'information_needed' ||
    !hasCompletedLancasterAccessToMedicine(card)
  ) {
    return null;
  }

  const missing = missingInformationEntries(
    missingInformation,
    card.missing_information,
    card.decision_transparency?.missing_information,
    contextual.missing_information
  );
  return hasMissingInformationReason(missing, 'lancaster_other_wp_circumstances_require_manual_review')
    ? LANCASTER_ACCESS_TO_MEDICINE_WP_REVIEW_REASON
    : null;
}

function bristolContextualSummary(card = {}, offer = null) {
  const profileId = card.course_identity?.profile_id || card.course_profile_id;
  if (profileId !== 'bristol-a100') {
    return null;
  }

  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  if (!contextual) {
    return null;
  }

  if (contextual.reason === 'bristol_scholars_tailored_offer_manual_review') {
    return 'Bristol Scholars may receive a tailored offer. The standard Bristol contextual offer of ABB should not be assumed, so this route requires individual review.';
  }

  if (contextual.status === 'contextual') {
    const contextualOfferLabel = 'Bristol contextual offer';
    const gradeSummary = 'ABB, including A in Chemistry and B in an accepted second science or Mathematics subject';
    const contextualGradesMet =
      (card.eligibility?.status || card.eligibility_status) === 'eligible' &&
      (card.academic_pathway || card.eligibility?.academic_pathway) === 'contextual';
    if (contextualGradesMet) {
      return `${contextualOfferLabel}: You meet the published Bristol contextual offer of ${gradeSummary}.`;
    }
    return "Contextual eligibility is confirmed, but your current grades do not meet Bristol's contextual academic requirements.";
  }

  if (contextual.status === 'not_contextual') {
    return 'The information provided does not currently meet Bristol’s published contextual-offer criteria. Your application has therefore been assessed against the standard academic requirements.';
  }

  if (contextual.status === 'information_needed') {
    const missingEvidence = bristolMissingContextualEvidenceList(contextual);
    const evidenceSuffix = missingEvidence.length > 0
      ? ` Missing evidence: ${missingEvidence.join(', ')}.`
      : '';
    return `More information is needed to confirm whether you qualify for Bristol’s contextual offer.${evidenceSuffix}`;
  }

  return null;
}

function contextualOfferRouteSummary(card = {}, offer = null) {
  const bristolSummary = bristolContextualSummary(card, offer);
  if (bristolSummary) {
    return bristolSummary;
  }

  const aberdeenReachSummary = aberdeenReachContextualSummary(card);
  if (aberdeenReachSummary) {
    return aberdeenReachSummary;
  }

  if (!offer || (offer.type !== 'contextual' && offer.type !== 'contextual_epq')) {
    return null;
  }
  const academicPathway = card.academic_pathway ||
    card.eligibility?.academic_pathway ||
    null;
  if (!academicPathway || !String(academicPathway).startsWith('contextual')) {
    return null;
  }

  const presentation = configuredPresentation(card);
  const configuredSummary = String(presentation.contextual_route_summary || '').trim();
  if (configuredSummary) {
    return configuredSummary;
  }

  const standardOffer = String(offer.standard_offer || '').trim();
  const alternativeOffer = String(offer.alternative_offer || '').trim();
  if (!standardOffer || !alternativeOffer) {
    return null;
  }

  const manchesterSummary = manchesterContextualSummary(card);
  const contextualRouteLabel = String(
    card.eligibility?.contextual_eligibility?.matched_contextual_pathway_label || ''
  ).trim();
  const comparison = `Standard offer ${standardOffer}; applied contextual offer ${alternativeOffer}.`;
  if (manchesterSummary) {
    return `${manchesterSummary} ${comparison}`;
  }

  const profileId =
    card.course_identity?.profile_id ||
    card.course_profile_id ||
    card.profile_id ||
    null;
  const guidancePoolId = String(card.guidance_pool_id || card.guidance_pool?.pool_id || '').trim();

  if (isDundeeContextualSchoolLeaverPool(profileId, guidancePoolId)) {
    return null;
  }

  if (contextualRouteLabel) {
    return `Contextual eligibility confirmed: ${contextualRouteLabel}. ${comparison}`;
  }
  return `Contextual eligibility confirmed. ${comparison}`;
}

function isDundeeContextualSchoolLeaverPool(profileId, guidancePoolId) {
  return profileId === 'dundee-a100' && [
    'home_scotland_contextual_school_leaver',
    'home_rest_of_uk_contextual_school_leaver'
  ].includes(String(guidancePoolId || '').trim());
}

function contextualConfirmationFor(card = {}, contextualStatus = null, options = {}) {
  const profileId = card.course_identity?.profile_id || card.profile_id || null;
  if (profileId === 'glasgow-a100' && contextualStatus === 'confirmed') {
    return {
      collapsed_label: 'Glasgow adjusted Scottish route confirmed',
      expanded_heading: 'Glasgow adjusted Scottish route confirmed',
      consideration_label: 'Adjusted Scottish route:',
      expanded_body:
        "ApplySmart applied Glasgow's adjusted/contextual Scottish academic route because Glasgow contextual eligibility and successful completion of Reach were confirmed. Reach completion alone does not make an applicant contextual."
    };
  }
  if (
    profileId === 'lancaster-a100' &&
    contextualStatus === 'confirmed' &&
    options.guaranteedInterview !== true
  ) {
    return { ...LANCASTER_CONTEXTUAL_CONFIRMATION };
  }
  if (profileId === 'liverpool-a100' && contextualStatus === 'confirmed') {
    const gcsePointsCheck = (card.eligibility?.checks || [])
      .find((check) => normaliseCheckId(check?.check_id || check?.check) === 'gcse_points');
    const contextualGcseThresholdApplied = Number(gcsePointsCheck?.required) === 12;
    const gcseSentence = contextualGcseThresholdApplied
      ? " ApplySmart applied Liverpool's 12-point contextual GCSE threshold instead of the standard 15-point threshold; mandatory English Language, Mathematics and required science grades still apply."
      : '';
    return {
      ...LIVERPOOL_CONTEXTUAL_CONFIRMATION,
      expanded_body: `${LIVERPOOL_CONTEXTUAL_CONFIRMATION.expanded_body}${gcseSentence}`
    };
  }
  const guidancePoolId = String(card.guidance_pool_id || card.guidance_pool?.pool_id || '').trim();
  if (contextualStatus === 'confirmed' && isDundeeContextualSchoolLeaverPool(profileId, guidancePoolId)) {
    return {
      collapsed_label: 'Dundee contextual route confirmed',
      expanded_heading: 'Contextual Route',
      expanded_body: "You meet Dundee's contextual admissions criteria and widening-access academic requirements."
    };
  }
  return null;
}

// Historical cycle year fields are not standardised across university JSON:
// most use a numeric entry_year, but several use a string cycle/entry_cycle
// field ("2025 entry", "2023_entry", "2023/24", "2025 entry for 2026
// places"). Extracts the first 4-digit year from whichever field is present
// so those universities' historical data is matched at all, instead of
// silently sorting to 0 and being dropped.
function extractCycleYear(entry) {
  const raw = entry.entry_year ?? entry.cycle ?? entry.entry_cycle;
  if (Number.isFinite(raw)) {
    return raw;
  }
  const match = String(raw ?? '').match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

// A cycle entry's UCAT figures are only safe to show on the applicant's
// current 2700 scale if the entry itself says so - many universities retain
// pre-2025 3600-scale rows (four-cognitive-subtest UCAT) alongside current
// 2700-scale rows (three-cognitive-subtest UCAT) in the same cycles array,
// and rendering the former unconverted next to a 2700-scale applicant score
// would misrepresent a historical figure as a current one. Resolves to
// true/false/null (unknown - treated as unsafe) from whichever scale field
// the entry uses (score_scale/ucat_scale/ucat_score_scale, numeric or a
// descriptive string).
function cycleScaleIs2700(figures) {
  const scaleValue = figures.score_scale ?? figures.ucat_scale ?? figures.ucat_score_scale;
  if (scaleValue === 2700) return true;
  if (scaleValue === 3600) return false;
  const text = String(scaleValue ?? '').toLowerCase();
  if (!text) return null;
  if (text.includes('3600') || text.includes('legacy')) return false;
  if (text.includes('2700')) return true;
  return null;
}

// Some universities already publish an explicit, audited conversion of a
// legacy 3600-scale figure to the current 2700 scale (e.g. Manchester's
// documented conversion_policy formula, or Glasgow/Aston's precomputed
// *_converted_2700 fields) - those are safe to show as-is. Absent one, a
// UCAT figure is only shown when the entry's own scale unambiguously
// resolves to 2700; otherwise it is omitted rather than guessed at or
// converted with an unaudited formula.
function safeUcatCutoff(figures) {
  const alreadyConverted =
    figures.converted_historical_interview_threshold_2700 ??
    figures.converted_score_2700 ??
    figures.lowest_ucat_converted_2700 ??
    figures.average_ucat_converted_2700;
  if (Number.isFinite(alreadyConverted)) {
    return alreadyConverted;
  }

  if (cycleScaleIs2700(figures) !== true) {
    return null;
  }

  return figures.interview_ucat_cutoff ?? figures.ucat_cutoff ?? figures.lowest_interviewed_ucat ?? figures.minimum_combined_score ?? null;
}

// Renders a single historical-admissions cycle entry (applications/interviews/
// offers/places/UCAT cutoff figures) as a human-readable check, with no
// interpretation — this is already-structured official/FOI evidence. UCAT
// figures are scale-gated by safeUcatCutoff so a legacy 3600-scale value is
// never shown unconverted beside the applicant's current 2700-scale score;
// non-scale figures (applications/interviews/offers/places) are unaffected
// and still render even when the UCAT figure must be omitted.
function formatAdmissionsNumber(value) {
  return Number(value).toLocaleString('en-GB');
}

function formatMetricDisplayValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(3)).toString();
}

function formatMetricDifference(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const formatted = formatMetricDisplayValue(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function humaniseMetricKey(value) {
  const normalised = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalised ? normalised.charAt(0).toUpperCase() + normalised.slice(1) : '';
}

function historicalMetricSubject(figures = {}) {
  const text = [
    figures.metric,
    figures.metric_type,
    ...Object.keys(figures || {})
  ].join(' ').toLowerCase();

  if (text.includes('gamsat')) return 'GAMSAT';
  if (text.includes('ucat') || text.includes('score')) return 'UCAT';
  return null;
}

function historicalMetricLabel(figures = {}) {
  const metric = figures.metric || figures.metric_type || null;
  if (!metric) {
    return null;
  }

  const subject = historicalMetricSubject(figures);
  return [humaniseMetricKey(metric), subject].filter(Boolean).join(' ');
}

function historicalMetricValue(figures = {}) {
  const explicitDisplay =
    figures.display_score_2700 ??
    figures.display_value ??
    figures.display_score ??
    null;
  if (Number.isFinite(explicitDisplay)) {
    return explicitDisplay;
  }

  const convertedOrSafe = safeUcatCutoff(figures);
  if (Number.isFinite(convertedOrSafe)) {
    return convertedOrSafe;
  }

  const metric = String(figures.metric || figures.metric_type || '').toLowerCase();
  const metricCandidates = Object.entries(figures || [])
    .filter(([key, value]) => (
      Number.isFinite(value) &&
      key !== 'entry_year' &&
      key !== 'original_score' &&
      key !== 'original_scale' &&
      key !== 'score_scale' &&
      key !== 'ucat_scale' &&
      key !== 'ucat_score_scale' &&
      key.toLowerCase().includes(metric)
    ));

  return metricCandidates[0]?.[1] ?? null;
}

function joinAdmissionsParts(parts, summaryStyle = null) {
  if (summaryStyle !== 'recent_admissions_sentence' || parts.length < 2) {
    return parts.join(', ');
  }
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function historicalCycleCheck(entryYear, groupLabel, figures, options = {}) {
  const parts = [];
  const applications = figures.applications ?? figures.applicants_approx;
  const interviews = figures.interviews ?? figures.invited_approx;
  const offers = figures.offers;
  const places = figures.places;
  const ucatCutoff = safeUcatCutoff(figures);
  const rawUcatCutoff =
    figures.interview_ucat_cutoff ??
    figures.ucat_cutoff ??
    figures.lowest_interviewed_ucat ??
    null;
  const rawUcatScale = figures.score_scale ?? figures.ucat_scale ?? figures.ucat_score_scale;
  const combinedScore = figures.minimum_combined_score ?? figures.combined_cutoff ?? null;
  const combinedScale = figures.combined_score_scale ?? figures.score_out_of ?? null;
  const metricLabel = historicalMetricLabel(figures);
  const metricValue = historicalMetricValue(figures);

  if (options.summaryStyle === 'recent_admissions_sentence') {
    if (Number.isFinite(applications)) parts.push(`approximately ${formatAdmissionsNumber(applications)} applicants`);
    if (Number.isFinite(interviews)) parts.push(`${formatAdmissionsNumber(interviews)} interviewed`);
    if (Number.isFinite(offers)) parts.push(`${formatAdmissionsNumber(offers)} offers`);
  } else {
    if (Number.isFinite(applications)) parts.push(`~${applications} applicants`);
    if (Number.isFinite(interviews)) parts.push(`~${interviews} interviewed`);
    if (Number.isFinite(offers)) parts.push(`~${offers} offers`);
  }
  if (Number.isFinite(places)) parts.push(`~${places} places`);
  if (metricLabel && Number.isFinite(metricValue)) {
    parts.push(`${metricLabel} ${formatMetricDisplayValue(metricValue)} (2700 scale)`);
  } else if (Number.isFinite(ucatCutoff)) {
    parts.push(`UCAT interview threshold ~${ucatCutoff} (2700 scale)`);
  }
  const originalScaleDisplayAllowed =
    figures.display_original_scale === true ||
    String(figures.use || '').includes('display_only_original_scale') ||
    String(figures.display_policy || '').includes('display_only_original_scale');
  if (
    originalScaleDisplayAllowed &&
    !metricLabel &&
    !Number.isFinite(ucatCutoff) &&
    Number.isFinite(rawUcatCutoff)
  ) {
    const scaleText = rawUcatScale ? ` (${rawUcatScale} scale, display only)` : ' (display only)';
    parts.push(`UCAT interview threshold ${rawUcatCutoff}${scaleText}`);
  }
  if (Number.isFinite(combinedScore)) {
    const scaleText = Number.isFinite(combinedScale) ? `/${combinedScale}` : '';
    parts.push(`combined-score threshold ${combinedScore}${scaleText} (display only)`);
  }

  if (parts.length === 0) {
    return null;
  }

  return check(
    options.label || groupLabel,
    'Historical',
    joinAdmissionsParts(parts, options.summaryStyle) + '.'
  );
}

// Renders the university's own historical_admissions JSON directly, with no
// interpretation — this is already-structured official/FOI evidence, not
// derived or invented. Most universities store a top-level `cycles` array
// (applications/interviews/offers/places per applicant group per entry
// year); a smaller number instead nest observed_cycles.groups under
// pre_interview_thresholds — both are supported.
function filterHistoricalEntriesForApplicant(entries, groupIds = []) {
  const groups = new Set(groupIds || []);
  const isInternational = groups.has('international_fee');
  const isHome = groups.has('home_fee') && !isInternational;

  if (!isInternational && !isHome) {
    return entries;
  }

  const exactGroupMatches = entries.filter((entry) =>
    historicalEntryMatchesApplicantGroups(entry, groups)
  );
  if (exactGroupMatches.length > 0) {
    return exactGroupMatches;
  }

  const matching = entries.filter((entry) => {
    const feeStatus = String(entry.fee_status || entry.applicant_group_id || '').toLowerCase();
    const anyGroupIds = [
      ...(entry.any_group_ids || []),
      ...(entry.applies_to_group_ids || [])
    ];
    if (isInternational) {
      return feeStatus.includes('international') || anyGroupIds.includes('international_fee');
    }
    return (
      feeStatus.includes('home') ||
      anyGroupIds.includes('home_fee') ||
      (!feeStatus.includes('international') && !anyGroupIds.includes('international_fee'))
    );
  });

  return matching;
}

function normaliseHistoricalApplicantGroupId(value) {
  const groupId = normaliseCheckId(value);
  if (groupId === 'home') return 'home_fee';
  if (groupId === 'international') return 'international_fee';
  return groupId;
}

function historicalEntryMatchesApplicantGroups(entry = {}, groups = new Set()) {
  const requiredGroupIds = (Array.isArray(entry.applicant_group_ids) && entry.applicant_group_ids.length > 0
    ? entry.applicant_group_ids
    : entry.applies_to_group_ids || []
  )
    .map(normaliseHistoricalApplicantGroupId)
    .filter(Boolean);
  if (requiredGroupIds.length > 0) {
    return requiredGroupIds.every((groupId) => groups.has(groupId));
  }

  const anyGroupIds = (entry.any_group_ids || [])
    .map(normaliseHistoricalApplicantGroupId)
    .filter(Boolean);
  if (anyGroupIds.length > 0) {
    return anyGroupIds.some((groupId) => groups.has(groupId));
  }

  const applicantGroupId = normaliseHistoricalApplicantGroupId(entry.applicant_group_id);
  return Boolean(applicantGroupId) && groups.has(applicantGroupId);
}

function historicalAdmissionsChecks(historicalAdmissions, groupIds = []) {
  if (!historicalAdmissions) {
    return [];
  }

  const cycles = historicalAdmissions.cycles;
  if (Array.isArray(cycles) && cycles.length > 0) {
    const years = cycles.map(extractCycleYear).filter(Number.isFinite);
    const mostRecentYear = years.length > 0 ? Math.max(...years) : null;
    if (mostRecentYear === null) {
      return [];
    }
    const mostRecentEntries = filterHistoricalEntriesForApplicant(
      cycles.filter((c) => extractCycleYear(c) === mostRecentYear),
      groupIds
    );

    return mostRecentEntries
      .map((entry) => {
        const feeLabel = titleCaseGroupLabel(
          entry.fee_status || entry.applicant_group_id || (entry.any_group_ids || [])[0] || 'All applicants'
        );
        // A fee status (e.g. "Home") can have multiple distinct rows in the
        // same year - different applicant pools (graduate / predicted
        // A-level / achieved A-level) with very different figures. Fold the
        // pool into the label so those rows aren't shown as identical
        // duplicates of each other.
        const groupLabel = entry.pool ? `${feeLabel} – ${titleCaseGroupLabel(entry.pool)}` : feeLabel;
        return historicalCycleCheck(mostRecentYear, groupLabel, entry, {
          label: historicalAdmissions.public_recent_label || null,
          summaryStyle: historicalAdmissions.public_summary_style || null
        });
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  const observedCycles = historicalAdmissions.pre_interview_thresholds?.observed_cycles;
  if (Array.isArray(observedCycles) && observedCycles.length > 0) {
    const mostRecent = [...observedCycles].sort((a, b) => (b.entry_year || 0) - (a.entry_year || 0))[0];
    const groups = mostRecent?.groups || {};

    return Object.entries(groups)
      .map(([groupId, figures]) => historicalCycleCheck(mostRecent.entry_year, titleCaseGroupLabel(groupId), figures))
      .filter(Boolean)
      .slice(0, 4);
  }

  return [];
}

function hasPublicUcatHistoricalComparison(comparison) {
  return Boolean(
    comparison &&
      comparison.comparison_type !== 'ranking_only' &&
      Number.isFinite(comparison.applicant_ucat)
  );
}

function applicantUcatForComparison(options = {}, ucatComparison = null) {
  const applicantUcat =
    ucatComparison?.applicant_ucat ??
    options.applicantContext?.admissions_tests?.ucat?.total_score;
  return Number.isFinite(applicantUcat) ? applicantUcat : null;
}

function historicalAdmissionComparisonMetrics(historicalAdmissions, groupIds = [], options = {}, ucatComparison = null) {
  if (!historicalAdmissions) {
    return [];
  }

  const cycles = historicalAdmissions.cycles;
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return [];
  }

  const years = cycles.map(extractCycleYear).filter(Number.isFinite);
  const mostRecentYear = years.length > 0 ? Math.max(...years) : null;
  if (mostRecentYear === null) {
    return [];
  }

  const applicantUcat = applicantUcatForComparison(options, ucatComparison);
  return filterHistoricalEntriesForApplicant(
    cycles.filter((c) => extractCycleYear(c) === mostRecentYear),
    groupIds
  )
    .map((entry) => {
      const label = historicalMetricLabel(entry, mostRecentYear);
      const value = historicalMetricValue(entry);
      if (!label || !Number.isFinite(value)) {
        return null;
      }
      return {
        label,
        value: formatMetricDisplayValue(value),
        difference: Number.isFinite(applicantUcat) ? formatMetricDifference(applicantUcat - value) : null
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

// Human labels for the score_model component_id values used across
// data/interview-band-configs/*.json (see interview-band-classifier.js's
// calculateScore/calculateComponent). Matched by substring against the
// component_id so new universities using the same naming convention
// (gcse_*, ucat_*, sjt_*, contextual_*, academic_*) get a readable label
// without a per-university entry.
const SCORE_COMPONENT_LABEL_PATTERNS = [
  [/achieved/i, 'Achieved-grade uplift'],
  [/wp|widening/i, 'Contextual uplift'],
  [/contextual/i, 'Contextual uplift'],
  [/gcse/i, 'GCSE score'],
  [/academic/i, 'Academic score'],
  [/grade/i, 'Grade profile score'],
  [/ucat/i, 'UCAT score'],
  [/sjt/i, 'SJT score']
];

function humanScoreComponentLabel(componentId) {
  const match = SCORE_COMPONENT_LABEL_PATTERNS.find(([pattern]) => pattern.test(componentId || ''));
  return match ? match[1] : titleCaseGroupLabel(componentId);
}

// Renders one calculated score component ({value, max, ...}) as a check.
// Values/maxima are read directly off the engine's own output - nothing is
// invented or recalculated here.
function scoreComponentCheck(label, component) {
  if (!component) {
    return null;
  }
  if (component.applicable === false) {
    return null;
  }
  if (component.max === 0 && component.value === 0) {
    return null;
  }
  if (!Number.isFinite(component.value)) {
    return check(label, 'Not available', component.reason
      ? studentFacingText(String(component.reason).replace(/_/g, ' '))
      : 'This component could not be calculated from the information supplied.');
  }
  const maxText = Number.isFinite(component.max) ? ` out of ${formatScorePoints(component.max)}` : '';
  return check(label, 'Counted', `${formatScorePoints(component.value)}${maxText}.`);
}

// Hull York contextual points are shown as not applied when unavailable, but
// keep the approved numeric score row when contextual points are counted.
function contextualScoreComponentCheck(component) {
  if (!component || !component.applicable) {
    return null;
  }
  if (component.value === 0) {
    return check(
      'Contextual points',
      'Not applied',
      'Not applied based on the information provided.'
    );
  }
  return scoreComponentCheck('Contextual score', component);
}

// Builds a generic score breakdown from whichever already-computed engine
// score shape is present for this university - the generic component_sum
// ranking (interview-band-classifier.js calculateScore), the Nottingham
// consumer's official_score, or the Hull York consumer's unofficial
// estimated_selection_score. Returns null when the university has no
// combined score model (ranking/cut-off-only universities), so the caller
// can fall back to ranking-only evidence instead.
function buildScoreBreakdown(options = {}) {
  if (options.officialScore) {
    const score = options.officialScore;
    const components = score.components || {};
    const checks = [
      scoreComponentCheck('GCSE score', components.gcse),
      scoreComponentCheck('UCAT cognitive score', components.ucat_cognitive),
      scoreComponentCheck('SJT score', components.sjt)
    ].filter(Boolean);
    return {
      name: 'Official Nottingham pre-interview score',
      value: Number.isFinite(score.value) ? score.value : null,
      max: Number.isFinite(score.max) ? score.max : null,
      status: score.status,
      explanation: score.explanation || null,
      checks
    };
  }

  if (options.estimatedSelectionScore) {
    const score = options.estimatedSelectionScore;
    const components = score.components || {};
    const checks = [
      scoreComponentCheck('GCSE score', components.gcse),
      scoreComponentCheck('UCAT score', components.ucat),
      scoreComponentCheck('SJT score', components.sjt),
      contextualScoreComponentCheck(components.contextual)
    ].filter(Boolean);
    return {
      name: score.label || 'Estimated selection score',
      value: Number.isFinite(score.value) ? score.value : null,
      max: Number.isFinite(score.max) ? score.max : null,
      status: score.status,
      explanation: score.disclosure || null,
      unofficial: score.official === false,
      checks
    };
  }

  const ranking = options.ranking;
  const scoreModel = options.scoreModel;
  // calculatePoolRanking() returns a raw UCAT/GAMSAT ranking (empty
  // `components: {}`) instead of the university's component_sum score
  // whenever the matched guidance pool ranks by admissions-test total rather
  // than the whole-university formula (score_model.pool_specific_output is
  // true for that pool's metric). scoreModel.type is a static, university-
  // level field and stays 'component_sum' even then, so it cannot be used
  // alone to decide whether to render a combined score - checking for real
  // components is what distinguishes an actual calculated score from a pool
  // that was deliberately routed away from the whole-university formula.
  const rankingIsComponentSum = Object.keys(ranking?.components || {}).length > 0;
  if (ranking && scoreModel?.type === 'component_sum' && rankingIsComponentSum && ranking.status === 'calculated') {
    const checks = Object.entries(ranking.components || {})
      .map(([componentId, component]) => scoreComponentCheck(humanScoreComponentLabel(componentId), component))
      .filter(Boolean);
    const capExplanation =
      ranking.cap_applied === true &&
      Number.isFinite(ranking.uncapped_value) &&
      Number.isFinite(ranking.selection_score_cap)
        ? ` Raw component total was ${ranking.uncapped_value}; final selection score is capped at ${ranking.selection_score_cap}.`
        : '';
    const breakdown = {
      name: scoreModel.label || 'Selection score',
      value: Number.isFinite(ranking.value) ? ranking.value : null,
      max: Number.isFinite(ranking.max) ? ranking.max : null,
      status: ranking.status,
      explanation: ranking.basis || capExplanation ? `${ranking.basis || ''}${capExplanation}` : null,
      checks
    };
    if (Number.isFinite(ranking.uncapped_value)) {
      breakdown.uncapped_value = ranking.uncapped_value;
      breakdown.selection_score_cap = Number.isFinite(ranking.selection_score_cap)
        ? ranking.selection_score_cap
        : null;
      breakdown.cap_applied = ranking.cap_applied === true;
    }
    if (Number.isFinite(ranking.applicable_max_score)) {
      breakdown.applicable_max_score = ranking.applicable_max_score;
      breakdown.selection_score_max = ranking.selection_score_max ?? ranking.applicable_max_score;
      breakdown.global_max = ranking.global_max ?? scoreModel.scale?.max ?? null;
    }
    return breakdown;
  }

  // The engine can return status: 'unavailable' for a component_sum university
  // when required scoring inputs are missing (e.g. incomplete GCSE grades) -
  // this is distinct from a ranking-only university with no combined score at
  // all, so it must not fall through to buildRankingEvidence's "this
  // university does not publish a combined points score" message, which
  // would be actively wrong for a university that does publish one.
  if (ranking && scoreModel?.type === 'component_sum' && rankingIsComponentSum && ranking.status === 'unavailable') {
    const checks = Object.entries(ranking.components || {})
      .map(([componentId, component]) => scoreComponentCheck(humanScoreComponentLabel(componentId), component))
      .filter(Boolean);
    const breakdown = {
      name: scoreModel.label || 'Selection score',
      value: null,
      max: Number.isFinite(ranking.max) ? ranking.max : null,
      status: ranking.status,
      explanation: ranking.basis || null,
      reason: ranking.reason || null,
      checks
    };
    if (Number.isFinite(ranking.applicable_max_score)) {
      breakdown.applicable_max_score = ranking.applicable_max_score;
      breakdown.selection_score_max = ranking.selection_score_max ?? ranking.applicable_max_score;
      breakdown.global_max = ranking.global_max ?? scoreModel.scale?.max ?? null;
    }
    return breakdown;
  }

  return null;
}

// For universities with no combined score model (ranking_metric-only, or a
// component_sum whose pool bypasses it via raw UCAT/GAMSAT ranking), render
// what selection is actually based on: the UCAT/GAMSAT figure used for
// ranking, and the SJT band, both already on the applicant/engine output.
// No thresholds or unofficial data are invented here.
function buildRankingEvidence(options = {}) {
  const bandMetric = options.bandMetric;
  const applicant = options.applicantContext;
  const ucat = applicant?.admissions_tests?.ucat;
  const gamsat = applicant?.admissions_tests?.gamsat;
  const ucatComparison = options.ucatComparison;
  const ucatRankingBypass = ucatRankingBypassApplies(options);
  const usesAberdeenAdjustedSelectionUcat =
    bandMetric?.metric === 'aberdeen_adjusted_selection_ucat_total';
  const adjustedSelectionUcatApplied =
    usesAberdeenAdjustedSelectionUcat &&
    Number.isFinite(options.ranking?.total_uplift_percent) &&
    options.ranking.total_uplift_percent > 0;

  const checks = [];
  if (ucatRankingBypass) {
    const applicantUcat = Number.isFinite(bandMetric?.value)
      ? bandMetric.value
      : ucat?.total_score;
    const max = Number.isFinite(bandMetric?.scale?.max)
      ? bandMetric.scale.max
      : (ucat?.score_scale ?? 2700);
    const officialMinimum = resolveApplicantUcatMinimum(
      options.stage1Eligibility,
      options.applicantGroupIds
    );
    if (Number.isFinite(officialMinimum)) {
      const met = Number.isFinite(applicantUcat) && applicantUcat >= officialMinimum;
      checks.push(check(
        'UCAT minimum',
        met ? 'Met' : 'Not met',
        Number.isFinite(applicantUcat)
          ? `Your total UCAT cognitive score is ${applicantUcat} / ${max}. Minimum total ${officialMinimum} / ${max}.`
          : `Minimum total ${officialMinimum} / ${max}.`
      ));
    } else if (Number.isFinite(applicantUcat)) {
      checks.push(check('UCAT total entered', 'Minimum gate only', `${applicantUcat} out of ${max}.`));
    }
    if (ucat?.sjt_band !== undefined && ucat?.sjt_band !== null) {
      checks.push(check('SJT band', 'On file', `Band ${ucat.sjt_band}.`));
    }
    checks.push(check(
      'Selection approach',
      'Ranking bypassed',
      options.selectionSummary ||
        'UCAT is used as a minimum eligibility gate for this route; competitive UCAT ranking does not apply.'
    ));
    return checks;
  }

  if (adjustedSelectionUcatApplied && Number.isFinite(ucat?.total_score)) {
    checks.push(check(
      'Your UCAT',
      'Preserved',
      `${ucat.total_score} out of ${ucat.score_scale ?? 2700}.`
    ));
    checks.push(check(
      'Contextual uplift',
      'Applied',
      `+${options.ranking.total_uplift_percent}%${
        publicUcatUpliftReasonLabel(options.ranking.applied_uplift || {})
          ? ` (${publicUcatUpliftReasonLabel(options.ranking.applied_uplift || {})})`
          : ''
      }.`
    ));
    checks.push(check(
      'Aberdeen adjusted selection UCAT',
      'Used for ranking',
      `${bandMetric.value} out of ${bandMetric.scale?.max ?? ucat.score_scale ?? 2700}.`
    ));
  }
  if (ucatComparison?.official_ucat_minimum) {
    checks.push(check(
      'UCAT minimum',
      ucatComparison.official_ucat_minimum.met ? 'Met' : 'Not met',
      ucatComparison.official_ucat_minimum.summary
    ));
  }
  if (ucatComparison) {
    checks.push(check(
      usesAberdeenAdjustedSelectionUcat ? 'Aberdeen adjusted selection UCAT' : 'UCAT',
      usesAberdeenAdjustedSelectionUcat && adjustedSelectionUcatApplied
        ? 'Compared'
        : ucatComparison.position ? titleCaseGroupLabel(ucatComparison.position) : 'Ranking only',
      ucatComparisonAssessmentText(ucatComparison)
    ));
    checks.push(check(
      'SJT requirement',
      titleCaseGroupLabel(ucatComparison.sjt_outcome),
      ucatComparison.sjt_summary
    ));
  } else
  if (bandMetric?.metric === 'gamsat_total' && Number.isFinite(bandMetric.value)) {
    checks.push(check('GAMSAT total entered', 'Used for ranking', `${bandMetric.value}${Number.isFinite(bandMetric.scale?.max) ? ` out of ${bandMetric.scale.max}` : ''}.`));
  } else if (Number.isFinite(bandMetric?.value) || Number.isFinite(ucat?.total_score)) {
    const value = Number.isFinite(bandMetric?.value) ? bandMetric.value : ucat.total_score;
    const max = Number.isFinite(bandMetric?.scale?.max) ? bandMetric.scale.max : (ucat?.score_scale ?? 2700);
    checks.push(check(
      'UCAT total entered',
      usesAberdeenAdjustedSelectionUcat ? 'Used for ranking without uplift' : 'Used for ranking',
      `${value} out of ${max}.`
    ));
  } else if (Number.isFinite(gamsat?.overall_score)) {
    checks.push(check('GAMSAT total entered', 'On file', `${gamsat.overall_score}${Number.isFinite(gamsat.score_scale) ? ` out of ${gamsat.score_scale}` : ''}.`));
  }

  if (!ucatComparison && ucat?.sjt_band !== undefined && ucat?.sjt_band !== null) {
    checks.push(check('SJT band', 'On file', `Band ${ucat.sjt_band}.`));
  }

  checks.push(check(
    'Selection approach',
    'Ranking/cut-off based',
    options.selectionSummary ||
      'This university does not publish a combined points score; eligible applicants are ranked against the admissions-test total (or a published cut-off), not a calculated score.'
  ));

  return checks;
}

function publicUcatUpliftReasonLabel(uplift = {}) {
  const reason = normaliseCheckId(uplift.reason || uplift.reason_label || uplift.uplift_reason || '');
  if (reason.includes('simd20') || reason.includes('simd_quintile_1')) {
    return 'SIMD20';
  }
  if (reason.includes('simd40') || reason.includes('simd_quintile_2')) {
    return 'SIMD40';
  }
  if (reason.includes('care')) {
    return 'Care experienced';
  }
  return uplift.reason_label || uplift.uplift_reason_label || null;
}

function buildUcatAdjustmentPresentation(options = {}) {
  if (options.bandMetric?.metric !== 'aberdeen_adjusted_selection_ucat_total') {
    return null;
  }

  const upliftPercent = Number(options.ranking?.total_uplift_percent);
  if (!Number.isFinite(upliftPercent) || upliftPercent <= 0) {
    return null;
  }

  const rawUcat = Number.isFinite(options.ranking?.raw_value)
    ? options.ranking.raw_value
    : options.applicantContext?.admissions_tests?.ucat?.total_score;
  const adjustedUcat = Number.isFinite(options.bandMetric?.value)
    ? options.bandMetric.value
    : options.ranking?.value;
  if (!Number.isFinite(rawUcat) || !Number.isFinite(adjustedUcat)) {
    return null;
  }

  const maxUcat = Number.isFinite(options.bandMetric?.scale?.max)
    ? options.bandMetric.scale.max
    : options.applicantContext?.admissions_tests?.ucat?.score_scale ?? 2700;
  const reasonLabel = publicUcatUpliftReasonLabel(options.ranking?.applied_uplift || {});

  return {
    raw_ucat: rawUcat,
    max_ucat: Number.isFinite(maxUcat) ? maxUcat : null,
    uplift_percent: upliftPercent,
    uplift_reason: options.ranking?.applied_uplift?.reason || null,
    uplift_reason_label: reasonLabel,
    adjusted_selection_ucat: adjustedUcat,
    label: 'Aberdeen adjusted selection UCAT',
    summary: [
      `Your UCAT: ${rawUcat}.`,
      `Contextual uplift: +${upliftPercent}%${reasonLabel ? ` (${reasonLabel})` : ''}.`,
      `Aberdeen adjusted selection UCAT: ${adjustedUcat}.`
    ].join(' ')
  };
}

function eligibilityChecksFromFailureCodes(checks, failures) {
  const failureChecks = (failures || [])
    .map((code) => {
      const label = humanFailureLabel(code);
      return label ? check('Entry requirement', 'Not met', label) : null;
    })
    .filter(Boolean);

  if (failureChecks.length > 0) {
    return failureChecks;
  }

  return (checks || [])
    .filter((entry) => entry && entry.status === 'pass')
    .slice(0, 4)
    .map((entry) => check('Entry requirement', 'Met', 'This requirement was assessed and met.'));
}

function studentFacingText(value) {
  return String(value || '')
    .replace(/\boffer outcome\b/gi, 'post-interview decision')
    .replace(/\boffer[- ]?(prediction|probability|likelihood|chance)\b/gi, 'post-interview assessment');
}

function optionalDisplayText(value) {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact || null;
}

function selectionApproachForContext(value, context = {}) {
  const simple = optionalDisplayText(value);
  if (simple) return simple;
  if (!value || typeof value !== 'object') return null;

  const selectionRouteId = optionalDisplayText(context.selection_route_id);
  const bySelectionRoute = value.by_selection_route;
  if (selectionRouteId && bySelectionRoute && typeof bySelectionRoute === 'object') {
    const routeText = optionalDisplayText(bySelectionRoute[selectionRouteId]);
    if (routeText) return routeText;
  }

  const poolIds = [
    context.guidance_pool_id,
    context.guidance_pool?.pool_id
  ]
    .map(optionalDisplayText)
    .filter(Boolean);
  const byApplicantPool = value.by_applicant_pool;
  if (byApplicantPool && typeof byApplicantPool === 'object') {
    for (const poolId of poolIds) {
      const poolText = optionalDisplayText(byApplicantPool[poolId]);
      if (poolText) return poolText;
    }
  }

  return optionalDisplayText(value.default);
}

function studentFacingEligibilityChecks(card, options = {}) {
  const checks = card.eligibility?.stage_1_checks || [];

  if (checks.length === 0) {
    const genericChecks = eligibilityChecksFromFailureCodes(
      options.eligibilityChecks,
      options.eligibilityFailures
    );
    if (genericChecks.length > 0) {
      return genericChecks;
    }

    return [
      check(
        'Entry requirements',
        isNotEligible(card) ? 'Not met' : 'Met',
        studentFacingText(card.eligibility?.summary) ||
          'The supported entry requirements have been assessed.'
      )
    ];
  }

  return checks.slice(0, 4).map((entry) => {
    const rawStatus = String(entry.status || entry.decision_outcome || '').toLowerCase();
    const status = rawStatus.includes('manual')
      ? 'Confirmed'
      : rawStatus.includes('not_applicable')
        ? 'Not applicable'
        : rawStatus.includes('not_used') || rawStatus.includes('not_considered')
          ? 'Not used'
          : rawStatus.includes('fail') || rawStatus.includes('not_eligible')
            ? 'Not met'
            : 'Met';
    const details = [entry.requirement, entry.applicant_value]
      .filter(Boolean)
      .map(studentFacingText)
      .join(' Applicant information: ');

    return check(entry.label || 'Entry requirement', status, details || 'This requirement was assessed.');
  });
}

function getProfileId(card) {
  return card.course_identity?.profile_id || card.engine_notes?.generated_from_profile_id || null;
}

function isNotEligible(card) {
  return (
    card.eligibility?.status === 'not_eligible' ||
    card.prediction?.result_band === 'not_eligible' ||
    card.display?.recommendation_display_state === 'not_eligible'
  );
}

function officialPredictionUnavailable(card = {}, options = {}) {
  const officialPrediction =
    options.officialPrediction ||
    card.prediction?.official_prediction ||
    card.official_prediction ||
    null;
  return Boolean(
    officialPrediction?.available === false ||
      card.prediction?.prediction_status === 'prediction_unavailable'
  );
}

function isManualReview(card, options) {
  return Boolean(
    options.manualReviewRequired ||
      card.eligibility?.status === 'manual_review' ||
      card.display?.recommendation_display_state === 'manual_review'
  );
}

function isInsufficientEvidence(card) {
  return (
    card.eligibility?.status === 'insufficient_evidence' ||
    card.prediction?.result_band === 'insufficient_evidence' ||
    card.display?.recommendation_display_state === 'insufficient_evidence' ||
    (!card.prediction?.available && !isNotEligible(card) && !officialPredictionUnavailable(card))
  );
}

function isEligibilityOnlyContext(card = {}, options = {}) {
  const readiness = options.readiness || card.readiness || card.engine_notes || {};
  return (
    card.prediction?.prediction_type === 'eligibility_only' ||
    card.prediction?.result_band === 'eligible_to_apply' ||
    card.display?.recommendation_display_state === 'eligibility_only' ||
    readiness.assessment_mode === 'eligibility_only' ||
    readiness.eligibility_only_ready === true ||
    options.scoreModel?.assessment_mode === 'eligibility_only'
  );
}

function applicantRouteFlags(card, options) {
  const applicant = options.applicantContext || card.applicant_context || {};
  const groupIds = applicant.applies_to_group_ids || [];
  const feeCohort = String(applicant.fee_cohort || '').toLowerCase();
  const entryRoute = String(
    applicant.entry_route || applicant.qualification_route || ''
  ).toLowerCase();

  return {
    contextual: Boolean(
      applicant.contextual ||
      applicant.widening_participation ||
      groupIds.some((groupId) => /contextual|widening/.test(String(groupId)))
    ),
    graduate: Boolean(
      applicant.graduate ||
      applicant.graduate_applicant ||
      /graduate/.test(entryRoute) ||
      groupIds.some((groupId) => /graduate/.test(String(groupId)))
    ),
    international: Boolean(
      applicant.international ||
      /international|overseas/.test(feeCohort) ||
      groupIds.some((groupId) => /international|overseas/.test(String(groupId)))
    )
  };
}

function buildEvidenceConfidence(card, options = {}) {
  const manualReview = isManualReview(card, options);
  const insufficientEvidence =
    !manualReview && isInsufficientEvidence(card);
  const insufficientEvidenceReasonCode =
    options.insufficientEvidenceReasonCode ||
    card.decision_transparency?.insufficient_evidence_reason_code ||
    null;
  const applicantInformationGap = isApplicantInformationReasonCode(insufficientEvidenceReasonCode);
  const readiness = options.readiness || card.readiness || card.engine_notes || {};
  const route = applicantRouteFlags(card, options);
  const routeEvidenceGap =
    (route.contextual && readiness.contextual_logic === false) ||
    (route.international && readiness.international_prediction === false) ||
    (route.graduate && readiness.manual_review_required === true);
  const coreEvidenceUnavailable =
    readiness.eligibility === false ||
    readiness.interview_prediction === false ||
    readiness.historical_guidance === false;

  if (!manualReview && officialPredictionUnavailable(card, options)) {
    const officialPrediction =
      options.officialPrediction ||
      card.prediction?.official_prediction ||
      card.official_prediction ||
      null;
    return {
      level: 'Medium',
      summary: 'Official eligibility evidence is available, but the official interview prediction is unavailable from public current-cycle data.',
      reasons: [
        'Official eligibility rules are available.',
        officialPrediction?.explanation ||
          'The university has not published enough current-cycle information for ApplySmart to reproduce the official interview prediction.'
      ]
    };
  }

  if (manualReview) {
    return {
      level: 'Limited',
      summary: 'The evidence is limited until the required adviser review is complete.',
      reasons: [
        'Some applicant information is missing or needs confirmation.',
        'Interview guidance is withheld until that review is complete.'
      ]
    };
  }

  if (isEligibilityOnlyContext(card, options)) {
    return {
      level: 'Medium',
      summary: 'The academic eligibility assessment is supported by official admissions evidence; interview likelihood is not predicted.',
      reasons: [
        'Official eligibility rules are available.',
        'The public result is limited to eligibility because the university does not publish an executable interview-prediction threshold.'
      ]
    };
  }

  if (insufficientEvidence || routeEvidenceGap || coreEvidenceUnavailable) {
    return {
      level: 'Limited',
      summary: 'The available evidence is not sufficient for confident guidance on this applicant route.',
      reasons: [
	        'Official eligibility information is used where it is available.',
	        applicantInformationGap
          ? 'A required applicant scoring input is missing, so ApplySmart cannot calculate the selection score for this route.'
          : routeEvidenceGap
	          ? 'This applicant route has an evidence gap that needs individual review.'
	          : 'Verified historical interview information is incomplete for this applicant route.'
	      ]
    };
  }

  const coreEvidenceReady =
    readiness.eligibility !== false &&
    readiness.interview_prediction !== false &&
    readiness.historical_guidance !== false &&
    readiness.regression !== false;
  const supportedScopeComplete =
    readiness.research_completeness === 'complete_for_supported_scope';
  const profileRecordsHighConfidence =
    String(readiness.prediction_confidence || '').toLowerCase() === 'high';

  if (
    coreEvidenceReady &&
    (supportedScopeComplete || profileRecordsHighConfidence)
  ) {
    return {
      level: 'High',
      summary: 'The recommendation is supported by strong admissions evidence for this applicant route.',
      reasons: [
        'Official eligibility rules are available.',
        'The university selection approach is implemented.',
        'Historical interview data is available for this applicant pool.',
        'The implemented checks have been tested across supported applicant profiles.'
      ]
    };
  }

  return {
    level: 'Medium',
    summary: 'The recommendation is supported by core admissions evidence, with some historical or route-specific limits.',
    reasons: [
      'Official eligibility rules are available.',
      'The university selection approach is implemented.',
      'Historical interview guidance is available, but some evidence is historical, FOI-derived or has documented gaps.'
    ]
  };
}

function selectionScoreThresholdComparison(options = {}) {
  const pool = options.guidancePool || {};
  const ranking = options.ranking || {};
  const scoreModel = options.scoreModel || {};
  const score = Number.isFinite(ranking.value) ? ranking.value : null;

  if (
    pool.metric !== 'selection_score' ||
    scoreModel.type !== 'component_sum' ||
    !Number.isFinite(score)
  ) {
    return null;
  }

  const threshold =
    Number.isFinite(pool.historical_cutoff?.value)
      ? pool.historical_cutoff.value
      : (pool.band_rules || [])
        .find((rule) =>
          ['interview_likely', 'realistic'].includes(rule.band) &&
          ['greater_than', 'greater_than_or_equal'].includes(rule.operator) &&
          Number.isFinite(rule.value)
        )?.value;

  if (!Number.isFinite(threshold)) {
    return null;
  }

  const guidanceText = [
    pool.comparison_guidance?.label,
    pool.comparison_guidance?.caveat,
    pool.comparison_guidance?.comparison_type
  ].filter(Boolean).join(' ');
  const suppliedLabel = typeof pool.comparison_guidance?.label === 'string'
    ? pool.comparison_guidance.label.trim()
    : '';
  const suppliedCategory = comparisonCategoryFromLabel(suppliedLabel);
  const provisional = suppliedCategory === 'advisory' ||
    /provisional|strategic benchmark|modelled|advisory|applysmart-derived/i.test(guidanceText);

  return {
    score,
    threshold,
    difference: score - threshold,
    provisional,
    comparison_label: publicSelectionScoreComparisonPhrase({
      comparison_label: suppliedLabel,
      comparison_caveat: pool.comparison_guidance?.caveat || null,
      comparison_category: suppliedCategory
    }),
    comparison_category: suppliedCategory,
    comparison_caveat: HISTORICAL_GUIDANCE_CAVEAT
  };
}

function formatScorePoints(value) {
  return Number(value.toFixed(2)).toString();
}

function comparisonCategoryFromLabel(label = '') {
  const text = String(label || '').toLowerCase();
  if (/\b(published|official)\b/.test(text) && !/\bunpublished\b/.test(text) && /reference range/.test(text)) {
    return 'published_reference_range';
  }
  if (/\b(published|official)\b/.test(text) && !/\bunpublished\b/.test(text) && /threshold|minimum/.test(text)) {
    return 'published_threshold';
  }
  if (/advisory|modelled|modeled|applysmart|guidance zone|historical-equivalent/.test(text)) {
    return 'advisory';
  }
  if (/observed|interviewed-score|lowest interviewed|average interviewed|interview scores/.test(text)) {
    return 'observed_data';
  }
  return null;
}

function publicThresholdGroup(text = '') {
  if (/contextual|widening participation|wp\b|ukwpmed/.test(text)) return 'contextual';
  if (/overseas|international|non-uk/.test(text)) return 'Overseas';
  if (/\bhome\b|uk-domicile/.test(text)) return 'Home';
  const accessRoute = text.match(/\b([a-z\s-]*access[a-z\s-]*)\s+(?:interview\s+|ucat\s+)?(?:threshold|minimum)\b/);
  if (accessRoute) {
    return titleCaseGroupLabel(accessRoute[1]);
  }
  return null;
}

function publicUcatComparisonPhrase(comparison = {}) {
  const comparisonType = comparison.comparison_type || '';
  const evidenceStatus = comparison.evidence_status || '';
  const labelText = String(comparison.benchmark_label || '').toLowerCase();
  const text = [
    comparison.benchmark_label,
    comparison.caveat,
    evidenceStatus,
    comparisonType
  ].filter(Boolean).join(' ').toLowerCase();
  const published =
    /\b(published|official)\b/.test(text) &&
    !/\b(unpublished|not official|no official)\b/.test(text);
  const advisory = /advisory|modelled|modeled|applysmart|historical-equivalent|working/.test(text);

  if (comparisonType === 'official_minimum') {
    return 'published UCAT minimum';
  }
  if (comparisonType === 'applysmart_prediction_band' || evidenceStatus === 'applysmart_derived') {
    return 'ApplySmart prediction band';
  }
  if (/historical ucat range|ucat range/.test(labelText) && !/interview/.test(labelText)) {
    return 'historical UCAT range';
  }
  if (advisory && /ucat/.test(labelText) && !/threshold|minimum|reference range/.test(labelText)) {
    return 'historical UCAT range';
  }
  if (published && /threshold|minimum/.test(labelText)) {
    const group = publicThresholdGroup(text);
    return group ? `published ${group} threshold` : 'published UCAT threshold';
  }
  if (published && /reference range/.test(labelText)) {
    return 'published UCAT reference range';
  }
  if (published && /threshold|minimum/.test(text)) {
    const group = publicThresholdGroup(text);
    return group ? `published ${group} threshold` : 'published UCAT threshold';
  }
  if (advisory && /score|point/.test(text) && !/ucat/.test(text)) {
    return 'historical score guide';
  }
  if (comparisonType === 'historical_average') {
    return 'historical UCAT range';
  }
  if (/ucat/.test(text) && !/interview/.test(text)) {
    return 'historical UCAT range';
  }
  return 'historical interview range';
}

function publicSelectionScoreComparisonPhrase(comparison = {}) {
  const text = [
    comparison.comparison_label,
    comparison.comparison_caveat,
    comparison.comparison_category
  ].filter(Boolean).join(' ').toLowerCase();
  const published =
    /\b(published|official)\b/.test(text) &&
    !/\b(unpublished|not official|no official)\b/.test(text);
  const advisory = /advisory|modelled|modeled|applysmart|provisional|strategic benchmark|working/.test(text);

  if (published && /threshold|minimum/.test(text)) {
    const group = publicThresholdGroup(text);
    return group ? `published ${group} threshold` : 'published score threshold';
  }
  if (advisory || /score|point/.test(text)) {
    return 'historical score guide';
  }
  return 'historical score guide';
}

function publicComparisonCaveat(comparison = {}) {
  const phrase = publicUcatComparisonPhrase(comparison);
  if (phrase.startsWith('published')) {
    return 'Published thresholds and reference ranges can change between cycles and do not guarantee an interview.';
  }
  if (comparison.comparison_type === 'applysmart_prediction_band' || comparison.evidence_status === 'applysmart_derived') {
    if (
      comparison.caveat === GLASGOW_SCOTLAND_HOME_UCAT_PREDICTION_CAVEAT ||
      comparison.caveat === GLASGOW_RUK_UCAT_PREDICTION_CAVEAT
    ) {
      return comparison.caveat;
    }
    return 'ApplySmart prediction bands are derived from admissions evidence; they are not university-published ranges, thresholds or guarantees.';
  }
  return HISTORICAL_GUIDANCE_CAVEAT;
}

function standardUcatComparisonSentence(comparison) {
  if (!comparison || comparison.position === null) {
    return 'Your UCAT score was assessed for this applicant group.';
  }
  const comparator = publicUcatComparisonPhrase(comparison);
  const position = { above: 'above', within: 'within', below: 'below' }[comparison.position] || 'against';
  return `Your UCAT score is ${position} the ${comparator} for this applicant group.`;
}

function standardSelectionScoreComparisonSentence(comparison) {
  if (!comparison || !Number.isFinite(comparison.difference)) {
    return null;
  }
  const comparator = comparison.comparison_label || publicSelectionScoreComparisonPhrase(comparison);
  const position = comparison.difference < 0 ? 'below' : comparison.difference > 0 ? 'above' : 'at';
  return `Your selection score is ${position} the ${comparator} for this applicant group.`;
}

function recommendationBandGroup(interviewBand) {
  return {
    very_strong_interview_potential: 'very_strong',
    interview_likely: 'strong',
    realistic: 'realistic',
    ambitious: 'cautious',
    high_risk: 'cautious'
  }[interviewBand] || 'realistic';
}

function scoreModelUsesAcademicAndUcat(context = {}) {
  const scoreModel = context.score_model || {};
  const componentText = Array.isArray(scoreModel.components)
    ? scoreModel.components
      .map((component) => [
        component.component_id,
        component.type,
        component.label,
        component.name
      ].filter(Boolean).join(' '))
      .join(' ')
    : '';
  const text = [
    scoreModel.label,
    scoreModel.basis,
    scoreModel.name,
    componentText
  ].filter(Boolean).join(' ').toLowerCase();

  return /ucat/.test(text) && /(academic|gcse|a[ -]?level|qualification|contextual)/.test(text);
}

function recommendationAssessmentBasis({ ucatComparison, selectionScoreComparison, context = {} } = {}) {
  if (ucatRankingBypassApplies(context)) {
    return 'minimum_gate';
  }

  const guidancePoolId = String(context.guidance_pool?.pool_id || context.guidance_pool_id || '').trim();
  if (
    context.course_identity?.profile_id === 'dundee-a100' &&
    guidancePoolId === 'home_scotland_standard_school_leaver'
  ) {
    return 'academic_profile';
  }

  if (ucatComparison && ucatComparison.comparison_type !== 'ranking_only') {
    const label = publicUcatComparisonPhrase(ucatComparison);
    if (label.startsWith('published')) {
      return 'published_ucat_reference';
    }
    if (label === 'historical UCAT range') {
      return 'historical_ucat_range';
    }
    return 'historical_interview_range';
  }

  if (selectionScoreComparison) {
    return scoreModelUsesAcademicAndUcat(context) ? 'academic_ucat' : 'selection_score';
  }

  if (isUcatRankingContext(context)) {
    return 'ucat_ranking';
  }

  if (context.score_model?.type === 'component_sum' || Number.isFinite(context.ranking?.value)) {
    return scoreModelUsesAcademicAndUcat(context) ? 'academic_ucat' : 'selection_score';
  }

  return 'academic_profile';
}

function standardRecommendationExplanation(interviewBand, options = {}) {
  const basis = recommendationAssessmentBasis(options);
  const bandGroup = recommendationBandGroup(interviewBand);
  const competitivenessExplanation = (subject, verb = 'appears') => ({
    very_strong: `Based on ApplySmart's assessment, your ${subject} ${verb} highly competitive for this applicant group.`,
    strong: `Based on ApplySmart's assessment, your ${subject} ${verb} competitive for this applicant group.`,
    realistic: `Based on ApplySmart's assessment, your ${subject} may be competitive for this applicant group.`,
    cautious: `Based on ApplySmart's assessment, your ${subject} may be less competitive for this applicant group.`
  }[bandGroup]);

  if (
    basis === 'ucat_ranking' ||
    basis === 'published_ucat_reference' ||
    basis === 'historical_ucat_range' ||
    basis === 'historical_interview_range'
  ) {
    return competitivenessExplanation('UCAT score');
  }

  if (basis === 'academic_ucat') {
    return competitivenessExplanation('academic profile and UCAT', 'appear');
  }

  if (basis === 'selection_score') {
    return competitivenessExplanation('selection score');
  }

  if (basis === 'minimum_gate') {
    const presentation = configuredPresentation(options.context);
    return presentation.minimum_gate_explanation ||
      "Based on ApplySmart's assessment, you meet the published minimum gates for this applicant route.";
  }

  return competitivenessExplanation('academic profile');
}

const RISK_BANDS = new Set(['ambitious', 'high_risk']);
const CAUTIOUS_COMPONENT_BANDS = new Set([
  'ambitious',
  'borderline',
  'high_risk',
  'weak',
  'low',
  'below'
]);
const POSITIVE_ACADEMIC_CLASSES = new Set([
  'strong',
  'very_strong',
  'excellent',
  'high',
  'competitive'
]);
const CAUTIOUS_ACADEMIC_CLASSES = new Set([
  'moderate',
  'weak',
  'borderline',
  'low',
  'below',
  'limited',
  'high_risk'
]);

function componentCategory(componentId) {
  const text = String(componentId || '').toLowerCase();
  if (/ucat/.test(text)) return 'ucat';
  if (/gcse|academic|grade|a_level|a-level|qualification/.test(text)) return 'academic';
  if (/contextual|wp|widening|care/.test(text)) return 'contextual';
  if (/route|resit|fee|international|graduate/.test(text)) return 'route';
  return 'other';
}

function hasNegativeAdjustment(component = {}) {
  return [
    component.value,
    component.adjustment,
    component.applied_adjustment,
    component.raw_adjustment
  ].some((value) => Number.isFinite(value) && value < 0);
}

function cautiousBand(value) {
  return CAUTIOUS_COMPONENT_BANDS.has(String(value || '').toLowerCase());
}

function cautiousAcademicClass(value) {
  return CAUTIOUS_ACADEMIC_CLASSES.has(String(value || '').toLowerCase());
}

function positiveAcademicClass(value) {
  return POSITIVE_ACADEMIC_CLASSES.has(String(value || '').toLowerCase());
}

function componentContributesToRisk(componentId, component = {}) {
  if (!component || component.applicable === false) {
    return false;
  }

  const category = componentCategory(componentId);
  if (category === 'ucat') {
    return cautiousBand(component.band || component.raw_band || component.profile_class);
  }

  if (category === 'academic') {
    if (positiveAcademicClass(component.profile_class || component.band || component.raw_band)) {
      return false;
    }
    return cautiousAcademicClass(component.profile_class) ||
      cautiousBand(component.band || component.raw_band) ||
      hasNegativeAdjustment(component);
  }

  if (category === 'contextual') {
    return hasNegativeAdjustment(component) ||
      cautiousBand(component.band || component.raw_band || component.outcome);
  }

  if (category === 'route') {
    return cautiousBand(component.band || component.raw_band || component.outcome) ||
      hasNegativeAdjustment(component);
  }

  return false;
}

function riskFactorsFromRanking(ranking = {}) {
  const factors = new Set();
  for (const [componentId, component] of Object.entries(ranking.components || {})) {
    if (!componentContributesToRisk(componentId, component)) {
      continue;
    }
    const category = componentCategory(componentId);
    if (['ucat', 'academic', 'contextual', 'route'].includes(category)) {
      factors.add(category);
    }
  }
  return [...factors];
}

function buildStandardRiskExplanation(interviewBand, options = {}) {
  if (!RISK_BANDS.has(interviewBand)) {
    return null;
  }

  const ranking = options.ranking || options.context?.ranking || {};
  const factors = riskFactorsFromRanking(ranking);
  const hasUcat = factors.includes('ucat');
  const hasAcademic = factors.includes('academic');
  const hasContextualOrRoute = factors.includes('contextual') || factors.includes('route');
  const base = 'Your academic entry requirements are met, but';

  if (hasUcat && !hasAcademic && !hasContextualOrRoute) {
    return {
      primary_factor: 'ucat',
      reason_code: 'ucat_historical_guidance_range',
      contributing_factors: ['ucat'],
      summary: `${base} your UCAT score falls within ApplySmart's more cautious historical guidance range for this applicant group.`
    };
  }

  if (hasAcademic && !hasUcat && !hasContextualOrRoute) {
    return {
      primary_factor: 'academic',
      reason_code: 'academic_historical_guidance_range',
      contributing_factors: ['academic'],
      summary: `${base} your academic profile falls within ApplySmart's more cautious historical guidance range for this applicant group.`
    };
  }

  if (hasUcat && hasAcademic) {
    return {
      primary_factor: 'combined_academic_ucat',
      reason_code: 'combined_academic_ucat_historical_guidance_range',
      contributing_factors: factors,
      summary: `${base} your academic profile and UCAT score fall within ApplySmart's more cautious historical guidance range for this applicant group.`
    };
  }

  if (hasContextualOrRoute) {
    return {
      primary_factor: factors.includes('route') ? 'route' : 'contextual',
      reason_code: 'contextual_or_route_historical_guidance_range',
      contributing_factors: factors,
      summary: `${base} a contextual or route-related factor places this profile within ApplySmart's more cautious historical guidance range for this applicant group.`
    };
  }

  const configuredExplanation = firstNonEmptyString(
    options.presentation?.band_explanations?.[interviewBand],
    options.presentation?.risk_explanations?.[interviewBand]
  );
  if (configuredExplanation) {
    return {
      primary_factor: 'overall_profile',
      reason_code: 'configured_band_explanation',
      contributing_factors: [],
      summary: configuredExplanation
    };
  }

  return null;
}

function bristolContextualCompactAcademicStatus(card = {}, state, eligibilityStatus) {
  const profileId = card.course_identity?.profile_id || card.course_profile_id;
  if (profileId !== 'bristol-a100') {
    return null;
  }

  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  const academicPathway = card.academic_pathway || card.eligibility?.academic_pathway || null;
  const contextualGradesMet =
    contextual?.status === 'contextual' &&
    contextual?.reason !== 'bristol_scholars_tailored_offer_manual_review' &&
    academicPathway === 'contextual' &&
    state !== 'not_eligible' &&
    eligibilityStatus !== 'not_eligible' &&
    state !== 'manual_review' &&
    eligibilityStatus !== 'manual_review' &&
    eligibilityStatus !== 'insufficient_evidence';
  if (!contextualGradesMet) {
    return null;
  }

  return 'Contextual eligibility confirmed. You meet the contextual academic requirements.';
}

function academicStatusSummary(state, eligibilityStatus, card = {}) {
  const presentation = configuredPresentation(card);
  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  const aberdeenReachSummary = aberdeenReachContextualSummary(card);
  const profileId = card.course_identity?.profile_id || card.course_profile_id || card.profile_id || null;
  const guidancePoolId = card.guidance_pool_id || card.guidance_pool?.pool_id || null;
  if (
    aberdeenReachSummary &&
    state !== 'not_eligible' &&
    eligibilityStatus !== 'not_eligible' &&
    state !== 'manual_review' &&
    eligibilityStatus !== 'manual_review' &&
    eligibilityStatus !== 'insufficient_evidence'
  ) {
    return aberdeenReachSummary;
  }
  const configuredContextualStatus = String(presentation.compact_contextual_status || '').trim();
  if (
    configuredContextualStatus &&
    contextual?.status === 'contextual' &&
    state !== 'not_eligible' &&
    eligibilityStatus !== 'not_eligible' &&
    state !== 'manual_review' &&
    eligibilityStatus !== 'manual_review' &&
    eligibilityStatus !== 'insufficient_evidence'
  ) {
    return configuredContextualStatus;
  }
  if (
    isDundeeContextualSchoolLeaverPool(profileId, guidancePoolId) &&
    contextual?.status === 'contextual' &&
    state !== 'not_eligible' &&
    eligibilityStatus !== 'not_eligible' &&
    state !== 'manual_review' &&
    eligibilityStatus !== 'manual_review' &&
    eligibilityStatus !== 'insufficient_evidence'
  ) {
    return 'You meet the academic requirements.';
  }
  if (
    contextual?.status === 'contextual' &&
    state !== 'not_eligible' &&
    eligibilityStatus !== 'not_eligible' &&
    state !== 'manual_review' &&
    eligibilityStatus !== 'manual_review' &&
    eligibilityStatus !== 'insufficient_evidence'
  ) {
    return 'Contextual eligibility confirmed.';
  }

  const bristolContextualSummary = bristolContextualCompactAcademicStatus(
    card,
    state,
    eligibilityStatus
  );
  if (bristolContextualSummary) {
    return bristolContextualSummary;
  }

  if (state === 'not_eligible' || eligibilityStatus === 'not_eligible') {
    const failures = card.eligibility_failures || card.eligibility?.failures || [];
    if (failures.some((failure) => ['sjt_band_excluded', 'disqualifying_sjt_rule'].includes(normaliseCheckId(failure)))) {
      return 'You do not currently meet this university’s SJT requirement.';
    }
    return 'You do not currently meet the academic requirements.';
  }
  if (
    state === 'manual_review' ||
    eligibilityStatus === 'manual_review' ||
    eligibilityStatus === 'insufficient_evidence'
  ) {
    return 'ApplySmart needs more information to assess the academic requirements.';
  }
  return 'You meet the academic requirements.';
}

function ucatComparisonLabel(comparison = {}) {
  if (comparison.comparison_type === 'official_minimum') {
    return {
      comparison_label: publicUcatComparisonPhrase(comparison),
      comparison_label_type: 'published_ucat_minimum',
      difference_word: 'minimum'
    };
  }

  if (comparison.comparison_type === 'applysmart_prediction_band' || comparison.evidence_status === 'applysmart_derived') {
    return {
      comparison_label: 'ApplySmart prediction band',
      comparison_label_type: 'applysmart_advisory_guide',
      difference_word: 'prediction band'
    };
  }

  const suppliedCategory = ucatComparisonCategory(comparison);

  if (suppliedCategory === 'published_reference_range') {
    return {
      comparison_label: publicUcatComparisonPhrase(comparison),
      comparison_label_type: 'published_interview_threshold',
      difference_word: 'range'
    };
  }

  if (suppliedCategory === 'published_threshold') {
    return {
      comparison_label: publicUcatComparisonPhrase(comparison),
      comparison_label_type: 'published_interview_threshold',
      difference_word: 'threshold'
    };
  }

  if (suppliedCategory === 'advisory' || comparison.comparison_type === 'current_guidance') {
    return {
      comparison_label: publicUcatComparisonPhrase(comparison),
      comparison_label_type: 'historical_interview_guide',
      difference_word: 'range'
    };
  }

  if (suppliedCategory === 'observed_data') {
    return {
      comparison_label: publicUcatComparisonPhrase(comparison),
      comparison_label_type: 'recent_interview_benchmark',
      difference_word: 'range'
    };
  }

  if (comparison.comparison_type === 'historical_average') {
    return {
      comparison_label: publicUcatComparisonPhrase(comparison),
      comparison_label_type: 'recent_interview_benchmark',
      difference_word: 'range'
    };
  }

  return {
    comparison_label: publicUcatComparisonPhrase(comparison),
    comparison_label_type: 'historical_interview_guide',
    difference_word: 'range'
  };
}

function comparisonLabelForUcat(comparison = {}) {
  return ucatComparisonLabel(comparison);
}

function ucatComparisonCategory(comparison = {}) {
  return comparisonCategoryFromLabel([
    comparison.benchmark_label,
    comparison.caveat,
    comparison.comparison_type
  ].filter(Boolean).join(' '));
}

function ucatComparisonDisplayName(comparison = {}) {
  return ucatComparisonLabel(comparison).comparison_label;
}

function differenceDirection(difference) {
  if (!Number.isFinite(difference)) {
    return null;
  }
  if (difference > 0) return 'above';
  if (difference < 0) return 'below';
  return 'at';
}

function buildUcatSelectionMetric(ucatComparison, options = {}) {
  if (!ucatComparison || typeof ucatComparison !== 'object') {
    return null;
  }

  if (!Number.isFinite(ucatComparison.applicant_ucat)) {
    return null;
  }

  const maximum = Number.isFinite(options.bandMetric?.scale?.max)
    ? options.bandMetric.scale.max
    : options.applicantContext?.admissions_tests?.ucat?.score_scale ?? 2700;
  const ucatAdjustment = buildUcatAdjustmentPresentation(options);

  if (!Number.isFinite(ucatComparison.benchmark_min)) {
    return {
      type: 'ucat',
      label: ucatAdjustment ? 'Aberdeen adjusted selection UCAT' : 'UCAT ranking',
      applicant_value: ucatComparison.applicant_ucat,
      comparison_value: null,
      comparison_max_value: null,
      comparison_label: null,
      comparison_label_type: null,
      comparison_context: null,
      difference: null,
      difference_direction: null,
      difference_word: null,
      maximum_value: Number.isFinite(maximum) ? maximum : null,
      display_mode: 'score',
      display_eligibility: true,
      entry_year: null,
      caveat: null
    };
  }

  const label = comparisonLabelForUcat(ucatComparison);
  const difference = ucatComparison.applicant_ucat - ucatComparison.benchmark_min;

  return {
    type: 'ucat',
    label: ucatAdjustment ? 'Aberdeen adjusted selection UCAT comparison' : 'UCAT comparison',
    applicant_value: ucatComparison.applicant_ucat,
    comparison_value: ucatComparison.benchmark_min,
    comparison_max_value: Number.isFinite(ucatComparison.benchmark_max)
      ? ucatComparison.benchmark_max
      : null,
    comparison_label: label.comparison_label,
    comparison_label_type: label.comparison_label_type,
    comparison_context: null,
    difference,
    difference_direction: differenceDirection(difference),
    difference_word: label.difference_word,
    maximum_value: Number.isFinite(maximum) ? maximum : null,
    display_mode: 'comparison',
    display_eligibility: true,
    entry_year: null,
    caveat: publicComparisonCaveat(ucatComparison)
  };
}

function buildScoreSelectionMetric(scoreBreakdown, selectionScoreComparison) {
  if (!scoreBreakdown || !Number.isFinite(scoreBreakdown.value)) {
    return null;
  }

  const scoreName = String(scoreBreakdown.name || '').toLowerCase();
  const type = /\bpoints?\b/.test(scoreName) && !/selection score/.test(scoreName)
    ? 'points'
    : 'selection_score';
  const label = type === 'points' ? 'Points score' : 'Selection score';
  const hasComparison = Number.isFinite(selectionScoreComparison?.threshold);
  const suppliedComparisonLabel = selectionScoreComparison?.comparison_label;
  const comparisonLabel = suppliedComparisonLabel ||
    (selectionScoreComparison?.provisional
      ? 'ApplySmart advisory benchmark'
      : type === 'points'
        ? 'Historical points guide'
        : 'Historical selection score');
  const comparisonLabelType =
    selectionScoreComparison?.comparison_category === 'published_threshold'
      ? 'published_interview_threshold'
      : selectionScoreComparison?.provisional
        ? 'applysmart_advisory_guide'
        : 'historical_interview_guide';
  const comparisonWord =
    comparisonLabelType === 'published_interview_threshold'
      ? 'threshold'
      : comparisonLabelType === 'applysmart_advisory_guide'
        ? 'benchmark'
        : type === 'points'
          ? 'guide'
          : 'benchmark';

  return {
    type,
    label,
    applicant_value: scoreBreakdown.value,
    comparison_value: hasComparison ? selectionScoreComparison.threshold : null,
    comparison_max_value: null,
    comparison_label: hasComparison ? comparisonLabel : null,
    comparison_label_type: hasComparison ? comparisonLabelType : null,
    comparison_context: scoreBreakdown.name || null,
    difference: hasComparison ? selectionScoreComparison.difference : null,
    difference_direction: hasComparison ? differenceDirection(selectionScoreComparison.difference) : null,
    difference_word: hasComparison ? comparisonWord : null,
    maximum_value: Number.isFinite(scoreBreakdown.max) ? scoreBreakdown.max : null,
    display_mode: 'score',
    display_eligibility: true,
    entry_year: null,
    caveat: hasComparison ? selectionScoreComparison.comparison_caveat || HISTORICAL_GUIDANCE_CAVEAT : null
  };
}

function buildEligibilitySelectionMetric(state) {
  if (state !== 'eligibility_only') {
    return null;
  }
  return {
    type: 'eligibility',
    label: 'Eligibility',
    applicant_value: null,
    comparison_value: null,
    comparison_max_value: null,
    comparison_label: null,
    comparison_label_type: null,
    comparison_context: null,
    difference: null,
    difference_direction: null,
    difference_word: null,
    maximum_value: null,
    display_mode: 'eligibility',
    display_eligibility: true,
    entry_year: null,
    value_label: 'Eligibility requirements met',
    caveat: null
  };
}

function buildSelectionMetric({ state, scoreBreakdown, selectionScoreComparison, ucatComparison, options }) {
  if (state === 'manual_review' || state === 'insufficient_evidence' || state === 'not_eligible') {
    return null;
  }
  if (state === 'eligibility_only') {
    return buildEligibilitySelectionMetric(state);
  }

  return buildScoreSelectionMetric(scoreBreakdown, selectionScoreComparison) ||
    buildUcatSelectionMetric(ucatComparison, options) ||
    buildEligibilitySelectionMetric(state);
}

function lowerInitial(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildCompactStatus({ state, eligibilityStatus, card = {} }) {
  if (state === 'not_eligible') {
    return {
      label: academicStatusSummary(state, eligibilityStatus, card),
      type: 'academic_status',
      tone: 'negative'
    };
  }

  if (state === 'manual_review') {
    const glasgowReachCompletionReason = glasgowReachCompletionInformationNeededReason(card);
    if (glasgowReachCompletionReason) {
      return {
        label: glasgowReachCompletionReason,
        type: 'information_needed',
        tone: 'warning'
      };
    }
    return {
      label: academicStatusSummary(state, eligibilityStatus, card),
      type: 'academic_status',
      tone: 'warning'
    };
  }

  if (state === 'insufficient_evidence' || eligibilityStatus === 'insufficient_evidence') {
    return {
      label: academicStatusSummary(state, eligibilityStatus, card),
      type: 'academic_status',
      tone: 'warning'
    };
  }

  return {
    label: academicStatusSummary(state, eligibilityStatus, card),
    type: 'academic_status',
    tone: 'positive'
  };
}

function comparisonMetricLabelFromSelectionMetric(metric) {
  if (!metric || typeof metric.comparison_label !== 'string' || !metric.comparison_label.trim()) {
    return null;
  }

  return metric.comparison_label.trim();
}

function comparisonMetricValueFromSelectionMetric(metric) {
  if (!metric || !Number.isFinite(metric.comparison_value)) {
    return null;
  }

  const value = formatMetricDisplayValue(metric.comparison_value);
  if (!Number.isFinite(metric.comparison_max_value)) {
    return value;
  }

  return `${value}-${formatMetricDisplayValue(metric.comparison_max_value)}`;
}

function selectionComparisonMetrics(selectionMetric) {
  if (!selectionMetric || !Number.isFinite(selectionMetric.comparison_value)) {
    return [];
  }

  const label = comparisonMetricLabelFromSelectionMetric(selectionMetric);
  const value = comparisonMetricValueFromSelectionMetric(selectionMetric);
  if (!label || !value) {
    return [];
  }

  return [
    {
      label,
      value,
      difference: formatMetricDifference(selectionMetric.difference)
    }
  ];
}

function buildComparisonMetrics({ state, selectionMetric, ucatComparison, options = {} }) {
  if (!['standard', 'not_eligible'].includes(state)) {
    return [];
  }
  if (ucatRankingBypassApplies(options)) {
    return [];
  }

  const historicalAdmissionsMetrics = historicalAdmissionComparisonMetrics(
    options.historicalAdmissions,
    options.applicantGroupIds,
    options,
    ucatComparison
  );
  if (historicalAdmissionsMetrics.length > 0) {
    return historicalAdmissionsMetrics;
  }

  return selectionComparisonMetrics(selectionMetric);
}

function buildComparisonMetricsTitle({ state, comparisonMetrics, options = {} }) {
  if (!['standard', 'not_eligible'].includes(state) || !Array.isArray(comparisonMetrics) || comparisonMetrics.length === 0) {
    return null;
  }

  const cycles = options.historicalAdmissions?.cycles;
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return null;
  }

  const years = cycles.map(extractCycleYear).filter(Number.isFinite);
  const mostRecentYear = years.length > 0 ? Math.max(...years) : null;
  if (mostRecentYear === null) {
    return null;
  }

  const mostRecentEntries = filterHistoricalEntriesForApplicant(
    cycles.filter((c) => extractCycleYear(c) === mostRecentYear),
    options.applicantGroupIds
  );
  const hasInterviewMetric = mostRecentEntries.some((entry) =>
    String(entry.metric || entry.metric_type || '').toLowerCase().includes('interview')
  );

  return hasInterviewMetric ? 'Historical Interview Data' : null;
}

function selectionScoreThresholdText(comparison) {
  if (!comparison) {
    return null;
  }

  const difference = comparison.difference;
  const formattedThreshold = formatScorePoints(comparison.threshold);
  const benchmarkName = comparison.comparison_label ||
    (comparison.provisional
      ? 'ApplySmart advisory benchmark'
      : 'historical selection score');
  if (difference < 0) {
    const suffix = comparison.provisional
      ? 'This result uses ApplySmart advisory modelling, not an official cut-off.'
      : 'This result does not mean the comparison point was met.';
    return `Your selection score is ${formatScorePoints(Math.abs(difference))} points below the ${benchmarkName} of ${formattedThreshold} for this applicant pool. ${suffix}`;
  }
  if (difference > 0) {
    return `Your selection score is ${formatScorePoints(difference)} points above the ${benchmarkName} of ${formattedThreshold} for this applicant pool.`;
  }
  return `Your selection score meets the ${benchmarkName} of ${formattedThreshold} for this applicant pool.`;
}

function existingSelectionScoreThresholdText(card) {
  const selectionStage = card.decision_transparency?.decision_path?.find((stage) =>
    stage.stage === 'Selection model'
  );
  const thresholdCheck = selectionStage?.checks?.find((entry) =>
    entry.label === 'Selection score threshold' ||
    entry.label === 'Selection score benchmark' ||
    entry.label === 'Historical selection score guide' ||
    entry.label === 'Selection score guide'
  );
  return thresholdCheck?.summary || null;
}

function selectionScoreThresholdSummary(options = {}) {
  return options.selectionScoreText || selectionScoreThresholdText(options.selectionScoreComparison);
}

function calculatedScoreExplanation(context = {}) {
  if (context.estimated_selection_score) {
    return null;
  }
  const score = context.official_score || null;
  if (score && Number.isFinite(score.value)) {
    const label = score.label || score.name || 'selection score';
    return `ApplySmart has calculated this ${lowerInitial(label)} using the available admissions evidence for this applicant group.`;
  }
  if (
    context.score_model?.type === 'component_sum' &&
    Number.isFinite(context.ranking?.value)
  ) {
    return 'ApplySmart has calculated this selection score using the available admissions evidence for this applicant group.';
  }
  if (!score || !Number.isFinite(score.value)) {
    return null;
  }
  return null;
}

function selectionScoreThresholdComparisonCheck(comparison) {
  if (!comparison) {
    return null;
  }

  const status = comparison.difference < 0
    ? 'Below guide'
    : comparison.difference > 0
      ? 'Above guide'
      : 'At guide';
  const label = comparison.provisional
    ? 'Selection score benchmark'
    : 'Selection score guide';
  return check(
    label,
    status,
    selectionScoreThresholdText(comparison)
  );
}

function historicalSummary(card, state, options = {}) {
  const presentation = configuredPresentation(card, options);
  if (ucatRankingBypassApplies({ ...card, ...options })) {
    return presentation.historical_summary ||
      'Historical UCAT ranking data is not used for this route because competitive UCAT ranking is bypassed after the minimum UCAT gate.';
  }
  if (state === 'eligibility_only') {
    return 'Historical admissions data is not used for this eligibility-only result because ApplySmart is not predicting interview likelihood.';
  }
  if (state === 'not_eligible') {
    const hasHistoricalContext =
      historicalAdmissionComparisonMetrics(
        options.historicalAdmissions,
        options.applicantGroupIds,
        options,
        options.ucatComparison
      ).length > 0 ||
      historicalAdmissionsChecks(options.historicalAdmissions, options.applicantGroupIds).length > 0 ||
      hasPublicUcatHistoricalComparison(options.ucatComparison);
    return hasHistoricalContext
      ? `Historical admissions data remains contextual only because the academic requirement above is not met. ${HISTORICAL_GUIDANCE_CAVEAT}`
      : `Historical admissions data is not applied because the entry requirements are not met. ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (state === 'manual_review') {
    return `Historical admissions data is held back until the review is complete. ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (state === 'insufficient_evidence') {
    const reasonCode = options.insufficientEvidenceReasonCode ||
      card.decision_transparency?.insufficient_evidence_reason_code;
    const reasonSummary = reasonScopedPresentationValue(
      presentation,
      'insufficient_evidence_historical_summaries',
      reasonCode
    ) || reasonScopedPresentationValue(
      presentation,
      'insufficient_evidence_timeline_historical_summaries',
      reasonCode
    );
    if (reasonSummary) {
      return reasonSummary;
    }
    if (isApplicantInformationReasonCode(reasonCode)) {
      const informationNeededReason = options.informationNeededReason ||
        card.information_needed_reason ||
        card.decision_transparency?.information_needed_reason ||
        null;
      return informationNeededReason
        ? `Historical admissions data was not compared. ${informationNeededReason} ${HISTORICAL_GUIDANCE_CAVEAT}`
        : `Historical admissions data was not compared because a required applicant scoring input is missing. ${HISTORICAL_GUIDANCE_CAVEAT}`;
    }
    return `There is not enough verified historical admissions data for this applicant route. ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (presentation.historical_summary) {
    return presentation.historical_summary;
  }
  const selectionScoreText = selectionScoreThresholdSummary(options);
  if (selectionScoreText) {
    return `${selectionScoreText} ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (['applysmart_prediction_band', 'current_guidance', 'historical_range', 'historical_threshold', 'historical_average'].includes(options.ucatComparison?.comparison_type)) {
    return `${ucatComparisonAssessmentText(options.ucatComparison)} ${publicComparisonCaveat(options.ucatComparison)}`;
  }

  return `The result was assessed using the available admissions evidence for this applicant group. ${HISTORICAL_GUIDANCE_CAVEAT}`;
}

function recommendationSummary(card, state, options = {}) {
  if (state === 'eligibility_only') {
    return 'You meet the supported academic requirements. ApplySmart does not estimate interview progression for this course.';
  }
  if (state === 'not_eligible') {
    return 'The interview recommendation is not applied because the supported entry requirements are not met.';
  }
  if (state === 'manual_review') {
    return 'An adviser must review the missing or unconfirmed information before interview guidance can be shown.';
  }
  if (state === 'insufficient_evidence') {
    const reasonCode = options.insufficientEvidenceReasonCode ||
      card.decision_transparency?.insufficient_evidence_reason_code;
    const reasonSummary = reasonScopedPresentationValue(
      configuredPresentation(card, options),
      'insufficient_evidence_recommendation_summaries',
      reasonCode
    );
    if (reasonSummary) {
      return reasonSummary;
    }
    if (isApplicantInformationReasonCode(reasonCode)) {
      return 'No interview recommendation is shown because a required applicant scoring input is missing.';
    }
    return 'No confident recommendation is shown because the available evidence is insufficient.';
  }

  if (options.riskExplanation?.summary) {
    return `${options.riskExplanation.summary} Treat this as guidance for university choice, not a promised interview.`;
  }

  const explanation = standardRecommendationExplanation(card.prediction?.result_band, {
    ucatComparison: options.ucatComparison,
    selectionScoreComparison: options.selectionScoreComparison,
    context: options.context || options.applicantContext
  });
  const contextualSummary = contextualOfferRouteSummary(
    card,
    card.alternative_academic_offer || (
      options.stage1Eligibility
        ? buildAlternativeAcademicOffer(options.stage1Eligibility, {
          academic_pathway: card.academic_pathway || card.eligibility?.academic_pathway || null,
          academic_pathway_id: card.academic_pathway_id || card.eligibility?.academic_pathway_id || null
        })
        : null
    )
  );
  if (contextualSummary) {
    return `${contextualSummary} ${explanation} Treat this as guidance for university choice, not a promised interview.`;
  }
  return `${explanation} Treat this as guidance for university choice, not a promised interview.`;
}

function hasBuilderOptions(options = {}) {
  return Object.keys(options || {}).length > 0;
}

function finiteNumber(...values) {
  return values.find((value) => Number.isFinite(value)) ?? null;
}

function completedCardScoreValue(card) {
  const predictionScore = card.prediction?.score;
  if (Number.isFinite(predictionScore)) {
    return predictionScore;
  }
  if (predictionScore && typeof predictionScore === 'object') {
    return finiteNumber(
      predictionScore.value,
      predictionScore.pre_interview_score?.value,
      predictionScore.application_score?.value,
      predictionScore.total_score?.value
    );
  }
  return finiteNumber(
    card.estimated_selection_score?.value,
    card.official_score?.value,
    card.stage_2?.score?.value,
    card.stage_2_selection?.represented_ranking_input?.score
  );
}

function completedCardScoreMax(card) {
  const predictionScore = card.prediction?.score;
  if (predictionScore && typeof predictionScore === 'object') {
    return finiteNumber(
      predictionScore.max,
      predictionScore.maximum,
      predictionScore.pre_interview_score?.max,
      predictionScore.application_score?.max,
      predictionScore.total_score?.max
    );
  }
  return finiteNumber(
    card.estimated_selection_score?.max,
    card.official_score?.max,
    card.stage_2?.score?.max,
    card.stage_2_selection?.represented_ranking_input?.max,
    card.prediction?.score_scale?.max
  );
}

function scoreBreakdownChecksFromCompletedCard(card, transparency) {
  const estimatedComponents = card.estimated_selection_score?.components;
  if (estimatedComponents) {
    return [
      scoreComponentCheck('GCSE score', estimatedComponents.gcse),
      scoreComponentCheck('UCAT score', estimatedComponents.ucat),
      scoreComponentCheck('SJT score', estimatedComponents.sjt),
      contextualScoreComponentCheck(estimatedComponents.contextual)
    ].filter(Boolean);
  }

  const officialComponents = card.official_score?.components;
  if (officialComponents) {
    return [
      scoreComponentCheck('GCSE score', officialComponents.gcse),
      scoreComponentCheck('UCAT cognitive score', officialComponents.ucat_cognitive),
      scoreComponentCheck('SJT score', officialComponents.sjt)
    ].filter(Boolean);
  }

  const stage2Components = card.stage_2?.score?.components;
  if (Array.isArray(stage2Components) && stage2Components.length > 0) {
    return stage2Components
      .map((component) => scoreComponentCheck(
        humanScoreComponentLabel(component.component_id || component.label),
        component
      ))
      .filter(Boolean);
  }

  const rankingFactors = card.stage_2_selection?.ranking_factors;
  if (
    card.stage_2_selection?.represented_ranking_input?.metric === 'selection_score' &&
    Array.isArray(rankingFactors)
  ) {
    return rankingFactors
      .filter((factor) => factor.calculation_status === 'calculated')
      .map((factor) => check(
        factor.label || humanScoreComponentLabel(factor.factor_id),
        'Counted',
        studentFacingText(factor.notes || 'This component was counted in the selection score.')
      ));
  }

  const selectionChecks =
    transparency?.decision_path?.find((stage) => stage.stage === 'Selection model')?.checks || [];
  return selectionChecks.filter((entry) => {
    if (
      entry.label === 'Applicant pool' ||
      entry.label === 'Selection approach' ||
      /tie-break|evidence limit/i.test(entry.label)
    ) {
      return false;
    }
    if (/cannot be completed|not fully calculated|awaiting/i.test(`${entry.status} ${entry.summary}`)) {
      return false;
    }
    return /(contribution|score|point|total|sjt)/i.test(`${entry.label} ${entry.summary}`);
  });
}

function completedCardHasScoringSurface(card, transparency) {
  if (
    card.estimated_selection_score ||
    card.official_score ||
    card.stage_2?.score ||
    card.stage_2_selection?.represented_ranking_input?.metric === 'selection_score'
  ) {
    return true;
  }

  const selectionChecks =
    transparency?.decision_path?.find((stage) => stage.stage === 'Selection model')?.checks || [];
  return selectionChecks.some((entry) =>
    /calculated/i.test(entry.status) &&
    !/cannot be completed|not fully calculated|awaiting/i.test(entry.summary) &&
    /(combined score|application score|total score|pre-interview total)/i.test(entry.label)
  );
}

function groupRuleApplies(rule = {}, groupIds = []) {
  const groups = new Set(groupIds || []);
  const all = rule.all_group_ids || rule.applies_to_group_ids || [];
  const any = rule.any_group_ids || [];
  const excluded = rule.excluded_group_ids || [];

  return (
    all.every((groupId) => groups.has(groupId)) &&
    (any.length === 0 || any.some((groupId) => groups.has(groupId))) &&
    !excluded.some((groupId) => groups.has(groupId))
  );
}

function applicantGroupConditionApplies(condition = {}, groupIds = []) {
  if (!condition || typeof condition !== 'object' || !condition.field) {
    return true;
  }
  if (condition.field !== 'applicant_group_ids') {
    return false;
  }

  const groups = new Set(groupIds || []);
  const values = Array.isArray(condition.value) ? condition.value : [condition.value];
  if (condition.operator === 'includes') {
    return values.every((groupId) => groups.has(groupId));
  }
  if (condition.operator === 'includes_any') {
    return values.some((groupId) => groups.has(groupId));
  }
  return false;
}

function ucatRankingBypassApplies(context = {}) {
  const stage2Selection =
    context.stage2InterviewSelection ||
    context.stage_2_interview_selection ||
    context.stage_2_selection ||
    null;
  const groupIds = context.applicantGroupIds || context.applicant_group_ids || [];
  const adjustments = Array.isArray(stage2Selection?.selection_adjustments)
    ? stage2Selection.selection_adjustments
    : [];

  return adjustments.some((adjustment) =>
    adjustment?.effect?.type === 'bypass_ranking' &&
    adjustment.effect.target === 'ucat_ranking' &&
    adjustment.effect.value === true &&
    groupRuleApplies(adjustment, groupIds) &&
    applicantGroupConditionApplies(adjustment.condition, groupIds)
  );
}

function resolveApplicantUcatMinimum(stage1Eligibility, groupIds = []) {
  const ucat = stage1Eligibility?.admissions_tests?.ucat || {};
  const groupRule = (ucat.group_minimum_total_scores || [])
    .find((rule) => groupRuleApplies(rule, groupIds));
  const minimum = groupRule?.minimum_total_score ?? ucat.minimum_total_score;

  return Number.isFinite(minimum) ? minimum : null;
}

function selectApplicableSjtPolicy(stage1Eligibility, groupIds = []) {
  const sjt = stage1Eligibility?.admissions_tests?.sjt || {};
  const groupPolicy = (sjt.group_policies || [])
    .find((policy) => groupRuleApplies(policy, groupIds));
  return { ...sjt, ...(groupPolicy || {}) };
}

function formatBandList(bands = []) {
  const sorted = [...bands].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `Band ${sorted[0]}`;
  if (sorted.every((band, index) => index === 0 || band === sorted[index - 1] + 1)) {
    return `Bands ${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
  return `Bands ${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`;
}

function buildSjtInterpretation(stage1Eligibility, groupIds = [], applicantContext = {}) {
  const policy = selectApplicableSjtPolicy(stage1Eligibility, groupIds);
  const band = applicantContext?.admissions_tests?.ucat?.sjt_band;
  const excludedBands = policy.excluded_bands || [];
  const acceptedBands = policy.accepted_bands || [];
  const usedInScore = policy.scoring?.used_in_score === true;
  const usedPostInterview =
    policy.used_after_interview === true ||
    policy.sjt_used_post_interview === true ||
    /post[- ]interview/i.test(String(policy.notes || policy.current_interview_score_contribution || ''));

  let outcome = 'ignored';
  let summary = Number.isFinite(band)
    ? `Band ${band} - not used for interview selection.`
    : 'SJT is not used for interview selection.';

  if (policy.used === false || policy.used_as_gate === false) {
    outcome = usedPostInterview ? 'post_interview' : 'ignored';
    summary = Number.isFinite(band)
      ? `Band ${band} - ${usedPostInterview ? 'used after interview, not for interview shortlisting.' : 'not used for interview selection.'}`
      : usedPostInterview
        ? 'SJT is used after interview, not for interview shortlisting.'
        : 'SJT is not used for interview selection.';
  } else if (excludedBands.includes(band)) {
    outcome = 'not_met';
    const excludedText = formatBandList(excludedBands) || `Band ${band}`;
    summary = `Not met - ${excludedText} ${excludedBands.length === 1 ? 'is' : 'are'} not accepted.`;
  } else if (usedInScore) {
    outcome = 'scored';
    summary = Number.isFinite(band)
      ? `Band ${band} - contributes to the university's selection score.`
      : 'SJT contributes to the university selection score.';
  } else if (policy.used_as_gate === true) {
    outcome = 'met';
    const acceptedText = formatBandList(acceptedBands);
    summary = acceptedText
      ? `Met - ${acceptedText} are accepted.`
      : Number.isFinite(band)
        ? `Band ${band} - accepted by the university's SJT gate.`
        : 'The SJT requirement is met.';
  }

  return {
    applicant_sjt_band: Number.isFinite(band) ? band : null,
    sjt_policy: policy.notes || policy.policy || summary,
    sjt_outcome: outcome,
    summary
  };
}

function derivedBandBenchmarkFromRule(rule = {}, pool = {}) {
  if (!rule || rule.evidence_status !== 'applysmart_derived') {
    return null;
  }

  if (rule.operator === 'between_inclusive' && Number.isFinite(rule.min) && Number.isFinite(rule.max)) {
    return {
      comparison_type: 'applysmart_prediction_band',
      comparison_operator: rule.operator,
      benchmark_min: rule.min,
      benchmark_max: rule.max,
      benchmark_label: pool.comparison_guidance?.label || null,
      caveat: pool.comparison_guidance?.caveat || null,
      evidence_status: rule.evidence_status,
      evidence_classification: rule.evidence_classification || null,
      prediction_band: rule.band || null
    };
  }

  if (
    ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'].includes(rule.operator) &&
    Number.isFinite(rule.value)
  ) {
    return {
      comparison_type: 'applysmart_prediction_band',
      comparison_operator: rule.operator,
      benchmark_min: rule.value,
      benchmark_max: null,
      benchmark_label: pool.comparison_guidance?.label || null,
      caveat: pool.comparison_guidance?.caveat || null,
      evidence_status: rule.evidence_status,
      evidence_classification: rule.evidence_classification || null,
      prediction_band: rule.band || null
    };
  }

  return null;
}

function isGlasgowScotlandHomeUcatPredictionContext(guidancePool = {}, context = {}) {
  const profileId =
    context.courseProfileId ||
    context.course_profile_id ||
    context.course_identity?.profile_id ||
    context.profile_id ||
    null;
  return profileId === 'glasgow-a100' && guidancePool?.pool_id === 'scotland_home_school_leaver';
}

function isGlasgowRukUcatPredictionContext(guidancePool = {}, context = {}) {
  const profileId =
    context.courseProfileId ||
    context.course_profile_id ||
    context.course_identity?.profile_id ||
    context.profile_id ||
    null;
  return profileId === 'glasgow-a100' && guidancePool?.pool_id === 'home_rest_of_uk_school_leaver';
}

function deriveHistoricalBenchmark(guidancePool = {}, scoreModel = {}, matchedBandRule = null, context = {}) {
  const pool = guidancePool || {};
  const rules = (pool.band_rules || []).filter((rule) =>
    rule.metric === undefined || rule.metric === pool.metric
  );
  if (pool.metric !== 'ucat_total' || rules.length === 0) {
    return { comparison_type: 'ranking_only', benchmark_min: null, benchmark_max: null };
  }

  const derivedBandBenchmark = derivedBandBenchmarkFromRule(matchedBandRule, pool);
  if (derivedBandBenchmark) {
    return derivedBandBenchmark;
  }

  if (pool.comparison_guidance?.comparison_type === 'current_guidance') {
    const guidanceKey = String(pool.pool_id || '').includes('international')
      ? 'international'
      : 'home';
    const guidance = scoreModel?.current_scale_guidance?.[guidanceKey];
    if (Number.isFinite(guidance?.value)) {
      return {
        comparison_type: 'current_guidance',
        benchmark_min: guidance.value,
        benchmark_max: null,
        benchmark_label: pool.comparison_guidance?.label || null,
        caveat: pool.comparison_guidance?.caveat || null
      };
    }
  }

  const realisticRange = rules.find((rule) =>
    rule.band === 'realistic' &&
    rule.operator === 'between_inclusive' &&
    Number.isFinite(rule.min) &&
    Number.isFinite(rule.max)
  );
  if (realisticRange) {
    const glasgowScotlandHomePredictionBand =
      isGlasgowScotlandHomeUcatPredictionContext(pool, context);
    const glasgowRukPredictionBand = isGlasgowRukUcatPredictionContext(pool, context);
    const glasgowApplySmartPredictionBand =
      glasgowScotlandHomePredictionBand || glasgowRukPredictionBand;
    return {
      comparison_type: 'historical_range',
      benchmark_min: realisticRange.min,
      benchmark_max: realisticRange.max,
      benchmark_label: glasgowApplySmartPredictionBand
        ? 'ApplySmart prediction band'
        : pool.comparison_guidance?.label || null,
      caveat: glasgowScotlandHomePredictionBand
        ? GLASGOW_SCOTLAND_HOME_UCAT_PREDICTION_CAVEAT
        : glasgowRukPredictionBand
        ? GLASGOW_RUK_UCAT_PREDICTION_CAVEAT
        : pool.comparison_guidance?.caveat || null,
      evidence_status: glasgowApplySmartPredictionBand ? 'applysmart_derived' : null,
      evidence_classification: glasgowApplySmartPredictionBand
        ? 'applysmart_prediction_guidance'
        : null,
      prediction_band: glasgowApplySmartPredictionBand ? realisticRange.band || null : null
    };
  }

  const thresholdRule =
    rules.find((rule) =>
      ['interview_likely', 'realistic'].includes(rule.band) &&
      ['greater_than', 'greater_than_or_equal'].includes(rule.operator) &&
      Number.isFinite(rule.value)
    ) ||
    rules.find((rule) =>
      ['ambitious', 'high_risk'].includes(rule.band) &&
      ['less_than', 'less_than_or_equal'].includes(rule.operator) &&
      Number.isFinite(rule.value)
    );

  return thresholdRule
    ? {
      comparison_type: pool.comparison_guidance?.comparison_type || 'historical_threshold',
      benchmark_min: thresholdRule.value,
      benchmark_max: null,
      benchmark_label: pool.comparison_guidance?.label || null,
      caveat: pool.comparison_guidance?.caveat || null
    }
    : { comparison_type: 'ranking_only', benchmark_min: null, benchmark_max: null };
}

function positionAgainstBenchmark(applicantUcat, comparison) {
  if (!Number.isFinite(applicantUcat)) return null;
  if (comparison.comparison_type === 'applysmart_prediction_band') {
    return 'within';
  }
  if (comparison.comparison_type === 'historical_range') {
    if (applicantUcat < comparison.benchmark_min) return 'below';
    if (applicantUcat > comparison.benchmark_max) return 'above';
    return 'within';
  }
  if (
    ['official_minimum', 'historical_threshold', 'historical_average', 'current_guidance'].includes(comparison.comparison_type) &&
    Number.isFinite(comparison.benchmark_min)
  ) {
    return applicantUcat < comparison.benchmark_min ? 'below' : 'above';
  }
  return null;
}

function buildUcatComparison(options = {}) {
  const applicantUcat =
    ['ucat_total', 'aberdeen_adjusted_selection_ucat_total'].includes(options.bandMetric?.metric) &&
    Number.isFinite(options.bandMetric.value)
      ? options.bandMetric.value
      : options.applicantContext?.admissions_tests?.ucat?.total_score;
  const officialMinimum = resolveApplicantUcatMinimum(
    options.stage1Eligibility,
    options.applicantGroupIds
  );
  const minimumFailure = (options.eligibilityFailures || [])
    .some((failure) => String(failure).startsWith('minimum_ucat_total_not_met'));
  const benchmark = deriveHistoricalBenchmark(
    options.guidancePool,
    options.scoreModel,
    options.matchedBandRule,
    {
      courseProfileId:
        options.courseProfileId ||
        options.course_profile_id ||
        options.course_identity?.profile_id ||
        null
    }
  );
  const comparison = minimumFailure && officialMinimum
    ? {
      comparison_type: 'official_minimum',
      benchmark_min: officialMinimum,
      benchmark_max: null
    }
    : benchmark;
  const position = positionAgainstBenchmark(applicantUcat, comparison);
  const differenceFromBenchmark =
    Number.isFinite(applicantUcat) &&
    ['official_minimum', 'historical_threshold', 'historical_average', 'current_guidance'].includes(comparison.comparison_type) &&
    Number.isFinite(comparison.benchmark_min)
      ? applicantUcat - comparison.benchmark_min
      : null;
  const sjt = buildSjtInterpretation(
    options.stage1Eligibility,
    options.applicantGroupIds,
    options.applicantContext
  );
  const publicBenchmarkLabel = comparison.comparison_type === 'ranking_only'
    ? null
    : publicUcatComparisonPhrase(comparison);
  const publicCaveat = comparison.comparison_type === 'ranking_only'
    ? null
    : publicComparisonCaveat(comparison);

  return {
    comparison_type: comparison.comparison_type,
    applicant_ucat: Number.isFinite(applicantUcat) ? applicantUcat : null,
    benchmark_min: comparison.benchmark_min,
    benchmark_max: comparison.benchmark_max,
    comparison_operator: comparison.comparison_operator || null,
    benchmark_label: publicBenchmarkLabel,
    caveat: publicCaveat,
    evidence_status: comparison.evidence_status || null,
    evidence_classification: comparison.evidence_classification || null,
    prediction_band: comparison.prediction_band || null,
    difference_from_benchmark: differenceFromBenchmark,
    position,
    applicant_pool: options.applicantPool ||
      humanApplicantPoolLabel(options.applicantGroupIds, options.applicantContext) ||
      null,
    sjt_policy: sjt.sjt_policy,
    sjt_outcome: sjt.sjt_outcome,
    sjt_summary: sjt.summary,
    applicant_sjt_band: sjt.applicant_sjt_band,
    official_ucat_minimum: Number.isFinite(officialMinimum)
      ? {
        minimum: officialMinimum,
        met: Number.isFinite(applicantUcat) ? applicantUcat >= officialMinimum : false,
        summary: Number.isFinite(applicantUcat)
          ? `${applicantUcat >= officialMinimum ? 'Met' : 'Not met'} - your score is ${applicantUcat} and the published minimum is ${officialMinimum}.`
          : `Not met - the published minimum is ${officialMinimum}.`
      }
      : null
  };
}

function ucatComparisonAssessmentText(comparison) {
  const ucat = comparison?.applicant_ucat;
  if (!comparison || !Number.isFinite(ucat)) {
    return 'UCAT ranking: Eligible applicants are ranked by UCAT. No reliable numerical historical comparison is available.';
  }
  const comparisonName = ucatComparisonDisplayName(comparison);

  if (comparison.comparison_type === 'official_minimum') {
    return `UCAT minimum: ${comparison.position === 'below' ? 'Not met' : 'Met'} - your score is ${ucat} and the published minimum is ${comparison.benchmark_min}.`;
  }
  if (comparison.comparison_type === 'historical_threshold') {
    const difference = comparison.difference_from_benchmark;
    if (Number.isFinite(difference)) {
      const direction = difference >= 0 ? 'above' : 'below';
      return `UCAT: ${ucat} - ${Math.abs(difference)} points ${direction} the ${comparisonName} of ${comparison.benchmark_min}.`;
    }
    return `UCAT: ${ucat} - compared with the ${comparisonName} of ${comparison.benchmark_min}.`;
  }
  if (comparison.comparison_type === 'current_guidance') {
    const difference = comparison.difference_from_benchmark;
    if (Number.isFinite(difference)) {
      const direction = difference >= 0 ? 'above' : 'below';
      return `UCAT: ${ucat}/2700 - ${Math.abs(difference)} points ${direction} the ${comparisonName} of ${comparison.benchmark_min}/2700.`;
    }
    return `UCAT: ${ucat}/2700 - compared with the ${comparisonName} of ${comparison.benchmark_min}/2700.`;
  }
  if (comparison.comparison_type === 'applysmart_prediction_band') {
    const rangeText = comparison.comparison_operator === 'greater_than_or_equal'
      ? `${comparison.benchmark_min}+`
      : comparison.comparison_operator === 'greater_than'
        ? `>${comparison.benchmark_min}`
        : comparison.comparison_operator === 'less_than'
          ? `<${comparison.benchmark_min}`
          : comparison.comparison_operator === 'less_than_or_equal'
            ? `<=${comparison.benchmark_min}`
            : `${comparison.benchmark_min}-${comparison.benchmark_max}`;
    return `UCAT: ${ucat} - within the ApplySmart prediction band of ${rangeText}.`;
  }
  if (comparison.comparison_type === 'historical_range') {
    const positionText = { above: 'above', within: 'within', below: 'below' }[comparison.position] || 'compared with';
    return `UCAT: ${ucat} - ${positionText} the ${comparisonName} of ${comparison.benchmark_min}-${comparison.benchmark_max}.`;
  }
  if (comparison.comparison_type === 'historical_average') {
    const direction = comparison.position === 'below' ? 'below' : 'above';
    return `UCAT: ${ucat} - ${direction} the ${comparisonName} of ${comparison.benchmark_min}.`;
  }

  return 'UCAT ranking: Eligible applicants are ranked by UCAT. No reliable numerical historical comparison is available.';
}

function ucatComparisonRecommendationText(comparison) {
  if (!comparison || comparison.position === null) {
    return 'You meet the academic requirements. Eligible applicants are ranked by UCAT. No reliable numerical historical comparison is available.';
  }
  if (comparison.comparison_type === 'official_minimum') {
    return comparison.position === 'below'
      ? 'A published UCAT minimum is not met.'
      : 'You meet the published UCAT minimum.';
  }

  return standardUcatComparisonSentence(comparison);
}

function officialPredictionInstitutionName(context = {}) {
  return context.course_identity?.university_name || context.university_name || 'the university';
}

function officialPredictionUnavailableSelectionSummary(context = {}) {
  const institution = officialPredictionInstitutionName(context);
  return `ApplySmart analysis uses the official ${institution} eligibility criteria and available admissions evidence to support interview competitiveness guidance. This is not a university decision or a guarantee of interview.`;
}

function isUcatRankingContext(context = {}) {
  if (ucatRankingBypassApplies(context)) {
    return false;
  }

  const rankingHasComponents = Object.keys(context.ranking?.components || {}).length > 0;
  return (
    context.band_metric?.metric === 'ucat_total' ||
    context.band_metric?.metric === 'aberdeen_adjusted_selection_ucat_total' ||
    context.stage_2_selection?.represented_ranking_input?.metric === 'ucat_total' ||
    (
      context.score_model?.type === 'ranking_metric' &&
      context.score_model?.metric === 'ucat_total' &&
      !rankingHasComponents
    )
  );
}

function completedCardScoreBreakdown(card, transparency) {
  if (!completedCardHasScoringSurface(card, transparency)) {
    return null;
  }

  const existingScoreBreakdown = transparency?.score_breakdown || {};
  const value = completedCardScoreValue(card);
  const max = completedCardScoreMax(card);
  const checks = scoreBreakdownChecksFromCompletedCard(card, transparency);
  const breakdown = {
    name:
      existingScoreBreakdown.name ||
      card.estimated_selection_score?.label ||
      (card.official_score ? 'Official Nottingham pre-interview score' : 'Selection score'),
    value,
    max,
    status: Number.isFinite(value) ? 'calculated' : 'unavailable',
    explanation:
      card.estimated_selection_score?.disclosure ||
      card.stage_2?.formula ||
      card.official_score?.formula ||
      null,
    checks
  };
  if (card.estimated_selection_score?.official === false) {
    breakdown.unofficial = true;
  }
  for (const field of ['applicable_max_score', 'selection_score_max', 'global_max']) {
    if (Number.isFinite(existingScoreBreakdown[field])) {
      breakdown[field] = existingScoreBreakdown[field];
    }
  }
  return breakdown;
}

function normaliseExistingDecisionTransparency(card) {
  const transparency = card.decision_transparency;
  if (!transparency || typeof transparency !== 'object') {
    return null;
  }

  const normalised = {
    ...transparency,
    evidence_confidence: transparency.evidence_confidence || card.evidence_confidence || buildEvidenceConfidence(card),
    warnings: [],
    manual_review_reason: transparency.manual_review_reason ?? null,
    insufficient_evidence_reason: transparency.insufficient_evidence_reason ?? null
  };

  const scoreBreakdown = completedCardScoreBreakdown(card, normalised);
  if (scoreBreakdown) {
    normalised.score_breakdown = scoreBreakdown;
  } else if (!Object.prototype.hasOwnProperty.call(transparency, 'score_breakdown')) {
    delete normalised.score_breakdown;
  }

  return normalised;
}

function decisionState(card, options = {}) {
  if (isNotEligible(card)) {
    return 'not_eligible';
  }
  if (isManualReview(card, options)) {
    return 'manual_review';
  }
  if (isEligibilityOnlyContext(card, options)) {
    return 'eligibility_only';
  }
  if (isInsufficientEvidence(card)) {
    return 'insufficient_evidence';
  }
  return 'standard';
}

function buildDecisionTimeline(card, options = {}) {
  const state = decisionState(card, options);
  const presentation = configuredPresentation(card, options);
  const ucatRankingBypass = ucatRankingBypassApplies({ ...card, ...options });
  const eligibilityStatus =
    state === 'not_eligible'
      ? 'Not eligible'
      : state === 'manual_review'
        ? 'Manual review'
        : card.eligibility?.status === 'insufficient_evidence'
          ? 'Insufficient evidence'
          : 'Eligible';
  const eligibilitySummary = {
    'Not eligible':
      'One or more published entry requirements covered by ApplySmart are not met.',
    'Manual review':
      'Some applicant information must be checked before eligibility can be confirmed.',
    'Insufficient evidence':
      'There is not enough verified applicant information to complete the eligibility assessment.',
    Eligible:
      'You meet the published entry requirements covered by ApplySmart.'
  }[eligibilityStatus];
  const officialPredictionReason =
    officialPredictionUnavailable(card, options)
      ? card.prediction?.official_prediction?.explanation ||
        options.officialPrediction?.explanation ||
        card.primary_explanation ||
        null
      : null;
  const officialPredictionSelectionSummary = officialPredictionReason
    ? officialPredictionUnavailableSelectionSummary(card)
    : null;
  const selectionSummary = (
    ucatRankingBypass
      ? presentation.timeline_selection_summary ||
        presentation.selection_summary ||
        options.selectionApproachDisplay
      : options.selectionApproachDisplay ||
        presentation.timeline_selection_summary ||
        presentation.selection_summary
  ) ||
    studentFacingText(card.stage_2_selection?.summary) ||
    officialPredictionSelectionSummary ||
    (officialPredictionReason ? `Official prediction unavailable. ${officialPredictionReason}` : null) ||
    'The university selection approach was applied after the eligibility checks.';
  const existingSelectionTimelineSummary = card.decision_timeline
    ?.find((step) => step.step === 3 && step.title === 'Selection model applied')
    ?.summary;
  const hideSelectionDetails = hideSelectionScoreDetails(presentation);
  const finalStatus =
    card.prediction?.result_band === 'eligible_to_apply'
      ? 'Eligible to apply'
      : CANONICAL_BAND_LABELS[card.prediction?.result_band] || 'Insufficient evidence';
  const selectionScoreComparison = hideSelectionDetails || ucatRankingBypass
    ? null
    : options.selectionScoreComparison || selectionScoreThresholdComparison(options);
  const selectionScoreText =
    hideSelectionDetails
      ? null
      : selectionScoreThresholdText(selectionScoreComparison) ||
        existingSelectionScoreThresholdText(card);
  const ucatComparisonText =
    ['applysmart_prediction_band', 'current_guidance', 'historical_range', 'historical_threshold', 'historical_average'].includes(options.ucatComparison?.comparison_type)
      ? ucatComparisonAssessmentText(options.ucatComparison)
      : null;
  const historicalPresentationSummary = presentation.historical_summary || null;
  const existingHistoricalTimelineSummary = card.decision_timeline
    ?.find((step) => step.step === 4 && step.title === 'Historical guidance compared')
    ?.summary;
  const reusableHistoricalTimelineSummary = /compares favourably/i.test(String(existingHistoricalTimelineSummary || ''))
    ? null
    : existingHistoricalTimelineSummary;

  return [
    {
      step: 1,
      title: 'Applicant details checked',
      status: 'Complete',
      summary: state === 'eligibility_only'
        ? 'Your applicant type and qualifications were checked.'
        : 'Your applicant type, qualifications and UCAT details were checked.'
    },
    {
      step: 2,
      title: 'Eligibility assessed',
      status: eligibilityStatus,
      summary: eligibilitySummary
    },
    {
      step: 3,
      title: 'Selection model applied',
      status:
        state === 'eligibility_only'
          ? 'Not predicted'
          : state === 'standard'
          ? 'Complete'
          : state === 'manual_review'
            ? 'Manual review'
            : state === 'insufficient_evidence'
              ? 'Insufficient evidence'
              : 'Not applied',
      summary:
        state === 'eligibility_only'
          ? ELIGIBILITY_ONLY_SELECTION_SUMMARY
          : state === 'standard'
          ? existingSelectionTimelineSummary || selectionSummary
          : state === 'manual_review'
            ? 'The selection approach needs adviser review before it can be completed.'
            : state === 'insufficient_evidence'
              ? selectionSummary
              : 'The selection approach was not applied because the entry requirements are not met.'
    },
    {
      step: 4,
      title: 'Historical guidance compared',
      status:
        state === 'eligibility_only'
          ? 'Not used'
          : ucatRankingBypass
          ? 'Not used'
          : state === 'standard'
          ? 'Complete'
          : state === 'insufficient_evidence'
            ? 'Insufficient evidence'
            : 'Not applied',
      summary:
        state === 'eligibility_only'
          ? historicalSummary(card, state, { selectionScoreComparison, ucatComparison: options.ucatComparison })
          : ucatRankingBypass
          ? historicalSummary(card, state, {
            ...options,
            selectionScoreComparison,
            ucatComparison: options.ucatComparison
          })
          : state === 'standard'
          ? (reusableHistoricalTimelineSummary || historicalPresentationSummary)
            ? (reusableHistoricalTimelineSummary || historicalPresentationSummary)
            : selectionScoreText
            ? `${selectionScoreText} It was compared with historical admissions data. ${HISTORICAL_GUIDANCE_CAVEAT}`
            : ucatComparisonText
              ? `${ucatComparisonText} ${options.ucatComparison?.caveat || HISTORICAL_GUIDANCE_CAVEAT}`
              : `${card.prediction?.ranking_metric === 'ucat_total' ? 'Your UCAT' : 'Your result'} was compared with historical admissions data. ${HISTORICAL_GUIDANCE_CAVEAT}`
		          : state === 'insufficient_evidence'
		            ? historicalSummary(card, state, {
	              ...options,
	              selectionScoreComparison,
	              ucatComparison: options.ucatComparison
	            })
	            : state === 'manual_review'
	              ? `Historical admissions data was not compared while adviser review is required. ${HISTORICAL_GUIDANCE_CAVEAT}`
	              : `Historical admissions data was not compared because the entry requirements are not met. ${HISTORICAL_GUIDANCE_CAVEAT}`
    },
    {
      step: 5,
      title: 'Interview recommendation produced',
      status:
        state === 'not_eligible'
          ? 'Not eligible'
          : state === 'manual_review'
            ? 'Manual review'
            : state === 'eligibility_only'
              ? 'Eligible to apply'
            : state === 'insufficient_evidence'
              ? 'Insufficient evidence'
              : finalStatus,
      summary: recommendationSummary(card, state, {
        selectionScoreComparison,
        selectionScoreText,
        insufficientEvidenceReasonCode: options.insufficientEvidenceReasonCode,
        guidancePool: options.guidancePool,
        scoreModel: options.scoreModel,
        context: { ...card, ...options },
        stage1Eligibility: options.stage1Eligibility,
        riskExplanation: options.riskExplanation
      })
    }
  ];
}

function resolveInsufficientEvidenceReason({
  insufficientEvidenceReason = null,
  insufficientEvidenceReasonCode = null,
  presentation = {},
  card = {},
  includeDefaultEvidenceReason = true
} = {}) {
  const missingInformation =
    card.missing_information ||
    card.decision_transparency?.missing_information ||
    null;
  const providedGcseCount = Number(missingInformation?.provided_count);
  const requiredGcseCount = Number(missingInformation?.required_count);
  const gcseComponentLabel = firstNonEmptyString(
    missingInformation?.component_label,
    'published scoring model'
  );
  const hasProvidedAndRequiredGcseCounts =
    Number.isFinite(providedGcseCount) && Number.isFinite(requiredGcseCount);

  return firstNonEmptyString(
    insufficientEvidenceReason,
    card.decision_transparency?.insufficient_evidence_reason,
    reasonScopedPresentationValue(
      presentation,
      'insufficient_evidence_reason_messages',
      insufficientEvidenceReasonCode
    ),
    insufficientEvidenceReasonCode === 'insufficient_gcse_results' && hasProvidedAndRequiredGcseCounts
      ? `This university ranks applicants using the best ${smallNumberWord(requiredGcseCount)} GCSEs. Only ${smallNumberWord(providedGcseCount)} GCSEs are available, so the ${gcseComponentLabel} cannot be calculated. This is not a rejection.`
      : null,
    insufficientEvidenceReasonCode === 'insufficient_gcse_results'
      ? 'ApplySmart needs a more complete GCSE profile before it can assess your interview potential for this course. This is not a rejection.'
      : null,
    presentation.insufficient_evidence_explanation,
    card.prediction?.cannot_predict_explanation,
    (card.prediction?.missing_data_reasons || [])[0],
    insufficientEvidenceReasonCode === 'university_methodology_gap'
      ? 'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.'
      : null,
    insufficientEvidenceReasonCode === 'prediction_calibration_unavailable'
      ? 'ApplySmart has not approved public prediction calibration for this applicant group.'
      : null,
    isApplicantInformationReasonCode(insufficientEvidenceReasonCode)
      ? 'ApplySmart needs more applicant information before it can calculate this selection score.'
      : null,
    includeDefaultEvidenceReason
      ? 'Verified historical interview information is not available for this applicant group.'
      : null
  );
}

function glasgowReachCompletionInformationNeededReason(card = {}) {
  const profileId = card.course_identity?.profile_id || card.course_profile_id || card.profile_id;
  if (profileId !== 'glasgow-a100') {
    return null;
  }

  const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
  const manualReviewReasons = [
    ...(Array.isArray(card.eligibility?.manual_review_reasons)
      ? card.eligibility.manual_review_reasons
      : []),
    ...(Array.isArray(card.manual_review_reasons)
      ? card.manual_review_reasons
      : []),
    contextual?.manual_review_reason
  ]
    .map(normaliseCheckId)
    .filter(Boolean);

  return manualReviewReasons.includes('glasgow_reach_completion_required')
    ? GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON
    : null;
}

function appendNotARejection(reason) {
  if (!reason) {
    return null;
  }
  return /not a rejection|does not mean you are ineligible/i.test(reason)
    ? reason
    : `${reason.replace(/\s+$/, '').replace(/[.?!]?$/, '.')} This is not a rejection.`;
}

function publicInformationNeededReason({
  state,
  manualReviewReason = null,
  insufficientEvidenceReason = null,
  insufficientEvidenceReasonCode = null,
  missingInformation = null,
  presentation = {},
  card = {}
} = {}) {
  if (state === 'manual_review') {
    const profileId = card.course_identity?.profile_id || card.course_profile_id;
    const contextual = card.eligibility?.contextual_eligibility || card.contextual_eligibility || null;
    const lancasterAccessWpReviewReason = lancasterAccessToMedicineWpReviewReason(card, missingInformation);
    const glasgowReachCompletionReason = glasgowReachCompletionInformationNeededReason(card);
    if (glasgowReachCompletionReason) {
      return glasgowReachCompletionReason;
    }
    if (lancasterAccessWpReviewReason) {
      return appendNotARejection(lancasterAccessWpReviewReason);
    }
    if (hasAberdeenReachContextualReview(card, missingInformation)) {
      return appendNotARejection(ABERDEEN_REACH_CONTEXTUAL_REVIEW_REASON);
    }
    if (profileId === 'bristol-a100' && contextual?.status === 'information_needed') {
      const missing = Array.isArray(
        missingInformation ||
        card.missing_information ||
        card.decision_transparency?.missing_information
      )
        ? (
          missingInformation ||
          card.missing_information ||
          card.decision_transparency?.missing_information
        )
        : [];
      const labels = missing
        .map((entry) => String(entry?.label || entry?.criterion_id || '').trim())
        .filter(Boolean);
      const suffix = labels.length > 0
        ? ` Missing evidence: ${labels.join(', ')}.`
        : '';
      return appendNotARejection(
        `More information is needed to confirm whether you qualify for Bristol’s contextual offer.${suffix}`
      );
    }
    return appendNotARejection(
      firstNonEmptyString(
        card.decision_transparency?.manual_review_reason,
        manualReviewReason,
        GENERIC_MANUAL_REVIEW_EXPLANATION
      )
    );
  }

  if (state !== 'insufficient_evidence') {
    return null;
  }

  return appendNotARejection(
    resolveInsufficientEvidenceReason({
      insufficientEvidenceReason,
      insufficientEvidenceReasonCode,
      presentation,
      card: {
        ...card,
        missing_information:
          missingInformation ||
          card.missing_information ||
          card.decision_transparency?.missing_information ||
          null
      },
      includeDefaultEvidenceReason: false
    }) || GENERIC_INSUFFICIENT_EVIDENCE_EXPLANATION
  );
}

function contextualEligibilityStatus(context = {}) {
  return (
    context.eligibility?.contextual_eligibility?.status ||
    context.contextual_eligibility?.status ||
    null
  );
}

function normalizeFactorUsage(card, options = {}) {
  const stage1Eligibility = options.stage1Eligibility || card.stage_1_eligibility || null;
  const stage2Selection = options.stage2InterviewSelection || card.stage_2_interview_selection || null;
  const applicantContext = options.applicantContext || card.applicant_context || null;
  const ucat = applicantContext?.admissions_tests?.ucat || null;
  const hasUcatEvidence = Number.isFinite(ucat?.total_score);
  const gcseRole = stage1Eligibility?.gcse?.selection_role;
  const aLevelRole = stage1Eligibility?.post_16?.a_level?.selection_role;
  const holisticReview = stage2Selection?.primary_model === 'holistic_review';
  const aLevelUsedInSelection = aLevelRole === 'selection' || aLevelRole === 'contextual_academic_review_only' || (holisticReview && !aLevelRole && Boolean(stage1Eligibility?.post_16?.a_level?.standard_offer));
  const sjtUsed = stage1Eligibility?.admissions_tests?.sjt?.used === true;
  const sjtGate = stage1Eligibility?.admissions_tests?.sjt?.used_as_gate === true;
  const sjtScored = stage1Eligibility?.admissions_tests?.sjt?.scoring?.used_in_score === true;
  const contextualConfirmed = contextualEligibilityStatus(card) === 'contextual';
  const contextualRole = contextualConfirmed ? 'contextual' : 'not_used';
  const ucatEligibility = stage1Eligibility?.admissions_tests?.ucat || {};
  const ucatRankingBypass = ucatRankingBypassApplies({ ...card, ...options });
  const guaranteedInterviewBypass = options.interviewOutcome === 'guaranteed_interview';
  const ucatSelectionText = [
    ucatEligibility.selection_role,
    ucatEligibility.used === false ? 'not used' : null,
    ucatEligibility.used === true ? 'used' : null,
    ucatEligibility.used_as_gate === true ? 'eligibility gate' : null,
    ucatEligibility.used_as_gate === false ? 'not used as gate' : null,
    ucatEligibility.required === true ? 'required' : null,
    ucatEligibility.required === false ? 'not required' : null,
    ucatEligibility.score_used_for_ranking,
    ucatEligibility.calculation_method,
    ucatEligibility.notes,
    stage2Selection?.primary_model,
    stage2Selection?.selection_model_label,
    stage2Selection?.primary_method,
    stage2Selection?.notes,
    ...(Array.isArray(stage2Selection?.ranking_factors)
      ? stage2Selection.ranking_factors.flatMap((factor) => [
          factor?.factor_id,
          factor?.factor,
          factor?.role,
          factor?.notes,
          factor?.source_field
        ])
      : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const ucatRankingUse =
    stage2Selection?.primary_model === 'ucat_ranking' ||
    (/(?:\bucat\b|\bucat cognitive total\b|\bucat total\b)/.test(ucatSelectionText) && /\branking\b/.test(ucatSelectionText));
  const ucatConsideredUse =
    stage2Selection?.primary_model === 'holistic_review' ||
    /(review_factor|qualitative_modifier|considered alongside|considered as part of|holistic review)/.test(ucatSelectionText);
  const ucatExplicitlyNotGate =
    ucatEligibility.used_as_gate === false ||
    /\bnot used as (?:an? )?(?:eligibility )?gate\b|\bnot (?:an? )?(?:eligibility )?gate\b/.test(ucatSelectionText);
  const ucatEligibilityUse =
    ucatEligibility.used_as_gate === true ||
    (guaranteedInterviewBypass && ucatEligibility.required !== false) ||
    (!ucatExplicitlyNotGate && /\bucat\b/.test(ucatSelectionText) && /\beligibility gate\b|\bgate\b|\bfilter\b/.test(ucatSelectionText));
  const ucatExplicitlyNotUsed =
    (!ucatRankingUse && !ucatConsideredUse && !ucatEligibilityUse) && (
      /\bnot used\b|\bnot scored\b|\bignored\b/.test(ucatSelectionText) ||
      ucatEligibility.required === false
    );

  const factorUsage = [
    {
      factor_id: 'ucat',
      label: 'UCAT',
      role: ucatExplicitlyNotUsed
        ? 'not_used'
        : ucatRankingBypass || ucatEligibilityUse
          ? 'eligibility'
          : ucatRankingUse
          ? 'ranking'
          : ucatConsideredUse
            ? 'considered'
            : 'unknown',
      detail: ucatRankingBypass
        ? 'Used as a minimum eligibility gate; competitive UCAT ranking is bypassed for this route.'
        : guaranteedInterviewBypass && ucatEligibility.required !== false
          ? 'Required as an eligibility condition; competitive UCAT ranking is bypassed for this guaranteed-interview route.'
        : ucatRankingUse
        ? 'Used for ranking in the university’s selection process.'
        : ucatConsideredUse
          ? 'Used as part of the university’s holistic selection review.'
          : ucatEligibilityUse
            ? 'Used as an eligibility gate.'
            : ucatExplicitlyNotUsed
              ? 'UCAT is not required for this route.'
              : 'UCAT selection role is not fully specified.',
      evidence_status: hasUcatEvidence ? 'available' : 'missing'
    },
    {
      factor_id: 'gcse',
      label: 'GCSEs',
      role: gcseRole === 'contextual_academic_review_only' || gcseRole === 'contextual_selection' ? 'considered' : gcseRole === 'eligibility_only' ? 'eligibility' : 'unknown',
      detail: gcseRole === 'contextual_academic_review_only'
        ? 'Used as part of the university’s academic context review.'
        : gcseRole === 'eligibility_only'
          ? 'Used as an academic eligibility requirement.'
          : 'GCSEs are part of the university’s academic review.',
      evidence_status: 'available'
    },
    {
      factor_id: 'a_level',
      label: 'A-levels',
      role: aLevelRole === 'eligibility_only' ? 'eligibility' : aLevelUsedInSelection ? 'considered' : 'unknown',
      detail: aLevelRole === 'eligibility_only'
        ? 'Used as an academic eligibility requirement.'
        : 'Used as part of the university’s academic review.',
      evidence_status: 'available'
    },
    {
      factor_id: 'sjt',
      label: 'SJT',
      role: sjtScored ? 'ranking' : sjtGate ? 'eligibility' : sjtUsed ? 'considered' : 'not_used',
      detail: sjtScored
        ? 'SJT contributes to the university’s selection scoring.'
        : sjtGate
          ? 'SJT is used as an eligibility gate.'
          : sjtUsed
            ? 'SJT is considered by the university.'
            : 'SJT is not used for interview selection.',
      evidence_status: sjtUsed || sjtGate || sjtScored ? 'available' : 'not_applicable'
    },
    {
      factor_id: 'contextual',
      label: 'Contextual',
      role: contextualRole,
      detail: contextualConfirmed
        ? 'Contextual information is used as part of the university’s contextual review.'
        : 'Contextual information is not used for this route.',
      evidence_status: contextualConfirmed ? 'available' : 'not_applicable'
    }
  ];

  return factorUsage;
}

function buildDecisionTransparency(card, options = {}) {
  if (!hasBuilderOptions(options)) {
    const existing = normaliseExistingDecisionTransparency(card);
    if (existing) {
      return existing;
    }
  }

  const presentation = configuredPresentation(card, options);
  const state = decisionState(card, options);
  const notEligible = state === 'not_eligible';
  const ucatRankingBypass = ucatRankingBypassApplies({ ...card, ...options });
  const profileId =
    card.course_identity?.profile_id ||
    card.course_profile_id ||
    card.profile_id ||
    options.courseProfileId ||
    null;
  const configuredPoolLabelFirst =
    profileId === 'dundee-a100' ? presentation.pool_label : null;
  const pool = options.interviewOutcome === 'guaranteed_interview'
    ? options.guaranteedInterviewPoolLabel ||
      presentation.pool_label ||
      'Guaranteed-interview verified applicants'
    : options.applicantPool ||
      configuredPoolLabelFirst ||
      (ucatRankingBypass ? presentation.pool_label : null) ||
      humanApplicantPoolLabel(options.applicantGroupIds, options.applicantContext) ||
      presentation.pool_label ||
      'The applicant group matching the supplied fee status and entry route';
  const eligibilitySummary = studentFacingText(
    options.eligibilitySummary ||
    card.eligibility?.summary ||
    (notEligible
      ? 'One or more supported entry requirements are not met.'
      : 'The supported entry requirements are met.')
  );
  const glasgowReachCompletionReason = glasgowReachCompletionInformationNeededReason(card);
  const manualReviewReason =
    state === 'manual_review'
      ? options.manualReviewReason ||
        glasgowReachCompletionReason ||
        'Some required applicant information is missing or needs confirmation by an adviser.'
      : null;
  const insufficientEvidenceReasonCode =
    state === 'insufficient_evidence' ? options.insufficientEvidenceReasonCode || null : null;
  const insufficientEvidenceReason =
    state === 'insufficient_evidence'
      ? resolveInsufficientEvidenceReason({
        insufficientEvidenceReason: options.insufficientEvidenceReason,
        insufficientEvidenceReasonCode,
        presentation,
        card
      })
      : null;
  const informationNeededReason =
    state === 'manual_review' || state === 'insufficient_evidence'
      ? options.informationNeededReason ||
        publicInformationNeededReason({
          state,
          manualReviewReason,
          insufficientEvidenceReason,
          insufficientEvidenceReasonCode,
          missingInformation: options.missingInformation,
          presentation,
          card
        })
      : null;
  const missingInformation =
    options.missingInformation ||
    card.missing_information ||
    null;
  const officialPrediction = options.officialPrediction || card.prediction?.official_prediction || null;
  const officialPredictionReason =
    officialPrediction?.available === false
      ? officialPrediction.explanation ||
        'Official interview prediction is unavailable because the university has not published enough current-cycle information for ApplySmart to reproduce it.'
      : null;
  const selectionSummary = (
    ucatRankingBypass
      ? presentation.selection_summary ||
        options.selectionApproachDisplay
      : options.selectionApproachDisplay ||
        presentation.selection_summary
  ) ||
    card.stage_2_selection?.summary ||
    'The university selection approach is applied after eligibility checks.';
  const contextualOffer = buildAlternativeAcademicOffer(options.stage1Eligibility, {
    academic_pathway: card.academic_pathway || card.eligibility?.academic_pathway || null,
    academic_pathway_id: card.academic_pathway_id || card.eligibility?.academic_pathway_id || null,
    selection_route_id: card.selection_route_id || card.eligibility?.selection_route_id || null
  });
  const contextualRouteSummaryText = contextualOfferRouteSummary(card, contextualOffer);
  const guaranteedInterview = options.interviewOutcome === 'guaranteed_interview';
  const hideScoreBreakdown = presentation.hide_score_breakdown === true;
  const hideSelectionDetails = hideSelectionScoreDetails(presentation);
  const scoreBreakdown =
    state === 'standard' && !guaranteedInterview && !hideScoreBreakdown
      ? buildScoreBreakdown(options)
      : null;
  const selectionScoreComparison = hideSelectionDetails || ucatRankingBypass
    ? null
    : options.selectionScoreComparison || selectionScoreThresholdComparison(options);
  const ucatComparison =
    options.ucatComparison ||
    (isUcatRankingContext({ ...card, ...options }) && !guaranteedInterview
      ? buildUcatComparison(options)
      : null);
  const ucatAdjustment = buildUcatAdjustmentPresentation(options);
  const selectionChecks = [
    check('Applicant pool', 'Used', pool),
    ...(contextualRouteSummaryText
      ? [check(
        'Contextual eligibility',
        'Confirmed',
        contextualRouteSummaryText
      )]
      : []),
    ...(guaranteedInterview
      ? [check(
        'Selection approach',
        'Guaranteed interview',
        options.guaranteedInterviewSelectionSummary ||
          'Every published guaranteed-interview condition for this route has been verified as met, so the usual scored/ranked selection approach does not apply.'
      )]
        : state === 'eligibility_only'
          ? [
            check('Selection approach', 'Not predicted', ELIGIBILITY_ONLY_SELECTION_SUMMARY),
            check('Interview prediction', 'Unavailable', ELIGIBILITY_ONLY_SELECTION_SUMMARY)
          ]
        : state !== 'standard'
          ? [check('Selection approach', 'Not applied', selectionSummary)]
        : scoreBreakdown
          ? scoreBreakdown.checks
          : hideSelectionDetails
            ? [check('Selection approach', 'Assessed', selectionSummary)]
          : options.applicantContext
            ? buildRankingEvidence({ ...options, selectionSummary, ucatComparison })
            : [check('Selection approach', 'Assessed', selectionSummary)]),
    ...(selectionScoreComparison && state === 'standard'
      ? [selectionScoreThresholdComparisonCheck(selectionScoreComparison)]
      : [])
  ];
  const evidenceConfidence = buildEvidenceConfidence(card, options);
  const selectionMetric = buildSelectionMetric({
    state,
    scoreBreakdown,
    selectionScoreComparison,
    ucatComparison,
    options
  });
  const compactStatus = buildCompactStatus({
    state,
    eligibilityStatus: card.eligibility?.status,
    card
  });
  const comparisonMetrics = buildComparisonMetrics({
    state,
    selectionMetric,
    ucatComparison,
    options
  });
  const comparisonMetricsTitle = buildComparisonMetricsTitle({
    state,
    comparisonMetrics,
    options
  });
  const historicalContextChecks = historicalAdmissionsChecks(
    options.historicalAdmissions,
    options.applicantGroupIds
  );
  const hasHistoricalContext =
    !ucatRankingBypass &&
    (comparisonMetrics.length > 0 || historicalContextChecks.length > 0 || hasPublicUcatHistoricalComparison(ucatComparison));

  const factorUsage = normalizeFactorUsage(card, options);
  const riskExplanation =
    state === 'standard' ? options.riskExplanation || null : null;

  return {
    factor_usage: factorUsage,
    decision_path: [
      {
        stage: 'Eligibility',
        status: notEligible ? 'Not met' : state === 'manual_review' ? 'Needs review' : 'Met',
        summary: eligibilitySummary,
        checks: studentFacingEligibilityChecks(card, {
          eligibilityChecks: options.eligibilityChecks,
          eligibilityFailures: options.eligibilityFailures
        })
      },
      {
        stage: 'Selection model',
        status:
          state === 'eligibility_only'
            ? 'Not predicted'
            : state === 'standard'
            ? 'Assessed'
            : state === 'manual_review'
              ? 'Needs review'
              : 'Not applied',
        summary:
          state === 'eligibility_only'
            ? ELIGIBILITY_ONLY_SELECTION_SUMMARY
            : state === 'standard'
            ? selectionSummary
            : state === 'manual_review'
              ? 'The selection approach cannot be completed until the required review is finished.'
              : state === 'not_eligible'
                ? 'The selection approach is not applied because the entry requirements are not met.'
                : 'The selection approach cannot support a confident result with the available evidence.',
        checks: selectionChecks
      },
      {
        stage: 'Historical guidance',
        status:
          state === 'eligibility_only'
            ? 'Not used'
            : ucatRankingBypass
            ? 'Not used'
            : state === 'standard'
            ? 'Guidance available'
            : state === 'insufficient_evidence'
              ? 'Insufficient evidence'
              : state === 'not_eligible' && hasHistoricalContext
                ? 'Context only'
              : 'Not applied',
        summary: historicalSummary(card, state, { ...options, selectionScoreComparison, ucatComparison }),
        checks: [
          check('Applicant pool', 'Used', pool),
          ...(ucatRankingBypass
            ? [check(
              'Historical UCAT comparison',
              'Not used',
              historicalSummary(card, state, { ...options, selectionScoreComparison, ucatComparison })
            )]
            : []),
          ...(hasPublicUcatHistoricalComparison(ucatComparison) && ['standard', 'not_eligible'].includes(state)
            ? [check('UCAT comparison', state === 'not_eligible' ? 'Context only' : 'Compared', ucatComparisonAssessmentText(ucatComparison))]
            : []),
          ...(!ucatRankingBypass && (state === 'standard' || state === 'insufficient_evidence' || state === 'not_eligible')
            ? historicalContextChecks
            : []),
          ucatRankingBypass
            ? null
            : state === 'eligibility_only'
            ? check('Interview prediction', 'Unavailable', ELIGIBILITY_ONLY_SELECTION_SUMMARY)
            : check('Important limitation', 'Guidance only', HISTORICAL_GUIDANCE_CAVEAT)
        ].filter(Boolean)
      },
      {
        stage: 'Recommendation',
        status:
          state === 'eligibility_only'
            ? 'Eligible to apply'
            : state === 'standard'
            ? 'Guidance only'
            : state === 'manual_review'
              ? 'Needs review'
              : state === 'not_eligible'
                ? 'Not eligible'
                : 'Insufficient evidence',
	        summary: recommendationSummary(card, state, {
	          selectionScoreComparison,
	          ucatComparison,
	          context: { ...card, ...options },
            stage1Eligibility: options.stage1Eligibility,
            riskExplanation
	        }),
        checks: []
      }
    ],
    key_reasons:
      state === 'not_eligible'
        ? [eligibilitySummary, 'Interview guidance cannot override an unsuccessful eligibility decision.']
        : state === 'manual_review'
          ? [manualReviewReason, 'Normal recommendation wording is withheld until the review is complete.']
          : state === 'eligibility_only'
            ? [
              eligibilitySummary,
              'UCAT is not required or ranked for this course.',
              ELIGIBILITY_ONLY_SELECTION_SUMMARY
            ]
          : state === 'insufficient_evidence'
            ? [insufficientEvidenceReason, 'A confident recommendation is not shown.']
            : [
              eligibilitySummary,
              ...(contextualRouteSummaryText ? [contextualRouteSummaryText] : []),
              ...(officialPredictionReason ? [officialPredictionReason] : []),
              `The result uses ${pool}.`,
              ...(riskExplanation?.summary ? [riskExplanation.summary] : []),
              selectionScoreComparison
                ? selectionScoreThresholdText(selectionScoreComparison)
                : scoreBreakdown && Number.isFinite(scoreBreakdown.value)
                  ? `${scoreBreakdown.name} is ${scoreBreakdown.value}${Number.isFinite(scoreBreakdown.max) ? ` out of ${scoreBreakdown.max}` : ''}.`
	                : ucatComparison
	                  ? ucatComparisonRecommendationText(ucatComparison)
	                  : selectionSummary
	            ],
	    evidence_used: options.evidenceUsed || presentation.evidence_used || (state === 'eligibility_only' ? EVIDENCE.eligibilityOnly : EVIDENCE.standard),
    evidence_confidence: evidenceConfidence,
    // Public result cards only expose applicant-facing checks/reasons above.
    // Raw classifier/readiness warnings remain available at their source
    // (classification output and engine_notes) for audits and validation, but
    // they are not part of the applicant-facing warning contract.
    warnings: [],
    official_prediction: officialPredictionReason
      ? {
        available: false,
        prediction_status: 'prediction_unavailable',
        reason_code: officialPrediction.reason_code || 'official_prediction_unavailable',
        explanation: officialPredictionReason,
        source_ids: officialPrediction.source_ids || []
      }
      : undefined,
    manual_review_reason: manualReviewReason,
    manual_review_reason_code: glasgowReachCompletionReason
      ? 'glasgow_reach_completion_required'
      : null,
    information_needed_reason: informationNeededReason,
    insufficient_evidence_reason: insufficientEvidenceReason,
    insufficient_evidence_reason_code: insufficientEvidenceReasonCode,
    missing_information: missingInformation,
    risk_explanation: riskExplanation,
    compact_status: compactStatus,
    comparison_metrics_title: comparisonMetricsTitle,
    comparison_metrics: comparisonMetrics,
    selection_approach_display: options.selectionApproachDisplay || null,
    selection_metric: selectionMetric,
    score_breakdown: scoreBreakdown,
    ucat_comparison: ucatComparison,
    ucat_adjustment: ucatAdjustment
  };
}

function presentResultCard({
  eligibilityStatus,
  interviewBand,
  manualReviewRequired = false,
  manualReviewReason = null,
  insufficientEvidenceReason = null,
  insufficientEvidenceReasonCode = null,
  missingInformation = null,
  transparencyContext = {}
}) {
  let display;
  const academicPathway = transparencyContext.academic_pathway ||
    transparencyContext.eligibility?.academic_pathway ||
    null;
  const academicPathwayId = transparencyContext.academic_pathway_id ??
    transparencyContext.eligibility?.academic_pathway_id ??
    null;
  const activeAlternativeAcademicOffer = buildAlternativeAcademicOffer(
    transparencyContext.stage_1_eligibility,
    {
      academic_pathway: academicPathway,
      academic_pathway_id: academicPathwayId,
      selection_route_id: transparencyContext.selection_route_id || null
    }
  );
  const contextualRouteSummary = contextualOfferRouteSummary(transparencyContext, activeAlternativeAcademicOffer);
  const selectionApproachDisplay = selectionApproachForContext(
    transparencyContext.selection_approach_display,
    transparencyContext
  );
  const presentation = mergePresentations(
    transparencyContext.score_model?.presentation,
    transparencyContext.guidance_pool?.presentation
  );
  const guidancePoolId = transparencyContext.guidance_pool?.pool_id || null;
  const suppressPrimaryTrustStatement =
    transparencyContext.course_identity?.profile_id === 'dundee-a100' &&
    [
      'home_scotland_standard_school_leaver',
      'home_scotland_contextual_school_leaver'
    ].includes(guidancePoolId);
  const guaranteedInterview = transparencyContext.interview_outcome === 'guaranteed_interview';
  const resultBand = guaranteedInterview && !interviewBand ? 'interview_likely' : interviewBand;
  const eligibilityOnly =
    transparencyContext.readiness?.assessment_mode === 'eligibility_only' ||
    transparencyContext.readiness?.eligibility_only_ready === true ||
    transparencyContext.score_model?.assessment_mode === 'eligibility_only' ||
    resultBand === 'eligible_to_apply';
  const ucatRankingBypass = ucatRankingBypassApplies(transparencyContext);
  const effectiveSelectionApproachDisplay = ucatRankingBypass
    ? presentation.selection_summary || selectionApproachDisplay
    : selectionApproachDisplay;
  const ucatRanking = isUcatRankingContext(transparencyContext);
  const ucatComparison = ucatRanking && !guaranteedInterview
    ? buildUcatComparison({
      applicantContext: transparencyContext.applicant_context,
      applicantGroupIds: transparencyContext.applicant_group_ids,
      applicantPool: transparencyContext.applicantPool,
      eligibilityFailures: transparencyContext.eligibility_failures,
      stage1Eligibility: transparencyContext.stage_1_eligibility,
      bandMetric: transparencyContext.band_metric,
      guidancePool: transparencyContext.guidance_pool,
      matchedBandRule: transparencyContext.matched_band_rule,
      scoreModel: transparencyContext.score_model,
      courseProfileId: transparencyContext.course_identity?.profile_id || null
    })
    : null;
	  const selectionScoreComparison = hideSelectionScoreDetails(presentation) || ucatRankingBypass
	    ? null
	    : selectionScoreThresholdComparison({
	      guidancePool: transparencyContext.guidance_pool,
	      ranking: transparencyContext.ranking,
	      scoreModel: transparencyContext.score_model
	    });
		  const feeInformation = publicFeeInformation(
		    transparencyContext.fee_information,
		    transparencyContext.applicant_group_ids
		  );
		  const officialPrediction = transparencyContext.official_prediction || null;
		  const officialPredictionUnavailable = officialPrediction?.available === false;
  const riskExplanation = buildStandardRiskExplanation(resultBand, {
    ranking: transparencyContext.ranking,
    context: transparencyContext,
    presentation
  });
  const glasgowReachCompletionReason = glasgowReachCompletionInformationNeededReason(transparencyContext);
  const manualReviewPrimaryExplanation = firstNonEmptyString(
    glasgowReachCompletionReason,
    transparencyContext.decision_transparency?.manual_review_reason,
    manualReviewReason
  ) || GENERIC_MANUAL_REVIEW_EXPLANATION;
  const preDisplayState =
    manualReviewRequired || eligibilityStatus === 'manual_review'
      ? 'manual_review'
      : eligibilityStatus === 'insufficient_evidence' || resultBand === 'insufficient_evidence'
        ? 'insufficient_evidence'
        : null;
  const informationNeededReason = publicInformationNeededReason({
    state: preDisplayState,
    manualReviewReason,
    insufficientEvidenceReason,
    insufficientEvidenceReasonCode,
    missingInformation:
      missingInformation ||
      transparencyContext.missing_information ||
      null,
    presentation,
    card: transparencyContext
  });
  const resolvedInsufficientEvidenceReason = resolveInsufficientEvidenceReason({
      insufficientEvidenceReason,
      insufficientEvidenceReasonCode,
      presentation,
      card: transparencyContext,
      includeDefaultEvidenceReason: false
    });
  const insufficientEvidencePrimaryExplanation =
    resolvedInsufficientEvidenceReason ||
    GENERIC_INSUFFICIENT_EVIDENCE_EXPLANATION;
  const defaultGuaranteedInterviewExplanation = contextualRouteSummary
    ? `${contextualRouteSummary} Based on ApplySmart's assessment, this applicant group meets the published guaranteed-interview evidence available for this route.`
    : "Based on ApplySmart's assessment, this applicant group meets the published guaranteed-interview evidence available for this route.";
  const guaranteedInterviewExplanation = firstNonEmptyString(
    transparencyContext.guaranteed_interview_explanation,
    presentation.guaranteed_interview_explanation,
    defaultGuaranteedInterviewExplanation
  );
  const guaranteedInterviewNotice = firstNonEmptyString(
    transparencyContext.guaranteed_interview_notice,
    presentation.guaranteed_interview_notice,
    'Every published guaranteed-interview condition for this route has been verified as met.'
  );
  const guaranteedInterviewHeadline = firstNonEmptyString(
    transparencyContext.guaranteed_interview_headline,
    presentation.guaranteed_interview_headline,
    STANDARD_RECOMMENDATION_HEADLINES.guaranteed_interview
  );
  if (guaranteedInterview) {
    display = {
      primary_user_facing_recommendation: guaranteedInterviewHeadline,
      recommendation_display_state: 'standard',
      primary_explanation: guaranteedInterviewExplanation,
      historical_guidance_caveat: null
    };
  } else if (eligibilityStatus === 'not_eligible' || interviewBand === 'not_eligible') {
    display = {
      primary_user_facing_recommendation: STANDARD_RECOMMENDATION_HEADLINES.not_eligible,
      recommendation_display_state: 'not_eligible',
      primary_explanation: notEligiblePrimaryExplanation(
        transparencyContext.eligibility_failures,
        transparencyContext
      ),
      historical_guidance_caveat: null
    };
	  } else if (manualReviewRequired || eligibilityStatus === 'manual_review') {
	    display = {
	      primary_user_facing_recommendation: STANDARD_RECOMMENDATION_HEADLINES.manual_review,
	      recommendation_display_state: 'manual_review',
	      primary_explanation: manualReviewPrimaryExplanation,
	      historical_guidance_caveat: null
	    };
  } else if (
    eligibilityStatus === 'insufficient_evidence' ||
    interviewBand === 'insufficient_evidence'
  ) {
	    display = {
	      primary_user_facing_recommendation: STANDARD_RECOMMENDATION_HEADLINES.insufficient_evidence,
	      recommendation_display_state: 'insufficient_evidence',
	      primary_explanation: insufficientEvidencePrimaryExplanation,
	      historical_guidance_caveat: null
	    };
  } else if (eligibilityOnly && eligibilityStatus === 'eligible') {
    display = {
      primary_user_facing_recommendation: STANDARD_RECOMMENDATION_HEADLINES.eligible_to_apply,
      recommendation_display_state: 'eligibility_only',
      primary_explanation:
        'ApplySmart has confirmed your eligibility against the entry requirements currently supported for this applicant group.',
      historical_guidance_caveat: null
    };
	  } else {
	    const recommendation = ucatRanking
	      ? UCAT_RANKING_RECOMMENDATIONS[interviewBand]
	      : STANDARD_RECOMMENDATIONS[interviewBand];
	    const standardExplanation = standardRecommendationExplanation(interviewBand, {
	      ucatComparison,
	      selectionScoreComparison,
	      context: transparencyContext
	    });
      const primaryExplanation = contextualRouteSummary
        ? `${contextualRouteSummary} ${riskExplanation?.summary || standardExplanation}`
        : riskExplanation?.summary || standardExplanation;
	    display = recommendation
	      ? {
	        primary_user_facing_recommendation: recommendation.headline,
	        recommendation_display_state: 'standard',
	        internal_recommendation: recommendation.recommendation,
	        primary_explanation: primaryExplanation,
	        trust_statement: suppressPrimaryTrustStatement ? null : presentation.trust_statement || (officialPredictionUnavailable
	          ? OFFICIAL_UNAVAILABLE_TRUST_STATEMENT
	          : null),
	        historical_guidance_caveat: ucatRankingBypass ? null : HISTORICAL_GUIDANCE_CAVEAT
	      }
	      : {
	        primary_user_facing_recommendation: STANDARD_RECOMMENDATION_HEADLINES.insufficient_evidence,
	        recommendation_display_state: 'insufficient_evidence',
	        primary_explanation:
	          'Your academic profile meets the published requirements. ApplySmart cannot fully position this application because verified historical interview data for this applicant group is currently limited.',
	        historical_guidance_caveat: null
	      };
	  }
  const publicRiskExplanation =
    display.recommendation_display_state === 'standard' ? riskExplanation : null;

  const transparencyCard = {
    ...transparencyContext,
    missing_information:
      missingInformation ||
      transparencyContext.missing_information ||
      null,
    eligibility: {
      ...(transparencyContext.eligibility || {}),
      status: eligibilityStatus
    },
    prediction: {
      ...(transparencyContext.prediction || {}),
      available: officialPredictionUnavailable
        ? false
        : eligibilityOnly || resultBand !== 'insufficient_evidence',
      result_band: eligibilityOnly && eligibilityStatus === 'eligible' && resultBand !== 'insufficient_evidence'
        ? 'eligible_to_apply'
        : resultBand,
      prediction_status: officialPredictionUnavailable
        ? 'prediction_unavailable'
        : transparencyContext.prediction?.prediction_status,
      prediction_type: eligibilityOnly ? 'eligibility_only' : 'interview_prediction',
      official_prediction: officialPredictionUnavailable
        ? {
          available: false,
          prediction_status: 'prediction_unavailable',
          reason_code: officialPrediction.reason_code || 'official_prediction_unavailable',
          explanation:
            officialPrediction.explanation ||
            'The university has not published enough current-cycle information for ApplySmart to reproduce the official interview prediction.',
          source_ids: officialPrediction.source_ids || []
        }
        : { available: true },
      applysmart_advisory_guidance: officialPredictionUnavailable
        ? {
          available: resultBand !== 'insufficient_evidence' && resultBand !== 'not_eligible',
          result_band: resultBand,
          guidance_only: true,
          trust_statement: OFFICIAL_UNAVAILABLE_TRUST_STATEMENT
        }
        : undefined,
      assessment: {
        type: eligibilityOnly ? 'eligibility_only' : 'interview_prediction',
        available: !officialPredictionUnavailable
      },
      interview_prediction: {
        available: !officialPredictionUnavailable &&
          !eligibilityOnly &&
          resultBand !== 'insufficient_evidence' &&
          resultBand !== 'not_eligible',
        unavailable_reason: eligibilityOnly
          ? 'ApplySmart does not estimate interview likelihood for this eligibility-only course.'
          : officialPredictionUnavailable
            ? officialPrediction.explanation || 'Official interview prediction is unavailable.'
            : resultBand === 'not_eligible'
              ? 'Interview prediction is not produced because the supported entry requirements are not met.'
              : null
      },
      ranking_metric: isUcatRankingContext(transparencyContext) ? 'ucat_total' : undefined
    },
    display
  };
  transparencyCard.information_needed_reason = informationNeededReason;
  const transparencyOptions = {
    manualReviewRequired,
    manualReviewReason,
    insufficientEvidenceReason,
    insufficientEvidenceReasonCode,
    missingInformation:
      missingInformation ||
      transparencyContext.missing_information ||
      null,
    applicantPool: transparencyContext.applicantPool,
    applicantGroupIds: transparencyContext.applicant_group_ids,
    evidenceUsed: transparencyContext.evidenceUsed,
    readiness: transparencyContext.readiness,
    applicantContext: transparencyContext.applicant_context,
    eligibilityChecks: transparencyContext.eligibility_checks,
    eligibilityFailures: transparencyContext.eligibility_failures,
    stage1Eligibility: transparencyContext.stage_1_eligibility,
    stage2InterviewSelection: transparencyContext.stage_2_interview_selection,
    historicalAdmissions: transparencyContext.historical_admissions,
    ranking: transparencyContext.ranking,
    bandMetric: transparencyContext.band_metric,
    scoreModel: transparencyContext.score_model,
    selectionScoreComparison,
    officialScore: transparencyContext.official_score,
    estimatedSelectionScore: transparencyContext.estimated_selection_score,
    interviewOutcome: transparencyContext.interview_outcome,
    guaranteedInterviewPoolLabel: transparencyContext.guaranteed_interview_pool_label,
    guidancePoolId: transparencyContext.guidance_pool_id,
    guidancePool: transparencyContext.guidance_pool,
    courseProfileId: transparencyContext.course_identity?.profile_id || null,
    ucatComparison,
    officialPrediction,
    warnings: transparencyContext.warnings,
    insufficientEvidenceReasonCode,
    informationNeededReason,
    selectionApproachDisplay: effectiveSelectionApproachDisplay
  };
  transparencyOptions.riskExplanation = publicRiskExplanation;
  const evidenceConfidence = buildEvidenceConfidence(
    transparencyCard,
    transparencyOptions
  );
  const prediction = transparencyCard.prediction;
  const suppressContextualStatusForUeaProgrammeRoute =
    transparencyContext.course_identity?.profile_id === 'east-anglia-a100' &&
    transparencyContext.interview_outcome === 'guaranteed_interview';
  const contextualEligibilityConfirmed =
    contextualEligibilityStatus(transparencyContext) === 'contextual';
  const contextualStatus =
    (
      display.recommendation_display_state === 'standard' ||
      eligibilityStatus === 'eligible'
    ) &&
    !suppressContextualStatusForUeaProgrammeRoute &&
    contextualEligibilityConfirmed
      ? 'confirmed'
      : null;
  const contextualConfirmation = contextualConfirmationFor(transparencyContext, contextualStatus, {
    guaranteedInterview
  });
  const futureConditionsArePublic =
    academicPathway === 'epq_alternative' &&
    ['eligible', 'met'].includes(normaliseCheckId(eligibilityStatus));
  const futureConditions = [
    ...(futureConditionsArePublic && Array.isArray(transparencyContext.future_conditions)
      ? transparencyContext.future_conditions
      : []),
    ...(futureConditionsArePublic && Array.isArray(transparencyContext.eligibility?.future_conditions)
      ? transparencyContext.eligibility.future_conditions
      : []),
    ...(futureConditionsArePublic && Array.isArray(transparencyContext.eligibility?.epq_alternative_result?.future_conditions)
      ? transparencyContext.eligibility.epq_alternative_result.future_conditions
      : [])
  ];
  const futureConditionAdvisoryText = futureConditionAdvisories(futureConditions, {
    universityName: transparencyContext.course_identity?.university_name ||
      transparencyContext.course_identity?.university ||
      null
  });
  const academicRequirementChecks = buildAcademicRequirementChecks(
    transparencyContext.eligibility_checks,
    eligibilityStatus,
    {
      course_profile_id: transparencyContext.course_identity?.profile_id || null,
      academic_pathway: academicPathway,
      academic_pathway_id: academicPathwayId,
      selection_route_id: transparencyContext.selection_route_id || null,
      applicant_context: transparencyContext.applicant_context || null,
      applicant_group_ids: transparencyContext.applicant_group_ids || [],
      guidance_pool_id:
        transparencyContext.guidance_pool_id ||
        transparencyContext.guidance_pool?.pool_id ||
        null,
      guidance_pool: transparencyContext.guidance_pool || null,
      has_epq_alternative_offer: hasEnabledEpqAlternativeOffer(
        transparencyContext.stage_1_eligibility
      )
    }
  );

  return {
    ...display,
    academic_pathway: academicPathway,
    academic_pathway_id: academicPathwayId,
    contextual_status: contextualStatus,
    contextual_confirmation: contextualConfirmation,
    alternative_academic_offer: activeAlternativeAcademicOffer,
    future_conditions: [...new Set(futureConditions)],
    future_condition_advisories: futureConditionAdvisoryText,
    academic_requirement_checks: academicRequirementChecks,
    missing_information:
      missingInformation ||
      transparencyContext.missing_information ||
      null,
    fee_information: feeInformation,
    selection_approach_display: effectiveSelectionApproachDisplay,
    information_needed_reason: informationNeededReason,
    trust_statement: display.trust_statement || futureConditionAdvisoryText[0] || null,
    prediction,
    interview_outcome: transparencyContext.interview_outcome || null,
    guaranteed_interview_notice: guaranteedInterview ? guaranteedInterviewNotice : null,
    guaranteed_interview_badge_label: guaranteedInterview
      ? transparencyContext.guaranteed_interview_badge_label || null
      : null,
    evidence_confidence: evidenceConfidence,
    risk_explanation: publicRiskExplanation,
    factor_usage: normalizeFactorUsage(transparencyContext, transparencyOptions),
    decision_timeline: buildDecisionTimeline(
      transparencyCard,
      transparencyOptions
    ),
    decision_transparency: buildDecisionTransparency(
      transparencyCard,
      transparencyOptions
    )
  };
}

module.exports = {
  HISTORICAL_GUIDANCE_CAVEAT,
  CANONICAL_BAND_LABELS,
  buildEvidenceConfidence,
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildAcademicRequirementChecks,
  buildAlternativeAcademicOffer,
  formatAlevelGradeProfile,
  futureConditionAdvisories,
  humanManualReviewReason,
  humanApplicantPoolLabel,
  insufficientEvidenceReasonCodeFromWarnings,
  presentResultCard
};
