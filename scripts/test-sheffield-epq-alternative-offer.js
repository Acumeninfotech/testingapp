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

const course = readJson('data/universities/sheffield-a100.json');
const config = readJson('data/interview-band-configs/sheffield-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/sheffield-a100.json');
const southamptonCourse = readJson('data/universities/southampton-a100.json');
const southamptonConfig = readJson('data/interview-band-configs/southampton-a100.json');
const southamptonFixture = readJson('data/fixtures/interview-band-classification/southampton-a100.json');

function subject(subjectId, predictedGrade, sittingStatus = 'first_sitting') {
  return {
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    ...(sittingStatus ? { sitting_status: sittingStatus } : {}),
    ...(['biology', 'chemistry', 'physics'].includes(subjectId)
      ? { practical_endorsement: 'pass' }
      : {})
  };
}

function applicantWith({
  subjects = [
    subject('biology', 'A'),
    subject('chemistry', 'A'),
    subject('mathematics', 'A')
  ],
  epq = undefined,
  hasResits = false
} = {}) {
  const aLevelProfile = {
    subjects,
    has_resits: hasResits
  };
  if (epq !== undefined) {
    aLevelProfile.epq = epq;
  }
  return merge(fixture.base_applicant, {
    applicant_identity: {
      resit: {
        has_resits: hasResits
      }
    },
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
  });
}

function classify(applicant, courseProfile = course, interviewConfig = config) {
  return classifyInterviewBand(courseProfile, interviewConfig, applicant);
}

function publicCardFor(courseProfile, interviewConfig, applicant) {
  const classification = classify(applicant, courseProfile, interviewConfig);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: { profile_id: courseProfile.profile_id },
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
  return checks
    .filter((check) => check.qualification_type === 'a_level')
    .filter((check) => [
      'a_level_standard_offer',
      'epq_alternative_offer',
      'a_level_route'
    ].includes(check.requirement_type));
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

function assertAcademicScenario({
  label,
  applicant,
  expectedStatus,
  expectedPathway,
  expectedPathwayId,
  expectedBand,
  expectedFailure,
  expectedManualReviewReason,
  allowedManualReviewReasons = [],
  expectedEpqStatus,
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
  assert.strictEqual(eligibility.academic_pathway ?? null, expectedPathway, `${label}: generic pathway`);
  assert.strictEqual(
    classification.eligibility.academic_pathway ?? null,
    expectedPathway,
    `${label}: classifier pathway`
  );
  assert.strictEqual(
    eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: generic pathway id`
  );
  assert.strictEqual(
    classification.eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: classifier pathway id`
  );
  assert.strictEqual(classification.canonical_interview_band, expectedBand, `${label}: band`);

  if (expectedFailure) {
    assert.ok(eligibility.failures.includes(expectedFailure), `${label}: generic failure`);
    assert.ok(classification.eligibility.failures.includes(expectedFailure), `${label}: classifier failure`);
  }
  if (expectedManualReviewReason) {
    assert.ok(
      eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: generic manual review reason ${JSON.stringify(eligibility.manual_review_reasons)}`
    );
    assert.ok(
      classification.eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: classifier manual review reason ${JSON.stringify(classification.eligibility.manual_review_reasons)}`
    );
  } else {
    assert.deepStrictEqual(
      eligibility.manual_review_reasons.filter((reason) => !allowedManualReviewReasons.includes(reason)),
      [],
      `${label}: no unexpected generic manual review`
    );
    assert.deepStrictEqual(
      classification.eligibility.manual_review_reasons.filter((reason) => !allowedManualReviewReasons.includes(reason)),
      [],
      `${label}: no unexpected classifier manual review`
    );
  }

  if (expectedEpqStatus) {
    assert.strictEqual(
      classification.eligibility.epq_alternative_result?.status,
      expectedEpqStatus,
      `${label}: EPQ result status`
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

const EPQ_PATHWAY_ID = 'sheffield_epq_alternative';

assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.standard_offer.grade_profile, [
  'A',
  'A',
  'A'
]);
assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.epq_alternative_offer, {
  enabled: true,
  pathway_id: EPQ_PATHWAY_ID,
  a_level_grades: ['A', 'A', 'B'],
  epq_minimum_grade: 'A',
  required_subject_grade_options: [
    {
      option_id: 'biology_mandatory_science_grade_a',
      required_subject_ids: ['biology'],
      grade_requirements: [
        {
          subject_id: 'biology',
          minimum_grade: 'A'
        }
      ],
      one_of_subject_groups: [
        {
          group_id: 'epq_second_science_with_biology',
          minimum_required: 1,
          subject_ids: ['chemistry', 'mathematics', 'physics', 'psychology', 'human_biology']
        }
      ]
    },
    {
      option_id: 'chemistry_mandatory_science_grade_a',
      required_subject_ids: ['chemistry'],
      grade_requirements: [
        {
          subject_id: 'chemistry',
          minimum_grade: 'A'
        }
      ],
      one_of_subject_groups: [
        {
          group_id: 'epq_second_science_with_chemistry',
          minimum_required: 1,
          subject_ids: ['biology', 'human_biology', 'mathematics', 'physics', 'psychology']
        }
      ]
    }
  ],
  conditions: {
    a_level_resits_allowed: false,
    must_be_taken_alongside_a_levels: true,
    equivalent_grade_combinations_allowed: false
  },
  source_ids: ['sheffield_a100_policy_2027']
});
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(course.stage_1_eligibility.post_16.a_level, 'epq_alternative'),
  false,
  'Sheffield must use the canonical epq_alternative_offer field, not the legacy alias.'
);

assertAcademicScenario({
  label: 'AAA no EPQ',
  applicant: applicantWith(),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: null,
  expectedBand: 'interview_likely'
});
assertPublicPost16(
  'AAA no EPQ',
  applicantWith(),
  [['A-level grades', 'met', 'a_level_standard_offer']]
);

assertAcademicScenario({
  label: 'AAA EPQ planning',
  applicant: applicantWith({ epq: { status: 'planning', grade: null } }),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: null,
  expectedBand: 'interview_likely'
});
assertPublicPost16(
  'AAA EPQ planning',
  applicantWith({ epq: { status: 'planning', grade: null } }),
  [['A-level grades', 'met', 'a_level_standard_offer']]
);

for (const [label, scenario] of [
  ['AAB EPQ A Biology A', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true }
  }],
  ['AAB EPQ A Chemistry A', {
    subjects: [subject('chemistry', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'predicted', grade: 'A', taken_alongside_a_levels: true }
  }],
  ['AAB EPQ A*', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'achieved', grade: 'A*', taken_alongside_a_levels: true }
  }],
  ['A*AB EPQ A', {
    subjects: [subject('biology', 'A*'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true }
  }]
]) {
  assertAcademicScenario({
    label,
    applicant: applicantWith(scenario),
    expectedStatus: 'eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedBand: 'interview_likely',
    expectedEpqStatus: 'met'
  });
  assertPublicPost16(
    label,
    applicantWith(scenario),
    [['A-levels + EPQ', 'met', 'epq_alternative_offer']]
  );
}

