#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  resolveUcatDecile
} = require('../assets/js/engine/ucat-decile-service');

const rootDir = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
);
const profile = readJson('data/universities/birmingham-a100.json');
const config = readJson('data/interview-band-configs/birmingham-a100.json');
const fixture = readJson('data/fixtures/birmingham-a100-readiness.json');
const classifierSource = fs.readFileSync(
  path.join(rootDir, 'assets/js/engine/interview-band-classifier.js'),
  'utf8'
);

assert.ok(
  !classifierSource.includes('verified_current_cycle_national_decile') &&
    !classifierSource.includes('verified_current_cycle_national_ucat_decile'),
  'Birmingham must not consume a manually supplied UCAT decile.'
);

const clone = (value) => JSON.parse(JSON.stringify(value));

function merge(base, overrides) {
  if (Array.isArray(overrides)) {
    return clone(overrides);
  }
  if (!overrides || typeof overrides !== 'object') {
    return overrides;
  }
  const result = base && typeof base === 'object' && !Array.isArray(base)
    ? clone(base)
    : {};
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(result[key], value)
      : clone(value);
  }
  return result;
}

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const GCSE_RANK = {
  U: 0,
  G: 1,
  F: 2,
  E: 3,
  D: 4,
  C: 5,
  '4': 4,
  '5': 5,
  B: 6,
  '6': 6,
  A: 7,
  '7': 7,
  '8': 8,
  '9': 9
};
const A_LEVEL_RANK = {
  U: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  'A*': 6
};
const IRISH_RANK = {
  H8: 1,
  H7: 2,
  H6: 3,
  H5: 4,
  H4: 5,
  H3: 6,
  H2: 7,
  H1: 8
};

function gradeRank(value, scale) {
  return scale[String(value ?? '').trim().toUpperCase()] ?? -1;
}

function gradeMeets(value, minimum, scale) {
  const minimumToken = String(minimum).split('/')[0];
  return gradeRank(value, scale) >= gradeRank(minimumToken, scale);
}

function profileMeets(actualGrades, requiredGrades, scale) {
  const actual = actualGrades
    .map((grade) => gradeRank(grade, scale))
    .sort((a, b) => b - a);
  const required = requiredGrades
    .map((grade) => gradeRank(grade, scale))
    .sort((a, b) => b - a);
  return actual.length >= required.length &&
    required.every((minimum, index) => actual[index] >= minimum);
}

function subjectMap(subjects = []) {
  return Object.fromEntries(subjects.map((subject) => [
    normaliseId(subject.subject_id),
    subject.predicted_grade ?? subject.achieved_grade ?? subject.grade
  ]));
}

function parseDualGrade(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return String(value ?? '').split(/[\/, +]+/).filter(Boolean);
}

function outcome(status, reason = null, extra = {}) {
  return {
    status,
    reasons: reason ? [reason] : [],
    guaranteed_interview: false,
    sjt_used_pre_interview: false,
    sjt_band_4_rejected: false,
    ...extra
  };
}

function evaluateResit(applicant) {
  const resit = applicant.applicant_identity?.resit || {};
  if (resit.has_resits !== true) {
    return null;
  }
  if (resit.official_exception_approved === true) {
    return null;
  }
  if (
    resit.extenuating_circumstances_exception_claimed === true &&
    resit.official_exception_approved !== false
  ) {
    return outcome(
      'manual_review',
      'extenuating_circumstances_exception_unverified'
    );
  }
  return outcome('not_eligible', 'resits_not_accepted');
}

function evaluateUcat(applicant, graduate = false) {
  if (applicant.admissions_tests?.ucat?.taken === true) {
    return null;
  }
  return outcome(
    'not_eligible',
    graduate && applicant.admissions_tests?.gamsat?.taken === true
      ? 'ucat_required_gamsat_not_used'
      : 'ucat_required'
  );
}

function evaluateGcse(applicant) {
  const rules = profile.stage_1_eligibility.gcse;
  const subjects = applicant.gcse_profile?.subjects || {};
  const EnglishRule = rules.grade_requirements.find(
    (rule) => rule.subject_id === 'english_language'
  );
  const mathematicsRule = rules.grade_requirements.find(
    (rule) => rule.subject_id === 'mathematics'
  );

  if (!gradeMeets(subjects.english_language, EnglishRule.minimum_grade, GCSE_RANK)) {
    return outcome('not_eligible', 'gcse_english_language_below_minimum');
  }
  if (!gradeMeets(subjects.mathematics, mathematicsRule.minimum_grade, GCSE_RANK)) {
    return outcome('not_eligible', 'gcse_mathematics_below_minimum');
  }

  const scienceRule = rules.science_requirement;
  const separate = scienceRule.accepted_options.find(
    (option) => option.option_id === 'separate_biology_and_chemistry'
  );
  const dual = scienceRule.accepted_options.find(
    (option) => option.option_id === 'dual_award_science'
  );
  const separatePassed = separate.grade_requirements.every((requirement) => {
    return gradeMeets(
      subjects[requirement.subject_id],
      requirement.minimum_grade,
      GCSE_RANK
    );
  });
  const dualRequirement = dual.grade_requirements[0];
  const dualGrades = parseDualGrade(subjects[dualRequirement.subject_id]);
  const dualPassed =
    dualGrades.length >= dualRequirement.minimum_grade_profile.length &&
    profileMeets(
      dualGrades,
      dualRequirement.minimum_grade_profile,
      GCSE_RANK
    );

  if (!separatePassed && !dualPassed) {
    return outcome('not_eligible', 'gcse_science_requirement_not_met');
  }
  return {
    science_route: separatePassed
      ? 'separate_biology_and_chemistry'
      : 'dual_award_science'
  };
}

