#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  deriveUniversityHistoricalDecile,
  resolveUcatDecile
} = require('../assets/js/engine/ucat-decile-service');
const {
  classifyInterviewBand,
  deriveApplicantGroupIds,
  resolveUcatMinimumTotalScore
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateNottinghamA100
} = require('../assets/js/engine/nottingham-a100-consumer');
const {
  buildHullYorkA100ResultCard,
  evaluateHullYorkA100
} = require('../assets/js/engine/hull-york-a100-consumer');
const {
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
const { isProductionReady } = require('../server/src/universities');

const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'data', 'examples');
const universitiesDir = path.join(rootDir, 'data', 'universities');
const interviewBandConfigsDir = path.join(rootDir, 'data', 'interview-band-configs');
const studentProfileTemplatePath = path.join(rootDir, 'data', 'templates', 'student-profile-template.json');
const ucatDecilesPath = path.join(rootDir, 'data', 'ucat-deciles.json');
const indexPath = path.join(rootDir, 'data', 'index.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function filterStudentProfiles(profiles) {
  const profileArgIndex = process.argv.indexOf('--profile');

  if (profileArgIndex === -1) {
    return profiles;
  }

  const profileId = process.argv[profileArgIndex + 1];
  assert.ok(profileId, '--profile requires a profile_id value.');

  const selected = profiles.filter((profile) => getStudentId(profile) === profileId);
  assert.ok(selected.length > 0, `No sample profile found for --profile ${profileId}.`);

  return selected;
}

const studentProfileTemplate = readJson(studentProfileTemplatePath);
const ucatDeciles = readJson(ucatDecilesPath);
const ALL_STUDENT_PROFILES = studentProfileTemplate.sample_profiles;
const STUDENT_PROFILES = filterStudentProfiles(ALL_STUDENT_PROFILES);

const notEligibleDisplay = presentResultCard({
  eligibilityStatus: 'not_eligible',
  interviewBand: 'interview_likely',
  manualReviewRequired: true
});
assert.strictEqual(notEligibleDisplay.recommendation_display_state, 'not_eligible');
assert.strictEqual(notEligibleDisplay.offer_prediction, undefined);

const manualReviewDisplay = presentResultCard({
  eligibilityStatus: 'manual_review',
  interviewBand: 'interview_likely'
});
assert.strictEqual(manualReviewDisplay.recommendation_display_state, 'manual_review');

const insufficientEvidenceDisplay = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'insufficient_evidence'
});
assert.strictEqual(
  insufficientEvidenceDisplay.recommendation_display_state,
  'insufficient_evidence'
);

const historicalGuidanceDisplay = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'realistic'
});
assert.strictEqual(historicalGuidanceDisplay.recommendation_display_state, 'standard');
assert.strictEqual(
  historicalGuidanceDisplay.historical_guidance_caveat,
  'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.'
);
assert.strictEqual(historicalGuidanceDisplay.offer_prediction, undefined);

assert.ok(Array.isArray(ALL_STUDENT_PROFILES), 'Student profile template must expose sample_profiles.');
assert.ok(
  ALL_STUDENT_PROFILES.some((profile) => profile.profile_id === 'strong_standard_applicant'),
  'Student profile template must include strong_standard_applicant.'
);
assert.ok(
  ALL_STUDENT_PROFILES.some((profile) => profile.profile_id === 'risk_applicant'),
  'Student profile template must include risk_applicant.'
);
assert.ok(
  ALL_STUDENT_PROFILES.some((profile) => profile.profile_id === 'test_case_7_aab_ruk'),
  'Student profile template must include test_case_7_aab_ruk.'
);
assert.ok(
  ALL_STUDENT_PROFILES.some((profile) => profile.profile_id === 'test_case_8_aaa_low_english_ruk'),
  'Student profile template must include test_case_8_aaa_low_english_ruk.'
);
assert.ok(
  ALL_STUDENT_PROFILES.some((profile) => profile.profile_id === 'test_case_9_aaa_all_7s_ucat_2200_ruk'),
  'Student profile template must include test_case_9_aaa_all_7s_ucat_2200_ruk.'
);
assert.ok(STUDENT_PROFILES.length > 0, 'At least one student profile must be selected for regression.');

for (const student of STUDENT_PROFILES) {
  assert.ok(student.applicant_identity?.applicant_type, `${getStudentId(student)} must include applicant type.`);
  assert.ok(student.course_target?.ucas_code, `${getStudentId(student)} must include target course code.`);
  assert.ok(student.gcse_profile?.subjects?.english_language, `${getStudentId(student)} must include GCSE English Language grade.`);
  assert.ok(student.gcse_profile?.subjects?.mathematics, `${getStudentId(student)} must include GCSE Mathematics grade.`);
  assert.ok(student.gcse_profile?.subjects?.biology, `${getStudentId(student)} must include GCSE Biology grade.`);
  assert.ok(student.gcse_profile?.subjects?.chemistry, `${getStudentId(student)} must include GCSE Chemistry grade.`);
  assert.ok(student.gcse_profile?.total_gcse_count, `${getStudentId(student)} must include total GCSE count.`);
  assert.ok(Array.isArray(student.gcse_profile?.top_8_gcse_grades), `${getStudentId(student)} must include top 8 GCSE grades.`);
  assert.ok(Array.isArray(student.a_level_profile?.subjects), `${getStudentId(student)} must include A-level subjects.`);
  assert.strictEqual(typeof getUcatTotal(student), 'number', `${getStudentId(student)} must include numeric UCAT total.`);
  assert.strictEqual(typeof getSjtBand(student), 'number', `${getStudentId(student)} must include numeric SJT band.`);
}

function discoverResultCards() {
  const index = readJson(indexPath);
  return index.universities
    .filter(isProductionReady)
    .map((entry) => {
      const relativePath = entry.result_card_example_file || `examples/${entry.id}-result-card.example.json`;
      return path.join(rootDir, relativePath.startsWith('data/') ? relativePath : path.join('data', relativePath));
    })
    .sort();
}

function getProfileId(card) {
  return (
    card.course_identity?.profile_id ||
    card.engine_notes?.generated_from_profile_id ||
    card.profile_id ||
    null
  );
}

