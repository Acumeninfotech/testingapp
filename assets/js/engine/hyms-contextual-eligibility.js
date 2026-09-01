const {
  isUkwpmedRecognisedByMedicalSchool
} = require('./contextual-profile-registry');
const {
  resolveUcatDecile
} = require('./ucat-decile-service');

const HYMS_CONTEXTUAL_EVALUATOR_ID = 'hyms_contextual_medicine_a100';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
const HYMS_PROFILE_ID = 'hull-york-a100';
const REDUCED_OFFER_CYCLE = 2027;

const HYMS_OTHER_PROGRAMMES = Object.freeze({
  york_experience_summer_school: {
    label: 'York Experience Summer School',
    contextual: true,
    reduced_offer: true,
    alternative_wp_offer: false,
    fast_track_decile: 4
  },
  york_black_access: {
    label: 'University of York Black Access',
    contextual: false,
    reduced_offer: false,
    alternative_wp_offer: false,
    fast_track_decile: 4
  },
  next_step_york: {
    label: 'Next Step York',
    contextual: false,
    reduced_offer: false,
    alternative_wp_offer: false,
    fast_track_decile: 4
  },
  realising_opportunities: {
    label: 'Realising Opportunities',
    contextual: false,
    reduced_offer: false,
    alternative_wp_offer: false,
    fast_track_decile: 5
  }
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'hyms_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    policy_decision: 'criteria_not_met',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      ordinary_markers: [],
      high_priority_markers: [],
      programmes: [],
      consequences: []
    },
    contextual_evidence: {
      ordinary_marker_count: 0,
      high_priority_marker_count: 0,
      programme_marker_count: 0,
      matched_criteria: [],
      ignored_legacy_flags: true
    },
    consequences: {
      reduced_offer: {
        status: 'not_eligible',
        cycle: REDUCED_OFFER_CYCLE,
        qualification_scope: ['a_level', 'scottish'],
        ib_reduced_route_implemented: false,
        reason: 'hyms_reduced_offer_criteria_not_met'
      },
      alternative_wp_offer: {
        status: 'not_eligible',
        cycle: REDUCED_OFFER_CYCLE,
        qualification_scope: ['a_level'],
        reason: 'hyms_alternative_wp_offer_criteria_not_met'
      },
      fast_track: {
        status: 'not_eligible',
        cycle: REDUCED_OFFER_CYCLE,
        reason: 'hyms_fast_track_criteria_not_met'
      }
    },
    activated_applicant_group_ids: [],
    source_ids: ['hyms_contextual_admissions_2027']
  };
}

function answerIsYes(value, normaliseId) {
  return value === true || ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  return value === false || ['no', 'false', 'none', 'not_applicable', 'not_eligible'].includes(normaliseId(value));
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
}

function quintileIs(value, expected, normaliseId) {
  const normalised = normaliseId(value);
  return normalised === `q${expected}` ||
    normalised === `quintile_${expected}` ||
    normalised === String(expected);
}

function addMatched(result, bucket, entry) {
  result.qualifying_criteria.push(entry);
  result.checks[bucket].push(entry);
  result.contextual_evidence.matched_criteria.push(entry.criterion_id);
}

function addMissing(result, bucket, entry) {
  result.missing_information.push(entry);
  result.checks[bucket].push(entry);
}

function isHomeFeeApplicant(applicant, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const groups = new Set((applicant.applicant_group_ids || []).map(normaliseId));
  return feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk' ||
    feeStatus.includes('home') ||
    groups.has('home_fee');
}