for (const [label, scenario] of [
  ['AAB EPQ B', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'predicted', grade: 'B', taken_alongside_a_levels: true },
    failedCondition: 'epq_minimum_grade'
  }],
  ['A*AC EPQ A', {
    subjects: [subject('biology', 'A*'), subject('mathematics', 'A'), subject('physics', 'C')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true },
    failedCondition: 'a_level_grade_profile'
  }],
  ['ABB EPQ A*', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'B'), subject('physics', 'B')],
    epq: { status: 'achieved', grade: 'A*', taken_alongside_a_levels: true },
    failedCondition: 'a_level_grade_profile'
  }],
  ['AAB EPQ A mandatory science below A', {
    subjects: [subject('biology', 'B'), subject('mathematics', 'A'), subject('physics', 'A')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true },
    failedCondition: 'required_subject_grade_options'
  }],
  ['AAB EPQ A complete required science absent', {
    subjects: [subject('mathematics', 'A'), subject('physics', 'A'), subject('psychology', 'B')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true },
    failedCondition: 'required_subject_grade_options'
  }],
  ['AAB EPQ A not taken alongside A-levels', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: false },
    failedCondition: 'epq_must_be_taken_alongside_a_levels'
  }]
]) {
  assertAcademicScenario({
    label,
    applicant: applicantWith(scenario),
    expectedStatus: 'not_eligible',
    expectedPathway: null,
    expectedPathwayId: null,
    expectedBand: 'not_eligible',
    expectedFailure: 'a_level_requirements_not_met',
    expectedEpqStatus: 'not_met',
    expectedEpqFailedCondition: scenario.failedCondition
  });
  assertPublicPost16(
    label,
    applicantWith(scenario),
    [['A-levels + EPQ', 'not_met', 'epq_alternative_offer']]
  );
}

for (const [label, scenario, expectedReason, explanationPattern] of [
  ['AAB EPQ planning', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'planning', grade: null, taken_alongside_a_levels: true }
  }, `${EPQ_PATHWAY_ID}_epq_grade_required`, /predicted or achieved EPQ grade/i],
  ['AAB EPQ A missing alongside evidence', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'achieved', grade: 'A' }
  }, 'epq_alongside_a_levels_evidence_missing', /EPQ was taken alongside/i],
  ['AAB EPQ A missing subject evidence', {
    subjects: [subject('biology', 'A'), subject('mathematics', 'A')],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true }
  }, 'a_level_grade_evidence_missing', /A-level grade evidence/i]
]) {
  assertAcademicScenario({
    label,
    applicant: applicantWith(scenario),
    expectedStatus: 'manual_review',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedBand: 'insufficient_evidence',
    expectedManualReviewReason: expectedReason,
    expectedEpqStatus: 'information_needed'
  });
  const card = publicCardFor(course, config, applicantWith(scenario));
  assert.deepStrictEqual(
    publicPost16PathwayChecks(card.academic_requirement_checks || []).map((check) => [
      check.label,
      check.status,
      check.requirement_type
    ]),
    [['A-levels + EPQ', 'information_needed', 'epq_alternative_offer']],
    `${label}: unexpected public post-16 rows ${JSON.stringify(card.academic_requirement_checks)}`
  );
  assert.match(card.primary_explanation, explanationPattern, `${label}: explanation`);
}

