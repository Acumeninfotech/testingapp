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
  humanManualReviewReason,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
const {
  predict
} = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (Array.isArray(overrides) || overrides === null || typeof overrides !== 'object') {
    return clone(overrides);
  }

  const result = clone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }
  return result;
}

const course = readJson('data/universities/leicester-a100.json');
const config = readJson('data/interview-band-configs/leicester-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/leicester-a100.json');

function subject(subjectId, predictedGrade) {
  return {
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    sitting_status: 'first_sitting'
  };
}

function applicantWith({ subjects = null, grades = ['A*', 'A', 'A'], epq = undefined, overrides = {} } = {}) {
  const defaultSubjects = [
    subject('chemistry', grades[0]),
    subject('biology', grades[1]),
    subject('mathematics', grades[2])
  ];
  const aLevelProfile = {
    subjects: subjects || defaultSubjects,
    sitting_status: 'first_sitting'
  };
  if (epq !== undefined) {
    aLevelProfile.epq = epq;
  }
  return merge(fixture.base_applicant, merge({
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 700,
          decision_making: 750,
          quantitative_reasoning: 750
        },
        sjt_band: 2,
        test_year: 2026
      }
    },
    a_level_profile: aLevelProfile
  }, overrides));
}

function classify(applicant, courseProfile = course, interviewConfig = config) {
  return classifyInterviewBand(courseProfile, interviewConfig, applicant);
}

function assertAcademicScenario({
  label,
  applicant,
  expectedStatus,
  expectedPathway,
  expectedPathwayId,
  expectedBand,
  expectedFailure,
  expectedManualReviewReason,
  expectedEpqFailedCondition,
  expectedEpqReason
}) {
  const eligibility = evaluateCourseEligibility(course, applicant);
  const classification = classify(applicant);

  assert.strictEqual(eligibility.status, expectedStatus, `${label}: generic eligibility status`);
  assert.strictEqual(
    classification.eligibility.status,
    expectedStatus,
    `${label}: classifier eligibility status`
  );
  assert.strictEqual(
    eligibility.academic_pathway ?? null,
    expectedPathway,
    `${label}: generic academic pathway`
  );
  assert.strictEqual(
    classification.eligibility.academic_pathway ?? null,
    expectedPathway,
    `${label}: classifier academic pathway`
  );
  assert.strictEqual(
    eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: generic academic pathway id`
  );
  assert.strictEqual(
    classification.eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: classifier academic pathway id`
  );
  assert.strictEqual(
    classification.canonical_interview_band,
    expectedBand,
    `${label}: classifier band`
  );

  if (expectedFailure) {
    assert.ok(eligibility.failures.includes(expectedFailure), `${label}: generic failure`);
    assert.ok(classification.eligibility.failures.includes(expectedFailure), `${label}: classifier failure`);
  }
  if (expectedManualReviewReason) {
    assert.ok(
      eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: generic manual-review reason ${JSON.stringify(eligibility.manual_review_reasons)}`
    );
    assert.ok(
      classification.eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: classifier manual-review reason ${JSON.stringify(classification.eligibility.manual_review_reasons)}`
    );
  } else {
    assert.deepStrictEqual(eligibility.manual_review_reasons, [], `${label}: no generic manual review`);
    assert.deepStrictEqual(
      classification.eligibility.manual_review_reasons,
      [],
      `${label}: no classifier manual review`
    );
  }
  if (expectedEpqFailedCondition) {
    assert.ok(
      classification.eligibility.epq_alternative_result?.failed_conditions.includes(expectedEpqFailedCondition),
      `${label}: EPQ failed condition ${JSON.stringify(classification.eligibility.epq_alternative_result)}`
    );
  }
  if (expectedEpqReason) {
    assert.ok(
      classification.eligibility.epq_alternative_result?.reasons.includes(expectedEpqReason),
      `${label}: EPQ reason ${JSON.stringify(classification.eligibility.epq_alternative_result)}`
    );
  }
}