function routeFlags(applicant, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const groups = new Set((applicant.applicant_group_ids || []).map(normaliseId));
  const feeStatus = normaliseId(identity.fee_status);
  const graduate =
    identity.graduate === true ||
    applicant.graduate_profile?.is_graduate === true ||
    groups.has('graduate_applicant');
  const priorUniversity =
    identity.prior_university_study === true ||
    identity.previously_started_or_completed_university_course === true ||
    applicant.prior_university_profile?.has_prior_study === true;
  const schoolLeaver =
    !graduate &&
    (
      groups.has('school_leaver') ||
      normaliseId(identity.applicant_type).includes('school') ||
      normaliseId(identity.applicant_type).includes('standard')
    );

  return {
    home: isHomeFeeApplicant(applicant, normaliseId),
    international:
      feeStatus === 'international' ||
      feeStatus === 'international_fee' ||
      feeStatus === 'overseas' ||
      feeStatus.includes('international'),
    graduate,
    prior_university: priorUniversity,
    school_leaver: schoolLeaver
  };
}

function scopeResult(result, applicant, normaliseId) {
  const flags = routeFlags(applicant, normaliseId);
  const scopeChecks = [
    check('hyms_home_fee', 'Home-fee applicant', 'applicant_identity.fee_status', flags.home && !flags.international ? 'matched' : 'not_matched', applicant.applicant_identity?.fee_status),
    check('hyms_school_leaver', 'School-leaver applicant', 'applicant_identity.applicant_type', flags.school_leaver ? 'matched' : 'not_matched', applicant.applicant_identity?.applicant_type),
    check('hyms_not_international', 'Not international fee status', 'applicant_identity.fee_status', !flags.international ? 'matched' : 'excluded', applicant.applicant_identity?.fee_status),
    check('hyms_not_graduate', 'Not a graduate applicant', 'graduate_profile.is_graduate', !flags.graduate ? 'matched' : 'excluded', applicant.graduate_profile?.is_graduate ?? applicant.applicant_identity?.graduate),
    check('hyms_no_prior_university_study', 'No prior university study', 'applicant_identity.prior_university_study', !flags.prior_university ? 'matched' : 'excluded', applicant.applicant_identity?.prior_university_study)
  ];
  result.checks.scope.push(...scopeChecks);

  if (flags.international) result.exclusions.push('international_applicant');
  if (flags.graduate) result.exclusions.push('graduate_applicant');
  if (flags.prior_university) result.exclusions.push('prior_university_applicant');

  return {
    flags,
    applicable:
      flags.home &&
      flags.school_leaver &&
      !flags.international &&
      !flags.graduate &&
      !flags.prior_university
  };
}