function evaluateALevel(applicant, contextual, international = false) {
  const rules = profile.stage_1_eligibility.post_16.a_level;
  const subjects = subjectMap(applicant.a_level_profile?.subjects);
  const excluded = new Set([
    ...rules.excluded_subject_ids,
    'critical_thinking',
    'epq'
  ]);
  if (Object.keys(subjects).some((subjectId) => excluded.has(subjectId))) {
    return outcome('not_eligible', 'excluded_a_level_subject');
  }
  if (subjects.mathematics !== undefined && subjects.further_mathematics !== undefined) {
    return outcome(
      'not_eligible',
      'mathematics_and_further_mathematics_not_separate'
    );
  }
  if (subjects.chemistry === undefined) {
    return outcome('not_eligible', 'a_level_chemistry_required');
  }

  const required = international
    ? {
        predicted_minimum_profile: ['A*', 'A', 'A'],
        second_science_any_of_subject_ids: ['biology', 'physics', 'mathematics']
      }
    : rules.grade_requirements.find((requirement) => {
        return requirement.requirement_id === (
          contextual ? 'home_contextual_a_level' : 'home_standard_a_level'
        );
      });
  const secondSciencePassed = required.second_science_any_of_subject_ids.some(
    (subjectId) => subjects[subjectId] !== undefined
  );
  if (!secondSciencePassed) {
    return outcome('not_eligible', 'a_level_second_science_required');
  }
  if (!profileMeets(
    Object.values(subjects),
    required.predicted_minimum_profile,
    A_LEVEL_RANK
  )) {
    return outcome('not_eligible', 'a_level_grade_profile_not_met');
  }
  return null;
}

function namedGcsePoints(grade) {
  if (gradeMeets(grade, '8', GCSE_RANK)) {
    return 4;
  }
  if (gradeMeets(grade, '7', GCSE_RANK)) {
    return 2;
  }
  if (gradeMeets(grade, '6', GCSE_RANK)) {
    return 1;
  }
  return 0;
}

function scoreHomeApplicant(applicant, contextual) {
  const model = profile.stage_1_eligibility.gcse.scoring_model;
  const subjects = applicant.gcse_profile?.subjects || {};
  const dualGrades = parseDualGrade(subjects.combined_science);
  const namedGrades = {
    english_language: subjects.english_language,
    english_literature: subjects.english_literature,
    mathematics: subjects.mathematics,
    biology: subjects.biology ?? dualGrades[0],
    chemistry: subjects.chemistry ?? dualGrades[1]
  };
  if (Object.values(namedGrades).some((grade) => grade === undefined || grade === null)) {
    return {
      status: 'unavailable',
      reason: 'incomplete_gcse_scoring_inputs'
    };
  }
  const namedRaw = Object.values(namedGrades)
    .reduce((total, grade) => total + namedGcsePoints(grade), 0);
  const excluded = new Set([
    'english_language',
    'english_literature',
    'mathematics',
    'biology',
    'chemistry',
    'combined_science'
  ]);
  const freeRaw = Object.entries(subjects)
    .filter(([subjectId, grade]) => !excluded.has(subjectId) && grade !== null)
    .map(([, grade]) => gradeMeets(grade, '8', GCSE_RANK) ? 2 : 0)
    .sort((a, b) => b - a)
    .slice(0, model.free_choice_subject_count)
    .reduce((total, points) => total + points, 0);
  const gcseRawPoints = namedRaw + freeRaw;
  const gcseScaledScore = gcseRawPoints * model.scale_multiplier;
  const decileLookup = resolveUcatDecile(
    applicant.admissions_tests?.ucat?.total_score,
    { courseProfileId: profile.profile_id }
  );
  const decile = decileLookup.available ? decileLookup.national_decile : null;
  const ucatComponent = profile.stage_2_interview_selection.calculation.score_components
    .find((component) => component.component_id === 'ucat_component');
  const ucatPoints = ucatComponent.decile_points[String(decile)];
  if (!Number.isFinite(ucatPoints)) {
    return {
      status: 'unavailable',
      reason: 'ucat_decile_lookup_unavailable'
    };
  }
  const contextualModel = profile.stage_2_interview_selection.calculation.score_components
    .find((component) => component.component_id === 'contextual_component');
  const contextualPoints = contextual
    ? contextualModel.points_by_quintile[
        applicant.applicant_identity?.polar4_quintile
      ]
    : 0;
  if (!Number.isFinite(contextualPoints)) {
    return {
      status: 'unavailable',
      reason: 'verified_polar4_quintile_required'
    };
  }
  return {
    status: 'calculated',
    gcse_raw_points: gcseRawPoints,
    gcse_scaled_score: gcseScaledScore,
    ucat_points: ucatPoints,
    contextual_points: contextualPoints,
    application_score: Math.round(
      (gcseScaledScore + ucatPoints + contextualPoints) * 1e12
    ) / 1e12
  };
}