function publicCardFor(courseProfile, interviewConfig, applicant) {
  const classification = classifyInterviewBand(courseProfile, interviewConfig, applicant);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: {
        profile_id: courseProfile.profile_id,
        university_name: courseProfile.institution?.name,
        course_name: courseProfile.course?.name,
        ucas_code: courseProfile.course?.ucas_code
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: courseProfile.engine_notes,
      eligibility: classification.eligibility,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      academic_pathway: classification.eligibility.academic_pathway || null,
      academic_pathway_id: classification.eligibility.academic_pathway_id ?? null,
      stage_1_eligibility: courseProfile.stage_1_eligibility || null,
      stage_2_interview_selection: courseProfile.stage_2_interview_selection || null,
      contextual_admissions: courseProfile.contextual_admissions || null,
      historical_admissions: courseProfile.historical_admissions || null,
      selection_approach_display: courseProfile.selection_approach_display || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      guidance_pool_id: classification.guidance_pool_id || null,
      score_model: interviewConfig.score_model,
      warnings: classification.warnings || []
    }
  });
}

function publicAcademicChecksFor(applicant) {
  return publicCardFor(course, config, applicant).academic_requirement_checks || [];
}

function publicKey(check) {
  return `${check.qualification_type}:${check.label}`;
}

function assertNoDuplicatePublicAcademicLabels(checks, label) {
  const keys = checks.map(publicKey);
  assert.strictEqual(
    new Set(keys).size,
    keys.length,
    `${label}: duplicate public academic labels ${JSON.stringify(checks)}`
  );
}

function publicPost16PathwayChecks(checks) {
  return checks.filter((check) =>
    check.qualification_type === 'a_level' &&
    [
      'a_level_standard_offer',
      'epq_alternative_offer',
      'a_level_route'
    ].includes(check.requirement_type)
  );
}

function assertPublicPost16(label, applicant, expectedRows) {
  const checks = publicAcademicChecksFor(applicant);
  assertNoDuplicatePublicAcademicLabels(checks, label);
  assert.deepStrictEqual(
    publicPost16PathwayChecks(checks).map((check) => [
      check.label,
      check.status,
      check.requirement_type
    ]),
    expectedRows,
    `${label}: unexpected public post-16 rows ${JSON.stringify(checks)}`
  );
}

function assertNoSelectionScoring(label, applicant) {
  const classification = classify(applicant);
  assert.strictEqual(classification.eligibility.status, 'not_eligible', `${label}: classifier eligibility`);
  assert.strictEqual(classification.canonical_interview_band, 'not_eligible', `${label}: classifier band`);
  assert.strictEqual(classification.ranking, null, `${label}: classifier ranking must not be calculated`);
  assert.strictEqual(classification.band_metric, undefined, `${label}: classifier band metric must not exist`);
  assert.strictEqual(classification.guidance_pool_id, undefined, `${label}: classifier guidance pool must not exist`);

  const apiResult = predict({
    universityIds: ['leicester-a100'],
    studentProfile: applicant
  })[0].result_card;
  assert.strictEqual(apiResult.recommendation_display_state, 'not_eligible', `${label}: public state`);
  assert.strictEqual(apiResult.prediction.result_band, 'not_eligible', `${label}: public result band`);
  assert.strictEqual(
    apiResult.prediction.interview_prediction.available,
    false,
    `${label}: public interview prediction must not be available`
  );
  assert.strictEqual(
    apiResult.decision_transparency.score_breakdown,
    null,
    `${label}: public score breakdown must not be shown`
  );
  assert.strictEqual(
    apiResult.decision_transparency.selection_metric,
    null,
    `${label}: public selection metric must not be shown`
  );
  assert.notStrictEqual(
    apiResult.primary_user_facing_recommendation,
    'Strong choice for your application',
    `${label}: must not be a Strong Choice`
  );
}

function assertNoSubjectCombinationFailure(label, applicant) {
  const classification = classify(applicant);
  assert.ok(
    !(classification.eligibility.failures || []).includes('a_level_subject_combination_not_met'),
    `${label}: valid subject combinations must not be reported as subject failures`
  );
  const card = publicCardFor(course, config, applicant);
  assert.ok(
    !(card.academic_requirement_checks || []).some((check) =>
      check.requirement_type === 'a_level_subject_combination' &&
      check.status === 'not_met'
    ),
    `${label}: public card must not show required A-level subjects as failed`
  );
}