function evaluateOrdinaryMarkers(evidence, result, normaliseId) {
  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);
  const school = asObject(evidence.school_education);
  const polar4 = evidence.postcode_measures?.polar4_quintile;
  const markers = [];
  const missing = [];

  const ucatBursary = check(
    'ucat_bursary',
    'UCAT bursary',
    'financial_support.ucat_bursary_recipient',
    answerIsYes(financial.ucat_bursary_recipient, normaliseId) ? 'matched' : isMissing(financial.ucat_bursary_recipient) ? 'missing' : 'not_matched',
    financial.ucat_bursary_recipient
  );
  if (ucatBursary.status === 'matched') markers.push(ucatBursary);
  else if (ucatBursary.status === 'missing') missing.push(ucatBursary);
  result.checks.ordinary_markers.push(ucatBursary);

  const polar = check(
    quintileIs(polar4, 1, normaliseId) ? 'polar4_quintile_1' : 'polar4_quintile_2',
    'POLAR4 Quintile 1 or 2',
    'home_area_region.polar4_quintile',
    quintileIs(polar4, 1, normaliseId) || quintileIs(polar4, 2, normaliseId)
      ? 'matched'
      : isMissing(polar4) ? 'missing' : 'not_matched',
    polar4
  );
  if (polar.status === 'matched') markers.push(polar);
  else if (polar.status === 'missing') missing.push(polar);
  result.checks.ordinary_markers.push(polar);

  const firstInFamily = check(
    'first_generation_higher_education',
    'First generation in immediate family to attend university',
    'personal_circumstances.first_in_family_at_university',
    answerIsYes(personal.first_in_family_at_university, normaliseId) ? 'matched' : isMissing(personal.first_in_family_at_university) ? 'missing' : 'not_matched',
    personal.first_in_family_at_university
  );
  if (firstInFamily.status === 'matched') markers.push(firstInFamily);
  else if (firstInFamily.status === 'missing') missing.push(firstInFamily);
  result.checks.ordinary_markers.push(firstInFamily);

  const verifiedSchoolPerformance =
    answerIsYes(school.hyms_verified_below_average_school_performance, normaliseId) ||
    answerIsYes(school.hyms_school_performance_marker, normaliseId);
  const broadSchoolPerformance =
    answerIsYes(school.school_below_progress_8, normaliseId) ||
    answerIsYes(school.below_average_gcse_school, normaliseId) ||
    answerIsYes(school.below_average_post16_school, normaliseId);
  const schoolActual = {
    hyms_verified_below_average_school_performance: school.hyms_verified_below_average_school_performance,
    hyms_school_performance_marker: school.hyms_school_performance_marker,
    school_below_progress_8: school.school_below_progress_8,
    below_average_gcse_school: school.below_average_gcse_school,
    below_average_post16_school: school.below_average_post16_school
  };
  const schoolEntry = check(
    'school_below_progress_8',
    'HYMS school-performance marker',
    'school_education',
    verifiedSchoolPerformance
      ? 'matched'
      : broadSchoolPerformance || [school.school_below_progress_8, school.below_average_gcse_school, school.below_average_post16_school].some(isMissing)
        ? 'information_needed'
        : 'not_matched',
    schoolActual,
    verifiedSchoolPerformance
      ? {}
      : broadSchoolPerformance
        ? { reason: 'hyms_school_performance_metric_requires_verification' }
        : {}
  );
  if (schoolEntry.status === 'matched') {
    markers.push(schoolEntry);
  } else if (schoolEntry.status === 'information_needed') {
    missing.push({
      ...schoolEntry,
      reason: schoolEntry.reason || 'hyms_school_performance_evidence_not_safely_derivable'
    });
  }
  result.checks.ordinary_markers.push(schoolEntry);

  return { markers, missing };
}

function evaluateHighPriorityMarkers(evidence, result, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const rows = [
    ['care_experienced', 'Care experienced', 'personal_circumstances.care_experienced', personal.care_experienced],
    ['refugee', 'Refugee status', 'personal_circumstances.refugee', personal.refugee ?? personal.uk_refugee_status_granted],
    ['military_family', 'Military background', 'personal_circumstances.military_family', personal.military_family],
    ['gypsy_roma_traveller', 'Gypsy, Roma or Traveller background', 'personal_circumstances.gypsy_roma_traveller', personal.gypsy_roma_traveller]
  ].map(([criterionId, label, evidencePath, value]) =>
    check(
      criterionId,
      label,
      evidencePath,
      answerIsYes(value, normaliseId) ? 'matched' : 'not_matched',
      value
    )
  );
  result.checks.high_priority_markers.push(...rows);
  return rows.filter((entry) => entry.status === 'matched');
}

function hasCompletionTiming(record) {
  return Number.isInteger(record.completion_year) ||
    record.completion_window_verified === true ||
    record.timing_verified === true ||
    record.provider_window_verified === true;
}

function programmeCompletionStatus(record, normaliseId) {
  const status = normaliseId(record.programme_status || record.status || record.completion_status);
  if (status === 'completed' && hasCompletionTiming(record)) return 'completed';
  if (status === 'completed') return 'timing_missing';
  if (['participating', 'offered', 'not_sure', 'unknown'].includes(status)) return status;
  return '';
}

function collectProgrammeRecords(evidence) {
  const access = asObject(evidence.access_programmes);
  return [
    {
      ...asObject(access.ukwpmed),
      evidence_path: 'access_programmes.ukwpmed',
      scheme: 'ukwpmed'
    },
    ...asArray(access.other_programmes).map((programme) => ({
      ...asObject(programme),
      evidence_path: 'access_programmes.other_programmes',
      scheme: 'other'
    }))
  ].filter((programme) => programme.programme_id);
}