function evaluateUkWpMed(applicant) {
  const rule = profile.contextual_admissions.guaranteed_interview_rules[0];
  const wp = applicant.ukwpmed || {};
  if (!rule.recognised_programmes.includes(wp.programme) || wp.successfully_completed !== true) {
    return outcome('not_eligible', 'ukwpmed_completion_not_verified');
  }
  if (wp.declared_in_ucas_extra_activities !== true) {
    return outcome('not_eligible', 'ukwpmed_declaration_missing');
  }
  const appendix = rule.appendix_1;
  const gcse = applicant.gcse_profile?.subjects || {};
  const allGcseGrades = Object.values(gcse).filter((grade) => grade !== null);
  const namedGrades = [
    gcse.english_language,
    gcse.mathematics,
    gcse.chemistry,
    gcse.biology
  ];
  const requiredNamed = appendix.named_subject_grade_profile.grades_in_any_order;
  const aLevels = subjectMap(applicant.a_level_profile?.subjects);
  const thresholdsMet =
    allGcseGrades.length >= appendix.minimum_gcse_count &&
    allGcseGrades.every((grade) => gradeMeets(grade, appendix.minimum_gcse_grade, GCSE_RANK)) &&
    namedGrades.every((grade) => grade !== undefined) &&
    profileMeets(namedGrades, requiredNamed, GCSE_RANK) &&
    applicant.admissions_tests?.ucat?.taken === true &&
    profileMeets(
      Object.values(aLevels),
      appendix.predicted_a_level_profile,
      A_LEVEL_RANK
    ) &&
    aLevels.chemistry !== undefined &&
    (aLevels.biology !== undefined || aLevels.human_biology !== undefined);
  if (!thresholdsMet) {
    return outcome('not_eligible', 'ukwpmed_appendix_1_thresholds_not_met');
  }
  return outcome('eligible', null, {
    pool_id: 'ukwpmed_guaranteed_interview',
    guaranteed_interview: true
  });
}

function evaluateIb(applicant) {
  const rules = profile.stage_1_eligibility.post_16.ib;
  const higher = subjectMap(applicant.ib_profile?.higher_level_subjects);
  const standard = subjectMap(applicant.ib_profile?.standard_level_subjects);
  const secondSciencePassed = rules.second_hl_science_any_of_subject_ids.some(
    (subjectId) => higher[subjectId] !== undefined
  );
  const conditionalPassed = rules.conditional_standard_level_requirements.every(
    (requirement) => {
      return higher[requirement.subject_id] !== undefined ||
        standard[requirement.subject_id] !== undefined;
    }
  );
  const passed =
    applicant.ib_profile?.total_points >= rules.minimum_total_points &&
    profileMeets(
      Object.values(higher),
      rules.higher_level_grade_profile.map(String),
      GCSE_RANK
    ) &&
    higher.chemistry !== undefined &&
    secondSciencePassed &&
    conditionalPassed;
  return passed ? null : outcome('not_eligible', 'ib_requirements_not_met');
}

function evaluateScottish(applicant) {
  const rules = profile.stage_1_eligibility.post_16.scottish;
  const higher = subjectMap(applicant.scottish_profile?.higher_subjects);
  const advanced = subjectMap(applicant.scottish_profile?.advanced_higher_subjects);
  const higherRule = rules.higher_requirements;
  const advancedRule = rules.advanced_higher_requirements;
  const passed =
    Object.keys(higher).length >= higherRule.subject_count &&
    profileMeets(
      Object.values(higher),
      higherRule.grade_profile,
      A_LEVEL_RANK
    ) &&
    higherRule.required_subject_ids.every(
      (subjectId) => higher[subjectId] !== undefined
    ) &&
    higherRule.additional_science_any_of_subject_ids.some(
      (subjectId) => higher[subjectId] !== undefined
    ) &&
    Object.keys(advanced).length >= advancedRule.subject_count &&
    profileMeets(
      Object.values(advanced),
      advancedRule.grade_profile,
      A_LEVEL_RANK
    ) &&
    advancedRule.required_subject_ids.every(
      (subjectId) => advanced[subjectId] !== undefined
    );
  return passed ? null : outcome('not_eligible', 'scottish_requirements_not_met');
}

function evaluateIrish(applicant) {
  const rules = profile.stage_1_eligibility.post_16.irish;
  const leaving = subjectMap(applicant.irish_profile?.leaving_certificate_subjects);
  const junior = subjectMap(applicant.irish_profile?.junior_cycle_subjects);
  const leavingRule = rules.leaving_certificate;
  const juniorRule = rules.junior_cycle_or_gcse_equivalent;
  const passed =
    Object.keys(leaving).length >= leavingRule.minimum_subject_count &&
    Object.values(leaving).every(
      (grade) => gradeMeets(grade, leavingRule.minimum_grade, IRISH_RANK)
    ) &&
    leavingRule.required_subject_ids.every(
      (subjectId) => leaving[subjectId] !== undefined
    ) &&
    leavingRule.second_science_any_of_subject_ids.some(
      (subjectId) => leaving[subjectId] !== undefined
    ) &&
    Object.keys(junior).length >= juniorRule.minimum_subject_count &&
    Object.values(junior).every(
      (grade) => String(grade).toLowerCase() === 'distinction'
    ) &&
    juniorRule.required_subject_ids.every(
      (subjectId) => junior[subjectId] !== undefined
    );
  return passed ? null : outcome('not_eligible', 'irish_requirements_not_met');
}