const EPQ_PATHWAY_ID = 'leicester_epq_alternative';
const EPQ_GRADE_REASON = `${EPQ_PATHWAY_ID}_epq_grade_required`;
const expectedScienceOptions = [
  ['biology', 'chemistry'],
  ['biology', 'physics'],
  ['biology', 'mathematics'],
  ['biology', 'psychology'],
  ['chemistry', 'biology'],
  ['chemistry', 'physics'],
  ['chemistry', 'mathematics'],
  ['chemistry', 'psychology']
];

assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.standard_offer.grade_profile, [
  'A*',
  'A',
  'A'
]);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.a_level.scoring_floor.grade_profile,
  ['A', 'A', 'B'],
  'Leicester AAB scoring floor should remain documented separately from eligibility.'
);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.a_level.grade_requirements.map((route) => [
    route.requirement_id,
    route.grade_profile
  ]),
  [
    ['a_level_leicester_access_leicester_medicine_contextual_offer', ['A', 'B', 'B']],
    ['a_level_leicester_realising_opportunities_contextual_offer', ['A', 'A', 'A']],
    ['a_level_leicester_imd_plus_indicator_contextual_offer', ['A', 'B', 'B']],
    ['a_level_standard_offer', ['A*', 'A', 'A']]
  ],
  'Leicester executable A-level eligibility routes should include contextual and standard pathways explicitly.'
);
assert.deepStrictEqual(
  config.eligibility.a_level.routes.map((route) => [
    route.route_id,
    route.grade_profile
  ]),
  [['a_level_standard_offer', ['A*', 'A', 'A']]],
  'Leicester classifier eligibility routes must not include the AAB scoring floor.'
);
assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.epq_alternative_offer, {
  enabled: true,
  pathway_id: EPQ_PATHWAY_ID,
  a_level_grades: ['A', 'A', 'A'],
  epq_minimum_grade: 'B',
  required_subject_grade_options: expectedScienceOptions.map(([first, second]) => ({
    option_id: `${first}_and_${second}_grade_a`,
    required_subject_ids: [first, second],
    grade_requirements: [
      {
        subject_id: first,
        minimum_grade: 'A'
      },
      {
        subject_id: second,
        minimum_grade: 'A'
      }
    ]
  })),
  conditions: {
    equivalent_grade_combinations_allowed: false
  }
});
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    course.stage_1_eligibility.post_16.a_level,
    'epq_alternative'
  ),
  false,
  'Leicester must use the canonical epq_alternative_offer field, not the legacy alias.'
);

{
  const activatedEpqProfiles = fs.readdirSync(path.join(rootDir, 'data/universities'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson(`data/universities/${file}`))
    .filter((profile) => profile.stage_1_eligibility?.post_16?.a_level?.epq_alternative_offer?.enabled === true)
    .map((profile) => profile.profile_id)
    .sort();
  assert.deepStrictEqual(activatedEpqProfiles, [
    'hull-york-a100',
    'keele-a100',
    'lancaster-a100',
    'leicester-a100',
    'queen-s-belfast-a100',
    'sheffield-a100'
  ]);
}

for (const [label, epq] of [
  ['A*AA no EPQ', undefined],
  ['A*AA EPQ planning', { status: 'planning', grade: null }]
]) {
  const applicant = applicantWith({ grades: ['A*', 'A', 'A'], epq });
  assertAcademicScenario({
    label,
    applicant,
    expectedStatus: 'eligible',
    expectedPathway: 'standard',
    expectedPathwayId: 'a_level_standard_offer',
    expectedBand: 'realistic'
  });
  assertPublicPost16(label, applicant, [['A-level grades', 'met', 'a_level_standard_offer']]);
}

{
  const applicant = applicantWith({
    grades: ['A*', 'A', 'A'],
    overrides: {
      gcse_profile: {
        subjects: {
          english_language: '9',
          mathematics: '9',
          chemistry: '9',
          biology: '9',
          physics: '8',
          english_literature: '8',
          history: '8',
          geography: '8'
        }
      },
      admissions_tests: {
        ucat: {
          total_score: 2400,
          subtests: {
            verbal_reasoning: 800,
            decision_making: 800,
            quantitative_reasoning: 800
          }
        }
      }
    }
  });
  const classification = classify(applicant);
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.eligibility.academic_pathway, 'standard');
  assert.strictEqual(classification.ranking.status, 'calculated');
  assert.strictEqual(classification.ranking.components.gcse_score.value, 44);
  assert.strictEqual(classification.ranking.components.ucat_score.value, 47);
  assert.strictEqual(classification.ranking.value, 91);
  assert.strictEqual(classification.ranking.max, 96);
  assert.strictEqual(classification.canonical_interview_band, 'interview_likely');
}

