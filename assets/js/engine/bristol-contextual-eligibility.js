const BRISTOL_CONTEXTUAL_EVALUATOR_ID = 'bristol_contextual_medicine_a100';
const BRISTOL_CONTEXTUAL_GROUP_ID = 'bristol_contextual_offer';
const BRISTOL_SCHOLARS_REVIEW_GROUP_ID = 'bristol_scholars_tailored_offer_review';
const {
  verifyBristolAspiringSchool
} = require('./bristol-aspiring-state-school-list');

const BRISTOL_ASPIRING_STATE_SCHOOL_AREA_ID = 'bristol_bs_ba_state_school';
const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
const BRISTOL_PROGRAMMES = new Set([
  'bristol_access_to_bristol',
  'access_to_bristol',
  'bristol_discover_bristol',
  'discover_bristol',
  'bristol_insight_into_bristol_summer_school',
  'insight_into_bristol_summer_school',
  'insight_into_bristol',
  'bristol_next_step_bristol',
  'next_step_bristol',
  'bristol_virtual_summer_school',
  'virtual_summer_school'
]);
const BRISTOL_SCHOLARS_PROGRAMME_IDS = new Set([
  'bristol_scholars'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'none', 'not_applicable'].includes(normaliseId(value));
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
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

function missing(criterionId, label, evidencePath, reason) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    reason
  };
}

function addMatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  const entry = check(criterionId, label, evidencePath, 'matched', actual, details);
  if (bucket === 'qualifying_criteria') {
    results.qualifying_criteria.push(entry);
  }
  results.checks[bucket].push(entry);
}

function addUnmatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  results.checks[bucket].push(check(criterionId, label, evidencePath, 'not_matched', actual, details));
}

function addMissing(results, bucket, criterionId, label, evidencePath, reason) {
  const entry = missing(criterionId, label, evidencePath, reason);
  results.missing_information.push(entry);
  results.checks[bucket].push(entry);
}

function addExclusion(results, criterionId, label, evidencePath, actual, reason) {
  const entry = check(criterionId, label, evidencePath, 'excluded', actual, { reason });
  results.exclusions.push(entry);
  results.checks.base_requirements.push(entry);
}

function hasOwnPath(source, path) {
  const steps = String(path).split('.').filter(Boolean);
  let current = source;
  for (const step of steps) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, step)) {
      return false;
    }
    current = current[step];
  }
  return true;
}

function hasPopulatedQualificationSubjects(subjects) {
  if (Array.isArray(subjects)) {
    return subjects.some((subject) => {
      const id = String(subject?.subject_id || '').trim();
      const hasGrade = [
        subject?.predicted_grade,
        subject?.achieved_grade,
        subject?.grade,
        subject?.higher_level_grade
      ].some((value) => !isMissing(value) && String(value).trim() !== '');
      return Boolean(id || hasGrade);
    });
  }

  if (subjects && typeof subjects === 'object') {
    return Object.entries(subjects).some(([subjectId, grade]) => {
      return String(subjectId || '').trim() !== '' || (!isMissing(grade) && String(grade ?? '').trim() !== '');
    });
  }

  return false;
}

function hasPopulatedALevelProfile(applicant) {
  const profile = asObject(applicant.a_level_profile);
  if (Object.keys(profile).length === 0) return false;
  if (hasPopulatedQualificationSubjects(profile.subjects)) return true;
  return asArray(profile.additional_subjects).some((subject) => {
    const id = String(subject?.subject_id || '').trim();
    const grade = subject?.grade;
    return Boolean(id) || (!isMissing(grade) && String(grade ?? '').trim() !== '');
  });
}

function hasPopulatedIbProfile(applicant) {
  const profile = asObject(applicant.ib_profile);
  if (Object.keys(profile).length === 0) return false;
  if (Number.isFinite(Number(profile.total_points))) return true;
  if (Number.isFinite(Number(profile.higher_level_total_points))) return true;
  if (hasPopulatedQualificationSubjects(profile.higher_level_subjects)) return true;
  if (hasPopulatedQualificationSubjects(profile.hl_subjects)) return true;
  if (hasPopulatedQualificationSubjects(profile.subjects)) return true;
  return false;
}