function evaluateGraduate(applicant) {
  const rules = profile.stage_1_eligibility.post_16.graduate;
  const graduate = applicant.graduate_profile || {};
  if (graduate.waiver_claimed === true) {
    return outcome('manual_review', 'graduate_degree_content_waiver');
  }
  const classificationPassed = rules.degree_requirement.accepted_classifications
    .includes(graduate.degree_classification);
  const degreePassed =
    classificationPassed &&
    graduate.recognised_institution === true &&
    ['completed', 'predicted'].includes(graduate.degree_status) &&
    graduate.degree_age_at_course_start_years <=
      rules.degree_requirement.maximum_age_at_course_start_years;
  const school = subjectMap(applicant.a_level_profile?.subjects);
  const schoolPassed =
    profileMeets(
      Object.values(school),
      rules.a_level_requirement.normal_grade_profile,
      A_LEVEL_RANK
    ) &&
    school.chemistry !== undefined &&
    rules.a_level_requirement.second_science_any_of_subject_ids.some(
      (subjectId) => school[subjectId] !== undefined
    );
  const gcse = applicant.gcse_profile?.subjects || {};
  const gcsePassed = ['english_language', 'mathematics', 'biology', 'chemistry']
    .every((subjectId) => gradeMeets(gcse[subjectId], '6', GCSE_RANK));
  if (!degreePassed || !schoolPassed || !gcsePassed) {
    return outcome('not_eligible', 'graduate_academic_threshold_not_met');
  }
  const ucatFailure = evaluateUcat(applicant, true);
  if (ucatFailure) {
    return ucatFailure;
  }
  return outcome('eligible', null, {
    pool_id: 'graduate_a100',
    ranking: {
      metric: 'ucat_total',
      value: applicant.admissions_tests.ucat.total_score
    }
  });
}

function evaluateEnglishLanguage(applicant) {
  const rules = profile.stage_1_eligibility.english_language;
  const language = applicant.english_language_profile || {};
  const accepted = rules.accepted_tests.find(
    (test) => normaliseId(test.test) === normaliseId(language.test)
  );
  if (!accepted) {
    return outcome('manual_review', 'unlisted_english_language_test');
  }
  const componentValues = Object.values(language.components || {});
  const passed =
    language.overall >= accepted.minimum_overall &&
    componentValues.length === 4 &&
    componentValues.every((value) => value >= accepted.minimum_each_component);
  return passed ? null : outcome('not_eligible', 'english_language_requirement_not_met');
}

function evaluateInternational(applicant) {
  if (applicant.qualification_route === 'international_qualification') {
    const unsupported = profile.stage_1_eligibility
      .unsupported_international_qualifications
      .some((item) => normaliseId(item.qualification) ===
        normaliseId(applicant.international_qualification?.name));
    return unsupported
      ? outcome(
          'not_eligible',
          'explicitly_unsupported_international_qualification'
        )
      : outcome('manual_review', 'unlisted_international_qualification');
  }
  const academicFailure = evaluateALevel(applicant, false, true);
  if (academicFailure) {
    return academicFailure;
  }
  const languageFailure = evaluateEnglishLanguage(applicant);
  if (languageFailure) {
    return languageFailure;
  }
  const ucatFailure = evaluateUcat(applicant);
  if (ucatFailure) {
    return ucatFailure;
  }
  return outcome('eligible', null, {
    pool_id: 'international',
    ranking: {
      metric: 'ucat_total',
      value: applicant.admissions_tests.ucat.total_score
    },
    non_academic_review: 'manual_review'
  });
}

function evaluateApplicant(applicant) {
  const resitOutcome = evaluateResit(applicant);
  if (resitOutcome) {
    return resitOutcome;
  }
  const route = normaliseId(applicant.qualification_route);
  const blockedRoutes = profile.stage_1_eligibility.post_16.blocked_routes
    .map((item) => item.route_id);
  if (blockedRoutes.includes(route)) {
    return outcome('not_eligible', 'blocked_qualification_route');
  }
  if (route === 'ukwpmed') {
    return evaluateUkWpMed(applicant);
  }
  if (applicant.applicant_identity?.fee_status === 'International') {
    return evaluateInternational(applicant);
  }
  if (route === 'graduate') {
    return evaluateGraduate(applicant);
  }
  const ucatFailure = evaluateUcat(applicant);
  if (ucatFailure) {
    return ucatFailure;
  }
  if (route === 'international_baccalaureate') {
    const failure = evaluateIb(applicant);
    return failure || outcome('eligible', null, {
      qualification_route: route
    });
  }
  if (route === 'scottish') {
    const failure = evaluateScottish(applicant);
    return failure || outcome('eligible', null, {
      qualification_route: route
    });
  }
  if (route === 'irish_leaving_certificate') {
    const failure = evaluateIrish(applicant);
    return failure || outcome('eligible', null, {
      qualification_route: route
    });
  }
  if (route !== 'a_level') {
    return outcome('manual_review', 'unrepresented_qualification_route');
  }

  const contextual = applicant.applicant_identity?.contextual === true;
  const gcse = evaluateGcse(applicant);
  if (gcse.status) {
    return gcse;
  }
  const aLevelFailure = evaluateALevel(applicant, contextual);
  if (aLevelFailure) {
    return aLevelFailure;
  }
  return outcome('eligible', null, {
    pool_id: contextual ? 'home_contextual_scored' : 'home_standard',
    science_route: gcse.science_route,
    score: scoreHomeApplicant(applicant, contextual)
  });
}

