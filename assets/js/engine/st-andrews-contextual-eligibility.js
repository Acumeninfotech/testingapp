const ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID = 'st_andrews_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function answerIsYes(value, normaliseId) {
  return ['yes', 'true', 'confirmed', 'completed', 'verified'].includes(normaliseId(value));
}

function answerIsUnresolved(value, normaliseId) {
  return ['not_sure', 'unsure', 'unknown', 'prefer_not_to_say'].includes(normaliseId(value));
}

function normaliseQuintile(value, normaliseId) {
  const normalised = normaliseId(value);
  if (!normalised) return null;
  const match = normalised.match(/(?:q|quintile|imd|simd)?_?([1-5])$/);
  return match ? `q${match[1]}` : normalised;
}

function check(criterionId, label, evidencePath, status, actual = undefined) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual
  };
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'st_andrews_medicine_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    contextual_level: null,
    academic_contextual_level: null,
    minimum_entry_eligible: false,
    ucat_contextual_adjustment_eligible: false,
    pledge_eligible: false,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      minimum_academic_entry: [],
      ucat_uplift: [],
      pledge: []
    },
    ucat_contextual_treatment: {
      treatment_id: 'none',
      uplift_percent: 0,
      reason: null
    },
    ucat_uplift_percent: 0,
    ucat_uplift_reason: null,
    adjusted_selection_ucat: null,
    activated_applicant_group_ids: []
  };
}

function isHomeScottishOrRukApplicant(identity, normaliseId) {
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  const homeFee =
    feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk' ||
    feeStatus.includes('home');
  const ukDomicile = [
    'scotland',
    'scottish',
    'scotland_domiciled',
    'england',
    'wales',
    'northern_ireland',
    'rest_of_uk',
    'ruk'
  ].includes(domicile);
  return homeFee && ukDomicile;
}

function deprivation40Check(postcode, normaliseId) {
  const imdQuintile = normaliseQuintile(postcode.imd_quintile, normaliseId);
  const simdQuintile = normaliseQuintile(postcode.simd_quintile, normaliseId);
  const matched = ['q1', 'q2'].includes(imdQuintile) || ['q1', 'q2'].includes(simdQuintile);
  const unresolved = [imdQuintile, simdQuintile].every((value) => !value || value === 'unknown');

  return check(
    'st_andrews_lowest_40_percent_deprivation_uk',
    'Lowest 40% most deprived areas of the UK',
    'home_area_region.imd_quintile/home_area_region.simd_quintile',
    matched ? 'matched' : unresolved ? 'information_needed' : 'not_matched',
    {
      imd_quintile: postcode.imd_quintile,
      simd_quintile: postcode.simd_quintile
    }
  );
}

function simd40Check(postcode, normaliseId) {
  const simdQuintile = normaliseQuintile(postcode.simd_quintile, normaliseId);
  return check(
    'st_andrews_lowest_40_percent_deprivation_scotland',
    'Lowest 40% most deprived areas of Scotland',
    'home_area_region.simd_quintile',
    ['q1', 'q2'].includes(simdQuintile)
      ? 'matched'
      : (!simdQuintile || simdQuintile === 'unknown') ? 'information_needed' : 'not_matched',
    postcode.simd_quintile
  );
}

function personalCheck(criterionId, label, evidencePath, values, normaliseId) {
  const entries = Object.entries(values);
  const matched = entries.some(([, value]) => answerIsYes(value, normaliseId));
  const unresolved = entries.some(([, value]) => answerIsUnresolved(value, normaliseId));
  return check(
    criterionId,
    label,
    evidencePath,
    matched ? 'matched' : unresolved ? 'information_needed' : 'not_matched',
    Object.fromEntries(entries)
  );
}

function evaluateStAndrewsContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const identity = asObject(applicant.applicant_identity);
  const postcode = asObject(evidence.postcode_measures);
  const personal = asObject(evidence.personal_circumstances);
  const school = asObject(evidence.school_education);
  const rawUcat = applicant.admissions_tests?.ucat?.total_score;

  const inScope = isHomeScottishOrRukApplicant(identity, normaliseId);
  result.checks.scope.push(check(
    'home_scotland_or_ruk_scope',
    'Home Scotland or Rest of UK applicant',
    'applicant_identity.fee_status/applicant_identity.domicile',
    inScope ? 'matched' : 'not_applicable',
    {
      fee_status: identity.fee_status,
      domicile: identity.domicile
    }
  ));
  if (!inScope) {
    return {
      ...result,
      reason: 'st_andrews_contextual_not_applicable',
      policy_decision: 'outside_home_scotland_ruk_contextual_scope'
    };
  }

  const deprivation = deprivation40Check(postcode, normaliseId);
  const lookedAfter = personalCheck(
    'st_andrews_looked_after',
    'Looked-after or care-experienced',
    'personal_circumstances.care_experienced',
    {
      care_experienced: personal.care_experienced,
      care_over_three_months: personal.care_over_three_months,
      care_leaver: personal.care_leaver,
      looked_after: personal.looked_after
    },
    normaliseId
  );
  const youngCarer = personalCheck(
    'st_andrews_young_carer',
    'Registered young carer',
    'personal_circumstances.young_or_adult_carer',
    {
      young_or_adult_carer: personal.young_or_adult_carer,
      young_carer: personal.young_carer,
      carer: personal.carer,
      unpaid_carer: personal.unpaid_carer
    },
    normaliseId
  );
  const estranged = personalCheck(
    'st_andrews_estranged',
    'Estranged',
    'personal_circumstances.estranged_from_family',
    {
      estranged_from_family: personal.estranged_from_family,
      estranged: personal.estranged,
      living_without_family_support: personal.living_without_family_support
    },
    normaliseId
  );
  const refugee = personalCheck(
    'st_andrews_refugee',
    'Refugee',
    'personal_circumstances.refugee',
    {
      refugee: personal.refugee,
      uk_refugee_status_granted: personal.uk_refugee_status_granted
    },
    normaliseId
  );

  const minimumChecks = [deprivation, lookedAfter, youngCarer, estranged, refugee];
  result.checks.minimum_academic_entry.push(...minimumChecks);
  const minimumMatches = minimumChecks.filter((entry) => entry.status === 'matched');
  const minimumUnresolved = minimumChecks.filter((entry) => entry.status === 'information_needed');

  const scotlandDeprivation = simd40Check(postcode, normaliseId);
  const ucatChecks = [scotlandDeprivation, lookedAfter, estranged, refugee];
  result.checks.ucat_uplift.push(...ucatChecks);
  const ucatMatches = ucatChecks.filter((entry) => entry.status === 'matched');

  const simd20 = normaliseQuintile(postcode.simd_quintile, normaliseId) === 'q1';
  const lowProgression = answerIsYes(school.low_progression_to_higher_education_school, normaliseId);
  const pledgeChecks = [
    lookedAfter,
    check(
      'st_andrews_simd20_plus_low_progression_school',
      'SIMD20 plus school progression evidence',
      'home_area_region.simd_quintile/school_education.low_progression_to_higher_education_school',
      simd20 && lowProgression
        ? 'matched'
        : (
          (!normaliseQuintile(postcode.simd_quintile, normaliseId) ||
            normaliseQuintile(postcode.simd_quintile, normaliseId) === 'unknown' ||
            answerIsUnresolved(school.low_progression_to_higher_education_school, normaliseId)
          ) ? 'information_needed' : 'not_matched'
        ),
      {
        simd_quintile: postcode.simd_quintile,
        low_progression_to_higher_education_school:
          school.low_progression_to_higher_education_school
      }
    )
  ];
  result.checks.pledge.push(...pledgeChecks);
  const pledgeMatches = pledgeChecks.filter((entry) => entry.status === 'matched');

  if (minimumMatches.length > 0) {
    const ucatUplift = ucatMatches.length > 0;
    const adjustedSelectionUcat = ucatUplift && Number.isFinite(rawUcat)
      ? {
          raw_ucat: rawUcat,
          adjusted_ucat: Math.round(rawUcat * 1.1),
          uplift_percent: 10,
          reason: ucatMatches[0].criterion_id,
          reason_label: ucatMatches[0].label,
          applied_to: 'interview_ranking_score_only'
        }
      : null;
    return {
      ...result,
      status: 'contextual',
      reason: 'st_andrews_medicine_minimum_entry_confirmed',
      is_contextual: true,
      contextual_level: 'minimum_entry',
      academic_contextual_level: 'minimum_entry',
      minimum_entry_eligible: true,
      ucat_contextual_adjustment_eligible: ucatUplift,
      pledge_eligible: pledgeMatches.length > 0,
      matched_contextual_pathway: minimumMatches[0].criterion_id,
      matched_contextual_pathway_label: 'St Andrews Medicine minimum-entry criteria',
      qualifying_criteria: minimumMatches,
      activated_applicant_group_ids: [
        'contextual',
        'widening_participation',
        ...(lookedAfter.status === 'matched' ? ['care_experienced'] : [])
      ],
      ucat_contextual_treatment: ucatUplift
        ? {
            treatment_id: 'st_andrews_10_percent_ucat_uplift',
            uplift_percent: 10,
            reason: ucatMatches[0].criterion_id
          }
        : result.ucat_contextual_treatment,
      ucat_uplift_percent: ucatUplift ? 10 : 0,
      ucat_uplift_reason: ucatMatches[0]?.criterion_id || null,
      adjusted_selection_ucat: adjustedSelectionUcat,
      pledge_criteria: pledgeMatches,
      policy_decision: 'st_andrews_minimum_entry_contextual_confirmed'
    };
  }

  if (minimumUnresolved.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'st_andrews_contextual_evidence_needs_review',
      manual_review_reason: 'st_andrews_contextual_evidence_needs_review',
      missing_information: minimumUnresolved.map((entry) => ({
        criterion_id: entry.criterion_id,
        label: entry.label,
        evidence_path: entry.evidence_path,
        reason: 'st_andrews_contextual_evidence_needs_review'
      })),
      provisional_activated_applicant_group_ids: [],
      policy_decision: 'st_andrews_contextual_information_needed'
    };
  }

  return {
    ...result,
    policy_decision: 'st_andrews_contextual_criteria_not_met'
  };
}

module.exports = {
  ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID,
  evaluateStAndrewsContextualEligibility
};