function resolveSupportedPost16QualificationRoute(applicant, normaliseId) {
  const explicitRoute = normaliseId(
    applicant.qualification_route ||
    applicant.route ||
    applicant.course_target?.qualification_route
  );
  if (explicitRoute) {
    return {
      qualificationRoute: explicitRoute,
      sourcePath: 'qualification_route'
    };
  }

  const hasALevelEvidence = hasPopulatedALevelProfile(applicant);
  const hasIbEvidence = hasPopulatedIbProfile(applicant);

  if (hasALevelEvidence && hasIbEvidence) {
    return {
      qualificationRoute: '',
      sourcePath: 'qualification_profiles',
      conflict: true
    };
  }

  if (hasIbEvidence) {
    return {
      qualificationRoute: 'international_baccalaureate',
      sourcePath: 'ib_profile'
    };
  }

  if (hasALevelEvidence) {
    return {
      qualificationRoute: 'a_level',
      sourcePath: 'a_level_profile'
    };
  }

  return {
    qualificationRoute: '',
    sourcePath: 'qualification_route'
  };
}

function evaluateBaseline(applicant, evidence, results, normaliseId) {
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const {
    qualificationRoute,
    sourcePath: qualificationRouteEvidencePath,
    conflict: qualificationRouteConflict
  } = resolveSupportedPost16QualificationRoute(applicant, normaliseId);

  const homeFee = feeStatus === 'home' || feeStatus === 'home_fee' || feeStatus.includes('home');
  const internationalFee = feeStatus === 'international' || feeStatus === 'international_fee' || feeStatus.includes('international');
  if (homeFee && !internationalFee) {
    addMatched(
      results,
      'base_requirements',
      'home_fee_status',
      'Home fee status',
      'applicant_identity.fee_status',
      identity.fee_status
    );
  } else if (!feeStatus) {
    addMissing(
      results,
      'base_requirements',
      'home_fee_status',
      'Home fee status',
      'applicant_identity.fee_status',
      'home_fee_status_required'
    );
  } else {
    addExclusion(
      results,
      'not_home_fee',
      'Bristol contextual admissions require Home fee status',
      'applicant_identity.fee_status',
      identity.fee_status,
      'bristol_contextual_home_fee_required'
    );
  }

  const qualificationSupported = ['a_level', 'international_baccalaureate', 'ib'].includes(qualificationRoute);
  if (qualificationSupported) {
    addMatched(
      results,
      'base_requirements',
      'supported_post16_qualification',
      'A-level and/or IB route',
      qualificationRouteEvidencePath,
      qualificationRoute
    );
  } else if (qualificationRouteConflict) {
    addMissing(
      results,
      'base_requirements',
      'supported_post16_qualification',
      'A-level and/or IB route',
      qualificationRouteEvidencePath,
      'qualification_route_conflicting_evidence'
    );
  } else if (!qualificationRoute) {
    addMissing(
      results,
      'base_requirements',
      'supported_post16_qualification',
      'A-level and/or IB route',
      qualificationRouteEvidencePath,
      'qualification_route_required'
    );
  } else {
    addExclusion(
      results,
      'unsupported_post16_qualification',
      'Bristol contextual route applies only to A-level and/or IB qualifications',
      qualificationRouteEvidencePath,
      qualificationRoute,
      'bristol_contextual_qualification_not_supported'
    );
  }

  // ApplySmart currently operates on UCAS-submitted applicant evidence.
  addMatched(
    results,
    'base_requirements',
    'ucas_application_assumed',
    'Application via UCAS',
    'application.channel',
    'assumed_ucas_application'
  );

}

function hasContextualSignals(applicant, evidence, normaliseId) {
  const legacy = asObject(evidence.legacy_declarations);
  const home = asObject(evidence.profile?.home_area_region);
  const access = asObject(evidence.access_programmes);
  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);
  const schoolArea = normaliseId(evidence?.home_area_region?.school_area);

  return (
    legacy.contextual === true ||
    legacy.widening_participation === true ||
    legacy.contextual_status_confirmed === true ||
    asArray(legacy.confirmed_flag_ids).length > 0 ||
    Boolean(String(home.postcode || '').trim()) ||
    schoolArea === BRISTOL_ASPIRING_STATE_SCHOOL_AREA_ID ||
    access.participation_status === 'yes' ||
    asArray(access.other_programmes).length > 0 ||
    Boolean(access.other_programme_name) ||
    answerIsYes(financial.free_school_meals, normaliseId) ||
    answerIsYes(personal.care_experienced, normaliseId) ||
    answerIsYes(personal.care_over_three_months, normaliseId)
  );
}