function evaluateProgrammes(evidence, result, normaliseId) {
  const access = asObject(evidence.access_programmes);
  const records = collectProgrammeRecords(evidence);
  const matchedContextual = [];
  const reducedOffer = [];
  const alternativeWp = [];
  const fastTrackCandidates = [];
  const missing = [];

  if (
    answerIsYes(access.participation_status, normaliseId) &&
    records.length === 0
  ) {
    const entry = check(
      'recognised_wp_programme_identity',
      'Recognised widening-participation programme identity',
      'access_programmes',
      'information_needed',
      access.other_programme_name || access.participation_status,
      { reason: 'hyms_recognised_programme_identity_required' }
    );
    addMissing(result, 'programmes', entry);
    missing.push(entry);
  }

  for (const record of records) {
    const programmeId = normaliseId(record.programme_id);
    const isRecognisedUkwpmed =
      record.scheme === 'ukwpmed' &&
      isUkwpmedRecognisedByMedicalSchool(HYMS_PROFILE_ID, record.programme_id);
    const hymsProgramme = HYMS_OTHER_PROGRAMMES[programmeId] || null;
    const recognised = isRecognisedUkwpmed || Boolean(hymsProgramme);
    const completionStatus = programmeCompletionStatus(record, normaliseId);
    const label = hymsProgramme?.label || record.programme_label || record.label || record.programme_id;
    const baseDetails = {
      programme_id: record.programme_id,
      programme_status: record.programme_status || record.status || null,
      completion_year: record.completion_year || null
    };

    if (!recognised) {
      const entry = check(
        'recognised_wp_programme',
        'Recognised HYMS widening-participation programme',
        record.evidence_path,
        'manual_review',
        baseDetails,
        { reason: 'hyms_programme_provider_or_window_unverified' }
      );
      result.checks.programmes.push(entry);
      result.missing_information.push(entry);
      continue;
    }

    if (completionStatus !== 'completed') {
      const entry = check(
        'recognised_wp_programme_completion',
        label,
        record.evidence_path,
        'information_needed',
        baseDetails,
        {
          reason: completionStatus === 'timing_missing'
            ? 'hyms_programme_completion_timing_required'
            : 'hyms_programme_completion_required'
        }
      );
      addMissing(result, 'programmes', entry);
      missing.push(entry);
      continue;
    }

    const entry = check(
      isRecognisedUkwpmed ? 'recognised_wp_programme' : programmeId,
      label,
      record.evidence_path,
      'matched',
      baseDetails
    );
    result.checks.programmes.push(entry);

    if (isRecognisedUkwpmed || hymsProgramme.contextual) {
      matchedContextual.push(entry);
    }
    if (hymsProgramme?.reduced_offer) {
      reducedOffer.push(entry);
    }
    if (isRecognisedUkwpmed) {
      alternativeWp.push(entry);
    }
    const fastTrackDecile = isRecognisedUkwpmed ? 4 : hymsProgramme?.fast_track_decile;
    if (Number.isFinite(fastTrackDecile)) {
      fastTrackCandidates.push({
        ...entry,
        required_decile: fastTrackDecile
      });
    }
  }

  return { matchedContextual, reducedOffer, alternativeWp, fastTrackCandidates, missing };
}

function resolveApplicantUcatDecile(applicant) {
  const ucat = asObject(applicant.admissions_tests?.ucat);
  const explicit = Number(ucat.national_decile ?? ucat.decile ?? ucat.ucat_decile);
  if (Number.isFinite(explicit)) {
    return {
      available: true,
      national_decile: explicit,
      lookup_source: 'applicant_supplied'
    };
  }
  return resolveUcatDecile(ucat.total_score, {
    courseProfileId: HYMS_PROFILE_ID,
    universityDecileData: null
  });
}