{
  const applicant = applicantWith({
    subjects: [
      subject('Chemistry', 'A'),
      subject('Biology', 'A'),
      subject('Mathematics', 'A')
    ],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true }
  });
  assertAcademicScenario({
    label: 'AAA achieved EPQ A display-case valid subjects',
    applicant,
    expectedStatus: 'eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedBand: 'realistic'
  });
  assertNoSubjectCombinationFailure('AAA achieved EPQ A display-case valid subjects', applicant);
  assertPublicPost16(
    'AAA achieved EPQ A display-case valid subjects',
    applicant,
    [['A-levels + EPQ', 'met', 'epq_alternative_offer']]
  );
}

{
  const applicant = applicantWith({ grades: ['A', 'A', 'B'] });
  assertAcademicScenario({
    label: 'AAB no EPQ',
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: 'a_level_standard_offer',
    expectedBand: 'not_eligible',
    expectedFailure: 'a_level_requirements_not_met'
  });
  assertNoSelectionScoring('AAB no EPQ', applicant);
  assertNoSubjectCombinationFailure('AAB no EPQ', applicant);
  assertPublicPost16('AAB no EPQ', applicant, [['A-level grades', 'not_met', 'a_level_standard_offer']]);
}

{
  const applicant = applicantWith({ grades: ['A', 'A', 'A'] });
  assertAcademicScenario({
    label: 'AAA no EPQ',
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: 'a_level_standard_offer',
    expectedBand: 'not_eligible',
    expectedFailure: 'a_level_requirements_not_met'
  });
  assertNoSelectionScoring('AAA no EPQ', applicant);
  assertNoSubjectCombinationFailure('AAA no EPQ', applicant);
  assertPublicPost16('AAA no EPQ', applicant, [['A-level grades', 'not_met', 'a_level_standard_offer']]);
  const card = publicCardFor(course, config, applicant);
  assert.deepStrictEqual(card.alternative_academic_offer, {
    type: 'epq',
    standard_offer: 'A*AA',
    alternative_offer: 'AAA + EPQ Grade B',
    epq_minimum_grade: 'B',
    pathway_id: EPQ_PATHWAY_ID,
    conditions: []
  });
  assert.ok(
    !(card.academic_requirement_checks || []).some((check) =>
      check.requirement_type === 'epq_alternative_offer' &&
      check.status === 'met'
    ),
    'AAA no EPQ: EPQ alternative must not be displayed as met.'
  );
  assert.match(card.primary_explanation, /A-level grades/i);
  assert.doesNotMatch(card.primary_explanation, /subjects do not match/i);
}

for (const [label, epq] of [
  ['AAA predicted EPQ B', { status: 'predicted', grade: 'B' }],
  ['AAA achieved EPQ B', { status: 'achieved', grade: 'B' }],
  ['AAA achieved EPQ A', { status: 'achieved', grade: 'A' }],
  ['AAA achieved EPQ A*', { status: 'achieved', grade: 'A*' }]
]) {
  const applicant = applicantWith({ grades: ['A', 'A', 'A'], epq });
  assertAcademicScenario({
    label,
    applicant,
    expectedStatus: 'eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedBand: 'realistic'
  });
  assertPublicPost16(label, applicant, [['A-levels + EPQ', 'met', 'epq_alternative_offer']]);
}