function applicationYearForContextualCycle(applicant = {}) {
  const direct = Number(applicant.application_year);
  if (Number.isInteger(direct)) return direct;
  const courseTargetYear = Number(asObject(applicant.course_target).application_year);
  if (Number.isInteger(courseTargetYear)) return courseTargetYear;
  return null;
}

function firstBristolRelationship(relationships, normaliseId) {
  const withSchoolEvidence = asArray(relationships)
    .map((relationship) => asObject(relationship))
    .filter((relationship) => {
      const schoolIdentifier = String(
        relationship.school_identifier ||
        relationship.school_id ||
        ''
      ).trim();
      const schoolName = String(relationship.school_name || '').trim();
      return Boolean(schoolIdentifier || schoolName);
    });

  if (withSchoolEvidence.length === 0) return null;

  const bristolOnly = withSchoolEvidence.filter((relationship) => {
    return normaliseId(relationship.university_id) === 'bristol_a100';
  });
  return (bristolOnly[0] || withSchoolEvidence[0]) || null;
}

function applyCentreCodeFromRelationship(relationship = {}, normaliseId) {
  const identifier = String(relationship.school_identifier || relationship.school_id || '').trim();
  if (!identifier) return '';

  const identifierType = normaliseId(relationship.school_identifier_type);
  if (identifierType === 'apply_centre_code' || /^[0-9]+$/.test(identifier)) {
    return identifier;
  }
  return '';
}

function evaluateAspiringSchoolCriterion(applicant, evidence, results, normaliseId) {
  const schoolArea = evidence?.home_area_region?.school_area;
  const school = asObject(evidence.school_education);
  const partnerSchools = asObject(evidence.partner_schools);
  const selectedRelationship = firstBristolRelationship(partnerSchools.relationships, normaliseId);
  const schoolIdentifier = selectedRelationship
    ? String(selectedRelationship.school_identifier || selectedRelationship.school_id || '').trim()
    : '';
  const schoolName = selectedRelationship
    ? String(selectedRelationship.school_name || '').trim()
    : '';
  const schoolIdentifierType = selectedRelationship
    ? selectedRelationship.school_identifier_type || ''
    : '';
  const verifiedApplyCentreCode = selectedRelationship
    ? applyCentreCodeFromRelationship(selectedRelationship, normaliseId)
    : '';
  const applicationYear = applicationYearForContextualCycle(applicant);

  const verification = verifyBristolAspiringSchool({
    applicationYear,
    schoolIdentifier: verifiedApplyCentreCode || schoolIdentifier,
    schoolIdentifierType,
    schoolName
  });

  results.contextual_evidence = {
    ...results.contextual_evidence,
    bristol_aspiring_state_school: {
      school_identifier: schoolIdentifier || null,
      school_identifier_type: schoolIdentifierType || null,
      school_name: schoolName || null,
      verification_status: verification.status,
      application_cycle_year: verification.application_cycle_year ?? applicationYear ?? null,
      source_file: verification.source_file || null,
      match_method: verification.match_method || null
    }
  };

  if (verification.status === 'matched_confirmed') {
    addMatched(
      results,
      'qualifying_criteria',
      'aspiring_state_school_or_college',
      'Bristol aspiring state school or college',
      'partner_schools.relationships',
      schoolIdentifier || schoolName,
      {
        application_cycle_year: verification.application_cycle_year,
        match_method: verification.match_method
      }
    );
    return { status: 'confirmed' };
  }

  if (verification.status === 'matched_awaiting_confirmation') {
    addMissing(
      results,
      'qualifying_criteria',
      'aspiring_state_school_or_college',
      'Bristol aspiring state school or college',
      'partner_schools.relationships',
      'bristol_aspiring_state_school_awaiting_confirmation'
    );
    return { status: 'information_needed' };
  }

  if (verification.status === 'list_unavailable' || verification.status === 'cycle_unavailable') {
    addMissing(
      results,
      'qualifying_criteria',
      'aspiring_state_school_or_college',
      'Bristol aspiring state school or college',
      'partner_schools.relationships',
      'bristol_aspiring_state_school_list_unavailable'
    );
    return { status: 'information_needed' };
  }

  if (verification.status === 'identifier_unverifiable') {
    addMissing(
      results,
      'qualifying_criteria',
      'aspiring_state_school_or_college',
      'Bristol aspiring state school or college',
      'partner_schools.relationships',
      'bristol_aspiring_state_school_identifier_unverifiable'
    );
    return { status: 'information_needed' };
  }

  if (verification.status === 'school_identifier_or_name_required') {
    if (
      normaliseId(schoolArea) === BRISTOL_ASPIRING_STATE_SCHOOL_AREA_ID ||
      answerIsYes(partnerSchools.status, normaliseId)
    ) {
      addMissing(
        results,
        'qualifying_criteria',
        'aspiring_state_school_or_college',
        'Bristol aspiring state school or college',
        'partner_schools.relationships',
        'bristol_aspiring_state_school_identifier_or_name_required'
      );
      return { status: 'information_needed' };
    }
  }

  const candidateSchoolEvidence =
    answerIsYes(school.state_non_fee_paying_school, normaliseId) ||
    answerIsYes(school.low_progression_to_higher_education_school, normaliseId) ||
    answerIsYes(partnerSchools.status, normaliseId) ||
    Boolean(selectedRelationship);

  if (candidateSchoolEvidence) {
    addUnmatched(
      results,
      'qualifying_criteria',
      'aspiring_state_school_or_college',
      'Bristol aspiring state school or college',
      'partner_schools.relationships',
      schoolIdentifier || schoolName || schoolArea || null
    );
    return { status: 'not_met' };
  }

  addUnmatched(
    results,
    'qualifying_criteria',
    'aspiring_state_school_or_college',
    'Bristol aspiring state school or college',
    'partner_schools.relationships',
    schoolArea
  );
  return { status: 'not_met' };
}