function assertExpected(id, result, expected) {
  assert.strictEqual(result.status, expected.status, `${id}: status`);
  if (expected.reason) {
    assert.ok(result.reasons.includes(expected.reason), `${id}: reason`);
  }
  if (expected.pool_id) {
    assert.strictEqual(result.pool_id, expected.pool_id, `${id}: pool`);
  }
  if (expected.science_route) {
    assert.strictEqual(
      result.science_route,
      expected.science_route,
      `${id}: science route`
    );
  }
  if (Object.hasOwn(expected, 'guaranteed_interview')) {
    assert.strictEqual(
      result.guaranteed_interview,
      expected.guaranteed_interview,
      `${id}: guaranteed interview`
    );
  }
  if (expected.qualification_route) {
    assert.strictEqual(
      result.qualification_route,
      expected.qualification_route,
      `${id}: qualification route`
    );
  }
  if (expected.ranking_metric) {
    assert.deepStrictEqual(result.ranking, {
      metric: expected.ranking_metric,
      value: expected.ranking_value
    }, `${id}: ranking`);
  }
  if (expected.non_academic_review) {
    assert.strictEqual(
      result.non_academic_review,
      expected.non_academic_review,
      `${id}: non-academic review`
    );
  }
  for (const field of [
    'gcse_raw_points',
    'gcse_scaled_score',
    'ucat_points',
    'contextual_points',
    'application_score'
  ]) {
    if (Object.hasOwn(expected, field)) {
      assert.strictEqual(result.score[field], expected[field], `${id}: ${field}`);
    }
  }
  if (Object.hasOwn(expected, 'sjt_used_pre_interview')) {
    assert.strictEqual(
      result.sjt_used_pre_interview,
      expected.sjt_used_pre_interview,
      `${id}: SJT use`
    );
  }
  if (Object.hasOwn(expected, 'sjt_band_4_rejected')) {
    assert.strictEqual(
      result.sjt_band_4_rejected,
      expected.sjt_band_4_rejected,
      `${id}: SJT Band 4`
    );
  }
  if (Object.hasOwn(expected, 'contextual_gcse_minimum_reduced')) {
    assert.strictEqual(
      profile.stage_1_eligibility.gcse.contextual_minimum_reduction,
      expected.contextual_gcse_minimum_reduced,
      `${id}: contextual GCSE minimum`
    );
  }
}

assert.strictEqual(fixture.course_profile_id, profile.profile_id);
assert.strictEqual(fixture.cases.length, 25, 'Exactly 25 Phase 6 cases are required.');
assert.deepStrictEqual(
  fixture.cases.map((testCase) => testCase.requirement_number),
  Array.from({ length: 25 }, (_, index) => index + 1),
  'Requirement coverage must be exactly 1 through 25.'
);

let executedScenarios = 0;
for (const testCase of fixture.cases) {
  const base = fixture.base_applicants[testCase.base];
  assert.ok(base, `${testCase.case_id}: fixture base must exist`);
  if (testCase.variants) {
    for (const variant of testCase.variants) {
      const applicant = merge(base, variant.overrides || {});
      const result = evaluateApplicant(applicant);
      assertExpected(
        `${testCase.case_id}/${variant.variant_id}`,
        result,
        variant.expected
      );
      executedScenarios += 1;
    }
  } else {
    const applicant = merge(base, testCase.overrides || {});
    const result = evaluateApplicant(applicant);
    assertExpected(testCase.case_id, result, testCase.expected);
    executedScenarios += 1;
  }
}

const sjt = profile.stage_1_eligibility.admissions_tests.sjt;
assert.strictEqual(sjt.used_as_eligibility_gate, false);
assert.strictEqual(sjt.used_for_interview_selection, false);
assert.strictEqual(sjt.band_4_automatic_rejection, false);
assert.ok(sjt.accepted_bands.includes(4));