assertAcademicScenario({
  label: 'AAB EPQ A A-level resit applicant',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A', 'resit'),
      subject('mathematics', 'A', 'first_sitting'),
      subject('physics', 'B', 'first_sitting')
    ],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true },
    hasResits: true
  }),
  expectedStatus: 'not_eligible',
  expectedPathway: null,
  expectedPathwayId: null,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met',
  allowedManualReviewReasons: ['ambiguous_resit_sequence'],
  expectedEpqStatus: 'not_met',
  expectedEpqFailedCondition: 'a_level_resits_not_allowed'
});
assertPublicPost16(
  'AAB EPQ A A-level resit applicant',
  applicantWith({
    subjects: [
      subject('biology', 'A', 'resit'),
      subject('mathematics', 'A', 'first_sitting'),
      subject('physics', 'B', 'first_sitting')
    ],
    epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true },
    hasResits: true
  }),
  [['A-levels + EPQ', 'not_met', 'epq_alternative_offer']]
);

assertAcademicScenario({
  label: 'AAB EPQ not taken',
  applicant: applicantWith({
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'not_taken', grade: null }
  }),
  expectedStatus: 'not_eligible',
  expectedPathway: null,
  expectedPathwayId: null,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met'
});
assertPublicPost16(
  'AAB EPQ not taken',
  applicantWith({
    subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
    epq: { status: 'not_taken', grade: null }
  }),
  [['A-level grades', 'not_met', 'a_level_standard_offer']]
);

assertAcademicScenario({
  label: 'legacy AAA applicant without EPQ object',
  applicant: applicantWith(),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: null,
  expectedBand: 'interview_likely'
});

{
  const applicant = applicantWith();
  const courseWithoutEpq = clone(course);
  delete courseWithoutEpq.stage_1_eligibility.post_16.a_level.epq_alternative_offer;
  const current = classify(applicant, course, config);
  const baseline = classify(applicant, courseWithoutEpq, config);
  assert.strictEqual(current.eligibility.status, baseline.eligibility.status);
  assert.strictEqual(current.canonical_interview_band, baseline.canonical_interview_band);
  assert.strictEqual(current.guidance_pool_id ?? null, baseline.guidance_pool_id ?? null);
  assert.strictEqual(current.selection_route_id ?? null, baseline.selection_route_id ?? null);
}

{
  const invalidStandardApplicant = applicantWith({
    subjects: [subject('mathematics', 'A'), subject('physics', 'A'), subject('psychology', 'A')]
  });
  const result = classify(invalidStandardApplicant);
  assert.strictEqual(result.eligibility.status, 'not_eligible');
  assert.strictEqual(result.eligibility.academic_pathway ?? null, null);
  assert.ok(
    result.eligibility.failures.includes('a_level_requirements_not_met'),
    'EPQ integration must not bypass Sheffield standard subject-combination failures.'
  );
}

{
  const apiResult = predict({
    universityIds: ['sheffield-a100'],
    studentProfile: applicantWith({
      subjects: [subject('biology', 'A'), subject('mathematics', 'A'), subject('physics', 'B')],
      epq: { status: 'achieved', grade: 'A', taken_alongside_a_levels: true }
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

{
  const checks = publicCardFor(
    southamptonCourse,
    southamptonConfig,
    southamptonFixture.base_applicant
  ).academic_requirement_checks || [];
  assertNoDuplicatePublicAcademicLabels(checks, 'Southampton control');
  assert.ok(
    checks.some((check) =>
      check.qualification_type === 'gcse' &&
      check.label === 'GCSEs' &&
      check.status === 'met'
    ),
    `Southampton control should keep its generic GCSE academic check: ${JSON.stringify(checks)}`
  );
  assert.ok(
    checks.some((check) =>
      check.qualification_type === 'a_level' &&
      check.label === 'A-level grades' &&
      check.status === 'met'
    ),
    `Southampton control should keep its generic A-level academic check: ${JSON.stringify(checks)}`
  );
  assert.strictEqual(
    checks.some((check) => /EPQ/i.test(check.label)),
    false,
    `Southampton control should not gain EPQ public checks: ${JSON.stringify(checks)}`
  );
}

console.log('Sheffield EPQ alternative offer activation: PASS');