function evaluateImdCriterion(applicant, evidence, results, normaliseId) {
  const postcodeMeasures = asObject(evidence.postcode_measures);
  const lookup = asObject(postcodeMeasures.lookup);
  const lookupValues = asObject(lookup.values);
  const imdLookup = asObject(lookupValues.imd);
  const imdQuintile = postcodeMeasures.imd_quintile;
  const imd = normaliseId(imdQuintile);
  const postcode = evidence?.profile?.home_area_region?.postcode;
  const hasExplicitImd = hasOwnPath(asObject(applicant.contextual_profile), 'home_area_region.imd_quintile');
  const source = normaliseId(imdLookup.source);
  const postcodeDerived = source === 'postcode_lookup';

  if (isMissing(postcode) || normaliseId(postcode) === 'unknown') {
    addMissing(
      results,
      'qualifying_criteria',
      'imd_quintile_1_or_2',
      'IMD quintile 1 or 2',
      'postcode_measures.imd_quintile',
      'home_postcode_required_for_imd_checks'
    );
    return { status: 'information_needed' };
  }

  if (isMissing(imdQuintile) || imd === 'unknown') {
    addMissing(
      results,
      'qualifying_criteria',
      'imd_quintile_1_or_2',
      'IMD quintile 1 or 2',
      'postcode_measures.imd_quintile',
      'imd_quintile_evidence_required'
    );
    return { status: 'information_needed' };
  }

  if ((imd === 'q1' || imd === 'q2' || imd === '1' || imd === '2') && (postcodeDerived || hasExplicitImd)) {
    if (!postcodeDerived) {
      addMissing(
        results,
        'qualifying_criteria',
        'imd_quintile_1_or_2',
        'IMD quintile 1 or 2',
        'postcode_measures.lookup.values.imd.source',
        'bristol_contextual_imd_postcode_evidence_required'
      );
      return { status: 'information_needed' };
    }
    addMatched(
      results,
      'qualifying_criteria',
      'imd_quintile_1_or_2',
      'IMD quintile 1 or 2',
      'postcode_measures.imd_quintile',
      imdQuintile,
      {
        dataset_year: 2019,
        value_source: imdLookup.source || null
      }
    );
    return { status: 'confirmed' };
  }

  if (['q3', 'q4', 'q5', '3', '4', '5'].includes(imd)) {
    addUnmatched(
      results,
      'qualifying_criteria',
      'imd_quintile_1_or_2',
      'IMD quintile 1 or 2',
      'postcode_measures.imd_quintile',
      imdQuintile
    );
    return { status: 'not_met' };
  }

  addMissing(
    results,
    'qualifying_criteria',
    'imd_quintile_1_or_2',
    'IMD quintile 1 or 2',
    'postcode_measures.imd_quintile',
    'imd_quintile_evidence_required'
  );
  return { status: 'information_needed' };
}