for (const [label, epq] of [
  ['AAA EPQ C', { status: 'achieved', grade: 'C' }],
  ['AAA EPQ not taken', { status: 'not_taken', grade: null }]
]) {
  const applicant = applicantWith({ grades: ['A', 'A', 'A'], epq });
  assertAcademicScenario({
    label,
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: null,
    expectedPathwayId: null,
    expectedBand: 'not_eligible',
    expectedFailure: 'a_level_requirements_not_met',
    ...(epq.status === 'achieved'
      ? { expectedEpqFailedCondition: 'epq_minimum_grade' }
      : { expectedEpqReason: 'epq_not_taken' })
  });
  assertPublicPost16(
    label,
    applicant,
    epq.status === 'achieved'
      ? [['A-levels + EPQ', 'not_met', 'epq_alternative_offer']]
      : [['A-level grades', 'not_met', 'a_level_standard_offer']]
  );
}

for (const [label, epq] of [
  ['AAA EPQ planning', { status: 'planning', grade: null }],
  ['AAA predicted EPQ missing grade', { status: 'predicted', grade: null }],
  ['AAA achieved EPQ missing grade', { status: 'achieved', grade: null }]
]) {
  const applicant = applicantWith({ grades: ['A', 'A', 'A'], epq });
  assertAcademicScenario({
    label,
    applicant,
    expectedStatus: 'manual_review',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedBand: 'insufficient_evidence',
    expectedManualReviewReason: EPQ_GRADE_REASON
  });
  const card = publicCardFor(course, config, applicant);
  assert.deepStrictEqual(
    publicPost16PathwayChecks(card.academic_requirement_checks || []).map((check) => [
      check.label,
      check.status,
      check.requirement_type
    ]),
    [['A-levels + EPQ', 'information_needed', 'epq_alternative_offer']],
    `${label}: unexpected public post-16 rows ${JSON.stringify(card.academic_requirement_checks)}`
  );
  assert.match(
    card.primary_explanation,
    /predicted or achieved EPQ grade/i,
    `${label}: should explain EPQ grade requirement: ${card.primary_explanation}`
  );
}

{
  const applicant = applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'achieved', grade: 'A' } });
  assertAcademicScenario({
    label: 'AAB EPQ A',
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: null,
    expectedPathwayId: null,
    expectedBand: 'not_eligible',
    expectedFailure: 'a_level_requirements_not_met',
    expectedEpqFailedCondition: 'a_level_grade_profile'
  });
  assertNoSelectionScoring('AAB EPQ A', applicant);
  assertNoSubjectCombinationFailure('AAB EPQ A', applicant);
  assertPublicPost16('AAB EPQ A', applicant, [['A-levels + EPQ', 'not_met', 'epq_alternative_offer']]);
}

{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('english_literature', 'A'),
      subject('history', 'A')
    ],
    epq: { status: 'achieved', grade: 'B' }
  });
  assertAcademicScenario({
    label: 'AAA EPQ B invalid science combination',
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: null,
    expectedPathwayId: null,
    expectedBand: 'not_eligible',
    expectedFailure: 'a_level_requirements_not_met',
    expectedEpqFailedCondition: 'required_subject_grade_options'
  });
  assertPublicPost16(
    'AAA EPQ B invalid science combination',
    applicant,
    [['A-levels + EPQ', 'not_met', 'epq_alternative_offer']]
  );
}

{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('mathematics', 'A')
    ],
    epq: { status: 'achieved', grade: 'B' }
  });
  const generic = evaluateCourseEligibility(course, applicant);
  const classification = classify(applicant);

  assert.strictEqual(generic.status, 'manual_review');
  assert.strictEqual(generic.academic_pathway, 'epq_alternative');
  assert.ok(generic.manual_review_reasons.includes('a_level_grade_evidence_missing'));
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assert.ok(classification.eligibility.failures.includes('a_level_subject_combination_not_met'));
  assert.ok(classification.eligibility.manual_review_reasons.includes('a_level_grade_evidence_missing'));
  assert.ok(
    classification.eligibility.epq_alternative_result?.reasons.includes('a_level_grade_evidence_missing')
  );
  assert.deepStrictEqual(
    publicPost16PathwayChecks(publicAcademicChecksFor(applicant)).map((check) => [
      check.label,
      check.status,
      check.requirement_type
    ]),
    [['A-levels + EPQ', 'information_needed', 'epq_alternative_offer']]
  );
}