function applyConsequences(result, applicant, evidenceMatches) {
  const ordinaryCount = evidenceMatches.ordinary.length;
  const highPriorityCount = evidenceMatches.highPriority.length;
  const programmeCount = evidenceMatches.programmes.length;
  const contextual = ordinaryCount >= 2 || highPriorityCount >= 1 || programmeCount >= 1;
  const reducedEvidence =
    ordinaryCount >= 2
      ? evidenceMatches.ordinary
      : highPriorityCount >= 1
        ? evidenceMatches.highPriority
        : evidenceMatches.reducedOfferProgrammes;
  const reducedEligible =
    ordinaryCount >= 2 ||
    highPriorityCount >= 1 ||
    evidenceMatches.reducedOfferProgrammes.length > 0;

  result.contextual_evidence.ordinary_marker_count = ordinaryCount;
  result.contextual_evidence.high_priority_marker_count = highPriorityCount;
  result.contextual_evidence.programme_marker_count = programmeCount;

  if (reducedEligible) {
    result.consequences.reduced_offer = {
      status: 'eligible',
      cycle: REDUCED_OFFER_CYCLE,
      qualification_scope: ['a_level', 'scottish'],
      a_level_offer: 'AAB including Biology and Chemistry',
      scottish_offer: '2027 contextual Scottish reduced route',
      firm_choice_condition: true,
      ib_reduced_route_implemented: false,
      evidence: reducedEvidence.map((entry) => entry.criterion_id)
    };
  }

  if (evidenceMatches.alternativeWpProgrammes.length > 0) {
    result.consequences.alternative_wp_offer = {
      status: 'eligible',
      cycle: REDUCED_OFFER_CYCLE,
      qualification_scope: ['a_level'],
      a_level_offer: 'ABB including Biology and Chemistry',
      firm_choice_condition: true,
      evidence: evidenceMatches.alternativeWpProgrammes.map((entry) => entry.criterion_id)
    };
  }

  const fastTrackCandidates = [
    ...evidenceMatches.highPriority.map((entry) => ({
      ...entry,
      required_decile: 4
    })),
    ...evidenceMatches.fastTrackProgrammes
  ];
  if (fastTrackCandidates.length > 0) {
    const ucatDecile = resolveApplicantUcatDecile(applicant);
    const minimumRequiredDecile = Math.min(
      ...fastTrackCandidates.map((entry) => entry.required_decile)
    );
    if (!ucatDecile.available || !Number.isFinite(ucatDecile.national_decile)) {
      const entry = check(
        'hyms_fast_track_ucat_decile',
        'HYMS fast-track UCAT decile',
        'admissions_tests.ucat.total_score',
        'information_needed',
        applicant.admissions_tests?.ucat?.total_score,
        { reason: 'hyms_fast_track_ucat_decile_required' }
      );
      result.missing_information.push(entry);
      result.checks.consequences.push(entry);
      result.consequences.fast_track = {
        status: 'information_needed',
        cycle: REDUCED_OFFER_CYCLE,
        required_decile: minimumRequiredDecile,
        reason: 'hyms_fast_track_ucat_decile_required',
        evidence: fastTrackCandidates.map((entry) => entry.criterion_id)
      };
    } else {
      const eligible = fastTrackCandidates.some((entry) =>
        ucatDecile.national_decile >= entry.required_decile
      );
      result.consequences.fast_track = {
        status: eligible ? 'eligible' : 'not_eligible',
        cycle: REDUCED_OFFER_CYCLE,
        required_decile: minimumRequiredDecile,
        national_decile: ucatDecile.national_decile,
        lookup_source: ucatDecile.lookup_source,
        reason: eligible ? 'hyms_fast_track_criteria_met' : 'hyms_fast_track_ucat_decile_below_threshold',
        evidence: fastTrackCandidates.map((entry) => entry.criterion_id)
      };
    }
  }

  return contextual;
}

function evaluateHymsContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const scope = scopeResult(result, applicant, normaliseId);

  if (!scope.applicable) {
    return {
      ...result,
      reason: result.exclusions[0] || 'hyms_contextual_not_applicable',
      policy_decision: 'outside_hyms_contextual_scope'
    };
  }

  const ordinary = evaluateOrdinaryMarkers(evidence, result, normaliseId);
  const highPriority = evaluateHighPriorityMarkers(evidence, result, normaliseId);
  const programmes = evaluateProgrammes(evidence, result, normaliseId);

  ordinary.markers.forEach((entry) => {
    if (!result.qualifying_criteria.includes(entry)) {
      result.qualifying_criteria.push(entry);
      result.contextual_evidence.matched_criteria.push(entry.criterion_id);
    }
  });
  highPriority.forEach((entry) => {
    if (!result.qualifying_criteria.includes(entry)) {
      result.qualifying_criteria.push(entry);
      result.contextual_evidence.matched_criteria.push(entry.criterion_id);
    }
  });
  programmes.matchedContextual.forEach((entry) => {
    if (!result.qualifying_criteria.includes(entry)) {
      result.qualifying_criteria.push(entry);
      result.contextual_evidence.matched_criteria.push(entry.criterion_id);
    }
  });

  const unresolvedOrdinary = ordinary.missing.filter((entry) =>
    ['not_sure', 'prefer_not_to_say'].includes(
      helpers.normaliseId(entry.actual)
    )
  );

  if (ordinary.markers.length === 1 && unresolvedOrdinary.length > 0) {
    for (const entry of unresolvedOrdinary) {
      if (!result.missing_information.includes(entry)) {
        result.missing_information.push({
          ...entry,
          reason: entry.reason || 'hyms_second_ordinary_marker_evidence_required'
        });
      }
    }
  }

  const isContextual = applyConsequences(result, applicant, {
    ordinary: ordinary.markers,
    highPriority,
    programmes: programmes.matchedContextual,
    reducedOfferProgrammes: programmes.reducedOffer,
    alternativeWpProgrammes: programmes.alternativeWp,
    fastTrackProgrammes: programmes.fastTrackCandidates
  });

  if (
    !isContextual &&
    ordinary.markers.length === 1 &&
    unresolvedOrdinary.length > 0
  ) {
    result.consequences.reduced_offer = {
      status: 'information_needed',
      cycle: REDUCED_OFFER_CYCLE,
      qualification_scope: ['a_level', 'scottish'],
      a_level_offer: 'AAB including Biology and Chemistry',
      ib_reduced_route_implemented: false,
      reason: 'hyms_contextual_reduced_offer_information_needed',
      evidence: ordinary.markers.map((entry) => entry.criterion_id),
      missing_evidence: unresolvedOrdinary.map((entry) => entry.criterion_id)
    };
  }

  if (isContextual) {
    return {
      ...result,
      status: 'contextual',
      reason: 'hyms_contextual_criteria_met',
      is_contextual: true,
      matched_contextual_pathway:
        highPriority[0]?.criterion_id ||
        programmes.matchedContextual[0]?.criterion_id ||
        (ordinary.markers.length >= 2 ? 'two_ordinary_markers' : null),
      matched_contextual_pathway_label:
        highPriority[0]?.label ||
        programmes.matchedContextual[0]?.label ||
        'Two or more ordinary HYMS contextual markers',
      policy_decision: 'hyms_contextual_eligible',
      activated_applicant_group_ids: [
        'contextual',
        ...(programmes.matchedContextual.length > 0 ? ['widening_participation'] : []),
        ...(highPriority.some((entry) => entry.criterion_id === 'care_experienced') ? ['care_experienced'] : [])
      ]
    };
  }

  if (result.missing_information.some((entry) => entry.status === 'manual_review')) {
    return {
      ...result,
      status: 'manual_review',
      reason: 'hyms_contextual_manual_review_required',
      manual_review_reason: 'hyms_contextual_manual_review_required',
      policy_decision: 'manual_review_required'
    };
  }

  if (result.missing_information.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'hyms_contextual_evidence_incomplete',
      manual_review_reason: 'hyms_contextual_evidence_incomplete',
      policy_decision: 'information_needed'
    };
  }

  return result;
}

module.exports = {
  HYMS_CONTEXTUAL_EVALUATOR_ID,
  evaluateHymsContextualEligibility
};