function evaluateProgrammeCriterion(evidence, results, normaliseId) {
  const access = asObject(evidence.access_programmes);
  const programme = asArray(access.other_programmes).find((entry) => {
    const id = normaliseId(entry?.programme_id);
    return BRISTOL_PROGRAMMES.has(id) || BRISTOL_SCHOLARS_PROGRAMME_IDS.has(id);
  });

  if (!programme) {
    if (access.participation_status === 'yes' || access.other_programme_name) {
      addMissing(
        results,
        'qualifying_criteria',
        'bristol_wp_programme_completion',
        'Recognised University of Bristol widening participation programme completion',
        'access_programmes.other_programmes',
        'bristol_programme_identifier_required'
      );
      return { status: 'information_needed' };
    }

    addUnmatched(
      results,
      'qualifying_criteria',
      'bristol_wp_programme_completion',
      'Recognised University of Bristol widening participation programme completion',
      'access_programmes.other_programmes',
      null
    );
    return { status: 'not_met' };
  }

  const programmeId = normaliseId(programme.programme_id);
  const programmeStatus = normaliseId(programme.status || programme.programme_status);
  const completionConfirmed = ['completed', 'confirmed', 'yes'].includes(programmeStatus);

  if (BRISTOL_SCHOLARS_PROGRAMME_IDS.has(programmeId) && completionConfirmed) {
    addMissing(
      results,
      'qualifying_criteria',
      'bristol_scholars',
      'Bristol Scholars tailored offer route',
      'access_programmes.other_programmes',
      'bristol_scholars_tailored_offer_manual_review'
    );
    return {
      status: 'manual_review',
      programme_id: programme.programme_id
    };
  }

  if (completionConfirmed && BRISTOL_PROGRAMMES.has(programmeId)) {
    addMatched(
      results,
      'qualifying_criteria',
      'bristol_wp_programme_completion',
      'Recognised University of Bristol widening participation programme completion',
      'access_programmes.other_programmes',
      programme.programme_id
    );
    return { status: 'confirmed' };
  }

  if (['participating', 'offered', 'not_sure'].includes(programmeStatus)) {
    addMissing(
      results,
      'qualifying_criteria',
      'bristol_wp_programme_completion',
      'Recognised University of Bristol widening participation programme completion',
      'access_programmes.other_programmes',
      'bristol_programme_completion_confirmation_required'
    );
    return { status: 'information_needed' };
  }

  addUnmatched(
    results,
    'qualifying_criteria',
    'bristol_wp_programme_completion',
    'Recognised University of Bristol widening participation programme completion',
    'access_programmes.other_programmes',
    programme.programme_id
  );
  return { status: 'not_met' };
}

function evaluateCareCriterion(applicant, evidence, results, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const careOverThreeMonths = personal.care_over_three_months;
  const explicitCareExperienced = asObject(asObject(applicant.contextual_profile).personal_circumstances).care_experienced;

  if (answerIsYes(careOverThreeMonths, normaliseId)) {
    addMatched(
      results,
      'qualifying_criteria',
      'care_experienced_three_months',
      'Care experience of at least three months',
      'personal_circumstances.care_over_three_months',
      careOverThreeMonths
    );
    return { status: 'confirmed' };
  }
  if (answerIsNo(careOverThreeMonths, normaliseId)) {
    addUnmatched(
      results,
      'qualifying_criteria',
      'care_experienced_three_months',
      'Care experience of at least three months',
      'personal_circumstances.care_over_three_months',
      careOverThreeMonths
    );
    return { status: 'not_met' };
  }
  if (answerIsYes(explicitCareExperienced, normaliseId)) {
    addMissing(
      results,
      'qualifying_criteria',
      'care_experienced_three_months',
      'Care experience of at least three months',
      'personal_circumstances.care_over_three_months',
      'care_duration_confirmation_required'
    );
    return { status: 'information_needed' };
  }

  addUnmatched(
    results,
    'qualifying_criteria',
    'care_experienced_three_months',
    'Care experience of at least three months',
    'personal_circumstances.care_over_three_months',
    careOverThreeMonths
  );
  return { status: 'not_met' };
}