assert.strictEqual(
  profile.stage_1_eligibility.admissions_tests.current_cycle_decile_boundaries.available,
  false
);
assert.strictEqual(
  profile.stage_2_interview_selection.thresholds
    .find((threshold) => threshold.threshold_id ===
      'home_current_application_score_threshold').value,
  null
);
assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.strictEqual(config.score_model.guidance_policy.probability_output_allowed, false);
assert.strictEqual(config.offer_prediction, undefined);
assert.strictEqual(profile.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(profile.offer_selection.offer_model.prediction_enabled, false);

const sharedIntegrationCases = [
  {
    case_id: 'shared_home_standard_a_level',
    applicant: fixture.base_applicants.home_standard,
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_home_standard_sjt_band_4',
    applicant: merge(fixture.base_applicants.home_standard, {
      admissions_tests: {
        ucat: {
          sjt_band: 4
        }
      }
    }),
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_contextual_status_with_unsupported_polar4_remains_standard',
    applicant: merge(fixture.base_applicants.home_standard, {
      applicant_identity: {
        contextual: true,
        contextual_status_confirmed: true,
        polar4_quintile: 'not_a_birmingham_quintile'
      }
    }),
    expected_status: 'eligible',
    expected_excluded_applicant_groups: ['contextual']
  },
  {
    case_id: 'shared_ucat_required',
    applicant: merge(fixture.base_applicants.home_standard, {
      admissions_tests: {
        ucat: {
          taken: false,
          total_score: null
        }
      }
    }),
    expected_status: 'not_eligible',
    expected_failure: 'required_admissions_test_missing:ucat'
  },
  {
    case_id: 'shared_ib',
    applicant: fixture.base_applicants.ib,
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_scottish',
    applicant: fixture.base_applicants.scottish,
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_irish',
    applicant: fixture.base_applicants.irish,
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_graduate',
    applicant: fixture.base_applicants.graduate,
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_international_a_level',
    applicant: fixture.base_applicants.international_a_level,
    expected_status: 'eligible'
  },
  {
    case_id: 'shared_ukwpmed',
    applicant: fixture.base_applicants.ukwpmed,
    expected_status: 'eligible',
    expected_guaranteed_interview: true
  }
];

for (const integrationCase of sharedIntegrationCases) {
  const result = evaluateCourseEligibility(
    profile,
    clone(integrationCase.applicant)
  );
  assert.strictEqual(
    result.status,
    integrationCase.expected_status,
    `${integrationCase.case_id}: shared eligibility status; ` +
      `failures=${result.failures.join(',')}; ` +
      `manual_review=${result.manual_review_reasons.join(',')}`
  );
  if (integrationCase.expected_failure) {
    assert.ok(
      result.failures.includes(integrationCase.expected_failure),
      `${integrationCase.case_id}: shared eligibility failure`
    );
  }
  for (const groupId of integrationCase.expected_excluded_applicant_groups || []) {
    assert.ok(
      !result.applicant_group_ids.includes(groupId),
      `${integrationCase.case_id}: unexpected derived applicant group ${groupId}`
    );
  }
  if (Object.hasOwn(integrationCase, 'expected_guaranteed_interview')) {
    assert.strictEqual(
      result.guaranteed_interview,
      integrationCase.expected_guaranteed_interview,
      `${integrationCase.case_id}: guaranteed interview`
    );
  }
}

const sharedClassifierCases = [
  {
    case_id: 'classifier_home_standard',
    applicant: fixture.base_applicants.home_standard,
    expected_pool: 'home_standard',
    expected_score: 8.5,
    expected_band: 'interview_likely'
  },
  {
    case_id: 'classifier_home_contextual_scored',
    applicant: merge(fixture.base_applicants.home_standard, {
      applicant_identity: {
        contextual: true,
        contextual_status_confirmed: true,
        polar4_quintile: 'Q1'
      }
    }),
    expected_pool: 'home_contextual_scored',
    expected_score: 10,
    expected_band: 'interview_likely'
  },
  {
    case_id: 'classifier_ukwpmed_guaranteed_interview',
    applicant: fixture.base_applicants.ukwpmed,
    expected_pool: 'ukwpmed_guaranteed_interview',
    expected_interview_outcome: 'guaranteed_interview'
  },
  {
    case_id: 'classifier_international',
    applicant: fixture.base_applicants.international_a_level,
    expected_pool: 'international',
    expected_score: 2300,
    expected_band: 'interview_likely',
    expected_manual_review: true
  },
  {
    case_id: 'classifier_graduate_a100',
    applicant: fixture.base_applicants.graduate,
    expected_pool: 'graduate_a100',
    expected_score: 2250,
    expected_band: 'insufficient_evidence'
  }
];

const requiredGuidanceLabels = [
  'historical_guidance_only',
  'medium_confidence',
  'not_current_cutoff',
  'non_deterministic_ranking'
];

for (const classifierCase of sharedClassifierCases) {
  const result = classifyInterviewBand(
    profile,
    config,
    clone(classifierCase.applicant)
  );
  assert.strictEqual(
    result.eligibility.status,
    'eligible',
    `${classifierCase.case_id}: shared classifier eligibility`
  );
  assert.strictEqual(
    result.guidance_pool_id,
    classifierCase.expected_pool,
    `${classifierCase.case_id}: shared classifier pool`
  );
  requiredGuidanceLabels.forEach((label) => {
    assert.ok(
      result.warnings.includes(label),
      `${classifierCase.case_id}: missing guidance warning ${label}`
    );
  });
  assert.strictEqual(
    result.offer_prediction_status,
    undefined,
    `${classifierCase.case_id}: interview-only output`
  );
  if (Object.hasOwn(classifierCase, 'expected_score')) {
    assert.strictEqual(
      result.ranking.value,
      classifierCase.expected_score,
      `${classifierCase.case_id}: shared classifier ranking value`
    );
  }
  if (classifierCase.expected_band) {
    assert.strictEqual(
      result.canonical_interview_band,
      classifierCase.expected_band,
      `${classifierCase.case_id}: shared classifier band`
    );
  }
  if (classifierCase.expected_interview_outcome) {
    assert.strictEqual(
      result.interview_outcome,
      classifierCase.expected_interview_outcome,
      `${classifierCase.case_id}: shared classifier interview outcome`
    );
    assert.strictEqual(
      result.ranking,
      null,
      `${classifierCase.case_id}: UKWPMED must not use numerical ranking`
    );
  }
  if (Object.hasOwn(classifierCase, 'expected_manual_review')) {
    assert.strictEqual(
      result.manual_review_required,
      classifierCase.expected_manual_review,
      `${classifierCase.case_id}: manual review`
    );
    assert.ok(
      result.non_executable_checks.includes(
        'international_personal_statement_and_non_academic_review'
      ),
      `${classifierCase.case_id}: non-academic review safeguard`
    );
  }
}

const sharedInterviewSjtBand4 = classifyInterviewBand(
  profile,
  config,
  merge(fixture.base_applicants.home_standard, {
    admissions_tests: {
      ucat: {
        sjt_band: 4
      }
    }
  })
);
assert.strictEqual(sharedInterviewSjtBand4.eligibility.status, 'eligible');
assert.strictEqual(sharedInterviewSjtBand4.guidance_pool_id, 'home_standard');
assert.strictEqual(sharedInterviewSjtBand4.canonical_interview_band, 'interview_likely');
assert.ok(!sharedInterviewSjtBand4.eligibility.failures.includes('sjt_band_excluded'));

const sharedInterviewMissingUcat = classifyInterviewBand(
  profile,
  config,
  merge(fixture.base_applicants.home_standard, {
    admissions_tests: {
      ucat: {
        taken: false,
        total_score: null
      }
    }
  })
);
assert.strictEqual(
  sharedInterviewMissingUcat.eligibility.status,
  'not_eligible',
  'shared interview engine must enforce Birmingham UCAT'
);
assert.ok(
  sharedInterviewMissingUcat.eligibility.failures.includes(
    'required_admissions_test_missing:ucat'
  ),
  'shared interview engine must expose the missing UCAT failure'
);

const sharedInterviewWithoutManualDecile = classifyInterviewBand(
  profile,
  config,
  fixture.base_applicants.home_standard
);
assert.strictEqual(sharedInterviewWithoutManualDecile.eligibility.status, 'eligible');
assert.strictEqual(sharedInterviewWithoutManualDecile.guidance_pool_id, 'home_standard');
assert.strictEqual(sharedInterviewWithoutManualDecile.ranking.status, 'calculated');
assert.strictEqual(
  sharedInterviewWithoutManualDecile.canonical_interview_band,
  'interview_likely'
);

const sharedInterviewWithoutUsableDecileData = classifyInterviewBand(
  profile,
  config,
  fixture.base_applicants.home_standard,
  {
    ucatDecileData: {
      score_scale: {
        cognitive_total_min: 900,
        cognitive_total_max: 2700
      }
    }
  }
);
assert.strictEqual(sharedInterviewWithoutUsableDecileData.eligibility.status, 'eligible');
assert.strictEqual(sharedInterviewWithoutUsableDecileData.ranking.status, 'unavailable');
assert.strictEqual(
  sharedInterviewWithoutUsableDecileData.ranking.reason,
  'ucat_decile_lookup_unavailable'
);
assert.strictEqual(
  sharedInterviewWithoutUsableDecileData.canonical_interview_band,
  'insufficient_evidence'
);

for (const practicalProfile of [
  {
    subjects: fixture.base_applicants.home_standard.a_level_profile.subjects.map(
      (subject) => ({
        ...subject,
        practical_endorsement:
          subject.subject_id === 'chemistry' ? 'fail' : null
      })
    )
  },
  {
    ...fixture.base_applicants.home_standard.a_level_profile,
    practical_passes: {
      chemistry: false,
      biology: false
    }
  }
]) {
  const result = classifyInterviewBand(
    profile,
    config,
    merge(fixture.base_applicants.home_standard, {
      a_level_profile: practicalProfile
    })
  );
  assert.strictEqual(
    result.eligibility.status,
    'eligible',
    'Birmingham must ignore practical endorsement without a recorded requirement'
  );
  assert.ok(
    !result.eligibility.failures.some((failure) => {
      return failure.includes('practical') || failure.includes('endorsement');
    })
  );
}

for (const applicant of [
  merge(fixture.base_applicants.ukwpmed, {
    ukwpmed: {
      declared_in_ucas_extra_activities: false
    }
  }),
  merge(fixture.base_applicants.ukwpmed, {
    gcse_profile: {
      subjects: {
        biology: '4'
      }
    }
  })
]) {
  const result = classifyInterviewBand(profile, config, applicant);
  assert.notStrictEqual(
    result.interview_outcome,
    'guaranteed_interview',
    'UKWPMED guarantee must require every official condition'
  );
}

const graduateClassifierResult = classifyInterviewBand(
  profile,
  config,
  clone(fixture.base_applicants.graduate)
);
assert.ok(
  graduateClassifierResult.eligibility.checks.some(
    (check) => (check.check_id || check.check) === 'ucat_required'
  ),
  'Graduate A100 must require UCAT'
);
assert.ok(
  !graduateClassifierResult.eligibility.checks.some(
    (check) => String(check.check_id || check.check).includes('gamsat')
  ),
  'Graduate A100 must not use GAMSAT'
);

// Approved home_standard band change: score >= 7.236 (the official 2025-entry
// historical minimum application score for standard Home applicants invited
// to interview) now classifies as the canonical 'interview_likely' band
// ('Strong Choice'), not 'realistic'. Below 7.236 is unchanged
// ('high_risk'). Only home_standard's band_rules were touched; 7.236 itself
// is an external published statistic and is not reproducible as an exact
// applicant score through Birmingham's own GCSE (0.1875 increments) + UCAT
// decile (fixed 0/0.44/.../4 points) formula, so the exact boundary is
// pinned directly against the approved rule definition below, while 7.235
// and 8.5 are verified end-to-end through real, achievable applicant scores.
const homeStandardPool = config.guidance_pools.find((pool) => pool.pool_id === 'home_standard');
assert.ok(homeStandardPool, 'expected a home_standard guidance pool in the Birmingham config');
const homeStandardStrongRule = homeStandardPool.band_rules.find((rule) => rule.band === 'interview_likely');
assert.ok(
  homeStandardStrongRule,
  'expected home_standard to define an interview_likely band rule for the approved Strong Choice change'
);
assert.strictEqual(homeStandardStrongRule.operator, 'greater_than_or_equal');
assert.strictEqual(
  homeStandardStrongRule.value,
  7.236,
  'the approved Strong Choice boundary must remain Birmingham’s official 2025-entry historical minimum application score'
);
const homeStandardHighRiskRule = homeStandardPool.band_rules.find((rule) => rule.band === 'high_risk');
assert.ok(homeStandardHighRiskRule, 'expected home_standard to retain its existing high_risk band rule');
assert.strictEqual(homeStandardHighRiskRule.operator, 'less_than');
assert.strictEqual(homeStandardHighRiskRule.value, 7.236, 'the below-threshold boundary must be unchanged');
assert.strictEqual(
  homeStandardPool.band_rules.some((rule) => rule.band === 'realistic'),
  false,
  'home_standard must no longer have a realistic band now that 7.236+ is Strong Choice'
);

// 7.235 (just below 7.236): must retain the existing below-threshold outcome.
const belowThresholdApplicant = merge(fixture.base_applicants.home_standard, {
  gcse_profile: { subjects: { mathematics: '7' } },
  admissions_tests: { ucat: { total_score: 2050 } }
});
const belowThresholdResult = classifyInterviewBand(profile, config, belowThresholdApplicant);
assert.strictEqual(belowThresholdResult.guidance_pool_id, 'home_standard');
assert.strictEqual(belowThresholdResult.ranking.value, 7.235, 'boundary fixture must compute to 7.235');
assert.strictEqual(
  belowThresholdResult.canonical_interview_band,
  'high_risk',
  '7.235 (below 7.236) must retain the existing below-threshold/high-risk outcome'
);

// 8.5 (at/above 7.236): must classify as Strong Choice (interview_likely).
const strongApplicantResult = classifyInterviewBand(
  profile,
  config,
  clone(fixture.base_applicants.home_standard)
);
assert.strictEqual(strongApplicantResult.guidance_pool_id, 'home_standard');
assert.strictEqual(strongApplicantResult.ranking.value, 8.5, 'boundary fixture must compute to 8.5');
assert.strictEqual(
  strongApplicantResult.canonical_interview_band,
  'interview_likely',
  '8.5 (>= 7.236) must classify as Strong Choice (interview_likely)'
);

const contextualBelowThresholdResult = classifyInterviewBand(
  profile,
  config,
  merge(fixture.base_applicants.home_standard, {
    applicant_identity: {
      contextual: true,
      contextual_status_confirmed: true,
      polar4_quintile: 'Q5'
    },
    admissions_tests: {
      ucat: {
        total_score: 2050
      }
    },
    gcse_profile: {
      subjects: {
        english_language: '6',
        english_literature: '6',
        mathematics: '6',
        biology: '6',
        chemistry: '6',
        history: '7',
        geography: '7'
      }
    }
  })
);
assert.strictEqual(contextualBelowThresholdResult.guidance_pool_id, 'home_contextual_scored');
assert.ok(
  contextualBelowThresholdResult.ranking.value < 8.561,
  'contextual below-threshold boundary fixture must remain below 8.561'
);
assert.strictEqual(
  contextualBelowThresholdResult.canonical_interview_band,
  'high_risk',
  '<8.561 must remain high_risk for Birmingham home_contextual_scored'
);

console.log('PASS: Birmingham home_standard 7.236 boundary (7.235 -> high_risk unchanged, 8.5 -> interview_likely/Strong Choice) and rule definition verified');

console.log(
  `Birmingham A100 readiness regression: PASS ` +
  `(${fixture.cases.length} fixture cases; ${executedScenarios} executed scenarios; ` +
  `${sharedIntegrationCases.length + sharedClassifierCases.length + 5} shared-engine integration cases)`
);