function loadUniversityProfile(profileId) {
  if (!profileId) {
    return null;
  }

  const filePath = path.join(universitiesDir, `${profileId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJson(filePath);
}

function loadResearchProfile(profileId) {
  if (!profileId) {
    return null;
  }

  const filePath = path.join(rootDir, 'data', 'research', `${profileId}-research.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJson(filePath);
}

function loadInterviewBandConfig(profileId) {
  if (!profileId) {
    return null;
  }

  const filePath = path.join(interviewBandConfigsDir, `${profileId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJson(filePath);
}

function isCompletedCard(card) {
  const readiness = card.readiness || {};
  const notes = card.engine_notes || {};
  const prediction = card.prediction || {};

  return Boolean(
    readiness.result_card_ready ||
      readiness.eligibility_ready ||
      readiness.interview_prediction_ready ||
      readiness.research_foi_pre_interview_score_ready ||
      notes.result_card_ready ||
      notes.interview_prediction_ready ||
      prediction.available === true ||
      card.eligibility?.status
  );
}

function hasClearStatus(card) {
  const statuses = new Set([
    card.eligibility?.status,
    card.stage_1?.status,
    card.stage_1?.eligibility_result,
    card.prediction?.prediction_status,
    card.prediction?.result_band,
    card.prediction?.prediction_type,
    card.prediction?.available === true ? 'interview_guidance_available' : null,
    card.prediction?.available === false ? 'prediction_blocked' : null,
    card.readiness?.interview_prediction_ready ? 'interview_guidance_available' : null,
    card.readiness?.eligibility_ready ? 'eligible' : null,
    card.engine_notes?.interview_prediction_ready ? 'interview_guidance_available' : null,
    card.engine_notes?.prediction_blocked ? 'prediction_blocked' : null
  ].filter(Boolean));

  return [...statuses].some((status) => {
    return [
      'eligible',
      'not_eligible',
      'interview_guidance_available',
      'eligibility_only',
      'prediction_blocked',
      'formula_ready',
      'unavailable',
      'not_assessed'
    ].some((allowed) => String(status).includes(allowed));
  });
}

function isFormulaEnabled(card) {
  if (isEligibilityOnly(card)) {
    return false;
  }
  if (card.prediction?.internal_calculations_hidden === true) {
    return false;
  }
  if (card.prediction?.result_band === 'insufficient_evidence') {
    return false;
  }
  if (/eligibility_gates?/i.test(String(card.prediction?.prediction_type || ''))) {
    return false;
  }
  return Boolean(
    card.readiness?.official_selection_formula_available ||
      card.readiness?.interview_prediction_ready ||
      card.readiness?.research_foi_pre_interview_score_ready ||
      card.engine_notes?.official_selection_formula_available ||
      card.engine_notes?.interview_prediction_ready ||
      card.prediction?.available === true
  );
}

function isEligibilityOnly(card) {
  return Boolean(
    card.prediction?.prediction_type === 'eligibility_only' ||
      card.prediction?.result_band === 'eligible_to_apply' ||
      card.recommendation_display_state === 'eligibility_only' ||
      card.readiness?.assessment_mode === 'eligibility_only' ||
      card.readiness?.eligibility_only_ready === true ||
      card.prediction?.available === false ||
      card.engine_notes?.prediction_blocked ||
      String(card.result_mode || '').includes('eligibility_only')
  );
}

function getPredictionStatus(card, evaluation = null) {
  if (evaluation && evaluation.student_specific_score_calculated === false && isFormulaEnabled(card)) {
    return 'prediction/ranking not assessed';
  }

  if (isEligibilityOnly(card)) {
    return 'eligibility_only';
  }

  if (card.prediction?.available === false) {
    return 'prediction_blocked';
  }

  if (card.prediction?.available === true && card.readiness?.interview_prediction_ready === true) {
    return 'interview_guidance_available';
  }

  if (isFormulaEnabled(card)) {
    return 'formula_ready';
  }

  return 'prediction_blocked';
}

const INTERVIEW_BANDS = new Set([
  'interview_likely',
  'realistic',
  'ambitious',
  'high_risk',
  'eligible_to_apply',
  'not_eligible',
  'insufficient_evidence'
]);

const STANDARD_READINESS_FIELDS = [
  'eligibility',
  'interview_prediction',
  'historical_guidance',
  'international_prediction',
  'contextual_logic',
  'result_card',
  'regression',
  'research_completeness',
  'manual_review_required'
];

function assertStandardReadinessMetadata(profile, research) {
  const productionReadiness = profile?.engine_notes || {};
  const researchReadiness = research?.readiness || research?.research_readiness_flags || {};

  for (const field of STANDARD_READINESS_FIELDS) {
    assert.notStrictEqual(
      productionReadiness[field],
      undefined,
      `Course engine_notes.${field} must be present.`
    );
    assert.notStrictEqual(
      researchReadiness[field],
      undefined,
      `Research readiness.${field} must be present.`
    );
    assert.strictEqual(
      researchReadiness[field],
      productionReadiness[field],
      `Research readiness.${field} must match the production profile.`
    );
  }
}

function assertCapabilityContract(card, profile) {
  const readiness = card.readiness || {};
  const profileReadiness = profile?.engine_notes || {};

  for (const field of ['eligibility_ready', 'interview_prediction_ready']) {
    assert.strictEqual(typeof readiness[field], 'boolean', `Result card readiness.${field} must be boolean.`);
    assert.strictEqual(typeof profileReadiness[field], 'boolean', `Course engine_notes.${field} must be boolean.`);
    assert.strictEqual(
      readiness[field],
      profileReadiness[field],
      `Result card readiness.${field} must match the course profile.`
    );
  }

  assert.strictEqual(readiness.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(profileReadiness.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(readiness.offer_prediction_ready, undefined);
  assert.strictEqual(profileReadiness.offer_prediction_ready, undefined);

  assert.ok(
    ['high', 'medium', 'low'].includes(readiness.prediction_confidence),
    'Result card readiness.prediction_confidence must be high, medium or low.'
  );
  assert.strictEqual(
    readiness.prediction_confidence,
    profileReadiness.prediction_confidence,
    'Result card prediction confidence must match the course profile.'
  );

  if (readiness.interview_prediction_ready) {
    const hasOfficialPredictionLimitation =
      card.prediction?.official_prediction?.available === false &&
      card.prediction?.applysmart_advisory_guidance?.available === true;
    assert.strictEqual(
      card.prediction?.available === true ||
        card.prediction?.result_band === 'insufficient_evidence' ||
        hasOfficialPredictionLimitation,
      true,
      'Interview-ready card must expose interview guidance or an evidence-limited guidance state.'
    );
    assert.ok(
      INTERVIEW_BANDS.has(card.prediction?.result_band),
      `Interview-ready card must use a canonical result band; received ${card.prediction?.result_band}.`
    );
  }
}

function collectScoreValues(value, pathParts = []) {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'number') {
    const keyPath = pathParts.join('.');
    return /score|points|value|max/i.test(keyPath) ? [{ path: keyPath, value }] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectScoreValues(entry, [...pathParts, String(index)]));
  }

  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => collectScoreValues(entry, [...pathParts, key]));
  }

  return [];
}

function assertFormulaScores(card) {
  const scoreSurfaces = [
    card.prediction?.score,
    card.prediction_summary,
    card.stage_2_selection,
    card.stage_2
  ];
  const values = scoreSurfaces.flatMap((surface, index) => collectScoreValues(surface, [`surface_${index}`]));

  assert.ok(values.length > 0, 'Formula/prediction-ready card must expose at least one numeric score field.');

  for (const entry of values) {
    assert.strictEqual(Number.isFinite(entry.value), true, `Score field ${entry.path} must be finite.`);
  }
}

function hasFiniteScoreFields(card) {
  const scoreSurfaces = [
    card.prediction?.score,
    card.prediction_summary,
    card.stage_2_selection,
    card.stage_2
  ];
  const values = scoreSurfaces.flatMap((surface, index) => collectScoreValues(surface, [`surface_${index}`]));

  return values.length > 0 && values.every((entry) => Number.isFinite(entry.value));
}

function getScoreStatus(card, evaluation) {
  if (evaluation.student_specific_score_calculated === false) {
    return 'not_calculated';
  }

  if (isFormulaEnabled(card)) {
    return hasFiniteScoreFields(card) ? 'calculated' : 'not_calculated';
  }

  if (isEligibilityOnly(card)) {
    return 'not_supported';
  }

  return 'not_supported';
}

function getFailureFlags(evaluation) {
  return {
    ucat_cutoff: evaluation.reasons.includes('ucat_below_minimum_total_score'),
    sjt_band_4: evaluation.reasons.includes('sjt_band_excluded'),
    academics: evaluation.reasons.includes('academic_requirements_not_met'),
    resit: evaluation.reasons.includes('resit_policy'),
    other: evaluation.reasons.some((reason) => {
      return ![
        'no_blocking_gate_triggered',
        'ucat_below_minimum_total_score',
        'sjt_band_excluded',
        'academic_requirements_not_met',
        'resit_policy'
      ].includes(reason);
    })
  };
}

function normaliseEligibilityStatus(evaluation) {
  const status = evaluation.status;

  if (status === 'eligible' && evaluation.scope === 'minimum_requirements_only') {
    return 'eligible_for_minimum_requirements';
  }

  if (status === 'eligible' || status === 'not_eligible') {
    return status;
  }

  return 'unknown/not_applicable';
}

function getStudentId(student) {
  return student.profile_id || student.id;
}

function getStudentLabel(student) {
  return student.label || getStudentId(student);
}

function getUcatTotal(student) {
  return student.admissions_tests?.ucat?.total_score ?? student.ucat_total;
}

function getSjtBand(student) {
  return student.admissions_tests?.ucat?.sjt_band ?? student.sjt_band;
}

function hasResits(student) {
  return Boolean(student.applicant_identity?.resit?.has_resits ?? student.resit);
}

function isContextual(student) {
  const flags = student.applicant_identity?.contextual_flags || {};
  return Boolean(
    student.applicant_identity?.contextual ||
      flags.plus_flag ||
      flags.flag ||
      flags.simd20 ||
      flags.simd40 ||
      flags.care_experienced ||
      flags.refugee ||
      flags.asylum_seeker ||
      flags.ucat_bursary ||
      flags.school_contextual_indicator ||
      flags.free_school_meals ||
      flags.first_generation_higher_education
  );
}

function gradeRank(grade, level) {
  if (grade === null || grade === undefined) {
    return null;
  }

  const normalized = String(grade).trim().toUpperCase();

  if (level === 'a_level') {
    return {
      'A*': 4,
      A: 3,
      B: 2,
      C: 1,
      D: 0
    }[normalized] ?? null;
  }

  if (/^[1-9]$/.test(normalized)) {
    return Number(normalized);
  }

  return {
    'A*': 8,
    A: 7,
    B: 6,
    C: 4,
    D: 3
  }[normalized] ?? null;
}

function gradeMeetsMinimum(actualGrade, minimumGrade, level = 'gcse') {
  const actualRank = gradeRank(actualGrade, level);

  if (actualRank === null || !minimumGrade) {
    return false;
  }

  return String(minimumGrade)
    .split('/')
    .some((candidate) => {
      const requiredRank = gradeRank(candidate, level);
      return requiredRank !== null && actualRank >= requiredRank;
    });
}

function getStudentSubjectGrade(student, subjectId) {
  const subjects = student.gcse_profile?.subjects || {};

  if (Object.prototype.hasOwnProperty.call(subjects, subjectId)) {
    return subjects[subjectId];
  }

  const additionalSubject = (student.gcse_profile?.additional_subjects || []).find((entry) => {
    return entry.subject_id === subjectId;
  });

  return additionalSubject?.grade ?? null;
}

function getALevelSubjects(student) {
  return student.a_level_profile?.subjects || [];
}

function getALevelGradeMap(student) {
  return Object.fromEntries(
    getALevelSubjects(student).map((subject) => {
      return [subject.subject_id, subject.achieved_grade || subject.predicted_grade];
    })
  );
}

function getALevelGrades(student) {
  return Object.values(getALevelGradeMap(student)).filter(Boolean);
}

function gradeProfileMeets(actualGrades, requiredProfile) {
  if (!Array.isArray(requiredProfile) || requiredProfile.length === 0) {
    return {
      passed: true,
      reason: 'no_grade_profile_stored'
    };
  }

  const actualRanks = actualGrades
    .map((grade) => gradeRank(grade, 'a_level'))
    .filter((rank) => rank !== null)
    .sort((a, b) => b - a);
  const requiredRanks = requiredProfile
    .map((grade) => gradeRank(grade, 'a_level'))
    .filter((rank) => rank !== null)
    .sort((a, b) => b - a);

  const passed =
    actualRanks.length >= requiredRanks.length &&
    requiredRanks.every((requiredRank, index) => actualRanks[index] >= requiredRank);

  return {
    passed,
    reason: passed ? 'a_level_grade_profile_met' : 'a_level_grade_profile_not_met',
    actual: actualGrades.join(''),
    required: requiredProfile.join('')
  };
}

function appliesToStandardApplicant(requirement, student) {
  const groups = requirement.applies_to_group_ids || [];

  if (!groups.length) {
    return true;
  }

  const contextualGroups = ['widening_participation', 'contextual', 'plus_flag', 'flag'];
  const isContextualRequirement = groups.some((group) => contextualGroups.includes(group));

  if (isContextualRequirement) {
    return isContextual(student);
  }

  return true;
}

function getStandardALevelRequirement(profile, student) {
  const aLevel = profile.stage_1_eligibility?.post_16?.a_level || {};
  const gradeRequirements = Array.isArray(aLevel.grade_requirements) ? aLevel.grade_requirements : [];

  const selectedRequirement =
    gradeRequirements.find((requirement) => appliesToStandardApplicant(requirement, student)) || null;

  if (selectedRequirement) {
    return {
      requirement_id: selectedRequirement.requirement_id,
      grade_profile: selectedRequirement.grade_profile || [],
      required_subject_ids: selectedRequirement.required_subject_ids || [],
      one_of_subject_groups: selectedRequirement.one_of_subject_groups || [],
      source: 'stage_1_eligibility.post_16.a_level.grade_requirements'
    };
  }

  if (Array.isArray(aLevel.standard_offer)) {
    return {
      requirement_id: 'a_level_standard_offer',
      grade_profile: aLevel.standard_offer,
      required_subject_ids: aLevel.required_subject_ids || aLevel.required_subjects || [],
      one_of_subject_groups: aLevel.one_of_subject_groups || [],
      source: 'stage_1_eligibility.post_16.a_level.standard_offer'
    };
  }

  if (aLevel.standard_offer?.grade_profile) {
    return {
      requirement_id: 'a_level_standard_offer',
      grade_profile: aLevel.standard_offer.grade_profile,
      required_subject_ids: aLevel.required_subject_ids || [],
      one_of_subject_groups: aLevel.one_of_subject_groups || [],
      source: 'stage_1_eligibility.post_16.a_level.standard_offer.grade_profile'
    };
  }

  return null;
}

function evaluateALevelAcademic(profile, student) {
  const requirement = getStandardALevelRequirement(profile, student);

  if (!requirement) {
    return {
      status: 'unknown',
      reasons: ['a_level_requirement_not_modelled'],
      rule_fields: []
    };
  }

  const gradeMap = getALevelGradeMap(student);
  const actualGrades = getALevelGrades(student);
  const gradeCheck = gradeProfileMeets(actualGrades, requirement.grade_profile);
  const reasons = [gradeCheck.reason];
  const ruleFields = [requirement.source];

  const missingRequiredSubjects = requirement.required_subject_ids.filter((subjectId) => {
    return !Object.prototype.hasOwnProperty.call(gradeMap, subjectId);
  });

  if (missingRequiredSubjects.length) {
    reasons.push(`missing_required_a_level_subjects:${missingRequiredSubjects.join(',')}`);
  } else if (requirement.required_subject_ids.length) {
    reasons.push('required_a_level_subjects_met');
  }

  for (const group of requirement.one_of_subject_groups) {
    const matchingSubjects = (group.subject_ids || []).filter((subjectId) => {
      return Object.prototype.hasOwnProperty.call(gradeMap, subjectId);
    });
    const minimumRequired = group.minimum_required || 1;

    if (matchingSubjects.length < minimumRequired) {
      reasons.push(`a_level_subject_group_not_met:${group.group_id}`);
    } else {
      reasons.push(`a_level_subject_group_met:${group.group_id}`);
    }
  }

  const passed =
    gradeCheck.passed &&
    missingRequiredSubjects.length === 0 &&
    !reasons.some((reason) => reason.startsWith('a_level_subject_group_not_met'));

  return {
    status: passed ? 'pass' : 'fail',
    actual: gradeCheck.actual,
    required: gradeCheck.required,
    reasons,
    rule_fields: ruleFields,
    requirement_id: requirement.requirement_id
  };
}

function gcseRequirementApplies(requirement, student) {
  const qualificationLevel = String(requirement.qualification_level || '');

  if (qualificationLevel === 'national_5') {
    return false;
  }

  return appliesToStandardApplicant(requirement, student);
}

function normalizeSubjectId(subject) {
  return String(subject || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function getGcseSubjectIdsFromRequirement(requirement) {
  if (Array.isArray(requirement.subject_ids)) {
    return requirement.subject_ids;
  }

  if (requirement.subject_id) {
    return [requirement.subject_id];
  }

  const subject = String(requirement.subject || '').toLowerCase();

  if (subject.includes('english')) {
    return ['english_language'];
  }

  if (subject.includes('math')) {
    return ['mathematics'];
  }

  if (subject.includes('biology') && subject.includes('chemistry')) {
    return ['biology', 'chemistry'];
  }

  return [];
}

function evaluateOtherGcseMinimum(profile, student, requirement) {
  const minimumCount = profile.stage_1_eligibility?.gcse?.minimum_count;
  const topGrades = student.gcse_profile?.top_8_gcse_grades || [];

  if (!minimumCount || !requirement.minimum_grade) {
    return {
      passed: true,
      reason: 'other_gcse_minimum_not_quantified'
    };
  }

  const relevantGrades = topGrades.slice(0, minimumCount);
  const passed =
    relevantGrades.length >= minimumCount &&
    relevantGrades.every((grade) => gradeMeetsMinimum(grade, requirement.minimum_grade, 'gcse'));

  return {
    passed,
    reason: passed
      ? `gcse_requirement_met:top_${minimumCount}_gcse_grades>=${requirement.minimum_grade}`
      : `gcse_requirement_not_met:top_${minimumCount}_gcse_grades>=${requirement.minimum_grade}`
  };
}

function evaluateGcseAcademic(profile, student) {
  const requirements = profile.stage_1_eligibility?.gcse?.grade_requirements || [];
  const applicableRequirements = requirements.filter((requirement) => gcseRequirementApplies(requirement, student));
  const reasons = [];
  const failed = [];

  for (const requirement of applicableRequirements) {
    const subjectIds = getGcseSubjectIdsFromRequirement(requirement);

    if (!subjectIds.length && /other gcse/i.test(String(requirement.subject || ''))) {
      const otherGcseCheck = evaluateOtherGcseMinimum(profile, student, requirement);
      reasons.push(otherGcseCheck.reason);

      if (!otherGcseCheck.passed) {
        failed.push(requirement.requirement_id || 'other_gcse_minimum');
      }

      continue;
    }

    for (const subjectId of subjectIds) {
      const actualGrade = getStudentSubjectGrade(student, normalizeSubjectId(subjectId));
      const passed = gradeMeetsMinimum(actualGrade, requirement.minimum_grade, 'gcse');
      const label = `${subjectId}:${actualGrade ?? 'missing'}>=${requirement.minimum_grade}`;

      if (passed) {
        reasons.push(`gcse_requirement_met:${label}`);
      } else {
        reasons.push(`gcse_requirement_not_met:${label}`);
        failed.push(requirement.requirement_id || subjectId);
      }
    }
  }

  return {
    status: failed.length ? 'fail' : 'pass',
    reasons: reasons.length ? reasons : ['no_gcse_grade_requirements_modelled'],
    failed_requirement_ids: failed,
    rule_fields: ['stage_1_eligibility.gcse.grade_requirements']
  };
}

function evaluateAcademicRequirements(profile, student) {
  const gcse = evaluateGcseAcademic(profile, student);
  const aLevel = evaluateALevelAcademic(profile, student);
  const failed = gcse.status === 'fail' || aLevel.status === 'fail';
  const unknown = gcse.status === 'unknown' || aLevel.status === 'unknown';

  return {
    status: failed ? 'fail' : unknown ? 'unknown' : 'pass',
    gcse,
    a_level: aLevel,
    reasons: [...gcse.reasons, ...aLevel.reasons],
    rule_fields: [...gcse.rule_fields, ...aLevel.rule_fields]
  };
}

function getNationalUcatDecile(totalScore) {
  const result = resolveUcatDecile(totalScore, { decileData: ucatDeciles });
  return result.available ? result.national_decile : null;
}

function getFurtherEducationPoint(student) {
  return student.selection_evidence?.further_education_point === true ? 1 : 0;
}

function calculateGcseUcatAdditionalPointsFormula(capability, student, stage1Status) {
  const calculation = capability.calculation;

  if (!calculation?.gcse_points || !calculation?.ucat_decile_points) {
    return {
      status: 'not_supported',
      evidence_classification: capability.evidence_classification,
      capability_classification: capability.classification,
      reasons: ['gcse_ucat_additional_points_formula_fields_not_available']
    };
  }

  const pointRows = calculation.gcse_points.points || [];
  const topGrades = student.gcse_profile?.top_8_gcse_grades || [];
  const gcseScore = topGrades.slice(0, calculation.gcse_points.scored_subject_count || 8).reduce((total, grade) => {
    const row = pointRows.find((entry) => (entry.grades || []).includes(String(grade)));
    return total + (row?.points || 0);
  }, 0);
  const nationalDecile = getNationalUcatDecile(getUcatTotal(student));
  const ucatRow = (calculation.ucat_decile_points.points || []).find((entry) => {
    return (entry.deciles || []).includes(nationalDecile);
  });
  const ucatScore = ucatRow?.points ?? null;
  const furtherEducationPoint = getFurtherEducationPoint(student);

  return {
    status: stage1Status === 'eligible' ? 'calculated' : 'not_applied_stage_1_not_eligible',
    formula: calculation.total_score?.formula,
    score: ucatScore === null ? null : gcseScore + ucatScore + furtherEducationPoint,
    max: calculation.total_score?.scale?.max ?? 28,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    official: ['official', 'official_source_verified', 'official_formula', 'foi_verified', 'foi_formula'].includes(capability.classification),
    components: {
      gcse_score: {
        value: gcseScore,
        max: calculation.gcse_points.score_max,
        rule_field: 'stage_2_interview_selection.calculation.gcse_points'
      },
      ucat_decile_score: {
        value: ucatScore,
        national_decile: nationalDecile,
        max: calculation.ucat_decile_points.max_points,
        rule_field: 'stage_2_interview_selection.calculation.ucat_decile_points'
      },
      further_education_point: {
        value: furtherEducationPoint,
        max: calculation.additional_points?.max_points ?? 1,
        rule_field: 'stage_2_interview_selection.calculation.additional_points'
      }
    },
    reasons:
      stage1Status === 'eligible'
        ? ['gcse_ucat_additional_points_formula_calculated']
        : ['gcse_ucat_additional_points_formula_supported_but_not_applied_because_stage_1_failed']
  };
}

function getGradeCountAtOrAbove(grades, minimumGrade) {
  return grades.filter((grade) => {
    const rank = gradeRank(grade, 'gcse');
    return rank !== null && rank >= minimumGrade;
  }).length;
}

function calculateWeightedDecileAcademicScore(profile, model, student) {

  if (!model) {
    return {
      value: null,
      max: null,
      reasons: ['weighted_decile_academic_scoring_model_not_found']
    };
  }

  const gcseEvaluation = evaluateGcseAcademic(profile, student);
  const aLevelEvaluation = evaluateALevelAcademic(profile, student);
  const topGrades = student.gcse_profile?.top_8_gcse_grades || [];
  const grade8Or9Count = getGradeCountAtOrAbove(topGrades, 8);
  const grade7OrAboveCount = getGradeCountAtOrAbove(topGrades, 7);
  const biologyGrade = getStudentSubjectGrade(student, 'biology');
  const chemistryGrade = getStudentSubjectGrade(student, 'chemistry');
  const scienceGrade7OrAbove =
    gradeMeetsMinimum(biologyGrade, '7', 'gcse') && gradeMeetsMinimum(chemistryGrade, '7', 'gcse');
  const scienceGrade8OrAbove =
    gradeMeetsMinimum(biologyGrade, '8', 'gcse') && gradeMeetsMinimum(chemistryGrade, '8', 'gcse');

  let gcsePoints = 0;
  const gcseReasons = [];

  if (gcseEvaluation.status === 'fail') {
    gcseReasons.push('weighted_decile_predictor_gcse_points_0_fails_minimum_gcse_prerequisites');
  } else if (grade8Or9Count >= 8 && scienceGrade8OrAbove) {
    gcsePoints = 30;
    gcseReasons.push('weighted_decile_predictor_gcse_points_30_8_or_more_gcse_8_9_with_strong_biology_chemistry');
  } else if (grade8Or9Count >= 6 && scienceGrade7OrAbove) {
    gcsePoints = 24;
    gcseReasons.push('weighted_decile_predictor_gcse_points_24_6_to_7_gcse_8_9_science_7_plus');
  } else if (grade7OrAboveCount >= 5) {
    gcsePoints = 18;
    gcseReasons.push('weighted_decile_predictor_gcse_points_18_around_5_gcse_7_plus');
  } else {
    gcsePoints = 12;
    gcseReasons.push('weighted_decile_predictor_gcse_points_12_meets_minimum_lacks_top_tier_profile');
  }

  const aLevelPoints = aLevelEvaluation.status === 'pass' ? 30 : 0;
  const aLevelReason =
    aLevelEvaluation.status === 'pass'
      ? 'weighted_decile_predictor_a_level_points_30_aaa_correct_subjects'
      : 'weighted_decile_predictor_a_level_points_0_below_standard_offer';

  return {
    value: gcsePoints + aLevelPoints,
    max: model.max_points,
    components: {
      gcse_or_national_5_points: {
        value: gcsePoints,
        max: model.gcse_or_national_5_points_max,
        rule_field: 'research.predictor_model.academic_scoring_model_standard_entry.ruk_gcse_scoring'
      },
      a_level_or_higher_points: {
        value: aLevelPoints,
        max: model.a_level_or_higher_points_max,
        rule_field: 'research.predictor_model.academic_scoring_model_standard_entry.ruk_a_level_scoring'
      }
    },
    reasons: [...gcseReasons, aLevelReason]
  };
}

function calculateWeightedDecileResearchModel(capability, profile, student, stage1Status) {
  const predictor = capability.model;

  if (!predictor?.pre_interview_formula?.standard_entry || !predictor?.ucat_scoring?.standard_entry_decile_points) {
    return {
      status: stage1Status === 'eligible' ? 'not_supported' : 'not_applied_stage_1_not_eligible',
      evidence_classification: capability.evidence_classification,
      capability_classification: capability.classification,
      reasons: ['weighted_decile_research_predictor_model_not_available']
    };
  }

  const academic = calculateWeightedDecileAcademicScore(
    profile,
    predictor.academic_scoring_model_standard_entry,
    student
  );
  const nationalDecile = getNationalUcatDecile(getUcatTotal(student));
  const ucatPoints = predictor.ucat_scoring.standard_entry_decile_points[String(nationalDecile)] ?? null;
  const score = academic.value === null || ucatPoints === null ? null : academic.value + ucatPoints;

  return {
    status: stage1Status === 'eligible' && score !== null ? 'calculated' : 'not_applied_stage_1_not_eligible',
    formula: predictor.pre_interview_formula.standard_entry.formula,
    score: stage1Status === 'eligible' ? score : score,
    max: predictor.pre_interview_formula.standard_entry.maximum_score,
    evidence_classification: predictor.source_status,
    capability_classification: capability.classification,
    official: predictor.official_university_published === true,
    components: {
      academic_score: {
        value: academic.value,
        max: academic.max,
        rule_field: 'research.predictor_model.academic_scoring_model_standard_entry'
      },
      ucat_decile_score: {
        value: ucatPoints,
        max: predictor.weighting?.standard_entry?.ucat_weight_pct ?? 40,
        national_decile: nationalDecile,
        rule_field: 'research.predictor_model.ucat_scoring.standard_entry_decile_points'
      }
    },
    reasons:
      stage1Status === 'eligible'
        ? ['weighted_decile_research_derived_pre_interview_score_calculated', ...academic.reasons]
        : ['weighted_decile_research_formula_supported_but_not_applied_because_stage_1_failed', ...academic.reasons]
  };
}

function getPointsForGrade(gradePoints, grade, level = 'a_level') {
  const normalizedGrade = String(grade || '').toUpperCase();
  const exact = (gradePoints || []).find((entry) => String(entry.grade).toUpperCase() === normalizedGrade);

  if (exact) {
    return exact.points;
  }

  const belowRow = (gradePoints || []).find((entry) => String(entry.grade).toLowerCase().startsWith('below_'));

  return belowRow?.points ?? 0;
}

function calculateScaledAcademicScoreFromALevelRoute(route, student) {
  if (!route?.grade_points || !route.raw_max) {
    return {
      value: null,
      raw_value: null,
      max: null,
      reasons: ['scaled_academic_a_level_route_not_available']
    };
  }

  const grades = getALevelGrades(student)
    .sort((a, b) => gradeRank(b, 'a_level') - gradeRank(a, 'a_level'))
    .slice(0, 3);

  if (grades.length < 3) {
    return {
      value: null,
      raw_value: null,
      max: 30,
      reasons: ['scaled_academic_a_level_requires_three_grades']
    };
  }

  const rawAcademicPoints = grades.reduce((total, grade) => {
    return total + getPointsForGrade(route.grade_points, grade, 'a_level');
  }, 0);

  return {
    value: Number(((rawAcademicPoints / route.raw_max) * 30).toFixed(2)),
    raw_value: rawAcademicPoints,
    raw_max: route.raw_max,
    max: 30,
    grades,
    reasons: ['scaled_academic_a_level_score_calculated']
  };
}

function calculateScaledAcademicUcatResearchModel(capability, profile, student, stage1Status) {
  const model = capability.model;
  const aLevelRoute = model?.academic?.routes?.a_level_standard_entry;
  const academic = calculateScaledAcademicScoreFromALevelRoute(aLevelRoute, student);
  const nationalDecile = getNationalUcatDecile(getUcatTotal(student));
  const ucatRow = (model?.ucat?.mapping_table || []).find((entry) => entry.decile === nationalDecile);
  const rawUcatPoints = ucatRow?.raw_ucat_points ?? null;
  const ucatMax = model?.ucat?.raw_max ?? null;
  const ucatScore =
    Number.isFinite(rawUcatPoints) && Number.isFinite(ucatMax)
      ? Number(((rawUcatPoints / ucatMax) * 20).toFixed(2))
      : null;
  const score =
    Number.isFinite(academic.value) && Number.isFinite(ucatScore)
      ? Number((academic.value + ucatScore).toFixed(2))
      : null;
  const canCalculate = stage1Status === 'eligible' && Number.isFinite(score);

  return {
    status:
      stage1Status !== 'eligible'
        ? 'not_applied_stage_1_not_eligible'
        : canCalculate
          ? 'calculated'
          : 'blocked_missing_required_components',
    formula: model?.pre_interview?.formula,
    score: stage1Status === 'eligible' ? score : score,
    max: model?.pre_interview?.score_scale?.max ?? 50,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    official: model?.official_or_foi_verified === true,
    components: {
      academic_score: {
        value: academic.value,
        raw_value: academic.raw_value,
        raw_max: academic.raw_max,
        max: academic.max,
        grades: academic.grades,
        rule_field: 'research.research_calculation_model.academic.routes.a_level_standard_entry'
      },
      ucat_decile_score: {
        value: ucatScore,
        raw_value: rawUcatPoints,
        raw_max: ucatMax,
        max: 20,
        national_decile: nationalDecile,
        rule_field: 'research.research_calculation_model.ucat.mapping_table'
      }
    },
    reasons:
      stage1Status === 'eligible' && canCalculate
        ? ['scaled_academic_ucat_research_pre_interview_score_calculated', ...academic.reasons]
        : stage1Status !== 'eligible'
          ? ['scaled_academic_ucat_research_formula_supported_but_not_applied_because_stage_1_failed', ...academic.reasons]
          : ['scaled_academic_ucat_research_formula_supported_but_missing_required_inputs', ...academic.reasons]
  };
}

function calculateSuppliedComponentFormula(capability, student, stage1Status) {
  const calculation = capability.calculation;

  if (!calculation?.total_score) {
    return {
      status: 'not_supported',
      evidence_classification: capability.evidence_classification,
      capability_classification: capability.classification,
      reasons: ['supplied_component_formula_fields_not_available']
    };
  }

  const sjtBand = String(getSjtBand(student));
  const sjtScore = calculation.sjt_points?.points_by_band?.[sjtBand] ?? null;
  const suppliedAcademicScore =
    student.selection_evidence?.academic_component_score ??
    student.selection_inputs?.academic_component_score ??
    null;
  const suppliedFeeCohortDecile =
    student.selection_evidence?.fee_cohort_ucat_decile ??
    student.selection_inputs?.fee_cohort_ucat_decile ??
    null;
  const ucatPointsRow = (calculation.ucat_decile_points?.points || []).find((entry) => {
    return entry.decile === suppliedFeeCohortDecile;
  });
  const ucatDecileScore = ucatPointsRow?.points ?? null;
  const canCalculate =
    stage1Status === 'eligible' &&
    Number.isFinite(suppliedAcademicScore) &&
    Number.isFinite(ucatDecileScore) &&
    Number.isFinite(sjtScore);

  return {
    status:
      stage1Status !== 'eligible'
        ? 'not_applied_stage_1_not_eligible'
        : canCalculate
          ? 'calculated'
          : 'blocked_missing_required_components',
    formula: calculation.total_score.formula,
    score: canCalculate ? suppliedAcademicScore + ucatDecileScore + sjtScore : null,
    max: calculation.total_score.scale?.max,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    blocking_classification:
      stage1Status === 'eligible' && !canCalculate
        ? !Number.isFinite(suppliedFeeCohortDecile)
          ? 'current_cycle_data_missing'
          : !Number.isFinite(suppliedAcademicScore) || !Number.isFinite(sjtScore)
            ? 'student_input_missing'
            : null
        : null,
    official: ['official', 'official_source_verified', 'official_formula', 'foi_verified', 'foi_formula'].includes(capability.classification),
    components: {
      academic_score: {
        value: suppliedAcademicScore,
        max: calculation.academic_score?.max_points,
        rule_field: 'stage_2_interview_selection.calculation.academic_score',
        reason: suppliedAcademicScore === null ? 'academic_component_score_not_supplied' : null
      },
      ucat_decile_score: {
        value: ucatDecileScore,
        max: calculation.ucat_decile_points?.max_points,
        rule_field: 'stage_2_interview_selection.calculation.ucat_decile_points',
        reason: suppliedFeeCohortDecile === null ? 'fee_cohort_ucat_decile_not_supplied' : null
      },
      sjt_score: {
        value: sjtScore,
        max: calculation.sjt_points?.max_points,
        rule_field: 'stage_2_interview_selection.calculation.sjt_points'
      }
    },
    reasons:
      stage1Status !== 'eligible'
        ? ['supplied_component_formula_supported_but_not_applied_because_stage_1_failed']
        : canCalculate
          ? ['supplied_component_formula_calculated']
          : ['supplied_component_formula_supported_but_missing_required_inputs']
  };
}

function calculateOfficialALevelAcademicMatrix(calculation, student) {
  const route = calculation.academic_score?.routes?.a_level;

  if (!route) {
    return {
      value: null,
      max: calculation.academic_score?.max_points ?? null,
      reasons: ['official_a_level_academic_matrix_not_available']
    };
  }

  const topGrades = student.gcse_profile?.top_8_gcse_grades || [];
  const grade8Or9Count = getGradeCountAtOrAbove(topGrades, 8);
  const allGrade8Or9 = topGrades.length >= 8 && topGrades.slice(0, 8).every((grade) => gradeMeetsMinimum(grade, '8', 'gcse'));
  const allGrade7OrAbove = topGrades.length >= 8 && topGrades.slice(0, 8).every((grade) => gradeMeetsMinimum(grade, '7', 'gcse'));
  const biologyGrade = getStudentSubjectGrade(student, 'biology');
  const chemistryGrade = getStudentSubjectGrade(student, 'chemistry');
  const scienceGrade6 =
    gradeMeetsMinimum(biologyGrade, '6', 'gcse') || gradeMeetsMinimum(chemistryGrade, '6', 'gcse');
  const subjectGrades = {
    english_language: getStudentSubjectGrade(student, 'english_language'),
    mathematics: getStudentSubjectGrade(student, 'mathematics'),
    biology: biologyGrade,
    chemistry: chemistryGrade
  };
  const nonScienceGrade6 = Object.entries(subjectGrades).some(([subjectId, grade]) => {
    return !['biology', 'chemistry'].includes(subjectId) && gradeMeetsMinimum(grade, '6', 'gcse');
  });

  let gcsePoints = 0;
  let gcseReason = 'official_gcse_matrix_no_scoring_band_matched';

  if (allGrade8Or9) {
    gcsePoints = 12;
    gcseReason = 'official_gcse_matrix_all_eight_grades_8_9';
  } else if (allGrade7OrAbove && grade8Or9Count >= 5) {
    gcsePoints = 10;
    gcseReason = 'official_gcse_matrix_all_7_plus_five_to_seven_8_9';
  } else if (allGrade7OrAbove) {
    gcsePoints = 8;
    gcseReason = 'official_gcse_matrix_all_7_plus_up_to_four_8_9';
  } else if (nonScienceGrade6) {
    gcsePoints = 4;
    gcseReason = 'official_gcse_matrix_grade_6_non_science_subject';
  } else if (scienceGrade6) {
    gcsePoints = 2;
    gcseReason = 'official_gcse_matrix_grade_6_biology_or_chemistry';
  }

  const gradeMap = getALevelGradeMap(student);
  const grades = getALevelGrades(student);
  const gradeCheck = gradeProfileMeets(grades, ['A', 'A', 'A']);
  const chemistryGradeALevel = gradeMap.chemistry;
  const astarCount = Object.values(gradeMap).filter((grade) => String(grade).toUpperCase() === 'A*').length;
  const chemistryAstar = String(chemistryGradeALevel || '').toUpperCase() === 'A*';
  let aLevelPoints = 0;
  let aLevelReason = 'official_a_level_matrix_below_aaa';

  if (gradeCheck.passed) {
    if (astarCount >= 2) {
      aLevelPoints = chemistryAstar ? 8 : 6;
      aLevelReason = chemistryAstar
        ? 'official_a_level_matrix_astar_astar_a_chemistry_astar'
        : 'official_a_level_matrix_astar_astar_a_no_chemistry_astar';
    } else if (astarCount === 1) {
      aLevelPoints = chemistryAstar ? 5 : 3;
      aLevelReason = chemistryAstar
        ? 'official_a_level_matrix_astar_aa_chemistry_astar'
        : 'official_a_level_matrix_astar_aa_not_chemistry';
    } else {
      aLevelPoints = 2;
      aLevelReason = 'official_a_level_matrix_aaa';
    }
  }

  const unboundedValue = gcsePoints + aLevelPoints;

  return {
    value: Math.min(unboundedValue, route.max_points),
    max: route.max_points,
    hard_cap_applied: unboundedValue > route.max_points,
    components: {
      gcse_component: {
        value: gcsePoints,
        max: route.gcse_component_max,
        rule_field: 'stage_2_interview_selection.calculation.academic_score.routes.a_level.gcse_component'
      },
      a_level_component: {
        value: aLevelPoints,
        max: route.a_level_component_max,
        rule_field: 'stage_2_interview_selection.calculation.academic_score.routes.a_level.a_level_component'
      }
    },
    reasons: [gcseReason, aLevelReason]
  };
}

function calculateOfficialPreAssessmentMatrixFormula(capability, profile, student, stage1Status) {
  const calculation = capability.calculation;
  const academic = calculateOfficialALevelAcademicMatrix(calculation, student);
  const suppliedFeeCohortDecile =
    student.selection_evidence?.fee_cohort_ucat_decile ??
    student.selection_inputs?.fee_cohort_ucat_decile ??
    null;
  const historicalDecile =
    suppliedFeeCohortDecile === null
      ? deriveUniversityHistoricalDecile(profile.profile_id, getUcatTotal(student), ucatDeciles)
      : null;
  const selectedDecile = suppliedFeeCohortDecile ?? historicalDecile?.decile ?? null;
  const ucatPointsRow = (calculation.ucat_decile_points?.points || []).find((entry) => {
    return entry.decile === selectedDecile;
  });
  const ucatDecileScore = ucatPointsRow?.points ?? null;
  const sjtBand = String(getSjtBand(student));
  const sjtScore = calculation.sjt_points?.points_by_band?.[sjtBand] ?? null;
  const canCalculate =
    stage1Status === 'eligible' &&
    Number.isFinite(academic.value) &&
    Number.isFinite(ucatDecileScore) &&
    Number.isFinite(sjtScore);
  const score = canCalculate ? Number((academic.value + ucatDecileScore + sjtScore).toFixed(2)) : null;

  return {
    status:
      stage1Status !== 'eligible'
        ? 'not_applied_stage_1_not_eligible'
        : canCalculate
          ? 'calculated'
          : 'blocked_missing_required_components',
    formula: calculation.total_score.formula,
    score,
    max: calculation.total_score.scale?.max,
    evidence_classification: historicalDecile?.available ? 'historical_decile_estimate' : capability.evidence_classification,
    capability_classification: capability.classification,
    official: true,
    components: {
      academic_score: {
        value: academic.value,
        max: academic.max,
        components: academic.components,
        rule_field: 'stage_2_interview_selection.calculation.academic_score',
        reason: academic.value === null ? 'academic_score_not_calculated' : null
      },
      ucat_decile_score: {
        value: ucatDecileScore,
        max: calculation.ucat_decile_points?.max_points,
        decile: selectedDecile,
        historical_estimate: Boolean(historicalDecile?.available),
        decile_band: historicalDecile?.decile_band ?? null,
        rule_field: 'stage_2_interview_selection.calculation.ucat_decile_points',
        reason: selectedDecile === null ? 'fee_cohort_ucat_decile_not_available' : null
      },
      sjt_score: {
        value: sjtScore,
        max: calculation.sjt_points?.max_points,
        rule_field: 'stage_2_interview_selection.calculation.sjt_points'
      }
    },
    reasons:
      stage1Status !== 'eligible'
        ? ['official_pre_assessment_formula_supported_but_not_applied_because_stage_1_failed', ...academic.reasons]
        : canCalculate
          ? [
              'official_pre_assessment_formula_calculated',
              ...(historicalDecile?.available ? ['ucat_decile_historical_estimate_used_not_current_live_pool'] : []),
              ...academic.reasons
            ]
          : ['official_pre_assessment_formula_supported_but_missing_required_inputs', ...academic.reasons]
  };
}

function inferEvidenceClassification(value, fallback = 'blocked_missing_formula') {
  const text = JSON.stringify(value || {}).toLowerCase();

  if (/research_derived|research-derived|mixed_foi_derived|research_team_model|mixed_research_team_model/.test(text)) {
    return 'research_derived_model';
  }

  if (/predictor_estimate|estimated_model|estimate/.test(text)) {
    return 'estimated_model';
  }

  if (/foi/.test(text)) {
    return 'foi_formula';
  }

  if (
    /official/.test(text) &&
    !/official_formula_prediction_ready"?\s*:\s*false/.test(text) &&
    !/official_university_published"?\s*:\s*false/.test(text) &&
    !/official_university_formula"?\s*:\s*false/.test(text)
  ) {
    return 'official_formula';
  }

  if (/historical|statistics/.test(text)) {
    return 'estimated_model';
  }

  return fallback;
}

function getCapabilityPriority(classification) {
  return {
    official: 1,
    official_source_verified: 1,
    official_formula: 1,
    foi_verified: 2,
    foi_formula: 2,
    official_historical_guidance: 3,
    research_derived_model: 4,
    estimated_model: 5,
    configured_interview_guidance: 6,
    eligibility_only: 6,
    evaluator_mapping_missing: 7,
    current_cycle_data_missing: 8,
    student_input_missing: 9,
    blocked_missing_formula: 10
  }[classification] ?? 99;
}

function isNonCalculableUcatRankingCalculation(profile, calculation) {
  const stage2 = profile?.stage_2_interview_selection || profile?.stage_2_selection || {};
  const ucat = profile?.stage_1_eligibility?.admissions_tests?.ucat || {};
  const primaryModel = String(stage2.primary_model || stage2.selection_model || '').toLowerCase();
  const totalMethod = String(calculation?.total_score?.calculation_method || '').toLowerCase();
  const componentMethods = (calculation?.score_components || []).map((component) => {
    return String(component.calculation_method || '').toLowerCase();
  });
  const rankingMethodStored =
    primaryModel === 'ucat_ranking' ||
    /ucat.*ranking|ranking.*ucat/.test(primaryModel) ||
    /ucat.*ranking|ranking.*ucat|rank_by_ucat/.test(totalMethod) ||
    componentMethods.some((method) => /rank_by_ucat|ucat.*ranking|ranking.*ucat/.test(method));
  const scoreScaleMax = calculation?.total_score?.scale?.max ?? null;
  const hasNoPointsFormula = scoreScaleMax === null && !calculation?.total_score?.formula;
  const thresholds = Array.isArray(stage2.thresholds) ? stage2.thresholds : [];
  const currentThresholdUnavailable = thresholds.some((threshold) => {
    return (
      threshold?.metric === 'ucat_total_score' &&
      threshold?.value === null &&
      /unknown|unavailable/.test(String(threshold.operator || threshold.status || threshold.threshold_id || '').toLowerCase())
    );
  });
  const interviewPredictionReady =
    profile?.engine_notes?.interview_prediction_ready ??
    profile?.readiness?.interview_prediction_ready ??
    profile?.profile_status?.interview_prediction_ready ??
    null;

  return (
    rankingMethodStored &&
    ucat.required === true &&
    typeof ucat.minimum_total_score !== 'number' &&
    hasNoPointsFormula &&
    currentThresholdUnavailable &&
    interviewPredictionReady === false
  );
}

function isHistoricalGuidanceUcatRankingCalculation(profile, calculation) {
  const stage2 = profile?.stage_2_interview_selection || {};
  const primaryModel = String(stage2.primary_model || '').toLowerCase();
  const methods = [
    calculation?.total_score?.calculation_method,
    ...(calculation?.score_components || []).map((component) => component.calculation_method)
  ].map((method) => String(method || '').toLowerCase());
  const hasUcatRanking =
    primaryModel === 'ucat_ranking' ||
    methods.some((method) => /ucat.*rank|rank.*ucat/.test(method));
  const hasHistoricalEvidence = Boolean(
    profile?.historical_admissions?.cycles?.length ||
    profile?.historical_admissions?.current_cycle_guidance
  );

  return Boolean(
    profile?.engine_notes?.interview_prediction_ready &&
    hasUcatRanking &&
    hasHistoricalEvidence
  );
}

function discoverCourseCalculationCapability(profile) {
  const calculation = profile?.stage_2_interview_selection?.calculation || profile?.stage_2_selection?.calculation;

  if (!calculation || calculation.verification_status === 'unverified') {
    return null;
  }

  const classification = calculation.evidence_classification || inferEvidenceClassification(calculation, 'official_formula');

  if (isHistoricalGuidanceUcatRankingCalculation(profile, calculation)) {
    return {
      adapter: 'ucat_ranking_historical_guidance',
      source_layer: 'course_profile',
      source_path: 'stage_2_interview_selection.calculation',
      classification: 'official_historical_guidance',
      evidence_classification: calculation.evidence_classification || calculation.verification_status || classification,
      calculation
    };
  }

  if (isNonCalculableUcatRankingCalculation(profile, calculation)) {
    return {
      adapter: 'ucat_ranking_threshold_unavailable',
      source_layer: 'course_profile',
      source_path: 'stage_2_interview_selection.calculation',
      classification: 'current_cycle_data_missing',
      evidence_classification: calculation.evidence_classification || calculation.verification_status || classification,
      calculation
    };
  }

  if (
    calculation.total_score &&
    calculation.academic_score?.routes &&
    calculation.ucat_decile_points &&
    calculation.sjt_points
  ) {
    return {
      adapter: 'official_pre_assessment_matrix_formula',
      source_layer: 'course_profile',
      source_path: 'stage_2_interview_selection.calculation',
      classification,
      evidence_classification: calculation.evidence_classification || calculation.verification_status || classification,
      calculation
    };
  }

  if (calculation.gcse_points && calculation.ucat_decile_points && calculation.total_score) {
    return {
      adapter: 'gcse_ucat_additional_points',
      source_layer: 'course_profile',
      source_path: 'stage_2_interview_selection.calculation',
      classification,
      evidence_classification: calculation.evidence_classification || calculation.verification_status || classification,
      calculation
    };
  }

  if (
    calculation.total_score &&
    calculation.academic_score &&
    calculation.ucat_decile_points &&
    calculation.sjt_points
  ) {
    return {
      adapter: 'supplied_component_formula',
      source_layer: 'course_profile',
      source_path: 'stage_2_interview_selection.calculation',
      classification,
      evidence_classification: calculation.evidence_classification || calculation.verification_status || classification,
      calculation
    };
  }

  return {
    adapter: 'unsupported_course_formula_shape',
    source_layer: 'course_profile',
    source_path: 'stage_2_interview_selection.calculation',
    classification: 'evaluator_mapping_missing',
    evidence_classification: calculation.evidence_classification || calculation.verification_status || 'unknown',
    calculation
  };
}

function discoverResearchPredictorCapability(research) {
  const predictor = research?.predictor_model;

  if (!predictor) {
    return null;
  }

  const hasWeightedDecileShape =
    predictor.pre_interview_formula?.standard_entry &&
    predictor.ucat_scoring?.standard_entry_decile_points &&
    predictor.academic_scoring_model_standard_entry;

  const classification = inferEvidenceClassification(predictor, 'research_derived_model');

  return {
    adapter: hasWeightedDecileShape ? 'weighted_decile_predictor_model' : 'unsupported_research_model_shape',
    source_layer: 'research_profile',
    source_path: 'predictor_model',
    classification,
    evidence_classification: predictor.source_status || predictor.evidence_level || classification,
    model: predictor
  };
}

function discoverResearchCalculationModelCapability(research) {
  const model = research?.research_calculation_model;

  if (!model) {
    return null;
  }

  const hasScaledAcademicUcatShape =
    model.pre_interview?.formula &&
    model.academic?.routes &&
    model.ucat?.mapping_table &&
    model.ucat?.raw_max;
  const classification = inferEvidenceClassification(model, 'research_derived_model');

  return {
    adapter: hasScaledAcademicUcatShape ? 'scaled_academic_ucat_research_model' : 'unsupported_research_model_shape',
    source_layer: 'research_profile',
    source_path: 'research_calculation_model',
    classification,
    evidence_classification: model.source_status || model.pre_interview?.verification_status || classification,
    model
  };
}

function discoverResearchFoiCapability(research) {
  const foi = research?.foi_formula_evidence;

  if (!foi) {
    return null;
  }

  return {
    adapter: 'research_foi_formula_metadata',
    source_layer: 'research_profile',
    source_path: 'foi_formula_evidence',
    classification: 'foi_formula',
    evidence_classification: 'foi_formula',
    model: foi
  };
}

function discoverResultCardCapability(card) {
  if (!card?.prediction || card.prediction.score === null || card.prediction.score === undefined) {
    return null;
  }

  return {
    adapter: 'result_card_display_metadata',
    source_layer: 'result_card_example',
    source_path: 'prediction',
    classification: 'evaluator_mapping_missing',
    evidence_classification: card.prediction.prediction_type || 'result_card_display_metadata',
    model: card.prediction
  };
}

function discoverInterviewBandConfigCapability(config) {
  if (!config?.score_model || !Array.isArray(config.guidance_pools)) {
    return null;
  }

  return {
    adapter: 'generic_interview_band_config',
    source_layer: 'interview_band_config',
    source_path: `data/interview-band-configs/${config.course_profile_id}.json`,
    classification: 'configured_interview_guidance',
    evidence_classification: config.evidence?.classification || 'configured_interview_guidance',
    model: config
  };
}

function discoverEvidenceCapabilities(profile, research, card, interviewBandConfig) {
  return [
    discoverCourseCalculationCapability(profile),
    discoverResearchPredictorCapability(research),
    discoverResearchCalculationModelCapability(research),
    discoverResearchFoiCapability(research),
    discoverInterviewBandConfigCapability(interviewBandConfig),
    discoverResultCardCapability(card)
  ]
    .filter(Boolean)
    .sort((a, b) => {
      if (
        a.adapter === 'generic_interview_band_config' &&
        b.adapter === 'ucat_ranking_historical_guidance'
      ) {
        return -1;
      }

      if (
        a.adapter === 'ucat_ranking_historical_guidance' &&
        b.adapter === 'generic_interview_band_config'
      ) {
        return 1;
      }

      return getCapabilityPriority(a.classification) - getCapabilityPriority(b.classification);
    });
}

function unsupportedCapabilityResult(capability, stage1Status) {
  return {
    status: stage1Status === 'eligible' ? 'evaluator_mapping_missing' : 'not_applied_stage_1_not_eligible',
    score: null,
    max: capability.calculation?.total_score?.scale?.max ?? capability.model?.score_scale?.max ?? null,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    source_layer: capability.source_layer,
    source_path: capability.source_path,
    reasons: [`${capability.adapter}_requires_evaluator_mapping`]
  };
}

function calculateUcatRankingThresholdUnavailable(capability, stage1Status) {
  return {
    status: stage1Status === 'eligible' ? 'blocked_current_cycle_data_missing' : 'not_applied_stage_1_not_eligible',
    score: null,
    max: null,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    blocking_classification: stage1Status === 'eligible' ? 'current_cycle_data_missing' : null,
    official: true,
    source_layer: capability.source_layer,
    source_path: capability.source_path,
    components: {
      ucat_ranking_threshold: {
        value: null,
        max: null,
        rule_field: 'stage_2_interview_selection.thresholds',
        reason: 'current_cycle_ucat_threshold_by_applicant_group_unavailable'
      }
    },
    reasons:
      stage1Status === 'eligible'
        ? ['ucat_ranking_supported_but_current_cycle_threshold_unavailable']
        : ['ucat_ranking_supported_but_not_applied_because_stage_1_failed']
  };
}

function calculateUcatRankingHistoricalGuidance(capability, student, stage1Status) {
  const ucatTotal = getUcatTotal(student);

  return {
    status: stage1Status === 'eligible' ? 'guidance_available' : 'not_applied_stage_1_not_eligible',
    score: stage1Status === 'eligible' ? ucatTotal : null,
    max: 2700,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    official: true,
    source_layer: capability.source_layer,
    source_path: capability.source_path,
    components: {
      ucat_ranking_input: {
        value: stage1Status === 'eligible' ? ucatTotal : null,
        max: 2700,
        rule_field: 'stage_1_eligibility.admissions_tests.ucat.total_score'
      }
    },
    reasons:
      stage1Status === 'eligible'
        ? ['official_ucat_ranking_with_historical_guidance_live_cutoff_not_required']
        : ['ucat_ranking_guidance_not_applied_because_stage_1_failed']
  };
}

function calculateConfiguredInterviewGuidance(capability, profile, student, stage1Status) {
  if (stage1Status !== 'eligible') {
    return {
      status: 'not_applied_stage_1_not_eligible',
      score: null,
      max: capability.model?.score_model?.scale?.max ?? null,
      interview_band: 'not_eligible',
      confidence: capability.model?.confidence ?? null,
      evidence_classification: capability.evidence_classification,
      capability_classification: capability.classification,
      official: true,
      guidance_official: false,
      source_layer: capability.source_layer,
      source_path: capability.source_path,
      reasons: ['configured_interview_guidance_not_applied_because_stage_1_failed']
    };
  }

  const classification = classifyInterviewBand(profile, capability.model, student);
  const band = classification.canonical_interview_band;
  const available = band !== 'not_eligible' && band !== 'insufficient_evidence';

  return {
    status: available ? 'guidance_available' : 'blocked_missing_required_components',
    score: available ? classification.ranking?.value ?? null : null,
    max: classification.ranking?.max ?? capability.model?.score_model?.scale?.max ?? null,
    interview_band: band,
    guidance_pool_id: classification.guidance_pool_id,
    confidence: classification.confidence,
    evidence_classification: capability.evidence_classification,
    capability_classification: capability.classification,
    official: true,
    guidance_official: false,
    source_layer: capability.source_layer,
    source_path: capability.source_path,
    components: {
      configured_ranking_input: {
        value: available ? classification.ranking?.value ?? null : null,
        max: classification.ranking?.max ?? capability.model?.score_model?.scale?.max ?? null,
        rule_field: capability.source_path
      }
    },
    reasons: available
      ? ['generic_interview_band_configuration_applied']
      : ['no_matching_configured_guidance_pool_or_complete_input']
  };
}

function calculateCapability(capability, profile, student, stage1Status) {
  if (capability.adapter === 'gcse_ucat_additional_points') {
    return calculateGcseUcatAdditionalPointsFormula(capability, student, stage1Status);
  }

  if (capability.adapter === 'weighted_decile_predictor_model') {
    return calculateWeightedDecileResearchModel(capability, profile, student, stage1Status);
  }

  if (capability.adapter === 'scaled_academic_ucat_research_model') {
    return calculateScaledAcademicUcatResearchModel(capability, profile, student, stage1Status);
  }

  if (capability.adapter === 'official_pre_assessment_matrix_formula') {
    return calculateOfficialPreAssessmentMatrixFormula(capability, profile, student, stage1Status);
  }

  if (capability.adapter === 'supplied_component_formula') {
    return calculateSuppliedComponentFormula(capability, student, stage1Status);
  }

  if (capability.adapter === 'ucat_ranking_threshold_unavailable') {
    return calculateUcatRankingThresholdUnavailable(capability, stage1Status);
  }

  if (capability.adapter === 'ucat_ranking_historical_guidance') {
    return calculateUcatRankingHistoricalGuidance(capability, student, stage1Status);
  }

  if (capability.adapter === 'generic_interview_band_config') {
    return calculateConfiguredInterviewGuidance(capability, profile, student, stage1Status);
  }

  return unsupportedCapabilityResult(capability, stage1Status);
}

function getSelectionCalculation(profile, research, card, interviewBandConfig, student, stage1Status) {
  if (!profile) {
    return {
      status: 'unknown',
      capability_classification: 'blocked_missing_formula',
      reasons: ['university_profile_not_found']
    };
  }

  const capabilities = discoverEvidenceCapabilities(profile, research, card, interviewBandConfig);

  if (!capabilities.length) {
    return {
      status: stage1Status === 'eligible' ? 'not_supported' : 'not_applied_stage_1_not_eligible',
      capability_classification: profile.stage_1_eligibility ? 'eligibility_only' : 'blocked_missing_formula',
      evidence_capabilities: [],
      reasons: ['no_formula_or_prediction_model_found_in_evidence_layers']
    };
  }

  const selectedCapability = capabilities[0];
  const result = calculateCapability(selectedCapability, profile, student, stage1Status);

  return {
    ...result,
    evidence_capabilities: capabilities.map((capability) => {
      return {
        classification: capability.classification,
        source_layer: capability.source_layer,
        source_path: capability.source_path,
        adapter: capability.adapter,
        evidence_classification: capability.evidence_classification
      };
    }),
    selected_capability: {
      classification: selectedCapability.classification,
      source_layer: selectedCapability.source_layer,
      source_path: selectedCapability.source_path,
      adapter: selectedCapability.adapter
    },
    capability_classification: result.capability_classification || selectedCapability.classification,
    source_layer: result.source_layer || selectedCapability.source_layer,
    source_path: result.source_path || selectedCapability.source_path
  };
}

function getHistoricalEstimate(profile, card, stage1Status) {
  const historical = profile?.historical_admissions || card.historical_context;

  if (!historical) {
    return {
      status: 'not_supported',
      reasons: ['historical_context_not_stored']
    };
  }

  return {
    status: stage1Status === 'eligible' ? 'context_only' : 'not_applied_stage_1_not_eligible',
    reasons: ['historical_statistics_are_context_only_not_hard_cutoffs'],
    rule_field: profile?.historical_admissions ? 'historical_admissions' : 'historical_context'
  };
}

function getInterviewLikelihood(stage1Status, officialCalculation) {
  if (stage1Status !== 'eligible') {
    return {
      status: 'not_eligible',
      reasons: ['interview_likelihood_not_assessed_because_stage_1_failed']
    };
  }

  if (officialCalculation.status === 'calculated') {
    return {
      status: 'unknown',
      reasons: ['pre_interview_score_calculated_but_interview_threshold_not_stored']
    };
  }

  if (officialCalculation.status === 'guidance_available') {
    return {
      status: 'guidance_available',
      reasons: ['official_ranking_and_historical_guidance_available_live_cutoff_not_required']
    };
  }

  return {
    status:
      officialCalculation.status?.startsWith('blocked') ||
      officialCalculation.status === 'not_supported' ||
      officialCalculation.status === 'evaluator_mapping_missing'
      ? 'prediction_blocked'
      : 'unknown',
    reasons: ['interview_selection_threshold_or_ranking_cutoff_not_available']
  };
}

function summarizeOfficialCalculation(calculation) {
  if (!calculation) {
    return 'unknown';
  }

  if (calculation.score !== null && calculation.score !== undefined) {
    return `${calculation.status}: ${calculation.score}/${calculation.max}`;
  }

  return calculation.status;
}

function buildUserSummary(stage1Status, academic, admissionsTests, officialCalculation, interviewLikelihood, decisionModel) {
  if (stage1Status === 'not_eligible') {
    const failingReasons = [];

    if (academic.status === 'fail') {
      failingReasons.push('academic requirements not met');
    }

    if (admissionsTests.status === 'fail') {
      failingReasons.push('UCAT/SJT gate not met');
    }

    return `Minimum requirements failed: ${failingReasons.join('; ')}. Selection scoring is ${decisionModel.selection_score_status}; interview likelihood ${decisionModel.interview_likelihood}; final status ${decisionModel.final_user_status}.`;
  }

  return `Minimum requirements ${decisionModel.minimum_eligibility_status}. Selection scoring ${summarizeOfficialCalculation(officialCalculation)}; interview likelihood ${decisionModel.interview_likelihood}; final status ${decisionModel.final_user_status}.`;
}

function getMinimumEligibilityStatus(stage1Status) {
  if (stage1Status === 'eligible') {
    return 'passed';
  }

  if (stage1Status === 'not_eligible') {
    return 'failed';
  }

  return 'unknown';
}

function getSelectionScoreStatus(minimumEligibilityStatus, officialCalculation) {
  if (minimumEligibilityStatus === 'failed') {
    return 'not_applicable';
  }

  if (
    officialCalculation.status === 'calculated' ||
    officialCalculation.status === 'guidance_available'
  ) {
    return 'calculated';
  }

  if (
    officialCalculation.status === 'blocked_missing_required_components' ||
    officialCalculation.status === 'blocked_missing_formula' ||
    officialCalculation.status === 'evaluator_mapping_missing'
  ) {
    return 'blocked';
  }

  if (
    officialCalculation.status === 'not_supported' ||
    officialCalculation.status === 'unknown' ||
    officialCalculation.status === 'not_applied_stage_1_not_eligible'
  ) {
    return 'unavailable';
  }

  return 'blocked';
}

function getSelectionScore(officialCalculation, selectionScoreStatus) {
  if (selectionScoreStatus !== 'calculated') {
    return null;
  }

  return Number.isFinite(officialCalculation.score) ? officialCalculation.score : null;
}

function getSelectionScoreMax(officialCalculation) {
  return Number.isFinite(officialCalculation.max) ? officialCalculation.max : null;
}

function getSelectionScoreWarnings(selectionScore, selectionScoreMax, interviewLikelihood, officialCalculation) {
  const warnings = [];
  const classification = officialCalculation.capability_classification || officialCalculation.blocking_classification;
  const evidence = String(officialCalculation.evidence_classification || '');

  if (
    officialCalculation.official === false ||
    ['research_derived_model', 'estimated_model'].includes(classification) ||
    (/research|predictor|estimate/i.test(evidence) && !/historical_decile_estimate/i.test(evidence))
  ) {
    warnings.push('research_derived_not_official_university_formula');
  }

  if (/historical_decile_estimate/i.test(evidence)) {
    warnings.push('ucat_decile_historical_estimate_not_current_live_pool');
  }

  if (officialCalculation.guidance_official === false) {
    warnings.push('derived_interview_guidance_not_official_university_threshold');
  }

  if (Number.isFinite(selectionScore) && Number.isFinite(selectionScoreMax)) {
    const scoreRatio = selectionScore / selectionScoreMax;

    if (scoreRatio < 0.7 && interviewLikelihood.status === 'unknown') {
      warnings.push(
        ['research_derived_model', 'estimated_model'].includes(classification) || officialCalculation.official === false
          ? 'low_research_selection_score_warning'
          : 'low_selection_score_warning_no_official_cutoff'
      );
    }
  }

  if (officialCalculation.status === 'blocked_missing_required_components') {
    const components = officialCalculation.components || {};

    for (const [componentId, component] of Object.entries(components)) {
      if (component?.value !== null && component?.value !== undefined) {
        continue;
      }

      warnings.push(`${componentId}_unavailable`);

      if (/ucat.*decile/i.test(componentId)) {
        warnings.push('current_cycle_data_missing_fee_cohort_ucat_decile');
      } else {
        warnings.push(`student_input_missing_${componentId}`);
      }
    }
  }

  if (officialCalculation.status === 'evaluator_mapping_missing') {
    warnings.push('evaluator_mapping_missing');
  }

  if (officialCalculation.status === 'blocked_missing_formula') {
    warnings.push('blocked_missing_formula');
  }

  if (officialCalculation.status === 'blocked_current_cycle_data_missing') {
    warnings.push('current_cycle_data_missing');
  }

  return warnings;
}

function getFinalUserStatus(minimumEligibilityStatus, selectionScoreStatus, interviewLikelihood, warnings) {
  if (minimumEligibilityStatus === 'failed') {
    return 'not_eligible_minimum_requirements';
  }

  if (
    warnings.includes('low_selection_score_warning_no_official_cutoff') ||
    warnings.includes('low_research_selection_score_warning')
  ) {
    return 'eligible_but_low_selection_score';
  }

  if (interviewLikelihood.status === 'likely') {
    return 'eligible_interview_likely';
  }

  if (interviewLikelihood.status === 'possible') {
    return 'eligible_interview_possible';
  }

  if (interviewLikelihood.status === 'unlikely') {
    return 'eligible_interview_unlikely';
  }

  if (interviewLikelihood.status === 'guidance_available') {
    return 'eligible_interview_guidance_available';
  }

  if (selectionScoreStatus === 'calculated') {
    return 'eligible_selection_score_calculated';
  }

  if (selectionScoreStatus === 'blocked' || selectionScoreStatus === 'unavailable') {
    return 'eligible_prediction_blocked';
  }

  return 'eligible_prediction_blocked';
}

function buildDecisionModel(stage1Status, officialCalculation, interviewLikelihood) {
  const minimumEligibilityStatus = getMinimumEligibilityStatus(stage1Status);
  const selectionScoreStatus = getSelectionScoreStatus(minimumEligibilityStatus, officialCalculation);
  const selectionScore = getSelectionScore(officialCalculation, selectionScoreStatus);
  const selectionScoreMax = getSelectionScoreMax(officialCalculation);
  const warnings = getSelectionScoreWarnings(
    selectionScore,
    selectionScoreMax,
    interviewLikelihood,
    officialCalculation
  );
  const finalUserStatus = getFinalUserStatus(
    minimumEligibilityStatus,
    selectionScoreStatus,
    interviewLikelihood,
    warnings
  );

  return {
    minimum_eligibility_status: minimumEligibilityStatus,
    selection_score_status: selectionScoreStatus,
    selection_score: selectionScore,
    selection_score_max: selectionScoreMax,
    interview_likelihood: interviewLikelihood.status,
    final_user_status: finalUserStatus,
    evidence_classification:
      officialCalculation.evidence_classification === 'historical_decile_estimate'
        ? `${officialCalculation.capability_classification || 'official_formula'}+historical_decile_estimate`
        :
      officialCalculation.blocking_classification ||
      officialCalculation.capability_classification ||
      officialCalculation.evidence_classification ||
      'blocked_missing_formula',
    warnings
  };
}

function collectStrings(value) {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

function assertHistoricalCutoffLabelling(card) {
  const suspicious = collectStrings(card).filter((text) => {
    return /historical/i.test(text) && /cut[\s-]?off|threshold/i.test(text);
  });

  for (const text of suspicious) {
    assert.ok(
      /context only|not .*cut[\s-]?off|not .*threshold|rough context|not official|not current|can vary/i.test(text),
      `Historical statistic text must be labelled as context, not a hard cutoff: ${text}`
    );
  }
}

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }

  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function buildAstonResultCardApplicant(card) {
  const context = card.applicant_context;
  const gcseSubjects = Object.fromEntries(
    context.academic_profile.gcse.subjects.map((subject) => [subject.subject_id, subject.grade])
  );
  const aLevelSubjects = context.academic_profile.a_level.predicted_grades.map((subject) => ({
    subject_id: subject.subject_id,
    predicted_grade: subject.grade,
    practical_endorsement: subject.practical_endorsement
  }));

  return {
    profile_id: context.profile_id,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: context.international ? 'International' : 'Home',
      domicile: 'England',
      contextual: context.contextual,
      widening_participation: context.widening_participation,
      graduate: context.graduate,
      resit: {
        has_resits: context.resit_applicant
      }
    },
    gcse_profile: {
      subjects: gcseSubjects
    },
    a_level_profile: {
      subjects: aLevelSubjects
    },
    admissions_tests: {
      ucat: {
        ...context.admissions_tests.ucat
      }
    }
  };
}

function assertAstonResultCardRegression(card, profile, interviewBandConfig) {
  assert.ok(profile, 'Aston production profile must exist.');
  assert.ok(interviewBandConfig, 'Aston interview-band config must exist.');
  assert.strictEqual(card.eligibility?.status, 'eligible', 'Aston example eligibility must pass.');
  assert.deepStrictEqual(
    card.prediction?.score_components?.gcse_academic_score,
    { value: 24, max: 24 },
    'Aston example GCSE score must remain 24/24.'
  );
  assert.strictEqual(card.prediction?.score_components?.ucat_band_score?.value, 11);
  assert.strictEqual(card.prediction?.score_components?.ucat_band_score?.max, 12);
  assert.strictEqual(card.prediction?.score, 35, 'Aston example total score must remain 35/36.');
  assert.deepStrictEqual(card.prediction?.score_scale, { min: 0, max: 36 });
  assert.strictEqual(card.prediction?.selected_ranking_pool, 'home_non_wp');
  assert.strictEqual(card.prediction?.result_band, 'interview_likely');
  assert.deepStrictEqual(
    card.stage_2_selection?.sjt,
    {
      band: 4,
      scored: false,
      points: 0,
      status: 'accepted_not_used'
    },
    'Aston example must keep SJT Band 4 accepted and unscored.'
  );
  assert.strictEqual(card.prediction?.offer_prediction_status, undefined);
  assert.strictEqual(card.offer_selection, undefined);
  assert.strictEqual(
    hasNestedKey(card, 'offer_probability'),
    false,
    'Aston result card must not emit an offer_probability field.'
  );
  assert.strictEqual(card.historical_context?.use, 'context_only');
  assert.strictEqual(card.historical_context?.fixed_current_cutoff, false);
  assert.ok(
    card.historical_context.guidance.every((entry) => /guidance|context/i.test(entry.classification)),
    'Every Aston historical threshold must be explicitly labelled as guidance/context.'
  );
  assert.ok(
    card.historical_context.guidance.every((entry) => /not .*current cutoff|not .*observed/i.test(entry.classification)),
    'No Aston historical threshold may be represented as a live cutoff.'
  );
  assert.ok(
    Array.isArray(card.evidence?.source_traceability) &&
      card.evidence.source_traceability.length >= 3,
    'Aston result card must retain production, research and interview-config traceability.'
  );
  assert.ok(
    card.evidence.source_traceability.every((source) => source.artifact && source.path),
    'Every Aston source-traceability entry must identify its artifact and repository path.'
  );

  const applicant = buildAstonResultCardApplicant(card);
  const classification = classifyInterviewBand(profile, interviewBandConfig, applicant);

  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.ranking.components.gcse_academic_score.value, 24);
  assert.strictEqual(classification.ranking.components.ucat_score.value, 11);
  assert.strictEqual(classification.ranking.value, 35);
  assert.strictEqual(classification.ranking.max, 36);
  assert.strictEqual(classification.guidance_pool_id, 'home_non_wp');
  assert.strictEqual(classification.canonical_interview_band, 'interview_likely');
  assert.strictEqual(classification.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(classification, 'offer_probability'), false);

  const internationalApplicant = JSON.parse(JSON.stringify(applicant));
  internationalApplicant.applicant_identity.fee_status = 'International';
  const international = classifyInterviewBand(profile, interviewBandConfig, internationalApplicant);
  assert.strictEqual(international.guidance_pool_id, 'international');
  assert.deepStrictEqual(international.band_metric, {
    metric: 'ucat_total',
    value: 2400,
    scale: { min: 0, max: 2700 }
  });
  assert.strictEqual(international.ranking.value, 2400);
  assert.strictEqual(international.ranking.max, 2700);
  assert.doesNotMatch(international.explanation, /\/36/);

  const belowPublishedUcatApplicant = JSON.parse(JSON.stringify(applicant));
  belowPublishedUcatApplicant.admissions_tests.ucat.total_score = 1649;
  const belowPublishedUcat = classifyInterviewBand(
    profile,
    interviewBandConfig,
    belowPublishedUcatApplicant
  );
  assert.strictEqual(belowPublishedUcat.ranking.status, 'unavailable');
  assert.strictEqual(belowPublishedUcat.ranking.components.ucat_score.value, null);
  assert.strictEqual(belowPublishedUcat.canonical_interview_band, 'insufficient_evidence');

  const legacyGradeApplicant = JSON.parse(JSON.stringify(applicant));
  legacyGradeApplicant.gcse_profile.subjects.english_language = 'A';
  const legacyGrade = classifyInterviewBand(profile, interviewBandConfig, legacyGradeApplicant);
  assert.strictEqual(legacyGrade.ranking.status, 'unavailable');
  assert.match(
    legacyGrade.ranking.components.gcse_academic_score.reason,
    /^ambiguous_gcse_grade_points:english_language:A$/
  );
  assert.strictEqual(legacyGrade.canonical_interview_band, 'insufficient_evidence');
  assert.strictEqual(legacyGrade.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(legacyGrade, 'offer_probability'), false);
}

function buildNottinghamResultCardApplicant(card) {
  const context = card.applicant_context;

  return {
    qualification_route: context.qualification_route,
    application_year: context.admissions_tests.ucat.test_year,
    entry_year: card.course_identity.entry_year,
    has_gcse_or_equivalent_results: context.has_gcse_or_equivalent_results,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: context.international ? 'International' : 'Home',
      domicile: 'England',
      contextual: context.contextual,
      contextual_status_confirmed: context.contextual,
      widening_participation: context.widening_participation,
      age_on_1_september: context.age_on_1_september,
      resit: {
        has_resits: context.resit_applicant
      }
    },
    gcse_profile: {
      subjects: Object.fromEntries(
        context.academic_profile.gcse.subjects.map((subject) => [
          subject.subject_id,
          subject.grade
        ])
      )
    },
    a_level_profile: {
      subjects: context.academic_profile.a_level.predicted_grades.map((subject) => ({
        subject_id: subject.subject_id,
        predicted_grade: subject.grade,
        practical_endorsement: subject.practical_endorsement
      })),
      completed_in_one_sitting:
        context.academic_profile.a_level.completed_in_one_sitting,
      study_period_years: context.academic_profile.a_level.study_period_years
    },
    admissions_tests: {
      ucat: {
        ...context.admissions_tests.ucat
      }
    }
  };
}

function assertNottinghamResultCardRegression(card, profile, interviewBandConfig) {
  assert.ok(profile, 'Nottingham production profile must exist.');
  assert.ok(interviewBandConfig, 'Nottingham interview-band config must exist.');
  assert.strictEqual(
    card.result_mode,
    'example_only_eligibility_official_score_and_guidance_only_historical_positioning'
  );
  assert.strictEqual(card.eligibility?.status, 'eligible');
  assert.strictEqual(card.official_score?.components?.gcse?.value, 28);
  assert.strictEqual(card.official_score?.components?.ucat_cognitive?.value, 32);
  assert.strictEqual(card.official_score?.components?.sjt?.value, 6);
  assert.strictEqual(card.official_score?.value, 66);
  assert.strictEqual(card.official_score?.max, 82);
  assert.strictEqual(
    card.interview_positioning?.guidance_label,
    'guidance-only: historically competitive range'
  );
  assert.strictEqual(card.interview_positioning?.historical_typical_range?.source_type, 'FOI');
  assert.strictEqual(card.interview_positioning?.safeguards?.guidance_only, true);
  assert.strictEqual(card.interview_positioning?.safeguards?.fixed_cutoff, false);
  assert.strictEqual(card.interview_positioning?.safeguards?.non_executable, true);
  assert.strictEqual(
    card.interview_positioning?.safeguards?.admissions_decision_effect,
    false
  );
  assert.strictEqual(card.exclusion_handling?.sjt_band_4?.excludes_from_interview, true);
  assert.strictEqual(
    card.exclusion_handling?.sjt_band_4?.historical_positioning_performed,
    false
  );
  assert.strictEqual(
    card.exclusion_handling?.no_gcse_50_point_route?.included_in_this_example,
    false
  );
  assert.strictEqual(
    card.exclusion_handling?.no_gcse_50_point_route
      ?.eligible_for_82_point_historical_positioning,
    false
  );
  assert.strictEqual(card.offer_prediction, undefined);
  assert.strictEqual(hasNestedKey(card, 'probability'), false);

  const evaluation = evaluateNottinghamA100(
    profile,
    buildNottinghamResultCardApplicant(card),
    { interviewBandConfig }
  );

  assert.strictEqual(evaluation.eligibility.status, 'eligible');
  assert.strictEqual(evaluation.official_score.components.gcse.value, 28);
  assert.strictEqual(evaluation.official_score.components.ucat_cognitive.value, 32);
  assert.strictEqual(evaluation.official_score.components.sjt.value, 6);
  assert.strictEqual(evaluation.official_score.value, 66);
  assert.strictEqual(evaluation.official_score.max, 82);
  assert.strictEqual(
    evaluation.interview_band_guidance.guidance_label,
    'guidance-only: historically competitive range'
  );
  assert.strictEqual(
    evaluation.interview_band_guidance.safeguards.admissions_decision_effect,
    false
  );

  const band4Applicant = buildNottinghamResultCardApplicant(card);
  band4Applicant.admissions_tests.ucat.sjt_band = 4;
  const band4 = evaluateNottinghamA100(profile, band4Applicant, {
    interviewBandConfig
  });
  assert.strictEqual(band4.eligibility.status, 'not_eligible');
  assert.strictEqual(
    band4.interview_band_guidance.status,
    'excluded_before_guidance'
  );
  assert.strictEqual(band4.interview_band_guidance.guidance_label, null);
  assert.strictEqual(
    band4.interview_band_guidance.historical_comparison_performed,
    false
  );
}

function evaluateStudentAgainstProfile(profile, student) {
  const result = {
    status: 'eligible',
    scope: 'minimum_requirements_only',
    student_specific_score_calculated: false,
    academic: null,
    admissions_tests: null,
    reasons: [],
    warnings: []
  };

  if (!profile) {
    result.status = 'unknown';
    result.warnings.push('university_profile_not_found');
    return result;
  }

  const tests = profile.stage_1_eligibility?.admissions_tests || {};
  const ucat = tests.ucat || {};
  const sjt = tests.sjt || {};
  const academic = evaluateAcademicRequirements(profile, student);
  result.academic = academic;

  if (academic.status === 'fail') {
    result.status = 'not_eligible';
    result.reasons.push('academic_requirements_not_met');
  } else if (academic.status === 'pass') {
    result.warnings.push('academic_requirements_checked');
  } else {
    result.warnings.push('academic_requirements_unknown');
  }

  if (hasResits(student) && profile.stage_1_eligibility?.resits?.allowed === false) {
    result.status = 'not_eligible';
    result.reasons.push('resit_policy');
  }

  const ucatTotal = getUcatTotal(student);
  const sjtBand = getSjtBand(student);
  const applicantGroupIds = deriveApplicantGroupIds(student);
  const minimumUcatTotalScore = resolveUcatMinimumTotalScore(ucat, applicantGroupIds);

  if (typeof minimumUcatTotalScore === 'number' && ucatTotal < minimumUcatTotalScore) {
    result.status = 'not_eligible';
    result.reasons.push('ucat_below_minimum_total_score');
  } else if (ucat.required === true) {
    result.warnings.push('ucat_required_checked');
  }

  const excludedBands = Array.isArray(sjt.excluded_bands) ? sjt.excluded_bands : [];

  if (excludedBands.includes(sjtBand)) {
    result.status = 'not_eligible';
    result.reasons.push('sjt_band_excluded');
  } else if (sjtBand === 4) {
    result.warnings.push('sjt_band_4_not_rejected_by_profile');
  }

  result.admissions_tests = {
    status:
      result.reasons.includes('ucat_below_minimum_total_score') || result.reasons.includes('sjt_band_excluded')
        ? 'fail'
        : 'pass',
    ucat: {
      total_score: ucatTotal,
      minimum_total_score: minimumUcatTotalScore,
      required: ucat.required === true,
      status:
        typeof minimumUcatTotalScore === 'number' && ucatTotal < minimumUcatTotalScore
          ? 'fail'
          : 'pass',
      rule_field: 'stage_1_eligibility.admissions_tests.ucat'
    },
    sjt: {
      band: sjtBand,
      excluded_bands: excludedBands,
      status: excludedBands.includes(sjtBand) ? 'fail' : 'pass',
      rule_field: 'stage_1_eligibility.admissions_tests.sjt'
    },
    reasons: [
      ...(result.reasons.includes('ucat_below_minimum_total_score') ? ['ucat_below_minimum_total_score'] : []),
      ...(result.reasons.includes('sjt_band_excluded') ? ['sjt_band_excluded'] : []),
      ...(ucat.required === true ? ['ucat_required_checked'] : []),
      ...(sjtBand === 4 && !excludedBands.includes(sjtBand) ? ['sjt_band_4_not_rejected_by_profile'] : [])
    ]
  };

  if (result.status === 'eligible' && result.reasons.length === 0) {
    result.reasons.push('no_blocking_gate_triggered');
  }

  return result;
}

function assertRiskProfileIssues(profile, evaluation) {
  const tests = profile?.stage_1_eligibility?.admissions_tests || {};
  const ucat = tests.ucat || {};
  const sjt = tests.sjt || {};
  const excludedBands = Array.isArray(sjt.excluded_bands) ? sjt.excluded_bands : [];
  const riskApplicant = ALL_STUDENT_PROFILES.find((student) => getStudentId(student) === 'risk_applicant');
  const riskUcatTotal = getUcatTotal(riskApplicant);
  const riskSjtBand = getSjtBand(riskApplicant);
  const riskMinimumUcatTotalScore = resolveUcatMinimumTotalScore(
    ucat,
    deriveApplicantGroupIds(riskApplicant)
  );

  if (typeof riskMinimumUcatTotalScore === 'number' && riskUcatTotal < riskMinimumUcatTotalScore) {
    assert.ok(evaluation.reasons.includes('ucat_below_minimum_total_score'), 'UCAT cutoff issue must be flagged.');
  }

  if (excludedBands.includes(riskSjtBand)) {
    assert.ok(evaluation.reasons.includes('sjt_band_excluded'), 'SJT Band 4 exclusion must be flagged.');
  } else if (riskSjtBand === 4) {
    assert.ok(
      !evaluation.reasons.includes('sjt_band_excluded'),
      'SJT Band 4 must not be rejected when accepted or not used.'
    );
    assert.ok(
      evaluation.warnings.includes('sjt_band_4_not_rejected_by_profile'),
      'Accepted/not-used SJT Band 4 policy must be explicit.'
    );
  }
}

function assertHullYorkResultCardRegression(card, profile, interviewBandConfig) {
  const fixture = readJson(
    path.join(rootDir, 'data', 'fixtures', 'hull-york-a100-readiness.json')
  );
  const evaluation = evaluateHullYorkA100(
    profile,
    interviewBandConfig,
    fixture.base_applicant
  );
  const generatedCard = buildHullYorkA100ResultCard(
    profile,
    interviewBandConfig,
    fixture.base_applicant
  );
  const cardText = JSON.stringify(card);

  assert.strictEqual(evaluation.eligibility.status, 'eligible');
  assert.strictEqual(evaluation.estimated_selection_score.value, 85.48);
  assert.strictEqual(evaluation.estimated_selection_score.max, 100);
  assert.strictEqual(evaluation.estimated_selection_score.contextual.points, 15);
  assert.strictEqual(evaluation.canonical_interview_band, 'interview_likely');
  assert.strictEqual(card.prediction.score, generatedCard.prediction.score);
  assert.strictEqual(card.prediction.result_band, generatedCard.prediction.result_band);
  assert.strictEqual(
    card.estimated_selection_score.contextual.points,
    generatedCard.estimated_selection_score.contextual.points
  );
  assert.match(cardText, /Estimated HYMS selection score/);
  assert.doesNotMatch(cardText, /Confirmed HYMS selection score/i);
  assert.match(cardText, /published HYMS admissions information/i);
  assert.strictEqual(card.engine_notes.generic_classifier_used, false);
}

function evaluateCard(filePath) {
  const card = readJson(filePath);
  const profileId = getProfileId(card);
  const profile = loadUniversityProfile(profileId);
  const research = loadResearchProfile(profileId);
  const interviewBandConfig = loadInterviewBandConfig(profileId);
  const completed = isCompletedCard(card);

  if (!completed) {
    return {
      filePath,
      profileId,
      skipped: true,
      reason: 'not_completed_or_ready'
    };
  }

  assert.ok(profileId, 'profile_id / university identifier must exist.');
  assert.ok(hasClearStatus(card), 'Completed card must expose a clear eligibility/prediction/formula status.');
  assertStandardReadinessMetadata(profile, research);

  if (profileId === 'nottingham-a100') {
    assertNottinghamResultCardRegression(card, profile, interviewBandConfig);
    assertHistoricalCutoffLabelling(card);

    return {
      filePath,
      profileId,
      skipped: false,
      evaluations: [],
      formula_enabled: true,
      eligibility_only: false,
      prediction_status: 'guidance_only_historical_positioning',
      dedicated_adapter: 'nottingham_a100_consumer'
    };
  }

  if (profileId === 'hull-york-a100') {
    assertHullYorkResultCardRegression(card, profile, interviewBandConfig);
    assertCapabilityContract(card, profile);
    assertHistoricalCutoffLabelling(card);

    return {
      filePath,
      profileId,
      skipped: false,
      evaluations: [],
      formula_enabled: true,
      eligibility_only: false,
      prediction_status: 'unofficial_estimate_mode',
      dedicated_adapter: 'hull_york_a100_consumer'
    };
  }

  assertCapabilityContract(card, profile);

  const evaluations = STUDENT_PROFILES.map((student) => {
    const evaluation = evaluateStudentAgainstProfile(profile, student);
    const reasons = [...evaluation.reasons, ...evaluation.warnings];
    const stage1Status = evaluation.status;
    const officialCalculation = getSelectionCalculation(
      profile,
      research,
      card,
      interviewBandConfig,
      student,
      stage1Status
    );
    const historicalEstimate = getHistoricalEstimate(profile, card, stage1Status);
    const interviewLikelihood = getInterviewLikelihood(stage1Status, officialCalculation);
    const decisionModel = buildDecisionModel(stage1Status, officialCalculation, interviewLikelihood);

    if (officialCalculation.status === 'calculated') {
      evaluation.student_specific_score_calculated = true;
    }

    return {
      test_case_id: getStudentId(student),
      test_case_name: getStudentLabel(student),
      stage_1_eligibility_result: stage1Status,
      academic_assessment: evaluation.academic,
      ucat_sjt_assessment: evaluation.admissions_tests,
      official_calculation: officialCalculation,
      historical_estimate: historicalEstimate,
      interview_likelihood: interviewLikelihood,
      decision_model: decisionModel,
      minimum_eligibility_status: decisionModel.minimum_eligibility_status,
      selection_score_status: decisionModel.selection_score_status,
      selection_score: decisionModel.selection_score,
      selection_score_max: decisionModel.selection_score_max,
      final_user_status: decisionModel.final_user_status,
      decision_warnings: decisionModel.warnings,
      final_user_facing_summary: buildUserSummary(
        stage1Status,
        evaluation.academic,
        evaluation.admissions_tests,
        officialCalculation,
        interviewLikelihood,
        decisionModel
      ),
      eligibility: normaliseEligibilityStatus(evaluation),
      prediction: getPredictionStatus(card, evaluation),
      score_status: getScoreStatus(card, evaluation),
      reasons,
      failure_flags: getFailureFlags(evaluation)
    };
  });

  for (const evaluation of evaluations) {
    assert.notStrictEqual(
      evaluation.stage_1_eligibility_result,
      'unknown',
      `${evaluation.test_case_name} must be evaluable against card/profile contract.`
    );
    assert.ok(evaluation.reasons.length > 0, `${evaluation.test_case_name} must produce a clear status detail.`);
  }

  if (card.engine_notes?.interview_band_config) {
    for (const evaluation of evaluations.filter((item) => item.stage_1_eligibility_result === 'eligible')) {
      assert.strictEqual(
        evaluation.official_calculation.selected_capability?.adapter,
        'generic_interview_band_config',
        `${profileId} must use the registered generic interview-band configuration adapter.`
      );
      assert.strictEqual(
        evaluation.official_calculation.status,
        'guidance_available',
        `${profileId} eligible shared cases must produce configured interview guidance.`
      );
    }
  }

  if (isFormulaEnabled(card)) {
    assertFormulaScores(card);
  }

  if (isEligibilityOnly(card)) {
    const reasonText = [
      card.prediction?.cannot_predict_explanation,
      card.prediction?.interview_prediction?.unavailable_reason,
      ...(card.prediction?.missing_data_reasons || []),
      ...(card.eligibility?.warnings || []),
      card.display?.secondary_explanation
    ]
      .filter(Boolean)
      .join(' ');

    assert.ok(reasonText.length > 0, 'Eligibility-only card must include prediction-blocked reason.');
  }

  assertRiskProfileIssues(profile, evaluateStudentAgainstProfile(
    profile,
    ALL_STUDENT_PROFILES.find((student) => getStudentId(student) === 'risk_applicant')
  ));
  assertHistoricalCutoffLabelling(card);

  if (profileId === 'aston-a100') {
    assertAstonResultCardRegression(card, profile, interviewBandConfig);
  }

  return {
    filePath,
    profileId,
    skipped: false,
    evaluations,
    formula_enabled: isFormulaEnabled(card),
    eligibility_only: isEligibilityOnly(card),
    prediction_status: getPredictionStatus(card)
  };
}

function formatList(items) {
  return items.length ? items.join(', ') : 'none';
}

function formatFlags(flags) {
  const active = Object.entries(flags)
    .filter(([, value]) => value)
    .map(([key]) => key);

  return active.length ? active.join(', ') : 'none';
}

function tableCell(value) {
  return String(value).replace(/\|/g, '/');
}

function printDecisionTable(results) {
  const rows = [];

  for (const result of results) {
    if (result.skipped) {
      rows.push([
        result.profileId || 'unknown',
        'not_applicable',
        'unknown',
        'blocked_missing_formula',
        'unavailable',
        'null',
        'null',
        'prediction_blocked',
        'eligible_prediction_blocked',
        `skipped: ${result.reason}`,
        'none',
        'none'
      ]);
      continue;
    }

    for (const evaluation of result.evaluations) {
      rows.push([
        result.profileId,
        evaluation.test_case_name,
        evaluation.minimum_eligibility_status,
        evaluation.decision_model.evidence_classification,
        evaluation.selection_score_status,
        evaluation.selection_score ?? 'null',
        evaluation.selection_score_max ?? 'null',
        evaluation.decision_model.interview_likelihood,
        evaluation.final_user_status,
        formatList(evaluation.reasons),
        formatList(evaluation.decision_warnings),
        formatFlags(evaluation.failure_flags)
      ]);
    }
  }

  console.log('| University | Test case | Minimum eligibility | Evidence classification | Selection score status | Selection score | Score max | Interview likelihood | Final user status | Reasons | Warnings | Failure flags |');
  console.log('| ---------- | --------- | ------------------- | ----------------------- | ---------------------- | --------------- | --------- | -------------------- | ----------------- | ------- | -------- | ------------- |');

  for (const row of rows) {
    console.log(`| ${row.map(tableCell).join(' | ')} |`);
  }
}

function formatOfficialCalculationDetails(calculation) {
  if (!calculation) {
    return 'unknown';
  }

  const parts = [`status=${calculation.status}`];
  parts.push(`classification=${calculation.capability_classification || calculation.blocking_classification || 'unknown'}`);

  if (calculation.source_layer || calculation.source_path) {
    parts.push(`source=${[calculation.source_layer, calculation.source_path].filter(Boolean).join(':')}`);
  }

  if (calculation.score !== null && calculation.score !== undefined) {
    parts.push(`score=${calculation.score}/${calculation.max}`);
  }

  if (calculation.formula) {
    parts.push(`formula=${calculation.formula}`);
  }

  if (calculation.components) {
    const componentText = Object.entries(calculation.components).map(([componentId, component]) => {
      const value = component.value === null || component.value === undefined ? 'not_calculated' : component.value;
      const max = component.max === null || component.max === undefined ? '?' : component.max;
      const extra = component.national_decile ? `, national_decile=${component.national_decile}` : '';
      const reason = component.reason ? `, reason=${component.reason}` : '';
      return `${componentId}:${value}/${max}${extra}${reason}`;
    });
    parts.push(`components=${componentText.join('; ')}`);
  }

  parts.push(`reasons=${formatList(calculation.reasons || [])}`);

  return parts.join(' | ');
}

function formatEvidenceCapabilities(calculation) {
  const capabilities = calculation?.evidence_capabilities || [];

  if (!capabilities.length) {
    return 'none';
  }

  return capabilities.map((capability) => {
    return [
      capability.classification,
      capability.source_layer,
      capability.source_path,
      capability.adapter
    ].filter(Boolean).join(':');
  }).join('; ');
}

function printDetailedEvaluationSections(results) {
  console.log('Detailed decision summaries');

  for (const result of results) {
    if (result.skipped) {
      continue;
    }

    for (const evaluation of result.evaluations) {
      console.log('');
      console.log(`${result.profileId} - ${evaluation.test_case_name}`);
      console.log(`  Minimum eligibility status: ${evaluation.minimum_eligibility_status}`);
      console.log(`  Stage 1 eligibility result: ${evaluation.stage_1_eligibility_result}`);
      console.log(
        `  Academic assessment result: ${evaluation.academic_assessment.status}; reasons=${formatList(evaluation.academic_assessment.reasons)}; rule_fields=${formatList(evaluation.academic_assessment.rule_fields)}`
      );
      console.log(
        `  UCAT/SJT assessment result: ${evaluation.ucat_sjt_assessment.status}; reasons=${formatList(evaluation.ucat_sjt_assessment.reasons)}; UCAT=${evaluation.ucat_sjt_assessment.ucat.total_score}; UCAT_min=${evaluation.ucat_sjt_assessment.ucat.minimum_total_score ?? 'none'}; SJT=Band ${evaluation.ucat_sjt_assessment.sjt.band}; SJT_excluded_bands=${formatList(evaluation.ucat_sjt_assessment.sjt.excluded_bands)}`
      );
      console.log(`  Evidence capabilities: ${formatEvidenceCapabilities(evaluation.official_calculation)}`);
      console.log(`  Selection calculation: ${formatOfficialCalculationDetails(evaluation.official_calculation)}`);
      console.log(
        `  Selection score: status=${evaluation.selection_score_status}; score=${evaluation.selection_score ?? 'null'}; max=${evaluation.selection_score_max ?? 'null'}; warnings=${formatList(evaluation.decision_warnings)}`
      );
      console.log(
        `  Historical estimate: status=${evaluation.historical_estimate.status}; reasons=${formatList(evaluation.historical_estimate.reasons)}; rule_field=${evaluation.historical_estimate.rule_field || 'none'}`
      );
      console.log(
        `  Interview likelihood: status=${evaluation.decision_model.interview_likelihood}; reasons=${formatList(evaluation.interview_likelihood.reasons)}`
      );
      console.log(`  Final user status: ${evaluation.final_user_status}`);
      console.log(`  Final user-facing summary: ${evaluation.final_user_facing_summary}`);
      console.log(`  Decision reasons: ${formatList(evaluation.reasons)}`);
    }
  }
}

const resultCardPaths = discoverResultCards();

assert.ok(resultCardPaths.length > 0, 'No medicine result-card examples found.');

const results = resultCardPaths.map((filePath) => evaluateCard(filePath));
const tested = results.filter((result) => !result.skipped);
const discoveredAstonCards = resultCardPaths.filter(
  (filePath) => path.basename(filePath) === 'aston-a100-result-card.example.json'
);
const testedAstonCards = tested.filter((result) => result.profileId === 'aston-a100');
const discoveredManchesterCards = resultCardPaths.filter(
  (filePath) => path.basename(filePath) === 'manchester-a100-result-card.example.json'
);
const testedManchesterCards = tested.filter((result) => result.profileId === 'manchester-a100');
const discoveredLiverpoolCards = resultCardPaths.filter(
  (filePath) => path.basename(filePath) === 'liverpool-a100-result-card.example.json'
);
const testedLiverpoolCards = tested.filter((result) => result.profileId === 'liverpool-a100');
const discoveredNottinghamCards = resultCardPaths.filter(
  (filePath) => path.basename(filePath) === 'nottingham-a100-result-card.example.json'
);
const testedNottinghamCards = tested.filter((result) => result.profileId === 'nottingham-a100');

assert.ok(tested.length > 0, 'No completed result-card examples were selected for regression testing.');
assert.strictEqual(
  discoveredAstonCards.length,
  1,
  'Aston result card must be discovered automatically exactly once.'
);
assert.strictEqual(
  testedAstonCards.length,
  1,
  'Aston result card must be included in the completed regression set exactly once.'
);
assert.strictEqual(
  discoveredManchesterCards.length,
  1,
  'Manchester A100 result card must be discovered automatically exactly once.'
);
assert.strictEqual(
  testedManchesterCards.length,
  1,
  'Manchester A100 result card must be included in the completed regression set exactly once.'
);
assert.strictEqual(
  discoveredLiverpoolCards.length,
  1,
  'Liverpool A100 result card must be discovered automatically exactly once.'
);
assert.strictEqual(
  testedLiverpoolCards.length,
  1,
  'Liverpool A100 result card must be included in the completed regression set exactly once.'
);
assert.strictEqual(
  discoveredNottinghamCards.length,
  1,
  'Nottingham A100 result card must be discovered automatically exactly once.'
);
assert.strictEqual(
  testedNottinghamCards.length,
  1,
  'Nottingham A100 result card must be included in the completed regression set exactly once.'
);
const testedLiverpool = testedLiverpoolCards[0];
const liverpoolEligibleGuidance = testedLiverpool.evaluations.find((evaluation) => {
  return evaluation.test_case_name === 'Test Case 9 - RUK AAA all GCSE 7 UCAT 2200';
});
if (STUDENT_PROFILES.some((student) => getStudentId(student) === 'test_case_9_aaa_all_7s_ucat_2200_ruk')) {
  assert.ok(liverpoolEligibleGuidance, 'Liverpool RUK guidance regression case must be present.');
  assert.strictEqual(liverpoolEligibleGuidance.minimum_eligibility_status, 'passed');
  assert.strictEqual(liverpoolEligibleGuidance.selection_score_status, 'calculated');
  assert.strictEqual(
    liverpoolEligibleGuidance.final_user_status,
    'eligible_interview_guidance_available'
  );
}

console.log('Completed result-card regression tests');
console.log(`Discovered cards: ${resultCardPaths.length}`);
console.log(`Completed cards tested: ${tested.length}`);
console.log('Aston-specific artifact and negative-safeguard assertions: PASS');
console.log('Manchester A100 automatic discovery and capability-contract assertions: PASS');
console.log('Liverpool A100 automatic discovery and result-card assertions: PASS');
console.log('Nottingham A100 guidance-only result-card and safeguard assertions: PASS');
console.log('');
printDecisionTable(results);
console.log('');
printDetailedEvaluationSections(results);
console.log('');

for (const result of results) {
  if (result.skipped) {
    console.log(`SKIP ${path.relative(rootDir, result.filePath)} (${result.reason})`);
    continue;
  }

  console.log(`PASS ${path.relative(rootDir, result.filePath)} (${result.profileId})`);
  for (const evaluation of result.evaluations) {
    console.log(
      `  ${evaluation.test_case_name}: minimum=${evaluation.minimum_eligibility_status}; evidence=${evaluation.decision_model.evidence_classification}; selection=${evaluation.selection_score_status}; score=${evaluation.selection_score ?? 'null'}/${evaluation.selection_score_max ?? 'null'}; interview=${evaluation.decision_model.interview_likelihood}; final=${evaluation.final_user_status}; warnings=${formatList(evaluation.decision_warnings)}; reasons=${formatList(evaluation.reasons)}; risk_flags=${formatFlags(evaluation.failure_flags)}`
    );
  }
  console.log(`  Formula enabled: ${result.formula_enabled}`);
  console.log(`  Eligibility only: ${result.eligibility_only}`);
}
