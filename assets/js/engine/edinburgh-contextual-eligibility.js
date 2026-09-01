const EDINBURGH_CONTEXTUAL_EVALUATOR_ID = 'edinburgh_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  return ['yes', 'true', 'confirmed', 'completed', 'verified'].includes(normaliseId(value));
}

function accessProgrammeStatusIsActive(value, normaliseId) {
  return ['yes', 'true', 'participating', 'completed', 'confirmed', 'verified'].includes(
    normaliseId(value)
  );
}

function normaliseQuintile(value, normaliseId) {
  const normalised = normaliseId(value);
  if (!normalised) return null;
  const match = normalised.match(/(?:q|quintile|simd)?_?([1-5])$/);
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

function firstAffirmativeField(record, fields, normaliseId) {
  return fields.find((field) => answerIsYes(record[field], normaliseId)) || null;
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'edinburgh_contextual_criteria_not_met',
    is_contextual: false,
    level: null,
    contextual_level: null,
    academic_contextual_level: null,
    academic_contextual_treatment: 'standard',
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      academic_contextual_level: [],
      ucat_contextual_treatment: [],
      unresolved_evidence: []
    },
    ucat_contextual_treatment: {
      treatment_id: 'none',
      uplift_percent: 0,
      minimum_total_score_required: true,
      minimum_total_score: 1850,
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
    feeStatus === 'rest_of_uk_roi_fee_rate' ||
    feeStatus.includes('home');
  const ukDomicile = [
    'scotland',
    'scottish',
    'scotland_domiciled',
    'england',
    'wales',
    'northern_ireland',
    'rest_of_uk',
    'ruk',
    'republic_of_ireland',
    'ireland'
  ].includes(domicile);
  return homeFee && ukDomicile;
}

function isScotlandDomiciledApplicant(identity, normaliseId) {
  return ['scotland', 'scottish', 'scotland_domiciled'].includes(
    normaliseId(identity.domicile)
  );
}

function explicitEdinburghEvidence(applicant, evidence) {
  const profile = asObject(applicant.contextual_profile);
  const structured = asObject(
    profile.edinburgh ||
      profile.university_specific?.edinburgh ||
      profile.university_specific?.['edinburgh-a100'] ||
      evidence.profile?.edinburgh ||
      evidence.profile?.university_specific?.edinburgh
  );
  return structured;
}

function normaliseEdinburghLevel(value, normaliseId) {
  const level = normaliseId(value);
  if (['plus_flag', 'plusflag', 'plus'].includes(level)) {
    return 'plus_flag';
  }
  if (['flag', 'edinburgh_flag'].includes(level)) {
    return 'flag';
  }
  if (['none', 'not_contextual', 'no_flag'].includes(level)) {
    return null;
  }
  return '';
}

function explicitLevelCheck(applicant, evidence, normaliseId) {
  const structured = explicitEdinburghEvidence(applicant, evidence);
  const rawLevel =
    structured.contextual_level ??
    structured.level ??
    structured.flag_status ??
    structured.academic_contextual_level;
  const level = normaliseEdinburghLevel(rawLevel, normaliseId);
  const status = normaliseId(
    structured.status ??
      structured.confirmation_status ??
      structured.evidence_status ??
      structured.verified
  );
  const confirmed =
    structured.confirmed === true ||
    structured.verified === true ||
    ['confirmed', 'verified', 'eligible'].includes(status);

  if (!rawLevel) {
    return check(
      'edinburgh_contextual_level_confirmed',
      'Edinburgh Flag / Plus Flag confirmation',
      'contextual_profile.edinburgh.contextual_level',
      'not_matched'
    );
  }

  if (!level || !confirmed) {
    return check(
      'edinburgh_contextual_level_confirmed',
      'Edinburgh Flag / Plus Flag confirmation',
      'contextual_profile.edinburgh.contextual_level',
      'information_needed',
      { level: rawLevel, status: structured.status || structured.confirmation_status || null }
    );
  }

  return check(
    `edinburgh_${level}`,
    level === 'plus_flag' ? 'Edinburgh Plus Flag' : 'Edinburgh Flag',
    'contextual_profile.edinburgh.contextual_level',
    'matched',
    { level }
  );
}

function programmeLooksLikeAccessEdinburgh(programme, normaliseId) {
  const record = asObject(programme);
  const values = [
    record.programme_id,
    record.programme_name,
    record.name,
    record.label,
    record.provider_university_id,
    record.provider_university_name
  ].map(normaliseId);

  return values.some((value) => {
    return value === 'edinburgh_access_edinburgh' ||
      value === 'access_edinburgh' ||
      value === 'university_of_edinburgh_access_edinburgh' ||
      (value.includes('access') && value.includes('edinburgh'));
  });
}

function accessEdinburghCheck(accessProgrammes, normaliseId) {
  const programmes = asArray(accessProgrammes.other_programmes).map(asObject);
  const programme = programmes.find((entry) => programmeLooksLikeAccessEdinburgh(entry, normaliseId));
  const fallbackName = normaliseId(accessProgrammes.other_programme_name);
  const fallbackStatus = normaliseId(accessProgrammes.participation_status);
  const hasFallback =
    fallbackName === 'access_edinburgh' ||
    (fallbackName.includes('access') && fallbackName.includes('edinburgh'));

  if (!programme && !hasFallback) {
    return check(
      'access_edinburgh_evidence',
      'Access Edinburgh evidence',
      'access_programmes',
      'not_matched'
    );
  }

  const status =
    programme?.status ||
    programme?.programme_status ||
    accessProgrammes.participation_status ||
    fallbackStatus ||
    null;

  if (accessProgrammeStatusIsActive(status, normaliseId)) {
    return check(
      'edinburgh_plus_flag_access_edinburgh',
      'Access Edinburgh Plus Flag',
      programme ? 'access_programmes.other_programmes' : 'access_programmes.other_programme_name',
      'matched',
      {
        programme_id: programme?.programme_id || null,
        status
      }
    );
  }

  return check(
    'access_edinburgh_evidence',
    'Access Edinburgh evidence',
    programme ? 'access_programmes.other_programmes' : 'access_programmes.other_programme_name',
    'information_needed',
    {
      programme_id: programme?.programme_id || null,
      status
    }
  );
}

function ucatBursaryCheck(financialSupport, normaliseId) {
  return check(
    'ucat_bursary',
    'UCAT bursary',
    'financial_support.ucat_bursary_recipient',
    answerIsYes(financialSupport.ucat_bursary_recipient, normaliseId) ? 'matched' : 'not_matched',
    financialSupport.ucat_bursary_recipient
  );
}

function simd40Check(evidence, scotlandDomiciled, normaliseId) {
  const simdQuintile = normaliseQuintile(evidence.postcode_measures?.simd_quintile, normaliseId);
  return check(
    'simd40_second_lowest_quintile',
    'SIMD40 second-lowest quintile',
    'home_area_region.simd_quintile',
    scotlandDomiciled && simdQuintile === 'q2' ? 'matched' : 'not_matched',
    evidence.postcode_measures?.simd_quintile
  );
}

function isEnglandWalesOrNorthernIrelandApplicant(identity, normaliseId) {
  return ['england', 'wales', 'northern_ireland'].includes(normaliseId(identity.domicile));
}

function polar2StateSchoolFlagCheck(evidence, identity, normaliseId) {
  const polarQuintile = normaliseQuintile(evidence.postcode_measures?.polar4_quintile, normaliseId);
  const school = asObject(evidence.school_education);
  const stateSchool = school.state_non_fee_paying_school;
  const inApplicableDomicile = isEnglandWalesOrNorthernIrelandApplicant(identity, normaliseId);
  const stateSchoolIsYes = answerIsYes(stateSchool, normaliseId);
  const stateSchoolIsUnresolved = ['', 'not_sure', 'unknown'].includes(normaliseId(stateSchool));

  if (inApplicableDomicile && polarQuintile === 'q2' && stateSchoolIsYes) {
    return check(
      'edinburgh_flag_polar2_state_school',
      'POLAR2 and state school Flag',
      'home_area_region.polar4_quintile/school_education.state_non_fee_paying_school',
      'matched',
      {
        polar4_quintile: evidence.postcode_measures?.polar4_quintile,
        state_non_fee_paying_school: stateSchool,
        domicile: identity.domicile
      }
    );
  }

  if (inApplicableDomicile && polarQuintile === 'q2' && stateSchoolIsUnresolved) {
    return check(
      'edinburgh_flag_polar2_state_school',
      'POLAR2 and state school Flag',
      'school_education.state_non_fee_paying_school',
      'information_needed',
      {
        polar4_quintile: evidence.postcode_measures?.polar4_quintile,
        state_non_fee_paying_school: stateSchool,
        domicile: identity.domicile
      }
    );
  }

  return check(
    'edinburgh_flag_polar2_state_school',
    'POLAR2 and state school Flag',
    'home_area_region.polar4_quintile/school_education.state_non_fee_paying_school',
    'not_matched',
    {
      polar4_quintile: evidence.postcode_measures?.polar4_quintile,
      state_non_fee_paying_school: stateSchool,
      domicile: identity.domicile
    }
  );
}

function personalCircumstanceChecks(personal, normaliseId) {
  const careField = firstAffirmativeField(
    personal,
    ['care_experienced', 'care_over_three_months', 'care_leaver'],
    normaliseId
  );
  const refugeeOrAsylumField = firstAffirmativeField(
    personal,
    ['refugee', 'uk_refugee_status_granted', 'seeking_asylum', 'asylum_seeker'],
    normaliseId
  );

  return [
    check(
      'edinburgh_plus_flag_care_experienced',
      'Care experienced Plus Flag',
      careField
        ? `personal_circumstances.${careField}`
        : 'personal_circumstances.care_experienced',
      careField ? 'matched' : 'not_matched',
      careField ? personal[careField] : personal.care_experienced
    ),
    check(
      'edinburgh_plus_flag_refugee_or_asylum',
      'Refugee or asylum Plus Flag',
      refugeeOrAsylumField
        ? `personal_circumstances.${refugeeOrAsylumField}`
        : 'personal_circumstances.refugee',
      refugeeOrAsylumField ? 'matched' : 'not_matched',
      refugeeOrAsylumField ? personal[refugeeOrAsylumField] : personal.refugee
    )
  ];
}

function preciseAgeUnder25(identity, normaliseId) {
  const numericAge = Number(identity.age_on_1_september ?? identity.age_on_1_october);
  if (Number.isFinite(numericAge)) {
    return numericAge < 25 ? 'yes' : 'no';
  }

  const ageBand = normaliseId(identity.age_at_course_start_band);
  if (['under_17', 'age_17', 'age_18', 'age_19', 'age_20'].includes(ageBand)) {
    return 'yes';
  }
  if (['age_21_or_over', 'age_18_or_over_legacy', 'not_sure', 'unknown', ''].includes(ageBand)) {
    return 'unknown';
  }
  return 'unknown';
}

function estrangedUnder25Check(personal, identity, normaliseId) {
  const estranged = personal.estranged_from_family ?? personal.estranged;
  if (!answerIsYes(estranged, normaliseId)) {
    return check(
      'edinburgh_plus_flag_estranged_under_25',
      'Estranged under 25 Plus Flag',
      'personal_circumstances.estranged_from_family',
      'not_matched',
      estranged
    );
  }

  const ageStatus = preciseAgeUnder25(identity, normaliseId);
  if (ageStatus === 'yes') {
    return check(
      'edinburgh_plus_flag_estranged_under_25',
      'Estranged under 25 Plus Flag',
      'personal_circumstances.estranged_from_family',
      'matched',
      {
        estranged,
        age_at_course_start_band: identity.age_at_course_start_band ?? null,
        age_on_1_september: identity.age_on_1_september ?? null
      }
    );
  }
  if (ageStatus === 'no') {
    return check(
      'edinburgh_plus_flag_estranged_under_25',
      'Estranged under 25 Plus Flag',
      'personal_circumstances.estranged_from_family',
      'not_matched',
      {
        estranged,
        age_on_1_september: identity.age_on_1_september ?? null
      }
    );
  }

  return check(
    'edinburgh_plus_flag_estranged_under_25',
    'Estranged under 25 Plus Flag',
    'personal_circumstances.estranged_from_family',
    'information_needed',
    {
      estranged,
      age_at_course_start_band: identity.age_at_course_start_band ?? null
    }
  );
}

function carerBridgingCheck(personal, normaliseId) {
  const carer = personal.young_or_adult_carer ?? personal.carer;
  return check(
    'edinburgh_carer_bridging_programme',
    'Carer with recognised bridging programme',
    'personal_circumstances.young_or_adult_carer',
    answerIsYes(carer, normaliseId) ? 'information_needed' : 'not_matched',
    carer
  );
}

function ucatTreatmentFor({ level, ucatBursary, simd40, rawUcat }) {
  let treatment = {
    treatment_id: 'none',
    uplift_percent: 0,
    minimum_total_score_required: true,
    minimum_total_score: 1850,
    reason: null,
    reason_label: null
  };

  if (level === 'flag') {
    treatment = {
      treatment_id: 'flag_5_percent',
      uplift_percent: 5,
      minimum_total_score_required: true,
      minimum_total_score: 1850,
      reason: 'edinburgh_flag',
      reason_label: 'Edinburgh Flag'
    };
  }
  if (level === 'plus_flag') {
    treatment = {
      treatment_id: 'plus_flag_10_percent',
      uplift_percent: 10,
      minimum_total_score_required: false,
      minimum_total_score: null,
      reason: 'edinburgh_plus_flag',
      reason_label: 'Edinburgh Plus Flag'
    };
  }
  if (ucatBursary.status === 'matched' && treatment.uplift_percent < 10) {
    treatment = {
      treatment_id: 'ucat_bursary_10_percent',
      uplift_percent: 10,
      minimum_total_score_required: false,
      minimum_total_score: null,
      reason: 'ucat_bursary',
      reason_label: 'UCAT bursary'
    };
  }
  if (
    simd40.status === 'matched' &&
    treatment.uplift_percent < 10 &&
    treatment.minimum_total_score_required !== false
  ) {
    treatment = {
      treatment_id: 'simd40_10_percent',
      uplift_percent: 10,
      minimum_total_score_required: true,
      minimum_total_score: 1850,
      reason: 'simd40_second_lowest_quintile',
      reason_label: 'SIMD40'
    };
  }

  const adjustedSelectionUcat =
    treatment.uplift_percent > 0 && Number.isFinite(rawUcat)
      ? {
        raw_ucat: rawUcat,
        adjusted_ucat: Math.round(rawUcat * (1 + treatment.uplift_percent / 100)),
        uplift_percent: treatment.uplift_percent,
        reason: treatment.reason,
        reason_label: treatment.reason_label,
        treatment_id: treatment.treatment_id,
        minimum_total_score_required: treatment.minimum_total_score_required,
        minimum_total_score: treatment.minimum_total_score,
        stacking_policy: 'highest_applicable_edinburgh_uplift_only'
      }
      : null;

  return { treatment, adjustedSelectionUcat };
}

function contextualOutcome(result, level, matchedCheck, ucatTreatment, adjustedSelectionUcat) {
  return {
    ...result,
    status: 'contextual',
    reason: level === 'plus_flag'
      ? 'edinburgh_plus_flag_confirmed'
      : 'edinburgh_flag_confirmed',
    is_contextual: true,
    level,
    contextual_level: level,
    academic_contextual_level: level,
    academic_contextual_treatment: level === 'plus_flag' ? 'reduced_minimum' : 'standard',
    matched_contextual_pathway: matchedCheck.criterion_id,
    matched_contextual_pathway_label: matchedCheck.label,
    qualifying_criteria: [matchedCheck],
    ucat_contextual_treatment: ucatTreatment,
    ucat_uplift_percent: ucatTreatment.uplift_percent,
    ucat_uplift_reason: ucatTreatment.reason,
    adjusted_selection_ucat: adjustedSelectionUcat,
    activated_applicant_group_ids: [
      'contextual',
      'widening_participation',
      level === 'plus_flag' ? 'edinburgh_plus_flag' : 'edinburgh_flag'
    ]
  };
}

function evaluateEdinburghContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = asObject(applicant.applicant_identity);
  const result = defaultResult();
  const inScope = isHomeScottishOrRukApplicant(identity, normaliseId);
  const scotlandDomiciled = isScotlandDomiciledApplicant(identity, normaliseId);

  result.checks.scope.push(check(
    'home_scotland_or_ruk_scope',
    'Home Scotland or RUK applicant',
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
      reason: 'edinburgh_contextual_not_applicable',
      policy_decision: 'outside_home_scotland_ruk_contextual_scope'
    };
  }

  const explicitCheck = explicitLevelCheck(applicant, evidence, normaliseId);
  result.checks.academic_contextual_level.push(explicitCheck);

  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);
  const accessProgrammes = asObject(evidence.access_programmes);
  const ucatBursary = ucatBursaryCheck(financial, normaliseId);
  const simd40 = simd40Check(evidence, scotlandDomiciled, normaliseId);
  const accessCheck = accessEdinburghCheck(accessProgrammes, normaliseId);
  const flagChecks = [
    polar2StateSchoolFlagCheck(evidence, identity, normaliseId)
  ];
  const personalChecks = [
    ...personalCircumstanceChecks(personal, normaliseId),
    estrangedUnder25Check(personal, identity, normaliseId),
    carerBridgingCheck(personal, normaliseId)
  ];
  result.checks.ucat_contextual_treatment.push(ucatBursary, simd40);
  result.checks.unresolved_evidence.push(accessCheck, ...flagChecks, ...personalChecks);
  result.checks.academic_contextual_level.push(accessCheck, ...flagChecks, ...personalChecks);

  const rawUcat = applicant.admissions_tests?.ucat?.total_score;
  const explicitLevel = explicitCheck.status === 'matched'
    ? (explicitCheck.criterion_id === 'edinburgh_plus_flag' ? 'plus_flag' : 'flag')
    : null;
  const derivedPlusCheck = [accessCheck, ...personalChecks].find((entry) => entry.status === 'matched');
  const derivedFlagCheck = flagChecks.find((entry) => entry.status === 'matched');
  const resolvedLevel = derivedPlusCheck && explicitLevel !== 'plus_flag'
    ? 'plus_flag'
    : explicitLevel || (derivedFlagCheck ? 'flag' : null);
  const resolvedCheck =
    resolvedLevel === 'plus_flag' && derivedPlusCheck
      ? derivedPlusCheck
      : resolvedLevel === 'flag' && derivedFlagCheck && !explicitLevel
        ? derivedFlagCheck
        : explicitCheck;
  const { treatment, adjustedSelectionUcat } = ucatTreatmentFor({
    level: resolvedLevel,
    ucatBursary,
    simd40,
    rawUcat
  });

  if (resolvedLevel) {
    return contextualOutcome(
      result,
      resolvedLevel,
      resolvedCheck,
      treatment,
      adjustedSelectionUcat
    );
  }

  const missingInformation = [
    explicitCheck,
    accessCheck,
    ...flagChecks,
    ...personalChecks
  ]
    .filter((entry) => entry.status === 'information_needed')
    .map((entry) => ({
      criterion_id: entry.criterion_id,
      label: entry.label,
      evidence_path: entry.evidence_path,
      reason: 'edinburgh_contextual_level_requires_confirmation'
    }));

  if (missingInformation.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'edinburgh_contextual_information_needed',
      manual_review_reason: 'edinburgh_contextual_information_needed',
      missing_information: missingInformation,
      ucat_contextual_treatment: treatment,
      ucat_uplift_percent: treatment.uplift_percent,
      ucat_uplift_reason: treatment.reason,
      adjusted_selection_ucat: adjustedSelectionUcat,
      policy_decision: 'manual_review_required_for_unresolved_edinburgh_contextual_level'
    };
  }

  return {
    ...result,
    ucat_contextual_treatment: treatment,
    ucat_uplift_percent: treatment.uplift_percent,
    ucat_uplift_reason: treatment.reason,
    adjusted_selection_ucat: adjustedSelectionUcat
  };
}

module.exports = {
  EDINBURGH_CONTEXTUAL_EVALUATOR_ID,
  evaluateEdinburghContextualEligibility
};