{
  const applicant = applicantWith({ grades: ['A', 'A', 'A'] });
  const courseWithoutEpq = clone(course);
  delete courseWithoutEpq.stage_1_eligibility.post_16.a_level.epq_alternative_offer;
  const current = classify(applicant, course, config);
  const baseline = classify(applicant, courseWithoutEpq, config);
  assert.deepStrictEqual(
    {
      status: current.eligibility.status,
      band: current.canonical_interview_band,
      guidance_pool_id: current.guidance_pool_id ?? null,
      selection_route_id: current.selection_route_id ?? null,
      ranking: current.ranking
    },
    {
      status: baseline.eligibility.status,
      band: baseline.canonical_interview_band,
      guidance_pool_id: baseline.guidance_pool_id ?? null,
      selection_route_id: baseline.selection_route_id ?? null,
      ranking: baseline.ranking
    },
    'legacy AAA applicant without an EPQ object should match the pre-EPQ baseline'
  );
}

{
  const applicant = applicantWith({ grades: ['A*', 'A', 'A'] });
  const courseWithoutEpq = clone(course);
  delete courseWithoutEpq.stage_1_eligibility.post_16.a_level.epq_alternative_offer;
  const current = classify(applicant, course, config);
  const baseline = classify(applicant, courseWithoutEpq, config);
  assert.deepStrictEqual(
    {
      status: current.eligibility.status,
      band: current.canonical_interview_band,
      guidance_pool_id: current.guidance_pool_id ?? null,
      selection_route_id: current.selection_route_id ?? null,
      ranking: current.ranking
    },
    {
      status: baseline.eligibility.status,
      band: baseline.canonical_interview_band,
      guidance_pool_id: baseline.guidance_pool_id ?? null,
      selection_route_id: baseline.selection_route_id ?? null,
      ranking: baseline.ranking
    },
    'standard A*AA result should match the pre-EPQ baseline'
  );
}

{
  const contextualApplicant = applicantWith({
    grades: ['A*', 'A', 'A'],
    overrides: {
      applicant_identity: {
        contextual: true,
        widening_participation: true
      }
    }
  });
  const courseWithoutEpq = clone(course);
  delete courseWithoutEpq.stage_1_eligibility.post_16.a_level.epq_alternative_offer;
  assert.strictEqual(
    classify(contextualApplicant, course, config).canonical_interview_band,
    classify(contextualApplicant, courseWithoutEpq, config).canonical_interview_band,
    'contextual classification should remain unchanged'
  );
}

{
  const resitApplicant = applicantWith({
    grades: ['A*', 'A', 'A'],
    overrides: {
      applicant_identity: {
        resit: {
          has_resits: true
        }
      }
    }
  });
  const courseWithoutEpq = clone(course);
  delete courseWithoutEpq.stage_1_eligibility.post_16.a_level.epq_alternative_offer;
  assert.strictEqual(
    classify(resitApplicant, course, config).eligibility.status,
    classify(resitApplicant, courseWithoutEpq, config).eligibility.status,
    'existing resit eligibility handling should remain unchanged'
  );
}

{
  const apiResult = predict({
    universityIds: ['leicester-a100'],
    studentProfile: applicantWith({
      grades: ['A', 'A', 'A'],
      epq: { status: 'achieved', grade: 'B' }
    })
  })[0];
  assert.strictEqual(apiResult.result_card.academic_pathway, 'epq_alternative');
  assert.strictEqual(apiResult.result_card.academic_pathway_id, EPQ_PATHWAY_ID);
  assert.deepStrictEqual(
    publicPost16PathwayChecks(apiResult.result_card.academic_requirement_checks || []).map((check) => [
      check.label,
      check.status,
      check.requirement_type
    ]),
    [['A-levels + EPQ', 'met', 'epq_alternative_offer']]
  );
}

console.log('Leicester EPQ alternative offer activation: PASS');