function evaluateFsmCriterion(applicant, evidence, results, normaliseId) {
  const financial = asObject(evidence.financial_support);
  const fsm = financial.free_school_meals;
  const hasExplicitFsm = hasOwnPath(asObject(applicant.contextual_profile), 'financial_support.free_school_meals');
  const legacyFsm = asObject(asObject(applicant.applicant_identity).contextual_flags).free_school_meals === true;

  if (answerIsYes(fsm, normaliseId) && legacyFsm) {
    addMissing(
      results,
      'qualifying_criteria',
      'free_school_meals_secondary',
      'Free School Meals eligibility during secondary education',
      'financial_support.free_school_meals',
      'bristol_contextual_fsm_secondary_verification_required'
    );
    return { status: 'information_needed' };
  }
  if (answerIsYes(fsm, normaliseId) && hasExplicitFsm) {
    addMatched(
      results,
      'qualifying_criteria',
      'free_school_meals_secondary',
      'Free School Meals eligibility during secondary education',
      'financial_support.free_school_meals',
      fsm
    );
    return { status: 'confirmed' };
  }
  if (answerIsNo(fsm, normaliseId)) {
    addUnmatched(
      results,
      'qualifying_criteria',
      'free_school_meals_secondary',
      'Free School Meals eligibility during secondary education',
      'financial_support.free_school_meals',
      fsm
    );
    return { status: 'not_met' };
  }

  addMissing(
    results,
    'qualifying_criteria',
    'free_school_meals_secondary',
    'Free School Meals eligibility during secondary education',
    'financial_support.free_school_meals',
    'free_school_meals_status_required'
  );
  return { status: 'information_needed' };
}

function evaluateBristolContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const results = {
    status: 'not_contextual',
    reason: 'bristol_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      base_requirements: [],
      qualifying_criteria: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {}
  };

  evaluateBaseline(applicant, evidence, results, normaliseId);
  if (results.exclusions.length > 0) {
    return {
      ...results,
      status: 'not_contextual',
      reason: 'bristol_contextual_baseline_not_met',
      is_contextual: false
    };
  }

  const baselineMissing = results.missing_information.some((entry) => [
    'home_fee_status',
    'supported_post16_qualification'
  ].includes(entry.criterion_id));
  if (baselineMissing) {
    return {
      ...results,
      status: 'information_needed',
      reason: 'bristol_contextual_baseline_information_needed',
      manual_review_reason: 'bristol_contextual_baseline_information_needed',
      is_contextual: false
    };
  }

  const criterionResults = [
    evaluateAspiringSchoolCriterion(applicant, evidence, results, normaliseId),
    evaluateImdCriterion(applicant, evidence, results, normaliseId),
    evaluateProgrammeCriterion(evidence, results, normaliseId),
    evaluateCareCriterion(applicant, evidence, results, normaliseId),
    evaluateFsmCriterion(applicant, evidence, results, normaliseId)
  ];

  const scholars = criterionResults.find((entry) => entry.status === 'manual_review');
  if (scholars) {
    return {
      ...results,
      status: 'information_needed',
      reason: 'bristol_scholars_tailored_offer_manual_review',
      manual_review_reason: 'bristol_scholars_tailored_offer_manual_review',
      is_contextual: false,
      provisional_activated_applicant_group_ids: [BRISTOL_SCHOLARS_REVIEW_GROUP_ID]
    };
  }

  if (results.qualifying_criteria.length > 0) {
    const matched = results.qualifying_criteria[0];
    return {
      ...results,
      status: 'contextual',
      reason: 'bristol_contextual_criteria_met',
      is_contextual: true,
      matched_contextual_pathway: 'bristol_contextual_offer',
      matched_contextual_pathway_label: 'Contextual route confirmed – assessed against ABB',
      contextual_evidence: {
        ...results.contextual_evidence,
        primary_criterion_id: matched.criterion_id
      },
      activated_applicant_group_ids: [
        BRISTOL_CONTEXTUAL_GROUP_ID,
        'contextual',
        'widening_participation'
      ]
    };
  }

  const contextualSignalsPresent = hasContextualSignals(applicant, evidence, normaliseId);
  if (results.missing_information.length > 0) {
    if (!contextualSignalsPresent) {
      return {
        ...results,
        status: 'not_contextual',
        reason: 'bristol_contextual_criteria_not_met',
        is_contextual: false
      };
    }
    return {
      ...results,
      status: 'information_needed',
      reason: 'bristol_contextual_information_needed',
      manual_review_reason: 'bristol_contextual_information_needed',
      is_contextual: false,
      provisional_activated_applicant_group_ids: [
        BRISTOL_CONTEXTUAL_GROUP_ID,
        'contextual',
        'widening_participation'
      ]
    };
  }

  return {
    ...results,
    status: 'not_contextual',
    reason: 'bristol_contextual_criteria_not_met',
    is_contextual: false
  };
}

module.exports = {
  BRISTOL_CONTEXTUAL_EVALUATOR_ID,
  BRISTOL_CONTEXTUAL_GROUP_ID,
  BRISTOL_SCHOLARS_REVIEW_GROUP_ID,
  evaluateBristolContextualEligibility
};
